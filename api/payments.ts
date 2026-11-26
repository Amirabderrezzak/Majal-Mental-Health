import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getPaymentGateway } from "./_lib/payment-gateway.js";
import { rateLimit } from "./_lib/rate-limit.js";
import { confirmPaymentBooking } from "./_lib/confirm-booking.js";
import { validateBookingSlot, fetchConflictCandidates, holdsSlot, SESSION_MINUTES } from "./_lib/slots.js";
import { getDb, getCaller, cors } from "./_lib/db.js";

const STALE_MS = 30 * 60 * 1000;
const INSTANT_ACCEPT_WINDOW_MS = 10 * 60 * 1000;
const nowIso = () => new Date().toISOString();

/** Where the gateway sends the patient back. Never taken from a request header in production. */
function frontendUrl(req: any): string {
  if (process.env.FRONTEND_URL) return process.env.FRONTEND_URL.replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  const host = req.headers?.host;
  if (host && process.env.NODE_ENV !== "production") return `${host.includes("localhost") || host.startsWith("127.") ? "http" : "https"}://${host}`;
  return "http://localhost:8080";
}

function priceFor(profile: any, type: string): number | null {
  if (type === "couples") return profile?.price_couples ?? null;
  if (type === "adolescents") return profile?.price_adolescents ?? null;
  return profile?.price_individual ?? null;
}

// ── checkout ──────────────────────────────────────────────────────────────────
export const checkoutHandler = async (req: any, res: any) => {
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const db = getDb();
  if (!db) return res.status(500).json({ error: "Database client not configured" });
  const user = await getCaller(db, req);
  if (!user) return res.status(401).json({ error: "Invalid or expired token" });

  const limit = rateLimit(req, { key: "checkout", windowMs: 10 * 60 * 1000, max: 10, id: user.id });
  if (!limit.ok) {
    res.setHeader("Retry-After", String(limit.retryAfter ?? 60));
    return res.status(429).json({ error: "Too many requests, please try again later." });
  }

  try {
    const { psychologist_id, booked_at: rawBookedAt, duration_minutes, full_name, phone, session_type, instant_request_id } = req.body || {};
    if (!psychologist_id || (!rawBookedAt && !instant_request_id)) {
      return res.status(400).json({ error: "psychologist_id and booked_at are required" });
    }

    const { data: psy } = await db.from("profiles")
      .select("user_type, approval_status, clinic_settings, price_individual, price_couples, price_adolescents")
      .eq("user_id", psychologist_id).maybeSingle();

    let bookedAt: string;
    let type: "individual" | "couples" | "adolescents" =
      session_type === "couples" || session_type === "adolescents" ? session_type : "individual";

    if (instant_request_id) {
      // "Parler maintenant": accepted requests used to open a free, unrecorded
      // video call. They now go through checkout like any session.
      const { data: request } = await db.from("immediate_session_requests")
        .select("id, patient_id, psychologist_id, status, responded_at")
        .eq("id", instant_request_id).maybeSingle();
      if (!request || request.patient_id !== user.id || request.psychologist_id !== psychologist_id) {
        return res.status(404).json({ error: "Demande introuvable." });
      }
      if (request.status !== "accepted" || !request.responded_at || Date.now() - new Date(request.responded_at).getTime() > INSTANT_ACCEPT_WINDOW_MS) {
        return res.status(400).json({ error: "Cette demande n'est plus valable. Faites une nouvelle demande." });
      }
      if (!psy || psy.user_type !== "psychologue" || psy.approval_status !== "approved") {
        return res.status(400).json({ error: "Ce psychologue n'accepte pas de réservations." });
      }
      type = "individual";
      const start = new Date();
      start.setUTCSeconds(0, 0);
      bookedAt = start.toISOString();
      const candidates = await fetchConflictCandidates(db, psychologist_id, start);
      const end = start.getTime() + SESSION_MINUTES * 60000;
      const clash = candidates.some((b) => {
        if (!holdsSlot(b, new Date()) || b.status === "done" || b.status === "no-show") return false;
        if (b.patient_id === user.id && b.status === "pending") return false;
        const bs = new Date(b.booked_at).getTime();
        return start.getTime() < bs + (b.duration_minutes ?? SESSION_MINUTES) * 60000 && end > bs;
      });
      if (clash) return res.status(409).json({ error: "Le psychologue a une séance prévue maintenant." });
    } else {
      const start = new Date(String(rawBookedAt));
      const check = validateBookingSlot({
        bookedAt: rawBookedAt,
        duration: duration_minutes,
        patientId: user.id,
        psychologistId: psychologist_id,
        psychologist: psy,
        existing: Number.isNaN(start.getTime()) ? [] : await fetchConflictCandidates(db, psychologist_id, start),
      });
      if (!check.ok) return res.status(check.status).json({ error: check.error });
      bookedAt = check.start.toISOString();

      // "Accepting new patients" used to be a switch that did nothing.
      if ((psy?.clinic_settings as any)?.acceptingNew === false) {
        const { count } = await db.from("bookings").select("id", { count: "exact", head: true })
          .eq("patient_id", user.id).eq("psychologist_id", psychologist_id).in("status", ["confirmed", "done", "no-show"]);
        if (!count) return res.status(409).json({ error: "Ce psychologue n'accepte pas de nouveaux patients pour le moment." });
      }
    }

    const price = priceFor(psy, type);
    if (price == null) return res.status(400).json({ error: "Ce type de séance n'est pas proposé" });

    const { count: openReservations } = await db.from("bookings").select("id", { count: "exact", head: true })
      .eq("patient_id", user.id).eq("status", "pending")
      .gt("created_at", new Date(Date.now() - STALE_MS).toISOString())
      .neq("booked_at", bookedAt);
    if ((openReservations ?? 0) >= 2) {
      return res.status(429).json({ error: "Vous avez déjà des réservations en attente de paiement. Terminez-les ou attendez quelques minutes." });
    }

    // Supersede this patient's own unfinished payments for the same slot.
    await db.from("payments").update({ status: "cancelled", updated_at: nowIso() })
      .eq("patient_id", user.id).eq("psychologist_id", psychologist_id).eq("booked_at", bookedAt).eq("status", "initiated");

    // Free abandoned reservations for this slot, then hold it.
    await db.from("bookings").update({ status: "cancelled", cancelled_by: "system", updated_at: nowIso() })
      .eq("psychologist_id", psychologist_id).eq("booked_at", bookedAt).eq("status", "pending")
      .lt("created_at", new Date(Date.now() - STALE_MS).toISOString());

    const { data: existingBooking } = await db.from("bookings").select("id, patient_id, status")
      .eq("psychologist_id", psychologist_id).eq("booked_at", bookedAt).neq("status", "cancelled").maybeSingle();

    let bookingId: string;
    if (existingBooking) {
      if (existingBooking.patient_id !== user.id || existingBooking.status !== "pending") {
        return res.status(409).json({ error: "Ce créneau est déjà réservé." });
      }
      bookingId = existingBooking.id;
      await db.from("bookings").update({ price, session_type: type, created_at: nowIso() }).eq("id", bookingId);
    } else {
      const { data: inserted, error: insErr } = await db.from("bookings").insert({
        patient_id: user.id,
        psychologist_id,
        booked_at: bookedAt,
        duration_minutes: SESSION_MINUTES,
        status: "pending",
        price,
        session_type: type,
        session_kind: instant_request_id ? "instant" : "scheduled",
        instant_request_id: instant_request_id ?? null,
      }).select("id").single();
      if (insErr || !inserted) {
        if ((insErr as any)?.code === "23505") return res.status(409).json({ error: "Ce créneau est déjà réservé." });
        console.error("Reservation insert error:", insErr);
        return res.status(500).json({ error: "Failed to reserve the slot" });
      }
      bookingId = inserted.id;
    }

    const { data: payment, error: payErr } = await db.from("payments").insert({
      patient_id: user.id,
      psychologist_id,
      booked_at: bookedAt,
      duration_minutes: SESSION_MINUTES,
      price,
      session_type: type,
      status: "initiated",
      booking_id: bookingId,
      instant_request_id: instant_request_id ?? null,
    }).select().single();
    if (payErr || !payment) {
      console.error("Payment insert error:", payErr);
      return res.status(500).json({ error: "Failed to create payment record" });
    }

    const gateway = getPaymentGateway();
    const isMock = !process.env.SOFIZPAY_PUBLIC_KEY;
    const result = await gateway.createCheckout({
      payment_id: payment.id,
      amount: price,
      full_name: typeof full_name === "string" && full_name.trim() ? full_name.trim().slice(0, 100) : "Patient",
      phone: typeof phone === "string" && phone.trim() ? phone.trim().slice(0, 20) : "0000000000",
      email: user.email || `patient-${user.id.slice(0, 8)}@majal.dz`,
      memo: "Majal - Séance thérapie",
    }, `${frontendUrl(req)}/payment/return?payment_id=${payment.id}`);

    await db.from("payments").update({ sofizpay_transaction_id: result.cib_transaction_id, status: "pending" }).eq("id", payment.id);

    res.json({ url: result.payment_url, payment_id: payment.id, booking_id: bookingId, amount: price, mock: isMock });
  } catch (err: any) {
    console.error("Checkout error:", err);
    const msg = err?.message || "Internal server error";
    if (msg === "Payment gateway not configured" || msg.includes("SofizPay")) return res.status(402).json({ error: msg });
    res.status(500).json({ error: "Internal server error" });
  }
};

// ── confirm ───────────────────────────────────────────────────────────────────
export const confirmHandler = async (req: any, res: any) => {
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const db = getDb();
  if (!db) return res.status(500).json({ error: "Database client not configured" });
  const user = await getCaller(db, req);
  if (!user) return res.status(401).json({ error: "Invalid or expired token" });

  try {
    const result = await confirmPaymentBooking(db, req.body?.payment_id, user.id);
    return res.status(result.status).json(result.body);
  } catch (err: any) {
    console.error("Confirm error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

// NOTE: there is deliberately no gateway webhook: SofizPay's CIB flow only
// redirects the browser to return_url. Payments whose capture is still in
// progress at that moment are re-verified by the scheduled job
// (api/notifications.ts → reconcilePayments) instead of being dropped.

export default async function handler(req: VercelRequest, res: VercelResponse) {
  switch (req.query.action as string) {
    case "checkout": return checkoutHandler(req, res);
    case "confirm": return confirmHandler(req, res);
    default: return res.status(400).json({ error: "Unknown or missing action" });
  }
}

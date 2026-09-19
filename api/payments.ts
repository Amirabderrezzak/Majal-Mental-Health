import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { getPaymentGateway, CheckoutParams } from "./_lib/payment-gateway.js";
import { rateLimit } from "./_lib/rate-limit.js";
import { confirmPaymentBooking } from "./_lib/confirm-booking.js";
import { validateBookingSlot, fetchConflictCandidates, SESSION_MINUTES } from "./_lib/slots.js";

function cors(res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

// ── checkout ───────────────────────────────────────────────────────────────────
const checkoutSupabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const checkoutSupabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

let checkoutSupabase: any;
try {
  if (checkoutSupabaseUrl && checkoutSupabaseKey) {
    checkoutSupabase = createClient(checkoutSupabaseUrl, checkoutSupabaseKey);
  }
} catch (e) {
  console.error("Failed to initialize Supabase client in checkout:", e);
}

export const checkoutHandler = async (req: any, res: any) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!checkoutSupabase) {
    return res.status(500).json({ error: "Database client not configured" });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing authorization header" });
  }

  const token = authHeader.split(" ")[1];
  const { data: { user }, error: authError } = await checkoutSupabase.auth.getUser(token);
  if (authError || !user) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  // Abuse protection: 10 checkouts per 10 minutes per client IP (each creates a
  // payment + hits the gateway, so cap cost-abuse). Applied after auth, before
  // the heavy DB/gateway work.
  const limit = rateLimit(req, { key: "checkout", windowMs: 10 * 60 * 1000, max: 10 });
  if (!limit.ok) {
    res.setHeader("Retry-After", String(limit.retryAfter ?? 60));
    return res.status(429).json({ error: "Too many requests, please try again later." });
  }

  try {
    const { psychologist_id, booked_at: rawBookedAt, duration_minutes, full_name, phone, session_type } = req.body || {};

    if (!psychologist_id || !rawBookedAt) {
      return res.status(400).json({ error: "psychologist_id and booked_at are required" });
    }

    const { data: psyProfile } = await checkoutSupabase
      .from("profiles")
      .select("user_type, approval_status, clinic_settings, price_individual, price_couples, price_adolescents")
      .eq("user_id", psychologist_id)
      .maybeSingle();

    // Server-side validation of the requested slot (approval, vacation, working
    // hours/days in Algeria time, buffer, overlaps, past dates, duration).
    // The UI already filters these, but the API must not trust the browser.
    const conflicts = await fetchConflictCandidates(checkoutSupabase, psychologist_id, new Date(String(rawBookedAt)));
    const check = validateBookingSlot({
      bookedAt: rawBookedAt,
      duration: duration_minutes,
      patientId: user.id,
      psychologistId: psychologist_id,
      psychologist: psyProfile,
      existing: Number.isNaN(new Date(String(rawBookedAt)).getTime()) ? [] : conflicts,
    });
    if (!check.ok) {
      return res.status(check.status).json({ error: check.error });
    }
    const booked_at = check.start.toISOString();

    // Server-side price selection — never trust a client-sent price.
    const type = session_type === "couples" || session_type === "adolescents"
      ? session_type
      : "individual";
    let price: number | null = null;
    if (type === "couples") price = psyProfile?.price_couples ?? null;
    else if (type === "adolescents") price = psyProfile?.price_adolescents ?? null;
    else price = psyProfile?.price_individual ?? null;

    if (price == null) {
      return res.status(400).json({ error: "Ce type de séance n'est pas proposé" });
    }

    // One patient may hold at most 2 unpaid reservations at a time, so a single
    // account cannot lock a therapist's whole calendar by abandoning checkouts.
    const { count: openReservations } = await checkoutSupabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("patient_id", user.id)
      .eq("status", "pending")
      .gt("created_at", new Date(Date.now() - 30 * 60 * 1000).toISOString())
      .neq("booked_at", booked_at);
    if ((openReservations ?? 0) >= 2) {
      return res.status(429).json({ error: "Vous avez déjà des réservations en attente de paiement. Terminez-les ou attendez quelques minutes." });
    }

    // A previous unfinished payment by the same patient for this exact slot is
    // superseded by the new one (the DB has no stored payment URL to resume).
    const { data: existing } = await checkoutSupabase
      .from("payments")
      .select("id, status, patient_id")
      .eq("psychologist_id", psychologist_id)
      .eq("booked_at", booked_at)
      .in("status", ["initiated", "pending"])
      .maybeSingle();
    if (existing && existing.patient_id === user.id) {
      await checkoutSupabase
        .from("payments")
        .update({ status: "cancelled", updated_at: new Date().toISOString() })
        .eq("id", existing.id);
    }

    // Reserve the slot so the calendar shows it as taken immediately and two
    // patients can never end up with the same time.
    // 1) Free abandoned reservations (pending > 30 min old) for this slot.
    await checkoutSupabase
      .from("bookings")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("psychologist_id", psychologist_id)
      .eq("booked_at", booked_at)
      .eq("status", "pending")
      .lt("created_at", new Date(Date.now() - 30 * 60 * 1000).toISOString());

    // 2) Reuse an existing reservation owned by this patient, otherwise block
    //    if the slot is already taken by someone else.
    const { data: existingBooking } = await checkoutSupabase
      .from("bookings")
      .select("id, patient_id, status")
      .eq("psychologist_id", psychologist_id)
      .eq("booked_at", booked_at)
      .neq("status", "cancelled")
      .maybeSingle();

    if (existingBooking) {
      if (existingBooking.patient_id !== user.id) {
        return res.status(409).json({ error: "Ce créneau est déjà réservé." });
      }
    } else {
      const { error: bookingInsertErr } = await checkoutSupabase
        .from("bookings")
        .insert({
          patient_id: user.id,
          psychologist_id,
          booked_at,
          duration_minutes: SESSION_MINUTES,
          status: "pending",
          price,
        });
      if (bookingInsertErr) {
        console.error("Reservation insert error:", bookingInsertErr);
        return res.status(500).json({ error: "Failed to reserve the slot" });
      }
    }

    const { data: payment, error: insertError } = await checkoutSupabase
      .from("payments")
      .insert({
        patient_id: user.id,
        psychologist_id,
        booked_at,
        duration_minutes: SESSION_MINUTES,
        price,
        session_type: type,
        status: "initiated",
      })
      .select()
      .single();

    if (insertError || !payment) {
      console.error("Payment insert error:", insertError);
      return res.status(500).json({ error: "Failed to create payment record" });
    }

    const origin = req.headers.origin || (req.headers.host
      ? `${req.headers.host.includes("localhost") ? "http" : "https"}://${req.headers.host}`
      : null);
    const FRONTEND_URL = origin || process.env.FRONTEND_URL || (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:8080");

    const returnUrl = `${FRONTEND_URL}/payment/return?payment_id=${payment.id}`;

    const gateway = getPaymentGateway();
    const isMock = !process.env.SOFIZPAY_PUBLIC_KEY;
    const result = await gateway.createCheckout({
      payment_id: payment.id,
      amount: price,
      full_name: full_name || "Patient",
      phone: phone || "0000000000",
      email: user.email || `patient-${user.id.slice(0, 8)}@majal.dz`,
      memo: `Majal - Séance thérapie`,
    }, returnUrl);

    await checkoutSupabase
      .from("payments")
      .update({
        sofizpay_transaction_id: result.cib_transaction_id,
        status: "pending",
      })
      .eq("id", payment.id);

    res.json({
      url: result.payment_url,
      payment_id: payment.id,
      cib_transaction_id: result.cib_transaction_id,
      mock: isMock,
    });
  } catch (err: any) {
    console.error("Checkout error:", err);
    const msg = err.message || "Internal server error";
    // Fail closed: an unconfigured gateway in production must not fall back to
    // the free mock. Surface it (402 mirrors a payment problem).
    if (msg === "Payment gateway not configured" || msg.includes("SofizPay")) {
      return res.status(402).json({ error: msg });
    }
    res.status(500).json({ error: msg });
  }
};

// ── confirm ───────────────────────────────────────────────────────────────────
const confirmSupabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const confirmSupabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

let confirmSupabase: any;
try {
  if (confirmSupabaseUrl && confirmSupabaseKey) {
    confirmSupabase = createClient(confirmSupabaseUrl, confirmSupabaseKey);
  }
} catch (e) {
  console.error("Failed to initialize Supabase client in confirm:", e);
}

export const confirmHandler = async (req: any, res: any) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!confirmSupabase) {
    return res.status(500).json({ error: "Database client not configured" });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing authorization header" });
  }

  const token = authHeader.split(" ")[1];
  const { data: { user }, error: authError } = await confirmSupabase.auth.getUser(token);
  if (authError || !user) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  try {
    const { payment_id } = req.body;

    const result = await confirmPaymentBooking(confirmSupabase, payment_id, user.id);
    return res.status(result.status).json(result.body);
  } catch (err: any) {
    console.error("Confirm error:", err);
    res.status(500).json({ error: err.message || "Internal server error" });
  }
};

// NOTE: there used to be a `webhook` action here, mirroring `confirm` but
// intended for SofizPay to call back directly. It's removed: SofizPay's
// createCheckout request (api/_lib/payment-gateway.ts) never registers a
// notify/webhook URL with the gateway — it only redirects the user's browser
// to `return_url` — and the handler required a user Bearer JWT, which no
// real gateway callback could ever supply. It was unreachable dead code.
// `confirm` (called from PaymentReturn.tsx after the redirect back) is the
// actual completion path; both ultimately call the same confirmPaymentBooking
// gateway re-verification. If SofizPay is later confirmed to support async
// server-to-server callbacks, reintroduce this action secured by the
// (currently unused) WEBHOOK_SECRET env var instead of a user JWT.

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const action = req.query.action as string;

  switch (action) {
    case "checkout":
      return checkoutHandler(req, res);
    case "confirm":
      return confirmHandler(req, res);
    default:
      return res.status(400).json({ error: "Unknown or missing action" });
  }
}

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { sendSessionReminder, sendNoShowNotification } from "./_lib/email.js";
import { calculateRefund } from "./_lib/cancellation-policy.js";
import { formatAlgiersLong } from "./_lib/slots.js";
import { getDb, getCaller, cors, getContact, wantsEmail } from "./_lib/db.js";
import { sendPushToUser, flushPushes, notify } from "./_lib/push.js";
import { attendance } from "./_lib/daily.js";
import { finalizePayment } from "./_lib/confirm-booking.js";
import { recordRefund } from "./_lib/refunds.js";

const STALE_MS = 30 * 60 * 1000;
const PAYMENT_RECHECK_MAX_MS = 48 * 3600 * 1000;
const GRACE_MS = 15 * 60 * 1000;
const nowIso = () => new Date().toISOString();

// Reject unless the caller knows CRON_SECRET (x-cron-secret or Bearer). Unset
// secret = locked.
function isCronAuthorized(req: any): boolean {
  const secret = process.env.CRON_SECRET || "";
  if (!secret) return false;
  const auth = req.headers?.authorization;
  const bearer = typeof auth === "string" && auth.startsWith("Bearer ") ? auth.slice(7) : null;
  return (req.headers?.["x-cron-secret"] || bearer) === secret;
}

// ── preferences ──────────────────────────────────────────────────────────────
export const preferencesHandler = async (req: VercelRequest, res: VercelResponse) => {
  cors(res, "GET, POST, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();
  const db = getDb();
  if (!db) return res.status(500).json({ error: "Database not configured" });
  const user = await getCaller(db, req);
  if (!user) return res.status(401).json({ error: "Invalid token" });

  if (req.method === "GET") {
    const { data } = await db.from("profiles").select("push_notifications_enabled").eq("user_id", user.id).maybeSingle();
    return res.status(200).json({ push_enabled: data?.push_notifications_enabled ?? false });
  }
  if (req.method === "POST") {
    const { push_enabled } = req.body || {};
    if (typeof push_enabled !== "boolean") return res.status(400).json({ error: "push_enabled must be a boolean" });
    const { error } = await db.from("profiles").update({ push_notifications_enabled: push_enabled }).eq("user_id", user.id);
    if (error) return res.status(500).json({ error: "Failed to save preference" });
    return res.status(200).json({ push_enabled });
  }
  return res.status(405).json({ error: "Method not allowed" });
};

// ── send-push: a user may only push to their own devices (test button) ──────────
export const sendPushHandler = async (req: any, res: any) => {
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const db = getDb();
  if (!db) return res.status(500).json({ error: "Database client not configured" });
  const user = await getCaller(db, req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });
  const { title, body, url } = req.body || {};
  if (!title || !body) return res.status(400).json({ error: "title and body are required" });
  const result = await sendPushToUser(db, user.id, String(title).slice(0, 120), String(body).slice(0, 300), typeof url === "string" && url.startsWith("/") ? url : "/");
  res.json({ success: true, ...result });
};

// ── scheduled job steps ─────────────────────────────────────────────────────────

/** Re-asks the gateway about payments whose capture was still in progress. */
async function reconcilePayments(db: any) {
  const out = { confirmed: 0, failed: 0, stillPending: 0 };
  const { data: payments } = await db.from("payments").select("*")
    .in("status", ["initiated", "pending"])
    .lt("created_at", new Date(Date.now() - 5 * 60 * 1000).toISOString())
    .order("created_at", { ascending: true }).limit(100);
  for (const p of payments ?? []) {
    const age = Date.now() - new Date(p.created_at).getTime();
    if (p.status === "initiated" && age > STALE_MS) {
      // Never reached the gateway (checkout crashed or tab closed before redirect).
      await db.from("payments").update({ status: "failed", updated_at: nowIso() }).eq("id", p.id).eq("status", "initiated");
      out.failed++;
      continue;
    }
    try {
      const r = await finalizePayment(db, p);
      if (r.status === 200) out.confirmed++;
      else if (r.status === 202) {
        if (age > PAYMENT_RECHECK_MAX_MS) {
          await db.from("payments").update({ status: "failed", updated_at: nowIso() }).eq("id", p.id);
          out.failed++;
        } else out.stillPending++;
      } else out.failed++;
    } catch (err) {
      console.error(`reconcile payment ${p.id} failed:`, err);
      out.stillPending++;
    }
  }
  return out;
}

/** Releases abandoned reservations — but not ones whose bank capture is still in flight. */
async function releaseStaleReservations(db: any) {
  const { data: stale } = await db.from("bookings").select("id")
    .eq("status", "pending").lt("created_at", new Date(Date.now() - STALE_MS).toISOString()).limit(500);
  let released = 0;
  for (const b of stale ?? []) {
    const { data: live } = await db.from("payments").select("id").eq("booking_id", b.id).eq("status", "pending").limit(1);
    if (live && live.length > 0) continue;
    const { data } = await db.from("bookings").update({ status: "cancelled", cancelled_by: "system", updated_at: nowIso() })
      .eq("id", b.id).eq("status", "pending").select("id");
    released += data?.length ?? 0;
  }
  return released;
}

/** One reminder per session, for sessions tomorrow (Algiers calendar day). */
async function sendReminders(db: any) {
  const OFFSET = 60 * 60 * 1000; // Algeria: UTC+1, no DST
  const a = new Date(Date.now() + OFFSET);
  const startOfToday = Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate()) - OFFSET;
  const { data: sessions } = await db.from("bookings")
    .select("id, patient_id, psychologist_id, booked_at, duration_minutes")
    .eq("status", "confirmed").is("reminder_sent_at", null)
    .gte("booked_at", new Date(startOfToday + 86400000).toISOString())
    .lt("booked_at", new Date(startOfToday + 2 * 86400000).toISOString());
  let sent = 0;
  for (const s of sessions ?? []) {
    const { data: claimed } = await db.from("bookings").update({ reminder_sent_at: nowIso() }).eq("id", s.id).is("reminder_sent_at", null).select("id");
    if (!claimed || claimed.length === 0) continue;
    const [patient, psy] = await Promise.all([getContact(db, s.patient_id), getContact(db, s.psychologist_id)]);
    const date = formatAlgiersLong(s.booked_at);
    try {
      if (patient.email) {
        await sendSessionReminder({ recipientEmail: patient.email, recipientName: patient.name || "Patient", partnerName: psy.name || "Psychologue", date, duration: s.duration_minutes, userType: "patient" });
        sent++;
      }
      if (psy.email && wantsEmail(psy, "reminders")) {
        await sendSessionReminder({ recipientEmail: psy.email, recipientName: psy.name || "Psychologue", partnerName: patient.name || "Patient", date, duration: s.duration_minutes, userType: "psychologue" });
        sent++;
      }
      await notify(db, s.patient_id, "Rappel de séance", `Votre séance avec ${psy.name || "votre psychologue"} a lieu le ${date}.`, "/mon-espace?page=sessions");
    } catch (err) {
      console.error(`reminder for ${s.id} failed:`, err);
    }
  }
  return sent;
}

/**
 * Closes sessions that have ended, from who actually joined the room.
 * Both joined → done. Only the therapist → patient no-show (no refund).
 * Only the patient, or nobody → the therapist missed it: full refund.
 * (Previously "no room" counted as the patient's absence even though only the
 * therapist could open the room.)
 */
async function closeEndedSessions(db: any) {
  const out = { done: 0, patientNoShow: 0, therapistNoShow: 0, bothAbsent: 0, skipped: 0 };
  const { data: sessions } = await db.from("bookings")
    .select("id, patient_id, psychologist_id, booked_at, duration_minutes, video_room_url, price")
    .eq("status", "confirmed").lte("booked_at", new Date(Date.now() - GRACE_MS).toISOString())
    .order("booked_at", { ascending: true }).limit(100);

  for (const s of sessions ?? []) {
    const start = new Date(s.booked_at).getTime();
    const end = start + (s.duration_minutes || 60) * 60000;
    if (end + GRACE_MS > Date.now()) continue;

    let present: Record<string, boolean> | null;
    if (!s.video_room_url) present = { [s.patient_id]: false, [s.psychologist_id]: false };
    else present = await attendance(s.video_room_url, start - 30 * 60000, end + 30 * 60000, [s.patient_id, s.psychologist_id]);
    if (!present) { out.skipped++; continue; } // Daily unreachable: decide next run

    const patientIn = present[s.patient_id];
    const psyIn = present[s.psychologist_id];
    if (patientIn && psyIn) {
      await db.from("bookings").update({ status: "done", updated_at: nowIso() }).eq("id", s.id).eq("status", "confirmed");
      out.done++;
      continue;
    }
    const party: "patient" | "psychologist" | "both" = psyIn ? "patient" : patientIn ? "psychologist" : "both";
    const { data: flagged } = await db.from("bookings")
      .update({ status: "no-show", no_show_party: party, no_show_detected_at: nowIso(), updated_at: nowIso() })
      .eq("id", s.id).eq("status", "confirmed").select("id");
    if (!flagged || flagged.length === 0) continue;

    const policy = party === "patient" ? calculateRefund(new Date(start), new Date()) : { refundPercent: 100, compensationPercent: 0 };
    if (party !== "patient") await recordRefund(db, s, 100, 0, party === "psychologist" ? "therapist_no_show" : "both_absent");
    else await recordRefund(db, s, policy.refundPercent, policy.compensationPercent, "patient_cancel");

    const [patient, psy] = await Promise.all([getContact(db, s.patient_id), getContact(db, s.psychologist_id)]);
    const date = formatAlgiersLong(s.booked_at);
    const patientMsg = party === "patient"
      ? `Vous n'avez pas rejoint la séance du ${date}. Aucun remboursement ne sera effectué.`
      : party === "psychologist"
        ? `Votre psychologue n'a pas rejoint la séance du ${date}. Vous serez intégralement remboursé(e).`
        : `La séance du ${date} n'a pas eu lieu. Vous serez intégralement remboursé(e).`;
    const psyMsg = party === "patient"
      ? `${patient.name || "Le patient"} ne s'est pas présenté à la séance du ${date}. Compensation de ${policy.compensationPercent}%.`
      : `Vous n'avez pas rejoint la séance du ${date}. Le patient est remboursé.`;
    await notify(db, s.patient_id, party === "patient" ? "Séance manquée" : "Séance non assurée", patientMsg, "/mon-espace?page=sessions");
    await notify(db, s.psychologist_id, party === "patient" ? "Patient absent" : "Séance manquée", psyMsg, "/espace-psy?page=sessions");

    const common = { date, absent: party, refundPercent: policy.refundPercent, compensationPercent: policy.compensationPercent } as const;
    if (patient.email) await sendNoShowNotification({ ...common, recipientEmail: patient.email, recipientName: patient.name || "Patient", partnerName: psy.name || "Psychologue", userType: "patient" }).catch(console.error);
    if (psy.email) await sendNoShowNotification({ ...common, recipientEmail: psy.email, recipientName: psy.name || "Psychologue", partnerName: patient.name || "Patient", userType: "psychologue" }).catch(console.error);

    if (party === "patient") out.patientNoShow++; else if (party === "psychologist") out.therapistNoShow++; else out.bothAbsent++;
  }
  return out;
}

// ── push-cron ──────────────────────────────────────────────────────────────────
// Vercel Hobby only allows a daily cron. Each step is idempotent, so the same URL
// can additionally be called hourly by any external scheduler with CRON_SECRET
// (recommended: missed sessions and refunds are then settled within the hour).
export const pushCronHandler = async (req: any, res: any) => {
  if (!isCronAuthorized(req)) return res.status(401).json({ error: "Unauthorized" });
  if (req.method !== "GET" && req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const db = getDb();
  if (!db) return res.status(500).json({ error: "Database client not configured" });

  try {
    const payments = await reconcilePayments(db);
    const releasedReservations = await releaseStaleReservations(db);
    const reminders = await sendReminders(db);
    const sessions = await closeEndedSessions(db);
    await db.rpc("expire_immediate_requests");
    const { data: closedRooms } = await db.from("audio_rooms").update({ is_live: false }).eq("is_live", true).lt("ends_at", nowIso()).select("id");
    const pushes = await flushPushes(db, undefined, 1000);
    res.json({ success: true, payments, releasedReservations, reminders, sessions, closedAudioRooms: closedRooms?.length ?? 0, pushes });
  } catch (err: any) {
    console.error("Push cron error:", err);
    res.status(500).json({ error: "Cron failed" });
  }
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Vercel Cron authenticates with `Authorization: Bearer <CRON_SECRET>`.
  const action = (req.query.action as string) || (isCronAuthorized(req) ? "push-cron" : null);
  switch (action) {
    case "preferences": return preferencesHandler(req, res);
    case "send-push": return sendPushHandler(req, res);
    case "push-cron": return pushCronHandler(req, res);
    default: return res.status(400).json({ error: "Unknown or missing action" });
  }
}

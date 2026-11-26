import type { VercelRequest, VercelResponse } from "@vercel/node";
import { sendRescheduleConfirmation, sendBookingStatusUpdate, sendCancellationConfirmation } from "./_lib/email.js";
import { calculateRefund } from "./_lib/cancellation-policy.js";
import { validateBookingSlot, fetchConflictCandidates, formatAlgiersLong } from "./_lib/slots.js";
import { getDb, getCaller, cors, getContact } from "./_lib/db.js";
import { flushPushes, notify } from "./_lib/push.js";
import { recordRefund, refundBasis } from "./_lib/refunds.js";
import { attendance } from "./_lib/daily.js";

const RESCHEDULE_MIN_NOTICE_MS = 2 * 3600 * 1000;
const MAX_RESCHEDULES = 2;
const nowIso = () => new Date().toISOString();

// ── reschedule ─────────────────────────────────────────────────────────────────
export const rescheduleHandler = async (req: VercelRequest, res: VercelResponse) => {
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const db = getDb();
  if (!db) return res.status(500).json({ error: "Database client not configured" });
  const user = await getCaller(db, req);
  if (!user) return res.status(401).json({ error: "Invalid token" });

  const { booking_id, new_booked_at } = req.body || {};
  if (!booking_id || !new_booked_at) return res.status(400).json({ error: "booking_id and new_booked_at are required" });

  const { data: booking } = await db.from("bookings")
    .select("id, patient_id, psychologist_id, status, booked_at, policy_anchor_at, reschedule_count, session_kind")
    .eq("id", booking_id).maybeSingle();
  if (!booking) return res.status(404).json({ error: "Booking not found" });
  if (booking.patient_id !== user.id) return res.status(403).json({ error: "Not authorized" });
  if (booking.status !== "confirmed") return res.status(400).json({ error: "Seules les séances confirmées peuvent être reportées." });
  if (booking.session_kind === "instant") return res.status(400).json({ error: "Une séance immédiate ne peut pas être reportée." });
  if (new Date(booking.booked_at).getTime() - Date.now() < RESCHEDULE_MIN_NOTICE_MS) {
    return res.status(400).json({ error: "Une séance ne peut plus être reportée moins de 2 heures avant son début." });
  }
  // Unlimited moves let a patient hold a therapist's calendar indefinitely.
  if ((booking.reschedule_count ?? 0) >= MAX_RESCHEDULES) {
    return res.status(400).json({ error: `Cette séance a déjà été reportée ${MAX_RESCHEDULES} fois. Annulez-la puis réservez un nouveau créneau.` });
  }

  const { data: psy } = await db.from("profiles").select("user_type, approval_status, clinic_settings").eq("user_id", booking.psychologist_id).maybeSingle();
  const target = new Date(String(new_booked_at));
  const check = validateBookingSlot({
    bookedAt: new_booked_at,
    patientId: user.id,
    psychologistId: booking.psychologist_id,
    psychologist: psy as any,
    existing: Number.isNaN(target.getTime()) ? [] : await fetchConflictCandidates(db, booking.psychologist_id, target),
    ignoreBookingId: booking.id,
  });
  if (!check.ok) return res.status(check.status).json({ error: check.error });

  const newBookedAt = check.start.toISOString();
  const oldBookedAt = booking.booked_at;
  const anchor = new Date(Math.min(
    refundBasis(booking).getTime(),
    new Date(oldBookedAt).getTime(),
    check.start.getTime(),
  )).toISOString();

  const { data: updated, error: updateError } = await db.from("bookings")
    .update({
      booked_at: newBookedAt,
      video_room_url: null, // a new slot gets a fresh room
      policy_anchor_at: anchor,
      reschedule_count: (booking.reschedule_count ?? 0) + 1,
      reminder_sent_at: null,
      updated_at: nowIso(),
    })
    .eq("id", booking_id).eq("status", "confirmed").eq("booked_at", oldBookedAt)
    .select("id");
  if (updateError) {
    if ((updateError as any).code === "23505") return res.status(409).json({ error: "Ce créneau n'est plus disponible." });
    console.error("Reschedule update error:", updateError);
    return res.status(500).json({ error: "Failed to reschedule" });
  }
  if (!updated || updated.length === 0) return res.status(409).json({ error: "La séance a changé entre-temps. Rechargez la page." });

  const newDateStr = formatAlgiersLong(newBookedAt);
  const oldDateStr = formatAlgiersLong(oldBookedAt);
  const [patient, therapist] = await Promise.all([getContact(db, booking.patient_id), getContact(db, booking.psychologist_id)]);

  await notify(db, booking.psychologist_id, "Séance reportée",
    `${patient.name || "Le patient"} a reporté la séance du ${oldDateStr} au ${newDateStr}.`, "/espace-psy?page=sessions");
  await flushPushes(db, [booking.psychologist_id]).catch(console.error);

  if (patient.email) {
    sendRescheduleConfirmation({ recipientEmail: patient.email, recipientName: patient.name || "Patient", partnerName: therapist.name || "Thérapeute", oldDate: oldDateStr, newDate: newDateStr, userType: "patient" }).catch(console.error);
  }
  if (therapist.email) {
    sendRescheduleConfirmation({ recipientEmail: therapist.email, recipientName: therapist.name || "Thérapeute", partnerName: patient.name || "Patient", oldDate: oldDateStr, newDate: newDateStr, userType: "psychologue" }).catch(console.error);
  }
  return res.status(200).json({ success: true, booked_at: newBookedAt, reschedules_left: MAX_RESCHEDULES - (booking.reschedule_count ?? 0) - 1 });
};

// ── update-status ──────────────────────────────────────────────────────────────
export const updateStatusHandler = async (req: any, res: any) => {
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const db = getDb();
  if (!db) return res.status(500).json({ error: "Database client configuration error" });
  const user = await getCaller(db, req);
  if (!user) return res.status(401).json({ error: "Unauthorized: Invalid token" });

  try {
    const { booking_id, status } = req.body || {};
    if (!booking_id || !status) return res.status(400).json({ error: "booking_id and status are required" });
    if (!["confirmed", "cancelled", "done"].includes(status)) return res.status(400).json({ error: "Invalid status" });

    const { data: booking } = await db.from("bookings")
      .select("id, booked_at, duration_minutes, status, patient_id, psychologist_id, price, policy_anchor_at, video_room_url")
      .eq("id", booking_id).maybeSingle();
    if (!booking) return res.status(404).json({ error: "Booking not found" });

    const isPatient = booking.patient_id === user.id;
    const isTherapist = booking.psychologist_id === user.id;
    if (!isPatient && !isTherapist) return res.status(403).json({ error: "Forbidden: You do not have permission to modify this booking" });
    if (isPatient && status !== "cancelled") return res.status(400).json({ error: "Patients are only allowed to cancel bookings" });

    // "confirmed" is only ever reached through a verified payment.
    if (status === "confirmed") return res.status(400).json({ error: "Une réservation est confirmée automatiquement après paiement." });
    if (booking.status === "cancelled") return res.status(400).json({ error: "Cette séance est déjà annulée." });
    if (booking.status === "done" || booking.status === "no-show") return res.status(400).json({ error: "Cette séance est déjà terminée." });

    const start = new Date(booking.booked_at).getTime();
    const end = start + (booking.duration_minutes || 60) * 60000;
    if (status === "done" && (booking.status !== "confirmed" || start > Date.now())) {
      return res.status(400).json({ error: "Une séance ne peut être terminée qu'après son début." });
    }
    if (status === "done") {
      // "Done" settles the money in the therapist's favour, so it requires the
      // patient to have actually been in the room (otherwise a therapist who
      // never showed up could close the session and avoid the refund).
      const present = booking.video_room_url
        ? await attendance(booking.video_room_url, start - 30 * 60000, end + 30 * 60000, [booking.patient_id, booking.psychologist_id])
        : { [booking.patient_id]: false, [booking.psychologist_id]: false };
      if (present && !(present[booking.patient_id] && present[booking.psychologist_id])) {
        return res.status(400).json({ error: "La présence des deux participants n'est pas confirmée dans le salon vidéo. La séance sera clôturée automatiquement." });
      }
    }
    if (status === "cancelled") {
      // Cancelling after the start is a missed session, handled by the
      // attendance check — not a cancellation with a refund tier.
      if (isPatient && booking.status === "confirmed" && start <= Date.now()) {
        return res.status(400).json({ error: "La séance a déjà commencé et ne peut plus être annulée." });
      }
      if (isTherapist && end <= Date.now()) {
        return res.status(400).json({ error: "Cette séance est déjà passée." });
      }
    }

    const { data: changed, error: updateError } = await db.from("bookings")
      .update({ status, cancelled_by: status === "cancelled" ? (isPatient ? "patient" : "psychologist") : null, updated_at: nowIso() })
      .eq("id", booking_id).eq("status", booking.status)
      .select("id");
    if (updateError) return res.status(500).json({ error: "Échec de la mise à jour." });
    if (!changed || changed.length === 0) return res.status(409).json({ error: "La séance a changé entre-temps. Rechargez la page." });

    // A patient abandoning their own unpaid reservation: nothing else to do.
    if (booking.status === "pending") {
      await db.from("payments").update({ status: "cancelled", updated_at: nowIso() })
        .eq("booking_id", booking.id).in("status", ["initiated"]);
      return res.json({ success: true, booking_id, status });
    }

    let policy = { refundPercent: 0, compensationPercent: 0 };
    if (status === "cancelled") {
      policy = isTherapist ? { refundPercent: 100, compensationPercent: 0 } : calculateRefund(refundBasis(booking), new Date());
      await recordRefund(db, booking, policy.refundPercent, policy.compensationPercent, isTherapist ? "therapist_cancel" : "patient_cancel");
    }

    const recipientId = isPatient ? booking.psychologist_id : booking.patient_id;
    const [recipient, sender] = await Promise.all([getContact(db, recipientId), getContact(db, user.id)]);
    const dateStr = formatAlgiersLong(booking.booked_at);
    if (recipient.email) {
      if (status === "cancelled") {
        await sendCancellationConfirmation({
          recipientEmail: recipient.email,
          recipientName: recipient.name || "Utilisateur",
          partnerName: sender.name || "Utilisateur",
          date: dateStr,
          refundPercent: policy.refundPercent,
          compensationPercent: policy.compensationPercent,
          // The e-mail goes to the OTHER party (was inverted for patient cancellations).
          userType: isPatient ? "psychologue" : "patient",
        }).catch(console.error);
      } else {
        await sendBookingStatusUpdate({
          recipientEmail: recipient.email,
          recipientName: recipient.name || "Utilisateur",
          partnerName: sender.name || "Utilisateur",
          date: dateStr,
          status,
          userType: isPatient ? "psychologue" : "patient",
        }).catch(console.error);
      }
    }
    // The in-app notification is written by the status trigger; push it now.
    await flushPushes(db, [recipientId]).catch(console.error);

    res.json({ success: true, booking_id, status, refund_percent: policy.refundPercent });
  } catch (err: any) {
    console.error("Update status endpoint error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  switch (req.query.action as string) {
    case "reschedule": return rescheduleHandler(req, res);
    case "update-status": return updateStatusHandler(req, res);
    default: return res.status(400).json({ error: "Unknown or missing action" });
  }
}

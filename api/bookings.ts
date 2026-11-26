import type { VercelRequest, VercelResponse } from "@vercel/node";
import { sendRescheduleConfirmation, sendBookingStatusUpdate, sendCancellationConfirmation, sendRescheduleRequest, sendRescheduleAnswer } from "./_lib/email.js";
import { calculateRefund } from "./_lib/cancellation-policy.js";
import { validateBookingSlot, fetchConflictCandidates, formatAlgiersLong } from "./_lib/slots.js";
import { getDb, getCaller, cors, getContact } from "./_lib/db.js";
import { flushPushes, notify } from "./_lib/push.js";
import { recordRefund, refundBasis } from "./_lib/refunds.js";
import { attendance } from "./_lib/daily.js";

const RESCHEDULE_MIN_NOTICE_MS = 2 * 3600 * 1000;
const MAX_RESCHEDULES = 2;
const nowIso = () => new Date().toISOString();
const PROPOSAL_MIN_LEAD_MS = 2 * 3600 * 1000;
const PROPOSAL_MAX_AHEAD_MS = 90 * 24 * 3600 * 1000;

/** Closes the open reschedule request of a booking (it moved, or was cancelled). */
async function closeOpenRequests(db: any, bookingId: string, status: "cancelled" | "expired") {
  await db.from("reschedule_requests").update({ status, responded_at: nowIso() })
    .eq("booking_id", bookingId).eq("status", "pending");
}

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

  await closeOpenRequests(db, booking.id, "cancelled");

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

    await closeOpenRequests(db, booking.id, "cancelled");

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

// ── reschedule-request: patient proposes a time outside normal availability ──
export const rescheduleRequestHandler = async (req: any, res: any) => {
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const db = getDb();
  if (!db) return res.status(500).json({ error: "Database client not configured" });
  const user = await getCaller(db, req);
  if (!user) return res.status(401).json({ error: "Invalid token" });

  const { booking_id, proposed_at, message } = req.body || {};
  if (!booking_id || !proposed_at) return res.status(400).json({ error: "booking_id and proposed_at are required" });
  const note = typeof message === "string" ? message.trim().slice(0, 500) : "";

  const { data: booking } = await db.from("bookings")
    .select("id, patient_id, psychologist_id, status, booked_at, session_kind")
    .eq("id", booking_id).maybeSingle();
  if (!booking) return res.status(404).json({ error: "Booking not found" });
  if (booking.patient_id !== user.id) return res.status(403).json({ error: "Not authorized" });
  if (booking.status !== "confirmed") return res.status(400).json({ error: "Seules les séances confirmées peuvent être déplacées." });
  if (booking.session_kind === "instant") return res.status(400).json({ error: "Une séance immédiate ne peut pas être déplacée." });
  if (new Date(booking.booked_at).getTime() - Date.now() < RESCHEDULE_MIN_NOTICE_MS) {
    return res.status(400).json({ error: "Une séance ne peut plus être déplacée moins de 2 heures avant son début." });
  }

  const proposed = new Date(String(proposed_at));
  if (Number.isNaN(proposed.getTime())) return res.status(400).json({ error: "Horaire proposé invalide." });
  if (proposed.getTime() - Date.now() < PROPOSAL_MIN_LEAD_MS) {
    return res.status(400).json({ error: "Proposez un horaire au moins 2 heures à l'avance, pour laisser au psychologue le temps de répondre." });
  }
  if (proposed.getTime() - Date.now() > PROPOSAL_MAX_AHEAD_MS) return res.status(400).json({ error: "Proposez un horaire dans les 90 prochains jours." });
  if (proposed.getTime() === new Date(booking.booked_at).getTime()) return res.status(400).json({ error: "C'est déjà l'horaire de votre séance." });

  const { data: psy } = await db.from("profiles").select("user_type, approval_status, clinic_settings").eq("user_id", booking.psychologist_id).maybeSingle();
  const check = validateBookingSlot({
    bookedAt: proposed_at,
    patientId: user.id,
    psychologistId: booking.psychologist_id,
    psychologist: psy as any,
    existing: await fetchConflictCandidates(db, booking.psychologist_id, proposed),
    ignoreBookingId: booking.id,
    therapistApproved: true,
  });
  if (!check.ok) return res.status(check.status).json({ error: check.error });

  const { data: created, error } = await db.from("reschedule_requests").insert({
    booking_id: booking.id,
    patient_id: booking.patient_id,
    psychologist_id: booking.psychologist_id,
    original_booked_at: booking.booked_at,
    proposed_at: check.start.toISOString(),
    message: note || null,
  }).select("id, proposed_at, status, created_at").single();
  if (error) {
    if ((error as any).code === "23505") return res.status(409).json({ error: "Une demande est déjà en attente pour cette séance. Annulez-la pour en faire une autre." });
    console.error("reschedule request insert:", error);
    return res.status(500).json({ error: "Impossible d'envoyer la demande." });
  }

  const [patient, therapist] = await Promise.all([getContact(db, booking.patient_id), getContact(db, booking.psychologist_id)]);
  const currentDate = formatAlgiersLong(booking.booked_at);
  const proposedDate = formatAlgiersLong(check.start);
  await notify(db, booking.psychologist_id, "Demande de changement d'horaire",
    `${patient.name || "Un patient"} propose de déplacer la séance du ${currentDate} au ${proposedDate}.`, "/espace-psy?page=sessions");
  await flushPushes(db, [booking.psychologist_id]).catch(console.error);
  if (therapist.email) {
    sendRescheduleRequest({ therapistEmail: therapist.email, therapistName: therapist.name || "Thérapeute", patientName: patient.name || "Patient", currentDate, proposedDate, message: note || null }).catch(console.error);
  }
  return res.status(200).json({ success: true, request: created });
};

// ── reschedule-respond: therapist accepts or declines ────────────────────────
export const rescheduleRespondHandler = async (req: any, res: any) => {
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const db = getDb();
  if (!db) return res.status(500).json({ error: "Database client not configured" });
  const user = await getCaller(db, req);
  if (!user) return res.status(401).json({ error: "Invalid token" });

  const { request_id, accept, note } = req.body || {};
  if (!request_id || typeof accept !== "boolean") return res.status(400).json({ error: "request_id and accept are required" });
  const responseNote = typeof note === "string" ? note.trim().slice(0, 500) : "";

  const { data: request } = await db.from("reschedule_requests").select("*").eq("id", request_id).maybeSingle();
  if (!request) return res.status(404).json({ error: "Demande introuvable." });
  if (request.psychologist_id !== user.id) return res.status(403).json({ error: "Not authorized" });
  if (request.status !== "pending") return res.status(409).json({ error: "Cette demande a déjà été traitée." });

  const { data: booking } = await db.from("bookings")
    .select("id, patient_id, psychologist_id, status, booked_at, policy_anchor_at, reschedule_count")
    .eq("id", request.booking_id).maybeSingle();
  // The request no longer applies: session cancelled/held, moved meanwhile, or
  // the proposed time has passed.
  const stale = !booking || booking.status !== "confirmed"
    || new Date(booking.booked_at).getTime() !== new Date(request.original_booked_at).getTime()
    || new Date(request.proposed_at).getTime() <= Date.now()
    || new Date(booking.booked_at).getTime() <= Date.now();
  if (stale) {
    await db.from("reschedule_requests").update({ status: "expired", responded_at: nowIso() }).eq("id", request.id).eq("status", "pending");
    return res.status(409).json({ error: "Cette demande n'est plus valable (séance déjà passée, déplacée ou annulée)." });
  }

  const [patient, therapist] = await Promise.all([getContact(db, request.patient_id), getContact(db, request.psychologist_id)]);
  const currentDate = formatAlgiersLong(booking.booked_at);
  const proposedDate = formatAlgiersLong(request.proposed_at);

  if (!accept) {
    const { data: done } = await db.from("reschedule_requests")
      .update({ status: "declined", response_note: responseNote || null, responded_at: nowIso() })
      .eq("id", request.id).eq("status", "pending").select("id");
    if (!done || done.length === 0) return res.status(409).json({ error: "Cette demande a déjà été traitée." });
    await notify(db, request.patient_id, "Horaire non disponible",
      `${therapist.name || "Votre psychologue"} ne peut pas vous recevoir le ${proposedDate}. Votre séance reste prévue le ${currentDate}.${responseNote ? ` Message : « ${responseNote} »` : ""}`,
      "/mon-espace?page=sessions");
    await flushPushes(db, [request.patient_id]).catch(console.error);
    if (patient.email) sendRescheduleAnswer({ patientEmail: patient.email, patientName: patient.name || "Patient", therapistName: therapist.name || "Thérapeute", accepted: false, currentDate, proposedDate, note: responseNote || null }).catch(console.error);
    return res.status(200).json({ success: true, status: "declined" });
  }

  // Accept: the therapist's calendar may have changed since the request.
  const proposed = new Date(request.proposed_at);
  const { data: psy } = await db.from("profiles").select("user_type, approval_status, clinic_settings").eq("user_id", user.id).maybeSingle();
  const check = validateBookingSlot({
    bookedAt: request.proposed_at,
    patientId: request.patient_id,
    psychologistId: user.id,
    psychologist: psy as any,
    existing: await fetchConflictCandidates(db, user.id, proposed),
    ignoreBookingId: booking.id,
    therapistApproved: true,
  });
  if (!check.ok) return res.status(check.status).json({ error: check.error });

  // The refund tier stays measured from the earliest date (same rule as a
  // normal reschedule). An agreed move does not count toward the 2-move limit.
  const anchor = new Date(Math.min(refundBasis(booking).getTime(), new Date(booking.booked_at).getTime(), proposed.getTime())).toISOString();
  const { data: moved, error: moveErr } = await db.from("bookings")
    .update({ booked_at: check.start.toISOString(), video_room_url: null, policy_anchor_at: anchor, reminder_sent_at: null, updated_at: nowIso() })
    .eq("id", booking.id).eq("status", "confirmed").eq("booked_at", booking.booked_at)
    .select("id");
  if (moveErr) {
    if ((moveErr as any).code === "23505") return res.status(409).json({ error: "Vous avez déjà une séance à ce moment-là." });
    console.error("accept reschedule:", moveErr);
    return res.status(500).json({ error: "Impossible de déplacer la séance." });
  }
  if (!moved || moved.length === 0) return res.status(409).json({ error: "La séance a changé entre-temps. Rechargez la page." });

  await db.from("reschedule_requests")
    .update({ status: "accepted", response_note: responseNote || null, responded_at: nowIso() })
    .eq("id", request.id);
  await notify(db, request.patient_id, "Nouvel horaire accepté",
    `${therapist.name || "Votre psychologue"} a accepté : votre séance a lieu le ${proposedDate}.${responseNote ? ` Message : « ${responseNote} »` : ""}`,
    "/mon-espace?page=sessions");
  await flushPushes(db, [request.patient_id]).catch(console.error);
  if (patient.email) sendRescheduleAnswer({ patientEmail: patient.email, patientName: patient.name || "Patient", therapistName: therapist.name || "Thérapeute", accepted: true, currentDate, proposedDate, note: responseNote || null }).catch(console.error);
  return res.status(200).json({ success: true, status: "accepted", booked_at: check.start.toISOString() });
};

// ── reschedule-cancel: patient withdraws their pending request ────────────────
export const rescheduleCancelHandler = async (req: any, res: any) => {
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const db = getDb();
  if (!db) return res.status(500).json({ error: "Database client not configured" });
  const user = await getCaller(db, req);
  if (!user) return res.status(401).json({ error: "Invalid token" });

  const { request_id } = req.body || {};
  const { data } = await db.from("reschedule_requests")
    .update({ status: "cancelled", responded_at: nowIso() })
    .eq("id", request_id).eq("patient_id", user.id).eq("status", "pending")
    .select("psychologist_id").maybeSingle();
  if (!data) return res.status(409).json({ error: "Cette demande n'est plus en attente." });
  return res.status(200).json({ success: true });
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  switch (req.query.action as string) {
    case "reschedule": return rescheduleHandler(req, res);
    case "update-status": return updateStatusHandler(req, res);
    case "reschedule-request": return rescheduleRequestHandler(req, res);
    case "reschedule-respond": return rescheduleRespondHandler(req, res);
    case "reschedule-cancel": return rescheduleCancelHandler(req, res);
    default: return res.status(400).json({ error: "Unknown or missing action" });
  }
}

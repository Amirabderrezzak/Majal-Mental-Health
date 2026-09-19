import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { sendPushToUser } from "./notifications.js";
import { sendRescheduleConfirmation } from "./_lib/email.js";
import { sendBookingStatusUpdate, sendCancellationConfirmation } from "./_lib/email.js";
import { calculateRefund } from "./_lib/cancellation-policy.js";
import { validateBookingSlot, fetchConflictCandidates, formatAlgiers, formatAlgiersLong } from "./_lib/slots.js";

const RESCHEDULE_MIN_NOTICE_MS = 2 * 3600 * 1000;

function cors(res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

// ── reschedule ─────────────────────────────────────────────────────────────────
const rescheduleSupabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const rescheduleHandler = async (req: VercelRequest, res: VercelResponse) => {
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) return res.status(401).json({ error: "Missing token" });

  const token = authHeader.slice(7);
  const { data: { user }, error: authError } = await rescheduleSupabase.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: "Invalid token" });

  const { booking_id, new_booked_at } = req.body;
  if (!booking_id || !new_booked_at) {
    return res.status(400).json({ error: "booking_id and new_booked_at are required" });
  }

  // Verify the booking belongs to this user
  const { data: booking, error: fetchError } = await rescheduleSupabase
    .from("bookings")
    .select("id, patient_id, psychologist_id, status, booked_at")
    .eq("id", booking_id)
    .single();

  if (fetchError || !booking) {
    return res.status(404).json({ error: "Booking not found" });
  }

  if (booking.patient_id !== user.id) {
    return res.status(403).json({ error: "Not authorized" });
  }

  if (booking.status !== "confirmed") {
    return res.status(400).json({ error: "Seules les séances confirmées peuvent être reportées." });
  }

  // The current slot must be at least 2h away, otherwise it can no longer be moved.
  if (new Date(booking.booked_at).getTime() - Date.now() < RESCHEDULE_MIN_NOTICE_MS) {
    return res.status(400).json({ error: "Une séance ne peut plus être reportée moins de 2 heures avant son début." });
  }

  const { data: psy } = await rescheduleSupabase
    .from("profiles")
    .select("user_type, approval_status, clinic_settings")
    .eq("user_id", booking.psychologist_id)
    .maybeSingle();

  const candidates = await fetchConflictCandidates(rescheduleSupabase, booking.psychologist_id, new Date(String(new_booked_at)));
  const check = validateBookingSlot({
    bookedAt: new_booked_at,
    patientId: user.id,
    psychologistId: booking.psychologist_id,
    psychologist: psy as any,
    existing: candidates,
    ignoreBookingId: booking.id,
  });
  if (!check.ok) return res.status(check.status).json({ error: check.error });

  const newBookedAt = check.start.toISOString();

  // Save old date for email notifications
  const oldBookedAt = booking.booked_at;

  // Update the booking (a new slot needs a fresh video room)
  const { error: updateError } = await rescheduleSupabase
    .from("bookings")
    .update({ booked_at: newBookedAt, video_room_url: null, updated_at: new Date().toISOString() })
    .eq("id", booking_id);

  if (updateError) {
    if ((updateError as any).code === "23505") {
      return res.status(409).json({ error: "Ce créneau n'est plus disponible." });
    }
    console.error("Reschedule update error:", updateError);
    return res.status(500).json({ error: "Failed to reschedule" });
  }

  // Create in-app notification for the therapist
  await rescheduleSupabase.from("notifications").insert({
    user_id: booking.psychologist_id,
    type: "booking",
    title: "Séance reportée",
    content: `Le patient a reporté la séance au ${formatAlgiersLong(newBookedAt)}.`,
    link: "/espace-psy?page=sessions"
  });

  // Send push notification
  const newDateStr = formatAlgiersLong(newBookedAt);
  const oldDateStr = formatAlgiersLong(oldBookedAt);
  sendPushToUser(booking.psychologist_id, "Séance reportée", `Votre patient a reporté la séance au ${newDateStr}.`, "/espace-psy").catch(console.error);

  // Fetch profile info for emails
  const [patientProfile, psyProfile] = await Promise.all([
    rescheduleSupabase.from("profiles").select("full_name").eq("user_id", booking.patient_id).single(),
    rescheduleSupabase.from("profiles").select("full_name").eq("user_id", booking.psychologist_id).single(),
  ]);
  const [patientAuth, psyAuth] = await Promise.all([
    rescheduleSupabase.auth.admin.getUserById(booking.patient_id),
    rescheduleSupabase.auth.admin.getUserById(booking.psychologist_id),
  ]);

  const patientEmail = patientAuth?.data?.user?.email;
  const psyEmail = psyAuth?.data?.user?.email;
  const patientName = patientProfile?.data?.full_name || "Patient";
  const psyName = psyProfile?.data?.full_name || "Thérapeute";

  // Send confirmation email to patient
  if (patientEmail) {
    sendRescheduleConfirmation({
      recipientEmail: patientEmail,
      recipientName: patientName,
      partnerName: psyName,
      oldDate: oldDateStr,
      newDate: newDateStr,
      userType: "patient",
    }).catch(console.error);
  }

  // Send notification email to therapist
  if (psyEmail) {
    sendRescheduleConfirmation({
      recipientEmail: psyEmail,
      recipientName: psyName,
      partnerName: patientName,
      oldDate: oldDateStr,
      newDate: newDateStr,
      userType: "psychologue",
    }).catch(console.error);
  }

  return res.status(200).json({ success: true });
};

// ── update-status ────────────────────────────────────────────────────────────────
const updateStatusSupabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const updateStatusSupabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

let updateStatusSupabase: any;
try {
  if (updateStatusSupabaseUrl && updateStatusSupabaseKey) {
    updateStatusSupabase = createClient(updateStatusSupabaseUrl, updateStatusSupabaseKey);
  }
} catch (e) {
  console.error("Failed to initialize Supabase client in update-status:", e);
}

export const updateStatusHandler = async (req: any, res: any) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!updateStatusSupabase) {
    console.error("Supabase client is not initialized in update-status.");
    return res.status(500).json({ error: "Database client configuration error" });
  }

  // 1. Authenticate caller using JWT token
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized: Missing or invalid authorization header" });
  }

  const token = authHeader.split(" ")[1];
  const { data: { user }, error: authError } = await updateStatusSupabase.auth.getUser(token);

  if (authError || !user) {
    return res.status(401).json({ error: "Unauthorized: Invalid token" });
  }

  const callerId = user.id;

  try {
    const { booking_id, status } = req.body;

    if (!booking_id || !status) {
      return res.status(400).json({ error: "booking_id and status are required" });
    }

    if (!["confirmed", "cancelled", "done"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    // 2. Fetch booking details to verify authorization
    const { data: booking, error: bookingError } = await updateStatusSupabase
      .from("bookings")
      .select("id, booked_at, status, patient_id, psychologist_id")
      .eq("id", booking_id)
      .single();

    if (bookingError || !booking) {
      return res.status(404).json({ error: "Booking not found" });
    }

    const isPatient = booking.patient_id === callerId;
    const isTherapist = booking.psychologist_id === callerId;

    if (!isPatient && !isTherapist) {
      return res.status(403).json({ error: "Forbidden: You do not have permission to modify this booking" });
    }

    // Patients can only cancel booking
    if (isPatient && status !== "cancelled") {
      return res.status(400).json({ error: "Patients are only allowed to cancel bookings" });
    }

    // Transition rules. "confirmed" is only ever reached through a verified payment
    // (payments.confirm), never by a client call: otherwise a therapist could confirm
    // an unpaid reservation and a cancelled slot could be resurrected.
    if (status === "confirmed") {
      return res.status(400).json({ error: "Une réservation est confirmée automatiquement après paiement." });
    }
    if (booking.status === "cancelled") {
      return res.status(400).json({ error: "Cette séance est déjà annulée." });
    }
    if (booking.status === "done") {
      return res.status(400).json({ error: "Cette séance est déjà terminée." });
    }
    if (status === "done" && (booking.status !== "confirmed" || new Date(booking.booked_at).getTime() > Date.now())) {
      return res.status(400).json({ error: "Une séance ne peut être terminée qu'après son début." });
    }

    // Update booking in database
    const { error: updateError } = await updateStatusSupabase
      .from("bookings")
      .update({ status })
      .eq("id", booking_id);

    if (updateError) {
      return res.status(500).json({ error: updateError.message });
    }

    // Determine recipient and partner names for notifications
    const recipientId = isPatient ? booking.psychologist_id : booking.patient_id;
    const senderId = callerId;

    // Fetch details of both parties to send proper email
    const { data: recipientProfile } = await updateStatusSupabase
      .from("profiles")
      .select("full_name")
      .eq("user_id", recipientId)
      .single();

    const { data: senderProfile } = await updateStatusSupabase
      .from("profiles")
      .select("full_name")
      .eq("user_id", senderId)
      .single();

    const { data: recipientAuth } = await updateStatusSupabase.auth.admin.getUserById(recipientId);

    const recipientEmail = recipientAuth?.user?.email;
    const recipientName = recipientProfile?.full_name || "Utilisateur";
    const partnerName = senderProfile?.full_name || "Utilisateur";

    const dateStr = formatAlgiersLong(booking.booked_at);

    if (recipientEmail) {
      if (status === "cancelled") {
        // A therapist-initiated cancellation always refunds the patient in full.
        const policy = isTherapist
          ? { refundPercent: 100, compensationPercent: 0 }
          : calculateRefund(new Date(booking.booked_at), new Date());
        await sendCancellationConfirmation({
          recipientEmail,
          recipientName,
          partnerName,
          date: dateStr,
          refundPercent: policy.refundPercent,
          compensationPercent: policy.compensationPercent,
          userType: isPatient ? "patient" : "psychologue"
        }).catch(console.error);
      } else {
        await sendBookingStatusUpdate({
          recipientEmail,
          recipientName,
          partnerName,
          date: dateStr,
          status,
          userType: isPatient ? "psychologue" : "patient"
        }).catch(console.error);
      }
    }

    // Send push notification to recipient
    const pushTitle = status === "cancelled" ? "Session annulée" : status === "confirmed" ? "Session confirmée" : "Mise à jour de session";
    const pushBody = status === "cancelled"
      ? `La session du ${dateStr} a été annulée par ${partnerName}.`
      : status === "confirmed"
      ? `Votre session du ${dateStr} avec ${partnerName} a été confirmée.`
      : `La session avec ${partnerName} est maintenant "${status}".`;
    sendPushToUser(recipientId, pushTitle, pushBody, "/mon-espace").catch(console.error);

    res.json({ success: true, booking_id, status });
  } catch (err: any) {
    console.error("Update status endpoint error:", err);
    res.status(500).json({ error: err.message });
  }
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const action = req.query.action as string;

  switch (action) {
    case "reschedule":
      return rescheduleHandler(req, res);
    case "update-status":
      return updateStatusHandler(req, res);
    default:
      return res.status(400).json({ error: "Unknown or missing action" });
  }
}

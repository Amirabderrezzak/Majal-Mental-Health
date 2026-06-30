import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { sendPushToUser } from "../notifications/send-push.js";
import { sendRescheduleConfirmation } from "../_lib/email.js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function cors(res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) return res.status(401).json({ error: "Missing token" });

  const token = authHeader.slice(7);
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: "Invalid token" });

  const { booking_id, new_booked_at } = req.body;
  if (!booking_id || !new_booked_at) {
    return res.status(400).json({ error: "booking_id and new_booked_at are required" });
  }

  // Verify the booking belongs to this user
  const { data: booking, error: fetchError } = await supabase
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

  if (booking.status === "cancelled" || booking.status === "done") {
    return res.status(400).json({ error: "Cannot reschedule a cancelled or completed session" });
  }

  // Validate new date is in the future
  const newDate = new Date(new_booked_at);
  if (newDate <= new Date()) {
    return res.status(400).json({ error: "New date must be in the future" });
  }

  // Save old date for email notifications
  const oldBookedAt = booking.booked_at;

  // Update the booking
  const { error: updateError } = await supabase
    .from("bookings")
    .update({ booked_at: new_booked_at, updated_at: new Date().toISOString() })
    .eq("id", booking_id);

  if (updateError) {
    console.error("Reschedule update error:", updateError);
    return res.status(500).json({ error: "Failed to reschedule" });
  }

  // Create in-app notification for the therapist
  await supabase.from("notifications").insert({
    user_id: booking.psychologist_id,
    type: "booking",
    title: "Séance reportée",
    content: `Le patient a reporté la séance au ${new Date(new_booked_at).toLocaleDateString("fr-FR")} à ${new Date(new_booked_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}.`,
    link: "/espace-psy?page=sessions"
  });

  // Send push notification
  const newDateStr = new Date(new_booked_at).toLocaleDateString("fr-FR", { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
  const oldDateStr = new Date(oldBookedAt).toLocaleDateString("fr-FR", { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  sendPushToUser(booking.psychologist_id, "Séance reportée", `Votre patient a reporté la séance au ${newDateStr}.`, "/espace-psy").catch(console.error);

  // Fetch profile info for emails
  const [patientProfile, psyProfile] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("user_id", booking.patient_id).single(),
    supabase.from("profiles").select("full_name").eq("user_id", booking.psychologist_id).single(),
  ]);
  const [patientAuth, psyAuth] = await Promise.all([
    supabase.auth.admin.getUserById(booking.patient_id),
    supabase.auth.admin.getUserById(booking.psychologist_id),
  ]);

  const patientEmail = patientAuth?.user?.email;
  const psyEmail = psyAuth?.user?.email;
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
}

import type { SupabaseClient } from "@supabase/supabase-js";
import { getPaymentGateway } from "./payment-gateway.js";
import { sendBookingConfirmation, sendTherapistNewBooking } from "./email.js";

export interface ConfirmResult {
  status: number;
  body: Record<string, unknown>;
}

interface PaymentRow {
  id: string;
  patient_id: string;
  psychologist_id: string;
  booked_at: string;
  duration_minutes: number;
  price: number;
  status: string;
  sofizpay_transaction_id?: string | null;
}

/**
 * Confirms a payment and creates/updates its booking.
 *
 * Security model:
 *  - The caller MUST be authenticated and MUST own the payment (userId === payment.patient_id).
 *  - The payment is ONLY confirmed after verifying with the payment gateway that the
 *    transaction actually succeeded (gateway.checkStatus). This prevents anyone from
 *    confirming an unpaid payment and getting a free, confirmed booking.
 *
 * Uses the service-role client (db) so it can write beyond RLS.
 */
export async function confirmPaymentBooking(
  db: SupabaseClient,
  paymentId: string,
  userId: string,
): Promise<ConfirmResult> {
  if (!paymentId) {
    return { status: 400, body: { error: "payment_id is required" } };
  }

  if (!userId) {
    return { status: 401, body: { error: "Missing authorization" } };
  }

  const { data: payment, error: fetchError } = await db
    .from("payments")
    .select("*")
    .eq("id", paymentId)
    .single<PaymentRow>();

  if (fetchError || !payment) {
    return { status: 404, body: { error: "Payment not found" } };
  }

  if (payment.patient_id !== userId) {
    return { status: 403, body: { error: "You do not own this payment" } };
  }

  if (payment.status === "confirmed") {
    const { data: existingBooking } = await db
      .from("bookings")
      .select("id")
      .eq("patient_id", payment.patient_id)
      .eq("booked_at", payment.booked_at)
      .eq("status", "confirmed")
      .maybeSingle();

    if (existingBooking) {
      return { status: 200, body: { success: true, booking_id: existingBooking.id, already_confirmed: true } };
    }
  }

  let paymentVerified = false;

  if (payment.sofizpay_transaction_id) {
    const gateway = getPaymentGateway();
    const statusResult = await gateway.checkStatus(payment.sofizpay_transaction_id);
    paymentVerified = statusResult.success;
    console.log(`Payment ${paymentId} status check: ${statusResult.status}`);
  }

  if (!paymentVerified) {
    await db
      .from("payments")
      .update({ status: "failed", updated_at: new Date().toISOString() })
      .eq("id", paymentId);

    // Release the reserved slot so it becomes bookable again.
    await db
      .from("bookings")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("patient_id", payment.patient_id)
      .eq("psychologist_id", payment.psychologist_id)
      .eq("booked_at", payment.booked_at)
      .eq("status", "pending");

    return { status: 400, body: { error: "Payment not confirmed" } };
  }

  // Find the reservation created at checkout (status "pending") or any existing
  // booking for this exact slot. Scope by psychologist so a different patient
  // can never hijack or duplicate the slot.
  const { data: existingBooking } = await db
    .from("bookings")
    .select("id, patient_id, status")
    .eq("psychologist_id", payment.psychologist_id)
    .eq("booked_at", payment.booked_at)
    .neq("status", "cancelled")
    .maybeSingle();

  let bookingId = "";

  if (existingBooking) {
    if (existingBooking.patient_id !== payment.patient_id) {
      await db
        .from("payments")
        .update({ status: "failed", updated_at: new Date().toISOString() })
        .eq("id", paymentId);
      return { status: 409, body: { error: "Ce créneau est déjà réservé par un autre patient." } };
    }
    // Our reservation — promote pending → confirmed (idempotent on retries).
    const { data: updated, error: updErr } = await db
      .from("bookings")
      .update({
        status: "confirmed",
        price: payment.price,
        duration_minutes: payment.duration_minutes,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existingBooking.id)
      .select()
      .single();
    if (updErr || !updated) {
      console.error("Booking confirm error:", updErr);
      return { status: 500, body: { error: "Failed to confirm booking" } };
    }
    bookingId = updated.id;
  } else {
    // Fallback: no reservation row (payment created before reservations were
    // reserved at checkout). Create the confirmed booking now.
    const { data: booking, error: bookingError } = await db
      .from("bookings")
      .insert({
        patient_id: payment.patient_id,
        psychologist_id: payment.psychologist_id,
        booked_at: payment.booked_at,
        duration_minutes: payment.duration_minutes,
        status: "confirmed",
        price: payment.price,
      })
      .select()
      .single();
    if (bookingError || !booking) {
      console.error("Booking creation error:", bookingError);
      return { status: 500, body: { error: "Failed to create booking after payment" } };
    }
    bookingId = booking.id;
  }

  await db
    .from("payments")
    .update({ status: "confirmed", updated_at: new Date().toISOString() })
    .eq("id", paymentId);

  const { data: patientProfile } = await db
    .from("profiles")
    .select("full_name")
    .eq("user_id", payment.patient_id)
    .single();

  const { data: patientAuth } = await db.auth.admin.getUserById(payment.patient_id);

  const { data: therapistProfile } = await db
    .from("profiles")
    .select("full_name")
    .eq("user_id", payment.psychologist_id)
    .single();

  const { data: therapistAuth } = await db.auth.admin.getUserById(payment.psychologist_id);

  const dateStr = new Date(payment.booked_at).toLocaleDateString("fr-FR", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

  if (patientAuth?.user?.email && patientProfile) {
    await sendBookingConfirmation({
      patientEmail: patientAuth.user.email,
      patientName: patientProfile.full_name || "Patient",
      therapistName: therapistProfile?.full_name || "Thérapeute",
      date: dateStr,
      duration: payment.duration_minutes,
      price: payment.price,
      bookingId,
    }).catch(console.error);
  }

  if (therapistAuth?.user?.email && therapistProfile) {
    await sendTherapistNewBooking({
      therapistEmail: therapistAuth.user.email,
      therapistName: therapistProfile.full_name || "Thérapeute",
      patientName: patientProfile?.full_name || "Patient",
      date: dateStr,
      duration: payment.duration_minutes,
    }).catch(console.error);
  }

  return { status: 200, body: { success: true, booking_id: bookingId } };
}

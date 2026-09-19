import type { SupabaseClient } from "@supabase/supabase-js";
import { formatAlgiersLong } from "./slots.js";
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
  session_type?: string | null;
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

  // Idempotent: a payment that already produced a booking never creates another one,
  // whatever that booking's status is now (confirmed, done, or cancelled afterwards).
  if (payment.status === "confirmed") {
    const { data: existingBooking } = await db
      .from("bookings")
      .select("id, status")
      .eq("patient_id", payment.patient_id)
      .eq("psychologist_id", payment.psychologist_id)
      .eq("booked_at", payment.booked_at)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingBooking) {
      return { status: 200, body: { success: true, booking_id: existingBooking.id, already_confirmed: true } };
    }
  }

  let paymentVerified = false;
  let paymentFailed = false;

  if (payment.sofizpay_transaction_id) {
    const gateway = getPaymentGateway();
    const statusResult = await gateway.checkStatus(payment.sofizpay_transaction_id);
    paymentVerified = statusResult.success;
    paymentFailed = statusResult.failed;
    console.log(`Payment ${paymentId} status check: ${statusResult.status}`);
  } else {
    // No transaction id means the payment was never sent to the gateway.
    paymentFailed = true;
  }

  if (!paymentVerified) {
    // Only release the reserved slot on a *definitive* failure (gateway reports
    // the transaction failed/cancelled/expired). A "pending" status means the
    // bank capture is still in flight — keep the booking pending so it isn't
    // freed for someone else and can be re-checked later.
    if (paymentFailed) {
      await db
        .from("payments")
        .update({ status: "failed", updated_at: new Date().toISOString() })
        .eq("id", paymentId);

      await db
        .from("bookings")
        .update({ status: "cancelled", updated_at: new Date().toISOString() })
        .eq("patient_id", payment.patient_id)
        .eq("psychologist_id", payment.psychologist_id)
        .eq("booked_at", payment.booked_at)
        .eq("status", "pending");
    } else {
      await db
        .from("payments")
        .update({ status: "pending", updated_at: new Date().toISOString() })
        .eq("id", paymentId);
    }

    return {
      status: paymentFailed ? 400 : 202,
      body: { error: paymentFailed ? "Payment not confirmed" : "Payment pending" },
    };
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
    if (existingBooking.status !== "pending") {
      // Already confirmed/done (e.g. a concurrent confirm won the race): nothing to promote.
      bookingId = existingBooking.id;
    } else {
    // Our reservation — promote pending → confirmed.
    const { data: updated, error: updErr } = await db
      .from("bookings")
      .update({
        status: "confirmed",
        price: payment.price,
        duration_minutes: payment.duration_minutes,
        session_type: payment.session_type,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existingBooking.id)
      .eq("status", "pending")
      .select()
      .single();
    if (updErr || !updated) {
      console.error("Booking confirm error:", updErr);
      return { status: 500, body: { error: "Failed to confirm booking" } };
    }
    bookingId = updated.id;
    }
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
        session_type: payment.session_type ?? "individual",
      })
      .select()
      .single();
    if (bookingError || !booking) {
      // 23505 = unique_violation. idx_unique_active_booking(psychologist_id,
      // booked_at) is the DB-level backstop for the TOCTOU window between the
      // existingBooking SELECT above and this INSERT: two concurrent confirms
      // for the same slot (different patients, no prior reservation row) can
      // both pass that SELECT before either writes. The loser hits this
      // constraint instead of silently double-booking the slot.
      if (bookingError?.code === "23505") {
        await db
          .from("payments")
          .update({ status: "failed", updated_at: new Date().toISOString() })
          .eq("id", paymentId);
        return { status: 409, body: { error: "Ce créneau est déjà réservé par un autre patient." } };
      }
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

  const dateStr = formatAlgiersLong(payment.booked_at);

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

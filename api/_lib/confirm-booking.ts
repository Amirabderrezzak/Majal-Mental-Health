import type { SupabaseClient } from "@supabase/supabase-js";
import { formatAlgiersLong } from "./slots.js";
import { getPaymentGateway } from "./payment-gateway.js";
import { sendBookingConfirmation, sendTherapistNewBooking } from "./email.js";
import { getContact, wantsEmail } from "./db.js";
import { flushPushes } from "./push.js";

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
  created_at?: string;
  session_type?: string | null;
  sofizpay_transaction_id?: string | null;
  booking_id?: string | null;
  instant_request_id?: string | null;
}

const now = () => new Date().toISOString();

/**
 * Patient-facing confirm (called from /payment/return): the caller must own the
 * payment, then the shared finalizer runs.
 */
export async function confirmPaymentBooking(db: SupabaseClient, paymentId: string, userId: string): Promise<ConfirmResult> {
  if (!paymentId) return { status: 400, body: { error: "payment_id is required" } };
  if (!userId) return { status: 401, body: { error: "Missing authorization" } };

  const { data: payment } = await db.from("payments").select("*").eq("id", paymentId).maybeSingle<PaymentRow>();
  if (!payment) return { status: 404, body: { error: "Payment not found" } };
  if (payment.patient_id !== userId) return { status: 403, body: { error: "You do not own this payment" } };
  return finalizePayment(db, payment);
}

/**
 * Verifies a payment with the gateway and, if it is paid, confirms its booking.
 * Used by the patient's return page AND by the scheduled job, which re-checks
 * payments whose bank capture was still in progress (they used to be marked
 * "failed" after 30 minutes even when the bank later took the money).
 *
 * Never trusts the client: the gateway is always asked.
 */
export async function finalizePayment(db: SupabaseClient, payment: PaymentRow): Promise<ConfirmResult> {
  // Idempotent: a confirmed payment has already produced exactly one booking.
  if (payment.status === "confirmed") {
    return { status: 200, body: { success: true, booking_id: payment.booking_id ?? null, already_confirmed: true } };
  }
  if (payment.status === "failed" || payment.status === "cancelled") {
    return { status: 400, body: { error: "Payment not confirmed" } };
  }

  let verified = false;
  let failed = false;
  if (payment.sofizpay_transaction_id) {
    const result = await getPaymentGateway().checkStatus(payment.sofizpay_transaction_id);
    verified = result.success;
    failed = result.failed;
  } else {
    failed = true; // never reached the gateway
  }

  if (!verified) {
    if (failed) {
      await db.from("payments").update({ status: "failed", updated_at: now() }).eq("id", payment.id).in("status", ["initiated", "pending"]);
      if (payment.booking_id) {
        await db.from("bookings").update({ status: "cancelled", cancelled_by: "system", updated_at: now() }).eq("id", payment.booking_id).eq("status", "pending");
      }
      return { status: 400, body: { error: "Payment not confirmed" } };
    }
    await db.from("payments").update({ status: "pending", updated_at: now() }).eq("id", payment.id).eq("status", "initiated");
    return { status: 202, body: { error: "Payment pending", pending: true } };
  }

  // Paid. Promote our reservation, or (if it was released meanwhile) re-create it
  // when the slot is still free.
  let bookingId: string | null = null;
  if (payment.booking_id) {
    // The patient cancelled the reservation themselves while the bank was still
    // capturing: honour the cancellation and refund in full.
    const { data: held } = await db.from("bookings").select("status, cancelled_by").eq("id", payment.booking_id).maybeSingle();
    if (held?.status === "cancelled" && held.cancelled_by && held.cancelled_by !== "system") {
      await db.from("payments").update({ status: "failed", updated_at: now() }).eq("id", payment.id);
      await db.from("refunds").insert({
        payment_id: payment.id, patient_id: payment.patient_id, psychologist_id: payment.psychologist_id,
        amount: payment.price, refund_percent: 100, compensation_amount: 0, reason: "paid_without_booking",
        note: "Réservation annulée avant la fin du paiement.",
      });
      return { status: 409, body: { error: "Cette réservation a été annulée. Votre paiement sera intégralement remboursé." } };
    }
  }
  if (payment.booking_id) {
    const { data: updated } = await db.from("bookings")
      .update({ status: "confirmed", price: payment.price, duration_minutes: payment.duration_minutes, session_type: payment.session_type ?? "individual", updated_at: now() })
      .eq("id", payment.booking_id).in("status", ["pending", "cancelled"])
      .or("status.eq.pending,cancelled_by.eq.system")
      .select("id").maybeSingle();
    if (updated) bookingId = updated.id;
    else {
      const { data: current } = await db.from("bookings").select("id, status").eq("id", payment.booking_id).maybeSingle();
      if (current && current.status !== "pending" && current.status !== "cancelled") bookingId = current.id; // a concurrent confirm won
    }
  }

  // A second payment for a reservation that another payment already paid (the
  // patient reopened checkout while the first capture was in flight): don't keep
  // both — record a full refund for this one.
  if (bookingId) {
    const { data: other } = await db.from("payments").select("id")
      .eq("booking_id", bookingId).eq("status", "confirmed").neq("id", payment.id).limit(1);
    if (other && other.length > 0) {
      await db.from("payments").update({ status: "failed", updated_at: now() }).eq("id", payment.id);
      await db.from("refunds").insert({
        payment_id: payment.id, patient_id: payment.patient_id, psychologist_id: payment.psychologist_id,
        amount: payment.price, refund_percent: 100, compensation_amount: 0, reason: "paid_without_booking",
        note: "Doublon : cette séance était déjà payée par un autre paiement.",
      });
      return { status: 409, body: { error: "Cette séance était déjà payée. Ce second paiement sera intégralement remboursé." } };
    }
  }

  if (!bookingId) {
    const { data: booking, error } = await db.from("bookings").insert({
      patient_id: payment.patient_id,
      psychologist_id: payment.psychologist_id,
      booked_at: payment.booked_at,
      duration_minutes: payment.duration_minutes,
      status: "confirmed",
      price: payment.price,
      session_type: payment.session_type ?? "individual",
      session_kind: payment.instant_request_id ? "instant" : "scheduled",
      instant_request_id: payment.instant_request_id ?? null,
    }).select("id").single();

    if (error || !booking) {
      // The slot went to someone else while the bank was capturing. The patient
      // paid, so record a full refund for an admin to process.
      await db.from("payments").update({ status: "failed", updated_at: now() }).eq("id", payment.id);
      await db.from("refunds").insert({
        payment_id: payment.id,
        patient_id: payment.patient_id,
        psychologist_id: payment.psychologist_id,
        amount: payment.price,
        refund_percent: 100,
        compensation_amount: 0,
        reason: "paid_without_booking",
        note: "Paiement capturé après la libération du créneau.",
      });
      return { status: 409, body: { error: "Ce créneau a été réservé entre-temps. Votre paiement sera intégralement remboursé." } };
    }
    bookingId = booking.id;
  }

  // The reservation row may be a re-created one, so a 23505 on the conditional
  // update above is impossible here; mark the payment last.
  await db.from("payments").update({ status: "confirmed", booking_id: bookingId, updated_at: now() }).eq("id", payment.id);

  const [patient, therapist] = await Promise.all([getContact(db, payment.patient_id), getContact(db, payment.psychologist_id)]);
  const dateStr = formatAlgiersLong(payment.booked_at);
  if (patient.email) {
    await sendBookingConfirmation({
      patientEmail: patient.email,
      patientName: patient.name || "Patient",
      therapistName: therapist.name || "Thérapeute",
      date: dateStr,
      duration: payment.duration_minutes,
      price: payment.price,
      bookingId: bookingId as string,
    }).catch(console.error);
  }
  if (therapist.email && wantsEmail(therapist, "newBookings")) {
    await sendTherapistNewBooking({
      therapistEmail: therapist.email,
      therapistName: therapist.name || "Thérapeute",
      patientName: patient.name || "Patient",
      date: dateStr,
      duration: payment.duration_minutes,
    }).catch(console.error);
  }
  await flushPushes(db, [payment.patient_id, payment.psychologist_id]).catch(console.error);

  return { status: 200, body: { success: true, booking_id: bookingId } };
}

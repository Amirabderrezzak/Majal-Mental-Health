import type { SupabaseClient } from "@supabase/supabase-js";

export type RefundReason = "patient_cancel" | "therapist_cancel" | "therapist_no_show" | "both_absent" | "paid_without_booking";

/**
 * The time a cancellation is measured against. Rescheduling moves `booked_at`,
 * but the refund tier must still be computed from the earliest date the session
 * was ever scheduled for — otherwise "reschedule to next week, then cancel"
 * turned a 0–70 % refund into 100 %.
 */
export function refundBasis(b: { booked_at: string; policy_anchor_at?: string | null }): Date {
  const booked = new Date(b.booked_at).getTime();
  const anchor = b.policy_anchor_at ? new Date(b.policy_anchor_at).getTime() : booked;
  return new Date(Math.min(booked, anchor));
}

/**
 * Writes the money owed into the refunds ledger (one row per booking) so an admin
 * can process it. Previously refunds and compensation existed only as a
 * sentence in an e-mail.
 */
export async function recordRefund(db: SupabaseClient, booking: { id: string; patient_id: string; psychologist_id: string; price?: number | null }, refundPercent: number, compensationPercent: number, reason: RefundReason) {
  const price = Math.max(0, Math.round(Number(booking.price ?? 0)));
  if (price === 0) return;
  const amount = Math.round((price * refundPercent) / 100);
  const compensation = Math.round((price * compensationPercent) / 100);
  if (amount === 0 && compensation === 0) return;
  const { data: payment } = await db.from("payments").select("id").eq("booking_id", booking.id).eq("status", "confirmed").maybeSingle();
  const { error } = await db.from("refunds").insert({
    booking_id: booking.id,
    payment_id: payment?.id ?? null,
    patient_id: booking.patient_id,
    psychologist_id: booking.psychologist_id,
    amount,
    refund_percent: refundPercent,
    compensation_amount: compensation,
    reason,
  });
  if (error && (error as any).code !== "23505") console.error("refund ledger insert failed:", error);
}

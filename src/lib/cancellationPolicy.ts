// Client-side mirror of api/_lib/cancellation-policy.ts (the frontend can't
// import from api/). Keep the tier thresholds in sync with the server — the
// server is authoritative for what's actually refunded; this only lets the UI
// warn the patient BEFORE they cancel.
export type RefundTier = "full-refund" | "partial-refund" | "no-refund" | "no-show";

export function getRefundTier(sessionTime: Date, now: Date = new Date()): { tier: RefundTier; refundPercent: number } {
  const hours = (sessionTime.getTime() - now.getTime()) / (1000 * 60 * 60);
  if (hours > 24) return { tier: "full-refund", refundPercent: 100 };
  if (hours > 2) return { tier: "partial-refund", refundPercent: 70 };
  if (hours > 0) return { tier: "no-refund", refundPercent: 0 };
  return { tier: "no-show", refundPercent: 0 };
}

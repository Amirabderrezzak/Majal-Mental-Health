export interface RefundResult {
  refundPercent: number;
  compensationPercent: number;
  policyTier: 'full-refund' | 'partial-refund' | 'no-refund' | 'no-show';
}

/**
 * Calculate refund and compensation percentages based on
 * how many hours before the session the cancellation occurred.
 *
 * Policy:
 *   > 24h  → 100% refund to patient, 100% compensation to therapist
 *   > 2h   → 70% refund to patient, 100% compensation to therapist
 *   < 2h   → 0% refund to patient, 100% compensation to therapist
 *   no-show → 0% refund to patient, 100% compensation to therapist (automatic)
 */
export function calculateRefund(sessionTime: Date, cancellationTime: Date): RefundResult {
  const hoursUntilSession = (sessionTime.getTime() - cancellationTime.getTime()) / (1000 * 60 * 60);

  if (hoursUntilSession > 24) {
    return { refundPercent: 100, compensationPercent: 100, policyTier: 'full-refund' };
  } else if (hoursUntilSession > 2) {
    return { refundPercent: 70, compensationPercent: 100, policyTier: 'partial-refund' };
  } else if (hoursUntilSession > 0) {
    return { refundPercent: 0, compensationPercent: 100, policyTier: 'no-refund' };
  } else {
    return { refundPercent: 0, compensationPercent: 100, policyTier: 'no-show' };
  }
}

export function getPolicyDescription(tier: RefundResult['policyTier'], lang: 'fr' | 'ar'): string {
  if (lang === 'ar') {
    switch (tier) {
      case 'full-refund': return 'إلغاء قبل أكثر من 24 ساعة من الجلسة: استرداد كامل للمبلغ';
      case 'partial-refund': return 'إلغاء بين 24 ساعة وساعتين من الجلسة: استرداد 70%';
      case 'no-refund': return 'إلغاء قبل أقل من ساعتين من الجلسة: لا يوجد استرداد';
      case 'no-show': return 'عدم الحضور: لا يوجد استرداد، تعويض كامل للأخصائي';
    }
  }
  switch (tier) {
    case 'full-refund': return 'Annulation > 24h avant la séance : remboursement intégral.';
    case 'partial-refund': return 'Annulation entre 24h et 2h avant la séance : remboursement de 70%.';
    case 'no-refund': return 'Annulation < 2h avant la séance : aucun remboursement.';
    case 'no-show': return 'Absence non justifiée : aucun remboursement, compensation intégrale au thérapeute.';
  }
}
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.EMAIL_FROM || 'Majal <noreply@majal.dz>';
const SITE = process.env.FRONTEND_URL || 'https://majalpsy.com';

// ── HTML escaping to prevent injection in email templates ────────────────────
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ── HTML wrapper ────────────────────────────────────────────────────────────
function wrap(content: string): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Majal</title></head>
<body style="margin:0;padding:0;background:#f4f7f6;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7f6;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,#0d9488,#0891b2);padding:32px 40px;text-align:center;">
          <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:700;letter-spacing:-0.5px;">🌿 Majal</h1>
          <p style="margin:6px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">Plateforme de santé mentale</p>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:40px;">${content}</td></tr>
        <!-- Footer -->
        <tr><td style="background:#f8fafb;padding:24px 40px;text-align:center;border-top:1px solid #e5e9eb;">
          <p style="margin:0;color:#9ca3af;font-size:12px;">© ${new Date().getFullYear()} Majal · <a href="${SITE}" style="color:#0d9488;text-decoration:none;">majalpsy.com</a></p>
          <p style="margin:4px 0 0;color:#9ca3af;font-size:11px;">Cet email a été envoyé automatiquement, merci de ne pas y répondre.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function btn(text: string, href: string): string {
  return `<div style="text-align:center;margin:28px 0;">
    <a href="${href}" style="display:inline-block;background:linear-gradient(135deg,#0d9488,#0891b2);color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:10px;font-size:15px;font-weight:600;">${text}</a>
  </div>`;
}

// ── 1. Booking Confirmation (patient) ───────────────────────────────────────
export async function sendBookingConfirmation(opts: {
  patientEmail: string;
  patientName: string;
  therapistName: string;
  date: string;
  duration: number;
  price: number;
  bookingId: string;
}) {
  return resend.emails.send({
    from: FROM,
    to: opts.patientEmail,
    subject: '✅ Votre réservation est confirmée — Majal',
    html: wrap(`
      <h2 style="margin:0 0 8px;color:#111827;font-size:22px;">Réservation confirmée !</h2>
      <p style="margin:0 0 24px;color:#6b7280;font-size:15px;">Bonjour <strong>${escapeHtml(opts.patientName)}</strong>, votre séance a été réservée avec succès.</p>
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;border-radius:10px;border:1px solid #bbf7d0;margin-bottom:24px;">
        <tr><td style="padding:20px 24px;">
          <p style="margin:0 0 8px;font-size:14px;color:#374151;"><strong>👨‍⚕️ Thérapeute :</strong> ${escapeHtml(opts.therapistName)}</p>
          <p style="margin:0 0 8px;font-size:14px;color:#374151;"><strong>📅 Date & Heure :</strong> ${opts.date}</p>
          <p style="margin:0 0 8px;font-size:14px;color:#374151;"><strong>⏱ Durée :</strong> ${opts.duration} minutes</p>
          <p style="margin:0;font-size:14px;color:#374151;"><strong>💳 Montant payé :</strong> ${opts.price.toLocaleString('fr-DZ')} DA</p>
        </td></tr>
      </table>
      ${btn('Voir ma réservation', `${SITE}/mon-espace`)}
      <p style="margin:0;color:#9ca3af;font-size:13px;text-align:center;">Référence : <code style="color:#0d9488;">${opts.bookingId.slice(0, 8).toUpperCase()}</code></p>
    `),
  });
}

// ── 2. New Booking Alert (therapist) ────────────────────────────────────────
export async function sendTherapistNewBooking(opts: {
  therapistEmail: string;
  therapistName: string;
  patientName: string;
  date: string;
  duration: number;
}) {
  return resend.emails.send({
    from: FROM,
    to: opts.therapistEmail,
    subject: '📅 Nouvelle réservation — Majal',
    html: wrap(`
      <h2 style="margin:0 0 8px;color:#111827;font-size:22px;">Nouvelle séance réservée</h2>
      <p style="margin:0 0 24px;color:#6b7280;font-size:15px;">Bonjour Dr. <strong>${escapeHtml(opts.therapistName)}</strong>, un patient vient de réserver une séance avec vous.</p>
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#eff6ff;border-radius:10px;border:1px solid #bfdbfe;margin-bottom:24px;">
        <tr><td style="padding:20px 24px;">
          <p style="margin:0 0 8px;font-size:14px;color:#374151;"><strong>👤 Patient :</strong> ${escapeHtml(opts.patientName)}</p>
          <p style="margin:0 0 8px;font-size:14px;color:#374151;"><strong>📅 Date & Heure :</strong> ${opts.date}</p>
          <p style="margin:0;font-size:14px;color:#374151;"><strong>⏱ Durée :</strong> ${opts.duration} minutes</p>
        </td></tr>
      </table>
      ${btn('Voir mon agenda', `${SITE}/espace-psy`)}
    `),
  });
}

// ── 3. Therapist Account Approved ───────────────────────────────────────────
export async function sendTherapistApproved(opts: {
  therapistEmail: string;
  therapistName: string;
}) {
  return resend.emails.send({
    from: FROM,
    to: opts.therapistEmail,
    subject: '🎉 Votre compte est approuvé — Majal',
    html: wrap(`
      <h2 style="margin:0 0 8px;color:#111827;font-size:22px;">Félicitations, votre compte est actif !</h2>
      <p style="margin:0 0 24px;color:#6b7280;font-size:15px;">Bonjour Dr. <strong>${escapeHtml(opts.therapistName)}</strong>, votre profil a été examiné et approuvé par notre équipe.</p>
      <p style="color:#374151;font-size:15px;">Votre profil est maintenant <strong>visible</strong> sur la plateforme Majal et les patients peuvent vous contacter pour des réservations.</p>
      ${btn('Accéder à mon espace', `${SITE}/espace-psy`)}
    `),
  });
}

// ── 4. Therapist Account Rejected ───────────────────────────────────────────
export async function sendTherapistRejected(opts: {
  therapistEmail: string;
  therapistName: string;
}) {
  return resend.emails.send({
    from: FROM,
    to: opts.therapistEmail,
    subject: 'Mise à jour de votre demande — Majal',
    html: wrap(`
      <h2 style="margin:0 0 8px;color:#111827;font-size:22px;">Votre demande n'a pas été approuvée</h2>
      <p style="margin:0 0 24px;color:#6b7280;font-size:15px;">Bonjour <strong>${escapeHtml(opts.therapistName)}</strong>, après examen de votre dossier, votre demande n'a pas pu être approuvée à ce moment.</p>
      <p style="color:#374151;font-size:15px;">Si vous pensez qu'il s'agit d'une erreur ou souhaitez fournir des informations complémentaires, veuillez contacter notre équipe.</p>
      ${btn('Contacter le support', `${SITE}/contact`)}
    `),
  });
}

// ── 5. Booking Status Update (patient or therapist) ─────────────────────────
export async function sendBookingStatusUpdate(opts: {
  recipientEmail: string;
  recipientName: string;
  partnerName: string;
  date: string;
  status: string;
  userType: 'patient' | 'psychologue';
}) {
  const statusFr = opts.status === 'confirmed' ? 'confirmée' : opts.status === 'cancelled' ? 'annulée' : 'terminée';
  
  const subject = opts.userType === 'patient'
    ? `📅 Votre séance est ${statusFr} — Majal`
    : `📅 Séance ${statusFr} — Majal`;

  const heading = opts.userType === 'patient'
    ? `Mise à jour de votre séance`
    : `Mise à jour d'une séance`;

  const bodyText = opts.userType === 'patient'
    ? `Votre séance avec le <strong>Dr. ${escapeHtml(opts.partnerName)}</strong> du <strong>${escapeHtml(opts.date)}</strong> a été <strong>${statusFr}</strong>.`
    : `La séance avec le patient <strong>${escapeHtml(opts.partnerName)}</strong> du <strong>${escapeHtml(opts.date)}</strong> a été <strong>${statusFr}</strong>.`;

  const redirectLink = opts.userType === 'patient'
    ? `${SITE}/mon-espace?page=sessions`
    : `${SITE}/espace-psy?page=sessions`;

  return resend.emails.send({
    from: FROM,
    to: opts.recipientEmail,
    subject: subject,
    html: wrap(`
      <h2 style="margin:0 0 8px;color:#111827;font-size:22px;">${heading}</h2>
      <p style="margin:0 0 24px;color:#6b7280;font-size:15px;">Bonjour <strong>${escapeHtml(opts.recipientName)}</strong>,</p>
      <p style="color:#374151;font-size:15px;line-height:1.6;">${bodyText}</p>
      ${btn('Accéder à mon espace', redirectLink)}
    `),
  });
}


import { createClient } from '@supabase/supabase-js';
import { sendBookingConfirmation, sendTherapistNewBooking } from '../_lib/email';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // ── Security: verify webhook secret ──────────────────────────────────────
  const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
  const providedSecret = req.headers['x-webhook-secret'];
  if (!WEBHOOK_SECRET || providedSecret !== WEBHOOK_SECRET) {
    console.warn('Webhook rejected: invalid or missing secret');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { booking_id, status } = req.body;
    if (!booking_id) return res.status(400).json({ error: 'booking_id is required' });

    const newStatus = status === 'success' ? 'confirmed' : 'cancelled';

    // Update booking status
    const { error: updateError } = await supabase
      .from('bookings')
      .update({ status: newStatus })
      .eq('id', booking_id);

    if (updateError) return res.status(500).json({ error: updateError.message });

    // Send emails only when confirmed
    if (newStatus === 'confirmed') {
      // Fetch full booking details with patient + therapist info
      const { data: booking } = await supabase
        .from('bookings')
        .select('id, booked_at, duration_minutes, price, patient_id, psychologist_id')
        .eq('id', booking_id)
        .single();

      if (booking) {
        // Fetch patient profile + email
        const { data: patient } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('user_id', booking.patient_id)
          .single();

        const { data: patientAuth } = await supabase.auth.admin.getUserById(booking.patient_id);

        // Fetch therapist profile + email
        const { data: therapist } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('user_id', booking.psychologist_id)
          .single();

        const { data: therapistAuth } = await supabase.auth.admin.getUserById(booking.psychologist_id);

        const dateStr = new Date(booking.booked_at).toLocaleDateString('fr-FR', {
          weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
          hour: '2-digit', minute: '2-digit'
        });

        // Send to patient
        if (patientAuth?.user?.email && patient) {
          await sendBookingConfirmation({
            patientEmail: patientAuth.user.email,
            patientName:  patient.full_name || 'Patient',
            therapistName: therapist?.full_name || 'Thérapeute',
            date:     dateStr,
            duration: booking.duration_minutes,
            price:    booking.price || 0,
            bookingId: booking.id,
          }).catch(console.error);
        }

        // Send to therapist
        if (therapistAuth?.user?.email && therapist) {
          await sendTherapistNewBooking({
            therapistEmail: therapistAuth.user.email,
            therapistName:  therapist.full_name || 'Thérapeute',
            patientName:    patient?.full_name || 'Patient',
            date:     dateStr,
            duration: booking.duration_minutes,
          }).catch(console.error);
        }
      }
    }

    res.json({ success: true, booking_id, status: newStatus });
  } catch (err: any) {
    console.error('Webhook error:', err);
    res.status(500).json({ error: err.message });
  }
}

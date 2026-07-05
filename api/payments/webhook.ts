import { createClient } from '@supabase/supabase-js';
import { sendBookingConfirmation, sendTherapistNewBooking } from '../_lib/email.js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

let supabase: any;
try {
  if (supabaseUrl && supabaseKey) {
    supabase = createClient(supabaseUrl, supabaseKey);
  }
} catch (e) {
  console.error("Failed to initialize Supabase client in webhook:", e);
}

async function confirmBooking(booking_id: string, transaction_id?: string) {
  const updateData: any = { status: 'confirmed' };
  if (transaction_id) updateData.transaction_id = transaction_id;

  const { error: updateError } = await supabase
    .from('bookings')
    .update(updateData)
    .eq('id', booking_id);

  if (updateError) throw new Error(updateError.message);

  const { data: booking } = await supabase
    .from('bookings')
    .select('id, booked_at, duration_minutes, price, patient_id, psychologist_id')
    .eq('id', booking_id)
    .single();

  if (!booking) return;

  const { data: patient } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('user_id', booking.patient_id)
    .single();

  const { data: patientAuth } = await supabase.auth.admin.getUserById(booking.patient_id);

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

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!supabase) {
    console.error("Supabase client is not initialized in webhook.");
    return res.status(500).json({ error: 'Database client configuration error' });
  }

  try {
    const { booking_id, status, transaction_id } = req.body;

    if (!booking_id) {
      return res.status(400).json({ error: 'booking_id is required' });
    }

    if (status === 'success') {
      await confirmBooking(booking_id, transaction_id);
      return res.json({ success: true, booking_id, status: 'confirmed' });
    }

    if (status === 'failed' || status === 'cancelled') {
      const { error: updateError } = await supabase
        .from('bookings')
        .update({ status: 'cancelled' })
        .eq('id', booking_id);

      if (updateError) return res.status(500).json({ error: updateError.message });
      return res.json({ success: true, booking_id, status: 'cancelled' });
    }

    return res.status(400).json({ error: 'Invalid status' });
  } catch (err: any) {
    console.error('Webhook error:', err);
    res.status(500).json({ error: err.message });
  }
}

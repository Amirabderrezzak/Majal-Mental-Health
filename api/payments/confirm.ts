import { createClient } from '@supabase/supabase-js';
import { getPaymentGateway } from '../_lib/payment-gateway.js';
import { sendBookingConfirmation, sendTherapistNewBooking } from '../_lib/email.js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

let supabase: any;
try {
  if (supabaseUrl && supabaseKey) {
    supabase = createClient(supabaseUrl, supabaseKey);
  }
} catch (e) {
  console.error("Failed to initialize Supabase client in confirm:", e);
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!supabase) {
    return res.status(500).json({ error: 'Database client not configured' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authorization header' });
  }

  const token = authHeader.split(' ')[1];
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  try {
    const { payment_id } = req.body;

    if (!payment_id) {
      return res.status(400).json({ error: 'payment_id is required' });
    }

    const { data: payment, error: fetchError } = await supabase
      .from('payments')
      .select('*')
      .eq('id', payment_id)
      .single();

    if (fetchError || !payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    if (payment.patient_id !== user.id) {
      return res.status(403).json({ error: 'You do not own this payment' });
    }

    if (payment.status === 'confirmed') {
      const { data: existingBooking } = await supabase
        .from('bookings')
        .select('id')
        .eq('patient_id', payment.patient_id)
        .eq('booked_at', payment.booked_at)
        .eq('status', 'confirmed')
        .maybeSingle();

      if (existingBooking) {
        return res.json({ success: true, booking_id: existingBooking.id, already_confirmed: true });
      }
    }

    let paymentVerified = false;

    if (payment.sofizpay_transaction_id) {
      const gateway = getPaymentGateway();
      const statusResult = await gateway.checkStatus(payment.sofizpay_transaction_id);
      paymentVerified = statusResult.success;
      console.log(`Payment ${payment_id} status check: ${statusResult.status}`);
    }

    if (!paymentVerified) {
      await supabase
        .from('payments')
        .update({ status: 'failed', updated_at: new Date().toISOString() })
        .eq('id', payment_id);

      return res.status(400).json({ error: 'Payment not confirmed' });
    }

    const { data: existingBooking } = await supabase
      .from('bookings')
      .select('id')
      .eq('patient_id', payment.patient_id)
      .eq('booked_at', payment.booked_at)
      .neq('status', 'cancelled')
      .maybeSingle();

    if (existingBooking) {
      await supabase
        .from('payments')
        .update({ status: 'confirmed', updated_at: new Date().toISOString() })
        .eq('id', payment_id);
      return res.json({ success: true, booking_id: existingBooking.id, already_confirmed: true });
    }

    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .insert({
        patient_id: payment.patient_id,
        psychologist_id: payment.psychologist_id,
        booked_at: payment.booked_at,
        duration_minutes: payment.duration_minutes,
        status: 'confirmed',
        price: payment.price,
      })
      .select()
      .single();

    if (bookingError || !booking) {
      console.error('Booking creation error:', bookingError);
      return res.status(500).json({ error: 'Failed to create booking after payment' });
    }

    await supabase
      .from('payments')
      .update({ status: 'confirmed', updated_at: new Date().toISOString() })
      .eq('id', payment_id);

    const { data: patientProfile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('user_id', payment.patient_id)
      .single();

    const { data: patientAuth } = await supabase.auth.admin.getUserById(payment.patient_id);

    const { data: therapistProfile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('user_id', payment.psychologist_id)
      .single();

    const { data: therapistAuth } = await supabase.auth.admin.getUserById(payment.psychologist_id);

    const dateStr = new Date(payment.booked_at).toLocaleDateString('fr-FR', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });

    if (patientAuth?.user?.email && patientProfile) {
      await sendBookingConfirmation({
        patientEmail: patientAuth.user.email,
        patientName: patientProfile.full_name || 'Patient',
        therapistName: therapistProfile?.full_name || 'Thérapeute',
        date: dateStr,
        duration: payment.duration_minutes,
        price: payment.price,
        bookingId: booking.id,
      }).catch(console.error);
    }

    if (therapistAuth?.user?.email && therapistProfile) {
      await sendTherapistNewBooking({
        therapistEmail: therapistAuth.user.email,
        therapistName: therapistProfile.full_name || 'Thérapeute',
        patientName: patientProfile?.full_name || 'Patient',
        date: dateStr,
        duration: payment.duration_minutes,
      }).catch(console.error);
    }

    res.json({ success: true, booking_id: booking.id });
  } catch (err: any) {
    console.error('Confirm error:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
}

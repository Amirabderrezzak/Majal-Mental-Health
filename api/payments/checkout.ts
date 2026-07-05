import { createClient } from '@supabase/supabase-js';
import { getPaymentGateway, CheckoutParams } from '../_lib/payment-gateway.js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

let supabase: any;
try {
  if (supabaseUrl && supabaseKey) {
    supabase = createClient(supabaseUrl, supabaseKey);
  }
} catch (e) {
  console.error("Failed to initialize Supabase client in checkout:", e);
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
    const { booking_id, price, full_name, phone } = req.body;

    if (!booking_id || !price) {
      return res.status(400).json({ error: 'booking_id and price are required' });
    }

    if (typeof price !== 'number' || price <= 0) {
      return res.status(400).json({ error: 'price must be a positive number' });
    }

    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('id, status, patient_id, psychologist_id')
      .eq('id', booking_id)
      .single();

    if (bookingError || !booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    if (booking.patient_id !== user.id) {
      return res.status(403).json({ error: 'You can only pay for your own bookings' });
    }

    if (booking.status !== 'pending') {
      return res.status(400).json({ error: 'Booking is not pending payment' });
    }

    const { data: patientProfile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('user_id', user.id)
      .single();

    const origin = req.headers.origin || (req.headers.host ? `${req.headers.host.includes('localhost') ? 'http' : 'https'}://${req.headers.host}` : null);
    const FRONTEND_URL = origin || process.env.FRONTEND_URL || (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:8080');

    const returnUrl = `${FRONTEND_URL}/payment/return`;

    const gateway = getPaymentGateway();
    const params: CheckoutParams = {
      booking_id,
      amount: price,
      full_name: full_name || patientProfile?.full_name || 'Patient',
      phone: phone || '',
      email: user.email || '',
      memo: `Booking: ${booking_id}`,
    };

    const result = await gateway.createCheckout(params, returnUrl);

    await supabase
      .from('bookings')
      .update({ transaction_id: result.transaction_id })
      .eq('id', booking_id);

    res.json({
      url: result.payment_url,
      transaction_id: result.transaction_id,
      amount: result.amount,
    });
  } catch (err: any) {
    console.error('Checkout error:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
}

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
    const { psychologist_id, booked_at, duration_minutes, full_name, phone } = req.body;

    if (!psychologist_id || !booked_at) {
      return res.status(400).json({ error: 'psychologist_id and booked_at are required' });
    }

    const { data: psyProfile } = await supabase
      .from('profiles')
      .select('price_per_session')
      .eq('user_id', psychologist_id)
      .single();

    const price = psyProfile?.price_per_session || 3000;

    const { data: existing } = await supabase
      .from('payments')
      .select('id, status')
      .eq('psychologist_id', psychologist_id)
      .eq('booked_at', booked_at)
      .in('status', ['initiated', 'pending'])
      .maybeSingle();

    if (existing) {
      if (existing.status === 'pending') {
        const { data: stalePayment } = await supabase
          .from('payments')
          .select('id, payment_url, cib_transaction_id')
          .eq('id', existing.id)
          .single();
        if (stalePayment?.payment_url) {
          return res.json({
            url: stalePayment.payment_url,
            payment_id: stalePayment.id,
            cib_transaction_id: stalePayment.cib_transaction_id,
          });
        }
      }
      await supabase
        .from('payments')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('id', existing.id);
    }

    const { data: existingBooking } = await supabase
      .from('bookings')
      .select('id')
      .eq('psychologist_id', psychologist_id)
      .eq('booked_at', booked_at)
      .neq('status', 'cancelled')
      .maybeSingle();

    if (existingBooking) {
      return res.status(409).json({ error: 'Ce créneau est déjà réservé.' });
    }

    const { data: payment, error: insertError } = await supabase
      .from('payments')
      .insert({
        patient_id: user.id,
        psychologist_id,
        booked_at,
        duration_minutes: duration_minutes || 60,
        price,
        status: 'initiated',
      })
      .select()
      .single();

    if (insertError || !payment) {
      console.error('Payment insert error:', insertError);
      return res.status(500).json({ error: 'Failed to create payment record' });
    }

    const origin = req.headers.origin || (req.headers.host
      ? `${req.headers.host.includes('localhost') ? 'http' : 'https'}://${req.headers.host}`
      : null);
    const FRONTEND_URL = origin || process.env.FRONTEND_URL || (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:8080');

    const returnUrl = `${FRONTEND_URL}/payment/return?payment_id=${payment.id}`;

    const gateway = getPaymentGateway();
    const result = await gateway.createCheckout({
      payment_id: payment.id,
      amount: price,
      full_name: full_name || 'Patient',
      phone: phone || '0000000000',
      email: user.email || `patient-${user.id.slice(0,8)}@majal.dz`,
      memo: `Majal - Séance thérapie`,
    }, returnUrl);

    await supabase
      .from('payments')
      .update({
        sofizpay_transaction_id: result.cib_transaction_id,
        status: 'pending',
      })
      .eq('id', payment.id);

    res.json({
      url: result.payment_url,
      payment_id: payment.id,
      cib_transaction_id: result.cib_transaction_id,
    });
  } catch (err: any) {
    console.error('Checkout error:', err);
    const msg = err.message || 'Internal server error';
    const isSofiz = msg.includes('SofizPay');
    res.status(isSofiz ? 402 : 500).json({ error: msg });
  }
}

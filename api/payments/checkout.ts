import { createClient } from '@supabase/supabase-js';
import { getPaymentGateway, CheckoutParams } from '../_lib/payment-gateway.js';
import { rateLimit } from '../_lib/rate-limit.js';

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

  // Abuse protection: 10 checkouts per 10 minutes per client IP (each creates a
  // payment + hits the gateway, so cap cost-abuse). Applied after auth, before
  // the heavy DB/gateway work.
  const limit = rateLimit(req, { key: "checkout", windowMs: 10 * 60 * 1000, max: 10 });
  if (!limit.ok) {
    res.setHeader("Retry-After", String(limit.retryAfter ?? 60));
    return res.status(429).json({ error: "Too many requests, please try again later." });
  }

  try {
    const { psychologist_id, booked_at, duration_minutes, full_name, phone, session_type } = req.body;

    if (!psychologist_id || !booked_at) {
      return res.status(400).json({ error: 'psychologist_id and booked_at are required' });
    }

    const { data: psyProfile } = await supabase
      .from('profiles')
      .select('price_individual, price_couples, price_adolescents')
      .eq('user_id', psychologist_id)
      .single();

    // Server-side price selection — never trust a client-sent price.
    const type = session_type === 'couples' || session_type === 'adolescents'
      ? session_type
      : 'individual';
    let price: number | null = null;
    if (type === 'couples') price = psyProfile?.price_couples ?? null;
    else if (type === 'adolescents') price = psyProfile?.price_adolescents ?? null;
    else price = psyProfile?.price_individual ?? null;

    if (price == null) {
      return res.status(400).json({ error: "Ce type de séance n'est pas proposé" });
    }

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
            mock: !process.env.SOFIZPAY_PUBLIC_KEY,
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
    const isMock = !process.env.SOFIZPAY_PUBLIC_KEY;
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
      mock: isMock,
    });
  } catch (err: any) {
    console.error('Checkout error:', err);
    const msg = err.message || 'Internal server error';
    // Fail closed: an unconfigured gateway in production must not fall back to
    // the free mock. Surface it (402 mirrors a payment problem).
    if (msg === 'Payment gateway not configured' || msg.includes('SofizPay')) {
      return res.status(402).json({ error: msg });
    }
    res.status(500).json({ error: msg });
  }
}

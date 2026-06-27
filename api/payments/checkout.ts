import { createClient } from '@supabase/supabase-js';

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

  // ── Authenticate: require a valid JWT ──────────────────────────────────────
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
    const { booking_id, price } = req.body;

    if (!booking_id || !price) {
      return res.status(400).json({ error: 'booking_id and price are required' });
    }

    if (typeof price !== 'number' || price <= 0) {
      return res.status(400).json({ error: 'price must be a positive number' });
    }

    // Verify booking exists and belongs to the authenticated user
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('id, status, patient_id')
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

    // TODO: Integrate Sofizpay or Stripe API here.
    const origin = req.headers.origin || (req.headers.host ? `${req.headers.host.includes('localhost') ? 'http' : 'https'}://${req.headers.host}` : null);
    const FRONTEND_URL = origin || process.env.FRONTEND_URL || (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:8080');

    const MOCK_CHECKOUT_URL = `${FRONTEND_URL}/payment/mock?booking_id=${encodeURIComponent(booking_id)}&amount=${encodeURIComponent(price)}`;

    res.json({ url: MOCK_CHECKOUT_URL });
  } catch (err: any) {
    console.error('Checkout error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

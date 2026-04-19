import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export default async function handler(req: any, res: any) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { booking_id, price } = req.body;

    if (!booking_id || !price) {
      return res.status(400).json({ error: 'booking_id and price are required' });
    }

    // Verify the booking exists
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('id, status')
      .eq('id', booking_id)
      .single();

    if (bookingError || !booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // TODO: Integrate Sofizpay or Stripe API here.
    // For now, redirect to a mock payment page on the frontend.
    const FRONTEND_URL = process.env.FRONTEND_URL || process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:5173';

    const MOCK_CHECKOUT_URL = `${FRONTEND_URL}/payment/mock?booking_id=${booking_id}&amount=${price}`;

    res.json({ url: MOCK_CHECKOUT_URL });
  } catch (err: any) {
    console.error('Checkout error:', err);
    res.status(500).json({ error: err.message });
  }
}

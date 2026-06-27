import { Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';

// Setup Supabase with Service Role to bypass RLS when acting as a webhook receiver
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('CRITICAL: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set in payment controller');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Endpoint to generate a payment link.
 * Expects { booking_id, price } in the request body.
 */
export const createPaymentSession = async (req: Request, res: Response): Promise<void> => {
  try {
    const { booking_id, price } = req.body;

    if (!booking_id || !price) {
      res.status(400).json({ error: 'booking_id and price are required' });
      return;
    }

    if (typeof price !== 'number' || price <= 0) {
      res.status(400).json({ error: 'price must be a positive number' });
      return;
    }

    // Verify booking exists
    const { data: booking, error: fetchError } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', booking_id)
      .single();

    if (fetchError || !booking) {
      res.status(404).json({ error: 'Booking not found' });
      return;
    }

    // TODO: Integrate Sofizpay or Stripe API here.
    const BASE = process.env.FRONTEND_URL || "http://localhost:8080";
    const MOCK_CHECKOUT_URL = `${BASE}/payment/mock?booking_id=${encodeURIComponent(booking_id)}&amount=${encodeURIComponent(price)}`;

    res.json({ url: MOCK_CHECKOUT_URL });

  } catch (err: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Webhook Endpoint triggered by the Payment Provider (e.g. Sofizpay IPN).
 * Updates the booking status to "confirmed" upon successful payment.
 */
export const paymentWebhook = async (req: Request, res: Response): Promise<void> => {
  try {
    // Verify webhook secret
    const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
    if (!WEBHOOK_SECRET) {
      console.error('WEBHOOK_SECRET env variable is not configured');
      res.status(500).json({ error: 'Server configuration error' });
      return;
    }

    const providedSecret = req.headers['x-webhook-secret'];
    if (providedSecret !== WEBHOOK_SECRET) {
      console.warn('Webhook rejected: invalid or missing secret');
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { booking_id, status } = req.body;

    if (!booking_id || status !== 'paid') {
      res.status(400).json({ error: 'Invalid payload or payment not successful' });
      return;
    }

    const { data, error } = await supabase
      .from('bookings')
      .update({ status: 'confirmed' })
      .eq('id', booking_id)
      .select();

    if (error || !data || data.length === 0) {
      res.status(500).json({ error: 'Failed to update booking status' });
      return;
    }

    // TODO: Trigger confirmation email here

    res.status(200).json({ message: 'Booking confirmed successfully' });
  } catch (err: any) {
    console.error('Webhook error:', err);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
};

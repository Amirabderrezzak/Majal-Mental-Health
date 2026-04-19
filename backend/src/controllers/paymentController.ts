import { Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';

// Setup Supabase with Service Role to bypass RLS when acting as a webhook receiver
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
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
    // For now, we mock generating a checkout URL, redirecting the user back to the success page
    const MOCK_CHECKOUT_URL = `http://localhost:8080/payment/mock?booking_id=${booking_id}&amount=${price}`;

    res.json({ url: MOCK_CHECKOUT_URL });

  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * Webhook Endpoint triggered by the Payment Provider (e.g. Sofizpay IPN).
 * Updates the booking status to "confirmed" upon successful payment.
 */
export const paymentWebhook = async (req: Request, res: Response): Promise<void> => {
  try {
    // In production, verify the webhook signature here to ensure it's from the payment provider!
    
    // Webhook shape usually contains an order/transaction ID matching our booking_id
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
      res.status(500).json({ error: 'Failed to update booking status in database' });
      return;
    }

    // TODO: Trigger NodeMailer confirmation email here pointing to 'data' (the updated booking)

    res.status(200).json({ message: 'Booking confirmed successfully' });
  } catch (err: any) {
    res.status(500).json({ error: 'Webhook processing failed', details: err.message });
  }
};

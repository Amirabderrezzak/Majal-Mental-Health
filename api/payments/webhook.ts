import { createClient } from '@supabase/supabase-js';

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
  // ─────────────────────────────────────────────────────────────────────────

  try {
    const { booking_id, status } = req.body;

    if (!booking_id) {
      return res.status(400).json({ error: 'booking_id is required' });
    }

    const newStatus = status === 'success' ? 'confirmed' : 'cancelled';

    const { error } = await supabase
      .from('bookings')
      .update({ status: newStatus })
      .eq('id', booking_id);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({ success: true, booking_id, status: newStatus });
  } catch (err: any) {
    console.error('Webhook error:', err);
    res.status(500).json({ error: err.message });
  }
}

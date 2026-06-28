import { createClient } from '@supabase/supabase-js';
import { sendPushToUser } from './send-push';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

let supabase: any;
try {
  if (supabaseUrl && supabaseKey) {
    supabase = createClient(supabaseUrl, supabaseKey);
  }
} catch (e) {
  console.error("Failed to initialize Supabase client:", e);
}

const CRON_SECRET = process.env.CRON_SECRET || '';

export default async function handler(req: any, res: any) {
  // Only allow GET (Vercel cron) or authenticated POST
  if (req.method === 'GET') {
    const authHeader = req.headers.authorization;
    if (!authHeader || authHeader !== `Bearer ${CRON_SECRET}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  } else if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!supabase) {
    return res.status(500).json({ error: 'Database client not configured' });
  }

  try {
    // Fetch recent unsent notifications (last 24h)
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: notifications, error } = await supabase
      .from('notifications')
      .select('id, user_id, title, message, link')
      .eq('push_sent', false)
      .gte('created_at', cutoff)
      .order('created_at', { ascending: true })
      .limit(50);

    if (error) {
      console.error('Failed to fetch notifications:', error);
      return res.status(500).json({ error: error.message });
    }

    if (!notifications || notifications.length === 0) {
      return res.json({ success: true, processed: 0 });
    }

    let processed = 0;
    let failed = 0;

    for (const notif of notifications) {
      if (!notif.user_id || !notif.title || !notif.message) {
        await supabase
          .from('notifications')
          .update({ push_sent: true })
          .eq('id', notif.id);
        processed++;
        continue;
      }

      try {
        await sendPushToUser(notif.user_id, notif.title, notif.message, notif.link || '/');
        await supabase
          .from('notifications')
          .update({ push_sent: true })
          .eq('id', notif.id);
        processed++;
      } catch (err) {
        console.error(`Failed to send push for notification ${notif.id}:`, err);
        failed++;
        // Mark as sent anyway to avoid infinite retries
        await supabase
          .from('notifications')
          .update({ push_sent: true })
          .eq('id', notif.id);
      }
    }

    res.json({ success: true, processed, failed, total: notifications.length });
  } catch (err: any) {
    console.error('Push cron error:', err);
    res.status(500).json({ error: err.message });
  }
}

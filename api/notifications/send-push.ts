import { createClient } from '@supabase/supabase-js';

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

const VAPID_PUBLIC_KEY = process.env.VITE_FIREBASE_VAPID_KEY || '';
const VAPID_PRIVATE_KEY = process.env.FIREBASE_VAPID_PRIVATE_KEY || '';
const VAPID_MAILTO = process.env.FIREBASE_VAPID_MAILTO || 'mailto:admin@majalpsy.com';

let webpush: any = null;

async function getWebPush() {
  if (webpush) return webpush;
  try {
    const wp = await import('web-push');
    wp.default.setVapidDetails(VAPID_MAILTO, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    webpush = wp.default;
    return webpush;
  } catch (err) {
    console.error('Failed to load web-push:', err);
    return null;
  }
}

async function sendPushToUser(userId: string, title: string, body: string, url: string = '/') {
  if (!supabase) return { sent: 0, errors: 0 };

  const { data: subscriptions } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('user_id', userId);

  if (!subscriptions || subscriptions.length === 0) return { sent: 0, errors: 0 };

  const wp = await getWebPush();
  if (!wp) return { sent: 0, errors: subscriptions.length };

  let sent = 0;
  let errors = 0;

  for (const sub of subscriptions) {
    try {
      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      };

      await wp.sendNotification(pushSubscription, JSON.stringify({
        notification: { title, body },
        data: { tag: 'majal-notification', link: url },
      }));

      sent++;
    } catch (err: any) {
      errors++;
      if (err.statusCode === 404 || err.statusCode === 410) {
        await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
      }
    }
  }

  return { sent, errors };
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!supabase) {
    return res.status(500).json({ error: 'Database client not configured' });
  }

  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return res.status(500).json({ error: 'Push notification keys not configured' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Missing Authorization header' });
  }

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { user_id, title, body, url } = req.body;

    if (!user_id || !title || !body) {
      return res.status(400).json({ error: 'user_id, title, and body are required' });
    }

    const result = await sendPushToUser(user_id, title, body, url);
    res.json({ success: true, ...result });
  } catch (err: any) {
    console.error('Push notification error:', err);
    res.status(500).json({ error: err.message });
  }
}

export { sendPushToUser };

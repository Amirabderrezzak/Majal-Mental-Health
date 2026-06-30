import { createClient } from '@supabase/supabase-js';
import { sendPushToUser } from './send-push';
import { sendSessionReminder } from '../_lib/email.js';

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

    let reminderSent = 0;
    let reminderFailed = 0;

    // Session reminder: find confirmed sessions happening tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const dayAfter = new Date(tomorrow);
    dayAfter.setDate(dayAfter.getDate() + 1);

    const { data: sessions } = await supabase
      .from('bookings')
      .select('id, patient_id, psychologist_id, booked_at, duration_minutes')
      .eq('status', 'confirmed')
      .gte('booked_at', tomorrow.toISOString())
      .lt('booked_at', dayAfter.toISOString());

    if (sessions && sessions.length > 0) {
      for (const session of sessions) {
        try {
          const [patProf, psyProf] = await Promise.all([
            supabase.from('profiles').select('full_name, user_id').eq('user_id', session.patient_id).single(),
            supabase.from('profiles').select('full_name, user_id').eq('user_id', session.psychologist_id).single(),
          ]);
          const [patAuth, psyAuth] = await Promise.all([
            supabase.auth.admin.getUserById(session.patient_id),
            supabase.auth.admin.getUserById(session.psychologist_id),
          ]);

          const patientName = patProf.data?.full_name || 'Patient';
          const psyName = psyProf.data?.full_name || 'Psychologue';
          const patientEmail = patAuth?.data?.user?.email;
          const psyEmail = psyAuth?.data?.user?.email;
          const dateStr = new Date(session.booked_at).toLocaleDateString('fr-FR', {
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
          });

          if (patientEmail) {
            await sendSessionReminder({
              recipientEmail: patientEmail,
              recipientName: patientName,
              partnerName: psyName,
              date: dateStr,
              duration: session.duration_minutes,
              userType: 'patient',
            });
          }
          if (psyEmail) {
            await sendSessionReminder({
              recipientEmail: psyEmail,
              recipientName: psyName,
              partnerName: patientName,
              date: dateStr,
              duration: session.duration_minutes,
              userType: 'psychologue',
            });
          }
          reminderSent += (patientEmail ? 1 : 0) + (psyEmail ? 1 : 0);
        } catch (err) {
          console.error(`Failed to send reminder for session ${session.id}:`, err);
          reminderFailed++;
        }
      }
    }

    res.json({ success: true, processed, failed, total: notifications.length, reminderSent, reminderFailed });
  } catch (err: any) {
    console.error('Push cron error:', err);
    res.status(500).json({ error: err.message });
  }
}

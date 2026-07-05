import { createClient } from '@supabase/supabase-js';
import { sendPushToUser } from './send-push.js';
import { sendSessionReminder, sendNoShowNotification } from '../_lib/email.js';
import { calculateRefund } from '../_lib/cancellation-policy.js';

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

    // ── No-show detection ──────────────────────────────────────────────────
    let noShowDetected = 0;
    let noShowFailed = 0;

    const gracePeriodMs = 15 * 60 * 1000;
    const noShowCutoff = new Date(Date.now() - gracePeriodMs).toISOString();

    const { data: confirmedSessions, error: nsError } = await supabase
      .from('bookings')
      .select('id, patient_id, psychologist_id, booked_at, duration_minutes')
      .eq('status', 'confirmed')
      .lte('booked_at', noShowCutoff);

    if (!nsError && confirmedSessions && confirmedSessions.length > 0) {
      const now = Date.now();
      const noShowSessions = confirmedSessions.filter((s: any) => {
        const sessionEnd = new Date(s.booked_at).getTime() + (s.duration_minutes || 60) * 60 * 1000;
        return sessionEnd + gracePeriodMs <= now;
      });

      for (const session of noShowSessions) {
        try {
          await supabase
            .from('bookings')
            .update({ status: 'no-show', no_show_detected_at: new Date().toISOString() })
            .eq('id', session.id);

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
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
          });

          const policy = calculateRefund(new Date(session.booked_at), new Date());

          await supabase.from('notifications').insert([
            { user_id: session.patient_id, title: 'Absence non justifiée', message: `Vous n'avez pas assisté à la séance du ${dateStr}. Aucun remboursement ne sera effectué.`, link: '/mon-espace?page=sessions', push_sent: false },
            { user_id: session.psychologist_id, title: 'Patient absent', message: `Le patient ${patientName} ne s'est pas présenté à la séance du ${dateStr}. Compensation de ${policy.compensationPercent}% appliquée.`, link: '/espace-psy?page=sessions', push_sent: false },
          ]);

          sendPushToUser(session.patient_id, 'Absence non justifiée', `Vous n'avez pas assisté à votre séance du ${dateStr}.`, '/mon-espace?page=sessions').catch(() => {});
          sendPushToUser(session.psychologist_id, 'Patient absent', `Le patient ${patientName} ne s'est pas présenté à la séance du ${dateStr}.`, '/espace-psy?page=sessions').catch(() => {});

          if (patientEmail) sendNoShowNotification({ recipientEmail: patientEmail, recipientName: patientName, partnerName: psyName, date: dateStr, userType: 'patient', compensationPercent: policy.compensationPercent }).catch(() => {});
          if (psyEmail) sendNoShowNotification({ recipientEmail: psyEmail, recipientName: psyName, partnerName: patientName, date: dateStr, userType: 'psychologue', compensationPercent: policy.compensationPercent }).catch(() => {});

          noShowDetected++;
        } catch (err) {
          console.error(`Failed to process no-show for session ${session.id}:`, err);
          noShowFailed++;
        }
      }
    }

    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const { data: stalePayments } = await supabase
      .from('payments')
      .select('id')
      .in('status', ['initiated', 'pending'])
      .lt('created_at', thirtyMinAgo);

    let staleCleaned = 0;
    if (stalePayments && stalePayments.length > 0) {
      const { error: staleErr } = await supabase
        .from('payments')
        .update({ status: 'failed', updated_at: new Date().toISOString() })
        .in('id', stalePayments.map((p: any) => p.id));
      if (!staleErr) staleCleaned = stalePayments.length;
    }

    res.json({ success: true, processed, failed, total: notifications.length, reminderSent, reminderFailed, noShowDetected, noShowFailed, stalePaymentsCleaned: staleCleaned });
  } catch (err: any) {
    console.error('Push cron error:', err);
    res.status(500).json({ error: err.message });
  }
}

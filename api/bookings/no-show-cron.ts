import { createClient } from '@supabase/supabase-js';
import { sendPushToUser } from '../notifications/send-push';
import { sendNoShowNotification } from '../_lib/email.js';
import { calculateRefund } from '../_lib/cancellation-policy';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

let supabase: any;
try {
  if (supabaseUrl && supabaseKey) {
    supabase = createClient(supabaseUrl, supabaseKey);
  }
} catch (e) {
  console.error("Failed to initialize Supabase client in no-show-cron:", e);
}

const CRON_SECRET = process.env.CRON_SECRET || '';

export default async function handler(req: any, res: any) {
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
    // Find confirmed sessions whose end time (booked_at + duration) is more than 15 minutes ago
    const gracePeriodMs = 15 * 60 * 1000;
    const cutoff = new Date(Date.now() - gracePeriodMs).toISOString();

    const { data: sessions, error } = await supabase
      .from('bookings')
      .select('id, patient_id, psychologist_id, booked_at, duration_minutes, status')
      .eq('status', 'confirmed')
      .lte('booked_at', cutoff);

    if (error) {
      console.error('Failed to fetch sessions for no-show check:', error);
      return res.status(500).json({ error: error.message });
    }

    if (!sessions || sessions.length === 0) {
      return res.json({ success: true, detected: 0, message: 'No sessions to check' });
    }

    // Filter: session end time (booked_at + duration) must be >= 15 min in the past
    const now = Date.now();
    const noShowSessions = sessions.filter((s: any) => {
      const sessionEnd = new Date(s.booked_at).getTime() + (s.duration_minutes || 60) * 60 * 1000;
      return sessionEnd + gracePeriodMs <= now;
    });

    if (noShowSessions.length === 0) {
      return res.json({ success: true, detected: 0, message: 'No no-shows detected yet' });
    }

    let detected = 0;
    let failed = 0;

    for (const session of noShowSessions) {
      try {
        // 1. Mark as no-show with timestamp
        const { error: updateError } = await supabase
          .from('bookings')
          .update({ status: 'no-show', no_show_detected_at: new Date().toISOString() })
          .eq('id', session.id);

        if (updateError) {
          console.error(`Failed to update booking ${session.id}:`, updateError);
          failed++;
          continue;
        }

        // 2. Fetch profiles for notification
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
          weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
          hour: '2-digit', minute: '2-digit',
        });

        // 3. Calculate compensation using policy engine
        const policy = calculateRefund(new Date(session.booked_at), new Date());

        // 4. Create in-app notifications
        const notifications = [
          { user_id: session.patient_id, title: 'Absence non justifiée', message: `Vous n'avez pas assisté à la séance du ${dateStr}. Aucun remboursement ne sera effectué.`, link: '/mon-espace?page=sessions', push_sent: false },
          { user_id: session.psychologist_id, title: 'Patient absent', message: `Le patient ${patientName} ne s'est pas présenté à la séance du ${dateStr}. Compensation de ${policy.compensationPercent}% appliquée.`, link: '/espace-psy?page=sessions', push_sent: false },
        ];

        await supabase.from('notifications').insert(notifications);

        // 5. Send push notifications
        await sendPushToUser(session.patient_id, 'Absence non justifiée', `Vous n'avez pas assisté à votre séance du ${dateStr}.`, '/mon-espace?page=sessions').catch(console.error);
        await sendPushToUser(session.psychologist_id, 'Patient absent', `Le patient ${patientName} ne s'est pas présenté à la séance du ${dateStr}.`, '/espace-psy?page=sessions').catch(console.error);

        // 6. Send email notifications
        if (patientEmail) {
          await sendNoShowNotification({
            recipientEmail: patientEmail,
            recipientName: patientName,
            partnerName: psyName,
            date: dateStr,
            userType: 'patient',
            compensationPercent: policy.compensationPercent,
          }).catch(console.error);
        }
        if (psyEmail) {
          await sendNoShowNotification({
            recipientEmail: psyEmail,
            recipientName: psyName,
            partnerName: patientName,
            date: dateStr,
            userType: 'psychologue',
            compensationPercent: policy.compensationPercent,
          }).catch(console.error);
        }

        detected++;
      } catch (err) {
        console.error(`Failed to process no-show for session ${session.id}:`, err);
        failed++;
      }
    }

    res.json({ success: true, detected, failed, total: noShowSessions.length });
  } catch (err: any) {
    console.error('No-show cron error:', err);
    res.status(500).json({ error: err.message });
  }
}
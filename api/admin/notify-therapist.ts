import { createClient } from '@supabase/supabase-js';
import { sendTherapistApproved, sendTherapistRejected } from '../_lib/email';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

let supabase: any;
try {
  if (supabaseUrl && supabaseKey) {
    supabase = createClient(supabaseUrl, supabaseKey);
  }
} catch (e) {
  console.error("Failed to initialize Supabase client in notify-therapist:", e);
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

  // ── Authorize: must be an admin ─────────────────────────────────────────────
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('user_id', user.id)
    .single();

  if (profileError || !profile?.is_admin) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  try {
    const { therapist_id, action } = req.body;

    if (!therapist_id || !['approved', 'rejected'].includes(action)) {
      return res.status(400).json({ error: 'therapist_id and action (approved|rejected) are required' });
    }

    // Fetch therapist profile
    const { data: therapist } = await supabase
      .from('profiles')
      .select('full_name, approval_status')
      .eq('user_id', therapist_id)
      .single();

    const { data: authUser } = await supabase.auth.admin.getUserById(therapist_id);

    const email = authUser?.user?.email;
    const name  = therapist?.full_name || 'Thérapeute';

    if (email) {
      if (action === 'approved') {
        await sendTherapistApproved({ therapistEmail: email, therapistName: name });
      } else {
        await sendTherapistRejected({ therapistEmail: email, therapistName: name });
      }
    }

    res.json({ success: true, notified: !!email });
  } catch (err: any) {
    console.error('Notify error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

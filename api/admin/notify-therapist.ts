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
    console.error("Supabase client is not initialized in notify-therapist. URL:", supabaseUrl ? "Present" : "Missing", "Key:", supabaseKey ? "Present" : "Missing");
    return res.status(500).json({ error: 'Database client configuration error: Missing Supabase URL or Service Role Key' });
  }

  try {
    const { therapist_id, action } = req.body; // action: 'approved' | 'rejected'

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
    res.status(500).json({ error: err.message });
  }
}

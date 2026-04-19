import { createClient } from '@supabase/supabase-js';
import { sendTherapistApproved, sendTherapistRejected } from '../_lib/email';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
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

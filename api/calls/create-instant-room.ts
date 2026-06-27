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

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!supabase) {
    console.error("Missing env vars: SUPABASE_URL=" + !!process.env.SUPABASE_URL + " SUPABASE_SERVICE_ROLE_KEY=" + !!process.env.SUPABASE_SERVICE_ROLE_KEY);
    return res.status(500).json({ error: 'Database client configuration error' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Missing Authorization header' });
  }

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return res.status(401).json({ error: 'Unauthorized user' });
  }

  const { psychologist_id, request_id } = req.body;
  if (!psychologist_id) {
    return res.status(400).json({ error: 'psychologist_id is required' });
  }
  if (!request_id) {
    return res.status(400).json({ error: 'request_id is required' });
  }

  if (user.id !== psychologist_id) {
    return res.status(403).json({ error: 'You can only accept requests assigned to you' });
  }

  try {
    const { data: request, error: reqError } = await supabase
      .from('immediate_session_requests')
      .select('id, psychologist_id, status')
      .eq('id', request_id)
      .eq('psychologist_id', psychologist_id)
      .eq('status', 'pending')
      .single();

    if (reqError || !request) {
      return res.status(404).json({ error: 'Request not found or already processed' });
    }

    const roomId = `instant-${user.id}-${psychologist_id}-${Date.now()}`;

    const DAILY_API_KEY = process.env.DAILY_API_KEY;
    let roomUrl = `https://majal.daily.co/${roomId}`;

    if (DAILY_API_KEY) {
      try {
        const dailyResponse = await fetch('https://api.daily.co/v1/rooms', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${DAILY_API_KEY}`,
          },
          body: JSON.stringify({
            name: roomId,
            privacy: 'public',
            properties: {
              enable_chat: true,
              start_video_off: false,
              start_audio_off: false,
              exp: Math.round(Date.now() / 1000) + 3600,
            },
          }),
        });

        const dailyData = await dailyResponse.json();
        if (dailyResponse.ok && dailyData.url) {
          roomUrl = dailyData.url;
        } else {
          console.error('Daily.co API error:', dailyData);
        }
      } catch (err) {
        console.error('Daily.co API error:', err);
      }
    } else {
      console.warn('DAILY_API_KEY not set — using fallback room URL');
    }

    const { error: updateError } = await supabase.from('immediate_session_requests').update({
      status: 'accepted',
      responded_at: new Date().toISOString(),
      room_url: roomUrl,
    }).eq('id', request_id);

    if (updateError) {
      console.error('Failed to update request:', updateError);
      return res.status(500).json({ error: 'Failed to update request status' });
    }

    res.json({ success: true, url: roomUrl });
  } catch (err: any) {
    console.error('Instant room creation error:', err);
    res.status(500).json({ error: err.message });
  }
}

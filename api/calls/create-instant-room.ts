import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
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

  const { psychologist_id } = req.body;
  if (!psychologist_id) {
    return res.status(400).json({ error: 'psychologist_id is required' });
  }

  try {
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
        }
      } catch (err) {
        console.error('Daily.co API error:', err);
      }
    }

    // Store the instant session record
    await supabase.from('immediate_session_requests').update({
      status: 'accepted',
      responded_at: new Date().toISOString(),
      room_url: roomUrl,
    }).eq('id', req.body.request_id);

    res.json({ success: true, url: roomUrl });
  } catch (err: any) {
    console.error('Instant room creation error:', err);
    res.status(500).json({ error: err.message });
  }
}

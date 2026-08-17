import { createClient } from '@supabase/supabase-js';
import { rateLimit } from '../_lib/rate-limit.js';

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

  // Abuse protection: 20 audio-room creations per 10 minutes per client IP
  // (each bills the Daily.co API). Applied after auth, before the costly call.
  const limit = rateLimit(req, { key: "create-audio-room", windowMs: 10 * 60 * 1000, max: 20 });
  if (!limit.ok) {
    res.setHeader("Retry-After", String(limit.retryAfter ?? 60));
    return res.status(429).json({ error: 'Too many requests, please try again later.' });
  }

  const { title } = req.body || {};
  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'title is required' });
  }

  const DAILY_API_KEY = process.env.DAILY_API_KEY;
  if (!DAILY_API_KEY) {
    console.error("DAILY_API_KEY is not set");
    return res.status(500).json({ error: 'Audio service not configured. Please contact support.' });
  }

  try {
    const dailyResponse = await fetch('https://api.daily.co/v1/rooms', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DAILY_API_KEY}`,
      },
      body: JSON.stringify({
        name: `audio-${Date.now()}`,
        privacy: 'private',
        properties: {
          enable_chat: true,
          start_video_off: true,
          start_audio_off: false,
          exp: Math.round(Date.now() / 1000) + 3600,
        },
      }),
    });

    const dailyData = await dailyResponse.json();
    if (!dailyResponse.ok || !dailyData.url) {
      console.error('Daily.co API error:', dailyData);
      return res.status(500).json({ error: 'Failed to create audio room. Please try again.' });
    }

    const roomUrl = dailyData.url;

    const { data: inserted, error: insertError } = await supabase
      .from('audio_rooms')
      .insert({
        host_id: user.id,
        title: title.trim(),
        room_url: roomUrl,
        privacy: 'private',
        is_live: true,
      })
      .select('id')
      .single();

    if (insertError || !inserted) {
      console.error('Failed to register audio room:', insertError);
      return res.status(500).json({ error: 'Failed to register audio room' });
    }

    res.json({ id: inserted.id, url: roomUrl });
  } catch (err: any) {
    console.error('Audio room creation handler error:', err);
    res.status(500).json({ error: err.message });
  }
}

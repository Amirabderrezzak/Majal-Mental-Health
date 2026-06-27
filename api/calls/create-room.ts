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

  const { booking_id } = req.body;
  if (!booking_id) {
    return res.status(400).json({ error: 'booking_id is required' });
  }

  try {
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('id, psychologist_id, status, video_room_url, booked_at, duration_minutes')
      .eq('id', booking_id)
      .single();

    if (bookingError || !booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    if (booking.psychologist_id !== user.id) {
      return res.status(403).json({ error: 'You are not authorized to start calls for this booking' });
    }

    if (booking.status === 'cancelled') {
      return res.status(400).json({ error: 'Cannot start a video call for a cancelled session' });
    }

    if (booking.status === 'done') {
      return res.status(400).json({ error: 'This session has already ended' });
    }

    if (booking.video_room_url) {
      return res.json({ success: true, url: booking.video_room_url });
    }

    // Time-based gate: only allow room creation within allowed window
    const now = new Date();
    const sessionStart = new Date(booking.booked_at);
    const durationMs = (booking.duration_minutes || 60) * 60 * 1000;
    const sessionEnd = new Date(sessionStart.getTime() + durationMs);
    const earlyBuffer = 15 * 60 * 1000; // 15 minutes before session

    if (now < new Date(sessionStart.getTime() - earlyBuffer)) {
      return res.status(400).json({ error: 'La session n\'est pas encore ouverte. Vous pourrez démarrer l\'appel 15 minutes avant l\'heure prévue.' });
    }
    if (now > sessionEnd) {
      return res.status(400).json({ error: 'Cette session est terminée.' });
    }

    const DAILY_API_KEY = process.env.DAILY_API_KEY;
    if (!DAILY_API_KEY) {
      console.error("DAILY_API_KEY is not set");
      return res.status(500).json({ error: 'Video service not configured. Please contact support.' });
    }

    let roomUrl: string | null = null;

    try {
      const dailyResponse = await fetch('https://api.daily.co/v1/rooms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${DAILY_API_KEY}`,
        },
        body: JSON.stringify({
          name: `booking-${booking_id}`,
          privacy: 'public',
          properties: {
            enable_chat: true,
            start_video_off: false,
            start_audio_off: false,
            max_participants_duration: (booking.duration_minutes || 60) * 60,
            exp: Math.round(sessionEnd.getTime() / 1000) + 900,
          },
        }),
      });

      const dailyData = await dailyResponse.json();
      if (dailyResponse.ok && dailyData.url) {
        roomUrl = dailyData.url;
      } else {
        console.error('Daily.co API error:', dailyData);
        return res.status(500).json({ error: 'Failed to create video room. Please try again.' });
      }
    } catch (err) {
      console.error('Failed to contact Daily.co API:', err);
      return res.status(500).json({ error: 'Video service unavailable. Please try again.' });
    }

    const { error: updateError } = await supabase
      .from('bookings')
      .update({ video_room_url: roomUrl })
      .eq('id', booking_id);

    if (updateError) {
      console.error('Failed to update booking:', updateError);
      return res.status(500).json({ error: 'Failed to save video room URL' });
    }

    res.json({ success: true, url: roomUrl });
  } catch (err: any) {
    console.error('Room creation handler error:', err);
    res.status(500).json({ error: err.message });
  }
}

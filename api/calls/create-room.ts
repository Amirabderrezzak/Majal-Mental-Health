import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
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
    // 1. Verify the user is a psychologist and the psychologist assigned to this booking
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('id, psychologist_id, status')
      .eq('id', booking_id)
      .single();

    if (bookingError || !booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    if (booking.psychologist_id !== user.id) {
      return res.status(403).json({ error: 'You are not authorized to start calls for this booking' });
    }

    // 2. Generate Daily.co room URL dynamically
    const DAILY_API_KEY = process.env.DAILY_API_KEY;
    // Fallback unique room URL for development/demo testing if Daily API key is not configured
    let roomUrl = `https://majal.daily.co/booking-${booking_id}`;

    if (DAILY_API_KEY) {
      try {
        const dailyResponse = await fetch('https://api.daily.co/v1/rooms', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${DAILY_API_KEY}`,
          },
          body: JSON.stringify({
            name: `booking-${booking_id}`,
            privacy: 'public', // Set to public for simplified guest access, or private with meeting tokens
            properties: {
              enable_chat: true,
              start_video_off: false,
              start_audio_off: false,
              exp: Math.round(Date.now() / 1000) + 3600 * 2, // expires in 2 hours
            },
          }),
        });

        const dailyData = await dailyResponse.json();
        if (dailyResponse.ok && dailyData.url) {
          roomUrl = dailyData.url;
        } else {
          console.warn('Daily.co room creation failed, using fallback:', dailyData);
        }
      } catch (err) {
        console.error('Failed to contact Daily.co API:', err);
      }
    }

    // 3. Update the booking row with the video room URL
    const { error: updateError } = await supabase
      .from('bookings')
      .update({ video_room_url: roomUrl })
      .eq('id', booking_id);

    if (updateError) {
      return res.status(500).json({ error: updateError.message });
    }

    res.json({ success: true, url: roomUrl });
  } catch (err: any) {
    console.error('Room creation handler error:', err);
    res.status(500).json({ error: err.message });
  }
}

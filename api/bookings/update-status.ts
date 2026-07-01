import { createClient } from '@supabase/supabase-js';
import { sendBookingStatusUpdate, sendCancellationConfirmation } from '../_lib/email.js';
import { sendPushToUser } from '../notifications/send-push.js';
import { calculateRefund } from '../_lib/cancellation-policy.js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

let supabase: any;
try {
  if (supabaseUrl && supabaseKey) {
    supabase = createClient(supabaseUrl, supabaseKey);
  }
} catch (e) {
  console.error("Failed to initialize Supabase client in update-status:", e);
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!supabase) {
    console.error("Supabase client is not initialized in update-status.");
    return res.status(500).json({ error: 'Database client configuration error' });
  }

  // 1. Authenticate caller using JWT token
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid authorization header' });
  }

  const token = authHeader.split(' ')[1];
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }

  const callerId = user.id;

  try {
    const { booking_id, status } = req.body;

    if (!booking_id || !status) {
      return res.status(400).json({ error: 'booking_id and status are required' });
    }

    if (!['confirmed', 'cancelled', 'done'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    // 2. Fetch booking details to verify authorization
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('id, booked_at, status, patient_id, psychologist_id')
      .eq('id', booking_id)
      .single();

    if (bookingError || !booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    const isPatient = booking.patient_id === callerId;
    const isTherapist = booking.psychologist_id === callerId;

    if (!isPatient && !isTherapist) {
      return res.status(403).json({ error: 'Forbidden: You do not have permission to modify this booking' });
    }

    // Patients can only cancel booking
    if (isPatient && status !== 'cancelled') {
      return res.status(400).json({ error: 'Patients are only allowed to cancel bookings' });
    }

    // Update booking in database
    const { error: updateError } = await supabase
      .from('bookings')
      .update({ status })
      .eq('id', booking_id);

    if (updateError) {
      return res.status(500).json({ error: updateError.message });
    }

    // Determine recipient and partner names for notifications
    const recipientId = isPatient ? booking.psychologist_id : booking.patient_id;
    const senderId = callerId;

    // Fetch details of both parties to send proper email
    const { data: recipientProfile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('user_id', recipientId)
      .single();

    const { data: senderProfile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('user_id', senderId)
      .single();

    const { data: recipientAuth } = await supabase.auth.admin.getUserById(recipientId);

    const recipientEmail = recipientAuth?.user?.email;
    const recipientName = recipientProfile?.full_name || 'Utilisateur';
    const partnerName = senderProfile?.full_name || 'Utilisateur';

    const dateStr = new Date(booking.booked_at).toLocaleDateString('fr-FR', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });

    if (recipientEmail) {
      if (status === "cancelled") {
        const policy = calculateRefund(new Date(booking.booked_at), new Date());
        await sendCancellationConfirmation({
          recipientEmail,
          recipientName,
          partnerName,
          date: dateStr,
          refundPercent: policy.refundPercent,
          compensationPercent: policy.compensationPercent,
          userType: isPatient ? 'patient' : 'psychologue'
        }).catch(console.error);
      } else {
        await sendBookingStatusUpdate({
          recipientEmail,
          recipientName,
          partnerName,
          date: dateStr,
          status,
          userType: isPatient ? 'psychologue' : 'patient'
        }).catch(console.error);
      }
    }

    // Send push notification to recipient
    const pushTitle = status === 'cancelled' ? 'Session annulée' : status === 'confirmed' ? 'Session confirmée' : 'Mise à jour de session';
    const pushBody = status === 'cancelled'
      ? `La session du ${dateStr} a été annulée par ${partnerName}.`
      : status === 'confirmed'
      ? `Votre session du ${dateStr} avec ${partnerName} a été confirmée.`
      : `La session avec ${partnerName} est maintenant "${status}".`;
    sendPushToUser(recipientId, pushTitle, pushBody, '/mon-espace').catch(console.error);

    res.json({ success: true, booking_id, status });
  } catch (err: any) {
    console.error('Update status endpoint error:', err);
    res.status(500).json({ error: err.message });
  }
}

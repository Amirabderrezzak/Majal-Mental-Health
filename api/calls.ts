import { rateLimit } from "./_lib/rate-limit.js";
import { getDb, getCaller, cors, getContact } from "./_lib/db.js";
import { notify, flushPushes } from "./_lib/push.js";
import { dailyConfigured, ensureRoom, createToken, joinUrl, roomNameFromUrl } from "./_lib/daily.js";

const EARLY_JOIN_MS = 15 * 60 * 1000;
const AUDIO_ROOM_MS = 60 * 60 * 1000;

function limited(req: any, res: any, key: string, id: string, max: number) {
  const r = rateLimit(req, { key, windowMs: 10 * 60 * 1000, max, id });
  if (r.ok) return false;
  res.setHeader("Retry-After", String(r.retryAfter ?? 60));
  res.status(429).json({ error: "Too many requests, please try again later." });
  return true;
}

// ── room: join a paid session (patient OR therapist) ────────────────────────────
// Previously only the therapist could create the room, the room was public (the
// link alone let anyone in), and a therapist who never clicked "start" left the
// patient locked out — then recorded as the patient's no-show.
export const roomHandler = async (req: any, res: any) => {
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const db = getDb();
  if (!db) return res.status(500).json({ error: "Database client configuration error" });
  const user = await getCaller(db, req);
  if (!user) return res.status(401).json({ error: "Unauthorized user" });
  const { booking_id } = req.body || {};
  if (!booking_id) return res.status(400).json({ error: "booking_id is required" });
  if (limited(req, res, "call-room", user.id, 30)) return;

  try {
    const { data: booking } = await db.from("bookings")
      .select("id, psychologist_id, patient_id, status, video_room_url, booked_at, duration_minutes")
      .eq("id", booking_id).maybeSingle();
    if (!booking) return res.status(404).json({ error: "Booking not found" });
    const isPsy = booking.psychologist_id === user.id;
    const isPatient = booking.patient_id === user.id;
    if (!isPsy && !isPatient) return res.status(403).json({ error: "Vous ne participez pas à cette séance." });
    if (booking.status === "cancelled") return res.status(400).json({ error: "Cette séance a été annulée." });
    if (booking.status === "done" || booking.status === "no-show") return res.status(400).json({ error: "Cette séance est terminée." });
    if (booking.status !== "confirmed") return res.status(400).json({ error: "Cette séance n'est pas encore confirmée (paiement en attente)." });

    const start = new Date(booking.booked_at).getTime();
    const end = start + (booking.duration_minutes || 60) * 60000;
    if (Date.now() < start - EARLY_JOIN_MS) {
      return res.status(400).json({ error: "La séance n'est pas encore ouverte. Vous pourrez la rejoindre 15 minutes avant l'heure prévue." });
    }
    if (Date.now() > end) return res.status(400).json({ error: "Cette séance est terminée." });
    if (!dailyConfigured()) return res.status(500).json({ error: "Video service not configured. Please contact support." });

    const exp = Math.round(end / 1000) + 15 * 60;
    let roomUrl = booking.video_room_url as string | null;
    const firstOpen = !roomUrl;
    if (!roomUrl) {
      roomUrl = await ensureRoom(`booking-${booking.id}`, { expSeconds: exp });
      await db.from("bookings").update({ video_room_url: roomUrl }).eq("id", booking.id);
    }

    const me = await getContact(db, user.id);
    const token = await createToken({
      room: roomNameFromUrl(roomUrl),
      userId: user.id,
      userName: me.name || (isPsy ? "Thérapeute" : "Patient"),
      isOwner: isPsy,
      expSeconds: exp,
    });

    if (firstOpen) {
      const otherId = isPsy ? booking.patient_id : booking.psychologist_id;
      await notify(db, otherId, "Séance ouverte",
        isPsy ? "Votre thérapeute vous attend dans le salon vidéo." : "Votre patient vous attend dans le salon vidéo.",
        isPsy ? "/mon-espace?page=sessions" : "/espace-psy?page=sessions");
      await flushPushes(db, [otherId]).catch(console.error);
    }

    res.json({ success: true, url: joinUrl(roomUrl, token) });
  } catch (err: any) {
    console.error("Room handler error:", err);
    res.status(502).json({ error: "Le service vidéo est indisponible. Réessayez dans un instant." });
  }
};

// ── instant-accept: therapist accepts a "Parler maintenant" request ─────────────
// Accepting no longer opens a free, unrecorded call: the patient is sent to
// checkout, and the session is a normal paid booking (joined via `room`).
export const instantAcceptHandler = async (req: any, res: any) => {
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const db = getDb();
  if (!db) return res.status(500).json({ error: "Database client configuration error" });
  const user = await getCaller(db, req);
  if (!user) return res.status(401).json({ error: "Unauthorized user" });
  const { request_id } = req.body || {};
  if (!request_id) return res.status(400).json({ error: "request_id is required" });
  if (limited(req, res, "instant-accept", user.id, 30)) return;

  await db.rpc("expire_immediate_requests");
  const { data: accepted } = await db.from("immediate_session_requests")
    .update({ status: "accepted", responded_at: new Date().toISOString() })
    .eq("id", request_id).eq("psychologist_id", user.id).eq("status", "pending")
    .gt("expires_at", new Date().toISOString())
    .select("id, patient_id").maybeSingle();
  if (!accepted) return res.status(400).json({ error: "Cette demande n'est plus disponible (expirée ou déjà traitée)." });

  await notify(db, accepted.patient_id, "Demande acceptée", "Votre psychologue est disponible. Finalisez le paiement pour commencer la séance.", "/psychologues");
  await flushPushes(db, [accepted.patient_id]).catch(console.error);
  res.json({ success: true });
};

// ── audio-room: an approved therapist opens a live audio room ──────────────────
export const audioRoomHandler = async (req: any, res: any) => {
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const db = getDb();
  if (!db) return res.status(500).json({ error: "Database client configuration error" });
  const user = await getCaller(db, req);
  if (!user) return res.status(401).json({ error: "Unauthorized user" });
  if (limited(req, res, "create-audio-room", user.id, 20)) return;

  const title = typeof req.body?.title === "string" ? req.body.title.trim().slice(0, 120) : "";
  if (!title) return res.status(400).json({ error: "title is required" });

  const { data: host } = await db.from("profiles").select("full_name, user_type, approval_status").eq("user_id", user.id).maybeSingle();
  if (host?.user_type !== "psychologue" || host?.approval_status !== "approved") {
    return res.status(403).json({ error: "Seuls les psychologues approuvés peuvent ouvrir un salon." });
  }
  if (!dailyConfigured()) return res.status(500).json({ error: "Audio service not configured. Please contact support." });

  try {
    const endsAt = Date.now() + AUDIO_ROOM_MS;
    const exp = Math.round(endsAt / 1000);
    const roomUrl = await ensureRoom(`audio-${user.id.slice(0, 8)}-${Date.now()}`, { expSeconds: exp, audioOnly: true });
    const { data: inserted, error } = await db.from("audio_rooms").insert({
      host_id: user.id, title, room_url: roomUrl, privacy: "private", is_live: true, ends_at: new Date(endsAt).toISOString(),
    }).select("id").single();
    if (error || !inserted) return res.status(500).json({ error: "Failed to register audio room" });
    const token = await createToken({ room: roomNameFromUrl(roomUrl), userId: user.id, userName: host.full_name || "Thérapeute", isOwner: true, expSeconds: exp, audioOnly: true });
    res.json({ id: inserted.id, url: joinUrl(roomUrl, token) });
  } catch (err) {
    console.error("Audio room error:", err);
    res.status(502).json({ error: "Failed to create audio room. Please try again." });
  }
};

// ── audio-join: any signed-in user joins a live room as a listener ─────────────
export const audioJoinHandler = async (req: any, res: any) => {
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const db = getDb();
  if (!db) return res.status(500).json({ error: "Database client configuration error" });
  const user = await getCaller(db, req);
  if (!user) return res.status(401).json({ error: "Connectez-vous pour rejoindre le salon." });
  if (limited(req, res, "audio-join", user.id, 60)) return;

  const { data: room } = await db.from("audio_rooms").select("id, room_url, is_live, ends_at, host_id").eq("id", req.body?.room_id).maybeSingle();
  if (!room || !room.is_live || new Date(room.ends_at).getTime() <= Date.now()) {
    return res.status(404).json({ error: "Ce salon est terminé." });
  }
  try {
    const token = await createToken({
      room: roomNameFromUrl(room.room_url),
      userId: user.id,
      userName: "Participant", // listeners stay anonymous to each other
      isOwner: room.host_id === user.id,
      expSeconds: Math.round(new Date(room.ends_at).getTime() / 1000),
      audioOnly: true,
    });
    res.json({ url: joinUrl(room.room_url, token) });
  } catch (err) {
    console.error("Audio join error:", err);
    res.status(502).json({ error: "Impossible de rejoindre le salon pour le moment." });
  }
};

export default async function handler(req: any, res: any) {
  switch (req.query.action as string) {
    case "room": return roomHandler(req, res);
    case "instant-accept": return instantAcceptHandler(req, res);
    case "audio-room": return audioRoomHandler(req, res);
    case "audio-join": return audioJoinHandler(req, res);
    default: return res.status(400).json({ error: "Unknown or missing action" });
  }
}

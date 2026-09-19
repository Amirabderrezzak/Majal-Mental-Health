import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { sendSessionReminder, sendNoShowNotification } from "./_lib/email.js";
import { calculateRefund } from "./_lib/cancellation-policy.js";
import { formatAlgiersLong } from "./_lib/slots.js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
let supabase: any = null;
try {
  if (supabaseUrl && supabaseKey) {
    supabase = createClient(supabaseUrl, supabaseKey);
  }
} catch (e) {
  console.error("Failed to create Supabase client in notifications:", e);
}

function cors(res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

const VAPID_PUBLIC_KEY = process.env.VITE_FIREBASE_VAPID_KEY || "";
const VAPID_PRIVATE_KEY = process.env.FIREBASE_VAPID_PRIVATE_KEY || "";
const VAPID_MAILTO = process.env.FIREBASE_VAPID_MAILTO || "mailto:admin@majalpsy.com";

let webpush: any = null;

async function getWebPush() {
  if (webpush) return webpush;
  try {
    const wp = await import("web-push");
    wp.default.setVapidDetails(VAPID_MAILTO, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    webpush = wp.default;
    return webpush;
  } catch (err) {
    console.error("Failed to load web-push:", err);
    return null;
  }
}

export async function sendPushToUser(userId: string, title: string, body: string, url: string = "/") {
  if (!supabase) return { sent: 0, errors: 0 };

  const { data: subscriptions } = await supabase
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("user_id", userId);

  if (!subscriptions || subscriptions.length === 0) return { sent: 0, errors: 0 };

  const wp = await getWebPush();
  if (!wp) return { sent: 0, errors: subscriptions.length };

  let sent = 0;
  let errors = 0;

  for (const sub of subscriptions) {
    try {
      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      };

      await wp.sendNotification(pushSubscription, JSON.stringify({
        notification: { title, body },
        data: { tag: "majal-notification", link: url },
      }));

      sent++;
    } catch (err: any) {
      errors++;
      if (err.statusCode === 404 || err.statusCode === 410) {
        await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
      }
    }
  }

  return { sent, errors };
}

const CRON_SECRET = process.env.CRON_SECRET || "";

// Reject unless the request proves knowledge of the shared CRON_SECRET, supplied
// either via the `x-cron-secret` header or an `Authorization: Bearer <secret>`
// header. If CRON_SECRET is unset (missing env), no value can match, so the
// endpoint stays locked down (returns 401 when the header is absent/mismatched).
function isCronAuthorized(req: any): boolean {
  if (!CRON_SECRET) return false;
  const headerSecret = req.headers["x-cron-secret"];
  const authHeader = req.headers.authorization;
  const bearer = typeof authHeader === "string" && authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;
  const provided = headerSecret || bearer;
  return provided === CRON_SECRET;
}

// ── preferences ──────────────────────────────────────────────────────────────
export const preferencesHandler = async (req: VercelRequest, res: VercelResponse) => {
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  if (!supabase) {
    return res.status(500).json({ error: "Database not configured" });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) return res.status(401).json({ error: "Missing token" });

  const token = authHeader.slice(7);
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: "Invalid token" });

  if (req.method === "GET") {
    const { data, error } = await supabase
      .from("profiles")
      .select("push_notifications_enabled")
      .eq("user_id", user.id)
      .single();

    if (error) {
      console.error("Failed to fetch push preference:", error);
      return res.status(200).json({ push_enabled: false });
    }

    return res.status(200).json({ push_enabled: data?.push_notifications_enabled ?? false });
  }

  if (req.method === "POST") {
    const { push_enabled } = req.body;
    if (typeof push_enabled !== "boolean") {
      return res.status(400).json({ error: "push_enabled must be a boolean" });
    }

    const { error } = await supabase
      .from("profiles")
      .update({ push_notifications_enabled: push_enabled })
      .eq("user_id", user.id);

    if (error) {
      console.error("Failed to save push preference:", error);
      return res.status(500).json({ error: "Failed to save preference" });
    }

    return res.status(200).json({ push_enabled });
  }

  return res.status(405).json({ error: "Method not allowed" });
};

// ── send-push ─────────────────────────────────────────────────────────────────
export const sendPushHandler = async (req: any, res: any) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!supabase) {
    return res.status(500).json({ error: "Database client not configured" });
  }

  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return res.status(500).json({ error: "Push notification keys not configured" });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: "Missing Authorization header" });
  }

  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    // SECURITY: a client may only push notifications to their own account.
    // The caller's identity is derived from the verified JWT (user.id) and the
    // requested target is forced to equal it, so no user can push to another
    // user's devices. Therapist→patient and other server-generated pushes are
    // handled by server-side/service-role flows (e.g. push-cron), which call
    // sendPushToUser() directly and are not subject to this restriction.
    const user_id = user.id;
    const { title, body, url } = req.body;

    if (!title || !body) {
      return res.status(400).json({ error: "title and body are required" });
    }

    const result = await sendPushToUser(user_id, title, body, url);
    res.json({ success: true, ...result });
  } catch (err: any) {
    console.error("Push notification error:", err);
    res.status(500).json({ error: err.message });
  }
};

// Did two participants actually meet in this booking's Daily room?
async function getRoomAttendance(session: { booked_at: string; duration_minutes?: number | null; video_room_url?: string | null }): Promise<"held" | "absent" | "unknown"> {
  if (!session.video_room_url) return "absent";
  const key = process.env.DAILY_API_KEY;
  if (!key) return "unknown";
  const room = session.video_room_url.split("/").pop();
  try {
    const r = await fetch(`https://api.daily.co/v1/meetings?room=${encodeURIComponent(room || "")}&limit=20`, { headers: { Authorization: `Bearer ${key}` } });
    if (r.status === 404) return "absent";
    if (!r.ok) return "unknown";
    const body: any = await r.json();
    const meetings: any[] = body?.data ?? [];
    const from = new Date(session.booked_at).getTime() - 30 * 60000;
    const to = new Date(session.booked_at).getTime() + ((session.duration_minutes || 60) + 30) * 60000;
    const held = meetings.some((m) => {
      const t = Number(m.start_time) * 1000;
      const people = new Set((m.participants ?? []).map((p: any) => p.user_id || p.participant_id)).size;
      return t >= from && t <= to && Math.max(people, m.max_participants ?? 0) >= 2;
    });
    return held ? "held" : "absent";
  } catch {
    return "unknown";
  }
}

// ── push-cron ──────────────────────────────────────────────────────────────────
export const pushCronHandler = async (req: any, res: any) => {
  // Require the shared secret for every method (GET = Vercel cron, POST = manual).
  if (!isCronAuthorized(req)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!supabase) {
    return res.status(500).json({ error: "Database client not configured" });
  }

  try {
    // Fetch recent unsent notifications (last 24h)
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: notifications, error } = await supabase
      .from("notifications")
      .select("id, user_id, title, content, link")
      .eq("push_sent", false)
      .gte("created_at", cutoff)
      .order("created_at", { ascending: true })
      .limit(50);

    if (error) {
      console.error("Failed to fetch notifications:", error);
      return res.status(500).json({ error: error.message });
    }

    if (!notifications || notifications.length === 0) {
      return res.json({ success: true, processed: 0 });
    }

    let processed = 0;
    let failed = 0;

    for (const notif of notifications) {
      if (!notif.user_id || !notif.title || !notif.content) {
        await supabase
          .from("notifications")
          .update({ push_sent: true })
          .eq("id", notif.id);
        processed++;
        continue;
      }

      try {
        await sendPushToUser(notif.user_id, notif.title, notif.content, notif.link || "/");
        await supabase
          .from("notifications")
          .update({ push_sent: true })
          .eq("id", notif.id);
        processed++;
      } catch (err) {
        console.error(`Failed to send push for notification ${notif.id}:`, err);
        failed++;
        // Mark as sent anyway to avoid infinite retries
        await supabase
          .from("notifications")
          .update({ push_sent: true })
          .eq("id", notif.id);
      }
    }

    let reminderSent = 0;
    let reminderFailed = 0;

    // Session reminder: find confirmed sessions happening tomorrow, in
    // Algeria local time (UTC+1, no DST) — NOT the server's own timezone.
    // Vercel functions run in UTC, so naive Date.setHours(0,0,0,0) would use
    // UTC midnight (= 1am Algeria time), shifting the day boundary by an hour.
    const ALGERIA_OFFSET_MS = 60 * 60 * 1000;
    const algeriaNow = new Date(Date.now() + ALGERIA_OFFSET_MS);
    const startOfTodayAlgeria = Date.UTC(algeriaNow.getUTCFullYear(), algeriaNow.getUTCMonth(), algeriaNow.getUTCDate()) - ALGERIA_OFFSET_MS;
    const tomorrow = new Date(startOfTodayAlgeria + 24 * 60 * 60 * 1000);
    const dayAfter = new Date(startOfTodayAlgeria + 2 * 24 * 60 * 60 * 1000);

    const { data: sessions } = await supabase
      .from("bookings")
      .select("id, patient_id, psychologist_id, booked_at, duration_minutes")
      .eq("status", "confirmed")
      .gte("booked_at", tomorrow.toISOString())
      .lt("booked_at", dayAfter.toISOString());

    if (sessions && sessions.length > 0) {
      for (const session of sessions) {
        try {
          const [patProf, psyProf] = await Promise.all([
            supabase.from("profiles").select("full_name, user_id").eq("user_id", session.patient_id).single(),
            supabase.from("profiles").select("full_name, user_id").eq("user_id", session.psychologist_id).single(),
          ]);
          const [patAuth, psyAuth] = await Promise.all([
            supabase.auth.admin.getUserById(session.patient_id),
            supabase.auth.admin.getUserById(session.psychologist_id),
          ]);

          const patientName = patProf.data?.full_name || "Patient";
          const psyName = psyProf.data?.full_name || "Psychologue";
          const patientEmail = patAuth?.data?.user?.email;
          const psyEmail = psyAuth?.data?.user?.email;
          const dateStr = formatAlgiersLong(session.booked_at);

          if (patientEmail) {
            await sendSessionReminder({
              recipientEmail: patientEmail,
              recipientName: patientName,
              partnerName: psyName,
              date: dateStr,
              duration: session.duration_minutes,
              userType: "patient",
            });
          }
          if (psyEmail) {
            await sendSessionReminder({
              recipientEmail: psyEmail,
              recipientName: psyName,
              partnerName: patientName,
              date: dateStr,
              duration: session.duration_minutes,
              userType: "psychologue",
            });
          }
          reminderSent += (patientEmail ? 1 : 0) + (psyEmail ? 1 : 0);
        } catch (err) {
          console.error(`Failed to send reminder for session ${session.id}:`, err);
          reminderFailed++;
        }
      }
    }

    // ── No-show detection ──────────────────────────────────────────────────
    let noShowDetected = 0;
    let noShowFailed = 0;

    const gracePeriodMs = 15 * 60 * 1000;
    const noShowCutoff = new Date(Date.now() - gracePeriodMs).toISOString();

    const { data: confirmedSessions, error: nsError } = await supabase
      .from("bookings")
      .select("id, patient_id, psychologist_id, booked_at, duration_minutes, video_room_url")
      .eq("status", "confirmed")
      .lte("booked_at", noShowCutoff)
      .order("booked_at", { ascending: true })
      .limit(50);

    if (!nsError && confirmedSessions && confirmedSessions.length > 0) {
      const now = Date.now();
      const noShowSessions = confirmedSessions.filter((s: any) => {
        const sessionEnd = new Date(s.booked_at).getTime() + (s.duration_minutes || 60) * 60 * 1000;
        return sessionEnd + gracePeriodMs <= now;
      });

      for (const session of noShowSessions) {
        try {
          // Evidence first: if two people actually shared the Daily room, the session
          // took place and is simply closed as "done". If Daily can't be queried we
          // leave the booking alone rather than wrongly declaring a no-show.
          const attendance = await getRoomAttendance(session);
          if (attendance === "unknown") continue;
          if (attendance === "held") {
            await supabase.from("bookings").update({ status: "done", updated_at: new Date().toISOString() }).eq("id", session.id).eq("status", "confirmed");
            continue;
          }

          const { data: flagged } = await supabase
            .from("bookings")
            .update({ status: "no-show", no_show_detected_at: new Date().toISOString() })
            .eq("id", session.id)
            .eq("status", "confirmed")
            .select("id");
          if (!flagged || flagged.length === 0) continue;

          const [patProf, psyProf] = await Promise.all([
            supabase.from("profiles").select("full_name, user_id").eq("user_id", session.patient_id).single(),
            supabase.from("profiles").select("full_name, user_id").eq("user_id", session.psychologist_id).single(),
          ]);
          const [patAuth, psyAuth] = await Promise.all([
            supabase.auth.admin.getUserById(session.patient_id),
            supabase.auth.admin.getUserById(session.psychologist_id),
          ]);

          const patientName = patProf.data?.full_name || "Patient";
          const psyName = psyProf.data?.full_name || "Psychologue";
          const patientEmail = patAuth?.data?.user?.email;
          const psyEmail = psyAuth?.data?.user?.email;
          const dateStr = formatAlgiersLong(session.booked_at);

          const policy = calculateRefund(new Date(session.booked_at), new Date());

          await supabase.from("notifications").insert([
            { user_id: session.patient_id, type: "booking", title: "Absence non justifiée", content: `Vous n'avez pas assisté à la séance du ${dateStr}. Aucun remboursement ne sera effectué.`, link: "/mon-espace?page=sessions", push_sent: false },
            { user_id: session.psychologist_id, type: "booking", title: "Patient absent", content: `Le patient ${patientName} ne s'est pas présenté à la séance du ${dateStr}. Compensation de ${policy.compensationPercent}% appliquée.`, link: "/espace-psy?page=sessions", push_sent: false },
          ]);

          sendPushToUser(session.patient_id, "Absence non justifiée", `Vous n'avez pas assisté à votre séance du ${dateStr}.`, "/mon-espace?page=sessions").catch(() => {});
          sendPushToUser(session.psychologist_id, "Patient absent", `Le patient ${patientName} ne s'est pas présenté à la séance du ${dateStr}.`, "/espace-psy?page=sessions").catch(() => {});

          if (patientEmail) sendNoShowNotification({ recipientEmail: patientEmail, recipientName: patientName, partnerName: psyName, date: dateStr, userType: "patient", compensationPercent: policy.compensationPercent }).catch(() => {});
          if (psyEmail) sendNoShowNotification({ recipientEmail: psyEmail, recipientName: psyName, partnerName: patientName, date: dateStr, userType: "psychologue", compensationPercent: policy.compensationPercent }).catch(() => {});

          noShowDetected++;
        } catch (err) {
          console.error(`Failed to process no-show for session ${session.id}:`, err);
          noShowFailed++;
        }
      }
    }

    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const { data: stalePayments } = await supabase
      .from("payments")
      .select("id")
      .in("status", ["initiated", "pending"])
      .lt("created_at", thirtyMinAgo);

    // Abandoned checkouts: release the slot held by a pending reservation.
    await supabase
      .from("bookings")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("status", "pending")
      .lt("created_at", thirtyMinAgo);

    let staleCleaned = 0;
    if (stalePayments && stalePayments.length > 0) {
      const { error: staleErr } = await supabase
        .from("payments")
        .update({ status: "failed", updated_at: new Date().toISOString() })
        .in("id", stalePayments.map((p: any) => p.id));
      if (!staleErr) staleCleaned = stalePayments.length;
    }

    // Immediate ("Parler maintenant") requests are otherwise only swept when a
    // therapist happens to open api/calls?action=instant-room — an abandoned
    // patient tab leaves them "pending" forever. Sweep them here too.
    let expiredRequests = 0;
    const { error: expireErr } = await supabase.rpc("expire_immediate_requests");
    if (!expireErr) expiredRequests = 1;

    res.json({ success: true, processed, failed, total: notifications.length, reminderSent, reminderFailed, noShowDetected, noShowFailed, stalePaymentsCleaned: staleCleaned, expiredRequestsSwept: expiredRequests });
  } catch (err: any) {
    console.error("Push cron error:", err);
    res.status(500).json({ error: err.message });
  }
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Vercel Cron authenticates via `Authorization: Bearer <CRON_SECRET>`, not the
  // `x-cron-secret` header — recognize both so a cron trigger with no `?action=`
  // still resolves to push-cron instead of 400ing before isCronAuthorized runs.
  const action =
    (req.query.action as string) ||
    (isCronAuthorized(req) ? "push-cron" : null);

  switch (action) {
    case "preferences":
      return preferencesHandler(req, res);
    case "send-push":
      return sendPushHandler(req, res);
    case "push-cron":
      return pushCronHandler(req, res);
    default:
      return res.status(400).json({ error: "Unknown or missing action" });
  }
}

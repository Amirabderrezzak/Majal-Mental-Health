import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { sendSessionReminder, sendNoShowNotification } from "./_lib/email.js";
import { calculateRefund } from "./_lib/cancellation-policy.js";

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
      .select("id, user_id, title, message, link")
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
      if (!notif.user_id || !notif.title || !notif.message) {
        await supabase
          .from("notifications")
          .update({ push_sent: true })
          .eq("id", notif.id);
        processed++;
        continue;
      }

      try {
        await sendPushToUser(notif.user_id, notif.title, notif.message, notif.link || "/");
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

    // Session reminder: find confirmed sessions happening tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const dayAfter = new Date(tomorrow);
    dayAfter.setDate(dayAfter.getDate() + 1);

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
          const dateStr = new Date(session.booked_at).toLocaleDateString("fr-FR", {
            weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit"
          });

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
      .select("id, patient_id, psychologist_id, booked_at, duration_minutes")
      .eq("status", "confirmed")
      .lte("booked_at", noShowCutoff);

    if (!nsError && confirmedSessions && confirmedSessions.length > 0) {
      const now = Date.now();
      const noShowSessions = confirmedSessions.filter((s: any) => {
        const sessionEnd = new Date(s.booked_at).getTime() + (s.duration_minutes || 60) * 60 * 1000;
        return sessionEnd + gracePeriodMs <= now;
      });

      for (const session of noShowSessions) {
        try {
          await supabase
            .from("bookings")
            .update({ status: "no-show", no_show_detected_at: new Date().toISOString() })
            .eq("id", session.id);

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
          const dateStr = new Date(session.booked_at).toLocaleDateString("fr-FR", {
            weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
          });

          const policy = calculateRefund(new Date(session.booked_at), new Date());

          await supabase.from("notifications").insert([
            { user_id: session.patient_id, title: "Absence non justifiée", message: `Vous n'avez pas assisté à la séance du ${dateStr}. Aucun remboursement ne sera effectué.`, link: "/mon-espace?page=sessions", push_sent: false },
            { user_id: session.psychologist_id, title: "Patient absent", message: `Le patient ${patientName} ne s'est pas présenté à la séance du ${dateStr}. Compensation de ${policy.compensationPercent}% appliquée.`, link: "/espace-psy?page=sessions", push_sent: false },
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

    let staleCleaned = 0;
    if (stalePayments && stalePayments.length > 0) {
      const { error: staleErr } = await supabase
        .from("payments")
        .update({ status: "failed", updated_at: new Date().toISOString() })
        .in("id", stalePayments.map((p: any) => p.id));
      if (!staleErr) staleCleaned = stalePayments.length;
    }

    res.json({ success: true, processed, failed, total: notifications.length, reminderSent, reminderFailed, noShowDetected, noShowFailed, stalePaymentsCleaned: staleCleaned });
  } catch (err: any) {
    console.error("Push cron error:", err);
    res.status(500).json({ error: err.message });
  }
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const action =
    (req.query.action as string) ||
    (req.headers["x-cron-secret"] ? "push-cron" : null);

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

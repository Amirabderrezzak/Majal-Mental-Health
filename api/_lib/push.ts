import type { SupabaseClient } from "@supabase/supabase-js";

let webpush: any = null;

async function getWebPush() {
  if (webpush) return webpush;
  const pub = process.env.VITE_FIREBASE_VAPID_KEY || "";
  const priv = process.env.FIREBASE_VAPID_PRIVATE_KEY || "";
  if (!pub || !priv) return null;
  try {
    const wp = await import("web-push");
    wp.default.setVapidDetails(process.env.FIREBASE_VAPID_MAILTO || "mailto:admin@majalpsy.com", pub, priv);
    webpush = wp.default;
    return webpush;
  } catch (err) {
    console.error("Failed to load web-push:", err);
    return null;
  }
}

/** Sends a push to every device of a user who has push turned on. */
export async function sendPushToUser(db: SupabaseClient, userId: string, title: string, body: string, url = "/") {
  // The on/off preference used to be stored but never consulted.
  const { data: prof } = await db.from("profiles").select("push_notifications_enabled").eq("user_id", userId).maybeSingle();
  if (prof?.push_notifications_enabled !== true) return { sent: 0, errors: 0 };

  const { data: subscriptions } = await db.from("push_subscriptions").select("endpoint, p256dh, auth").eq("user_id", userId);
  if (!subscriptions || subscriptions.length === 0) return { sent: 0, errors: 0 };

  const wp = await getWebPush();
  if (!wp) return { sent: 0, errors: subscriptions.length };

  let sent = 0;
  let errors = 0;
  for (const sub of subscriptions) {
    try {
      await wp.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify({ notification: { title, body }, data: { tag: "majal-notification", link: url } }),
      );
      sent++;
    } catch (err: any) {
      errors++;
      if (err.statusCode === 404 || err.statusCode === 410) {
        await db.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
      }
    }
  }
  return { sent, errors };
}

/**
 * Delivers in-app notifications that haven't been pushed yet. Called right after
 * the action that created them (booking confirmed, cancelled, message…), so
 * pushes are no longer held until the once-a-day cron — and each notification is
 * pushed exactly once (previously some were pushed directly AND again by cron).
 */
export async function flushPushes(db: SupabaseClient, userIds?: string[], limit = 200) {
  let q = db.from("notifications").select("id, user_id, title, content, link")
    .eq("push_sent", false)
    .gte("created_at", new Date(Date.now() - 24 * 3600 * 1000).toISOString())
    .order("created_at", { ascending: true })
    .limit(limit);
  if (userIds && userIds.length) q = q.in("user_id", userIds);
  const { data, error } = await q;
  if (error || !data) return { processed: 0, failed: 0 };

  let processed = 0;
  let failed = 0;
  for (const n of data) {
    // Claim first so two concurrent flushes never push the same notification.
    const { data: claimed } = await db.from("notifications").update({ push_sent: true }).eq("id", n.id).eq("push_sent", false).select("id");
    if (!claimed || claimed.length === 0) continue;
    try {
      await sendPushToUser(db, n.user_id, n.title, n.content, n.link || "/");
      processed++;
    } catch (err) {
      console.error(`push failed for notification ${n.id}:`, err);
      failed++;
    }
  }
  return { processed, failed };
}

/** Inserts an in-app notification and pushes it immediately. */
export async function notify(db: SupabaseClient, userId: string, title: string, content: string, link: string, type: "booking" | "message" | "system" = "booking") {
  const { error } = await db.from("notifications").insert({ user_id: userId, title, content, link, type, push_sent: false });
  if (error) console.error("notification insert failed:", error);
}

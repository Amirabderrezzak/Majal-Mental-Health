import type { VercelRequest, VercelResponse } from "@vercel/node";
import { sendNewMessageNotification } from "./_lib/email.js";
import { rateLimit } from "./_lib/rate-limit.js";
import { getDb, getCaller, cors, getContact, wantsEmail } from "./_lib/db.js";
import { flushPushes } from "./_lib/push.js";

const MAX_CONTENT = 5000;
const EMAIL_QUIET_MS = 15 * 60 * 1000;

export const sendHandler = async (req: VercelRequest, res: VercelResponse) => {
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const db = getDb();
  if (!db) return res.status(500).json({ error: "Database not configured" });
  const user = await getCaller(db, req);
  if (!user) return res.status(401).json({ error: "Invalid token" });

  // Messaging has no relationship restriction (a patient may ask a question
  // before booking), so rate limiting is the main spam guard.
  const limit = rateLimit(req, { key: "send-message", windowMs: 10 * 60 * 1000, max: 60, id: user.id });
  if (!limit.ok) {
    res.setHeader("Retry-After", String(limit.retryAfter ?? 60));
    return res.status(429).json({ error: "Too many messages, please slow down." });
  }

  const { receiver_id, content, file_url, file_type, file_name } = req.body || {};
  if (!receiver_id || typeof receiver_id !== "string") return res.status(400).json({ error: "receiver_id is required" });
  if (receiver_id === user.id) return res.status(400).json({ error: "You cannot message yourself" });
  const text = typeof content === "string" ? content.trim() : "";
  if (!text && !file_url) return res.status(400).json({ error: "content or file_url is required" });
  if (text.length > MAX_CONTENT) return res.status(400).json({ error: `Message trop long (${MAX_CONTENT} caractères maximum).` });

  // An attachment must be a file the sender uploaded to their own folder. A
  // free-form value let a sender point a message at anyone's storage path (the
  // storage read policy trusts paths referenced by the reader's messages).
  if (file_url != null) {
    if (typeof file_url !== "string" || !file_url.startsWith(`${user.id}/`) || file_url.includes("..") || /[:?#\\]/.test(file_url)) {
      return res.status(400).json({ error: "Pièce jointe invalide." });
    }
  }

  const { data: receiver } = await db.from("profiles").select("user_id").eq("user_id", receiver_id).maybeSingle();
  if (!receiver) return res.status(404).json({ error: "Recipient not found" });

  // Before the insert, so the quiet-period check below doesn't see this message.
  const { data: recent } = await db.from("messages").select("id")
    .eq("sender_id", user.id).eq("receiver_id", receiver_id)
    .gte("created_at", new Date(Date.now() - EMAIL_QUIET_MS).toISOString()).limit(1);

  const { data: message, error: insertError } = await db.from("messages").insert({
    sender_id: user.id,
    receiver_id,
    content: text || null,
    file_url: file_url || null,
    file_type: typeof file_type === "string" ? file_type.slice(0, 100) : null,
    file_name: typeof file_name === "string" ? file_name.slice(0, 200) : null,
  }).select().single();
  if (insertError) {
    console.error("Failed to insert message:", insertError);
    return res.status(500).json({ error: "Failed to send message" });
  }

  // One e-mail per conversation burst, not one per message, and only if the
  // recipient wants message e-mails.
  if (!recent || recent.length === 0) {
    const [sender, recipient] = await Promise.all([getContact(db, user.id), getContact(db, receiver_id)]);
    if (recipient.email && wantsEmail(recipient, "messages")) {
      sendNewMessageNotification({
        recipientEmail: recipient.email,
        recipientName: recipient.name || "Utilisateur",
        senderName: sender.name || "Utilisateur",
        userType: recipient.userType === "psychologue" ? "psychologue" : "patient",
      }).catch(console.error);
    }
  }
  await flushPushes(db, [receiver_id]).catch(console.error);

  return res.status(200).json(message);
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  switch ((req.query.action as string) || "send") {
    case "send": return sendHandler(req, res);
    default: return res.status(400).json({ error: "Unknown or missing action" });
  }
}

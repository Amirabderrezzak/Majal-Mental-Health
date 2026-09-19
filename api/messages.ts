import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { sendNewMessageNotification } from "./_lib/email.js";
import { rateLimit } from "./_lib/rate-limit.js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
let supabase: any = null;
try {
  if (supabaseUrl && supabaseKey) {
    supabase = createClient(supabaseUrl, supabaseKey);
  }
} catch (e) {
  console.error("Failed to create Supabase client in messages/send:", e);
}

function cors(res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

export const sendHandler = async (req: VercelRequest, res: VercelResponse) => {
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  if (!supabase) {
    return res.status(500).json({ error: "Database not configured" });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) return res.status(401).json({ error: "Missing token" });

  const token = authHeader.slice(7);
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: "Invalid token" });

  // Abuse protection: messaging has no relationship restriction (a patient can
  // legitimately message a psychologist before ever booking, to ask a
  // question — see Profil.tsx), so rate limiting is the main spam guard.
  const limit = rateLimit(req, { key: "send-message", windowMs: 10 * 60 * 1000, max: 60, id: user.id });
  if (!limit.ok) {
    res.setHeader("Retry-After", String(limit.retryAfter ?? 60));
    return res.status(429).json({ error: "Too many messages, please slow down." });
  }

  const { receiver_id, content, file_url, file_type, file_name } = req.body;
  if (!receiver_id) return res.status(400).json({ error: "receiver_id is required" });
  if (receiver_id === user.id) return res.status(400).json({ error: "You cannot message yourself" });

  if (!content && !file_url) return res.status(400).json({ error: "content or file_url is required" });

  const { data: receiverProfile, error: receiverError } = await supabase
    .from("profiles")
    .select("user_id")
    .eq("user_id", receiver_id)
    .maybeSingle();
  if (receiverError || !receiverProfile) {
    return res.status(404).json({ error: "Recipient not found" });
  }

  const { data: message, error: insertError } = await supabase.from("messages").insert({
    sender_id: user.id,
    receiver_id,
    content: content || null,
    file_url: file_url || null,
    file_type: file_type || null,
    file_name: file_name || null,
  }).select().single();

  if (insertError) {
    console.error("Failed to insert message:", insertError);
    return res.status(500).json({ error: "Failed to send message" });
  }

  // Fetch sender and recipient names + email
  const [senderProfile, recipientProfile] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("user_id", user.id).single(),
    supabase.from("profiles").select("full_name, user_type").eq("user_id", receiver_id).single(),
  ]);
  const [recipientAuth] = await Promise.all([
    supabase.auth.admin.getUserById(receiver_id),
  ]);

  const senderName = senderProfile.data?.full_name || "Utilisateur";
  const recipientName = recipientProfile.data?.full_name || "Utilisateur";
  const recipientEmail = recipientAuth?.data?.user?.email;
  const recipientType = recipientProfile.data?.user_type || "patient";

  // Send email notification asynchronously (don't block the response)
  if (recipientEmail) {
    sendNewMessageNotification({
      recipientEmail,
      recipientName,
      senderName,
      userType: recipientType === "psychologue" ? "psychologue" : "patient",
    }).catch(console.error);
  }

  return res.status(200).json(message);
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const action = (req.query.action as string) || "send";

  switch (action) {
    case "send":
      return sendHandler(req, res);
    default:
      return res.status(400).json({ error: "Unknown or missing action" });
  }
}

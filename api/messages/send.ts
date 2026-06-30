import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { sendNewMessageNotification } from "../_lib/email.js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
let supabase: ReturnType<typeof createClient> | null = null;
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
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

  const { receiver_id, content, file_url, file_type, file_name } = req.body;
  if (!receiver_id) return res.status(400).json({ error: "receiver_id is required" });

  if (!content && !file_url) return res.status(400).json({ error: "content or file_url is required" });

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
}

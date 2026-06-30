import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
let supabase: any = null;
try {
  if (supabaseUrl && supabaseKey) {
    supabase = createClient(supabaseUrl, supabaseKey);
  }
} catch (e) {
  console.error("Failed to create Supabase client in preferences:", e);
}

function cors(res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
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
}

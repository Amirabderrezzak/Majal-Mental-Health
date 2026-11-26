import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// One service-role client per function instance. Every handler used to build its
// own copy (some with `!` assertions that crashed at import when env was missing).
let client: SupabaseClient | null = null;

export function getDb(): SupabaseClient | null {
  if (client) return client;
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !key) return null;
  client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return client;
}

export interface AuthedUser {
  id: string;
  email?: string;
}

/** Verifies the caller's Supabase JWT. Returns null when missing/invalid. */
export async function getCaller(db: SupabaseClient, req: any): Promise<AuthedUser | null> {
  const header = req.headers?.authorization;
  if (typeof header !== "string" || !header.startsWith("Bearer ")) return null;
  const token = header.slice(7).trim();
  if (!token) return null;
  const { data, error } = await db.auth.getUser(token);
  if (error || !data?.user) return null;
  return { id: data.user.id, email: data.user.email ?? undefined };
}

export function cors(res: any, methods = "POST, OPTIONS") {
  res.setHeader("Access-Control-Allow-Origin", process.env.FRONTEND_URL || "*");
  res.setHeader("Access-Control-Allow-Methods", methods);
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

/** Name + e-mail of a user, for notifications. */
export async function getContact(db: SupabaseClient, userId: string) {
  const [{ data: profile }, { data: auth }] = await Promise.all([
    db.from("profiles").select("full_name, user_type, notification_preferences, push_notifications_enabled").eq("user_id", userId).maybeSingle(),
    db.auth.admin.getUserById(userId),
  ]);
  return {
    name: (profile?.full_name as string | null) || null,
    email: auth?.user?.email ?? null,
    userType: (profile?.user_type as string | null) ?? "patient",
    prefs: (profile?.notification_preferences ?? {}) as Record<string, boolean>,
    pushEnabled: profile?.push_notifications_enabled === true,
  };
}

export type EmailKind = "newBookings" | "reminders" | "messages";

/**
 * Therapists can switch some e-mails off in Settings (the toggles used to be
 * saved but never read). Patients have no such switches and always get them.
 * Defaults match the UI: messages off, the rest on.
 */
export function wantsEmail(contact: { userType: string; prefs: Record<string, boolean> }, kind: EmailKind): boolean {
  if (contact.userType !== "psychologue") return true;
  const defaults: Record<EmailKind, boolean> = { newBookings: true, reminders: true, messages: false };
  const v = contact.prefs?.[kind];
  return typeof v === "boolean" ? v : defaults[kind];
}

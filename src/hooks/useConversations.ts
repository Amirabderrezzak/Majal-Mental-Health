import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Conversation {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  last_message_at: string;
}

/**
 * Everyone the signed-in user has exchanged messages with (most recent first),
 * including people they have no booking with — e.g. a patient who wrote before
 * booking. Inboxes used to list booking partners only, hiding those threads.
 */
export function useConversations(refreshKey?: unknown) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  useEffect(() => {
    let cancelled = false;
    supabase.rpc("my_conversations").then(({ data, error }) => {
      if (cancelled) return;
      if (error) { console.error("Failed to load conversations:", error); return; }
      setConversations(Array.isArray(data) ? ((data as unknown) as Conversation[]) : []);
    });
    return () => { cancelled = true; };
  }, [refreshKey]);
  return conversations;
}

/** Booking partners first-seen order, plus message-only contacts, sorted by last message. */
export function mergeContacts(
  fromBookings: Map<string, { name: string; avatar?: string }>,
  conversations: Conversation[],
  fallbackName: string,
): [string, { name: string; avatar?: string }][] {
  const merged = new Map(fromBookings);
  for (const c of conversations) {
    if (!merged.has(c.user_id)) merged.set(c.user_id, { name: c.full_name || fallbackName, avatar: c.avatar_url || undefined });
  }
  const last = new Map(conversations.map((c) => [c.user_id, new Date(c.last_message_at).getTime()]));
  return [...merged.entries()].sort((a, b) => (last.get(b[0]) ?? 0) - (last.get(a[0]) ?? 0));
}

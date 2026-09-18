import { supabase } from "@/integrations/supabase/client";

export interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string | null;
  file_url: string | null;
  file_type: string | null;
  file_name: string | null;
  created_at: string;
}

export const fetchMessages = async (userId1: string, userId2: string) => {
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .or(`and(sender_id.eq.${userId1},receiver_id.eq.${userId2}),and(sender_id.eq.${userId2},receiver_id.eq.${userId1})`)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error fetching messages:", error);
    return [];
  }
  return data as Message[];
};

export const sendMessage = async (
  sender_id: string,
  receiver_id: string,
  content: string | null = null,
  file_url: string | null = null,
  file_type: string | null = null,
  file_name: string | null = null
) => {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error("Not authenticated");

  const res = await fetch("/api/messages?action=send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ receiver_id, content, file_url, file_type, file_name }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Failed to send" }));
    console.error("Error sending message:", err.error);
    throw new Error(err.error);
  }

  return res.json();
};

export const uploadAttachment = async (file: File) => {
  // Retrieve current user ID to scope the folder path
  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user?.id;
  if (!userId) {
    throw new Error("User must be authenticated to upload files.");
  }

  // Generate a unique path scoped by user ID
  const fileExt = file.name.split('.').pop();
  const filePath = `${userId}/${crypto.randomUUID()}.${fileExt}`;

  const { error } = await supabase.storage
    .from('chat_attachments')
    .upload(filePath, file);

  if (error) {
    console.error("Error uploading attachment:", error);
    throw error;
  }

  // Store the bare storage path, not a signed URL — signed URLs expire, but
  // messages.file_url is permanent. A fresh signed URL is minted on read via
  // resolveAttachmentUrl() instead (see below).
  return {
    filePath,
    url: filePath,
    type: file.type,
    name: file.name
  };
};

// Extracts the chat_attachments storage path from either a bare path (new
// messages) or a legacy full signed URL (messages sent before this fix, which
// embedded a since-expired token) — both contain the path as a substring, so
// storage RLS ("Users can view own chat attachments") matches on it the same
// way. Returns null if no chat_attachments path can be found.
function extractAttachmentPath(fileUrl: string): string | null {
  if (!fileUrl) return null;
  const marker = "chat_attachments/";
  const idx = fileUrl.indexOf(marker);
  if (idx === -1) return fileUrl; // already a bare path
  return fileUrl.slice(idx + marker.length).split("?")[0];
}

// Mints a fresh signed URL for a message attachment at render time, rather
// than trusting a URL stored (and possibly expired) in the database.
export const resolveAttachmentUrl = async (fileUrl: string): Promise<string | null> => {
  const path = extractAttachmentPath(fileUrl);
  if (!path) return null;

  const { data, error } = await supabase.storage
    .from('chat_attachments')
    .createSignedUrl(path, 60 * 60); // 1 hour — plenty for a single viewing session

  if (error) {
    console.error("Error resolving attachment URL:", error);
    return null;
  }
  return data?.signedUrl || null;
};

export const subscribeToMessages = (userId: string, callback: (payload: any) => void) => {
  const channel = supabase
    .channel('messages-db-changes')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `sender_id=eq.${userId}`, // server-side filter: only receive own outgoing messages
      },
      (payload) => {
        const msg = payload.new as Message;
        callback(msg);
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `receiver_id=eq.${userId}`, // server-side filter: only receive incoming messages
      },
      (payload) => {
        const msg = payload.new as Message;
        callback(msg);
      }
    )
    .subscribe();

  return channel;
};

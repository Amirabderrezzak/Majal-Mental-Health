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

  const { data, error } = await supabase.storage
    .from('chat_attachments')
    .upload(filePath, file);

  if (error) {
    console.error("Error uploading attachment:", error);
    throw error;
  }
  
  // Get the signed URL that will work for download/viewing
  // (Assuming 'chat_attachments' is not public, we use createSignedUrl, but for simplicity in chat we can do that or download logic)
  const { data: urlData } = await supabase.storage
    .from('chat_attachments')
    .createSignedUrl(filePath, 60 * 15); // 15 minutes
    
  return {
    filePath,
    url: urlData?.signedUrl || "",
    type: file.type,
    name: file.name
  };
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

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
  const { data, error } = await supabase.from("messages").insert({
    sender_id,
    receiver_id,
    content,
    file_url,
    file_type,
    file_name,
  });

  if (error) {
    console.error("Error sending message:", error);
    throw error;
  }
  return data;
};

export const uploadAttachment = async (file: File) => {
  // Generate a unique path for the file
  const fileExt = file.name.split('.').pop();
  const filePath = `${crypto.randomUUID()}.${fileExt}`;

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
    .createSignedUrl(filePath, 60 * 60 * 24 * 365); // 1 year expiry for simplicity
    
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
      },
      (payload) => {
        // Only fire callback if it concerns the current user
        const msg = payload.new as Message;
        if (msg.sender_id === userId || msg.receiver_id === userId) {
          callback(msg);
        }
      }
    )
    .subscribe();

  return channel;
};

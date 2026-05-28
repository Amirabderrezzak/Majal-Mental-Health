import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  content: string;
  type: "booking" | "message" | "system";
  is_read: boolean;
  link: string | null;
  created_at: string;
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    let channel: any;

    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        setLoading(false);
        return;
      }
      const uId = session.user.id;
      setUserId(uId);

      // 1. Fetch initial notifications
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", uId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching notifications:", error);
      } else {
        setNotifications((data || []) as Notification[]);
      }
      setLoading(false);

      // 2. Subscribe to realtime changes filtered by user_id
      channel = supabase
        .channel(`public:notifications:user:${uId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${uId}`,
          },
          (payload: any) => {
            if (payload.eventType === "INSERT") {
              const newNotif = payload.new as Notification;
              setNotifications((prev) => [newNotif, ...prev]);
              // Trigger a toast message
              toast.info(newNotif.title, {
                description: newNotif.content,
              });
            } else if (payload.eventType === "UPDATE") {
              const updatedNotif = payload.new as Notification;
              setNotifications((prev) =>
                prev.map((n) => (n.id === updatedNotif.id ? updatedNotif : n))
              );
            } else if (payload.eventType === "DELETE") {
              const deletedNotif = payload.old as { id: string };
              setNotifications((prev) => prev.filter((n) => n.id !== deletedNotif.id));
            }
          }
        )
        .subscribe();
    }

    init();

    return () => {
      if (channel) {
        channel.unsubscribe();
      }
    };
  }, []);

  const markAsRead = async (id: string) => {
    // Optimistic update
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );

    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", id);

    if (error) {
      console.error("Error marking notification as read:", error);
      // Revert if error
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (data) setNotifications(data as Notification[]);
    }
  };

  const markAllAsRead = async () => {
    if (!userId) return;

    // Optimistic update
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));

    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", userId)
      .eq("is_read", false);

    if (error) {
      console.error("Error marking all notifications as read:", error);
      // Revert if error
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (data) setNotifications(data as Notification[]);
    }
  };

  const deleteNotification = async (id: string) => {
    // Optimistic update
    setNotifications((prev) => prev.filter((n) => n.id !== id));

    const { error } = await supabase
      .from("notifications")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting notification:", error);
      // Revert if error
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (data) setNotifications(data as Notification[]);
    }
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  };
}

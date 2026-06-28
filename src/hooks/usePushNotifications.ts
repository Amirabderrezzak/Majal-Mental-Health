import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY || "";
const FCM_SENDER_ID = import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePushNotifications(userId: string | null) {
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if ("Notification" in window && "serviceWorker" in navigator && "PushManager" in window) {
      setIsSupported(true);
      setPermission(Notification.permission);
    }
  }, []);

  useEffect(() => {
    if (!userId || !isSupported) return;
    checkSubscription();
  }, [userId, isSupported]);

  const checkSubscription = async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setIsSubscribed(!!subscription);
    } catch {
      setIsSubscribed(false);
    }
  };

  const subscribe = useCallback(async () => {
    if (!userId) { console.warn("Push: no userId"); return false; }
    if (!isSupported) { console.warn("Push: browser not supported"); return false; }
    if (!VAPID_KEY) { console.warn("Push: VAPID key missing"); return false; }
    setLoading(true);

    try {
      const permissionResult = await Notification.requestPermission();
      setPermission(permissionResult);

      if (permissionResult !== "granted") {
        setLoading(false);
        return false;
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_KEY),
      });

      const subscriptionJson = subscription.toJSON();
      const { error } = await supabase.from("push_subscriptions").upsert({
        user_id: userId,
        endpoint: subscription.endpoint,
        p256dh: (subscriptionJson.keys?.p256dh as string) || "",
        auth: (subscriptionJson.keys?.auth as string) || "",
        fcm_token: subscription.endpoint,
      }, { onConflict: "endpoint" });

      if (error) {
        console.error("Failed to save push subscription:", error);
      }

      setIsSubscribed(true);
      setLoading(false);
      return true;
    } catch (err) {
      console.error("Push subscription failed:", err);
      setLoading(false);
      return false;
    }
  }, [userId, isSupported]);

  const unsubscribe = useCallback(async () => {
    if (!userId) return;
    setLoading(true);

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await subscription.unsubscribe();
        await supabase
          .from("push_subscriptions")
          .delete()
          .eq("endpoint", subscription.endpoint);
      }
      setIsSubscribed(false);
    } catch (err) {
      console.error("Push unsubscribe failed:", err);
    }
    setLoading(false);
  }, [userId]);

  return { isSupported, permission, isSubscribed, loading, subscribe, unsubscribe };
}

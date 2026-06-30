import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

const VAPID_KEY = "BGfH7txiGVGr7ZCAFQAlh8qjwGDqLAgIPztMM33NeeOsvnI3tj3Fe2fg5mDzJDHcLv_btn8ITCiIduvwoU5O0zc";

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
  const [preferenceEnabled, setPreferenceEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [prefsLoaded, setPrefsLoaded] = useState(false);

  useEffect(() => {
    if ("Notification" in window && "serviceWorker" in navigator && "PushManager" in window) {
      setIsSupported(true);
      setPermission(Notification.permission);
    }
  }, []);

  useEffect(() => {
    if (!userId || !isSupported) return;
    (async () => {
      const [sub, pref] = await Promise.all([checkSubscription(), fetchPreference()]);
      setPrefsLoaded(true);
      // If preference says on but no browser subscription, subscribe once on initial load
      if (pref && !sub) {
        await doSubscribe();
      }
    })();
  }, [userId, isSupported]);

  const fetchPreference = async (): Promise<boolean> => {
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) return false;
      const res = await fetch("/api/notifications/preferences", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setPreferenceEnabled(data.push_enabled);
        return data.push_enabled;
      }
      return false;
    } catch (err) {
      console.error("Failed to fetch push preference:", err);
      return false;
    }
  };

  const savePreference = async (enabled: boolean) => {
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) return false;
      const res = await fetch("/api/notifications/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ push_enabled: enabled }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        console.error("savePreference failed:", res.status, text);
      }
      return res.ok;
    } catch (err) {
      console.error("Failed to save push preference:", err);
      return false;
    }
  };

  const checkSubscription = async (): Promise<boolean> => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      const hasSub = !!subscription;
      setIsSubscribed(hasSub);
      return hasSub;
    } catch {
      setIsSubscribed(false);
      return false;
    }
  };

  const doSubscribe = async () => {
    if (!userId || !isSupported || !VAPID_KEY) return false;
    try {
      const permissionResult = await Notification.requestPermission();
      setPermission(permissionResult);
      if (permissionResult !== "granted") return false;

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_KEY),
      });

      const subscriptionJson = subscription.toJSON();
      await supabase.from("push_subscriptions").upsert({
        user_id: userId,
        endpoint: subscription.endpoint,
        p256dh: (subscriptionJson.keys?.p256dh as string) || "",
        auth: (subscriptionJson.keys?.auth as string) || "",
        fcm_token: subscription.endpoint,
      }, { onConflict: "endpoint" });

      setIsSubscribed(true);
      return true;
    } catch (err) {
      console.error("Push subscription failed:", err);
      return false;
    }
  };

  const doUnsubscribe = async () => {
    if (!userId) return;
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await subscription.unsubscribe();
        await supabase.from("push_subscriptions").delete().eq("endpoint", subscription.endpoint);
      }
      setIsSubscribed(false);
    } catch (err) {
      console.error("Push unsubscribe failed:", err);
    }
  };

  const togglePreference = useCallback(async () => {
    if (!userId) return false;
    setLoading(true);
    const newVal = !preferenceEnabled;

    if (newVal) {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") {
        setLoading(false);
        return false;
      }
    }

    const saved = await savePreference(newVal);
    if (saved) {
      setPreferenceEnabled(newVal);
      if (newVal) {
        const ok = await doSubscribe();
        if (!ok) {
          setPreferenceEnabled(false);
          await savePreference(false);
        }
        setLoading(false);
        return ok;
      } else {
        await doUnsubscribe();
        setLoading(false);
        return true;
      }
    }
    setLoading(false);
    return false;
  }, [userId, preferenceEnabled]);

  return {
    isSupported,
    permission,
    isSubscribed,
    preferenceEnabled,
    loading,
    togglePreference,
    subscribe: doSubscribe,
    unsubscribe: doUnsubscribe,
  } as const;
}

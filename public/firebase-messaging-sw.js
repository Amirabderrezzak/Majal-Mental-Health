// Firebase Messaging Service Worker
// Handles background push notifications

// Listen for push events
self.addEventListener("push", (event) => {
  if (!event.data) return;

  const data = event.data.json();
  const title = data.notification?.title || "Majal";
  const options = {
    body: data.notification?.body || "",
    icon: "/favicon.ico",
    badge: "/favicon.ico",
    tag: data.data?.tag || "majal-notification",
    data: { url: data.data?.link || "/" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Handle notification click
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(clients.openWindow(url));
});

// Listen for messages from the main thread
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

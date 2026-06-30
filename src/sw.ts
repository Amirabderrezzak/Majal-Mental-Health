/// <reference lib="webworker" />
import { precacheAndRoute } from "workbox-precaching";
import { registerRoute } from "workbox-routing";
import { NetworkFirst, CacheFirst, StaleWhileRevalidate } from "workbox-strategies";

declare const self: ServiceWorkerGlobalScope;

precacheAndRoute(self.__WB_MANIFEST);

registerRoute(
  ({ request }) =>
    request.destination === "style" ||
    request.destination === "script" ||
    request.destination === "font",
  new CacheFirst({ cacheName: "static-assets" })
);

registerRoute(
  ({ url }) =>
    url.origin === "https://fonts.googleapis.com" ||
    url.origin === "https://fonts.gstatic.com",
  new StaleWhileRevalidate({ cacheName: "google-fonts" })
);

registerRoute(
  ({ request }) => request.destination === "image",
  new CacheFirst({ cacheName: "images" })
);

registerRoute(
  ({ url }) => url.pathname.startsWith("/api/"),
  new NetworkFirst({ cacheName: "api-responses" })
);

self.addEventListener("push", (event) => {
  if (!event.data) return;
  const data = event.data.json();
  const title = data.notification?.title || "Majal";
  const options: NotificationOptions = {
    body: data.notification?.body || "",
    icon: "/favicon.ico",
    badge: "/favicon.ico",
    tag: data.data?.tag || "majal-notification",
    data: { url: data.data?.link || "/" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(clients.openWindow(url));
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

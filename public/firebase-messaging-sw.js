// Deprecated - use the main sw.js managed by vite-plugin-pwa instead
// This file is kept to unregister old service workers

self.addEventListener("activate", () => {
  self.registration.unregister();
});

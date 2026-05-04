// Dedicated push-only Service Worker (separat von Workbox-PWA-SW).
// Scope: nur Push-Empfang + Klick-Navigation. Kein Caching.
self.addEventListener("install", (e) => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (_) { data = { title: "FieldIQ", body: event.data?.text?.() ?? "" }; }
  const title = data.title || "FieldIQ";
  const options = {
    body: data.body || "",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag: data.tag || "fieldiq-default",
    data: { url: data.url || "/" },
    vibrate: [120, 60, 120],
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of all) {
      if (c.url.includes(self.registration.scope) && "focus" in c) {
        c.navigate(url).catch(() => {});
        return c.focus();
      }
    }
    if (self.clients.openWindow) return self.clients.openWindow(url);
  })());
});

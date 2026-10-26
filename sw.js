/* Persistent service worker for Transload Log. Do not self-unregister: iOS Home Screen
   web push requires an active registration with push and notification handlers. */
const SW_VERSION = "transload-push-v1";

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    // Do not delete every cache here: the page manages its own stale-cache cleanup.
    await self.clients.claim();
  })());
});

self.addEventListener("push", (event) => {
  event.waitUntil((async () => {
    let payload = {};
    try { payload = event.data ? event.data.json() : {}; } catch (_) {}
    const title = typeof payload.title === "string" ? payload.title : "Transload Log";
    const body = typeof payload.body === "string" ? payload.body : "A truck's loading timer needs attention.";
    const location = typeof payload.location === "string" ? payload.location : "";
    const options = {
      body,
      tag: typeof payload.tag === "string" ? payload.tag : "transload-overdue",
      renotify: false,
      icon: "./apple-touch-icon-v9.png",
      badge: "./apple-touch-icon-v9.png",
      data: { url: "./", location, entryId: typeof payload.entryId === "string" ? payload.entryId : "" }
    };
    await self.registration.showNotification(title, options);
  })());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const rawUrl = event.notification?.data?.url || "./";
    const target = new URL(rawUrl, self.location.href).href;
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windows) {
      if (client.url.startsWith(self.location.origin) && "focus" in client) {
        await client.focus();
        if ("navigate" in client && client.url !== target) await client.navigate(target);
        return;
      }
    }
    if (self.clients.openWindow) await self.clients.openWindow(target);
  })());
});

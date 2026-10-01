const CACHE_NAME = "hubigo-v1";
const STATIC_ASSETS = ["/", "/manifest.json", "/icon.svg", "/offline"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") {
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      return (
        cached ||
        fetch(request).catch(() => {
          if (request.mode === "navigate") {
            return caches.match("/offline");
          }
        })
      );
    })
  );
});

self.addEventListener("sync", (event) => {
  if (event.tag === "hubigo-sync") {
    event.waitUntil(self.clients.matchAll().then((clients) => {
      clients.forEach((client) => client.postMessage({ type: "SYNC_OUTBOX" }));
    }));
  }
});

self.addEventListener("push", (event) => {
  const data = event.data?.json() ?? { title: "Hubigo", body: "You have a new notification" };
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icon.svg",
      badge: "/icon.svg",
      data: data.url ? { url: data.url } : undefined,
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? "/";
  event.waitUntil(self.clients.openWindow(url));
});

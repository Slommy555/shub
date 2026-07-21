/* Slommy HQ service worker. Three responsibilities:
 *
 *  1) Notifications — show reminders from the registration (the only path that
 *     works in an installed PWA, incl. iOS) and focus the app when one is
 *     clicked. This also backs the Notification Triggers API scheduled from
 *     src/hooks/useScheduledReminders.ts. DO NOT remove these handlers.
 *
 *  2) Offline app shell — precache the shell on install and serve same-origin
 *     assets with a stale-while-revalidate strategy so the UI loads without a
 *     network. API calls (Supabase + Edge Functions) are cross-origin and are
 *     never intercepted, so they always go to the network.
 *
 *  3) Updates — a freshly installed SW waits (it does NOT skipWaiting on its
 *     own) until the app posts SKIP_WAITING from the in-app "Refresh" toast,
 *     then it takes over and the page reloads. On a first install there is no
 *     controller to replace, so it activates immediately.
 */

const CACHE_VERSION = 'v2';
const CACHE_NAME = `slommy-hq-${CACHE_VERSION}`;

// The minimal shell needed to boot offline. Content-hashed JS/CSS are added to
// the cache at runtime by the stale-while-revalidate handler below.
const SHELL = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-180.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL))
      .catch(() => {
        /* a missing shell file shouldn't block install */
      })
  );
  // Intentionally NO skipWaiting() — see the file header / message handler.
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

// The "Refresh" toast posts this once the user opts in to the new version.
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // Only handle our own origin. Supabase / Edge Functions are cross-origin and
  // must always hit the network (never cached).
  if (url.origin !== self.location.origin) return;

  // Navigations: network-first so a deployed build is picked up when online,
  // falling back to the cached shell when offline.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(async () => (await caches.match(req)) || caches.match('/index.html'))
    );
    return;
  }

  // Other same-origin GETs (hashed JS/CSS, icons, fonts): stale-while-revalidate.
  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(req);
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200 && res.type === 'basic') cache.put(req, res.clone());
          return res;
        })
        .catch(() => undefined);
      return cached || (await network) || Response.error();
    })
  );
});

// --------------------------------------------------------------------------
// Notifications (unchanged) — required so reminders work in an installed PWA.
// --------------------------------------------------------------------------

// Focus an existing window (or open one) when a reminder notification is clicked.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of all) {
        if ('focus' in client) {
          client.postMessage({ type: 'notification-click', data: event.notification.data });
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    })()
  );
});

// Web Push support (for a future server-side push). Harmless if never used.
self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (_) {
    payload = { title: 'Reminder', body: event.data ? event.data.text() : '' };
  }
  const title = payload.title || 'Reminder';
  event.waitUntil(
    self.registration.showNotification(title, {
      body: payload.body || '',
      tag: payload.tag,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: payload.data || { url: '/' },
    })
  );
});

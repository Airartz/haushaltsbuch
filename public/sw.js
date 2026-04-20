const CACHE_NAME = 'haushaltsbuch-v7';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/css/app.css',
  '/js/app.js',
  '/js/icons.js',
  '/js/push.js',
  '/js/dashboard.js',
  '/js/tasks.js',
  '/js/shopping.js',
  '/js/calendar.js',
  '/js/dienstplan.js',
  '/js/recipes.js',
  '/js/admin.js',
  '/manifest.json'
];

// ─── Install ──────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// ─── Activate ─────────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ─── Fetch (Network-first für API, Cache-first für Assets) ────────────────────
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.pathname.startsWith('/api') || url.pathname.startsWith('/auth') ||
      url.pathname.startsWith('/push') || url.pathname.startsWith('/socket.io')) {
    return; // API-Calls immer live
  }
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request))
  );
});

// ─── Push empfangen ───────────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data.json(); } catch (_) {}

  const options = {
    body:             data.body || 'Neue Benachrichtigung',
    icon:             '/icons/icon-192.png',
    badge:            '/icons/icon-192.png',
    tag:              data.taskId ? `task-${data.taskId}` : 'haushaltsbuch',
    renotify:         true,
    requireInteraction: true,   // bleibt sichtbar bis der Nutzer reagiert
    data: {
      url:    data.url    || '/',
      taskId: data.taskId || null
    },
    // Aktions-Buttons direkt in der Benachrichtigung
    actions: data.actions || []
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'Haushaltsbuch', options)
  );
});

// ─── Notification geklickt ────────────────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const { taskId, url } = event.notification.data;
  const action = event.action;

  if (action === 'complete' && taskId) {
    // Task direkt aus der Benachrichtigung heraus als erledigt markieren
    event.waitUntil(
      fetch(`/api/tasks/${taskId}/complete`, {
        method:      'POST',
        credentials: 'include',
        headers:     { 'Content-Type': 'application/json' }
      })
      .then(() => focusOrOpen(url))
      .catch(() => focusOrOpen(url))
    );
  } else if (action === 'dismiss') {
    // Einfach schließen, App nicht öffnen
    return;
  } else {
    // Normaler Klick auf Benachrichtigung → App öffnen/fokussieren
    event.waitUntil(focusOrOpen(url));
  }
});

function focusOrOpen(url) {
  return self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
    for (const client of clientList) {
      if ('focus' in client) {
        client.postMessage({ type: 'NAVIGATE', url: url || '/' });
        return client.focus();
      }
    }
    return self.clients.openWindow(url || '/');
  });
}

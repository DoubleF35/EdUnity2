// EdUnity Service Worker — Modalità Offline v1
const CACHE = 'edunity-v2';
const STATIC = ['/', '/index.html', '/icon-192.png', '/icon-512.png', '/logo.png', '/riccio.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(STATIC).catch(() => {})));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (url.hostname.includes('googleapis.com') ||
      url.hostname.includes('firebaseio.com') ||
      url.hostname.includes('workers.dev') ||
      url.hostname.includes('gstatic.com')) return;

  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (e.request.method === 'GET' && res?.status === 200 && res.type !== 'opaque') {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => {
        if (e.request.mode === 'navigate') return caches.match('/index.html');
        return new Response('Offline', { status: 503 });
      });
    })
  );
});

self.addEventListener('push', e => {
  const data = e.data?.json() || {};
  const n = data.notification || {};
  e.waitUntil(self.registration.showNotification(n.title || 'EdUnity', {
    body: n.body || '', icon: '/icon-192.png', badge: '/icon-192.png',
    tag: 'edunity-push', renotify: true
  }));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(ws => {
    if (ws.length) return ws[0].focus();
    return clients.openWindow('/');
  }));
});

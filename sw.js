// ═══════════════════════════════════════════════════════════════════
//  EdUnity — Service Worker
//
//  IMPORTANTE: ad OGNI modifica del sito, incrementa il numero di
//  versione qui sotto (es. v3, v4...). È questo cambiamento che dice
//  al browser "c'è una versione nuova, scaricala".
// ═══════════════════════════════════════════════════════════════════
const VERSION = 'edunity-v34';
const CACHE = VERSION;

// File di base da avere disponibili offline
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/logo.png',
  '/riccio.png',
  '/manifest.json'
];

// ── INSTALL: precarica i file di base ──────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(c => c.addAll(CORE_ASSETS).catch(() => {}))
  );
});

// ── ACTIVATE: elimina tutte le cache vecchie ───────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ── Messaggio dalla pagina: attiva subito il nuovo SW ──────────────
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ── FETCH ──────────────────────────────────────────────────────────
// Strategia:
//  • HTML / navigazione  → NETWORK FIRST (prendi sempre la versione
//    nuova dal server; usa la cache solo se sei offline). È QUESTO
//    che risolve il problema della "versione vecchia".
//  • Altri asset (img, css, font) → CACHE FIRST con aggiornamento in
//    background, per velocità.
//  • Chiamate a Firebase / API / Google → SEMPRE rete, mai cache.
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Non intercettare mai chiamate dinamiche/esterne
  const bypass = [
    'firestore.googleapis.com',
    'firebaseio.com',
    'firebasedatabase.app',
    'identitytoolkit.googleapis.com',
    'securetoken.googleapis.com',
    'googleapis.com',
    'gstatic.com',
    'workers.dev'
  ];
  if (bypass.some(h => url.hostname.includes(h))) return;

  const isHTML =
    req.mode === 'navigate' ||
    req.destination === 'document' ||
    (req.headers.get('accept') || '').includes('text/html');

  if (isHTML) {
    // NETWORK FIRST per l'HTML
    event.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put('/index.html', copy)).catch(() => {});
          return res;
        })
        .catch(() =>
          caches.match(req).then(r => r || caches.match('/index.html'))
        )
    );
    return;
  }

  // CACHE FIRST per gli altri asset, con refresh in background
  event.respondWith(
    caches.match(req).then(cached => {
      const network = fetch(req)
        .then(res => {
          if (res && res.status === 200 && res.type === 'basic') {
            const copy = res.clone();
            caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});

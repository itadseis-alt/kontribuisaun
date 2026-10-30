// Service worker: app funsiona offline depois loke dala ida.
const VERSAUN = 'kontribuisaun-v1.0.0';
const ASSETS = [
  './', './index.html', './app.js', './style.css', './manifest.webmanifest',
  './lib/xlsx.full.min.js', './data/cefo24.json',
  './icons/icon-192.png', './icons/icon-512.png', './icons/maskable-512.png', './icons/apple-touch-icon.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSAUN).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k !== VERSAUN).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Network-first ba HTML (atu simu atualizasaun), cache-first ba seluk.
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  const isHtml = req.mode === 'navigate' || req.destination === 'document';
  if (isHtml) {
    e.respondWith(fetch(req).then(r => {
      const copy = r.clone(); caches.open(VERSAUN).then(c => c.put('./index.html', copy)); return r;
    }).catch(() => caches.match('./index.html')));
    return;
  }
  e.respondWith(caches.match(req, { ignoreSearch: true }).then(hit => hit || fetch(req).then(r => {
    if (r.ok) { const copy = r.clone(); caches.open(VERSAUN).then(c => c.put(req, copy)); }
    return r;
  })));
});

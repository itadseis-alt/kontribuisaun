// Service worker: app funsiona offline depois loke dala ida.
// Network-first ba kódigu (index/app/style/data) -> telefone simu versaun foun kedas bainhira iha internet.
const VERSAUN = 'kontribuisaun-v2.0.0';
const ASSETS = [
  './', './index.html', './app.js', './style.css', './manifest.webmanifest',
  './config.js', './lib/xlsx.full.min.js', './lib/supabase.js', './lib/591.supabase.js', './data/cefo24.json',
  './icons/icon-192.png', './icons/icon-512.png', './icons/maskable-512.png', './icons/apple-touch-icon.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSAUN)
    .then(c => c.addAll(ASSETS.map(u => new Request(u, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k !== VERSAUN).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  const estatiku = /\/(lib|icons)\//.test(url.pathname);   // la muda: cache-first
  if (estatiku) {
    e.respondWith(caches.match(req, { ignoreSearch: true }).then(hit => hit || fetch(req)));
    return;
  }
  const isHtml = req.mode === 'navigate' || req.destination === 'document';
  const chave = isHtml ? './index.html' : url.pathname;
  e.respondWith(
    fetch(req.url, { cache: 'no-cache' }).then(r => {
      if (r.ok) { const copy = r.clone(); caches.open(VERSAUN).then(c => c.put(isHtml ? './index.html' : new Request(url.pathname), copy)); }
      return r;
    }).catch(() => caches.match(isHtml ? './index.html' : req, { ignoreSearch: true }))
  );
});

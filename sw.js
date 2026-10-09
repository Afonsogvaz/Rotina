/* Service worker: deixa a app abrir sem internet.
   Estratégia: responde logo com a cópia guardada e atualiza-a em segundo plano,
   por isso uma versão nova da app aparece na abertura seguinte. */
const CACHE = 'rotina-v5';
const ASSETS = [
  './', './index.html', './style.css', './manifest.json',
  './core.js', './rules.js', './stats.js', './charts.js', './views.js', './sheets.js', './library.js', './app.js',
  './young-serif.woff2', './icon-180.png', './icon-192.png', './icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    caches.open(CACHE).then(async cache => {
      const cached = await cache.match(req, { ignoreSearch: true });
      const network = fetch(req)
        .then(res => { if (res && res.ok) cache.put(req, res.clone()); return res; })
        .catch(() => cached || (req.mode === 'navigate' ? cache.match('./index.html') : undefined));
      return cached || network;
    })
  );
});

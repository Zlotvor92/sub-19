/* SUB-19 service worker — offline keširanje.
   Pri svakoj izmeni aplikacije podigni CACHE broj i APP_VERSION:
   stari keš se briše, a PODACI u localStorage OSTAJU netaknuti.
   Update-flow: novi SW NE preuzima kontrolu odmah (ne skipWaiting na install) —
   čeka korisnikov klik na "Osveži" (baner u aplikaciji), da se ne prekine unos. */
const CACHE = 'sub19-cache-v49';
const APP_VERSION = '49';
const ASSETS = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];

self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('install', e => {
  /* NE skipWaiting ovde — čeka SKIP_WAITING poruku (klik na "Osveži"). */
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const u = new URL(e.request.url);
  if (u.pathname.startsWith('/api/') || u.hostname.endsWith('strava.com')) return; /* uvek mreža, nikad keš */
  if (e.request.mode === 'navigate') {
    /* network-first: nova verzija stiže čim ima interneta, offline radi iz keša */
    e.respondWith(
      fetch(e.request)
        .then(r => { const cp = r.clone(); caches.open(CACHE).then(c => c.put('./index.html', cp)); return r; })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }
  e.respondWith(
    caches.match(e.request).then(hit => hit || fetch(e.request).then(r => {
      if (r.ok && new URL(e.request.url).origin === location.origin) {
        const cp = r.clone(); caches.open(CACHE).then(c => c.put(e.request, cp));
      }
      return r;
    }))
  );
});

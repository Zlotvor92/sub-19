/* SUB-19 service worker — offline keširanje.
   Pri svakoj izmeni aplikacije podigni CACHE broj i APP_VERSION:
   stari keš se briše, a PODACI u localStorage OSTAJU netaknuti.
   Update-flow: novi SW NE preuzima kontrolu odmah (ne skipWaiting na install) —
   čeka korisnikov klik na "Osveži" (baner u aplikaciji), da se ne prekine unos. */
const CACHE = 'sub19-cache-v117';
const APP_VERSION = '117';
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
  /* SVE iz ASSETS spiska: network-first. Ranije je ovo važilo samo za index.html i
     manifest.json — pa se ISTA greška ponovila na ikonicama (promenio fajl, korisnik
     ne vidi promenu jer je stari keš i dalje tu). ASSETS je mali spisak (par KB ukupno),
     cena mrežne provere je zanemarljiva — zato ide na CEO spisak, ne fajl-po-fajl kad
     god se neki od njih sledeći put promeni. */
  /* './' se normalizuje u '/', pa je stari `endsWith('/')` odgovarao BILO KOJOJ
     putanji koja se zavrsava kosom crtom (npr. '/nesto/drugo/') i mapirao je na
     kes index.html-a. Za tu jednu stavku vazi samo tacno poklapanje. */
  const key = ASSETS.find(a => {
    const p = a.replace(/^\./, '');            /* './index.html' -> '/index.html', './' -> '/' */
    return u.pathname === p || (p !== '/' && u.pathname.endsWith(p));
  });
  if (e.request.mode === 'navigate' || key) {
    const cacheKey = key || './index.html';
    e.respondWith(
      fetch(e.request)
        .then(r => { putSafe(cacheKey, r); return r; })
        .catch(() => caches.match(cacheKey))
    );
    return;
  }
  e.respondWith(
    caches.match(e.request).then(hit => hit || fetch(e.request).then(r => {
      if (new URL(e.request.url).origin === location.origin) putSafe(e.request, r);
      return r;
    }))
  );
});

/* Kesira SAMO ispravan, pun odgovor.
   - Bez provere `r.ok` neuspeo deploy (500/404 HTML stranica) zavrsi u kesu kao
     index.html i servira se offline dok sledeci uspesan fetch ne prodje —
     `.catch()` grana to ne hvata, jer HTTP greska NIJE mrezna greska.
   - status 206 (Partial Content) i opaque odgovori bacaju u cache.put(),
     sto je bilo neuhvaceno odbijanje obecanja. */
function putSafe(key, r) {
  if (!r || !r.ok || r.status === 206 || r.type === 'opaque') return;
  const cp = r.clone();
  caches.open(CACHE).then(c => c.put(key, cp)).catch(() => {});
}

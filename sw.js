/* SUB-20 service worker — offline keširanje.
   Pri svakoj izmeni aplikacije podigni CACHE broj i APP_VERSION:
   stari keš se briše, a PODACI u localStorage OSTAJU netaknuti.
   Update-flow: novi SW NE preuzima kontrolu odmah (ne skipWaiting na install) —
   čeka korisnikov klik na "Osveži" (baner u aplikaciji), da se ne prekine unos. */
const CACHE = 'sub19-cache-v183';
const APP_VERSION = '183';
/* './app.js' MORA biti na spisku: od v150 index.html je samo markup, a ceo kod
   aplikacije je u app.js. Da nije tu, dobio bi network-first samo omotač, dok
   bi se logika servirala iz starog keša — tj. „promenio sam kod, ništa se ne
   vidi", tačno ona greška zbog koje je ceo spisak i prebačen na network-first. */
const ASSETS = ['./', './index.html', './app.js', './manifest.json', './icon-32.png', './icon-192.png', './icon-512.png', './icon-128.png', './icon-maskable-512.png', './apple-touch-icon.png', './privacy.html', './uputstvo.html'];

self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
  /* KOJU VERZIJU OVAJ SW ZAISTA NOSI.
     Podnožje Podešavanja je do sada pisalo APP_VERSION iz app.js — a app.js ide
     network-first, pa taj broj skoči čim deploy prođe, bez obzira na to što keš
     i dalje drži staru verziju. Dva različita stanja izgledala su isto, pa se
     nije moglo razlikovati „ažuriran sam" od „traka nije izašla". */
  if (e.data && e.data.type === 'VERSION' && e.source) {
    e.source.postMessage({ type: 'VERSION', version: APP_VERSION, cache: CACHE });
  }
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
  /* TACNO poklapanje putanje, ne `endsWith`. Ranije bi '/bilo/sta/index.html'
     odgovaralo stavci './index.html' i dobilo keširanu kopiju korenske
     stranice. Trenutno takve putanje ne postoje, ali pravilo je bilo šire
     nego što opisuje — a ista klasa greške ('./' je preko endsWith('/')
     hvatao SVAKU putanju sa kosom crtom) već je jednom popravljena ovde. */
  const key = ASSETS.find(a => u.pathname === a.replace(/^\./, ''));
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

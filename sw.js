/* SUB-20 service worker — offline keširanje.
   Pri svakoj izmeni aplikacije podigni CACHE broj i APP_VERSION:
   stari keš se briše, a PODACI u localStorage OSTAJU netaknuti.
   Update-flow: novi SW NE preuzima kontrolu odmah (ne skipWaiting na install) —
   čeka korisnikov klik na "Osveži" (baner u aplikaciji), da se ne prekine unos. */
const CACHE = 'sub19-cache-v263';
const APP_VERSION = '263';
/* './app.js' MORA biti na spisku: od v150 index.html je samo markup, a ceo kod
   aplikacije je u app.js. Da nije tu, dobio bi network-first samo omotač, dok
   bi se logika servirala iz starog keša — tj. „promenio sam kod, ništa se ne
   vidi", tačno ona greška zbog koje je ceo spisak i prebačen na network-first. */
const ASSETS = ['./', './index.html', './app.js', './sw-reg.js', './manifest.json', './icon-32.png', './icon-192.png', './icon-512.png', './icon-128.png', './icon-maskable-512.png', './apple-touch-icon.png', './privacy.html', './uputstvo.html'];

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
  /* JEDAN FAJL KOJI FALI NE SME DA OBORI CELU INSTALACIJU.
     Ranije je stajalo `c.addAll(ASSETS)`. `addAll` je atomičan: ako ijedan
     odgovor nije uspešan, ceo poziv odbija — instalacija pada, nov SW nikad ne
     stigne do stanja `installed`, pa NEMA ni offline keša ni trake „Osveži".
     I sve to tiho: u aplikaciji izgleda kao da ažuriranja jednostavno nema.

     Uhvaćeno kad je u ASSETS dodat nov fajl (sw-reg.js) a jedan server ga još
     nije imao — traka je prestala da izlazi, a uzrok je bio pet redova dalje.
     Dovoljno je da se jednom pogreši putanja ili da deploy ne prenese fajl.

     Sada se svaki fajl kešira za sebe. Ono što ne uspe biće pokupljeno pri
     prvom traženju (v. fetch rukovalac — sve iz ASSETS ide network-first i
     usput se upisuje u keš), pa je gubitak privremen umesto potpun. */
  e.waitUntil(caches.open(CACHE).then(c =>
    Promise.allSettled(ASSETS.map(a => c.add(a))).then(ishodi => {
      const pali = ishodi.map((r, i) => r.status === 'rejected' ? ASSETS[i] : null).filter(Boolean);
      if (pali.length) console.warn('[sw] nije keširano pri instalaciji:', pali.join(', '));
    })
  ));
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
  /* TUĐI DOMEN — SW SE NE MEŠA.
     Ovde je sve vreme prolazila i slika sa Google naloga (Zajednica). Opšta
     grana ispod bi je uzela, pokušala `fetch(e.request)` iz service workera i
     — kad to ne uspe — vratila prazan 504. A rezultat te grane se NIKAD ne
     kešira: `putSafe` je i onako ograničen na sopstveni domen. Dakle za tuđe
     adrese SW ne donosi ništa, a dodaje put kojim zahtev može da propadne.
     Prijavljeno sa iPhonea: aplikacija ima adresu slike, a u krugu stoji
     početno slovo. Bez presretanja pregledač učitava sliku sam. */
  if (u.origin !== location.origin) return;
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
  /* `.catch()` NIJE ukras. Grana iznad ga ima (pada na keš), a ova nije imala:
     kad se traži nešto što nije u kešu a mreže nema, `fetch` odbija, pa odbija
     i obećanje dato `respondWith`-u — a tada pregledač prikaže SVOJU stranicu
     mrežne greške umesto da zahtev prosto propadne. Na slici koja se ne učita
     to je razlika između praznog mesta i razbijene stranice. */
  e.respondWith(
    caches.match(e.request).then(hit => hit || fetch(e.request).then(r => {
      putSafe(e.request, r);       /* dovde stižu samo sopstvene adrese */
      return r;
    })).catch(() => new Response('', { status: 504, statusText: 'Offline' }))
  );
});

/* ============================================================================
   MALI IndexedDB — jedini način da service worker vidi podatke aplikacije.

   localStorage NE POSTOJI u service workeru (nema pristupa iz pozadinske
   niti). Sve što ovaj fajl treba da zna kad je aplikacija ZATVORENA — koji
   je nalog, koji token, šta je ostalo neposlato — mora da stigne ovim putem.
   Aplikacija upisuje (v. `idbUpisi` u app.js), ovde se samo čita i briše.
   ========================================================================= */
const IDB_BAZA = 'sub19', IDB_SKLAD = 'red';
function idbOtvori() {
  return new Promise((res, rej) => {
    const z = indexedDB.open(IDB_BAZA, 1);
    z.onupgradeneeded = () => { const db = z.result; if (!db.objectStoreNames.contains(IDB_SKLAD)) db.createObjectStore(IDB_SKLAD); };
    z.onsuccess = () => res(z.result);
    z.onerror = () => rej(z.error);
  });
}
function idbRadi(nacin, posao) {
  return idbOtvori().then(db => new Promise((res, rej) => {
    const t = db.transaction(IDB_SKLAD, nacin), s = t.objectStore(IDB_SKLAD);
    const z = posao(s);
    z.onsuccess = () => res(z.result);
    z.onerror = () => rej(z.error);
  }));
}
function idbCitaj(k) { return idbRadi('readonly', s => s.get(k)).catch(() => null); }
function idbUpisi(k, v) { return idbRadi('readwrite', s => s.put(v, k)).catch(() => null); }
function idbObrisi(k) { return idbRadi('readwrite', s => s.delete(k)).catch(() => null); }

/* ============================================================================
   OBAVEŠTENJA (Web Push)

   Sadržaj stiže ŠIFROVAN i pregledač ga dešifruje pre nego što stigne ovde —
   server ne može da pročita ono što je poslao, a push servis (Google/Apple)
   ne vidi ništa osim šifrata. Zato se ovde dobija običan JSON.

   `userVisibleOnly` je obavezan u svim pregledačima: svaki primljen push MORA
   da završi kao vidljivo obaveštenje. Ako se ne prikaže ništa, pregledač prvo
   sam prikaže „Ova stranica je osvežena u pozadini", a posle nekoliko takvih
   ODUZME dozvolu. Zato `showNotification` nema nijednu granu koja ćuti.
   ========================================================================= */
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; }
  catch (x) { d = { telo: e.data ? e.data.text() : '' }; }
  const naslov = String(d.naslov || 'SUB-20').slice(0, 80);
  const opcije = {
    body: String(d.telo || '').slice(0, 300),
    icon: './icon-192.png',
    badge: './icon-128.png',
    lang: 'sr',
    /* Ista `tag` vrednost menja prethodno obaveštenje umesto da doda novo —
       jutarnji podsetnik ne sme da se gomila u listi ako telefon danima
       stoji zaključan. `renotify` traži da zamena ipak zavibrira. */
    tag: String(d.oznaka || 'sub19').slice(0, 40),
    renotify: true,
    data: { url: String(d.url || './').slice(0, 200) }
  };
  e.waitUntil((async () => {
    /* `tiho` traži: ako je aplikacija U OVOM TRENUTKU otvorena i vidljiva,
       nemoj da lupaš obaveštenje preko nje — samo joj javi da osveži. Koristi
       se za „analiza je gotova": ako čovek gleda u ekran, tekst se pojavi sam.
       Pravilo `userVisibleOnly` traži obaveštenje samo kad app NIJE vidljiva,
       i baš taj izuzetak se ovde koristi — ništa se ne preskače naslepo. */
    if (d.tiho) {
      const lista = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      if (lista.some(k => k.visibilityState === 'visible')) {
        for (const k of lista) { try { k.postMessage({ type: 'PUSH', poruka: d }); } catch (x) {} }
        return;
      }
    }
    await self.registration.showNotification(naslov, opcije);
  })());
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  let cilj;
  try { cilj = new URL((e.notification.data && e.notification.data.url) || './', self.location.href).href; }
  catch (x) { cilj = self.registration.scope; }
  /* Ako je aplikacija već otvorena — fokusiraj TU karticu i odvedi je na
     traženi tab. Bez ovoga bi `openWindow` napravio drugu kopiju aplikacije,
     a dve otvorene kopije istog naloga se otimaju oko sinhronizacije. */
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(lista => {
    for (const k of lista) {
      if (k.url.indexOf(self.registration.scope) !== 0) continue;
      if ('navigate' in k && k.url !== cilj) return k.navigate(cilj).then(c => (c || k).focus()).catch(() => k.focus());
      return k.focus();
    }
    return self.clients.openWindow(cilj);
  }));
});

/* Pregledač s vremena na vreme sam poništi pretplatu i traži novu. Ako se na
   to ne odgovori, obaveštenja tiho prestanu da stižu — bez ijedne poruke,
   i korisniku u Podešavanjima i dalje piše da su uključena.

   Token iz IDB-a ume da bude istekao (v. `sync` niže — namerno se NE
   osvežava iz pozadine), pa se nova pretplata uvek prvo upiše u IDB. Ako
   slanje sada ne uspe, aplikacija je pošalje pri prvom sledećem otvaranju. */
self.addEventListener('pushsubscriptionchange', e => {
  e.waitUntil((async () => {
    const nalog = await idbCitaj('nalog');
    if (!nalog || !nalog.vapid) return;
    let nova = e.newSubscription;
    if (!nova) {
      try {
        nova = await self.registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: odB64u(nalog.vapid)
        });
      } catch (x) { return; }
    }
    const paket = nova.toJSON ? nova.toJSON() : null;
    if (!paket || !paket.endpoint) return;
    await idbUpisi('pretplata-neposlata', { pretplata: paket, uredjaj: nalog.uredjaj || null });
    if (!nalog.access || Date.now() > (nalog.isticeMs || 0) - 60000) return;
    try {
      const r = await fetch('./api/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + nalog.access },
        body: JSON.stringify({ akcija: 'prijava', pretplata: paket, uredjaj: nalog.uredjaj || null })
      });
      if (r.ok) await idbObrisi('pretplata-neposlata');
    } catch (x) { /* aplikacija će je poslati pri sledećem otvaranju */ }
  })());
});

/* base64url -> Uint8Array (applicationServerKey traži bajtove, ne string). */
function odB64u(s) {
  const t = String(s).replace(/-/g, '+').replace(/_/g, '/');
  const b = atob(t + '='.repeat((4 - t.length % 4) % 4));
  const u = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i);
  return u;
}

/* ============================================================================
   POZADINSKA SINHRONIZACIJA (Background Sync)

   ŠTA REŠAVA: uneseš trening bez signala (staza, teretana, avion), zatvoriš
   aplikaciju — i upis u Supabase se nikad ne desi dok je sledeći put ne
   otvoriš. Sa `sync` pregledač sam pokrene ovaj kod čim se veza vrati, i to
   i ako je aplikacija ZATVORENA.

   ZAŠTO JE OVO BEZBEDNO I KAD PADNE: red u IDB-u je KOPIJA onoga što
   aplikacija ionako ima u localStorage. Ako se ovde bilo šta ne poklopi —
   token istekao, server odgovorio sukobom — red se prosto obriše. Ništa se
   ne gubi: aplikacija pri sledećem otvaranju gura isto to stanje sama.

   TOKEN SE NAMERNO NE OSVEŽAVA ODAVDE. Supabase pri osvežavanju ROTIRA
   refresh token; kad bi ga service worker potrošio, kopija u localStorage
   bi postala neupotrebljiva i korisnik bi bio odjavljen bez razloga. Zato
   se radi samo dok je pristupni token još važeći (sat vremena) — a to je
   tačno onaj prozor u kom se veza obično i vrati. */
const SYNC_STANJE = 'sub19-stanje';

self.addEventListener('sync', e => {
  if (e.tag === SYNC_STANJE) e.waitUntil(guraniStanje());
});

async function guraniStanje() {
  const nalog = await idbCitaj('nalog');
  const red = await idbCitaj('stanje');
  if (!red || !nalog || !nalog.url || !nalog.anon || !nalog.userId || !nalog.access) { await idbObrisi('stanje'); return; }
  /* Istekao token — odustani TIHO (bez bacanja), inače bi pregledač ponavljao
     posao koji ne može da uspe dok se aplikacija ne otvori. */
  if (Date.now() > (nalog.isticeMs || 0) - 60000) { await idbObrisi('stanje'); return; }

  const glava = { apikey: nalog.anon, Authorization: 'Bearer ' + nalog.access, 'Content-Type': 'application/json' };
  const baza = String(nalog.url).replace(/\/+$/, '');

  /* NE GAZI TUĐU IZMENU. Ako je u međuvremenu drugi uređaj upisao noviju
     verziju, ovaj red je zastareo — a stanje je JEDAN blob, pa bi prepis
     obrisao celu tuđu sesiju. Sukob rešava aplikacija, koja ume da PITA
     (v. sbDecide u app.js); pozadina za to nema kome da se obrati. */
  try {
    const r = await fetch(baza + '/rest/v1/user_state?select=updated_at,device_id&user_id=eq.' + nalog.userId, { headers: glava });
    if (r.ok) {
      const j = await r.json();
      const na = j && j[0];
      if (na && na.device_id && na.device_id !== nalog.uredjaj &&
          (!red.seenAt || new Date(na.updated_at) > new Date(red.seenAt))) {
        await idbObrisi('stanje');
        return;
      }
    }
  } catch (x) { throw new Error('mreza'); }   /* baci -> pregledač ponavlja kasnije */

  const r = await fetch(baza + '/rest/v1/user_state', {
    method: 'POST',
    headers: Object.assign({}, glava, { Prefer: 'resolution=merge-duplicates,return=minimal' }),
    body: JSON.stringify({
      user_id: nalog.userId, data: red.podaci,
      device_id: nalog.uredjaj, app_version: APP_VERSION
    })
  });
  /* 4xx se neće popraviti ponavljanjem (istekao token, promenjena šema) —
     red se briše i posao prepušta aplikaciji. 5xx i mrežna greška se
     ponavljaju, jer su privremene. */
  if (r.ok) { await idbObrisi('stanje'); return; }
  if (r.status >= 400 && r.status < 500) { await idbObrisi('stanje'); return; }
  throw new Error('upis nije uspeo (' + r.status + ')');
}

/* ============================================================================
   POVREMENA SINHRONIZACIJA (Periodic Background Sync)

   Samo Chrome/Android, samo za INSTALIRANU aplikaciju, i samo kad pregledač
   proceni da se dovoljno koristi. Ne može se na njega računati — zato ovde
   NE stoji ništa bez čega aplikacija ne bi radila.

   Radi jednu jeftinu i konkretnu stvar: osvežava offline kopiju i pita za
   novu verziju. Efekat koji se stvarno oseti: kad sledeći put otvoriš
   aplikaciju bez signala, offline kopija nije od pre nedelju dana; a kad
   izađe nova verzija, traka „Osveži" te čeka odmah umesto da se pojavi tek
   posle prvog učitavanja.

   Ovde se NE povlače treninzi. Za to bi trebali Strava/intervals.icu tokeni i
   ceo račun po kilometru koji živi u app.js — kopija te logike u service
   workeru bi se razišla sa aplikacijom prvom izmenom. */
self.addEventListener('periodicsync', e => {
  if (e.tag === 'sub19-osvezi') e.waitUntil(osveziKopiju());
});

async function osveziKopiju() {
  try { await self.registration.update(); } catch (x) {}
  try {
    const c = await caches.open(CACHE);
    await Promise.allSettled(ASSETS.map(a => c.add(a)));
  } catch (x) {}
}

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

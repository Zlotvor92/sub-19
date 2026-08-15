/* /api/icu-oauth.js — OAuth povezivanje sa intervals.icu.

   ZAŠTO PREKO SERVERA: razmena koda za token traži `client_secret`, koji ne
   sme u pregledač. Server ga drži, pregledač dobija samo token.

   ZAŠTO SE I ADRESA ZA AUTORIZACIJU GRADI OVDE: da `client_id` i spisak
   opsega stoje na jednom mestu (Vercel promenljive), a ne i u kodu aplikacije.
   Nije tajna, ali je jedno mesto za izmenu umesto dva.

   TOK:
   1) aplikacija traži GET /api/icu-oauth?akcija=url&state=...
      -> vraća { url } ka intervals.icu/oauth/authorize
   2) korisnik odobri, intervals.icu vraća ?code=... na našu adresu
   3) aplikacija šalje POST /api/icu-oauth { code }
      -> server razmeni kod i vrati { athleteId, token, scope }

   Token po njihovoj dokumentaciji NE ističe. Nova prijava sa drugog uređaja
   poništava prethodni token — jedan token po aplikaciji i korisniku.

   Vercel Environment Variables:
   - ICU_CLIENT_ID, ICU_CLIENT_SECRET   (iz intervals.icu -> Settings)
   - SUPABASE_URL, SUPABASE_ANON_KEY    (isti kao za /api/analyze) */

/* ROK NA IZLAZNI POZIV.
   Isti problem je opisan i rešen za poziv modela u api/analyze.js (v. `ROK_MS`
   tamo); ovo je ista mera na ostalim izlazima.
   `fetch` nema podrazumevan rok. Kad upstream (Supabase, intervals.icu, Strava,
   Resend, push servis) ZASTANE a ne odbije, poziv visi dok ga ne preseče
   `maxDuration` — a tada Vercel vraća SVOJU HTML stranicu 504 umesto našeg
   JSON-a. Klijent na nju radi `response.json()` i čovek dobija „...is not valid
   JSON" (Chrome) odnosno „The string did not match the expected pattern"
   (Safari): poruku koju ne kontrolišemo, o kvaru koji nismo imenovali.
   Rok stoji ISPOD `maxDuration` ove funkcije, da odgovor stigne od nas i sa
   razlogom. Pozivalac koji sam donese `signal` zadržava svoj — rok se ne
   nameće preko tuđe odluke. */
const IZLAZNI_ROK_MS = 8000;
function fetchRok(ulaz, opcije, ms) {
  const o = Object.assign({}, opcije || {});
  if (!o.signal) {
    try { o.signal = AbortSignal.timeout(ms > 0 ? ms : IZLAZNI_ROK_MS); } catch (e) { /* stariji Node — bez roka, kao pre */ }
  }
  return fetch(ulaz, o);
}


/* ACTIVITY:READ je dodat da bi intervals.icu mogao da bude PRIMARAN izvor
   treninga (v. /api/activities.js). Ko je vec povezan, ima token BEZ tog
   opsega — njegovi pozivi ka treninzima vratice 403, sto /api/activities
   prevodi u poruku „otkaci pa ponovo povezi". Wellness mu i dalje radi, pa
   ponovno povezivanje nije hitno nego dobitak. */
/* NAJMANJA POTREBNA DOZVOLA.
   `SETTINGS:WRITE` je bio u spisku, a nijedan poziv ga nije koristio — ni ovde,
   ni u api/icu.js (wellness, activities, workouts), ni u app.js. Token koji
   čuvamo na korisnikovom uređaju je time imao pravo UPISA u podešavanja njegovog
   intervals.icu naloga, bez ijednog razloga; ako taj token ikad iscuri, šteta je
   veća nego što mora da bude. Politika privatnosti je uz to tvrdila da se
   koristi za upis praga tempa — što se nikad nije dešavalo.

   `SETTINGS:READ` je DODAT sa granom `{sta:'zone'}`: zone pulsa žive u sportskim
   podešavanjima, i bez ovog opsega intervals.icu na taj poziv vraća 403. To je
   bio i stvarni uzrok prijave „zone se ne povlače, ma koliko puta pritisnem
   Povuci sve" — poziv je uredno odlazio i uredno bio odbijen, a klijent je
   grešku gutao, pa se spolja videlo samo da ničega nema.
   READ, ne WRITE: aplikacija zone samo čita. Prag tempa i dalje unosiš sam.

   POSTOJEĆE VEZE MORAJU DA SE OBNOVE. Opseg se dobija pri autorizaciji, pa ko je
   povezan pre ove izmene ima token bez `SETTINGS` i za njega zone neće raditi
   dok ne uradi „Otkači" pa „Poveži intervals.icu". Aplikacija to sada i kaže
   izričito (v. `icuImaZone` i `zoneRazlog` u app.js) umesto da ćuti. Veza preko
   API ključa ima pun pristup i nju ovo ne dira. */
const SCOPE = 'ACTIVITY:READ,WELLNESS:READ,CALENDAR:WRITE,SETTINGS:READ';

/* KRATKOTRAJAN KEŠ POTVRĐENIH TOKENA — ista provera, jedan mrežni skok manje.
   Do sada je SVAKI poziv ka bilo kojoj putanji plaćao dodatan krug ka
   Supabase-u. Jedna sinhronizacija sa intervals.icu su četiri poziva, dakle
   četiri takva kruga; anketa o AI analizi pita na svake tri sekunde do minut i
   po. To je pola sekunde čiste latencije koja ne radi ništa.

   Prozor je namerno kratak — 30 s. Poređenja radi: preporučeni način (lokalna
   provera potpisa JWT-a, bez ijednog poziva) veruje tokenu do njegovog isteka,
   dakle ceo sat. Ovo je STROŽE od toga, uz istu uštedu. Ključ mape je sam
   token, pa se tuđa sesija ne može ni pogoditi ni podmetnuti.
   Mapa živi u modulu, dakle koliko i topla instanca funkcije; gornja granica
   postoji da dugotrajna instanca ne raste bez kraja. */
const AUTH_KES = new Map();
const AUTH_KES_MS = 30000;
const AUTH_KES_MAX = 500;

async function requireUser(req) {
  const url  = process.env.SUPABASE_URL;
  const anon = process.env.SUPABASE_ANON_KEY;
  if (!url || !anon) {
    return { ok: false, status: 500,
      error: 'SUPABASE_URL / SUPABASE_ANON_KEY nisu podešeni u Vercel → Settings → Environment Variables.' };
  }
  const h = req.headers.authorization || req.headers.Authorization || '';
  const m = /^Bearer\s+(.+)$/i.exec(String(h).trim());
  if (!m) return { ok: false, status: 401, error: 'Nedostaje prijava.' };
  const kes = AUTH_KES.get(m[1]);
  if (kes && kes.doKada > Date.now()) return { ok: true, userId: kes.id, email: kes.email, token: m[1] };
  try {
    const r = await fetchRok(url.replace(/\/+$/, '') + '/auth/v1/user', {
      headers: { apikey: anon, Authorization: 'Bearer ' + m[1] }
    });
    if (!r.ok) return { ok: false, status: 401, error: 'Prijava je istekla — prijavi se ponovo.' };
    const u = await r.json();
    if (!u || !u.id) return { ok: false, status: 401, error: 'Neispravna prijava.' };
    if (AUTH_KES.size >= AUTH_KES_MAX) {
      /* Izbacuju se ISTEKLI, ne ceo keš. `clear()` je na toploj instanci značio
         da svaki 500. poziv baci i sve što je tog trenutka još važilo, pa
         sledećih nekoliko poziva ponovo plaća krug ka Supabase-u bez razloga —
         a keš i postoji da bi ih poštedeo. Ako posle čišćenja i dalje nema
         mesta (500 VAŽEĆIH tokena unutar 30 s), prazni se sve: gornja granica
         je tu da instanca ne raste bez kraja i ta namera ostaje. */
      const sada = Date.now();
      for (const [k, v] of AUTH_KES) if (v.doKada <= sada) AUTH_KES.delete(k);
      if (AUTH_KES.size >= AUTH_KES_MAX) AUTH_KES.clear();
    }
    AUTH_KES.set(m[1], { id: u.id, email: u.email || null, doKada: Date.now() + AUTH_KES_MS });
    return { ok: true, userId: u.id, email: u.email || null, token: m[1] };
  } catch (e) {
    return { ok: false, status: 503, error: 'Provera prijave trenutno nije moguća.' };
  }
}

/* Adresa na koju intervals.icu vraća korisnika. Mora se DOSLOVNO poklapati sa
   onim što je prijavljeno pri traženju client_id-a, uključujući kosu crtu.

   NE ČITA SE IZ ZAGLAVLJA ZAHTEVA.
   Ranije je, kad `ICU_REDIRECT_URI` nije podešen, adresa građena iz
   `x-forwarded-host` — dakle iz vrednosti koju šalje pozivalac. Ta vrednost
   ide kao `redirect_uri` u adresu za autorizaciju, pa bi podmetnuto zaglavlje
   vratilo korisnika (sa `code`-om u upitu) na tuđi server. intervals.icu to
   najverovatnije odbija jer proverava registrovanu adresu — ali odbrana ne
   sme da zavisi od tuđe validacije, pogotovo ne od one koju ne vidimo.

   REDOSLED REZERVI NIJE PROIZVOLJAN.
   `ICU_REDIRECT_URI` je jedino što je sigurno tačno — ta adresa je i
   prijavljena kod intervals.icu, pa se DOSLOVNO poklapa. Zato ide prva i zato
   je treba podesiti.
   `VERCEL_PROJECT_PRODUCTION_URL` je STABILAN produkcijski domen; sledeći je
   jer OAuth traži tačno poklapanje, a registrovana adresa je upravo taj domen.
   `VERCEL_URL` je adresa POJEDINAČNOG deploya (menja se pri svakom) — za
   OAuth se po pravilu NEĆE poklopiti sa registrovanom, pa stoji poslednja,
   samo da pregled na privremenom deployu ne ostane bez ičega.
   Ako nijedno nije poznato, vraća se `null` i putanja odgovara jasnim 501 —
   bolje nego izdati adresu za autorizaciju u koju se ne može imati poverenja. */
function povratnaAdresa() {
  const rucno = String(process.env.ICU_REDIRECT_URI || '').trim();
  if (/^https:\/\/[^\/\s]+\//.test(rucno)) return rucno;
  for (const v of [process.env.VERCEL_PROJECT_PRODUCTION_URL, process.env.VERCEL_URL]) {
    const d = String(v || '').trim();
    if (/^[A-Za-z0-9._-]+$/.test(d)) return 'https://' + d + '/';
  }
  return null;
}


/* ============================================================
   DNEVNI LIMIT — v. supabase/rate-limit.sql

   `rate-limit.sql` postoji doslovno zato što jedan prijavljen korisnik može u
   petlji da gađa spoljni servis SA NAŠE IP ADRESE, a posledice snosi vlasnik.
   Ista rečenica važi i ovde, i to jače: ova putanja uz to troši i naš
   `client_secret`. `api/icu.js` je limit dobio, ova putanja nije — pa je jedan
   prijavljen korisnik mogao u petlji da iscrpi kvotu naše aplikacije i izazove
   blokadu, čime sinhronizacija prestaje da radi SVIM korisnicima.

   Provera oblika (`^[a-f0-9]+$` i sl.) štedi jedan poziv na očigledno smeće, ali
   smeće ISPRAVNOG oblika ide do spoljnog servisa — pa oblik nije limit.

   PROPUŠTA kad baza ne odgovara — namerno, isto kao u api/icu.js: ovo nije
   razorna radnja i SQL možda još nije pušten. Ali se VIDI: `console.error`. */
async function limitPrekoracen(token, endpoint, limit) {
  const url = process.env.SUPABASE_URL, anon = process.env.SUPABASE_ANON_KEY;
  if (!url || !anon) return false;
  try {
    const r = await fetchRok(url.replace(/\/+$/, '') + '/rest/v1/rpc/check_and_bump_endpoint', {
      method: 'POST',
      headers: { apikey: anon, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_endpoint: endpoint, p_limit: limit })
    });
    if (r.ok) return false;
    const telo = await r.text();
    let j = null; try { j = JSON.parse(telo); } catch (e) {}
    if ((j && (j.code === 'P0001' || String(j.message || '').includes('DAILY_LIMIT_EXCEEDED')))
        || String(telo).includes('DAILY_LIMIT_EXCEEDED')) return true;
    console.error('[limit][ALARM] brojac nije radio (%s) — propusteno bez brojanja. HTTP %s: %s',
      endpoint, r.status, telo.slice(0, 200));
    return false;
  } catch (e) {
    console.error('[limit][ALARM] brojac nedostupan (%s) — propusteno bez brojanja: %s', endpoint, e.message);
    return false;
  }
}

export default async function handler(req, res) {
  const clientId     = process.env.ICU_CLIENT_ID;
  const clientSecret = process.env.ICU_CLIENT_SECRET;

  const auth = await requireUser(req);
  if (!auth.ok) { res.status(auth.status).json({ error: auth.error }); return; }

  /* --- 1. korak: adresa za autorizaciju --- */
  if (req.method === 'GET') {
    if (!clientId) { res.status(501).json({ error: 'OAuth nije podešen (nedostaje ICU_CLIENT_ID).' }); return; }
    const state = String((req.query && req.query.state) || '').slice(0, 128);
    if (!/^[A-Za-z0-9_-]{8,128}$/.test(state)) { res.status(400).json({ error: 'Neispravan state.' }); return; }
    const povratak = povratnaAdresa();
    if (!povratak) {
      res.status(501).json({ error: 'OAuth nije podešen (nedostaje ICU_REDIRECT_URI).' });
      return;
    }
    const url = 'https://intervals.icu/oauth/authorize'
      + '?client_id=' + encodeURIComponent(clientId)
      + '&redirect_uri=' + encodeURIComponent(povratak)
      + '&scope=' + encodeURIComponent(SCOPE)
      + '&state=' + encodeURIComponent(state);
    res.status(200).json({ url });
    return;
  }

  if (req.method !== 'POST') { res.status(405).json({ error: 'Samo GET ili POST.' }); return; }
  if (!clientId || !clientSecret) {
    res.status(501).json({ error: 'OAuth nije podešen (nedostaje ICU_CLIENT_ID ili ICU_CLIENT_SECRET).' });
    return;
  }

  /* --- 2. korak: razmena koda za token --- */
  let body;
  try { body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body; }
  catch { res.status(400).json({ error: 'Neispravan JSON.' }); return; }

  const code = String((body && body.code) || '').trim();
  if (!/^[A-Za-z0-9_\-.]{8,256}$/.test(code)) { res.status(400).json({ error: 'Neispravan kod.' }); return; }

  /* Limit stoji SAMO na ovoj grani: GET samo sklopi adresu i ne izlazi na mrežu,
     a ovo je poziv ka intervals.icu sa našim `client_secret`-om. Povezivanje se
     radi jednom, pa je i dvadeset dnevno neuporedivo više od stvarne upotrebe. */
  if (await limitPrekoracen(auth.token, 'icu_oauth', 20)) {
    res.status(429).json({ error: 'Previše pokušaja povezivanja danas. Probaj ponovo sutra.' }); return;
  }

  /* Njihov endpoint prima form-urlencoded, ne JSON. */
  const params = new URLSearchParams();
  params.set('client_id', clientId);
  params.set('client_secret', clientSecret);
  params.set('code', code);

  try {
    const r = await fetchRok('https://intervals.icu/api/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: params.toString()
    });
    if (!r.ok) {
      let d = '';
      try { d = (await r.text()).slice(0, 200); } catch {}
      /* Kod važi 2 minuta — istekao kod je najčešći uzrok, pa se to i kaže. */
      res.status(r.status === 400 || r.status === 401 ? 400 : 502).json({
        error: 'intervals.icu nije prihvatio povezivanje (HTTP ' + r.status + '). Kod važi dva minuta — pokušaj ponovo.',
        detail: d
      });
      return;
    }
    const j = await r.json();
    const token = j && j.access_token;
    const athleteId = j && j.athlete && j.athlete.id;
    if (!token || !athleteId) { res.status(502).json({ error: 'Odgovor bez tokena ili ID-a sportiste.' }); return; }
    res.status(200).json({
      athleteId: String(athleteId),
      token: String(token),
      scope: String((j && j.scope) || ''),
      ime: String((j && j.athlete && j.athlete.name) || '')
    });
  } catch (e) {
    res.status(503).json({ error: 'Nema veze sa intervals.icu.' });
  }
}

/* SUB-20 · intervals.icu — svi pozivi na jednom mestu.

     {sta:'wellness'}    jutarnja merenja (HRV, puls u miru, san, CTL/ATL)
     {sta:'activities'}  odradjeni treninzi, sa krugovima
     {sta:'workouts'}    slanje planiranih treninga u kalendar
     {sta:'zone'}        granice zona pulsa iz sportskih podesavanja

   ZASTO U ISTOM FAJLU. Bilo je odvojeno (wellness.js, activities.js,
   workouts.js), ali Vercel Hobby plan dozvoljava najvise 12 serverless
   funkcija po deployu — trinaesta obara CEO build, pa se ne objavi nijedna
   izmena. Ove tri su bile najprirodnija grupa: iste dve env varijable
   (SUPABASE_URL, SUPABASE_ANON_KEY), ista provera prijave, isti oblik tela
   zahteva, i sve tri razgovaraju sa intervals.icu KORISNIKOVIM tokenom.
   Prelude (kes tokena, requireUser, brojac limita, icuAuth) je bio TRI PUTA
   prepisan; sada je jednom.

   SVAKA GRANA JE OSTALA DOSLOVNO ISTA, samo je dobila ime. To je namerno:
   spajanje je bilo iznudjeno granicom platforme, a ne prilika da se prepravi
   810 linija koje rade. Dnevni limiti i imena brojaca ostaju po grani —
   wellness 100, activities 200, workouts 40 — jer se broje odvojeno u bazi
   (v. supabase/rate-limit.sql) i trosenje jednog ne sme da blokira drugi.
   Cetvrta grana `zone` ima svoj brojac (20) po istom pravilu.

   ZASTO PREKO SERVERA UOPSTE: intervals.icu ne salje CORS zaglavlja, pa bi
   poziv iz pregledaca bio blokiran. */

/* Provera Supabase sesije — UGRAĐENA, ne uvezena (v. komentar u /api/analyze.js:
   Vercel funkcije bez build koraka ne razrešavaju lokalne import-e). */
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
    const r = await fetch(url.replace(/\/+$/, '') + '/auth/v1/user', {
      headers: { apikey: anon, Authorization: 'Bearer ' + m[1] }
    });
    if (!r.ok) return { ok: false, status: 401, error: 'Prijava je istekla — prijavi se ponovo.' };
    const u = await r.json();
    if (!u || !u.id) return { ok: false, status: 401, error: 'Neispravna prijava.' };
    if (AUTH_KES.size >= AUTH_KES_MAX) AUTH_KES.clear();
    AUTH_KES.set(m[1], { id: u.id, email: u.email || null, doKada: Date.now() + AUTH_KES_MS });
    return { ok: true, userId: u.id, email: u.email || null, token: m[1] };
  } catch (e) {
    return { ok: false, status: 503, error: 'Provera prijave trenutno nije moguća.' };
  }
}

/* PREPOZNAVANJE „PREKORAČEN LIMIT" IDE PO ŠIFRI GREŠKE, NE PO TEKSTU.
   Ranije se svuda gledalo `telo.includes('DAILY_LIMIT_EXCEEDED')`. Dok god
   PostgREST prosleđuje poruku izuzetka to radi — ali čim je skrati, promeni
   omot ili je prevede, provera tiho postaje „propusti", i to na svih pet
   putanja odjednom. `errcode` je deo ugovora funkcije (v. rate-limit.sql),
   tekst nije. Tekst ostaje kao rezerva za starije verzije PostgREST-a. */
function jeLimit(telo) {
  let j = null;
  try { j = JSON.parse(telo); } catch (e) {}
  if (j && (j.code === 'P0001' || String(j.message || '').includes('DAILY_LIMIT_EXCEEDED'))) return true;
  return String(telo || '').includes('DAILY_LIMIT_EXCEEDED');
}

/* Dnevni limit po korisniku i endpointu — ista atomska funkcija kao za
   /api/wellness i /api/workouts (v. supabase/rate-limit.sql).

   PROPUŠTA kad baza ne odgovara — namerno, jer SQL možda još nije pušten a ni
   mrežni prekid ne sme da obori analizu. ALI SE VIDI: `console.error`, ne
   `console.warn`. Vercel `warn` meša sa običnim logovima, a `error` ide u
   kanal na koji se može zakačiti obaveštenje. Limit koji tiho otkaže izgleda
   isto kao limit koji radi — mesecima. */
async function limitPrekoracen(token, endpoint, limit) {
  try {
    const r = await fetch(process.env.SUPABASE_URL.replace(/\/+$/, '') + '/rest/v1/rpc/check_and_bump_endpoint', {
      method: 'POST',
      headers: {
        apikey: process.env.SUPABASE_ANON_KEY,
        Authorization: 'Bearer ' + token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ p_endpoint: endpoint, p_limit: limit })
    });
    if (r.ok) return false;
    const telo = await r.text();
    if (jeLimit(telo)) return true;
    console.error('[limit][ALARM] brojac nije radio (%s) — propusteno bez brojanja. HTTP %s: %s',
      endpoint, r.status, telo.slice(0, 200));
    return false;
  } catch (e) {
    console.error('[limit][ALARM] brojac nedostupan (%s) — propusteno bez brojanja: %s', endpoint, e.message);
    return false;
  }
}

/* AUTORIZACIJA KA intervals.icu — dva puta, jer postoje dve vrste veze:
   - OAuth token  -> "Authorization: Bearer <token>"  (novo, bez unosa ičega)
   - API kljuc    -> Basic, sa fiksnim korisnickim imenom API_KEY (staro)
   Stari nacin se ZADRZAVA: korisnici koji su vec uneli kljuc ne smeju da
   ostanu bez veze zbog nove mogucnosti. */
function icuAuth(body) {
  const token  = String((body && body.token) || '').trim();
  const apiKey = String((body && body.apiKey) || '').trim();
  if (token) {
    if (token.length < 8 || token.length > 400) return { ok: false, error: 'Neispravan token.' };
    return { ok: true, header: 'Bearer ' + token };
  }
  if (apiKey) {
    if (apiKey.length < 8 || apiKey.length > 200) return { ok: false, error: 'Neispravan API ključ.' };
    return { ok: true, header: 'Basic ' + Buffer.from('API_KEY:' + apiKey).toString('base64') };
  }
  return { ok: false, error: 'Nedostaje veza sa intervals.icu.' };
}

const DAN = /^\d{4}-\d{2}-\d{2}$/;

/* ---------- jedinstveno za wellness ---------- */
/* Iz punog zapisa uzima SAMO ono što analiza koristi. Nazivi polja se razlikuju
   između izvora koje intervals.icu prima (Garmin, Oura, ručni unos), pa se za
   svaku vrednost pokušava nekoliko poznatih imena. */
function izvuci(z) {
  const prvi = (...k) => { for (const x of k) { const v = z[x]; if (v != null && v !== '') return v; } return null; };
  const broj = v => (v == null || isNaN(+v)) ? null : +v;
  const san = broj(prvi('sleepSecs', 'sleep_secs'));
  const out = {
    datum:      typeof z.id === 'string' ? z.id.slice(0, 10) : null,
    hrv:        broj(prvi('hrv', 'hrvSDNN', 'hrv_sdnn')),
    pulsUMiru:  broj(prvi('restingHR', 'resting_hr', 'restingHr')),
    sanH:       san != null ? Math.round(san / 360) / 10 : null,
    sanOcena:   broj(prvi('sleepScore', 'sleep_score', 'sleepQuality', 'sleep_quality')),
    tezina:     broj(prvi('weight')),
    /* intervals.icu računa i trenažno opterećenje: ctl = dugoročna forma,
       atl = kratkoročni umor, razlika je "svežina". Dolazi besplatno uz isti
       poziv, a trend analizi daje ono što iz samih treninga ne može da izvede. */
    ctl:        broj(prvi('ctl')),
    atl:        broj(prvi('atl'))
  };
  if (out.ctl != null && out.atl != null) out.svezina = Math.round((out.ctl - out.atl) * 10) / 10;
  /* zapis bez ijednog korisnog podatka se ne vraća */
  const imaNesto = ['hrv','pulsUMiru','sanH','sanOcena','tezina','ctl'].some(k => out[k] != null);
  return (out.datum && imaNesto) ? out : null;
}

/* ---------- jedinstveno za workouts ---------- */
const MAX_DOGADJAJA = 60;   /* ~2 meseca plana; iznad toga je greška u pozivaocu */

/* ---------- jedinstveno za activities ---------- */
const broj = v => (v == null || v === '' || isNaN(+v)) ? null : +v;
const ceo  = v => { const x = broj(v); return x == null ? null : Math.round(x); };

/* BRZINA -> TEMPO. intervals.icu čuva i `pace` i `gap` kao BRZINU u m/s, ali
   se kroz izvore i verzije ume pojaviti i već izračunat tempo u s/km. Umesto
   pogađanja, opseg odlučuje: trkačka brzina je 1–8 m/s, a trkački tempo
   100–900 s/km — ta dva opsega se ne preklapaju, pa je razlikovanje sigurno.
   Sve van oba opsega je smeće i vraća se kao `null`, ne kao izmišljen broj. */
function tempoIz(v) {
  const x = broj(v);
  if (x == null || !isFinite(x) || x <= 0) return null;
  if (x >= 1 && x <= 8)     return Math.round(1000 / x);   /* m/s */
  if (x >= 100 && x <= 900) return Math.round(x);          /* već s/km */
  return null;
}

/* Sažetak treninga — SAMO ono što aplikacija i analiza koriste. Ceo zapis ima
   183 polja; slanje svega bi naduvalo i odgovor i ono što ide modelu. */
function sazetak(a) {
  if (!a || typeof a !== 'object') return null;
  const id = a.id != null ? String(a.id) : null;
  const datum = typeof a.start_date_local === 'string' ? a.start_date_local.slice(0, 10) : null;
  if (!id || !DAN.test(datum || '')) return null;
  const km = broj(a.distance) != null ? Math.round(broj(a.distance) / 100) / 10 : null;
  /* SAT POČETKA, odvojen od datuma. Aplikacija iz njega traži temperaturu tog
     trčanja u Open-Meteo prognozi (v. `tempTrcanja` u app.js) umesto da uzme
     `temp` sa sata, koje je zglobno očitavanje i sistematski je više od
     vazduha. Čita se iz stringa, bez `new Date()` — vrednost je lokalno vreme
     trkača, a parsiranje bi je pomerilo za zonu servera. */
  const sh = /^\d{4}-\d\d-\d\dT(\d\d)/.exec(String(a.start_date_local || ''));
  const o = {
    id, datum,
    sat: sh ? +sh[1] : null,
    tip: typeof a.type === 'string' ? a.type.slice(0, 32) : null,
    naziv: typeof a.name === 'string' ? a.name.slice(0, 120) : null,
    opis:  typeof a.description === 'string' ? a.description.slice(0, 400) : null,
    km,
    sec: ceo(a.moving_time),
    hr: ceo(a.average_heartrate), maxHr: ceo(a.max_heartrate),
    kadenca: broj(a.average_cadence) != null ? Math.round(broj(a.average_cadence) * 2) / 2 : null,
    uspon: ceo(a.total_elevation_gain),
    temp: ceo(a.average_temp),
    /* „oseća se kao" je za zaključak o vrućini bolji broj od temperature
       vazduha — vlažnost i vetar menjaju napor pri istom tempu. */
    osecaSe: ceo(a.average_feels_like),
    /* Ono zbog čega intervals.icu i jeste bolji izvor: već izračunato. */
    gapSec: tempoIz(a.gap),
    razdvajanje: broj(a.decoupling) != null ? Math.round(broj(a.decoupling) * 10) / 10 : null,
    efikasnost: broj(a.icu_efficiency_factor) != null ? Math.round(broj(a.icu_efficiency_factor) * 100) / 100 : null,
    opterecenje: ceo(a.icu_training_load),
    intenzitet: ceo(a.icu_intensity),
    trimp: ceo(a.trimp),
    korak: ceo(a.average_stride),
    zonePuls: Array.isArray(a.icu_hr_zone_times) ? a.icu_hr_zone_times.map(ceo).slice(0, 8) : null,
    zoneTempo: Array.isArray(a.pace_zone_times) ? a.pace_zone_times.map(ceo).slice(0, 8) : null
  };
  return o;
}

/* Jedan krug (rep ili oporavak). `paceSec` se računa iz distance i vremena, ne
   iz `average_speed` — tako je isti broj koji aplikacija svuda koristi. */
function krug(x, red) {
  if (!x || typeof x !== 'object') return null;
  const distM = broj(x.distance), sec = ceo(x.moving_time);
  const o = {
    red,
    tip: x.type === 'RECOVERY' ? 'oporavak' : 'rad',
    distM: distM != null ? Math.round(distM) : null,
    sec,
    elapsed: ceo(x.elapsed_time),
    paceSec: (distM > 0 && sec > 0) ? Math.round(sec / (distM / 1000)) : tempoIz(x.average_speed),
    gapSec: tempoIz(x.gap),
    hr: ceo(x.average_heartrate), maxHr: ceo(x.max_heartrate), minHr: ceo(x.min_heartrate),
    kadenca: broj(x.average_cadence) != null ? Math.round(broj(x.average_cadence) * 2) / 2 : null,
    watts: ceo(x.average_watts),
    razdvajanje: broj(x.decoupling) != null ? Math.round(broj(x.decoupling) * 10) / 10 : null,
    oznaka: typeof x.label === 'string' ? x.label.slice(0, 40) : null,
    grupa: typeof x.group_id === 'string' ? x.group_id.slice(0, 40) : null
  };
  if (o.distM == null && o.sec == null) return null;
  return o;
}

/* Grupa ponavljanja — „6×800" kao jedna stavka. */
function grupa(g) {
  if (!g || typeof g !== 'object') return null;
  const distM = broj(g.distance), sec = ceo(g.moving_time);
  return {
    oznaka: typeof g.id === 'string' ? g.id.slice(0, 40) : (typeof g.label === 'string' ? g.label.slice(0, 40) : null),
    n: ceo(g.count),
    distM: distM != null ? Math.round(distM) : null,
    sec,
    paceSec: (distM > 0 && sec > 0) ? Math.round(sec / (distM / 1000)) : null,
    gapSec: tempoIz(g.gap),
    hr: ceo(g.average_heartrate), maxHr: ceo(g.max_heartrate),
    kadenca: broj(g.average_cadence) != null ? Math.round(broj(g.average_cadence) * 2) / 2 : null,
    razdvajanje: broj(g.decoupling) != null ? Math.round(broj(g.decoupling) * 10) / 10 : null
  };
}

const ID_OBLIK = /^[A-Za-z0-9_-]{1,64}$/;

async function obradiWellness(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Samo POST.' }); return; }

  const auth = await requireUser(req);
  if (!auth.ok) { res.status(auth.status).json({ error: auth.error }); return; }

  /* 100/dan je namerno velikodusno: normalna upotreba je 1 automatsko
     povlacenje dnevno (`S.icu.autoDan` ga cuva) plus po koji rucni klik na
     "Povuci sada". Sto puta se ne dodje slucajno — samo skriptom. */
  const DNEVNI_LIMIT = 100;
  if (await limitPrekoracen(auth.token, 'wellness', DNEVNI_LIMIT)) {
    res.status(429).json({ error: 'Dnevni limit povlačenja sa intervals.icu (' + DNEVNI_LIMIT + ') je iskorišćen. Pokušaj ponovo sutra.' });
    return;
  }

  let body;
  try { body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body; }
  catch { res.status(400).json({ error: 'Neispravan JSON.' }); return; }

  const athleteId = String((body && body.athleteId) || '').trim();
  const oldest    = String((body && body.oldest) || '').trim();
  const newest    = String((body && body.newest) || '').trim();

  if (!/^i?\d+$/.test(athleteId)) { res.status(400).json({ error: 'Neispravan intervals.icu ID sportiste.' }); return; }
  const aut = icuAuth(body);
  if (!aut.ok) { res.status(400).json({ error: aut.error }); return; }
  if (!DAN.test(oldest) || !DAN.test(newest)) { res.status(400).json({ error: 'Neispravan opseg datuma.' }); return; }
  if (newest < oldest) { res.status(400).json({ error: 'Kraj opsega je pre početka.' }); return; }

  const url = 'https://intervals.icu/api/v1/athlete/' + encodeURIComponent(athleteId) +
              '/wellness?oldest=' + oldest + '&newest=' + newest;

  try {
    const r = await fetch(url, { headers: { Authorization: aut.header, Accept: 'application/json' } });
    if (r.status === 401 || r.status === 403) {
      res.status(401).json({ error: 'intervals.icu je odbio pristup. Otkači pa ponovo poveži intervals.icu u Podešavanjima.' });
      return;
    }
    if (r.status === 429) { res.status(429).json({ error: 'intervals.icu privremeno ograničava zahteve. Pokušaj kasnije.' }); return; }
    if (!r.ok) { res.status(502).json({ error: 'intervals.icu greška (HTTP ' + r.status + ').' }); return; }

    const j = await r.json();
    const niz = Array.isArray(j) ? j : (j && Array.isArray(j.wellness) ? j.wellness : []);
    const dani = niz.map(izvuci).filter(Boolean).sort((a, b) => a.datum < b.datum ? -1 : 1);
    res.status(200).json({ dani });
  } catch (e) {
    /* namerno bez detalja iz greške — u njoj može završiti deo URL-a */
    res.status(503).json({ error: 'Nema veze sa intervals.icu.' });
  }
}

/* ============================================================
   ZONE PULSA SA intervals.icu

   ZAŠTO. Vreme po zonama (`icu_hr_zone_times`) je oduvek dolazilo SA icu-a, a
   granice zona (šta Z1 uopšte znači) ISKLJUČIVO sa Strave. To su dva sistema:
   Strava podrazumevano ima pet zona izvedenih iz maksimalnog pulsa, icu sedam
   izvedenih iz praga (LTHR). Granice se ne poklapaju, pa je AI raspodelu sa
   icu-a čitao kroz Stravine nazive i tvrdio „ceo trening u zoni 1" za trčanje
   koje je po Stravinim zonama bilo Z2 (prijava korisnika).

   Sada, kad je icu povezan, i granice i raspodela dolaze iz njega — isti
   sistem sa obe strane. Strava ostaje izvor samo kad icu-a nema.

   OBLIK. icu daje GORNJE granice (`hr_zones: [130,145,...]`), a aplikacija
   svuda radi sa `{min,max}` (Stravin oblik). Prevod je ovde, na jednom mestu,
   da klijent i `zonaZaPuls` ostanu nepromenjeni.
   ============================================================ */
function zoneIzSporta(j) {
  /* DVA MOGUĆA OBLIKA. `/athlete/{id}` vraća sportska podešavanja ugnježdena u
     `sportSettings`, a namenski `/athlete/{id}/sport-settings` vraća go niz.
     Prihvataju se oba, jer se zove i jedno i drugo (v. `obradiZone`) — i jer je
     pretpostavka o obliku odgovora već jednom bila mesto gde je sve stalo. */
  const lista = Array.isArray(j) ? j
              : (j && Array.isArray(j.sportSettings) ? j.sportSettings : []);
  /* Sportska podešavanja su po grupama tipova; traži se ona koja pokriva
     trčanje. Bez ovog filtera bi se lako uzele biciklističke zone, koje su za
     istog čoveka bitno drugačije. */
  const zaTrcanje = lista.find(s => s && Array.isArray(s.types) &&
    s.types.some(t => /run|trčanje|trcanje/i.test(String(t || ''))));
  const s = zaTrcanje || null;
  if (!s) return null;
  const gornje = Array.isArray(s.hr_zones) ? s.hr_zones.map(ceo).filter(x => x != null) : [];
  /* Stroga provera, jer ovo postaje merilo po kom se sudi svaki trening:
     rastući niz uverljivih pulseva. Sve što nije takvo se odbija u celosti —
     pola tačnih zona je gore od nijedne, jer izgleda ispravno. */
  if (gornje.length < 2 || gornje.length > 8) return null;
  for (let i = 0; i < gornje.length; i++) {
    if (!(gornje[i] >= 50 && gornje[i] <= 250)) return null;
    if (i > 0 && gornje[i] <= gornje[i - 1]) return null;
  }
  const imena = Array.isArray(s.hr_zone_names) ? s.hr_zone_names : [];
  const zone = gornje.map((g, i) => ({
    min: i === 0 ? 1 : gornje[i - 1] + 1,
    /* POSLEDNJA ZONA JE OTVORENA NAGORE, kao i kod Strave. icu poslednju
       granicu drži na maksimalnom pulsu; da se preslikala doslovno, otkucaj
       iznad nje ne bi pripadao nijednoj zoni i `zonaZaPuls` bi vratio null
       baš na najtežim trenucima trke. */
    max: i === gornje.length - 1 ? null : gornje[i],
    ime: typeof imena[i] === 'string' ? imena[i].slice(0, 24) : null
  }));
  return {
    zone,
    lthr: ceo(s.lthr),
    maxHr: ceo(s.max_hr)
  };
}

async function obradiZone(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Samo POST.' }); return; }

  const auth = await requireUser(req);
  if (!auth.ok) { res.status(auth.status).json({ error: auth.error }); return; }

  /* SOPSTVEN BROJAC, ne deljen sa `activities`.

     Deljenje je bilo prvo resenje — izbegava rucno pustanje SQL-a. Ali brojaci
     su po grani bas zato da trosenje jedne ne blokira drugu: sa deljenim
     brojacem bi 200 poziva ka treninzima ugasilo i povlacenje zona, a to se ne
     bi videlo kao greska nego kao „zone se ne azuriraju". Zamka u
     test/api.test.mjs to izricito brani.

     TRAZI PUSTANJE supabase/rate-limit.sql (spisak dozvoljenih naziva je u
     bazi). Dok se ne pusti, `check_and_bump_endpoint` dize BAD_ENDPOINT, a
     `limitPrekoracen` na gresku PROPUSTA poziv — zone rade, samo nebrojeno i uz
     ALARM u logu. Dakle: zaboravljena migracija ne kvari funkciju, ali se vidi.

     Limit je nizak jer klijent zone trazi najvise jednom nedeljno; 20 dnevno je
     brana od petlje u kodu, ne stvarno ogranicenje. */
  const DNEVNI_LIMIT = 20;
  if (await limitPrekoracen(auth.token, 'zone', DNEVNI_LIMIT)) {
    res.status(429).json({ error: 'Dnevni limit povlačenja zona je iskorišćen. Pokušaj ponovo sutra.' });
    return;
  }

  let body;
  try { body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body; }
  catch { res.status(400).json({ error: 'Neispravan JSON.' }); return; }

  const athleteId = String((body && body.athleteId) || '').trim();
  if (!/^i?\d+$/.test(athleteId)) { res.status(400).json({ error: 'Neispravan intervals.icu ID sportiste.' }); return; }
  const aut = icuAuth(body);
  if (!aut.ok) { res.status(400).json({ error: aut.error }); return; }

  const zovi = async (url) => {
    const r = await fetch(url, { headers: { Authorization: aut.header, Accept: 'application/json' } });
    if (r.status === 401 || r.status === 403) {
      const e = new Error('odbijen'); e.status = 401;
      /* 403 ovde gotovo uvek znači STAR TOKEN bez opsega `SETTINGS:READ` —
         zone su dodate posle njega. Poruka mora reći šta da se uradi, ne samo
         da je odbijeno; upravo je nedostatak te rečenice pretvorio prijavu u
         „ništa ne šljaka". */
      e.poruka = 'intervals.icu je odbio pristup zonama. Veza je starija od ove funkcije i nema dozvolu za čitanje podešavanja — otkači pa ponovo poveži intervals.icu u Podešavanjima.';
      throw e;
    }
    if (r.status === 429) { const e = new Error('limit'); e.status = 429; e.poruka = 'intervals.icu privremeno ograničava zahteve. Pokušaj kasnije.'; throw e; }
    if (r.status === 404) return null;   /* putanja ne postoji — proba se druga */
    if (!r.ok) { const e = new Error('http'); e.status = 502; e.poruka = 'intervals.icu greška (HTTP ' + r.status + ').'; throw e; }
    return r.json();
  };

  try {
    const baza = 'https://intervals.icu/api/v1/athlete/' + encodeURIComponent(athleteId);
    /* Prvo namenska putanja, pa athlete objekat kao rezerva. Redosled je takav
       jer `/sport-settings` vraća baš ono što nam treba, dok athlete objekat
       nosi i sve ostalo i nije zajemčeno da podešavanja ugnezdi. */
    let zone = null;
    for (const url of [baza + '/sport-settings', baza]) {
      const j = await zovi(url);
      if (!j) continue;
      zone = zoneIzSporta(j);
      if (zone) break;
    }
    /* `zone: null` NIJE greška — sportska podešavanja za trčanje prosto nisu
       popunjena. Klijent tada zadržava ono što ima (Stravine zone) umesto da
       prikaže grešku zbog podatka koji je ionako opcion. Ali se KAŽE, da se
       „nisu popunjena" ne bi čitalo isto kao „nisam ni pokušao". */
    res.status(200).json({
      zone: zone ? zone.zone : null,
      lthr: zone ? zone.lthr : null,
      maxHr: zone ? zone.maxHr : null,
      razlog: zone ? null : 'U intervals.icu Sport Settings za trčanje nisu podešene zone pulsa.'
    });
  } catch (e) {
    if (e && e.status) { res.status(e.status).json({ error: e.poruka || 'Greška.' }); return; }
    /* namerno bez detalja iz greške — u njoj može završiti deo URL-a */
    res.status(503).json({ error: 'Nema veze sa intervals.icu.' });
  }
}

async function obradiWorkouts(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Samo POST.' }); return; }

  const auth = await requireUser(req);
  if (!auth.ok) { res.status(auth.status).json({ error: auth.error }); return; }

  /* Nizi limit nego kod /api/wellness, jer je ovo SKUPLJI poziv: jedan zahtev
     u rezimu "zameni" povlaci citanje kalendara + do MAX_DOGADJAJA brisanja +
     upis. Stvarna upotreba je par slanja dnevno (posalji plan, pa ispravka). */
  const DNEVNI_LIMIT = 40;
  if (await limitPrekoracen(auth.token, 'workouts', DNEVNI_LIMIT)) {
    res.status(429).json({ error: 'Dnevni limit slanja na intervals.icu (' + DNEVNI_LIMIT + ') je iskorišćen. Pokušaj ponovo sutra.' });
    return;
  }

  let body;
  try { body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body; }
  catch { res.status(400).json({ error: 'Neispravan JSON.' }); return; }

  const athleteId = String((body && body.athleteId) || '').trim();
  const dogadjaji = Array.isArray(body && body.events) ? body.events : null;

  if (!/^i?\d+$/.test(athleteId)) { res.status(400).json({ error: 'Neispravan intervals.icu ID sportiste.' }); return; }
  const aut = icuAuth(body);
  if (!aut.ok) { res.status(400).json({ error: aut.error }); return; }
  if (!dogadjaji || !dogadjaji.length) { res.status(400).json({ error: 'Nema treninga za slanje.' }); return; }
  if (dogadjaji.length > MAX_DOGADJAJA) { res.status(400).json({ error: 'Previše treninga odjednom (najviše ' + MAX_DOGADJAJA + ').' }); return; }

  /* Propušta se SAMO ono što intervals.icu treba za planiran trening — ne
     prosleđuje se sirov objekat iz pregledača. */
  const cist = [];
  for (const e of dogadjaji) {
    const dan = String((e && e.date) || '');
    if (!DAN.test(dan)) { res.status(400).json({ error: 'Neispravan datum u listi treninga.' }); return; }
    const ext = String((e && e.externalId) || '').slice(0, 60);
    if (!/^sub19-[A-Za-z0-9_]+$/.test(ext)) { res.status(400).json({ error: 'Neispravan ID treninga.' }); return; }
    cist.push({
      category: 'WORKOUT',
      type: 'Run',
      start_date_local: dan + 'T00:00:00',
      name: String((e && e.name) || 'Trening').slice(0, 120),
      description: String((e && e.description) || '').slice(0, 4000),
      external_id: ext,
      /* iz koje aplikacije dolazi — vidi se u intervals.icu */
      indoor: false
    });
  }

  const url = 'https://intervals.icu/api/v1/athlete/' + encodeURIComponent(athleteId) +
              '/events/bulk?upsert=true';
  const zaglavlja = { Authorization: aut.header, Accept: 'application/json' };

  /* REŽIM "ZAMENI" — prvo obriši naše postojeće događaje, pa napravi nove.
     Zašto uopšte postoji: intervals.icu gradi Garmin izvoz kad se događaj
     NAPRAVI. Ako se postojeći samo ažurira (upsert), stari izvoz ostaje, pa
     ispravke koje zavise od podešavanja sportiste (npr. tek unet prag tempa)
     nikad ne stignu na sat. Tada je jedini put brisanje i ponovno pravljenje.
     Briše se ISKLJUČIVO ono što nosi naš external_id — tuđi događaji u istom
     opsegu se ne diraju. */
  if (String((body && body.rezim) || '') === 'zameni') {
    const datumi = cist.map(e => e.start_date_local.slice(0, 10)).sort();
    const gl = 'https://intervals.icu/api/v1/athlete/' + encodeURIComponent(athleteId) +
               '/events?oldest=' + datumi[0] + '&newest=' + datumi[datumi.length - 1] +
               '&category=WORKOUT';
    try {
      const g = await fetch(gl, { headers: zaglavlja });
      if (g.status === 401 || g.status === 403) {
        res.status(401).json({ error: 'intervals.icu je odbio ključ ili nema dozvolu za kalendar.' }); return;
      }
      if (g.ok) {
        const lista = await g.json();
        const nasi = (Array.isArray(lista) ? lista : [])
          .filter(e => e && typeof e.external_id === 'string' && /^sub19-/.test(e.external_id) && e.id != null)
          .slice(0, MAX_DOGADJAJA);
        /* BRISANJE IDE PARALELNO, U MALIM GRUPAMA.
           Ranije je bila obicna sekvencijalna petlja: do 60 zahteva jedan za
           drugim, bez roka i bez provere odgovora. Na 200-400 ms po pozivu to
           je 12-25 s samo za brisanje, pre GET-a i zavrsnog POST-a — dovoljno
           da funkciju prekine vremenski limit USRED petlje. Posledica je bila
           gora od neuspeha: kalendar delimicno obrisan, novi treninzi nikad
           poslati. Grupe po 5 drze ukupno vreme u sekundama, a `sub19-` filter
           i dalje garantuje da se tudji dogadjaji ne diraju. */
        const GRUPA = 5;
        for (let i = 0; i < nasi.length; i += GRUPA) {
          await Promise.all(nasi.slice(i, i + GRUPA).map(e =>
            fetch('https://intervals.icu/api/v1/athlete/' + encodeURIComponent(athleteId) +
                  '/events/' + encodeURIComponent(e.id), { method: 'DELETE', headers: zaglavlja })
              .catch(() => null)   /* pojedinacan neuspeh ne sme da obori ceo posao */
          ));
        }
      }
    } catch (e) {
      /* brisanje nije uspelo — i dalje se šalje, gore je ne poslati ništa */
    }
  }

  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { Authorization: aut.header, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(cist)
    });
    if (r.status === 401 || r.status === 403) {
      res.status(401).json({ error: 'intervals.icu je odbio ključ ili nema dozvolu za pisanje u kalendar.' });
      return;
    }
    if (r.status === 429) { res.status(429).json({ error: 'intervals.icu privremeno ograničava zahteve. Pokušaj kasnije.' }); return; }
    if (!r.ok) {
      let d = '';
      try { d = (await r.text()).slice(0, 200); } catch {}
      res.status(502).json({ error: 'intervals.icu greška (HTTP ' + r.status + ').', detail: d });
      return;
    }
    let n = cist.length;
    try { const j = await r.json(); if (Array.isArray(j)) n = j.length; } catch {}
    res.status(200).json({ poslato: n });
  } catch (e) {
    res.status(503).json({ error: 'Nema veze sa intervals.icu.' });
  }
}

async function obradiActivities(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Samo POST.' }); return; }

  const auth = await requireUser(req);
  if (!auth.ok) { res.status(auth.status).json({ error: auth.error }); return; }

  /* Vise nego kod wellness-a (100), jer jedna sinhronizacija trosi jedan poziv
     za spisak plus jedan za detalje — a rucnih klikova ume da bude. */
  const DNEVNI_LIMIT = 200;
  if (await limitPrekoracen(auth.token, 'activities', DNEVNI_LIMIT)) {
    res.status(429).json({ error: 'Dnevni limit povlačenja sa intervals.icu (' + DNEVNI_LIMIT + ') je iskorišćen. Pokušaj ponovo sutra.' });
    return;
  }

  let body;
  try { body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body; }
  catch { res.status(400).json({ error: 'Neispravan JSON.' }); return; }

  const athleteId = String((body && body.athleteId) || '').trim();
  if (!/^i?\d+$/.test(athleteId)) { res.status(400).json({ error: 'Neispravan intervals.icu ID sportiste.' }); return; }
  const aut = icuAuth(body);
  if (!aut.ok) { res.status(400).json({ error: aut.error }); return; }

  const zovi = async (url) => {
    const r = await fetch(url, { headers: { Authorization: aut.header, Accept: 'application/json' } });
    if (r.status === 401 || r.status === 403) {
      const e = new Error('odbijen'); e.status = 401;
      /* 403 na aktivnostima gotovo uvek znaci STAR TOKEN bez opsega za
         treninge — korisnik je povezao icu dok je aplikacija trazila samo
         wellness. Poruka mora da kaze sta da uradi, ne samo da je odbijeno. */
      e.poruka = 'intervals.icu je odbio pristup treninzima. Otkači pa ponovo poveži intervals.icu u Podešavanjima — starija veza nema dozvolu za treninge.';
      throw e;
    }
    if (r.status === 429) { const e = new Error('limit'); e.status = 429; e.poruka = 'intervals.icu privremeno ograničava zahteve. Pokušaj kasnije.'; throw e; }
    if (!r.ok) { const e = new Error('http'); e.status = 502; e.poruka = 'intervals.icu greška (HTTP ' + r.status + ').'; throw e; }
    return r.json();
  };

  try {
    /* ---- REŽIM 3: SIROVI TOKOVI (po-km presek za kontinuirana trčanja) ----

       ZAŠTO POSTOJI: režim 2 vraća `icu_intervals` — deonice koje je icu
       PREPOZNAO. Na laganom i dugom trčanju struktura ne postoji, pa je odgovor
       prazan i to je tačno. Ali tada nema NIŠTA po kilometru: ni tempa, ni
       pulsa, ni drifta. Dok je Strava bila primaran izvor, taj presek se
       računao iz njenih streamova; kad je icu postao primaran, lagana trčanja
       su tiho ostala samo na proseku cele sesije — i AI analiza je to i pisala.

       Vraćaju se SIROVI tokovi, u istom obliku u kom ih daje Strava
       (`key_by_type=true`), da bi ih klijent obradio ISTOM funkcijom
       (`perKmDetail`). Dve kopije tog računa bi se pre ili kasnije razišle. */
    if (Array.isArray(body.tokovi)) {
      const ids = body.tokovi.map(x => String(x || '').trim()).filter(x => ID_OBLIK.test(x)).slice(0, 3);
      if (!ids.length) { res.status(400).json({ error: 'Nijedan ispravan ID treninga.' }); return; }
      /* Samo ono što perKmDetail zaista čita — svaki dodatni tok je čist teret
         na mreži (jedan sat trčanja je ~3600 tačaka po nizu). */
      const ZELJENI = ['time', 'distance', 'heartrate', 'cadence', 'altitude', 'temp', 'watts', 'moving'];
      const out = {};
      for (const id of ids) {
        try {
          const j = await zovi('https://intervals.icu/api/v1/activity/' + encodeURIComponent(id) +
                               '/streams?types=' + ZELJENI.join(','));
          /* icu vraća niz {type, data}; Strava vraća objekat {type:{data}}.
             Normalizuje se na Stravin oblik, jer njega klijent već ume. */
          const niz = Array.isArray(j) ? j : (j && Array.isArray(j.streams) ? j.streams : []);
          const tok = {};
          for (const s of niz) {
            if (!s || typeof s.type !== 'string' || !Array.isArray(s.data)) continue;
            if (!ZELJENI.includes(s.type)) continue;
            /* Vrednosti se svode na broj ili null — u tokovima ume da bude i
               `false` i string, a perKmDetail sabira. */
            tok[s.type] = { data: s.data.map(v => (v == null || v === false) ? null
                                                : (v === true ? 1 : (Number.isFinite(+v) ? +v : null))) };
          }
          out[id] = (tok.distance && tok.distance.data.length) ? tok : { greska: true };
        } catch (e) {
          if (e.status === 401 || e.status === 429) throw e;
          out[id] = { greska: true };
        }
      }
      res.status(200).json({ tokovi: out });
      return;
    }

    /* ---- REŽIM 2: krugovi za tražene treninge ---- */
    if (Array.isArray(body.detalji)) {
      const ids = body.detalji.map(x => String(x || '').trim()).filter(x => ID_OBLIK.test(x)).slice(0, 12);
      if (!ids.length) { res.status(400).json({ error: 'Nijedan ispravan ID treninga.' }); return; }
      const out = {};
      for (const id of ids) {
        try {
          const j = await zovi('https://intervals.icu/api/v1/activity/' + encodeURIComponent(id) + '/intervals');
          const kr = Array.isArray(j && j.icu_intervals) ? j.icu_intervals.map(krug).filter(Boolean) : [];
          const gr = Array.isArray(j && j.icu_groups) ? j.icu_groups.map(grupa).filter(Boolean) : [];
          /* Prazan nalaz je i sam podatak: znaci da icu NIJE nasao strukturu
             (kontinuirano trcanje), pa aplikacija zna da ne treba da ceka. */
          out[id] = { krugovi: kr, grupe: gr };
        } catch (e) {
          if (e.status === 401 || e.status === 429) throw e;   /* ovo se ne guta */
          out[id] = { greska: true };
        }
      }
      res.status(200).json({ detalji: out });
      return;
    }

    /* ---- REŽIM 1: spisak treninga u opsegu ---- */
    const oldest = String((body && body.oldest) || '').trim();
    const newest = String((body && body.newest) || '').trim();
    if (!DAN.test(oldest) || !DAN.test(newest)) { res.status(400).json({ error: 'Neispravan opseg datuma.' }); return; }
    if (newest < oldest) { res.status(400).json({ error: 'Kraj opsega je pre početka.' }); return; }

    const j = await zovi('https://intervals.icu/api/v1/athlete/' + encodeURIComponent(athleteId) +
                         '/activities?oldest=' + oldest + '&newest=' + newest);
    const niz = Array.isArray(j) ? j : (j && Array.isArray(j.activities) ? j.activities : []);
    /* Samo trčanja: icu prima i bicikl, plivanje, teretanu, a plan se odnosi
       na trčanje. Uporedjuje se malim slovima jer se tip pise razlicito
       zavisno od izvora (Run / VirtualRun / TrailRun). */
    const treninzi = niz.map(sazetak).filter(Boolean)
      .filter(a => !a.tip || /run|trčanje|trcanje/i.test(a.tip))
      .sort((a, b) => a.datum < b.datum ? -1 : 1)
      .slice(0, 200);
    res.status(200).json({ treninzi });
  } catch (e) {
    if (e && e.status) { res.status(e.status).json({ error: e.poruka || 'Greška.' }); return; }
    /* namerno bez detalja iz greške — u njoj može završiti deo URL-a */
    res.status(503).json({ error: 'Nema veze sa intervals.icu.' });
  }
}


export default async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Samo POST.' }); return; }

  /* PRIJAVA PRE GRANANJA. Ako se prvo gleda `sta`, neprijavljen poziv dobija
     „Ocekuje se sta: wellness | activities | workouts" — dakle spisak onoga
     sto putanja ume, pre nego sto je iko dokazao da sme da je zove. Grane i
     dalje zovu `requireUser` same; drugi poziv je pogodak u kesu (v. AUTH_KES),
     ne dodatni krug ka Supabase-u. */
  const auth = await requireUser(req);
  if (!auth.ok) { res.status(auth.status).json({ error: auth.error }); return; }

  /* `sta` se cita bez trosenja tela: Vercel ga vec isparsira u objekat, pa ga
     svaka grana cita ponovo — jeftinije od prosledjivanja kroz tri potpisa. */
  let sta = '';
  try {
    const b = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    sta = String((b && b.sta) || '').trim();
  } catch { res.status(400).json({ error: 'Neispravan JSON.' }); return; }

  if (sta === 'wellness')   return obradiWellness(req, res);
  if (sta === 'workouts')   return obradiWorkouts(req, res);
  if (sta === 'activities') return obradiActivities(req, res);
  if (sta === 'zone')       return obradiZone(req, res);
  res.status(400).json({ error: 'Nepoznat zahtev. Očekuje se sta: wellness | activities | workouts | zone.' });
}

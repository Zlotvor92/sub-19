/* SUB-20 · Dnevni izveštaj — Vercel Cron, jednom dnevno (vidi vercel.json).

   IZMENA (v2): Ranije se "aktivnost" merila kroz user_state.updated_at —
   vreme POSLEDNJEG USPEŠNOG UPISA u Supabase. To je POSREDAN signal: ako
   pozadinska sinhronizacija nije uspela (token istekao u tom trenutku, app
   zatvorena pre nego što je odloženi upis stigao da se izvrši — sync je
   odložen 4s posle svakog save()), lokalni podaci su ažurni a Supabase to
   ne zna, pa izveštaj pokazuje lažno staru "poslednju aktivnost".

   Sada se čita SADRŽAJ podataka (user_state.data, isti JSON koji app čuva),
   i iz njega se IZVLAČI: poslednji stvarno odrađen trening (log status=done,
   po ts polju — datum kad je STVARNO trčano, ne planiran dan), km ove
   nedelje, poslednji Strava sync. Direktan signal, ne posredan.

   AI korišćenje se čita iz DVA izvora i uzima se kasniji: `log[*].aiAt` u
   user_state (app ga upisuje pri svakom preuzetom rezultatu, za svakog
   korisnika, i nikad ga ne briše) i `api_usage` tabela (brojač dnevnog
   limita). Sam `api_usage` nije bio dovoljan: vlasniku se dnevni limit ne
   naplaćuje, pa mu je kolona stajala zamrznuta na poslednjem danu pre nego
   što je taj izuzetak uveden — analize su radile, izveštaj o njima nije znao.

   TOK:
   1) Vercel poziva ovu putanju, CRON_SECRET provera (nepromenjeno).
   2) app_stats pogled — samo tri broja: ukupno korisnika, novih za 7 dana i
      sa generisanim planom. Brojevi „Aktivnih" se VIŠE NE ČITAJU odatle nego
      se računaju ovde (v. agregatAktivnosti).
   3) SIROV user_state.data za SVAKOG korisnika — service_role zaobilazi RLS
      namerno, ovo je jedino mesto gde taj ključ sme da postoji.
   4) api_usage dani sa pozivima > 0, po korisniku — za "poslednja AI analiza".
   5) endpoint_usage dani, po korisniku — nezavisan zapis o korišćenju, jedini
      koji preživi neuspelu sinhronizaciju stanja.
   6) Lista naloga (email) preko Admin API-ja — kao pre.
   7) Sve se spaja po user_id u JEDNU tabelu po korisniku. Svaki od koraka
      2-6 je u SOPSTVENOM try/catch — ako neki padne, ostali podaci i dalje
      stižu, samo se to polje prikaže kao nepoznato („—", ne nula).
   8) Mejl preko Resend-a.

   POTREBNE Vercel Environment Variables — NEPROMENJENO od ranije verzije:
   CRON_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY,
   REPORT_TO, REPORT_FROM. */

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
const IZLAZNI_ROK_MS = 15000;
function fetchRok(ulaz, opcije, ms) {
  const o = Object.assign({}, opcije || {});
  if (!o.signal) {
    try { o.signal = AbortSignal.timeout(ms > 0 ? ms : IZLAZNI_ROK_MS); } catch (e) { /* stariji Node — bez roka, kao pre */ }
  }
  return fetch(ulaz, o);
}


function checkCron(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const h = req.headers.authorization || req.headers.Authorization || '';
  const want = 'Bearer ' + secret;
  if (h.length !== want.length) return false;
  let diff = 0;
  for (let i = 0; i < h.length; i++) diff |= h.charCodeAt(i) ^ want.charCodeAt(i);
  return diff === 0;
}

async function fetchStats(url, key) {
  const r = await fetchRok(url.replace(/\/+$/, '') + '/rest/v1/app_stats?select=*', {
    headers: { apikey: key, Authorization: 'Bearer ' + key }
  });
  if (!r.ok) throw new Error('app_stats upit nije uspeo (' + r.status + ')');
  const rows = await r.json();
  return (rows && rows[0]) || {};
}

/* PAGINIRANO. Ranije je ovo bio JEDAN upit bez limita, a `data` je CEO JSON
   blob stanja svakog korisnika (plan, dnevnik, VDOT istorija, perKm nizovi po
   treningu, wellness mapa — lako 200-500 KB po aktivnom korisniku). Dva
   problema: sve to je odjednom ulazilo u memoriju funkcije, i — tise, pa gore —
   PostgREST ima podrazumevani `max-rows`, pa bi preko te granice korisnici
   TIHO ispadali iz izvestaja bez ikakvog traga da lista nije potpuna.
   Ista klasa greske je vec ispravljena za Admin API listu (fetchUserList);
   ovaj upit je tada promasen.

   PAGINACIJA JE RESILA `max-rows`, ALI NE I MEMORIJU. Redovi su i dalje svi
   zavrsavali u jednom nizu — 50 strana × 200 redova × do 500 KB je red
   velicine sto megabajta u funkciji koja ima 60 s i megabajt-dva rezerve po
   redu. Prvi korisnik preko te granice obara CEO izvestaj, i to greskom koja
   ne kaze zasto (OOM, ne HTTP status).
   Zato se svaka strana SAZIMA cim stigne, pa se sirovi blob baca. Iz njega
   izvestaju ionako treba pet izvedenih brojeva — oko dvesta bajta po
   korisniku umesto pola megabajta. Merenje na realnom stanju (70 treninga sa
   perKm i laps nizovima, 180 dana oporavka): 453 KB -> ~200 B.

   Izvlacenje po redu je u SOPSTVENOM try/catch (isti razlog kao u mergeRows):
   `data` je u potpunosti pod kontrolom korisnika, pa jedan pokvaren zapis ne
   sme da obori citanje cele strane. */
const PRAZNA_AKTIVNOST = {
  lastWorkoutDate: null, weekKm: 0, lastStravaSync: null,
  stravaConnected: false, stravaAthlete: null, lastAiDay: null, upisDan: null, trcanja: []
};

async function fetchRawUserState(url, key, todayStr) {
  const PER = 200, MAX_PAGES = 50, sazeto = {};
  for (let page = 0; page < MAX_PAGES; page++) {
    const od = page * PER, doIdx = od + PER - 1;
    const r = await fetchRok(url.replace(/\/+$/, '') + '/rest/v1/user_state?select=user_id,data,updated_at&order=user_id.asc', {
      headers: {
        apikey: key, Authorization: 'Bearer ' + key,
        Range: od + '-' + doIdx, 'Range-Unit': 'items'
      }
    });
    if (!r.ok && r.status !== 206) throw new Error('user_state upit nije uspeo (' + r.status + ')');
    const j = await r.json();
    const red = Array.isArray(j) ? j : [];
    for (const row of red) {
      /* `updated_at` piše Postgres, ne korisnik — pa se čita izvan izvlačenja
         iz `data` i preživljava pokvaren blob. */
      const upisDan = danBeograd(Date.parse(row.updated_at));
      try { sazeto[row.user_id] = Object.assign(deriveActivity(row.data, todayStr), { upisDan }); }
      catch (e) { sazeto[row.user_id] = Object.assign({}, PRAZNA_AKTIVNOST, { upisDan }); }
    }
    if (red.length < PER) break;   /* `red` izlazi iz opsega ovde — blob se oslobađa */
  }
  return sazeto;
}

/* POSLEDNJI DAN PO KORISNIKU, iz bilo kog dnevnog brojača.
   `api_usage` i `endpoint_usage` su istog oblika (user_id, dan, broj) i čitaju
   se istom petljom; razlikuju se samo imena tabele i kolone.

   PAGINIRANO, iz istog razloga kao fetchUserList i fetchRawUserState. Ovaj
   upit je pri toj ispravci promašen — a raste BRŽE od oba: jedan red po
   korisniku PO DANU (za `endpoint_usage` još i po endpointu). Bez `Range`
   zaglavlja PostgREST vraća do `max-rows` (podrazumevano 1000) i tu staje, bez
   greške; korisnici sa starijim danima na vrhu tako tiho ispadaju.
   Silazni redosled po danu je uslov za tačnost: prvi viđen red po korisniku je
   i najnoviji, pa se ostali smeju preskočiti. Redosled mora biti određen i
   preko granica strana — zato i drugi kriterijum (`user_id`). */
async function fetchPoslednjiDan(url, key, tabela, kolona, filter) {
  const PER = 1000, MAX_PAGES = 50, lastByUser = {};
  for (let page = 0; page < MAX_PAGES; page++) {
    const od = page * PER, doIdx = od + PER - 1;
    const r = await fetchRok(url.replace(/\/+$/, '') + '/rest/v1/' + tabela
      + '?select=user_id,' + kolona + '&' + filter
      + '&order=' + kolona + '.desc,user_id.asc', {
      headers: {
        apikey: key, Authorization: 'Bearer ' + key,
        Range: od + '-' + doIdx, 'Range-Unit': 'items'
      }
    });
    if (!r.ok && r.status !== 206) throw new Error(tabela + ' upit nije uspeo (' + r.status + ')');
    const j = await r.json();
    const rows = Array.isArray(j) ? j : [];
    for (const row of rows) {
      if (!(row.user_id in lastByUser)) lastByUser[row.user_id] = row[kolona];
    }
    if (rows.length < PER) break;
  }
  return lastByUser;
}

const fetchAiUsageDays  = (url, key) => fetchPoslednjiDan(url, key, 'api_usage', 'day', 'calls=gt.0');
/* `endpoint_usage` čuva 30 dana (v. `check_and_bump_endpoint`) — tačno koliko
   najširi prozor u izveštaju i traži. */
const fetchEndpointDays = (url, key) => fetchPoslednjiDan(url, key, 'endpoint_usage', 'dan', 'broj=gt.0');

/* SVE STRANE JEDNOG UPITA. Isti razlog kao gore: bez `Range` PostgREST staje
   na `max-rows` bez greške. */
async function fetchSveStrane(url, key, putanja, PER = 1000, MAX_PAGES = 50) {
  const out = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const od = page * PER;
    const r = await fetchRok(url.replace(/\/+$/, '') + '/rest/v1/' + putanja, {
      headers: { apikey: key, Authorization: 'Bearer ' + key, Range: od + '-' + (od + PER - 1), 'Range-Unit': 'items' }
    });
    if (!r.ok && r.status !== 206) throw new Error(putanja.split('?')[0] + ' upit nije uspeo (' + r.status + ')');
    const j = await r.json();
    const rows = Array.isArray(j) ? j : [];
    out.push(...rows);
    if (rows.length < PER) break;
  }
  return out;
}

/* Jedan red po nalogu sa statusom i kandidatom za brisanje (v.
   supabase/migrations/…_korisnik_aktivnost.sql). Pravila „ko trenira" i „ko je
   kandidat" žive u bazi, na jednom mestu — izveštaj ih samo prikazuje. */
const fetchAktivnost = (url, key) =>
  fetchSveStrane(url, key, 'admin_aktivnost?select=*&order=registrovan.asc,user_id.asc');

/* Otvaranja i sinhronizacije u poslednjih 42 dana — za „aktivnih po danu",
   kalendar od 5 nedelja i poređenje sa prethodnom nedeljom. */
const fetchDogadjaji = (url, key, odIso) =>
  fetchSveStrane(url, key, 'korisnik_dogadjaj?select=user_id,vrsta,napravljeno,app_version,meta'
    + '&vrsta=in.(otvaranje,sinhronizacija,nov_plan)'
    + '&napravljeno=gte.' + encodeURIComponent(odIso) + '&order=napravljeno.asc,id.asc');

/* Admin API vraca najvise per_page po strani. Ranije se citala SAMO prva strana
   (per_page=200) — preko toga su korisnici tiho ispadali iz izvestaja, bez
   ikakvog traga da lista nije potpuna. Sada se strane citaju dok ima podataka. */
async function fetchUserList(url, key) {
  const PER = 200, MAX_PAGES = 25;   /* gornja granica da greska na serveru ne napravi beskonacnu petlju */
  const out = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const r = await fetchRok(url.replace(/\/+$/, '') + '/auth/v1/admin/users?per_page=' + PER + '&page=' + page, {
      headers: { apikey: key, Authorization: 'Bearer ' + key }
    });
    if (!r.ok) throw new Error('lista korisnika nije uspela (' + r.status + ')');
    const j = await r.json();
    const users = Array.isArray(j) ? j : (Array.isArray(j.users) ? j.users : []);
    out.push(...users);
    if (users.length < PER) break;
  }
  return out.map(u => ({
    id: u.id,
    email: u.email || '(bez email-a)',
    created: u.created_at || null,
    lastSignIn: u.last_sign_in_at || null
  }));
}

function danMinus(ymd, n) {
  const d = new Date(ymd + 'T00:00:00Z');
  if (isNaN(d.getTime())) return null;
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

/* ============================================================
   KOLIKO IH JE AKTIVNO — RAČUNA SE OVDE, NE U `app_stats`

   Pogled `app_stats` broji aktivnost isključivo kroz `user_state.updated_at`,
   dakle kroz POSLEDNJI USPEŠAN UPIS STANJA. Kad ta jedna sinhronizacija ne
   uspe (token istekao baš tada, aplikacija zatvorena pre odloženog upisa —
   sync je odložen 4 s posle svakog save()), čovek je koristio aplikaciju a u
   izveštaju ispada neaktivan.

   ČITANJE SADRŽAJA `data` TO NE POPRAVLJA, i važno je zašto: sve u `data`
   stiže na server ISTIM tim upisom, pa nijedno polje unutra ne može biti
   novije od `updated_at`. Popravka mora doći iz izvora koji se piše DRUGIM
   putem.
   Takva dva postoje i već su u bazi: `api_usage` (RPC pri svakoj AI analizi)
   i `endpoint_usage` (RPC pri sinhronizaciji sa intervals.icu, osvežavanju
   Strava tokena, čitanju rezultata analize…). Oba se upisuju direktno iz
   servera, nezavisno od toga da li je stanje uspelo da se sačuva.

   PROZORI SU DANI, NE SATI. Oba brojača pamte DAN (beogradski, v.
   `check_and_bump_endpoint`), ne trenutak — pa je „aktivnih u 24 sata"
   preciznost koju izvor ne nosi. Zaglavlje zato kaže „danas", „7 dana",
   „30 dana", i to je tačno ono što se meri.
   ============================================================ */
function agregatAktivnosti(sazeta, endpointDani, aiDani, danasStr) {
  const svi = new Set([].concat(
    Object.keys(sazeta || {}), Object.keys(endpointDani || {}), Object.keys(aiDani || {})
  ));
  const prag7 = danMinus(danasStr, 6), prag30 = danMinus(danasStr, 29);
  const out = { danas: 0, d7: 0, d30: 0 };
  for (const id of svi) {
    const zadnji = [
      (sazeta && sazeta[id] && sazeta[id].upisDan) || null,
      (endpointDani && endpointDani[id]) || null,
      (aiDani && aiDani[id]) || null
    ].filter(x => typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x)).sort().pop();
    if (!zadnji) continue;
    if (zadnji >= prag30) out.d30++;
    if (zadnji >= prag7) out.d7++;
    if (zadnji >= danasStr) out.danas++;
  }
  return out;
}

function mondayOfWeekUTC(dateStr) {
  const d = new Date(dateStr + 'T00:00:00Z');
  const wd = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - wd);
  return d.toISOString().slice(0, 10);
}

/* KOG JE DANA TRENING STVARNO ODRAĐEN — prepisano iz `danTreninga()` u app.js,
   uz isti redosled izvora: pravi datum sa sata (`runDate`), pa ručno uneti
   (`ts`), pa ništa. Trećeg izvora koji app ima (planski `d.date`) ovde nema,
   jer izveštaj ne čita plan.

   ZAŠTO NIJE SVEJEDNO. Na obe putanje sinhronizacije (`Strava` i `intervals.icu`)
   `l.runDate` se upisuje IZVAN `if(!l.lock)` bloka, a `l.ts` unutar njega — pa
   kod ručno ispravljenog unosa (`lock`) `ts` ostaje PLANSKI dan, a jedino
   `runDate` zna kad se stvarno trčalo. Izveštaj je do sada gledao samo `ts` i
   time prikazivao dan iz plana kao „poslednji trening".

   Oblik se proverava iz istog razloga kao u app.js: u starijim zapisima `ts`
   ume da bude epoch, a `'1785834000' >= '2026-09-01'` je poređenje koje uvek
   laže. */
function danTreninga(e) {
  const k = [e && e.runDate, e && e.ts]
    .find(x => typeof x === 'string' && /^\d{4}-\d{2}-\d{2}/.test(x));
  return k ? k.slice(0, 10) : null;
}

/* DAN U BEOGRADU, ne u UTC-u. `l.aiAt` je epoch u milisekundama, a poredi se i
   spaja sa `api_usage.day` — koji Postgres računa kao
   `(now() at time zone 'Europe/Belgrade')::date`. Analiza u 01:30 po Beogradu
   je u UTC-u još prethodni dan; bez ovoga bi se ista analiza u dva izvora
   vodila pod dva različita datuma. */
function danBeograd(ms) {
  if (typeof ms !== 'number' || !isFinite(ms) || ms <= 0) return null;
  const d = new Date(ms);
  if (isNaN(d.getTime())) return null;
  try {
    return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Belgrade' }).format(d);
  } catch (e) {
    return d.toISOString().slice(0, 10);   /* Node bez pune ICU baze — UTC je bolji od ničega */
  }
}

function deriveActivity(data, todayStr) {
  const log = (data && data.log) || {};
  const sviUnosi = Object.values(log).filter(e => e && typeof e === 'object');
  const entries = sviUnosi.filter(e => e.status === 'done');

  let lastWorkout = null;
  for (const e of entries) {
    const d = danTreninga(e);
    if (d && (!lastWorkout || d > lastWorkout.date)) {
      lastWorkout = { date: d, km: typeof e.km === 'number' ? e.km : null };
    }
  }

  const monday = mondayOfWeekUTC(todayStr);
  let weekKm = 0;
  for (const e of entries) {
    const d = danTreninga(e);
    if (d && d >= monday && d <= todayStr && typeof e.km === 'number') {
      weekKm += e.km;
    }
  }

  /* POSLEDNJA AI ANALIZA — IZ STANJA, ne samo iz brojača.
     `api_usage` je bio jedini izvor, i zato je kolona umela da stoji zamrznuta
     mesecima: brojač se NE pomera vlasniku (v. `jeVlasnik` u api/analyze.js),
     pa za njega u toj tabeli posle uvođenja izuzetka nema nijednog reda.
     `l.aiAt` upisuje sam app pri svakom preuzetom rezultatu (v. `aiProveri`),
     za SVAKOG korisnika, i nikad se ne briše — dakle direktan zapis, i to
     unazad. Brojač ostaje drugi izvor (hvata i pokrenute analize čiji rezultat
     korisnik nikad nije pokupio); u izveštaj ide kasniji od ta dva. */
  let lastAiDay = null;
  for (const e of sviUnosi) {
    const dan = danBeograd(e.aiAt);
    if (dan && (!lastAiDay || dan > lastAiDay)) lastAiDay = dan;
  }

  /* `data` je U POTPUNOSTI pod kontrolom korisnika (sbPush gura proizvoljan
     JSON, RLS proverava samo vlasnistvo reda, ne sadrzaj). `new Date(smece)`
     je Invalid Date, a `.toISOString()` NAD NJIM baca RangeError — koji je, dok
     se deriveActivity zvao IZVAN try/catch-a, obarao ceo izvestaj: jedan
     korisnik sa `strava.lastSync:"nije-datum"` gasio je mejl ZA SVE. Poziv je
     danas u try/catch-u (v. fetchRawUserState), ali bezbedan parse ostaje —
     dve odbrane, jer je cena jedna linija a ispad je bio potpun. */
  const sinhro = (data && data.strava && data.strava.lastSync)
    ? new Date(data.strava.lastSync) : null;
  const lastStravaSync = (sinhro && !isNaN(sinhro.getTime())) ? sinhro.toISOString() : null;
  /* "Povezan" = objekat postoji uopšte (OAuth uspešno završen bar jednom),
     ne da li je TRENUTNI token još važeći — to bi tražilo živ poziv ka
     Stravi, nepotrebno za ovaj izveštaj. */
  const stravaConnected = !!(data && data.strava);
  const stravaAthlete = (data && data.strava && data.strava.athlete) || null;

  /* TRENINZI U POSLEDNJIH 63 DANA (dan + km) — za grafikone po danu (30 dana)
     i po nedelji (8 nedelja od ponedeljka unazad staje u 63 dana).
     Jedan unos po treningu (dva treninga istog dana su dva unosa). Izvori su
     isti kao u pogledu `admin_aktivnost`: odrađen dan iz plana i trčanje van
     plana. Granica pre registracije se primenjuje tek u izveštaju, jer se ovde
     ne zna kad je nalog otvoren. */
  const od63 = danMinus(todayStr, 62);
  const trcanja = [];
  const kmIli0 = v => (typeof v === 'number' && isFinite(v) && v > 0 && v < 400) ? v : 0;
  for (const e of entries) {
    const d = danTreninga(e);
    if (d && d >= od63 && d <= todayStr) trcanja.push({ d, km: kmIli0(e.km) });
  }
  const van = data && data.vanPlana;
  if (van && typeof van === 'object' && !Array.isArray(van)) {
    for (const [d, km] of Object.entries(van)) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(d) && d >= od63 && d <= todayStr && kmIli0(km)) trcanja.push({ d, km: kmIli0(km) });
    }
  }

  return {
    lastWorkoutDate: lastWorkout ? lastWorkout.date : null,
    weekKm: Math.round(weekKm * 10) / 10,
    lastStravaSync,
    stravaConnected,
    stravaAthlete,
    lastAiDay,
    trcanja: trcanja.slice(0, 300)
  };
}

function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('sr-RS', { day: '2-digit', month: '2-digit', year: 'numeric' })
    + ' ' + d.toLocaleTimeString('sr-RS', { hour: '2-digit', minute: '2-digit' });
}
function fmtDateOnly(ymd) {
  if (!ymd) return '—';
  const parts = ymd.split('-');
  const y = parts[0], m = parts[1], d = parts[2];
  return d && m && y ? (d + '.' + m + '.' + y + '.') : '—';
}
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* `sazetaStanja` je mapa user_id -> vec izvedena aktivnost (v. fetchRawUserState).
   Ranije je ovde stajao sirov `data` blob i `deriveActivity` se zvao tek sad;
   izvlacenje je pomereno u citanje da bi se blob bacio odmah po strani. Odbrana
   po redu (try/catch oko korisnickog JSON-a) nije nestala nego je otisla sa
   njim — ovde ostaje samo podrazumevana vrednost za korisnika bez reda. */
function mergeRows(users, sazetaStanja, aiDays, todayStr) {
  const stanja = sazetaStanja || {};
  return (users || []).map(u => {
    const act = stanja[u.id] || PRAZNA_AKTIVNOST;
    return {
      id: u.id,
      email: u.email,
      created: u.created,
      trcanja: act.trcanja || [],
      lastSignIn: u.lastSignIn,
      lastWorkoutDate: act.lastWorkoutDate,
      weekKm: act.weekKm,
      lastStravaSync: act.lastStravaSync,
      stravaConnected: act.stravaConnected,
      stravaAthlete: act.stravaAthlete,
      /* Kasniji od dva izvora, v. obrazloženje u deriveActivity. Oba su
         'GGGG-MM-DD', pa je poređenje niski ispravno. */
      lastAiDay: [act.lastAiDay, (aiDays && aiDays[u.id]) || null]
        .filter(x => typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x))
        .sort()
        .pop() || null
    };
  });
}

/* ============================================================
   IZGLED MEJLA — U JEZIKU APLIKACIJE („Quiet Athlete")

   Isti sistem kao web/src/styles/tokens.css i docs/redesign/QUIET_ATHLETE.md:
   svetla podloga, ravne površine bez kartica, senki i gradijenata; odeljci
   razdvojeni razmakom i tankom linijom; jedan veliki broj tankim slovima uz
   manju jedinicu; oznake verzalom sa razmakom 0,08 em; zelena kao jedina boja
   marke, a kategorije su tonovi zelene — uvek uz naziv i broj, jer boja nikad
   sama ne nosi značenje. Stanje „loše" (kandidati) ide uz reč, kao u aplikaciji.

   Tehniku diktiraju mejl klijenti: Gmail (i aplikacija na iPhone-u) izbacuje
   <style>, SVG i JavaScript, pa je sve tabela sa INLINE stilom — trake su
   ćelije zadate širinom u procentima, stubići su <div> zadate visine u ćeliji
   poravnatoj na dno. Svaki grafikon nosi i brojeve kao tekst.
   ============================================================ */
const T = { /* vrednosti iz web/src/styles/tokens.css, svetla tema */
  bg: '#f6f7f5', surface2: '#edf0eb', sel: '#e6eee5', line: '#e0e5de',
  text: '#19251e', text2: '#46554b', text3: '#5c6b61', accent: '#335e35',
  base: '#7ca07f', build: '#4f8056', bad: '#a3322a'
};
const FONT = "Figtree,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif";
const NUM = 'font-variant-numeric:tabular-nums';
const LBL = `font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:${T.text3}`;

/* Redosled je i redosled u traci i legendi. Tonovi jedne boje (kao faze u
   aplikaciji), neaktivni neutralno sivi, označeni u boji stanja „loše". */
const STATUSI = [
  { k: 'trci',                naziv: 'Trenira', opis: 'trening u 14 dana', boja: T.accent },
  { k: 'otvara_ne_trci',      naziv: 'Otvara, ne trenira', opis: 'aktivan bez treninga', boja: T.base },
  { k: 'nov',                 naziv: 'Nov nalog', opis: 'mlađi od 7 dana', boja: '#b3c8b0' },
  { k: 'neaktivan',           naziv: 'Neaktivan', opis: '14+ dana bez traga', boja: '#d3d8d0' },
  { k: 'oznacen_za_brisanje', naziv: 'Označen za brisanje', opis: 'čeka rok', boja: T.bad }
];
const STATUS_PO_KLJUCU = Object.fromEntries(STATUSI.map(s => [s.k, s]));

const procenat = (a, b) => (b > 0 && isFinite(a)) ? Math.round(a * 100 / b) : 0;
const ceo = v => (typeof v === 'number' && isFinite(v)) ? v : (Number.isFinite(+v) ? +v : 0);
/* Decimalni zarez, kao u aplikaciji (26,5 km). */
const decimal = v => { const r = Math.round(ceo(v) * 10) / 10; return (Number.isInteger(r) ? String(r) : r.toFixed(1)).replace('.', ','); };
const kratakDan = ymd => (typeof ymd === 'string' && /^\d{4}-\d{2}-\d{2}/.test(ymd))
  ? ymd.slice(8, 10) + '.' + ymd.slice(5, 7) + '.' : '';
const danIz = v => (typeof v === 'string' && v) ? danBeograd(Date.parse(v)) : null;
const razlikaDana = (od, doDana) => Math.round((Date.parse(doDana + 'T00:00:00Z') - Date.parse(od + 'T00:00:00Z')) / 86400000);

function poslednjihDana(todayStr, n) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) out.push(danMinus(todayStr, i));
  return out;
}

/* Linearna mešavina dve boje — sekvencijalna skala jedne boje za kalendar i kohorte. */
function mesaj(a, b, t) {
  const p = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const x = p(a), y = p(b), k = Math.max(0, Math.min(1, t));
  return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * k).toString(16).padStart(2, '0')).join('');
}
const skala = t => mesaj('#dbe6d8', T.accent, t);

/* Odeljak kao `Section` u aplikaciji: naslov + podatak desno, bez kartice. */
function odeljak(naslov, desno, podnaslov, telo) {
  return `<tr><td style="padding:26px 0 0;border-top:1px solid ${T.line}">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td style="font-size:20px;font-weight:700;color:${T.text};letter-spacing:-.01em">${esc(naslov)}</td>
      ${desno ? `<td align="right" valign="bottom" style="${LBL};white-space:nowrap">${esc(desno)}</td>` : ''}
    </tr></table>
    ${podnaslov ? `<div style="font-size:14px;color:${T.text2};margin-top:4px;line-height:1.45">${esc(podnaslov)}</div>` : ''}
    <div style="padding:18px 0 28px">${telo}</div>
  </td></tr>`;
}

const napomena = t => `<div style="font-size:13px;color:${T.text3};line-height:1.5;margin-top:8px">${esc(t)}</div>`;

/* Promena prema prethodnom periodu — reč i znak, ne samo boja. */
function promena(sada, pre, jedinica) {
  const r = sada - pre;
  if (!r) return { tekst: 'isto kao prethodnih 7 dana', boja: T.text3 };
  return { tekst: (r > 0 ? '+' : '−') + Math.abs(r) + ' ' + jedinica + ' prema prethodnih 7 dana', boja: r > 0 ? T.accent : T.bad };
}

/* Mreža 2×2 kao „Polazni VDOT | Procena" u Napretku: broj tankim slovima, tanke linije. */
function mrezaBrojeva(polja) {
  const td = (p, i) => `<td width="50%" align="center" valign="top" style="padding:18px 6px;${i % 2 === 0 ? 'border-right:1px solid ' + T.line + ';' : ''}">
      <div style="font-size:14px;color:${T.text2}">${esc(p.naziv)}</div>
      <div style="font-size:40px;font-weight:300;color:${T.text};line-height:1.15;margin-top:4px;${NUM}">${esc(p.vrednost)}</div>
      <div style="font-size:12px;color:${p.boja || T.text3};margin-top:4px;line-height:1.35">${esc(p.dodatak || '')}</div></td>`;
  const redovi = [];
  for (let i = 0; i < polja.length; i += 2) {
    redovi.push(`<tr>${polja.slice(i, i + 2).map((p, j) => td(p, j)).join('')}</tr>`);
  }
  return `<table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid ${T.line};border-bottom:1px solid ${T.line};table-layout:fixed">${redovi.join(`<tr><td colspan="2" style="border-top:1px solid ${T.line};font-size:0;line-height:0">&nbsp;</td></tr>`)}</table>`;
}

/* Složena traka do 100% sa razmakom od 2 px i legendom (naziv, broj, udeo). */
function slozenaTraka(delovi) {
  const ukupno = delovi.reduce((s, d) => s + d.vrednost, 0);
  if (!ukupno) return napomena('Nema podataka.');
  const vidljivi = delovi.filter(d => d.vrednost > 0);
  const traka = vidljivi.map((d, i) => {
    const r = vidljivi.length === 1 ? '6px' : i === 0 ? '6px 0 0 6px' : i === vidljivi.length - 1 ? '0 6px 6px 0' : '0';
    return `<td width="${Math.max(2, d.vrednost * 100 / ukupno).toFixed(2)}%" style="background:${d.boja};height:14px;border-radius:${r};${i ? 'border-left:2px solid ' + T.bg + ';' : ''}font-size:0;line-height:0">&nbsp;</td>`;
  }).join('');
  const legenda = delovi.map(d => `<tr>
      <td width="18" style="padding:7px 0;border-bottom:1px solid ${T.line}"><div style="width:10px;height:10px;border-radius:3px;background:${d.boja}"></div></td>
      <td style="padding:7px 0;border-bottom:1px solid ${T.line};font-size:15px;color:${T.text}">${esc(d.naziv)} <span style="font-size:13px;color:${T.text3}">${esc(d.opis || '')}</span></td>
      <td align="right" style="padding:7px 0;border-bottom:1px solid ${T.line};font-size:15px;font-weight:700;color:${T.text};${NUM}">${d.vrednost}</td>
      <td align="right" width="48" style="padding:7px 0;border-bottom:1px solid ${T.line};font-size:13px;color:${T.text3};${NUM}">${procenat(d.vrednost, ukupno)}%</td>
    </tr>`).join('');
  return `<table width="100%" cellpadding="0" cellspacing="0" style="table-layout:fixed"><tr>${traka}</tr></table>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:14px">${legenda}</table>`;
}

/* Vodoravne trake (zajednička skala `max`) — red spiska sa trakom ispod naslova. */
function trake(redovi, max, boja) {
  const m = max || Math.max(1, ...redovi.map(r => r.vrednost));
  return `<table width="100%" cellpadding="0" cellspacing="0">${redovi.map(r => {
    const w = m ? Math.min(100, r.vrednost * 100 / m) : 0;
    return `<tr><td style="padding:9px 0 10px;border-bottom:1px solid ${T.line}"><table width="100%" cellpadding="0" cellspacing="0"><tr><td style="font-size:15px;color:${T.text}">${esc(r.naziv)}${r.opis ? `<br><span style="font-size:13px;color:${T.text3}">${esc(r.opis)}</span>` : ''}</td><td align="right" valign="top" style="font-size:13px;color:${T.text3};white-space:nowrap"><b style="font-size:15px;color:${T.text}">${esc(r.oznaka != null ? r.oznaka : r.vrednost)}</b>${r.dodatak ? ' ' + esc(r.dodatak) : ''}</td></tr></table><table width="100%" cellpadding="0" cellspacing="0" style="margin-top:7px;background:${T.surface2};border-radius:4px"><tr>${w > 0 ? `<td width="${Math.max(1.5, w).toFixed(1)}%" style="background:${r.boja || boja};height:8px;border-radius:4px;font-size:0;line-height:0">&nbsp;</td>` : ''}<td style="height:8px;font-size:0;line-height:0">&nbsp;</td></tr></table></td></tr>`;
  }).join('')}</table>`;
}

/* Stubići kroz vreme. Istaknut stub (danas / tekuća nedelja) je tamnozelen,
   ostali svetliji ton. Brojevi stoje nad stubovima iz `oznaciVrednost`. */
function stubici(tacke, o) {
  const H = o.visina || 96;
  const max = Math.max(0, ...tacke.map(t => t.vrednost));
  if (!max) return napomena(o.prazno || 'Nijedan zapis u ovom periodu.');
  const iMax = tacke.findIndex(t => t.vrednost === max);
  const sviBrojevi = tacke.length <= 10;
  const kolone = tacke.map((t, i) => {
    const h = t.vrednost ? Math.max(3, Math.round(t.vrednost * H / max)) : 0;
    const istaknut = i === tacke.length - 1;
    const broj = t.vrednost && (sviBrojevi || i === iMax || istaknut)
      ? `<div style="font-size:${sviBrojevi ? 12 : 10}px;font-weight:600;color:${T.text};text-align:center;padding-bottom:3px;${NUM}">${esc(o.format ? o.format(t.vrednost) : t.vrednost)}</div>` : '';
    return `<td valign="bottom" style="padding:0 ${sviBrojevi ? 5 : 1}px${i === 0 ? ';height:' + (H + 18) + 'px' : ''}">${broj}${h ? `<div style="height:${h}px;background:${istaknut ? T.accent : (o.boja || T.base)};border-radius:3px 3px 0 0;font-size:0;line-height:0">&nbsp;</div>` : ''}</td>`;
  }).join('');
  const oznake = tacke.map(t => t.oznaka
    ? `<td align="center" style="padding-top:6px;font-size:11px;color:${T.text3};white-space:nowrap">${esc(t.oznaka)}</td>` : '<td></td>').join('');
  return `<table width="100%" cellpadding="0" cellspacing="0" style="table-layout:fixed"><tr>${kolone}</tr><tr><td colspan="${tacke.length}" style="border-top:1px solid ${T.line};font-size:0;line-height:0">&nbsp;</td></tr><tr>${oznake}</tr></table>`;
}

/* Kalendar aktivnosti: 5 nedelja × 7 dana, kao nedeljna traka u aplikaciji
   (P U S Č P S N). Broj u ćeliji = različiti aktivni korisnici tog dana;
   jačina zelene je ista informacija, ne jedina. Danas je uokviren. */
function kalendar(poDanu, todayStr) {
  const pon = mondayOfWeekUTC(todayStr);
  const start = danMinus(pon, 28);
  const max = Math.max(1, ...[...poDanu.values()]);
  const zaglavlje = ['P', 'U', 'S', 'Č', 'P', 'S', 'N'].map(x =>
    `<td align="center" style="padding:0 0 8px;font-size:13px;color:${T.text3}">${x}</td>`).join('');
  const redovi = [];
  for (let w = 0; w < 5; w++) {
    const prvi = danMinus(start, -7 * w);
    let celije = `<td width="44" style="font-size:11px;font-weight:400;text-align:left;color:${T.text3};white-space:nowrap;padding-right:4px">${esc(kratakDan(prvi))}</td>`;
    for (let d = 0; d < 7; d++) {
      const dan = danMinus(start, -(7 * w + d));
      const buduci = dan > todayStr;
      const n = buduci ? 0 : (poDanu.get(dan) || 0);
      const t = n / max;
      const bg = buduci ? 'transparent' : (n ? skala(t) : T.surface2);
      const boja = n && t > .5 ? 'color:#ffffff;' : '';
      const okvir = dan === todayStr ? `border:2px solid ${T.text};height:28px;line-height:28px;` : 'height:32px;line-height:32px;';
      celije += `<td style="padding:2px"><div style="${okvir}border-radius:8px;background:${bg};${boja}">${buduci ? '' : (n || '')}</div></td>`;
    }
    redovi.push(`<tr style="font-size:13px;font-weight:600;text-align:center">${celije}</tr>`);
  }
  const legenda = [0, .25, .5, .75, 1].map(t =>
    `<td style="padding:0 2px"><div style="width:18px;height:10px;border-radius:3px;background:${t ? skala(t) : T.surface2}"></div></td>`).join('');
  return `<table width="100%" cellpadding="0" cellspacing="0" style="table-layout:fixed"><tr><td width="44"></td>${zaglavlje}</tr>${redovi.join('')}</table>
    <table cellpadding="0" cellspacing="0" style="margin-top:10px"><tr><td style="font-size:12px;color:${T.text3};padding-right:6px">manje</td>${legenda}<td style="font-size:12px;color:${T.text3};padding-left:6px">više · najviše ${max} dnevno</td></tr></table>`;
}

/* Kohorte po nedelji registracije: koliko njih je napravilo plan, odradilo
   trening i trenira sada. Ćelija nosi procenat i broj; boja je ista skala. */
function kohorte(akt, todayStr) {
  const grupe = new Map();
  const pon = mondayOfWeekUTC(todayStr);
  const granica = danMinus(pon, 35);
  for (const x of akt) {
    const reg = danIz(x.registrovan);
    if (!reg) continue;
    const k = reg >= granica ? mondayOfWeekUTC(reg) : 'ranije';
    if (!grupe.has(k)) grupe.set(k, { n: 0, plan: 0, trening: 0, trci: 0 });
    const g = grupe.get(k);
    g.n++;
    if (x.ima_plan === true || ceo(x.planova_napravljeno) > 0) g.plan++;
    if (ceo(x.treninga) > 0) g.trening++;
    if (x.status === 'trci') g.trci++;
  }
  if (!grupe.size) return napomena('Nema naloga.');
  const kljucevi = [...grupe.keys()].filter(k => k !== 'ranije').sort().reverse();
  if (grupe.has('ranije')) kljucevi.push('ranije');
  const th = t => `<td align="center" style="padding:0 2px 8px;font-size:12px;color:${T.text3}">${t}</td>`;
  const celija = (v, n) => {
    const p = procenat(v, n), t = p / 100;
    return `<td style="padding:2px"><div style="border-radius:8px;background:${v ? skala(t) : T.surface2};color:${v && t > .5 ? '#ffffff' : T.text};text-align:center;padding:7px 0 6px;${NUM}"><div style="font-size:14px;font-weight:600">${p}%</div><div style="font-size:11px;opacity:.8">${v} od ${n}</div></div></td>`;
  };
  const redovi = kljucevi.map(k => {
    const g = grupe.get(k);
    const naziv = k === 'ranije' ? 'Ranije' : 'od ' + kratakDan(k);
    return `<tr><td style="font-size:13px;color:${T.text};padding-right:6px;white-space:nowrap">${esc(naziv)}<div style="font-size:11px;color:${T.text3}">${g.n} ${g.n === 1 ? 'nalog' : 'naloga'}</div></td>${celija(g.plan, g.n)}${celija(g.trening, g.n)}${celija(g.trci, g.n)}</tr>`;
  }).join('');
  return `<table width="100%" cellpadding="0" cellspacing="0" style="table-layout:fixed"><tr><td width="26%"></td>${th('Plan')}${th('Prvi trening')}${th('Trenira sada')}</tr>${redovi}</table>`;
}

/* Red spiska kao `Row` u aplikaciji: naslov, podnaslov, vrednost desno. */
const red = (naslov, podnaslov, vrednost, vrednostPod, bojaVrednosti) => `<tr><td style="padding:11px 0;border-bottom:1px solid ${T.line};font-size:13px;line-height:1.45;color:${T.text3};word-break:break-word"><b style="font-size:15px;font-weight:600;color:${T.text}">${naslov}</b>${podnaslov ? '<br>' + podnaslov : ''}</td><td align="right" valign="top" style="padding:11px 0 11px 10px;border-bottom:1px solid ${T.line};font-size:12px;line-height:1.5;color:${T.text3};white-space:nowrap"><b style="font-size:15px;color:${bojaVrednosti || T.text}">${vrednost}</b>${vrednostPod ? '<br>' + vrednostPod : ''}</td></tr>`;

function buildHtml(stats, rows, errors, brisanja, aktivni, dodatno) {
  const d = dodatno || {};
  const todayStr = d.todayStr || danBeograd(Date.now());
  const row = (label, val) =>
    `<tr><td style="padding:10px 0;color:${T.text2};font-size:15px;border-bottom:1px solid ${T.line}">${esc(label)}</td>` +
    `<td align="right" style="padding:10px 0;font-weight:700;font-size:15px;color:${T.text};border-bottom:1px solid ${T.line};${NUM}">${esc(val)}</td></tr>`;

  /* NULA KOJA ZNAČI „NISAM DOBIO BROJ" MORA DA SE RAZLIKUJE OD NULE.
     Bez ovoga bi izostanak jednog upita prikazao nule kao činjenicu — a to je
     gore od greške, jer izgleda kao da je aplikaciju preko noći napustio svako.
     Otkazuje POLJE PO POLJE, jer brojevi ne dolaze iz jednog izvora. */
  const broj = (v, palo) => (palo || v == null) ? '—' : v;
  /* „Aktivnih" se računa iz tri izvora (v. agregatAktivnosti); ako ijedan nije
     stigao, broj je poznato manji od stvarnog i ne sme se prikazati kao tačan. */
  const aktivnoPalo = !!(errors.rawState || errors.endpointUsage || errors.aiUsage);
  const a = aktivni || { danas: null, d7: null, d30: null };

  const akt = Array.isArray(d.aktivnost) ? d.aktivnost : [];
  const aktOk = !errors.aktivnost && akt.length > 0;
  const poId = new Map(akt.map(x => [x.user_id, x]));
  const N = aktOk ? akt.length : (rows.length || ceo(stats.korisnika));
  const imeZa = id => (poId.get(id) && poId.get(id).ime) || null;

  const poStatusu = {};
  for (const s of STATUSI) poStatusu[s.k] = 0;
  for (const x of akt) if (x.status in poStatusu) poStatusu[x.status]++;
  const kandidati = akt.filter(x => x.kandidat_za_brisanje === true)
    .sort((p, q) => ceo(q.dana_neaktivan) - ceo(p.dana_neaktivan));
  const novih7 = rows.filter(u => { const dd = danIz(u.created); return dd && dd >= danMinus(todayStr, 6); }).length;
  const novihPre = rows.filter(u => { const dd = danIz(u.created); return dd && dd >= danMinus(todayStr, 13) && dd < danMinus(todayStr, 6); }).length;

  /* ---------- aktivni po danu (otvaranja + sinhronizacije) ---------- */
  const dani42 = poslednjihDana(todayStr, 42);
  const aktivniPoDanu = new Map(dani42.map(x => [x, new Set()]));
  const platforma = new Map(), verzijaIzDogadjaja = new Map();
  for (const e of (d.dogadjaji || [])) {
    if (e.vrsta !== 'otvaranje' && e.vrsta !== 'sinhronizacija') continue;
    const dd = danIz(e.napravljeno);
    if (dd && aktivniPoDanu.has(dd)) aktivniPoDanu.get(dd).add(e.user_id);
    if (e.vrsta === 'otvaranje' && e.meta && typeof e.meta.platforma === 'string') platforma.set(e.user_id, e.meta.platforma);
    if (e.app_version) verzijaIzDogadjaja.set(e.user_id, String(e.app_version));
  }
  const brojPoDanu = new Map([...aktivniPoDanu].map(([k, v]) => [k, v.size]));
  const razlicitiU = (od, doIncl) => {
    const s = new Set();
    for (const [k, v] of aktivniPoDanu) if (k >= od && k <= doIncl) for (const u of v) s.add(u);
    return s.size;
  };
  const akt7 = razlicitiU(danMinus(todayStr, 6), todayStr);
  const aktPre7 = razlicitiU(danMinus(todayStr, 13), danMinus(todayStr, 7));

  /* ---------- treninzi: po danu, po nedelji, po korisniku ---------- */
  const dani30 = poslednjihDana(todayStr, 30);
  const kmPoDanu = new Map(dani30.map(x => [x, 0]));
  const brojTreningaPoDanu = new Map(dani30.map(x => [x, 0]));
  const ponedeljak = mondayOfWeekUTC(todayStr);
  const nedelje = [];
  for (let i = 7; i >= 0; i--) nedelje.push(danMinus(ponedeljak, i * 7));
  const kmPoNedelji = new Map(nedelje.map(x => [x, 0]));
  const kmPoKorisniku = new Map();
  let tren7 = 0, trenPre7 = 0;
  for (const u of rows) {
    const reg = danIz(u.created) || '0000-00-00';
    for (const t of (u.trcanja || [])) {
      if (!t || typeof t.d !== 'string' || t.d < reg) continue;
      if (brojTreningaPoDanu.has(t.d)) {
        brojTreningaPoDanu.set(t.d, brojTreningaPoDanu.get(t.d) + 1);
        kmPoDanu.set(t.d, kmPoDanu.get(t.d) + ceo(t.km));
        kmPoKorisniku.set(u.id, (kmPoKorisniku.get(u.id) || 0) + ceo(t.km));
      }
      const pon = mondayOfWeekUTC(t.d);
      if (kmPoNedelji.has(pon)) kmPoNedelji.set(pon, kmPoNedelji.get(pon) + ceo(t.km));
      if (t.d >= danMinus(todayStr, 6)) tren7++;
      else if (t.d >= danMinus(todayStr, 13)) trenPre7++;
    }
  }
  const treninga30 = [...brojTreningaPoDanu.values()].reduce((s, v) => s + v, 0);
  const km30 = [...kmPoDanu.values()].reduce((s, v) => s + v, 0);

  /* ---------- 1. ZAGLAVLJE + VELIKI BROJ ---------- */
  const datum = new Date().toLocaleDateString('sr-Latn-RS', { timeZone: 'Europe/Belgrade', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const sat = new Date().toLocaleTimeString('sr-Latn-RS', { timeZone: 'Europe/Belgrade', hour: '2-digit', minute: '2-digit' });
  const glava = `<tr><td style="padding:4px 0 22px">
      <table width="100%" cellpadding="0" cellspacing="0"><tr>
        <td style="font-size:26px;font-weight:800;letter-spacing:-.04em;color:${T.text}">sub20</td>
        <td align="right" style="${LBL}">Dnevni izveštaj</td>
      </tr></table>
      <div style="font-size:32px;font-weight:700;letter-spacing:-.02em;color:${T.text};margin-top:20px">Korisnici</div>
      <div style="font-size:16px;color:${T.text2};margin-top:4px">${esc(datum)} · stanje u ${esc(sat)}</div>
    </td></tr>`;
  const veliki = aktOk ? `<tr><td style="padding:6px 0 26px">
      <div style="color:${T.text};line-height:1"><span style="font-size:96px;font-weight:300;letter-spacing:-.04em;${NUM}">${poStatusu.trci}</span><span style="font-size:30px;color:${T.text2};padding-left:10px">od ${N}</span></div>
      <div style="font-size:15px;color:${T.text2};margin-top:12px">trenira — ${procenat(poStatusu.trci, N)}% registrovanih ima trening u poslednjih 14 dana</div>
      <div style="margin-top:22px">${slozenaTraka(STATUSI.map(s => ({ naziv: s.naziv, opis: s.opis, vrednost: poStatusu[s.k], boja: s.boja })))}</div>
    </td></tr>`
    : `<tr><td style="padding:6px 0 26px"><div style="font-size:20px;font-weight:700;color:${T.text}">Ko trenira, a ko ne</div>${napomena('Pogled admin_aktivnost nije učitan' + (errors.aktivnost ? ': ' + errors.aktivnost : '') + '. Ostali delovi izveštaja su tačni.')}</td></tr>`;
  /* Naslov „Ko trenira, a ko ne" stoji iznad trake i kad pogled stigne. */
  const veliki2 = aktOk ? veliki.replace('<tr><td style="padding:6px 0 26px">', `<tr><td style="padding:6px 0 26px"><div style="${LBL};margin-bottom:6px">Ko trenira, a ko ne</div>`) : veliki;

  const pA = promena(akt7, aktPre7, errors.dogadjaji ? '' : 'korisnika');
  const pT = promena(tren7, trenPre7, 'treninga');
  const pN = promena(novih7, novihPre, 'naloga');
  const mreza = `<tr><td style="padding:0 0 26px">${mrezaBrojeva([
    { naziv: 'Aktivno 7 dana', vrednost: errors.dogadjaji ? broj(a.d7, aktivnoPalo) : akt7, dodatak: errors.dogadjaji ? (aktivnoPalo ? 'nepotpuno' : procenat(ceo(a.d7), N) + '% registrovanih') : pA.tekst, boja: errors.dogadjaji ? null : pA.boja },
    { naziv: 'Treninga 7 dana', vrednost: errors.rawState ? '—' : tren7, dodatak: errors.rawState ? 'nije učitano' : pT.tekst, boja: errors.rawState ? null : pT.boja },
    { naziv: 'Novih naloga 7 dana', vrednost: errors.users ? '—' : novih7, dodatak: errors.users ? 'nije učitano' : pN.tekst, boja: errors.users ? null : pN.boja },
    { naziv: 'Za brisanje', vrednost: aktOk ? kandidati.length : '—', dodatak: aktOk ? (kandidati.length ? 'kandidata — spisak je dole' : 'nema kandidata') : 'nije učitano', boja: kandidati.length ? T.bad : null }
  ])}</td></tr>`;

  /* ---------- 2. UKRATKO (samo izračunate činjenice) ---------- */
  const sPlanom = akt.filter(x => x.ima_plan === true || ceo(x.planova_napravljeno) > 0).length;
  const saTreningom = akt.filter(x => ceo(x.treninga) > 0).length;
  const levak = [
    { naziv: 'Registrovani', vrednost: N },
    { naziv: 'Napravili plan', vrednost: sPlanom },
    { naziv: 'Bar jedan trening', vrednost: saTreningom },
    { naziv: 'Trenira sada', vrednost: poStatusu.trci }
  ];
  let najveciPad = null;
  for (let i = 1; i < levak.length; i++) {
    const pad = levak[i - 1].vrednost - levak[i].vrednost;
    if (!najveciPad || pad > najveciPad.pad) najveciPad = { pad, od: levak[i - 1], do: levak[i] };
  }
  const zakljucci = aktOk ? [
    `${poStatusu.trci} od ${N} registrovanih (${procenat(poStatusu.trci, N)}%) trenira — trening zabeležen u poslednjih 14 dana.`,
    `${N - poStatusu.trci} (${procenat(N - poStatusu.trci, N)}%) ne trenira: ${poStatusu.otvara_ne_trci} otvara aplikaciju bez treninga, ${poStatusu.nov} su novi nalozi, ${poStatusu.neaktivan} su neaktivni.`,
    najveciPad && najveciPad.pad > 0
      ? `Najveći gubitak je između koraka „${najveciPad.od.naziv}" i „${najveciPad.do.naziv}": ${najveciPad.od.vrednost} → ${najveciPad.do.vrednost} (−${procenat(najveciPad.pad, najveciPad.od.vrednost)}%).`
      : null,
    !errors.rawState ? `U poslednjih 30 dana: ${treninga30} ${treninga30 === 1 ? 'trening' : 'treninga'}, ukupno ${decimal(km30)} km.` : null,
    `${kandidati.length} ${kandidati.length === 1 ? 'nalog ispunjava' : 'naloga ispunjava'} pravilo za brisanje (stariji od 14 dana, bez treninga 30 dana, bez traga 14 dana).`
  ].filter(Boolean) : [];
  const ukratko = zakljucci.length ? odeljak('Ukratko', '', '', `<table width="100%" cellpadding="0" cellspacing="0">${zakljucci.map(t =>
      `<tr><td width="16" valign="top" style="padding:8px 0"><div style="width:6px;height:6px;border-radius:3px;background:${T.accent};margin-top:7px"></div></td><td style="padding:6px 0;font-size:15px;line-height:1.5;color:${T.text}">${esc(t)}</td></tr>`).join('')}</table>`) : '';

  /* ---------- 3. PUT KORISNIKA ---------- */
  const levakHtml = aktOk ? odeljak('Put korisnika', 'od ' + N, 'Koliko registrovanih stigne do svakog koraka, i koliko njih pređe u sledeći', trake(levak.map((k, i) => ({
    naziv: k.naziv,
    opis: i ? `od prethodnog koraka ${procenat(k.vrednost, levak[i - 1].vrednost)}%` : 'svi nalozi',
    vrednost: k.vrednost, oznaka: k.vrednost, dodatak: procenat(k.vrednost, N) + '%',
    boja: [T.base, T.build, T.accent, T.accent][i]
  })), N, T.accent)) : '';

  /* ---------- 4. AKTIVNOST ---------- */
  let aktivnostHtml;
  if (errors.dogadjaji) {
    aktivnostHtml = odeljak('Aktivnost', '', '', napomena('Zapis o otvaranjima nije učitan: ' + errors.dogadjaji));
  } else {
    const oznakaDana = (dd, i, n) => (n - 1 - i) % 7 === 0 ? kratakDan(dd) : '';
    const tacke = dani30.map((x, i) => ({ vrednost: brojPoDanu.get(x) || 0, oznaka: oznakaDana(x, i, dani30.length) }));
    const prosek = tacke.reduce((s, t) => s + t.vrednost, 0) / tacke.length;
    aktivnostHtml = odeljak('Aktivnost', '5 nedelja', 'Različiti korisnici koji su tog dana otvorili ili sinhronizovali aplikaciju', kalendar(brojPoDanu, todayStr))
      + odeljak('Aktivnih po danu', '30 dana', `Prosek ${decimal(prosek)} dnevno · najviše ${Math.max(0, ...tacke.map(t => t.vrednost))} · danas je tamniji stub`, stubici(tacke, { boja: T.base }));
  }

  /* ---------- 5. TRENINZI I KILOMETRI ---------- */
  const treninziHtml = errors.rawState
    ? odeljak('Treninzi', '', '', napomena('Stanja korisnika nisu učitana: ' + errors.rawState))
    : odeljak('Kilometri po danu', '30 dana', `${treninga30} ${treninga30 === 1 ? 'trening' : 'treninga'} · ${decimal(km30)} km ukupno · bez trčanja uvezenih pre registracije`,
        stubici(dani30.map((x, i) => ({ vrednost: Math.round(kmPoDanu.get(x) * 10) / 10, oznaka: (dani30.length - 1 - i) % 7 === 0 ? kratakDan(x) : '' })),
          { boja: T.build, format: v => decimal(v), prazno: 'Nijedan trening u poslednjih 30 dana.' }))
      + odeljak('Nedeljna kilometraža', '8 nedelja', 'Zbir svih korisnika po nedelji; tekuća nedelja je tamnija i još traje',
        stubici(nedelje.map(x => ({ vrednost: Math.round(kmPoNedelji.get(x) * 10) / 10, oznaka: kratakDan(x) })), { boja: T.base, visina: 90, format: v => decimal(v) }));

  /* ---------- 6. NAJAKTIVNIJI ---------- */
  const vodeci = [...kmPoKorisniku.entries()].filter(([, v]) => v > 0).sort((p, q) => q[1] - p[1]).slice(0, 5);
  const vodeciHtml = vodeci.length ? odeljak('Najviše kilometara', '30 dana', '', `<table width="100%" cellpadding="0" cellspacing="0">${vodeci.map(([id, v], i) => {
    const u = rows.find(r => r.id === id);
    const n = (u && u.trcanja || []).filter(t => t && t.d >= danMinus(todayStr, 29) && t.d >= (danIz(u.created) || '')).length;
    return red(`<span style="color:${T.text3};font-weight:400;padding-right:8px">${i + 1}.</span>${esc(imeZa(id) || (u && u.email) || '—')}`, `${n} ${n === 1 ? 'trening' : 'treninga'}`, decimal(v) + ' km', '');
  }).join('')}</table>`) : '';

  /* ---------- 7. NOVI NALOZI + KOHORTE ---------- */
  const poNedelji = new Map(nedelje.map(x => [x, 0]));
  for (const u of rows) {
    const dd = danIz(u.created);
    if (!dd) continue;
    const pon = mondayOfWeekUTC(dd);
    if (poNedelji.has(pon)) poNedelji.set(pon, poNedelji.get(pon) + 1);
  }
  const noviHtml = errors.users ? '' : odeljak('Novi nalozi', '8 nedelja', 'Registracije po nedelji · nedelja počinje ponedeljkom',
    stubici(nedelje.map(x => ({ vrednost: poNedelji.get(x), oznaka: kratakDan(x) })), { boja: T.base, visina: 80 }));
  const kohorteHtml = aktOk ? odeljak('Kohorte', 'po nedelji registracije', 'Od naloga otvorenih iste nedelje: koliko je napravilo plan, odradilo prvi trening i trenira sada', kohorte(akt, todayStr)) : '';

  /* ---------- 8. NEAKTIVNOST ---------- */
  const korpe = [
    { naziv: 'Danas ili juče', od: 0, do: 1 }, { naziv: '2–3 dana', od: 2, do: 3 }, { naziv: '4–7 dana', od: 4, do: 7 },
    { naziv: '8–14 dana', od: 8, do: 14 }, { naziv: '15–30 dana', od: 15, do: 30 }, { naziv: 'Više od 30 dana', od: 31, do: 1e9 }
  ];
  const neaktivnostHtml = aktOk ? odeljak('Poslednji znak života', '', 'Koliko je dana prošlo od poslednjeg otvaranja, sinhronizacije, poziva servera ili AI analize', trake(korpe.map((k, i) => {
    const v = akt.filter(x => ceo(x.dana_neaktivan) >= k.od && ceo(x.dana_neaktivan) <= k.do).length;
    return { naziv: k.naziv, vrednost: v, oznaka: v, dodatak: procenat(v, N) + '%', boja: i < 3 ? T.accent : i < 4 ? T.base : '#c5ccc2' };
  }), N, T.accent)) : '';

  /* ---------- 9. ŠTA KORISTE ---------- */
  const funkcijeHtml = aktOk ? odeljak('Šta koriste', 'od ' + N, '', trake([
    { naziv: 'Napravili plan',         vrednost: sPlanom },
    { naziv: 'Povezali Stravu',        vrednost: akt.filter(x => x.strava === true).length },
    { naziv: 'Povezali intervals.icu', vrednost: akt.filter(x => x.icu === true).length },
    { naziv: 'Pokrenuli AI analizu',   vrednost: akt.filter(x => ceo(x.ai_analiza) > 0).length },
    { naziv: 'Uključili obaveštenja',  vrednost: akt.filter(x => ceo(x.push_uredjaja) > 0).length },
    { naziv: 'Profil u zajednici',     vrednost: akt.filter(x => x.profil_zajednice === true).length }
  ].map(r => ({ ...r, oznaka: r.vrednost, dodatak: procenat(r.vrednost, N) + '%' })), N, T.build)) : '';

  /* ---------- 10. CILJEVI: distance + trke koje dolaze ---------- */
  const distance = {};
  for (const x of akt) if (x.ima_plan === true) { const k = x.plan_trka || 'Ostalo'; distance[k] = (distance[k] || 0) + 1; }
  const REDOSLED = ['5K', '10K', 'Polumaraton', 'Maraton'];
  const distRedovi = Object.entries(distance)
    .sort((p, q) => (REDOSLED.indexOf(p[0]) + 1 || 99) - (REDOSLED.indexOf(q[0]) + 1 || 99))
    .map(([naziv, v], i) => ({ naziv, vrednost: v, oznaka: v, dodatak: procenat(v, sPlanom) + '%', boja: [T.base, T.build, T.accent, T.text][i % 4] }));
  const trke = akt.filter(x => typeof x.plan_datum_trke === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x.plan_datum_trke) && x.plan_datum_trke >= todayStr)
    .sort((p, q) => p.plan_datum_trke.localeCompare(q.plan_datum_trke)).slice(0, 6);
  const ciljeviHtml = aktOk && distRedovi.length ? odeljak('Ciljevi', sPlanom + ' planova', 'Distanca aktivnog plana', trake(distRedovi, null, T.accent)
      + (trke.length ? `<div style="${LBL};margin:22px 0 2px">Trke koje dolaze</div><table width="100%" cellpadding="0" cellspacing="0">${trke.map(x => {
        const za = razlikaDana(todayStr, x.plan_datum_trke);
        return red(esc(x.ime || x.email || '—'), esc(x.plan_trka || 'Trka'), esc(kratakDan(x.plan_datum_trke)), za === 0 ? 'danas' : 'za ' + za + ' d');
      }).join('')}</table>` : '')) : '';

  /* ---------- 11. VERZIJE I UREĐAJI ---------- */
  const verzije = {};
  for (const x of akt) {
    const v = verzijaIzDogadjaja.get(x.user_id) || x.verzija_aplikacije;
    if (v) verzije[v] = (verzije[v] || 0) + 1;
  }
  const verRedovi = Object.entries(verzije).sort((p, q) => q[1] - p[1]).slice(0, 6)
    .map(([v, n]) => ({ naziv: 'Verzija ' + v, vrednost: n, oznaka: n, dodatak: procenat(n, N) + '%' }));
  const platRedovi = {};
  for (const p of platforma.values()) platRedovi[p] = (platRedovi[p] || 0) + 1;
  const NAZIV_PLATFORME = { android: 'Android aplikacija', instalirana: 'Instalirana (PWA)', pregledac: 'Pregledač' };
  const uredjajiHtml = aktOk && verRedovi.length ? odeljak('Verzije aplikacije', '', 'Poslednja verzija sa kojom je korisnik sinhronizovao ili otvorio aplikaciju', trake(verRedovi, N, T.base)
      + (Object.keys(platRedovi).length ? `<div style="${LBL};margin:22px 0 2px">Kako otvaraju</div>` + trake(Object.entries(platRedovi).map(([p, n]) => ({ naziv: NAZIV_PLATFORME[p] || p, vrednost: n, oznaka: n })), null, T.build) : '')) : '';

  /* ---------- 12. KANDIDATI ZA BRISANJE ---------- */
  const kandidatiHtml = aktOk ? odeljak('Kandidati za brisanje', kandidati.length ? String(kandidati.length) : '',
    kandidati.length ? 'Stariji od 14 dana, bez treninga 30 dana i bez ikakvog traga 14 dana' : 'Nijedan nalog trenutno ne ispunjava pravilo',
    kandidati.length ? `<table width="100%" cellpadding="0" cellspacing="0">${kandidati.map(x =>
      red(esc(x.ime || '—'), `${esc(x.email || '')} · registrovan ${esc(fmtDateOnly(danIz(x.registrovan)))}${x.ima_plan ? ' · ima plan' : ''}`, ceo(x.dana_neaktivan) + ' d', 'neaktivan', T.bad)).join('')}</table>` : '') : '';

  /* ---------- 13. KLJUČNI BROJEVI (Facts) ---------- */
  const brojeviHtml = odeljak('Ključni brojevi', '', '', `${errors.stats
      ? `<div style="background:#f8e1de;border-radius:12px;padding:12px 14px;margin-bottom:12px;font-size:13px;line-height:1.5"><b style="color:${T.bad}">Deo statistike nije učitan</b><br><span style="color:${T.text2}">${esc(errors.stats)} — ako pogled app_stats ne postoji: Supabase → SQL Editor → supabase/app-stats.sql. Ostali brojevi su i dalje tačni.</span></div>`
      : ''}<table width="100%" cellpadding="0" cellspacing="0">
      ${row('Korisnika ukupno', broj(stats.korisnika, errors.stats))}
      ${row('Aktivnih (danas)', broj(a.danas, aktivnoPalo))}
      ${row('Aktivnih (7 dana)', broj(a.d7, aktivnoPalo))}
      ${row('Aktivnih (30 dana)', broj(a.d30, aktivnoPalo))}
      ${row('Novih (7 dana)', broj(stats.novih_7d, errors.stats))}
      ${row('Sa generisanim planom', broj(stats.sa_generisanim_planom, errors.stats))}
      ${errors.rawState ? '' : row('Treninga u 30 dana', treninga30)}
      ${errors.rawState ? '' : row('Kilometara u 30 dana', decimal(km30))}
    </table>`);

  /* ---------- 14. SVI KORISNICI, PO STATUSU ---------- */
  let usersHtml;
  if (errors.users) {
    usersHtml = napomena(`Lista korisnika nije uspela: ${errors.users}. Brojevi gore su i dalje tačni.`);
  } else if (!rows.length) {
    usersHtml = napomena('Nema registrovanih korisnika.');
  } else {
    const grupe = aktOk ? STATUSI.map(s => ({ s, clanovi: [] })) : [];
    const bez = { s: { naziv: aktOk ? 'Bez statusa' : 'Svi nalozi', boja: '#c5ccc2' }, clanovi: [] };
    for (const u of rows) {
      const x = poId.get(u.id);
      const g = x && grupe.find(gr => gr.s.k === x.status);
      (g || bez).clanovi.push(u);
    }
    grupe.push(bez);
    usersHtml = grupe.filter(g => g.clanovi.length).map(g => `
      <table cellpadding="0" cellspacing="0" style="margin:18px 0 2px"><tr><td style="padding-right:8px"><div style="width:10px;height:10px;border-radius:3px;background:${g.s.boja}"></div></td><td style="${LBL}">${esc(g.s.naziv)} · ${g.clanovi.length}</td></tr></table>
      <table width="100%" cellpadding="0" cellspacing="0">${g.clanovi.sort((p, q) => String(p.email).localeCompare(String(q.email))).map(u => {
        const ime = imeZa(u.id);
        /* Jedan kompaktan red po nalogu: spisak raste sa svakim nalogom, a Gmail seče mejl iznad 102 KB. */
        const pod = [esc(u.email), u.stravaConnected ? 'Strava' : null, u.lastAiDay ? 'AI ' + esc(fmtDateOnly(u.lastAiDay)) : null,
          u.lastWorkoutDate ? `<b style="color:${T.text2}">trening ${esc(fmtDateOnly(u.lastWorkoutDate))}${u.weekKm ? ', ' + esc(decimal(u.weekKm)) + ' km ove ned.' : ''}</b>` : null].filter(Boolean).join(' · ');
        return `<tr><td style="padding:8px 0;border-bottom:1px solid ${T.line};font-size:12px;line-height:1.5;color:${T.text3};word-break:break-word"><b style="font-size:14px;color:${T.text}">${esc(ime || u.email)}</b> ${pod}</td></tr>`;
      }).join('')}</table>`).join('')
      + (errors.rawState ? napomena(`Napomena: podaci o treningu nisu uspeli da se učitaju (${errors.rawState}) — kolone treninga mogu biti prazne.`) : '')
      + (errors.aiUsage ? napomena(`Napomena: AI korišćenje nije uspelo da se učita (${errors.aiUsage}).`) : '')
      + (errors.endpointUsage ? napomena(`Napomena: zapis o pozivima nije uspeo da se učita (${errors.endpointUsage}) — brojevi „Aktivnih" su zato prazni.`) : '');
  }
  const korisniciHtml = odeljak('Svi korisnici', rows.length ? String(rows.length) : '', 'Po statusu; uz svakog: adresa, veze i poslednji trening', usersHtml);

  /* Odložena brisanja se prijavljuju SAMO kad ih ima — prazan red svakog jutra
     je šum koji se posle nedelju dana ne čita. */
  const b = brisanja || { obrisano: [], greske: [] };
  const brisanjaHtml = (b.obrisano.length || b.greske.length)
    ? odeljak('Odložena brisanja', '', '', `${b.obrisano.length ? `<div style="color:${T.text2};font-size:14px">Izvršeno: ${esc(b.obrisano.join(', '))}</div>` : ''}
         ${b.greske.length ? `<div style="color:${T.bad};font-size:14px;margin-top:6px">NIJE uspelo: ${esc(b.greske.join(' · '))}</div>` : ''}`)
    : '';

  return `<!doctype html><html lang="sr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light"><title>sub20 · dnevni izveštaj</title></head>
<body style="margin:0;padding:0;background:${T.bg}">
<table width="100%" cellpadding="0" cellspacing="0" style="background:${T.bg};font-family:${FONT};color:${T.text}">
<tr><td align="center" style="padding:28px 20px 36px">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px">
  ${glava}
  ${veliki2}
  ${mreza}
  ${ukratko}
  ${levakHtml}
  ${aktivnostHtml}
  ${treninziHtml}
  ${vodeciHtml}
  ${noviHtml}
  ${kohorteHtml}
  ${neaktivnostHtml}
  ${funkcijeHtml}
  ${ciljeviHtml}
  ${uredjajiHtml}
  ${kandidatiHtml}
  ${brojeviHtml}
  ${korisniciHtml}
  ${brisanjaHtml}
  <tr><td style="padding:22px 0 0;border-top:1px solid ${T.line};font-size:12px;color:${T.text3};line-height:1.6">
    „Trenira" = trening zabeležen kroz aplikaciju u poslednjih 14 dana. Trčanja uvezena sa Strave pre registracije se ne računaju.
    Pravila statusa i kandidata žive u pogledu admin_aktivnost u bazi.
    <div style="font-size:18px;font-weight:800;letter-spacing:-.04em;color:${T.text};margin-top:14px">sub20</div>
  </td></tr>
</table></td></tr></table></body></html>`.replace(/>\s*\n\s*</g, '><').replace(/\s*\n\s*/g, ' ');
}


/* ============================================================
   IZVRŠENJE ODLOŽENOG BRISANJA

   Vlasnik ne briše tuđe naloge odmah — označi ih i zabrani (v.
   supabase/admin-brisanje.sql i /api/broadcast {admin:'obrisi'}). Ovde se rok
   naplaćuje: nalozi kojima je istekao brišu se stvarno.

   ZAŠTO OVDE, a ne u zasebnoj funkciji: Vercel Hobby plan dozvoljava dvanaest
   serverless funkcija po deployu, a već ih je devet. Ovaj posao ide jednom
   dnevno, kao i izveštaj, i traži isti service_role ključ — pa je ovo
   najprirodnije mesto.

   NE SME DA OBORI IZVEŠTAJ. Ako brisanje padne, mejl svejedno mora da stigne,
   jer u njemu i piše šta nije uspelo. Zato ceo posao vraća nalaz umesto da
   baca. Spisak tabela je NAMERNO prepisan iz api/broadcast.js: fajlovi se ne
   uvoze međusobno (v. komentar o build koraku u api/analyze.js), pa razliku
   čuva test „spisak tabela je isti na sva tri mesta". */
const BRISI_TABELE = [
  'user_state', 'push_pretplata', 'ai_posao', 'api_usage',
  'bug_report_usage', 'endpoint_usage', 'zajednica_profil', 'user_state_istorija'
];

async function izvrsiOdlozenaBrisanja(url, key) {
  const baza = url.replace(/\/+$/, '');
  const head = { apikey: key, Authorization: 'Bearer ' + key };
  const nalaz = { obrisano: [], greske: [] };
  let redovi = [];
  try {
    const r = await fetchRok(baza + '/rest/v1/nalog_za_brisanje?select=user_id,email,izvrsi_posle'
      + '&izvrsi_posle=lt.' + encodeURIComponent(new Date().toISOString()), { headers: head });
    if (!r.ok) { nalaz.greske.push('spisak: HTTP ' + r.status); return nalaz; }
    redovi = await r.json();
  } catch (e) { nalaz.greske.push('spisak: ' + e.message); return nalaz; }

  for (const x of (Array.isArray(redovi) ? redovi : [])) {
    const id = String(x.user_id || '');
    if (!id) continue;
    let pao = null;
    for (const t of BRISI_TABELE) {
      try {
        const r = await fetchRok(baza + '/rest/v1/' + t + '?user_id=eq.' + encodeURIComponent(id),
          { method: 'DELETE', headers: { ...head, Prefer: 'return=minimal' } });
        if (!r.ok && r.status !== 404) pao = t + ': HTTP ' + r.status;
      } catch (e) { pao = t + ': ' + e.message; }
      if (pao) break;
    }
    /* Nalog TEK NA KRAJU, i samo ako su svi podaci prošli. Obrnut redosled
       ostavlja čoveka bez pristupa a sa podacima na serveru. */
    if (pao) { nalaz.greske.push((x.email || id) + ' — ' + pao); continue; }
    try {
      const r = await fetchRok(baza + '/auth/v1/admin/users/' + encodeURIComponent(id),
        { method: 'DELETE', headers: head });
      if (!r.ok) { nalaz.greske.push((x.email || id) + ' — nalog: HTTP ' + r.status); continue; }
    } catch (e) { nalaz.greske.push((x.email || id) + ' — nalog: ' + e.message); continue; }
    /* Red u nalog_za_brisanje nestaje sam, kroz `on delete cascade`. */
    nalaz.obrisano.push(x.email || id);
    console.log('[cron] izvrseno odlozeno brisanje naloga %s (%s)', x.email || '—', id);
  }
  return nalaz;
}

/* Naslov ne sme da tvrdi „0 korisnika" kad brojač nije ni odgovorio. Kad je
   pregled aktivnosti stigao, naslov nosi glavni broj: koliko ih trenira. */
function naslovMejla(stats, errors, aktivnost, todayStr) {
  const dan = kratakDan(todayStr);
  if (!errors.aktivnost && Array.isArray(aktivnost) && aktivnost.length) {
    const n = aktivnost.length;
    const trci = aktivnost.filter(x => x.status === 'trci').length;
    const kand = aktivnost.filter(x => x.kandidat_za_brisanje === true).length;
    return 'SUB-20 dnevni izveštaj ' + dan + ' — ' + n + ' korisnika, trenira ' + trci + ' (' + procenat(trci, n) + '%)'
      + (kand ? ', za brisanje ' + kand : '');
  }
  return errors.stats
    ? 'SUB-20 dnevni izveštaj — statistika nije učitana'
    : 'SUB-20 dnevni izveštaj — ' + (stats.korisnika ?? 0) + ' korisnika';
}

export default async function handler(req, res) {
  if (!checkCron(req)) return res.status(401).json({ error: 'Neautorizovano.' });

  const url = process.env.SUPABASE_URL;
  const svcKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const resendKey = process.env.RESEND_API_KEY;
  const to = process.env.REPORT_TO;
  const from = process.env.REPORT_FROM;
  const missing = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'RESEND_API_KEY', 'REPORT_TO', 'REPORT_FROM']
    .filter(k => !process.env[k]);
  if (missing.length) return res.status(500).json({ error: 'Nedostaju env varijable: ' + missing.join(', ') });

  /* DAN JE BEOGRADSKI, ne UTC. Aplikacija je cela u jednoj zoni (v.
     `danasBeograd` u api/push.js, `v_dan` u supabase/rate-limit.sql), pa je i
     „danas" u izveštaju isti dan koji brojači upisuju. Cron ide u 05:00 UTC,
     gde se to dvoje poklapa — ali poklapanje po rasporedu nije razlog da
     ostane netačno. */
  const todayStr = danBeograd(Date.now()) || new Date().toISOString().slice(0, 10);
  const errors = {};

  /* STATISTIKA OTKAZUJE KAO I SVAKI DRUGI KORAK — u svom try/catch.
     Ranije je ovde stajao `return res.status(502)`, dakle jedini korak koji je
     obarao CEO posao. To nije bila samo izgubljena tabelica na vrhu mejla:
     `izvrsiOdlozenaBrisanja()` se poziva NIZE, pa se odlozena brisanja naloga
     ne bi izvrsila nijedan dan dok god `app_stats` ne odgovara — a jedina
     poruka koja bi to javila je isti onaj izvestaj koji nije poslat.
     Klasa greske ista kao kod svake rucne migracije: tiho, i mesecima. */
  let stats = {};
  try { stats = await fetchStats(url, svcKey); }
  catch (e) { errors.stats = e.message; }

  let users = [];
  try { users = await fetchUserList(url, svcKey); }
  catch (e) { errors.users = e.message; }

  let rawStates = {};
  try { rawStates = await fetchRawUserState(url, svcKey, todayStr); }
  catch (e) { errors.rawState = e.message; }

  let aiDays = {};
  try { aiDays = await fetchAiUsageDays(url, svcKey); }
  catch (e) { errors.aiUsage = e.message; }

  /* Nezavisan zapis o korišćenju — jedini koji preživi neuspelu sinhronizaciju
     stanja (v. agregatAktivnosti). */
  let endpointDays = {};
  try { endpointDays = await fetchEndpointDays(url, svcKey); }
  catch (e) { errors.endpointUsage = e.message; }

  /* Pregled po korisniku (status, kandidat) i događaji za grafikone. Oba su
     dodatak: kad ne stignu, mejl ide sa ostalim delovima i javlja šta fali. */
  let aktivnost = [];
  try { aktivnost = await fetchAktivnost(url, svcKey); }
  catch (e) { errors.aktivnost = e.message; }

  let dogadjaji = [];
  try { dogadjaji = await fetchDogadjaji(url, svcKey, new Date(Date.now() - 43 * 86400000).toISOString()); }
  catch (e) { errors.dogadjaji = e.message; }

  /* Rok za odložena brisanja se naplaćuje PRE sastavljanja mejla, da bi nalaz
     mogao da uđe u njega. */
  const brisanja = await izvrsiOdlozenaBrisanja(url, svcKey);

  const rows = mergeRows(users, rawStates, aiDays, todayStr);
  const aktivni = agregatAktivnosti(rawStates, endpointDays, aiDays, todayStr);
  const html = buildHtml(stats, rows, errors, brisanja, aktivni, { todayStr, aktivnost, dogadjaji });

  try {
    const r = await fetchRok('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + resendKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from, to,
        /* Naslov ne sme da tvrdi „0 korisnika" kad brojac nije ni odgovorio. */
        subject: naslovMejla(stats, errors, aktivnost, todayStr),
        html
      })
    });
    const j = await r.json();
    if (!r.ok) return res.status(502).json({ error: 'Resend greška: ' + JSON.stringify(j) });
    return res.status(200).json({ ok: true, sent: j.id || true });
  } catch (e) {
    return res.status(502).json({ error: 'Slanje mejla nije uspelo: ' + e.message });
  }
}

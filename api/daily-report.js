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
  stravaConnected: false, stravaAthlete: null, lastAiDay: null, upisDan: null, dani30: []
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

/* Otvaranja i sinhronizacije u poslednjih 30 dana — za „aktivnih po danu". */
const fetchDogadjaji = (url, key, odIso) =>
  fetchSveStrane(url, key, 'korisnik_dogadjaj?select=user_id,vrsta,napravljeno'
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

  /* DANI TRENINGA U POSLEDNJIH 30 DANA — za grafikon „treninga po danu".
     Jedan unos po treningu (dva treninga istog dana su dva unosa). Izvori su
     isti kao u pogledu `admin_aktivnost`: odrađen dan iz plana i trčanje van
     plana. Granica pre registracije se primenjuje tek u izveštaju, jer se ovde
     ne zna kad je nalog otvoren. */
  const od30 = danMinus(todayStr, 29);
  const dani30 = [];
  for (const e of entries) {
    const d = danTreninga(e);
    if (d && d >= od30 && d <= todayStr) dani30.push(d);
  }
  const van = data && data.vanPlana;
  if (van && typeof van === 'object' && !Array.isArray(van)) {
    for (const [d, km] of Object.entries(van)) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(d) && d >= od30 && d <= todayStr && typeof km === 'number' && km > 0) dani30.push(d);
    }
  }

  return {
    lastWorkoutDate: lastWorkout ? lastWorkout.date : null,
    weekKm: Math.round(weekKm * 10) / 10,
    lastStravaSync,
    stravaConnected,
    stravaAthlete,
    lastAiDay,
    dani30: dani30.slice(0, 200)
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
      dani30: act.dani30 || [],
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
   IZGLED MEJLA — DNEVNI PREGLED KAO DASHBOARD

   Mejl klijenti (Gmail pre svih) izbacuju <style>, SVG i JavaScript. Zato je
   sve tabela sa inline stilom: trake su ćelije zadate širinom u procentima,
   stubići su <div> zadate visine u ćeliji poravnatoj na dno. Svaki grafikon
   nosi i brojeve kao tekst: boja nikad ne nosi značenje sama, a jedan ton
   palete (zeleni) ima kontrast ispod 3:1 prema podlozi.

   Paleta je proverena na daltonizam (prva tri kategorijska tona, susedni
   parovi ΔE ≥ 9). Neaktivni su neutralno sivi, ne četvrti ton.
   ============================================================ */
const B = {
  pozadina: '#F3F3F1', karta: '#FFFFFF', tekst: '#0B0B0B', sekundarno: '#52514E',
  priguseno: '#8A8984', mreza: '#E6E5E1', brend: '#FA2E55',
  s1: '#2A78D6', s2: '#EB6834', s3: '#1BAF7A', neutral: '#B9B8B2', kriticno: '#D03B3B'
};
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

/* Redosled je i redosled u složenoj traci i u legendi. */
const STATUSI = [
  { k: 'trci',                naziv: 'Trenira (trening u 14 dana)', boja: B.s1 },
  { k: 'otvara_ne_trci',      naziv: 'Otvara aplikaciju, ne trenira', boja: B.s2 },
  { k: 'nov',                 naziv: 'Nov nalog (mlađi od 7 dana)', boja: B.s3 },
  { k: 'neaktivan',           naziv: 'Neaktivan (14+ dana bez traga)', boja: B.neutral },
  { k: 'oznacen_za_brisanje', naziv: 'Označen za brisanje', boja: B.kriticno }
];
const STATUS_PO_KLJUCU = Object.fromEntries(STATUSI.map(s => [s.k, s]));

const procenat = (a, b) => (b > 0 && isFinite(a)) ? Math.round(a * 100 / b) : 0;
const ceo = v => (typeof v === 'number' && isFinite(v)) ? v : (Number.isFinite(+v) ? +v : 0);
const kratakDan = ymd => (typeof ymd === 'string' && /^\d{4}-\d{2}-\d{2}/.test(ymd))
  ? ymd.slice(8, 10) + '.' + ymd.slice(5, 7) + '.' : '';
const danIz = v => (typeof v === 'string' && v) ? danBeograd(Date.parse(v)) : null;

function poslednjihDana(todayStr, n) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) out.push(danMinus(todayStr, i));
  return out;
}

function karta(naslov, podnaslov, telo) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${B.karta};border-radius:14px;border:1px solid ${B.mreza};margin:0 0 16px">
    <tr><td style="padding:20px 22px">
      <div style="font-size:15px;font-weight:700;color:${B.tekst}">${esc(naslov)}</div>
      ${podnaslov ? `<div style="font-size:12px;color:${B.priguseno};margin-top:3px">${esc(podnaslov)}</div>` : ''}
      <div style="margin-top:16px">${telo}</div>
    </td></tr></table>`;
}

const napomena = t => `<div style="font-size:12px;color:${B.priguseno};line-height:1.5">${esc(t)}</div>`;

function kpiPlocice(plocice) {
  const td = p => `<td width="50%" valign="top" style="padding:5px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${B.karta};border:1px solid ${B.mreza};border-radius:14px">
      <tr><td style="padding:16px 14px">
        <div style="font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:${B.priguseno}">${esc(p.naziv)}</div>
        <div style="font-size:30px;font-weight:800;color:${B.tekst};margin-top:6px;line-height:1">${esc(p.vrednost)}</div>
        <div style="font-size:12px;color:${p.boja || B.sekundarno};margin-top:6px">${esc(p.napomena || '')}</div>
      </td></tr></table></td>`;
  const redovi = [];
  for (let i = 0; i < plocice.length; i += 2) redovi.push(`<tr>${plocice.slice(i, i + 2).map(td).join('')}</tr>`);
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 11px;table-layout:fixed">
    ${redovi.join('')}</table>`;
}

/* Složena traka do 100%: jedan red ćelija, razmak od 2px između delova. */
function slozenaTraka(delovi) {
  const ukupno = delovi.reduce((s, d) => s + d.vrednost, 0);
  if (!ukupno) return napomena('Nema podataka.');
  const vidljivi = delovi.filter(d => d.vrednost > 0);
  const traka = vidljivi.map((d, i) =>
    `<td width="${Math.max(2, (d.vrednost * 100 / ukupno)).toFixed(2)}%" style="background:${d.boja};height:22px;${i ? 'border-left:2px solid ' + B.karta + ';' : ''}${i === 0 ? 'border-radius:6px 0 0 6px;' : ''}${i === vidljivi.length - 1 ? 'border-radius:0 6px 6px 0;' : ''}${vidljivi.length === 1 ? 'border-radius:6px;' : ''}font-size:0;line-height:0">&nbsp;</td>`).join('');
  const legenda = delovi.map(d => `<tr>
      <td width="16" style="padding:5px 0"><div style="width:10px;height:10px;border-radius:3px;background:${d.boja}"></div></td>
      <td style="padding:5px 0;font-size:13px;color:${B.tekst}">${esc(d.naziv)}</td>
      <td align="right" style="padding:5px 0;font-size:13px;font-weight:700;color:${B.tekst};white-space:nowrap">${d.vrednost}</td>
      <td align="right" width="52" style="padding:5px 0;font-size:13px;color:${B.sekundarno};white-space:nowrap">${procenat(d.vrednost, ukupno)}%</td>
    </tr>`).join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="table-layout:fixed"><tr>${traka}</tr></table>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px">${legenda}</table>`;
}

/* Vodoravne trake; `max` je zajednička skala svih redova. */
function trake(redovi, max, boja) {
  const m = max || Math.max(1, ...redovi.map(r => r.vrednost));
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${redovi.map(r => {
    const w = m ? Math.min(100, r.vrednost * 100 / m) : 0;
    return `<tr>
      <td width="36%" style="padding:6px 10px 6px 0;font-size:13px;color:${B.tekst};vertical-align:middle">${esc(r.naziv)}</td>
      <td style="padding:6px 0;vertical-align:middle">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${B.pozadina};border-radius:6px"><tr>
          ${w > 0 ? `<td width="${Math.max(1.5, w).toFixed(2)}%" style="background:${r.boja || boja};height:14px;border-radius:6px;font-size:0;line-height:0">&nbsp;</td>` : ''}
          <td style="height:14px;font-size:0;line-height:0">&nbsp;</td>
        </tr></table>
      </td>
      <td width="92" align="right" style="padding:6px 0 6px 10px;font-size:13px;white-space:nowrap;vertical-align:middle"><b style="color:${B.tekst}">${esc(r.oznaka != null ? r.oznaka : r.vrednost)}</b>${r.dodatak ? ` <span style="color:${B.priguseno}">${esc(r.dodatak)}</span>` : ''}</td>
    </tr>`;
  }).join('')}</table>`;
}

/* Stubići kroz vreme. Brojevi stoje iznad najvišeg i poslednjeg stuba —
   ne nad svakim, da grafikon ostane čitljiv. */
function stubici(tacke, boja, visina) {
  const H = visina || 90;
  const max = Math.max(0, ...tacke.map(t => t.vrednost));
  if (!max) return napomena('Nijedan zapis u ovom periodu.');
  const iMax = tacke.findIndex(t => t.vrednost === max);
  const poslednji = tacke.length - 1;
  const kolone = tacke.map((t, i) => {
    const h = t.vrednost ? Math.max(3, Math.round(t.vrednost * H / max)) : 0;
    const broj = (i === iMax || i === poslednji) && t.vrednost
      ? `<div style="font-size:10px;font-weight:700;color:${B.tekst};text-align:center;padding-bottom:2px">${t.vrednost}</div>` : '';
    return `<td valign="bottom" align="center" style="padding:0 1px;height:${H + 16}px">${broj}${h ? `<div style="height:${h}px;background:${boja};border-radius:3px 3px 0 0;font-size:0;line-height:0">&nbsp;</div>` : ''}</td>`;
  }).join('');
  const oznake = tacke.map(t =>
    `<td align="center" style="padding-top:5px;font-size:9px;color:${B.priguseno};white-space:nowrap;border-top:1px solid ${B.mreza}">${esc(t.oznaka || '')}</td>`).join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="table-layout:fixed">
    <tr>${kolone}</tr><tr>${oznake}</tr></table>`;
}

function buildHtml(stats, rows, errors, brisanja, aktivni, dodatno) {
  const d = dodatno || {};
  const todayStr = d.todayStr || danBeograd(Date.now());
  const row = (label, val) =>
    `<tr><td style="padding:8px 0;color:${B.sekundarno};font-size:13px;border-bottom:1px solid ${B.mreza}">${esc(label)}</td>` +
    `<td align="right" style="padding:8px 0;font-weight:700;font-size:14px;color:${B.tekst};border-bottom:1px solid ${B.mreza}">${esc(val)}</td></tr>`;

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

  const poStatusu = {};
  for (const s of STATUSI) poStatusu[s.k] = 0;
  for (const x of akt) if (x.status in poStatusu) poStatusu[x.status]++;
  const kandidati = akt.filter(x => x.kandidat_za_brisanje === true)
    .sort((p, q) => ceo(q.dana_neaktivan) - ceo(p.dana_neaktivan));

  const novih7 = rows.filter(u => { const dd = danIz(u.created); return dd && dd >= danMinus(todayStr, 6); }).length;

  /* ---------- 1. KLJUČNI BROJEVI ---------- */
  const plocice = kpiPlocice([
    { naziv: 'Registrovanih', vrednost: N, napomena: '+' + novih7 + ' u 7 dana' },
    { naziv: 'Trenira', vrednost: aktOk ? poStatusu.trci : '—', napomena: aktOk ? procenat(poStatusu.trci, N) + '% registrovanih' : 'nije učitano', boja: B.s1 },
    { naziv: 'Aktivno 7 dana', vrednost: broj(a.d7, aktivnoPalo), napomena: aktivnoPalo ? 'nepotpuno' : procenat(ceo(a.d7), N) + '% registrovanih' },
    { naziv: 'Za brisanje', vrednost: aktOk ? kandidati.length : '—', napomena: 'kandidata', boja: kandidati.length ? B.kriticno : B.sekundarno }
  ]);

  /* ---------- 2. ZAKLJUČCI (samo izračunate činjenice) ---------- */
  const sPlanom = akt.filter(x => x.ima_plan === true || ceo(x.planova_napravljeno) > 0).length;
  const saTreningom = akt.filter(x => ceo(x.treninga) > 0).length;
  const levak = [
    { naziv: 'Registrovani', vrednost: N },
    { naziv: 'Napravili plan', vrednost: sPlanom },
    { naziv: 'Bar jedan trening', vrednost: saTreningom },
    { naziv: 'Trenira (14 dana)', vrednost: poStatusu.trci }
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
    `${kandidati.length} ${kandidati.length === 1 ? 'nalog ispunjava' : 'naloga ispunjava'} pravilo za brisanje (stariji od 14 dana, bez treninga 30 dana, bez traga 14 dana).`
  ].filter(Boolean) : [];
  const zakljucciHtml = zakljucci.length
    ? karta('Zaključci', 'Izračunato iz podataka iznad, bez procene', `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${zakljucci.map(t =>
        `<tr><td width="14" valign="top" style="padding:4px 0;color:${B.brend};font-weight:800">•</td><td style="padding:4px 0;font-size:13px;line-height:1.5;color:${B.tekst}">${esc(t)}</td></tr>`).join('')}</table>`)
    : '';

  /* ---------- 3. KO TRENIRA, A KO NE ---------- */
  const udeoHtml = aktOk
    ? karta('Ko trenira, a ko ne', `Svih ${N} naloga po statusu`, slozenaTraka(STATUSI.map(s => ({ naziv: s.naziv, vrednost: poStatusu[s.k], boja: s.boja }))))
    : karta('Ko trenira, a ko ne', '', napomena('Pogled admin_aktivnost nije učitan' + (errors.aktivnost ? ': ' + errors.aktivnost : '') + '.'));

  /* ---------- 4. LEVAK ---------- */
  const levakHtml = aktOk
    ? karta('Put korisnika', 'Koliko registrovanih stigne do svakog koraka', trake(levak.map((k, i) => ({
        naziv: k.naziv, vrednost: k.vrednost, oznaka: k.vrednost,
        dodatak: i ? procenat(k.vrednost, N) + '%' : '100%'
      })), N, B.s1))
    : '';

  /* ---------- 5. AKTIVNOST KROZ VREME ---------- */
  const dani = poslednjihDana(todayStr, 30);
  const oznakaDana = (dd, i) => (i === 0 || i === dani.length - 1 || (dani.length - 1 - i) % 7 === 0) ? kratakDan(dd) : '';
  let aktivniPoDanuHtml;
  if (errors.dogadjaji) {
    aktivniPoDanuHtml = napomena('Zapis o otvaranjima nije učitan: ' + errors.dogadjaji);
  } else {
    const poDanu = new Map(dani.map(x => [x, new Set()]));
    for (const e of (d.dogadjaji || [])) {
      if (e.vrsta !== 'otvaranje' && e.vrsta !== 'sinhronizacija') continue;
      const dd = danIz(e.napravljeno);
      if (dd && poDanu.has(dd)) poDanu.get(dd).add(e.user_id);
    }
    aktivniPoDanuHtml = stubici(dani.map((x, i) => ({ vrednost: poDanu.get(x).size, oznaka: oznakaDana(x, i) })), B.s1);
  }
  const treningPoDanu = new Map(dani.map(x => [x, 0]));
  for (const u of rows) {
    const reg = danIz(u.created) || '0000-00-00';
    for (const dd of (u.dani30 || [])) if (dd >= reg && treningPoDanu.has(dd)) treningPoDanu.set(dd, treningPoDanu.get(dd) + 1);
  }
  const ukupnoTreninga30 = [...treningPoDanu.values()].reduce((s, v) => s + v, 0);
  const vremeHtml =
    karta('Aktivnih korisnika po danu', 'Različiti korisnici koji su otvorili ili sinhronizovali aplikaciju · poslednjih 30 dana', aktivniPoDanuHtml) +
    karta('Treninga po danu', `Odrađeni treninzi svih korisnika · poslednjih 30 dana · ukupno ${ukupnoTreninga30}`,
      errors.rawState ? napomena('Stanja korisnika nisu učitana: ' + errors.rawState)
        : stubici(dani.map((x, i) => ({ vrednost: treningPoDanu.get(x), oznaka: oznakaDana(x, i) })), B.s3));

  /* ---------- 6. NOVI NALOZI PO NEDELJI ---------- */
  const ponedeljak = mondayOfWeekUTC(todayStr);
  const nedelje = [];
  for (let i = 7; i >= 0; i--) nedelje.push(danMinus(ponedeljak, i * 7));
  const poNedelji = new Map(nedelje.map(x => [x, 0]));
  for (const u of rows) {
    const dd = danIz(u.created);
    if (!dd) continue;
    const pon = mondayOfWeekUTC(dd);
    if (poNedelji.has(pon)) poNedelji.set(pon, poNedelji.get(pon) + 1);
  }
  const noviHtml = errors.users ? '' : karta('Novi nalozi po nedelji', 'Poslednjih 8 nedelja · nedelja počinje ponedeljkom',
    stubici(nedelje.map(x => ({ vrednost: poNedelji.get(x), oznaka: kratakDan(x) })), B.s2, 80));

  /* ---------- 7. FUNKCIJE ---------- */
  const funkcijeHtml = aktOk ? karta('Šta koriste', `Udeo od ${N} registrovanih`, trake([
    { naziv: 'Napravili plan',        vrednost: sPlanom },
    { naziv: 'Povezali Stravu',       vrednost: akt.filter(x => x.strava === true).length },
    { naziv: 'Povezali intervals.icu', vrednost: akt.filter(x => x.icu === true).length },
    { naziv: 'Pokrenuli AI analizu',  vrednost: akt.filter(x => ceo(x.ai_analiza) > 0).length },
    { naziv: 'Uključili obaveštenja', vrednost: akt.filter(x => ceo(x.push_uredjaja) > 0).length },
    { naziv: 'Profil u zajednici',    vrednost: akt.filter(x => x.profil_zajednice === true).length }
  ].map(r => ({ ...r, oznaka: r.vrednost, dodatak: procenat(r.vrednost, N) + '%' })), N, B.s1)) : '';

  /* ---------- 8. PLANOVI PO DISTANCI ---------- */
  const distance = {};
  for (const x of akt) if (x.ima_plan === true) { const k = x.plan_trka || 'Ostalo'; distance[k] = (distance[k] || 0) + 1; }
  const REDOSLED = ['5K', '10K', 'Polumaraton', 'Maraton'];
  const distRedovi = Object.entries(distance)
    .sort((p, q) => (REDOSLED.indexOf(p[0]) + 1 || 99) - (REDOSLED.indexOf(q[0]) + 1 || 99))
    .map(([naziv, v]) => ({ naziv, vrednost: v, oznaka: v, dodatak: procenat(v, sPlanom) + '%' }));
  const planoviHtml = aktOk && distRedovi.length
    ? karta('Aktivni planovi po distanci', `${sPlanom} korisnika ima plan`, trake(distRedovi, null, B.s2)) : '';

  /* ---------- 9. KANDIDATI ZA BRISANJE ---------- */
  const thS = `padding:6px 4px;font-size:10px;text-transform:uppercase;color:${B.priguseno};text-align:left;border-bottom:1px solid ${B.mreza}`;
  const tdS = `padding:7px 4px;font-size:12px;color:${B.tekst};border-bottom:1px solid ${B.mreza};vertical-align:top;word-break:break-word`;
  const kandidatiHtml = aktOk ? karta('Kandidati za brisanje', kandidati.length
      ? 'Stariji od 14 dana, bez treninga 30 dana i bez ikakvog traga 14 dana'
      : 'Nijedan nalog trenutno ne ispunjava pravilo',
    kandidati.length ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr><th style="${thS}">Korisnik</th><th style="${thS}">Reg.</th><th style="${thS};text-align:right">Neaktivan</th><th style="${thS};text-align:right">Tren.</th></tr>
      ${kandidati.map(x => `<tr>
        <td style="${tdS}"><b>${esc(x.ime || '—')}</b><br><span style="color:${B.priguseno};word-break:break-all">${esc(x.email || '')}</span></td>
        <td style="${tdS};white-space:nowrap">${esc(fmtDateOnly(danIz(x.registrovan)))}</td>
        <td style="${tdS};text-align:right;white-space:nowrap;color:${B.kriticno};font-weight:700">${ceo(x.dana_neaktivan)} d</td>
        <td style="${tdS};text-align:right">${ceo(x.treninga)}</td>
      </tr>`).join('')}</table>` : '') : '';

  /* ---------- 10. KLJUČNI BROJEVI (tabela) ---------- */
  const brojeviHtml = karta('Ključni brojevi', '', `${errors.stats
      ? `<div style="background:#FDECEE;border:1px solid ${B.brend};border-radius:10px;padding:10px 12px;margin-bottom:12px;font-size:12px"><b style="color:${B.kriticno}">Deo statistike nije učitan</b><br><span style="color:${B.sekundarno}">${esc(errors.stats)} — ako pogled <code>app_stats</code> ne postoji: Supabase → SQL Editor → <code>supabase/app-stats.sql</code>. Ostali brojevi su i dalje tačni.</span></div>`
      : ''}<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      ${row('Korisnika ukupno', broj(stats.korisnika, errors.stats))}
      ${row('Aktivnih (danas)', broj(a.danas, aktivnoPalo))}
      ${row('Aktivnih (7 dana)', broj(a.d7, aktivnoPalo))}
      ${row('Aktivnih (30 dana)', broj(a.d30, aktivnoPalo))}
      ${row('Novih (7 dana)', broj(stats.novih_7d, errors.stats))}
      ${row('Sa generisanim planom', broj(stats.sa_generisanim_planom, errors.stats))}
      ${aktOk ? row('Treninga u 30 dana', ukupnoTreninga30) : ''}
    </table>`);

  /* ---------- 11. SVI KORISNICI ---------- */
  let usersHtml;
  if (errors.users) {
    usersHtml = napomena(`Lista korisnika nije uspela: ${errors.users}. Brojevi gore su i dalje tačni.`);
  } else if (!rows.length) {
    usersHtml = napomena('Nema registrovanih korisnika.');
  } else {
    const red = STATUSI.map(s => s.k);
    const sortirani = rows.slice().sort((p, q) => {
      const sp = poId.get(p.id), sq = poId.get(q.id);
      const ip = sp ? red.indexOf(sp.status) : 99, iq = sq ? red.indexOf(sq.status) : 99;
      return (ip - iq) || String(p.email).localeCompare(String(q.email));
    });
    const status = x => {
      const s = x && STATUS_PO_KLJUCU[x.status];
      return s ? `<span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${s.boja};margin-right:5px"></span>${esc(s.naziv.split(' (')[0])}` : '—';
    };
    usersHtml = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr><th style="${thS}">Korisnik</th><th style="${thS}">Status</th><th style="${thS}">Poslednji trening</th><th style="${thS}">Strava · AI</th></tr>
      ${sortirani.map(u => {
        const x = poId.get(u.id);
        return `<tr>
        <td style="${tdS}">${x && x.ime ? `<b>${esc(x.ime)}</b><br>` : ''}<span style="color:${x && x.ime ? B.priguseno : B.tekst};word-break:break-all">${esc(u.email)}</span></td>
        <td style="${tdS}">${status(x)}</td>
        <td style="${tdS}">${esc(fmtDateOnly(u.lastWorkoutDate))}${u.weekKm ? `<br><span style="color:${B.priguseno}">${esc(u.weekKm)} km ove ned.</span>` : ''}</td>
        <td style="${tdS}">${u.stravaConnected ? 'Strava' : `<span style="color:${B.priguseno}">bez Strave</span>`}<br><span style="color:${B.priguseno}">AI ${esc(fmtDateOnly(u.lastAiDay))}</span></td>
      </tr>`;
      }).join('')}</table>
      ${errors.rawState ? napomena(`Napomena: podaci o treningu nisu uspeli da se učitaju (${errors.rawState}) — kolone treninga mogu biti prazne.`) : ''}
      ${errors.aiUsage ? napomena(`Napomena: AI korišćenje nije uspelo da se učita (${errors.aiUsage}).`) : ''}
      ${errors.endpointUsage ? napomena(`Napomena: zapis o pozivima nije uspeo da se učita (${errors.endpointUsage}) — brojevi „Aktivnih" su zato prazni.`) : ''}`;
  }

  /* Odložena brisanja se prijavljuju SAMO kad ih ima — prazan red svakog jutra
     je šum koji se posle nedelju dana ne čita. */
  const b = brisanja || { obrisano: [], greske: [] };
  const brisanjaHtml = (b.obrisano.length || b.greske.length)
    ? karta('Odložena brisanja', '', `${b.obrisano.length ? `<div style="color:${B.sekundarno};font-size:12px">Izvršeno: ${esc(b.obrisano.join(', '))}</div>` : ''}
         ${b.greske.length ? `<div style="color:${B.kriticno};font-size:12px">NIJE uspelo: ${esc(b.greske.join(' · '))}</div>` : ''}`)
    : '';

  const datum = new Date().toLocaleDateString('sr-Latn-RS', { timeZone: 'Europe/Belgrade', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  return `<div style="margin:0;padding:0;background:${B.pozadina}">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${B.pozadina};font-family:${FONT}">
  <tr><td align="center" style="padding:24px 12px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:680px">
    <tr><td style="padding:0 4px 18px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
        <td><div style="font-size:20px;font-weight:800;color:${B.tekst}">SUB<span style="color:${B.brend}">-20</span> <span style="font-weight:600;color:${B.sekundarno}">· dnevni izveštaj</span></div>
          <div style="font-size:12px;color:${B.priguseno};margin-top:4px">${esc(datum)} · stanje u ${esc(new Date().toLocaleTimeString('sr-Latn-RS', { timeZone: 'Europe/Belgrade', hour: '2-digit', minute: '2-digit' }))}</div></td>
      </tr></table>
    </td></tr>
    <tr><td>
      ${plocice}
      ${zakljucciHtml}
      ${udeoHtml}
      ${levakHtml}
      ${vremeHtml}
      ${noviHtml}
      ${funkcijeHtml}
      ${planoviHtml}
      ${kandidatiHtml}
      ${brojeviHtml}
      ${karta('Svi korisnici', 'Po statusu, pa po adresi', usersHtml)}
      ${brisanjaHtml}
      <div style="font-size:11px;color:${B.priguseno};text-align:center;padding:8px 0 4px;line-height:1.6">
        „Trenira" = trening zabeležen kroz aplikaciju u poslednjih 14 dana. Trčanja uvezena sa Strave pre registracije se ne računaju.<br>
        Pravila statusa i kandidata žive u pogledu <code>admin_aktivnost</code> u bazi.
      </div>
    </td></tr>
  </table></td></tr></table></div>`;
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
  try { dogadjaji = await fetchDogadjaji(url, svcKey, new Date(Date.now() - 31 * 86400000).toISOString()); }
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

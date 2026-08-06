/* /api/activities.js — čitanje TRENINGA sa intervals.icu.

   ZAŠTO POSTOJI, KAD VEĆ POSTOJI STRAVA SYNC:
   Strava daje sirove streamove, pa aplikacija sama traži radne deonice
   (`detectWorkSegments`, prag brzine nad k-means podelom). To radi, ali je
   sopstvena heuristika i ume da promaši. intervals.icu je iste deonice VEĆ
   prepoznao — nad izvornim fajlom sa sata, ne nad Stravinom prekodiranom
   kopijom — i izlaže ih kroz `/activity/{id}/intervals`: svaki rep i svaki
   oporavak posebno, sa distancom, vremenom, pulsom, kadencom, GAP-om
   (tempo korigovan za nagib) i razdvajanjem (`decoupling`) PO REPU. Uz to
   korisnik te deonice može i ručno da ispravi u njihovom interfejsu.

   Zato je intervals.icu PRIMARAN izvor kad je povezan; Strava ostaje potpuno
   ravnopravna rezerva za sve koji intervals.icu nemaju i neće da ga prave.

   ZAŠTO PREKO SERVERA: isto što i /api/wellness — intervals.icu ne šalje CORS
   zaglavlja, a ključ ne sme da putuje iz pregledača ka trećoj strani.

   TRI REŽIMA, da odgovor uvek ostane ograničen:
     { oldest, newest }        -> spisak treninga u opsegu (sažeci)
     { detalji: [id, id, …] }  -> krugovi za do 12 traženih treninga
     { tokovi:  [id, id, …] }  -> sirovi tokovi za do 3 treninga, iz kojih se
                                  na uređaju računa po-km presek za lagana i
                                  duga trčanja (icu tu nema strukturu)

   U Vercel Project Settings -> Environment Variables treba da postoje:
   - SUPABASE_URL, SUPABASE_ANON_KEY  (isti kao za /api/analyze) */

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

/* OAuth token ili stari API ključ — identično kao /api/wellness. */
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
  const o = {
    id, datum,
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

export default async function handler(req, res) {
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

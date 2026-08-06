/* /api/wellness.js — čitanje jutarnjih podataka (HRV, puls u miru, san) sa
   intervals.icu.

   ZAŠTO PREKO SERVERA, A NE DIREKTNO IZ PREGLEDAČA:
   intervals.icu ne šalje CORS zaglavlja za pozive sa tuđih domena, pa bi
   `fetch` iz aplikacije bio blokiran. Uz to, ključ bi u tom slučaju putovao
   iz pregledača ka trećoj strani na svakom pozivu.

   ZAŠTO GARMIN IDE OVUDA:
   Garminov zvanični Health API traži partnerski program i poslovnu proveru.
   intervals.icu već prima Garmin sinhronizaciju i izlaže je kroz otvoren API
   sa običnim ključem — dakle isti podaci, bez čekanja na odobrenje.

   BEZBEDNOST:
   - zahtev mora nositi Supabase sesiju korisnika (isto kao /api/analyze);
     bez toga bi ovo bio otvoren proxy kroz koji svako može da gađa
     intervals.icu sa našeg servera;
   - ključ se NIKAD ne loguje i ne vraća u odgovoru;
   - vraća se samo ono što aplikaciji treba, ne ceo objekat.

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

export default async function handler(req, res) {
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

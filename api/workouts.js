/* /api/workouts.js — slanje planiranih treninga na intervals.icu kalendar,
   odakle ih intervals.icu prosleđuje na Garmin Connect i dalje na sat.

   LANAC: naš generator -> intervals.icu (kalendar) -> Garmin Connect -> sat.
   Da bi poslednja karika radila, korisnik u intervals.icu Settings mora da
   uključi "Upload planned workouts" i autorizuje Garmin Connect. Bez toga
   trening stiže u intervals.icu kalendar, ali ne i na sat.

   ZAŠTO PREKO SERVERA: intervals.icu ne šalje CORS zaglavlja (isto kao za
   /api/wellness), pa bi poziv iz pregledača bio blokiran.

   ZAŠTO `external_id` I `upsert`: svaki događaj nosi naš ID dana (npr.
   sub19-g5d3). Ponovno slanje tada AŽURIRA isti događaj umesto da napravi
   duplikat, a događaje koje nismo mi napravili ne diramo nikad. */

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
const MAX_DOGADJAJA = 60;   /* ~2 meseca plana; iznad toga je greška u pozivaocu */

export default async function handler(req, res) {
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

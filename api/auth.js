/* SUB-20 · Strava OAuth — OBE strane razmene tokena.

     GET  /api/auth?code=…           kod -> pristupni + refresh token (prva veza)
     POST /api/auth {refresh_token}  osvezavanje isteklog pristupnog tokena

   ZASTO U ISTOM FAJLU. Bilo je odvojeno (api/auth.js + api/refresh.js), ali
   Vercel Hobby plan dozvoljava najvise 12 serverless funkcija po deployu i
   trinaesta obara CEO build — pa se ne objavi nijedna izmena. Ova dva su
   najprirodniji par: ista dva tajna kljuca, ista provera prijave, isti Strava
   endpoint, razlika je samo u `grant_type`. Grananje ide po METODI, pa nema
   novog parametra ni mesta za zabunu.

   IZMENE (bezbednost):

   1) GET nosi kod, POST nosi refresh token. Svaka druga metoda se odbija.

   2) Osnovna provera oblika koda — Strava vraća heksadecimalni niz. Time se
      odbacuje očigledno smeće pre nego što potroši poziv ka Stravi.

   3) Zahteva prijavljenog korisnika (Supabase JWT). BEZ ovoga, bilo ko sa
      VAŽEĆIM Strava kodom — ne mora biti korisnik ove app — mogao je da
      pozove ovu putanju i iskoristi NAŠ client_secret da zameni kod za
      token. Pošto Strava ograničava broj naloga koji smeju da se povežu
      na jednu aplikaciju ("athlete capacity"), to bi trošilo ta ograničena
      mesta bez ikakve veze sa stvarnim korisnicima. Pošto je Supabase
      prijava sad OBAVEZNA pre bilo čega u app, do trenutka kad korisnik
      poveže Stravu već ima važeću sesiju — provera ovde ne menja tok,
      samo zatvara putanju za sve ostale.

   NAPOMENA O CSRF-u: zaštita od podmetnutog koda (napadač navede žrtvu na
   `…/?code=NJEGOV_KOD`, pa se žrtvina aplikacija poveže na NAPADAČEV Strava
   nalog) rešava se `state` parametrom — a to je posao KLIJENTA, ne ove
   putanje: klijent pravi nasumičan `state`, čuva ga lokalno i proverava po
   povratku. Server ga ne može proveriti bez čuvanja stanja. Ta izmena je
   urađena u index.html (stravaConnect / handleOAuthReturn). */

/* Provera Supabase sesije (UGRAĐENA, ne uvezena — isti razlog kao u
   analyze.js: Vercel funkcije preko GitHub web editora nemaju build korak,
   pa `import` iz zajedničkog fajla obara funkciju bez jasne poruke). */
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

/* Jedno mesto za oba poziva ka Stravi — razlikuju se samo poljem koje nose. */
async function kaStravi(res, dodatno) {
  const id = process.env.STRAVA_CLIENT_ID;
  const sec = process.env.STRAVA_CLIENT_SECRET;
  if (!id || !sec) {
    return res.status(500).json({ message: 'STRAVA_CLIENT_ID / STRAVA_CLIENT_SECRET nisu podešeni u Vercel → Settings → Environment Variables' });
  }
  try {
    const r = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: id, client_secret: sec, ...dodatno })
    });
    const j = await r.json();
    return res.status(r.ok ? 200 : r.status).json(j);
  } catch (e) {
    return res.status(502).json({ message: 'Strava nedostupna: ' + e.message });
  }
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
    const r = await fetch(url.replace(/\/+$/, '') + '/rest/v1/rpc/check_and_bump_endpoint', {
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
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ message: 'Samo GET ili POST.' });
  }

  /* POST zahteva Content-Type: application/json. Time se blokira zloupotreba sa
     TUDJEG sajta preko obicnog <form> POST-a — takav zahtev ne moze da postavi
     ovo zaglavlje bez preflight provere, a preflight ne odobravamo (nema CORS
     zaglavlja). */
  if (req.method === 'POST') {
    const ct = String(req.headers['content-type'] || '');
    if (!ct.includes('application/json')) {
      return res.status(415).json({ message: 'Očekuje se Content-Type: application/json.' });
    }
  }

  /* Zahteva prijavljenog korisnika, na OBE grane.
     Bez toga bi svako sa vazecim Strava kodom — ne mora biti korisnik ove app —
     mogao da iskoristi NAS client_secret da zameni kod za token i tako trosi
     ogranicena mesta ("athlete capacity"). Na POST grani je razlog jos
     direktniji: putanja je nekad bila potpuno otvorena, pa je svako sa
     ukradenim refresh tokenom mogao da kuje pristupne tokene nasim kljucem. */
  const auth = await requireUser(req);
  if (!auth.ok) return res.status(auth.status).json({ message: auth.error });

  /* Limit je velikodušan: pregledač osvežava token na svaki sat, a Strava se
     povezuje jednom. Sto poziva dnevno nijedan pravi korisnik ne dosegne, a
     petlja ga dosegne u sekundi. */
  if (await limitPrekoracen(auth.token, 'strava_token', 100)) {
    return res.status(429).json({ message: 'Previše poziva ka Stravi danas. Probaj ponovo sutra.' });
  }

  /* ---------- GET: prva veza, kod -> tokeni ---------- */
  if (req.method === 'GET') {
    const code = (req.query && req.query.code) || '';
    if (!code) return res.status(400).json({ message: 'Nedostaje code parametar' });
    /* Strava vraca heksadecimalni niz — ocigledno smece se odbacuje pre nego
       sto potrosi poziv ka Stravi. */
    if (typeof code !== 'string' || code.length > 128 || !/^[a-f0-9]+$/i.test(code)) {
      return res.status(400).json({ message: 'Neispravan oblik koda.' });
    }
    return kaStravi(res, { code, grant_type: 'authorization_code' });
  }

  /* ---------- POST: osvezavanje ---------- */
  let rt = '';
  try {
    const b = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    rt = (b && b.refresh_token) || '';
  } catch (e) {
    return res.status(400).json({ message: 'Neispravan JSON.' });
  }
  if (!rt || typeof rt !== 'string') {
    return res.status(400).json({ message: 'Nedostaje refresh_token' });
  }
  return kaStravi(res, { refresh_token: rt, grant_type: 'refresh_token' });
}

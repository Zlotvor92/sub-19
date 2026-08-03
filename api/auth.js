/* SUB-20 · Strava OAuth — razmena koda za tokene.
   Čita STRAVA_CLIENT_ID i STRAVA_CLIENT_SECRET iz Vercel Environment Variables.

   IZMENE (bezbednost):

   1) Prihvata se samo GET (klijent zove `fetch('/api/auth?code=…')`).

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

/* Provera Supabase sesije (UGRAĐENA, ne uvezena — isti razlog kao u analyze.js
   i refresh.js: Vercel funkcije preko GitHub web editora nemaju build korak,
   pa `import` iz zajedničkog fajla obara funkciju bez jasne poruke). */
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
  try {
    const r = await fetch(url.replace(/\/+$/, '') + '/auth/v1/user', {
      headers: { apikey: anon, Authorization: 'Bearer ' + m[1] }
    });
    if (!r.ok) return { ok: false, status: 401, error: 'Prijava je istekla — prijavi se ponovo.' };
    const u = await r.json();
    if (!u || !u.id) return { ok: false, status: 401, error: 'Neispravna prijava.' };
    return { ok: true, userId: u.id, email: u.email || null };
  } catch (e) {
    return { ok: false, status: 503, error: 'Provera prijave trenutno nije moguća.' };
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ message: 'Samo GET.' });
  }

  const auth = await requireUser(req);
  if (!auth.ok) return res.status(auth.status).json({ message: auth.error });

  const code = (req.query && req.query.code) || '';
  if (!code) return res.status(400).json({ message: 'Nedostaje code parametar' });
  if (typeof code !== 'string' || code.length > 128 || !/^[a-f0-9]+$/i.test(code)) {
    return res.status(400).json({ message: 'Neispravan oblik koda.' });
  }

  const id = process.env.STRAVA_CLIENT_ID;
  const sec = process.env.STRAVA_CLIENT_SECRET;
  if (!id || !sec) {
    return res.status(500).json({ message: 'STRAVA_CLIENT_ID / STRAVA_CLIENT_SECRET nisu podešeni u Vercel → Settings → Environment Variables' });
  }

  try {
    const r = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: id, client_secret: sec, code, grant_type: 'authorization_code' })
    });
    const j = await r.json();
    return res.status(r.ok ? 200 : r.status).json(j);
  } catch (e) {
    return res.status(502).json({ message: 'Strava nedostupna: ' + e.message });
  }
}

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

/* ACTIVITY:READ je dodat da bi intervals.icu mogao da bude PRIMARAN izvor
   treninga (v. /api/activities.js). Ko je vec povezan, ima token BEZ tog
   opsega — njegovi pozivi ka treninzima vratice 403, sto /api/activities
   prevodi u poruku „otkaci pa ponovo povezi". Wellness mu i dalje radi, pa
   ponovno povezivanje nije hitno nego dobitak. */
const SCOPE = 'ACTIVITY:READ,WELLNESS:READ,CALENDAR:WRITE,SETTINGS:WRITE';

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
    return { ok: true, userId: u.id };
  } catch (e) {
    return { ok: false, status: 503, error: 'Provera prijave trenutno nije moguća.' };
  }
}

/* Adresa na koju intervals.icu vraća korisnika. Mora se DOSLOVNO poklapati sa
   onim što je prijavljeno pri traženju client_id-a, uključujući kosu crtu. */
function povratnaAdresa(req) {
  if (process.env.ICU_REDIRECT_URI) return process.env.ICU_REDIRECT_URI;
  const host  = req.headers['x-forwarded-host'] || req.headers.host || '';
  const proto = req.headers['x-forwarded-proto'] || 'https';
  return proto + '://' + host + '/';
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
    const url = 'https://intervals.icu/oauth/authorize'
      + '?client_id=' + encodeURIComponent(clientId)
      + '&redirect_uri=' + encodeURIComponent(povratnaAdresa(req))
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

  /* Njihov endpoint prima form-urlencoded, ne JSON. */
  const params = new URLSearchParams();
  params.set('client_id', clientId);
  params.set('client_secret', clientSecret);
  params.set('code', code);

  try {
    const r = await fetch('https://intervals.icu/api/oauth/token', {
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

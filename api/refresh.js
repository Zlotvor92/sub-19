/* SUB-20 · Strava OAuth — osvežavanje isteklog access tokena.

   IZMENE U ODNOSU NA PRETHODNU VERZIJU (bezbednost):

   1) refresh_token se VIŠE NE ČITA iz query stringa.
      Ranije je postojao `req.query.refresh_token` kao rezerva — a klijent ga
      nikad tako ne šalje (uvek POST + JSON telo). Bio je to mrtav kod koji
      je stvarao stvaran rizik: tokeni u URL-u završe u Vercel logovima,
      istoriji pretraživača, Referer zaglavljima i log-ovima posrednika.
      Uklonjeno bez ikakvog uticaja na aplikaciju.

   2) Prihvata se samo POST.

   3) Zahteva se Content-Type: application/json.
      Ovo blokira zloupotrebu sa TUĐEG sajta preko obicnog <form> POST-a —
      takav zahtev ne može da postavi ovo zaglavlje bez preflight provere,
      a preflight ne odobravamo (nema CORS zaglavlja).

   ŠTA OVO NE REŠAVA — iskreno: ko VEĆ ima tuđi refresh_token, može ovu
   putanju pozvati skriptom (curl) i dobiti access token, koristeći naš
   client_secret. Pravi lek je autentifikacija zahteva (Supabase JWT), ne
   dodatna zaglavlja. Ozbiljnost je ipak niska: da bi neko imao refresh_token,
   morao bi već da ima pristup uređaju žrtve. */
/* --- Provera Supabase sesije (UGRAĐENA, ne uvezena) ---
   Ranije je ovo bio zajednički `_auth.js` sa `import`-om. Vercel funkcije
   deployovane preko GitHub web editora nemaju build korak ni package.json
   podešavanje, pa je uvoz pomoćnog fajla obarao funkciju — a Vercel tada
   vrati HTML stranicu "A server error has occurred". Klijent na to radi
   `response.json()` i dobije nerazumljivo "...is not valid JSON" (Chrome)
   odnosno "The string did not match the expected pattern" (Safari).
   Zato je provera ugrađena u svaki fajl: par linija duplikata je jeftinije
   od cele klase problema sa razrešavanjem modula. */
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
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ message: 'Samo POST.' });
  }
  const ct = String(req.headers['content-type'] || '');
  if (!ct.includes('application/json')) {
    return res.status(415).json({ message: 'Očekuje se Content-Type: application/json.' });
  }

  /* Zahteva prijavljenog korisnika. Ranije je putanja bila potpuno otvorena —
     svako je mogao da je pozove i, uz ukraden refresh token, koristi NAS
     client_secret da kuje pristupne tokene. */
  const auth = await requireUser(req);
  if (!auth.ok) return res.status(auth.status).json({ message: auth.error });

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

  const id = process.env.STRAVA_CLIENT_ID;
  const sec = process.env.STRAVA_CLIENT_SECRET;
  if (!id || !sec) {
    return res.status(500).json({ message: 'STRAVA_CLIENT_ID / STRAVA_CLIENT_SECRET nisu podešeni u Vercel → Settings → Environment Variables' });
  }

  try {
    const r = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: id, client_secret: sec, refresh_token: rt, grant_type: 'refresh_token' })
    });
    const j = await r.json();
    return res.status(r.ok ? 200 : r.status).json(j);
  } catch (e) {
    return res.status(502).json({ message: 'Strava nedostupna: ' + e.message });
  }
}

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

  let body;
  try { body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body; }
  catch { res.status(400).json({ error: 'Neispravan JSON.' }); return; }

  const athleteId = String((body && body.athleteId) || '').trim();
  const apiKey    = String((body && body.apiKey) || '').trim();
  const oldest    = String((body && body.oldest) || '').trim();
  const newest    = String((body && body.newest) || '').trim();

  if (!/^i?\d+$/.test(athleteId)) { res.status(400).json({ error: 'Neispravan intervals.icu ID sportiste.' }); return; }
  if (apiKey.length < 8 || apiKey.length > 200) { res.status(400).json({ error: 'Neispravan API ključ.' }); return; }
  if (!DAN.test(oldest) || !DAN.test(newest)) { res.status(400).json({ error: 'Neispravan opseg datuma.' }); return; }
  if (newest < oldest) { res.status(400).json({ error: 'Kraj opsega je pre početka.' }); return; }

  const url = 'https://intervals.icu/api/v1/athlete/' + encodeURIComponent(athleteId) +
              '/wellness?oldest=' + oldest + '&newest=' + newest;
  /* intervals.icu koristi basic auth sa fiksnim korisničkim imenom API_KEY. */
  const basic = Buffer.from('API_KEY:' + apiKey).toString('base64');

  try {
    const r = await fetch(url, { headers: { Authorization: 'Basic ' + basic, Accept: 'application/json' } });
    if (r.status === 401 || r.status === 403) {
      res.status(401).json({ error: 'intervals.icu je odbio ključ. Proveri ID sportiste i API ključ u Settings → Developer.' });
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

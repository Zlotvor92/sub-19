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
        for (const e of nasi) {
          await fetch('https://intervals.icu/api/v1/athlete/' + encodeURIComponent(athleteId) +
                      '/events/' + encodeURIComponent(e.id), { method: 'DELETE', headers: zaglavlja });
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

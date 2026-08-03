/* SUB-20 · Prijava buga — korisnik opiše problem, stiže na mejl preko Resend-a.

   Isti obrazac kao ostali api/ fajlovi: JWT provera UGRAĐENA (ne import iz
   _auth.js — Vercel funkcije preko GitHub web editora nemaju build korak,
   import bi oborio funkciju bez jasne poruke, već viđeno u ovom projektu).

   POTREBNE Vercel Environment Variables (iste koje daily-report.js već koristi):
   - SUPABASE_URL, SUPABASE_ANON_KEY   (JWT provera + rate limit RPC)
   - RESEND_API_KEY, REPORT_TO, REPORT_FROM   (slanje mejla) */

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
    return { ok: true, userId: u.id, email: u.email || null, token: m[1] };
  } catch (e) {
    return { ok: false, status: 503, error: 'Provera prijave trenutno nije moguća.' };
  }
}

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Samo POST.' });
  }

  const auth = await requireUser(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  /* Jasna poruka odmah, umesto da se cita iz Resend-ove sirove greske
     (tacno ono sto se desilo: REPORT_TO nedostajao, korisnik je video
     "Missing `to` field" i morao da nagadja sta to znaci). */
  const missing = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'RESEND_API_KEY', 'REPORT_TO', 'REPORT_FROM']
    .filter(k => !process.env[k]);
  if (missing.length) return res.status(500).json({ error: 'Nedostaju env varijable: ' + missing.join(', ') });

  /* Dnevni limit — ista atomska funkcija kao za AI analizu, ODVOJEN brojač
     (bug_report_usage, ne api_usage) da koriscenje jednog ne blokira drugo. */
  const DAILY_LIMIT = 10;
  try {
    const rl = await fetch(process.env.SUPABASE_URL.replace(/\/+$/, '') + '/rest/v1/rpc/check_and_bump_bug_usage', {
      method: 'POST',
      headers: {
        apikey: process.env.SUPABASE_ANON_KEY,
        Authorization: 'Bearer ' + auth.token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ p_limit: DAILY_LIMIT })
    });
    if (!rl.ok) {
      const errBody = await rl.text();
      if (errBody.includes('DAILY_LIMIT_EXCEEDED')) {
        return res.status(429).json({ error: 'Dnevni limit prijava (' + DAILY_LIMIT + ') je iskorišćen. Pokušaj ponovo sutra.' });
      }
      /* Tabela/funkcija mozda jos nije podesena (stara sema) — ne blokiramo
         korisnika, ali se to mora videti u logovima (v. isti komentar u
         api/analyze.js): limit koji tiho otkaze izgleda kao limit koji radi. */
      console.warn('[limit] brojac nije radio (bug_report_usage) — propusteno bez brojanja. HTTP %s: %s',
        rl.status, errBody.slice(0, 200));
    }
  } catch (e) {
    console.warn('[limit] brojac nedostupan (bug_report_usage) — propusteno bez brojanja: %s', e.message);
  }

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({ error: 'Neispravan JSON.' });
  }

  const description = (body && typeof body.description === 'string') ? body.description.trim() : '';
  if (!description) return res.status(400).json({ error: 'Opis je prazan.' });
  if (description.length > 3000) return res.status(400).json({ error: 'Opis je predugačak (max 3000 znakova).' });

  /* Kontekst je klijent šalje, dakle nepouzdan — escape pre ubacivanja u
     HTML mejl (ista klasa greske kao u daily-report.js: bez ovoga bi
     zlonameran userAgent/tab mogao da ubaci HTML u mejl). Dužina ograničena
     posebno, ne oslanjamo se samo na escape. */
  const cap = (s, n) => esc(String(s == null ? '' : s).slice(0, n));
  const ctx = body && body.context ? body.context : {};

  const html = `<div style="font-family:-apple-system,sans-serif;max-width:520px;margin:0 auto;padding:20px;background:#0A0A0F;color:#F5F5F7">
    <div style="font-weight:800;font-size:18px;margin-bottom:4px">SUB<span style="color:#FA2E55">-20</span> — prijava buga</div>
    <div style="color:#7A7A86;font-size:12px;margin-bottom:18px">${esc(new Date().toLocaleString('sr-RS'))}</div>
    <div style="background:#16161D;border-radius:12px;padding:16px;margin-bottom:16px;white-space:pre-wrap;font-size:14px;line-height:1.5">${cap(description, 3000)}</div>
    <table style="border-collapse:collapse;width:100%;font-size:12px;color:#7A7A86">
      <tr><td style="padding:3px 0">Prijavio</td><td style="padding:3px 0;color:#F5F5F7">${esc(auth.email || auth.userId)}</td></tr>
      <tr><td style="padding:3px 0">Verzija app</td><td style="padding:3px 0;color:#F5F5F7">${cap(ctx.version, 20)}</td></tr>
      <tr><td style="padding:3px 0">Ekran</td><td style="padding:3px 0;color:#F5F5F7">${cap(ctx.tab, 40)}</td></tr>
      <tr><td style="padding:3px 0">Uređaj</td><td style="padding:3px 0;color:#F5F5F7">${cap(ctx.userAgent, 200)}</td></tr>
    </table>
  </div>`;

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + process.env.RESEND_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.REPORT_FROM,
        to: process.env.REPORT_TO,
        subject: 'SUB-20 bug — ' + description.slice(0, 60),
        html
      })
    });
    const j = await r.json();
    if (!r.ok) return res.status(502).json({ error: 'Resend greška: ' + JSON.stringify(j) });
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(502).json({ error: 'Slanje mejla nije uspelo: ' + e.message });
  }
}

/* SUB-20 · Dnevni izveštaj — Vercel Cron, jednom dnevno (vidi vercel.json).

   IZMENA (v2): Ranije se "aktivnost" merila kroz user_state.updated_at —
   vreme POSLEDNJEG USPEŠNOG UPISA u Supabase. To je POSREDAN signal: ako
   pozadinska sinhronizacija nije uspela (token istekao u tom trenutku, app
   zatvorena pre nego što je odloženi upis stigao da se izvrši — sync je
   odložen 4s posle svakog save()), lokalni podaci su ažurni a Supabase to
   ne zna, pa izveštaj pokazuje lažno staru "poslednju aktivnost".

   Sada se čita SADRŽAJ podataka (user_state.data, isti JSON koji app čuva),
   i iz njega se IZVLAČI: poslednji stvarno odrađen trening (log status=done,
   po ts polju — datum kad je STVARNO trčano, ne planiran dan), km ove
   nedelje, poslednji Strava sync. Direktan signal, ne posredan.

   AI korišćenje se NE čita iz user_state (analiza se ne čuva u stanju) —
   čita se iz api_usage tabele, koja VEĆ postoji za dnevni limit i sama
   po sebi je tačan zapis "kog dana je ovaj korisnik pozvao AI analizu".

   TOK:
   1) Vercel poziva ovu putanju, CRON_SECRET provera (nepromenjeno).
   2) app_stats pogled — agregatni brojevi za vrh mejla (nepromenjeno).
   3) SIROV user_state.data za SVAKOG korisnika (NOVO) — service_role
      zaobilazi RLS namerno, ovo je jedino mesto gde taj ključ sme da postoji.
   4) api_usage dani sa pozivima > 0, po korisniku (NOVO) — za "poslednja AI
      analiza".
   5) Lista naloga (email) preko Admin API-ja — kao pre.
   6) Sve se spaja po user_id u JEDNU tabelu po korisniku. Svaki od koraka
      3-5 je u SOPSTVENOM try/catch — ako neki padne, ostali podaci i dalje
      stižu, samo se ta kolona prikaže kao nepoznata.
   7) Mejl preko Resend-a.

   POTREBNE Vercel Environment Variables — NEPROMENJENO od ranije verzije:
   CRON_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY,
   REPORT_TO, REPORT_FROM. */

function checkCron(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const h = req.headers.authorization || req.headers.Authorization || '';
  const want = 'Bearer ' + secret;
  if (h.length !== want.length) return false;
  let diff = 0;
  for (let i = 0; i < h.length; i++) diff |= h.charCodeAt(i) ^ want.charCodeAt(i);
  return diff === 0;
}

async function fetchStats(url, key) {
  const r = await fetch(url.replace(/\/+$/, '') + '/rest/v1/app_stats?select=*', {
    headers: { apikey: key, Authorization: 'Bearer ' + key }
  });
  if (!r.ok) throw new Error('app_stats upit nije uspeo (' + r.status + ')');
  const rows = await r.json();
  return (rows && rows[0]) || {};
}

async function fetchRawUserState(url, key) {
  const r = await fetch(url.replace(/\/+$/, '') + '/rest/v1/user_state?select=user_id,data,updated_at', {
    headers: { apikey: key, Authorization: 'Bearer ' + key }
  });
  if (!r.ok) throw new Error('user_state upit nije uspeo (' + r.status + ')');
  return await r.json();
}

async function fetchAiUsageDays(url, key) {
  const r = await fetch(url.replace(/\/+$/, '') + '/rest/v1/api_usage?select=user_id,day,calls&calls=gt.0&order=day.desc', {
    headers: { apikey: key, Authorization: 'Bearer ' + key }
  });
  if (!r.ok) throw new Error('api_usage upit nije uspeo (' + r.status + ')');
  const rows = await r.json();
  const lastByUser = {};
  for (const row of rows) {
    if (!(row.user_id in lastByUser)) lastByUser[row.user_id] = row.day;
  }
  return lastByUser;
}

async function fetchUserList(url, key) {
  const r = await fetch(url.replace(/\/+$/, '') + '/auth/v1/admin/users?per_page=200', {
    headers: { apikey: key, Authorization: 'Bearer ' + key }
  });
  if (!r.ok) throw new Error('lista korisnika nije uspela (' + r.status + ')');
  const j = await r.json();
  const users = Array.isArray(j) ? j : (Array.isArray(j.users) ? j.users : []);
  return users.map(u => ({
    id: u.id,
    email: u.email || '(bez email-a)',
    created: u.created_at || null,
    lastSignIn: u.last_sign_in_at || null
  }));
}

function mondayOfWeekUTC(dateStr) {
  const d = new Date(dateStr + 'T00:00:00Z');
  const wd = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - wd);
  return d.toISOString().slice(0, 10);
}

function deriveActivity(data, todayStr) {
  const log = (data && data.log) || {};
  const entries = Object.values(log).filter(e => e && e.status === 'done');

  let lastWorkout = null;
  for (const e of entries) {
    const d = e.ts;
    if (d && typeof d === 'string' && (!lastWorkout || d > lastWorkout.date)) {
      lastWorkout = { date: d, km: typeof e.km === 'number' ? e.km : null };
    }
  }

  const monday = mondayOfWeekUTC(todayStr);
  let weekKm = 0;
  for (const e of entries) {
    if (typeof e.ts === 'string' && e.ts >= monday && e.ts <= todayStr && typeof e.km === 'number') {
      weekKm += e.km;
    }
  }

  const lastStravaSync = (data && data.strava && data.strava.lastSync)
    ? new Date(data.strava.lastSync).toISOString() : null;
  /* "Povezan" = objekat postoji uopšte (OAuth uspešno završen bar jednom),
     ne da li je TRENUTNI token još važeći — to bi tražilo živ poziv ka
     Stravi, nepotrebno za ovaj izveštaj. */
  const stravaConnected = !!(data && data.strava);
  const stravaAthlete = (data && data.strava && data.strava.athlete) || null;

  return {
    lastWorkoutDate: lastWorkout ? lastWorkout.date : null,
    weekKm: Math.round(weekKm * 10) / 10,
    lastStravaSync,
    stravaConnected,
    stravaAthlete
  };
}

function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('sr-RS', { day: '2-digit', month: '2-digit', year: 'numeric' })
    + ' ' + d.toLocaleTimeString('sr-RS', { hour: '2-digit', minute: '2-digit' });
}
function fmtDateOnly(ymd) {
  if (!ymd) return '—';
  const parts = ymd.split('-');
  const y = parts[0], m = parts[1], d = parts[2];
  return d && m && y ? (d + '.' + m + '.' + y + '.') : '—';
}
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function mergeRows(users, rawStates, aiDays, todayStr) {
  const stateById = {};
  for (const row of (rawStates || [])) stateById[row.user_id] = row;

  return (users || []).map(u => {
    const st = stateById[u.id];
    const act = st ? deriveActivity(st.data, todayStr) : { lastWorkoutDate: null, weekKm: 0, lastStravaSync: null, stravaConnected: false, stravaAthlete: null };
    return {
      email: u.email,
      created: u.created,
      lastSignIn: u.lastSignIn,
      lastWorkoutDate: act.lastWorkoutDate,
      weekKm: act.weekKm,
      lastStravaSync: act.lastStravaSync,
      stravaConnected: act.stravaConnected,
      stravaAthlete: act.stravaAthlete,
      lastAiDay: (aiDays && aiDays[u.id]) || null
    };
  });
}

function buildHtml(stats, rows, errors, todayStr) {
  const row = (label, val) =>
    `<tr><td style="padding:6px 14px;color:#7A7A86;font-size:13px">${esc(label)}</td>` +
    `<td style="padding:6px 14px;font-weight:700;font-size:15px">${esc(val)}</td></tr>`;

  let usersHtml;
  if (errors.users) {
    usersHtml = `<p style="color:#7A7A86;font-size:13px">Lista korisnika nije uspela: ${esc(errors.users)}. Brojevi gore su i dalje tačni.</p>`;
  } else if (!rows.length) {
    usersHtml = `<p style="color:#7A7A86;font-size:13px">Nema registrovanih korisnika.</p>`;
  } else {
    const th = t => `<th style="padding:6px 10px;white-space:nowrap">${t}</th>`;
    const td = t => `<td style="padding:5px 10px;white-space:nowrap">${t}</td>`;
    const stravaCell = u => u.stravaConnected
      ? esc(u.stravaAthlete || '(bez imena)') + '<br><span style="color:#7A7A86;font-size:11px">sync ' + esc(fmtDate(u.lastStravaSync)) + '</span>'
      : '<span style="color:#7A7A86">nije povezano</span>';
    usersHtml = `<div style="overflow-x:auto"><table style="border-collapse:collapse;width:100%;font-size:12px">
      <tr style="text-align:left;color:#7A7A86">${th('Email')}${th('Poslednji trening')}${th('Km ove nedelje')}${th('Strava')}${th('AI analiza')}${th('Prijava')}</tr>
      ${rows.map(u => `<tr>
        ${td(esc(u.email))}
        ${td(esc(fmtDateOnly(u.lastWorkoutDate)))}
        ${td(esc(u.weekKm) + ' km')}
        ${td(stravaCell(u))}
        ${td(esc(fmtDateOnly(u.lastAiDay)))}
        ${td(esc(fmtDate(u.lastSignIn)))}
      </tr>`).join('')}
      </table></div>
      ${errors.rawState ? `<p style="color:#7A7A86;font-size:12px;margin-top:8px">Napomena: podaci o treningu nisu uspeli da se učitaju (${esc(errors.rawState)}) — kolone treninga mogu biti prazne.</p>` : ''}
      ${errors.aiUsage ? `<p style="color:#7A7A86;font-size:12px;margin-top:4px">Napomena: AI korišćenje nije uspelo da se učita (${esc(errors.aiUsage)}).</p>` : ''}`;
  }

  return `<div style="font-family:-apple-system,sans-serif;max-width:640px;margin:0 auto;padding:20px;background:#0A0A0F;color:#F5F5F7">
    <div style="font-weight:800;font-size:18px;margin-bottom:4px">SUB<span style="color:#FA2E55">-20</span> — dnevni izveštaj</div>
    <div style="color:#7A7A86;font-size:12px;margin-bottom:18px">${esc(new Date().toLocaleDateString('sr-RS', { day: '2-digit', month: 'long', year: 'numeric' }))}</div>
    <table style="border-collapse:collapse;width:100%;background:#16161D;border-radius:12px;overflow:hidden;margin-bottom:22px">
      ${row('Korisnika ukupno', stats.korisnika ?? 0)}
      ${row('Aktivnih (24h)', stats.aktivnih_24h ?? 0)}
      ${row('Aktivnih (7 dana)', stats.aktivnih_7d ?? 0)}
      ${row('Aktivnih (30 dana)', stats.aktivnih_30d ?? 0)}
      ${row('Novih (7 dana)', stats.novih_7d ?? 0)}
      ${row('Sa generisanim planom', stats.sa_generisanim_planom ?? 0)}
    </table>
    <div style="font-weight:700;font-size:13px;letter-spacing:.04em;text-transform:uppercase;color:#7A7A86;margin-bottom:8px">Aktivnost po korisniku</div>
    ${usersHtml}
  </div>`;
}

export default async function handler(req, res) {
  if (!checkCron(req)) return res.status(401).json({ error: 'Neautorizovano.' });

  const url = process.env.SUPABASE_URL;
  const svcKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const resendKey = process.env.RESEND_API_KEY;
  const to = process.env.REPORT_TO;
  const from = process.env.REPORT_FROM;
  const missing = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'RESEND_API_KEY', 'REPORT_TO', 'REPORT_FROM']
    .filter(k => !process.env[k]);
  if (missing.length) return res.status(500).json({ error: 'Nedostaju env varijable: ' + missing.join(', ') });

  let stats;
  try {
    stats = await fetchStats(url, svcKey);
  } catch (e) {
    return res.status(502).json({ error: 'Statistika nije uspela: ' + e.message });
  }

  const todayStr = new Date().toISOString().slice(0, 10);
  const errors = {};

  let users = [];
  try { users = await fetchUserList(url, svcKey); }
  catch (e) { errors.users = e.message; }

  let rawStates = [];
  try { rawStates = await fetchRawUserState(url, svcKey); }
  catch (e) { errors.rawState = e.message; }

  let aiDays = {};
  try { aiDays = await fetchAiUsageDays(url, svcKey); }
  catch (e) { errors.aiUsage = e.message; }

  const rows = mergeRows(users, rawStates, aiDays, todayStr);
  const html = buildHtml(stats, rows, errors, todayStr);

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + resendKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from, to,
        subject: 'SUB-20 dnevni izveštaj — ' + (stats.korisnika ?? 0) + ' korisnika',
        html
      })
    });
    const j = await r.json();
    if (!r.ok) return res.status(502).json({ error: 'Resend greška: ' + JSON.stringify(j) });
    return res.status(200).json({ ok: true, sent: j.id || true });
  } catch (e) {
    return res.status(502).json({ error: 'Slanje mejla nije uspelo: ' + e.message });
  }
}

/* SUB-20 · Dnevni izveštaj — Vercel Cron, jednom dnevno (vidi vercel.json).

   TOK:
   1) Vercel sam poziva ovu putanju, šalje CRON_SECRET kao Authorization header
      (dokumentovano Vercel ponašanje — mi samo uporedimo da se poklapa).
   2) Povučemo app_stats pogled (agregatni brojevi, već testiran) preko
      SUPABASE_SERVICE_ROLE_KEY — ovo je JEDINO mesto u celom projektu gde je
      service_role ključ ispravan izbor: čisto serversko, nikad ne dodiruje
      frontend, i svrha mu je baš da zaobiđe RLS radi administrativnog uvida.
   3) Odvojeno, u SOPSTVENOM try/catch, povučemo listu prijavljenih naloga
      (email, poslednja prijava) preko Supabase Admin API-ja. Ovo je manje
      sigurna putanja (oblik odgovora nije isto potvrđen kao za app_stats),
      pa ako padne, OSNOVNI izveštaj sa brojevima svejedno stiže.
   4) Pošaljemo HTML mejl preko Resend-a (RESEND_API_KEY).

   POTREBNE Vercel Environment Variables (Settings → Environment Variables):
   - CRON_SECRET              (bilo koji dug nasumičan string — Vercel ga šalje sam)
   - SUPABASE_URL             (isti kao za ostale api/ fajlove)
   - SUPABASE_SERVICE_ROLE_KEY (Project Settings → API Keys → service_role —
                                 NIKAD u frontend, samo ovde)
   - RESEND_API_KEY           (resend.com, besplatan nivo dovoljan)
   - REPORT_TO                (mejl adresa na koju izveštaj stiže — tvoja)
   - REPORT_FROM               (npr. 'SUB-20 <onboarding@resend.dev>' dok ne
                                 verifikuješ sopstveni domen na Resend-u) */

function checkCron(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const h = req.headers.authorization || req.headers.Authorization || '';
  return h === 'Bearer ' + secret;
}

async function fetchStats(url, key) {
  const r = await fetch(url.replace(/\/+$/, '') + '/rest/v1/app_stats?select=*', {
    headers: { apikey: key, Authorization: 'Bearer ' + key }
  });
  if (!r.ok) throw new Error('app_stats upit nije uspeo (' + r.status + ')');
  const rows = await r.json();
  return (rows && rows[0]) || {};
}

/* Odvojeno od fetchStats — namerno manje pouzdano (Admin API oblik odgovora
   nije potvrđen sa istim nivoom sigurnosti), pa NIKAD ne sme da obori ceo
   izveštaj ako padne. Pozivalac ovo hvata u sopstveni try/catch. */
async function fetchUserList(url, key) {
  const r = await fetch(url.replace(/\/+$/, '') + '/auth/v1/admin/users?per_page=200', {
    headers: { apikey: key, Authorization: 'Bearer ' + key }
  });
  if (!r.ok) throw new Error('lista korisnika nije uspela (' + r.status + ')');
  const j = await r.json();
  const users = Array.isArray(j) ? j : (Array.isArray(j.users) ? j.users : []);
  return users.map(u => ({
    email: u.email || '(bez email-a)',
    created: u.created_at || null,
    lastSignIn: u.last_sign_in_at || null
  }));
}

function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('sr-RS', { day: '2-digit', month: '2-digit', year: 'numeric' })
    + ' ' + d.toLocaleTimeString('sr-RS', { hour: '2-digit', minute: '2-digit' });
}
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function buildHtml(stats, users, usersError) {
  const row = (label, val) =>
    `<tr><td style="padding:6px 14px;color:#7A7A86;font-size:13px">${esc(label)}</td>` +
    `<td style="padding:6px 14px;font-weight:700;font-size:15px">${esc(val)}</td></tr>`;

  let usersHtml;
  if (usersError) {
    usersHtml = `<p style="color:#7A7A86;font-size:13px">Lista korisnika nije uspela ovog puta: ${esc(usersError)}. Brojevi gore su i dalje tačni.</p>`;
  } else if (!users.length) {
    usersHtml = `<p style="color:#7A7A86;font-size:13px">Nema registrovanih korisnika.</p>`;
  } else {
    usersHtml = `<table style="border-collapse:collapse;width:100%;font-size:13px">
      <tr style="text-align:left;color:#7A7A86"><th style="padding:6px 14px">Email</th><th style="padding:6px 14px">Registrovan</th><th style="padding:6px 14px">Poslednja prijava</th></tr>
      ${users.map(u => `<tr><td style="padding:5px 14px">${esc(u.email)}</td><td style="padding:5px 14px">${esc(fmtDate(u.created))}</td><td style="padding:5px 14px">${esc(fmtDate(u.lastSignIn))}</td></tr>`).join('')}
      </table>`;
  }

  return `<div style="font-family:-apple-system,sans-serif;max-width:520px;margin:0 auto;padding:20px;background:#0A0A0F;color:#F5F5F7">
    <div style="font-weight:800;font-size:18px;margin-bottom:4px">SUB<span style="color:#FA2E55">-20</span> — dnevni izveštaj</div>
    <div style="color:#7A7A86;font-size:12px;margin-bottom:18px">${esc(new Date().toLocaleDateString('sr-RS', { day: '2-digit', month: 'long', year: 'numeric' }))}</div>
    <table style="border-collapse:collapse;width:100%;background:#16161D;border-radius:12px;overflow:hidden;margin-bottom:22px">
      ${row('Korisnika ukupno', stats.korisnika ?? 0)}
      ${row('Aktivnih (24h)', stats.aktivnih_24h ?? 0)}
      ${row('Aktivnih (7 dana)', stats.aktivnih_7d ?? 0)}
      ${row('Aktivnih (30 dana)', stats.aktivnih_30d ?? 0)}
      ${row('Novih (7 dana)', stats.novih_7d ?? 0)}
      ${row('Prosek treninga/korisnik', stats.prosek_treninga ?? '—')}
      ${row('Prosek VDOT unosa/korisnik', stats.prosek_vdot_unosa ?? '—')}
      ${row('Sa generisanim planom', stats.sa_generisanim_planom ?? 0)}
    </table>
    <div style="font-weight:700;font-size:13px;letter-spacing:.04em;text-transform:uppercase;color:#7A7A86;margin-bottom:8px">Registrovani korisnici</div>
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

  let users = [], usersError = null;
  try {
    users = await fetchUserList(url, svcKey);
  } catch (e) {
    usersError = e.message; /* namerno ne rušimo ceo izveštaj zbog ovoga */
  }

  const html = buildHtml(stats, users, usersError);

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

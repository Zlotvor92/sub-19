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

/* PAGINIRANO. Ranije je ovo bio JEDAN upit bez limita, a `data` je CEO JSON
   blob stanja svakog korisnika (plan, dnevnik, VDOT istorija, perKm nizovi po
   treningu, wellness mapa — lako 200-500 KB po aktivnom korisniku). Dva
   problema: sve to je odjednom ulazilo u memoriju funkcije, i — tise, pa gore —
   PostgREST ima podrazumevani `max-rows`, pa bi preko te granice korisnici
   TIHO ispadali iz izvestaja bez ikakvog traga da lista nije potpuna.
   Ista klasa greske je vec ispravljena za Admin API listu (fetchUserList);
   ovaj upit je tada promasen.

   PAGINACIJA JE RESILA `max-rows`, ALI NE I MEMORIJU. Redovi su i dalje svi
   zavrsavali u jednom nizu — 50 strana × 200 redova × do 500 KB je red
   velicine sto megabajta u funkciji koja ima 60 s i megabajt-dva rezerve po
   redu. Prvi korisnik preko te granice obara CEO izvestaj, i to greskom koja
   ne kaze zasto (OOM, ne HTTP status).
   Zato se svaka strana SAZIMA cim stigne, pa se sirovi blob baca. Iz njega
   izvestaju ionako treba pet izvedenih brojeva — oko dvesta bajta po
   korisniku umesto pola megabajta. Merenje na realnom stanju (70 treninga sa
   perKm i laps nizovima, 180 dana oporavka): 453 KB -> ~200 B.

   Izvlacenje po redu je u SOPSTVENOM try/catch (isti razlog kao u mergeRows):
   `data` je u potpunosti pod kontrolom korisnika, pa jedan pokvaren zapis ne
   sme da obori citanje cele strane. */
const PRAZNA_AKTIVNOST = {
  lastWorkoutDate: null, weekKm: 0, lastStravaSync: null,
  stravaConnected: false, stravaAthlete: null
};

async function fetchRawUserState(url, key, todayStr) {
  const PER = 200, MAX_PAGES = 50, sazeto = {};
  for (let page = 0; page < MAX_PAGES; page++) {
    const od = page * PER, doIdx = od + PER - 1;
    const r = await fetch(url.replace(/\/+$/, '') + '/rest/v1/user_state?select=user_id,data,updated_at&order=user_id.asc', {
      headers: {
        apikey: key, Authorization: 'Bearer ' + key,
        Range: od + '-' + doIdx, 'Range-Unit': 'items'
      }
    });
    if (!r.ok && r.status !== 206) throw new Error('user_state upit nije uspeo (' + r.status + ')');
    const j = await r.json();
    const red = Array.isArray(j) ? j : [];
    for (const row of red) {
      try { sazeto[row.user_id] = deriveActivity(row.data, todayStr); }
      catch (e) { sazeto[row.user_id] = PRAZNA_AKTIVNOST; }
    }
    if (red.length < PER) break;   /* `red` izlazi iz opsega ovde — blob se oslobađa */
  }
  return sazeto;
}

/* PAGINIRANO, iz istog razloga kao fetchUserList i fetchRawUserState.
   Ovaj upit je pri toj ispravci promašen — a raste BRŽE od oba: jedan red po
   korisniku PO DANU. Bez `Range` zaglavlja PostgREST vraća do `max-rows`
   (podrazumevano 1000) i tu staje, bez greške; korisnici sa starijim danima
   na vrhu tako tiho gube kolonu „AI analiza".
   `order=day.desc` je uslov za tačnost: prvi viđen red po korisniku je i
   najnoviji, pa se ostali smeju preskočiti. Redosled mora biti određen i
   preko granica strana — zato i drugi kriterijum (`user_id`). */
async function fetchAiUsageDays(url, key) {
  const PER = 1000, MAX_PAGES = 50, lastByUser = {};
  for (let page = 0; page < MAX_PAGES; page++) {
    const od = page * PER, doIdx = od + PER - 1;
    const r = await fetch(url.replace(/\/+$/, '') +
      '/rest/v1/api_usage?select=user_id,day,calls&calls=gt.0&order=day.desc,user_id.asc', {
      headers: {
        apikey: key, Authorization: 'Bearer ' + key,
        Range: od + '-' + doIdx, 'Range-Unit': 'items'
      }
    });
    if (!r.ok && r.status !== 206) throw new Error('api_usage upit nije uspeo (' + r.status + ')');
    const j = await r.json();
    const rows = Array.isArray(j) ? j : [];
    for (const row of rows) {
      if (!(row.user_id in lastByUser)) lastByUser[row.user_id] = row.day;
    }
    if (rows.length < PER) break;
  }
  return lastByUser;
}

/* Admin API vraca najvise per_page po strani. Ranije se citala SAMO prva strana
   (per_page=200) — preko toga su korisnici tiho ispadali iz izvestaja, bez
   ikakvog traga da lista nije potpuna. Sada se strane citaju dok ima podataka. */
async function fetchUserList(url, key) {
  const PER = 200, MAX_PAGES = 25;   /* gornja granica da greska na serveru ne napravi beskonacnu petlju */
  const out = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const r = await fetch(url.replace(/\/+$/, '') + '/auth/v1/admin/users?per_page=' + PER + '&page=' + page, {
      headers: { apikey: key, Authorization: 'Bearer ' + key }
    });
    if (!r.ok) throw new Error('lista korisnika nije uspela (' + r.status + ')');
    const j = await r.json();
    const users = Array.isArray(j) ? j : (Array.isArray(j.users) ? j.users : []);
    out.push(...users);
    if (users.length < PER) break;
  }
  return out.map(u => ({
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

  /* `data` je U POTPUNOSTI pod kontrolom korisnika (sbPush gura proizvoljan
     JSON, RLS proverava samo vlasnistvo reda, ne sadrzaj). `new Date(smece)`
     je Invalid Date, a `.toISOString()` NAD NJIM baca RangeError — koji je, dok
     se deriveActivity zvao IZVAN try/catch-a, obarao ceo izvestaj: jedan
     korisnik sa `strava.lastSync:"nije-datum"` gasio je mejl ZA SVE. Poziv je
     danas u try/catch-u (v. fetchRawUserState), ali bezbedan parse ostaje —
     dve odbrane, jer je cena jedna linija a ispad je bio potpun. */
  const sinhro = (data && data.strava && data.strava.lastSync)
    ? new Date(data.strava.lastSync) : null;
  const lastStravaSync = (sinhro && !isNaN(sinhro.getTime())) ? sinhro.toISOString() : null;
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

/* `sazetaStanja` je mapa user_id -> vec izvedena aktivnost (v. fetchRawUserState).
   Ranije je ovde stajao sirov `data` blob i `deriveActivity` se zvao tek sad;
   izvlacenje je pomereno u citanje da bi se blob bacio odmah po strani. Odbrana
   po redu (try/catch oko korisnickog JSON-a) nije nestala nego je otisla sa
   njim — ovde ostaje samo podrazumevana vrednost za korisnika bez reda. */
function mergeRows(users, sazetaStanja, aiDays, todayStr) {
  const stanja = sazetaStanja || {};
  return (users || []).map(u => {
    const act = stanja[u.id] || PRAZNA_AKTIVNOST;
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

function buildHtml(stats, rows, errors, brisanja) {
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

  /* Odložena brisanja se prijavljuju SAMO kad ih ima — prazan red svakog jutra
     je šum koji se posle nedelju dana ne čita. */
  const b = brisanja || { obrisano: [], greske: [] };
  const brisanjaHtml = (b.obrisano.length || b.greske.length)
    ? `<div style="margin-top:22px;padding:12px 14px;background:#16161D;border-radius:12px">
         <div style="font-weight:700;font-size:13px;margin-bottom:6px">Odložena brisanja</div>
         ${b.obrisano.length ? `<div style="color:#7A7A86;font-size:12px">Izvršeno: ${esc(b.obrisano.join(', '))}</div>` : ''}
         ${b.greske.length ? `<div style="color:#FA2E55;font-size:12px">NIJE uspelo: ${esc(b.greske.join(' · '))}</div>` : ''}
       </div>`
    : '';

  return `<div style="font-family:-apple-system,sans-serif;max-width:640px;margin:0 auto;padding:20px;background:#0A0A0F;color:#F5F5F7">
    <div style="font-weight:800;font-size:18px;margin-bottom:4px">SUB<span style="color:#FA2E55">-20</span> — dnevni izveštaj</div>
    <div style="color:#7A7A86;font-size:12px;margin-bottom:18px">${esc(new Date().toLocaleDateString('sr-RS', { day: '2-digit', month: 'long', year: 'numeric' }))}</div>
    ${errors.stats
      /* NULA KOJA ZNACI „NISAM DOBIO BROJ" MORA DA SE RAZLIKUJE OD NULE.
         Otkad izostanak statistike vise ne obara ceo izvestaj, tabela bi bez
         ovoga pokazala sest nula kao cinjenicu — a to je gore od greske, jer
         izgleda kao da je aplikaciju preko noci napustio svako. */
      ? `<div style="background:#2A1116;border:1px solid #FA2E55;border-radius:12px;padding:12px;margin-bottom:22px;font-size:13px">
           <b style="color:#FA2E55">Statistika nije učitana</b><br>
           <span style="color:#7A7A86">${esc(errors.stats)}</span><br>
           <span style="color:#7A7A86">Ako pogled <code>app_stats</code> ne postoji: Supabase → SQL Editor → <code>supabase/app-stats.sql</code>. Brojevi po korisniku ispod su i dalje tačni.</span>
         </div>`
      : `<table style="border-collapse:collapse;width:100%;background:#16161D;border-radius:12px;overflow:hidden;margin-bottom:22px">
      ${row('Korisnika ukupno', stats.korisnika ?? 0)}
      ${row('Aktivnih (24h)', stats.aktivnih_24h ?? 0)}
      ${row('Aktivnih (7 dana)', stats.aktivnih_7d ?? 0)}
      ${row('Aktivnih (30 dana)', stats.aktivnih_30d ?? 0)}
      ${row('Novih (7 dana)', stats.novih_7d ?? 0)}
      ${row('Sa generisanim planom', stats.sa_generisanim_planom ?? 0)}
    </table>`}
    <div style="font-weight:700;font-size:13px;letter-spacing:.04em;text-transform:uppercase;color:#7A7A86;margin-bottom:8px">Aktivnost po korisniku</div>
    ${usersHtml}
    ${brisanjaHtml}
  </div>`;
}


/* ============================================================
   IZVRŠENJE ODLOŽENOG BRISANJA

   Vlasnik ne briše tuđe naloge odmah — označi ih i zabrani (v.
   supabase/admin-brisanje.sql i /api/broadcast {admin:'obrisi'}). Ovde se rok
   naplaćuje: nalozi kojima je istekao brišu se stvarno.

   ZAŠTO OVDE, a ne u zasebnoj funkciji: Vercel Hobby plan dozvoljava dvanaest
   serverless funkcija po deployu, a već ih je devet. Ovaj posao ide jednom
   dnevno, kao i izveštaj, i traži isti service_role ključ — pa je ovo
   najprirodnije mesto.

   NE SME DA OBORI IZVEŠTAJ. Ako brisanje padne, mejl svejedno mora da stigne,
   jer u njemu i piše šta nije uspelo. Zato ceo posao vraća nalaz umesto da
   baca. Spisak tabela je NAMERNO prepisan iz api/broadcast.js: fajlovi se ne
   uvoze međusobno (v. komentar o build koraku u api/analyze.js), pa razliku
   čuva test „spisak tabela je isti na sva tri mesta". */
const BRISI_TABELE = [
  'user_state', 'push_pretplata', 'ai_posao', 'api_usage',
  'bug_report_usage', 'endpoint_usage', 'zajednica_profil', 'user_state_istorija'
];

async function izvrsiOdlozenaBrisanja(url, key) {
  const baza = url.replace(/\/+$/, '');
  const head = { apikey: key, Authorization: 'Bearer ' + key };
  const nalaz = { obrisano: [], greske: [] };
  let redovi = [];
  try {
    const r = await fetch(baza + '/rest/v1/nalog_za_brisanje?select=user_id,email,izvrsi_posle'
      + '&izvrsi_posle=lt.' + encodeURIComponent(new Date().toISOString()), { headers: head });
    if (!r.ok) { nalaz.greske.push('spisak: HTTP ' + r.status); return nalaz; }
    redovi = await r.json();
  } catch (e) { nalaz.greske.push('spisak: ' + e.message); return nalaz; }

  for (const x of (Array.isArray(redovi) ? redovi : [])) {
    const id = String(x.user_id || '');
    if (!id) continue;
    let pao = null;
    for (const t of BRISI_TABELE) {
      try {
        const r = await fetch(baza + '/rest/v1/' + t + '?user_id=eq.' + encodeURIComponent(id),
          { method: 'DELETE', headers: { ...head, Prefer: 'return=minimal' } });
        if (!r.ok && r.status !== 404) pao = t + ': HTTP ' + r.status;
      } catch (e) { pao = t + ': ' + e.message; }
      if (pao) break;
    }
    /* Nalog TEK NA KRAJU, i samo ako su svi podaci prošli. Obrnut redosled
       ostavlja čoveka bez pristupa a sa podacima na serveru. */
    if (pao) { nalaz.greske.push((x.email || id) + ' — ' + pao); continue; }
    try {
      const r = await fetch(baza + '/auth/v1/admin/users/' + encodeURIComponent(id),
        { method: 'DELETE', headers: head });
      if (!r.ok) { nalaz.greske.push((x.email || id) + ' — nalog: HTTP ' + r.status); continue; }
    } catch (e) { nalaz.greske.push((x.email || id) + ' — nalog: ' + e.message); continue; }
    /* Red u nalog_za_brisanje nestaje sam, kroz `on delete cascade`. */
    nalaz.obrisano.push(x.email || id);
    console.log('[cron] izvrseno odlozeno brisanje naloga %s (%s)', x.email || '—', id);
  }
  return nalaz;
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

  const todayStr = new Date().toISOString().slice(0, 10);
  const errors = {};

  /* STATISTIKA OTKAZUJE KAO I SVAKI DRUGI KORAK — u svom try/catch.
     Ranije je ovde stajao `return res.status(502)`, dakle jedini korak koji je
     obarao CEO posao. To nije bila samo izgubljena tabelica na vrhu mejla:
     `izvrsiOdlozenaBrisanja()` se poziva NIZE, pa se odlozena brisanja naloga
     ne bi izvrsila nijedan dan dok god `app_stats` ne odgovara — a jedina
     poruka koja bi to javila je isti onaj izvestaj koji nije poslat.
     Klasa greske ista kao kod svake rucne migracije: tiho, i mesecima. */
  let stats = {};
  try { stats = await fetchStats(url, svcKey); }
  catch (e) { errors.stats = e.message; }

  let users = [];
  try { users = await fetchUserList(url, svcKey); }
  catch (e) { errors.users = e.message; }

  let rawStates = {};
  try { rawStates = await fetchRawUserState(url, svcKey, todayStr); }
  catch (e) { errors.rawState = e.message; }

  let aiDays = {};
  try { aiDays = await fetchAiUsageDays(url, svcKey); }
  catch (e) { errors.aiUsage = e.message; }

  /* Rok za odložena brisanja se naplaćuje PRE sastavljanja mejla, da bi nalaz
     mogao da uđe u njega. */
  const brisanja = await izvrsiOdlozenaBrisanja(url, svcKey);

  const rows = mergeRows(users, rawStates, aiDays, todayStr);
  const html = buildHtml(stats, rows, errors, brisanja);

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + resendKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from, to,
        /* Naslov ne sme da tvrdi „0 korisnika" kad brojac nije ni odgovorio. */
        subject: errors.stats
          ? 'SUB-20 dnevni izveštaj — statistika nije učitana'
          : 'SUB-20 dnevni izveštaj — ' + (stats.korisnika ?? 0) + ' korisnika',
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

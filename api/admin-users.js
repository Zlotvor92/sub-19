/* SUB-20 · Spisak korisnika i brisanje tudjeg naloga — SAMO za vlasnika.

   ZASTO ODVOJENO OD /api/delete-account. Ta putanja brise iskljucivo nalog
   onoga ko je poziva i NIKAD ne cita ciji nalog iz zahteva — to je njeno
   jedino bezbednosno obecanje i drzi ga test. Ubacivanje administratorskog
   brisanja tamo bi to obecanje ponistilo. Zato zaseban fajl, sa zasebnom
   kapijom.

   KAPIJA. `proveriVlasnika` je ista provera kao u broadcast.js i daily-report.js:
   token se proverava KOD SUPABASE-a, pa se procitana adresa poredi sa
   ADMIN_EMAIL. Ne veruje se nicemu sto pregledac tvrdi. Trazi se i potvrdjena
   adresa (`email_confirmed_at`) — bez toga bi, na Supabase podesavanju sa
   iskljucenom potvrdom mejla, neko mogao da se registruje vlasnikovom adresom
   i dobije spisak svih korisnika. `jeVlasnik()` u klijentu sluzi SAMO da se
   kartica ne iscrtava drugima; on nije zastita.

   POTREBNE Vercel Environment Variables:
   - SUPABASE_URL, SUPABASE_ANON_KEY          (provera prijave i vlasnistva)
   - SUPABASE_SERVICE_ROLE_KEY                (spisak i brisanje)
   - ADMIN_EMAIL (ili REPORT_TO kao rezerva)  (ko je vlasnik) */

/* Vraca korisnika iz tokena AKO je vlasnik, inace null. Vraca ceo objekat, ne
   samo `true`, jer je id potreban da bi se sprecilo da vlasnik obrise sam
   sebe kroz ovu putanju. */
async function vlasnikIz(req) {
  const admin = String(process.env.ADMIN_EMAIL || process.env.REPORT_TO || '').trim().toLowerCase();
  const url = process.env.SUPABASE_URL, anon = process.env.SUPABASE_ANON_KEY;
  if (!admin || !url || !anon) return null;
  const h = req.headers.authorization || req.headers.Authorization || '';
  const m = /^Bearer\s+(.+)$/i.exec(String(h).trim());
  if (!m) return null;
  try {
    const r = await fetch(url.replace(/\/+$/, '') + '/auth/v1/user', {
      headers: { apikey: anon, Authorization: 'Bearer ' + m[1] }
    });
    if (!r.ok) return null;
    const u = await r.json();
    const potvrdjen = !!(u && (u.email_confirmed_at || u.confirmed_at));
    if (!u || !u.email || !potvrdjen) return null;
    return String(u.email).trim().toLowerCase() === admin ? u : null;
  } catch (e) { return null; }
}

/* Iste tabele i isti redosled kao u api/delete-account.js — podaci pa nalog.
   Kad dodajes tabelu u supabase/, dodaj je na OBA mesta; test „spisak tabela
   pokriva sve iz supabase/*.sql" pada ako zaboravis. */
const TABELE = [
  'user_state',
  'push_pretplata',
  'ai_posao',
  'api_usage',
  'bug_report_usage',
  'endpoint_usage'
];

async function sviKorisnici(url, key) {
  const PER = 200, out = [];
  for (let page = 1; page <= 25; page++) {
    const r = await fetch(url.replace(/\/+$/, '') + '/auth/v1/admin/users?per_page=' + PER + '&page=' + page, {
      headers: { apikey: key, Authorization: 'Bearer ' + key }
    });
    if (!r.ok) throw new Error('spisak korisnika nije uspeo (' + r.status + ')');
    const j = await r.json();
    const users = Array.isArray(j) ? j : (Array.isArray(j.users) ? j.users : []);
    out.push(...users);
    if (users.length < PER) break;
  }
  return out;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Samo POST.' });
  }
  const ct = String(req.headers['content-type'] || '');
  if (!ct.includes('application/json')) {
    return res.status(415).json({ error: 'Zahteva se Content-Type: application/json.' });
  }

  const vlasnik = await vlasnikIz(req);
  /* 404, ne 403: putanja koja na neovlascen zahtev kaze „zabranjeno" potvrdjuje
     da postoji. Ovako se ne razlikuje od nepostojece. */
  if (!vlasnik) return res.status(404).json({ error: 'Ne postoji.' });

  const url = process.env.SUPABASE_URL;
  const srv = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !srv) {
    return res.status(500).json({ error: 'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY nisu podešeni.' });
  }
  const baza = url.replace(/\/+$/, '');
  const srvHead = { apikey: srv, Authorization: 'Bearer ' + srv };

  let body;
  try { body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body; }
  catch { return res.status(400).json({ error: 'Neispravan JSON.' }); }
  body = body || {};

  /* ---------- SPISAK ---------- */
  if (!body.obrisiId) {
    let lista;
    try { lista = await sviKorisnici(baza, srv); }
    catch (e) { return res.status(502).json({ error: e.message }); }

    /* Koliko svako ima zapisa — da se prazan probni nalog razlikuje od nekog
       ko aplikaciju stvarno koristi. Jedan upit za sve, ne po korisniku. */
    const brojac = {};
    try {
      const r = await fetch(baza + '/rest/v1/user_state?select=user_id,updated_at', { headers: srvHead });
      if (r.ok) for (const x of await r.json()) brojac[x.user_id] = x.updated_at || true;
    } catch (e) { /* bez ovoga spisak i dalje radi */ }

    const korisnici = lista.map(u => ({
      id: u.id,
      email: u.email || '—',
      napravljen: u.created_at || null,
      poslednjaPrijava: u.last_sign_in_at || null,
      imaPodatke: !!brojac[u.id],
      sinhronizovan: typeof brojac[u.id] === 'string' ? brojac[u.id] : null,
      jaSam: u.id === vlasnik.id
    })).sort((a, b) => String(b.poslednjaPrijava || '').localeCompare(String(a.poslednjaPrijava || '')));

    return res.status(200).json({ ok: true, korisnici });
  }

  /* ---------- BRISANJE ---------- */
  const cilj = String(body.obrisiId);
  /* Vlasnik ne sme sebe da obrise ODAVDE — izgubio bi pristup spisku i ne bi
     mogao ni da povrati stanje. Za sopstveni nalog postoji Podesavanja →
     Nalog → Brisanje naloga, gde stoji i potvrda kucanjem. */
  if (cilj === vlasnik.id) {
    return res.status(400).json({
      error: 'Svoj nalog ne brišeš odavde — Podešavanja → Nalog → Brisanje naloga.'
    });
  }

  /* Provera da nalog postoji PRE brisanja redova: bez toga bi pogresan id
     tiho obrisao nula redova i vratio „ok", pa bi izgledalo kao da je neko
     obrisan a nije. */
  let meta = null;
  try {
    const r = await fetch(baza + '/auth/v1/admin/users/' + encodeURIComponent(cilj), { headers: srvHead });
    if (r.ok) meta = await r.json();
  } catch (e) { /* pada na proveru ispod */ }
  if (!meta || !meta.id) return res.status(404).json({ error: 'Taj nalog ne postoji.' });

  const obrisano = [];
  for (const t of TABELE) {
    try {
      const r = await fetch(baza + '/rest/v1/' + t + '?user_id=eq.' + encodeURIComponent(cilj), {
        method: 'DELETE', headers: { ...srvHead, Prefer: 'return=minimal' }
      });
      if (!r.ok && r.status !== 404) {
        const telo = await r.text();
        console.error('[admin][ALARM] tabela %s nije obrisana za %s — HTTP %s: %s', t, cilj, r.status, telo.slice(0, 200));
        return res.status(502).json({ error: 'Brisanje podataka nije uspelo (' + t + '). Nalog NIJE obrisan.' });
      }
      if (r.ok) obrisano.push(t);
    } catch (e) {
      console.error('[admin][ALARM] tabela %s nedostupna za %s: %s', t, cilj, e.message);
      return res.status(503).json({ error: 'Server nije dostupan. Nalog NIJE obrisan.' });
    }
  }

  try {
    const r = await fetch(baza + '/auth/v1/admin/users/' + encodeURIComponent(cilj), {
      method: 'DELETE', headers: srvHead
    });
    if (!r.ok) {
      const telo = await r.text();
      console.error('[admin][ALARM] nalog %s nije obrisan — HTTP %s: %s', cilj, r.status, telo.slice(0, 200));
      return res.status(502).json({ error: 'Podaci su obrisani, ali sam nalog nije.' });
    }
  } catch (e) {
    return res.status(503).json({ error: 'Podaci su obrisani, ali sam nalog nije.' });
  }

  console.log('[admin] %s obrisao nalog %s (%s); tabele: %s',
    vlasnik.email, meta.email || '—', cilj, obrisano.join(', ') || '—');
  return res.status(200).json({ ok: true, email: meta.email || null, obrisano });
}

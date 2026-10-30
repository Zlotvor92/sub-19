/* SUB-20 · MCP server za Claude — SAMO ČITANJE zdravstvenih podataka.

     POST /api/mcp            MCP (Streamable HTTP, bez stanja, odgovor JSON)
     GET  /api/mcp?metadata   OAuth Protected Resource Metadata (RFC 9728)

   ŠTA CLAUDE VIDI. Jedan alat, `zdravstveni_podaci`: jutarnja merenja iz
   `user_state.data.wellness` (HRV, puls u miru, san, težina, CTL/ATL/svežina —
   sve što stiže sa intervals.icu, v. `izvuci` u api/icu.js). Plan, dnevnik
   treninga, beleške i sve ostalo NE izlaze: iz baze se traži samo putanja
   `data->wellness`, pa ostatak stanja ne dolazi ni do ove funkcije. Trčanja
   Claude čita sa Strave (njihov konektor), ne odavde.

   PRIJAVA. Claude dobija OAuth token od Supabase OAuth 2.1 servera (korisnik
   odobrava u aplikaciji, na /?authorization_id=…). Takav token ima ista prava kao
   sesija aplikacije — Supabase nema sopstvene opsege — pa se „samo čitanje"
   drži na tri mesta, ne samo ovde:
     1. ovaj fajl prima SAMO token sa `client_id` i nudi samo čitanje;
     2. `requireUser` u ostalim api/*.js odbija token sa `client_id` (403);
     3. baza odbija svaki Data API zahtev sa takvim tokenom (pre-request
        funkcija, v. supabase/migrations/*_oauth_samo_mcp.sql).
   Zato se ovde podaci čitaju service_role ključem, za `user_id` koji je
   Supabase Auth potvrdio iz tokena — korisnikov token u bazu ni ne može.

   ZAŠTO BEZ MCP SDK-A. api/ nema build korak ni package.json (v. zaglavlje
   api/analyze.js), pa nema ni zavisnosti. Za server bez stanja koji nudi
   samo alate dovoljna su četiri JSON-RPC metoda: initialize, ping,
   tools/list, tools/call; obaveštenja dobijaju 202 bez tela. */

/* ROK NA IZLAZNI POZIV — isti razlog kao u ostalim api/*.js (v. `fetchRok` u
   api/auth.js): poziv koji visi bi pojeo `maxDuration`, pa bi Vercel vratio
   svoju HTML stranicu umesto JSON-RPC odgovora. Kraći nego drugde: ova funkcija
   nema svoj `maxDuration` u vercel.json (taj fajl je zaključan testom
   web/deploy/cutover.node.test.ts), pa važi podrazumevani rok, a zahtev pravi
   najviše dva izlazna poziva (Auth + baza). */
const IZLAZNI_ROK_MS = 4000;
function fetchRok(ulaz, opcije, ms) {
  const o = Object.assign({}, opcije || {});
  if (!o.signal) {
    try { o.signal = AbortSignal.timeout(ms > 0 ? ms : IZLAZNI_ROK_MS); } catch (e) { /* stariji Node — bez roka, kao pre */ }
  }
  return fetch(ulaz, o);
}

/* Najnovija prva: kad klijent traži verziju koju ne znamo, odgovara se najnovijom (pravilo specifikacije). */
const VERZIJE = ['2025-11-25', '2025-06-18', '2025-03-26'];
const DAN = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PODRAZUMEVANO_DANA = 30;
const NAJVISE_DANA = 400;

const ALAT = {
  name: 'zdravstveni_podaci',
  title: 'Zdravstveni podaci (sub20)',
  description:
    'Čita korisnikova jutarnja merenja iz aplikacije sub20, izvor intervals.icu: HRV (ms, kako ga šalje uređaj), ' +
    'puls u miru (otkucaja/min), san (sati i ocena — skala ocene zavisi od uređaja), telesnu masu (kg) i trenažno ' +
    'opterećenje CTL/ATL sa svežinom (CTL − ATL). Jedan zapis po danu, samo dani za koje merenje postoji. ' +
    'Samo čitanje. Treninge i trčanja ne vraća — za njih koristi Strava. Bez argumenata vraća poslednjih 30 dana.',
  inputSchema: {
    type: 'object',
    properties: {
      od: { type: 'string', description: 'Prvi dan, YYYY-MM-DD. Podrazumevano: 29 dana pre `do`.' },
      do: { type: 'string', description: 'Poslednji dan, YYYY-MM-DD. Podrazumevano: danas (Beograd).' }
    },
    additionalProperties: false
  },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
};

function danasBeograd() {
  /* sv-SE daje tačno YYYY-MM-DD; dan se računa po Beogradu, ne po UTC-u servera. */
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Belgrade' }).format(new Date());
}
function pravDan(s) {
  if (typeof s !== 'string' || !DAN.test(s)) return false;
  const d = new Date(s + 'T00:00:00Z');
  return !isNaN(d) && d.toISOString().slice(0, 10) === s;
}
function pomeriDan(s, dana) {
  const d = new Date(s + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + dana);
  return d.toISOString().slice(0, 10);
}
function razmakDana(od, doDana) {
  return Math.round((Date.parse(doDana + 'T00:00:00Z') - Date.parse(od + 'T00:00:00Z')) / 86400000);
}

/* Tvrdnje iz tela tokena BEZ provere potpisa. Potpis proverava Supabase Auth
   (`/auth/v1/user`) pre nego što se išta pročita; ovde služi samo da se token
   bez `client_id` odbije bez mrežnog kruga. */
function tvrdnje(token) {
  try {
    const t = JSON.parse(Buffer.from(String(token).split('.')[1] || '', 'base64url').toString('utf8'));
    return t && typeof t === 'object' ? t : null;
  } catch (e) { return null; }
}

function adresaResursa(req) {
  const h = req.headers || {};
  const host = String(h['x-forwarded-host'] || h.host || '').split(',')[0].trim();
  return 'https://' + host + '/api/mcp';
}

function metapodaci(req) {
  return {
    resource: adresaResursa(req),
    authorization_servers: [process.env.SUPABASE_URL.replace(/\/+$/, '') + '/auth/v1'],
    bearer_methods_supported: ['header'],
    /* `openid` se namerno ne nudi: ID token traži asimetrične ključeve projekta, a pristupu podacima ne treba. */
    scopes_supported: ['email'],
    resource_name: 'sub20 — zdravstveni podaci (samo čitanje)'
  };
}

function odbijPrijavu(req, res, greska) {
  const deo = greska ? `error="${greska}", ` : '';
  res.setHeader('WWW-Authenticate',
    `Bearer ${deo}resource_metadata="${adresaResursa(req)}?metadata", scope="email"`);
  return res.status(401).json({ error: greska === 'invalid_token' ? 'Prijava je istekla ili nije za ovaj resurs.' : 'Nedostaje prijava.' });
}

/* Korisnik iz OAuth tokena. Token bez `client_id` (sesija aplikacije) ovde
   nema šta da traži: ova putanja postoji samo za Claude konektor. */
async function korisnik(token) {
  const t = tvrdnje(token);
  if (!t || !t.client_id) return { ok: false, status: 401 };
  try {
    const r = await fetchRok(process.env.SUPABASE_URL.replace(/\/+$/, '') + '/auth/v1/user', {
      headers: { apikey: process.env.SUPABASE_ANON_KEY, Authorization: 'Bearer ' + token }
    });
    if (!r.ok) return { ok: false, status: r.status >= 500 ? 503 : 401 };
    const u = await r.json();
    if (!u || typeof u.id !== 'string' || !UUID.test(u.id)) return { ok: false, status: 401 };
    return { ok: true, userId: u.id };
  } catch (e) {
    return { ok: false, status: 503 };
  }
}

async function procitajWellness(userId) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.SUPABASE_URL.replace(/\/+$/, '') +
    '/rest/v1/user_state?select=wellness:data-%3Ewellness&user_id=eq.' + encodeURIComponent(userId);
  const r = await fetchRok(url, { headers: { apikey: key, Authorization: 'Bearer ' + key, Accept: 'application/json' } });
  if (!r.ok) throw new Error('baza ' + r.status);
  const redovi = await r.json();
  const w = Array.isArray(redovi) && redovi[0] ? redovi[0].wellness : null;
  return w && typeof w === 'object' && !Array.isArray(w) ? w : {};
}

const broj = v => (typeof v === 'number' && isFinite(v) ? v : null);

/* Polja se imenuju sa jedinicom: Claude ne zna srpske skraćenice iz stanja (`sanH`, `pulsUMiru`). */
function zapis(datum, z) {
  return {
    datum,
    hrv_ms: broj(z.hrv),
    puls_u_miru_bpm: broj(z.pulsUMiru),
    san_sati: broj(z.sanH),
    san_ocena: broj(z.sanOcena),
    tezina_kg: broj(z.tezina),
    ctl: broj(z.ctl),
    atl: broj(z.atl),
    svezina: broj(z.svezina)
  };
}

async function alatZdravlje(userId, args) {
  const a = args && typeof args === 'object' ? args : {};
  const doDana = a['do'] == null ? danasBeograd() : a['do'];
  if (!pravDan(doDana)) return greskaAlata('`do` mora biti datum u obliku YYYY-MM-DD.');
  const od = a.od == null ? pomeriDan(doDana, -(PODRAZUMEVANO_DANA - 1)) : a.od;
  if (!pravDan(od)) return greskaAlata('`od` mora biti datum u obliku YYYY-MM-DD.');
  const razmak = razmakDana(od, doDana);
  if (razmak < 0) return greskaAlata('`od` je posle `do`.');
  if (razmak >= NAJVISE_DANA) return greskaAlata(`Najviše ${NAJVISE_DANA} dana u jednom pozivu.`);

  let w;
  try { w = await procitajWellness(userId); }
  catch (e) { return greskaAlata('Podaci trenutno nisu dostupni (baza ne odgovara). Pokušaj ponovo.'); }

  const dani = Object.keys(w)
    .filter(d => DAN.test(d) && d >= od && d <= doDana && w[d] && typeof w[d] === 'object')
    .sort()
    .map(d => zapis(d, w[d]));
  const rezultat = { od, do: doDana, izvor: 'intervals.icu, jutarnja merenja', broj_dana: dani.length, dani };
  return { content: [{ type: 'text', text: JSON.stringify(rezultat) }] };
}

function greskaAlata(poruka) {
  return { content: [{ type: 'text', text: poruka }], isError: true };
}

const rpcGreska = (id, code, message) => ({ jsonrpc: '2.0', id: id == null ? null : id, error: { code, message } });

/* Jedna JSON-RPC poruka -> odgovor, ili `null` za obaveštenje/odgovor klijenta (na njih se ne odgovara). */
async function obradi(poruka, userId) {
  if (!poruka || typeof poruka !== 'object' || poruka.jsonrpc !== '2.0') return rpcGreska(null, -32600, 'Neispravan JSON-RPC zahtev.');
  if (typeof poruka.method !== 'string') return null;            // odgovor klijenta na naš zahtev — ne šaljemo ih
  if (poruka.id === undefined || poruka.id === null) return null; // obaveštenje
  const id = poruka.id;
  const p = poruka.params && typeof poruka.params === 'object' ? poruka.params : {};
  switch (poruka.method) {
    case 'initialize': {
      const trazena = typeof p.protocolVersion === 'string' ? p.protocolVersion : '';
      return { jsonrpc: '2.0', id, result: {
        protocolVersion: VERZIJE.includes(trazena) ? trazena : VERZIJE[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: 'sub20', title: 'sub20 — zdravstveni podaci', version: '1' },
        instructions: 'Samo čitanje jutarnjih zdravstvenih merenja (HRV, puls u miru, san, težina, CTL/ATL). Treninge čitaj sa Strave.'
      } };
    }
    case 'ping':
      return { jsonrpc: '2.0', id, result: {} };
    case 'tools/list':
      return { jsonrpc: '2.0', id, result: { tools: [ALAT] } };
    case 'tools/call':
      if (p.name !== ALAT.name) return rpcGreska(id, -32602, 'Nepoznat alat: ' + String(p.name));
      return { jsonrpc: '2.0', id, result: await alatZdravlje(userId, p.arguments) };
    default:
      return rpcGreska(id, -32601, 'Metod nije podržan: ' + poruka.method);
  }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const nedostaje = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'].filter(k => !process.env[k]);
  if (nedostaje.length) return res.status(500).json({ error: nedostaje.join(' / ') + ' nisu podešeni u Vercel → Settings → Environment Variables.' });

  if (req.method === 'GET' && req.query && Object.prototype.hasOwnProperty.call(req.query, 'metadata')) {
    return res.status(200).json(metapodaci(req));
  }
  if (req.method !== 'POST') {
    /* GET bez upita bi bio SSE tok — ovaj server ga ne otvara (specifikacija: 405). */
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Samo POST.' });
  }

  const h = req.headers.authorization || req.headers.Authorization || '';
  const m = /^Bearer\s+(.+)$/i.exec(String(h).trim());
  if (!m) return odbijPrijavu(req, res, null);
  const ko = await korisnik(m[1]);
  if (!ko.ok) {
    if (ko.status === 503) return res.status(503).json({ error: 'Provera prijave trenutno nije moguća.' });
    return odbijPrijavu(req, res, 'invalid_token');
  }

  let telo = req.body;
  if (typeof telo === 'string') {
    try { telo = JSON.parse(telo); } catch (e) { return res.status(400).json(rpcGreska(null, -32700, 'Telo nije JSON.')); }
  }
  if (Array.isArray(telo)) {
    /* Paket poruka postoji samo u verziji 2025-03-26; kasnije verzije ga nemaju. */
    const odgovori = (await Promise.all(telo.map(x => obradi(x, ko.userId)))).filter(Boolean);
    if (!odgovori.length) return res.status(202).end();
    return res.status(200).json(odgovori);
  }
  const odgovor = await obradi(telo, ko.userId);
  if (!odgovor) return res.status(202).end();
  return res.status(200).json(odgovor);
}

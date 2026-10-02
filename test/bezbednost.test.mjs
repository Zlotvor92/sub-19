/* BEZBEDNOSNI TESTOVI — svaki je STVARAN napad koji je jednom prošao.

   Ovo nije lista dobrih praksi nego regresioni štit: svaki `test` ispod
   odgovara napadu koji je izveden nad ovim kodom i uspeo. Ako neki od njih
   ponovo prođe, rupa se vratila.

   MODEL PRETNJE — odakle podatak koji app ne kontroliše:
     1. UVEZEN BACKUP  — proizvoljan JSON, korisnik ga sam otvori („uvezi moj
        backup da vidiš plan"). Najšira površina; sve ostalo je uže.
     2. URL pri povratku sa OAuth-a — `?code=`, `#access_token=`.
     3. ODGOVOR AI SERVERA — tekst koji ide u innerHTML.
     4. STRAVA / intervals.icu — nazivi aktivnosti, zapisi o oporavku.
     5. TELO ZAHTEVA ka api/ — bilo ko sa važećom prijavom.

   ZAŠTO JE XSS OVDE NAJTEŽI ISHOD: `localStorage` drži Supabase sesiju
   (`sub19_sb`), Strava access/refresh token i intervals.icu token. Jedan
   uspešan `<img onerror>` odatle uzima sve.

   CSP POMAŽE, ALI NE ZAVISI SE OD NJEGA. Ovde je do sada stajalo da CSP ne
   pomaže „jer aplikacija JESTE jedna velika inline skripta, pa `script-src`
   mora da dozvoli 'unsafe-inline'" — to više nije tačno od kad je kod izdvojen
   u app.js: `vercel.json` ima `script-src 'self'`, bez 'unsafe-inline', i
   test/doslednost.test.mjs to i tvrdi. Dva testa u istom repozitorijumu su
   govorila suprotno o istoj stvari.
   `style-src 'unsafe-inline'` je i dalje nužan (aplikacija gradi `style`
   atribute), pa CSP NE zaustavlja ubacivanje CSS-a — v. nalaz Z-1 i zamku za
   Zajednicu niže. */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readRepoFile } from './repo.mjs';

/* Nekoliko oblika probijanja iz atributa i iz teksta.

   Poslednji je iz nalaza Z-1 i ne liči na ostale: ne probija tag nego VREDNOST
   ATRIBUTA, kroz numeričke HTML entitete. Pregledač vrednost atributa prvo
   dekodira kao HTML pa je onda čita kao CSS, pa `&#34;&#41;&#59;` postane
   `");` i iz `url("…")` se izlazi u nove deklaracije. `esc()` ga ne zaustavlja,
   jer entiteti u vrednosti atributa i jesu ispravan escapovan tekst — hvata ga
   `ubaceniCSS`, koji dekodira pre nego što gleda. */
const PAYLOADI = [
  `"><img src=x onerror=alert(1)>`,
  `'><svg/onload=alert(1)>`,
  `"><script>alert(1)</script>`,
  `javascript:alert(1)`,
  `" autofocus onfocus=alert(1) x="`,
  `https://lh3.googleusercontent.com/a&#34;&#41;&#59;position:fixed&#59;inset:0&#59;z-index:99999&#59;background:red&#59;x:url&#40;&#34;`
];

/* Tagovi koje aplikacija sama emituje — sve van toga je ubačeno. */
const NASI = /^<\/?(p|br|strong|div|span|button|input|select|option|textarea|label|details|summary|svg|path|circle|ellipse|line|rect|text|polyline|polygon|defs|linearGradient|stop|title|g|table|tr|td|th|small|b|i|a|hr|nav|section|header|main|pre|form|em|ul|ol|li)\b/i;

/* Spisak „naših" tagova nije dovoljan sam za sebe: `<svg/onload=alert(1)>`
   počinje sa <svg i time bi prošao kao naš. Zato i tag sa našim imenom mora da
   bude čist — aplikacija ne emituje nijedan inline rukovalac događaja ni
   javascript: URL (provereno grepom kroz app.js), pa je svaki takav ubačen.

   Traži se SAMO van vrednosti atributa: pravilno escapovan tekst legitimno
   sadrži i „onerror=" i „javascript:" unutar navodnika
   (`data-day="&quot;&gt;&lt;img src=x onerror=alert(1)&gt;"`) — to je dokaz da
   escapovanje radi, ne propust. Izuzetak su atributi koji nose URL: tamo
   javascript: unutar navodnika jeste izvršiv, pa se gleda i u vrednosti. */
const bezVrednosti = t => t.replace(/"[^"]*"|'[^']*'/g, '""');
const OPASAN = /[\s/]on[a-z]+\s*=/i;
const OPASAN_URL = /\b(?:href|src|action|formaction|xlink:href)\s*=\s*["']?\s*javascript:/i;

/* Vraća ubačene tagove; prazan niz = nema injekcije. */
function ubaceniTagovi(html) {
  return (String(html).match(/<[a-zA-Z][^>]*>/g) || [])
    .filter(t => !NASI.test(t) || OPASAN.test(bezVrednosti(t)) || OPASAN_URL.test(t));
}

/* ---------- I CSS JE UBACIVANJE ----------

   `ubaceniTagovi` gleda imena tagova i rukovaoce. `style` atribut sa
   proizvoljnim deklaracijama je za nju uredan izlaz — pa je nalaz Z-1 (tuđ
   `avatar_url` ubacuje `position:fixed;inset:0;z-index:99999` u moj dokument
   preko numeričkih HTML entiteta) prošao kroz nju i da je Zajednica bila na
   spisku ekrana. `style-src 'unsafe-inline'` je za ovu aplikaciju nužan, pa CSP
   to ne zaustavlja.

   Zato se OVDE prvo dekodira kao HTML — tačno ono što pregledač radi sa
   vrednošću atributa pre nego što je pročita kao CSS — pa se onda traže
   deklaracije koje aplikacija sama nikad ne emituje. `position` i `inset` nisu
   na spisku „naših" jer ih nijedan `style` u app.js ne postavlja; kad bi se to
   promenilo, spisak ide s tim, a ne zamka. */
const dekodirajHTML = s => String(s)
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
  .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');

const OPASNE_DEKLARACIJE = [
  /position\s*:\s*(fixed|absolute|sticky)/i,
  /\binset\s*:/i, /\bz-index\s*:/i,
  /\bexpression\s*\(/i, /\bbehavior\s*:/i, /url\s*\(\s*['"]?\s*javascript:/i,
  /* `content:` kao SVOJSTVO, ne kao deo imena drugog (`justify-content:`,
     `align-content:`) — `\b` ispred crtice je granica reči, pa je zamka
     obarala sopstveni `style` aplikacije čim se nedelja otvori u Planu. */
  /-moz-binding/i, /(?<![\w-])content\s*:/i
];
/* Gleda SAMO unutar `style` atributa. Escapovan tekst legitimno sadrži
   „position:fixed" kad je to samo opis treninga koji neko kucao — isti lažni
   alarm zbog kog se ni „onerror=" ne traži kroz ceo HTML. Vrednost atributa se
   dekodira, jer to radi i pregledač pre nego što je preda CSS parseru. */
function ubaceniCSS(html) {
  const nadjeno = [];
  for (const m of String(html).matchAll(/\sstyle\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
    const d = dekodirajHTML(m[1] !== undefined ? m[1] : m[2]);
    for (const re of OPASNE_DEKLARACIJE)
      if (re.test(d) && !nadjeno.includes(String(re))) nadjeno.push(String(re));
  }
  return nadjeno;
}

function prazno() {
  return {
    v: 7, log: {}, knee: [], kg: [], pred: {}, predLock: {}, vdotLog: [],
    moves: {}, alts: {}, wellness: {}, icu: null, strava: null,
    ui: { firstRun: null, lastBackup: null, snooze: null, seenWeek: null }, genPlan: null
  };
}
function planSaDanom(id, extra = {}) {
  const s = prazno();
  s.genPlan = {
    meta: { raceDistM: 5000 }, pred: [], qs: {},
    weeks: [{ w: 1, start: '2026-06-22', days: [{ dow: 0, tag: 'tempo', km: 8, desc: 'Tempo', id, ...extra }] }]
  };
  return s;
}

describe('Serverske funkcije', () => {
  const ENV = {
    SUPABASE_URL: 'https://x.supabase.co', SUPABASE_ANON_KEY: 'anon',
    SUPABASE_SERVICE_ROLE_KEY: 'srv', RESEND_API_KEY: 'rk',
    REPORT_FROM: 'a@b.c', REPORT_TO: 'vlasnik@b.c', ADMIN_EMAIL: 'vlasnik@b.c',
    CRON_SECRET: 'tajna', GEMINI_API_KEY: 'gk'
  };
  const res = () => {
    const r = { code: null, body: null, headers: {} };
    r.status = c => { r.code = c; return r; };
    r.json = b => { r.body = b; return r; };
    r.setHeader = (k, v) => { r.headers[k] = v; };
    return r;
  };
  const J = (b, ok = true, st = 200) => ({ ok, status: st, json: async () => b, text: async () => JSON.stringify(b) });
  const origFetch = globalThis.fetch;

  test('athleteId ne može da odvede zahtev van intervals.icu (SSRF)', async () => {
    Object.assign(process.env, ENV);
    const { default: h } = await import('../api/icu.js?t=' + Date.now());
    const pozvani = [];
    globalThis.fetch = async u => {
      pozvani.push(String(u));
      return String(u).includes('/auth/v1/user') ? J({ id: 'u1' }) : J([]);
    };
    for (const zli of ['1@zlo.rs', '1/../../evil', '../../../etc/passwd', 'i1%2f%2fzlo.rs',
      '1?x=y', 'http://zlo.rs', '1 2', '1\n2']) {
      const r = res();
      await h({ method: 'POST', headers: { authorization: 'Bearer jwt' },
        body: { athleteId: zli, apiKey: 'kljuckljuc', oldest: '2026-01-01', newest: '2026-01-02' } }, r);
      assert.equal(r.code, 400, `athleteId ${JSON.stringify(zli)} nije odbijen`);
    }
    const vani = pozvani.filter(p => !p.includes('intervals.icu') && !p.includes('supabase'));
    assert.deepEqual(vani, [], `zahtev je izašao van dozvoljenih hostova: ${vani}`);
    globalThis.fetch = origFetch;
  });

  test('naslov mejla ne prima novi red (ubacivanje zaglavlja)', async () => {
    Object.assign(process.env, ENV);
    const { default: h } = await import('../api/report-bug.js?t=' + Date.now());
    let telo = null;
    globalThis.fetch = async (u, o) => {
      const s = String(u);
      if (s.includes('/auth/v1/user')) return J({ id: 'u1', email: 'z@t.rs' });
      if (s.includes('rpc/')) return J({});
      if (s.includes('resend')) { telo = JSON.parse(o.body); return J({ id: 'm' }); }
      return J({});
    };
    const r = res();
    await h({ method: 'POST', headers: { authorization: 'Bearer jwt' },
      body: { description: 'Bug\nBcc: napadac@zlo.rs\r\nX-Evil: da', context: {} } }, r);
    assert.ok(telo, 'mejl nije poslat');
    assert.ok(!/[\r\n]/.test(telo.subject), `naslov sadrži novi red: ${JSON.stringify(telo.subject)}`);
    assert.deepEqual(ubaceniTagovi(telo.html), [], 'HTML injekcija u telo mejla');
    globalThis.fetch = origFetch;
  });

  test('kontekst prijave buga (userAgent, tab) je escapovan u mejlu', async () => {
    Object.assign(process.env, ENV);
    const { default: h } = await import('../api/report-bug.js?t=' + Date.now());
    let telo = null;
    globalThis.fetch = async (u, o) => {
      const s = String(u);
      if (s.includes('/auth/v1/user')) return J({ id: 'u1', email: 'z@t.rs' });
      if (s.includes('rpc/')) return J({});
      if (s.includes('resend')) { telo = JSON.parse(o.body); return J({ id: 'm' }); }
      return J({});
    };
    const r = res();
    await h({ method: 'POST', headers: { authorization: 'Bearer jwt' },
      body: { description: 'x', context: { userAgent: PAYLOADI[0], tab: PAYLOADI[1], version: PAYLOADI[2] } } }, r);
    assert.deepEqual(ubaceniTagovi(telo.html), [], 'kontekst nije escapovan');
    globalThis.fetch = origFetch;
  });

  test('običan prijavljen korisnik ne može da pročita spisak svih adresa', async () => {
    Object.assign(process.env, ENV);
    const { default: h } = await import('../api/broadcast.js?t=' + Date.now());
    globalThis.fetch = async u => {
      const s = String(u);
      if (s.includes('/auth/v1/user')) return J({ id: 'u1', email: 'obican@t.rs' });
      if (s.includes('admin/users')) return J([{ email: 'zrtva@t.rs' }]);
      return J({});
    };
    const r = res();
    await h({ method: 'POST', headers: { authorization: 'Bearer jwt_obicnog' }, body: {} }, r);
    assert.equal(r.code, 401, `dobijen HTTP ${r.code}: ${JSON.stringify(r.body)}`);
    globalThis.fetch = origFetch;
  });

  test('admin sa NEPOTVRĐENOM adresom ne prolazi kao vlasnik', async () => {
    /* NAPAD: Supabase izda JWT sa proizvoljnim, nepotvrđenim mejlom ako je Email
       provider uključen a potvrda isključena. Napadač se registruje vlasnikovom
       adresom (bez pristupa njoj) i dobija token `email: vlasnik, email_confirmed_at: null`.
       Ranije je proveriVlasnika gledala samo jednakost adrese — pa je izlistavao
       sve adrese korisnika i slao mejl svima. Sada mora biti POTVRĐENA. */
    Object.assign(process.env, ENV);
    const { default: h } = await import('../api/broadcast.js?t=' + Date.now());
    const pozovi = async user => {
      globalThis.fetch = async u => {
        const s = String(u);
        if (s.includes('/auth/v1/user')) return J(user);
        if (s.includes('admin/users')) return J([{ email: 'zrtva@t.rs' }]);
        return J({});
      };
      const r = res();
      await h({ method: 'POST', headers: { authorization: 'Bearer jwt' }, body: {} }, r);
      return r;
    };
    /* napadač: vlasnikova adresa, ali nepotvrđena → 401 */
    assert.equal((await pozovi({ id: 'a', email: ENV.ADMIN_EMAIL, email_confirmed_at: null })).code, 401,
      'nepotvrđena vlasnikova adresa je prošla');
    /* pravi vlasnik: potvrđen → mora i dalje da prođe (popravka nije preoštra) */
    assert.equal((await pozovi({ id: 'v', email: ENV.ADMIN_EMAIL, email_confirmed_at: '2026-01-01T00:00:00Z' })).code, 200,
      'potvrđen vlasnik je odbijen — popravka je preoštra');
    /* stariji GoTrue: `confirmed_at` umesto `email_confirmed_at` → prolazi */
    assert.equal((await pozovi({ id: 'v', email: ENV.ADMIN_EMAIL, confirmed_at: '2026-01-01T00:00:00Z' })).code, 200,
      'confirmed_at (stariji GoTrue) nije prihvaćen kao potvrda');
    globalThis.fetch = origFetch;
  });

  test('jedan pokvaren zapis ne obara ceo dnevni izveštaj (DoS)', async () => {
    /* NAPAD: bilo koji korisnik upiše u svoj user_state.data
       `strava.lastSync = "nije-datum"`. deriveActivity je radio
       `new Date(...).toISOString()` bez zaštite, van try/catch-a — RangeError je
       obarao ceo izveštaj, pa mejl nije stizao NIKOME. */
    Object.assign(process.env, ENV);
    const { default: h } = await import('../api/daily-report.js?t=' + Date.now());
    let mejlPoslat = false;
    globalThis.fetch = async (u, o) => {
      const s = String(u);
      if (s.includes('app_stats')) return J([{ korisnika: 2 }]);
      if (s.includes('user_state')) return J([
        { user_id: 'zli', updated_at: '2026-08-01T00:00:00Z', data: { strava: { athlete: 'X', lastSync: 'nije-datum' } } },
        { user_id: 'ok', updated_at: '2026-08-01T00:00:00Z', data: { strava: { athlete: 'Y', lastSync: '2026-08-01T10:00:00Z' } } }
      ]);
      if (s.includes('api_usage')) return J([]);
      if (s.includes('admin/users')) return J({ users: [
        { id: 'zli', email: 'zli@t.rs', created_at: '2026-01-01', last_sign_in_at: '2026-08-01' },
        { id: 'ok', email: 'ok@t.rs', created_at: '2026-01-01', last_sign_in_at: '2026-08-01' }
      ] });
      if (s.includes('resend')) { mejlPoslat = true; return J({ id: 'm' }); }
      return J({});
    };
    const r = res();
    let bacio = null;
    try { await h({ method: 'GET', headers: { authorization: 'Bearer ' + ENV.CRON_SECRET } }, r); }
    catch (e) { bacio = e.message; }
    assert.equal(bacio, null, `izveštaj je bacio izuzetak: ${bacio}`);
    assert.equal(r.code, 200, `dobijen HTTP ${r.code}: ${JSON.stringify(r.body)}`);
    assert.ok(mejlPoslat, 'mejl nije poslat — jedan pokvaren zapis je oborio izveštaj');
    globalThis.fetch = origFetch;
  });

  test('prekoračen dnevni limit ne propušta poziv ka LLM-u', async () => {
    Object.assign(process.env, ENV);
    const { default: h } = await import('../api/analyze.js?t=' + Date.now());
    let llm = 0;
    globalThis.fetch = async u => {
      const s = String(u);
      if (s.includes('/auth/v1/user')) return J({ id: 'u1', email: 'z@t.rs' });
      if (s.includes('rpc/check_and_bump')) return J({ error: 'DAILY_LIMIT_EXCEEDED' }, false, 400);
      if (s.includes('generativelanguage')) { llm++; return J({ candidates: [{ content: { parts: [{ text: 'ok' }] } }] }); }
      return J({});
    };
    const r = res();
    await h({ method: 'POST', headers: { authorization: 'Bearer jwt' },
      body: { session: { desc: 'x' }, entered: { km: 5 } } }, r);
    assert.equal(r.code, 429);
    assert.equal(llm, 0, 'LLM je pozvan i pored prekoračenog limita');
    globalThis.fetch = origFetch;
  });
});

describe('Prepoznavanje vlasnika', () => {
  test('politika privatnosti ZADRŽAVA kontakt adresu (to je obaveza, ne propust)', () => {
    /* Kontakt za brisanje podataka mora da postoji — bez njega politika
       privatnosti ne valja. Test je tu da se ne „očisti" greškom. */
    const privacy = readRepoFile('privacy.html');
    assert.match(privacy, /mailto:[A-Za-z0-9._%+-]+@/,
      'privacy.html nema kontakt adresu za zahteve o podacima');
  });

  test('pravu proveru i dalje radi server, nad adresom iz tokena', () => {
    /* Klijentska provera samo skriva dugme. Ako bi i ona bila jedina, svako bi
       preko dev tools-a mogao da pozove /api/broadcast. */
    const srv = readRepoFile('api/broadcast.js');
    assert.ok(/process\.env\.ADMIN_EMAIL/.test(srv), 'server ne čita ADMIN_EMAIL');
    assert.ok(/\/auth\/v1\/user/.test(srv), 'server ne proverava adresu kod Supabase-a');
  });
});

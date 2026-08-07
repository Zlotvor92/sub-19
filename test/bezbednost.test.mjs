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
   uspešan `<img onerror>` odatle uzima sve. CSP ne pomaže protiv toga jer
   aplikacija JESTE jedna velika inline skripta, pa `script-src` mora da
   dozvoli 'unsafe-inline'. */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { loadApp, readRepoFile, readClientSource } from './harness.mjs';

/* Nekoliko oblika probijanja iz atributa i iz teksta. */
const PAYLOADI = [
  `"><img src=x onerror=alert(1)>`,
  `'><svg/onload=alert(1)>`,
  `"><script>alert(1)</script>`,
  `javascript:alert(1)`,
  `" autofocus onfocus=alert(1) x="`
];

/* Tagovi koje aplikacija sama emituje — sve van toga je ubačeno. */
const NASI = /^<\/?(p|br|strong|div|span|button|input|select|option|textarea|label|details|summary|svg|path|circle|line|rect|text|polyline|polygon|defs|linearGradient|stop|title|g|table|tr|td|th|small|b|i|a|hr|nav|section|header|main|pre|form|em|ul|ol|li)\b/i;

/* Vraća ubačene tagove; prazan niz = nema injekcije.
   Namerno NE traži nizove kao „onerror=" — escapovan tekst ih legitimno
   sadrži (`&lt;img ... onerror=alert(1)&gt;`), pa bi to bio lažni alarm. */
function ubaceniTagovi(html) {
  return (String(html).match(/<[a-zA-Z][^>]*>/g) || []).filter(t => !NASI.test(t));
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

describe('Granica poverenja — uvoz backupa odbija zlonamerne ID-jeve', () => {
  test('validanId propušta samo mašinski oblik', () => {
    const app = loadApp();
    for (const dobar of ['n1d1', 'n6t', 'g12d3', 'p2b', 'g3_1', 'k1751376000000', 'kt-n1d1']) {
      assert.equal(app.call('validanId', dobar), true, `odbijen ispravan ID "${dobar}"`);
    }
    for (const los of [...PAYLOADI, '', 'a b', 'a"b', 'a<b', 'a/b', 'x'.repeat(65), null, 42, {}]) {
      assert.equal(app.call('validanId', los), false, `propušten ID ${JSON.stringify(los)}`);
    }
  });

  test('validanGenPlan odbija zlonameran ID dana', () => {
    const app = loadApp();
    for (const p of PAYLOADI) {
      app.ctx.__z = planSaDanom(p);
      assert.equal(app.evalIn('validanGenPlan(__z.genPlan)'), false,
        `propušten dan sa ID ${JSON.stringify(p)}`);
    }
  });

  test('validanGenPlan odbija zlonameran PRED red', () => {
    const app = loadApp();
    const napravi = (r) => {
      const s = planSaDanom('g1d1');
      s.genPlan.pred = [r];
      return s;
    };
    for (const p of PAYLOADI) {
      app.ctx.__z = napravi({ id: p, w: 1, l: 'N1 · Tempo', q: 4, pt: 260 });
      assert.equal(app.evalIn('validanGenPlan(__z.genPlan)'), false, `propušten PRED id ${JSON.stringify(p)}`);
      app.ctx.__z = napravi({ id: 'g1_0', w: 1, l: 'N1 · Tempo', q: p, pt: 260 });
      assert.equal(app.evalIn('validanGenPlan(__z.genPlan)'), false, `propušten PRED q ${JSON.stringify(p)}`);
    }
  });

  test('losIdUStanju hvata SVAKU mapu i niz koji nose ID-jeve', () => {
    const app = loadApp();
    const P = PAYLOADI[0];
    const slucajevi = {
      log: { log: { [P]: { status: 'done' } } },
      pred: { log: {}, pred: { [P]: 250 } },
      predLock: { log: {}, predLock: { [P]: true } },
      alts: { log: {}, alts: { [P]: { tag: 'lako' } } },
      moves: { log: {}, moves: { [P]: '2026-07-01' } },
      vdotLog: { log: {}, vdotLog: [{ id: P, ts: '2026-07-01' }] },
      'knee.id': { log: {}, knee: [{ id: P, date: '2026-07-01', pain: 1 }] },
      'knee.src': { log: {}, knee: [{ id: 'k1', src: P, date: '2026-07-01', pain: 1 }] },
      'kg.src': { log: {}, kg: [{ date: '2026-07-01', kg: 80, src: P }] }
    };
    for (const [ime, st] of Object.entries(slucajevi)) {
      app.ctx.__s = st;
      assert.ok(app.evalIn('losIdUStanju(__s)'), `propušten zlonameran ID u ${ime}`);
    }
  });

  test('ispravan backup i dalje prolazi (provera nije preoštra)', () => {
    const app = loadApp();
    app.ctx.__s = prazno();
    assert.equal(app.evalIn('losIdUStanju(__s)'), null);
    app.ctx.__s = {
      log: { n1d1: { status: 'done' }, g1d1: { status: 'done' } },
      pred: { p1: 265, g1_0: 250 }, predLock: { p1: true },
      alts: { n2d3: { tag: 'lako' } }, moves: { 'n2d3': '2026-07-01' },
      vdotLog: [{ id: 'p1', ts: '2026-07-01' }],
      knee: [{ id: 'kt-n1d1', src: 'n1d1', date: '2026-07-01', pain: 1 }],
      kg: [{ date: '2026-07-01', kg: 80, src: 'n1d1' }]
    };
    assert.equal(app.evalIn('losIdUStanju(__s)'), null, 'odbijen ispravan backup');
    app.ctx.__z = planSaDanom('g1d1');
    assert.equal(app.evalIn('validanGenPlan(__z.genPlan)'), true);
  });
});

describe('Drugi sloj — iscrtavanje escapuje i kad validacija otkaže', () => {
  /* Namerno se ZAOBILAZI uvoz i piše pravo u S: proverava se da svaka kartica
     sama po sebi ne ubacuje HTML, da nova kartica sutra ne zavisi od toga da
     li je neko setio validaciju. */
  test('kartica treninga (formHTML) ne ubacuje HTML iz ID-a dana', () => {
    for (const p of PAYLOADI) {
      const app = loadApp();
      app.ctx.__z = planSaDanom(p);
      app.evalIn('S=migrate(__z)||S; S.genPlan=__z.genPlan; setActivePlan(); rebuildDateIndex()');
      app.evalIn(`S.log[DATED[0].id]={status:'done',km:8,sec:2000}`);
      const t = ubaceniTagovi(app.evalIn('formHTML(DATED[0])'));
      assert.deepEqual(t, [], `formHTML propustio ${JSON.stringify(p)} → ${t.join(' ')}`);
    }
  });

  test('kartica treninga ne ubacuje HTML iz PRED reda', () => {
    for (const p of PAYLOADI) {
      const app = loadApp();
      const s = planSaDanom('g1d1', {
        session: { type: 'tempo', kind: 'Tempo', qKm: 4, paceSec: 260, wuKm: 2, cdKm: 2 }
      });
      s.genPlan.pred = [{ id: p, w: 1, l: 'N1 · Tempo', q: p, pt: 260, p5k: 1200 }];
      app.ctx.__z = s;
      app.evalIn('S=migrate(__z)||S; S.genPlan=__z.genPlan; setActivePlan(); rebuildDateIndex()');
      app.evalIn(`S.log['g1d1']={status:'done',km:8,sec:2000}`);
      const t = ubaceniTagovi(app.evalIn('formHTML(BY_ID["g1d1"])'));
      assert.deepEqual(t, [], `PRED propušten ${JSON.stringify(p)} → ${t.join(' ')}`);
    }
  });

  test('lista za pomeranje treninga ne ubacuje HTML', () => {
    for (const p of PAYLOADI) {
      const app = loadApp();
      const s = prazno();
      s.genPlan = {
        meta: { raceDistM: 5000 }, pred: [], qs: {},
        weeks: [{ w: 1, start: '2026-06-22', days: [
          { dow: 0, tag: 'lako', km: 5, desc: 'x', id: p },
          { dow: 1, tag: 'lako', km: 5, desc: 'y', id: 'g1d2' }] }]
      };
      app.ctx.__z = s;
      app.evalIn('S=migrate(__z)||S; S.genPlan=__z.genPlan; setActivePlan(); rebuildDateIndex()');
      const t = ubaceniTagovi(app.call('weekSwapHTML', app.evalIn('CUR_PLAN[0]')));
      assert.deepEqual(t, [], `weekSwapHTML propustio ${JSON.stringify(p)}`);
    }
  });

  test('ekran povreda ne ubacuje HTML (ID, deo tela, aktivnost, beleška)', () => {
    for (const p of PAYLOADI) {
      const app = loadApp();
      app.ctx.__p = p;
      app.evalIn(`S.knee=[{id:__p,date:'2026-06-22',act:__p,pain:5,note:__p,part:__p}]`);
      app.call('renderOporavak');
      const t = ubaceniTagovi(app.evalIn('$("#pg-opor").innerHTML') || '');
      assert.deepEqual(t, [], `renderOporavak propustio ${JSON.stringify(p)}`);
    }
  });

  test('plan, Danas i Podešavanja ne ubacuju HTML iz opisa/imena', () => {
    for (const p of PAYLOADI) {
      const app = loadApp();
      const s = prazno();
      s.genPlan = {
        meta: { raceDistM: 5000, raceName: p }, pred: [], qs: {},
        weeks: [{ w: 1, start: '2026-06-22', focus: p, days: [{ dow: 0, tag: 'lako', km: 5, desc: p, id: 'g1d1' }] }]
      };
      s.strava = { athlete: p, lastSync: 1, access: 'a', refresh: 'b', expiresAt: 9e12 };
      s.icu = { athleteId: p, token: 't', lastSync: 1 };
      app.ctx.__z = s;
      app.evalIn('S=migrate(__z)||S; S.genPlan=__z.genPlan; S.strava=__z.strava; S.icu=__z.icu; setActivePlan(); rebuildDateIndex()');
      for (const [fn, sel] of [['renderPlan', '#pg-plan'], ['renderDanas', '#pg-danas'], ['renderOporavak', '#pg-opor']]) {
        app.call(fn);
        const t = ubaceniTagovi(app.evalIn(`$("${sel}").innerHTML`) || '');
        assert.deepEqual(t, [], `${fn} propustio ${JSON.stringify(p)} → ${t.join(' ')}`);
      }
      app.call('openSettings');
      const t2 = ubaceniTagovi(app.evalIn('$("#sheet").innerHTML') || '');
      assert.deepEqual(t2, [], `openSettings propustio ${JSON.stringify(p)}`);
    }
  });

  test('odgovor AI servera ne može da ubaci tag', () => {
    const app = loadApp();
    for (const p of [...PAYLOADI, `**<script>x</script>**`, `<iframe src=javascript:alert(1)>`]) {
      const t = ubaceniTagovi(app.call('mdToHtml', p));
      assert.deepEqual(t, [], `mdToHtml propustio ${JSON.stringify(p)} → ${t.join(' ')}`);
    }
  });

  test('nepoznat tip treninga iz backupa ne razbija class atribut', () => {
    const app = loadApp();
    for (const p of PAYLOADI) {
      assert.equal(app.call('safeTag', p), '', `safeTag propustio ${JSON.stringify(p)}`);
      assert.equal(app.call('tagName', p), 'Trening');
    }
  });
});

describe('Uvoz backupa — ostale zamke', () => {
  test('prototype pollution kroz `ui` ne prolazi', () => {
    const app = loadApp();
    app.ctx.__z = JSON.parse('{"v":7,"log":{},"ui":{"__proto__":{"zagadjeno":"DA"}}}');
    app.evalIn('migrate(__z)');
    assert.equal(app.evalIn('({}).zagadjeno'), undefined, 'prototip je zagađen');
    assert.equal(app.evalIn('[].zagadjeno'), undefined);
  });

  test('backup iz novije šeme se odbija, ne tumači po starim pravilima', () => {
    const app = loadApp();
    const SCHEMA = app.get('SCHEMA');
    assert.equal(app.call('migrate', { log: {}, v: SCHEMA + 1 }), null);
  });

  test('pokvaren genPlan ne prolazi (app bi ostala razbijena posle zamene S)', () => {
    const app = loadApp();
    for (const g of [{}, { weeks: 'x' }, { weeks: [] }, { weeks: [{ w: 1 }] },
      { weeks: [{ w: 1, start: 'x', days: [{ dow: 0 }] }] },
      { weeks: [{ w: 1, start: '2026-06-22', days: [{ dow: 99 }] }] },
      { weeks: [{ w: 1, start: '2026-06-22', days: [{ dow: 0, km: 'x' }] }] }]) {
      app.ctx.__g = g;
      assert.equal(app.evalIn('validanGenPlan(__g)'), false, `propušten ${JSON.stringify(g).slice(0, 60)}`);
    }
  });
});

describe('Tokeni ne napuštaju uređaj', () => {
  const tajne = { stravaAccess: 'SA_TOKEN', stravaRefresh: 'SR_TOKEN', icuToken: 'ICU_TOKEN', icuKey: 'ICU_KLJUC' };
  function saTokenima(app) {
    app.ctx.__t = tajne;
    app.evalIn(`S.strava={access:__t.stravaAccess,refresh:__t.stravaRefresh,expiresAt:9e12,athlete:'Neko',scope:'x',lastSync:1};
                S.icu={athleteId:'i123',token:__t.icuToken,apiKey:__t.icuKey,lastSync:1}`);
  }
  const nemaTajni = (json, gde) => {
    for (const [ime, v] of Object.entries(tajne)) {
      assert.ok(!json.includes(v), `${gde} sadrži ${ime}`);
    }
  };

  test('backup fajl (izvoz) nema nijedan token', () => {
    const app = loadApp(); saTokenima(app);
    nemaTajni(app.evalIn('JSON.stringify(backupPayload())'), 'backupPayload');
  });

  test('sinhronizacija na server nema nijedan token', () => {
    const app = loadApp(); saTokenima(app);
    nemaTajni(app.evalIn('JSON.stringify(sbPayload(S))'), 'sbPayload');
  });

  test('a stvarni podaci ostaju u backupu', () => {
    const app = loadApp(); saTokenima(app);
    app.evalIn(`S.log={n1d1:{status:'done',km:7}}; S.wellness={'2026-07-01':{datum:'2026-07-01',hrv:60}}`);
    const p = app.evalIn('backupPayload()');
    assert.equal(p.log.n1d1.km, 7);
    assert.ok(p.wellness['2026-07-01'], 'podaci o oporavku su izgubljeni');
  });
});

describe('Čitanje JWT-a — identitet naloga mora izaći tačan', () => {
  /* Iz ovog polja izlaze `SB.userId` i `SB.email`, a `userId` je ono po čemu
     sbInit odlučuje da li podmetnut `#access_token=` sme da zameni postojeću
     sesiju. Dekodiranje mora biti tačno, i ne sme da zavisi od `escape()` —
     funkcije uklonjene iz standarda (Annex B), koja uz to radi nad UTF-16
     jedinicama pa mejl sa ćirilicom ili umlautom izlazi izobličen. */
  const jwtSa = tvrdnje => {
    const b64u = o => Buffer.from(JSON.stringify(o), 'utf8').toString('base64')
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    return 'zaglavlje.' + b64u(tvrdnje) + '.potpis';
  };

  test('obična adresa se čita tačno', () => {
    const app = loadApp();
    const c = app.call('sbClaims', jwtSa({ sub: 'u-123', email: 'trkac@primer.rs' }));
    assert.equal(c.userId, 'u-123');
    assert.equal(c.email, 'trkac@primer.rs');
  });

  test('adresa sa ne-ASCII znakovima ne izlazi izobličena', () => {
    const app = loadApp();
    for (const mejl of ['đorđe@primer.rs', 'müller@primer.de', 'пера@пример.рс']) {
      const c = app.call('sbClaims', jwtSa({ sub: 'u1', email: mejl }));
      assert.equal(c.email, mejl, 'izobličeno dekodiranje: ' + mejl);
    }
  });

  test('pokvaren token ne baca nego vraća prazno', () => {
    const app = loadApp();
    for (const zao of ['', 'a.b.c', 'nije-jwt', 'a.!!!.c', 'a.' + 'x'.repeat(50) + '.c']) {
      const c = app.call('sbClaims', zao);
      assert.equal(c.userId, null, 'prošlo je: ' + zao);
      assert.equal(c.email, null);
    }
  });

  test('escape() se više ne koristi', () => {
    assert.doesNotMatch(readClientSource(), /decodeURIComponent\(escape\(/,
      'čitanje JWT-a i dalje stoji na funkciji uklonjenoj iz standarda');
  });
});

describe('OAuth — CSRF zaštita', () => {
  test('Strava: pogrešan, istekao, odsutan i već potrošen state se odbijaju', () => {
    const app = loadApp();
    const post = v => app.evalIn(`localStorage.setItem('sub19_st_state', JSON.stringify(${JSON.stringify(v)}))`);

    post({ st: 'PRAVI', exp: Date.now() + 60000 });
    assert.equal(app.call('stravaCheckState', 'NAPADACEV'), false, 'prihvaćen tuđi state');

    post({ st: 'PRAVI', exp: Date.now() - 1 });
    assert.equal(app.call('stravaCheckState', 'PRAVI'), false, 'prihvaćen istekao state');

    app.evalIn(`localStorage.removeItem('sub19_st_state')`);
    assert.equal(app.call('stravaCheckState', ''), false, 'prihvaćen prazan state');

    post({ st: 'PRAVI', exp: Date.now() + 60000 });
    assert.equal(app.call('stravaCheckState', 'PRAVI'), true, 'odbijen ispravan state');
    assert.equal(app.call('stravaCheckState', 'PRAVI'), false, 'state je iskorišćen dvaput');
  });

  test('intervals.icu: isto, i sopstvenim ključem (ne troši Stravin)', () => {
    const app = loadApp();
    const st = app.call('icuMakeState');
    assert.ok(app.evalIn(`localStorage.getItem('sub19-icu-state')`), 'ICU state nije sačuvan');
    assert.equal(app.evalIn(`localStorage.getItem('sub19_st_state')`), null, 'ICU je dirao Stravin ključ');
    assert.equal(app.call('icuCheckState', 'NAPADACEV'), false);
    const st2 = app.call('icuMakeState');
    assert.equal(app.call('icuCheckState', st2), true);
    assert.equal(app.call('icuCheckState', st2), false, 'ICU state je iskorišćen dvaput');
    assert.notEqual(st, st2, 'state nije nasumičan');
  });

  test('state je kriptografski nasumičan, ne Math.random', () => {
    const izvor = readClientSource();
    assert.ok(izvor.includes('crypto.getRandomValues'), 'nema crypto.getRandomValues');
    const f = /function secureRandomToken\(\)\{[\s\S]*?\n\}/.exec(izvor)[0];
    assert.ok(!/Math\.random/.test(f), 'secureRandomToken koristi Math.random');
    const app = loadApp();
    assert.match(app.call('secureRandomToken'), /^[0-9a-f]{40}$/);
  });

  test('prozor za prijavu nije duži od 5 minuta', () => {
    /* Prozor je ujedno i vreme u kom bi podmetnut #access_token bio usvojen. */
    const app = loadApp();
    assert.ok(app.get('SB_PROZOR_MS') <= 5 * 60 * 1000,
      `prozor je ${app.get('SB_PROZOR_MS') / 60000} min`);
  });

  test('podmetnut #access_token ne može da zameni već prijavljen nalog', () => {
    const izvor = readClientSource();
    const blok = /if\(h\)\{[\s\S]*?\n  \}/.exec(izvor)[0];
    assert.ok(/noviClaims\.userId!==SB\.userId/.test(blok),
      'sbInit ne poredi ID naloga pre usvajanja tokena');
  });
});

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

  test('service_role ključ postoji samo tamo gde mora', async () => {
    /* Ovaj ključ zaobilazi RLS. Sme samo u daily-report i broadcast (oboje
       gateovano CRON_SECRET-om / vlasnikom), i NIKAD u klijentu.
       push.js je treći iz istog razloga: jutarnji podsetnik i „analiza je
       gotova" šalju se dok korisnik NIJE prisutan, pa njegovog tokena nema —
       a i te putanje su gateovane CRON_SECRET-om (v. proveriTajnu).

       delete-account.js je četvrti, i jedini koji ključ koristi DOK je
       korisnik prisutan. Mora: brojači (`api_usage`, `bug_report_usage`,
       `endpoint_usage`) se po dizajnu pišu isključivo kroz `check_and_bump_*`
       i nemaju delete politiku za korisnika, a brisanje reda u `auth.users`
       je ionako admin operacija. Zauzvrat ta putanja NIKAD ne čita čiji se
       nalog briše iz zahteva — samo iz proverenog tokena; drži to test „ne
       briše nalog čiji id stigne u telu zahteva" u api.test.mjs.

       Vlasnikov spisak korisnika, brisanje tudjeg naloga i zabrana ZIVE U
       broadcast.js — bili su zaseban api/admin-users.js, ali Vercel Hobby plan
       dozvoljava najvise 12 serverless funkcija po deployu i trinaesta obara
       ceo build. Kapija za te radnje je UZA nego za slanje mejla: samo vlasnik,
       nikad CRON_SECRET. */
    const dozvoljeni = new Set(['daily-report.js', 'broadcast.js', 'push.js',
                                'delete-account.js']);
    const { readdirSync } = await import('node:fs');
    for (const f of readdirSync(new URL('../api/', import.meta.url))) {
      const izvor = readRepoFile('api/' + f);
      if (/SUPABASE_SERVICE_ROLE_KEY/.test(izvor)) {
        assert.ok(dozvoljeni.has(f), `service_role ključ se koristi u api/${f}`);
      }
    }
    /* Traži se STVARNA vrednost ključa, ne pomen imena — index.html sadrži
       komentar koji upozorava da `sb_secret_...` nikad ne sme u klijent, i to
       je ispravno da tu piše. */
    const klijent = readClientSource();
    const pravKljuc = /sb_secret_[A-Za-z0-9_-]{12,}|eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\./;
    assert.ok(!pravKljuc.test(klijent), 'prava vrednost tajnog ključa je u klijentskom kodu');
    assert.ok(!/process\.env/.test(klijent), 'klijent pokušava da čita serverske promenljive');
    /* Anon/publishable ključ SME (javan je po dizajnu, zaštitu nosi RLS). */
    assert.ok(/sb_publishable_/.test(klijent), 'nedostaje očekivan publishable ključ');
  });
});

describe('Zapisi o oporavku (intervals.icu / backup)', () => {
  /* Server ih pretvara u brojeve, ali uvoz backupa i sbPull nisu — a odatle
     idu pravo u HTML. Sva tri mesta su jednom bila probijena. */
  function otrovanOporavak(app, P) {
    app.ctx.__p = P;
    app.evalIn(`S.wellness={};
      for(let i=1;i<=8;i++){ const d='2026-07-0'+i;
        S.wellness[d]={datum:d,hrv:__p,pulsUMiru:__p,sanH:__p,sanOcena:__p,ctl:__p,atl:__p,svezina:__p}; }`);
  }

  test('kartica Oporavak ne ubacuje HTML', () => {
    for (const P of PAYLOADI) {
      const app = loadApp(); otrovanOporavak(app, P);
      assert.deepEqual(ubaceniTagovi(app.call('karticaOporavka')), [],
        `karticaOporavka propustila ${JSON.stringify(P)}`);
    }
  });

  test('kartica Puls u miru i njen grafikon ne ubacuju HTML', () => {
    /* Nova povrsina (v202): zasebna kartica sa sopstvenim SVG-om. Prolazi kroz
       iste otrove kao i „Jutros" — bez ovoga bi nov kvadrat bio jedina
       nezasticena tacka na ekranu Oporavak. */
    for (const P of PAYLOADI) {
      const app = loadApp(); otrovanOporavak(app, P);
      assert.deepEqual(ubaceniTagovi(app.call('karticaPulsUMiru')), [],
        `karticaPulsUMiru propustila ${JSON.stringify(P)}`);
    }
  });

  test('HRV grafikon (SVG) ne ubacuje HTML', () => {
    for (const P of PAYLOADI) {
      const app = loadApp(); app.ctx.__p = P;
      app.evalIn(`S.wellness={}; for(let i=1;i<=8;i++){const d='2026-07-0'+i;
        S.wellness[d]={datum:d,hrv:(i<8?50+i:__p)};}`);
      assert.deepEqual(ubaceniTagovi(app.evalIn('chartHrv(oporavakNiz(90))')), [],
        `chartHrv propustio ${JSON.stringify(P)}`);
    }
  });

  test('red „Tog jutra" na kartici treninga ne ubacuje HTML', () => {
    for (const P of PAYLOADI) {
      const app = loadApp(); otrovanOporavak(app, P);
      app.evalIn(`S.log[DATED[0].id]={status:'done',km:8,sec:2000,ts:'2026-07-08'}`);
      assert.deepEqual(ubaceniTagovi(app.evalIn('formHTML(DATED[0])')), [],
        `formHTML propustio ${JSON.stringify(P)}`);
    }
  });

  test('cistWellness svodi sve na brojeve i odbacuje smeće', () => {
    const app = loadApp();
    app.ctx.__w = {
      '2026-07-01': { hrv: '55', pulsUMiru: 48, sanH: '7.5', svezina: -3 },
      '2026-07-02': { hrv: PAYLOADI[0], pulsUMiru: {}, sanH: [], ctl: 'abc' },
      'nije-datum': { hrv: 60 },
      '2026-07-03': 'nije objekat'
    };
    const c = app.evalIn('cistWellness(__w)');
    assert.equal(c['2026-07-01'].hrv, 55, 'broj kao tekst nije pretvoren');
    assert.equal(c['2026-07-01'].sanH, 7.5);
    assert.equal(c['2026-07-02'].hrv, null, 'payload nije očišćen');
    assert.equal(c['2026-07-02'].ctl, null);
    assert.ok(!('nije-datum' in c), 'ključ koji nije datum je prošao');
    assert.ok(!('2026-07-03' in c), 'zapis koji nije objekat je prošao');
    assert.equal(app.evalIn('JSON.stringify(cistWellness(null))'), '{}');
    assert.equal(app.evalIn('JSON.stringify(cistWellness([1,2]))'), '{}');
  });

  test('migrate čisti wellness (pokriva i uvoz i sbPull)', () => {
    const app = loadApp();
    app.ctx.__z = { v: 7, log: {}, wellness: { '2026-07-01': { hrv: PAYLOADI[0] } } };
    const st = app.evalIn('migrate(__z)');
    assert.equal(st.wellness['2026-07-01'].hrv, null, 'migrate nije očistio wellness');
  });
});

describe('Fuzz — svako polje stanja otrovano, svaki ekran iscrtan', () => {
  /* Catch-all: ne cilja poznatu rupu nego traži one koje nisam nabrojao.
     Ako neka buduća kartica zaboravi esc(), ovo pada bez da se test menja. */
  for (const P of PAYLOADI) {
    test(`nijedan ekran ne ubacuje HTML za ${JSON.stringify(P).slice(0, 34)}`, () => {
      const app = loadApp();
      app.ctx.__p = P;
      app.evalIn(`
        S.genPlan={meta:{raceDistM:5000,raceName:__p,dayWarnings:[__p]},
          pred:[{id:'g1_0',w:1,l:'N1 · '+__p,q:4,pt:260,p5k:1200}],qs:{},
          weeks:[{w:1,start:'2026-06-22',focus:__p,days:[
            {dow:0,tag:'tempo',km:8,desc:__p,id:'g1d1',
             session:{type:'tempo',kind:__p,qKm:4,paceSec:260,wuKm:2,cdKm:2}},
            {dow:1,tag:'lako',km:5,desc:__p,id:'g1d2'},
            {dow:2,rest:true,desc:__p,id:'g1d3'}]}]};
        setActivePlan(); rebuildDateIndex();
        S.log['g1d1']={status:'done',km:8,sec:2000,note:__p,src:__p,stravaName:__p,stravaDesc:__p,
                       autoOdbijen:__p,hr:__p,rpe:__p,maxHr:__p,elevGain:__p,relEffort:__p,temp:__p};
        S.pred={'g1_0':__p};
        S.knee=[{id:'k1',src:'g1d1',date:'2026-06-22',act:__p,pain:5,note:__p,part:__p}];
        S.kg=[{date:'2026-06-22',kg:__p,src:'g1d1'}];
        S.vdotLog=[{id:'g1_0',ts:'2026-07-01',vdot:__p,prev:__p,delta:__p,measured:__p}];
        S.strava={athlete:__p,lastSync:1,access:'a',refresh:'b',expiresAt:9e12,scope:__p,hrZones:[{min:__p,max:__p}]};
        S.icu={athleteId:__p,token:'t',lastSync:1,lastPush:1,scope:__p};
        S.wellness={}; for(let i=1;i<=8;i++){const d='2026-07-0'+i;
          S.wellness[d]={datum:d,hrv:__p,pulsUMiru:__p,sanH:__p,sanOcena:__p,ctl:__p,atl:__p,svezina:__p};}
        S.ui.bodyView=__p;
      `);
      const ekrani = [['renderDanas', '#pg-danas'], ['renderPlan', '#pg-plan'],
        ['renderOporavak', '#pg-opor'], ['renderOporavak', '#pg-opor'], ['renderPred', '#pg-pred']];
      for (const [fn, sel] of ekrani) {
        app.call(fn);
        const t = ubaceniTagovi(app.evalIn(`$("${sel}").innerHTML`) || '');
        assert.deepEqual(t, [], `${fn} propustio → ${t.slice(0, 3).join(' ')}`);
      }
      /* i modalni prikazi */
      for (const fn of ['openSettings']) {
        app.call(fn);
        const t = ubaceniTagovi(app.evalIn('$("#sheet").innerHTML') || '');
        assert.deepEqual(t, [], `${fn} propustio → ${t.slice(0, 3).join(' ')}`);
      }
      for (const izraz of ['openDaySheet("g1d1")', 'openAltSheet("g1d1")',
        'openKneeSheet("k1")', 'openKneeSheet(null)', 'openWeekSwap(1)']) {
        app.evalIn(izraz);
        const t = ubaceniTagovi(app.evalIn('$("#sheet").innerHTML') || '');
        assert.deepEqual(t, [], `${izraz} propustio → ${t.slice(0, 3).join(' ')}`);
      }
    });
  }
});

describe('Prepoznavanje vlasnika', () => {
  const klijent = readClientSource();

  test('poredi se Supabase ID naloga, ne mejl adresa', () => {
    assert.match(klijent, /const ADMIN_UID='[0-9a-f-]{36}'/,
      'nema ADMIN_UID u očekivanom obliku');
    assert.match(klijent, /function jeVlasnik\(\)\{ return sbAuthed\(\) && SB\.userId===ADMIN_UID; \}/,
      'jeVlasnik ne poredi po ID-u naloga');
  });

  test('mejl adresa vlasnika nije u klijentskom kodu (skreperi za spam)', () => {
    const mejlovi = klijent.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) || [];
    /* Dozvoljeno je samo ono što nije stvarna adresa: primeri u placeholderima
       i sl. Prava adresa vlasnika ne sme tu da stoji. */
    const stvarne = mejlovi.filter(m => !/example|@t\.rs|@b\.c|noreply/i.test(m));
    assert.deepEqual(stvarne, [], `mejl adrese u index.html: ${stvarne.join(', ')}`);
  });

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

  test('tuđi nalog ne prolazi kao vlasnik', () => {
    const app = loadApp();
    app.evalIn(`SB.access='x'; SB.userId='11111111-2222-3333-4444-555555555555'; SB.email='napadac@zlo.rs'`);
    assert.equal(app.call('jeVlasnik'), false, 'tuđi ID je prošao kao vlasnik');
    app.evalIn(`SB.userId=ADMIN_UID`);
    assert.equal(app.call('jeVlasnik'), true, 'vlasnik nije prepoznat');
    app.evalIn(`SB.access=null`);
    assert.equal(app.call('jeVlasnik'), false, 'neprijavljen je prošao kao vlasnik');
  });
});

describe('Nonce kroz redirect_to (Supabase prijava)', () => {
  const nonceIz = href => {
    const m = /redirect_to=([^&]+)/.exec(href);
    return m ? new URLSearchParams(new URL(decodeURIComponent(m[1])).search).get('sbn') : null;
  };

  test('sbLogin šalje nasumičan nonce u povratnoj adresi', () => {
    const a = loadApp(); a.call('sbLogin');
    const n1 = nonceIz(a.ctx.location.href);
    assert.match(n1 || '', /^[0-9a-f]{40}$/, `nonce nije poslat: ${a.ctx.location.href}`);
    const b = loadApp(); b.call('sbLogin');
    assert.notEqual(n1, nonceIz(b.ctx.location.href), 'nonce nije nasumičan');
  });

  test('poslat nonce je ISTI onaj koji se čuva za proveru', () => {
    const a = loadApp(); a.call('sbLogin');
    const poslat = nonceIz(a.ctx.location.href);
    assert.equal(a.call('sbCheckState', poslat), true, 'ispravan nonce nije prihvaćen');
  });

  test('pogrešan nonce se odbija', () => {
    const a = loadApp(); a.call('sbLogin');
    assert.equal(a.call('sbCheckState', 'a'.repeat(40)), false, 'tuđi nonce je prošao');
  });

  test('istekao nonce se odbija i kad je tačan', () => {
    const a = loadApp({ now: '2026-07-01T10:00:00Z' });
    a.call('sbLogin');
    const poslat = nonceIz(a.ctx.location.href);
    a.clock.set('2026-07-01T10:10:00Z');            /* prozor je 3 min */
    assert.equal(a.call('sbCheckState', poslat), false, 'istekao nonce je prošao');
  });

  test('nonce je jednokratan', () => {
    const a = loadApp(); a.call('sbLogin');
    const poslat = nonceIz(a.ctx.location.href);
    assert.equal(a.call('sbCheckState', poslat), true);
    assert.equal(a.call('sbCheckState', poslat), false, 'isti nonce je prihvaćen dvaput');
  });

  test('prvo pokretanje: bez nonce-a prolazi (uvođenje ne zaključava naloge)', () => {
    /* Ako Supabase na ovom projektu odbacuje upit u redirect_to, prijava mora
       da radi kao ranije — inače bi izmena zaključala sve korisnike. */
    const a = loadApp();
    a.call('sbMakeState');
    assert.equal(a.call('sbCheckState', null), true, 'prvo pokretanje je zaključano');
  });

  test('kad se jednom dokaže da nonce radi, izostavljanje se ODBIJA', () => {
    /* Napadač ne sme da „spusti" zaštitu tako što izostavi parametar. */
    const a = loadApp();
    a.call('sbLogin');
    const poslat = nonceIz(a.ctx.location.href);
    assert.equal(a.call('sbCheckState', poslat), true);
    assert.equal(a.evalIn('sbNonceRadi()'), true, 'saznanje nije zapamćeno');
    a.call('sbMakeState');
    assert.equal(a.call('sbCheckState', null), false, 'downgrade je prošao');
  });

  test('saznanje preživljava restart aplikacije (localStorage)', () => {
    const a = loadApp();
    a.call('sbLogin');
    a.call('sbCheckState', nonceIz(a.ctx.location.href));
    const zapamceno = a.ls.getItem('sub19_sb_nonce_ok');
    assert.equal(zapamceno, '1');
    const b = loadApp({ seedLocalStorage: { sub19_sb_nonce_ok: '1' } });
    b.call('sbMakeState');
    assert.equal(b.call('sbCheckState', null), false, 'saznanje se izgubilo pri restartu');
  });

  test('bez pokrenute prijave ništa ne prolazi', () => {
    const a = loadApp();
    assert.equal(a.call('sbCheckState', 'a'.repeat(40)), false);
    assert.equal(a.call('sbCheckState', null), false);
  });
});

describe('Harness stvarno čita ono što render upiše', () => {
  /* Ovaj opis postoji zato što je harness jedno vreme vraćao NOV element pri
     svakom querySelector-u: render je pisao u jedan objekat, test čitao iz
     drugog, dobijao prazan string i prolazio IAKO NIŠTA NIJE PROVERAVAO.
     Nekoliko bezbednosnih testova je tako bilo prazan hod. Ako se to ponovi,
     pada ovde — pre nego što lažno zeleni fuzz uspava. */
  test('querySelector vraća isti element pri svakom pozivu', () => {
    const app = loadApp();
    assert.equal(app.evalIn('$("#pg-danas") === $("#pg-danas")'), true,
      'querySelector vraća nov element — testovi kroz render ništa ne proveravaju');
    assert.equal(app.evalIn('document.getElementById("sb-gate") === document.querySelector("#sb-gate")'), true,
      'getElementById i querySelector ne dele isti element');
  });

  test('render zaista puni ekran koji test čita', () => {
    const app = loadApp();
    app.call('renderDanas');
    assert.ok((app.evalIn('$("#pg-danas").innerHTML') || '').length > 200,
      'renderDanas nije ništa upisao — čitanje ide u prazno');
    app.call('renderPred');
    assert.ok((app.evalIn('$("#pg-pred").innerHTML') || '').length > 200,
      'renderPred nije ništa upisao');
  });
});

describe('VDOT zapisi (backup / sbPull)', () => {
  test('cistVdotLog svodi vrednosti na brojeve', () => {
    const app = loadApp();
    app.ctx.__v = [
      { id: 'p1', ts: '2026-07-01', vdot: '48.1', prev: 47, delta: 1.1, measured: 50 },
      { id: 'p2', ts: '2026-07-02', vdot: PAYLOADI[0], prev: {}, delta: [], measured: 'abc' },
      { id: 'p3' },                       /* bez ts — otpada */
      'nije objekat',
      { ts: '2026-07-03' }                /* bez id — otpada */
    ];
    const c = app.evalIn('cistVdotLog(__v)');
    assert.equal(c.length, 2, 'nevalidni zapisi nisu odbačeni');
    assert.equal(c[0].vdot, 48.1, 'broj kao tekst nije pretvoren');
    assert.equal(c[1].vdot, null, 'payload nije očišćen');
    assert.equal(c[1].measured, null);
    assert.equal(app.evalIn('cistVdotLog(null).length'), 0);
  });

  test('migrate čisti vdotLog (pokriva i uvoz i sbPull)', () => {
    const app = loadApp();
    app.ctx.__z = { v: 7, log: {}, vdotLog: [{ id: 'p1', ts: '2026-07-01', vdot: PAYLOADI[0] }] };
    const st = app.evalIn('migrate(__z)');
    assert.equal(st.vdotLog[0].vdot, null, 'migrate nije očistio vdotLog');
  });

  test('ekran Trka ne ubacuje HTML iz VDOT zapisa', () => {
    for (const P of PAYLOADI) {
      const app = loadApp();
      app.ctx.__p = P;
      app.evalIn(`S.vdotLog=[{id:'p1',ts:'2026-07-01',vdot:__p,prev:__p,delta:__p,measured:__p},
                              {id:'p2',ts:'2026-07-02',vdot:__p,prev:__p,delta:__p,measured:__p}];
                  S.pred={p1:__p,p2:__p}`);
      app.call('renderPred');
      const t = ubaceniTagovi(app.evalIn('$("#pg-pred").innerHTML') || '');
      assert.deepEqual(t, [], `renderPred propustio ${JSON.stringify(P)} → ${t.slice(0, 2).join(' ')}`);
    }
  });

  test('oznaka pored unosa tempa (vdotDeltaHTML) ne ubacuje HTML', () => {
    const app = loadApp();
    app.ctx.__p = PAYLOADI[0];
    app.evalIn(`S.vdotLog=[{id:'p1',ts:'2026-07-01',vdot:__p,delta:__p}]`);
    assert.deepEqual(ubaceniTagovi(app.call('vdotDeltaHTML', 'p1', 260)), []);
  });
});

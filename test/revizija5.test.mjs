/* PETA REVIZIJA — ZAMKE ZA NALAZE KOJI SU JOŠ OTVORENI

   Svaki blok ima DVA testa:
     - `NALAZ N…`  — invarijanta koja MORA da važi. Danas PADA. To je nalaz.
     - `kontrola N…` — negativna provera koja danas PROLAZI. Ona ne meri
       aplikaciju nego SCENARIO: ako popravka (ili neka kasnija izmena) učini
       da zamka više ne postavlja situaciju zbog koje postoji, kontrola pada i
       kaže da je test postao prazan hod. Nijedna invarijanta nije snimljena
       vrednost — sve su oblika „nikad" / „mora".

   Kad se nalaz popravi, `NALAZ` prolazi a `kontrola` MORA da nastavi da prolazi.
   Ako prođu obe tek pošto je kontrola prestala da važi, popravka je ugasila
   funkciju umesto da je popravila. */

import test from 'node:test';
import assert from 'node:assert/strict';
import { loadApp } from './harness.mjs';

/* ============================================================
   Lažni Supabase: jedan red `user_state`, kao u produkciji.
   `updated_at` raste sa svakim upisom, `device_id` nosi poslednjeg pisca. */
function lazniServer() {
  const red = { data: null, updated_at: null, device_id: null };
  let t = 0;
  red._tick = () => '2026-08-09T10:00:' + String(10 + t++).padStart(2, '0') + '.000Z';
  return red;
}
function uredjaj(ime, server, opts = {}) {
  const a = loadApp({ now: '2026-08-09T10:00:00Z', online: true });
  a.evalIn(`SB_URL='https://fake.test'; SB_ANON='anon';
    SB={access:'tok',refresh:'ref',expiresAt:${Date.now() + 3600e3},email:'x@y.z',userId:'u1',
        slika:null,ime:null,seenAt:null,deviceId:'${ime}'};`);
  a.setFetch(async (url, opt) => {
    const u = String(url);
    if (u.includes('/rest/v1/user_state')) {
      if (opt && opt.method === 'POST') {
        if (opts.postPuca) throw new Error('Failed to fetch');
        const b = JSON.parse(opt.body);
        server.data = b.data; server.updated_at = server._tick(); server.device_id = b.device_id;
        return { ok: true, status: 200, json: async () => [{ updated_at: server.updated_at }] };
      }
      if (opts.getPuca) throw new Error('Failed to fetch');
      if (!server.updated_at) return { ok: true, status: 200, json: async () => [] };
      return { ok: true, status: 200, json: async () => [{ data: server.data, updated_at: server.updated_at, device_id: server.device_id }] };
    }
    return { ok: true, status: 200, json: async () => ({}), text: async () => '' };
  });
  return a;
}
/* Uređaj sazna gde je server — tačno ono što `sbInit` uradi pri pokretanju. */
const upoznajServer = a => a.evalIn('(async()=>{ const d=await sbRemoteAt(); SB.seenAt = d ? d.at : null; })()');

/* Dva uređaja na istom nalogu; A upiše svoje, pa B upiše svoje. */
async function dvaUredjaja(opts = {}) {
  const server = lazniServer();
  const A = uredjaj('devA', server), B = uredjaj('devB', server);
  await A.evalIn('sbPush()');            /* prvi upis — obojica ga vide */
  await upoznajServer(A); await upoznajServer(B);
  A.evalIn(`S.kg.push({id:'kgA',date:'2026-08-09',kg:71});`);
  B.evalIn(`S.kg.push({id:'kgB',date:'2026-08-09',kg:99});`);
  await A.evalIn('sbPush()');            /* A je prvi na mreži */
  if (opts.bSeVracaUAplikaciju) {        /* B je instalirana PWA koja se budi iz pozadine */
    B.evalIn(`document.visibilityState='visible';`);
    B.okini('visibilitychange');
    await new Promise(r => setTimeout(r, 30));
  }
  await B.evalIn('sbPush()');            /* B snimi bilo šta -> sbSchedulePush -> sbPush */
  return { server, A, B };
}

test('NALAZ N1 — push nikad ne sme da pregazi zapis koji je na server stavio DRUGI uređaj, a koji ovaj nije video', async () => {
  const { server, B } = await dvaUredjaja({ bSeVracaUAplikaciju: true });
  const naServeru = server.data.kg.map(x => x.id);
  assert.ok(naServeru.includes('kgA'),
    'unos sa uređaja A je nestao sa servera: na serveru je ' + JSON.stringify(naServeru) +
    ' (B.seenAt=' + B.evalIn('SB.seenAt') + ', server=' + server.updated_at + ')');
});

test('kontrola N1a — scenario stvarno postavlja sukob (B je zastareo u trenutku upisa)', async () => {
  const server = lazniServer();
  const A = uredjaj('devA', server), B = uredjaj('devB', server);
  await A.evalIn('sbPush()');
  await upoznajServer(A); await upoznajServer(B);
  const seenB = B.evalIn('SB.seenAt');
  A.evalIn(`S.kg.push({id:'kgA',date:'2026-08-09',kg:71});`);
  await A.evalIn('sbPush()');
  assert.ok(seenB && server.updated_at > seenB,
    'B mora biti zastareo pre sopstvenog upisa, inače zamka ne meri ništa');
  assert.equal(server.device_id, 'devA', 'na serveru mora stajati TUĐI uređaj');
  assert.ok(server.data.kg.some(x => x.id === 'kgA'), 'A-ov unos mora biti na serveru pre nego što B upiše');
});

test('kontrola N1b — povratak u aplikaciju NE osvežava saznanje o serveru (zato zamka i postoji)', async () => {
  const { B, server } = await dvaUredjaja({ bSeVracaUAplikaciju: true });
  assert.ok(B.okini('visibilitychange') > 0, 'aplikacija mora biti zakačena na visibilitychange');
  assert.ok(server.updated_at, 'server mora imati zapis');
});

test('NALAZ N2 — „Uzmi sa servera" koje ne uspe ne sme da otključa upis niti da ćuti', async () => {
  const server = lazniServer();
  const A = uredjaj('devA', server);
  A.evalIn(`S.kg.push({id:'kgSaServera',date:'2026-08-09',kg:70});`);
  await A.evalIn('sbPush()');                       /* server ima podatke drugog uređaja */

  /* Uređaj B: povlačenje puca (nema signala / 500 / HTML umesto JSON-a), upis prolazi. */
  const B = uredjaj('devB', server, { getPuca: true });
  B.evalIn(`SB.seenAt='2026-08-01T00:00:00Z'; S.kg.push({id:'kgLokalno',date:'2026-08-09',kg:99});`);
  /* Traka se pravi preko createElement/appendChild — uhvati je da bi joj se
     dugme moglo pritisnuti kao u pregledaču. */
  B.evalIn(`globalThis.__traka=null;
    const _gid=document.getElementById;
    document.getElementById=id=> id==='sync-sukob' ? globalThis.__traka : _gid(id);
    const _ap=document.body.appendChild.bind(document.body);
    document.body.appendChild=el=>{ globalThis.__traka=el; return _ap(el); };`);
  B.evalIn(`prikaziSukobSync('2026-08-09T09:00:00Z')`);
  assert.equal(B.evalIn('SB_SUKOB'), true, 'traka mora zaključati upis dok se ne izabere');

  await B.evalIn(`__traka.querySelector('#sy-pull').onclick()`);   /* korisnik bira SERVER */
  await B.evalIn('sbPush()');                                      /* pa nastavi da koristi app */

  const naServeru = server.data.kg.map(x => x.id);
  assert.ok(naServeru.includes('kgSaServera'),
    'korisnik je izabrao „Uzmi sa servera", povlačenje nije uspelo, i lokalno stanje je ipak pregazilo server: ' +
    JSON.stringify(naServeru) + '; upozorenja korisniku: ' + B.calls.alerts.length);
  assert.ok(B.calls.alerts.length > 0, 'neuspelo povlačenje mora biti rečeno korisniku');
});

test('kontrola N2 — kad povlačenje USPE, isti klik stvarno usvaja serversko stanje', async () => {
  const server = lazniServer();
  const A = uredjaj('devA', server);
  A.evalIn(`S.kg.push({id:'kgSaServera',date:'2026-08-09',kg:70});`);
  await A.evalIn('sbPush()');
  const B = uredjaj('devB', server);
  B.evalIn(`SB.seenAt='2026-08-01T00:00:00Z'; S.kg.push({id:'kgLokalno',date:'2026-08-09',kg:99});`);
  B.evalIn(`globalThis.__traka=null;
    const _gid=document.getElementById;
    document.getElementById=id=> id==='sync-sukob' ? globalThis.__traka : _gid(id);
    const _ap=document.body.appendChild.bind(document.body);
    document.body.appendChild=el=>{ globalThis.__traka=el; return _ap(el); };`);
  B.evalIn(`prikaziSukobSync('2026-08-09T09:00:00Z')`);
  await B.evalIn(`__traka.querySelector('#sy-pull').onclick()`);
  const kg = B.evalIn('JSON.stringify(S.kg.map(x=>x.id))');
  assert.ok(JSON.parse(kg).includes('kgSaServera'),
    'sa ispravnom mrežom klik mora da donese serverski unos — inače zamka N2 pada iz pogrešnog razloga');
});

/* ============================================================
   Generisan plan sa zapamćenim ulazom (v243 ga pamti; ovde se postavlja ručno
   jer `finishOnboarding` traži ceo čarobnjak). */
function planSaUlazom(a, ulaz) {
  const p = a.call('generatePlan', ulaz);
  assert.ok(!p.error, 'plan mora da se napravi: ' + p.error);
  a.evalIn(`S.genPlan=adaptGeneratedPlan(${JSON.stringify(p)});
            S.genPlan.ulaz=${JSON.stringify(ulaz)};
            setActivePlan(); rebuildDateIndex();`);
}
const ULAZ = {
  startDate: '2026-01-05', raceDate: '2026-05-24', raceDistM: 42195,
  pb: { distM: 42195, sec: 13500 }, weeklyKm: 60, runDays: 5,
  quality: 2, intensity: 'std', trainedRecently: true, goalSec: 13200
};
/* Opis svakog dana i ciljni tempo svakog PRED reda — sve što promena cilja sme
   da dira samo u budućnosti. */
const otisakPlana = a => JSON.parse(a.evalIn(
  `JSON.stringify({dani:CUR_PLAN.map(w=>w.days.map(d=>[d.id,d.km,d.desc||''])), pred:CUR_PRED.map(r=>[r.id,r.w,r.pt])})`));
const otisakIz = r => ({
  dani: r.weeks.map(w => w.days.map(d => [d.id, d.km, d.desc || ''])),
  pred: r.pred.map(x => [x.id, x.w, x.pt])
});
/* „Prošlost" se meri KALENDAROM, ne brojem koji funkcija sama prijavi.
   Da se filtrira po `r.promenaCilja.nedelja`, zamka bi u kvarnom slučaju
   (nedelja=1) poredila prazan skup i prošla ne merivši ništa. */
function proslostDoNedelje(a, today) {
  const w = JSON.parse(a.evalIn(`JSON.stringify(CUR_PLAN.map(x=>({w:x.w,kraj:addD(x.start,6)})))`));
  const prosle = w.filter(x => x.kraj < today).map(x => x.w);
  return prosle.length ? Math.max(...prosle) + 1 : 1;   /* prva nedelja koja NIJE prošla */
}
function razlikeUProslosti(pre, po, prvaBuduca) {
  const out = [];
  pre.dani.forEach((w, i) => {
    if (i + 1 >= prvaBuduca) return;
    w.forEach((d, j) => {
      const b = (po.dani[i] || [])[j];
      if (JSON.stringify(d) !== JSON.stringify(b)) out.push('N' + (i + 1) + ' ' + JSON.stringify(d) + ' -> ' + JSON.stringify(b));
    });
  });
  pre.pred.forEach((r, i) => {
    if (r[1] >= prvaBuduca) return;
    const b = po.pred[i];
    if (JSON.stringify(r) !== JSON.stringify(b)) out.push('PRED ' + JSON.stringify(r) + ' -> ' + JSON.stringify(b));
  });
  return out;
}

test('NALAZ N3 — promena cilja nikad ne sme da prepiše nedelju koja je već prošla', () => {
  const a = loadApp({ now: '2026-01-05T09:00:00Z' });
  planSaUlazom(a, ULAZ);
  a.evalIn(`TODAY='2026-06-15';                       /* tri nedelje POSLE trke */
            CUR_PLAN.forEach(w=>w.days.forEach(d=>{ if(!d.rest) S.log[d.id]={status:'done',km:d.km,ts:d.date}; }));`);
  const pre = otisakPlana(a);
  const prvaBuduca = proslostDoNedelje(a, '2026-06-15');
  assert.equal(prvaBuduca, 21, 'ceo plan od 20 nedelja mora biti u prošlosti — inače zamka ne meri prošlost');
  const r = a.call('planSaNovimCiljem', 10800, '2026-06-15');
  /* ISPRAVLJENA TVRDNJA. Prvobitno je ovde stajalo `assert.ok(!r.error)`, pa je
     ova zamka bila u protivrečnosti sa N3b: N3b traži da poziv BUDE odbijen kad
     nijedna nedelja ne dolazi, a to je i popravka koju izveštaj sam predlaže.
     Sa njom N3 nikad ne bi mogao da prođe, ma koliko kod bio ispravan.

     Prava invarijanta pokriva oba ishoda: ili se odbije, ili prošlost ostane
     netaknuta. Na starom kodu pada isto kao i pre — tamo se NIJE odbilo, a
     prošlost JESTE prepisana. */
  if (r.error) return;
  const razlike = razlikeUProslosti(pre, otisakIz(r), prvaBuduca);
  assert.deepEqual(razlike, [],
    'plan tvrdi da menja ' + r.promenaCilja.izmenjenoNedelja + ' nedelja „koje tek dolaze (od N' +
    r.promenaCilja.nedelja + ')", a prepisao je i prošlost:\n  ' + razlike.slice(0, 6).join('\n  '));
});

test('NALAZ N3b — kad nijedna nedelja ne dolazi, promena cilja mora da bude odbijena', () => {
  const a = loadApp({ now: '2026-01-05T09:00:00Z' });
  planSaUlazom(a, ULAZ);
  a.evalIn(`TODAY='2026-06-15';`);
  const r = a.call('planSaNovimCiljem', 10800, '2026-06-15');
  assert.ok(r.error, 'plan je završen 2026-05-24 — nema nijedne buduće nedelje, a funkcija je vratila plan sa ' +
    (r.promenaCilja && r.promenaCilja.izmenjenoNedelja) + ' „budućih" nedelja');
});

test('kontrola N3 — usred pripreme promena cilja radi i NE dira prošlost', () => {
  const a = loadApp({ now: '2026-01-05T09:00:00Z' });
  planSaUlazom(a, ULAZ);
  a.evalIn(`TODAY='2026-02-23';`);
  const pre = otisakPlana(a);
  const prvaBuduca = proslostDoNedelje(a, '2026-02-23');
  assert.ok(prvaBuduca > 1 && prvaBuduca <= 20, 'mora postojati i prošlost i budućnost: prvaBuduca=' + prvaBuduca);
  const r = a.call('planSaNovimCiljem', 12600, '2026-02-23');
  assert.ok(!r.error, 'promena cilja usred pripreme mora da radi: ' + r.error);
  assert.deepEqual(razlikeUProslosti(pre, otisakIz(r), prvaBuduca), [],
    'prošlost mora ostati netaknuta i u ispravnom slučaju');
  const po = otisakIz(r);
  const budućePromenjeno = po.pred.some((x, i) => x[1] >= prvaBuduca && JSON.stringify(x) !== JSON.stringify(pre.pred[i]));
  assert.ok(budućePromenjeno, 'bar jedan budući PRED red mora da dobije nov tempo — inače promena cilja ne radi ništa');
});

test('NALAZ N4 — spojiDan nikad ne sme da odbaci poznat prosečan puls zato što trajanje nije poznato', () => {
  const a = loadApp({ now: '2026-08-09T09:00:00Z' });
  /* Strava aktivnost bez `moving_time` (ručni unos, prekinut upload) — puls JESTE poznat. */
  const s = a.call('spojiDan', [{ id: 1, type: 'Run', distance: 8000, elapsed_time: 2600, average_heartrate: 145, max_heartrate: 165 }]);
  assert.equal(s.hr, 145,
    'puls 145 je stigao sa aktivnosti, a spojiDan vratio hr=' + s.hr +
    ' (ponder je trajanje, a trajanje je 0) — trening ostaje bez pulsa');
});

test('NALAZ N4b — Strava putanja nikad ne sme da upiše trajanje 0 kao izmereno vreme', async () => {
  const a = loadApp({ now: '2026-08-09T09:00:00Z', online: true });
  planSaUlazom(a, { ...ULAZ, startDate: '2026-08-03', raceDate: '2026-12-06' });
  a.evalIn(`TODAY='2026-08-09';
    S.strava={access:'a',refresh:'r',expiresAt:Math.floor(Date.now()/1000)+3600,athlete:'X',zonesTs:Date.now()};`);
  const dan = a.evalIn(`(DATED.find(d=>!d.rest&&d.date>='2026-08-04')||{}).id`);
  const datum = a.evalIn(`(DATED.find(d=>!d.rest&&d.date>='2026-08-04')||{}).date`);
  a.setFetch(async (url) => {
    if (String(url).includes('/athlete/activities'))
      return { ok: true, status: 200, json: async () => [{ id: 1, type: 'Run', distance: 8000,
        elapsed_time: 2600, average_heartrate: 145, max_heartrate: 165, name: 'Trk',
        start_date_local: datum + 'T06:00:00Z' }] };
    return { ok: true, status: 200, json: async () => [] };
  });
  await a.evalIn('stravaSync(false)');
  const l = JSON.parse(a.evalIn(`JSON.stringify(S.log['${dan}']||null)`));
  assert.ok(l && l.status === 'done', 'trčanje mora biti evidentirano: ' + JSON.stringify(l));
  assert.notEqual(l.sec, 0,
    'upisano je sec=0 kao izmereno vreme za ' + l.km + ' km (icu putanja isti slučaj štiti sa `if(spoj.sec)`)');
});

test('kontrola N4 — sa poznatim trajanjem isti oblik daje i puls i vreme', () => {
  const a = loadApp({ now: '2026-08-09T09:00:00Z' });
  const s = a.call('spojiDan', [{ id: 1, type: 'Run', distance: 8000, moving_time: 2600, average_heartrate: 145, max_heartrate: 165 }]);
  assert.equal(s.hr, 145, 'sa moving_time puls mora da prođe — inače zamka N4 meri pogrešnu stvar');
  assert.equal(s.sec, 2600);
  assert.equal(s.km, 8);
});

test('NALAZ N5 — nečitljiva oznaka verzije nikad ne sme da obriše korisnikovo podešavanje', () => {
  const a = loadApp({ now: '2026-08-09T09:00:00Z' });
  const pun = v => ({ v, log: { n1d1: { status: 'done', km: 10 } }, knee: [], kg: [], pred: {}, predLock: {},
    vdotLog: [], moves: {}, alts: {}, genPlan: null, strava: null, wellness: {}, icu: null, t3k: [], vreme: null,
    zajed: { vidljiv: true, nadimak: 'Pera' }, ui: { firstRun: '2026-01-01' } });
  for (const v of [null, 'x', [], {}]) {
    const m = a.call('migrate', JSON.parse(JSON.stringify(pun(v))));
    /* JSON, ne deepEqual: objekat dolazi iz vm realma i ima drugi prototip. */
    assert.equal(JSON.stringify({ vidljiv: m.zajed.vidljiv, nadimak: m.zajed.nadimak }),
      JSON.stringify({ vidljiv: true, nadimak: 'Pera' }),
      'sa v=' + JSON.stringify(v) + ' migrate je vratio zajed=' + JSON.stringify(m.zajed) +
      ' — komentar iznad tvrdi da „preterano nizak broj ne može ništa da pokvari", ' +
      'ali grana v<10 dodeljuje bezuslovno umesto `o.zajed || {…}`');
  }
});

test('kontrola N5 — sa ispravnom oznakom isto stanje zadržava podešavanje', () => {
  const a = loadApp({ now: '2026-08-09T09:00:00Z' });
  const m = a.call('migrate', { v: 10, log: {}, zajed: { vidljiv: true, nadimak: 'Pera' } });
  assert.equal(JSON.stringify({ vidljiv: m.zajed.vidljiv, nadimak: m.zajed.nadimak }),
    JSON.stringify({ vidljiv: true, nadimak: 'Pera' }),
    'sa v:10 podešavanje mora da preživi — inače zamka N5 ne razlikuje uzrok');
  /* i da je „najstarije" zaista ono što se pogađa kad oznake nema */
  const m1 = a.call('migrate', { log: {} });
  assert.equal(m1.v, 10, 'stanje bez oznake se migrira do tekuće šeme');
});

test('NALAZ N6 — prozor koji se traži od intervals.icu mora da obuhvati LOKALNI današnji dan', async () => {
  const stara = process.env.TZ;
  process.env.TZ = 'Europe/Belgrade';
  try {
    /* 2026-08-09 00:30 po Beogradu = 2026-08-08 22:30 UTC */
    const a = loadApp({ now: '2026-08-08T22:30:00Z', online: true });
    a.evalIn(`S.icu={athleteId:'i1',apiKey:'k',lastSync:null}; TODAY=todayStr();`);
    let telo = null;
    a.setFetch(async (u, o) => { telo = JSON.parse(o.body); return { ok: true, status: 200, json: async () => ({ dani: [] }) }; });
    await a.evalIn('icuSync(30)');
    const danas = a.evalIn('TODAY');
    assert.ok(telo.newest >= danas,
      'TODAY=' + danas + ', a od intervals.icu se traži samo do ' + telo.newest +
      ' (`new Date().toISOString()` je UTC datum, a cela ostala aplikacija radi sa lokalnim)');
  } finally { process.env.TZ = stara; }
});

test('NALAZ N7 — dok aplikacija stoji otvorena, prelazak ponoći ne sme da ostane neprimećen', () => {
  const a = loadApp({ now: '2026-08-09T21:55:00Z' });      /* 23:55 po Beogradu/UTC+2 */
  const pre = a.evalIn('TODAY');
  a.clock.set('2026-08-10T04:15:00Z');                     /* šest sati kasnije, bez ijednog dodira */
  const sada = a.evalIn('todayStr()');
  assert.notEqual(pre, sada, 'sat mora zaista da pređe u nov dan — inače zamka ne meri ništa');
  assert.equal(a.evalIn('TODAY'), sada,
    'TODAY je ostao na ' + a.evalIn('TODAY') + ', a dan je ' + sada +
    ' — ekran „Danas", zaglavlje i podrazumevani datum unosa i dalje govore o jučerašnjem danu');
});

test('kontrola N7 — povratak u aplikaciju (jedini okidač koji postoji) stvarno uhvati nov dan', () => {
  const a = loadApp({ now: '2026-08-09T21:55:00Z' });
  a.clock.set('2026-08-10T04:15:00Z');
  a.evalIn(`document.visibilityState='visible';`);
  assert.ok(a.okini('visibilitychange') > 0, 'aplikacija mora biti zakačena na visibilitychange');
  assert.equal(a.evalIn('TODAY'), a.evalIn('todayStr()'),
    'na povratku u aplikaciju dan MORA da se uskladi — ako i ovo padne, kvar je u osveziDan(), ne u okidačima');
});

test('kontrola N6 — kad se lokalni i UTC datum poklapaju, prozor je ispravan', async () => {
  const stara = process.env.TZ;
  process.env.TZ = 'Europe/Belgrade';
  try {
    const a = loadApp({ now: '2026-08-09T10:00:00Z', online: true });   /* 12:00 po Beogradu */
    a.evalIn(`S.icu={athleteId:'i1',apiKey:'k',lastSync:null}; TODAY=todayStr();`);
    let telo = null;
    a.setFetch(async (u, o) => { telo = JSON.parse(o.body); return { ok: true, status: 200, json: async () => ({ dani: [] }) }; });
    await a.evalIn('icuSync(30)');
    assert.equal(telo.newest, a.evalIn('TODAY'),
      'usred dana prozor mora biti tačan — inače zamka N6 ne meri pomeraj zone nego nešto drugo');
    assert.ok(telo.oldest < telo.newest, 'prozor mora imati dužinu');
  } finally { process.env.TZ = stara; }
});

test('BY_ID ne pamti dane plana koji više ne postoji', () => {
  /* Napomena pete revizije, bez nalaza: `rebuildDateIndex` je čistio `BY_DATE`
     i `DATED`, ali ne i `BY_ID`. Putanja kroz koju se to vidi nije nađena, jer
     svi pozivaoci ID dobijaju iz tekućeg iscrtavanja — ali time cela zaštita
     `if(!d) return` po kodu zavisi od toga da se nešto drugo ne promeni.
     Prostor ID-jeva se menja pri svakom prelasku lični ↔ generisan plan
     ('n…' ↔ 'g…') i pri uvozu backupa. */
  const a = loadApp({ now: '2026-08-09T09:00:00Z' });
  const licni = a.evalIn('Object.keys(BY_ID).length');
  assert.ok(licni > 0, 'lični plan nije indeksiran — zamka ne meri ništa');
  assert.ok(a.evalIn(`Object.keys(BY_ID).every(k=>k[0]==='n')`), 'lični plan ne nosi „n" ID-jeve');

  planSaUlazom(a, ULAZ);
  assert.ok(a.evalIn(`Object.keys(BY_ID).every(k=>k[0]==='g')`),
    'posle prelaska na generisan plan u BY_ID su ostali dani ličnog plana: ' +
    a.evalIn(`JSON.stringify(Object.keys(BY_ID).filter(k=>k[0]!=='g').slice(0,5))`));

  a.evalIn('S.genPlan=null; setActivePlan(); rebuildDateIndex();');
  assert.ok(a.evalIn(`Object.keys(BY_ID).every(k=>k[0]==='n')`),
    'posle povratka na lični plan u BY_ID su ostali dani generisanog: ' +
    a.evalIn(`JSON.stringify(Object.keys(BY_ID).filter(k=>k[0]!=='n').slice(0,5))`));
});

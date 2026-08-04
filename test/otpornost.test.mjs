/* Otpornost na oštećen ulaz — ne "da li radi kad je sve u redu", nego
   "šta se izgubi kad nije".

   Svaki test ovde odgovara nalazu iz QA pregleda koji je bio STVARAN, ne
   teorijski: oštećen localStorage je brisao sve i lokalno i na serveru, a
   datumi iz uvezenog backupa nisu proveravani pa su lomili grafikone. */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { loadApp, readClientSource } from './harness.mjs';

/* Stanje sa stvarnim unosima. ID-jevi NAMERNO nisu iz ugrađenog seeda
   (n1d1, k1…) — inače ih uskladiVlasnickePodatke() ukloni kao tuđe, pa bi
   test merio čišćenje umesto učitavanja. */
const PRAVO = JSON.stringify({
  v: 7,
  log: { g3d2: { status: 'done', km: 8.2 }, g3d4: { status: 'done', km: 12 } },
  knee: [{ id: 'kx1', date: '2026-07-01', pain: 2, note: 'proba' }],
  kg: [{ date: '2026-07-01', kg: 81.4 }],
  pred: {}, wellness: {}, vdotLog: []
});

describe('Oštećen lokalni zapis ne briše podatke', () => {
  const OSTECEN = PRAVO.slice(0, -3);   /* prekinut upis — odsečen kraj */

  test('sirovi bajtovi se sklanjaju u zaseban ključ, ne prepisuju', () => {
    const app = loadApp({ seedLocalStorage: { 'sub19-v1': OSTECEN } });
    assert.equal(app.ls.getItem('sub19-v1-osteceno'), OSTECEN,
      'sirov sadržaj nije sačuvan — podaci su nepovratno izgubljeni');
  });

  test('podiže se zastavica sa razlogom', () => {
    const app = loadApp({ seedLocalStorage: { 'sub19-v1': OSTECEN } });
    const z = app.get('UCITAVANJE_PALO');
    assert.ok(z, 'zastavica nije podignuta');
    assert.equal(z.bajtova, OSTECEN.length);
    assert.ok(z.razlog.length > 0, 'razlog nije zabeležen');
  });

  test('korisnik VIDI traku, ne prazan ekran bez objašnjenja', () => {
    const app = loadApp({ seedLocalStorage: { 'sub19-v1': OSTECEN } });
    assert.ok(app.evalIn('!!document.getElementById("stanje-osteceno")'),
      'nema trake — aplikacija izgleda kao da je prvi put pokrenuta');
  });

  test('prazno stanje se NE gura na server', async () => {
    /* Ovo je bio najskuplji deo: sbDecide vrati "ok" (server nije noviji od
       SB.seenAt), pa bi sbPush prepisao i serversku kopiju — jedino mesto
       gde su podaci još postojali. */
    const app = loadApp({ seedLocalStorage: { 'sub19-v1': OSTECEN } });
    app.evalIn(`SB={userId:'u1',token:'t',email:'a@b.c',expiresAt:Date.now()+9e6,deviceId:'d'};`);
    const poslato = await app.evalIn('sbPush()');
    assert.equal(poslato, false, 'sbPush je poslao prazno stanje na server');
    assert.equal(app.calls.fetches.length, 0, 'otišao je mrežni zahtev');
  });

  test('ISPRAVNO stanje se učitava normalno — zaštita ne smeta', () => {
    const app = loadApp({ seedLocalStorage: { 'sub19-v1': PRAVO } });
    assert.equal(app.get('UCITAVANJE_PALO'), null, 'lažna uzbuna na ispravnom stanju');
    assert.equal(app.ls.getItem('sub19-v1-osteceno'), null, 'napravljen spas ključ bez potrebe');
    assert.equal(Object.keys(app.evalIn('S.log')).length, 2, 'unosi nisu učitani');
    assert.equal(app.evalIn('S.knee.length'), 1);
  });
});

describe('Datumi iz uvezenog backupa se proveravaju', () => {
  const app = loadApp();

  test('validanDatum odbija sve što nije stvaran datum', () => {
    for (const d of ['2026-07-01', '2026-02-28', '2024-02-29'])
      assert.equal(app.call('validanDatum', d), true, `odbijen ispravan datum ${d}`);
    for (const d of ['abc', '', null, undefined, 42, '2026-13-01', '2026-00-10',
                     '2026-02-30', '2026-7-1', '2026-07-01T00:00:00', '20260701'])
      assert.equal(app.call('validanDatum', d), false, `propušten neispravan datum ${JSON.stringify(d)}`);
  });

  test('zapisi bez upotrebljivog datuma se odbacuju, ne "popravljaju"', () => {
    /* Pogođen datum bio bi izmišljen podatak o nečijem bolu ili masi. */
    const m = app.call('migrate', {
      v: 7, log: {},
      knee: [{ id: 'k1', date: 'abc', pain: 3 }, { id: 'k2', date: '2026-07-01', pain: 1 }],
      kg: [{ date: '2026-13-45', kg: 80 }, { date: '2026-07-02', kg: 81 }]
    });
    assert.deepEqual(Array.from(m.knee).map(x => x.date), ['2026-07-01']);
    assert.deepEqual(Array.from(m.kg).map(x => x.date), ['2026-07-02']);
  });

  test('grafikon više ne ispisuje NaN koordinate', () => {
    const a = loadApp();
    a.evalIn(`S.knee=[{id:'k1',date:'abc',pain:3},{id:'k2',date:'2026-13-45',pain:2}];
              S.knee=cistDatirane(S.knee); rebuildDateIndex();`);
    a.call('renderKnee');
    const html = a.evalIn('$("#pg-koleno").innerHTML') || '';
    assert.ok(!/NaN/.test(html), 'SVG i dalje sadrži NaN koordinate');
    assert.ok(!/undefined/.test(html), 'u HTML-u je "undefined"');
  });
});

describe('Neuspeo upis u localStorage ne prekida rad', () => {
  test('save() ne baca kad je skladište puno, i javi čoveku', () => {
    const app = loadApp({ seedLocalStorage: { 'sub19-v1': PRAVO } });
    /* posle učitavanja: svaki dalji upis puca, kao kad se popuni kvota */
    app.ls.setItem = () => { const e = new Error('quota'); e.name = 'QuotaExceededError'; throw e; };
    assert.doesNotThrow(() => app.call('save'), 'save() i dalje baca — prekida pozivaoca');
    assert.ok(app.evalIn('!!document.getElementById("upis-pao")'),
      'korisnik ne vidi da čuvanje ne radi');
  });

  test('traka se ne ponavlja pri svakom čuvanju', () => {
    const app = loadApp({ seedLocalStorage: { 'sub19-v1': PRAVO } });
    app.ls.setItem = () => { throw new Error('quota'); };
    app.call('save'); app.call('save'); app.call('save');
    assert.equal(app.evalIn('document.getElementById("upis-pao") ? 1 : 0'), 1);
  });
});

describe('Prikaz vremena ne pušta smeće u ekran', () => {
  const app = loadApp();
  test('fmtClock vraća „—" umesto „-1:-1:-5" i „NaN:NaN"', () => {
    for (const v of [-5, -0.1, NaN, Infinity, -Infinity, null, undefined])
      assert.equal(app.call('fmtClock', v), '—', `fmtClock(${v}) = ${app.call('fmtClock', v)}`);
  });
  test('ispravne vrednosti se ne menjaju', () => {
    assert.equal(app.call('fmtClock', 0), '0:00');
    assert.equal(app.call('fmtClock', 273), '4:33');
    assert.equal(app.call('fmtClock', 3600), '1:00:00');
    assert.equal(app.call('fmtClock', 90061), '25:01:01');
  });
});

describe('Čarobnjak kaže ZAŠTO je zaključan', () => {
  test('nerealno vreme za izabranu distancu dobija objašnjenje', () => {
    const app = loadApp();
    app.call('openWizard');
    app.evalIn(`wiz.pbDist=5000; wiz.pbH=''; wiz.pbMin='1'; wiz.pbSec='40';`);
    app.call('updateVdotPreview');
    assert.equal(app.call('pbSanityOk'), false, 'unos se ne prepoznaje kao nerealan');
    const t = app.evalIn('$("#pbUpozorenjeTxt").textContent') || '';
    assert.ok(t.length > 0, 'dugme je mrtvo, a razlog se nigde ne vidi');
    assert.match(t, /proveri unos/i);
  });

  test('uredan unos ne prikazuje upozorenje', () => {
    const app = loadApp();
    app.call('openWizard');
    app.evalIn(`wiz.pbDist=5000; wiz.pbH=''; wiz.pbMin='20'; wiz.pbSec='37';`);
    app.call('updateVdotPreview');
    assert.equal(app.evalIn('$("#pbUpozorenjeTxt").textContent') || '', '');
    assert.equal(app.evalIn('$("#pbUpozorenje").style.display'), 'none');
  });
});

describe('Kod ostaje očišćen', () => {
  const izvor = readClientSource().replace(/\/\*[\s\S]*?\*\//g, '');

  test('nema CommonJS export-a — u pregledaču su mrtvo slovo', () => {
    assert.ok(!/module\.exports/.test(izvor),
      'vratile su se module.exports linije; testovi učitavaju app.js u vm, export nije potreban');
  });

  /* NEPOVEZANE SPOSOBNOSTI — dovršene, ali ih ništa u aplikaciji ne doseže.
     Nisu greška u kodu nego nedostajuće dugme; zato se NE brišu (ostaju
     vidljive kao gotov posao), ali stoje na imenskom spisku da bi svaka
     NOVA mrtva funkcija odmah pala na testu.

     Spisak sme samo da se SKRAĆUJE — kad se nešto poveže ili obriše. */
  const NEPOVEZANO = {
    applyEdit:        'izmena pojedinačnog polja sesije (tempo/dužina/pauza/broj ponavljanja); ekran „Zameni" menja samo tag/km/opis',
    recalibratedPlan: 'ponovno računanje preostalih nedelja iz trenutne forme',
    reentryPlan:      'povratak u plan posle pauze, od stvarno ostvarenog obima',
    /* predictRange NEĆE se povezivati: donja granica (blockTempo) uračunava i
       oporavke između intervala, pa na sesiji sa 400 m kaskanja daje 4:48/km i
       raspon od pet minuta (19:02–23:44). To nije predikcija trke nego prosek
       celog bloka — raspon te širine ne govori ništa. */
    predictRange:     'predikcija kao raspon (hi/lo) — donja granica uračunava oporavke, pa je raspon prevelik da bi značio išta'
  };

  test('svaka deklarisana funkcija se poziva — ili je na spisku nepovezanih', () => {
    const imena = [...izvor.matchAll(/^(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/gm)].map(m => m[1]);
    const mrtve = imena.filter(n => (izvor.match(new RegExp('\\b' + n.replace(/\$/g, '\\$') + '\\b', 'g')) || []).length <= 1);
    const nove = mrtve.filter(n => !(n in NEPOVEZANO));
    assert.deepEqual(nove, [], `nove funkcije koje se nikad ne pozivaju: ${nove.join(', ')}`);
  });

  test('spisak nepovezanih se ne širi — svaka stavka na njemu je i dalje mrtva', () => {
    /* Kad se nešto poveže, stavka mora da ode sa spiska; inače spisak
       postane groblje u kom se sakrije prava nova mrtva funkcija. */
    const jos = Object.keys(NEPOVEZANO).filter(n =>
      (izvor.match(new RegExp('\\b' + n + '\\b', 'g')) || []).length > 1);
    assert.deepEqual(jos, [], `povezano je, skini sa spiska NEPOVEZANO: ${jos.join(', ')}`);
  });
});

/* NEVAŽEĆI DATUM NE SME DA UGASI EKRAN.

   Nađeno pri pregledu: dodir na tačku grafikona tempa je bacao
   „s.split is not a function" kad `S.log[id].ts` nije string nego broj. Poziv
   je duboko u iscrtavanju, pa se nije video kao poruka o grešci nego kao PRAZAN
   tab Progres — najgori mogući oblik: izgleda kao da podataka nema.

   Aplikacija `ts` uvek upisuje kao string; broj dolazi iz uvezenog ili ručno
   menjanog backupa. Zato `cistVdotLog` već ima istu proveru za svoj `ts` —
   ovo je ista klasa, samo na drugom polju. */
describe('Datumi iz oštećenog zapisa', () => {

  test('s2d ne baca ni na jednom obliku smeća', () => {
    const app = loadApp();
    for (const lose of [null, undefined, 123456789, {}, [], '', 'juče', '2026-13', NaN, true]) {
      assert.doesNotThrow(() => app.call('s2d', lose), `s2d(${JSON.stringify(lose)}) je bacio`);
      const d = app.call('s2d', lose);
      assert.ok(Number.isNaN(d.getTime()), `s2d(${JSON.stringify(lose)}) je vratio važeći datum`);
    }
  });

  test('ispravan datum i dalje radi tačno', () => {
    const app = loadApp();
    assert.equal(app.call('fmtDY', '2026-09-24'), '24.09.2026.');
    assert.equal(app.call('fmtD', '2026-09-24'), '24.09.');
    assert.equal(app.call('dowOf', '2026-09-24'), 'Čet');
  });

  test('nevažeći datum daje „—", ne „NaN.NaN."', () => {
    const app = loadApp();
    for (const f of ['fmtD', 'fmtDY', 'fmtDL', 'dowOf']) {
      const izlaz = String(app.call(f, 1754300000000));
      assert.equal(izlaz, '—', `${f}(broj) je vratio „${izlaz}"`);
      assert.doesNotMatch(izlaz, /NaN/);
    }
  });

  test('grafikon tempa se iscrta i kad je datum trčanja broj', () => {
    /* Prava posledica: pre ovoga je ceo tab Progres ostajao prazan. */
    const app = loadApp({ now: '2026-08-04T09:00:00Z' });
    app.evalIn(`
      const d = DATED.find(x => x.tag === 'tempo');
      S.log[d.id] = { status:'done', km:8, sec:2120, ts: Date.now() };
      CHART_SEL.tempo = 0;
    `);
    let html = null;
    assert.doesNotThrow(() => { html = app.call('chartTempo'); }, 'chartTempo je bacio na numeričkom ts');
    assert.ok(html && html.includes('<svg'), 'grafikon nije iscrtan');
    assert.doesNotMatch(String(html), /NaN/, 'u grafikonu se pojavio NaN');
  });
});

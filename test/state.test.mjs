/* Stanje: migracija šeme, VDOT lanac, backup (izvoz/uvoz).
   Ovo je sloj u kom greška ne pravi pogrešan broj nego GUBI podatke, pa se
   testira i ono što NE sme da se desi. */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { loadApp } from './harness.mjs';

describe('migrate — šema stanja', () => {
  const app = loadApp();
  const migrate = o => app.call('migrate', o);
  const SCHEMA = app.get('SCHEMA');

  test('odbija sve što nije prepoznatljivo stanje', () => {
    assert.equal(migrate(null), null);
    assert.equal(migrate('tekst'), null);
    assert.equal(migrate(42), null);
    assert.equal(migrate({}), null, 'objekat bez log-a nije stanje');
    assert.equal(migrate({ nesto: 1 }), null);
  });

  test('popunjava SVE ključeve koje aplikacija čita, bez obzira na verziju', () => {
    /* Komentar u migrate: „Svi ostali ključevi su ovde bezuslovno" — predLock
       je jednom nedostajao i obarao unos tempa (TypeError). Test je tu da se
       ta klasa greške ne ponovi na sledećem dodatom polju. */
    const OBAVEZNI = ['log', 'knee', 'kg', 'pred', 'predLock', 'vdotLog',
      'moves', 'alts', 'genPlan', 'ui', 'wellness', 'icu'];
    for (const ulaz of [{ log: {} }, { log: {}, v: 1 }, { log: {}, v: 5 }, { log: {}, v: SCHEMA }]) {
      const o = migrate(JSON.parse(JSON.stringify(ulaz)));
      assert.ok(o, 'migrate je odbio validno stanje');
      for (const k of OBAVEZNI) {
        assert.ok(k in o, `nedostaje ključ "${k}" za ulaz v=${ulaz.v}`);
      }
    }
  });

  test('nikad ne briše postojeće unose', () => {
    const ulaz = {
      v: 1,
      log: { n1d1: { status: 'done', km: 7 } },
      knee: [{ id: 'k1', date: '2026-06-22', pain: 3 }],
      kg: [{ date: '2026-06-22', kg: 81 }],
      pred: { p1: 265 }
    };
    const o = migrate(JSON.parse(JSON.stringify(ulaz)));
    assert.deepEqual(Object.keys(o.log), ['n1d1']);
    assert.equal(o.log.n1d1.km, 7);
    assert.equal(o.knee.length, 1);
    assert.equal(o.kg.length, 1);
    assert.equal(o.pred.p1, 265);
  });

  test('odbija stanje iz BUDUĆE šeme umesto da ga tiho spusti', () => {
    /* Bez ovoga bi backup iz novije verzije bio protumačen po starim
       pravilima i tiho pogrešno prikazan. */
    const o = migrate({ log: {}, v: SCHEMA + 1 });
    assert.equal(o, null, 'stanje iz novije šeme mora biti odbijeno');
  });
});

describe('VDOT lanac (preracunajVdotLog)', () => {
  test('idempotentan — ponovni unos istih podataka ne diže VDOT', () => {
    /* Dokumentovan bag: 48.1 -> 50.1 -> 51.3 -> 52.0 na istim podacima. */
    const app = loadApp();
    app.evalIn(`S.vdotLog=[{id:'p1',ts:'2026-07-01',measured:52}]`);
    const prvi = app.evalIn('preracunajVdotLog(), S.vdotLog[0].vdot');
    for (let i = 0; i < 5; i++) app.evalIn('preracunajVdotLog()');
    const posle = app.evalIn('S.vdotLog[0].vdot');
    assert.equal(posle, prvi, `VDOT se pomerio: ${prvi} -> ${posle}`);
  });

  test('sortira po datumu — ispravka starije sesije prepravlja i sve posle nje', () => {
    const app = loadApp();
    app.evalIn(`S.vdotLog=[
      {id:'b',ts:'2026-08-01',measured:52},
      {id:'a',ts:'2026-07-01',measured:50}
    ]`);
    app.evalIn('preracunajVdotLog()');
    const redosled = app.evalIn('S.vdotLog.map(e=>e.id).join(",")');
    assert.equal(redosled, 'a,b', 'lanac nije sortiran po datumu');
    const prevB = app.evalIn('S.vdotLog[1].prev');
    const vdotA = app.evalIn('S.vdotLog[0].vdot');
    assert.equal(prevB, vdotA, 'druga sesija ne kreće od rezultata prve');
  });

  test('prigušenje zavisi od TIPA sesije, ne jedan broj za sve', () => {
    /* Ranije ravnih 40% za sve. Intervalne sesije nose grešku od pauza
       (prepoznavanje radnih deonica ume da uvuče i kaskanje), pa im se veruje
       manje — 12% — dok kontinuiran tempo dobija 28%. */
    const app = loadApp();
    const baseline = app.call('baselineVdot');
    const zaZonu = zona => {
      const id = app.evalIn(`(CUR_PRED.find(r=>zoneForPredRow(r)==='${zona}')||{}).id`);
      assert.ok(id, `nema PRED reda u zoni ${zona}`);
      app.evalIn(`S.vdotLog=[{id:${JSON.stringify(id)},ts:'2026-07-01',measured:${baseline + 10}}]`);
      app.evalIn('preracunajVdotLog()');
      return app.evalIn('S.vdotLog[0]');
    };
    const int = zaZonu('I'), tempo = zaZonu('T');
    assert.equal(int.alpha, 0.12, 'intervali ne koriste svoj koeficijent');
    assert.equal(tempo.alpha, 0.28, 'tempo ne koristi svoj koeficijent');
    assert.ok(Math.abs(int.vdot - (baseline + 1.2)) < 0.11, `intervali: ${int.vdot}`);
    assert.ok(Math.abs(tempo.vdot - (baseline + 2.8)) < 0.11, `tempo: ${tempo.vdot}`);
    assert.ok(int.vdot < tempo.vdot, 'intervalima se veruje isto ili više nego tempu');
  });

  test('zapis bez poznatog PRED reda pada na srednji koeficijent', () => {
    /* Dešava se stvarno: generisan plan zamenjen, pa VDOT zapisi ostanu bez
       svog reda. Ne sme da pukne ni da tiho preskoči merenje. */
    const app = loadApp();
    const baseline = app.call('baselineVdot');
    app.evalIn(`S.vdotLog=[{id:'nepostojeci',ts:'2026-07-01',measured:${baseline + 10}}]`);
    app.evalIn('preracunajVdotLog()');
    assert.equal(app.evalIn('S.vdotLog[0].alpha'), 0.15);
  });

  test('zapis bez `measured` (stari backup) se ne dira', () => {
    const app = loadApp();
    app.evalIn(`S.vdotLog=[{id:'stari',ts:'2026-07-01',vdot:47.7}]`);
    app.evalIn('preracunajVdotLog()');
    assert.equal(app.evalIn('S.vdotLog[0].vdot'), 47.7);
  });
});

describe('Backup — izvoz ne sme da nosi pristupne podatke', () => {
  test('izvezeno stanje nema NIJEDAN token ni ključ', () => {
    /* Politika je već primenjena na serversku sinhronizaciju (sbPayload);
       izvoz u fajl mora da poštuje istu, jer backup završi u mejlu i
       Downloads folderu. intervals.icu token po njihovoj dokumentaciji NE
       ističe — jednom procurio, traje. */
    const app = loadApp();
    app.evalIn(`S.strava={access:'AAA',refresh:'BBB',expiresAt:1,athlete:'Neko',scope:'x',lastSync:1}`);
    app.evalIn(`S.icu={athleteId:'i123',token:'TAJNI_TOKEN',apiKey:'TAJNI_KLJUC',lastSync:1}`);
    const json = app.evalIn('JSON.stringify(backupPayload())');
    assert.ok(!json.includes('AAA'), 'Strava access token je u backupu');
    assert.ok(!json.includes('BBB'), 'Strava refresh token je u backupu');
    assert.ok(!json.includes('TAJNI_TOKEN'), 'intervals.icu token je u backupu');
    assert.ok(!json.includes('TAJNI_KLJUC'), 'intervals.icu API ključ je u backupu');
  });

  test('sbPayload (sinhronizacija) takođe nema tokene — nepromenjeno ponašanje', () => {
    const app = loadApp();
    app.evalIn(`S.strava={access:'AAA',refresh:'BBB',expiresAt:1,athlete:'Neko',scope:'x',lastSync:1}`);
    app.evalIn(`S.icu={athleteId:'i123',token:'TAJNI_TOKEN',lastSync:1}`);
    const json = app.evalIn('JSON.stringify(sbPayload(S))');
    assert.ok(!json.includes('AAA') && !json.includes('BBB'));
    assert.ok(!json.includes('TAJNI_TOKEN'));
    assert.ok(json.includes('Neko'), 'ime sportiste sme da ostane (već je vidljivo u UI)');
  });

  test('izvoz čuva sve stvarne podatke (dnevnik, koleno, težina, VDOT)', () => {
    const app = loadApp();
    app.evalIn(`S.log={n1d1:{status:'done',km:7}}; S.knee=[{id:'k1',date:'2026-06-22',pain:2}];
                S.kg=[{date:'2026-06-22',kg:81}]; S.vdotLog=[{id:'p1',ts:'2026-07-01',measured:50}]`);
    const p = app.evalIn('backupPayload()');
    assert.equal(p.log.n1d1.km, 7);
    assert.equal(p.knee.length, 1);
    assert.equal(p.kg.length, 1);
    assert.equal(p.vdotLog.length, 1);
  });
});

describe('Backup — uvoz odbija pokvaren plan umesto da razbije aplikaciju', () => {
  const app = loadApp();
  const ok = o => app.call('validanGenPlan', o);

  test('prihvata ispravan generisan plan', () => {
    const dobar = {
      weeks: [{ w: 1, start: '2026-06-22', days: [{ dow: 0, tag: 'lako', km: 5 }] }],
      pred: [], qs: {}, meta: {}
    };
    assert.equal(ok(dobar), true);
  });

  test('prihvata null (nema generisanog plana — lični plan je aktivan)', () => {
    assert.equal(ok(null), true);
    assert.equal(ok(undefined), true);
  });

  test('odbija sve oblike koji bi oborili setActivePlan/rebuildDateIndex', () => {
    assert.equal(ok({}), false, 'bez weeks');
    assert.equal(ok({ weeks: 'ne-niz' }), false);
    assert.equal(ok({ weeks: [] }), false, 'prazan plan');
    assert.equal(ok({ weeks: [{ w: 1 }] }), false, 'nedelja bez days');
    assert.equal(ok({ weeks: [{ w: 1, days: 'x' }] }), false);
    assert.equal(ok({ weeks: [{ w: 1, start: '2026-06-22', days: [{ dow: 99 }] }] }), false, 'dow van opsega');
    assert.equal(ok({ weeks: [{ w: 1, start: 'nije-datum', days: [{ dow: 0 }] }] }), false);
    assert.equal(ok({ weeks: [{ w: 1, start: '2026-06-22', days: [{ dow: 0, km: 'x' }] }] }), false, 'km nije broj');
  });
});

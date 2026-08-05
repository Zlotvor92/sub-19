/* Stanje: migracija šeme, VDOT lanac, backup (izvoz/uvoz).
   Ovo je sloj u kom greška ne pravi pogrešan broj nego GUBI podatke, pa se
   testira i ono što NE sme da se desi. */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { loadApp, readRepoFile } from './harness.mjs';

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

describe('Ucitavanje POPUNJENOG stanja — mrtva zona `const`-a', () => {
  /* PRAVI KVAR, ne hipoteza: `validanId` je zivelo uz provere uvoza, na dnu
     fajla, a `migrate()` ga zove sa prvog reda izvrsavanja (loadState()). Sve
     dok nijedan seed nije imao t3k zapis, `.filter` nikad ne pozove validanId
     i greska ne nastane. Ko je imao zapisan test na 3 km, dobio bi
     „Cannot access 'ID_OBLIK' before initialization", loadState() bi pao u
     catch i aplikacija bi se otvorila PRAZNA.

     Zato se ovde ne testira validanId nego UCITAVANJE stanja u kom je svako
     polje popunjeno — jedini oblik koji bi tu klasu greske uhvatio. */
  const PUNO = {
    v: 9,
    log: { n1d1: { status: 'done', km: 8, sec: 2400, hr: 150, ts: '2026-06-22', decoupling: { n: 4.2 } } },
    pred: { 'n1-t': 240 }, predLock: {},
    vdotLog: [{ id: 't3k-2026-07-01-ab12x', ts: '2026-07-01', measured: 48.1, vdotMigrated: true }],
    t3k: [{ id: 't3k-2026-07-01-ab12x', date: '2026-07-01', sec: 718 }],
    knee: [{ id: 'k1', src: 'n1d1', date: '2026-06-22', act: 'Trčanje', pain: 3, note: '', part: 'koleno-D' }],
    kg: [{ date: '2026-06-22', kg: 80.4, src: 'n1d1' }],
    wellness: { '2026-06-22': { datum: '2026-06-22', hrv: 62, pulsUMiru: 47, sanH: 7.1 } },
    moves: {}, alts: {}, genPlan: null,
    icu: { athleteId: 'i1', token: 't', scope: 'ACTIVITY:READ' },
    vreme: { at: 1, lat: 44.81, lon: 20.46, sati: { '2026-08-05T18': { temp: 30 } } },
    ui: { firstRun: '2026-06-22', geo: { lat: 44.81, lon: 20.46 }, satTreninga: 18 }
  };

  /* Vlasnicka sesija: bez nje `uskladiVlasnickePodatke()` skine seed sa licnog
     plana i `S.log` ostane prazan iz sasvim drugog, ispravnog razloga. */
  const vlasnik = {
    'sub19-v1': JSON.stringify(PUNO),
    sub19_sb: JSON.stringify({ access: 't', refresh: 'r', expiresAt: Date.now() + 3600e3,
      email: 'x@t.rs', userId: '0403f8fb-a643-4d4e-843d-f71199a0d6f9', seenAt: null, deviceId: 'd1' })
  };

  test('stanje sa zapisanim testom na 3 km se ucitava, ne resetuje', () => {
    const app = loadApp({ seedLocalStorage: vlasnik });
    assert.equal(app.get('UCITAVANJE_PALO'), null,
      `loadState je pao: ${JSON.stringify(app.get('UCITAVANJE_PALO'))}`);
    assert.equal(app.evalIn('Object.keys(S.log).length'), 1, 'unosi su nestali');
    assert.equal(app.evalIn('S.t3k.length'), 1, 'test na 3 km je odbacen');
    assert.equal(app.evalIn('S.t3k[0].sec'), 718);
  });

  test('svako popunjeno polje prezivi migrate', () => {
    const app = loadApp({ seedLocalStorage: vlasnik });
    const st = JSON.parse(app.evalIn('JSON.stringify({knee:S.knee.length, kg:S.kg.length,'
      + ' wellness:Object.keys(S.wellness).length, vdotLog:S.vdotLog.length,'
      + ' geo:!!(S.ui&&S.ui.geo), icu:!!S.icu, vreme:!!S.vreme})'));
    assert.deepEqual(st, { knee: 1, kg: 1, wellness: 1, vdotLog: 1, geo: true, icu: true, vreme: true });
  });

  test('nijedna provera koju migrate zove ne sme da bude ispod njega u fajlu', () => {
    /* Opsti oblik greske, ne samo ovaj jedan simbol. */
    const src = readRepoFile('app.js');
    const telo = /function migrate\(o\)\{([\s\S]*?)\n\}/.exec(src);
    assert.ok(telo, 'migrate() nije nadjen');
    const migratePoz = src.indexOf('function migrate(o){');
    const pozvane = [...telo[1].matchAll(/\b(validan[A-Za-z]*|cist[A-Za-z]*|je[A-Z][A-Za-z]*)\(/g)]
      .map(m => m[1]);
    for (const ime of new Set(pozvane)) {
      /* `const X = ...` je u mrtvoj zoni do svoje linije; `function X(){}` nije. */
      const konst = new RegExp(`^const ${ime}\\b`, 'm').exec(src);
      if (konst && src.indexOf(konst[0]) > migratePoz)
        assert.fail(`${ime} je const ISPOD migrate() — pucace pri ucitavanju`);
      /* i konstante koje ta funkcija cita */
      const def = new RegExp(`function ${ime}\\(([^)]*)\\)\\{([^}]*)\\}`).exec(src);
      if (!def) continue;
      for (const konstIme of new Set([...def[2].matchAll(/\b([A-Z][A-Z0-9_]{2,})\b/g)].map(m => m[1]))) {
        const dekl = new RegExp(`^const ${konstIme}\\s*=`, 'm').exec(src);
        if (dekl && src.indexOf(dekl[0]) > migratePoz)
          assert.fail(`${ime}() cita ${konstIme}, a ${konstIme} je const ISPOD migrate() — mrtva zona`);
      }
    }
  });
});

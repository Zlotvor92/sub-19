/* TRENINZI SA intervals.icu — PRIMARAN IZVOR, STRAVA REZERVA

   Tri stvari se ovde lako pokvare tiho:

   1. REDOSLED. „icu ako je povezan, inače Strava" je odluka koju ništa u
      izlazu ne pokazuje — ako se izvor zameni, sve i dalje radi, samo lošije.

   2. OBLIK KRUGOVA. `l.laps` čitaju `aiIzvor`, `trendSummary` i AI payload.
      Ako icu krugovi ne legnu u isti oblik, kartica i trend tiho počnu da
      pokazuju drugo — ili ništa.

   3. OPORAVCI KAO KRUGOVI. Ako pauze uđu u `laps`, „6×800" postane 11 krugova
      i prosečan tempo radnog dela postane besmislen. */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { loadApp, readRepoFile } from './harness.mjs';

const app = (o = {}) => loadApp({ now: '2026-08-05T09:00:00Z', ...o });

/* Odgovor kakav vraća /api/activities za jednu 6×800 sesiju. */
const KRUGOVI = [
  { red: 0, tip: 'rad',      distM: 800, sec: 186, paceSec: 233, gapSec: 231, hr: 168, maxHr: 176, kadenca: 88, razdvajanje: 1.2 },
  { red: 1, tip: 'oporavak', distM: 200, sec: 120, paceSec: 600, hr: 140 },
  { red: 2, tip: 'rad',      distM: 800, sec: 188, paceSec: 235, gapSec: 234, hr: 172, maxHr: 179, kadenca: 88 },
  { red: 3, tip: 'oporavak', distM: 205, sec: 124, paceSec: 605, hr: 143 },
  { red: 4, tip: 'rad',      distM: 800, sec: 191, paceSec: 239, gapSec: 238, hr: 176, maxHr: 183, kadenca: 87 },
  { red: 5, tip: 'oporavak', distM: 210, sec: 131, paceSec: 624, hr: 146 }
];

describe('Krugovi sa icu-a u oblik koji aplikacija već koristi', () => {

  test('oporavci NISU krugovi — lepe se na rep ispred sebe', () => {
    const a = app();
    const laps = a.call('icuKrugoviULaps', KRUGOVI);
    assert.equal(laps.length, 3, `oporavci su ušli u krugove: ${laps.length}`);
    assert.equal(laps[0].restSec, 120);
    assert.equal(laps[1].restSec, 124);
    assert.equal(laps[2].restSec, 131);
  });

  test('oblik je isti kao iz Strave — inače kartica i trend prestanu da čitaju', () => {
    const a = app();
    const l = a.call('icuKrugoviULaps', KRUGOVI)[0];
    for (const k of ['distM', 'paceSec', 'avgHr', 'cadence', 'watts'])
      assert.ok(k in l, `nedostaje polje ${k} koje Strava putanja ima`);
    assert.equal(l.distM, 800);
    assert.equal(l.paceSec, 233);
    assert.equal(l.avgHr, 168);
    assert.equal(l.cadence, 88);
  });

  test('nosi i ono što Strava putanja NEMA', () => {
    const a = app();
    const l = a.call('icuKrugoviULaps', KRUGOVI)[0];
    assert.equal(l.gapSec, 231);
    assert.equal(l.maxHr, 176);
    assert.equal(l.razdvajanje, 1.2);
  });

  test('krug bez distance ili tempa se preskače, ne pravi NaN', () => {
    const a = app();
    const laps = a.call('icuKrugoviULaps', [
      { tip: 'rad', distM: 0, sec: 0, paceSec: null },
      { tip: 'rad', distM: 800, sec: 186, paceSec: 233 },
      null
    ]);
    assert.equal(laps.length, 1);
    assert.doesNotMatch(JSON.stringify(laps), /NaN/);
    assert.ok(laps[0].distM > 0 && laps[0].paceSec > 0);
  });

  test('radni tempo je ukupno vreme / ukupna distanca, ne prosek prosekâ', () => {
    /* Namerno NEJEDNAKI repovi: 1600 m na 4:00/km (384 s) i 400 m na 3:00/km
       (72 s). Ispravno je 2000 m za 456 s = 228 s/km (3:48). Prosek prosekâ bi
       dao (240+180)/2 = 210 s/km (3:30) — 18 s/km brže nego što je istrčano. */
    const a = app();
    const laps = a.call('icuKrugoviULaps', [
      { tip: 'rad', distM: 1600, sec: 384, paceSec: 240 },
      { tip: 'rad', distM: 400,  sec: 72,  paceSec: 180 }
    ]);
    assert.equal(a.call('icuRadniTempo', laps), 228);
    const naivno = Math.round((240 + 180) / 2);
    assert.notEqual(a.call('icuRadniTempo', laps), naivno);
  });

  test('prazan ulaz ne pravi ni krugove ni tempo', () => {
    const a = app();
    assert.equal(a.call('icuKrugoviULaps', null).length, 0);
    assert.equal(a.call('icuRadniTempo', []), null);
    assert.equal(a.call('icuRadniTempo', null), null);
  });
});

describe('Ko sme da čita treninge', () => {

  const sa = (icu) => { const a = app(); a.ctx.__i = icu; a.evalIn('S.icu=__i; save();'); return a; };

  test('nova OAuth veza sme', () => {
    assert.equal(sa({ athleteId: 'i1', token: 't', scope: 'ACTIVITY:READ,WELLNESS:READ' }).call('icuImaTreninge'), true);
  });

  test('stara OAuth veza bez opsega NE sme — i to se zna unapred', () => {
    /* Bez ove provere bi svaka sinhronizacija išla do servera pa se vraćala sa
       403; ovako se čoveku odmah kaže da ponovo poveže. */
    assert.equal(sa({ athleteId: 'i1', token: 't', scope: 'WELLNESS:READ,CALENDAR:WRITE' }).call('icuImaTreninge'), false);
  });

  test('stari API ključ sme — on nema opsege', () => {
    assert.equal(sa({ athleteId: 'i1', apiKey: 'k12345678' }).call('icuImaTreninge'), true);
  });

  test('nepovezan ne sme', () => {
    assert.equal(sa(null).call('icuImaTreninge'), false);
    assert.equal(sa({ athleteId: 'i1' }).call('icuImaTreninge'), false);
  });

  test('OAuth opseg u kodu servera traži i treninge', () => {
    const izvor = readRepoFile('api/icu-oauth.js');
    const m = /const SCOPE = '([^']+)'/.exec(izvor);
    assert.ok(m, 'nema SCOPE konstante');
    assert.match(m[1], /ACTIVITY:READ/, 'opseg ne traži treninge — icu će vraćati 403');
    assert.match(m[1], /WELLNESS:READ/, 'izgubljen opseg za jutarnja merenja');
  });
});

describe('Kartica i analiza vide odakle su krugovi', () => {

  test('kartica imenuje intervals.icu kad su krugovi odatle', () => {
    const a = app();
    const laps = a.call('icuKrugoviULaps', KRUGOVI);
    a.ctx.__l = { laps, lapsIzvor: 'icu' };
    assert.match(a.evalIn('aiIzvor(__l)'), /po krugu · 3 kruga · intervals\.icu/);
  });

  test('Strava krugovi se ne predstavljaju kao icu', () => {
    const a = app();
    a.ctx.__l = { laps: [{ distM: 800, paceSec: 233 }], lapsIzvor: 'strava' };
    const t = a.evalIn('aiIzvor(__l)');
    assert.match(t, /po krugu/);
    assert.doesNotMatch(t, /intervals\.icu/);
  });

  test('bez ijednog izvora i dalje pošteno piše da je samo prosek', () => {
    const a = app();
    a.ctx.__l = {};
    assert.equal(a.evalIn('aiIzvor(__l)'), 'samo prosek cele sesije');
  });
});

describe('Redosled izvora i čuvari sinhronizacije', () => {

  test('icu je primaran kad je povezan, Strava kad nije', () => {
    const izvor = readRepoFile('app.js');
    const m = /async function sinhronizujTreninge\(manual\)\{([\s\S]*?)\n\}/.exec(izvor);
    assert.ok(m, 'nema jedinstvene ulazne tačke za sinhronizaciju');
    const telo = m[1];
    assert.ok(telo.indexOf('icuImaTreninge') < telo.indexOf('stravaSync'),
      'Strava se poziva pre nego što se icu uopšte proba');
    assert.match(telo, /return stravaSync\(manual\)/, 'nema pada na Stravu');
  });

  test('prikupljanje detalja NIJE vezano za to da li tempo već postoji', () => {
    /* Ovo je bio bug sa prijave: čovek unese tempo ručno, Strava sync preskoči
       celu granu, i analiza mu zauvek piše „samo prosek cele sesije". */
    const izvor = readRepoFile('app.js');
    assert.match(izvor, /const imaDetalje = !!\(S\.log\[d\.id\]/,
      'čuvar detalja se ne računa iz postojanja detalja');
    assert.match(izvor, /if\(rowId && !imaDetalje\)\{/,
      'grana za detalje i dalje zavisi od S.pred[rowId]');
    assert.match(izvor, /const smeTempo = rowId && !S\.predLock\[rowId\] && S\.pred\[rowId\]==null/,
      'upis tempa više nema svoj uslov — sad bi pregazio ručni unos');
  });

  /* Povlacenje treninga: ko sme, kada, i odakle se uopste poziva.
     `preMs` se racuna UNUTAR peskovnika: Date.now() u testu je pravi sat, a u
     aplikaciji lazni — mesanje ta dva daje besmislenu razliku. */
  const spreman = (stanje, preMs) => {
    const a = app();
    a.ctx.__s = stanje; a.ctx.__pre = preMs;
    a.evalIn(`Object.assign(S, __s);
      if(__pre!=null && S.icu) S.icu.trSync = Date.now() - __pre;
      if(__pre!=null && S.strava) S.strava.lastSync = Date.now() - __pre;
      save(); navigator.onLine=true;`);
    return a;
  };

  test('automatsko povlačenje ne zavisi od toga da li Strava postoji', () => {
    /* Ko ima samo intervals.icu ranije ne bi dobio nijednu automatsku
       sinhronizaciju — uslov je gledao isključivo `S.strava`. */
    const a = spreman({ icu: { athleteId: 'i1', token: 't', scope: 'ACTIVITY:READ' }, strava: null }, 4 * 3600000);
    assert.equal(a.call('trPovuciAko', 3600000), true, 'samo icu ne dobija povlačenje');
  });

  test('bez ijednog izvora se ne poziva ništa', () => {
    const a = spreman({ icu: null, strava: null });
    assert.equal(a.call('trPovuciAko', 3600000), false);
  });

  test('sveža sinhronizacija se ne ponavlja', () => {
    const a = spreman({ icu: { athleteId: 'i1', token: 't', scope: 'ACTIVITY:READ' }, strava: null }, 60000);
    assert.equal(a.call('trPovuciAko', 15 * 60000), false, 'povlači ponovo minut posle prethodnog');
    assert.equal(a.call('trPovuciAko', 30000), true, 'ne povlači ni kad je prag prošao');
  });

  test('offline se ne pokušava', () => {
    const a = spreman({ icu: { athleteId: 'i1', token: 't', scope: 'ACTIVITY:READ' }, strava: null }, 4 * 3600000);
    a.evalIn('navigator.onLine=false');
    assert.equal(a.call('trPovuciAko', 3600000), false);
  });

  test('POVRATAK U APLIKACIJU povlači treninge, ne samo jutarnja merenja', () => {
    /* PRIJAVA: „završio trčanje, nije uradio automatski update".
       `sinhronizujTreninge` se zvalo samo iz dugmeta i JEDNOM pri učitavanju
       stranice — a instalirana PWA se ne učitava iznova, budi se iz pozadine.
       Na povratku je radio samo `icuAutoSync`, koji povlači isključivo
       jutarnja merenja i to jednom dnevno. */
    const izvor = readRepoFile('app.js');
    const rukovalac = /visibilitychange',\(\)=>\{([\s\S]*?)\n\}\);/.exec(izvor);
    assert.ok(rukovalac, 'nema visibilitychange rukovaoca');
    assert.match(rukovalac[1], /trPovuciAko\(/, 'povratak u aplikaciju ne povlači treninge');
    assert.match(rukovalac[1], /icuAutoSync\(\)/, 'izgubljeno povlačenje jutarnjih merenja');
  });
});

describe('Lagana trčanja dobijaju presek po kilometru i sa icu-a', () => {

  /* REGRESIJA SA PRIJAVE: „AI analiza opet brljavi, nije dobio po km-u trčanje".
     `icu_intervals` je za kontinuirano trčanje prazan — to je tačan odgovor, jer
     strukture nema. Ali dok je Strava bila primarni izvor, po-km presek se
     računao iz njenih streamova; kad je icu postao primaran, lagana trčanja su
     tiho ostala samo na proseku cele sesije, pa je i AI to pisao. */

  test('sinhronizacija traži tokove i za lako i za dugo trčanje', () => {
    const izvor = readRepoFile('app.js');
    const m = /async function icuSyncTreninzi\(danaUnazad, manual\)\{([\s\S]*?)\n\}/.exec(izvor);
    assert.ok(m, 'nema icuSyncTreninzi');
    assert.match(m[1], /d\.tag==='lako'\|\|d\.tag==='lr'/, 'kontinuirana trčanja se ne skupljaju');
    assert.match(m[1], /icuApi\(\{tokovi:/, 'tokovi se ne traže');
    assert.match(m[1], /perKmDetail\(t\)/, 'presek se ne računa istom funkcijom kao za Stravu');
  });

  test('presek se NE traži ponovo kad već postoji u tekućoj verziji', () => {
    /* Tokovi su veliki; bez ovog čuvara bi svaka sinhronizacija povlačila
       nekoliko stotina kilobajta za trening koji je već obrađen. */
    const izvor = readRepoFile('app.js');
    assert.match(izvor, /\(l\.perKm\[0\]\|\|\{\}\)\.v===PERKM_VER\)\)\n?\s*tokovi\.push/,
      'nema čuvara protiv ponovnog povlačenja tokova');
  });

  test('icu-ovo razdvajanje ima prednost nad našim računom', () => {
    /* Njihovo je merenje nad celim fajlom; naše je procena iz po-km preseka.
       Kad postoji njihovo, naše se ne sme upisati preko. */
    const izvor = readRepoFile('app.js');
    assert.match(izvor, /if\(!\(l\.icu&&l\.icu\.razdvajanje!=null\)\)\{\s*\n\s*const dek=decouplingPerKm\(perKm\);/,
      'naš drift gazi icu-ov');
  });

  test('po-km presek oslobađa brojač AI analiza', () => {
    /* Limit postoji zato što „ista analiza za iste podatke ne donosi ništa
       novo". Kad podaci prestanu da budu isti, taj razlog otpada. */
    const izvor = readRepoFile('app.js');
    const m = /const perKm=perKmDetail\(t\);([\s\S]*?)\n\s*\}\);/.exec(izvor);
    assert.ok(m, 'grana za tokove nije nađena');
    assert.match(m[1], /delete l\.aiCount/, 'analiza ostaje zaključana na starim podacima');
  });

  test('perKmDetail čita icu tokove isto kao Stravine', () => {
    /* Server normalizuje icu oblik ({type,data}[]) na Stravin ({type:{data}}),
       pa ista funkcija radi za oba izvora. Ovde se to i proverava nad
       realističnim tokom od 3 km. */
    const a = app();
    const N = 1800;                                   /* 3 km po 600 s/km */
    const t = { time: { data: [] }, distance: { data: [] }, heartrate: { data: [] }, cadence: { data: [] } };
    for (let i = 0; i < N; i++) {
      t.time.data.push(i);
      t.distance.data.push((i + 1) * (3000 / N));   /* poslednji uzorak mora DA STIGNE na 3000 */
      t.heartrate.data.push(140 + Math.floor(i / 600) * 5);   /* puls raste po km */
      t.cadence.data.push(86);
    }
    a.ctx.__t = t;
    const perKm = JSON.parse(a.evalIn('JSON.stringify(perKmDetail(__t))'));
    assert.equal(perKm.length, 3, `dobijeno ${perKm.length} kilometara`);
    assert.ok(perKm[0].paceSec > 0 && perKm[0].hr > 0, 'nema ni tempa ni pulsa po kilometru');
    assert.ok(perKm[2].hr > perKm[0].hr, 'porast pulsa kroz trčanje se izgubio');
  });
});

describe('Server: /api/activities', () => {

  const src = readRepoFile('api/activities.js');

  test('režim tokova postoji, ograničen je i vraća Stravin oblik', () => {
    assert.match(src, /Array\.isArray\(body\.tokovi\)/, 'nema režima za sirove tokove');
    assert.match(src, /\.slice\(0, 3\)/, 'broj treninga po pozivu nije ograničen');
    assert.match(src, /'\/streams\?types='/, 'ne poziva se streams endpoint');
    assert.match(src, /tok\[s\.type\] = \{ data:/, 'odgovor nije sveden na Stravin oblik {type:{data}}');
    /* Bez ovog filtera bi se povlacili i tokovi koje perKmDetail ni ne cita. */
    assert.match(src, /if \(!ZELJENI\.includes\(s\.type\)\) continue;/, 'povlače se i tokovi koji se ne koriste');
  });

  test('traži prijavu i broji dnevni limit, kao i wellness', () => {
    assert.match(src, /requireUser\(req\)/);
    assert.match(src, /limitPrekoracen\(auth\.token, 'activities'/);
  });

  test('ključ ne izlazi iz servera ni u grešci', () => {
    assert.doesNotMatch(src, /error:.*apiKey/);
    assert.doesNotMatch(src, /console\.(log|warn|error)\([^)]*apiKey/);
    assert.match(src, /Nema veze sa intervals\.icu/);
  });

  test('403 se prevodi u uputstvo, ne u golu grešku', () => {
    assert.match(src, /starija veza nema dozvolu za treninge/);
  });

  test('odgovor je ograničen — ni spisak ni detalji ne mogu da narastu', () => {
    assert.match(src, /\.slice\(0, 12\)/, 'nema plafona na broj traženih detalja');
    assert.match(src, /\.slice\(0, 200\)/, 'nema plafona na dužinu spiska');
  });

  test('brzina i tempo se ne mešaju', () => {
    /* icu čuva `pace`/`gap` kao brzinu u m/s; ako se to protumači kao s/km,
       tempo ispadne 3 s/km i cela analiza je smeće. */
    assert.match(src, /function tempoIz/);
    assert.match(src, /x >= 1 && x <= 8/);
    assert.match(src, /x >= 100 && x <= 900/);
  });

  test('vraćaju se samo trčanja', () => {
    assert.match(src, /run\|trčanje\|trcanje/i);
  });
});

describe('Trend analiza koristi ono što icu daje', () => {

  /* Dan iz plana sa krugovima kakve vraća intervals.icu. */
  function saKrugovima(a, dan) {
    a.ctx.__d = dan;
    return a.evalIn(`
      const d = BY_DATE[__d];
      S.log[d.id] = { status:'done', km:8.3, sec:2800, ts:__d, runDate:__d, src:'icu',
        lapsIzvor:'icu',
        laps:[{distM:1600,paceSec:240,avgHr:168,cadence:88,gapSec:238,restSec:120},
              {distM:400, paceSec:180,avgHr:178,cadence:90,gapSec:179,restSec:150}],
        icu:{ efikasnost:1.82, opterecenje:68, osecaSe:36 } };
      rebuildDateIndex();
      JSON.stringify(trendSummary().treninzi.find(x=>x.date===__d));`);
  }

  test('tempo je ponderisan distancom, ne prosek prosekâ', () => {
    /* 1600 m @4:00 + 400 m @3:00 = 2000 m za 456 s = 228 s/km. Prosek prosekâ
       bi dao 210 — 18 s/km brže nego što je istrčano, i to bi u trendu
       izgledalo kao napredak koga nema. */
    const a = loadApp({ now: '2026-08-05T09:00:00Z' });
    const r = JSON.parse(saKrugovima(a, '2026-07-01'));
    assert.equal(r.tempo, 228);
    assert.notEqual(r.tempo, 210);
  });

  test('GAP, broj repova i oporavci ulaze u trend', () => {
    const a = loadApp({ now: '2026-08-05T09:00:00Z' });
    const r = JSON.parse(saKrugovima(a, '2026-07-01'));
    assert.equal(r.repova, 2);
    assert.equal(r.pauzaPrva, 120);
    assert.equal(r.pauzaZadnja, 150, 'produžavanje oporavka je najraniji znak da serija puca');
    assert.ok(r.gap > 0 && Math.abs(r.gap - 226) <= 2, `GAP ${r.gap}`);
  });

  test('mere koje icu sam izračuna stižu do trenda', () => {
    const a = loadApp({ now: '2026-08-05T09:00:00Z' });
    const r = JSON.parse(saKrugovima(a, '2026-07-01'));
    assert.equal(r.efikasnost, 1.82);
    assert.equal(r.opterecenje, 68);
    assert.equal(r.osecaSe, 36);
  });

  test('bez icu-a trend radi kao i pre — nema izmišljenih polja', () => {
    const a = loadApp({ now: '2026-08-05T09:00:00Z' });
    a.evalIn(`
      const d = BY_DATE['2026-07-01'];
      S.log[d.id] = { status:'done', km:8.3, sec:2800, ts:'2026-07-01', lapsIzvor:'strava',
        laps:[{distM:800,paceSec:233,avgHr:168,cadence:88},{distM:800,paceSec:239,avgHr:175,cadence:88}] };
      rebuildDateIndex();`);
    const r = JSON.parse(a.evalIn(`JSON.stringify(trendSummary().treninzi.find(x=>x.date==='2026-07-01'))`));
    assert.equal(r.tempo, 236, 'tempo se i dalje računa iz Stravinih krugova');
    for (const k of ['gap', 'pauzaPrva', 'efikasnost', 'opterecenje'])
      assert.equal(r[k], undefined, `polje ${k} je izmišljeno bez icu podataka`);
  });
});

describe('Pokupljanje završenih analiza se ne sme zaglaviti', () => {
  /* `AI_KUPIM` sprečava dva pokupljanja u isto vreme. Dok se skidao golom
     dodelom na kraju funkcije, jedan izuzetak usred petlje (npr. `save()` na
     punoj kvoti) ostavljao bi zastavicu podignutu — i pokupljanje bi TIHO
     prestalo do sledećeg učitavanja stranice, dok bi analiza zauvek stajala
     na „u toku". Tačno ono stanje koje je cela ova funkcija i uvedena da
     spreči. */
  const saPoslom = () => {
    const a = app();
    /* Harness podrazumeva `onLine:false`, a aiPokupiSve tada odmah izlazi — bez
       ovoga bi testovi prolazili ne ušavši u funkciju uopšte. */
    a.evalIn(`navigator.onLine = true;
              S.log={n1d1:{status:'done', aiPosao:{id:'11111111-1111-4111-8111-111111111111', at:Date.now()}}};
              SB.userId='u1'; SB.access='t'; SB.refresh='r'; SB.expiresAt=Date.now()+9e6;`);
    return a;
  };

  test('izuzetak usred pokupljanja spušta zastavicu', async () => {
    const a = saPoslom();
    let zvano = 0;
    a.setFetch(async () => {
      zvano++;
      return { ok: true, status: 200, json: async () => ({ stanje: 'gotovo', tekst: 'x' }) };
    });
    /* aiPozovi hvata mrežnu grešku, pa se puca namerno dublje — na save(),
       tačno kao kad je localStorage pun. */
    a.evalIn('save = () => { throw new Error("kvota"); }');
    await a.evalIn('aiPokupiSve().catch(()=>{})');
    assert.ok(zvano > 0, 'funkcija nije ni ušla u petlju — test ne meri ništa');
    assert.equal(a.evalIn('AI_KUPIM'), false,
      'zastavica je ostala podignuta — pokupljanje je TIHO prestalo do restarta');
  });

  test('uredno pokupljanje takođe spušta zastavicu', async () => {
    const a = saPoslom();
    a.setFetch(async () => ({
      ok: true, status: 200,
      json: async () => ({ stanje: 'gotovo', tekst: 'Analiza.' })
    }));
    await a.evalIn('aiPokupiSve()');
    await new Promise(r => setTimeout(r, 10));
    assert.equal(a.evalIn('AI_KUPIM'), false);
    assert.equal(a.evalIn('S.log.n1d1.aiText'), 'Analiza.', 'rezultat nije pokupljen');
    assert.equal(a.evalIn('S.log.n1d1.aiPosao'), undefined, 'posao je ostao u redu');
  });
});

describe('Vlasnik nema limit AI analiza', () => {

  test('drugima ostaju dve po treningu', () => {
    const a = loadApp();
    assert.equal(a.call('aiPreostalo', {}), 2);
    assert.equal(a.call('aiPreostalo', { aiCount: 1 }), 1);
    assert.equal(a.call('aiPreostalo', { aiCount: 2 }), 0);
    assert.equal(a.call('aiPreostalo', { aiCount: 9 }), 0);
  });

  test('vlasniku limit ne važi ni posle deset analiza', () => {
    const a = loadApp();
    a.evalIn(`SB.userId=ADMIN_UID; SB.access='t'; SB.expiresAt=Date.now()+9e6;`);
    assert.equal(a.call('jeVlasnik'), true);
    assert.equal(a.call('aiPreostalo', { aiCount: 10 }), Infinity);
  });

  /* Ovde je do sada stajala provera regularnim izrazom nad izvornim kodom
     (`assert.match(src, /if \(!vlasnik && posao !== 'radi'\)/)`). Takav test
     kaže samo da kod IZGLEDA očekivano — a baš ta klasa je propustila potpun
     obilazak dnevnog limita (v. „Analiza odvojena od cekanja" u api.test.mjs).
     Zato se sada vozi pravi poziv i broji ono što jedino znači nešto: da li je
     brojač pomeren. */
  async function pozoviAnalizu(korisnik) {
    const stariFetch = globalThis.fetch;
    const env = {
      SUPABASE_URL: 'https://x.supabase.co', SUPABASE_ANON_KEY: 'anon',
      GEMINI_API_KEY: 'k', ADMIN_EMAIL: 'vlasnik@t.rs', VERCEL_URL: 'x.vercel.app'
    };
    const staro = {};
    for (const k of Object.keys(env)) { staro[k] = process.env[k]; process.env[k] = env[k]; }
    let brojano = 0;
    globalThis.fetch = async (u, o) => {
      const s = String(u);
      const J = (b) => ({ ok: true, status: 200, json: async () => b, text: async () => JSON.stringify(b) });
      if (s.includes('/auth/v1/user')) return J(korisnik);
      if (s.includes('check_and_bump_api_usage')) { brojano++; return J({}); }
      if (s.includes('ai_posao') && o && o.method === 'POST') return J([{ id: 'p1' }]);
      return J({});
    };
    try {
      const { default: h } = await import('../api/analyze.js?t=' + Math.random());
      const r = { code: null, body: null, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; }, setHeader() {} };
      await h({ method: 'POST', headers: { authorization: 'Bearer jwt' }, body: { posao: 'start' } }, r);
      return { brojano, code: r.code };
    } finally {
      globalThis.fetch = stariFetch;
      for (const k of Object.keys(env)) { if (staro[k] === undefined) delete process.env[k]; else process.env[k] = staro[k]; }
    }
  }

  test('vlasniku se dnevni limit ne broji', async () => {
    const o = await pozoviAnalizu({ id: 'v', email: 'vlasnik@t.rs', email_confirmed_at: '2026-01-01' });
    assert.equal(o.code, 200);
    assert.equal(o.brojano, 0, 'vlasniku se troši sopstvena kvota');
  });

  test('drugom korisniku se broji', async () => {
    const o = await pozoviAnalizu({ id: 'k', email: 'neko@t.rs', email_confirmed_at: '2026-01-01' });
    assert.equal(o.brojano, 1, 'običan korisnik je preskočio brojač');
  });

  test('NEPOTVRĐENA vlasnikova adresa ne skida limit', async () => {
    /* NAPAD: na Supabase podešavanju bez obavezne potvrde mejla svako se može
       registrovati vlasnikovom adresom i dobiti token sa `email: vlasnik,
       email_confirmed_at: null`. Bez provere potvrde time skida limit sebi. */
    const o = await pozoviAnalizu({ id: 'a', email: 'vlasnik@t.rs', email_confirmed_at: null });
    assert.equal(o.brojano, 1, 'nepotvrđena vlasnikova adresa je skinula limit');
  });
});

describe('Vreme na dan treninga', () => {

  /* Prognoza se seje za DANAS i za prvi predstojeći kvalitetan dan — stvarna
     prognoza pokriva tri dana, pa fiksni datumi ne bi uvek pogodili sesiju. */
  const sa = () => {
    const a = loadApp({ now: '2026-08-05T09:00:00Z' });
    a.evalIn(`
      S.ui.geo={lat:44.81,lon:20.46}; S.ui.satTreninga=17;
      const kv=DATED.find(x=>x.date>=TODAY&&(x.tag==='int'||x.tag==='tempo'));
      const lk=DATED.find(x=>x.date>=TODAY&&x.tag==='lako');
      const sati={};
      [TODAY, kv&&kv.date, lk&&lk.date].filter(Boolean).forEach(d=>{ for(let h=0;h<24;h++){
        const vru = h>=13&&h<=19;
        sati[d+'T'+String(h).padStart(2,'0')]={temp:vru?33:19, osecaj:vru?37:18,
          vlaga:vru?38:70, vetar:9, kisa:vru?5:20};
      }});
      S.vreme={at:Date.now(), lat:44.81, lon:20.46, sati}; save();`);
    return a;
  };

  test('usporavanje se meri OSEĆAJEM, ne temperaturom vazduha', () => {
    /* Vlažnost ubija hlađenje znojenjem — 30 °C na 80% vlage nije isto što i
       30 °C na 25%. Zato ulaz mora biti apparent temperature. */
    const a = sa();
    assert.equal(a.call('vrucinaZa', 10).pct, 0);
    assert.equal(a.call('vrucinaZa', 18).pct, 1);
    assert.equal(a.call('vrucinaZa', 27).pct, 4);
    assert.equal(a.call('vrucinaZa', 37).pct, 8);
    assert.equal(a.call('vrucinaZa', null), null);
  });

  test('usporavanje raste sa vrućinom, nikad ne pada', () => {
    const a = sa();
    let prosli = -1;
    for (const t of [0, 15, 20, 25, 30, 35, 40]) {
      const p = a.call('vrucinaZa', t).pct;
      assert.ok(p >= prosli, `na ${t} °C usporavanje je palo`);
      prosli = p;
    }
  });

  test('kvalitetna sesija dobija prilagođen tempo, lagana ne', () => {
    /* Na laganom se ide po osećaju ionako — broj bi tu bio lažna preciznost. */
    const a = sa();
    const kv = a.evalIn(`(()=>{ const d=DATED.find(x=>x.date>=TODAY&&(x.tag==='int'||x.tag==='tempo'));
      return d?karticaVremena(d):''; })()`);
    assert.match(String(kv), /tempo uz vrućinu/);
    const lako = a.evalIn(`(()=>{ const d=DATED.find(x=>x.date>=TODAY&&x.tag==='lako');
      return d?karticaVremena(d):''; })()`);
    assert.doesNotMatch(String(lako), /tempo uz vrućinu/);
    assert.match(String(lako), /°C/, 'lagan dan ipak vidi vreme');
  });

  test('hladniji termin se nudi samo kad je razlika stvarna', () => {
    const a = sa();
    /* 17h ima osećaj 37, 7h ima 18 — razlika od 19 °C se nudi. */
    const danas = a.get('TODAY');
    assert.ok(a.call('najboljiSat', danas, 17));
    /* U 7h je već najhladnije — nema šta da se pomera. */
    assert.equal(a.call('najboljiSat', danas, 7), null);
  });

  test('za danas se ne nudi sat koji je već prošao', () => {
    /* „Idi u 5:00" u dva po podne nije savet. Baš je ta rečenica pročitana kao
       trenutna temperatura („piše 25 °C, a napolju je 36"). */
    const a = sa();
    a.clock.set('2026-08-05T14:30:00Z');
    const danas = a.get('TODAY');
    const b = a.call('najboljiSat', danas, 17);
    if (b) assert.ok(b.sat > 14, `nudi ${b.sat}:00, a sada je 14:30`);
    /* Sutra nema tog ograničenja — ceo dan je još pred nama. */
    const sutra = a.call('addD', danas, 1);
    const bs = a.call('najboljiSat', sutra, 17);
    if (bs) assert.ok(bs.sat >= 5);
  });

  test('kartica pokazuje i „sada", ne samo sat treninga', () => {
    /* Otvorena u 14 h, kartica je pokazivala isključivo brojeve za 17 h, pa je
       jedini stepen koji je ličio na trenutni bio onaj iz saveta o hladnijem
       satu — i tako je i pročitan. */
    const a = sa();
    a.clock.set('2026-08-05T14:30:00Z');
    const h = String(a.evalIn(`(()=>{ const d=BY_DATE[TODAY]; return d&&!d.rest?karticaVremena(d):''; })()`));
    if (h) {
      assert.match(h, /sada · 14:00/, 'nema reda „sada"');
      assert.match(h, /u 17:00/, 'nema reda za sat treninga');
    }
    /* Za budući dan „sada" nema smisla i ne sme se pojaviti. */
    const sutra = String(a.evalIn(`(()=>{ const d=DATED.find(x=>x.date>TODAY&&!x.rest); return d?karticaVremena(d):''; })()`));
    assert.doesNotMatch(sutra, /sada ·/, 'prognoza za drugi dan ne zna šta je „sada"');
  });

  test('keš koji NE pokriva trenutni sat se ne priznaje kao svež', () => {
    /* Zapis stiže i iz backupa i sa drugog uređaja preko servera, pa `at` može
       biti mlad a da u njemu nema sata koji nam upravo treba. Tada je red
       „sada" tiho izostajao — kartica bi izgledala kao pre v181. */
    const a = sa();
    const bez = a.evalIn(`(()=>{
      const h=String(new Date().getHours()).padStart(2,'0');
      delete S.vreme.sati[TODAY+'T'+h];
      S.vreme.at=Date.now();          /* mlad keš, ali bez trenutnog sata */
      return JSON.stringify({ sada: vremeSada(TODAY) });
    })()`);
    assert.equal(JSON.parse(bez).sada, null, 'sat postoji iako je obrisan');
    /* vremePovuci mora da odbije takav keš i ode na mrežu. */
    const izvor = readRepoFile('app.js');
    assert.match(izvor, /const pokriva=!!\(v&&v\.sati&&v\.sati\[kljucSada\]\)/,
      'keš se i dalje meri samo starošću');
    assert.match(izvor, /Date\.now\(\)-v\.at<3\*3600000&&v\.lat===g\.lat&&v\.lon===g\.lon&&pokriva/,
      'pokrivenost trenutnog sata nije uslov za korišćenje keša');
  });

  test('bez lokacije se ništa ne crta i ništa ne šalje', () => {
    const a = loadApp({ now: '2026-08-05T09:00:00Z' });
    const d = a.evalIn(`JSON.stringify(karticaVremena(BY_DATE[TODAY]||DATED[0]))`);
    assert.equal(JSON.parse(d), '');
  });

  test('koordinate se ne šalju na naš server', () => {
    /* Ceo razlog zašto ovaj poziv NE ide preko /api — v. komentar u kodu. */
    const src = readRepoFile('app.js');
    const m = /const VREME_URL='([^']+)'/.exec(src);
    assert.ok(m, 'nema adrese vremenske službe');
    assert.match(m[1], /^https:\/\/api\.open-meteo\.com/);
    assert.doesNotMatch(src, /\/api\/(weather|vreme)/, 'prognoza ide preko našeg servera — koordinate mu tada prolaze kroz ruke');
    const csp = readRepoFile('vercel.json');
    assert.match(csp, /connect-src[^;]*https:\/\/api\.open-meteo\.com/, 'CSP ne dozvoljava poziv');
  });
});

describe('Ista sesija ranije', () => {

  test('potpis razlikuje 6×800 od 5×1000', () => {
    /* Oba su „Intervali"; poređenje po tempu između njih ne znači ništa. */
    const a = loadApp({ now: '2026-08-05T09:00:00Z' });
    const potpisi = JSON.parse(a.evalIn(`JSON.stringify(
      DATED.filter(d=>sesijaPotpis(d)).map(d=>sesijaPotpis(d)))`));
    assert.ok(potpisi.length > 3, 'nijedan dan nema potpis');
    assert.ok(new Set(potpisi).size > 1, 'svi dani imaju isti potpis — struktura se ne razlikuje');
    for (const p of potpisi) assert.match(p, /\|/, `potpis bez strukture: ${p}`);
  });

  test('lagano trčanje se poredi po POJASU distance, ne po strukturi', () => {
    /* 8 km lako i 9 km lako su isti stimulus; 8 km i 20 km nisu. */
    const a = loadApp({ now: '2026-08-05T09:00:00Z' });
    const laki = a.evalIn(`DATED.filter(d=>(d.tag==='lako'||d.tag==='lr')&&sesijaPotpis(d)).length`);
    assert.ok(laki > 0, 'lagana trčanja nemaju potpis — nemaju se sa čim porediti');
    const p = JSON.parse(a.evalIn(`(()=>{
      const nadji=km=>{ const d=DATED.find(x=>x.tag==='lako'&&x.km===km); return d?sesijaPotpis(d):null; };
      return JSON.stringify({ k7:nadji(7), k8:nadji(8), k11:nadji(11) }); })()`));
    assert.ok(p.k7 && p.k8, 'nema laganih trčanja od 7 i 8 km u planu');
    assert.equal(p.k7, p.k8, '7 km i 8 km lako moraju biti u istom pojasu');
    assert.notEqual(p.k8, p.k11, '8 km i 11 km lako ne smeju u isti pojas');
  });

  test('porede se samo RANIJE i samo odrađene sesije', () => {
    const a = loadApp({ now: '2026-08-05T09:00:00Z' });
    const r = JSON.parse(a.evalIn(`(()=>{
      const m={}; DATED.forEach(d=>{ const s=sesijaPotpis(d); if(s)(m[s]=m[s]||[]).push(d); });
      const par=Object.values(m).find(v=>v.length>=3);
      /* prvi odrađen, drugi NEodrađen, treći je „danas" */
      S.log[par[0].id]={status:'done',km:par[0].km,sec:2400,hr:150,ts:par[0].date,
        laps:[{distM:800,paceSec:240,avgHr:170}]};
      const pid=predRowFor(par[0]); if(pid) S.pred[pid]=240;
      rebuildDateIndex();
      return JSON.stringify({ ranijih: isteSesije(par[2],5).length,
                              odPrvog: isteSesije(par[0],5).length });
    })()`));
    assert.equal(r.ranijih, 1, 'neodrađena sesija je ušla u poređenje');
    assert.equal(r.odPrvog, 0, 'prva sesija u planu nema šta da poredi unazad');
  });
});

describe('Lagano trčanje se poredi po pulsu i driftu', () => {

  /* Dva ranija lagana trčanja istog pojasa + današnje, sve sa pulsom i driftom. */
  const sa = (danasnji) => {
    const a = loadApp({ now: '2026-08-05T09:00:00Z' });
    a.ctx.__d = danasnji || { km: 8, sec: 8 * 300, hr: 145, dek: 3.1 };
    a.evalIn(`(()=>{
      const laki=DATED.filter(x=>x.tag==='lako'&&sesijaPotpis(x)===sesijaPotpis(DATED.find(y=>y.tag==='lako'&&y.km===8)));
      DAN_A=laki[0]; DAN_B=laki[1]; DANAS=laki[2];
      S.log[DAN_A.id]={status:'done', km:8, sec:8*310, hr:155, ts:DAN_A.date, temp:22, decoupling:{n:6.4}};
      S.log[DAN_B.id]={status:'done', km:8, sec:8*305, hr:150, ts:DAN_B.date, temp:24, decoupling:{n:5.0}};
      S.log[DANAS.id]={status:'done', km:__d.km, sec:__d.sec, hr:__d.hr, ts:DANAS.date,
                       decoupling:__d.dek!=null?{n:__d.dek}:null};
      rebuildDateIndex(); })()`);
    return a;
  };

  test('lagano trčanje sada UOPŠTE ima šta da poredi', () => {
    const a = sa();
    assert.equal(a.evalIn('isteSesije(DANAS,5).length'), 2);
  });

  test('vodeći broj je PULS, ne tempo', () => {
    /* Na laganom se ide po osećaju — razlika u tempu je šum. Ono što se sa
       bazom menja je puls na tom tempu. */
    const a = sa();
    const h = String(a.evalIn('karticaIstaSesija(DANAS)'));
    assert.match(h, /Slično lagano ranije/);
    assert.match(h, /<b>155<\/b> <small>bpm<\/small>/, 'puls nije podebljan broj u redu');
    assert.match(h, /drift/, 'drift se ne prikazuje');
    assert.match(h, /6,4 %/, 'drift nije prikazan sa srpskim zarezom');
    /* Tempo SME kao kontekst („5:10/km"); RAZLIKA u tempu ne sme — to je
       merilo kvalitetne sesije, a na laganom bi tvrdilo napredak tamo gde ga
       nema. */
    assert.match(h, /5:10\/km/, 'tempo se ne vidi ni kao kontekst');
    assert.doesNotMatch(h, /[−+]\d+ s\/km/, 'lagano se poredi razlikom u tempu');
  });

  test('niži puls pri sličnom tempu je zelen, viši je ružičast', () => {
    const a = sa({ km: 8, sec: 8 * 306, hr: 145, dek: 3.1 });   /* 5:06 vs 5:10 i 5:05 */
    const h = String(a.evalIn('karticaIstaSesija(DANAS)'));
    /* 145 naspram 155 = −10, i tempo je u granici → zeleno */
    assert.match(h, /color:var\(--green\)">−10/, 'napredak u pulsu nije obeležen');
  });

  test('puls na BITNO drugačijem tempu se ne boji kao napredak', () => {
    /* 145 bpm na 6:00/km naspram 155 bpm na 5:10/km nije jača baza nego
       sporije trčanje. Broj se i dalje vidi, ali bez tvrdnje o napretku. */
    const a = sa({ km: 8, sec: 8 * 360, hr: 145, dek: 3.1 });
    const h = String(a.evalIn('karticaIstaSesija(DANAS)'));
    assert.match(h, /color:var\(--txt3\)">−10/, 'razlika u pulsu se boji iako tempo nije uporediv');
    assert.doesNotMatch(h, /color:var\(--green\)">−10/);
  });

  test('drift se poredi uvek — on sam po sebi već drži tempo u računu', () => {
    /* Drift JESTE odnos tempo/puls, pa ne zavisi od toga koliko se brzo trčalo. */
    const a = sa({ km: 8, sec: 8 * 360, hr: 145, dek: 3.1 });
    const h = String(a.evalIn('karticaIstaSesija(DANAS)'));
    assert.match(h, /color:var\(--green\)">−3,3/, 'pad drifta 6,4 → 3,1 nije prikazan kao napredak');
  });

  test('bez ijednog pulsa i drifta kartice nema — tempo laganog ne znači ništa', () => {
    const a = loadApp({ now: '2026-08-05T09:00:00Z' });
    a.evalIn(`(()=>{
      const laki=DATED.filter(x=>x.tag==='lako'&&sesijaPotpis(x)===sesijaPotpis(DATED.find(y=>y.tag==='lako'&&y.km===8)));
      laki.slice(0,2).forEach(x=>{ S.log[x.id]={status:'done',km:8,sec:2480,ts:x.date}; });
      DANAS=laki[2]; S.log[DANAS.id]={status:'done',km:8,sec:2460,ts:DANAS.date};
      rebuildDateIndex(); })()`);
    assert.equal(a.evalIn('karticaIstaSesija(DANAS)'), '');
  });

  test('kvalitetna sesija je i dalje poređenje po TEMPU', () => {
    /* Nova grana ne sme da pregazi staru — intervali se porede po tempu
       radnog dela, ne po pulsu. */
    const a = loadApp({ now: '2026-08-05T09:00:00Z' });
    const h = String(a.evalIn(`(()=>{
      const m={}; DATED.forEach(d=>{ const s=sesijaPotpis(d); if(s&&(d.tag==='int'||d.tag==='tempo'))(m[s]=m[s]||[]).push(d); });
      const par=Object.values(m).find(v=>v.length>=2);
      S.log[par[0].id]={status:'done',ts:par[0].date,laps:[{distM:800,sec:192,paceSec:240,avgHr:170}]};
      const pid=predRowFor(par[0]); if(pid) S.pred[pid]=240;
      rebuildDateIndex();
      return karticaIstaSesija(par[1]); })()`));
    assert.match(h, /Ista sesija ranije/);
    assert.doesNotMatch(h, /Slično lagano/);
    assert.match(h, /4:00/, 'tempo radnog dela se više ne prikazuje');
  });
});

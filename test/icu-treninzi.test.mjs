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

  test('automatsko povlačenje ne zavisi od toga da li Strava postoji', () => {
    /* Ko ima samo intervals.icu ranije ne bi dobio nijednu automatsku
       sinhronizaciju — uslov je gledao isključivo `S.strava`. */
    const izvor = readRepoFile('app.js');
    assert.match(izvor, /if\(\(icuImaTreninge\(\)\|\|S\.strava\) && Date\.now\(\)-zadnja>3600000\) sinhronizujTreninge\(false\)/);
  });
});

describe('Server: /api/activities', () => {

  const src = readRepoFile('api/activities.js');

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

  test('server proverava POTVRĐENU adresu, ne samo poklapanje', () => {
    /* Bez provere potvrde bi se, na Supabase podešavanju bez obavezne potvrde
       mejla, svako mogao registrovati vlasnikovom adresom i skinuti limit. */
    const src = readRepoFile('api/analyze.js');
    assert.match(src, /async function jeVlasnik\(req\)/);
    assert.match(src, /email_confirmed_at \|\| u\.confirmed_at/);
    assert.match(src, /if \(!vlasnik\) try \{/, 'limit se i dalje broji vlasniku');
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

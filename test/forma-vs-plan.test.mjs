/* FORMA NAPRAM PLANA — s čime se današnja forma uopšte poredi.

   ZAŠTO OVAJ FAJL POSTOJI

   `formaVsPlan` je do sada uzimala PROSEK propisanih tempa SVIH preostalih dana
   do trke i taj prosek proglašavala „formom koju plan traži danas". Plan po
   konstrukciji ima rampu (vdot0 → vdotGoal), pa je prosek te rampe otprilike
   sredina — broj koji plan traži tek za dva i po meseca.

   Posledica, izmerena na trkaču koji svaki trening odradi TAČNO na propisanom
   tempu: razlika oko −2 poena kroz prvih osam nedelja, kartica „Forma je iza
   plana" i ponuda da se svih ~25 preostalih kvalitetnih treninga uspori za
   ~16 s/km. Ko to prihvati, dobija plan koji više ne traži ništa teže — pa
   više ni ne meri ništa brže: forma se zamrzne na vrednosti iz druge nedelje
   do kraja priprema.

   Druga strana iste greške je u taperu: prosek preostalog pada (poslednja
   sesija je aktivacija na tempu trke, čitana kroz R zonu), pa je aplikacija dva
   dana pred maraton nudila da se ta sesija UBRZA za ~50 s/km.

   Ovde se meri oboje, i to na sve četiri distance, jer se veličina greške
   povećavala sa dužinom plana — dakle bila je najveća tamo gde najviše boli. */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { loadApp, ROOT } from './harness.mjs';

const POCETAK = '2026-01-05';
const dodaj = (d, n) => { const x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const DIST = { '5K': 5000, '10K': 10000, 'HM': 21097.5, 'Maraton': 42195 };
const PB = { 5000: 1237, 10000: 2570, 21097.5: 5700, 42195: 13500 };

function saPlanom(raceDistM, over = {}) {
  const a = loadApp({ now: POCETAK + 'T09:00:00Z' });
  const plan = a.call('generatePlan', {
    startDate: POCETAK, raceDate: dodaj(POCETAK, 20 * 7), raceDistM,
    pb: { distM: raceDistM, sec: PB[raceDistM] }, weeklyKm: 60, runDays: 5,
    quality: 2, intensity: 'std', trainedRecently: true, ...over
  });
  assert.ok(plan && !plan.error, 'plan se nije napravio');
  a.evalIn(`S.genPlan=adaptGeneratedPlan(${JSON.stringify(plan)}); setActivePlan(); rebuildDateIndex();`);
  return a;
}

/* Svi kvalitetni dani sa svojim PRED redom i tempom koji plan traži. */
const kvalitetni = a => a.evalIn(`(function(){var o=[];DATED.forEach(function(d){
  if(d.rest||!d.km)return; var pid=predRowFor(d); if(!pid)return;
  var r=CUR_PRED.find(function(x){return x.id===pid;}); if(!r)return;
  o.push({id:d.id,date:d.date,pid:pid,pt:effectivePace(d,r),nemeri:!!r.nemeri,l:r.l});});return o;})()`);

/* Odigra ceo plan sa zadatim odstupanjem od propisanog tempa (s/km).
   Vraća karticu koja se javi na kraju svake nedelje. */
function odigraj(a, odstupanje, opt = {}) {
  const kartice = [];
  const nedelje = a.evalIn("CUR_PLAN.map(function(w){return {w:w.w,start:w.start};})");
  const svi = kvalitetni(a);
  for (const w of nedelje) {
    for (const d of svi) {
      if (d.date < w.start || d.date > dodaj(w.start, 6)) continue;
      if (!(d.pt > 0)) continue;
      if (opt.preskoci && opt.preskoci(d)) continue;
      const p = d.pt + odstupanje;
      a.evalIn(`S.log[${JSON.stringify(d.id)}]={status:'done',km:(BY_ID[${JSON.stringify(d.id)}].km||0),runDate:'${d.date}'};
                S.pred[${JSON.stringify(d.pid)}]=${p};
                recordVdot(${JSON.stringify(d.pid)}, ${p}, '${d.date}', sessKind(BY_ID[${JSON.stringify(d.id)}]), false, BY_ID[${JSON.stringify(d.id)}]);`);
    }
    const kraj = dodaj(w.start, 6);
    a.evalIn(`TODAY='${kraj}';`);
    const p = a.call('vdotPredlog', kraj);
    if (p) kartice.push({ w: w.w, brzi: p.brzi, delta: p.delta, n: p.changes.length, poruka: p.message });
  }
  return kartice;
}

/* ============================================================
   1. DOSLEDAN TRKAČ NE DOBIJA NIJEDNU PONUDU
   ============================================================ */
describe('Trkač koji radi tačno ono što plan traži', () => {
  for (const [ime, m] of Object.entries(DIST)) {
    test(`${ime}: nijedna ponuda da se plan uspori ni ubrza`, () => {
      const kartice = odigraj(saPlanom(m), 0);
      assert.deepEqual(kartice.map(k => `N${k.w} ${k.brzi ? 'ispred' : 'iza'} ${k.delta}`), [],
        'doslednom trkaču se nudi da promeni tempo celog ostatka priprema');
    });
  }

  test('poređenje ide sa rampom te nedelje, ne sa prosekom cele budućnosti', () => {
    /* Imenilac mora biti isti broj iz kog se crta siva referentna kriva —
       dakle onaj koji korisnik već vidi na grafikonu predikcije. */
    const a = saPlanom(42195);
    const nedelje = a.evalIn("CUR_PLAN.map(function(w){return {w:w.w,start:w.start};})");
    for (const w of nedelje) {
      const dan = dodaj(w.start, 2);
      a.evalIn(`TODAY='${dan}';`);
      const sada = a.call('planVdotSada', dan);
      const rampa = a.evalIn(`planVdotZaNedelju(S.genPlan.meta, ${w.w})`);
      assert.equal(sada, Math.round(rampa * 10) / 10,
        `N${w.w}: imenilac ${sada} nije rampa te nedelje (${rampa})`);
    }
  });

  test('imenilac RASTE kroz pripremu — plan traži sve više', () => {
    /* Stari prosek je radio suprotno: bio je najviši na početku (kad je pred
       trkačem cela rampa) i padao ka kraju. Zato je i davao „iza plana" u
       drugoj nedelji i „ispred plana" u taperu, oba lažno. */
    const a = saPlanom(42195);
    const niz = a.evalIn("CUR_PLAN.map(function(w){return w.start;})")
      .map(s => { a.evalIn(`TODAY='${s}';`); return a.call('planVdotSada', s); });
    for (let i = 1; i < niz.length; i++)
      assert.ok(niz[i] >= niz[i - 1], `imenilac pada u N${i + 1}: ${JSON.stringify(niz)}`);
    assert.ok(niz[niz.length - 1] > niz[0], `imenilac ne raste uopšte: ${JSON.stringify(niz)}`);
  });

  test('lični (tvrdo kodovan) plan takođe ima imenilac po nedeljama', () => {
    /* Bez ovoga bi popravka radila samo za generisan plan, a vlasnikov plan —
       jedini koji zaista postoji u produkciji — ostao bez ijednog poređenja. */
    const a = loadApp({ now: '2026-07-01T09:00:00Z' });
    assert.equal(a.evalIn('S.genPlan'), null, 'test ne meri lični plan');
    const v = a.call('planVdotSada', '2026-07-01');
    assert.ok(v != null && isFinite(v) && v > 20 && v < 85, `imenilac ličnog plana je ${v}`);
  });
});

/* ============================================================
   2. ALI KAD TRKAČ STVARNO ODSTUPI — PONUDA MORA DA POSTOJI

   Popravka koja samo ugasi karticu je gora od greške: tiho bi uklonila celu
   funkciju umesto da ispravi imenilac.
   ============================================================ */
describe('Stvarno odstupanje se i dalje prepoznaje', () => {
  for (const [ime, m] of Object.entries(DIST)) {
    test(`${ime}: 15 s/km brže od plana → „ispred plana"`, () => {
      const k = odigraj(saPlanom(m), -15);
      assert.ok(k.length, 'trkač brži 15 s/km ne dobija nikakvu ponudu');
      assert.ok(k.every(x => x.brzi), `neka kartica ide u pogrešnom smeru: ${JSON.stringify(k.map(x => x.brzi))}`);
    });

    test(`${ime}: 20 s/km sporije od plana → „iza plana"`, () => {
      const k = odigraj(saPlanom(m), +20);
      assert.ok(k.length, 'trkač sporiji 20 s/km ne dobija nikakvu ponudu');
      assert.ok(k.every(x => !x.brzi), `neka kartica ide u pogrešnom smeru: ${JSON.stringify(k.map(x => x.brzi))}`);
    });
  }
});

/* ============================================================
   3. AKTIVACIJA PRED TRKU NE MERI FORMU I NE MENJA SE
   ============================================================ */
describe('Aktivacija pred trku', () => {
  /* TRKA MORA DA SE PROBA NA SVAKI DAN U NEDELJI. Prva verzija ove popravke
     označavala je aktivaciju samo na putu kroz TRKAČKU nedelju — a kad trka
     padne rano u nedelji, protokol -3/-2/-1 se upisuje u PRETHODNU nedelju,
     drugim putem. Merenjem (trka u ponedeljak): zastavica nije bila
     postavljena, forma je i dalje padala, predikcija na maratonu
     3:26:21 → 3:27:53. Zamka na jednom danu u nedelji propustila bi to. */
  for (let off = 0; off <= 6; off++) {
    const trka = dodaj(POCETAK, 20 * 7 + off);
    test(`trka ${trka} (dan ${new Date(trka + 'T00:00:00Z').getUTCDay()}) — tačno jedan red koji ne meri`, () => {
      const a = loadApp({ now: POCETAK + 'T09:00:00Z' });
      const plan = a.call('generatePlan', {
        startDate: POCETAK, raceDate: trka, raceDistM: 42195,
        pb: { distM: 42195, sec: 13500 }, weeklyKm: 55, runDays: 5,
        quality: 2, intensity: 'std', trainedRecently: true
      });
      assert.ok(plan && !plan.error, 'plan se nije napravio');
      const akt = plan.weeks.flatMap(w => w.days).filter(d => /aktivacija/.test(d.desc || ''));
      assert.equal(akt.length, 1, 'plan nema tačno jednu aktivaciju');
      const nemeri = plan.pred.filter(r => r.nemeri);
      assert.equal(nemeri.length, 1,
        `aktivacija nije označena kao sesija koja ne meri formu (${nemeri.length} redova)`);
      assert.match(nemeri[0].l, /Repeticije/);
    });
  }

  for (const [ime, m] of Object.entries(DIST)) {
    test(`${ime}: odrađena tačno kako piše, ne pomera ni formu ni predikciju`, () => {
      const a = saPlanom(m);
      const svi = kvalitetni(a);
      const akt = svi.find(d => d.nemeri);
      assert.ok(akt, 'aktivacija nije nađena');
      /* Odigraj sve OSIM aktivacije. */
      odigraj(a, 0, { preskoci: d => d.id === akt.id });

      a.evalIn(`TODAY='${akt.date}';`);
      const formaPre = a.call('currentVdot');
      const predPre = a.call('predCalc').last;
      assert.ok(formaPre != null, 'nema forme pred aktivaciju');

      const r = a.call('recordVdot', akt.pid, akt.pt, akt.date, null, false, null);
      assert.equal(r, null, 'aktivacija je ušla u lanac forme');
      a.evalIn(`S.pred[${JSON.stringify(akt.pid)}]=${akt.pt};`);

      assert.equal(a.call('currentVdot'), formaPre,
        'forma se promenila zato što je poslednji trening odrađen ISPRAVNO');
      const predPosle = a.call('predCalc').last;
      assert.equal(predPosle && predPosle.pred, predPre && predPre.pred,
        'predikcija pred trku se promenila zbog aktivacije');
    });
  }

  test('nijedan predlog tempa ne dira aktivaciju', () => {
    /* Ni ubrzati ni usporiti: tempo aktivacije je tempo TRKE, a ne tempo
       izveden iz forme, pa ga „prilagoditi formi" znači pokvariti ga. */
    for (const m of Object.values(DIST)) {
      const a = saPlanom(m);
      const akt = kvalitetni(a).find(d => d.nemeri);
      for (const odst of [-15, +20]) {
        const b = saPlanom(m);
        const nedelje = b.evalIn("CUR_PLAN.map(function(w){return w.start;})");
        const svi = kvalitetni(b);
        for (const d of svi) {
          if (d.id === akt.id || !(d.pt > 0)) continue;
          const p = d.pt + odst;
          b.evalIn(`S.log[${JSON.stringify(d.id)}]={status:'done',km:(BY_ID[${JSON.stringify(d.id)}].km||0),runDate:'${d.date}'};
                    S.pred[${JSON.stringify(d.pid)}]=${p};
                    recordVdot(${JSON.stringify(d.pid)}, ${p}, '${d.date}', sessKind(BY_ID[${JSON.stringify(d.id)}]), false, BY_ID[${JSON.stringify(d.id)}]);`);
        }
        for (const s of nedelje) {
          b.evalIn(`TODAY='${s}';`);
          const pr = b.call('vdotPredlog', s);
          if (!pr) continue;
          assert.ok(!pr.changes.some(c => c.id === akt.id),
            `predlog menja aktivaciju (odstupanje ${odst} s/km, distanca ${m})`);
        }
      }
    }
  });
});

/* ============================================================
   4. ZAMKA NAD SAMOM ZAMKOM

   Otisak generatora je sam sebe blagosiljao: `node --test` iz korena tretira
   svaki fajl u `test/` kao test fajl, pa je i `otisak-generatora.mjs` bio
   pokretan kao test — a njegova grana za komandnu liniju UPISUJE nov otisak.
   Prvi prolaz posle izmene generatora bi pao, drugi bi prošao, jer je prvi u
   međuvremenu prepisao fixture. Svaka nenamerna izmena generatora bila bi tako
   tiho odobrena.
   ============================================================ */
describe('Otisak generatora se ne prepisuje sam', () => {
  test('pokretanje alata kroz test runner ne dira fixture', () => {
    const fx = ROOT + '/test/fixtures/otisak-generatora.json';
    const pre = readFileSync(fx, 'utf8');
    try {
      execFileSync(process.execPath, ['--test', 'test/otisak-generatora.mjs'],
        { cwd: ROOT, stdio: 'ignore', timeout: 120000 });
    } catch { /* prolaz/pad alata nije predmet ovog testa */ }
    assert.equal(readFileSync(fx, 'utf8'), pre,
      'alat je prepisao otisak dok su se vrteli testovi — zamka blagosilja samu sebe');
  });
});

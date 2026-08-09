/* TREĆA REVIZIJA — automatski unos, imenilac opterećenja, ćutanje na dan trke.

   Sva tri nalaza dele isti oblik: kod radi nešto drugo nego što njegov
   sopstveni komentar ili tekst na ekranu tvrdi.

   1. `recordVdot` vraća `null` iz pet razloga, a `upisiAutoTempo` ih je sve
      tretirao kao jedan — pa je sesija na tempu trke, uneta sa sata i odrađena
      TAČNO po propisu, gubila tempo, a kartica pisala da „ne odgovara tvojoj
      formi". Isti broj otkucan rukom prolazio je uredno.

   2. `hronicniObim` je od utorka uračunavao TEKUĆU, nezavršenu nedelju, iako
      kartica ispod broja piše „poslednje četiri ZAVRŠENE nedelje". Imenilac bi
      preko noći pao 17–18%, a kroz `injuryProposal` je to menjalo i dozu
      povratka posle povrede.

   3. Dan trke se namerno nikad ne menja automatski — ali iz „ne menjaj" je
      ispalo „ne pominji": na dan trke sa statusom STANI kartica se uopšte nije
      iscrtavala.

   I jedan nalaz koji nije bio u izveštaju, nađen dok sam proveravao drugi:
   `autoRealign` je pri izjednačenju biraо dan po redosledu u nizu, ne po
   kilometraži. */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { loadApp } from './harness.mjs';

const POCETAK = '2026-01-05';
const dodaj = (d, n) => { const x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const DIST = { '5K': 5000, '10K': 10000, 'PM': 21097.5, 'Maraton': 42195 };
const PB = { 5000: 1237, 10000: 2570, 21097.5: 5700, 42195: 13500 };

function saPlanom(raceDistM, over = {}) {
  const a = loadApp({ now: POCETAK + 'T09:00:00Z' });
  const plan = a.call('generatePlan', {
    startDate: POCETAK, raceDate: dodaj(POCETAK, 20 * 7), raceDistM,
    pb: { distM: raceDistM, sec: PB[raceDistM] }, weeklyKm: 55, runDays: 5,
    quality: 2, intensity: 'std', trainedRecently: true, ...over
  });
  assert.ok(plan && !plan.error, 'plan se nije napravio');
  a.evalIn(`S.genPlan=adaptGeneratedPlan(${JSON.stringify(plan)}); setActivePlan(); rebuildDateIndex();`);
  return a;
}
const daniPlana = a => a.evalIn("DATED.map(function(d){return {id:d.id,km:d.km||0,rest:!!d.rest,date:d.date,tag:d.tag};})");

/* ============================================================
   1. AUTOMATSKI UNOS NE SME DA GUBI TEMPO SESIJA NA TEMPU TRKE
   ============================================================ */
describe('Automatski unos sesije koja ne meri formu', () => {
  for (const [ime, m] of Object.entries(DIST)) {
    test(`${ime}: tempo odrađen tačno po propisu se upiše i sa sata`, () => {
      const a = saPlanom(m);
      const kv = a.evalIn(`(function(){var o=[];DATED.forEach(function(d){
        if(d.rest||!d.km)return; var pid=predRowFor(d); if(!pid)return;
        var r=CUR_PRED.find(function(x){return x.id===pid;}); if(!r)return;
        o.push({id:d.id,date:d.date,pid:pid,pt:effectivePace(d,r),nemeri:!!r.nemeri,l:r.l});});return o;})()`);
      const nemeri = kv.filter(x => x.nemeri && x.pt > 0);
      assert.ok(nemeri.length, 'plan nema nijednu sesiju sa `nemeri` redom — scenario ne meri ono zbog čega postoji');

      const izgubljeni = [];
      for (const d of nemeri) {
        a.evalIn(`S.log[${JSON.stringify(d.id)}]={status:'done',km:1,runDate:'${d.date}'};
                  delete S.pred[${JSON.stringify(d.pid)}];`);
        a.call('upisiAutoTempo', d.pid, d.pt, d.date, a.evalIn(`BY_ID[${JSON.stringify(d.id)}]`));
        const upisan = a.evalIn(`S.pred[${JSON.stringify(d.pid)}]`);
        const odbijen = a.evalIn(`(S.log[${JSON.stringify(d.id)}]||{}).autoOdbijen`);
        if (upisan == null) izgubljeni.push(`${d.id} ${d.l} @ ${d.pt} s/km`);
        assert.equal(odbijen, undefined,
          `${d.l}: tempo identičan propisu označen kao „ne odgovara tvojoj formi"`);
      }
      assert.deepEqual(izgubljeni, [],
        'tempo odrađen tačno po propisu je izgubljen na automatskom putu (ručni ga upisuje)');
    });
  }

  test('u lanac forme i dalje ne ulazi ništa', () => {
    /* Popravka sme da vrati tempo, ali NE sme da vrati merenje — to je bio
       nalaz zatvoren u v239 i mora da ostane zatvoren. */
    const a = saPlanom(42195);
    const kv = a.evalIn(`(function(){var o=[];DATED.forEach(function(d){
      if(d.rest||!d.km)return; var pid=predRowFor(d); if(!pid)return;
      var r=CUR_PRED.find(function(x){return x.id===pid;}); if(!r)return;
      if(r.nemeri) o.push({id:d.id,date:d.date,pid:pid,pt:effectivePace(d,r)});});return o;})()`);
    for (const d of kv) {
      a.evalIn(`S.log[${JSON.stringify(d.id)}]={status:'done',km:1,runDate:'${d.date}'};`);
      a.call('upisiAutoTempo', d.pid, d.pt, d.date, a.evalIn(`BY_ID[${JSON.stringify(d.id)}]`));
    }
    assert.equal(a.evalIn('(S.vdotLog||[]).length'), 0, 'sesija koja ne meri formu je ušla u lanac');
    assert.equal(a.call('currentVdot'), null, 'forma je nastala iz sesija koje ne mere');
  });

  test('besmislen tempo se i dalje odbija, i na sesiji koja ne meri', () => {
    /* Provere verodostojnosti (zasićenje tablice) su NAMERNO iznad provere
       `nemeri` — inače bi popravka propustila bilo koji broj. */
    const a = saPlanom(42195);
    const d = a.evalIn(`(function(){var o=null;DATED.forEach(function(d){
      if(o||d.rest||!d.km)return; var pid=predRowFor(d); if(!pid)return;
      var r=CUR_PRED.find(function(x){return x.id===pid;}); if(!r||!r.nemeri)return;
      o={id:d.id,date:d.date,pid:pid};});return o;})()`);
    assert.ok(d, 'nema sesije sa `nemeri` redom');
    a.evalIn(`S.log[${JSON.stringify(d.id)}]={status:'done',km:1,runDate:'${d.date}'};`);
    assert.equal(a.call('upisiAutoTempo', d.pid, 45, d.date, a.evalIn(`BY_ID[${JSON.stringify(d.id)}]`)), false,
      'tempo od 45 s/km je prihvaćen');
    assert.equal(a.evalIn(`S.pred[${JSON.stringify(d.pid)}]`), undefined, 'besmislen tempo je upisan');
  });
});

/* ============================================================
   2. IMENILAC OPTEREĆENJA — SAMO ZAVRŠENE NEDELJE
   ============================================================ */
describe('Hronično opterećenje broji samo završene nedelje', () => {
  for (const [ime, m] of Object.entries(DIST)) {
    test(`${ime}: imenilac se ne menja unutar nedelje`, () => {
      const a = saPlanom(m);
      const dani = daniPlana(a);
      const n11 = a.evalIn("CUR_PLAN.filter(function(w){return w.w===11;})[0].start");
      const hron = [], acwr = [];
      for (let i = 0; i < 7; i++) {
        const dan = dodaj(n11, i);
        /* dnevnik sadrži SAMO ono što se do tog dana zaista desilo */
        const log = {};
        for (const d of dani) if (!d.rest && d.km && d.date <= dan) log[d.id] = { status: 'done', km: d.km, runDate: d.date };
        a.evalIn(`S.log=${JSON.stringify(log)}; S.knee=[]; rebuildDateIndex(); TODAY='${dan}';`);
        hron.push(a.call('hronicniObim', dan));
        acwr.push(a.call('acwrSada', dan).odnos);
      }
      for (let i = 1; i < 7; i++)
        assert.equal(hron[i], hron[0],
          `imenilac se promenio ${hron[0]} → ${hron[i]} unutar nedelje, a nijedna se nije završila (${JSON.stringify(hron)})`);
      /* I posledica — ali samo u JEDNOM smeru. Brojilac (akutno) se kotrlja i
         sme da se menja svakog dana; ono što se ne sme jeste da odnos SKOČI
         zato što je imenilac pao. Pre popravke: 5K 1.10 → 1.35, 10K 1.10 → 1.27,
         PM 1.11 → 1.31, maraton 1.15 → 1.40. */
      assert.ok(acwr[1] <= acwr[0] + 0.05,
        `ACWR skočio ${acwr[0]} → ${acwr[1]} između ponedeljka i utorka, a nijedna nedelja se nije završila (${JSON.stringify(acwr)})`);
    });
  }

  test('pauza i dalje spušta imenilac — zaštita nije ugašena', () => {
    /* Popravka sme da ukloni lažan pad usred nedelje, ali NE sme da ukloni
       pravi pad posle stvarne pauze. */
    const a = saPlanom(42195);
    const dani = daniPlana(a);
    const PAUZA_OD = dodaj(POCETAK, 8 * 7);
    const log = {};
    for (const d of dani) if (!d.rest && d.km && d.date < PAUZA_OD) log[d.id] = { status: 'done', km: d.km, runDate: d.date };
    a.evalIn(`S.log=${JSON.stringify(log)}; S.knee=[]; rebuildDateIndex();`);
    const pre = a.call('hronicniObim', PAUZA_OD);
    const posle = a.call('hronicniObim', dodaj(PAUZA_OD, 14));
    assert.ok(posle < pre * 0.75,
      `posle dve nedelje pauze imenilac je ${posle} naspram ${pre} — pauza se više ne oseti`);
  });
});

/* ============================================================
   3. NA DAN TRKE SE NE ĆUTI
   ============================================================ */
describe('Kad status kaže STANI, dan trke ne prolazi bez reči', () => {
  for (const [ime, m] of Object.entries(DIST)) {
    test(`${ime}: bol 7/10 tri dana pred trku`, () => {
      const a = saPlanom(m);
      const trka = a.evalIn("(function(){for(var i=DATED.length-1;i>=0;i--) if(DATED[i].tag==='trka') return DATED[i].date; return null;})()");
      assert.ok(trka, 'plan nema dan trke');
      a.evalIn(`S.knee=[{id:'k1',date:'${dodaj(trka, -3)}',pain:7,part:'koleno-L'}]; rebuildDateIndex(); TODAY='${trka}';`);
      assert.equal(a.call('kneeStatus', trka).cls, 'stop', 'scenario ne daje status STANI — ne meri ono zbog čega postoji');

      const p = a.call('injuryProposal', trka);
      assert.ok(p, 'na dan trke, uz bol 7/10 i status STANI, nema nikakve poruke');
      assert.match(p.message, /TRKA/, 'poruka ne pominje trku');
      assert.match(p.message, /tvoja odluka/, 'poruka ne kaže čija je odluka');
      assert.equal(p.changes.length, 0, 'dan trke je automatski izmenjen — to se ne sme');
    });
  }

  test('bez trke u horizontu se ništa ne menja — nema prazne kartice', () => {
    const a = saPlanom(42195);
    const dani = daniPlana(a).filter(d => !d.rest && d.km && d.tag !== 'trka');
    /* sredina priprema, daleko od trke, bol koji NE menja nijedan dan:
       plan je već sav u prošlosti za taj horizont */
    const dan = dani[Math.floor(dani.length / 2)].date;
    a.evalIn(`S.knee=[{id:'k1',date:'${dan}',pain:2,part:'koleno-L'}]; rebuildDateIndex(); TODAY='${dan}';`);
    assert.equal(a.call('injuryProposal', dan), null, 'blag bol pravi karticu ni iz čega');
  });
});

/* ============================================================
   4. autoRealign — nađeno pri proveri, nije bilo u izveštaju
   ============================================================ */
describe('autoRealign bira po sličnosti, ne po redosledu', () => {
  for (const [ime, m] of Object.entries(DIST)) {
    test(`${ime}: dan koji ima svoje trčanje se ne odnosi`, () => {
      const a = saPlanom(m);
      const n2 = a.evalIn("CUR_PLAN.filter(function(w){return w.w===2;})[0].start");
      const dani = a.evalIn(`(function(){var o=[];CUR_PLAN.forEach(function(w){if(w.w!==2)return;
        w.days.forEach(function(d){o.push({id:d.id,date:d.date,km:d.km||0,rest:!!d.rest});});});return o;})()`);
      const trcalacki = dani.filter(d => !d.rest && d.km > 0);
      const byDate = {};
      for (const d of trcalacki) byDate[d.date] = [{ distance: d.km * 1000, id: 'a-' + d.id }];
      const sub = dodaj(n2, 5);
      if (!byDate[sub]) byDate[sub] = [{ distance: Math.round(trcalacki[0].km * 0.75 * 1000), id: 'a-extra' }];

      const pre = Object.fromEntries(trcalacki.map(d => [d.id, d.date]));
      a.ctx.__bd = byDate;
      a.evalIn('autoRealign(__bd)');
      const posle = a.evalIn("(function(){var o={};DATED.forEach(function(d){o[d.id]=d.date;});return o;})()");
      const zrtve = Object.keys(pre).filter(i => pre[i] !== posle[i] && byDate[pre[i]]);
      assert.deepEqual(zrtve, [],
        `dan sa sopstvenim trčanjem je odnet: ${zrtve.map(i => i + ' (' + pre[i] + ' → ' + posle[i] + ')').join(', ')}`);
    });
  }

  test('trčanje BEZ para se i dalje uredno veže — popravka ne gasi funkciju', () => {
    const a = saPlanom(42195);
    const n2 = a.evalIn("CUR_PLAN.filter(function(w){return w.w===2;})[0].start");
    const ned = a.evalIn(`(function(){var d=BY_DATE['${dodaj(n2, 6)}'];return d&&!d.rest&&d.km?{id:d.id,km:d.km}:null;})()`);
    assert.ok(ned, 'nedeljni dan nije trkački — scenario ne meri ono zbog čega postoji');
    a.ctx.__bd = { [dodaj(n2, 5)]: [{ distance: ned.km * 1000, id: 'a-lr' }] };
    assert.equal(a.evalIn('autoRealign(__bd)'), 1, 'trčanje bez para se više ne veže');
    assert.equal(a.evalIn(`BY_ID[${JSON.stringify(ned.id)}].date`), dodaj(n2, 5),
      'pomeren je pogrešan dan — na istoj udaljenosti mora da odluči kilometraža');
  });
});

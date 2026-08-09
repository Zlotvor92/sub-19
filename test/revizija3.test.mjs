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

/* ============================================================
   5. DVA TRČANJA ISTOG DANA — OBA SE BROJE

   Ranije se uzimalo samo ono bliže planiranoj kilometraži. Na kvalitetnom danu
   je to sistematski biralo pogrešno (planirana kilometraža uključuje WU/CD koje
   ljudi trče kraće, pa lagano večernje trčanje ispadne „bliže planu" od
   jutarnjih intervala), a uz to se gubio i obim: dan sa dva trčanja brojao se
   kao jedno.
   ============================================================ */
describe('Dan sa dva trčanja', () => {
  const strava = (km, sec, hr) => ({ id: 'a' + km, distance: km * 1000, moving_time: sec, average_heartrate: hr });

  test('kilometraža i vreme su ZBIR, ne izbor', () => {
    const a = saPlanom(5000);
    const s = a.call('spojiDan', [strava(7.71, 2400, 158), strava(9.40, 3000, 138)]);
    assert.equal(s.n, 2);
    assert.equal(s.km, 17.11, 'obim nije zbir — jedno trčanje je nestalo');
    assert.equal(s.sec, 5400);
    /* puls ponderisan trajanjem, ne prosek prosekâ */
    assert.equal(s.hr, Math.round((158 * 2400 + 138 * 3000) / 5400));
  });

  test('duplikat se NE sabira', () => {
    /* Bez ovoga bi popravka koja vraća izgubljeni obim počela da izmišlja
       nepostojeći: isti trening ume da stigne dvaput. */
    const a = saPlanom(5000);
    const s = a.call('spojiDan', [strava(10, 3000, 140), strava(10, 3000, 140)]);
    assert.equal(s.n, 1, 'isti trening je uračunat dvaput');
    assert.equal(s.km, 10);
  });

  test('blizak ali različit trening se sabira', () => {
    /* Prag za duplikat je 1% — dva stvarno različita trčanja slične dužine
       moraju da prođu kao dva. */
    const a = saPlanom(5000);
    const s = a.call('spojiDan', [strava(10, 3000, 140), strava(10.3, 3120, 142)]);
    assert.equal(s.n, 2, 'dva različita trčanja spojena u jedno');
  });

  test('radi i nad intervals.icu oblikom zapisa', () => {
    const a = saPlanom(5000);
    const s = a.call('spojiDan', [
      { id: 'i1', distance: 7710, km: 7.71, sec: 2400, hr: 158 },
      { id: 'i2', distance: 9400, km: 9.40, sec: 3000, hr: 138 }
    ]);
    assert.equal(s.km, 17.11, 'icu oblik se ne čita — obim se gubi');
    assert.equal(s.sec, 5400);
  });

  test('jedno trčanje se ponaša tačno kao pre', () => {
    const a = saPlanom(5000);
    const s = a.call('spojiDan', [strava(9.4, 3000, 140)]);
    assert.equal(s.n, 1);
    assert.equal(s.km, 9.4);
    assert.equal(s.sec, 3000);
    assert.equal(s.hr, 140);
  });
});

/* ============================================================
   6. PROMENA CILJA NE BRIŠE ISTORIJU

   Do sada toka nije bilo: cilj se menjao samo kroz čarobnjak, a on prolazi kroz
   `purgeGenPlanData()`. Merenjem, posle osam nedelja uredne pripreme promena
   cilja je brisala 40 dana dnevnika, svih 12 izmerenih sesija i celu formu
   (`currentVdot()` 49.3 → null), a nova rampa je kretala od PB-a umesto od
   izmerene forme — sve za promenu broja koji govori o BUDUĆNOSTI.
   ============================================================ */
describe('Promena ciljnog vremena usred pripreme', () => {
  /* Plan + osam odigranih nedelja, sa upisanim tempima i merenjima. */
  function odigranih8(m) {
    const a = saPlanom(m);
    a.evalIn(`S.genPlan.ulaz={startDate:'${POCETAK}',raceDate:'${dodaj(POCETAK, 20 * 7)}',raceDistM:${m},
      pb:{distM:${m},sec:${PB[m]}},weeklyKm:55,runDays:5,quality:2,intensity:'std',trainedRecently:true};`);
    const granica = dodaj(POCETAK, 8 * 7);
    const kv = a.evalIn(`(function(){var o=[];DATED.forEach(function(d){
      if(d.rest||!d.km||d.date>='${granica}')return; var pid=predRowFor(d); if(!pid)return;
      var r=CUR_PRED.find(function(x){return x.id===pid;}); if(!r)return;
      o.push({id:d.id,date:d.date,pid:pid,pt:effectivePace(d,r)});});return o;})()`);
    for (const d of kv) {
      if (!(d.pt > 0)) continue;
      a.evalIn(`S.log[${JSON.stringify(d.id)}]={status:'done',km:(BY_ID[${JSON.stringify(d.id)}].km||0),runDate:'${d.date}'};
                S.pred[${JSON.stringify(d.pid)}]=${d.pt};
                recordVdot(${JSON.stringify(d.pid)}, ${d.pt}, '${d.date}', sessKind(BY_ID[${JSON.stringify(d.id)}]), false, BY_ID[${JSON.stringify(d.id)}]);`);
    }
    a.evalIn(`TODAY='${granica}';`);
    return { a, danas: granica };
  }

  for (const [ime, m] of Object.entries(DIST)) {
    test(`${ime}: dnevnik, tempi i forma preživljavaju promenu cilja`, () => {
      const { a, danas } = odigranih8(m);
      const preLog = a.evalIn('Object.keys(S.log).length');
      const prePred = a.evalIn('Object.keys(S.pred).length');
      const preVdot = a.evalIn('(S.vdotLog||[]).length');
      const preForma = a.call('currentVdot');
      assert.ok(preLog >= 6 && prePred >= 6 && preVdot >= 6 && preForma != null,
        `scenario nije odigran — nema šta da se izgubi (log ${preLog}, pred ${prePred}, vdot ${preVdot}, forma ${preForma})`);

      const stari = a.evalIn('goalSecActive()');
      const r = a.call('planSaNovimCiljem', Math.round(stari * 0.95), danas);
      assert.ok(!r.error, 'promena cilja nije uspela: ' + r.error);
      a.evalIn(`S.genPlan={weeks:${JSON.stringify(r.weeks)},pred:${JSON.stringify(r.pred)},qs:${JSON.stringify(r.qs)},meta:${JSON.stringify(r.meta)},ulaz:${JSON.stringify(r.ulaz)}};
                setActivePlan(); rebuildDateIndex();`);

      assert.equal(a.evalIn('Object.keys(S.log).length'), preLog, 'dnevnik je obrisan');
      assert.equal(a.evalIn('Object.keys(S.pred).length'), prePred, 'uneti tempi su obrisani');
      assert.equal(a.evalIn('(S.vdotLog||[]).length'), preVdot, 'izmerene sesije su obrisane');
      assert.equal(a.call('currentVdot'), preForma, 'forma se promenila zbog promene cilja');
    });
  }

  test('menjaju se SAMO nedelje koje tek dolaze', () => {
    const { a, danas } = odigranih8(42195);
    const preDani = a.evalIn("(function(){var o={};DATED.forEach(function(d){o[d.id]=(d.km||0)+'|'+(d.desc||'');});return o;})()");
    const idx = a.evalIn(`(weekOf('${danas}')||{}).w`);
    const r = a.call('planSaNovimCiljem', Math.round(a.evalIn('goalSecActive()') * 0.95), danas);
    assert.ok(!r.error, r.error);
    a.evalIn(`S.genPlan={weeks:${JSON.stringify(r.weeks)},pred:${JSON.stringify(r.pred)},qs:${JSON.stringify(r.qs)},meta:${JSON.stringify(r.meta)},ulaz:${JSON.stringify(r.ulaz)}};
              setActivePlan(); rebuildDateIndex();`);
    const posle = a.evalIn("(function(){var o={};DATED.forEach(function(d){o[d.id]=(d.km||0)+'|'+(d.desc||'');});return o;})()");
    const promenjeni = Object.keys(preDani).filter(k => preDani[k] !== posle[k]);
    const rano = promenjeni.filter(k => +(/^g(\d+)d/.exec(k) || [])[1] < idx);
    assert.deepEqual(rano, [], `promenjeni su dani iz nedelja pre tekuće: ${rano.join(', ')}`);
    assert.ok(promenjeni.length, 'nijedan dan se nije promenio — cilj nije ni primenjen');
  });

  test('ID-jevi PRED redova iz prošlosti se ne pomeraju', () => {
    /* Na njih pokazuju `S.pred`, `S.predLock` i `S.vdotLog`. Da se pomere,
       merenja bi se otkačila od svojih sesija i tiho promenila značenje. */
    const { a, danas } = odigranih8(42195);
    const idx = a.evalIn(`(weekOf('${danas}')||{}).w`);
    const pre = a.evalIn(`CUR_PRED.filter(function(r){return r.w<${idx};}).map(function(r){return r.id+'|'+r.l;})`);
    const r = a.call('planSaNovimCiljem', Math.round(a.evalIn('goalSecActive()') * 0.95), danas);
    assert.ok(!r.error, r.error);
    const posle = r.pred.filter(x => x.w < idx).map(x => x.id + '|' + x.l);
    assert.deepEqual(Array.from(posle), Array.from(pre), 'PRED redovi iz prošlosti su dobili druge ID-jeve');
  });

  test('cilj zaista promeni tempo sesija na tempu trke', () => {
    const { a, danas } = odigranih8(42195);
    const idx = a.evalIn(`(weekOf('${danas}')||{}).w`);
    const cilj = a.evalIn('goalSecActive()');
    const pre = a.evalIn(`CUR_PRED.filter(function(r){return r.w>=${idx} && r.nemeri;}).map(function(r){return r.pt;})`);
    assert.ok(pre.length, 'nema nijedne buduće sesije na tempu trke');
    const r = a.call('planSaNovimCiljem', Math.round(cilj * 0.90), danas);
    assert.ok(!r.error, r.error);
    const posle = r.pred.filter(x => x.w >= idx && x.nemeri).map(x => x.pt);
    assert.ok(posle.length, 'buduće sesije na tempu trke su nestale');
    assert.ok(posle[0] < pre[0], `brži cilj nije ubrzao sesije na tempu trke (${pre[0]} → ${posle[0]})`);
  });

  test('bez zapamćenog ulaza se ne regeneriše ništa — kaže se zašto', () => {
    /* Stariji planovi nemaju `ulaz`. Bolje odbiti nego regenerisati iz
       pogođenih ulaznih podataka. */
    const a = saPlanom(10000);
    a.evalIn('delete S.genPlan.ulaz;');
    const r = a.call('planSaNovimCiljem', 2400, dodaj(POCETAK, 30));
    assert.ok(r.error, 'plan bez zapamćenog ulaza je ipak regenerisan');
    assert.match(r.error, /ulazn/i);
  });

  test('parseClock prima ono što ljudi kucaju, i odbija ostalo', () => {
    const a = saPlanom(5000);
    assert.equal(a.call('parseClock', '3:25:00'), 12300);
    assert.equal(a.call('parseClock', '1:37:12'), 5832);
    assert.equal(a.call('parseClock', '21:09'), 1269);
    for (const los of ['', '  ', 'abc', '3:70', '1:2:3:4', '-1:00', '25:61', '3::00'])
      assert.equal(a.call('parseClock', los), null, `prihvaćeno: „${los}"`);
  });
});

/* Da plan napravljen kroz čarobnjak zaista NOSI ulaz — bez toga je ceo tok
   promene cilja mrtav za svakog novog korisnika, a to se ne bi videlo dok neko
   ne pokuša da promeni cilj. */
describe('Čarobnjak pamti ulazne podatke', () => {
  test('novonapravljen plan nosi `ulaz` dovoljan za regenerisanje', () => {
    const a = loadApp({ now: POCETAK + 'T09:00:00Z' });
    a.evalIn(`Object.assign(wiz,{raceDist:42195,raceDate:'${dodaj(POCETAK, 20 * 7)}',pbDist:42195,
      pbH:3,pbMin:45,pbSec:0,weeklyKm:55,trainedRecently:true,runDays:5,quality:2,
      runDows:[1,2,4,6,7],lrDow:7,qDays:[2,4],intensity:'std',goalH:'',goalMin:'',goalSec:''});
      finishOnboarding();`);
    const ulaz = a.evalIn('S.genPlan && S.genPlan.ulaz ? JSON.parse(JSON.stringify(S.genPlan.ulaz)) : null');
    assert.ok(ulaz, 'plan iz čarobnjaka ne nosi `ulaz` — promena cilja je nedostupna svakom novom korisniku');
    for (const k of ['startDate', 'raceDate', 'raceDistM', 'pb', 'weeklyKm', 'runDays', 'quality', 'intensity'])
      assert.ok(ulaz[k] != null, `u zapamćenom ulazu nedostaje ${k}`);
    /* i da je zaista dovoljan: isti ulaz mora ponovo da napravi plan */
    a.ctx.__u = ulaz;
    assert.ok(a.evalIn('!generatePlan(__u).error'), 'zapamćen ulaz ne pravi plan');
    /* i da promena cilja odatle radi */
    a.evalIn(`TODAY='${dodaj(POCETAK, 21)}';`);
    assert.ok(!a.call('planSaNovimCiljem', 12000, dodaj(POCETAK, 21)).error,
      'promena cilja ne radi nad planom iz čarobnjaka');
  });
});

/* ============================================================
   7. recalibratedPlan — dve greške koje je izveštaj izmerio

   Funkcija je i dalje NEPOVEZANA (drži je spisak u `otpornost.test.mjs`), ali
   je temelj na kom stoji promena cilja, pa mora da bude tačna pre nego što se
   ikad poveže.
   ============================================================ */
describe('Rekalibracija sa formom tačno na planu ne menja ništa', () => {
  for (const [ime, m] of Object.entries(DIST)) {
    test(`${ime}: no-op kad je forma tačno ona koju plan očekuje`, () => {
      const a = saPlanom(m);
      const ulaz = {
        startDate: POCETAK, raceDate: dodaj(POCETAK, 20 * 7), raceDistM: m,
        pb: { distM: m, sec: PB[m] }, weeklyKm: 55, runDays: 5,
        quality: 2, intensity: 'std', trainedRecently: true
      };
      a.ctx.__u = ulaz;
      const meta = a.evalIn('JSON.parse(JSON.stringify(S.genPlan.meta))');
      for (const w of [5, 9, 14]) {
        const ocekivano = a.call('planVdotZaNedelju', meta, w);
        const r = a.evalIn(`(function(){var r=recalibratedPlan(__u, ${w}, ${ocekivano}, null);
          return r&&r.meta?JSON.parse(JSON.stringify(r.meta)):null;})()`);
        assert.ok(r, `N${w}: rekalibracija nije vratila plan`);
        const dobijeno = a.call('planVdotZaNedelju', r, w);
        assert.ok(Math.abs(dobijeno - ocekivano) < 0.05,
          `N${w}: plan očekuje VDOT ${ocekivano}, rekalibrisan računa ${dobijeno} — pomak za korak rampe`);
      }
    });
  }

  test('racePace ostaje stabilan, kako komentar iznad njega i traži', () => {
    /* Bez eksplicitnog cilja oslonac je bio TRENUTNA forma, pa se `racePace`
       menjao pri svakoj rekalibraciji: izmereno na N14, maratonski tempo
       260 → 264 s/km, bez ijedne korisnikove odluke. */
    const a = saPlanom(42195);
    a.ctx.__u = {
      startDate: POCETAK, raceDate: dodaj(POCETAK, 20 * 7), raceDistM: 42195,
      pb: { distM: 42195, sec: PB[42195] }, weeklyKm: 55, runDays: 5,
      quality: 2, intensity: 'std', trainedRecently: true
    };
    const meta = a.evalIn('JSON.parse(JSON.stringify(S.genPlan.meta))');
    const forma = a.call('planVdotZaNedelju', meta, 14);
    const r = a.evalIn(`(function(){var r=recalibratedPlan(__u, 14, ${forma}, null);
      return r&&r.meta?r.meta.racePace:null;})()`);
    assert.equal(r, meta.racePace,
      `racePace se pomerio ${meta.racePace} → ${r} pri rekalibraciji bez promene cilja`);
  });
});

/* ============================================================
   8. RUČNO ZAKLJUČAN TEMPO NAD PROMENOM CILJA

   Izveštaj je ovo naveo kao prvu stvar koju treba izmeriti AKO se tok za
   promenu cilja napravi (tačka D5). Napravljen je, pa se meri.

   `S.alts[id].pace` sa `paceAuto:false` je izričita korisnikova odluka za
   određen dan — mora da preživi promenu cilja. Automatski postavljen tempo
   (`paceAuto:true`, iz kartice „Prilagodi tempo") nije odluka nego procena i
   sme da bude pregažen; ali ni on ne sme da ostane a da se ne vidi, jer bi
   tiho protivrečio novom cilju.
   ============================================================ */
describe('Promena cilja i ručno zaključan tempo', () => {
  function pripremi() {
    const a = saPlanom(42195);
    a.evalIn(`S.genPlan.ulaz={startDate:'${POCETAK}',raceDate:'${dodaj(POCETAK, 20 * 7)}',raceDistM:42195,
      pb:{distM:42195,sec:${PB[42195]}},weeklyKm:55,runDays:5,quality:2,intensity:'std',trainedRecently:true};`);
    const danas = dodaj(POCETAK, 8 * 7);
    a.evalIn(`TODAY='${danas}';`);
    /* budući kvalitetni dan */
    const d = a.evalIn(`(function(){var o=null;DATED.forEach(function(x){
      if(o||x.rest||!x.km||x.date<'${danas}')return;
      if(x.tag!=='int'&&x.tag!=='tempo')return; o={id:x.id,date:x.date,km:x.km,tag:x.tag};});return o;})()`);
    assert.ok(d, 'nema budućeg kvalitetnog dana');
    return { a, danas, d };
  }

  test('ručno zaključan tempo preživi promenu cilja', () => {
    const { a, danas, d } = pripremi();
    a.evalIn(`setAlt(${JSON.stringify(d.id)}, {tag:'${d.tag}', km:${d.km}, desc:'ručno', pace:333, paceAuto:false});
              rebuildDateIndex();`);
    const r = a.call('planSaNovimCiljem', Math.round(a.evalIn('goalSecActive()') * 0.90), danas);
    assert.ok(!r.error, r.error);
    a.evalIn(`S.genPlan={weeks:${JSON.stringify(r.weeks)},pred:${JSON.stringify(r.pred)},qs:${JSON.stringify(r.qs)},meta:${JSON.stringify(r.meta)},ulaz:${JSON.stringify(r.ulaz)}};
              setActivePlan(); rebuildDateIndex();`);
    assert.equal(a.evalIn(`S.alts[${JSON.stringify(d.id)}] && S.alts[${JSON.stringify(d.id)}].pace`), 333,
      'ručno zaključan tempo je obrisan promenom cilja');
    const ep = a.evalIn(`(function(){var x=BY_ID[${JSON.stringify(d.id)}]; if(!x)return null;
      var z=zonaZaDan(x); return effectivePace(x, z&&z.r);})()`);
    assert.equal(ep, 333, `dan više ne koristi ručno zaključan tempo (${ep})`);
  });

  test('dan sa ručnim tempom i dalje postoji posle promene cilja', () => {
    /* ID-jevi dana su stabilni po nedelji i danu; da nisu, `S.alts` bi ostao
       da visi nad danom koga više nema. */
    const { a, danas, d } = pripremi();
    a.evalIn(`setAlt(${JSON.stringify(d.id)}, {tag:'${d.tag}', km:${d.km}, desc:'ručno', pace:333, paceAuto:false});`);
    const r = a.call('planSaNovimCiljem', Math.round(a.evalIn('goalSecActive()') * 0.90), danas);
    assert.ok(!r.error, r.error);
    a.evalIn(`S.genPlan={weeks:${JSON.stringify(r.weeks)},pred:${JSON.stringify(r.pred)},qs:${JSON.stringify(r.qs)},meta:${JSON.stringify(r.meta)},ulaz:${JSON.stringify(r.ulaz)}};
              setActivePlan(); rebuildDateIndex();`);
    assert.ok(a.evalIn(`!!BY_ID[${JSON.stringify(d.id)}]`), 'dan sa ručnim tempom je nestao iz plana');
  });
});

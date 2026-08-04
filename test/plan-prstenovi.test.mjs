/* TAB PLAN — PRSTENOVI

   Bio je spisak od 14 kartica po ~150 px: sedam nedelja na ekran, i to samo kad
   nijedna nema dug opis. Ceo plan se nije mogao obuhvatiti pogledom — a to je
   jedina stvar zbog koje se taj tab otvara.

   Ono što ovde ima smisla testirati nisu prstenovi nego BROJEVI ispod njih:
   dva velika prstena mere dve različite stvari i lako je zameniti im imenilac,
   a prosek i „najjača nedelja" se lako izračunaju pogrešno na praznom planu. */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { loadApp } from './harness.mjs';

/* Stanje sa odrađenim nedeljama do zadatog dana. */
function planSa(nedelje, danas = '2026-08-04T09:00:00Z') {
  const a = loadApp({ now: danas });
  a.evalIn(`
    ${JSON.stringify(nedelje)}.forEach(([w, km]) => {
      const ned = CUR_PLAN.find(x => x.w === w);
      const dani = ned.days.filter(d => !d.rest && d.km);
      const poDanu = km / dani.length;
      dani.forEach(d => { S.log[d.id] = { status:'done', km: poDanu, sec: Math.round(poDanu*300) }; });
    });
    rebuildDateIndex();`);
  return a;
}

describe('Dva velika prstena mere dve različite stvari', () => {

  test('levi je naspram plana DO SADA, desni naspram celog plana', () => {
    const a = planSa([[1, 30], [2, 33]]);
    const z = a.call('planSazetak');
    assert.ok(z.doSada < z.ukupno, 'plan do sada nije manji od celog plana');
    assert.equal(z.istrcano, 63);
    /* Isti brojilac, različit imenilac — zato su i procenti različiti. */
    assert.equal(z.drziPlan, Math.round(63 / z.doSada * 100));
    assert.equal(z.ceoPlan, Math.round(63 / z.ukupno * 100));
    assert.notEqual(z.drziPlan, z.ceoPlan);
  });

  test('„do sada" broji tekuću nedelju samo do današnjeg dana', () => {
    /* Inače bi u utorak pisalo da kasniš za celom nedeljom koja tek traje. */
    const a = planSa([], '2026-08-04T09:00:00Z');   /* utorak N7 */
    const z = a.call('planSazetak');
    const doKraja = a.evalIn(`CUR_PLAN.filter(w => w.start <= '2026-08-04')
      .reduce((s, w) => s + weekPlanKm(w), 0)`);
    assert.ok(z.doSada < doKraja,
      `„do sada" (${z.doSada}) broji celu tekuću nedelju umesto samo do danas`);
  });

  test('ceo plan je zbir svih 14 nedelja', () => {
    const a = planSa([]);
    const z = a.call('planSazetak');
    const zbir = a.evalIn('CUR_PLAN.reduce((s,w)=>s+weekPlanKm(w),0)');
    assert.equal(z.ukupno, zbir);
  });

  test('prekoračenje plana ne seče prsten, ali ni ne pravi NaN', () => {
    /* Sat mora biti odmah po kraju prve nedelje — inače imenilac „do sada"
       obuhvata i svih šest narednih, pa prekoračenja nema. */
    const a = planSa([[1, 60]], '2026-06-29T09:00:00Z');   /* plan N1 je 30, istrčano 60 */
    const z = a.call('planSazetak');
    assert.ok(z.drziPlan > 100, `prekoračenje nije prikazano: ${z.drziPlan}%`);
    const svg = a.call('prstenSVG', 2, '200%', 104, 'red');
    /* `rotate(-90 …)` je legitiman minus — traži se NaN i NEGATIVAN dashoffset,
       jer bi on prsten iscrtao naopako. */
    assert.doesNotMatch(svg, /NaN/, `prsten daje NaN: ${svg}`);
    const off = Number(/stroke-dashoffset="(-?[\d.]+)"/.exec(svg)[1]);
    assert.ok(off >= 0, `negativan dashoffset: ${off}`);
    assert.equal(off, 0, 'pun prsten pri prekoračenju nije pun');
  });
});

describe('Brojevi ispod prstenova', () => {

  test('prosek se računa preko SVIH završenih nedelja, ne samo onih sa km', () => {
    /* Preskočena nedelja je nula, ne izuzetak — inače je prosek lažno visok. */
    const a = planSa([[1, 30], [2, 0], [3, 30]]);
    const z = a.call('planSazetak');
    const zavrsenih = a.evalIn(`CUR_PLAN.filter(w => addD(w.start,6) < TODAY).length`);
    assert.equal(Math.round(z.prosek * 100), Math.round(60 / zavrsenih * 100));
  });

  test('na praznom planu prosek je „nema podatka", ne nula', () => {
    /* Nula bi značila „trčao si nula", a ovde još nijedna nedelja nije prošla. */
    const a = planSa([], '2026-06-23T09:00:00Z');   /* druga dan prve nedelje */
    assert.equal(a.call('planSazetak').prosek, null);
  });

  test('najjača nedelja je stvarno najjača', () => {
    const a = planSa([[1, 20], [2, 45], [3, 30]]);
    const z = a.call('planSazetak');
    assert.equal(z.najjaca.w, 2);
    assert.equal(z.najjacaKm, 45);
  });

  test('bez ijednog trčanja najjača nedelja se ne izmišlja', () => {
    const h = planSa([], '2026-06-23T09:00:00Z').call('renderPlan') ||
              planSa([], '2026-06-23T09:00:00Z').evalIn('$("#pg-plan").innerHTML');
    assert.doesNotMatch(String(h), /najjača · N\d/, 'prikazana je „najjača" nedelja bez ijednog km');
  });

  test('preostalo + istrčano daje ceo plan', () => {
    const z = planSa([[1, 30], [2, 33]]).call('planSazetak');
    assert.equal(Math.round((z.preostalo + z.istrcano) * 10), Math.round(z.ukupno * 10));
  });
});

describe('Raspored nedelja', () => {

  test('svih 14 nedelja je na ekranu', () => {
    const a = planSa([]);
    a.call('renderPlan');
    const h = a.evalIn('$("#pg-plan").innerHTML');
    const prstenova = (String(h).match(/class="pl-w/g) || []).length;
    assert.equal(prstenova, a.evalIn('CUR_PLAN.length'));
  });

  test('DELOAD ne pravi svoju fazu nego ostaje u okolnoj', () => {
    /* Inače bi se RAZVOJ raspao na tri odvojena naslova oko jedne deload nedelje. */
    const a = planSa([]);
    const faze = a.call('planFaze').map(g => g.ime);
    assert.ok(!faze.includes('DELOAD'), `DELOAD je dobio svoju grupu: ${faze.join(', ')}`);
    assert.equal(new Set(faze).size, faze.length, `faza se ponavlja: ${faze.join(', ')}`);
  });

  test('svaka nedelja pripada tačno jednoj fazi', () => {
    const a = planSa([]);
    const svew = a.call('planFaze').flatMap(g => g.nedelje.map(w => w.w));
    assert.equal(svew.length, a.evalIn('CUR_PLAN.length'));
    assert.equal(new Set(svew).size, svew.length, 'nedelja je u dve faze');
  });

  test('dani otvorene nedelje se crtaju, i to sa njenim danima', () => {
    const a = planSa([]);
    a.evalIn('openW.clear(); openW.add(3);');
    a.call('renderPlan');
    const h = String(a.evalIn('$("#pg-plan").innerHTML'));
    assert.match(h, /class="pl-body"/, 'nema otvorenog tela nedelje');
    const ocekivano = a.evalIn(`CUR_PLAN.find(w=>w.w===3).days.length`);
    const dana = (h.match(/class="day t-/g) || []).length;
    assert.equal(dana, ocekivano, `otvoreno ${dana} dana, nedelja ih ima ${ocekivano}`);
  });

  test('zatvorena nedelja ne crta svoje dane', () => {
    const a = planSa([]);
    a.evalIn('openW.clear();');
    a.call('renderPlan');
    assert.doesNotMatch(String(a.evalIn('$("#pg-plan").innerHTML')), /class="pl-body"/);
  });
});

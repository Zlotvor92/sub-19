/* EKRAN DANAS — KARTOTEKA

   Do sada je sve stajalo u JEDNOJ kartici: opis sesije, planski brojevi, polja
   za unos, harmonika, podaci sa sata, jutarnja merenja, AI napomena i dugme.
   Ništa nije govorilo šta je glavno, a merenja su se nizala u rečenicu.

   Sada je svaki izvor podataka svoja kartica sa imenom: Plan (šta traži plan),
   Uneto (šta si upisao ti), Sa sata i Jutros (šta je stiglo samo), Analiza. */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { loadApp } from './harness.mjs';

/* Dan sa punim podacima: uneto, sve sa sata, jutarnja merenja. */
function danSaSvim(extra = {}) {
  const a = loadApp({ now: '2026-08-04T09:00:00Z' });
  a.evalIn(`
    S.strava={athlete:'x',hrZones:[{min:0,max:120},{min:120,max:140},{min:140,max:155},{min:155,max:168},{min:168,max:-1}]};
    const d=CUR_PLAN[0].days.find(x=>x.tag==='lako'); __id=d.id;
    S.log[d.id]=Object.assign({status:'done',km:8.01,sec:2679,hr:141,ts:d.date,
      cadence:86,maxHr:154,elevGain:71,temp:31,relEffort:19,decoupling:{n:11.2},
      perKm:[1,2,3,4,5,6,7,8].map(i=>({paceSec:334,hr:140,cadence:86}))},
      ${JSON.stringify(extra)});
    S.wellness={[d.date]:{hrv:111,pulsUMiru:47,sanH:6.7,svezina:-13.8}};
    rebuildDateIndex();`);
  a.ctx.__d = a.evalIn('BY_ID[__id]');
  return a;
}
const naslovi = h => [...String(h).matchAll(/<span class="card-t">([^<]*)<\/span>/g)].map(m => m[1]);

describe('Kartice po izvoru podataka', () => {

  test('odrađen trening daje kartice po izvoru, tim redom', () => {
    const h = danSaSvim().evalIn('dayCard(__d)');
    /* „Analiza" nema naslov dok je prazna — to je cela poenta sažetog stanja:
       kartica je tada jedan red, sama radnja. Zato se traži odvojeno. */
    assert.deepEqual(naslovi(h), ['Plan', 'Uneto', 'Sa sata', 'Jutros']);
    assert.match(h, /class="card ai-card prazna"/, 'nema kartice za analizu');
  });

  test('svaka kartica je zaseban element, ne jedan blok', () => {
    const h = danSaSvim().evalIn('dayCard(__d)');
    const broj = (String(h).match(/<div class="card/g) || []).length;
    assert.ok(broj >= 5, `očekivano bar 5 kartica, nađeno ${broj}`);
  });

  test('kartica koja nema šta da pokaže se ne crta', () => {
    /* Bez podataka sa sata i bez jutarnjih merenja ostaju samo Plan i Uneto.
       Prazna kartica sa naslovom je gori od nikakve — obećava sadržaj. */
    const a = loadApp({ now: '2026-08-04T09:00:00Z' });
    a.evalIn(`const d=CUR_PLAN[0].days.find(x=>x.tag==='lako'); __id=d.id;
      S.log[d.id]={status:'done',km:8,sec:2679}; S.wellness={}; rebuildDateIndex();`);
    a.ctx.__d = a.evalIn('BY_ID[__id]');
    const n = naslovi(a.evalIn('dayCard(__d)'));
    assert.ok(!n.includes('Sa sata'), 'crta se prazna kartica „Sa sata"');
    assert.ok(!n.includes('Jutros'), 'crta se prazna kartica „Jutros"');
  });

  test('dok trening nije odrađen vidi se samo Plan', () => {
    const a = loadApp({ now: '2026-08-04T09:00:00Z' });
    a.evalIn(`const d=CUR_PLAN[0].days.find(x=>x.tag==='lako'); __id=d.id; rebuildDateIndex();`);
    a.ctx.__d = a.evalIn('BY_ID[__id]');
    const h = a.evalIn('dayCard(__d)');
    assert.deepEqual(naslovi(h), ['Plan']);
    assert.match(h, /Završi trening/, 'nema dugmeta za završetak');
  });

  test('podaci sa sata su redovi, ne rečenica', () => {
    /* Ranije: „⌚ Sa sata: kadenca 86 spm · maks. puls 154 · uspon 71 m · …" */
    const h = danSaSvim().evalIn('dayCard(__d)');
    assert.doesNotMatch(h, /Sa sata: kadenca/, 'merenja se i dalje nižu u rečenicu');
    const redova = (String(h).match(/<div class="drow">/g) || []).length;
    assert.ok(redova >= 9, `očekivano bar 9 redova (6 sa sata + 3 jutros), nađeno ${redova}`);
  });

  test('poreklo unosa stoji u zaglavlju kartice Uneto', () => {
    const h = danSaSvim({ src: 'strava', lock: true }).evalIn('dayCard(__d)');
    assert.match(h, /Uneto<\/span><span class="dhead-x">sa Strave · ručno korigovano/);
  });
});

describe('AI analiza — kartica u dva stanja', () => {

  test('bez analize je JEDAN red, ne kartica sa naslovom', () => {
    const h = danSaSvim().evalIn('dayCard(__d)');
    assert.match(h, /class="card ai-card prazna"/, 'prazna kartica nema sažeto stanje');
    assert.match(h, /Analiziraj trening/);
    assert.doesNotMatch(h, /<span class="card-t">Analiza<\/span>[\s\S]*?ai-out/,
      'prazna analiza već crta naslov i prostor za tekst');
  });

  test('izvor podataka je podnaslov radnje, ne zaseban red iznad', () => {
    /* Ranije je stajalo „📊 AI dobija po KILOMETRU (8 km) — nema podelu po
       intervalu." kao poseban red — šum dok te ne zanima. */
    const h = danSaSvim().evalIn('dayCard(__d)');
    assert.doesNotMatch(h, /AI dobija/, 'stara napomena je i dalje tu');
    assert.match(h, /po kilometru · 8 km/);
  });

  test('krugovi imaju prednost nad kilometrima, sa pravim oblikom reči', () => {
    const sLaps = n => danSaSvim({ laps: Array.from({ length: n }, () => ({ paceSec: 300, hr: 150 })) })
      .evalIn('dayCard(__d)');
    assert.match(sLaps(1), /po krugu · 1 krug\b/);
    assert.match(sLaps(3), /po krugu · 3 kruga\b/);
    assert.match(sLaps(12), /po krugu · 12 krugova\b/);
  });

  test('sačuvana analiza pretvara red u punu karticu', () => {
    const h = danSaSvim({ aiText: 'Tempo je bio **ravnomeran**.', aiCount: 1 }).evalIn('dayCard(__d)');
    assert.match(h, /<span class="card-t">Analiza<\/span>/);
    assert.doesNotMatch(h, /class="card ai-card prazna"/);
    assert.match(h, /<strong>ravnomeran<\/strong>/, 'markdown nije obrađen');
    assert.match(h, /Analiziraj ponovo · 1 preostala/);
  });

  test('kad je kvota potrošena, nema dugmeta ni poruke o grešci', () => {
    const h = danSaSvim({ aiText: 'Nešto.', aiCount: 2 }).evalIn('dayCard(__d)');
    assert.doesNotMatch(h, /Analiziraj ponovo/);
    assert.doesNotMatch(h, /Iskorišćene su 2 analize/, 'greška se prikazuje pre nego što se pritisne');
  });

  test('bez unetih km i vremena analize nema uopšte', () => {
    const a = loadApp({ now: '2026-08-04T09:00:00Z' });
    a.evalIn(`const d=CUR_PLAN[0].days.find(x=>x.tag==='lako'); __id=d.id;
      S.log[d.id]={status:'done'}; rebuildDateIndex();`);
    a.ctx.__d = a.evalIn('BY_ID[__id]');
    assert.doesNotMatch(a.evalIn('dayCard(__d)'), /ai-card/);
  });

  test('tekst iz oštećenog backupa ne izlazi iz svog mesta', () => {
    /* `aiText` se čuva u stanju, pa uvezen backup može doneti bilo šta.
       mdToHtml escapuje PRE parsiranja markdowna — oznake ostaju tekst. */
    const h = danSaSvim({ aiText: '<img src=x onerror=alert(1)>', aiCount: 1 }).evalIn('dayCard(__d)');
    assert.doesNotMatch(h, /<img/, 'oznaka je prošla u DOM');
    assert.match(h, /&lt;img/);
  });

  test('aiText koji nije tekst ne pravi „[object Object]"', () => {
    for (const zlo of [{ a: 1 }, 42, [], '   ']) {
      const h = danSaSvim({ aiText: zlo, aiCount: 1 }).evalIn('dayCard(__d)');
      assert.doesNotMatch(String(h), /\[object Object\]/);
      assert.match(String(h), /class="card ai-card prazna"/,
        `aiText=${JSON.stringify(zlo)} je prikazan kao da postoji analiza`);
    }
  });
});

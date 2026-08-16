/* DELOAD ZADRŽAVA JEDNU OŠTRINU, I NEDELJA KAŽE ČEMU SLUŽI

   Dve izmene sa istim povodom: plan je delovao jednolično. Izmerene su, ne
   procenjene — na generisanom 5K planu od 16 nedelja bilo je 79 sesija sa 16
   različitih oblika (20 %), a 3 nedelje BEZ IJEDNOG kvaliteta.

   1. DELOAD. `if(isDeload) continue;` je preskakao oba kvalitetna slota, pa je
      nedelja rasterećenja bila četiri identična laka trčanja plus dugo — petina
      pripreme bez ijednog stimulusa. Sada q1 slot dobija kratku oštrinu
      (`mkDeloadOstrina`): 4–8 × 200 m sa PUNIM oporavkom, dakle neuromišićni
      stimulus bez metaboličkog umora. q2 ostaje lagan dan.

   2. FOKUS. Polje `focus` UI već iscrtava i vlasnikov ručno pisan plan ga
      uredno nosi; generisan plan ga je jedini ostavljao prazan, pa je od trake
      ostajalo samo „VRHUNAC", pa opet „VRHUNAC". Nijedan trening se ne menja —
      menja se to što nedelja izgovori šta radi.

   ŠTA OVE ZAMKE ČUVAJU. Ne konkretne brojeve (prag ponavljanja, tekst) nego
   invarijante: da deload OSTANE rasterećenje, da oštrina bude MANJA od
   redovnog kvaliteta, i da nedelja rasterećenja i dalje bude prepoznatljiva
   kao takva svuda gde se to čita. */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { loadApp } from './harness.mjs';

const a = loadApp({ now: '2026-08-15T08:00:00Z' });
const PB = {
  5000: { distM: 5000, sec: 1290 }, 10000: { distM: 10000, sec: 2700 },
  21097.5: { distM: 21097.5, sec: 5700 }, 42195: { distM: 42195, sec: 12000 }
};
const DISTANCE = [['5K', 5000, 16, 45], ['10K', 10000, 18, 50],
                  ['Polumaraton', 21097.5, 20, 70], ['Maraton', 42195, 20, 70]];

function datum(n) { const d = new Date('2026-08-17'); d.setDate(d.getDate() + n * 7 - 2); return d.toISOString().slice(0, 10); }
function plan(distM, nedelja, km, extra = {}) {
  const g = a.call('generatePlan', Object.assign({
    startDate: '2026-08-17', raceDate: datum(nedelja), raceDistM: distM,
    pb: PB[distM], weeklyKm: km, runDays: 5, quality: 2,
    intensity: 'std', trainedRecently: true
  }, extra));
  assert.ok(g && !g.error, `plan se nije napravio: ${g && g.error}`);
  return JSON.parse(JSON.stringify({ weeks: g.weeks })).weeks;
}
const kmNedelje = w => w.days.reduce((s, d) => s + (d.km || 0), 0);
const ostrine = w => w.days.filter(d => d.session && d.session.kind === 'Oštrina');
const kvaliteti = w => w.days.filter(d => d.tag === 'int' || d.tag === 'tempo');

describe('Deload više nije nedelja bez ijednog stimulusa', () => {

  for (const [ime, distM, ned, km] of DISTANCE) {
    test(`${ime}: svaka deload nedelja u kvalitetnoj fazi ima tačno jednu oštrinu`, () => {
      /* TAČNO JEDNU: nula je stari propust, dve su prestale da budu
         rasterećenje. Bazne nedelje se ne broje — tamo kvaliteta nema po
         definiciji i to je namerno. */
      const w = plan(distM, ned, km);
      const deloadi = w.filter(x => x.deload && kvaliteti(x).length + ostrine(x).length > 0);
      assert.ok(deloadi.length > 0, 'nijedna deload nedelja u kvalitetnoj fazi — proveri postavku');
      for (const d of deloadi) {
        assert.equal(ostrine(d).length, 1,
          `N${d.w}: ${ostrine(d).length} oštrina umesto jedne`);
        assert.equal(kvaliteti(d).length, 1,
          `N${d.w}: deload nosi ${kvaliteti(d).length} kvalitetnih dana — više nije rasterećenje`);
      }
    });
  }

  test('oštrina je MANJA od najmanjeg redovnog kvaliteta', () => {
    /* Ovo je granica koja deload čini deloadom. Ista zamka je u ovom
       repozitorijumu već dvaput pukla na drugom mestu: tvrdo kodovane taper
       sesije su na niskom obimu ispadale VEĆE od redovnih, pa je taper imao
       više kilometara od vrhunca. */
    for (const [ime, distM, ned, km] of DISTANCE) {
      const w = plan(distM, ned, km);
      /* TAPER SE IZUZIMA. Njegove sesije su namerno najmanje u planu — taper
         je dublji rez od deloada, pa bi poređenje s njim tražilo da oštrina
         bude manja od najmanjeg treninga u celoj pripremi. Meri se prema
         REDOVNOM kvalitetu, jer to je ono od čega deload rasterećuje. */
      const zadnjeRadne = w.length - 2;
      const najmanjiRedovni = Math.min(...w.filter(x => !x.deload && x.w <= zadnjeRadne)
        .flatMap(x => kvaliteti(x).filter(d => d.session && d.session.kind !== 'Oštrina'))
        .map(d => d.km || 0).filter(x => x > 0));
      for (const d of w.filter(x => x.deload)) {
        for (const o of ostrine(d)) {
          assert.ok(o.km < najmanjiRedovni,
            `${ime} N${d.w}: oštrina ${o.km} km nije manja od najmanjeg redovnog kvaliteta ${najmanjiRedovni} km`);
        }
      }
    }
  });

  test('radni deo oštrine je simboličan, ne trening', () => {
    /* Cilj je kvalitet koraka, ne zadihanost. Gornja granica drži da se
       „oštrina" ne pretvori u prikriveni interval trening. */
    for (const [ime, distM, ned, km] of DISTANCE) {
      for (const d of plan(distM, ned, km).filter(x => x.deload)) {
        for (const o of ostrine(d)) {
          const rad = o.session.reps * o.session.repM / 1000;
          assert.ok(rad <= 2, `${ime} N${d.w}: ${rad} km rada u deload nedelji`);
          assert.ok(o.session.restSec >= 90,
            `${ime} N${d.w}: pauza ${o.session.restSec} s — nije pun oporavak`);
        }
      }
    }
  });

  test('deload i dalje NOSI MANJE od nedelje pre sebe', () => {
    /* Najvažnija invarijanta cele izmene: dodata sesija ne sme da naduva
       nedelju. `allocEasyLR` deli ostatak posle kvalitetnih sesija, pa bi
       greška ovde bila tiha — nedelja bi ostala označena kao deload a ne bi to
       više bila. */
    for (const [ime, distM, ned, km] of DISTANCE) {
      const w = plan(distM, ned, km);
      for (let i = 1; i < w.length; i++) {
        if (!w[i].deload) continue;
        assert.ok(kmNedelje(w[i]) < kmNedelje(w[i - 1]),
          `${ime} N${w[i].w}: deload ${kmNedelje(w[i]).toFixed(1)} km ≥ prethodna ${kmNedelje(w[i - 1]).toFixed(1)} km`);
      }
    }
  });

  test('deload ostaje u pojasu rasterećenja, ne postaje nedelja odmora', () => {
    /* OVO JE UHVAĆENO TEK MERENJEM, ne testom — i zato sada postoji.
       Prva verzija izmene je oštrinu izuzela iz mehanizma koji produžuje
       zagrevanje da nedelja stigne do cilja. Delovalo je ispravno („4×200 m ne
       treba veliko zagrevanje"), a posledica je bila tiha: q1 dan je od punog
       laganog trčanja postao mala sesija, ostatak nije imao gde jer LR i lagani
       dani imaju plafone, pa je deload padao i do 46 % prethodne nedelje —
       dakle nedelja odmora, a niko to nije odlučio.
       Mereno na 6720 deload nedelja: pre izmene prosek 73.9 %, sa greškom
       70.9 % i 489 nedelja ispod 60 %, posle ispravke 74.0 % i svega 4.

       MATRICA NIJE PROIZVOLJNA. Prva verzija OVE zamke merila je samo srednje i
       visoke obime sa 5 dana i NIJE MOGLA DA PADNE — namerno vraćen kvar je
       prošao kroz nju netaknut. Manjak nastaje tamo gde nedelja nema odakle da
       nadoknadi: malo dana i nizak obim. Zato mreža ide kroz 3 dana i kroz
       12–22 km, gde propust stvarno bije. */
    for (const [ime, distM, ned] of DISTANCE) {
      for (const dana of [3, 4, 5]) {
        for (const km of [12, 22, 45, 70]) {
          const w = plan(distM, ned, km, { runDays: dana });
          for (let i = 1; i < w.length; i++) {
            if (!w[i].deload) continue;
            const udeo = kmNedelje(w[i]) / kmNedelje(w[i - 1]);
            const gde = `${ime} ${dana}d ${km}km N${w[i].w}`;
            assert.ok(udeo >= 0.58,
              `${gde}: deload je ${(udeo * 100).toFixed(0)} % prethodne — to je odmor, ne rasterećenje`);
            assert.ok(udeo <= 0.92,
              `${gde}: deload je ${(udeo * 100).toFixed(0)} % prethodne — nije rasterećenje`);
          }
        }
      }
    }
  });

  test('oštrina se ne pojavljuje u BAZNOJ fazi', () => {
    /* Baza je aerobna po definiciji; deload unutar nje nema šta da rasterećuje
       od kvaliteta koji ne postoji. Početnik bez skorašnjeg treninga dobija
       najdužu bazu, pa je to najstroži slučaj. */
    const w = plan(5000, 20, 25, { trainedRecently: false });
    const bazne = w.filter(x => x.days.every(d => d.rest || d.tag === 'lako' || d.tag === 'lr' || d.tag === 'rw' || d.tag === 'snaga'));
    assert.ok(bazne.length > 0, 'nema baznih nedelja — proveri postavku');
    for (const b of bazne) assert.equal(ostrine(b).length, 0, `N${b.w}: oštrina u baznoj fazi`);
  });
});

describe('Nedelja kaže čemu služi', () => {

  test('nijedna nedelja nije bez oznake', () => {
    /* Ovo je bio ceo nalaz: `focus` je za generisan plan bio prazan string. */
    for (const [ime, distM, ned, km] of DISTANCE) {
      for (const w of plan(distM, ned, km)) {
        assert.match(String(w.focus || ''), /\S/, `${ime} N${w.w} nema oznaku svrhe`);
      }
    }
  });

  test('oznaka imenuje ono što u nedelji STVARNO stoji', () => {
    /* Gradi se iz sesija, ne iz faze — inače bi bila druga kopija onoga što
       `weekPhase` već piše pored, i razišla bi se prvom izmenom generatora. */
    const sve = plan(5000, 16, 45);
    for (const w of sve) {
      /* Trkačka nedelja nosi „TRKA" i to je cela poruka — sesija aktivacije uz
         nju se namerno ne nabraja. */
      if (w.deload || w.w === sve.length || !kvaliteti(w).length) continue;
      for (const d of kvaliteti(w)) {
        assert.ok(String(w.focus).includes(d.session.kind),
          `N${w.w}: oznaka „${w.focus}" ne pominje sesiju „${d.session.kind}"`);
      }
    }
  });

  test('deload ostaje prepoznatljiv SVUDA gde se čita', () => {
    /* `weekPhase` je nedelju rasterećenja prepoznavao po tome što je `focus`
       DOSLOVNO jednak 'DELOAD'. Čim je focus dobio pun tekst, ta jednakost je
       pala i cela nedelja bi se prikazala kao VRHUNAC — a `adaptGeneratedPlan`
       nije prenosio ni `deload` zastavicu, pa rezerve nije bilo.
       Dnevni izveštaj čita istu stvar preko `/DELOAD/i`. */
    const g = a.call('generatePlan', {
      startDate: '2026-08-17', raceDate: datum(16), raceDistM: 5000,
      pb: PB[5000], weeklyKm: 45, runDays: 5, quality: 2, intensity: 'std', trainedRecently: true
    });
    const adapt = a.call('adaptGeneratedPlan', g);
    assert.ok(adapt && adapt.weeks && adapt.weeks.length, 'plan se nije adaptirao');
    const deloadi = adapt.weeks.filter(w => /^DELOAD/i.test(String(w.focus || '')));
    assert.ok(deloadi.length > 0, 'nijedna nedelja se ne predstavlja kao deload');
    for (const w of deloadi) {
      assert.equal(w.deload, true, `N${w.w}: zastavica deload se ne prenosi kroz adaptaciju`);
      assert.equal(a.call('weekPhase', w, adapt.weeks.length), 'DELOAD',
        `N${w.w}: faza je „${a.call('weekPhase', w, adapt.weeks.length)}" umesto DELOAD`);
    }
  });

  test('ručno pisan plan i dalje radi — njegov tekst je drugačiji', () => {
    /* Vlasnikov plan nosi „DELOAD (intenzitetski) — …". Provera po jednakosti
       bi promašila i njega; zato je prefiks, ne jednakost. */
    assert.equal(a.call('weekPhase', { w: 7, focus: 'DELOAD (intenzitetski) — bez kvaliteta i pliometrije, cilj je oporavak' }, 14), 'DELOAD');
    assert.equal(a.call('weekPhase', { w: 7, deload: true, focus: '' }, 14), 'DELOAD');
    assert.notEqual(a.call('weekPhase', { w: 7, focus: 'Int + Tempo' }, 14), 'DELOAD');
  });

  test('trkačka nedelja i taper nose svoje ime', () => {
    const w = plan(5000, 16, 45);
    assert.match(String(w[w.length - 1].focus), /TRKA/, 'poslednja nedelja se ne predstavlja kao trka');
    assert.match(String(w[w.length - 2].focus), /Taper/i, 'taper se ne predstavlja kao taper');
  });
});

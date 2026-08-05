/* generatePlan — invarijante, ne fiksni brojevi.

   Namerno se NE tvrdi „N3 mora imati 24.4 km": takav test puca na svaku
   legitimnu izmenu kalibracije i uči čoveka da ga briše. Umesto toga se
   proverava ono što MORA da važi u svakom planu, jer je trenerski pogrešno
   ako ne važi — i to su tačno pravila koja komentari u kodu opisuju kao
   ranije polomljena (dugo trčanje kraće od laganog dana, taper viši od
   vrhunca, deload koji ne spušta, obrnut rast obima). */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { loadApp } from './harness.mjs';

const app = loadApp();
const gen = inp => app.call('generatePlan', inp);

const DIST = { '5K': 5000, '10K': 10000, 'HM': 21097.5, 'Maraton': 42195 };

/* datum trke N nedelja od danas, uvek nedeljom */
function raceDateIn(weeks) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + weeks * 7);
  return d.toISOString().slice(0, 10);
}
const today = () => new Date().toISOString().slice(0, 10);

function baseInput(over = {}) {
  return {
    startDate: today(),
    raceDate: raceDateIn(16),
    raceDistM: 5000,
    pb: { distM: 5000, sec: 1237 },
    weeklyKm: 40,
    runDays: 4,
    quality: 2,
    intensity: 'std',
    trainedRecently: true,
    ...over
  };
}

const weekKm = w => w.days.reduce((s, d) => s + (d.km || 0), 0);
/* obim BEZ same trke — trkačka nedelja inače uvek "premaši vrhunac" na
   maratonu (42 km je trka, ne trening) */
const weekTrainingKm = w => w.days.reduce((s, d) => s + (d.tag === 'trka' ? 0 : (d.km || 0)), 0);
const runDaysOf = w => w.days.filter(d => !d.rest && d.tag !== 'snaga');
/* Nizovi nastali unutar vm konteksta imaju DRUGI Array.prototype od host
   realma, pa ih deepStrictEqual odbija i kad je sadržaj identičan.
   Poređenje ide preko običnih host nizova. */
const plain = a => Array.from(a);

/* matrica: 4 distance × nekoliko realnih profila trkača */
const SCENARIJI = [];
for (const [ime, distM] of Object.entries(DIST)) {
  const minW = { 5000: 6, 10000: 8, 21097.5: 10, 42195: 12 }[distM];
  for (const runDays of [3, 4, 5, 6]) {
    for (const weeklyKm of [12, 30, 55]) {
      for (const trainedRecently of [true, false]) {
        SCENARIJI.push({
          ime: `${ime} · ${runDays}d · ${weeklyKm}km · ${trainedRecently ? 'trenirao' : 'početnik'}`,
          inp: baseInput({
            raceDistM: distM,
            raceDate: raceDateIn(Math.max(minW + 4, 18)),
            weeklyKm, runDays, trainedRecently,
            pb: { distM: 5000, sec: weeklyKm < 20 ? 1600 : 1237 }
          })
        });
      }
    }
  }
}

describe('generatePlan — osnovna ispravnost', () => {
  test('svi scenariji se generišu bez greške i bez NaN', () => {
    for (const s of SCENARIJI) {
      const p = gen(s.inp);
      assert.ok(!p.error, `${s.ime}: ${p.error}`);
      assert.ok(Array.isArray(p.weeks) && p.weeks.length > 0, `${s.ime}: nema nedelja`);
      for (const w of p.weeks) {
        for (const d of w.days) {
          assert.ok(d.km == null || Number.isFinite(d.km), `${s.ime} N${w.w}: km nije broj (${d.km})`);
          assert.ok(!/NaN|undefined|Infinity/.test(String(d.desc || '')),
            `${s.ime} N${w.w} dow${d.dow}: opis sadrži NaN/undefined — "${d.desc}"`);
        }
      }
    }
  });

  test('nijedan opis ne pokazuje neurednu decimalu', () => {
    /* PUCALO: taper sesije skaliraju zagrevanje i smirivanje (×0,75 / ×0,8), a
       rezultat nije išao kroz r1() — pa je 1,5 × 0,8 curilo u opis kao
       „1.2000000000000002 km hlađenje". Binarni zapis decimala; pogađalo je sve
       četiri distance u poslednjoj nedelji pred trku, dakle baš u planu koji
       čovek najpažljivije čita. Sve kilometraže se prikazuju na jednu decimalu,
       pa je više od jedne u opisu uvek greška, ne stil. */
    for (const s of SCENARIJI) {
      const p = gen(s.inp);
      p.weeks.forEach(w => w.days.forEach(d => {
        const loše = (d.desc || '').match(/\d+\.\d\d+/);
        assert.ok(!loše, `${s.ime} N${w.w} d${d.dow}: „${loše && loše[0]}" u opisu — ${d.desc}`);
      }));
    }
  });

  test('odbija degenerisan ulaz čistom greškom (ne NaN-om)', () => {
    assert.ok(gen(baseInput({ pb: { distM: 5000, sec: 0 } })).error);
    assert.ok(gen(baseInput({ pb: { distM: 0, sec: 1200 } })).error);
    assert.ok(gen(baseInput({ weeklyKm: 0 })).error);
    assert.ok(gen(baseInput({ raceDistM: 1234 })).error, 'nepodržana distanca mora dati grešku');
    assert.ok(gen(baseInput({ raceDate: raceDateIn(2) })).error, 'prekratak rok mora dati grešku');
    assert.ok(gen(baseInput({ raceDate: raceDateIn(200) })).error, 'predug rok mora dati grešku');
  });

  test('svaka nedelja ima tačno 7 dana (osim prve, koja se seče datumom, i trkačke)', () => {
    for (const s of SCENARIJI.slice(0, 24)) {
      const p = gen(s.inp);
      p.weeks.forEach((w, i) => {
        const zadnja = i === p.weeks.length - 1;
        if (i === 0 || zadnja) return;
        assert.equal(w.days.length, 7, `${s.ime} N${w.w} ima ${w.days.length} dana`);
      });
    }
  });

  test('dow je uvek 1–7 i jedinstven unutar nedelje', () => {
    for (const s of SCENARIJI.slice(0, 24)) {
      const p = gen(s.inp);
      for (const w of p.weeks) {
        const dows = plain(w.days.map(d => d.dow));
        assert.equal(new Set(dows).size, dows.length, `${s.ime} N${w.w}: duplirani dow (${dows})`);
        dows.forEach(x => assert.ok(x >= 1 && x <= 7, `${s.ime} N${w.w}: dow ${x}`));
      }
    }
  });
});

describe('generatePlan — trenerske invarijante', () => {
  test('dugo trčanje je NAJDUŽE trčanje svoje nedelje', () => {
    /* Komentar u allocEasyLR: „Invarijanta do kraja: LR MORA ostati najduže
       trčanje nedelje" — bilo je polomljeno na deload nedeljama niskog obima. */
    for (const s of SCENARIJI) {
      const p = gen(s.inp);
      p.weeks.forEach((w, i) => {
        if (i === p.weeks.length - 1) return;           /* trkačka nedelja ima trku */
        const lr = w.days.filter(d => d.tag === 'lr' || d.tag === 'rw');
        if (!lr.length) return;
        const najduziLR = Math.max(...lr.map(d => d.km || 0));
        const ostali = w.days.filter(d => d.tag !== 'lr' && d.tag !== 'rw' && !d.rest);
        for (const d of ostali) {
          assert.ok((d.km || 0) <= najduziLR + 0.06,
            `${s.ime} N${w.w}: ${d.tag} ${d.km} km > LR ${najduziLR} km`);
        }
      });
    }
  });

  test('deload nedelja je manja od nedelje pre nje', () => {
    for (const s of SCENARIJI) {
      const p = gen(s.inp);
      p.weeks.forEach((w, i) => {
        if (!w.deload || i === 0) return;
        assert.ok(weekKm(w) < weekKm(p.weeks[i - 1]) + 0.01,
          `${s.ime} N${w.w} (deload) ${weekKm(w)} km >= N${p.weeks[i - 1].w} ${weekKm(p.weeks[i - 1])} km`);
      });
    }
  });

  test('taper i trkačka nedelja su ispod vrhunca', () => {
    for (const s of SCENARIJI) {
      const p = gen(s.inp);
      if (p.weeks.length < 5) continue;
      const radne = p.weeks.slice(0, -2);
      const vrhunac = Math.max(...radne.map(weekKm));
      const taper = weekKm(p.weeks[p.weeks.length - 2]);
      const trkacka = weekTrainingKm(p.weeks[p.weeks.length - 1]);
      assert.ok(taper < vrhunac, `${s.ime}: taper ${taper} >= vrhunac ${vrhunac}`);
      assert.ok(trkacka < vrhunac, `${s.ime}: trkačka (bez trke) ${trkacka} >= vrhunac ${vrhunac}`);
    }
  });

  test('nedeljni obim nikad ne skoči preko bezbedne granice', () => {
    /* Komentar u izravnavanju rasta: cilj je da isporučeni rast ostane u
       okviru koraka rasta profila (uz margin za diskretnost sesija).

       Poređenje kreće od i=2, ne od i=1: PRVA nedelja je isečena datumom
       početka (ako se plan pravi u utorak, ima 6 dana i samo deo trčanja),
       pa je njen obim manji iz kalendarskih razloga, ne trenerskih. Prelaz
       „isečena N1 → puna N2" izgleda kao skok, a nije — i test je zbog toga
       padao ili prolazio u zavisnosti od dana u nedelji kad se pokrene.
       Preskače se po BROJU DANA, ne po rednom broju nedelje: kad se plan
       napravi u ponedeljak, prva nedelja je puna i poređenje ostaje. */
    for (const s of SCENARIJI) {
      const p = gen(s.inp);
      for (let i = 1; i < p.weeks.length - 2; i++) {
        const prev = p.weeks[i - 1], cur = p.weeks[i];
        if (prev.deload || cur.deload) continue;
        if (prev.days.length < 7) continue;
        const pv = weekKm(prev), cv = weekKm(cur);
        if (pv <= 0) continue;
        const korak = app.call('korakRasta' + ({ 5000: '5K', 10000: '10K', 21097.5: '21K', 42195: '42K' }[s.inp.raceDistM]), pv, s.inp.intensity);
        assert.ok(cv <= pv + korak * 2.2 + 0.5,
          `${s.ime} N${cur.w}: ${pv} -> ${cv} km (korak ${korak.toFixed(1)})`);
      }
    }
  });

  test('broj dana trčanja poštuje izbor korisnika', () => {
    for (const runDays of [2, 3, 4, 5, 6, 7]) {
      const p = gen(baseInput({ runDays, weeklyKm: 45, raceDate: raceDateIn(20) }));
      assert.ok(!p.error, p.error);
      /* gleda se srednja radna nedelja — prva se seče datumom, poslednje su taper */
      const w = p.weeks[Math.floor(p.weeks.length / 2)];
      assert.equal(runDaysOf(w).length, runDays,
        `traženo ${runDays}, dobijeno ${runDaysOf(w).length} u N${w.w}`);
    }
  });

  test('izabrani konkretni dani se poštuju TAČNO', () => {
    const runDows = [2, 4, 6, 7];
    const p = gen(baseInput({ runDows, lrDow: 7, weeklyKm: 45, raceDate: raceDateIn(20) }));
    assert.ok(!p.error, p.error);
    const w = p.weeks[Math.floor(p.weeks.length / 2)];
    const stvarni = plain(runDaysOf(w).map(d => d.dow)).sort((a, b) => a - b);
    assert.deepEqual(stvarni, runDows, `dobijeno ${stvarni}`);
  });

  test('dan trke pada TAČNO na zadati datum i nosi tačnu distancu', () => {
    for (const [ime, distM] of Object.entries(DIST)) {
      const minW = { 5000: 6, 10000: 8, 21097.5: 10, 42195: 12 }[distM];
      const p = gen(baseInput({ raceDistM: distM, raceDate: raceDateIn(minW + 6), weeklyKm: 50, runDays: 5 }));
      assert.ok(!p.error, `${ime}: ${p.error}`);
      const zadnja = p.weeks[p.weeks.length - 1];
      const trka = zadnja.days.find(d => d.tag === 'trka');
      assert.ok(trka, `${ime}: nema dana trke`);
      assert.ok(Math.abs(trka.km - distM / 1000) < 0.01, `${ime}: distanca trke ${trka.km}`);
    }
  });

  test('bazna faza postoji samo za početnika i ne sadrži kvalitet', () => {
    const poc = gen(baseInput({ trainedRecently: false, weeklyKm: 15, runDays: 4, raceDate: raceDateIn(24) }));
    assert.ok(!poc.error, poc.error);
    assert.ok(poc.meta.baseWeeks > 0, 'početnik mora dobiti baznu fazu');
    for (let i = 0; i < poc.meta.baseWeeks; i++) {
      const w = poc.weeks[i];
      const kvalitet = w.days.filter(d => d.tag === 'int' || d.tag === 'tempo');
      assert.equal(kvalitet.length, 0, `N${w.w}: bazna faza ima kvalitetnu sesiju`);
    }
    const tren = gen(baseInput({ trainedRecently: true, weeklyKm: 15, runDays: 4, raceDate: raceDateIn(24) }));
    assert.equal(tren.meta.baseWeeks, 0, 'trenirani ne sme dobiti baznu fazu');
  });

  test('PRED redovi i qs ključevi pokazuju na dan koji stvarno postoji', () => {
    /* Uklonjeni dani iz nedelje 1 moraju povući i svoj PRED red i qs ključ. */
    for (const s of SCENARIJI.slice(0, 24)) {
      const p = gen(s.inp);
      const postoji = new Set();
      p.weeks.forEach(w => w.days.forEach(d => postoji.add('n' + w.w + 'd' + d.dow)));
      for (const k of Object.keys(p.qs)) {
        assert.ok(postoji.has(k), `${s.ime}: qs ključ ${k} nema svoj dan`);
      }
      const naziviPoNedelji = {};
      p.weeks.forEach(w => w.days.forEach(d => {
        if (d.session) (naziviPoNedelji[w.w] = naziviPoNedelji[w.w] || []).push('N' + w.w + ' · ' + d.session.kind);
      }));
      for (const r of p.pred) {
        assert.ok((naziviPoNedelji[r.w] || []).includes(r.l),
          `${s.ime}: PRED red "${r.l}" nema odgovarajući dan`);
      }
    }
  });

  test('meta nosi goalSec kad je cilj zadat (inače Progres i AI dobijaju predikciju umesto cilja)', () => {
    const p = gen(baseInput({ goalSec: 1170 }));
    assert.equal(p.meta.goalSec, 1170);
    const bez = gen(baseInput());
    assert.equal(bez.meta.goalSec, null);
  });

  test('nerealan cilj proizvodi upozorenje', () => {
    const p = gen(baseInput({ pb: { distM: 5000, sec: 1500 }, goalSec: 900, raceDate: raceDateIn(8) }));
    assert.ok(!p.error, p.error);
    assert.ok(p.meta.dayWarnings.some(t => /iznad onoga što ovaj plan realno donosi/.test(t)),
      'nedostaje upozorenje o nerealnom cilju');
  });
});

describe('buildDaySlots', () => {
  const slots = (...a) => app.call('buildDaySlots', ...a);

  test('kvalitet je ograničen na 1 kad je 3 ili manje dana trčanja', () => {
    for (const rd of [2, 3]) {
      const s = slots(rd, 2, null, false);
      const q = Object.values(s).filter(r => r === 'q1' || r === 'q2').length;
      assert.equal(q, 1, `runDays ${rd} dao ${q} kvaliteta`);
    }
  });

  test('nikad više od 2 kvaliteta', () => {
    for (let rd = 2; rd <= 7; rd++) {
      const q = Object.values(slots(rd, 2, null, false)).filter(r => r === 'q1' || r === 'q2').length;
      assert.ok(q <= 2, `runDays ${rd} dao ${q}`);
    }
  });

  test('dugo trčanje ide na traženi dan', () => {
    for (let lrDow = 1; lrDow <= 7; lrDow++) {
      assert.equal(slots(5, 2, { lrDow }, false)[lrDow], 'lr', `lrDow ${lrDow}`);
    }
  });

  test('broj dana trčanja odgovara traženom', () => {
    for (let rd = 2; rd <= 7; rd++) {
      const n = Object.values(slots(rd, 2, null, false)).filter(r => r !== 'rest').length;
      assert.equal(n, rd, `traženo ${rd}, dobijeno ${n}`);
    }
  });

  test('srednje-dugo trčanje nikad ne pada uz dugo', () => {
    for (let rd = 5; rd <= 7; rd++) {
      const s = slots(rd, 2, { lrDow: 7 }, true);
      const mlr = Object.keys(s).find(d => s[d] === 'mlr');
      if (!mlr) continue;
      const d = +mlr;
      const susedi = [d === 1 ? 7 : d - 1, d === 7 ? 1 : d + 1];
      assert.ok(!susedi.some(x => s[x] === 'lr'),
        `runDays ${rd}: MLR na ${d} je uz LR`);
    }
  });
});

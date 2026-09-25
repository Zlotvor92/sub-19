/* Računica generatora — nalazi iz audita v274.

   1. Deload je skalirao `km` dana sa oštrinom, ali ne i njenu sesiju, pa su se
      kartica i opis (zagrevanje + deonice + hlađenje) razilazili — do 1.6 km.
   2. Oporavak između ponavljanja računao se kao fiksnih 150 m i kad je pauza
      trčanje od 3 min („2×5000 m (3 min laganog trčanja)" ≈ 0.5 km).
   3. Tempo svake sesije mora biti tempo svoje zone za VDOT te nedelje, ili
      tempo trke za sesije izvedene iz cilja — nezavisna provera, ne otisak. */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { loadApp } from './harness.mjs';

const a = loadApp({ now: '2026-09-25T09:00:00Z' });
const ZONA = { 'Intervali': 'I', 'Piramida': 'I', 'Fartlek': 'I', 'Tempo': 'T', 'Tempo isprekidan': 'T',
  'Progresivno': 'T', 'Repeticije': 'R', 'Oštrina': 'R' };
const IZ_CILJA = new Set(['Tempo trke', 'Trkački ritam', 'Maratonski tempo', 'Progresivno (tempo trke)', 'Kontrolna trka']);

function* planovi() {
  for (const dm of [5000, 10000, 21097.5, 42195])
    for (const km of [15, 35, 60])
      for (const rd of [3, 5])
        for (const nw of [12, 20]) {
          const start = '2026-09-28';
          a.ctx.__m = { startDate: start, raceDate: a.call('addD', start, nw * 7 - 1), raceDistM: dm,
            pb: { distM: 5000, sec: 1320 }, weeklyKm: km, runDays: rd, quality: 2, intensity: 'std',
            trainedRecently: true, goalSec: null };
          const g = JSON.parse(a.evalIn('JSON.stringify(generatePlan(__m))'));
          if (!g.error) yield { g, ime: `${dm} ${km}km ${rd}d ${nw}n` };
        }
}

describe('Računica generatora', () => {
  test('kilometraža svakog dana sa sesijom odgovara sesiji (i opisu)', () => {
    let n = 0;
    for (const { g, ime } of planovi()) for (const w of g.weeks) for (const d of w.days) {
      if (!d.session) continue; n++;
      assert.equal(d.km, a.call('sessKm', d.session), `${ime} N${w.w} ${d.session.kind}: ${d.km} ≠ sesija`);
      /* opis POČINJE opisom sesije; trkačka nedelja dodaje „— aktivacija".
         Kontrolna trka ima sopstveni, duži opis (pravila za dan) — za nju se
         proverava da nosi iste km zagrevanja i hlađenja. */
      if (d.session.kind === 'Kontrolna trka')
        assert.ok(d.desc.includes(d.session.wuKm + ' km zagrevanje') && d.desc.includes(d.session.cdKm + ' km hlađenje'),
          `${ime} N${w.w}: opis kontrolne trke ne odgovara sesiji`);
      else
        assert.ok(d.desc.startsWith(a.call('sessDesc', d.session)), `${ime} N${w.w}: opis ne odgovara sesiji`);
    }
    assert.ok(n > 500, `provereno samo ${n} sesija`);
  });

  test('tempo svake sesije je tempo njene zone za VDOT te nedelje', () => {
    let n = 0;
    for (const { g, ime } of planovi()) {
      const W = g.weeks.length, m = g.meta;
      for (const w of g.weeks) {
        if (w.w === W) continue;   /* trkačka nedelja: aktivacija je namerno na tempu trke */
        const v = a.call('planVdotZaNedelju', m, w.w);
        for (const d of w.days) {
          const s = d.session; if (!s) continue; n++;
          let ocek;
          if (IZ_CILJA.has(s.kind)) ocek = m.racePace;
          else {
            assert.ok(ZONA[s.kind], `nepoznata vrsta sesije: ${s.kind}`);
            ocek = a.call('paceForZone', v, ZONA[s.kind]);
            if (ZONA[s.kind] === 'I' && m.raceDistM === 5000 && W - w.w <= 6) ocek = Math.max(ocek, m.racePace);
          }
          assert.ok(Math.abs(s.paceSec - ocek) <= 1, `${ime} N${w.w} ${s.kind}: ${s.paceSec} umesto ${ocek}`);
        }
      }
    }
    assert.ok(n > 500);
  });

  test('pauza u trčanju se računa iz trajanja, hod ostaje 150 m', () => {
    const dz = a.call('kmPauze', { type: 'int', kind: 'Tempo trke', reps: 2, repM: 5000, paceSec: 280, restSec: 180 });
    assert.ok(Math.abs(dz - 180 / (280 * 1.35)) < 1e-9);
    assert.ok(dz > 0.45 && dz < 0.5, `džog od 3 min posle tempa 4:40 je ${dz} km`);
    assert.equal(a.call('kmPauze', { type: 'int', kind: 'Intervali', reps: 5, repM: 1000, paceSec: 240, restSec: 120 }), 0.6);
    assert.equal(a.call('kmPauze', { type: 'int', kind: 'Tempo isprekidan', reps: 1, repM: 3000, paceSec: 260, restSec: 90 }), 0);
  });
});

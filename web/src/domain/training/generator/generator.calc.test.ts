/* Računica generatora — nalazi iz audita v274.

   1. Deload je skalirao `km` dana sa oštrinom, ali ne i njenu sesiju, pa su se kartica i opis
      (zagrevanje + deonice + hlađenje) razilazili — do 1.6 km.
   2. Oporavak između ponavljanja računao se kao fiksnih 150 m i kad je pauza trčanje od 3 min.
   3. Tempo svake sesije mora biti tempo svoje zone za VDOT te nedelje, ili tempo trke za sesije
      izvedene iz cilja — nezavisna provera, ne otisak.

   parity: test/generator-racunica.test.mjs — svih 3 testa. */

import { describe, expect, it } from 'vitest';
import { addDays, parseIsoDate, type IsoDate } from '../../date';
import { planVdotForWeek } from '../prediction';
import { kmBetweenReps, sessDesc, sessKm } from '../sessions/calc';
import type { IntervalSession, TrainingPlan } from '../types';
import { paceForZone } from '../vdot/paceForZone';
import { generatePlan } from './generatePlan';

const ZONE: Record<string, 'I' | 'T' | 'R'> = {
  Intervali: 'I',
  Piramida: 'I',
  Fartlek: 'I',
  Tempo: 'T',
  'Tempo isprekidan': 'T',
  Progresivno: 'T',
  Repeticije: 'R',
  Oštrina: 'R'
};
const FROM_GOAL = new Set([
  'Tempo trke',
  'Trkački ritam',
  'Maratonski tempo',
  'Progresivno (tempo trke)',
  'Kontrolna trka'
]);

function* plans(): Generator<{ g: TrainingPlan; name: string }> {
  const start = parseIsoDate('2026-09-28') as IsoDate;
  for (const dm of [5000, 10000, 21097.5, 42195])
    for (const km of [15, 35, 60])
      for (const rd of [3, 5])
        for (const nw of [12, 20]) {
          const g = generatePlan({
            startDate: start,
            raceDate: addDays(start, nw * 7 - 1),
            raceDistM: dm,
            pb: { distM: 5000, sec: 1320 },
            weeklyKm: km,
            runDays: rd,
            quality: 2,
            intensity: 'std',
            trainedRecently: true,
            goalSec: null
          });
          if (!('error' in g)) yield { g, name: `${dm} ${km}km ${rd}d ${nw}n` };
        }
}

describe('Računica generatora', () => {
  it('kilometraža svakog dana sa sesijom odgovara sesiji (i opisu)', () => {
    let n = 0;
    for (const { g, name } of plans())
      for (const w of g.weeks)
        for (const d of w.days) {
          if (!d.session) continue;
          n++;
          expect(d.km, `${name} N${w.w} ${d.session.kind}`).toBe(sessKm(d.session));
          /* opis POČINJE opisom sesije; trkačka nedelja dodaje „— aktivacija". Kontrolna trka ima
             sopstveni, duži opis — za nju se proverava da nosi iste km zagrevanja i hlađenja. */
          if (d.session.kind === 'Kontrolna trka') {
            expect(d.desc).toContain(`${d.session.wuKm} km zagrevanje`);
            expect(d.desc).toContain(`${d.session.cdKm} km hlađenje`);
          } else {
            expect(
              d.desc.startsWith(sessDesc(d.session)),
              `${name} N${w.w}: opis ne odgovara sesiji`
            ).toBe(true);
          }
        }
    expect(n).toBeGreaterThan(500);
  });

  it('tempo svake sesije je tempo njene zone za VDOT te nedelje', () => {
    let n = 0;
    for (const { g, name } of plans()) {
      const total = g.weeks.length;
      const m = g.meta;
      for (const w of g.weeks) {
        if (w.w === total) continue; // trkačka nedelja: aktivacija je namerno na tempu trke
        const v = planVdotForWeek(m, w.w) as number;
        for (const d of w.days) {
          const s = d.session;
          if (!s) continue;
          n++;
          let expected: number;
          if (FROM_GOAL.has(s.kind)) {
            expected = m.racePace;
          } else {
            const zone = ZONE[s.kind];
            expect(zone, `nepoznata vrsta sesije: ${s.kind}`).toBeDefined();
            expected = paceForZone(v, zone as 'I' | 'T' | 'R');
          }
          expect(
            Math.abs(s.paceSec - expected),
            `${name} N${w.w} ${s.kind}: ${s.paceSec} umesto ${expected}`
          ).toBeLessThanOrEqual(1);
        }
      }
    }
    expect(n).toBeGreaterThan(500);
  });

  it('pauza u trčanju se računa iz trajanja, hod ostaje 150 m', () => {
    const mk = (over: Partial<IntervalSession>): IntervalSession => ({
      type: 'int',
      kind: 'Intervali',
      wuKm: 2,
      cdKm: 1.5,
      reps: 1,
      repM: 1000,
      paceSec: 240,
      restSec: 120,
      overrides: {},
      ...over
    });
    const jog = kmBetweenReps(
      mk({ kind: 'Tempo trke', reps: 2, repM: 5000, paceSec: 280, restSec: 180 })
    );
    expect(Math.abs(jog - 180 / (280 * 1.35))).toBeLessThan(1e-9);
    expect(jog > 0.45 && jog < 0.5, `džog od 3 min posle tempa 4:40 je ${jog} km`).toBe(true);
    expect(
      kmBetweenReps(mk({ kind: 'Intervali', reps: 5, repM: 1000, paceSec: 240, restSec: 120 }))
    ).toBe(0.6);
    expect(
      kmBetweenReps(
        mk({ kind: 'Tempo isprekidan', reps: 1, repM: 3000, paceSec: 260, restSec: 90 })
      )
    ).toBe(0);
  });
});

/* P8 (10k-v2.13.0, nalazi slepe ocene P7): G1 rast obima do kraja razvoja (D39), G2 najniži nivo lestvice uvek staje
   (D40), G3 tekst za trkača (D41), upozorenje kratkih laganih dana (D42). Nezavisne provere (brojevi iz odluke
   organizatora i profila P7, ne iz policy.ts); svaki test pada na 10k-v2.12.0. */

import { describe, expect, it } from 'vitest';
import { userText } from './app/format.ts';
import { generateTenKV2 } from './generate.ts';
import { pacesFromVdot } from './paces.ts';
import { capM } from './quality.ts';
import { beginnerGridInputs, feelGridInputs, grid02Inputs } from './testInputs.ts';
import type { PlanWeek, TenKV2Plan } from './types.ts';
import { userPlanMessages, userWeekNotes } from './userNotes.ts';

type WD = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
const DAYS: Record<3 | 4 | 5 | 6, WD[]> = {
  3: ['tue', 'thu', 'sun'],
  4: ['tue', 'thu', 'sat', 'sun'],
  5: ['mon', 'tue', 'thu', 'sat', 'sun'],
  6: ['mon', 'tue', 'wed', 'thu', 'sat', 'sun']
};
/** Profili P7 (P7/make-inputs.ts, start 2.11.2026). */
const profile = (
  days: 3 | 4 | 5 | 6,
  km: number,
  raceDate: string,
  o: { tenK?: number; easy?: number; beginner?: boolean }
): Record<string, unknown> => ({
  startDate: '2026-11-02',
  raceDate,
  runDays: DAYS[days],
  currentWeeklyKm: km,
  goalTimeSec: null,
  longRunDay: 'sun',
  recentResult:
    o.tenK !== undefined ? { distanceM: 10000, timeSec: o.tenK, date: '2026-10-19' } : null,
  ...(o.easy !== undefined ? { easyPaceSecPerKm: o.easy } : {}),
  ...(o.beginner ? { experience: 'beginner' } : {})
});
const P = {
  p03: profile(3, 20, '2027-01-24', { tenK: 3534 }),
  p06: profile(5, 30, '2026-12-27', { tenK: 2184 }),
  p08: profile(3, 40, '2027-03-07', { tenK: 2713 }),
  p10: profile(3, 20, '2027-03-07', { easy: 450 }),
  p11: profile(3, 15, '2027-03-07', { tenK: 3362, beginner: true }),
  p12: profile(4, 35, '2027-01-24', { easy: 420, beginner: true })
};
const gen = (input: Record<string, unknown>): TenKV2Plan => {
  const r = generateTenKV2(input);
  if (!r.ok) throw new Error(JSON.stringify(r.reasons));
  return r.plan;
};
const quality = (w: PlanWeek) =>
  w.days.filter((d) => d.workout.kind === 'quality' || d.role === 'test' || d.role === 'sharpener');
const zoneKm = (w: PlanWeek, z: string) =>
  w.days
    .flatMap((d) => d.workout.segments)
    .filter((s) => s.zone === z && (s.kind === 'rep' || s.kind === 'continuous'))
    .reduce((a, s) => a + s.km, 0);
const every = <T,>(xs: T[], n: number): T[] => xs.filter((_, i) => i % n === 0);
const SAMPLE = [
  ...([3, 4, 5, 6] as const).flatMap((d) => every(grid02Inputs(d), 40)),
  ...([3, 4, 5, 6] as const).flatMap((d) => every(feelGridInputs(d), 40)),
  ...([3, 4] as const).flatMap((d) => every(beginnerGridInputs(d), 20))
].map((c) => c.input);

describe('P8 G1 (D39): obim raste do kraja razvoja', () => {
  it('p11 (početnik 15 km, 3 dana, 18 ned): vrh 19,5 km tek u poslednjoj ne-rasteretnoj nedelji razvoja (ranije ned 7)', () => {
    const p = gen(P.p11);
    const dev = p.weeks.filter((w) => w.phase === 'development' && !w.deload).map((w) => w.index);
    const first = p.weeks.find((w) => w.targetKm >= 19.5)!.index;
    expect(first).toBe(Math.max(...dev));
    // Ne-rasteretne nedelje baze i razvoja ne opadaju; rast je ≥ 3 % ili ga nema (G1b, D45 — nema „rasta" od 0,1 km).
    const nd = p.weeks.filter((w) => (w.phase === 'base' || w.phase === 'development') && !w.deload);
    for (let i = 1; i < nd.length; i++) {
      const g = nd[i]!.targetKm - nd[i - 1]!.targetKm;
      expect(g).toBeGreaterThanOrEqual(0);
      if (g > 0) expect(g).toBeGreaterThanOrEqual(0.03 * nd[i - 1]!.targetKm - 0.05);
    }
  });
  it('mreža: nijedna ne-rasteretna nedelja baze/razvoja ne raste više nego što preostali rast do vrha traži', () => {
    let checked = 0;
    for (const input of SAMPLE) {
      const p = gen(input);
      const nd = p.weeks.filter((w) => (w.phase === 'base' || w.phase === 'development') && !w.deload);
      for (let i = 1; i < nd.length; i++) {
        const left = nd.length - i;
        const last = Math.round(nd[i - 1]!.targetKm * 10);
        const cap = Math.round(p.peakCapKm * 10);
        if (last >= cap || nd[i]!.fitted !== null) continue;
        const step = Math.round(nd[i]!.nominalKm * 10) - last;
        expect(step).toBeLessThanOrEqual(Math.max(1, Math.round((cap - last) / left)));
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(200);
  });
});

describe('P8 G2 (D40): najniži nivo lestvice uvek staje', () => {
  it('plafon zone nije ispod prvog nivoa lestvice (RP 2 × 1200 m, T 2,0 km / početnik 1,5 km)', () => {
    const v45 = pacesFromVdot(45);
    expect(capM('RP', 15, true, v45)).toBe(2400);
    expect(capM('RP', 20, false, v45)).toBe(2400);
    // S3 (D49): plafon T početnika = max(udeo × cilj; 3,0 km) — iznad prvog nivoa (1,5 km).
    expect(capM('T', 15, true, v45)).toBe(3000);
    expect(capM('T', 15, false, v45)).toBe(2000);
    // G4 (D43): RP ≤ 30 min rada — 15 % × 60 km = 9000 m, ali 30 min RP tempom VDOT 45 je manje.
    expect(capM('RP', 60, false, v45)).toBe(Math.floor((1800 / v45.RP) * 1000 + 1e-6));
    expect(capM('RP', 60, false, v45)).toBeLessThan(9000);
  });
  it('p11: RP u specifičnoj fazi, taper i trkačka nedelja sa trkačkim tempom', () => {
    const p = gen(P.p11);
    expect(p.weeks.filter((w) => w.phase === 'specific' && zoneKm(w, 'RP') > 0).length).toBeGreaterThan(0);
    for (const w of p.weeks.filter((x) => x.phase === 'taper' || x.phase === 'race'))
      expect(zoneKm(w, 'RP')).toBeGreaterThan(0);
  });
  it('mreža (redovan, 3 dana, početnik): taper i rasterećenje uvek imaju kvalitet, svaki plan ima RP', () => {
    for (const input of [...SAMPLE, P.p03, P.p10, P.p11, P.p12]) {
      const p = gen(input);
      expect(p.weeks.filter((w) => w.phase !== 'race' && zoneKm(w, 'RP') > 0).length).toBeGreaterThan(0);
      for (const w of p.weeks)
        if (w.phase === 'taper' || (w.deload && w.phase !== 'race'))
          expect(quality(w).length).toBeGreaterThan(0);
    }
  });
});

const BAD =
  /nije izvodljiv|odstupanje|cilj po pravilu|\[pravilo\]|\b[DA]\d{1,2}\b|\bT1\b|pouk|ne može da se sastavi|ne nose ovaj obim|plafon|najviše \d+ % nedelje u tom tempu|0,8 × dugog|≤ RP doza/iu;

describe('P8 G3 (D41): tekst za trkača', () => {
  const plans = [...every(SAMPLE, 2), ...Object.values(P)].map(gen);
  it('bez internih oznaka i reči sastavljanja; svako upozorenje plana najviše jednom', () => {
    for (const p of plans) {
      const msgs = userPlanMessages(p).map(userText);
      for (const t of [...msgs, ...p.weeks.flatMap((w) => userWeekNotes(w.notes).map(userText))])
        expect(t, t).not.toMatch(BAD);
      expect(new Set(msgs).size).toBe(msgs.length);
      expect(msgs.filter((t) => /redovnog rasta|Vrh obima/u.test(t)).length).toBeLessThanOrEqual(1);
    }
  });
  it('napomena tvrdi samo ono što brojevi pokazuju (spuštena doza, kraći dugi rasterećenja)', () => {
    let n = 0;
    for (const p of plans)
      for (const w of p.weeks)
        for (const t of userWeekNotes(w.notes)) {
          const d = /kvalitetni trening: (T|I|RP|R) ([\d,]+) km \(prošli put ([\d,]+) km\)/u.exec(t);
          if (d) {
            const km = Number(d[2]!.replace(',', '.'));
            expect(w.days.some((x) => x.workout.dose && x.workout.dose.doseM === Math.round(km * 1000))).toBe(true);
            expect(Number(d[3]!.replace(',', '.'))).toBeGreaterThan(km);
            n++;
          }
          const l = /dugi ([\d,]+) km — kraći nego obično/u.exec(t);
          if (l) {
            expect(w.days.find((x) => x.role === 'long')!.workout.km).toBe(Number(l[1]!.replace(',', '.')));
            for (const e of w.days.filter((x) => x.role === 'easy')) expect(e.workout.km).toBeGreaterThanOrEqual(3);
            n++;
          }
        }
    expect(n).toBeGreaterThan(0);
  });
  it('napomena testa završava šta trkač radi sa rezultatom', () => {
    for (const p of plans)
      for (const w of p.weeks.filter((x) => x.days.some((d) => d.role === 'test')))
        expect(userWeekNotes(w.notes).find((t) => /test 5 km/iu.test(t))).toMatch(/unesi rezultat[^.]*sledeće nedelje\.$/iu);
  });
  it('p08 (3 dana, 40 km, 18 ned): bez napomene „ne može da se sastavi" u nedeljama, jedna poruka o vrhu obima', () => {
    const p = gen(P.p08);
    expect(p.weeks.some((w) => w.notes.some((x) => x.startsWith('Nedelja ne može')))).toBe(true);
    expect(p.weeks.flatMap((w) => userWeekNotes(w.notes)).some((x) => x.includes('ne može'))).toBe(false);
    expect(userPlanMessages(p).filter((x) => x.startsWith('Vrh obima')).length).toBe(1);
  });
});

const workMin = (d: PlanWeek['days'][number], z: string): number =>
  d.workout.segments
    .filter((x) => x.zone === z && (x.kind === 'rep' || x.kind === 'continuous'))
    .reduce((a, x) => a + x.sec, 0) / 60;

describe('P8 dopuna: G4 minuti rada, G5 oštrenje, G1a vrh, G6, G7 test, G8 dugi početnika', () => {
  const plans = [...SAMPLE, ...Object.values(P)].map(gen);
  it('G4 (D43): T ≤ 30 min (≥ 80 km: 40), I ≤ 20 / 24 min, RP ≤ 30 min po treningu; G5 (D44): oštrenje 2 jednake deonice ≤ 12 min', () => {
    for (const p of plans)
      for (const w of p.weeks)
        for (const d of w.days) {
          if (d.role === 'sharpener') {
            const st = d.workout.dose!.structure;
            expect(st.form === 'reps' && st.reps).toBe(2);
            expect(workMin(d, 'RP')).toBeLessThanOrEqual(12 + 1e-6);
            continue;
          }
          if (d.workout.kind !== 'quality') continue;
          expect(workMin(d, 'T')).toBeLessThanOrEqual((w.targetKm >= 80 ? 40 : 30) + 0.05);
          expect(workMin(d, 'I')).toBeLessThanOrEqual((p.paces.vdot < 40 ? 20 : 24) + 0.05);
          expect(workMin(d, 'RP')).toBeLessThanOrEqual(30 + 0.05);
        }
  });
  it('G1a (D45): vrh ≤ start × 1,30 / 1,35 / 1,40 po dužini pripreme i ≤ satni plafon (6 / 7 / 8 h), nikad ispod starta', () => {
    for (const p of plans) {
      const n = p.weeks.length;
      const f = n <= 12 ? 1.3 : n <= 15 ? 1.35 : 1.4;
      const h = p.paces.vdot < 40 ? 6 : p.paces.vdot < 50 ? 7 : 8;
      const mid = (p.paces.E.fast + p.paces.E.slow) / 2;
      expect(p.peakCapKm).toBeLessThanOrEqual(Math.max(p.startKm, p.startKm * f, 0) + 1e-6);
      expect(p.peakCapKm).toBeLessThanOrEqual(Math.max(p.startKm, (h * 3600) / mid) + 0.05);
      expect(p.peakCapKm).toBeGreaterThanOrEqual(p.startKm);
    }
  });
  it('G6 (D47): lagan ≤ 0,70 × dugi (4+ dana) i ≤ 0,80 (3 dana) u nedeljama izgradnje', () => {
    for (const p of plans)
      for (const w of p.weeks.filter((x) => ['base', 'development', 'specific'].includes(x.phase) && !x.deload && !x.limits)) {
        const long = w.days.find((d) => d.role === 'long')!.workout.km;
        // S9 (STOP, do odluke organizatora): početnik ostaje na 0,80.
        const share = p.input.runDays.length >= 4 && p.input.experience !== 'beginner' ? 0.7 : 0.8;
        for (const e of w.days.filter((d) => d.role === 'easy'))
          expect(e.workout.km).toBeLessThanOrEqual(Math.floor(share * long * 10 + 1e-9) / 10 + 1e-9);
      }
  });
  it('G7 (D46): u nedelji testa test je jedini kvalitet; test ne pre nedelje 4', () => {
    for (const p of plans)
      for (const w of p.weeks.filter((x) => x.days.some((d) => d.role === 'test'))) {
        expect(w.index).toBeGreaterThanOrEqual(4);
        expect(w.days.filter((d) => d.workout.kind === 'quality').length).toBe(0);
      }
  });
  it('G8 (D48): p11 dugi raste preko 8,7 km (do 50 % cilja u 3 poslednje nedelje izgradnje); ispod 10 km — rečenica u planu', () => {
    const p = gen(P.p11);
    const longest = Math.max(...p.weeks.flatMap((w) => w.days.filter((d) => d.role === 'long').map((d) => d.workout.km)));
    expect(longest).toBeGreaterThan(8.7);
    expect(p.notes.some((n) => n.startsWith('Najduži dugi je'))).toBe(longest < 10);
  });
});

describe('P8 D42: kratki lagani dani → preporuka manje dana', () => {
  it('p06 (VDOT 58, 30 km, 5 dana): upozorenje sa preporukom 3–4 dana; 3 dana bez upozorenja', () => {
    const w = gen(P.p06).warnings.filter((v) => v.rule === 'SHORT_EASY');
    expect(w.length).toBe(1);
    expect(w[0]!.message).toContain('preporuka 3–4 dana');
    // 10K (c), P8 dopuna: prvo u planu, sa brojem preporučenih dana.
    expect(userPlanMessages(gen(P.p06))[0]).toMatch(/^Lagani treninzi su kratki.*Sa 3–4 dana/u);
    expect(gen(P.p03).warnings.some((v) => v.rule === 'SHORT_EASY')).toBe(false);
  });
});

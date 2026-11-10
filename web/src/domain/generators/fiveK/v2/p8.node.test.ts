/* P8-5K (5k-v2.15.0): ispravke po slepoj trenerskoj oceni — G1 obim raste do kraja razvoja, G2 prvi nivo lestvice uvek
   staje, G3 tekst za trkača, (a) I 10 %, (b) rasterećenje ≤ 60 % / taper ≤ 70 % poslednje doze zone, dugi rasterećenja
   ≤ 0,8 × poslednji, (c) prvi I posle R faze ≤ 70 % budžeta I, (d) WU/CD trkačkog dana po vrhu obima, (e) početnik
   iznad kapaciteta plana početnika → plan bez oznake početnika. Izveštaj: docs/generators-v2/perfection/reports/
   P8-5K-REPORT.md. */

import { describe, expect, it } from 'vitest';
import { feelFirstLevelOf } from './feel.ts';
import { generateFiveKV2 } from './generate.ts';
import { firstPeakIWeek } from './periodize.ts';
import { FIVE_K_V2_POLICY as P, type Athlete } from './policy.ts';
import { earlyGridInputs } from './testInputs.ts';
import { userWarnings } from './text.ts';
import type { FiveKV2Plan, Paces, PlanWeek, QualityType } from './types.ts';
import { validatePlan } from './validate.ts';
import { devWeeksLeft, peakKm, spreadKm } from './volume.ts';
import { firstIBudget, firstLevelBudget, iMaxShareOf, raceWarmup, why } from './workouts.ts';

const EPS = 1e-6;
const planOf = (input: unknown): FiveKV2Plan => {
  const r = generateFiveKV2(input);
  if (!r.ok || r.plan.planType === 'runWalk') throw new Error(JSON.stringify(r).slice(0, 300));
  return r.plan;
};
const athleteOf = (p: FiveKV2Plan): Athlete => ({
  days: p.input.runDays.length as Athlete['days'],
  beginner: p.experience === 'beginner',
  feel: p.paceMode === 'feel'
});
const isBuild = (w: PlanWeek): boolean =>
  w.phase === 'base' || w.phase === 'peak' || w.phase === 'sharpen';
const zoneWork = (w: PlanWeek, z: 'I' | 'RP' | 'T' | 'R'): number =>
  w.days.filter((d) => d.workout.kind === 'quality').reduce((a, d) => a + d.workout.workKm[z], 0);
/** Uzorak rane mreže generatora (svaki 4.), bez trčanja/hodanja. */
const SAMPLE = earlyGridInputs()
  .filter((_, i) => i % 4 === 0)
  .map((c) => ({ id: c.id, r: generateFiveKV2(c.input) }))
  .filter(
    (x): x is { id: string; r: Extract<typeof x.r, { ok: true }> } =>
      x.r.ok && x.r.plan.planType !== 'runWalk'
  )
  .map((x) => ({ id: x.id, p: x.r.plan as FiveKV2Plan }));

describe('P8-5K: uzorak rane mreže', () => {
  it('uzorak je dovoljno velik i bez grešaka validatora', () => {
    expect(SAMPLE.length).toBeGreaterThan(150);
    for (const { id, p } of SAMPLE)
      expect(
        validatePlan(p)
          .filter((v) => v.severity === 'error')
          .map((v) => v.rule),
        id
      ).toEqual([]);
  });

  it('G1: ne-rasteretna nedelja razvoja ≤ poslednji + (vrh − poslednji) / preostale nedelje razvoja', () => {
    let slowed = 0;
    for (const { id, p } of SAMPLE) {
      const cap = peakKm(p.startKm, p.capacityKm, athleteOf(p), {
        weeks: p.weeks.length,
        p: p.paces
      });
      let last: number | null = null;
      p.weeks.forEach((w, i) => {
        if (!isBuild(w) || w.deload) return;
        if (last !== null && (w.phase === 'base' || w.phase === 'peak')) {
          const lim = spreadKm(last, cap, devWeeksLeft(p.weeks, i));
          // Dopuna G1b: korak < 3 % se ne primenjuje (nedelja drži cilj).
          if (w.targetKm > last)
            expect(w.targetKm - last + 1e-9, `${id} ned ${w.index} korak`).toBeGreaterThanOrEqual(
              Math.min(last * 0.03, cap - last)
            );
          expect(w.targetKm, `${id} ned ${w.index}`).toBeLessThanOrEqual(lim + EPS);
          if (Number.isFinite(lim) && lim < Math.floor(last * 1.08 * 10 + 1e-9) / 10) slowed++;
        }
        last = w.targetKm;
      });
    }
    expect(slowed).toBeGreaterThan(50);
  });

  it('(b) rasterećenje: rad zone ≤ max(0,6 × poslednja doza, prvi nivo); taper ≤ max(0,7 ×, prvi nivo); dugi ≤ 0,8 ×', () => {
    let checked = 0;
    for (const { id, p } of SAMPLE) {
      const last: Partial<Record<'I' | 'RP' | 'T' | 'R', number>> = {};
      let lastLong: number | null = null;
      for (const w of p.weeks) {
        const share = w.deload && isBuild(w) ? 0.6 : w.phase === 'taper' ? 0.7 : null;
        if (share !== null)
          for (const z of ['I', 'RP', 'T', 'R'] as const) {
            const v = zoneWork(w, z);
            if (!v || last[z] === undefined) continue;
            checked++;
            const first = Math.max(
              0,
              ...w.days
                .filter((d) => d.workout.kind === 'quality' && d.workout.workKm[z] > 0)
                .map((d) => {
                  const t = d.workout.qualityType as QualityType;
                  const v = firstLevelBudget(t, p.paces as never, w.phase);
                  return Number.isFinite(v)
                    ? v
                    : feelFirstLevelOf(t, z === 'RP' ? 'I' : z, w.phase, p.paces);
                })
                .filter(Number.isFinite)
            );
            expect(v, `${id} ned ${w.index} ${z}`).toBeLessThanOrEqual(
              Math.max(share * (last[z] ?? 0), first) + 0.05
            );
          }
        if (w.deload && isBuild(w) && lastLong !== null) {
          const L = w.days.find((d) => d.role === 'long')!.workout.km;
          expect(L, `${id} ned ${w.index} dugi`).toBeLessThanOrEqual(
            Math.max(P.easy.minKm, Math.floor(lastLong * 0.8 * 10 + 1e-9) / 10) + EPS
          );
        }
        if (isBuild(w) && !w.deload) {
          for (const z of ['I', 'RP', 'T', 'R'] as const)
            if (zoneWork(w, z) > 0) last[z] = zoneWork(w, z);
          lastLong = w.days.find((d) => d.role === 'long')?.workout.km ?? lastLong;
        }
      }
    }
    expect(checked).toBeGreaterThan(200);
  });

  it('(c) prvi I posle R faze ≤ 70 % budžeta I (ili prvi nivo lestvice)', () => {
    let n = 0;
    for (const { id, p } of SAMPLE) {
      if (p.paceMode !== 'vdot' || p.experience === 'beginner') continue;
      const k = firstPeakIWeek(p.weeks);
      const w = k === null ? undefined : p.weeks[k - 1];
      const q = w?.days.find((d) => d.role === 'q1' && d.workout.qualityType === 'I');
      if (!w || !q) continue;
      n++;
      expect(q.workout.workKm.I, `${id} ned ${w.index}`).toBeLessThanOrEqual(
        Math.max(firstIBudget(w.budgets.I), firstLevelBudget('I', p.paces as never, 'peak')) + EPS
      );
    }
    expect(n).toBeGreaterThan(30);
  });

  it('(d) trkački dan: WU/CD = raceWarmup(vrh, najduži trening); nije najduži dan plana kad se može izbeći', () => {
    for (const { id, p } of SAMPLE) {
      const race = p.weeks.at(-1)!.days.find((d) => d.role === 'race')!;
      const longest = Math.max(
        ...p.weeks.slice(0, -1).flatMap((w) => w.days.map((d) => d.workout.km))
      );
      const b = raceWarmup(p.peakKm, longest);
      const seg = (k: string): number => race.workout.segments.find((s) => s.kind === k)!.km;
      expect([seg('warmup'), seg('cooldown')], id).toEqual([b.warmupKm, b.cooldownKm]);
      const min = P.warmup.raceMin.warmupKm + 5 + P.warmup.raceMin.cooldownKm;
      if (longest > min + EPS) expect(race.workout.km, id).toBeLessThan(longest);
      if (p.peakKm <= 20) expect(b.warmupKm + b.cooldownKm).toBeLessThanOrEqual(2.5);
    }
  });
});

describe('P8-5K: pojedinačna pravila', () => {
  it('(a) budžet I/RP 10 % za svaki cilj', () => {
    for (const km of [12, 39.9, 40, 65]) expect(iMaxShareOf(km)).toBe(0.1);
  });

  it('G2: rasteretni vrhunac malog obima ima I prvog nivoa (ne samo ubrzanja); po osećaju tempo staje u 12 km', () => {
    const p = planOf({
      startDate: '2026-11-02',
      raceDate: '2027-01-03',
      runDays: ['tue', 'thu', 'sun'],
      currentWeeklyKm: 12,
      recentResult: { distanceM: 5000, timeSec: 994, date: '2026-10-19' },
      goalTimeSec: null
    });
    const d = p.weeks.find((w) => w.phase === 'peak' && w.deload)!;
    expect(d.days.some((x) => x.workout.qualityType === 'I')).toBe(true);
    const f = planOf({
      startDate: '2026-11-02',
      raceDate: '2027-02-21',
      runDays: ['tue', 'thu', 'sun'],
      currentWeeklyKm: 12,
      typicalEasyPaceSecPerKm: 300,
      goalTimeSec: null
    });
    expect(
      f.weeks.some(
        (w) => w.phase === 'base' && w.days.some((x) => x.workout.qualityType === 'TEMPO_FEEL')
      )
    ).toBe(true);
  });

  it('(e) početnik iznad kapaciteta plana početnika → plan bez oznake početnika, uz napomenu; u kapacitetu ostaje početnik', () => {
    const base = {
      startDate: '2026-11-02',
      raceDate: '2027-01-10',
      runDays: ['tue', 'thu', 'sat', 'sun'],
      goalTimeSec: null,
      recentResult: null,
      typicalEasyPaceSecPerKm: 420,
      experience: 'beginner',
      canRun30Min: true
    };
    const hi = planOf({ ...base, currentWeeklyKm: 45 });
    expect(hi.experience).toBe('regular');
    expect(hi.startKm).toBeGreaterThan(30); // kapacitet početnika 29,9 km; trkač 4 dana nosi više
    expect(hi.notes.some((n) => n.includes('plan kreće od tvog stvarnog obima'))).toBe(true);
    expect(planOf({ ...base, currentWeeklyKm: 25 }).experience).toBe('beginner');
  });

  it('G3: isto upozorenje jednom po planu (zbirno), tekst bez internih izraza', () => {
    const ws = [
      { rule: 'PLANNED_BELOW_TARGET', message: 'Nedelja ima 50 km umesto 52 km.', week: 3 },
      { rule: 'PLANNED_BELOW_TARGET', message: 'Nedelja ima 49 km umesto 52 km.', week: 5 },
      { rule: 'PLANNED_BELOW_TARGET', message: 'Nedelja ima 48 km umesto 52 km.', week: 6 },
      { rule: 'GOAL_STATUS', message: 'Cilj je ambiciozan.' }
    ];
    expect(userWarnings(ws)).toEqual([
      'Nedelja 3 ima 50 km umesto 52 km. Slično i u nedeljama 5 i 6.',
      'Cilj je ambiciozan.'
    ]);
    for (const { id, p } of SAMPLE.filter((_, i) => i % 3 === 0)) {
      const txt = [...p.notes, ...p.weeks.flatMap((w) => w.notes), ...userWarnings(p.warnings)];
      for (const bad of ['nije izvodljiv', 'odstupanje', 'cilj po pravilu', 'pouka', 'Odluka'])
        expect(
          txt.filter((t) => t.includes(bad)),
          id
        ).toEqual([]);
      expect(new Set(userWarnings(p.warnings)).size).toBe(
        new Set(p.warnings.map((v) => v.rule)).size
      );
    }
  });

  it('G3: „ista količina … (obim ne dozvoljava više)" samo kad veća doza postoji u ponudi; inače „najveća doza"', () => {
    const p = planOf({
      startDate: '2026-11-02',
      raceDate: '2027-01-10',
      runDays: ['mon', 'tue', 'thu', 'sat', 'sun'],
      currentWeeklyKm: 65,
      recentResult: { distanceM: 5000, timeSec: 1022, date: '2026-10-19' },
      goalTimeSec: null
    });
    // Dopuna G4 (plafon minuta) menja koje nedelje drže dozu; tvrdnja mora da važi kad napomena postoji.
    const notes = p.weeks.flatMap((w) => w.notes.filter((n) => n.includes('ista količina')));
    for (const n of notes) expect(n).toContain('to je najveća doza ovog treninga u planu');
    // 5k-v2.15.1: posle G4 (plafon minuta) kraj ponude se u mreži ne dostiže (0 napomena u ranoj mreži) — razlog se
    // proverava neposredno: budžet drži dozu → „obim …", kraj ponude → „najveća doza …".
    expect(why(true)).toBe('obim nedelje ne dozvoljava više');
    expect(why(false)).toBe('to je najveća doza ovog treninga u planu');
  });
});

/* 5k-v2.15.1 (P8 dopuna i završetak): nezavisne invarijante mreže — brojevi pravila su ovde ispisani (ne čitaju se iz
   funkcija konstruktora), da bi izmena pravila u kodu obarala test. */
describe('P8-5K dopuna: nezavisne invarijante mreže (G1a, G1b, G6, G7, korak I)', () => {
  const dev = (w: PlanWeek): boolean => (w.phase === 'base' || w.phase === 'peak') && !w.deload;

  it('G7: u nedelji kontrolnog testa test je jedini kvalitet i nedelja nije pre 4.', () => {
    let tests = 0;
    for (const { id, p } of SAMPLE)
      for (const w of p.weeks.filter((x) => x.test)) {
        tests++;
        expect(w.index, id).toBeGreaterThanOrEqual(4);
        const q = w.days.filter((d) => d.workout.kind === 'quality');
        expect(
          q.map((d) => d.workout.qualityType),
          `${id} ned ${w.index}`
        ).toEqual(['TEST_3K']);
      }
    expect(tests).toBeGreaterThan(30);
  });

  it('G1a: vrh ≤ start × 1,30 (≤ 12 ned) / 1,35 (13–15) / 1,40 (≥ 16) i ≤ satni plafon 6 / 7 / 8 h (ili start)', () => {
    let hourBound = 0;
    for (const { id, p } of SAMPLE) {
      const n = p.weeks.length;
      const factor = n >= 16 ? 1.4 : n >= 13 ? 1.35 : 1.3;
      const peak = Math.max(...p.weeks.filter(isBuild).map((w) => w.targetKm));
      expect(peak, id).toBeLessThanOrEqual(p.startKm * factor + EPS);
      if (p.paces.vdot === null) continue;
      const hours = p.paces.vdot < 40 ? 6 : p.paces.vdot < 50 ? 7 : 8;
      const hourKm = (hours * 3600) / ((p.paces.E.fast + p.paces.E.slow) / 2);
      expect(peak, id).toBeLessThanOrEqual(Math.max(hourKm, p.startKm) + EPS);
      if (peak + 0.1 > hourKm) hourBound++;
    }
    expect(hourBound).toBeGreaterThan(0);
  });

  it('G1b: korak rasta razvoja manji od 3 % se ne primenjuje (osim koraka koji dostiže vrh)', () => {
    let steps = 0;
    for (const { id, p } of SAMPLE) {
      const ws = p.weeks.filter(dev);
      const peak = Math.max(...p.weeks.filter(isBuild).map((w) => w.targetKm));
      for (let i = 1; i < ws.length; i++) {
        const [a, b] = [ws[i - 1]!.targetKm, ws[i]!.targetKm];
        if (b <= a + EPS || b >= peak - EPS) continue;
        steps++;
        expect(b - a, `${id} ned ${ws[i]!.index}: ${a} → ${b}`).toBeGreaterThanOrEqual(
          a * 0.03 - EPS
        );
      }
    }
    expect(steps).toBeGreaterThan(100);
  });

  it('G6: redovan plan sa 4+ dana — lagan ≤ 0,7 × dugi u nedelji izgradnje (3 dana i početnik 0,8); uvodne nedelje početnika lagan ≤ dugi', () => {
    let weeks = 0;
    let onCap = 0;
    let begOver07 = 0;
    for (const { id, p } of SAMPLE) {
      // 5k-v2.15.2 (dopuna odluke): početnik ostaje na 0,8 za svaki broj dana.
      const beg4 = p.experience === 'beginner' && p.input.runDays.length >= 4;
      const share = p.input.runDays.length >= 4 && !beg4 ? 7 : 8;
      for (const w of p.weeks.filter((x) => isBuild(x) && !x.deload)) {
        const long = w.days.find((d) => d.role === 'long');
        if (!long) continue;
        weeks++;
        const intro =
          p.experience === 'beginner' && w.phase === 'base' && w.index <= P.beginner.introWeeks;
        const cap = intro ? long.workout.km : Math.floor(long.workout.km * share + 1e-9) / 10;
        for (const d of w.days.filter((x) => x.role === 'easy')) {
          expect(d.workout.km, `${id} ned ${w.index}`).toBeLessThanOrEqual(cap + EPS);
          if (share === 7 && !intro && d.workout.km > cap - EPS) onCap++;
          // Početnik sa 4 dana zaista koristi prostor između 0,7 i 0,8 × dugi (inače bi pravilo bilo 0,7).
          if (beg4 && !intro && d.workout.km > Math.floor(long.workout.km * 7 + 1e-9) / 10 + EPS)
            begOver07++;
        }
      }
    }
    expect(weeks).toBeGreaterThan(500);
    expect(onCap).toBeGreaterThan(50);
    expect(begOver07).toBeGreaterThan(0);
  });

  it('odluka 2: I u vrhuncu posle prethodnog I raste najviše jedan korak lestvice nedeljno (i posle smanjenog prvog)', () => {
    let pairs = 0;
    let belowOldFloor = 0;
    for (const { id, p } of SAMPLE) {
      if (p.paceMode === 'feel' || p.experience === 'beginner') continue;
      // Lestvica I: dužine ponude × broj ponavljanja 2–6, ponavljanje 2–5 min na I tempu plana.
      const paceI = (p.paces as Paces).I;
      const ladder = [
        ...new Set(
          [1.2, 1.0, 0.8, 0.7, 0.6, 0.5, 0.4]
            .filter((km) => km * paceI >= 120 - EPS && km * paceI <= P.quality.iRepMaxSec)
            .flatMap((km) => [2, 3, 4, 5, 6].map((r) => Math.round(r * km * 100)))
        )
      ].sort((x, y) => x - y);
      const ws = p.weeks.filter((w) => w.phase === 'peak' && !w.deload && !w.test);
      for (let i = 1; i < ws.length; i++) {
        const a = Math.round(zoneWork(ws[i - 1]!, 'I') * 100);
        const b = Math.round(zoneWork(ws[i]!, 'I') * 100);
        if (a === 0 || b === 0) continue;
        const next = ladder.find((x) => x > a);
        if (next === undefined) continue;
        pairs++;
        expect(b, `${id} ned ${ws[i]!.index}: ${a} → ${b}`).toBeLessThanOrEqual(next);
        if (b < ws[i]!.budgets.I * 100 * 0.7 - EPS) belowOldFloor++;
      }
    }
    expect(pairs).toBeGreaterThan(50);
    // Pravilo zaista deluje: bez njega bi svaka takva nedelja bila ≥ 70 % budžeta (stari donji prag).
    expect(belowOldFloor).toBeGreaterThan(0);
  });
});

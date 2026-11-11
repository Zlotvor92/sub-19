import { describe, expect, it } from 'vitest';
import { addDays } from './fromV2/dates.ts';
import { raceTimeForVdot } from './fromV2/paces.ts';
import type { HmV2Plan, PlanWeek, Weekday } from './fromV2/types.ts';
import { generateHmV3 } from './generate.ts';

/* V3-HM pilot: invarijante nad malom mrežom (3–6 dana, 15–90 km, 6–24 nedelje, tri porodice). Plan postoji, čuvar
   bez nalaza, oblik iz GAP § 2 izmeren brojevima (vrh 3 nedelje pred trku, 85 % / 60 % / oštrenje 6–12 min, dugi
   do najdužeg uz talas, blok RP raste do vrha, provera forme, bez iste nedelje i iste doze 3 puta). */

const DAYS: Record<number, Weekday[]> = {
  3: ['tue', 'thu', 'sun'],
  4: ['tue', 'thu', 'sat', 'sun'],
  5: ['mon', 'tue', 'thu', 'sat', 'sun'],
  6: ['mon', 'tue', 'wed', 'thu', 'sat', 'sun']
};
const START = '2026-11-02';

type Fam = 'result' | 'feel' | 'beginner';
interface Case {
  fam: Fam;
  days: number;
  km: number;
  weeks: number;
  input: Record<string, unknown>;
}

function input(fam: Fam, days: number, km: number, weeks: number, vdot: number, feelEasy: number) {
  const base = {
    startDate: START,
    raceDate: addDays(START, 7 * weeks - 1),
    runDays: DAYS[days],
    longRunDay: 'sun',
    currentWeeklyKm: km
  };
  const result = {
    distanceM: 10000,
    timeSec: Math.round(raceTimeForVdot(vdot, 10000)),
    date: '2026-10-19'
  };
  if (fam === 'result') return { ...base, recentResult: result };
  if (fam === 'feel') return { ...base, recentResult: null, easyPaceSecPerKm: feelEasy };
  return vdot > 40
    ? { ...base, recentResult: null, easyPaceSecPerKm: feelEasy, experience: 'beginner' }
    : { ...base, recentResult: result, experience: 'beginner' };
}

const cases: Case[] = [];
let i = 0;
for (const days of [3, 4, 5, 6])
  for (const km of [15, 25, 35, 45, 60, 75, 90])
    for (const weeks of [6, 9, 12, 16, 20, 24]) {
      const vdot = [35, 45, 55][i++ % 3]!;
      cases.push({
        fam: 'result',
        days,
        km,
        weeks,
        input: input('result', days, km, weeks, vdot, 0)
      });
      if (km <= 60 && weeks !== 9)
        cases.push({
          fam: 'feel',
          days,
          km,
          weeks,
          input: input('feel', days, km, weeks, 0, [330, 390, 450][i % 3]!)
        });
    }
for (const days of [4, 5])
  for (const km of [20, 25, 30, 40, 45])
    for (const weeks of [8, 12, 16, 20, 24])
      for (const v of [35, 50])
        cases.push({
          fam: 'beginner',
          days,
          km,
          weeks,
          input: input('beginner', days, km, weeks, v, 420)
        });

const workMin = (w: PlanWeek): number =>
  w.days.reduce(
    (a, d) =>
      a +
      d.workout.segments
        .filter((g) => g.kind === 'rep' || g.kind === 'continuous')
        .reduce((x, g) => x + g.sec, 0),
    0
  ) / 60;
const longOf = (w: PlanWeek): number =>
  w.days.find((d) => d.workout.kind === 'long')?.workout.km ?? 0;
const blockOf = (w: PlanWeek): number =>
  w.days
    .find((d) => d.workout.kind === 'long')
    ?.workout.segments.filter((g) => g.zone === 'RP')
    .reduce((a, g) => a + g.km, 0) ?? 0;
const sig = (w: PlanWeek): string =>
  `${w.targetKm}|${w.days.map((d) => d.workout.title).join('|')}`;

const plans: { c: Case; plan: HmV2Plan; findings: number }[] = [];
for (const c of cases) {
  const r = generateHmV3(c.input);
  if (r.ok) plans.push({ c, plan: r.plan, findings: r.findings?.length ?? 0 });
}

describe('HM v3 pilot — mreža', () => {
  it('mreža je dovoljno velika i pokriva tri porodice', () => {
    expect(cases.length).toBeGreaterThanOrEqual(200);
    expect(cases.length).toBeLessThanOrEqual(400);
    for (const fam of ['result', 'feel', 'beginner'] as Fam[])
      expect(plans.filter((x) => x.c.fam === fam).length, fam).toBeGreaterThanOrEqual(30);
  });

  it('svaki ulaz koji prolazi proveru ulaza daje plan; čuvar bez nalaza', () => {
    const bad = plans
      .filter((x) => x.findings > 0)
      .map((x) => `${JSON.stringify(x.c.input)} → ${x.plan.warnings.map((w) => w.rule).join(',')}`);
    expect(bad).toEqual([]);
    expect(plans.every((x) => x.plan.policyVersion === 'hm-v3.0.0-pilot')).toBe(true);
  });

  it('najteža nedelja po minutima rada je 3 nedelje pred trku (≤ 8 nedelja: 2); posle nje ≤ 85 %, taper ≤ 60 %, trkačka 6–12 min', () => {
    const bad: string[] = [];
    for (const { c, plan } of plans) {
      const ws = plan.weeks;
      const N = ws.length;
      const peakAt = N <= 8 ? N - 2 : N - 3;
      const m = ws.map(workMin);
      const peak = m[peakAt - 1]!;
      const top = m.indexOf(Math.max(...m.slice(0, N - 1))) + 1;
      if (top !== peakAt) bad.push(`${c.fam}/${c.days}d/${c.km}/${N}: vrh u ${top}`);
      if (N > 8 && m[N - 3]! > 0.85 * peak + 0.5) bad.push(`${c.fam}/${N}: posle vrha ${m[N - 3]}`);
      if (m[N - 2]! > 0.6 * peak + 0.5) bad.push(`${c.fam}/${N}: taper ${m[N - 2]}`);
      const sharp = m[N - 1]!;
      if (sharp < 6 || sharp > 12.5) bad.push(`${c.fam}/${N}: oštrenje ${sharp}`);
    }
    expect(bad).toEqual([]);
  });

  it('nijedna ne-rasteretna nedelja nije ista kao prethodna; ista doza iste zone najviše 2 nedelje zaredom', () => {
    const bad: string[] = [];
    for (const { c, plan } of plans) {
      const ws = plan.weeks;
      for (let k = 1; k < ws.length; k++)
        if (!ws[k]!.deload && sig(ws[k]!) === sig(ws[k - 1]!))
          bad.push(`${c.fam}/${ws.length}: ned ${k + 1}`);
      const build = ws.filter((w) => !w.deload && w.phase !== 'race');
      const doses = build.map((w) =>
        w.days
          .filter((d) => d.workout.kind === 'quality')
          .map((d) => d.workout.title.replace(/Lagano.*/, ''))
      );
      for (let k = 2; k < doses.length; k++)
        for (const t of doses[k]!)
          if (doses[k - 1]!.includes(t) && doses[k - 2]!.includes(t))
            bad.push(`${c.fam}/${ws.length}: ${t} ×3`);
    }
    expect(bad).toEqual([]);
  });

  it('dugi: raste do najdužeg do kraja razvoja (od ≈ 0,82 najdužeg ili 30 % sadašnjeg obima), talas (−12 % ili više) u specifičnoj fazi, blok RP raste do vrha', () => {
    const bad: string[] = [];
    for (const { c, plan } of plans) {
      const ws = plan.weeks;
      const N = ws.length;
      if (N < 12) continue;
      const longs = ws.map(longOf);
      const longest = Math.max(...longs);
      const first = longs[0]!;
      if (first > Math.max(0.9 * longest, 0.3 * c.km + 0.1))
        bad.push(`${c.fam}/${c.km}/${N}: dugi počinje ${first} od ${longest}`);
      const devEnd = c.fam === 'beginner' ? N - 3 : N - 7;
      if (longs[devEnd - 1]! < 0.9 * longest)
        bad.push(`${c.fam}/${c.km}/${N}: kraj lestvice ${longs[devEnd - 1]}`);
      const blocks = ws.map(blockOf);
      const peakBlock = blocks[N - 4]!;
      if (peakBlock < Math.max(...blocks))
        bad.push(`${c.fam}/${N}: blok vrha ${peakBlock} < ${Math.max(...blocks)}`);
      if (c.fam !== 'beginner') {
        const spec = ws.slice(N - 7, N - 2).filter((w) => !w.deload);
        const wave = spec.some((w, k) => k > 0 && longOf(w) <= 0.88 * longOf(spec[k - 1]!));
        if (!wave)
          bad.push(`${c.fam}/${c.days}/${c.km}/${N}: bez talasa ${spec.map(longOf).join(',')}`);
        const up = blocks.filter((b) => b > 0);
        if (up.length < 3 || peakBlock < Math.min(6, Math.floor(0.4 * longOf(ws[N - 4]!))))
          bad.push(`${c.fam}/${c.km}/${N}: blokovi ${up.join('/')}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('provera forme (≥ 12 nedelja): trka/test u rasteretnoj nedelji N−8 sa rečenicom šta rezultat znači', () => {
    const bad: string[] = [];
    for (const { c, plan } of plans) {
      const N = plan.weeks.length;
      if (N < 12) continue;
      const w = plan.weeks[N - 9]!;
      const ok =
        w.deload &&
        w.test &&
        w.days.some((d) => d.role === 'test') &&
        w.notes.some((n) => /potvrđuje|unesi rezultat/.test(n));
      if (!ok) bad.push(`${c.fam}/${N}`);
    }
    expect(bad).toEqual([]);
  });

  it('početnik: vrh ≤ start × 2,0, korak ≤ 1,5 km, svaka 4. lakša, dugi ≤ 2 h 05', () => {
    const bad: string[] = [];
    for (const { c, plan } of plans.filter((x) => x.c.fam === 'beginner')) {
      const ws = plan.weeks;
      if (plan.peakKm > 2 * c.km + 0.05) bad.push(`vrh ${plan.peakKm}`);
      let prev = c.km;
      for (const w of ws) {
        if (!w.deload && w.phase !== 'taper' && w.phase !== 'race') {
          if (w.targetKm - prev > 1.5 + 0.15) bad.push(`korak ${w.index}`);
          prev = w.targetKm;
        }
      }
      const mid = (plan.paces.E.fast + plan.paces.E.slow) / 2;
      if (Math.max(...ws.map(longOf)) * mid > 7500 + 60) bad.push('dugi > 2 h 05');
      if (ws.length >= 12 && !ws.some((w) => w.deload)) bad.push('bez lakše nedelje');
    }
    expect(bad).toEqual([]);
  });

  it('upotrebljivost: nijedna nedelja ispod minimuma, nijedan prazan trening, lagan ≤ dugi (i preko čuvara)', () => {
    for (const { plan } of plans)
      for (const w of plan.weeks) {
        const long = longOf(w);
        for (const d of w.days) {
          expect(d.workout.km).toBeGreaterThan(0);
          if (long > 0 && d.workout.kind === 'easy') expect(d.workout.km).toBeLessThanOrEqual(long);
        }
      }
  });
});

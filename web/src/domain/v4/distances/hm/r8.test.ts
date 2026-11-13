/* KRUG 8 (briefs/R8-ENGINE.md) — zahtevi druge distance za motor, provera nad podacima polumaratona. */
import { describe, expect, it } from 'vitest';
import {
  buildState,
  guard,
  paceCtxOf,
  plan,
  renderPlan,
  summarize,
  type DistanceData,
  type Goal,
  type PlanDoc,
  type RunnerFacts
} from '../../engine';
import { addDays } from '../../engine/dates';
import { derivedPauses, scheduleMaxGap } from '../../engine/pauses';
import { fastWorkSec } from '../../engine/guard';
import { slotDose, type BuildCtx } from '../../engine/select';
import type { PlanDay } from '../../engine/types';
import { estimateForm } from '../../fitness';
import { hm } from './index';
import { PROFILES, factsOf } from './testdata/profiles';
import { qualityDay, replanWith, runsAsPlanned, startPlan } from './testdata/scenarios';

function make(
  facts: RunnerFacts,
  goal: Goal,
  data: DistanceData = hm
): { doc: PlanDoc; state: ReturnType<typeof buildState> } {
  const state = buildState(facts, goal, data, estimateForm);
  const r = plan(state, goal, data);
  if (!r.ok) throw new Error('plan');
  return { doc: r.doc, state };
}
const P = (id: string): { facts: RunnerFacts; goal: Goal } => {
  const p = PROFILES.find((x) => x.id === id);
  if (p === undefined) throw new Error(id);
  return { facts: factsOf(p), goal: p.goal };
};

describe('krug 8 — motor čita podatke distance', () => {
  it('t. 1: čuvar `taper` meri udelom iz `safety.taper.weekBeforeMaxOfPeak`, ne konstantom', () => {
    const { facts, goal } = P('p01');
    const { doc, state } = make(facts, goal);
    expect(guard(doc, state, hm).filter((f) => f.check === 'taper')).toEqual([]);
    const taper = hm.safety.taper;
    if (taper === undefined) throw new Error('taper');
    const strict: DistanceData = {
      ...hm,
      safety: { ...hm.safety, taper: { ...taper, weekBeforeMaxOfPeak: 0.05 } }
    };
    const found = guard(doc, state, strict).filter((f) => f.check === 'taper');
    expect(found.length).toBeGreaterThan(0);
    expect(found[0]?.message).toContain('5 %');
  });

  it('t. 8: raspon tempa starta (`{paceFrom}`–`{paceTo}`) je podatak distance', () => {
    const { facts, goal } = P('p01');
    const { doc, state } = make(facts, goal);
    const line = (text: string): string =>
      text.split('\n').find((l) => l.includes('Prvih 5 km')) ?? '';
    const base = line(renderPlan(doc, state, hm));
    const near: DistanceData = {
      ...hm,
      safety: { ...hm.safety, raceStartPaceOffsetSec: { from: 0, to: 1 } }
    };
    const other = line(renderPlan(doc, state, near));
    expect(base).not.toBe('');
    expect(other).not.toBe(base);
    const m = /trči (\d+):(\d+)–(\d+):(\d+)/.exec(other);
    const n = /trči (\d+):(\d+)–(\d+):(\d+)/.exec(base);
    const sec = (a?: string, b?: string): number => Number(a) * 60 + Number(b);
    expect(sec(n?.[1], n?.[2]) - sec(m?.[1], m?.[2])).toBe(5);
    expect(sec(n?.[3], n?.[4]) - sec(m?.[3], m?.[4])).toBe(9);
  });
});

describe('krug 8 — t. 5: pauza iz praznine prema rasporedu trkača', () => {
  it('najveći razmak rasporeda: 3 dana (uto, čet, ned) = 3; svaki dan = 1', () => {
    expect(scheduleMaxGap([1, 3, 6])).toBe(3);
    expect(scheduleMaxGap([0, 1, 2, 3, 4, 5, 6])).toBe(1);
  });
  it('kod 3 dana nedeljno 5 dana bez trčanja nije pauza, 6 jeste', () => {
    const days = Array.from({ length: 14 }, (_, i) => {
      const date = addDays('2026-11-02', i);
      return {
        id: `d${String(i)}`,
        date,
        workout: [1, 3, 6].includes(i % 7)
          ? { kind: 'easy', steps: [{ extent: { durationSec: 1800 } }] }
          : null
      };
    }) as unknown as PlanDay[];
    const later = ['2026-11-12', '2026-11-15'];
    /* uto 3. 11., pa pon 9. 11.: sre–ned = 5 dana bez trčanja (propušteni čet i ned) — nije pauza */
    const five = new Set(['2026-11-03', '2026-11-09', ...later]);
    expect(derivedPauses(days, five, '2026-11-02', '2026-11-16', [], [1, 3, 6])).toEqual([]);
    /* uto 3. 11., pa uto 10. 11.: sre–pon = 6 dana — pauza */
    const six = new Set(['2026-11-03', '2026-11-10', ...later]);
    expect(derivedPauses(days, six, '2026-11-02', '2026-11-16', [], [1, 3, 6])).toHaveLength(1);
    /* bez rasporeda: staro pravilo (3 dana) */
    expect(derivedPauses(days, five, '2026-11-02', '2026-11-16', [])).toHaveLength(1);
  });
});

describe('krug 8 — t. 2, 3, 10: doza i sužavanje', () => {
  const ctxWith = (cap: number, base: number): BuildCtx =>
    ({
      decisions: { doseCapSec: { prag: cap }, doseBaseSec: { prag: base } },
      data: { safety: { minDoseSec: 300, progression: {} } },
      template: null
    }) as unknown as BuildCtx;
  const slot = { place: 'quality' as const, stimulus: 'prag', index: 3, phase: 'posebna' };
  it('t. 2: u sužavanju/rasterećenju % ide na manji od osnovice i plafona; u gradnji na osnovicu (do plafona)', () => {
    /* veliki obim: osnovica 3000 s > plafon 1500 s; 20 % ne sme dati 600 s (40 % plafona) nego 300 s */
    expect(slotDose(slot, 0.2, 'taper', ctxWith(1500, 3000))).toBe(300);
    expect(slotDose(slot, 0.2, 'recovery', ctxWith(1500, 3000))).toBe(300);
    expect(slotDose(slot, 0.2, 'build', ctxWith(1500, 3000))).toBe(600);
    expect(slotDose(slot, 0.9, 'build', ctxWith(1500, 3000))).toBe(1500);
    /* osnovica ispod plafona: isto kao ranije */
    expect(slotDose(slot, 0.5, 'taper', ctxWith(1500, 1000))).toBe(500);
  });

  it('t. 3: zamenski podražaj (prag → intervali) nosi `dosePct` mesta', () => {
    const { facts, goal } = P('p01');
    const forced: DistanceData = { ...hm, safety: { ...hm.safety, minZoneGapSecPerKm: 999 } };
    const { doc } = make(facts, goal, forced);
    const base = doc.header.decisions.doseBaseSec?.intervali ?? 0;
    const cap = doc.header.decisions.doseCapSec.intervali ?? 0;
    let replaced = 0;
    for (const w of doc.weeks) {
      const prag = w.intent.stimuli.find((x) => x.stimulus === 'prag');
      if (prag?.dosePct === undefined || w.intent.stimuli.some((x) => x.stimulus === 'intervali'))
        continue;
      for (const d of w.days) {
        if (hm.library.find((x) => x.id === d.workout?.libraryId)?.stimulus !== 'intervali')
          continue;
        replaced += 1;
        /* doza zamene ≤ % mesta × osnovica (i ≤ plafon); rep deonica zaokružuje do jednog ponavljanja */
        expect(fastWorkSec(d.workout), `n${String(w.index)}`).toBeLessThanOrEqual(
          Math.min(cap, prag.dosePct * base) + 240
        );
      }
    }
    expect(replaced).toBeGreaterThan(0);
  });
});

describe('krug 8 — t. 11: izlazak iz početne rampe (plan počinje dan posle testa/trke)', () => {
  it('dugi nedelju za nedeljom ≤ + 25 % ili + 20 min od istrčanog dugog prethodne nedelje', () => {
    const { facts, goal } = P('p11');
    /* par P2 B: početnik od 6 nedelja (3–4 dana, 8 → 20 km), test 10 km juče */
    const plan6 = [
      { n: 3, total: 8, long: 4 },
      { n: 3, total: 11, long: 5 },
      { n: 3, total: 14, long: 6 },
      { n: 4, total: 17, long: 7 },
      { n: 4, total: 19, long: 8 },
      { n: 4, total: 20, long: 10 }
    ];
    const runs: RunnerFacts['runs'] = [];
    plan6.forEach((w, i) => {
      const monday = addDays('2026-10-26', -7 * (5 - i));
      const days = w.n === 3 ? [1, 3, 6] : [1, 3, 5, 6];
      days.forEach((d, j) => {
        const last = j === days.length - 1;
        const km = last ? w.long : (w.total - w.long) / (w.n - 1);
        runs.push({
          id: `b${String(i)}-${String(j)}`,
          date: addDays(monday, d),
          distanceM: Math.round((last && i === 5 ? 10 : km) * 1000),
          durationSec: Math.round(
            (last && i === 5 ? 10 : km) * (last && i === 5 ? 336.2 : 440 + 8 * j)
          ),
          ...(last && i === 5 ? { effort: 'test' as const } : {})
        });
      });
    });
    const { doc } = make(
      { ...facts, runs, profile: { ...facts.profile, yearsRunning: 0.1, longestRecentKm: 10 } },
      goal
    );
    const ctx = paceCtxOf(doc.header);
    const longs = doc.weeks
      .slice(0, 6)
      .map((w) => w.days.find((d) => d.workout?.kind === 'long')?.workout ?? null)
      .map((w) => (w === null ? 0 : summarize(w, ctx).durationSec));
    expect(longs[0] ?? 0, longs.join(',')).toBeGreaterThan(0);
    for (let i = 1; i < longs.length; i += 1) {
      /* posle rasterećenja merilo je dugi pre njega (trener, krug 6 § D) */
      const prev = Math.max(
        longs[i - 1] ?? 0,
        doc.weeks[i - 1]?.intent.kind === 'recovery' ? (longs[i - 2] ?? 0) : 0
      );
      const cur = longs[i] ?? 0;
      expect(cur, `${String(i + 1)}: ${longs.join(',')}`).toBeLessThanOrEqual(
        Math.max(1.25 * prev, prev + 1200) + 60
      );
    }
  });
});

/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access,
   @typescript-eslint/no-unsafe-argument -- pomoćne funkcije scenarija su netipizovane (testdata) */
describe('krug 8 — t. 17: rep posle više događaja u istom ponovnom planiranju', () => {
  it('bol pa trka 10 km (oba u jednom ponovnom planiranju): van 28 dana nema izmena osim jednog dugog', () => {
    const start = startPlan('p11');
    const q = qualityDay(start.doc, 9);
    const raceDay = addDays(q.date as string, 14);
    const today = addDays(raceDay, 1);
    const ctx = paceCtxOf(start.doc.header);
    const race = {
      id: 'trka-10k',
      date: raceDay,
      distanceM: 10000,
      durationSec: 3480,
      effort: 'race' as const
    };
    const facts = {
      ...start.facts,
      today,
      runs: [...runsAsPlanned(start.doc, addDays(raceDay, -1)), race],
      pain: [{ date: q.date as string, level: 4, part: 'koleno' }]
    };
    const pain = {
      id: `pain:${String(q.date)}`,
      date: q.date,
      kind: 'pain',
      level: 4,
      part: 'koleno'
    };
    const r = replanWith(start, facts, [pain]);
    const kinds = new Set((r.events as { kind: string }[]).map((e) => e.kind));
    expect(kinds.has('pain') && kinds.has('result'), [...kinds].join(',')).toBe(true);
    const limit = addDays(today, 28);
    const before = start.doc as PlanDoc;
    const after = r.result.doc as PlanDoc;
    let longs = 0;
    for (const w of after.weeks) {
      if (w.start <= limit) continue;
      const old = before.weeks.find((x) => x.start === w.start);
      for (const d of w.days) {
        const o = old?.days.find((x) => x.date === d.date);
        const same =
          JSON.stringify(o?.workout === null ? null : summarize(o?.workout ?? null, ctx)) ===
          JSON.stringify(d.workout === null ? null : summarize(d.workout, ctx));
        if (same) continue;
        expect(d.workout?.kind, `${d.date}`).toBe('long');
        longs += 1;
      }
    }
    expect(longs).toBeLessThanOrEqual(1);
  });
});

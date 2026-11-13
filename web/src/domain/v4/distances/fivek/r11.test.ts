/* KRUG 11 (poruka organizatora 13. 11.) — 5 km: stavke 16 i 17 nad profilima i malom mrežom. */
import { describe, expect, it } from 'vitest';
import { buildState, paceCtxOf, plan, renderPlan, summarize, type PlanDoc } from '../../engine';
import { diffDays } from '../../engine/dates';
import { smallGrid } from '../../engine/testdata/round9b';
import { estimateForm } from '../../fitness';
import { fivek } from './index';
import { PROFILES, factsOf } from './testdata/profiles';

/* 5 km 17:00, 22:00, 30:00 */
const FORMS = [1020, 1320, 1800];

const docs = (): { id: string; doc: PlanDoc }[] => {
  const out: { id: string; doc: PlanDoc }[] = [];
  for (const p of PROFILES) {
    const r = plan(buildState(factsOf(p), p.goal, fivek, estimateForm), p.goal, fivek);
    if (r.ok) out.push({ id: p.id, doc: r.doc });
  }
  for (const g of smallGrid(fivek.distanceM, FORMS)) {
    const goal = { distanceId: fivek.id, raceDate: g.raceDate };
    const r = plan(buildState(g.facts, goal, fivek, estimateForm), goal, fivek);
    if (r.ok) out.push({ id: g.label, doc: r.doc });
  }
  return out;
};

describe('krug 11 — 5 km', () => {
  it(
    'stavka 16: lagan dan i dan sa ubrzanjima traju bar `minEasySec` (zaokruživanje ne ide ispod poda)',
    {
      timeout: 60_000
    },
    () => {
      const bad: string[] = [];
      for (const { id, doc } of docs()) {
        const ctx = paceCtxOf(doc.header);
        for (const d of doc.weeks.flatMap((w) => w.days)) {
          if (d.workout?.kind !== 'easy') continue;
          const sec = summarize(d.workout, ctx).durationSec;
          if (sec < fivek.safety.minEasySec - 30)
            bad.push(`${id} ${d.date} ${String(Math.round(sec))} s`);
        }
      }
      expect(bad).toEqual([]);
    }
  );

  it(
    'stavka 17: zaokružen rad kvaliteta ne prelazi plafon zone (najviše korak od 15 s)',
    {
      timeout: 60_000
    },
    () => {
      const bad: string[] = [];
      for (const { id, doc } of docs()) {
        const caps = doc.header.decisions.doseCapSec;
        for (const d of doc.weeks.flatMap((w) => w.days)) {
          const x = d.workout;
          if (x?.kind !== 'quality' || x.stimulus === null) continue;
          const cap = caps[x.stimulus];
          if (cap !== undefined && x.workSec > cap + 15)
            bad.push(`${id} ${d.date} ${x.stimulus} ${String(x.workSec)} > ${String(cap)}`);
        }
      }
      expect(bad).toEqual([]);
    }
  );

  it('stavka 19: `birthYear` ≥ 55 godina — brzi treninzi nedelje razmaknuti bar 3 dana i rečenica u zaglavlju; bez `birthYear` ništa', () => {
    const p = PROFILES.find((x) => x.id === 'p16');
    if (p === undefined) throw new Error('p16');
    const r = plan(buildState(factsOf(p), p.goal, fivek, estimateForm), p.goal, fivek);
    if (!r.ok) throw new Error('p16');
    expect(r.doc.header.decisions.ageYears).toBe(66);
    expect(renderPlan(r.doc, undefined, fivek)).toMatch(
      /Godine \(66\): oporavak posle brzog treninga traje duže/
    );
    for (const w of r.doc.weeks) {
      if (w.intent.kind === 'race') continue;
      const hard = w.days
        .filter((d) => d.workout?.kind === 'quality' || d.workout?.kind === 'test')
        .map((d) => d.date);
      for (let i = 1; i < hard.length; i += 1)
        expect(
          diffDays(hard[i - 1] ?? '', hard[i] ?? ''),
          `n${String(w.index)}`
        ).toBeGreaterThanOrEqual(3);
    }
    const { birthYear: _drop, ...rest } = p.profile;
    const young = { ...factsOf(p), profile: rest };
    const y = plan(buildState(young, p.goal, fivek, estimateForm), p.goal, fivek);
    if (!y.ok) throw new Error('p16 bez birthYear');
    expect(y.doc.header.decisions.ageYears).toBeUndefined();
    expect(renderPlan(y.doc, undefined, fivek)).not.toMatch(/Godine \(/);
  });
});

/* KRUG 15 (briefs/R15-MOTOR.md, R12-5K F3) — motor nad podacima 5 km: kvalitet ima prednost nad laganim danom na podu
   (M20). */
import { describe, expect, it } from 'vitest';
import { buildState, plan, type PlanDoc } from '../../engine';
import { estimateForm } from '../../fitness';
import { fivek } from './index';
import { PROFILES, factsOf } from './testdata/profiles';

function build(id: string): PlanDoc {
  const p = PROFILES.find((x) => x.id === id);
  if (p === undefined) throw new Error(id);
  const state = buildState(factsOf(p), p.goal, fivek, estimateForm);
  const res = plan(state, p.goal, fivek);
  if (!res.ok) throw new Error(id);
  return res.doc;
}

describe('krug 15 — kvalitet pre laganog dana na podu (M20)', () => {
  it('p06 (brz, mali obim, 5 dana): 1. nedelja ima oba brza treninga, lagan dan ustupa mesto', () => {
    const doc = build('p06');
    const w1 = doc.weeks[0];
    const quality = w1?.days.filter((d) => d.workout?.kind === 'quality').length ?? 0;
    const runs = w1?.days.filter((d) => d.workout !== null).length ?? 0;
    expect(quality).toBe(2);
    expect(runs).toBe(4);
  });

  it('p06: upozorenje kaže pravi razlog (drugi brzi trening), bez „svi traženi dani ostaju"', () => {
    const doc = build('p06');
    const dropped = doc.header.warnings.find((w) => w.code === 'dan-izostavljen');
    expect(dropped?.meaning).toContain('drugom brzom treningu');
    const short = doc.header.warnings.find((w) => w.code === 'lagan-kratak');
    expect(short?.meaning ?? '').not.toContain('Svi traženi dani');
  });
});

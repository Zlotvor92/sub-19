/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument -- scenariji su netipizovani */
/* KRUG 15 (briefs/R15-MOTOR.md, R12-5K F3) — motor nad podacima 5 km: kvalitet ima prednost nad laganim danom na podu
   (M20). */
import { describe, expect, it } from 'vitest';
import { buildState, plan, type PlanDoc } from '../../engine';
import { renderPlan } from '../../engine';
import { estimateForm } from '../../fitness';
import { fivek } from './index';
import { PROFILES, factsOf } from './testdata/profiles';
import { SCENARIOS } from './testdata/scenarios';

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

  it('p14: kratka priprema obećava dugi iz probnog plana, ne manji od onoga što plan već ima', () => {
    const doc = build('p14');
    const w = doc.header.warnings.find((x) => x.code === 'kratka-priprema');
    /* R22 B3 (MOTOR): broj dugog samo kad probni plan stvarno donosi dobitak; broj nedelja uvek */
    expect(w?.proposal).toMatch(/imaš \d+ nedelj\w* pripreme/);
    const promised = /dugi do ([\d,]+) km/.exec(w?.proposal ?? '')?.[1];
    if (promised !== undefined) expect(Number(promised.replace(',', '.'))).toBeGreaterThan(5);
  });

  it('p16 (66 god.): manje brzih treninga je zbog godina — bez saveta „podigni obim"', () => {
    const doc = build('p16');
    const w = doc.header.warnings.find((x) => x.code === 'obim-za-nivo');
    expect(w?.problem).toContain('godina');
    expect(w?.proposal ?? '').not.toMatch(/podigni nedeljni obim/i);
  });

  it('svih 16 profila: jedan broj nedelja pripreme u svim upozorenjima (M6)', () => {
    for (const p of PROFILES) {
      const doc = build(p.id);
      const text = doc.header.warnings.map((w) => w.proposal).join(' ');
      const nums = new Set([...text.matchAll(/(\d+) nedelj\w* pripreme/g)].map((m) => m[1]));
      expect(nums.size, p.id).toBeLessThanOrEqual(1);
    }
  });

  it('M23 (p16, pravilo godina): nedelja kojoj je skinut brz trening ima ubrzanja na dan pred dugi', () => {
    const doc = build('p16');
    const w9 = doc.weeks[8];
    const before = w9?.days[5];
    expect(before?.workout?.kind).toBe('easy');
    expect(before?.workout?.stimulus).not.toBeNull();
  });

  it('stabilnost (R16): „ništa se nije desilo" — očekivano vreme i raspon u ispisu isti pre i posle', () => {
    const line = (t: string): string => /Očekivano na dan trke: [^—]*/.exec(t)?.[0] ?? '';
    for (const sc of SCENARIOS.filter((x) => x.title.includes('ništa'))) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const r: any = sc.run();
      /* scenarij „ništa" sa proverom forme iz plana (promena ≠ 0) ima pravu izmenu — meri se samo promena 0 */
      if ((r.changes as unknown[]).length > 0) continue;
      expect(line(renderPlan(r.after, r.afterState, fivek)), String(sc.no)).toBe(
        line(renderPlan(r.before, r.beforeState, fivek))
      );
    }
  });
});

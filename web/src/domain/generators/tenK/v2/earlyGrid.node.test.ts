/* Segment 06d (10k-v2.5.1, N7): adaptacija koju konstruktor sastavi a validator odbije — trajna mreža rane adaptacije
   (Uslov 8). Mreža E (earlyGrid.harness.node.test.ts): 0 odbijanja, adaptInvariants, regresija prema 51a924f. Primeri
   iz nalaza N7: K1 (rasterećenje sa testom podignuto naviše bez testa, VOLUME_RULE) i K2 (najduži dugi D7 — konstruktor
   je brojao sastavljen, a ne upisan dugi prošle nedelje, TAPER_LONG). */

import { describe, expect, it } from 'vitest';
import { describeEarlyGrid } from './earlyGrid.harness.node.test.ts';
import { adaptTenKV2 } from './adapt.ts';
import { adaptInvariants } from './adaptInvariants.ts';
import { generateTenKV2 } from './generate.ts';
import { longestLong10 } from './lengths.ts';
import { TEN_K_V2_POLICY as P } from './policy.ts';
import {
  beginnerGridInputs,
  earlyFacts,
  earlyGridBases,
  type EarlyScenario,
  feelGridInputs,
  gridInputs
} from './testInputs.ts';
import type { AdaptResult, TenKV2Facts, TenKV2Plan } from './types.ts';
import { validatePlan } from './validate.ts';

/* Brz nivo — uzorak; pun — deo 1, delovi 2…12: earlyGrid.<k>.full.node.test.ts (06i: 12 delova). */
describeEarlyGrid('mreža E: rana adaptacija i pred nedeljom testa (N7)', 1);

const inputs = [
  ...gridInputs(),
  ...([3, 4, 5, 6] as const).flatMap((d) => feelGridInputs(d)),
  ...([3, 4] as const).flatMap((d) => beginnerGridInputs(d))
];
const plan = (id: string): TenKV2Plan => {
  const r = generateTenKV2(inputs.find((x) => x.id === id)!.input);
  if (!r.ok) throw new Error(id);
  return r.plan;
};
const adapt = (id: string, s: EarlyScenario, asOf: string) => {
  const p0 = plan(id);
  const r: AdaptResult = adaptTenKV2(p0, earlyFacts(p0, s, asOf), asOf);
  if (!r.ok) throw new Error(JSON.stringify(r).slice(0, 1500));
  expect(validatePlan(r.plan).filter((v) => v.severity === 'error')).toEqual([]);
  return { p0, p: r.plan };
};

describe('primeri N7 (10k-v2.5.0 odbijeno)', () => {
  it('K1: 4 dana, 12 ned, 25 km, lagan 4:30, bol 5 u četvrtak ned 1 — ned 4 obično rasterećenje 17 km bez testa (bilo 20 km, VOLUME_RULE)', () => {
    const { p0, p } = adapt('f-d4-12w-25km-e270-A-sun', 'pain5', '2026-11-05');
    expect(p0.weeks[3]!).toMatchObject({ deload: true, test: true });
    const w = p.weeks[3]!;
    expect([w.deload, w.test ?? false, w.nominalKm, w.targetKm, w.fitted]).toEqual([
      true,
      false,
      17,
      17,
      null
    ]);
    expect(w.days.some((d) => d.role === 'test')).toBe(false);
  });

  it('K1: 5 dana, 12 ned, 30 km, pauza 20 dana do kraja ned 1 — ned 4 18,5 km bez testa (bilo 20 km)', () => {
    const { p } = adapt('f-d5-12w-30km-e270-C-sat', 'pause20', '2026-11-07');
    const w = p.weeks[3]!;
    expect([w.deload, w.test ?? false, w.nominalKm, w.targetKm, w.fitted]).toEqual([
      true,
      false,
      18.5,
      18.5,
      null
    ]);
  });

  // 06f (pouka 35): bazni plan se promenio — ned 1 sa jednim kvalitetom, upisan dugi ned 1 = 10,5 km (na 7ba9717 9,2 km
  // upisan prema 10,5 sastavljenih; ta razlika više ne postoji u ovom planu). Svojstvo ostaje: dugi tapera ≤ 0,75 ×
  // najduži UPISAN dugi.
  it('K2: 5 dana, 8 ned, 35 km, bol 5 u sredu ned 1 — dugi tapera ≤ 0,75 × najduži UPISAN dugi (10,5 km ned 1)', () => {
    const { p0, p } = adapt('f-d5-8w-35km-e270-A-sat', 'pain5', '2026-11-04');
    // Dugi ned 1 (nedelja 11-01, pre asOf) je zaštićen: ostaje iz prethodnog plana.
    expect(p.weeks[0]!.days.find((d) => d.role === 'long')).toEqual(
      p0.weeks[0]!.days.find((d) => d.role === 'long')
    );
    const taper = p.weeks.find((w) => w.phase === 'taper')!;
    const longest = longestLong10(p.weeks.slice(0, taper.index - 1));
    expect(longest).toBe(105);
    const long = taper.days.find((d) => d.role === 'long')!;
    expect(Math.round(long.workout.km * 10)).toBeLessThanOrEqual(
      Math.floor(P.taper.longFactor * longest + 1e-9)
    );
    expect(long.workout.km).toBe(7.3);
  });
});

describe('primeri 06d (nove klase, 10k-v2.5.0 odbijeno)', () => {
  const kinds = (w: { days: { role: string }[] }) => w.days.map((d) => d.role);
  it('N-a: bol 8 na kraju ned 8 (10 ned) — taper 7,0 km (10k-v2.9.0: 8,2); trkačka skraćena: dan bola 01-03 postaje odmor, 6,5 ≤ 7,0 (D23)', () => {
    const { p } = adapt('10w-25km-v30-A-sat', 'pain8', '2026-12-26');
    const [taper, race] = [p.weeks[8]!, p.weeks[9]!];
    // 10K-08 (T1): bazni plan niži (lagan ≤ 0,8 × dugi) — taper 8,2 → 7,0 km, lagan tapera 4,1 → 3,5 km; mehanizam isti.
    expect(taper.plannedKm).toBe(7);
    expect(race.days.map((d) => `${d.date}:${d.role}:${d.workout.km}`)).toEqual([
      '2027-01-05:easy:3',
      '2027-01-07:easy:3.5',
      '2027-01-09:race:13.12'
    ]);
    expect(race.plannedKm).toBeLessThanOrEqual(taper.plannedKm);
    expect(race.notes).toContain('Trkačka nedelja skraćena: taper je imao dane odmora/bola (D23).');
  });

  it('N-b: umor početnika kraj ned 1 — prinudno rasterećenje ned 2 u uvodu: 0,8 × (16 km), bez kvaliteta, dani uvoda', () => {
    const { p } = adapt('b-d3-10w-20km-e390-A-sat', 'fatigue', '2026-11-07');
    const w = p.weeks[1]!;
    expect([w.deload, w.targetKm]).toEqual([true, 16]);
    expect(kinds(w)).toEqual(['long', 'easy', 'easy']);
    expect(w.days.some((d) => d.workout.kind === 'quality')).toBe(false);
  });

  it('N-c: pauza 10, sreda ned 10 = dan Q1 (upisan T 3600 m) — rasterećenje ned 13 T 2000 m (≈ 60 % od 3600), ne od sastavljenih 3000', () => {
    const { p0, p } = adapt('b-d3-17w-30km-e330-B-sun', 'pause10', '2027-01-06');
    expect(p.weeks[9]!.days.find((d) => d.role === 'q1')).toEqual(
      p0.weeks[9]!.days.find((d) => d.role === 'q1')
    );
    expect(p.weeks[9]!.days.find((d) => d.role === 'q1')!.workout.dose!.doseM).toBe(3600);
    expect(p.weeks[12]!.days.find((d) => d.role === 'q1')!.workout.dose).toMatchObject({
      zone: 'T',
      doseM: 2000
    });
  });

  it('N-d: pauza 20, sreda ned 11 = dan Q1 (upisan RP 3600) — poslednja T doza 3600 (ned 10); 10K-08: taper T kontinuirano 1,5 km (10k-v2.9.0 bez kvaliteta)', () => {
    const { p } = adapt('b-d3-16w-30km-e330-B-sun', 'pause20', '2027-01-13');
    const taper = p.weeks[14]!;
    expect(taper.phase).toBe('taper');
    // 10K-08 (T1): bazni plan je drugi (lagan ≤ 0,8 × dugi) — taper ima T kontinuirano 1,5 km (≈ 60 % poslednje T doze,
    // min 1,5 km, D31), koji staje u plafon 10 % cilja; 10k-v2.9.0: taper bez kvaliteta.
    expect(taper.days.filter((d) => d.workout.kind === 'quality').map((d) => d.workout.dose?.doseM)).toEqual([
      1500
    ]);
    expect(taper.notes.some((n) => n.includes('T kontinuirano ≈ 60 %'))).toBe(true);
  });
});

describe('N-a × D30b (odluka organizatora): izuzetak invarijante samo za trkačku nedelju skraćenu po D23', () => {
  const D23 = 'Trkačka nedelja skraćena: taper je imao dane odmora/bola (D23).';
  const run = (id: string) => {
    const b = earlyGridBases().find((x) => x.id === id)!;
    const r0 = generateTenKV2(b.input);
    if (!r0.ok) throw new Error(id);
    const p0 = r0.plan;
    const N = p0.weeks.length;
    const asOf = p0.weeks[N - 3]!.endDate;
    const facts = earlyFacts(p0, 'pain8', asOf);
    const r = adaptTenKV2(p0, facts, asOf);
    if (!r.ok) throw new Error(JSON.stringify(r.reasons));
    return { p0, p: r.plan, asOf, facts: facts as unknown as TenKV2Facts, N };
  };
  for (const [id, planned, taper] of [
    ['f-d6-9w-35km-e315-B-sat', 7.94, 10.6],
    ['f-d6-14w-35km-e360-B-sat', 7.59, 11.1]
  ] as const)
    it(`${id}, bol 8 kraj ned N − 2: trkačka ${planned} + 10 < 18 km — prihvaćeno (D23, RACE_WEEK_SHORT); bez napomene D23 invarijanta pada`, () => {
      const { p0, p, asOf, facts, N } = run(id);
      const race = p.weeks[N - 1]!;
      expect([race.plannedKm, p.weeks[N - 2]!.plannedKm]).toEqual([planned, taper]);
      expect(race.notes).toContain(D23);
      expect(p.warnings.some((w) => w.rule === 'RACE_WEEK_SHORT' && w.week === N)).toBe(true);
      expect(adaptInvariants(p0, p, asOf, facts)).toEqual([]);
      // Ista nedelja bez oznake skraćenja po D23 (ili bez upozorenja): manjak obara invarijantu.
      const noNote = {
        ...p,
        weeks: p.weeks.map((w, i) =>
          i === N - 1 ? { ...w, notes: w.notes.filter((n) => n !== D23) } : w
        )
      };
      expect(adaptInvariants(p0, noNote, asOf, facts)).toContain('trkačka + trka < minimum');
      const noWarn = { ...p, warnings: p.warnings.filter((w) => w.rule !== 'RACE_WEEK_SHORT') };
      expect(adaptInvariants(p0, noWarn, asOf, facts)).toContain('trkačka + trka < minimum');
    });
});

describe('06e (10k-v2.5.2, pouka 34): umor sa asOf pre starta — 10k-v2.5.1 odbijao 100 % (WEEK_INFEASIBLE)', () => {
  const kinds = (w: { days: { role: string }[] }) => w.days.map((d) => d.role);
  it('10 ned, 25 km, VDOT 30, 4 dana, umor 2026-11-01 (start − 1): ned 1 = 0,8 × 25 = 20 km (T 2000 m ≈ 60 %, dugi 0,8 × 8,2 = 6,5 km), ned 2 = 25 km bez rasta', () => {
    const { p0, p } = adapt('10w-25km-v30-B-sun', 'fatigue', '2026-11-01');
    const step = p.adaptation!.steps[0]!;
    expect([step.fromWeek, step.deload, step.preStart]).toEqual([
      1,
      true,
      { buildKm: 25, longKm: 8.2, tDoseM: 2000 }
    ]);
    expect(p0.weeks[0]!.days.find((d) => d.role === 'long')!.workout.km).toBe(8.2);
    const [w1, w2] = p.weeks;
    expect([w1!.deload, w1!.nominalKm, w1!.targetKm, w1!.fitted]).toEqual([true, 20, 20, null]);
    const q = w1!.days.filter((d) => d.workout.kind === 'quality');
    expect(q.map((d) => d.workout.dose)).toMatchObject([{ zone: 'T', doseM: 2000 }]);
    expect(w1!.days.find((d) => d.role === 'long')!.workout.km).toBe(6.5);
    expect([w2!.deload, w2!.nominalKm, w2!.targetKm, w2!.fitted]).toEqual([false, 25, 25, null]);
    expect(w2!.targetKm).toBe(p0.weeks[0]!.targetKm);
    // Dalje po rasporedu: ned 3 raste od ned 2 (D6), faze ostaju.
    expect(p.weeks[2]!.targetKm).toBe(p0.weeks[1]!.targetKm);
    expect(p.weeks.map((w) => w.phase)).toEqual(p0.weeks.map((w) => w.phase));
  });

  it('početnik 4 dana, 18 km, umor 2026-11-01: ned 1 = 14,4 km sadržaj uvoda (bez kvaliteta, dugi + 3 lagana), ned 2 = 18 km (uvod)', () => {
    const { p0, p } = adapt('b-d4-10w-18km-e330-A-sun', 'fatigue', '2026-11-01');
    const [w1, w2] = p.weeks;
    expect([w1!.deload, w1!.targetKm]).toEqual([true, 14.4]);
    expect(w1!.days.some((d) => d.workout.kind === 'quality')).toBe(false);
    expect(kinds(w1!).sort()).toEqual(kinds(p0.weeks[0]!).sort());
    expect(w1!.notes.some((n) => n.includes('Uvod: '))).toBe(true);
    expect([w2!.deload, w2!.targetKm]).toEqual([false, p0.weeks[0]!.targetKm]);
    expect(w2!.days.some((d) => d.workout.kind === 'quality')).toBe(false);
  });

  it('adaptInvariants obara ned 2 sa rastom i ned 1 iznad 0,8 × planirane ned 1', () => {
    const p0 = plan('10w-25km-v30-B-sun');
    const asOf = '2026-11-01';
    const facts = earlyFacts(p0, 'fatigue', asOf);
    const r = adaptTenKV2(p0, facts, asOf);
    if (!r.ok) throw new Error('odbijeno');
    const f = facts as unknown as TenKV2Facts;
    expect(adaptInvariants(p0, r.plan, asOf, f)).toEqual([]);
    const up = (i: number, km: number) => ({
      ...r.plan,
      weeks: r.plan.weeks.map((w, k) => (k === i ? { ...w, targetKm: km } : w))
    });
    expect(adaptInvariants(p0, up(1, 26.5), asOf, f)).toContain(
      'umor pre starta: ned 2 raste preko planirane ned 1'
    );
    expect(adaptInvariants(p0, up(0, 21), asOf, f)).toContain(
      'umor pre starta: ned 1 > 0,8 × planirana ned 1'
    );
  });
});

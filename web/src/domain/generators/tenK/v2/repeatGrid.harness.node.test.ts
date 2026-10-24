/* 10K v2 06f/06g: trajne mreže ponovljenih i uzastopnih činjenica nad planovima mreže E (testInputs.earlyGridBases) —
   zajednički kod za repeatGrid.node.test.ts (deo 1) i repeatGrid.<k>.full.node.test.ts (16 delova, ≤ ~40 s svaki). Izdvojeno iz mreže E u 06g:
   pojedinačni testovi punog nivoa trajali su 51–303 s po delu E (CI timeout 120 s, run 652).

   Mreže (svaka nad planovima dela; pun nivo: uzorak skupa po mreži, deo `part`; brz: manji uzorak):
   - pouka 36: isti umor ponovo asOf + 1 … + 7 → 0 novih rasterećenja, traka bez umora (tokovi umora mreže E);
   - pouka 36 precizno: umor pet/ned nedelje k − 1, asOf nedelja k − 1 ili ponedeljak k → rasterećenje u nedelji k, isti
     dani od utorka (izuzetak: ponedeljak k je dan testa);
   - zaštićeni dani (kao MAR-07b): nov rezultat kraj ned k + zaključan ili urađen Q1 ned k + 1 → 0 odbijanja, dan
     bajt-isti, doneDayIds;
   - nalaz 3 (pouke 18 i 23): isti bol 7/8 kraj ned N − 3 i N − 2 ponovo asOf + 1 … + 7 → 0 odbijanja, isti plan;
   - 06g (pouke 23 i 30): bol 7/8 svakog dana ned N − 3 … N − 1, pa NOV zapis bola asOf + 1 … + 7 → 0 odbijanja;
   - 06h (pouke 23, 34, 36): asOf = prvi dan plana, svi scenariji mreže E i rezultat → 0 odbijanja, adaptInvariants
     prazno, regresija prema b8fcf22 (prihvaćeni bajt-isti; ranije odbijen samo umor), umor = start − 1 osim dana 1. */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { FULL, part } from '@/test/level';
import { adaptBanner, adaptTenKV2 } from './adapt.ts';
import { adaptInvariants } from './adaptInvariants.ts';
import { addDays } from './dates.ts';
import { earlyPlan } from './earlyGrid.harness.node.test.ts';
import {
  at46e,
  GRID_TIMEOUT,
  hasP37,
  missingParts,
  p37FlowErrors,
  p07FlowErrors,
  p08Errors
} from './level.harness.node.test.ts';
import {
  EARLY_PRE_BACK,
  earlyAsOfs,
  earlyFacts,
  earlyGridBases,
  type EarlyBase,
  factsOf,
  painFacts,
  planHash06c,
  START0_SCENARIOS,
  start0AsOf,
  mark07
} from './testInputs.ts';
import type { PlanWeek, TenKV2Plan } from './types.ts';

export const REPEAT_PARTS = 16;
const HERE = fileURLToPath(new URL('./', import.meta.url));

/** Uzorak planova po mreži: pun — svaki `full`. plan skupa (3084), brz — svaki `fast`. */
const STRIDE = {
  fatigue: { full: 4, fast: 60 },
  monday: { full: 4, fast: 60 },
  locked: { full: 4, fast: 60 },
  pain: { full: 4, fast: 60 },
  painNew: { full: 40, fast: 300 },
  start0: { full: 2, fast: 60 }
} as const;

/** 06h: heševi mreže „prvi dan plana" na b8fcf22 (svi planovi mreže E × START0_SCENARIOS, redom; 0 = odbijeno). */
const START0 = JSON.parse(
  readFileSync(`${HERE}segment06h.startday-hashes-b8fcf22.json`, 'utf8')
) as { against: string; scenarios: string[]; hashes: number[] };
type Net = keyof typeof STRIDE;

/** Planovi mreže `net` u delu `partIndex` (brz nivo: ceo brz uzorak u delu 1). */
function basesOf(net: Net, partIndex: number): EarlyBase[] {
  const k = FULL ? STRIDE[net].full : STRIDE[net].fast;
  const xs = earlyGridBases().filter((_, i) => i % k === 0);
  return FULL ? part(xs, partIndex, REPEAT_PARTS) : xs;
}

/** 06i (pouka 37): dani nedelje `w` posle `from` samo naniže prema `ref` (isti datumi, km ≤, kvalitet sme da otpadne). */
function downOnly(w: PlanWeek, ref: PlanWeek, from: string): boolean {
  const xs = w.days.filter((d) => d.date > from);
  const ys = ref.days.filter((d) => d.date > from);
  return (
    xs.length === ys.length &&
    xs.every(
      (d, i) =>
        d.date === ys[i]!.date &&
        d.workout.km <= ys[i]!.workout.km + 1e-9 &&
        (d.role === ys[i]!.role || d.role === 'easy')
    )
  );
}

const rpe = (date: string) => ({ date, km: 6, durationSec: 2400, completed: true, rpe: 8 });
const pain = (date: string, level: number) => ({
  date,
  km: 0,
  durationSec: 0,
  completed: false,
  pain: level
});

/** Describe trajnih mreža ponavljanja (brz: uzorak; pun: deo `partIndex`). */
export function describeRepeatGrid(title: string, partIndex: number): void {
  describe(title, () => {
    it('pun nivo: svi delovi postoje', () => {
      if (FULL && partIndex === 1)
        expect(missingParts(HERE, 'repeatGrid', REPEAT_PARTS)).toEqual([]);
      expect(basesOf('fatigue', partIndex).length).toBeGreaterThan(0);
    });

    it(
      'pouka 36: isti umor ponovo asOf + 1 … + 7 → 0 novih rasterećenja, traka bez umora',
      () => {
        const dl = (p: TenKV2Plan): number => p.weeks.filter((w) => w.deload).length;
        // Tokovi umora mreže E za planove dela (earlyAsOfs + pre starta, isto kao testInputs.earlyFlows).
        const flows = basesOf('fatigue', partIndex).flatMap((base) => {
          const p0 = earlyPlan(base);
          return [
            ...earlyAsOfs(p0)
              .filter((a) => a.scenarios.includes('fatigue'))
              .map((a) => ({ base, key: `${base.id}/${a.tag}/fatigue`, asOf: a.asOf })),
            ...EARLY_PRE_BACK.map((d) => ({
              base,
              key: `${base.id}/start-${d}/fatigue`,
              asOf: addDays(p0.input.startDate, -d)
            })),
            { base, key: `${base.id}/start+0/fatigue`, asOf: start0AsOf(p0) }
          ];
        });
        const bad: string[] = [];
        let n = 0;
        for (const f of flows) {
          const p0 = earlyPlan(f.base);
          const facts = earlyFacts(p0, 'fatigue', f.asOf);
          const r1 = adaptTenKV2(p0, facts, f.asOf);
          if (!r1.ok) continue;
          for (let d = 1; d <= 7; d++) {
            const at = addDays(f.asOf, d);
            if (at >= p0.input.raceDate) break;
            const r2 = adaptTenKV2(r1.plan, facts, at);
            n++;
            if (!r2.ok) bad.push(`${f.key}/+${d}: odbijeno`);
            else if (dl(r2.plan) > dl(r1.plan))
              bad.push(`${f.key}/+${d}: rasterećenja ${dl(r1.plan)} → ${dl(r2.plan)}`);
            else if (adaptBanner(r1.plan, r2, facts, at).some((m) => m.includes('RPE')))
              bad.push(`${f.key}/+${d}: traka umora`);
          }
        }
        expect(n).toBeGreaterThan(FULL ? 1000 : 100);
        expect(bad.slice(0, 20)).toEqual([]);
      },
      GRID_TIMEOUT
    );

    it(
      'pouka 36 precizno: umor pet/ned nedelje k − 1, asOf nedelja k − 1 ili ponedeljak k → rasterećenje u nedelji k, isti dani od utorka',
      () => {
        // Izuzetak: ponedeljak k je dan testa (asOf ponedeljak = test urađen, ostaje u nedelji k; nedelja → test
        // prelazi u sledeću nedelju, A13).
        const bad: string[] = [];
        let n = 0;
        let m37 = 0;
        for (const b of basesOf('monday', partIndex)) {
          const p0 = earlyPlan(b);
          for (let k = 2; k <= p0.weeks.length - 3; k++) {
            const sun = p0.weeks[k - 2]!.endDate;
            const mon = p0.weeks[k - 1]!.startDate;
            const facts = { workouts: [rpe(addDays(sun, -2)), rpe(sun)] };
            const a = adaptTenKV2(p0, facts, sun);
            const c = adaptTenKV2(p0, facts, mon);
            n++;
            if (!a.ok || !c.ok) {
              bad.push(`${b.id}/k${k}: odbijeno`);
              continue;
            }
            const forced = (x: TenKV2Plan) =>
              x.weeks.filter((w, j) => w.deload && !p0.weeks[j]!.deload).map((w) => w.index);
            if (forced(c.plan).length > 0 && forced(c.plan)[0] !== k)
              bad.push(`${b.id}/k${k}: rasterećenje ${forced(c.plan).join(',')}`);
            if (p0.weeks[k - 1]!.days.some((d) => d.date === mon && d.role === 'test')) continue;
            const after = (x: TenKV2Plan, from: number) =>
              JSON.stringify(
                x.weeks.slice(from).flatMap((w) => w.days.filter((d) => d.date > mon))
              );
            // 06i (pouka 37): ponedeljak k je zaštićen (≤ asOf) i nedelja k ima ostatak do cilja (keptKm) — preostali
            // dani nedelje k samo naniže prema asOf nedelja (isti datumi), nedelje posle k iste.
            if (c.plan.weeks[k - 1]!.keptKm !== undefined) {
              m37++;
              if (!downOnly(c.plan.weeks[k - 1]!, a.plan.weeks[k - 1]!, mon))
                bad.push(`${b.id}/k${k}: pouka 37 — preostali dani nisu samo naniže`);
              if (after(a.plan, k) !== after(c.plan, k))
                bad.push(`${b.id}/k${k}: drugi dani posle nedelje k`);
            } else if (after(a.plan, 0) !== after(c.plan, 0))
              bad.push(`${b.id}/k${k}: drugi dani od utorka`);
          }
        }
        expect(n).toBeGreaterThan(FULL ? 300 : 200);
        expect(m37).toBeGreaterThan(0);
        expect(bad.slice(0, 20)).toEqual([]);
      },
      GRID_TIMEOUT
    );

    it(
      'zaštićeni dani (kao maraton MAR-07b): nov rezultat kraj ned k + zaključan ili urađen Q1 ned k + 1 → 0 odbijanja, dan bajt-isti',
      () => {
        const bad: string[] = [];
        let n = 0;
        for (const b of basesOf('locked', partIndex)) {
          const p0 = earlyPlan(b);
          for (let k = 2; k <= p0.weeks.length - 4; k += 2) {
            const at = p0.weeks[k - 1]!.endDate;
            const q = p0.weeks[k]!.days.find((d) => d.role === 'q1' || d.role === 'q2');
            if (!q) continue;
            for (const s of ['faster', 'slower'] as const)
              for (const how of ['locked', 'done'] as const) {
                const base = factsOf(p0, s, at);
                const facts =
                  how === 'locked'
                    ? { ...base, lockedDayIds: [q.date] }
                    : {
                        ...base,
                        // Urađen unapred (zapis danas za dan posle asOf) → adaptation.doneDayIds.
                        workouts: [
                          {
                            date: at,
                            dayId: q.date,
                            km: q.workout.km,
                            durationSec: q.workout.sec,
                            completed: true
                          }
                        ]
                      };
                const r = adaptTenKV2(p0, facts, at);
                n++;
                const key = `${b.id}/k${k}/${s}/${how}`;
                if (!r.ok) bad.push(`${key}: ${r.reasons[0]!.message.slice(0, 120)}`);
                else {
                  const d = r.plan.weeks[k]!.days.find((x) => x.date === q.date);
                  if (JSON.stringify(d) !== JSON.stringify(q)) bad.push(`${key}: dan promenjen`);
                  if (how === 'done' && !r.plan.adaptation!.doneDayIds?.includes(q.date))
                    bad.push(`${key}: bez doneDayIds`);
                }
              }
          }
        }
        expect(n).toBeGreaterThan(FULL ? 400 : 100);
        expect(bad.slice(0, 20)).toEqual([]);
      },
      GRID_TIMEOUT
    );

    it(
      'nalaz 3 (pouke 18 i 23): isti bol 7/8 na kraju ned N − 3 i N − 2 ponovo asOf + 1 … + 7 → 0 odbijanja, isti plan',
      () => {
        const bad: string[] = [];
        let n = 0;
        for (const b of basesOf('pain', partIndex)) {
          const p0 = earlyPlan(b);
          const N = p0.weeks.length;
          for (const w of [N - 3, N - 2])
            for (const level of [7, 8]) {
              const asOf = p0.weeks[w - 1]!.endDate;
              const facts = painFacts(asOf, level);
              const r1 = adaptTenKV2(p0, facts, asOf);
              if (!r1.ok) {
                bad.push(`${b.id}/w${w}/p${level}: odbijeno`);
                continue;
              }
              for (let d = 1; d <= 7; d++) {
                const at = addDays(asOf, d);
                if (at >= p0.input.raceDate) break;
                const r2 = adaptTenKV2(r1.plan, facts, at);
                n++;
                if (!r2.ok) bad.push(`${b.id}/w${w}/p${level}/+${d}: ${r2.reasons[0]!.message}`);
                else if (JSON.stringify(r2.plan.weeks) !== JSON.stringify(r1.plan.weeks))
                  bad.push(`${b.id}/w${w}/p${level}/+${d}: drugi plan`);
              }
            }
        }
        expect(n).toBeGreaterThan(FULL ? 1000 : 500);
        expect(bad.slice(0, 20)).toEqual([]);
      },
      GRID_TIMEOUT
    );

    it(
      '06g (pouke 23 i 30): bol 7/8 svakog dana ned N − 3 … N − 1, pa NOV zapis bola asOf + 1 … + 7 → 0 odbijanja',
      () => {
        const bad: string[] = [];
        let n = 0;
        for (const b of basesOf('painNew', partIndex)) {
          const p0 = earlyPlan(b);
          const N = p0.weeks.length;
          for (const w of [N - 3, N - 2, N - 1])
            for (let i = 0; i < 7; i++) {
              const asOf = addDays(p0.weeks[w - 1]!.startDate, i);
              if (asOf >= p0.input.raceDate) continue;
              for (const level of [7, 8]) {
                const r1 = adaptTenKV2(p0, { workouts: [pain(asOf, level)] }, asOf);
                if (!r1.ok) {
                  bad.push(`${b.id}/${asOf}/p${level}: odbijeno`);
                  continue;
                }
                for (let d = 1; d <= 7; d++) {
                  const at = addDays(asOf, d);
                  if (at >= p0.input.raceDate) break;
                  const facts = { workouts: [pain(asOf, level), pain(at, level)] };
                  const r2 = adaptTenKV2(r1.plan, facts, at);
                  n++;
                  if (!r2.ok)
                    bad.push(
                      `${b.id}/${asOf}/p${level}/+${d}: ${r2.reasons[0]!.message.slice(0, 100)}`
                    );
                }
              }
            }
        }
        expect(n).toBeGreaterThan(FULL ? 1000 : 300);
        expect(bad.slice(0, 20)).toEqual([]);
      },
      GRID_TIMEOUT
    );

    it(
      '06h (pouke 23, 34, 36): asOf = prvi dan plana, svi scenariji mreže E i rezultat → 0 odbijanja, adaptInvariants prazno, prema b8fcf22 menja se samo ranije odbijen umor; umor = start − 1 osim dana 1',
      () => {
        expect([START0.against, START0.scenarios]).toEqual(['b8fcf22', [...START0_SCENARIOS]]);
        expect(START0.hashes.length).toBe(earlyGridBases().length * START0_SCENARIOS.length);
        const idx = new Map(earlyGridBases().map((b, i) => [b.id, i]));
        const bad: string[] = [];
        let [n, fixed] = [0, 0];
        const runs37: { key: string; hash: number; res: unknown; m07: string }[] = [];
        for (const b of basesOf('start0', partIndex)) {
          const p0 = earlyPlan(b);
          const at = start0AsOf(p0);
          // Mreža proverava sama sebe: asOf je prvi dan plana (zapisi umora pre starta).
          if (at !== p0.weeks[0]!.startDate || at !== p0.input.startDate)
            bad.push(`${b.id}: asOf ${at} nije prvi dan plana`);
          for (const [j, s] of START0_SCENARIOS.entries()) {
            const key = `${b.id}/start+0/${s}`;
            const facts = earlyFacts(p0, s, at);
            const r = adaptTenKV2(p0, facts, at);
            n++;
            if (!r.ok) {
              bad.push(`${key}: ${r.reasons[0]!.message.slice(0, 120)}`);
              continue;
            }
            for (const v of adaptInvariants(p0, r.plan, at, facts)) bad.push(`${key}: ${v}`);
            const old = START0.hashes[idx.get(b.id)! * START0_SCENARIOS.length + j]!;
            const h = planHash06c(r);
            runs37.push({
              key,
              hash: h,
              res: hasP37(r) ? 'Mešovita nedelja: zaštićeni dani 0 km' : null,
              m07: mark07(r)
            });
            if (old === 0) {
              fixed++;
              if (s !== 'fatigue') bad.push(`${key}: na b8fcf22 odbijen, a nije umor`);
            } else if (old !== at46e('start0', key, h)) bad.push(`${key}: promenjen prema b8fcf22`);
            if (s !== 'fatigue') continue;
            // Pouke 34 i 36: ista nedelja rasterećenja kao start − 1; dan 1 (≤ asOf) upisan kakav jeste.
            const before = addDays(at, -1);
            const r0 = adaptTenKV2(p0, earlyFacts(p0, s, before), before);
            if (!r0.ok) bad.push(`${b.id}/start-1/fatigue: odbijeno`);
            else if (
              !r.plan.weeks[0]!.deload ||
              JSON.stringify(r.plan.weeks.slice(1)) !== JSON.stringify(r0.plan.weeks.slice(1)) ||
              // 06i (pouka 37): uz ostatak do cilja (keptKm) ostali dani ned 1 samo naniže prema start − 1.
              (r.plan.weeks[0]!.keptKm !== undefined
                ? !downOnly(r.plan.weeks[0]!, r0.plan.weeks[0]!, at)
                : JSON.stringify(r.plan.weeks[0]!.days.filter((d) => d.date !== at)) !==
                  JSON.stringify(r0.plan.weeks[0]!.days.filter((d) => d.date !== at))) ||
              JSON.stringify(r.plan.weeks[0]!.days.filter((d) => d.date === at)) !==
                JSON.stringify(p0.weeks[0]!.days.filter((d) => d.date === at))
            )
              bad.push(`${key}: nije rasterećenje ned 1 kao start − 1 uz upisan dan 1`);
          }
        }
        // 06i: prema 46e72eb menjaju se tačno tokovi sa mešovitom nedeljom pouke 37; 10K-07: tokovi koje 10k-v2.9.0
        // menja (fixture, uzrok) — pre provere „promenjen prema b8fcf22" (koja ih čita preko at46e).
        const e37 = p37FlowErrors('start0', runs37).slice(0, 10);
        const e07 = [...p07FlowErrors('start0', runs37), ...p08Errors('start0', runs37)].slice(
          0,
          10
        );
        expect(n).toBeGreaterThan(FULL ? 600 : 300);
        // Na b8fcf22 umor sa asOf = start odbijen u svakom planu (organizator: 1245/1245).
        expect(fixed).toBe(n / START0_SCENARIOS.length);
        expect(bad.slice(0, 20)).toEqual([]);
        expect(e37).toEqual([]);
        expect(e07).toEqual([]);
      },
      GRID_TIMEOUT
    );
  });
}

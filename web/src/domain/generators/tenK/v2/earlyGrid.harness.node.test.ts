/* Mreža E 10K v2 (segment 06d, 10k-v2.5.1, N7): rana adaptacija, pred nedeljom testa i pred taperom — zajednički kod
   za earlyGrid.node.test.ts i earlyGrid.<k>.full.node.test.ts.

   Planovi (testInputs.earlyGridBases): svaki 12. ulaz mreže 01, svaki 7. mreže po osećaju (3–6 dana), svaki 3. mreže
   početnika (3–4 dana) = 3084. asOf (testInputs.earlyAsOfs): sreda i kraj nedelje 1 i, u planu sa testom, nedelje
   pre nedelje testa (≥ 2) — pauza 10 i 20 dana, bol 5 i 8, pauza 10 + bol 5, manjak, umor; kraj nedelje N − 2 — bol 8
   (taper skraćen, D23); imenovani tokovi stanja doze iz upisanih dana (EARLY_NAMED). Po toku: prihvaćen (0
   odbijanja), adaptInvariants prazno (Uslov 8: nijedan prazan trening, dugi ≥ lagan, nedelja ≥ minimum), regresija:
   tok prihvaćen na 51a924f bajt-isti (heš bez oznake verzije, segment06d.early-hashes-51a924f.json; 0 = tamo
   odbijen) osim tokova porodice 1 (prošlost = upisani dani; spisak u istom fajlu).
   06e (10k-v2.5.2, pouka 34): isti planovi sa asOf PRE STARTA (start − 1, − 3, − 6) — umor, bol 5, pauza 10, rezultat
   (testInputs.EARLY_PRE_SCENARIOS), posle svih tokova 06d; regresija prema bd07eec
   (segment06e.prestart-hashes-bd07eec.json: prihvaćeni bajt-isti; umor tamo odbijen, 0).
   06f (10k-v2.6.0, pouka 36): tok umora ponovo sa ISTIM činjenicama na asOf + 1 … + 7 (pre trke) — 0 novih
   rasterećenja, traka (adaptBanner) bez umora (brz: tokovi umora uzorka; pun: svaki 4. tok umora dela).

   - BRZ nivo: deterministički uzorak (svaki K_FAST. tok 06d i svaki K_PRE. tok pre starta unutar porodice × scenario)
     + imenovani primeri N7/06d/06e.
   - PUN nivo: delovi po indeksu plana (`part`, EARLY_PARTS); glavni fajl = deo 1. */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { FULL, part, sample } from '@/test/level';
import { adaptBanner, adaptTenKV2 } from './adapt.ts';
import { adaptInvariants } from './adaptInvariants.ts';
import { addDays } from './dates.ts';
import { generateTenKV2 } from './generate.ts';
import { at7ba, GRID_TIMEOUT, missingParts, p35FlowErrors } from './level.harness.node.test.ts';
import {
  EARLY_NAMED,
  type EarlyBase,
  type EarlyFlow,
  earlyFacts,
  earlyFlows,
  earlyGridBases,
  EARLY_06D,
  factsOf,
  painFacts,
  planHash06c
} from './testInputs.ts';
import type { TenKV2Facts, TenKV2Plan } from './types.ts';

export const EARLY_PARTS = 4;
const K_FAST = 60;
const K_PRE = 240;
const HERE = fileURLToPath(new URL('./', import.meta.url));
export const EARLY_HASHES = `${HERE}segment06d.early-hashes-51a924f.json`;
export const PRE_HASHES = `${HERE}segment06e.prestart-hashes-bd07eec.json`;
/** Broj planova i tokova celog skupa (06d + asOf pre starta 3084 × 3 × 4). */
export const EARLY_PLANS = 3084;
export const EARLY_TOTAL = EARLY_06D + 37008;

/** Primeri nalaza (uvek u uzorku brzog nivoa): K1 pauza 20 kraj ned 1; K2 bol 5/8 sreda ned 1; N-a bol 8 kraj ned
    N − 2; N-b umor početnika kraj ned 1; N-c/N-d (EARLY_NAMED). Primer K1 bol 5 u četvrtak ned 1 nije asOf mreže
    — poseban test u earlyGrid.node.test.ts. */
export const NAMED_FLOWS: readonly string[] = [
  'f-d5-12w-30km-e270-C-sat/w1end/pause20',
  'f-d5-8w-35km-e270-A-sat/w1wed/pain5',
  'f-d5-8w-35km-e270-A-sat/w1wed/pain8',
  '10w-25km-v30-A-sat/w8end/pain8',
  'b-d3-10w-20km-e390-A-sat/w1end/fatigue',
  ...EARLY_NAMED,
  // 06e: umor pre starta — 4 dana (T 60 %), početnik (sadržaj uvoda), 3 dana 20 km (T ne staje u plafon, D11).
  '10w-25km-v30-A-sat/start-1/fatigue',
  'b-d4-10w-18km-e330-A-sat/start-1/fatigue',
  'f-d3-8w-20km-e270-A-sat/start-3/fatigue'
];

const plans = new Map<string, TenKV2Plan>();
export function earlyPlan(b: EarlyBase): TenKV2Plan {
  let x = plans.get(b.id);
  if (!x) {
    const r = generateTenKV2(b.input);
    if (!r.ok) throw new Error(`${b.id}: ${JSON.stringify(r.reasons)}`);
    plans.set(b.id, (x = r.plan));
  }
  return x;
}

let allFlows: EarlyFlow[] | null = null;
export const earlyAll = (): EarlyFlow[] => (allFlows ??= earlyFlows(earlyPlan));

/** Tokovi brzog nivoa (uzorak) ili dela punog (planovi `part`). */
export function earlyCases(partIndex: number): EarlyFlow[] {
  const flows = earlyAll();
  if (FULL) {
    const ids = new Set(part(earlyGridBases(), partIndex, EARLY_PARTS).map((p) => p.id));
    return flows.filter((f) => ids.has(f.base.id));
  }
  const named = (f: EarlyFlow): boolean => NAMED_FLOWS.includes(f.key);
  const cat = (f: EarlyFlow): string => `${f.base.family}/${f.s}`;
  return [
    ...sample(flows.slice(0, EARLY_06D), K_FAST, cat, named),
    ...sample(flows.slice(EARLY_06D), K_PRE, cat, named)
  ];
}

export interface EarlyRun {
  ok: boolean;
  bad: string[];
  hash: number;
  /** 06f: pouka 35 u rezultatu (napomena konstruktora). */
  p35: boolean;
}

export function runEarly(f: EarlyFlow): EarlyRun {
  const p0 = earlyPlan(f.base);
  const facts = earlyFacts(p0, f.s, f.asOf);
  const r = adaptTenKV2(p0, facts, f.asOf);
  if (!r.ok)
    return {
      ok: false,
      bad: [`${f.key}: ${JSON.stringify(r).slice(0, 400)}`],
      hash: 0,
      p35: false
    };
  const bad = adaptInvariants(p0, r.plan, f.asOf, facts as unknown as TenKV2Facts).map(
    (v) => `${f.key}: ${v}`
  );
  return { ok: true, bad, hash: planHash06c(r), p35: JSON.stringify(r).includes('Pouka 35:') };
}

interface EarlyHashes {
  against: string;
  /** Heš po rednom broju toka; 0 = tok odbijen na 51a924f. */
  hashes: number[];
  /** Tokovi porodice 1 (prošlost = upisani dani): prihvaćeni na 51a924f, menjaju se. */
  family1: string[];
  /** A5 u uvodu početnika (N-b): prihvaćeni na 51a924f sa ciljem spuštenim ispod 0,8 × (kvalitet nije stao),
      sada 0,8 × bez kvaliteta. */
  introA5: string[];
}
let hashes: EarlyHashes | null = null;
export const earlyHashes = (): EarlyHashes =>
  (hashes ??= JSON.parse(readFileSync(EARLY_HASHES, 'utf8')) as EarlyHashes);
/** 06e: heševi tokova pre starta na bd07eec (redni broj − EARLY_06D; 0 = odbijen). */
let preHashes: { against: string; hashes: number[] } | null = null;
export const earlyPreHashes = (): { against: string; hashes: number[] } =>
  (preHashes ??= JSON.parse(readFileSync(PRE_HASHES, 'utf8')) as {
    against: string;
    hashes: number[];
  });
/** Heš toka u referenci (06d: 51a924f; pre starta: bd07eec); 0 = tamo odbijen. */
const refHash = (f: EarlyFlow): number =>
  f.n < EARLY_06D ? earlyHashes().hashes[f.n]! : earlyPreHashes().hashes[f.n - EARLY_06D]!;
/** 06f (pouka 35): heš toka u stanju 7ba9717 (fixture) — starije regresije porede njega. */
const hash7ba = (f: EarlyFlow, h: number): number => at7ba('early', f.key, h);

/** Describe mreže E (brz: uzorak; pun: deo `partIndex`). */
export function describeEarlyGrid(title: string, partIndex: number): void {
  describe(title, () => {
    let flows: EarlyFlow[] = [];
    let res: EarlyRun[] = [];
    beforeAll(() => {
      flows = earlyCases(partIndex);
      res = flows.map(runEarly);
    }, GRID_TIMEOUT);

    it('ceo skup: planovi i tokovi; imenovani primeri u skupu; pun nivo — svi delovi postoje', () => {
      const all = earlyAll();
      expect(new Set(all.map((f) => f.base.id)).size).toBe(EARLY_PLANS);
      expect(all.length).toBe(EARLY_TOTAL);
      expect(earlyHashes().against).toBe('51a924f');
      expect(earlyHashes().hashes.length).toBe(EARLY_06D);
      expect(earlyPreHashes().against).toBe('bd07eec');
      expect(earlyPreHashes().hashes.length).toBe(all.length - EARLY_06D);
      const keys = new Set(all.map((f) => f.key));
      expect(NAMED_FLOWS.filter((k) => !keys.has(k))).toEqual([]);
      if (FULL) expect(missingParts(HERE, 'earlyGrid', EARLY_PARTS)).toEqual([]);
      else expect(flows.length).toBeGreaterThan(1000);
    });

    it('0 odbijanja i adaptInvariants prazno (Uslov 8)', () => {
      expect(res.filter((r) => !r.ok).length).toBe(0);
      expect(res.flatMap((r) => r.bad)).toEqual([]);
    });

    it(
      'pouka 36: isti umor ponovo asOf + 1 … + 7 → 0 novih rasterećenja, traka bez umora',
      () => {
        const dl = (p: TenKV2Plan): number => p.weeks.filter((w) => w.deload).length;
        const bad: string[] = [];
        let n = 0;
        // Pun nivo: svaki 4. tok umora dela (× 7 ponavljanja; ceo skup ≈ 120 000 adaptacija bi trajao > 13 min).
        const fat = flows.filter((x) => x.s === 'fatigue');
        for (const f of FULL ? fat.filter((_, i) => i % 4 === 0) : fat) {
          const p0 = earlyPlan(f.base);
          const facts = earlyFacts(p0, f.s, f.asOf);
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
        expect(n).toBeGreaterThan(FULL ? 5000 : 100);
        expect(bad.slice(0, 20)).toEqual([]);
      },
      GRID_TIMEOUT
    );

    it('06f (10k-v2.6.0): prema 7ba9717 menjaju se tačno tokovi sa poukom 35 (nedelja u rezultatu ili bazni plan)', () => {
      const runs = flows.map((f, i) => ({
        key: f.key,
        id: f.base.id,
        hash: res[i]!.hash,
        res: res[i]!.p35 ? 'Pouka 35:' : null
      }));
      expect(p35FlowErrors('early', runs).slice(0, 10)).toEqual([]);
    });

    it(
      '06f (pouka 36 precizno): umor pet/ned nedelje k − 1, asOf nedelja k − 1 ili ponedeljak k → rasterećenje u nedelji k, isti dani od utorka',
      () => {
        // Pun nivo: planovi dela; brz: svaki 25. plan skupa (u planovima uzorka). Izuzetak: ponedeljak k je dan testa
        // (asOf ponedeljak = test urađen, ostaje u nedelji k; nedelja → test prelazi u sledeću nedelju, A13).
        const ids = new Set(flows.map((f) => f.base.id));
        const bases = FULL
          ? part(earlyGridBases(), partIndex, EARLY_PARTS)
          : earlyGridBases().filter((b, i) => i % 25 === 0 && ids.has(b.id));
        const bad: string[] = [];
        let n = 0;
        for (const b of bases) {
          const p0 = earlyPlan(b);
          for (let k = 2; k <= p0.weeks.length - 3; k++) {
            const sun = p0.weeks[k - 2]!.endDate;
            const mon = p0.weeks[k - 1]!.startDate;
            const rpe = (date: string) => ({
              date,
              km: 6,
              durationSec: 2400,
              completed: true,
              rpe: 8
            });
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
            const after = (x: TenKV2Plan) =>
              JSON.stringify(x.weeks.flatMap((w) => w.days.filter((d) => d.date > mon)));
            if (after(a.plan) !== after(c.plan)) bad.push(`${b.id}/k${k}: drugi dani od utorka`);
          }
        }
        expect(n).toBeGreaterThan(FULL ? 5000 : 200);
        expect(bad.slice(0, 20)).toEqual([]);
      },
      GRID_TIMEOUT
    );

    it(
      '06f (zaštićeni dani, kao maraton MAR-07b): nov rezultat kraj ned k + zaključan ili urađen Q1 ned k + 1 → 0 odbijanja, dan bajt-isti',
      () => {
        // Pun nivo: planovi dela; brz: svaki 25. plan skupa (u planovima uzorka). k = 2, 4, … ≤ N − 4.
        const ids = new Set(flows.map((f) => f.base.id));
        const bases = FULL
          ? part(earlyGridBases(), partIndex, EARLY_PARTS)
          : earlyGridBases().filter((b, i) => i % 25 === 0 && ids.has(b.id));
        const bad: string[] = [];
        let n = 0;
        for (const b of bases) {
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
                        workouts: [
                          {
                            // Urađen unapred (zapis danas za dan posle asOf) → adaptation.doneDayIds.
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
        expect(n).toBeGreaterThan(FULL ? 4000 : 100);
        expect(bad.slice(0, 20)).toEqual([]);
      },
      GRID_TIMEOUT
    );

    it(
      '06f (nalaz 3, pouke 18 i 23): isti bol 7/8 na kraju ned N − 3 i N − 2 ponovo asOf + 1 … + 7 → 0 odbijanja, isti plan',
      () => {
        // Pun nivo: planovi dela; brz: svaki 25. plan skupa (u planovima uzorka).
        const ids = new Set(flows.map((f) => f.base.id));
        const bases = FULL
          ? part(earlyGridBases(), partIndex, EARLY_PARTS)
          : earlyGridBases().filter((b, i) => i % 25 === 0 && ids.has(b.id));
        const bad: string[] = [];
        let n = 0;
        for (const b of bases) {
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
        expect(n).toBeGreaterThan(FULL ? 10000 : 500);
        expect(bad.slice(0, 20)).toEqual([]);
      },
      GRID_TIMEOUT
    );

    it('regresija: tok prihvaćen na 51a924f (pre starta: bd07eec) bajt-isti (heš bez oznake verzije), osim porodice 1 i A5 u uvodu (ti se menjaju)', () => {
      const h = earlyHashes();
      const fam = new Set([...h.family1, ...h.introA5]);
      const accepted = flows.map((f, i) => [f, res[i]!] as const).filter(([f]) => refHash(f) !== 0);
      const changed = accepted
        .filter(([f, r]) => refHash(f) !== hash7ba(f, r.hash))
        .map(([f]) => f.key);
      expect(changed.filter((k) => !fam.has(k))).toEqual([]);
      expect(changed.filter((k) => fam.has(k)).sort()).toEqual(
        accepted
          .map(([f]) => f.key)
          .filter((k) => fam.has(k))
          .sort()
      );
    });
  });
}

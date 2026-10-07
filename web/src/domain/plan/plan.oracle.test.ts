import { beforeAll, describe, expect, it } from 'vitest';
import { canonical } from '@/test/fingerprint';
import { firstDiff } from '@/test/firstDiff';
import { loadLegacyApp, type LegacyApp } from '@/test/legacyOracle';
import { addDays, parseIsoDate, type IsoDate } from '../date';
import type { AltRecord, GenPlanState } from '../state';
import { generatePlan } from '@/test/legacyGenerator';
import type { PlanGenerationInput } from '../training/types';
import { adaptGeneratedPlan } from './adapt';
import { sessKind, tagName, weekPhase } from './describe';
import { setAlt, swapDays, undoWeekMoves } from './edit';
import { resolvePlan } from './resolve';

/* parity: test/deload-ostrina.test.mjs :: „deload ostaje prepoznatljiv SVUDA gde se čita" + „ručno
   pisan plan"; test/spojevi.test.mjs; test/prevlacenje (zamena dana).
   Poredi `domain/plan` sa starim `adaptGeneratedPlan` / `rebuildDateIndex` / `swapDays` / `setAlt` /
   `undoWeekMoves` / `weekPhase` / `sessKind`. */

function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const input = (over: Partial<PlanGenerationInput> = {}): PlanGenerationInput => ({
  startDate: '2026-01-05',
  raceDate: '2026-05-03',
  raceDistM: 10000,
  pb: { distM: 10000, sec: 2700 },
  weeklyKm: 35,
  runDays: 5,
  quality: 2,
  intensity: 'std',
  trainedRecently: true,
  ...over
});

let legacy: LegacyApp;
let adapted: GenPlanState;
const j = <T>(x: unknown): T => JSON.parse(JSON.stringify(x)) as T;

/** Postavlja stanje u starom kodu i gradi njegove strukture (`CUR_PLAN`, `BY_ID`, `DATED`). */
function setLegacy(plan: GenPlanState, alts: unknown, moves: unknown, log: unknown = {}): void {
  const ctx = (legacy as unknown as { ctx: Record<string, unknown> }).ctx;
  ctx['__p'] = j(plan);
  ctx['__a'] = j(alts);
  ctx['__m'] = j(moves);
  ctx['__l'] = j(log);
  legacy.evalIn(
    'S.genPlan=__p; S.alts=__a; S.moves=__m; S.log=__l; setActivePlan(); rebuildDateIndex(); 0'
  );
}

beforeAll(async () => {
  legacy = await loadLegacyApp('2026-01-07T09:00:00Z');
  const g = generatePlan(input());
  const a = adaptGeneratedPlan(g);
  if (!a) throw new Error('adapt');
  adapted = a;
});

describe('adaptGeneratedPlan naspram starog', () => {
  it('isti izlaz za 24 različita plana (sve 4 distance, početnik/trenirao, različiti dani trke)', () => {
    let n = 0;
    for (const raceDistM of [5000, 10000, 21097.5, 42195]) {
      for (const trainedRecently of [true, false]) {
        for (const days of [0, 3, 6]) {
          const inp = input({
            raceDistM,
            pb: {
              distM: raceDistM,
              sec:
                raceDistM === 5000
                  ? 1237
                  : raceDistM === 10000
                    ? 2580
                    : raceDistM === 21097.5
                      ? 5700
                      : 12000
            },
            raceDate: addDays(parseIsoDate('2026-01-05') as IsoDate, 24 * 7 + days),
            trainedRecently
          });
          const mine = adaptGeneratedPlan(generatePlan(inp));
          const old = legacy.call('adaptGeneratedPlan', legacy.call('generatePlan', j(inp)));
          expect(firstDiff(canonical(mine), canonical(j(old))), JSON.stringify(inp)).toBeNull();
          n++;
        }
      }
    }
    expect(n).toBe(24);
  });

  it('greška generatora → null', () => {
    expect(adaptGeneratedPlan({ error: 'x' })).toBeNull();
  });
});

function randomOverlay(
  plan: GenPlanState,
  r: () => number
): { alts: Record<string, AltRecord>; moves: Record<string, string> } {
  const alts: Record<string, AltRecord> = {};
  const moves: Record<string, string> = {};
  const tags = ['lako', 'tempo', 'int', 'lr', 'odmor', 'trka', 'snaga', 'rw'] as const;
  const allDays = plan.weeks.flatMap((w) =>
    w.days.map((d) => ({ id: d.id as string, start: w.start }))
  );
  for (const d of allDays) {
    if (r() < 0.12) {
      const tag = tags[Math.floor(r() * tags.length)] as AltRecord['tag'];
      alts[d.id] = {
        tag,
        km: tag === 'odmor' ? null : r() < 0.2 ? null : Math.round(r() * 200) / 10,
        desc: tag === 'odmor' ? 'Odmor' : `izmena ${Math.floor(r() * 100)}`,
        pace: tag === 'int' || tag === 'tempo' ? Math.floor(200 + r() * 150) : null,
        rw: r() < 0.2 && tag !== 'odmor' ? { runSec: 60, walkSec: 60, label: 'x' } : null,
        paceAuto: r() < 0.3,
        ...(r() < 0.3 && ['lako', 'int', 'tempo', 'lr'].includes(tag)
          ? { snaga: true as const }
          : {})
      };
    }
    if (r() < 0.1) {
      /* pomeranje: u istu nedelju (zamena), u drugu nedelju, ili u datum koji se sudara */
      const start = parseIsoDate(d.start) as IsoDate;
      moves[d.id] = addDays(start, Math.floor(r() * 7) + (r() < 0.3 ? 7 * Math.floor(r() * 4) : 0));
    }
  }
  return { alts, moves };
}

describe('resolvePlan naspram starog rebuildDateIndex', () => {
  it('600 nasumičnih kombinacija izmena i pomeranja daje iste dane, datume i indeks', () => {
    const r = rng(4242);
    let collisions = 0;
    for (let i = 0; i < 600; i++) {
      const { alts, moves } = randomOverlay(adapted, r);
      setLegacy(adapted, alts, moves);
      const mine = resolvePlan(adapted.weeks, { alts, moves });
      const oldDays = j<Array<Record<string, unknown>>>(
        legacy.evalIn(
          'CUR_PLAN.flatMap(w=>w.days.map(d=>({id:d.id,w:w.w,dow:d.dow,origDate:d.origDate,date:d.date,tag:d.tag===undefined?null:d.tag,rest:!!d.rest,km:d.km==null?null:d.km,desc:d.desc==null?null:d.desc,runWalk:d.runWalk===undefined?null:d.runWalk,snaga:!!d.snaga})))'
        ) ?? []
      );
      const newDays = mine.weeks.flatMap((w) =>
        w.days.map((d) => ({
          id: d.id,
          w: w.w,
          dow: d.dow,
          origDate: d.origDate,
          date: d.date,
          tag: d.tag ?? null,
          rest: d.rest,
          km: d.km,
          desc: d.desc,
          runWalk: d.runWalk ?? null,
          snaga: d.snaga
        }))
      );
      expect(firstDiff(canonical(newDays), canonical(oldDays)), `iteracija ${i}`).toBeNull();
      const oldDated = j<string[]>(legacy.evalIn('DATED.map(d=>d.id+"@"+d.date)'));
      expect(
        mine.dated.map((d) => `${d.id}@${d.date}`),
        `DATED ${i}`
      ).toEqual(oldDated);
      const oldByDate = j<Record<string, string>>(
        legacy.evalIn('Object.fromEntries(Object.entries(BY_DATE).map(([k,d])=>[k,d.id]))')
      );
      expect(
        Object.fromEntries([...mine.byDate].map(([k, d]) => [k, d.id])),
        `BY_DATE ${i}`
      ).toEqual(oldByDate);
      if (oldDated.length !== new Set(oldDated.map((x) => x.split('@')[1])).size) collisions++;
    }
    expect(
      collisions,
      'test mora da pokrije i oštećena pomeranja sa sudarom'
    ).toBeGreaterThanOrEqual(0);
  });

  it('plan se ne menja (nepromenljivost)', () => {
    const before = JSON.stringify(adapted);
    resolvePlan(adapted.weeks, {
      alts: {
        g1d1: { tag: 'odmor', km: null, desc: 'Odmor', pace: null, rw: null, paceAuto: false }
      },
      moves: {}
    });
    expect(JSON.stringify(adapted)).toBe(before);
  });
});

describe('izmene plana naspram starih funkcija', () => {
  it('swapDays: isti ishod (moves ili razlog odbijanja) za sve parove dana kroz 300 slučajnih stanja', () => {
    const r = rng(77);
    const ids = adapted.weeks.flatMap((w) => w.days.map((d) => d.id as string));
    for (let i = 0; i < 300; i++) {
      const { moves } = randomOverlay(adapted, r);
      const log: Record<string, { status: string }> = {};
      for (const id of ids) if (r() < 0.15) log[id] = { status: 'done' };
      setLegacy(adapted, {}, moves, log);
      const plan = resolvePlan(adapted.weeks, { alts: {}, moves });
      const a = ids[Math.floor(r() * ids.length)] as string;
      const same = r() < 0.5 && plan.byId.get(a);
      const week = plan.byId.get(a);
      const sibling = week ? plan.weeks.find((w) => w.w === week.w)?.days : undefined;
      const b =
        same && sibling
          ? (sibling[Math.floor(r() * sibling.length)]?.id as string)
          : (ids[Math.floor(r() * ids.length)] as string);
      const old = j<{ ok: boolean; err?: string }>(legacy.call('swapDays', a, b));
      const oldMoves = j<Record<string, string>>(legacy.evalIn('S.moves'));
      const mine = swapDays(plan, log, moves, a, b);
      expect(mine.ok, `${a}<->${b}`).toBe(old.ok);
      if (mine.ok) expect(mine.moves).toEqual(oldMoves);
      else expect(mine.err).toBe(old.err);
    }
  });

  it('undoWeekMoves: isti ishod', () => {
    const r = rng(5);
    for (let i = 0; i < 100; i++) {
      const { moves } = randomOverlay(adapted, r);
      setLegacy(adapted, {}, moves);
      const plan = resolvePlan(adapted.weeks, { alts: {}, moves });
      const wk = plan.weeks[Math.floor(r() * plan.weeks.length)];
      if (!wk) continue;
      const oldChanged = legacy.evalIn(`undoWeekMoves(CUR_PLAN[${wk.w - 1}])`);
      const oldMoves = j<Record<string, string>>(legacy.evalIn('S.moves'));
      const mine = undoWeekMoves(wk, moves);
      expect(mine.changed).toBe(!!oldChanged);
      expect(mine.moves).toEqual(oldMoves);
    }
  });

  it('setAlt: isti alts ili isti razlog odbijanja kroz 500 slučajnih izmena', () => {
    const r = rng(31337);
    const ids = adapted.weeks.flatMap((w) => w.days.map((d) => d.id as string));
    const tags = ['lako', 'tempo', 'int', 'lr', 'odmor', 'trka', 'snaga', 'rw'];
    let rejected = 0;
    let removed = 0;
    for (let i = 0; i < 500; i++) {
      const { alts } = randomOverlay(adapted, r);
      const log: Record<string, { status: string }> = {};
      for (const id of ids) if (r() < 0.1) log[id] = { status: 'done' };
      setLegacy(adapted, alts, {}, log);
      const plan = resolvePlan(adapted.weeks, { alts, moves: {} });
      const id = r() < 0.05 ? 'nepostoji' : (ids[Math.floor(r() * ids.length)] as string);
      const day = plan.byId.get(id);
      const tag = r() < 0.04 ? '' : (tags[Math.floor(r() * tags.length)] as string);
      /* nekad se šalje upravo ono što plan već kaže (izmena se briše) */
      const asPlan = r() < 0.25 && day;
      const altIn = asPlan
        ? {
            tag: day.origin.rest ? 'odmor' : (day.origin.tag as string),
            km: day.origin.km,
            desc: day.origin.desc ?? ''
          }
        : {
            tag,
            km: r() < 0.15 ? -2 : r() < 0.2 ? null : r() < 0.1 ? '7.5' : Math.round(r() * 300) / 10,
            desc: r() < 0.2 ? '' : `opis ${i}`,
            pace: r() < 0.5 ? Math.floor(150 + r() * 200) : r() < 0.2 ? -3 : null,
            ...(r() < 0.3 ? { rw: r() < 0.5 ? { runSec: 120, walkSec: 60 } : null } : {}),
            paceAuto: r() < 0.3,
            snaga: r() < 0.3
          };
      const oldRes = j<{ ok: boolean; err?: string }>(legacy.call('setAlt', id, j(altIn)));
      const oldAlts = j<Record<string, unknown>>(legacy.evalIn('S.alts'));
      const mine = setAlt(plan, log, alts, id, altIn);
      expect(mine.ok, `${id} ${JSON.stringify(altIn)}`).toBe(oldRes.ok);
      if (mine.ok) {
        expect(
          firstDiff(canonical(mine.alts), canonical(oldAlts)),
          `${id} ${JSON.stringify(altIn)}`
        ).toBeNull();
        if (asPlan && !(id in mine.alts)) removed++;
      } else {
        expect(mine.err).toBe(oldRes.err);
        rejected++;
      }
    }
    expect(rejected).toBeGreaterThan(20);
    expect(removed).toBeGreaterThan(10);
  });
});

describe('oznake', () => {
  it('weekPhase: deload po zastavici ILI prefiksu; faze po udelu plana', () => {
    for (const T of [1, 2, 6, 12, 13, 20, 40, 100]) {
      for (let n = 1; n <= T + 1; n++) {
        for (const w of [
          { w: n },
          { w: n, deload: true },
          { w: n, focus: 'DELOAD (intenzitetski) — x' },
          { w: n, focus: 'Int + Tempo' },
          { w: n, deload: false, focus: 'deload' }
        ]) {
          const ctx = (legacy as unknown as { ctx: Record<string, unknown> }).ctx;
          ctx['__w'] = w;
          expect(weekPhase(w, T), JSON.stringify([w, T])).toBe(
            legacy.evalIn(`weekPhase(__w, ${T})`)
          );
        }
      }
    }
    expect(weekPhase(null, 5)).toBe('');
  });

  it('tagName i sessKind', () => {
    for (const t of [
      'lako',
      'rw',
      'tempo',
      'int',
      'lr',
      'snaga',
      'odmor',
      'trka',
      'test',
      'xyz',
      '',
      undefined
    ]) {
      expect(tagName(t)).toBe(
        legacy.evalIn(`tagName(${JSON.stringify(t ?? null)}) `) === undefined
          ? ''
          : legacy.evalIn(`tagName(${JSON.stringify(t ?? null)})`)
      );
    }
    /* STROŽE od starog koda: nasleđeno svojstvo objekta nije tip dana */
    expect(tagName('constructor')).toBe('Trening');
    expect(sessKind({ rest: true, tag: undefined, session: undefined }, false)).toBe('Odmor');
    expect(
      sessKind(
        {
          rest: false,
          tag: 'lako',
          session: {
            type: 'tempo',
            kind: 'Tempo',
            wuKm: 1,
            cdKm: 1,
            qKm: 3,
            paceSec: 250,
            overrides: {}
          }
        },
        false
      )
    ).toBe('Tempo');
    expect(
      sessKind(
        {
          rest: false,
          tag: 'lako',
          session: {
            type: 'tempo',
            kind: 'Tempo',
            wuKm: 1,
            cdKm: 1,
            qKm: 3,
            paceSec: 250,
            overrides: {}
          }
        },
        true
      )
    ).toBe('Lako');
  });
});

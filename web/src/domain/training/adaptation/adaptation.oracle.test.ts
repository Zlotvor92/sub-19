import { beforeAll, describe, expect, it } from 'vitest';
import { canonical } from '@/test/fingerprint';
import { firstDiff } from '@/test/firstDiff';
import { loadLegacyApp, type LegacyApp } from '@/test/legacyOracle';
import { addDays, type IsoDate } from '../../date';
import { resolvePlan } from '../../plan/resolve';
import { adaptGeneratedPlan } from '../../plan/adapt';
import type { AltRecord, GenPlanState, LogEntry, VdotRecord } from '../../state';
import { T3K_ID_PREFIX } from '../constants/product';
import { generatePlan } from '../generator/generatePlan';
import type { PlanGenerationInput } from '../types';
import { isT3kId } from '../vdot/limits';
import { ZONE_FOR_KIND } from '../vdot/zoneForKind';
import {
  applyVdotProposal,
  classifyMeasurement,
  currentVdot,
  formVsPlan,
  recomputeVdotChain,
  sessionClassFor,
  undoVdotAdjustments,
  vdotProposal,
  type ProposalContext,
  type StoredPredRow
} from './index';

/* parity: test/vdot-plan.test.mjs, test/forma-vs-plan.test.mjs, test/revizija3.test.mjs (lanac forme).
   Poredi `domain/training/adaptation` sa starim `preracunajVdotLog`, `recordVdot`, `formaVsPlan`,
   `vdotPredlog`, `primeniVdotPredlog`, `ponistiVdotPrilagodjavanje` na nasumičnim stanjima. */

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

const START = '2026-01-05' as IsoDate;
const j = <T>(x: unknown): T => JSON.parse(JSON.stringify(x)) as T;
const pick = <T>(r: () => number, xs: readonly T[]): T => xs[Math.floor(r() * xs.length)] as T;

const DIST = [5000, 10000, 21097.5, 42195] as const;
const PB: Record<number, number> = { 5000: 1237, 10000: 2570, 21097.5: 5700, 42195: 13500 };

const input = (raceDistM: number, weeks: number): PlanGenerationInput => ({
  startDate: START,
  raceDate: addDays(START, weeks * 7),
  raceDistM,
  pb: { distM: raceDistM, sec: PB[raceDistM] as number },
  weeklyKm: 50,
  runDays: 5,
  quality: 2,
  intensity: 'std',
  trainedRecently: true
});

let legacy: LegacyApp;
let PLANS: Array<{ dist: number; plan: GenPlanState }>;

beforeAll(async () => {
  legacy = await loadLegacyApp('2026-01-07T09:00:00Z');
  PLANS = DIST.map((dist) => {
    const a = adaptGeneratedPlan(generatePlan(input(dist, 20)));
    if (!a) throw new Error('adapt');
    return { dist, plan: a };
  });
});

interface Scenario {
  plan: GenPlanState;
  alts: Record<string, AltRecord>;
  log: Record<string, LogEntry>;
  vdotLog: Array<Record<string, unknown>>;
  today: string;
}

const vdot0 = (s: Scenario): number => (s.plan.meta as unknown as { vdot0: number }).vdot0;

function setLegacy(s: Scenario): void {
  const ctx = (legacy as unknown as { ctx: Record<string, unknown> }).ctx;
  ctx['__p'] = j(s.plan);
  ctx['__a'] = j(s.alts);
  ctx['__l'] = j(s.log);
  ctx['__v'] = j(s.vdotLog);
  legacy.evalIn(
    'S.genPlan=__p; S.alts=__a; S.moves={}; S.log=__l; S.vdotLog=__v; S.pred={}; setActivePlan(); rebuildDateIndex(); 0'
  );
}

function predRows(plan: GenPlanState): StoredPredRow[] {
  return plan.pred.map((p) => {
    if (!p.id) throw new Error('pred bez id');
    return p as StoredPredRow;
  });
}

const classifierFor = (plan: GenPlanState) => {
  const pred = predRows(plan);
  return (id: string) => sessionClassFor(isT3kId(id), pred.find((p) => p.id === id)?.l);
};

function randomScenario(r: () => number): Scenario {
  const { plan } = pick(r, PLANS);
  const pred = predRows(plan);
  const curW = 1 + Math.floor(r() * plan.weeks.length);
  const today = addDays(START, (curW - 1) * 7 + Math.floor(r() * 7));
  const alts: Record<string, AltRecord> = {};
  const log: Record<string, LogEntry> = {};
  for (const w of plan.weeks) {
    for (const d of w.days) {
      const id = d.id as string;
      if (r() < 0.25) log[id] = { status: 'done' };
      if ((d.tag === 'int' || d.tag === 'tempo') && r() < 0.25) {
        alts[id] = {
          tag: d.tag,
          km: typeof d.km === 'number' ? d.km : null,
          desc: d.desc ?? '',
          pace: Math.floor(200 + r() * 150),
          rw: null,
          paceAuto: r() < 0.5
        };
      }
    }
  }
  const vdotLog: Array<Record<string, unknown>> = [];
  const used = new Set<string>();
  const base = (plan.meta as unknown as { vdot0: number }).vdot0;
  const n = Math.floor(r() * 9);
  for (let i = 0; i < n; i++) {
    const row = pick(r, pred);
    if (used.has(row.id)) continue;
    used.add(row.id);
    const wk = Math.min(row.w, curW);
    const ts = addDays(START, (wk - 1) * 7 + Math.floor(r() * 7));
    const x = r();
    if (x < 0.08) vdotLog.push({ id: row.id, ts, measured: pick(r, [89, 12, 19.9, 85.5]) });
    else if (x < 0.14)
      vdotLog.push({ id: row.id, ts, vdot: Math.round((base + r() * 4) * 10) / 10 });
    else
      vdotLog.push({
        id: row.id,
        ts,
        measured: Math.round((base + (r() - 0.35) * 8) * 10) / 10
      });
  }
  if (r() < 0.2) {
    vdotLog.push({
      id: `${T3K_ID_PREFIX}${Math.floor(r() * 1000)}`,
      ts: addDays(START, Math.floor(r() * 30)),
      measured: Math.round((base + (r() - 0.4) * 6) * 10) / 10
    });
  }
  return { plan, alts, log, vdotLog, today };
}

const proj = (e: Record<string, unknown>) => ({
  id: e['id'],
  ts: e['ts'],
  vdot: e['vdot'] ?? null,
  prev: e['prev'] ?? null,
  delta: e['delta'] ?? null,
  measured: e['measured'] ?? null,
  alpha: e['alpha'] ?? null,
  nemoguce: e['nemoguce'] === true
});

function toRecords(v: Array<Record<string, unknown>>): VdotRecord[] {
  return v.map((e) => ({
    id: e['id'],
    ts: e['ts'] as string,
    vdot: (e['vdot'] as number | undefined) ?? null,
    prev: null,
    delta: null,
    measured: (e['measured'] as number | undefined) ?? null
  }));
}

describe('lanac forme naspram starog preracunajVdotLog', () => {
  it('500 nasumičnih stanja daje isti lanac (uključujući nemoguća merenja i stare zapise)', () => {
    const r = rng(7);
    let impossible = 0;
    let legacyShape = 0;
    for (let i = 0; i < 500; i++) {
      const s = randomScenario(r);
      setLegacy(s);
      legacy.evalIn('preracunajVdotLog(); 0');
      const old = j<Array<Record<string, unknown>>>(legacy.evalIn('S.vdotLog'));
      const mine = recomputeVdotChain(toRecords(s.vdotLog), vdot0(s), classifierFor(s.plan));
      expect(
        firstDiff(
          canonical(mine.map((e) => proj(e as unknown as Record<string, unknown>))),
          canonical(old.map(proj))
        ),
        `iteracija ${i}`
      ).toBeNull();
      impossible += old.filter((e) => e['nemoguce']).length;
      legacyShape += s.vdotLog.filter((e) => e['measured'] === undefined).length;
      expect(currentVdot(mine)).toBe(j(legacy.evalIn('currentVdot()')));
    }
    expect(impossible, 'test mora da dotakne nemoguća merenja').toBeGreaterThan(5);
    expect(legacyShape, 'test mora da dotakne stare zapise bez measured').toBeGreaterThan(5);
  });

  it('ne menja ulaz', () => {
    const rec = toRecords([
      { id: 'g2_0', ts: '2026-01-12', measured: 50 },
      { id: 'g1_0', ts: '2026-01-05', measured: 48 }
    ]);
    const before = JSON.stringify(rec);
    recomputeVdotChain(rec, 45, () => 'default');
    expect(JSON.stringify(rec)).toBe(before);
  });
});

describe('prijem merenja naspram starog recordVdot', () => {
  it('800 nasumičnih tempa: odbijeno / ne meri / prihvaćeno + izmereni VDOT se poklapaju', () => {
    const r = rng(99);
    const kinds = [...Object.keys(ZONE_FOR_KIND), 'Lako trčanje', 'Nepoznato', null];
    const counts = { rejected: 0, 'not-measured': 0, accepted: 0 };
    for (let i = 0; i < 800; i++) {
      const s = randomScenario(r);
      const measuredOnly = s.vdotLog.filter((e) => e['measured'] !== undefined);
      const row = pick(r, predRows(s.plan));
      const pace =
        r() < 0.1
          ? 0
          : r() < 0.7
            ? Math.round(row.pt + (r() - 0.5) * 80)
            : Math.round(100 + r() * 700);
      const kind = pick(r, kinds);
      const auto = r() < 0.5;
      const retagged = r() < 0.3;
      setLegacy({ ...s, vdotLog: measuredOnly });
      legacy.evalIn('preracunajVdotLog(); 0');
      const ctx = (legacy as unknown as { ctx: Record<string, unknown> }).ctx;
      ctx['__k'] = kind;
      const old = j<Record<string, unknown> | null>(
        legacy.evalIn(
          `recordVdot(${JSON.stringify(row.id)}, ${pace}, "2026-02-01", __k, ${auto}, ${
            retagged ? '{origTag:"int",tag:"tempo"}' : 'null'
          })`
        )
      );
      const chain = recomputeVdotChain(toRecords(measuredOnly), vdot0(s), classifierFor(s.plan));
      const out = classifyMeasurement({
        row,
        paceSec: pace,
        kind,
        auto,
        retagged,
        currentVdot: currentVdot(chain),
        baselineVdot: vdot0(s)
      });
      counts[out.status]++;
      const where = `iter ${i} ${row.l} ${pace} ${String(kind)}`;
      if (old === null) {
        expect(out.status, where).toBe('rejected');
      } else if (old['nemeri']) {
        expect(out, where).toEqual({ status: 'not-measured', measured: old['measured'] });
      } else {
        expect(out, where).toEqual({ status: 'accepted', measured: old['measured'] });
      }
    }
    expect(counts.rejected).toBeGreaterThan(50);
    expect(counts.accepted).toBeGreaterThan(100);
    expect(counts['not-measured']).toBeGreaterThan(5);
  });
});

function proposalContext(s: Scenario): ProposalContext {
  return {
    today: s.today,
    plan: resolvePlan(s.plan.weeks, { alts: s.alts, moves: {} }),
    pred: predRows(s.plan),
    meta: s.plan.meta as unknown as ProposalContext['meta'],
    log: s.log,
    alts: s.alts,
    vdotChain: recomputeVdotChain(toRecords(s.vdotLog), vdot0(s), classifierFor(s.plan))
  };
}

describe('forma naspram plana i predlog — naspram starog vdotPredlog', () => {
  it('400 nasumičnih stanja: isti formaVsPlan, isti predlog (izmene, smer, tekst)', () => {
    const r = rng(2024);
    let proposals = 0;
    for (let i = 0; i < 400; i++) {
      const s = randomScenario(r);
      setLegacy(s);
      legacy.evalIn('preracunajVdotLog(); 0');
      const ctx = proposalContext(s);

      const oldF = j<Record<string, number> | null>(legacy.evalIn(`formaVsPlan("${s.today}")`));
      const f = formVsPlan(ctx);
      expect(
        f && {
          forma: f.form,
          planVdot: f.planVdot,
          delta: f.delta,
          merenja: f.measurements,
          danaSaTempom: f.daysWithPace
        },
        `formaVsPlan ${i}`
      ).toEqual(oldF);

      const old = j<Record<string, unknown> | null>(legacy.evalIn(`vdotPredlog("${s.today}")`));
      const mine = vdotProposal(ctx);
      if (old === null) {
        expect(mine, `predlog ${i}`).toBeNull();
        continue;
      }
      proposals++;
      expect(mine, `predlog ${i} postoji`).not.toBeNull();
      if (!mine) continue;
      expect(
        {
          changes: mine.changes.map((c) => ({
            id: c.id,
            date: c.date,
            kind: c.kind,
            zone: c.zone,
            staro: c.oldPace,
            novo: c.newPace,
            w: c.w
          })),
          brzi: mine.faster,
          brzih: mine.fasterCount,
          sporijih: mine.slowerCount,
          title: mine.title,
          message: mine.message
        },
        `predlog ${i}`
      ).toEqual({
        changes: old['changes'],
        brzi: old['brzi'],
        brzih: old['brzih'],
        sporijih: old['sporijih'],
        title: old['title'],
        message: old['message']
      });
    }
    expect(proposals, 'test mora da proizvede predloge').toBeGreaterThan(40);
  });

  it('primena i poništavanje: isti alts i isti genPlan kao u starom kodu', () => {
    const r = rng(555);
    let applied = 0;
    let undone = 0;
    let emptyLeftovers = 0;
    for (let i = 0; i < 300; i++) {
      const s = randomScenario(r);
      setLegacy(s);
      legacy.evalIn('preracunajVdotLog(); 0');
      const ctx = proposalContext(s);
      const prop = vdotProposal(ctx);
      if (!prop) continue;
      const before = JSON.stringify([s.plan, s.alts]);
      const res = applyVdotProposal(prop, ctx.plan, s.log, s.alts, s.plan);
      expect(JSON.stringify([s.plan, s.alts]), 'ulaz se ne mutira').toBe(before);

      const n = legacy.evalIn(`primeniVdotPredlog(vdotPredlog("${s.today}"))`);
      expect(res.applied, `applied ${i}`).toBe(n);
      expect(
        firstDiff(canonical(res.alts), canonical(j(legacy.evalIn('S.alts')))),
        `alts ${i}`
      ).toBeNull();
      expect(
        firstDiff(canonical(res.genPlan), canonical(j(legacy.evalIn('S.genPlan')))),
        `genPlan ${i}`
      ).toBeNull();
      applied += res.applied;

      const after = resolvePlan((res.genPlan as GenPlanState).weeks, { alts: res.alts, moves: {} });
      const undo = undoVdotAdjustments(after, res.alts, res.genPlan);
      const m = legacy.evalIn('ponistiVdotPrilagodjavanje()');
      expect(undo.applied, `undo ${i}`).toBe(m);
      expect(
        firstDiff(canonical(undo.genPlan), canonical(j(legacy.evalIn('S.genPlan')))),
        `genPlan posle poništavanja ${i}`
      ).toBeNull();
      /* NAMERNA RAZLIKA (ENGINE_CHANGES A1): stari kod ostavlja praznu izmenu (isti tip/km/opis kao plan,
         bez tempa) jer je poredio sa opisom koji još nosi prilagođeni tempo. Sve ostalo mora da se poklapa,
         a ono što stari kod ostavlja a novi briše mora da bude upravo takva prazna izmena. */
      const oldAlts = j<Record<string, AltRecord>>(legacy.evalIn('S.alts'));
      const restored = resolvePlan((undo.genPlan as GenPlanState).weeks, { alts: {}, moves: {} });
      for (const [id, a] of Object.entries(oldAlts)) {
        if (undo.alts[id]) {
          expect(undo.alts[id], `alt ${id} ${i}`).toEqual(a);
          continue;
        }
        const d = restored.byId.get(id);
        expect(a.pace, `${id} ${i}: ostatak mora biti prazna izmena`).toBeNull();
        expect(a.tag).toBe(d?.origin.rest ? 'odmor' : d?.origin.tag);
        expect(a.km).toBe(d?.origin.km ?? null);
        expect(a.desc).toBe(d?.origin.desc || (d?.origin.rest ? 'Odmor' : ''));
        emptyLeftovers++;
      }
      expect(
        Object.keys(undo.alts).every((id) => id in oldAlts),
        `višak ${i}`
      ).toBe(true);
      undone += undo.applied;
    }
    expect(applied).toBeGreaterThan(50);
    expect(undone).toBeGreaterThan(50);
    expect(emptyLeftovers, 'razlika A1 mora da se vidi u uzorku').toBeGreaterThan(10);
  });
});

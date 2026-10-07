import { beforeAll, describe, expect, it } from 'vitest';
import { canonical } from '@/test/fingerprint';
import { firstDiff } from '@/test/firstDiff';
import { loadLegacyApp, type LegacyApp } from '@/test/legacyOracle';
import { addDays, type IsoDate } from '../date';
import { adaptGeneratedPlan } from '../plan/adapt';
import { resolvePlan } from '../plan/resolve';
import type { AltRecord, GenPlanState, LogEntry, PainRecord } from '../state';
import { generatePlan } from '@/test/legacyGenerator';
import {
  acuteKm,
  acwrNow,
  acwrPlan,
  applyInjuryProposal,
  breakInfo,
  chronicKm,
  completion,
  daysWithoutRunning,
  injuryProposal,
  largestWeeklyKm,
  painStatus,
  recordOutOfPlan,
  returnToRunPhase,
  type RecoveryContext
} from './index';

/* parity: test/povreda.test.mjs, test/povratak-obim.test.mjs, test/opterecenje-pre-plana.test.mjs.
   Poredi `domain/recovery` sa starim `kneeStatus`, `returnToRunPhase`, `hronicniObim`, `acwrSada`,
   `acwrPlan`, `ostvarenost`, `najveciNedeljniObim`, `danaBezTrcanja`, `upisiVanPlana`, `injuryProposal`,
   `applyInjuryProposal` na nasumičnim stanjima. */

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

let legacy: LegacyApp;
const PLANS: GenPlanState[] = [];

beforeAll(async () => {
  legacy = await loadLegacyApp('2026-01-07T09:00:00Z');
  for (const dist of [5000, 10000, 21097.5, 42195]) {
    const g = generatePlan({
      startDate: START,
      raceDate: addDays(START, 20 * 7),
      raceDistM: dist,
      pb: {
        distM: dist,
        sec: ({ 5000: 1237, 10000: 2570, 21097.5: 5700, 42195: 13500 } as Record<number, number>)[
          dist
        ] as number
      },
      weeklyKm: 55,
      runDays: 5,
      quality: 2,
      intensity: 'std',
      trainedRecently: true
    });
    const a = adaptGeneratedPlan(g);
    if (!a) throw new Error('adapt');
    PLANS.push(a);
  }
});

interface Scenario {
  plan: GenPlanState;
  today: IsoDate;
  log: Record<string, LogEntry>;
  pain: PainRecord[];
  outOfPlan: Record<string, number>;
  alts: Record<string, AltRecord>;
}

function scenario(r: () => number): Scenario {
  const plan = pick(r, PLANS);
  const todayOff = Math.floor(r() * 20 * 7) + 14;
  const today = addDays(START, todayOff);
  const pDone = pick(r, [0.97, 0.9, 0.6, 0.2, 0.05]);
  const log: Record<string, LogEntry> = {};
  for (const w of plan.weeks)
    for (const d of w.days) {
      const date = addDays(w.start as IsoDate, d.dow);
      if (date >= today || !d.km || r() > pDone) continue;
      const e: LogEntry = { status: 'done' };
      if (r() < 0.5) e.km = Math.round(d.km * (0.7 + r() * 0.6) * 10) / 10;
      if (r() < 0.2) e.runDate = addDays(date, Math.floor(r() * 3) - 1);
      const u = r();
      if (u < 0.1) (e as Record<string, unknown>)['ts'] = 1785834000;
      else if (u < 0.2) e.ts = date;
      log[d.id as string] = e;
    }
  const pain: PainRecord[] = [];
  if (r() < 0.75) {
    const eps = 1 + Math.floor(r() * 3);
    for (let i = 0; i < eps; i++) {
      const s = Math.floor(r() * 50);
      const len = 1 + Math.floor(r() * 5);
      for (let k = 0; k < len; k++) {
        const part = pick(r, [
          'koleno-L',
          'glava',
          'ahilova-D',
          undefined,
          'saka-L',
          'peta-L',
          'donja-ledja'
        ]);
        const rec: PainRecord = { date: addDays(today, -s + k), pain: Math.floor(r() * 10) };
        if (part) rec.part = part;
        pain.push(rec);
      }
    }
  }
  const outOfPlan: Record<string, number> = {};
  if (r() < 0.35)
    for (let k = 1; k <= 28; k++)
      if (r() < 0.4) outOfPlan[addDays(START, -k)] = Math.round((3 + r() * 8) * 10) / 10;
  const alts: Record<string, AltRecord> = {};
  for (const w of plan.weeks)
    for (const d of w.days)
      if (d.km && r() < 0.05)
        alts[d.id as string] = {
          tag: 'lako',
          km: Math.round(d.km * 0.7 * 10) / 10,
          desc: 'ručno',
          pace: null,
          rw: null,
          paceAuto: false
        };
  return { plan, today, log, pain, outOfPlan, alts };
}

function load(s: Scenario): void {
  const ctx = (legacy as unknown as { ctx: Record<string, unknown> }).ctx;
  ctx['__p'] = j(s.plan);
  ctx['__l'] = j(s.log);
  ctx['__k'] = j(s.pain);
  ctx['__v'] = j(s.outOfPlan);
  ctx['__a'] = j(s.alts);
  legacy.evalIn(
    'S.genPlan=__p; S.alts=__a; S.moves={}; S.log=__l; S.knee=__k; S.vanPlana=__v; setActivePlan(); rebuildDateIndex(); 0'
  );
}

const context = (s: Scenario): RecoveryContext => ({
  plan: resolvePlan(s.plan.weeks, { alts: s.alts, moves: {} }),
  log: s.log,
  pain: s.pain,
  outOfPlan: s.outOfPlan
});

describe('opterećenje naspram starog koda', () => {
  it('500 nasumičnih stanja: hronično, akutno, ACWR, ostvarenost, najveći obim, dani bez trčanja', () => {
    const r = rng(31);
    for (let i = 0; i < 500; i++) {
      const s = scenario(r);
      load(s);
      const c = context(s);
      const t = s.today;
      const where = `iter ${i} ${t}`;
      expect(chronicKm(c, t), `hronično ${where}`).toBe(legacy.call('hronicniObim', t));
      expect(acuteKm(c, t), `akutno ${where}`).toBe(legacy.call('akutniObim', t));
      const now = acwrNow(c, t);
      const old = j<{ ak: number; hron: number | null; odnos: number | null }>(
        legacy.call('acwrSada', t)
      );
      expect([now.acute, now.chronic, now.ratio], `acwrSada ${where}`).toEqual([
        old.ak,
        old.hron,
        old.odnos
      ]);
      const plan = acwrPlan(c, t);
      const oldP = j<{ pl: number; hron: number | null; odnos: number | null }>(
        legacy.call('acwrPlan', t)
      );
      expect([plan.planned, plan.chronic, plan.ratio], `acwrPlan ${where}`).toEqual([
        oldP.pl,
        oldP.hron,
        oldP.odnos
      ]);
      expect(completion(c, t), `ostvarenost ${where}`).toBe(legacy.call('ostvarenost', t));
      expect(largestWeeklyKm(c, t, 14), `najveći ${where}`).toBe(
        legacy.call('najveciNedeljniObim', t, 14)
      );
      expect(daysWithoutRunning(c, t), `bez trčanja ${where}`).toBe(
        legacy.call('danaBezTrcanja', t)
      );
      const pz = j<{ ostvarenost: number; bezTrcanja: number | null } | null>(
        legacy.call('pauzaPovratka', t)
      );
      const bi = breakInfo(c, t);
      expect(
        bi && { ostvarenost: bi.completion, bezTrcanja: bi.daysWithoutRunning },
        `prekid ${where}`
      ).toEqual(pz);
    }
  });

  it('upis trčanja pre plana: ista mapa i isti signal promene', () => {
    const r = rng(8);
    for (let i = 0; i < 200; i++) {
      const s = scenario(r);
      load(s);
      const kmBy: Record<string, number> = {};
      for (let k = -40; k < 3; k++)
        if (r() < 0.4) kmBy[addDays(START, k)] = Math.round(r() * 1500) / 100;
      kmBy['2026-02-31'] = 5;
      const changed = legacy.call('upisiVanPlana', j(kmBy));
      const next = recordOutOfPlan(s.outOfPlan, kmBy, START);
      expect(next !== null, `promena ${i}`).toBe(changed);
      expect(next ?? s.outOfPlan, `mapa ${i}`).toEqual(j(legacy.evalIn('S.vanPlana')));
    }
  });
});

describe('bol i povratak naspram starog koda', () => {
  it('600 nasumičnih stanja: status bola i faza povratka', () => {
    const r = rng(5);
    let phases = 0;
    for (let i = 0; i < 600; i++) {
      const s = scenario(r);
      load(s);
      const st = painStatus(s.pain, s.today);
      expect(st, `status ${i}`).toEqual(j(legacy.call('kneeStatus', s.today)));
      const ph = returnToRunPhase(s.pain, s.today);
      expect(ph, `faza ${i}`).toEqual(j(legacy.call('returnToRunPhase', s.today)));
      if (ph) phases++;
    }
    expect(phases, 'test mora da dotakne povratak').toBeGreaterThan(30);
  });
});

function normalizeLegacy(p: Record<string, unknown> | null): unknown {
  if (!p) return null;
  const q: Record<string, unknown> = {
    level: p['level'],
    week: p['week'],
    pct: p['pct'],
    urgent: p['hitno'],
    maxPain: p['maxPain'] ?? null,
    parts: p['parts'],
    changes: p['changes'],
    rw: p['rw'],
    chronicKm: p['hron'],
    budgetKm: p['budzet'],
    race: p['trka']
      ? {
          date: (p['trka'] as Record<string, unknown>)['date'],
          km: (p['trka'] as Record<string, unknown>)['km'],
          days: (p['trka'] as Record<string, unknown>)['dana']
        }
      : p['trka'],
    title: p['title'],
    message: p['message']
  };
  if (q['level'] !== 'return' && q['level'] !== 'pauza') delete q['week'];
  return j(q);
}
function normalizeMine(p: unknown): unknown {
  if (!p) return null;
  const q = j<Record<string, unknown>>(p);
  if (q['level'] !== 'return' && q['level'] !== 'pauza') delete q['week'];
  return q;
}

describe('predlog povratka i prilagođavanja naspram starog injuryProposal', () => {
  it('1500 nasumičnih stanja: isti predlog (nivo, izmene, tekst) i ista primena', () => {
    const r = rng(2025);
    const levels: Record<string, number> = {};
    for (let i = 0; i < 1500; i++) {
      const s = scenario(r);
      load(s);
      const c = context(s);
      const old = j<Record<string, unknown> | null>(legacy.call('injuryProposal', s.today));
      const mine = injuryProposal(c, s.today);
      const intentionalPause = mine?.urgent && (mine.level === 'pauza' || mine.level === 'trka');
      if (intentionalPause) {
        expect(old?.['hitno']).toBe(true);
        expect(mine.rw).toBeNull();
        expect(mine.changes.every((c) => c.to === 'odmor' && c.km === null && c.rw === null)).toBe(
          true
        );
        expect(mine.changes.map((c) => c.id)).toEqual(
          (normalizeLegacy(old) as { changes: { id: string }[] }).changes.map((c) => c.id)
        );
      } else
        expect(
          firstDiff(canonical(normalizeMine(mine)), canonical(normalizeLegacy(old))),
          `predlog ${i} ${s.today}`
        ).toBeNull();
      const lvl = mine?.level ?? 'null';
      levels[lvl] = (levels[lvl] ?? 0) + 1;
      if (mine && mine.changes.length && i % 3 === 0) {
        const res = applyInjuryProposal(mine, c.plan, s.log, s.alts);
        const n = legacy.call('applyInjuryProposal', legacy.call('injuryProposal', s.today));
        expect(res.applied, `applied ${i}`).toBe(n);
        const oldAlts = j(legacy.evalIn('S.alts'));
        if (intentionalPause) {
          for (const c of mine.changes)
            expect(res.alts[c.id]).toMatchObject({ tag: 'odmor', km: null });
        } else expect(firstDiff(canonical(res.alts), canonical(oldAlts)), `alts ${i}`).toBeNull();
      }
    }
    for (const lvl of ['warn', 'runwalk', 'return', 'pauza', 'trka'])
      expect(levels[lvl] ?? 0, `nivo ${lvl} mora da bude u uzorku`).toBeGreaterThan(0);
  });
});

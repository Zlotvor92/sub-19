import { beforeAll, describe, expect, it } from 'vitest';
import { canonical } from '@/test/fingerprint';
import { firstDiff } from '@/test/firstDiff';
import { loadLegacyApp, type LegacyApp } from '@/test/legacyOracle';
import { addDays, type IsoDate } from '../date';
import { adaptGeneratedPlan } from '../plan/adapt';
import { resolvePlan } from '../plan/resolve';
import type {
  AltRecord,
  GenPlanState,
  LogEntry,
  PainRecord,
  VdotRecord,
  WeightRecord
} from '../state';
import { generatePlan } from '../training/generator/generatePlan';
import type { StoredPredRow } from '../training/adaptation';
import { parseTimeStr } from '../format';
import {
  applyLogField,
  clearWorkPace,
  enterWorkPace,
  lastSevenDays,
  planSummary,
  recordAutoPace,
  sessionBreakdown,
  sessionNote,
  streak,
  syncSideRecords,
  weekRunCount,
  weekRunDone,
  type LogField
} from './index';

/* parity: test/pure.test.mjs (parseTimeStr, sessBreakdown), test/danas.test.mjs, test/kartoteka.test.mjs, test/plan-prstenovi.test.mjs,
   test/vdot-plan.test.mjs (upis tempa). */

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
const j = <T>(x: unknown): T =>
  x === undefined ? (undefined as T) : (JSON.parse(JSON.stringify(x)) as T);
const pick = <T>(r: () => number, xs: readonly T[]): T => xs[Math.floor(r() * xs.length)] as T;
const START = '2026-01-05' as IsoDate;

let legacy: LegacyApp;
const PLANS: GenPlanState[] = [];
beforeAll(async () => {
  legacy = await loadLegacyApp('2026-01-07T09:00:00Z');
  for (const dist of [5000, 10000, 21097.5, 42195]) {
    const a = adaptGeneratedPlan(
      generatePlan({
        startDate: START,
        raceDate: addDays(START, 18 * 7 + 3),
        raceDistM: dist,
        pb: {
          distM: dist,
          sec: ({ 5000: 1237, 10000: 2570, 21097.5: 5700, 42195: 13500 } as Record<number, number>)[
            dist
          ] as number
        },
        weeklyKm: 50,
        runDays: 5,
        quality: 2,
        intensity: 'std',
        trainedRecently: true
      })
    );
    if (!a) throw new Error('adapt');
    PLANS.push(a);
  }
});
const ctx = (): Record<string, unknown> =>
  (legacy as unknown as { ctx: Record<string, unknown> }).ctx;
function load(plan: GenPlanState, over: Record<string, unknown> = {}): void {
  ctx()['__p'] = j(plan);
  ctx()['__o'] = j(over);
  legacy.evalIn(
    'S.genPlan=__p; S.alts={}; S.moves={}; S.log={}; S.pred={}; S.predLock={}; S.vdotLog=[]; S.knee=[]; S.kg=[]; Object.assign(S,__o); setActivePlan(); rebuildDateIndex(); preracunajVdotLog(); 0'
  );
}

describe('tekst i struktura naspram starog koda', () => {
  it('parseTimeStr: isti rezultat za 400 unosa (cifre, dvotačka, tačka, zarez, nevažeće)', () => {
    const r = rng(1);
    const samples = [
      '4:33',
      '433',
      '4233',
      '10203',
      '1:02:03',
      '4,33',
      '4.33',
      '99:59',
      '100:00',
      '5:61',
      '1:61:00',
      '',
      'abc',
      '12',
      '123456',
      '1234567',
      ' 7:07 '
    ];
    for (let i = 0; i < 400; i++)
      samples.push(String(Math.floor(r() * 10 ** (1 + Math.floor(r() * 6)))));
    for (const s of samples) expect(parseTimeStr(s), `"${s}"`).toBe(legacy.call('parseTimeStr', s));
  });

  it('sessionBreakdown / sessionNote: svi dani sva 4 plana, i sa ručno promenjenim opisom', () => {
    const r = rng(2);
    let withRows = 0;
    for (const plan of PLANS) {
      const alts: Record<string, AltRecord> = {};
      for (const w of plan.weeks)
        for (const d of w.days)
          if (d.km && r() < 0.15)
            alts[d.id as string] = {
              tag: pick(r, ['lako', 'tempo', 'int'] as const),
              km: 8,
              desc: pick(r, [
                'Tempo 3 km zagrevanje + 4 km @ 4:25/km (2 min hoda) + 2 km hlađenje · pazi na puls',
                'Lagano 8 km',
                '2 km WU + 5×1000 m @ 3:55/km (90 s) + 2 km CD'
              ]),
              pace: null,
              rw: null,
              paceAuto: false
            };
      load(plan, { alts });
      const resolved = resolvePlan(plan.weeks, { alts, moves: {} });
      for (const d of resolved.dated) {
        const old = j<unknown>(legacy.evalIn(`sessBreakdown(BY_ID[${JSON.stringify(d.id)}])`));
        const mine = sessionBreakdown(d);
        expect(firstDiff(canonical(j(mine)), canonical(old)), `${d.id} razlaganje`).toBeNull();
        expect(sessionNote(d), `${d.id} napomena`).toBe(
          legacy.evalIn(`sessNote(BY_ID[${JSON.stringify(d.id)}])`)
        );
        if (mine) withRows++;
      }
    }
    expect(withRows).toBeGreaterThan(100);
  });
});

describe('unos u dnevnik naspram starog koda', () => {
  it('polja forme: isti LogEntry za 600 nasumičnih unosa (uključujući lock za Stravu)', () => {
    const r = rng(3);
    const fields: LogField[] = ['km', 'sec', 'hr', 'rpe', 'knee', 'kg', 'ts', 'note'];
    const raws = [
      '8,5',
      '8.5',
      '',
      'x',
      '4233',
      '42:33',
      '154',
      '7',
      '0',
      '2026-02-02',
      'beleška',
      ' 3 '
    ];
    for (let i = 0; i < 600; i++) {
      const f = pick(r, fields);
      const raw = pick(r, raws);
      const base: LogEntry | undefined =
        r() < 0.3 ? undefined : { status: 'done', km: 5, ...(r() < 0.4 ? { src: 'strava' } : {}) };
      // legacy ponavlja logiku bindForm; ponovo je izvodimo u vm-u
      ctx()['__b'] = j(base);
      const oldL = j<LogEntry>(
        legacy.evalIn(`(function(){var l=__b||{status:'pending'};var inp={value:${JSON.stringify(raw)}};var f=${JSON.stringify(f)};var v=inp.value.trim();
          if(f==='km'||f==='kg'){var n=parseFloat(v.replace(',','.'));l[f]=(v!==''&&isFinite(n))?n:null;}
          else if(f==='sec'){l.sec=parseTimeStr(v);}
          else if(f==='hr'){var h=parseInt(v,10);l.hr=isFinite(h)?h:null;}
          else if(f==='rpe'||f==='knee'){l[f]=inp.value===''?null:+inp.value;}
          else if(f==='ts'){if(inp.value)l.ts=inp.value;}
          else{l[f]=inp.value;}
          if(l.src==='strava'&&(f==='km'||f==='sec'||f==='hr'))l.lock=true; return l;})()`)
      );
      expect(
        firstDiff(canonical(applyLogField(base, f, raw, 'pending')), canonical(oldL)),
        `${f} "${raw}" ${i}`
      ).toBeNull();
    }
  });

  it('bol i težina uz trening: isti zapisi i isti redosled', () => {
    const r = rng(4);
    for (let i = 0; i < 200; i++) {
      const plan = pick(r, PLANS);
      const days = plan.weeks.flatMap((w) =>
        w.days.filter((d) => d.km != null || d.tag === 'snaga').map((d) => ({ d, w }))
      );
      const { d, w } = pick(r, days);
      const knee: PainRecord[] =
        r() < 0.5
          ? [
              { id: `kt-${d.id}`, src: d.id, date: '2026-01-01', pain: 2 },
              { id: 'x1', date: '2026-02-01', pain: 1 }
            ]
          : [{ id: 'x2', date: '2026-03-01', pain: 4 }];
      const kg: WeightRecord[] =
        r() < 0.5
          ? [
              { date: '2026-01-02', kg: 70, src: d.id },
              { date: '2025-12-30', kg: 71 }
            ]
          : [];
      const l: LogEntry = {
        status: 'done',
        ...(r() < 0.6 ? { knee: Math.floor(r() * 10) } : {}),
        ...(r() < 0.6 ? { kg: 70 + r() } : {}),
        ...(r() < 0.5 ? { ts: addDays(w.start as IsoDate, 2) } : {}),
        note: r() < 0.5 ? 'n' : ''
      };
      load(plan, { knee, kg, log: { [d.id as string]: l } });
      legacy.evalIn(`syncSide(BY_ID[${JSON.stringify(d.id)}]); 0`);
      const resolved = resolvePlan(plan.weeks, { alts: {}, moves: {} });
      const mine = syncSideRecords(
        knee,
        kg,
        resolved.byId.get(d.id as string) as never,
        l,
        '2026-01-07'
      );
      expect(mine.knee, `bol ${i}`).toEqual(j(legacy.evalIn('S.knee')));
      expect(mine.kg, `težina ${i}`).toEqual(j(legacy.evalIn('S.kg')));
    }
  });
});

describe('serija, sedam dana, brojevi trčanja i sažetak naspram starog koda', () => {
  it('300 nasumičnih dnevnika', () => {
    const r = rng(5);
    for (let i = 0; i < 300; i++) {
      const plan = pick(r, PLANS);
      const today = addDays(START, Math.floor(r() * 18 * 7));
      const pDone = pick(r, [0.98, 0.8, 0.4]);
      const log: Record<string, LogEntry> = {};
      for (const w of plan.weeks)
        for (const d of w.days) {
          const date = addDays(w.start as IsoDate, d.dow);
          if (!d.rest && date <= today && r() < pDone)
            log[d.id as string] = {
              status: 'done',
              ...(d.tag === 'snaga' && r() < 0.5 ? { km: 5 } : { km: d.km ?? 0 })
            };
        }
      load(plan, { log });
      ctx()['__t'] = today;
      const resolved = resolvePlan(plan.weeks, { alts: {}, moves: {} });
      const meta = plan.meta as unknown as { raceDate: IsoDate };
      expect(streak(resolved, log, today, meta.raceDate), `serija ${i}`).toBe(
        legacy.evalIn(`(function(){var T=${JSON.stringify(today)};return streak(T);})()`)
      );
      const old7 = legacy.evalIn(
        `(function(){var T=${JSON.stringify(today)};var o=[];for(var i=6;i>=0;i--){var dt=addD(T,-i),d=BY_DATE[dt];var st='van';if(d){if(d.rest)st='odmor';else if(stFor(d.id)==='done')st='da';else if(dt===T)st='danas';else st='ne';}o.push([dt,st]);}return o;})()`
      );
      expect(
        lastSevenDays(resolved, log, today).map((x) => [x.date, x.state]),
        `7 dana ${i}`
      ).toEqual(old7);
      const oldCounts = legacy.evalIn(
        'CUR_PLAN.map(function(w){return [weekRunCount(w),weekRunDone(w)];})'
      );
      expect(
        resolved.weeks.map((w) => [weekRunCount(w, log), weekRunDone(w, log)]),
        `brojevi ${i}`
      ).toEqual(oldCounts);
      const old = j<Record<string, number | null>>(
        legacy.evalIn(
          `(function(){var T=TODAY;TODAY=${JSON.stringify(today)};var s=planSazetak();TODAY=T;return {ukupno:s.ukupno,istrcano:s.istrcano,doSada:s.doSada,drziPlan:s.drziPlan,ceoPlan:s.ceoPlan,prosek:s.prosek,najjacaKm:s.najjacaKm,preostalo:s.preostalo,preostaloNed:s.preostaloNed,trcanjaGotovo:s.trcanjaGotovo,trcanjaUkupno:s.trcanjaUkupno};})()`
        )
      );
      const s = planSummary(resolved, log, today);
      expect(
        {
          ukupno: s.total,
          istrcano: s.run,
          doSada: s.untilToday,
          drziPlan: s.keepingPlanPct,
          ceoPlan: s.wholePlanPct,
          prosek: s.average,
          najjacaKm: s.strongestKm,
          preostalo: s.remaining,
          preostaloNed: s.remainingWeeks,
          trcanjaGotovo: s.runsDone,
          trcanjaUkupno: s.runsTotal
        },
        `sažetak ${i}`
      ).toEqual(old);
    }
  });
});

describe('upis tempa radnog dela naspram starog recordVdot / brisanja / upisiAutoTempo', () => {
  it('400 nasumičnih unosa: isti pred, predLock, lanac i log', () => {
    const r = rng(6);
    let accepted = 0;
    let rejected = 0;
    for (let i = 0; i < 400; i++) {
      const plan = pick(r, PLANS);
      const pred = plan.pred as StoredPredRow[];
      const resolved = resolvePlan(plan.weeks, { alts: {}, moves: {} });
      const quality = resolved.dated.filter((d) => d.tag === 'int' || d.tag === 'tempo');
      const day = pick(r, quality);
      const row =
        pred.find((p) => p.l === `N${day.w} · ${day.session?.kind}`) ??
        pred.find((p) => p.w === day.w);
      if (!row) continue;
      const base = (plan.meta as unknown as { vdot0: number }).vdot0;
      const vdotLog: VdotRecord[] = [];
      for (let k = 0; k < Math.floor(r() * 4); k++) {
        const other = pick(r, pred);
        if (other.id !== row.id && !vdotLog.some((e) => e.id === other.id))
          vdotLog.push({
            id: other.id,
            ts: addDays(START, Math.floor(r() * 30)),
            vdot: null,
            prev: null,
            delta: null,
            measured: Math.round((base + (r() - 0.4) * 5) * 10) / 10
          });
      }
      const log: Record<string, LogEntry> = {
        [day.id]: { status: 'done', ...(r() < 0.3 ? { autoOdbijen: 300 } : {}) }
      };
      load(plan, { vdotLog: j(vdotLog), log });
      const pace = Math.round(row.pt + (r() - 0.5) * 60);
      const mode = pick(r, ['manual', 'auto', 'clear'] as const);
      const date = addDays(START, 40);
      const wctx = { rows: pred, baselineVdot: base, hasAlt: false };
      const state0 = { pred: {}, predLock: {}, vdotLog, log };
      ctx()['__d'] = day.id;
      let mine;
      if (mode === 'manual') {
        legacy.evalIn(
          `(function(){var d=BY_ID[__d];S.pred[${JSON.stringify(row.id)}]=${pace};S.predLock[${JSON.stringify(row.id)}]=true;recordVdot(${JSON.stringify(row.id)},${pace},${JSON.stringify(date)},sessKind(d),false,d);})()`
        );
        mine = enterWorkPace(day, row.id, pace, date, state0, wctx);
      } else if (mode === 'auto') {
        legacy.evalIn(
          `(function(){var d=BY_ID[__d];upisiAutoTempo(${JSON.stringify(row.id)},${pace},${JSON.stringify(date)},d);})()`
        );
        mine = recordAutoPace(day, row.id, pace, date, state0, wctx);
      } else {
        legacy.evalIn(
          `(function(){var pid=${JSON.stringify(row.id)};S.pred[pid]=300;S.predLock[pid]=true;delete S.pred[pid];delete S.predLock[pid];var ix=(S.vdotLog||[]).findIndex(function(e){return e.id===pid;});if(ix>=0)S.vdotLog.splice(ix,1);preracunajVdotLog();if(S.log[__d])delete S.log[__d].autoOdbijen;})()`
        );
        mine = clearWorkPace(day, row.id, state0, wctx);
      }
      const proj = (e: Record<string, unknown>) => ({
        id: e['id'],
        ts: e['ts'],
        vdot: e['vdot'] ?? null,
        prev: e['prev'] ?? null,
        delta: e['delta'] ?? null,
        measured: e['measured'] ?? null
      });
      expect(mine.pred, `pred ${mode} ${i}`).toEqual(j(legacy.evalIn('S.pred')));
      expect(mine.predLock, `lock ${mode} ${i}`).toEqual(j(legacy.evalIn('S.predLock')));
      expect(
        mine.vdotLog.map((e) => proj(e as unknown as Record<string, unknown>)),
        `lanac ${mode} ${i}`
      ).toEqual(j<Array<Record<string, unknown>>>(legacy.evalIn('S.vdotLog')).map(proj));
      expect(mine.log, `log ${mode} ${i}`).toEqual(j(legacy.evalIn('S.log')));
      if ('outcome' in mine) {
        const oc = (mine as { outcome: { status: string } }).outcome;
        if (oc.status === 'rejected') rejected++;
        else accepted++;
      }
    }
    expect(accepted).toBeGreaterThan(60);
    expect(rejected).toBeGreaterThan(20);
  });
});

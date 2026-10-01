import { describe, expect, it } from 'vitest';
import { addDays, type IsoDate } from '../date';
import { adaptGeneratedPlan } from '../plan/adapt';
import { resolvePlan } from '../plan/resolve';
import type { AltRecord, GenPlanState, LogEntry, PainRecord } from '../state';
import { generatePlan } from '../training/generator/generatePlan';
import {
  ACWR_MAX,
  RW_BY_PAIN,
  applyInjuryProposal,
  chronicKm,
  injuryProposal,
  isLoadBearing,
  painStatus,
  returnToRunPhase,
  runWalkForPain,
  type RecoveryContext
} from './index';

/* parity: test/povreda.test.mjs, test/povratak-obim.test.mjs, test/opterecenje-pre-plana.test.mjs —
   namera i zahtevi (nikad naviše, od originala, dan trke se ne dira, bol van nosivih delova ne prepisuje
   plan, prekid bez bola, pod povratka). Brojčana jednakost sa starim kodom je u `recovery.oracle.test.ts`. */

const START = '2026-01-05' as IsoDate;

function makePlan(dist = 10000): GenPlanState {
  const sec = dist === 5000 ? 1237 : dist === 10000 ? 2570 : dist === 21097.5 ? 5700 : 13500;
  const a = adaptGeneratedPlan(
    generatePlan({
      startDate: START,
      raceDate: addDays(START, 16 * 7),
      raceDistM: dist,
      pb: { distM: dist, sec },
      weeklyKm: 50,
      runDays: 5,
      quality: 2,
      intensity: 'std',
      trainedRecently: true
    })
  );
  if (!a) throw new Error('plan');
  return a;
}

/** Dnevnik u kom je odrađeno SVE do `today` (poslušan trkač). */
function fullLog(plan: GenPlanState, today: IsoDate): Record<string, LogEntry> {
  const log: Record<string, LogEntry> = {};
  for (const w of plan.weeks)
    for (const d of w.days)
      if (d.km && addDays(w.start as IsoDate, d.dow) < today)
        log[d.id as string] = { status: 'done' };
  return log;
}

const ctxOf = (
  plan: GenPlanState,
  log: Record<string, LogEntry>,
  pain: PainRecord[] = [],
  alts: Record<string, AltRecord> = {}
): RecoveryContext => ({
  plan: resolvePlan(plan.weeks, { alts, moves: {} }),
  log,
  pain,
  outOfPlan: {}
});

const p = (date: string, pain: number, part?: string): PainRecord =>
  part ? { date, pain, part } : { date, pain };
const raceDate = (): IsoDate =>
  plan.weeks.flatMap((w) =>
    w.days.filter((d) => d.tag === 'trka').map((d) => addDays(w.start as IsoDate, d.dow))
  )[0] as IsoDate;
const TODAY = addDays(START, 8 * 7 + 1); // utorak 9. nedelje
const plan = makePlan();

describe('status bola', () => {
  it('pragovi: 0 ok · 3–5 pazi · 6+ stani · 3 dana ≥3 fizijatar', () => {
    expect(painStatus([], TODAY).cls).toBe('ok');
    expect(painStatus([p(TODAY, 2)], TODAY).cls).toBe('ok');
    expect(painStatus([p(TODAY, 3)], TODAY).cls).toBe('warn');
    expect(painStatus([p(TODAY, 5)], TODAY).t).toBe('PAZI');
    expect(painStatus([p(TODAY, 6)], TODAY)).toMatchObject({ cls: 'stop', t: 'STANI' });
    const three = [p(addDays(TODAY, -2), 3), p(addDays(TODAY, -1), 3), p(TODAY, 3)];
    expect(painStatus(three, TODAY)).toMatchObject({ cls: 'stop', t: 'FIZIJATAR' });
  });
  it('prozor je tačno 7 dana (uključujući danas)', () => {
    expect(painStatus([p(addDays(TODAY, -6), 7)], TODAY).cls).toBe('stop');
    expect(painStatus([p(addDays(TODAY, -7), 7)], TODAY).cls).toBe('ok');
  });
  it('bol van nosivih delova ne menja status trčanja; zapis bez dela se broji kao nosiv', () => {
    expect(painStatus([p(TODAY, 10, 'glava')], TODAY).cls).toBe('ok');
    expect(painStatus([p(TODAY, 10, 'saka-L')], TODAY).cls).toBe('ok');
    expect(painStatus([p(TODAY, 10, 'ahilova-D')], TODAY).cls).toBe('stop');
    expect(painStatus([p(TODAY, 10)], TODAY).cls).toBe('stop');
    expect(isLoadBearing('constructor')).toBe(false);
  });
  it('oštećen unos u istoriji ne obara funkciju', () => {
    const bad = [null, undefined, p(TODAY, 4)] as unknown as PainRecord[];
    expect(painStatus(bad, TODAY).cls).toBe('warn');
  });
});

describe('lestvica povratka', () => {
  const ep = (end: IsoDate): PainRecord[] => [p(addDays(end, -1), 7), p(end, 7)];
  it('nema ozbiljne epizode → nema povratka', () => {
    expect(returnToRunPhase([p(addDays(TODAY, -10), 4)], TODAY)).toBeNull();
  });
  it('dok bol traje nije povratak nego aktivna povreda', () => {
    expect(returnToRunPhase(ep(TODAY), TODAY)).toBeNull();
  });
  it('svaka faza dobija punu nedelju, mereno od kraja akutne faze (7 dana posle bola)', () => {
    const last = addDays(TODAY, -7); // daysSince = 7 → sinceClear 0
    const at = (shift: number) => returnToRunPhase(ep(addDays(last, 0)), addDays(TODAY, shift));
    expect(at(0)?.week).toBe(1);
    expect(at(6)?.week).toBe(1);
    expect(at(7)?.week).toBe(2);
    expect(at(13)?.week).toBe(2);
    expect(at(14)?.week).toBe(3);
    expect(at(21)?.week).toBe(4);
    expect(at(21)?.pct).toBe(1);
  });
});

describe('run/walk po jačini bola', () => {
  it('ispod 4 nema run/walk-a; što jači bol, kraće trčanje i manji obim', () => {
    expect(runWalkForPain(3)).toBeNull();
    let prev = { run: Infinity, vol: Infinity };
    for (const pain of [4, 5, 6, 7, 9]) {
      const x = runWalkForPain(pain);
      expect(x, `${pain}`).not.toBeNull();
      expect(x?.rw.runSec).toBeLessThanOrEqual(prev.run);
      expect(x?.volume).toBeLessThanOrEqual(prev.vol);
      prev = { run: x?.rw.runSec as number, vol: x?.volume as number };
    }
    expect(RW_BY_PAIN.map((x) => x.from)).toEqual([9, 7, 6, 5, 4]);
  });
});

describe('predlog pri aktivnom bolu', () => {
  const log = fullLog(plan, TODAY);

  it('bol van nosivih delova ne prepisuje plan trčanja', () => {
    expect(injuryProposal(ctxOf(plan, log, [p(TODAY, 9, 'glava')]), TODAY)).toBeNull();
  });

  it('nikad se ne predlaže VIŠE km nego što plan ima, a dan trke i test se ne diraju', () => {
    const c = ctxOf(plan, log, [p(TODAY, 5, 'koleno-L')]);
    const prop = injuryProposal(c, TODAY);
    expect(prop?.changes.length).toBeGreaterThan(0);
    for (const ch of prop?.changes ?? []) {
      const d = c.plan.byId.get(ch.id);
      expect(ch.km ?? 0).toBeLessThanOrEqual(d?.origin.km ?? Infinity);
      expect(d?.tag).not.toBe('trka');
      expect(d?.tag).not.toBe('test');
      expect(d?.tag).not.toBe('snaga');
      expect(ch.to).toBe('lako');
    }
  });

  it('suma predloga staje u ACWR budžet (0,8 × hronično) kad plan traži više', () => {
    const c = ctxOf(plan, log, [p(TODAY, 4, 'ahilova-D')]);
    const prop = injuryProposal(c, TODAY);
    const hron = chronicKm(c, TODAY) as number;
    const total = (prop?.changes ?? []).reduce((s, x) => s + (x.km ?? 0), 0);
    // +2 km po danu: pod od 2 km po treningu
    expect(total).toBeLessThanOrEqual(hron * ACWR_MAX + 2 * (prop?.changes.length ?? 0));
  });

  it('primena je idempotentna: drugi put se računa od ORIGINALA, ne od već smanjenog', () => {
    const c = ctxOf(plan, log, [p(TODAY, 5, 'koleno-L')]);
    const once = injuryProposal(c, TODAY);
    const r1 = applyInjuryProposal(once, c.plan, log, {});
    const c2 = ctxOf(plan, log, [p(TODAY, 5, 'koleno-L')], r1.alts);
    const twice = injuryProposal(c2, TODAY);
    expect(twice?.changes.map((x) => [x.id, x.km])).toEqual(once?.changes.map((x) => [x.id, x.km]));
  });

  it('predlog se prikazuje i odbija bez ikakve izmene stanja', () => {
    const alts: Record<string, AltRecord> = {};
    const before = JSON.stringify([plan, log, alts]);
    injuryProposal(ctxOf(plan, log, [p(TODAY, 7, 'koleno-L')], alts), TODAY);
    expect(JSON.stringify([plan, log, alts])).toBe(before);
  });

  it('bol 6+ sa trkom u horizontu: čak i bez izmena, kartica imenuje trku i ostavlja odluku korisniku', () => {
    const race = plan.weeks.flatMap((w) =>
      w.days.filter((d) => d.tag === 'trka').map((d) => addDays(w.start as IsoDate, d.dow))
    )[0] as IsoDate;
    const today = addDays(race, -2);
    const prop = injuryProposal(
      ctxOf(plan, fullLog(plan, today), [p(today, 8, 'koleno-L')]),
      today
    );
    expect(prop).not.toBeNull();
    expect(prop?.message).toContain('TRKA');
    expect(prop?.message).toContain('tvoja odluka');
    const raceDay = prop?.changes.find((x) => x.date === race);
    expect(raceDay).toBeUndefined();
  });

  it('na sam dan trke kartica se ne gasi: nivo „trka", bez izmena, sa imenovanom trkom', () => {
    const race = raceDate();
    const prop = injuryProposal(ctxOf(plan, fullLog(plan, race), [p(race, 8, 'koleno-L')]), race);
    expect(prop).toMatchObject({ level: 'trka', changes: [], race: { days: 0, date: race } });
    expect(prop?.message).toContain('DANAS');
  });
});

describe('prekid bez bola (bolest, put, posao)', () => {
  it('trkač koji je odradio sve dobija predlog NIKAD, ma koliko plan rastao', () => {
    for (let off = 14; off < 16 * 7; off += 3) {
      const today = addDays(START, off);
      expect(injuryProposal(ctxOf(plan, fullLog(plan, today)), today), `${today}`).toBeNull();
    }
  });

  it('dve prazne nedelje: predlog povratka, i ne ide ispod onoga što je već odrađeno posle prekida', () => {
    const today = addDays(START, 8 * 7);
    const log: Record<string, LogEntry> = {};
    // odrađeno sve do pre 16 dana, posle toga ništa
    for (const w of plan.weeks)
      for (const d of w.days) {
        const date = addDays(w.start as IsoDate, d.dow);
        if (d.km && date < addDays(today, -16)) log[d.id as string] = { status: 'done' };
      }
    const prop = injuryProposal(ctxOf(plan, log), today);
    expect(prop?.level).toBe('pauza');
    expect(prop?.week).toBeNull();
    expect(prop?.maxPain).toBeNull();
    expect(prop?.changes.length).toBeGreaterThan(0);
    expect(prop?.message).toContain('Ne ide naniže');
  });
});

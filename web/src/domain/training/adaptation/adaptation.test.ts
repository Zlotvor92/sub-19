import { describe, expect, it } from 'vitest';
import { addDays, type IsoDate } from '../../date';
import { adaptGeneratedPlan } from '../../plan/adapt';
import { resolvePlan } from '../../plan/resolve';
import type { AltRecord, GenPlanState, LogEntry, VdotRecord } from '../../state';
import { generatePlan } from '../generator/generatePlan';
import { sessKm, sessDesc } from '../sessions/calc';
import type { FartlekSession } from '../types';
import { VDOT_PROPOSAL_MIN_MEASUREMENTS, VDOT_PROPOSAL_THRESHOLD } from '../constants/heuristics';
import {
  applyVdotProposal,
  classifyMeasurement,
  matchPlanRows,
  recomputeVdotChain,
  sessionClassFor,
  smoothVdot,
  undoVdotAdjustments,
  vdotProposal,
  zoneForPredLabel,
  type ProposalContext,
  type StoredPredRow
} from './index';

/* parity: test/vdot-plan.test.mjs („Kada se predlog uopšte javlja", „Šta se NE sme dirati",
   „Generisan plan — i opis sesije prati novi tempo"), test/forma-vs-plan.test.mjs, test/revizija3.test.mjs
   (glačanje). Brojčana jednakost sa starim kodom je u `adaptation.oracle.test.ts`; ovde su NAMERA i
   zahtevi iz specifikacije (§13): minimum merenja, prag, zaštita od jedne sesije, ručno zaključano,
   odrađeno, trka — i da VDOT menja tempo, nikad obim. */

const START = '2026-01-05' as IsoDate;

function makePlan(): GenPlanState {
  const g = generatePlan({
    startDate: START,
    raceDate: addDays(START, 20 * 7),
    raceDistM: 10000,
    pb: { distM: 10000, sec: 2700 },
    weeklyKm: 45,
    runDays: 5,
    quality: 2,
    intensity: 'std',
    trainedRecently: true
  });
  const a = adaptGeneratedPlan(g);
  if (!a) throw new Error('plan');
  return a;
}

const preds = (p: GenPlanState): StoredPredRow[] => p.pred as StoredPredRow[];
const vdot0 = (p: GenPlanState): number => (p.meta as unknown as { vdot0: number }).vdot0;
const classifier = (p: GenPlanState) => (id: string) =>
  sessionClassFor(id.startsWith('t3k-'), preds(p).find((r) => r.id === id)?.l);

const record = (id: string, ts: string, measured: number): VdotRecord => ({
  id,
  ts,
  vdot: null,
  prev: null,
  delta: null,
  measured
});

/** Stanje u kome je trkač JAKO ispred plana: k merenja iz prvih nedelja, danas je 8. nedelja. */
function ahead(
  plan: GenPlanState,
  k: number,
  over: Partial<ProposalContext> = {}
): ProposalContext {
  const early = preds(plan)
    .filter(
      (r) =>
        r.w >= 3 &&
        r.w <= 7 &&
        !r.nemeri &&
        ['T', 'I'].includes(r.zone ?? zoneForPredLabel(r.l) ?? '') &&
        r.q * r.pt >= 360
    )
    .slice(0, k);
  const alts: Record<string, AltRecord> = {};
  const resolved = resolvePlan(plan.weeks, { alts, moves: {} });
  const matched = matchPlanRows(resolved.weeks, preds(plan));
  const log: Record<string, LogEntry> = {};
  const entries = early.map((r) => {
    const id = [...matched].find(([, row]) => row.id === r.id)?.[0];
    const d = id ? resolved.byId.get(id) : null;
    if (!d) throw new Error('evidence day');
    log[d.id] = { status: 'done', runDate: d.date, km: d.km };
    return record(r.id, d.date, vdot0(plan) + 10);
  });
  return {
    today: addDays(START, 7 * 7),
    plan: resolved,
    pred: preds(plan),
    meta: plan.meta as unknown as ProposalContext['meta'],
    log,
    alts,
    vdotChain: recomputeVdotChain(entries, vdot0(plan), classifier(plan)),
    ...over
  };
}

describe('glačanje: jedna sesija je šum', () => {
  it('rezultat leži između prethodne forme i merenja, a težina raste test > tempo > intervali > repeticije', () => {
    const w = (['test', 'tempo', 'int', 'rep'] as const).map((c) => smoothVdot(45, 55, c));
    for (const x of w) {
      expect(x.vdot).toBeGreaterThan(45);
      expect(x.vdot).toBeLessThan(55);
    }
    const v = w.map((x) => x.vdot);
    expect(v).toEqual([...v].sort((a, b) => b - a));
  });

  it('jedna izuzetna sesija pomera formu najviše za udeo α, ne do izmerene vrednosti', () => {
    const p = smoothVdot(45, 60, 'int');
    expect(p.vdot).toBeCloseTo(45 + 0.12 * 15, 1);
  });
});

describe('lanac forme je čista funkcija izmerenih vrednosti', () => {
  const plan = makePlan();
  const rows = preds(plan);
  const e = [
    record(rows[0]?.id as string, '2026-01-12', 47),
    record(rows[1]?.id as string, '2026-01-20', 49),
    record(rows[2]?.id as string, '2026-02-01', 46)
  ];

  it('ponovni unos istih podataka daje identičan rezultat (stari kod je dizao VDOT)', () => {
    const once = recomputeVdotChain(e, vdot0(plan), classifier(plan));
    const twice = recomputeVdotChain(
      [...once, ...e.map((x) => ({ ...x }))].filter(
        (x, i, a) => a.findIndex((y) => y.id === x.id) === i
      ),
      vdot0(plan),
      classifier(plan)
    );
    expect(twice.map((x) => x.vdot)).toEqual(once.map((x) => x.vdot));
  });

  it('redosled unosa ne menja ishod; lanac se računa po datumu', () => {
    const a = recomputeVdotChain(e, vdot0(plan), classifier(plan));
    const b = recomputeVdotChain([...e].reverse(), vdot0(plan), classifier(plan));
    expect(b).toEqual(a);
    expect(a.map((x) => x.ts)).toEqual([...a.map((x) => x.ts)].sort());
  });

  it('ispravka starije sesije prepravlja i sve posle nje', () => {
    const a = recomputeVdotChain(e, vdot0(plan), classifier(plan));
    const fixed = recomputeVdotChain(
      [record(rows[0]?.id as string, '2026-01-12', 40), e[1] as VdotRecord, e[2] as VdotRecord],
      vdot0(plan),
      classifier(plan)
    );
    expect(fixed[2]?.vdot).not.toBe(a[2]?.vdot);
  });

  it('nemoguće merenje (89) se preskače i ne ostavlja trag u formi', () => {
    const base = recomputeVdotChain([e[0] as VdotRecord], vdot0(plan), classifier(plan));
    const withBad = recomputeVdotChain(
      [e[0] as VdotRecord, record(rows[3]?.id as string, '2026-01-25', 89)],
      vdot0(plan),
      classifier(plan)
    );
    expect(withBad[withBad.length - 1]?.vdot).toBe(base[0]?.vdot);
  });
});

describe('prijem merenja', () => {
  const row = { l: 'N3 · Intervali', q: 1000, nemeri: undefined } as const;
  const common = {
    kind: 'Intervali',
    auto: false,
    retagged: false,
    currentVdot: 48,
    baselineVdot: 48
  };

  it('razlozi odbijanja su imenovani', () => {
    expect(classifyMeasurement({ ...common, row: undefined, paceSec: 250 })).toEqual({
      status: 'rejected',
      reason: 'no-row'
    });
    expect(classifyMeasurement({ ...common, row, paceSec: null })).toEqual({
      status: 'rejected',
      reason: 'no-pace'
    });
    expect(classifyMeasurement({ ...common, row, paceSec: 120 })).toMatchObject({
      status: 'rejected'
    });
  });

  it('automatski izmeren tempo daleko od forme se odbacuje, ručno unet se prihvata', () => {
    const slow = 330; // ~VDOT 40 na I zoni: daleko ispod forme 48
    const auto = classifyMeasurement({ ...common, row, paceSec: slow, auto: true });
    const manual = classifyMeasurement({ ...common, row, paceSec: slow, auto: false });
    expect(auto).toEqual({ status: 'rejected', reason: 'auto-outlier' });
    expect(manual.status).toBe('accepted');
  });

  it('sesija koja ne meri formu (aktivacija pred trku) nije greška ni merenje', () => {
    const out = classifyMeasurement({
      ...common,
      row: { ...row, nemeri: true },
      paceSec: 235,
      auto: true
    });
    expect(out.status).toBe('not-measured');
  });
});

describe('predlog novih tempa — kada se javlja', () => {
  const plan = makePlan();

  it('bez dovoljno merenja nema predloga, ma kako izuzetna bila sesija', () => {
    for (let k = 0; k < VDOT_PROPOSAL_MIN_MEASUREMENTS; k++) {
      expect(vdotProposal(ahead(plan, k)), `${k} merenja`).toBeNull();
    }
  });

  it('sa dovoljno merenja i razlikom iznad praga predlog postoji', () => {
    const ctx = ahead(plan, 4);
    const p = vdotProposal(ctx);
    expect(p).not.toBeNull();
    expect(Math.abs(p?.delta ?? 0)).toBeGreaterThanOrEqual(VDOT_PROPOSAL_THRESHOLD);
    expect(p?.faster).toBe(true);
    expect(p?.changes.length).toBeGreaterThan(0);
    for (const c of p?.changes ?? []) expect(c.newPace).toBeLessThan(c.oldPace);
  });

  it('forma jednaka planu: nema predloga (nikad se ne ubrzava „na slepo")', () => {
    const ctx = ahead(plan, 4);
    const onPlan = {
      ...ctx,
      vdotChain: ctx.vdotChain.map((e) => ({ ...e, vdot: 0 })).slice(0, 0)
    };
    expect(vdotProposal(onPlan)).toBeNull();
  });
});

describe('predlog — šta se NE sme dirati', () => {
  const plan = makePlan();
  const base = ahead(plan, 4);
  const full = vdotProposal(base);
  const ids = new Set(full?.changes.map((c) => c.id));

  it('postoji bar nekoliko dana koji se menjaju (inače su ostali testovi prazan hod)', () => {
    expect(ids.size).toBeGreaterThanOrEqual(3);
  });

  it('odrađen dan se ne menja', () => {
    const id = [...ids][0] as string;
    const log: Record<string, LogEntry> = { ...base.log, [id]: { status: 'done' } };
    const p = vdotProposal({ ...base, log });
    expect(p?.changes.map((c) => c.id)).not.toContain(id);
  });

  it('ručno zaključan tempo (alts.pace bez paceAuto) se ne dira, automatski se prepisuje', () => {
    const [a, b] = [...ids] as [string, string];
    const day = base.plan.byId.get(a);
    const mk = (id: string, auto: boolean): AltRecord => {
      const d = base.plan.byId.get(id);
      return {
        tag: d?.tag ?? 'int',
        km: d?.km ?? null,
        desc: d?.desc ?? '',
        pace: 400,
        rw: null,
        paceAuto: auto
      };
    };
    expect(day).toBeDefined();
    const alts = { [a]: mk(a, false), [b]: mk(b, true) };
    const p = vdotProposal({
      ...base,
      alts,
      plan: resolvePlan(plan.weeks, { alts, moves: {} })
    });
    const got = p?.changes.map((c) => c.id) ?? [];
    expect(got).not.toContain(a);
    expect(got).toContain(b);
  });

  it('dan sa ručno zaključanim tempom u sesiji (overrides.paceSec) se ne dira', () => {
    const id = [...ids][0] as string;
    const locked: GenPlanState = {
      ...plan,
      weeks: plan.weeks.map((w) => ({
        ...w,
        days: w.days.map((d) =>
          d.id === id && d.session
            ? { ...d, session: { ...d.session, overrides: { paceSec: true } } }
            : d
        )
      }))
    };
    const ctx = ahead(locked, 4);
    expect(vdotProposal(ctx)?.changes.map((c) => c.id)).not.toContain(id);
  });

  it('dan trke i prošli dani ostaju netaknuti', () => {
    for (const c of full?.changes ?? []) {
      expect(c.date >= base.today).toBe(true);
      const d = base.plan.byId.get(c.id);
      expect(d?.tag).not.toBe('trka');
      expect(d?.tag).not.toBe('test');
    }
  });

  it('red koji ne meri formu (aktivacija) se ne dira ni u jednom smeru', () => {
    const nemeri = preds(plan).filter((r) => r.nemeri);
    const matched = matchPlanRows(base.plan.weeks, preds(plan));
    const touched = new Set(full?.changes.map((c) => matched.get(c.id)?.id));
    for (const r of nemeri) expect(touched.has(r.id)).toBe(false);
  });

  it('današnji trening čuva propis, a predlog počinje tek sutra', () => {
    const change = full?.changes[0];
    expect(change).toBeDefined();
    const sameDay = vdotProposal({ ...base, today: change!.date });
    expect(sameDay?.changes.map((c) => c.id)).not.toContain(change!.id);
    for (const c of sameDay?.changes ?? []) expect(c.date > change!.date).toBe(true);
  });

  it('budući trening sa već priloženim merenjem ili zaključavanjem čuva propis', () => {
    const change = full?.changes[0];
    expect(change).toBeDefined();
    const matched = matchPlanRows(base.plan.weeks, preds(plan));
    const rowId = matched.get(change!.id)!.id;
    const cases: Array<Partial<ProposalContext>> = [
      { enteredPaces: { [rowId]: 1 } },
      { predLock: { [rowId]: true } },
      { vdotChain: [...base.vdotChain, record(rowId, change!.date, 50)] }
    ];
    for (const over of cases) {
      const proposed = vdotProposal({ ...base, ...over });
      expect(proposed).not.toBeNull();
      expect(proposed?.changes.map((c) => c.id)).not.toContain(change!.id);
    }
  });

  it('jedan red pripada najviše jednom danu', () => {
    const matched = matchPlanRows(base.plan.weeks, preds(plan));
    const rowIds = [...matched.values()].map((r) => r.id);
    expect(new Set(rowIds).size).toBe(rowIds.length);
  });
});

describe('primena predloga: novi tempo čuva dozu rada', () => {
  const plan = makePlan();
  const ctx = ahead(plan, 4);
  const prop = vdotProposal(ctx);

  it('kilometraža i opis prate sesiju, alts nose paceAuto', () => {
    const res = applyVdotProposal(prop, ctx.plan, ctx.log, ctx.alts, plan);
    expect(res.applied).toBe(prop?.changes.length);
    const after = resolvePlan((res.genPlan as GenPlanState).weeks, { alts: res.alts, moves: {} });
    for (const c of prop?.changes ?? []) {
      const alt = res.alts[c.id];
      expect(alt?.pace).toBe(c.newPace);
      expect(alt?.paceAuto).toBe(true);
      expect(after.byId.get(c.id)?.km).not.toBeNull();
    }
    const kmBefore = plan.weeks.flatMap((w) => w.days.map((d) => d.km ?? null));
    const kmAfterGen = (res.genPlan as GenPlanState).weeks.flatMap((w) =>
      w.days.map((d) => d.km ?? null)
    );
    // Isti rad i pauze pri drugačijem tempu daju mali pomak izvedene kilometraže.
    const sum = (a: Array<number | null>): number => a.reduce<number>((s, x) => s + (x ?? 0), 0);
    expect(Math.abs(sum(kmAfterGen) - sum(kmBefore))).toBeLessThan(sum(kmBefore) * 0.02);
  });

  it('ulaz se ne mutira', () => {
    const before = JSON.stringify([plan, ctx.alts]);
    applyVdotProposal(prop, ctx.plan, ctx.log, ctx.alts, plan);
    expect(JSON.stringify([plan, ctx.alts])).toBe(before);
  });

  it('poništavanje vraća plan i alts u prvobitno stanje (ako su izmene bile samo automatske)', () => {
    const res = applyVdotProposal(prop, ctx.plan, ctx.log, ctx.alts, plan);
    const after = resolvePlan((res.genPlan as GenPlanState).weeks, { alts: res.alts, moves: {} });
    const undo = undoVdotAdjustments(after, res.alts, res.genPlan);
    expect(undo.applied).toBe(res.applied);
    expect(undo.alts).toEqual({});
    expect(undo.genPlan).toEqual(plan);
  });

  it('poništavanje ne dira ručne izmene', () => {
    const [id] = prop?.changes.map((c) => c.id) ?? [];
    const manual: Record<string, AltRecord> = {
      x: { tag: 'lako', km: 5, desc: 'ručno', pace: null, rw: null, paceAuto: false }
    };
    const base = resolvePlan(plan.weeks, { alts: manual, moves: {} });
    const undo = undoVdotAdjustments(base, manual, plan);
    expect(undo.applied).toBe(0);
    expect(undo.alts).toEqual(manual);
    expect(id).toBeDefined();
  });
});

describe('ispravke naspram starog koda (docs/ENGINE_CHANGES.md, A1–A2)', () => {
  const plan = makePlan();
  const ctx = ahead(plan, 4);
  const prop = vdotProposal(ctx);
  const id = prop?.changes[0]?.id as string;

  it('A2: primena predloga NE briše snagu koju je korisnik dodao uz trčanje', () => {
    const d = ctx.plan.byId.get(id);
    const alts: Record<string, AltRecord> = {
      [id]: {
        tag: d?.tag ?? 'int',
        km: d?.km ?? null,
        desc: d?.desc ?? '',
        pace: null,
        rw: null,
        paceAuto: false,
        snaga: true
      }
    };
    const c = { ...ctx, alts, plan: resolvePlan(plan.weeks, { alts, moves: {} }) };
    const p = vdotProposal(c);
    expect(p?.changes.map((x) => x.id)).toContain(id);
    const res = applyVdotProposal(p, c.plan, c.log, alts, plan);
    expect(res.alts[id]?.snaga).toBe(true);
    expect(res.alts[id]?.paceAuto).toBe(true);
  });

  it('A2: poništavanje ne briše izmenu koja nosi snagu', () => {
    const d = ctx.plan.byId.get(id);
    const alts: Record<string, AltRecord> = {
      [id]: {
        tag: d?.tag ?? 'int',
        km: d?.km ?? null,
        desc: d?.desc ?? '',
        pace: 250,
        rw: null,
        paceAuto: true,
        snaga: true
      }
    };
    const undo = undoVdotAdjustments(resolvePlan(plan.weeks, { alts, moves: {} }), alts, plan);
    expect(undo.alts[id]?.snaga).toBe(true);
    expect(undo.alts[id]?.pace).toBeNull();
  });

  it('A1: posle poništavanja ne ostaje prazna izmena koja dan i dalje označava kao ručno menjan', () => {
    const res = applyVdotProposal(prop, ctx.plan, ctx.log, ctx.alts, plan);
    const after = resolvePlan((res.genPlan as GenPlanState).weeks, { alts: res.alts, moves: {} });
    const undo = undoVdotAdjustments(after, res.alts, res.genPlan);
    expect(Object.keys(undo.alts)).toEqual([]);
  });
});

describe('prilagođavanje tempa treninga na vreme', () => {
  const initial = makePlan();
  const originalDay = initial.weeks.flatMap((w) => w.days).find((d) => d.session);
  if (!originalDay?.id || !originalDay.session) throw new Error('session day');
  const id = originalDay.id;
  const session: FartlekSession = {
    type: 'fartlek',
    kind: 'Fartlek',
    zone: 'T',
    wuKm: 2,
    cdKm: 1,
    paceSec: 300,
    reps: 4,
    repSec: 180,
    restSec: 60,
    easyPaceSec: 400,
    overrides: {}
  };
  const plan: GenPlanState = {
    ...initial,
    weeks: initial.weeks.map((w) => ({
      ...w,
      days: w.days.map((d) =>
        d.id === id && d.session
          ? { ...d, session, km: sessKm(session), desc: sessDesc(session) }
          : d
      )
    }))
  };
  const change = (newPace: number) => ({
    changes: [{ id, newPace, oldPace: 300, kind: 'Fartlek', zone: 'T' as const, date: START, w: 1 }]
  });

  it('čuva minute rada, pauze, zagrevanje i hlađenje; vidljivi km/opis prate novi tempo', () => {
    const resolved = resolvePlan(plan.weeks, { alts: {}, moves: {} });
    const applied = applyVdotProposal(change(240), resolved, {}, {}, plan);
    const after = resolvePlan(applied.genPlan!.weeks, { alts: applied.alts, moves: {} });
    const day = after.byId.get(id)!;
    const fresh = day.session as FartlekSession;
    expect(fresh.reps * fresh.repSec).toBe(720);
    expect([fresh.wuKm, fresh.cdKm, fresh.restSec, fresh.easyPaceSec]).toEqual([2, 1, 60, 400]);
    expect(day.km).toBe(sessKm(fresh));
    expect(day.desc).toBe(sessDesc(fresh));
    expect(day.km).toBeGreaterThan(sessKm(session));
    expect(applied.alts[id]?.km).toBe(day.km);
    expect(applied.alts[id]?.desc).toContain('4:00/km');
    const undo = undoVdotAdjustments(after, applied.alts, applied.genPlan);
    expect(undo.genPlan).toEqual(plan);
    expect(undo.alts).toEqual({});
  });

  it('ponovljena primena ne zamrzava kilometražu prethodnog automatskog tempa', () => {
    const first = applyVdotProposal(
      change(270),
      resolvePlan(plan.weeks, { alts: {}, moves: {} }),
      {},
      {},
      plan
    );
    const firstResolved = resolvePlan(first.genPlan!.weeks, { alts: first.alts, moves: {} });
    const second = applyVdotProposal(change(240), firstResolved, {}, first.alts, first.genPlan);
    const final = resolvePlan(second.genPlan!.weeks, { alts: second.alts, moves: {} });
    const day = final.byId.get(id)!;
    expect(day.km).toBe(sessKm(day.session!));
    expect(day.km).toBeGreaterThan(firstResolved.byId.get(id)!.km!);
    const undo = undoVdotAdjustments(final, second.alts, second.genPlan);
    expect(undo.genPlan).toEqual(plan);
    expect(undo.alts).toEqual({});
  });

  it('izričito ručno zadati kilometri, opis i run/walk ostaju kroz primenu i poništavanje', () => {
    const alts: Record<string, AltRecord> = {
      [id]: {
        tag: originalDay.tag,
        km: 9,
        desc: 'Moj trening',
        pace: null,
        paceAuto: false,
        rw: { runSec: 120, walkSec: 60, label: '2 min trčanje / 1 min hod' }
      }
    };
    const applied = applyVdotProposal(
      change(240),
      resolvePlan(plan.weeks, { alts, moves: {} }),
      {},
      alts,
      plan
    );
    const after = resolvePlan(applied.genPlan!.weeks, { alts: applied.alts, moves: {} });
    expect(after.byId.get(id)?.km).toBe(9);
    expect(after.byId.get(id)?.desc).toBe('Moj trening');
    expect(applied.alts[id]?.rw).toEqual(alts[id]?.rw);
    const undo = undoVdotAdjustments(after, applied.alts, applied.genPlan);
    expect(undo.genPlan).toEqual(plan);
    expect(undo.alts).toEqual(alts);
  });
});

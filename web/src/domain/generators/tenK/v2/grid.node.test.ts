/* Mreža segmenta 02: dana 3/4/5/6 × nedelje 8–18 × obim po broju dana (D17, korak 5 km) × VDOT {30..70} ×
   3 rasporeda × trka sub/ned = 15 840 planova: 0 odbijanja, 0 grešaka validatora, deterministički, = bazna
   linija segment02.baseline.json. Invarijante se proveravaju nezavisno od validatora (brojevi iz odluka).
   Regresija (pouka 1): 4 dana × 10–18 ned prema 53da370 (segment01.baseline.json i heševi planova). */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { addDays, daysBetween, weekdayOf } from './dates.ts';
import { generateTenKV2 } from './generate.ts';
import { fnv1a, grid02Inputs, planHash } from './testInputs.ts';
import type { Phase, PlanWeek, TenKV2Plan } from './types.ts';
import { validatePlan } from './validate.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const BASELINE = join(HERE, 'segment02.baseline.json');
const BASELINE_53 = join(HERE, 'segment01.baseline.json');
const HASHES_53 = join(HERE, 'segment02.plan-hashes-53da370.json');
const EXCEPTIONS = join(HERE, 'segment02.regression-exceptions.json');
const LETTER = { base: 'B', development: 'D', specific: 'S', taper: 'T', race: 'R' } as const;
const DAYS = [3, 4, 5, 6] as const;
type Days = (typeof DAYS)[number];

/** D17 nezavisno (brojevi iz odluke). */
const SHARE: Record<Days, number> = { 3: 0.4, 4: 0.33, 5: 0.3, 6: 0.27 };
const WEEK_MIN: Record<Days, number> = { 3: 9, 4: 12, 5: 15, 6: 18 };
/** D14: WU/CD po pojasu trenutnog obima, isti za sve brojeve dana. */
const band = (km: number): [number, number] =>
  km < 35 ? [900, 600] : km < 45 ? [1200, 900] : [1500, 900];
const EPS = 1e-9;
const to10 = (km: number): number => Math.round(km * 10);
const isBuild = (ph: Phase): boolean => ph === 'base' || ph === 'development' || ph === 'specific';
const steady = (w: PlanWeek): boolean => isBuild(w.phase) && !w.deload;
const T_C = [2000, 2500, 3000, 3500, 4000, 4500, 5000];
const T_CRUISE = [2000, 2400, 3000, 3600, 4000, 4800, 5000, 6000, 6400, 8000];

type Row = [number, number, number, number, string, number[]];
type Baseline = { policyVersion: string; plans: Record<string, Row> };

/** Vrh cilj/planirano, najduži dugi, najveća glavna doza [km], niz faza, rasteretne nedelje. */
function summary(p: TenKV2Plan): Row {
  const build = p.weeks.filter((w) => isBuild(w.phase));
  const peak = build.reduce((a, w) => (w.targetKm > a.targetKm ? w : a), build[0]!);
  const longest = Math.max(
    ...p.weeks.flatMap((w) => w.days.filter((d) => d.role === 'long').map((d) => d.workout.km))
  );
  const main = Math.max(
    ...p.weeks.map((w) =>
      w.days.reduce(
        (a, d) =>
          a + Math.round((d.workout.workKm.T + d.workout.workKm.I + d.workout.workKm.RP) * 1000),
        0
      )
    )
  );
  return [
    peak.targetKm,
    peak.plannedKm,
    longest,
    main / 1000,
    p.weeks.map((w) => LETTER[w.phase]).join(''),
    p.weeks.filter((w) => w.deload).map((w) => w.index)
  ];
}

interface Stats {
  plans: number;
  belowTime: number;
  belowShare: number;
  capacity: number;
  doseDropped: number;
  repeats: number;
  peakRatio: number;
  deloadNoQuality: number;
  taperRpOnly: number;
  taperNone: number;
  raceShort: number;
}

/** Nezavisne invarijante jednog plana; prekršaji idu u `bad[invarijanta]`, brojke u `st`. */
function check(id: string, n: Days, p: TenKV2Plan, bad: Record<string, string[]>, st: Stats): void {
  const no = (inv: string, msg: string): void => {
    (bad[inv] ??= []).push(`${id}: ${msg}`);
  };
  const time10 = Math.floor((6300 / p.paces.E.slow) * 10 + EPS);
  const shareCap10 = (t: number): number => Math.floor(SHARE[n] * to10(t) + EPS);
  const longOf = (w: PlanWeek): number | null => {
    const l = w.days.find((d) => d.role === 'long');
    return l ? to10(l.workout.km) : null;
  };
  const [wu, cd] = band(p.input.currentWeeklyKm);
  const phases = p.weeks.map((w) => w.phase);
  const B = phases.filter(isBuild).length;
  const first = (k: number): boolean => k === 1 || phases[k - 2] !== phases[k - 1];
  let run = 0;
  let last: PlanWeek | null = null;
  for (const w of p.weeks) {
    const tag = `ned ${w.index}`;
    // planirano = cilj (tehnička tolerancija 0,1 km); trkačka: cilj = planirano.
    if (Math.abs(w.plannedKm - w.targetKm) > 0.1 + EPS)
      no('PLANNED_EQ_TARGET', `${tag} ${w.plannedKm} ≠ ${w.targetKm}`);
    // Uslov 8 (D15/D17): nedelja ≥ minimum po broju dana; trkačka samo upozorenje.
    if (w.phase !== 'race' && w.plannedKm + EPS < WEEK_MIN[n]) no('WEEK_MIN', tag);
    if (w.phase === 'race' && w.plannedKm + EPS < WEEK_MIN[n]) st.raceShort++;
    const long = longOf(w);
    const easy = w.days.filter((d) => d.role === 'easy').map((d) => to10(d.workout.km));
    if (w.phase !== 'race') {
      if (long === null) no('LONG', `${tag} bez dugog`);
      else {
        if (easy.some((e) => e > long)) no('LONG_GE_EASY', tag);
        if (long > shareCap10(w.targetKm) || long > time10) no('LONG_CAP', `${tag} ${long / 10}`);
      }
      // D19: lagani dani jednaki (razlika ≤ 0,1 km), svaki ≥ 3 km.
      if (easy.length > 1 && Math.max(...easy) - Math.min(...easy) > 1) no('EASY_EQUAL', tag);
      if (easy.some((e) => e < 30)) no('EASY_MIN', tag);
    }
    for (const d of w.days) {
      const wo = d.workout;
      if (wo.kind !== 'quality') continue;
      const s = wo.segments;
      if (
        s[0]!.kind !== 'warmup' ||
        s[0]!.sec !== wu ||
        s.at(-1)!.kind !== 'cooldown' ||
        s.at(-1)!.sec !== cd
      )
        no('WU_CD_BAND', `${tag} ${d.date}`);
      if (wo.dose!.zone === 'T')
        for (const x of s)
          if (x.kind === 'rep' && Math.round(x.km * 1000) < 1000) no('T_REP_1000', tag);
      // D18: 3 dana bez I i R.
      if (n === 3 && (wo.dose!.zone === 'I' || wo.dose!.zone === 'R')) no('THREE_NO_I_R', tag);
    }
    const quality = w.days.filter((d) => d.workout.kind === 'quality');
    if (n === 3 && steady(w) && quality.length !== 1) no('THREE_ONE_QUALITY', tag);
    if (w.notes.some((x) => x.includes('ponovljen'))) st.repeats++;
    // D5: mesto rasterećenja i niz izgradnje.
    if (isBuild(w.phase)) {
      if (w.deload) {
        if (w.index < 3 || w.index === B || first(w.index)) no('DELOAD_PLACE', tag);
        run = 0;
      } else {
        run++;
        if (run > 4 || (run === 4 && !first(w.index))) no('DELOAD_RUN', tag);
      }
    } else if (w.deload) no('DELOAD_PLACE', tag);
    // D5: sadržaj rasterećenja.
    if (w.deload && last) {
      const tSlot = n === 3 ? 'q1' : 'q2';
      const lastM = last.days.find((d) => d.role === tSlot)!.workout.dose!.doseM;
      const ladder = w.phase === 'base' ? T_C : T_CRUISE;
      const want = ladder.filter((m) => m <= 0.6 * lastM + 1e-6 && m >= 2000).pop() ?? 2000;
      const cap = Math.floor(0.1 * w.targetKm * 1000 + 1e-6);
      if (want > cap) {
        if (quality.length !== 0) no('DELOAD_CONTENT', `${tag} kvalitet uprkos plafonu`);
        st.deloadNoQuality++;
      } else if (
        quality.length !== 1 ||
        quality[0]!.role !== tSlot ||
        quality[0]!.workout.dose!.doseM !== want
      )
        no('DELOAD_CONTENT', `${tag} T ≠ ${want}`);
      const lastLong = longOf(last)!;
      const wantLong = Math.min(Math.floor(0.8 * lastLong + EPS), shareCap10(w.targetKm), time10);
      if (long !== wantLong) no('DELOAD_LONG', `${tag} ${long} ≠ ${wantLong}`);
      if (easy.length !== n - 1 - quality.length) no('DELOAD_CONTENT', `${tag} lagani`);
      if (w.fitted === null && to10(w.targetKm) !== Math.round(0.8 * to10(last.targetKm)))
        no('DELOAD_TARGET', tag);
    }
    if (w.phase === 'taper') {
      const q = quality.map((d) => d.workout.dose!.zone).join();
      if (q === '') st.taperNone++;
      else if (n > 3 && q === 'RP') st.taperRpOnly++;
      if (w.days.length !== n) no('TAPER_DAYS', tag);
    }
    // D20: dana sa trkom = min(broj dana, 5).
    if (w.phase === 'race' && w.days.length !== Math.min(n, 5)) no('RACE_DAYS', tag);
    if (steady(w)) last = w;
  }
  // D9: zahtevni dani nikad uzastopni (i preko granice nedelje).
  const hard = p.weeks.flatMap((w) => w.days.filter((d) => d.hard).map((d) => d.date)).sort();
  for (let i = 1; i < hard.length; i++)
    if (daysBetween(hard[i - 1]!, hard[i]!) < 2) no('HARD_ADJACENT', `${hard[i - 1]} ${hard[i]}`);
  // Nedelja 1 < trenutni obim SAMO kad je dugi nedelje 1 na 105 min (3 dana: ili na udelu 40 %, D17).
  const w1 = p.weeks[0]!;
  if (w1.targetKm < p.input.currentWeeklyKm) {
    const l1 = longOf(w1)!;
    if (l1 === time10) st.belowTime++;
    else if (n === 3 && l1 === shareCap10(w1.targetKm)) st.belowShare++;
    else no('WEEK1_BELOW', `${w1.targetKm} < ${p.input.currentWeeklyKm}, dugi ${l1 / 10}`);
  }
  // DOSE_DROPPED SAMO u planovima ograničenim kapacitetom: nedelja izgradnje spuštena sa dugim na 105 min.
  const timeCut = p.weeks.some((w) => steady(w) && w.fitted === 'down' && longOf(w) === time10);
  if (p.warnings.some((x) => x.rule === 'DOSE_DROPPED')) {
    st.doseDropped++;
    if (!timeCut) no('DOSE_DROPPED_ONLY_CAPACITY', 'bez nedelje spuštene uz dugi na 105 min');
  }
  if (p.warnings.some((x) => x.rule === 'CAPACITY_LIMITED')) st.capacity++;
  st.peakRatio += p.peakKm / p.startKm;
  st.plans++;
}

/** D22 element: T deonica deljiva sa 50, a ne sa 100 m, ili R deonica 400 m. */
function d22(p: TenKV2Plan): { t50: boolean; r400: boolean } {
  let t50 = false;
  let r400 = false;
  for (const w of p.weeks)
    for (const d of w.days) {
      const s = d.workout.dose?.structure;
      if (!s || s.form !== 'reps') continue;
      if (d.workout.dose!.zone === 'T' && s.repM % 100 !== 0) t50 = true;
      if (d.workout.dose!.zone === 'R' && s.repM === 400) r400 = true;
    }
  return { t50, r400 };
}

describe('mreža 02: 15 840 planova (3/4/5/6 dana × 8–18 ned)', () => {
  const inputs = DAYS.flatMap((n) => grid02Inputs(n));
  const rows: Record<string, Row> = {};
  const hashes: number[] = [];
  const rejected: string[] = [];
  const errors: Record<string, number> = {};
  const bad: Record<string, string[]> = {};
  const stats = {} as Record<Days, Stats>;
  for (const n of DAYS)
    stats[n] = {
      plans: 0,
      belowTime: 0,
      belowShare: 0,
      capacity: 0,
      doseDropped: 0,
      repeats: 0,
      peakRatio: 0,
      deloadNoQuality: 0,
      taperRpOnly: 0,
      taperNone: 0,
      raceShort: 0
    };
  /** 4 dana × 10–18 ned: heš plana (regresija) i D22 elementi. */
  const reg: Record<string, { hash: number; t50: boolean; r400: boolean }> = {};
  let repeats4 = 0;
  for (const { id, days, weeks, input } of inputs) {
    const n = days as Days;
    const r = generateTenKV2(input);
    hashes.push(fnv1a(JSON.stringify(r)));
    if (!r.ok) {
      rejected.push(`${id}: ${r.reasons.map((x) => x.code).join(',')}`);
      continue;
    }
    for (const v of validatePlan(r.plan))
      if (v.severity === 'error') errors[v.rule] = (errors[v.rule] ?? 0) + 1;
    rows[id] = summary(r.plan);
    check(id, n, r.plan, bad, stats[n]);
    if (n === 4 && weeks >= 10) {
      reg[id] = { hash: planHash(r), ...d22(r.plan) };
      repeats4 += r.plan.weeks.filter((w) => w.notes.some((x) => x.includes('ponovljen'))).length;
    }
  }

  it('15 840 ulaza, 0 odbijanja, 0 grešaka validatora (BASE_PLATEAU 0)', () => {
    expect(inputs.length).toBe(15840);
    expect(DAYS.map((n) => grid02Inputs(n).length)).toEqual([2640, 3696, 4224, 5280]);
    expect(new Set(inputs.map((g) => g.id)).size).toBe(15840);
    expect(rejected.slice(0, 20)).toEqual([]);
    expect(errors).toEqual({});
    expect(errors['BASE_PLATEAU'] ?? 0).toBe(0);
  });

  it('deterministički: drugo generisanje daje bajt-isti rezultat', () => {
    const again = inputs.map(({ input }) => fnv1a(JSON.stringify(generateTenKV2(input))));
    expect(again).toEqual(hashes);
  });

  it('invarijante (nezavisno od validatora): planirano = cilj, dugi ≥ lagan, dugi ≤ udeo i ≤ 105 min, teški dani nesusedni, WU/CD po pojasu, T ≥ 1000 m, rasterećenje po D5, D19, D20, Uslov 8, 3 dana jedan kvalitet bez I/R', () => {
    const summaryBad = Object.fromEntries(
      Object.entries(bad).map(([k, v]) => [k, `${v.length}: ${v.slice(0, 3).join(' | ')}`])
    );
    expect(summaryBad).toEqual({});
  });

  it('nedelja 1 < trenutni obim SAMO uz dugi ned 1 na 105 min (4–6 dana); 3 dana i na udelu 40 % (odstupanje D17)', () => {
    expect(DAYS.map((n) => [stats[n].belowTime, stats[n].belowShare])).toEqual([
      [132, 396],
      [660, 0],
      [264, 0],
      [264, 0]
    ]);
  });

  it('DOSE_DROPPED samo u planovima ograničenim kapacitetom (nedelja spuštena uz dugi na 105 min)', () => {
    expect(DAYS.map((n) => stats[n].doseDropped)).toEqual([0, 162, 0, 0]);
  });

  it('brojke po broju dana (izveštaj): CAPACITY_LIMITED, ponavljanja, vrh/start, odstupanja', () => {
    const t = DAYS.map((n) => {
      const s = stats[n];
      return [
        s.plans,
        s.capacity,
        s.repeats,
        Math.round((s.peakRatio / s.plans) * 1000) / 1000,
        s.deloadNoQuality,
        s.taperRpOnly,
        s.taperNone,
        s.raceShort
      ];
    });
    expect(t).toEqual([
      [2640, 888, 216, 1.257, 528, 0, 48, 6],
      [3696, 1320, 48, 1.25, 0, 0, 0, 0],
      [4224, 810, 0, 1.279, 0, 0, 0, 0],
      [5280, 732, 0, 1.25, 0, 6, 0, 0]
    ]);
    // Ponavljanje slota u mreži 4 dana × 10–18 ned: 1068 (10k-v2.1.0) → 0 posle D22.
    expect(repeats4).toBe(0);
  });

  it('kratka priprema (D21): 8 ned BBDDSSTR, 9 ned BBDDDSSTR, tačno jedno rasterećenje (ned 4)', () => {
    for (const [id, row] of Object.entries(rows)) {
      if (id.includes('-8w-')) expect([row[4], row[5]], id).toEqual(['BBDDSSTR', [4]]);
      if (id.includes('-9w-')) expect([row[4], row[5]], id).toEqual(['BBDDDSSTR', [4]]);
    }
  });

  it('generisanje daje TAČNO baznu liniju segment02.baseline.json', () => {
    if (process.env['TEN_K_V2_WRITE_BASELINE'] === '1')
      writeFileSync(BASELINE, JSON.stringify({ policyVersion: '10k-v2.2.0', plans: rows }) + '\n');
    const base = JSON.parse(readFileSync(BASELINE, 'utf8')) as Baseline;
    expect(base.policyVersion).toBe('10k-v2.2.0');
    expect(Object.keys(base.plans).length).toBe(15840);
    expect(rows).toEqual(base.plans);
  });

  it('regresija (pouka 1): 4 dana × 10–18 ned — vrh cilj i vrh planirano ≥ 53da370; izuzeci samo uz razlog iz fajla', () => {
    const old = JSON.parse(readFileSync(BASELINE_53, 'utf8')) as Baseline;
    const ex = JSON.parse(readFileSync(EXCEPTIONS, 'utf8')) as {
      against: string;
      reasons: Record<string, string>;
      plans: Record<string, string>;
    };
    expect(old.policyVersion).toBe('10k-v2.1.0');
    expect(ex.against).toBe('53da370');
    expect(Object.keys(old.plans).length).toBe(3024);
    const lower: string[] = [];
    const bad: string[] = [];
    let changedRows = 0;
    for (const [id0, r0] of Object.entries(old.plans)) {
      const id = `d4-${id0}`;
      const r = rows[id]!;
      if (JSON.stringify(r) !== JSON.stringify(r0)) changedRows++;
      if (r[0] >= r0[0] && r[1] >= r0[1]) continue;
      lower.push(id);
      if (!ex.reasons[ex.plans[id] ?? '']) bad.push(`${id}: ${r0[0]}/${r0[1]} → ${r[0]}/${r[1]}`);
    }
    expect(bad).toEqual([]);
    expect(Object.keys(ex.plans).sort()).toEqual(lower.sort());
    // Redovi bazne linije (vrh, najduži dugi, glavna doza, faze, rasterećenja) se ne menjaju.
    expect(changedRows).toBe(0);
  });

  it('regresija: svaki plan 4 dana × 10–18 ned je isti kao 53da370 (bez oznake verzije i teksta CAPACITY_LIMITED) ili sadrži D22 strukturu (T 50 m / R 400 m)', () => {
    const old = JSON.parse(readFileSync(HASHES_53, 'utf8')) as {
      against: string;
      hashes: Record<string, number>;
    };
    expect(old.against).toBe('53da370');
    expect(Object.keys(old.hashes).sort()).toEqual(Object.keys(reg).sort());
    const cause = { same: 0, t50r400: 0, t50: 0, r400: 0, other: [] as string[] };
    for (const [id, x] of Object.entries(reg)) {
      if (x.hash === old.hashes[id]) cause.same++;
      else if (x.t50 && x.r400) cause.t50r400++;
      else if (x.t50) cause.t50++;
      else if (x.r400) cause.r400++;
      else cause.other.push(id);
    }
    expect(cause).toEqual({ same: 2184, t50r400: 528, t50: 0, r400: 312, other: [] });
  });

  it('D20 trkačka nedelja (6 dana): otpada dugi, pa najraniji lagan dan', () => {
    const r = generateTenKV2(grid02Inputs(6).find((g) => g.id === 'd6-12w-50km-v45-B-sat')!.input);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const w = r.plan.weeks.at(-1)!;
    // Nedelja ned–sub, trka sub (nije dan trčanja): dani ned, pon, uto, sre, čet, pet → otpadaju ned (dugi)
    // i pon (najraniji lagan); ostaju uto, sre, čet, pet + trka.
    expect(w.days.map((d) => `${d.weekday}:${d.role}`)).toEqual([
      'tue:easy',
      'wed:sharpener',
      'thu:easy',
      'fri:eve',
      'sat:race'
    ]);
    expect(weekdayOf(addDays(w.startDate, 6))).toBe('sat');
  });
});

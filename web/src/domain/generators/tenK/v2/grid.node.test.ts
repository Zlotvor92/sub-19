/* Mreža segmenta 02: dana 3/4/5/6 × nedelje 8–18 × obim po broju dana (D17, korak 5 km) × VDOT {30..70} ×
   3 rasporeda × trka sub/ned = 15 840 planova: 0 odbijanja, 0 grešaka validatora, deterministički, = bazna
   linija segment02b.baseline.json (10k-v2.2.1). Invarijante se proveravaju nezavisno od validatora (brojevi
   iz odluka). Regresija (pouka 1) prema 49ad476 (10k-v2.2.0): redovi segment02.baseline.json i heševi celih
   planova segment02b.plan-hashes-49ad476.json; promena samo od D17 (3 dana), D22b ili D23. */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { addDays, daysBetween, weekdayOf } from './dates.ts';
import { generateTenKV2 } from './generate.ts';
import { fnv1a, grid02Inputs, planHashes49 } from './testInputs.ts';
import type { Phase, PlanWeek, TenKV2Plan } from './types.ts';
import { validatePlan } from './validate.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const BASELINE = join(HERE, 'segment02b.baseline.json');
const BASELINE_49 = join(HERE, 'segment02.baseline.json');
const HASHES_49 = join(HERE, 'segment02b.plan-hashes-49ad476.json');
const EXCEPTIONS = join(HERE, 'segment02b.regression-exceptions.json');
const LETTER = { base: 'B', development: 'D', specific: 'S', taper: 'T', race: 'R' } as const;
const DAYS = [3, 4, 5, 6] as const;
type Days = (typeof DAYS)[number];

/** D17 nezavisno (brojevi iz odluke; 02b: 3 dana udeo 0,45). */
const SHARE: Record<Days, number> = { 3: 0.45, 4: 0.33, 5: 0.3, 6: 0.27 };
const WEEK_MIN: Record<Days, number> = { 3: 9, 4: 12, 5: 15, 6: 18 };
const KM_RANGE: Record<Days, [number, number]> = {
  3: [20, 40],
  4: [25, 55],
  5: [30, 65],
  6: [35, 80]
};
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
  capacity: number;
  raceKmEasy: number;
  longShorter: number;
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
      // D10/D22/D22b: T i RP deonice ≥ 1000 m.
      if (wo.dose!.zone === 'T' || wo.dose!.zone === 'RP')
        for (const x of s)
          if (x.kind === 'rep' && Math.round(x.km * 1000) < 1000) no('T_RP_REP_1000', tag);
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
  // D23: trkačka nedelja (bez trke) ≤ taper; lagan = min(35 min E, najkraći lagan tapera).
  const taper = p.weeks[p.weeks.length - 2]!;
  const race = p.weeks[p.weeks.length - 1]!;
  if (race.plannedKm > taper.plannedKm + EPS)
    no('RACE_LE_TAPER', `${race.plannedKm} > ${taper.plannedKm}`);
  const taperEasy = Math.min(
    ...taper.days.filter((d) => d.role === 'easy').map((d) => to10(d.workout.km))
  );
  const byKm = taperEasy * 10 < Math.round((2100 * 100) / ((p.paces.E.fast + p.paces.E.slow) / 2));
  const raceEasy = race.days.filter((d) => d.role === 'easy');
  for (const d of raceEasy)
    if (
      byKm ? Math.round(d.workout.km * 100) !== taperEasy * 10 : d.workout.segments[0]!.sec !== 2100
    )
      no('RACE_EASY_D23', `${d.date}`);
  if (byKm && raceEasy.length > 0) st.raceKmEasy++;
  // D25: upozorenje TAČNO kad je u ne-rasteretnoj nedelji izgradnje kvalitetni dan duži od dugog po
  // trajanju; preporuka manje dana tačno kad red D17 sa manje dana podržava trenutni obim.
  const longer = p.weeks.some((w) => {
    const l = w.days.find((d) => d.role === 'long');
    return (
      steady(w) &&
      !!l &&
      w.days.some((d) => d.workout.kind === 'quality' && d.workout.sec > l.workout.sec)
    );
  });
  const d25 = p.warnings.filter((x) => x.rule === 'LONG_SHORTER_THAN_QUALITY');
  if (longer !== (d25.length === 1) || d25.length > 1 || d25.some((x) => x.severity !== 'warning'))
    no('D25_EXACT', `${longer} ${d25.length}`);
  const km = p.input.currentWeeklyKm;
  const fewer = DAYS.filter((k) => k < n && KM_RANGE[k][0] <= km && km <= KM_RANGE[k][1]);
  if (d25.length === 1 && d25[0]!.message.includes('preporuka') !== fewer.length > 0)
    no('D25_ADVICE', d25[0]!.message);
  if (longer) st.longShorter++;
  // D9: zahtevni dani nikad uzastopni (i preko granice nedelje).
  const hard = p.weeks.flatMap((w) => w.days.filter((d) => d.hard).map((d) => d.date)).sort();
  for (let i = 1; i < hard.length; i++)
    if (daysBetween(hard[i - 1]!, hard[i]!) < 2) no('HARD_ADJACENT', `${hard[i - 1]} ${hard[i]}`);
  // Nedelja 1 < trenutni obim SAMO kad je dugi nedelje 1 na 105 min (02b: i za 3 dana, udeo 45 %, D17).
  const w1 = p.weeks[0]!;
  if (w1.targetKm < p.input.currentWeeklyKm) {
    const l1 = longOf(w1)!;
    if (l1 === time10) st.belowTime++;
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

/** Uzrok promene prema 49ad476 (markeri u NOVOM planu): RP deonica sa 50 m (D22b) i lagan trkačke
    nedelje zadat u km (D23). Stari plan sa RP deonicom < 1000 m nosi oznaku iz fixture-a. */
function markers(p: TenKV2Plan): { rp50: boolean; raceKm: boolean } {
  const rp50 = p.weeks.some((w) =>
    w.days.some((d) => {
      const s = d.workout.dose?.zone === 'RP' ? d.workout.dose.structure : null;
      return s?.form === 'reps' && s.repM % 100 !== 0;
    })
  );
  const raceKm = p.weeks
    .at(-1)!
    .days.some((d) => d.role === 'easy' && d.workout.blocks[0]!.kind === 'easy');
  return { rp50, raceKm };
}

type Exceptions = {
  against: string;
  reasons: Record<string, string>;
  plans: Record<string, string>;
};

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
      capacity: 0,
      raceKmEasy: 0,
      longShorter: 0,
      doseDropped: 0,
      repeats: 0,
      peakRatio: 0,
      deloadNoQuality: 0,
      taperRpOnly: 0,
      taperNone: 0,
      raceShort: 0
    };
  /** Regresija prema 49ad476: heševi (planHashes49), markeri uzroka, CAPACITY_LIMITED. */
  const reg: Record<
    string,
    { days: Days; h: [number, number, number]; rp50: boolean; raceKm: boolean; capacity: boolean }
  > = {};
  for (const { id, days, input } of inputs) {
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
    reg[id] = {
      days: n,
      h: planHashes49(r),
      ...markers(r.plan),
      capacity: r.plan.warnings.some((x) => x.rule === 'CAPACITY_LIMITED')
    };
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

  it('invarijante (nezavisno od validatora): planirano = cilj, dugi ≥ lagan, dugi ≤ udeo i ≤ 105 min, teški dani nesusedni, WU/CD po pojasu, T i RP ≥ 1000 m (D22b), rasterećenje po D5, D19, D20, trkačka ≤ taper (D23), D25 tačno, Uslov 8, 3 dana jedan kvalitet bez I/R', () => {
    const summaryBad = Object.fromEntries(
      Object.entries(bad).map(([k, v]) => [k, `${v.length}: ${v.slice(0, 3).join(' | ')}`])
    );
    expect(summaryBad).toEqual({});
  });

  it('nedelja 1 < trenutni obim SAMO uz dugi ned 1 na 105 min — i za 3 dana (D17 udeo 45 %; 10k-v2.2.0: 132 + 396 na udelu 40 %)', () => {
    expect(DAYS.map((n) => stats[n].belowTime)).toEqual([330, 660, 264, 264]);
  });

  it('D23: trkačka ≤ taper u svakom planu; lagan u km kad je lagan tapera kraći od 35 min E (10k-v2.2.0: trkačka > taper 0 / 8 / 57 / 9)', () => {
    expect(DAYS.map((n) => stats[n].raceKmEasy)).toEqual([636, 1428, 2004, 2538]);
  });

  it('D25: LONG_SHORTER_THAN_QUALITY tačno u planovima sa kvalitetnim danom dužim od dugog (nezavisno): 0 / 132 / 132 / 330', () => {
    expect(DAYS.map((n) => stats[n].longShorter)).toEqual([0, 132, 132, 330]);
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
    // 10k-v2.2.0: [2640, 888, 216, 1.257, 528, 0, 48, 6], [3696, 1320, 48, …], [4224, 810, 0, …],
    // [5280, 732, 0, 1.25, 0, 6, 0, 0]. Ponavljanja rastu zbog D22b (odstupanje u DECISIONS).
    expect(t).toEqual([
      [2640, 828, 1224, 1.258, 528, 0, 48, 6],
      [3696, 1320, 192, 1.25, 0, 0, 0, 0],
      [4224, 810, 144, 1.279, 0, 0, 0, 0],
      [5280, 732, 144, 1.25, 0, 6, 0, 90]
    ]);
  });

  it('kratka priprema (D21): 8 ned BBDDSSTR, 9 ned BBDDDSSTR, tačno jedno rasterećenje (ned 4)', () => {
    for (const [id, row] of Object.entries(rows)) {
      if (id.includes('-8w-')) expect([row[4], row[5]], id).toEqual(['BBDDSSTR', [4]]);
      if (id.includes('-9w-')) expect([row[4], row[5]], id).toEqual(['BBDDDSSTR', [4]]);
    }
  });

  it('generisanje daje TAČNO baznu liniju segment02b.baseline.json', () => {
    if (process.env['TEN_K_V2_WRITE_BASELINE'] === '1')
      writeFileSync(BASELINE, JSON.stringify({ policyVersion: '10k-v2.2.1', plans: rows }) + '\n');
    const base = JSON.parse(readFileSync(BASELINE, 'utf8')) as Baseline;
    expect(base.policyVersion).toBe('10k-v2.2.1');
    expect(Object.keys(base.plans).length).toBe(15840);
    expect(rows).toEqual(base.plans);
  });

  it('regresija (pouka 1): vrh cilj i vrh planirano ≥ 49ad476 za svih 15 840; niži samo uz razlog iz fajla, koji se proverava', () => {
    const old = JSON.parse(readFileSync(BASELINE_49, 'utf8')) as Baseline;
    const fx = JSON.parse(readFileSync(HASHES_49, 'utf8')) as {
      plans: Record<string, [number, number, number]>;
    };
    expect(old.policyVersion).toBe('10k-v2.2.0');
    expect(Object.keys(old.plans).length).toBe(15840);
    const lower: Record<string, string> = {};
    for (const [id, r0] of Object.entries(old.plans)) {
      const r = rows[id]!;
      if (r[0] >= r0[0] && r[1] >= r0[1]) continue;
      // D22b: kapacitet — vrh cilja niži samo u planu sa CAPACITY_LIMITED čiji je 49ad476 plan imao RP
      // deonicu < 1000 m; ROUNDING: isti vrh cilja, planirano niže u okviru tolerancije 0,1 km.
      lower[id] = r[0] < r0[0] ? 'D22b_CAPACITY' : 'ROUNDING';
    }
    if (process.env['TEN_K_V2_WRITE_BASELINE'] === '1') {
      const ex = JSON.parse(readFileSync(EXCEPTIONS, 'utf8')) as Exceptions;
      writeFileSync(EXCEPTIONS, JSON.stringify({ ...ex, plans: lower }) + '\n');
    }
    const ex = JSON.parse(readFileSync(EXCEPTIONS, 'utf8')) as Exceptions;
    expect(ex.against).toBe('49ad476');
    expect(Object.keys(ex.reasons).sort()).toEqual(['D22b_CAPACITY', 'ROUNDING']);
    expect(ex.plans).toEqual(lower);
    const why: string[] = [];
    for (const [id, reason] of Object.entries(lower)) {
      const [r0, r] = [old.plans[id]!, rows[id]!];
      if (reason === 'D22b_CAPACITY' && (fx.plans[id]![2] !== 1 || !reg[id]!.capacity))
        why.push(id);
      if (reason === 'ROUNDING' && (r[0] !== r0[0] || r0[1] - r[1] > 0.1 + EPS)) why.push(id);
    }
    expect(why).toEqual([]);
    const count = (reason: string, n: Days): number =>
      Object.entries(lower).filter(([id, x]) => x === reason && reg[id]!.days === n).length;
    expect(DAYS.map((n) => [count('D22b_CAPACITY', n), count('ROUNDING', n)])).toEqual([
      [132, 36],
      [126, 0],
      [0, 0],
      [0, 0]
    ]);
  });

  it('regresija: ceo plan isti kao 49ad476 (bez oznake verzije, teksta CAPACITY_LIMITED i upozorenja D25) ili promenjen SAMO od D17 (3 dana), D22b ili D23', () => {
    const fx = JSON.parse(readFileSync(HASHES_49, 'utf8')) as {
      against: string;
      plans: Record<string, [number, number, number]>;
    };
    expect(fx.against).toBe('49ad476');
    expect(Object.keys(fx.plans).sort()).toEqual(Object.keys(reg).sort());
    const zero = (): Record<string, number> => ({
      same: 0,
      D17: 0,
      D22b: 0,
      D23: 0,
      'D22b+D23': 0
    });
    const cause: Record<Days, Record<string, number>> = {
      3: zero(),
      4: zero(),
      5: zero(),
      6: zero()
    };
    const three = { alone: 0, D22b: 0, D23: 0, both: 0 };
    const other: string[] = [];
    for (const [id, x] of Object.entries(reg)) {
      const [h0, pre0, rp0] = fx.plans[id]!;
      const c = cause[x.days];
      if (x.h[0] === h0) {
        c['same']!++;
        continue;
      }
      // D22b menja plan samo ako je stari imao RP < 1000 m ili novi ima RP 50 m; D23 menja samo trkačku
      // nedelju (nedelje pre trkačke iste) i daje lagan u km.
      const d22b = rp0 === 1 || x.rp50;
      const d23 = x.raceKm;
      if (x.days === 3) {
        c['D17']!++;
        three[d22b && d23 ? 'both' : d22b ? 'D22b' : d23 ? 'D23' : 'alone']++;
      } else if (d22b && d23) c['D22b+D23']!++;
      else if (d22b) c['D22b']!++;
      else if (d23 && x.h[1] === pre0) c['D23']!++;
      else other.push(id);
    }
    expect(other).toEqual([]);
    expect(cause).toEqual({
      3: { same: 132, D17: 2508, D22b: 0, D23: 0, 'D22b+D23': 0 },
      4: { same: 1854, D17: 0, D22b: 414, D23: 1266, 'D22b+D23': 162 },
      5: { same: 2112, D17: 0, D22b: 108, D23: 1680, 'D22b+D23': 324 },
      6: { same: 2724, D17: 0, D22b: 18, D23: 2412, 'D22b+D23': 126 }
    });
    expect(three).toEqual({ alone: 972, D22b: 900, D23: 234, both: 402 });
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

/* 2.5.0: činjenice → OGRANIČENJA adaptacije (AdaptStep). JEDINO mesto odluka 1–7 (DECISIONS 5k-v2.5.0):
   ovde se ne gradi nijedna nedelja; konstruktor (generate.construct) prima korak kao ulaz.
   2.6.0 (Odluka 3): dan bez zapisa je poznat (bez trčanja) samo u facts.coverage sa complete = true;
   odluke 2, 3 i 6 se iz zapisa primenjuju samo na pokriven deo; bol, umor, rezultat i eksplicitna pauza
   (facts.breaks) uvek. 2.6.1 (Odluka 1 dopuna): bol — ovde se određuju samo sidro povratka (nedelja r) i
   nivo pre bola; osnovu računa volume.returnBaseKm. 2.7.0 (Odluka 9): oznaka `reduced` (cilj koraka je
   smanjenje: pauza, manjak — da; višak — ne); rasterećenja ukida steps.framesFor. */

import { weekLabel } from './input.ts';
import { addDays, dayNumber, mustDay } from './dates.ts';
import { vdotFromResult } from './paces.ts';
import { FIVE_K_V2_POLICY as P } from './policy.ts';
import { baseAthlete, vdotAt } from './steps.ts';
import type {
  AdaptReason,
  AdaptStep,
  BreakFact,
  DateRange,
  FactsCoverage,
  FiveKV2Plan,
  IsoDate,
  PlanDay,
  Reason,
  ResultFact,
  WorkoutFact
} from './types.ts';
import { adaptFloorKm, planLastBuildKm, returnBaseKm, returnShareKm } from './volume.ts';

const A = P.adapt;
const round1 = (x: number): number => Math.round(x * 10) / 10;
const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const fmt = (sec: number): string =>
  `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}`;
const growthNote = (level: number): string =>
  ` Povratak do ${level} km (nivo pre smanjenja) po +${A.returnGrowth * 100}%/ned u svim fazama osim tapera i trkačke nedelje.`;

/**
 * 2.6.1 (Odluka 1 dopuna, tačka 5): dopuna poruke PAIN koraka sa povratkom. Osnova iz cilja nedelje sidra r
 * U KONSTRUKCIJI (`targetRKm`; pauza iz istog koraka ga smanjuje) i nivoa koraka (najveći nivo koraka);
 * računa je samo volume.returnBaseKm. Kad deluje min sa ciljem nedelje r, poruka to kaže. adapt.ts poziva
 * posle konstrukcije.
 */
export function painReturnNote(step: AdaptStep, targetRKm: number, off?: number): string {
  const rf = step.returnFrom!;
  const level = step.levelKm!;
  const base = returnBaseKm(rf.share, level, targetRKm);
  const shareKm = returnShareKm(rf.share, level);
  const pct = `${rf.share * 100}%`;
  return `${
    base < shareKm
      ? ` Posle nedelje ${weekLabel(rf.week, off)} rast kreće od ${base} km (cilj nedelje ${weekLabel(rf.week, off)}; ${pct} nivoa pre bola bilo bi ${shareKm} km).`
      : ` Posle nedelje ${weekLabel(rf.week, off)} rast kreće od ${pct} nivoa pre bola (${base} km).`
  }${growthNote(level)}`;
}

export interface CheckedFacts {
  workouts: WorkoutFact[];
  results: ResultFact[];
  lockedDayIds: string[];
  /** 2.6.0: null = bez pokrivenosti (nijedan dan bez zapisa nije poznat). */
  coverage: FactsCoverage | null;
  breaks: BreakFact[];
}

/** 2.6.0 (Odluka 3): da li su svi dani [from, to] poznati (pokriveni potpunim zapisom). */
export function coveredDays(c: FactsCoverage | null, from: number, to: number): boolean {
  return c !== null && c.complete && mustDay(c.from) <= from && mustDay(c.to) >= to;
}

/**
 * 2.10.1 (MASTER pouka 37, dopuna 5K-08i) — km zaštićenog dana po ČINJENICAMA, JEDINO mesto (konstruktor ga prima kroz
 * Written.factKm, validator čita zbir u PlanWeek.protectedKm): dan u eksplicitnoj pauzi = 0; dan sa zapisom = zbir km
 * urađenih zapisa (neurađen = 0); poznat dan bez zapisa (potpuna pokrivenost, Odluka 3) = 0; inače (asOf bez zapisa i
 * pokrivenosti, zaključan budući dan) null = planirani km. Neodrađen dan ne „jede" cilj nedelje.
 */
export function factKmOf(facts: CheckedFacts, asOf: IsoDate): (d: PlanDay) => number | null {
  const t = mustDay(asOf);
  return (d) => {
    const n = mustDay(d.date);
    if (n > t) return null;
    if (facts.breaks.some((b) => mustDay(b.from) <= n && n <= mustDay(b.to))) return 0;
    const recs = facts.workouts.filter((x) => (x.dayId ?? x.date) === d.date);
    if (recs.length > 0)
      return Math.round(recs.reduce((a, x) => a + (x.completed ? x.km : 0), 0) * 100) / 100;
    return coveredDays(facts.coverage, n, n) ? 0 : null;
  };
}

/** Provera oblika činjenica (sve greške odjednom). `days` = datumi dana plana (dayId). */
export function checkFacts(
  raw: unknown,
  asOf: IsoDate,
  days: ReadonlySet<string>
): { ok: true; facts: CheckedFacts } | { ok: false; reasons: Reason[] } {
  const reasons: Reason[] = [];
  const add = (code: Reason['code'], message: string): void => {
    reasons.push({ code, message });
  };
  if (raw === undefined || raw === null) raw = {};
  if (typeof raw !== 'object') {
    add('ADAPT_FACT_INVALID', 'Činjenice moraju biti objekat.');
    return { ok: false, reasons };
  }
  const r = raw as Record<string, unknown>;
  const list = (k: string): unknown[] => {
    const v = r[k];
    if (v === undefined || v === null) return [];
    if (!Array.isArray(v)) {
      add('ADAPT_FACT_INVALID', `${k} mora biti niz.`);
      return [];
    }
    return v;
  };
  const dateOk = (d: unknown, what: string): d is IsoDate => {
    if (dayNumber(d) === null) {
      add('ADAPT_FACT_INVALID', `${what}: datum mora biti YYYY-MM-DD.`);
      return false;
    }
    if (mustDay(d as string) > mustDay(asOf)) {
      add('ADAPT_FACT_AFTER_AS_OF', `${what}: datum ${String(d)} je posle asOf ${asOf}.`);
      return false;
    }
    return true;
  };
  const workouts: WorkoutFact[] = [];
  list('workouts').forEach((x, i) => {
    const o = (typeof x === 'object' && x !== null ? x : {}) as Record<string, unknown>;
    const what = `Trening ${i + 1}`;
    if (!dateOk(o['date'], what)) return;
    const bad = (m: string): void => add('ADAPT_FACT_INVALID', `${what}: ${m}`);
    const { dayId, km, durationSec, completed, rpe, pain } = o;
    if (dayId !== undefined && (typeof dayId !== 'string' || !days.has(dayId)))
      return add('ADAPT_DAY_UNKNOWN', `${what}: dayId ${JSON.stringify(dayId)} nije dan plana.`);
    if (!isNum(km) || km < 0) return bad('km mora biti ≥ 0.');
    if (!isNum(durationSec) || durationSec < 0) return bad('durationSec mora biti ≥ 0.');
    if (typeof completed !== 'boolean') return bad('completed mora biti true/false.');
    if (rpe !== undefined && (!isNum(rpe) || rpe < 1 || rpe > 10))
      return bad('rpe mora biti 1–10.');
    if (pain !== undefined && (!isNum(pain) || pain < 0 || pain > 10))
      return bad('pain mora biti 0–10.');
    workouts.push({
      date: o['date'],
      ...(dayId !== undefined ? { dayId: dayId } : {}),
      km,
      durationSec,
      completed,
      ...(rpe !== undefined ? { rpe: rpe } : {}),
      ...(pain !== undefined ? { pain: pain } : {})
    });
  });
  const results: ResultFact[] = [];
  list('results').forEach((x, i) => {
    const o = (typeof x === 'object' && x !== null ? x : {}) as Record<string, unknown>;
    const what = `Rezultat ${i + 1}`;
    if (!dateOk(o['date'], what)) return;
    const { distM, sec, kind } = o;
    if (!(P.input.resultDistancesM as readonly unknown[]).includes(distM))
      return add('ADAPT_RESULT_INVALID', `${what}: distanca mora biti 3000, 5000 ili 10000 m.`);
    if (!isNum(sec) || sec <= 0)
      return add('ADAPT_RESULT_INVALID', `${what}: vreme mora biti > 0 s.`);
    if (kind !== 'test' && kind !== 'race')
      return add('ADAPT_RESULT_INVALID', `${what}: kind mora biti 'test' ili 'race'.`);
    results.push({ distM: distM as number, sec, date: o['date'], kind });
  });
  const lockedDayIds: string[] = [];
  for (const id of list('lockedDayIds')) {
    if (typeof id !== 'string' || !days.has(id))
      add('ADAPT_DAY_UNKNOWN', `Zaključan dan ${String(id)} nije dan plana.`);
    else if (!lockedDayIds.includes(id)) lockedDayIds.push(id);
  }
  // 2.6.0: opseg datuma (from ≤ to ≤ asOf) — pokrivenost i eksplicitne pauze.
  const range = (o: Record<string, unknown>, what: string): DateRange | null => {
    if (!dateOk(o['from'], `${what} (from)`) || !dateOk(o['to'], `${what} (to)`)) return null;
    if (mustDay(o['from']) > mustDay(o['to'])) {
      add('ADAPT_FACT_INVALID', `${what}: from mora biti ≤ to.`);
      return null;
    }
    return { from: o['from'], to: o['to'] };
  };
  let coverage: FactsCoverage | null = null;
  const rc = r['coverage'];
  if (rc !== undefined && rc !== null) {
    const o = (typeof rc === 'object' ? rc : {}) as Record<string, unknown>;
    const d = range(o, 'coverage');
    if (typeof o['complete'] !== 'boolean')
      add('ADAPT_FACT_INVALID', 'coverage.complete mora biti true/false.');
    else if (d) coverage = { ...d, complete: o['complete'] };
  }
  const breaks: BreakFact[] = [];
  list('breaks').forEach((x, i) => {
    const o = (typeof x === 'object' && x !== null ? x : {}) as Record<string, unknown>;
    const what = `Pauza ${i + 1}`;
    if (o['kind'] !== 'break') return add('ADAPT_FACT_INVALID', `${what}: kind mora biti 'break'.`);
    const d = range(o, what);
    if (d) breaks.push({ kind: 'break', ...d });
  });
  return reasons.length > 0
    ? { ok: false, reasons }
    : { ok: true, facts: { workouts, results, lockedDayIds, coverage, breaks } };
}

export type ResultUse = 'apply' | 'old' | 'notNewer' | 'outOfRange';

/**
 * 5k-v2.11.0 (Z3): JEDNA odluka o rezultatu (assess i Forma, app/form.ts): 'old' = stariji od resultMaxAgeDays na
 * asOf; 'notNewer' = nije noviji od rezultata u upotrebi; 'outOfRange' = VDOT van opsega ulaza (RESULT_IGNORED);
 * 'apply' = adaptacija ga primenjuje (od više takvih — najnoviji).
 */
export function resultUse(
  plan: FiveKV2Plan,
  x: { distM: number; sec: number; date: IsoDate },
  asOf: IsoDate
): ResultUse {
  if (mustDay(asOf) - mustDay(x.date) > A.resultMaxAgeDays) return 'old';
  const steps = plan.adaptation?.steps ?? [];
  const prev =
    [...steps].reverse().find((s) => s.result)?.result?.date ?? plan.input.recentResult?.date;
  if (prev !== undefined && mustDay(x.date) <= mustDay(prev)) return 'notNewer';
  const v = round1(vdotFromResult(x.distM, x.sec));
  return v >= P.input.vdot.min && v <= P.input.vdot.max ? 'apply' : 'outOfRange';
}

/**
 * Ograničenja iz činjenica (Odluke 1–7). Nedelja r sadrži asOf + 1; n = prva puna nedelja posle asOf
 * („sledeća nedelja"). Pravila obima sledeće nedelje (pauza > umor > izvršenje) — primenjuje se samo
 * najviše aktivno; bol se primenjuje uvek, po datumima; novi rezultat uvek ažurira tempo.
 */
export function assess(
  plan: FiveKV2Plan,
  facts: CheckedFacts,
  asOf: IsoDate
): { ok: true; step: AdaptStep; reasons: AdaptReason[] } | { ok: false; reasons: Reason[] } {
  const weeks = plan.weeks;
  const N = weeks.length;
  /** 2.10.4 (3i): broj nedelje u porukama (input.weekLabel). */
  const wl = (k: number): number => weekLabel(k, plan.input.weekOffset);
  const steps = plan.adaptation?.steps ?? [];
  const day = (d: IsoDate): number => mustDay(d);
  const next = addDays(asOf, 1);
  const weekOf = (d: IsoDate): number => {
    const i = weeks.findIndex((w) => day(d) >= day(w.startDate) && day(d) <= day(w.endDate));
    return i >= 0 ? i + 1 : day(d) < day(weeks[0]!.startDate) ? 1 : N + 1;
  };
  const r = weekOf(next);
  const n = r <= N && day(weeks[r - 1]!.startDate) < day(next) ? r + 1 : r;
  const wk = (w: number) => (w >= 1 && w <= N ? weeks[w - 1]! : null);
  const build = (w: number): boolean => {
    const x = wk(w);
    return x !== null && (x.phase === 'base' || x.phase === 'peak' || x.phase === 'sharpen');
  };
  // 5k-v2.11.0 (N1): jedna definicija „poslednja izgradnja" (volume.planLastBuildKm; cilj koraka i osnova povratka
  // posle bola, kao adaptVolume i validator).
  const lastBuild = planLastBuildKm(weeks, steps, n);
  const out: AdaptReason[] = [];
  const reason = (condition: AdaptReason['condition'], applied: boolean, message: string): void => {
    out.push({ condition, applied, message });
  };

  const W = facts.workouts;
  // 2.6.0: trčanje = završen zapis sa km ili trajanjem (vremenska sesija bez km je trčanje).
  const runs = W.filter((x) => x.completed && (x.km > 0 || x.durationSec > 0));
  const sumKm = (from: number, to: number): number =>
    runs.filter((x) => day(x.date) >= from && day(x.date) <= to).reduce((s, x) => s + x.km, 0);
  const planDays: PlanDay[] = weeks.flatMap((w) => w.days);
  const plannedKm = (from: number, to: number): number =>
    planDays
      .filter((d) => d.countsToWeek && day(d.date) >= from && day(d.date) <= to)
      .reduce((s, d) => s + d.workout.km, 0);
  // 2.6.0 (Odluka 3): poznati su samo dani u potpunoj pokrivenosti; km iz zapisa samo tada i samo ako
  // svako trčanje u prozoru ima km (vremenski zapis bez km = nepoznat obim).
  const cov = facts.coverage;
  const knownKm = (from: number, to: number): number | null =>
    coveredDays(cov, from, to) &&
    runs.every((x) => x.km > 0 || day(x.date) < from || day(x.date) > to)
      ? sumKm(from, to)
      : null;
  const t = day(asOf);
  // 2.6.0 (Odluka 1): nivo pre smanjenja = cilj poslednje ne-rasteretne nedelje izgradnje završene pre
  // prvog dana događaja (rasteretna nedelja nije nivo); bez nje — start plana.
  const levelBefore = (event: number): number => {
    let lv: number | null = null;
    for (const w of weeks)
      if (day(w.endDate) < event && !w.deload && build(w.index)) lv = w.targetKm;
    return lv ?? plan.startKm;
  };
  const athlete = baseAthlete(plan.input);
  const floorKm = adaptFloorKm(Infinity, athlete);

  // Odluka 1: novi rezultat.
  const step: AdaptStep = {
    asOf,
    firstWeek: r,
    fromWeek: n,
    result: null,
    vdot: null,
    startKm: null,
    pauseRemainder: false,
    restart: false,
    deload: false,
    noQuality: [],
    oneQuality: [],
    rest: null,
    pain: null,
    orientation: false,
    levelKm: null,
    returnFrom: null
  };
  const vdotOf = (x: ResultFact): number => round1(vdotFromResult(x.distM, x.sec));
  const kindOf = (x: ResultFact): ResultUse => resultUse(plan, x, asOf);
  const fresh = facts.results.filter((x) => kindOf(x) !== 'old');
  for (const x of facts.results)
    if (!fresh.includes(x))
      reason(
        'RESULT_IGNORED',
        false,
        `Rezultat ${x.date} je stariji od 12 nedelja — ne menja tempo.`
      );
  const newer = fresh
    .filter((x) => kindOf(x) !== 'notNewer')
    .sort((a, b) => day(b.date) - day(a.date) || vdotOf(b) - vdotOf(a));
  for (const x of fresh)
    if (!newer.includes(x))
      reason('RESULT_IGNORED', false, `Rezultat ${x.date} nije noviji od rezultata u upotrebi.`);
  // 2.10.3 (08k, kao 10K A1): rezultat sa VDOT van opsega ulaza se ne primenjuje (RESULT_IGNORED sa vrednošću i
  // opsegom); adaptacija se nastavlja sa ostalim činjenicama — ne odbija se cela. Generator (input.ts) i dalje odbija ulaz.
  const inRange = (x: ResultFact): boolean => kindOf(x) === 'apply';
  for (const x of newer)
    if (!inRange(x))
      reason(
        'RESULT_IGNORED',
        false,
        `${x.kind === 'test' ? 'Test' : 'Trka'} ${x.distM / 1000}K ${fmt(x.sec)} (${x.date}): VDOT ${vdotOf(x)} van ${P.input.vdot.min}–${P.input.vdot.max} — rezultat se ne primenjuje.`
      );
  const res = newer.find(inRange);
  if (res) {
    const v = vdotOf(res);
    if (n <= N) {
      step.result = res;
      step.vdot = v;
      const was = vdotAt(plan.input, steps, n);
      reason(
        'NEW_RESULT',
        true,
        `${res.kind === 'test' ? 'Test' : 'Trka'} ${res.distM / 1000}K ${fmt(res.sec)} (${res.date}): VDOT ${v} od nedelje ${wl(n)}${was === null ? ' — plan po osećaju prelazi na tempo' : ` (bilo ${was})`}.`
      );
    } else
      reason('NEW_RESULT', false, 'Novi rezultat: nema sledeće nedelje do trke — tempo ostaje.');
  }

  const target = (w: number): number | null => wk(w)?.targetKm ?? null;
  const endOf = (w: number): IsoDate => wk(Math.min(w, N))!.endDate;

  // Odluka 4: bol (uvek, po datumima; prethodni koraci ostaju, pa ponovni bol produžava period).
  // 2.6.1 (Odluka 1 dopuna): sidro povratka = nedelja r (sadrži asOf + 1: prvi dan odmora ili bola), ne
  // poslednja nedelja bola; samo kad je r nedelja izgradnje. Nivo pre bola: levelBefore prvog dana bola.
  // Osnova (cilj nedelje r posle konstrukcije, nivo konačnog koraka): painReturnNote u adapt.ts.
  const hurt = W.filter((x) => t - day(x.date) < A.painLookbackDays && (x.pain ?? 0) >= A.painMin);
  // 5k-v2.11.1 (Z8, kao umor — pouka 36): bol je vezan za ZAPISE — kad je raniji korak bola već video najnoviji zapis
  // bola (asOf koraka ≥ datum zapisa), nov korak bola se ne pravi (sidro i osnova ostaju iz tog koraka; bez kaskade).
  const lastHurt = hurt.length > 0 ? Math.max(...hurt.map((x) => day(x.date))) : null;
  const painSeen =
    lastHurt !== null ? steps.find((s) => s.pain !== null && day(s.asOf) >= lastHurt) : undefined;
  if (painSeen)
    reason(
      'PAIN',
      false,
      `Bol ${Math.max(...hurt.map((x) => x.pain!))}/10: za ove zapise ograničenja su već u planu (prilagođavanje ${painSeen.asOf}). ${A.painMessage}`
    );
  else if (hurt.length > 0) {
    const max = Math.max(...hurt.map((x) => x.pain!));
    const restN = max >= A.painRestMin ? A.restDays : 0;
    if (restN > 0) step.rest = { from: next, to: addDays(asOf, restN) };
    step.pain = { from: addDays(asOf, restN + 1), to: addDays(asOf, restN + A.painDays) };
    if (r <= N && build(r)) {
      step.returnFrom = { week: r, share: A.painEasyFactor };
      step.levelKm = levelBefore(Math.min(...hurt.map((x) => day(x.date))));
    }
    reason(
      'PAIN',
      true,
      `Bol ${max}/10 u poslednja ${A.painLookbackDays} dana: ${restN > 0 ? `${restN} dana odmora, pa ` : ''}${A.painDays} dana bez kvaliteta (do ${step.pain.to}). ${A.painMessage}`
    );
  }

  let volumeRule = false;

  // Odluka 3: pauza — uzastopni POZNATI dani bez trčanja do asOf (2.6.0: samo u potpunoj pokrivenosti)
  // ili eksplicitna pauza (facts.breaks; završena u poslednjih 7 dana i posle prethodne adaptacije).
  const lastRun = runs.length > 0 ? Math.max(...runs.map((x) => day(x.date))) : null;
  let pause = 0;
  let pauseStart = t + 1;
  let explicit = false;
  if (cov !== null && cov.complete && day(cov.to) >= t) {
    const from = Math.max(lastRun !== null ? lastRun + 1 : -Infinity, day(cov.from));
    if (from <= t) [pause, pauseStart] = [t - from + 1, from];
  }
  const prevAsOf = steps.length > 0 ? day(steps[steps.length - 1]!.asOf) : null;
  for (const b of facts.breaks) {
    const len = day(b.to) - day(b.from) + 1;
    const recent = day(b.to) > t - A.windowDays && (prevAsOf === null || day(b.to) > prevAsOf);
    if (recent && len > pause) [pause, pauseStart, explicit] = [len, day(b.from), true];
  }
  if (pause >= A.pause.shortDays) {
    const ps = addDays(asOf, pauseStart - t);
    const pre =
      knownKm(pauseStart - A.windowDays, pauseStart - 1) ?? target(weekOf(ps)) ?? plan.startKm;
    const k14 = knownKm(pauseStart - 2 * A.windowDays, pauseStart - 1);
    const pre14 = k14 !== null ? k14 / 2 : pre;
    const tier = pause >= A.pause.longDays ? 'long' : pause >= A.pause.midDays ? 'mid' : 'short';
    const raw =
      tier === 'long'
        ? Math.min(pre14, pre * A.pause.longShare)
        : pre * (tier === 'mid' ? A.pause.midShare : A.pause.shortShare);
    let km = round1(Math.max(floorKm, raw));
    const tn = build(n) ? target(n) : null;
    if (tn !== null) km = Math.min(km, tn);
    step.startKm = km;
    step.reduced = true;
    step.pauseRemainder = true;
    step.restart = tier === 'long';
    step.levelKm = Math.max(step.levelKm ?? 0, levelBefore(pauseStart));
    const first: DateRange = { from: next, to: endOf(n) };
    if (tier === 'short') step.oneQuality.push(first);
    else {
      step.noQuality.push(first);
      if (n + 1 <= N) step.oneQuality.push({ from: wk(n + 1)!.startDate, to: wk(n + 1)!.endDate });
    }
    step.orientation = step.restart && N - n + 1 < A.restartFullPrepWeeks;
    volumeRule = true;
    reason(
      'PAUSE',
      true,
      `${explicit ? 'Pauza (prijavljena)' : 'Pauza'} ${pause} dana (obim 7 dana pre pauze ${round1(pre)} km): cilj ${km} km${km > round1(raw) ? ` (ne ispod ${floorKm} km za ${plan.input.runDays.length} dana)` : ''}; ${tier === 'short' ? 'prva nedelja 1 kvalitet' : 'prva nedelja bez kvaliteta, druga 1 kvalitet'}${step.restart ? '; nov start (faze preostale izgradnje ponovo)' : ''}${step.orientation ? `; ${A.orientationMessage.replace(/\.$/, '')}` : ''}.${growthNote(step.levelKm)}`
    );
  }

  // Odluka 5: umor (lagani = lagan ili dugi dan plana; trening van plana se računa kao lagan). 5k-v2.11.0 (C2, kao
  // 10K/HM/MAR): zapis bez dayId je van plana (lagan), ne uparuje se po datumu.
  const byId = new Map(planDays.map((d) => [d.date, d]));
  const easyHard = runs.filter((x) => {
    const d = x.dayId !== undefined ? byId.get(x.dayId) : undefined;
    return (
      t - day(x.date) < A.windowDays &&
      (x.rpe ?? 0) >= A.fatigueRpe &&
      (!d || d.workout.kind === 'easy' || d.workout.kind === 'long')
    );
  });
  if (easyHard.length >= A.fatigueCount) {
    // 2.8.0 (MASTER pouka 36): umor je vezan za ZAPISE — prinudno rasterećenje je nedelja POSLE nedelje poslednjeg
    // zapisa umora (prva nedelja koja počinje posle zapisa). Ako je asOf već u njoj (r < n), rasterećenje važi za
    // njen ostatak (prošli dani zaštićeni); ako je ona već rasterećenje (redovno ili od istih zapisa), novo se ne
    // pravi. Isti zapisi prijavljeni u nedelju i u ponedeljak daju isti plan.
    const last = Math.max(...easyHard.map((x) => day(x.date)));
    const after = addDays(asOf, last + 1 - t);
    const ra = weekOf(after);
    const dw = Math.max(r, ra <= N && day(weeks[ra - 1]!.startDate) < day(after) ? ra + 1 : ra);
    const ok = !volumeRule && build(dw) && !wk(dw)!.deload;
    if (ok) {
      step.deload = true;
      if (dw !== n) step.deloadWeek = dw;
      volumeRule = true;
    }
    reason(
      'FATIGUE',
      ok,
      `${easyHard.length} lagana treninga sa RPE ≥ ${A.fatigueRpe} u 7 dana: ${ok ? `nedelja ${wl(dw)} je rasterećenje${dw < n ? ` (ostatak od ${next})` : ''}` : volumeRule ? 'nadjačano pauzom' : dw < n && build(dw) ? `rasterećenje za ove zapise je već u planu (nedelja ${wl(dw)})` : 'sledeća nedelja je već rasterećenje, taper ili trka'}.`
    );
  }

  // Odluke 2 i 6: izvršenje prema planu (prozori od 7 dana do asOf). 2.6.0: samo potpuno pokriveni
  // prozori (Odluka 3); nepokriven deo nije manjak ni višak.
  const w2 = [t - A.windowDays + 1, t] as const;
  const w1 = [t - 2 * A.windowDays + 1, t - A.windowDays] as const;
  if (coveredDays(cov, ...w2)) {
    const p2 = plannedKm(...w2);
    const a2 = sumKm(...w2);
    const tn = target(n);
    // 5k-v2.11.1 (Z7, kao umor — pouka 36): manjak je vezan za ZAPISE — korak čiji se prozor zapisa preklapa sa
    // prozorom ranijeg primenjenog koraka manjka ne pravi novi (isti zapisi ne seku cilj ponovo).
    const seen = steps.find((s) => s.underFrom !== undefined && day(s.asOf) >= w2[0]);
    if (p2 > 0 && a2 < A.underShare * p2 && seen) {
      volumeRule = true;
      reason(
        'UNDER_EXECUTION',
        false,
        `Izvršeno ${round1(a2)} od ${round1(p2)} km u 7 dana: manjak za ove zapise je već u planu (prilagođavanje ${seen.asOf}).`
      );
    } else if (p2 > 0 && a2 < A.underShare * p2) {
      const ok = !volumeRule && build(n) && tn !== null;
      if (ok) {
        // Ne ispod min(planirano, donja granica volume.adaptFloorKm).
        step.startKm = round1(
          Math.max(
            Math.min(tn, lastBuild ?? tn, Math.max(a2, A.underFloorShare * tn)),
            Math.min(tn, floorKm)
          )
        );
        step.reduced = true;
        step.underFrom = addDays(asOf, w2[0] - t);
        step.levelKm = Math.max(step.levelKm ?? 0, levelBefore(w2[0]));
        volumeRule = true;
      }
      reason(
        'UNDER_EXECUTION',
        ok,
        `Izvršeno ${round1(a2)} od ${round1(p2)} km u 7 dana (< ${A.underShare * 100}%): ${ok ? `nedelja ${wl(n)} ne raste, cilj ${step.startKm} km.${growthNote(step.levelKm!)}` : 'nadjačano ili nema sledeće nedelje izgradnje.'}`
      );
    } else if (coveredDays(cov, w1[0], t)) {
      const p1 = plannedKm(...w1);
      const a1 = sumKm(...w1);
      if (p1 > 0 && p2 > 0 && a1 > A.overShare * p1 && a2 > A.overShare * p2) {
        const ok = !volumeRule && build(n) && tn !== null && !wk(n)!.deload;
        if (ok) {
          // 5k-v2.11.0 (N1): poslednja izgradnja posle bola je osnova povratka — kao kod manjka, ne ispod
          // min(planirano, donja granica volume.adaptFloorKm).
          step.startKm = round1(Math.max(Math.min(tn, lastBuild ?? tn), Math.min(tn, floorKm)));
          step.reduced = false;
          volumeRule = true;
        }
        reason(
          'OVER_EXECUTION',
          ok,
          `Izvršeno > ${Math.round(A.overShare * 100)}% planiranog dve nedelje zaredom (${round1(a1)}/${round1(p1)}, ${round1(a2)}/${round1(p2)} km): ${ok ? `plan se ne povećava (nedelja ${wl(n)}: ${step.startKm} km). Više od plana povećava rizik; drži se plana` : 'nadjačano, ili sledeća nedelja nije nedelja izgradnje bez rasterećenja'}.`
        );
      }
    }
  }
  if (
    W.length === 0 &&
    facts.results.length === 0 &&
    facts.lockedDayIds.length === 0 &&
    facts.breaks.length === 0
  )
    reason('NO_FACTS', true, 'Nema činjenica: budući deo plana ostaje isti.');
  return { ok: true, step, reasons: out };
}

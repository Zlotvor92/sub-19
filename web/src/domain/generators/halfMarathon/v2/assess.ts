/* Segment 04 (H18): činjenice → OGRANIČENJA adaptacije (HmV2AdaptStep). JEDINO mesto odluka A1–A10
   (DECISIONS hm-v2.3.0; sidro bola A4 / pouka 18; oznaka smanjenja `reduced` A17 / pouka 22): ovde se ne
   gradi nijedna nedelja; konstruktor (generate.construct) prima korak kao ulaz. Kopija 10K v2 (Uslov 7).
   A10: dan bez zapisa je poznat (bez trčanja) samo u facts.coverage sa complete = true; A2, A3 (iz zapisa)
   i A6 samo na pokrivenom delu; bol, umor, rezultat i eksplicitna pauza (facts.breaks) uvek. */

import { addDays, dayNumber, mustDay } from './dates.ts';
import type { PaceInput } from './input.ts';
import { round1, vdotFromResult } from './paces.ts';
import { isBuildPhase } from './periodize.ts';
import { HM_V2_POLICY as P } from './policy.ts';
import { stepVdotAt } from './steps.ts';
import { returnAnchor, returnBase10 } from './volume.ts';
import type {
  AdaptReason,
  BreakFact,
  DateRange,
  FactsCoverage,
  IsoDate,
  PlanDay,
  PreStartRef,
  Reason,
  ResultDistanceM,
  ResultFact,
  HmV2AdaptStep,
  HmV2Plan,
  WorkoutFact
} from './types.ts';

const A = P.adapt;
const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const fmt = (sec: number): string =>
  `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}`;
const km = (x: number): string => round1(x).toFixed(1).replace('.', ',');
const growthNote = (level: number): string =>
  ` Povratak do ${km(level)} km (nivo pre smanjenja) po +${A.returnGrowth * 100} %/ned (min ${km(A.returnGrowthMinKm)} km), osim tapera i trkačke nedelje (A8).`;

/**
 * A4 (pouka 18): dopuna poruke PAIN koraka sa povratkom — osnova iz cilja nedelje sidra r U KONSTRUKCIJI
 * (`targetR10`; pauza iz istog koraka ga smanjuje, A3) i nivoa koraka (A8: najveći). Osnovu računa samo
 * volume.returnBase10 (isto što konstruktor posle nedelje r); adapt.ts poziva posle konstrukcije. N2
 * (pouka 18): kad je osnova cilj nedelje r (< 0,7 × nivo), poruka imenuje cilj r i 70 % nivoa.
 */
export function painReturnNote(step: HmV2AdaptStep, targetR10: number): string {
  const rf = step.returnFrom!;
  const a = returnAnchor(rf.share, step.levelKm);
  const base = returnBase10(a, targetR10);
  // Kad deluje min sa ciljem nedelje r, broj je cilj nedelje r, ne udeo nivoa.
  const from =
    a.base10 !== null && base < a.base10
      ? `${km(base / 10)} km (cilj nedelje ${rf.week}; ${rf.share * 100} % nivoa pre bola bilo bi ${km(a.base10 / 10)} km)`
      : `${rf.share * 100} % nivoa pre bola (${km(base / 10)} km)`;
  return ` Posle nedelje ${rf.week} rast kreće od ${from}.${growthNote(step.levelKm!)}`;
}

export interface CheckedFacts {
  workouts: WorkoutFact[];
  results: ResultFact[];
  lockedDayIds: string[];
  /** null = bez pokrivenosti (nijedan dan bez zapisa nije poznat, A10). */
  coverage: FactsCoverage | null;
  breaks: BreakFact[];
}

/** A10: da li su svi dani [from, to] poznati (pokriveni potpunim zapisom). */
export function coveredDays(c: FactsCoverage | null, from: number, to: number): boolean {
  return c !== null && c.complete && mustDay(c.from) <= from && mustDay(c.to) >= to;
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
  if (typeof raw !== 'object' || Array.isArray(raw)) {
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
    return v as unknown[];
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
  const obj = (x: unknown): Record<string, unknown> =>
    (typeof x === 'object' && x !== null ? x : {}) as Record<string, unknown>;
  const workouts: WorkoutFact[] = [];
  list('workouts').forEach((x, i) => {
    const o = obj(x);
    const what = `Trening ${i + 1}`;
    if (!dateOk(o['date'], what)) return;
    const bad = (m: string): void => add('ADAPT_FACT_INVALID', `${what}: ${m}`);
    const { dayId, km: k, durationSec, completed, rpe, pain } = o;
    if (dayId !== undefined && (typeof dayId !== 'string' || !days.has(dayId)))
      return add('ADAPT_DAY_UNKNOWN', `${what}: dayId ${JSON.stringify(dayId)} nije dan plana.`);
    if (!isNum(k) || k < 0) return bad('km mora biti ≥ 0.');
    if (!isNum(durationSec) || durationSec < 0) return bad('durationSec mora biti ≥ 0.');
    if (typeof completed !== 'boolean') return bad('completed mora biti true/false.');
    if (rpe !== undefined && (!isNum(rpe) || rpe < 1 || rpe > 10))
      return bad('rpe mora biti 1–10.');
    if (pain !== undefined && (!isNum(pain) || pain < 0 || pain > 10))
      return bad('pain mora biti 0–10.');
    workouts.push({
      date: o['date'],
      ...(dayId !== undefined ? { dayId } : {}),
      km: k,
      durationSec,
      completed,
      ...(rpe !== undefined ? { rpe } : {}),
      ...(pain !== undefined ? { pain } : {})
    });
  });
  const results: ResultFact[] = [];
  list('results').forEach((x, i) => {
    const o = obj(x);
    const what = `Rezultat ${i + 1}`;
    if (!dateOk(o['date'], what)) return;
    const { distM, sec, kind } = o;
    if (!P.input.resultDistancesM.includes(distM as number))
      return add(
        'ADAPT_RESULT_INVALID',
        `${what}: distanca mora biti 5000, 10000, 21097,5 ili 42195 m.`
      );
    if (!isNum(sec) || sec <= 0)
      return add('ADAPT_RESULT_INVALID', `${what}: vreme mora biti > 0 s.`);
    if (kind !== 'test' && kind !== 'race')
      return add('ADAPT_RESULT_INVALID', `${what}: kind mora biti 'test' ili 'race'.`);
    results.push({ distM: distM as ResultDistanceM, sec, date: o['date'], kind });
  });
  const lockedDayIds: string[] = [];
  for (const id of list('lockedDayIds')) {
    if (typeof id !== 'string' || !days.has(id))
      add('ADAPT_DAY_UNKNOWN', `Zaključan dan ${JSON.stringify(id)} nije dan plana.`);
    else if (!lockedDayIds.includes(id)) lockedDayIds.push(id);
  }
  // Opseg datuma (from ≤ to ≤ asOf): pokrivenost i eksplicitne pauze.
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
    const o = obj(rc);
    const d = range(o, 'coverage');
    if (typeof o['complete'] !== 'boolean')
      add('ADAPT_FACT_INVALID', 'coverage.complete mora biti true/false.');
    else if (d) coverage = { ...d, complete: o['complete'] };
  }
  const breaks: BreakFact[] = [];
  list('breaks').forEach((x, i) => {
    const o = obj(x);
    const what = `Pauza ${i + 1}`;
    if (o['kind'] !== 'break') return add('ADAPT_FACT_INVALID', `${what}: kind mora biti 'break'.`);
    const d = range(o, what);
    if (d) breaks.push({ kind: 'break', ...d });
  });
  return reasons.length > 0
    ? { ok: false, reasons }
    : { ok: true, facts: { workouts, results, lockedDayIds, coverage, breaks } };
}

/**
 * Ograničenja iz činjenica (A1–A10). Nedelja r sadrži asOf + 1; n = prva puna nedelja posle asOf
 * („sledeća nedelja"). Obim (A7): samo najviše aktivno od pauza > umor > izvršenje; bol uvek, po
 * datumima; novi rezultat uvek ažurira tempo. `pace` = osnova tempa ulaza (input.checkInput).
 */
export function assess(
  plan: HmV2Plan,
  facts: CheckedFacts,
  asOf: IsoDate,
  pace: PaceInput,
  weekMinKm: number,
  week1Ref: () => PreStartRef | null = () => null
): { step: HmV2AdaptStep; reasons: AdaptReason[] } {
  const weeks = plan.weeks;
  const N = weeks.length;
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
    return x !== null && isBuildPhase(x.phase);
  };
  let lastBuild: number | null = null;
  for (const w of weeks) if (w.index < n && !w.deload && build(w.index)) lastBuild = w.targetKm;
  const out: AdaptReason[] = [];
  const reason = (condition: AdaptReason['condition'], applied: boolean, message: string): void => {
    out.push({ condition, applied, message });
  };

  const W = facts.workouts;
  // A10: trčanje = završen zapis sa km ili trajanjem.
  const runs = W.filter((x) => x.completed && (x.km > 0 || x.durationSec > 0));
  const sumKm = (from: number, to: number): number =>
    runs.filter((x) => day(x.date) >= from && day(x.date) <= to).reduce((s, x) => s + x.km, 0);
  const planDays: PlanDay[] = weeks.flatMap((w) => w.days);
  const plannedKm = (from: number, to: number): number =>
    planDays
      .filter((d) => d.countsToWeek && day(d.date) >= from && day(d.date) <= to)
      .reduce((s, d) => s + d.workout.km, 0);
  // A10: poznati su samo dani u potpunoj pokrivenosti; km iz zapisa samo tada i samo ako svako trčanje u
  // prozoru ima km (vremenski zapis bez km = nepoznat obim).
  const cov = facts.coverage;
  const knownKm = (from: number, to: number): number | null =>
    coveredDays(cov, from, to) &&
    runs.every((x) => x.km > 0 || day(x.date) < from || day(x.date) > to)
      ? sumKm(from, to)
      : null;
  const t = day(asOf);
  // A8: nivo pre smanjenja = cilj poslednje ne-rasteretne nedelje izgradnje završene pre prvog dana
  // događaja; bez nje — start plana.
  const levelBefore = (event: number): number => {
    let lv: number | null = null;
    for (const w of weeks)
      if (day(w.endDate) < event && !w.deload && build(w.index)) lv = w.targetKm;
    return lv ?? plan.startKm;
  };
  const target = (w: number): number | null => wk(w)?.targetKm ?? null;
  const endOf = (w: number): IsoDate => wk(Math.min(w, N))!.endDate;

  const step: HmV2AdaptStep = {
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

  // A1: novi rezultat (≤ 84 dana, noviji od rezultata u upotrebi, VDOT 30–80).
  const prevResult =
    [...steps].reverse().find((s) => s.result)?.result?.date ?? plan.input.recentResult?.date;
  const vdotOf = (x: ResultFact): number => round1(vdotFromResult(x.distM, x.sec));
  const label = (x: ResultFact): string =>
    `${x.kind === 'test' ? 'Test' : 'Trka'} ${x.distM === 21097.5 ? 'polumaraton' : x.distM === 42195 ? 'maraton' : `${x.distM / 1000} km`} ${fmt(x.sec)} (${x.date})`;
  const q = P.input;
  const fresh = facts.results.filter((x) => t - day(x.date) <= q.resultMaxAgeDays);
  for (const x of facts.results)
    if (!fresh.includes(x))
      reason(
        'RESULT_IGNORED',
        false,
        `${label(x)}: stariji od ${q.resultMaxAgeDays} dana — ne menja tempo (A1).`
      );
  const newer = fresh
    .filter((x) => prevResult === undefined || day(x.date) > day(prevResult))
    .sort((a, b) => day(b.date) - day(a.date) || vdotOf(b) - vdotOf(a));
  for (const x of fresh)
    if (!newer.includes(x))
      reason('RESULT_IGNORED', false, `${label(x)}: nije noviji od rezultata u upotrebi (A1).`);
  let res: ResultFact | null = null;
  for (const x of newer) {
    const v = vdotOf(x);
    if (v < q.vdotMin || v > q.vdotMax)
      reason(
        'RESULT_IGNORED',
        false,
        `${label(x)}: VDOT ${km(v)} van ${q.vdotMin}–${q.vdotMax} — rezultat se ne primenjuje (A1).`
      );
    else if (res) reason('RESULT_IGNORED', false, `${label(x)}: nije najnoviji rezultat (A1).`);
    else res = x;
  }
  if (res) {
    const v = vdotOf(res);
    if (n <= N) {
      step.result = res;
      step.vdot = v;
      const was = stepVdotAt(steps, n);
      reason(
        'NEW_RESULT',
        true,
        `${label(res)}: VDOT ${km(v)} od nedelje ${n}${was === null && pace.kind === 'feel' ? ' — plan po osećaju prelazi na tempo iz rezultata' : ` (bilo ${km(was ?? (pace.kind === 'result' ? pace.vdotRaw : 0))})`}; obim po pravilu H6, doza se nastavlja (A1).`
      );
    } else
      reason(
        'NEW_RESULT',
        false,
        `${label(res)}: nema sledeće nedelje do trke — tempo ostaje (A1).`
      );
  }

  // A4: bol (uvek, po datumima; prethodni koraci ostaju, pa ponovni bol produžava period). Pouka 18:
  // sidro povratka = nedelja r (prvi dan odmora ili bola), ne poslednja nedelja bola.
  const hurt = W.filter((x) => t - day(x.date) < A.painLookbackDays && (x.pain ?? 0) >= A.painMin);
  if (hurt.length > 0) {
    const max = Math.max(...hurt.map((x) => x.pain!));
    const restN = max >= A.painRestMin ? A.restDays : 0;
    if (restN > 0) step.rest = { from: next, to: addDays(asOf, restN) };
    step.pain = { from: addDays(asOf, restN + 1), to: addDays(asOf, restN + A.painDays) };
    const back = r <= N && build(r);
    if (back) {
      step.returnFrom = { week: r, share: A.painEasyFactor };
      step.levelKm = levelBefore(Math.min(...hurt.map((x) => day(x.date))));
    }
    reason(
      'PAIN',
      true,
      `Bol ${max}/10 u poslednja ${A.painLookbackDays} dana: ${restN > 0 ? `${restN} dana odmora (do ${step.rest!.to}), pa ` : ''}${A.painDays} dana bez kvaliteta i ubrzanja (${step.pain.from} – ${step.pain.to}). ${A.painMessage}`
    );
    // Osnova povratka (cilj nedelje r posle konstrukcije, nivo konačnog koraka): painReturnNote, adapt.ts.
  }

  let volumeRule = false;

  // A3: pauza — uzastopni POZNATI dani bez trčanja do asOf (A10: samo u potpunoj pokrivenosti) ili
  // eksplicitna pauza (završena u poslednjih 7 dana i posle prethodne adaptacije).
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
    let k = round1(Math.max(weekMinKm, raw));
    const tn = build(n) ? target(n) : null;
    if (tn !== null) k = Math.min(k, tn);
    step.startKm = k;
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
      `${explicit ? 'Pauza (prijavljena)' : 'Pauza'} ${pause} dana (obim 7 dana pre pauze ${km(pre)} km): cilj ${km(k)} km${k > round1(raw) && k === round1(weekMinKm) ? ` (ne ispod minimuma nedelje ${km(weekMinKm)} km, A9)` : ''}; ${tier === 'short' ? 'prva nedelja 1 kvalitet' : 'prva nedelja bez kvaliteta, druga 1 kvalitet'}${step.restart ? '; nov start (faze preostale izgradnje ponovo, vrh od novog starta)' : ''} (A3).${step.orientation ? ` ${A.orientationMessage}` : ''}${growthNote(step.levelKm)}`
    );
  }

  // A5: umor (lagani = lagan ili dugi dan plana; zapis bez dayId = van plana, računa se kao lagan).
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
    const ok = !volumeRule && build(n) && !wk(n)!.deload;
    // Pouka 34: asOf pre starta (nedelja 1 je sledeća) — referenca je nedelja 1 generatora bez činjenica.
    const ref = ok && n === 1 && t < day(weeks[0]!.startDate) ? week1Ref() : null;
    if (ok) {
      step.deload = true;
      volumeRule = true;
      if (ref) step.preStart = ref;
    }
    reason(
      'FATIGUE',
      ok,
      `${easyHard.length} lagana treninga sa RPE ≥ ${A.fatigueRpe} u 7 dana: ${ok ? `nedelja ${n} je rasterećenje (A5)${ref ? `; pre starta: 0,8 × planirana nedelja 1 (${km(ref.targetKm)} km), nedelja 2 = ${km(ref.targetKm)} km bez rasta (pouka 34)` : ''}` : volumeRule ? 'nadjačano pauzom (A7)' : 'sledeća nedelja je već rasterećenje, taper ili trka (A5)'}.`
    );
  }

  // A2 i A6: izvršenje prema planu (prozori od 7 dana do asOf) — samo potpuno pokriveni prozori (A10).
  const w2 = [t - A.windowDays + 1, t] as const;
  const w1 = [t - 2 * A.windowDays + 1, t - A.windowDays] as const;
  if (coveredDays(cov, ...w2)) {
    const p2 = plannedKm(...w2);
    const a2 = sumKm(...w2);
    const tn = build(n) ? target(n) : null;
    if (p2 > 0 && a2 < A.underShare * p2) {
      const ok = !volumeRule && tn !== null;
      if (ok) {
        step.startKm = round1(
          Math.max(
            Math.min(tn, lastBuild ?? tn, Math.max(a2, A.underFloorShare * tn)),
            Math.min(tn, weekMinKm)
          )
        );
        step.reduced = true;
        step.levelKm = Math.max(step.levelKm ?? 0, levelBefore(w2[0]));
        volumeRule = true;
      }
      reason(
        'UNDER_EXECUTION',
        ok,
        `Izvršeno ${km(a2)} od ${km(p2)} km u 7 dana (< ${A.underShare * 100} %): ${ok ? `nedelja ${n} ne raste, cilj ${km(step.startKm!)} km (A2).${growthNote(step.levelKm!)}` : volumeRule ? 'nadjačano (A7).' : 'sledeća nedelja nije izgradnja (A2).'}`
      );
    } else if (coveredDays(cov, w1[0], t)) {
      const p1 = plannedKm(...w1);
      const a1 = sumKm(...w1);
      if (p1 > 0 && p2 > 0 && a1 > A.overShare * p1 && a2 > A.overShare * p2) {
        const ok = !volumeRule && tn !== null && !wk(n)!.deload;
        if (ok) {
          step.startKm = round1(Math.min(tn, lastBuild ?? tn));
          step.reduced = false;
          volumeRule = true;
        }
        reason(
          'OVER_EXECUTION',
          ok,
          `Izvršeno > ${Math.round(A.overShare * 100)} % planiranog dve nedelje zaredom (${km(a1)}/${km(p1)}, ${km(a2)}/${km(p2)} km): ${ok ? `plan se ne povećava (nedelja ${n}: ${km(step.startKm!)} km); više od plana povećava rizik — drži se plana (A6)` : volumeRule ? 'nadjačano (A7)' : 'sledeća nedelja nije izgradnja bez rasterećenja (A6)'}.`
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
  return { step, reasons: out };
}

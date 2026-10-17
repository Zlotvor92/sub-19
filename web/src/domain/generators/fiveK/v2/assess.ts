/* 2.5.0: činjenice → OGRANIČENJA adaptacije (AdaptStep). JEDINO mesto odluka 1–7 (DECISIONS 5k-v2.5.0):
   ovde se ne gradi nijedna nedelja; konstruktor (generate.construct) prima korak kao ulaz.
   Činjenice se smatraju potpunim od prvog zapisa treninga do asOf; bez zapisa nema pravila iz treninga. */

import { addDays, dayNumber, mustDay } from './dates.ts';
import { vdotFromResult } from './paces.ts';
import { FIVE_K_V2_POLICY as P, rulesOf } from './policy.ts';
import { baseAthlete, vdotAt } from './steps.ts';
import type {
  AdaptReason,
  AdaptStep,
  DateRange,
  FiveKV2Plan,
  IsoDate,
  PlanDay,
  Reason,
  ResultFact,
  WorkoutFact
} from './types.ts';

const A = P.adapt;
const round1 = (x: number): number => Math.round(x * 10) / 10;
const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const fmt = (sec: number): string =>
  `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}`;

export interface CheckedFacts {
  workouts: WorkoutFact[];
  results: ResultFact[];
  lockedDayIds: string[];
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
  return reasons.length > 0
    ? { ok: false, reasons }
    : { ok: true, facts: { workouts, results, lockedDayIds } };
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
  let lastBuild: number | null = null;
  for (const w of weeks) if (w.index < n && !w.deload && build(w.index)) lastBuild = w.targetKm;
  const out: AdaptReason[] = [];
  const reason = (condition: AdaptReason['condition'], applied: boolean, message: string): void => {
    out.push({ condition, applied, message });
  };

  const W = facts.workouts;
  const runs = W.filter((x) => x.completed && x.km > 0);
  const sumKm = (from: number, to: number): number =>
    runs.filter((x) => day(x.date) >= from && day(x.date) <= to).reduce((s, x) => s + x.km, 0);
  const planDays: PlanDay[] = weeks.flatMap((w) => w.days);
  const plannedKm = (from: number, to: number): number =>
    planDays
      .filter((d) => d.countsToWeek && day(d.date) >= from && day(d.date) <= to)
      .reduce((s, d) => s + d.workout.km, 0);
  const coverage = W.length > 0 ? Math.min(...W.map((x) => day(x.date))) : null;
  const t = day(asOf);

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
    orientation: false
  };
  const prevResult =
    [...steps].reverse().find((s) => s.result)?.result?.date ?? plan.input.recentResult?.date;
  const vdotOf = (x: ResultFact): number => round1(vdotFromResult(x.distM, x.sec));
  const fresh = facts.results.filter((x) => t - day(x.date) <= A.resultMaxAgeDays);
  for (const x of facts.results)
    if (!fresh.includes(x))
      reason(
        'RESULT_IGNORED',
        false,
        `Rezultat ${x.date} je stariji od 12 nedelja — ne menja tempo.`
      );
  const newer = fresh
    .filter((x) => prevResult === undefined || day(x.date) > day(prevResult))
    .sort((a, b) => day(b.date) - day(a.date) || vdotOf(b) - vdotOf(a));
  for (const x of fresh)
    if (!newer.includes(x))
      reason('RESULT_IGNORED', false, `Rezultat ${x.date} nije noviji od rezultata u upotrebi.`);
  const res = newer[0];
  if (res) {
    const v = vdotOf(res);
    if (v < P.input.vdot.min || v > P.input.vdot.max)
      return {
        ok: false,
        reasons: [
          {
            code: 'VDOT_OUT_OF_RANGE',
            message: `VDOT novog rezultata (${v}) mora biti ${P.input.vdot.min}–${P.input.vdot.max}.`
          }
        ]
      };
    if (n <= N) {
      step.result = res;
      step.vdot = v;
      const was = vdotAt(plan.input, steps, n);
      reason(
        'NEW_RESULT',
        true,
        `${res.kind === 'test' ? 'Test' : 'Trka'} ${res.distM / 1000}K ${fmt(res.sec)} (${res.date}): VDOT ${v} od nedelje ${n}${was === null ? ' — plan po osećaju prelazi na tempo' : ` (bilo ${was})`}.`
      );
    } else
      reason('NEW_RESULT', false, 'Novi rezultat: nema sledeće nedelje do trke — tempo ostaje.');
  }

  // Odluka 4: bol (uvek, po datumima; prethodni koraci ostaju, pa ponovni bol produžava period).
  const hurt = W.filter((x) => t - day(x.date) < A.painLookbackDays && (x.pain ?? 0) >= A.painMin);
  if (hurt.length > 0) {
    const max = Math.max(...hurt.map((x) => x.pain!));
    const restN = max >= A.painRestMin ? A.restDays : 0;
    if (restN > 0) step.rest = { from: next, to: addDays(asOf, restN) };
    step.pain = { from: addDays(asOf, restN + 1), to: addDays(asOf, restN + A.painDays) };
    reason(
      'PAIN',
      true,
      `Bol ${max}/10 u poslednja ${A.painLookbackDays} dana: ${restN > 0 ? `${restN} dana odmora, pa ` : ''}${A.painDays} dana bez kvaliteta (do ${step.pain.to}). ${A.painMessage}`
    );
  }

  const rules = rulesOf(baseAthlete(plan.input));
  const target = (w: number): number | null => wk(w)?.targetKm ?? null;
  const endOf = (w: number): IsoDate => wk(Math.min(w, N))!.endDate;
  let volumeRule = false;

  // Odluka 3: pauza (uzastopni dani bez trčanja do asOf).
  if (coverage !== null) {
    const lastRun = runs.length > 0 ? Math.max(...runs.map((x) => day(x.date))) : null;
    const pause = lastRun !== null ? t - lastRun : t - coverage + 1;
    if (pause >= A.pause.shortDays) {
      const pre =
        lastRun !== null
          ? sumKm(lastRun - 6, lastRun)
          : (target(weekOf(addDays(asOf, -pause + 1))) ?? plan.startKm);
      const pre14 = lastRun !== null ? sumKm(lastRun - 13, lastRun) / 2 : pre;
      const tier = pause >= A.pause.longDays ? 'long' : pause >= A.pause.midDays ? 'mid' : 'short';
      const raw =
        tier === 'long'
          ? Math.min(pre14, pre * A.pause.longShare)
          : pre * (tier === 'mid' ? A.pause.midShare : A.pause.shortShare);
      let km = round1(Math.max(rules.weeklyKm.min, raw));
      const tn = build(n) ? target(n) : null;
      if (tn !== null) km = Math.min(km, tn);
      step.startKm = km;
      step.pauseRemainder = true;
      step.restart = tier === 'long';
      const first: DateRange = { from: next, to: endOf(n) };
      if (tier === 'short') step.oneQuality.push(first);
      else {
        step.noQuality.push(first);
        if (n + 1 <= N)
          step.oneQuality.push({ from: wk(n + 1)!.startDate, to: wk(n + 1)!.endDate });
      }
      step.orientation = step.restart && N - n + 1 < A.restartFullPrepWeeks;
      volumeRule = true;
      reason(
        'PAUSE',
        true,
        `Pauza ${pause} dana (obim 7 dana pre pauze ${round1(pre)} km): cilj ${km} km${km > round1(raw) ? ` (ne ispod ${rules.weeklyKm.min} km za ${plan.input.runDays.length} dana)` : ''}; ${tier === 'short' ? 'prva nedelja 1 kvalitet' : 'prva nedelja bez kvaliteta, druga 1 kvalitet'}${step.restart ? '; nov start (faze preostale izgradnje ponovo)' : ''}${step.orientation ? `; ${A.orientationMessage}` : ''}.`
      );
    }
  }

  // Odluka 5: umor (lagani = lagan ili dugi dan plana; trening van plana se računa kao lagan).
  const byId = new Map(planDays.map((d) => [d.date, d]));
  const easyHard = runs.filter((x) => {
    const d = byId.get(x.dayId ?? x.date);
    return (
      t - day(x.date) < A.windowDays &&
      (x.rpe ?? 0) >= A.fatigueRpe &&
      (!d || d.workout.kind === 'easy' || d.workout.kind === 'long')
    );
  });
  if (easyHard.length >= A.fatigueCount) {
    const ok = !volumeRule && build(n) && !wk(n)!.deload;
    if (ok) {
      step.deload = true;
      volumeRule = true;
    }
    reason(
      'FATIGUE',
      ok,
      `${easyHard.length} lagana treninga sa RPE ≥ ${A.fatigueRpe} u 7 dana: ${ok ? `nedelja ${n} je rasterećenje` : volumeRule ? 'nadjačano pauzom' : 'sledeća nedelja je već rasterećenje, taper ili trka'}.`
    );
  }

  // Odluke 2 i 6: izvršenje prema planu (prozori od 7 dana do asOf; samo pokriveni činjenicama).
  const w2 = [t - A.windowDays + 1, t] as const;
  const w1 = [t - 2 * A.windowDays + 1, t - A.windowDays] as const;
  if (coverage !== null && coverage <= w2[0]) {
    const p2 = plannedKm(...w2);
    const a2 = sumKm(...w2);
    const tn = target(n);
    if (p2 > 0 && a2 < A.underShare * p2) {
      const ok = !volumeRule && build(n) && tn !== null;
      if (ok) {
        // Ne ispod min(planirano, donja granica ulaza za broj dana) — kao volume.adaptFloorKm.
        step.startKm = round1(
          Math.max(
            Math.min(tn, lastBuild ?? tn, Math.max(a2, A.underFloorShare * tn)),
            Math.min(tn, rules.weeklyKm.min)
          )
        );
        volumeRule = true;
      }
      reason(
        'UNDER_EXECUTION',
        ok,
        `Izvršeno ${round1(a2)} od ${round1(p2)} km u 7 dana (< ${A.underShare * 100}%): ${ok ? `nedelja ${n} ne raste, cilj ${step.startKm} km` : 'nadjačano ili nema sledeće nedelje izgradnje'}.`
      );
    } else if (coverage <= w1[0]) {
      const p1 = plannedKm(...w1);
      const a1 = sumKm(...w1);
      if (p1 > 0 && p2 > 0 && a1 > A.overShare * p1 && a2 > A.overShare * p2) {
        const ok = !volumeRule && build(n) && tn !== null && !wk(n)!.deload;
        if (ok) {
          step.startKm = round1(Math.min(tn, lastBuild ?? tn));
          volumeRule = true;
        }
        reason(
          'OVER_EXECUTION',
          ok,
          `Izvršeno > ${Math.round(A.overShare * 100)}% planiranog dve nedelje zaredom (${round1(a1)}/${round1(p1)}, ${round1(a2)}/${round1(p2)} km): ${ok ? `plan se ne povećava (nedelja ${n}: ${step.startKm} km). Više od plana povećava rizik; drži se plana` : 'nadjačano, ili sledeća nedelja nije nedelja izgradnje bez rasterećenja'}.`
        );
      }
    }
  }
  if (W.length === 0 && facts.results.length === 0 && facts.lockedDayIds.length === 0)
    reason('NO_FACTS', true, 'Nema činjenica: budući deo plana ostaje isti.');
  return { ok: true, step, reasons: out };
}

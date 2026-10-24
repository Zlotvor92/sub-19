/* Ugao 4 (jedan vlasnik), HM — validator sam računa veličinu umesto da pozove vlasnika. Za svaki par: iscrpno po
   celom dozvoljenom domenu (tempo iz VDOT 30–80 korak 0,1 i lagan 270–510 s/km korak 1; ostalo navedeno) proverava
   da li dve definicije daju isti ishod. Bez slučajnosti.
   Pokretanje iz web/: node ../docs/generators-v2/audit/owner/hm-algebra.ts */
import { feelPaces, midEasy, pacesFromVdot, round1, vdotFromResult } from '../../../../web/src/domain/generators/halfMarathon/v2/paces.ts';
import { longTimeCap10, painLong10 } from '../../../../web/src/domain/generators/halfMarathon/v2/lengths.ts';
import { HM_V2_POLICY as P, planRule } from '../../../../web/src/domain/generators/halfMarathon/v2/policy.ts';
import { easyTimeWorkout, qualityWorkout, warmupCooldown } from '../../../../web/src/domain/generators/halfMarathon/v2/workouts.ts';
import { raceEasyWorkout } from '../../../../web/src/domain/generators/halfMarathon/v2/week.ts';
import { checkInput } from '../../../../web/src/domain/generators/halfMarathon/v2/input.ts';
import { patternOf } from '../../../../web/src/domain/generators/halfMarathon/v2/schedule.ts';
import type { Paces, Weekday } from '../../../../web/src/domain/generators/halfMarathon/v2/types.ts';

const EPSV = 1e-6; // validate.ts:144
const paces: Paces[] = [];
for (let v = 300; v <= 800; v++) paces.push(pacesFromVdot(v / 10));
for (let e = 270; e <= 510; e++) paces.push(feelPaces(e));
const out: Record<string, { checked: number; diverge: number; example?: string }> = {};
const rec = (k: string, bad: boolean, ex: () => string) => {
  const o = (out[k] ??= { checked: 0, diverge: 0 });
  o.checked++;
  if (bad) {
    o.diverge++;
    o.example ??= ex();
  }
};

// 1. LONG_DURATION (validate.ts:674) vs longTimeCap10 (lengths.ts:180), i bol (validate.ts:662 vs lengths.painLong10).
for (const p of paces)
  for (const S of [P.lengths.longMaxSec, P.beginner.longMaxSec, P.adapt.painLongMaxSec]) {
    const cap = longTimeCap10(p, S);
    for (const l10 of [cap - 1, cap, cap + 1]) {
      const ctor = l10 <= cap; // konstruktor sme da sastavi
      const val = !((l10 / 10) * p.E.slow > S + EPSV); // validator prihvata
      rec('LONG_DURATION ⇔ longTimeCap10', ctor !== val, () => `E.slow ${p.E.slow}, S ${S}, l10 ${l10}: ctor ${ctor} val ${val}`);
    }
    if (S === P.adapt.painLongMaxSec)
      for (const l10 of [40, 80, 120, 160, 200, 240]) {
        const c = painLong10(l10, p);
        const vOk = !((c / 10) * p.E.slow > Math.min(P.lengths.longMaxSec, S) + EPSV);
        rec('bol: painLong10 ⇔ validator min(150, 60 min)', !vOk, () => `E.slow ${p.E.slow} l10 ${l10} → ${c}`);
      }
  }

// 2. WARMUP/COOLDOWN km (validate.ts:903–923) vs workouts.timeEasy (fromSec).
for (const p of paces)
  for (const km of [30, 45, 65])
    for (const beg of [false, true]) {
      const wc = warmupCooldown(km, beg);
      const w = qualityWorkout({ ladder: 'T_continuous', zone: 'T', doseM: 2000, structure: { form: 'continuous', km: 2 }, step: 'start' }, p, wc);
      const wu = w.segments[0]!;
      const cd = w.segments[w.segments.length - 1]!;
      const mid = midEasy(p);
      const bad = Math.round(wu.km * 100) !== Math.round((wu.sec * 100) / mid) || Math.round(cd.km * 100) !== Math.round((cd.sec * 100) / mid);
      rec('WU/CD km: validator formula ⇔ workouts.timeEasy', bad, () => `mid ${mid}`);
    }

// 3. RACE_WEEK_EASY (validate.ts:1643/1673) vs week.raceEasyWorkout.
for (const p of paces) {
  const mid = midEasy(p);
  const timed = easyTimeWorkout(P.raceWeek.otherEasySec, p);
  for (let te = 40; te <= 120; te++) {
    const w = raceEasyWorkout(te, p);
    const byKm = te * 10 < Math.round((P.raceWeek.otherEasySec * 100) / mid);
    const valOk = byKm ? Math.round(w.segments[0]!.km * 100) === te * 10 : w.segments[0]!.sec === P.raceWeek.otherEasySec;
    const ctorByKm = w.blocks[0]!.kind === 'easy';
    rec('RACE_WEEK_EASY ⇔ raceEasyWorkout', !valOk || byKm !== ctorByKm, () => `mid ${mid} te ${te} timed ${timed.km}`);
  }
}

// 4. Osnova tempa: validator `reliable` (validate.ts:232–237) vs input.checkInput (pace.kind) — plan bez adaptacije.
const START = '2026-11-02';
const back = (n: number) => new Date(Date.parse(START + 'T00:00:00Z') - n * 86400000).toISOString().slice(0, 10);
for (const distanceM of P.input.resultDistancesM)
  for (let f = 0.5; f <= 3.2; f += 0.01) {
    // vreme iz brzine: 5K 12:30 … 60 min približno, skalirano distancom
    const timeSec = Math.round((distanceM / 1000) * 150 * f);
    for (const age of [0, 30, 84, 85, 120]) {
      const input = {
        startDate: START, raceDate: '2027-01-24', runDays: ['tue', 'thu', 'sat', 'sun'], longRunDay: 'sun', currentWeeklyKm: 40,
        recentResult: { distanceM, timeSec, date: back(age) }, goalTimeSec: null, easyPaceSecPerKm: 360
      };
      const c = checkInput(input);
      if (!c.ok) continue;
      const v = round1(vdotFromResult(distanceM, timeSec));
      const reliable = age <= P.input.resultMaxAgeDays && v >= P.input.vdotMin;
      rec('osnova tempa: validator reliable ⇔ checkInput', reliable !== (c.pace.kind === 'result'), () => `${distanceM} ${timeSec}s age ${age}`);
    }
  }

// 5. Broj laganih dana rasterećenja: validator runDays − 2 (validate.ts:1296, 1503) vs konstruktor qDays − 1 + easy (week.ts:476, 665).
const WD: Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
for (let mask = 0; mask < 128; mask++) {
  const days = WD.filter((_, i) => mask & (1 << i));
  for (const exp of ['regular', 'beginner'] as const) {
    const rule = planRule(days.length, exp);
    if (!rule) continue;
    for (const long of days) {
      const pat = patternOf(days, long, rule.quality);
      if (!pat) continue;
      const ctor = [pat.q1, ...(pat.q2 ? [pat.q2] : [])].length - 1 + pat.easy.length;
      rec('lagani dani rasterećenja: runDays − 2 ⇔ qDays − 1 + easy', ctor !== days.length - 2, () => `${days.join(',')} long ${long}`);
    }
  }
}

// 6. Najmanja T doza: validator lowestOf/tFloorM čita P.deload.tMinKm i za taper (validate.ts:729); konstruktor tapera P.taper.tMinKm.
rec('tFloor tapera: P.deload.tMinKm ⇔ P.taper.tMinKm', P.deload.tMinKm !== P.taper.tMinKm, () => `${P.deload.tMinKm} vs ${P.taper.tMinKm}`);

console.log(JSON.stringify({ paces: paces.length, out }, null, 1));

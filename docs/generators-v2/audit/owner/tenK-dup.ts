/* Ugao 4 (jedan vlasnik), 10K v2 — dvostruke definicije: izraz validatora (prepisan iz validate.ts, linija u komentaru)
   prema funkciji konstruktora (uvoz), iscrpno po celom domenu argumenata. Bez slučajnosti (seed nije potreban: sve
   mreže su pune). Kod: 670700e. Pokretanje iz web/: node ../docs/generators-v2/audit/owner/tenK-dup.ts */

const V2 = '../../../../web/src/domain/generators/tenK/v2';
const { TEN_K_V2_POLICY: P, planRule } = await import(`${V2}/policy.ts`);
const { warmupCooldown, ladderLevels, doseOf, zoneOf } = await import(`${V2}/workouts.ts`);
const { startLevel, capM, pickDeload, pickTaper, pickSlot, INITIAL_QUALITY } = await import(`${V2}/quality.ts`);
const { sharpenerReps, raceEasyWorkout, raceWeekRuns } = await import(`${V2}/week.ts`);
const { longTimeCap10, longShareCap10 } = await import(`${V2}/lengths.ts`);
const { nominal10, peakCap10, growth10 } = await import(`${V2}/volume.ts`);
const { pacesFromVdot, feelPaces, midEasy } = await import(`${V2}/paces.ts`);
const { patternOf } = await import(`${V2}/schedule.ts`);
const { addDays, weekdayOf } = await import(`${V2}/dates.ts`);

const EPS = 1e-6; // validate.ts:101
const to10 = (km: number): number => Math.round(km * 10);
const out: Record<string, { n: number; diff: number; ex: unknown[] }> = {};
const rec = (k: string, same: boolean, ex: unknown): void => {
  const r = (out[k] ??= { n: 0, diff: 0, ex: [] });
  r.n++;
  if (!same) {
    r.diff++;
    if (r.ex.length < 3) r.ex.push(ex);
  }
};

const rules = [3, 4, 5, 6].flatMap((d) =>
  [planRule(d, 'regular'), ...(d <= 4 ? [planRule(d, 'beginner')] : [])].filter(Boolean)
);
const paceSet = [
  ...Array.from({ length: 501 }, (_, i) => pacesFromVdot(30 + i * 0.1)),
  ...Array.from({ length: 241 }, (_, i) => feelPaces(270 + i).paces)
];

// A. WU/CD pojas: validate.ts:655–657 prema workouts.warmupCooldown (workouts.ts:149).
for (let k = 0; k <= 20000; k++) {
  const km = k / 100;
  for (const beginner of [false, true]) {
    const bands = P.workout.warmupCooldown;
    const wc = beginner ? bands[0] : bands.filter((b: { fromKm: number }) => to10(b.fromKm) <= to10(km)).pop();
    const own = warmupCooldown(km, beginner);
    rec('A WU/CD', wc.warmupSec === own.warmupSec && wc.cooldownSec === own.cooldownSec, { km, beginner });
  }
}

// B. Početni nivo: validate.ts:988–993 (startM) prema quality.startLevel (quality.ts:107), kad prvi nivo staje u plafon.
const LADDERS = ['R', 'I', 'T_continuous', 'T_cruise', 'RP'] as const;
for (const ladder of LADDERS)
  for (const beginner of [false, true])
    for (let t = 50; t <= 1000; t++) {
      const targetKm = t / 10;
      const own = startLevel(ladder, targetKm, beginner);
      const cap = capM(zoneOf(ladder), targetKm);
      const lv = ladderLevels(ladder, beginner).map(doseOf);
      const v = beginner ? lv[0] : (lv.filter((m: number) => m <= P.startLevel.capShare * cap + EPS).pop() ?? lv[0]);
      if (own === null) rec('B start (prvi nivo > plafon: konstruktor null)', true, null);
      else rec('B start', doseOf(own) === v, { ladder, beginner, targetKm, own: doseOf(own), v });
    }

// C. ≈ 60 % poslednje doze: validate.ts:150 expectedReduced prema quality.reduced (preko pickDeload / pickTaper).
const expectedReduced = (ladder: string, lastM: number, share: number, floorM: number, beginner = false): number => {
  const lv = ladderLevels(ladder, beginner).map(doseOf).filter((m: number) => m <= share * lastM + EPS && m >= floorM);
  return lv[lv.length - 1] ?? floorM;
};
for (const rule of rules)
  for (const phase of ['base', 'development', 'specific'] as const)
    for (let lastM = 0; lastM <= 12000; lastM += 50) {
      const st = { ...INITIAL_QUALITY, q1: { ladder: 'T_continuous', doseM: lastM, structure: { form: 'continuous', km: lastM / 1000 } }, q2: { ladder: 'T_cruise', doseM: lastM, structure: { form: 'continuous', km: lastM / 1000 } }, t: lastM };
      const d = pickDeload(st, phase, 200, rule);
      const ladder = phase === 'base' ? 'T_continuous' : 'T_cruise';
      const want = expectedReduced(ladder, lastM, P.deload.tShare, rule.beginner ? Math.round(P.beginner.tFirstKm * 1000) : Math.round(P.deload.tMinKm * 1000), rule.beginner);
      rec('C deload', d !== null && d.doseM === want, { rule: `${rule.quality}q-b${rule.beginner}`, phase, lastM, own: d?.doseM, want });
    }
for (const rule of rules)
  for (let lastM = 0; lastM <= 12000; lastM += 50) {
    const st = { q1: { ladder: 'RP', doseM: lastM, structure: { form: 'reps', reps: 1, repM: lastM } }, q2: { ladder: 'T_cruise', doseM: lastM, structure: { form: 'reps', reps: 1, repM: lastM } }, t: lastM };
    const t = pickTaper(st, 500, rule);
    if (!t || t === 'none') { rec('C taper (nema)', true, null); continue; }
    const t7 = P.taper;
    const wantRp = expectedReduced('RP', lastM, t7.doseShare, t7.rpMin.reps * t7.rpMin.repM);
    const wantT = expectedReduced('T_cruise', lastM, t7.doseShare, Math.round(t7.tMinKm * 1000));
    rec('C taper RP', t.q1.doseM === wantRp, { lastM, own: t.q1.doseM, wantRp });
    if (t.q2) rec('C taper T', t.q2.doseM === wantT, { lastM, own: t.q2.doseM, wantT });
  }

// D. Dani trkačke nedelje D20: validate.ts:1352–1362 prema week.raceWeekRuns (week.ts:579), svi skupovi 3–6 dana,
//    svaki dan dugog, trka subota/nedelja.
const WD = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
const START = '2026-11-02';
for (let mask = 0; mask < 128; mask++) {
  const days = WD.filter((_, i) => mask & (1 << i));
  if (days.length < 3 || days.length > 6) continue;
  for (const long of days)
    for (const raceOff of [5, 6]) {
      const pat = patternOf(days, long);
      if (!pat) continue;
      const frame = { index: 9, startDate: START, endDate: addDays(START, 6), phase: 'race', deload: false };
      const race = addDays(START, raceOff);
      if (!days.includes(weekdayOf(race))) continue;
      const own = raceWeekRuns(days, pat, frame, race);
      const inWeek = (wd: string): string => Array.from({ length: 7 }, (_, i) => addDays(START, i)).find((d) => weekdayOf(d) === wd)!;
      const runs = days.map(inWeek).filter((d) => d !== race).sort();
      const keep = Math.min(days.length, P.raceWeek.maxRunDays) - 1;
      const dropOrder = [inWeek(pat.long), ...pat.easy.map(inWeek).sort()].filter((d) => runs.includes(d));
      const dropped = dropOrder.slice(0, Math.max(0, runs.length - keep));
      const v = runs.filter((d) => !dropped.includes(d));
      rec('D D20 dani', JSON.stringify(own) === JSON.stringify(v), { days, long, race, own, v });
    }
}

// E. Oštrenje: validate.ts:1396–1401 prema week.sharpenerReps (week.ts:571).
for (let m = 0; m <= 20000; m += 10) {
  const q = P.raceWeek;
  const full = q.sharpener.reps * q.sharpener.repM;
  const v = m >= full ? q.sharpener.reps : m >= q.sharpenerSmallReps * q.sharpener.repM ? q.sharpenerSmallReps : 0;
  rec('E oštrenje', v === sharpenerReps(m), { m });
}

// F. Lagan trkačke nedelje u km ili 35 min: validate.ts:1453 prema week.raceEasyWorkout (week.ts:597).
for (const p of paceSet)
  for (let e10 = 30; e10 <= 150; e10++) {
    const byKm = e10 * 10 < Math.round((P.raceWeek.otherEasySec * 100) / midEasy(p));
    const w = raceEasyWorkout(e10, p);
    const ownByKm = w.segments[0].kmBasis === 'exact';
    rec('F lagan trkačke', byKm === ownByKm, { vdot: p.vdot, e10, byKm, ownByKm });
  }

// G. Plafon trajanja dugog: validate.ts:568 (km × sporo E > s) prema lengths.longTimeCap10 (lengths.ts:25).
//    (a) plafon konstruktora prolazi validator; (b) plafon + 0,1 km validator odbija (ista granica).
for (const p of paceSet)
  for (const sec of [P.lengths.longMaxSec, P.beginner.longMaxSec, P.adapt.painLongMaxSec]) {
    const c = longTimeCap10(p, sec);
    rec('G trajanje (a) plafon prolazi', !((c / 10) * p.E.slow > sec + EPS), { vdot: p.vdot, sec, c });
    rec('G trajanje (b) plafon+0,1 pada', ((c + 1) / 10) * p.E.slow > sec + EPS, { vdot: p.vdot, sec, c, slow: p.E.slow });
  }
// G2. Udeo dugog: validate.ts:561 prema lengths.longShareCap10 (lengths.ts:30).
for (const rule of rules)
  for (let t10 = 50; t10 <= 1000; t10++)
    rec('G2 udeo', Math.floor(rule.longMaxShare * t10 + 1e-9) === longShareCap10(t10, rule.longMaxShare), { t10 });

// H. Nominalni cilj bez adaptacije: validate.ts:1536–1546 prema volume.nominal10 (volume.ts:112).
for (const rule of rules)
  for (let s10 = Math.round(rule.kmMin * 10); s10 <= Math.round(rule.kmMax * 10); s10 += 5) {
    const cap10 = peakCap10(s10, rule);
    for (let last = rule.weekMinKm * 10; last <= cap10; last += 3)
      for (const peak of [last, cap10])
        for (const [phase, deload] of [['base', false], ['specific', true], ['taper', false]] as const) {
          const frame = { index: 5, startDate: START, endDate: START, phase, deload };
          const own = nominal10(frame, { lastBuild10: last, peak10: peak }, s10, cap10, rule);
          const v = phase === 'taper' ? Math.round(P.taper.factor * peak) : deload ? Math.round(P.deload.factor * last) : Math.min(last + growth10(last, rule), cap10);
          rec('H nominal', own === v, { s10, last, peak, phase, deload });
        }
  }

// I. Spuštanje doze (D11 ispred D12): validate.ts:874–878 prema quality.pickSlot allowDrop (quality.ts:142).
for (const ladder of LADDERS)
  for (const beginner of [false, true]) {
    const lv = ladderLevels(ladder, beginner);
    for (const prev of lv)
      for (let t = 50; t <= 1000; t += 1) {
        const targetKm = t / 10;
        const cap = capM(zoneOf(ladder), targetKm);
        if (doseOf(prev) <= cap) continue;
        const d = pickSlot({ ladder, doseM: doseOf(prev), structure: prev }, ladder, targetKm, pacesFromVdot(45), true, false, beginner);
        const best = lv.map(doseOf).filter((m: number) => m <= cap).pop();
        rec('I drop', (d?.doseM ?? undefined) === best, { ladder, beginner, prev: doseOf(prev), targetKm, own: d?.doseM, best });
      }
  }

for (const [k, r] of Object.entries(out))
  console.log(`${k}: ${r.n} poređenja, razlika ${r.diff}${r.ex.length ? ' npr. ' + JSON.stringify(r.ex) : ''}`);

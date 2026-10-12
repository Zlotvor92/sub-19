// Node ≥22.15 (module.registerHooks + type stripping). New outputs only; never rewrites
// the locked generator-ab evidence or earlier segment outputs.
//   node docs/probes/quality-dose.mjs
// Writes docs/qa/quality-dose/U01.json–U10.json, grid.json and summary.json.
// "Before" values are read from docs/qa/session-purpose/UXX.json (commit 38ecc08,
// the previous segment), so no second checkout is needed.
import { registerHooks } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
registerHooks({ resolve(s,c,n) { try { return n(s,c); } catch(e) { if(s.startsWith('.')) for(const x of ['.ts','/index.ts']) try { return n(s+x,c); } catch {} throw e; } } });
const T = '../../web/src/domain/training/';
const { generatePlan } = await import(T + 'generator/generatePlan.ts');
const { sessQKm } = await import(T + 'sessions/calc.ts');
const { zoneBudgetKm } = await import(T + 'sessions/constraints.ts');
const { validIntervalLeg } = await import(T + 'sessions/prescription.ts');
const { paceForZone } = await import(T + 'vdot/paceForZone.ts');
const W = await import(T + 'generator/weeklyLoad.ts');
const out = new URL('../qa/quality-dose/', import.meta.url);
mkdirSync(out, { recursive: true });
const sha = (x) => createHash('sha256').update(JSON.stringify(x)).digest('hex');
const min = (sec) => Math.round(sec / 6) / 10;

/** Per-week fast-work summary (M counts half in `loadMin`, raw minutes in `fastMin`). */
function weeks(plan) {
  return plan.weeks.map((wk) => {
    const sessions = wk.days.filter((d) => d.session).map((d) => {
      const s = d.session;
      const shape = s.type === 'int' ? `${s.reps}×${s.repM} m / ${s.restSec} s`
        : s.type === 'pyramid' ? s.reps.join('-') + ' m'
        : s.type === 'fartlek' ? `${s.reps}×${s.repSec} s`
        : `${s.qKm} km`;
      return { dow: d.dow, kind: s.kind, zone: s.zone, shape, workKm: Math.round(sessQKm(s) * 100) / 100, workMin: min(sessQKm(s) * s.paceSec) };
    });
    const finish = wk.days.find((d) => d.finish)?.finish ?? null;
    const lr = wk.days.find((d) => d.tag === 'lr' && !d.mlr);
    const fastSec = wk.days.reduce((n, d) => n + (d.session ? sessQKm(d.session) * d.session.paceSec : 0), 0) + (finish ? finish.km * finish.paceSec : 0);
    const loadSec = wk.days.reduce((n, d) => n + (d.session ? W.sessionLoadSec(d) : 0) + W.finishLoadSec(d.finish), 0);
    return { w: wk.w, deload: !!wk.deload, taper: !!wk.taper, vol: wk.vol, lrKm: lr?.km ?? 0, finish, sessions, fastMin: min(fastSec), loadMin: min(loadSec) };
  });
}

const profiles = JSON.parse(readFileSync(new URL('../qa/generator-ab/inputs.json', import.meta.url)));
const summary = [];
for (const profile of profiles) {
  const plan = generatePlan(structuredClone(profile.input));
  assert.ok(!('error' in plan));
  const before = JSON.parse(readFileSync(new URL(`../qa/session-purpose/${profile.id}.json`, import.meta.url))).plan;
  const readiness = plan.meta.athlete.qualityReadiness;
  // Beginner/returning/developing plans must be byte-identical to the previous segment.
  if (readiness !== 'experienced') assert.equal(sha(plan), sha(before), profile.id);
  writeFileSync(new URL(`${profile.id}.json`, out), JSON.stringify({ input: profile.input, plan }, null, 2) + '\n');
  summary.push({ id: profile.id, readiness, sha256: sha(plan), previousSha256: sha(before), unchanged: sha(plan) === sha(before), before: weeks(before), after: weeks(plan) });
}

/* Experienced grid: invariants of the new policy across distances, volumes, run days,
   continuity and intensity. Session ceilings are checked against the delivered week. */
const grid = { scenarios: 0, weeks: 0, sessions: 0, failures: [] , maxLoadToEnvelope: 0 };
for (const raceDistM of [5000, 10000, 21097.5, 42195])
  for (const weeklyKm of [25, 40, 55, 75, 95])
    for (const runDays of [4, 5, 6])
      for (const consistentWeeks of [8, 24])
        for (const intensity of ['kons', 'std', 'agr']) {
          const input = { startDate: '2026-10-12', raceDate: raceDistM >= 42195 ? '2027-02-28' : '2027-01-31', raceDistM, pb: { distM: 5000, sec: 1300, date: '2026-09-20' }, weeklyKm, recentLongRunKm: Math.min(24, weeklyKm * 0.3), consistentWeeks, breakWeeks: 0, qualityExperience: 'experienced', runDays, quality: 2, intensity, volIntensity: 'std', trainedRecently: true, lrDow: 7, _noSuggest: true };
          const id = `${raceDistM}/${weeklyKm}/${runDays}/${consistentWeeks}/${intensity}`;
          const plan = generatePlan(input);
          if ('error' in plan) { grid.failures.push({ id, kind: 'generation', error: plan.error }); continue; }
          grid.scenarios++;
          const v = plan.meta.trainingVdot;
          for (const wk of plan.weeks) {
            grid.weeks++;
            for (const d of wk.days.filter((x) => x.session)) {
              grid.sessions++;
              const s = d.session;
              if (sessQKm(s) > zoneBudgetKm(s, wk.vol) + 0.051 && s.kind !== 'Kontrolna trka') grid.failures.push({ id, w: wk.w, kind: 'zone-budget', session: s.kind });
              if (s.zone === 'I' && s.type === 'int' && !validIntervalLeg(s.repM, s.paceSec)) grid.failures.push({ id, w: wk.w, kind: 'i-leg' });
            }
            const normal = !wk.deload && !wk.taper && wk.w < plan.meta.weeks && !wk.days.some((d) => d.session?.kind === 'Kontrolna trka');
            if (!normal) continue;
            const lr = wk.days.find((d) => d.tag === 'lr' && !d.mlr);
            const env = W.weeklyFastEnvelopeSec({ readiness: 'experienced', volKm: wk.vol, easyPaceSec: paceForZone(v, 'E'), longRunKm: lr?.km ?? 0, longRunPaceSec: paceForZone(v, 'LR') });
            const load = wk.days.reduce((n, d) => n + (d.session ? W.sessionLoadSec(d) : 0) + W.finishLoadSec(d.finish), 0);
            grid.maxLoadToEnvelope = Math.max(grid.maxLoadToEnvelope, load / env);
          }
        }
grid.maxLoadToEnvelope = Math.round(grid.maxLoadToEnvelope * 1000) / 1000;
writeFileSync(new URL('grid.json', out), JSON.stringify(grid, null, 2) + '\n');
assert.equal(grid.failures.length, 0, JSON.stringify(grid.failures.slice(0, 5)));

writeFileSync(new URL('summary.json', out), JSON.stringify({ baseline: '38ecc0862737c06652a00eefca7295f49a4687d6', lockedQA: 'f8cb2081ed4ba223fe7efe14a621144beb9bce0d', scope: 'Technical before/after of weekly fast work on the ten immutable QA inputs; no new coach scoring', profiles: summary.map(({ before, after, ...p }) => ({ ...p, weeks: after.map((a, i) => ({ w: a.w, deload: a.deload, taper: a.taper, beforeFastMin: before[i]?.fastMin ?? null, afterFastMin: a.fastMin, afterLoadMin: a.loadMin, before: before[i]?.sessions.map((s) => `${s.zone} ${s.kind} ${s.shape} (${s.workMin} min)`) ?? [], after: a.sessions.map((s) => `${s.zone} ${s.kind} ${s.shape} (${s.workMin} min)`), finish: a.finish })) })), grid: { scenarios: grid.scenarios, weeks: grid.weeks, sessions: grid.sessions, failures: grid.failures.length, maxLoadToEnvelope: grid.maxLoadToEnvelope } }, null, 2) + '\n');
console.log(JSON.stringify({ unchanged: summary.filter((p) => p.unchanged).map((p) => p.id), changed: summary.filter((p) => !p.unchanged).map((p) => p.id), grid: { scenarios: grid.scenarios, weeks: grid.weeks, sessions: grid.sessions, failures: grid.failures.length, maxLoadToEnvelope: grid.maxLoadToEnvelope } }));

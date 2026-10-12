// Node ≥22.15 (module.registerHooks + type stripping). New outputs only; never rewrites
// the locked generator-ab evidence or earlier segment outputs.
//   node docs/probes/hm-progression.mjs
// Writes docs/qa/hm-progression/U01.json–U10.json, weeks.json, grid.json and summary.json.
// "Before" = docs/qa/quality-dose/UXX.json (commit 548d1b1, the previous segment).
import { registerHooks } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
registerHooks({ resolve(s,c,n) { try { return n(s,c); } catch(e) { if(s.startsWith('.')) for(const x of ['.ts','/index.ts']) try { return n(s+x,c); } catch {} throw e; } } });
const T = '../../web/src/domain/training/';
const { generatePlan } = await import(T + 'generator/generatePlan.ts');
const { sessQKm } = await import(T + 'sessions/calc.ts');
const { paceForZone } = await import(T + 'vdot/paceForZone.ts');
const W = await import(T + 'generator/weeklyLoad.ts');
const { HM_WEEKLY_FAST_SHARE, hmTrack } = await import(T + 'distances/hmProgression.ts');
const out = new URL('../qa/hm-progression/', import.meta.url);
mkdirSync(out, { recursive: true });
const sha = (x) => createHash('sha256').update(JSON.stringify(x)).digest('hex');
const r1 = (x) => Math.round(x * 10) / 10;
const DOW = ['', 'Pon', 'Uto', 'Sre', 'Čet', 'Pet', 'Sub', 'Ned'];

/** Weekly breakdown: T / HM (RP) / I minutes, LR finish, recoveries and hard-day layout. */
function weeks(plan) {
  const v = plan.meta.trainingVdot ?? plan.meta.vdot0;
  const pLR = paceForZone(v, 'LR');
  return plan.weeks.map((wk) => {
    const min = { T: 0, RP: 0, I: 0, R: 0, activation: 0 };
    const sessions = [];
    for (const d of wk.days.filter((x) => x.session)) {
      const s = d.session;
      const m = (sessQKm(s) * s.paceSec) / 60;
      const key = s.purpose === 'activation' ? 'activation' : s.zone;
      min[key] = (min[key] ?? 0) + m;
      const shape = s.type === 'int' ? `${s.reps}×${s.repM} m` : s.type === 'fartlek' ? `${s.reps}×${s.repSec} s` : s.type === 'pyramid' ? s.reps.join('-') + ' m' : `${s.qKm} km`;
      const rest = s.type === 'int' || s.type === 'fartlek' || s.type === 'pyramid' ? s.restSec : null;
      sessions.push({ dow: DOW[d.dow], kind: s.kind, zone: s.purpose === 'activation' ? 'activation' : s.zone, shape, restSec: rest, workMin: r1(m) });
    }
    const lr = wk.days.find((d) => d.tag === 'lr' && !d.mlr);
    const finish = lr?.finish ?? null;
    if (finish) min.RP += (finish.km * finish.paceSec) / 60;
    const hard = wk.days.filter((d) => d.session || d.finish || (d.tag === 'lr' && !d.mlr && d.km * pLR >= 90 * 60)).map((d) => `${DOW[d.dow]}:${d.session ? d.session.kind : d.finish ? 'LR+HM završetak' : 'duga ≥90 min'}`);
    const easyAfterLR = wk.days.find((d) => d.dow === 1 && d.tag === 'lako')?.km ?? null;
    return {
      w: wk.w, deload: !!wk.deload, taper: !!wk.taper, vol: wk.vol,
      tMin: r1(min.T), hmMin: r1(min.RP), iMin: r1(min.I + min.R), activationMin: r1(min.activation),
      lrKm: lr?.km ?? null, lrMin: lr ? Math.round((lr.km * pLR) / 60) : null,
      finish: finish ? `${finish.km} km @ ${finish.zone}` : null,
      sessions, hardDays: hard, mondayEasyKm: easyAfterLR
    };
  });
}

const profiles = JSON.parse(readFileSync(new URL('../qa/generator-ab/inputs.json', import.meta.url)));
const summary = [];
const detail = {};
for (const profile of profiles) {
  const plan = generatePlan(structuredClone(profile.input));
  assert.ok(!('error' in plan));
  const before = JSON.parse(readFileSync(new URL(`../qa/quality-dose/${profile.id}.json`, import.meta.url))).plan;
  const hm = profile.input.raceDistM === 21097.5;
  // Every non-HM plan must be byte-identical to the previous segment.
  if (!hm) assert.equal(sha(plan), sha(before), profile.id);
  writeFileSync(new URL(`${profile.id}.json`, out), JSON.stringify({ input: profile.input, plan }, null, 2) + '\n');
  summary.push({ id: profile.id, distance: profile.input.raceDistM, readiness: plan.meta.athlete.qualityReadiness, track: hm ? hmTrack(plan.meta.athlete.qualityReadiness) : null, sha256: sha(plan), previousSha256: sha(before), unchanged: sha(plan) === sha(before) });
  if (hm) detail[profile.id] = { before: weeks(before), after: weeks(plan) };
}
writeFileSync(new URL('weeks.json', out), JSON.stringify(detail, null, 2) + '\n');

/* HM grid: tracks × volume × run days × intensity × continuity. Checks per-session ceilings on
   the delivered week, recovery bounds, block minimum, one quality beside an LR finish, and the
   weekly envelope on normal weeks. */
const grid = { scenarios: 0, weeks: 0, sessions: 0, failures: [], maxLoadToEnvelope: 0, maxRpRestSec: 0, maxTRestSec: 0 };
for (const qualityExperience of ['experienced', 'some'])
  for (const weeklyKm of [20, 30, 45, 60, 80])
    for (const runDays of [3, 4, 5, 6])
      for (const consistentWeeks of [8, 24])
        for (const intensity of ['kons', 'std', 'agr']) {
          const input = { startDate: '2026-10-12', raceDate: '2027-02-07', raceDistM: 21097.5, pb: { distM: 5000, sec: 1350, date: '2026-09-20' }, weeklyKm, recentLongRunKm: Math.min(20, weeklyKm * 0.3), consistentWeeks, breakWeeks: 0, qualityExperience, runDays, quality: 2, intensity, volIntensity: 'std', trainedRecently: true, lrDow: 7, _noSuggest: true };
          const id = `${qualityExperience}/${weeklyKm}/${runDays}/${consistentWeeks}/${intensity}`;
          const plan = generatePlan(input);
          if ('error' in plan) { grid.failures.push({ id, kind: 'generation', error: plan.error }); continue; }
          grid.scenarios++;
          const v = plan.meta.trainingVdot;
          const readiness = plan.meta.athlete.qualityReadiness;
          for (const wk of plan.weeks) {
            grid.weeks++;
            const qs = wk.days.filter((x) => x.session);
            for (const d of qs) {
              grid.sessions++;
              const s = d.session;
              const q = sessQKm(s);
              if (s.zone === 'T' && q > wk.vol * 0.1 + 0.051) grid.failures.push({ id, w: wk.w, kind: 'T>10%', q, vol: wk.vol });
              if (s.kind === 'Tempo trke' && q > Math.min(wk.vol * 0.2, 12) + 0.051) grid.failures.push({ id, w: wk.w, kind: 'RP>20%', q, vol: wk.vol });
              if (s.type === 'int' && s.kind === 'Tempo trke') { grid.maxRpRestSec = Math.max(grid.maxRpRestSec, s.restSec); if (s.repM < 1000) grid.failures.push({ id, w: wk.w, kind: 'RP block < 1 km' }); }
              if (s.type === 'int' && s.kind === 'Tempo isprekidan') { grid.maxTRestSec = Math.max(grid.maxTRestSec, s.restSec); if (s.repM < 1000) grid.failures.push({ id, w: wk.w, kind: 'T block < 1 km' }); }
            }
            if (wk.days.some((d) => d.finish) && qs.some((d) => d.session.zone === 'RP')) grid.failures.push({ id, w: wk.w, kind: 'RP session beside LR finish' });
            const normal = !wk.deload && !wk.taper && wk.w < plan.meta.weeks && !qs.some((d) => d.session.kind === 'Kontrolna trka');
            if (!normal) continue;
            const lr = wk.days.find((d) => d.tag === 'lr' && !d.mlr);
            const env = W.weeklyFastEnvelopeSec({ readiness, volKm: wk.vol, easyPaceSec: paceForZone(v, 'E'), longRunKm: lr?.km ?? 0, longRunPaceSec: paceForZone(v, 'LR'), share: HM_WEEKLY_FAST_SHARE[hmTrack(readiness)] });
            const load = wk.days.reduce((n, d) => n + (d.session ? W.sessionLoadSec(d) : 0) + W.finishLoadSec(d.finish), 0);
            grid.maxLoadToEnvelope = Math.max(grid.maxLoadToEnvelope, load / env);
          }
        }
grid.maxLoadToEnvelope = Math.round(grid.maxLoadToEnvelope * 1000) / 1000;
writeFileSync(new URL('grid.json', out), JSON.stringify(grid, null, 2) + '\n');
assert.equal(grid.failures.length, 0, JSON.stringify(grid.failures.slice(0, 5)));

writeFileSync(new URL('summary.json', out), JSON.stringify({ baseline: '548d1b17eb98d75f7e5ec072700d8f65707361ff', lockedQA: 'f8cb2081ed4ba223fe7efe14a621144beb9bce0d', scope: 'Technical before/after of HM threshold and HM-pace progression on the ten immutable QA inputs; no new coach scoring', profiles: summary, grid: { scenarios: grid.scenarios, weeks: grid.weeks, sessions: grid.sessions, failures: grid.failures.length, maxLoadToEnvelope: grid.maxLoadToEnvelope, maxRpRestSec: grid.maxRpRestSec, maxTRestSec: grid.maxTRestSec } }, null, 2) + '\n');
console.log(JSON.stringify({ unchanged: summary.filter((p) => p.unchanged).map((p) => p.id), changed: summary.filter((p) => !p.unchanged).map((p) => p.id), grid: { scenarios: grid.scenarios, weeks: grid.weeks, sessions: grid.sessions, failures: grid.failures.length, maxLoadToEnvelope: grid.maxLoadToEnvelope, maxRpRestSec: grid.maxRpRestSec, maxTRestSec: grid.maxTRestSec } }));

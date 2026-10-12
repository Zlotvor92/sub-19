# Session purpose before dose and constraints

Base: `fix/plan-finalization` at `56269a6`, including all three earlier generator phases and the delivered-plan finalization fix. Locked historical QA: `f8cb2081ed4ba223fe7efe14a621144beb9bce0d`. Original generator-ab inputs, raw/blind plans, scores, events and reports are unchanged.

## Behavior

- New prescriptions carry `purpose` before dose/limits. T, I, R, RP, M and activation are distinct. Explicit purpose wins; existing explicit zones and a separate prescription label map support older callers. The measured-workout `ZONE_FOR_KIND` map remains unchanged.
- All four profiles explicitly pass RP/M intent for race-specific constructors. HM race progression is RP; marathon progression remains M. Controlled HM rehearsal is explicitly RP, never a maximal fitness test.
- T/RP/M retain the builder's recovery. I uses proportional recovery; R uses full recovery proportional to work duration. Activation retains its short near-RP work and 120 s recovery, carries RP zone, and stays excluded from fitness measurement. There is no universal 60 s rule.
- I pyramids remove shortened legs below 60 s instead of silently describing them as aerobic I work. The same 60–300 s contract applies to interval repetitions. If fewer than two valid legs survive, the existing weekly guard substitutes easy volume; no faster pace, R relabeling or increased work is introduced.
- Race activation is called `Aktivacija`, with explicit near-race-pace/no-sprint instructions. Its existing pace is preserved. Optional purpose metadata requires no mutation/migration of historical protected records.

## Before / after

| Example | Before | After |
| --- | --- | --- |
| Production 10K builder 6×1200 m @270 s/km, 60 s rest; dose week 10 | Legacy I dose gives 3×1200 m, 240 s; only then RP | RP from construction through dose/limit; 3×1200 m, 60 s |
| Same RP format with 75/90/180 s builder recovery | Recovery could be rewritten as I | Original 75/90/180 s preserved |
| I pyramid 100–200–300–200–100 m @272 s/km | Four legs below 60 s retained as I | Only 300 m qualifies; fewer than two legs, so quality is deferred to easy work |
| I pyramid 200–400–600–400–200 @272 s/km, adequate budget | Short outer legs still I | 400–600–400; I pace preserved, proportional recovery 122 s |
| Race activation 200 m repeats near RP | `Repeticije`, R zone despite near-RP pace | `Aktivacija`, activation purpose, RP zone, original 120 s recovery |
| HM race progression | M metadata for HM pace | RP metadata; marathon profile explicitly retains M |

## Evidence and checks

`node docs/probes/session-purpose.mjs` regenerates only `docs/qa/session-purpose/U01.json`–`U10.json` and `summary.json`. Uses the same ten immutable QA inputs; verifies 207 delivered sessions for purpose/zone/source, description/km consistency, and I leg duration. These are technical checks, not new blinded coaching scores.

New regression coverage checks RP recovery with four different pauses and legacy missing metadata; explicit T/I/R/RP/M overrides; dose and constraint paths for tiny/viable I pyramids; activation and non-measurement rows; HM RP versus marathon M progression; all four distance profiles. Existing preservation and measured-form suites remain active, including actual km/min, effective dates, overlays, measured locks and JSON restore.

Snapshot updates are intentional: new purpose/zone/source fields on prescriptions; corrected RP recovery changes workout totals and easy-volume allocation; short I pyramids may disappear; activation label/zone/description changes; HM progression zone changes. Refreshed only generator fingerprint (2,304 scenarios), seeded differential (1,500 inputs), and replan D6 snapshots. Original oracle/QA inputs and coaching evidence remain frozen. Browser expected outputs now read the separate current-purpose fixtures, retaining the same wizard inputs and persistence assertions.

Validation: strict TypeScript, lint, formatting, build, 1,429 frontend/domain/oracle tests across 134 files, and 396 backend tests. New purpose regression suite: 15 tests. Fingerprint updates: 1,920/2,304 changed scenarios; seeded differential: 1,469/1,500 changed outputs with error count unchanged at 14, and identical seed/count/goal-input coverage. Remote browser result is recorded in the PR handoff.

Local browser execution is blocked: Chromium is absent and Playwright's download returned truncated/non-ZIP data. The browser suite is ready for CI; do not treat a local browser pass as established.

## Remaining scope

Quality-minute ceilings, readiness multipliers, weekly quality budgets and clinical/training calibration are not recalibrated in this segment. Removing tiny I legs can yield fewer quality sessions for small budgets; this is explicit deferral rather than changing the intended stimulus. Legacy saved near-RP `Repeticije` cannot safely be identified as activation by label alone, so protected saved workouts are preserved rather than silently relabeled. No new coaching scores or production/watch validation.

`vercel.json` disables automatic deployments only for `fix/session-purpose`, honoring the requested draft-only workflow. The cutover test still checks all production settings against the existing reference and separately asserts this exact branch exception. No merge or deploy is requested.

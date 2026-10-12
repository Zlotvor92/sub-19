# Plan finalization — continuation checkpoint

## Base and scope

Branch: `fix/plan-finalization`, stacked on QA PR #35 (`qa/generator-ab-10-users-4-coaches`). Locked QA commit: `f8cb2081ed4ba223fe7efe14a621144beb9bce0d`; it includes completed generator phases 1–3. Remote main remains older; this branch does not omit those fixes. No merge or deployment.

Read the original report, PROTOCOL and REPRODUCE before implementation. Everything in `docs/qa/generator-ab/`, including input/raw/blind plans, event outputs and coach scores, remains byte-for-byte unchanged. New complete adjustment outputs and before/after audits are in `docs/qa/plan-finalization/`.

## Resulting behavior

`graftFuturePlan` finalizes after guards and saved-day preservation, before rebuilding future PRED/QS. New automatic descriptions are derived from actual session, distance, run/walk, stride and finish structures, including final LR fuel duration. Protected past/today, done, manual and measured records retain their exact day bodies, PRED rows and QS. Effective dates and execution log remain untouched.

Delivered aggregates resolve manual overlays and assign moved days to their effective calendar weeks. Manual overlays hide their original structured prescription for display/aggregates while retaining it for measurement history. Pure automatic pace overlays are aligned by one domain helper used both during finalization and store apply/preview; removal of a session also removes its obsolete automatic type/text.

Focus is rebuilt for future calendar weeks from actual delivered training. Empty quality weeks say easy running rather than Fartlek/Tempo/remaining sharpness. Deload/taper prefixes remain. Fully historical weeks remain exact.

Generated numeric/return warnings are replaced with final remaining-plan facts and regenerated preparation reasons. Unrelated result/input/scheduling cautions remain. Return policy dates and actual initial easy calendar-week count are separate facts, and preview notes use the same final warnings as persisted metadata. Additional volume guards can prolong easy running beyond the policy window: U06 has four configured return calendar weeks and eight actual initial easy weeks; the warnings report eight consistently, rather than promising quality after week four.

A protected demanding training inside the confirmed return window is kept and named in `Konflikt povratne politike` with its ID and effective date, both in warnings/preview and `futureChanges.conflicts`. The runner must decide on that saved training manually.

## Frozen-event before / after

| Profile | Stale acceleration descriptions | Stale quality focus | Final weekly peak | Actual initial easy calendar weeks |
| --- | ---: | ---: | ---: | ---: |
| U04 | 2 → 0 | 1 → 0 | 32.2 km | 2 |
| U06 | 2 → 0 | 5 → 0 | 10.1 km | 8 |
| U08 earlier permitted return | 3 → 0 | 2 → 0 | 49 km | 3 |
| U09 | 3 → 0 | 5 → 0 | 29 km | 3 |
| U10 | 4 → 0 | 2 → 0 | 47.4 km | 4 |

U06 originally warned about 11.6 km despite final preparation of 10.1 km; new warnings and preparation both report 10.1. U10 formerly described 6×20 s strides on November 30 after structurally removing them and mixed two/four return weeks; new automatic description has only the final easy prescription and both notes/warnings report four actual easy weeks.

U08 primary November 25 attempt still rejects the insufficient eight-week HM cycle without mutating inputs/history; the successful October 28 supplemental case remains explicitly separate.

## Regression coverage and changed expectations

Ten new regression tests replay the five exact frozen events and cover dated manual conflicts, effective-week overlay aggregation, easy overlays hiding an old quality session, actual km/sec and protected day/PRED/QS preservation through JSON persistence/restore, pure automatic overlays and the primary U08 rejection. Existing history/restore/idempotency/store tests remain enabled.

The 40 goal-change hashes in `web/src/test/fixtures/d6-replan.json` change intentionally. A separate two-checkout comparison first verifies every old hash against the locked baseline and then compares old/new day structures excluding `desc`, PRED, QS and inputs: 40/40 exact, zero prescription/prediction/QS/input changes. Only future automatic prose, focus and derived metadata/warnings change. Legacy oracle recordings and the 2,304 initial generator fingerprints remain unchanged. Oracle test titles remain unchanged because they are frozen recording keys.

## Reproduction

Node 24 for the independent probes:

```bash
node docs/probes/plan-finalization.mjs
SUB20_FINALIZATION_BASELINE=/path/to/f8cb2081-checkout node docs/probes/plan-finalization-snapshot-audit.mjs
cd web
npm run check
npm run build
npx playwright test e2e/generator-ab-users.spec.ts e2e/phase3-execution.spec.ts
```

The snapshot audit requires a separate locked checkout; it verifies original hashes before comparing structures. Neither new probe writes to the historical evidence directory. The normal Vitest tests load frozen files directly and work in Node 22 CI as well.

## Validation and limits

Local final results and CI are recorded in the draft PR. Domain/event audits and the 40-scenario structural comparison pass. Browser CI runs the existing ten wizard/apply/reload/log/restore flows; local Chromium is unavailable, so no local browser pass is claimed.

This segment repairs final consistency and preservation, not quality-dose calibration, fatigue continuity/deload policy or limited marathon-product choices. No stronger performance/coaching certification is claimed. Previously saved plans are not silently migrated; protected user prose is not rewritten. Conflict detection uses structured training/type information rather than inferring intensity from arbitrary user-written prose. Preparation peaks retain the existing definition: remaining non-taper training weeks before the race week, excluding historical volume.

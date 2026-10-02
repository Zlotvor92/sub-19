import { RUN_WALK_LADDER, RUN_WALK_WEEKS } from '../constants/product';
import type { RunWalk } from '../types';

/** Trčanje/hod lestvica za početnike: nedelja 1–4 → 1:1, 2:1, 3:1, 5:1. Van lestvice `null`. */
export function runWalkForWeek(weekIdx: number): RunWalk | null {
  if (weekIdx < 1 || weekIdx > RUN_WALK_WEEKS) return null;
  const step = RUN_WALK_LADDER[weekIdx - 1];
  return step ? { runSec: step.runSec, walkSec: step.walkSec, label: step.label } : null;
}

/** „3 min trčanje / 1 min hod" (celi minuti bez decimale, inače jedna decimala). */
export function runWalkText(rw: { runSec: number; walkSec: number } | null | undefined): string {
  if (!rw) return '';
  const f = (s: number): string =>
    s >= 60
      ? s / 60 === Math.floor(s / 60)
        ? `${s / 60} min`
        : `${(s / 60).toFixed(1)} min`
      : `${s} s`;
  return `${f(rw.runSec)} trčanje / ${f(rw.walkSec)} hod`;
}

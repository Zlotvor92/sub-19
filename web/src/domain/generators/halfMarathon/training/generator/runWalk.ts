import { RUN_WALK_LADDER, RUN_WALK_WEEKS } from '../constants/product';
import type { RunWalk } from '../types';

/**
 * Trčanje/hod lestvica za početnike: nedelja 1–4 → 1:1, 2:1, 3:1, 5:1. Van lestvice `null`.
 * `ladder` (koraci 1–4 po nedelji) omogućava ponavljanje ili zadržavanje koraka; bez njega važi osnovna lestvica.
 */
export function runWalkForWeek(weekIdx: number, ladder?: readonly number[]): RunWalk | null {
  if (weekIdx < 1) return null;
  const rung = ladder ? ladder[weekIdx - 1] : weekIdx <= RUN_WALK_WEEKS ? weekIdx : undefined;
  const step = rung === undefined ? undefined : RUN_WALK_LADDER[rung - 1];
  return step ? { runSec: step.runSec, walkSec: step.walkSec, label: step.label } : null;
}

/** Ispravna lestvica: 1–8 celobrojnih koraka 1–4 (nepouzdan ulaz iz sačuvanog stanja). */
export function validRunWalkLadder(ladder: unknown): ladder is number[] {
  return (
    Array.isArray(ladder) &&
    ladder.length >= 1 &&
    ladder.length <= 8 &&
    ladder.every((n) => Number.isInteger(n) && n >= 1 && n <= RUN_WALK_LADDER.length)
  );
}

/** Korak lestvice (1–4) čije trčanje/hod odgovara datom paru; `null` ako je par ručno izmenjen. */
export function runWalkRung(
  rw: { runSec: number; walkSec: number } | null | undefined
): number | null {
  if (!rw) return null;
  const i = RUN_WALK_LADDER.findIndex((s) => s.runSec === rw.runSec && s.walkSec === rw.walkSec);
  return i < 0 ? null : i + 1;
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

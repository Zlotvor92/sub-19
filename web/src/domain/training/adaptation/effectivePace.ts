/* Ciljni tempo dana posle ručne/automatske izmene — pravilo čitanja zapisa (izmena ima prednost nad PRED redom), bez
   trenerske odluke. Premešteno doslovno iz `./proposal.ts` (segment 5/5). */
import type { ResolvedDay } from '../../plan/types';
import type { AltRecord } from '../../state/types';

/** Ciljni tempo dana: ručna izmena ima prednost nad propisom iz PRED reda. */
export function effectivePace(
  alts: Readonly<Record<string, AltRecord>>,
  d: Pick<ResolvedDay, 'id'>,
  rowPace: number | null | undefined
): number | null {
  const a = alts[d.id];
  return a && a.pace != null ? a.pace : (rowPace ?? null);
}

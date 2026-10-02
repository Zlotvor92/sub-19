import { r1 } from '../../format';
import { AUTO_VDOT_TOLERANCE } from '../constants/heuristics';
import type { PredictionRow, Zone } from '../types';
import { vdotFromPace, vdotPaceInRange } from '../vdot/vdotFromPace';
import { vdotFromQuality } from '../vdot/calculateVDOT';
import { vdotPossible } from '../vdot/limits';
import { ZONE_FOR_KIND } from '../vdot/zoneForKind';
import { zoneForPredLabel } from './chain';

export type RejectReason = 'no-row' | 'no-pace' | 'out-of-table' | 'impossible' | 'auto-outlier';

export type MeasureOutcome =
  | { status: 'rejected'; reason: RejectReason }
  /** Sesija čiji je propis izveden iz cilja (aktivacija, tempo trke): tempo se čuva i prikazuje, ali NE
   *  ulazi u lanac forme. Nije isto što i „merenje nije verodostojno". */
  | { status: 'not-measured'; measured: number }
  | { status: 'accepted'; measured: number };

export interface MeasureInput {
  row: Pick<PredictionRow, 'l' | 'q' | 'nemeri'> | undefined;
  paceSec: number | null | undefined;
  /** Naziv sesije dana (`sessKind`), kad je poznat. */
  kind: string | null;
  /** Merenje je izvedeno automatski (Strava/icu lapovi), ne uneto rukom. */
  auto: boolean;
  /** Dan je ručno prebačen u drugi tip (npr. intervali → tempo): zona prati ono što je sesija STVARNO bila. */
  retagged: boolean;
  currentVdot: number | null;
  baselineVdot: number | null;
}

/**
 * Da li se ostvareni tempo prihvata kao merenje forme. Provere verodostojnosti (zasićenje tablice,
 * moguć VDOT) važe i za ručni unos: tvrdnja da je trčao brže nego što tablica uopšte poznaje nije
 * tvrdnja o formi. AUTOMATSKI izmeren tempo koji odstupa od forme za više od 4 VDOT poena se odbacuje
 * (greška u prepoznavanju radnih deonica, ne pad forme); ručni se uvek prihvata.
 */
export function classifyMeasurement(i: MeasureInput): MeasureOutcome {
  const { row } = i;
  if (!row) return { status: 'rejected', reason: 'no-row' };
  if (!i.paceSec) return { status: 'rejected', reason: 'no-pace' };
  let zone: Zone | null | undefined = zoneForPredLabel(row.l);
  if (i.retagged && i.kind != null && ZONE_FOR_KIND[i.kind]) zone = ZONE_FOR_KIND[i.kind];
  if (zone == null && i.kind != null) zone = ZONE_FOR_KIND[i.kind];
  const measured = r1(
    zone != null ? vdotFromPace(i.paceSec, zone) : vdotFromQuality(i.paceSec, row.q)
  );
  if (zone != null && !vdotPaceInRange(i.paceSec, zone))
    return { status: 'rejected', reason: 'out-of-table' };
  if (!vdotPossible(measured)) return { status: 'rejected', reason: 'impossible' };
  if (row.nemeri) return { status: 'not-measured', measured };
  if (i.auto) {
    const form = i.currentVdot != null ? i.currentVdot : i.baselineVdot;
    if (form != null && Math.abs(measured - form) > AUTO_VDOT_TOLERANCE) {
      return { status: 'rejected', reason: 'auto-outlier' };
    }
  }
  return { status: 'accepted', measured };
}

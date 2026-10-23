/* Raspodela nedeljnog obima po danima trčanja: dugo trčanje (LR) i lagani dani, posle
   kvalitetnih sesija. 10K nema srednje-dugo trčanje. */

import { r1 } from '../../format';

/** Pod po danu trčanja: prati obim po danu, uz apsolutni minimum od 1,5 km (ispod toga nije trening). */
export function perRunFloor(vol: number, runDays: number): number {
  return Math.max(1.5, Math.min(3, r1((vol / Math.max(runDays, 1)) * 0.75)));
}

export interface Allocation {
  lr: number;
  easies: number[];
}

/** Plafon dugog trčanja po funkciji distance: (obim, tempo LR u s/km) → km. */
export type LongRunCapFn = (vol: number, longRunPaceSecPerKm: number) => number;

/**
 * LR je uvek najduže trčanje nedelje; lagan dan ne sme da mu se približi (inače
 * to više nije lagan dan nego drugo dugo trčanje); lagani dani dele ono što ostane.
 */
export function allocEasyLongRun(
  vol: number,
  qKms: readonly number[],
  easyCount: number,
  runDays: number,
  longRunPaceSecPerKm: number,
  lrCapFn: LongRunCapFn,
  /** An independently progressed target replaces the legacy proportional LR choice. */
  targetLR?: { km: number; maxShare: number }
): Allocation {
  const floorPerRun = perRunFloor(vol, runDays);
  const qSum = qKms.reduce((a, b) => a + b, 0);
  const maxQ = qKms.length ? Math.max(...qKms) : 0;
  const rem = Math.max(vol - qSum, 3);
  const dayCap = lrCapFn(vol, longRunPaceSecPerKm || 0);
  if (easyCount === 0) {
    return {
      lr: r1(Math.min(Math.max(rem, maxQ * 1.1), Math.max(dayCap, maxQ * 1.05))),
      easies: []
    };
  }
  /* Na malo dana svako trčanje je veći udeo nedelje — zato strukturni cap po broju dana. */
  const capShare = runDays >= 5 ? 0.32 : runDays === 4 ? 0.36 : runDays === 3 ? 0.5 : 0.68;
  const cap = Math.min(vol * (targetLR?.maxShare ?? capShare), dayCap);
  /* Pod od 4 km važi tek od ~13 km/ned naviše; na 10 km/ned to je 40% nedelje. */
  const floor = Math.max(maxQ * 1.05, Math.min(4, vol * 0.3));
  let lr = targetLR
    ? targetLR.km
    : Math.max(rem * 0.45, maxQ * 1.12, (rem / (easyCount + 1)) * 1.3);
  lr = Math.min(lr, cap, rem - floorPerRun * easyCount);
  lr = Math.max(lr, Math.min(floor, rem - floorPerRun * 0.85 * easyCount));
  const weights = [1.15, 1, 0.9, 0.85, 0.8, 0.75].slice(0, easyCount);
  const wsum = weights.reduce((a, b) => a + b, 0);
  let easies = weights.map((x) => Math.max(floorPerRun, r1(((rem - lr) * x) / wsum)));
  /* Lagan dan: do 70% LR-a dok je LR kratak, strogih 50% kad poraste, nikad preko 14 km. */
  const mx = Math.max(...easies);
  const easyCeil = targetLR
    ? Math.min(14, lr * 0.8)
    : Math.min(14, Math.max(lr * 0.5, Math.min(12, lr * 0.7)));
  if (mx >= easyCeil && mx > 0) {
    const sc = easyCeil / mx;
    easies = easies.map((e) => Math.max(floorPerRun, r1(e * sc)));
  }
  /* Invarijanta do kraja: LR ostaje najduže trčanje nedelje. */
  const mxE = easies.length ? Math.max(...easies) : 0;
  if (mxE > lr) lr = mxE * 1.05;
  lr = r1(Math.max(lr, floor));
  return { lr, easies };
}

/* Raspodela nedeljnog obima po danima trčanja: dugo trčanje (LR), srednje-dugo
   (MLR) i lagani dani, posle kvalitetnih sesija. */

import { r1 } from '../../format';

/** Pod po danu trčanja: prati obim po danu, uz apsolutni minimum od 1,5 km (ispod toga nije trening). */
export function perRunFloor(vol: number, runDays: number): number {
  return Math.max(1.5, Math.min(3, r1((vol / Math.max(runDays, 1)) * 0.75)));
}

export interface Allocation {
  lr: number;
  easies: number[];
  /** Samo kad je MLR tražen; 0 znači „nije bilo odakle" (dan se ponaša kao običan lagan). */
  mlr?: number;
}

/** Plafon dugog trčanja po funkciji distance: (obim, tempo LR u s/km) → km. */
export type LongRunCapFn = (vol: number, longRunPaceSecPerKm: number) => number;

/**
 * LR je uvek najduže trčanje nedelje; lagan dan ne sme da mu se približi (inače
 * to više nije lagan dan nego drugo dugo trčanje). `mlrShare` (HM, 42K) je udeo
 * dugog trčanja koji dobija srednje-dugo; lagani dani dele ono što ostane.
 */
export function allocEasyLongRun(
  vol: number,
  qKms: readonly number[],
  easyCount: number,
  runDays: number,
  longRunPaceSecPerKm: number,
  lrCapFn: LongRunCapFn,
  mlrShare?: number
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
  const cap = Math.min(vol * capShare, dayCap);
  /* Pod od 4 km važi tek od ~13 km/ned naviše; na 10 km/ned to je 40% nedelje. */
  const floor = Math.max(maxQ * 1.05, Math.min(4, vol * 0.3));
  let lr = Math.max(rem * 0.45, maxQ * 1.12, (rem / (easyCount + 1)) * 1.3);
  lr = Math.min(lr, cap, rem - floorPerRun * easyCount);
  lr = Math.max(lr, Math.min(floor, rem - floorPerRun * 0.85 * easyCount));
  const weights = [1.15, 1, 0.9, 0.85, 0.8, 0.75].slice(0, easyCount);
  const wsum = weights.reduce((a, b) => a + b, 0);
  let easies = weights.map((x) => Math.max(floorPerRun, r1(((rem - lr) * x) / wsum)));
  /* Lagan dan: do 70% LR-a dok je LR kratak, strogih 50% kad poraste, nikad preko 14 km. */
  const mx = Math.max(...easies);
  const easyCeil = Math.min(14, Math.max(lr * 0.5, Math.min(12, lr * 0.7)));
  if (mx >= easyCeil && mx > 0) {
    const sc = easyCeil / mx;
    easies = easies.map((e) => Math.max(floorPerRun, r1(e * sc)));
  }
  /* Invarijanta do kraja: LR ostaje najduže trčanje nedelje. */
  const mxE = easies.length ? Math.max(...easies) : 0;
  if (mxE > lr) lr = mxE * 1.05;
  lr = r1(Math.max(lr, floor));
  if (!mlrShare) return { lr, easies };

  /* Srednje-dugo uzima udeo dugog, ali nikad toliko da lagani dani padnu ispod poda;
     ako nema odakle, izostaje (0). Ostatak se skida sa laganih dana proporcionalno. */
  const mlr = r1(Math.min(lr * mlrShare, lr * 0.85));
  const free = easies.reduce((s, e) => s + Math.max(0, e - floorPerRun), 0);
  const first = easies.length ? (easies[0] as number) : 0;
  const need = Math.max(0, mlr - first);
  if (easies.length < 1 || need > free + 0.01) return { lr, easies, mlr: 0 };
  if (need > 0) {
    let left = need;
    /* skida se od NAJDUŽIH laganih dana nanize */
    const order = easies.map((e, i) => ({ e, i })).sort((a, b) => b.e - a.e);
    order.forEach((x) => {
      if (left <= 0.01) return;
      const can = Math.max(0, (easies[x.i] as number) - floorPerRun);
      const take = Math.min(can, left);
      easies[x.i] = r1((easies[x.i] as number) - take);
      left -= take;
    });
  }
  easies.shift(); // prvi lagan dan JESTE srednje-dugo
  return { lr, easies, mlr };
}

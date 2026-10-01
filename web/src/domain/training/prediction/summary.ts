/* PREDIKCIJA KROZ PLAN — za svaki red sa upisanim tempom: vreme na ciljnoj distanci koje taj tempo
   (preko FORME, ne sirovo) obećava.

   Predikcija ide iz IZGLAČANOG VDOT-a iz lanca, ne iz jedne sesije: kartica „Trenutna forma" prikazuje
   lanac, a predikcija je ranije računala VDOT iz SAMO te sesije — pa su dva broja na istom ekranu
   govorila različito (izmereno: posle jednog tempa na vrućini kartica 48,4 → 46,4, a predikcija skoči
   20:32 → 22:26). Sirov račun ostaje samo kao rezerva za redove bez zapisa u lancu.

   Redovi koji ne mere formu (`nemeri`, aktivacija pred trku) nose tempo, ali ne i predikciju — inače bi
   ih rezervni račun ucrtao kao najgoru tačku u planu, tri dana pred trku. */

import type { VdotRecord } from '../../state/types';
import type { PredictionRow } from '../types';
import { t3kVdot, type T3kRow } from '../test3k';
import { raceTimeForVdot, riegelDist } from '../vdot/racePrediction';
import { vdotFromPace } from '../vdot/vdotFromPace';
import { zoneForPredLabel } from '../adaptation/chain';

export interface PredictionEntry<R> {
  r: R;
  /** Ostvaren tempo (s/km). */
  a: number | undefined;
  /** Predviđeno vreme na ciljnoj distanci (s) ili `null`. */
  pred: number | null;
}

export interface PredictionSummary {
  /** Jedan unos po redu plana, ISTIM REDOSLEDOM (grafikon ih crta po indeksu). */
  rows: Array<PredictionEntry<PredictionRow & { id: string }>>;
  tests: Array<PredictionEntry<T3kRow>>;
  entered: Array<PredictionEntry<PredictionRow & { id: string }> | PredictionEntry<T3kRow>>;
  last: PredictionEntry<PredictionRow & { id: string }> | PredictionEntry<T3kRow> | null;
  best: PredictionEntry<PredictionRow & { id: string }> | PredictionEntry<T3kRow> | null;
  /** Najnoviji među redovima plana (test nema svoje mesto na toj osi). */
  lastRow: PredictionEntry<PredictionRow & { id: string }> | null;
}

export function predictionSummary(input: {
  pred: ReadonlyArray<PredictionRow & { id: string }>;
  /** `predId → ostvaren tempo`. */
  paces: Readonly<Record<string, number | undefined>>;
  chain: readonly VdotRecord[];
  tests: readonly T3kRow[];
  raceDistM: number;
}): PredictionSummary {
  const { raceDistM } = input;
  const chainOf = (id: string): VdotRecord | undefined => input.chain.find((x) => x && x.id === id);
  const chainVdot = (id: string): number | null => {
    const e = chainOf(id);
    return e && e.vdot != null && Number.isFinite(e.vdot) ? e.vdot : null;
  };

  const rows = input.pred.map((r) => {
    const a = input.paces[r.id];
    let pred: number | null = null;
    if (a && !r.nemeri) {
      const zone = zoneForPredLabel(r.l);
      const v = chainVdot(r.id) ?? (zone != null ? vdotFromPace(a, zone) : null);
      pred =
        v != null
          ? raceTimeForVdot(v, raceDistM)
          : Math.round(riegelDist(a * r.q, r.q * 1000, raceDistM));
    }
    return { r, a, pred };
  });

  /* Testovi su u ZASEBNOM nizu, ne u `rows`: grafikon crta `rows` po indeksu naspram plana. */
  const tests = input.tests.map((r) => {
    const v = chainVdot(r.id) ?? t3kVdot(r.sec);
    return {
      r,
      a: r.pt,
      pred: v != null ? Math.round(raceTimeForVdot(v, raceDistM)) : null
    };
  });

  const entered = [...rows.filter((x) => x.pred != null), ...tests.filter((x) => x.pred != null)];
  /* „Zadnja" mora biti HRONOLOŠKI najnovija (po datumu unosa), ne poslednja po redosledu nedelja. */
  const tsFor = (id: string): string | null => chainOf(id)?.ts ?? null;
  const newest = <T extends { r: { id: string } }>(xs: T[]): T | null =>
    xs.length
      ? xs.reduce((m, x) => {
          const tm = tsFor(m.r.id);
          const tx = tsFor(x.r.id);
          return tx && (!tm || tx > tm) ? x : m;
        }, xs[0] as T)
      : null;
  const best = entered.length
    ? entered.reduce((m, x) => ((x.pred as number) < (m.pred as number) ? x : m))
    : null;
  return {
    rows,
    tests,
    entered,
    last: newest(entered),
    best,
    lastRow: newest(rows.filter((x) => x.pred != null))
  };
}

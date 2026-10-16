import type { IsoDate } from '../date';
import type { DayTag } from '../state';
import type { FastFinish, Strides, RunWalk, Session } from '../training/types';

/** Original dana kakav ga je generator napravio — za poređenje i vraćanje izmena. */
export interface DayOrigin {
  tag: DayTag | undefined;
  km: number | null;
  desc: string | null;
  rest: boolean;
  runWalk: RunWalk | undefined;
  finish?: FastFinish;
  strides?: Strides;
}

/**
 * Dan plana SA primenjenim izmenama (`alts`) i pomeranjem (`moves`). Izveden, nepromenljiv prikaz:
 * stari kod je ovo mutirao na kloniranim objektima (`rebuildDateIndex`), novi ga računa iz
 * (plan, alts, moves) kad god se išta od toga promeni.
 */
export interface ResolvedDay {
  id: string;
  /** Redni broj nedelje u planu (1-indeksiran). */
  w: number;
  weekStart: IsoDate;
  /** 0 = ponedeljak … 6 = nedelja. */
  dow: number;
  /** Mesto dana po planu. */
  origDate: IsoDate;
  /** Efektivni datum (posle zamene dana). */
  date: IsoDate;
  tag: DayTag | undefined;
  rest: boolean;
  km: number | null;
  desc: string | null;
  runWalk: RunWalk | undefined;
  finish?: FastFinish;
  strides?: Strides;
  snaga: boolean;
  /** VAŽEĆI propis: struktura onoga što korisnik sada treba da odradi. `undefined` kad je dan ručno izmenjen tako da
   *  izmena nema strukturu (drugi tip, km ili opis) — tada važi opis izmene. Odlučuje samo `resolvePlan`. */
  session: Session | undefined;
  /** ORIGINALNI propis generatora, i posle ručne izmene: istorija, spajanje sa redom predikcije, ručno zaključan tempo. */
  originSession: Session | undefined;
  mlr: boolean;
  test: boolean;
  origin: DayOrigin;
}

export interface ResolvedWeek {
  w: number;
  start: IsoDate;
  deload: boolean;
  focus: string;
  /** Taper nedelja (zastavica iz generatora; stariji planovi je nemaju). */
  taper?: true;
  /** Faza nedelje koju je upisao generator plana (A3); stariji planovi je nemaju. */
  phase?: string;
  days: ResolvedDay[];
}

export interface ResolvedPlan {
  weeks: ResolvedWeek[];
  byId: ReadonlyMap<string, ResolvedDay>;
  byDate: ReadonlyMap<IsoDate, ResolvedDay>;
  /** Dani sa datumom, sortirani po datumu. */
  dated: ResolvedDay[];
  /** Broj dana koji nisu odmor. */
  trainingDays: number;
}

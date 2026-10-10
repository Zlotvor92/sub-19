/* LIČNI (UGRAĐENI) PLAN VLASNIKA — pravila ko ga vidi i šta se oko njega računa. Sami podaci plana su u `data/personalPlan`.

   Hardkodovan plan je vlasnikov lični plan, ne podrazumevan plan aplikacije. Ko nije vlasnik i još nema svoj plan, ide PRAVO u čarobnjaka. IZUZETAK: ko je već upisivao
   treninge na ovaj (tuđi) plan ne sme da bude nasilno prebačen — čarobnjak bi mu sklonio plan ispod ruku, a njegovi unosi nose ID-jeve ugrađenog plana ('n12d5') i ostali bi bez
   mesta na kom se prikazuju. Njemu se umesto toga PREDLAŽE svoj plan (traka na „Danas"), pa sam bira kada.

   Plan se u aplikaciji tretira kao GENERISAN (`GenPlanState`): `activeGenPlan` vraća pravi `genPlan`, a kad njega nema i plan sme da se vidi — ovaj, sa `meta` izvedenim iz
   konstanti ispod. Zato svi ekrani i servisi rade nad jednim oblikom. U perzistirano stanje se ugrađeni plan NIKAD ne upisuje (`genPlan` ostaje `null`, kao i do sada). */

import {
  PERSONAL_PRED,
  PERSONAL_QS,
  PERSONAL_RACE,
  PERSONAL_START,
  PERSONAL_WEEKS
} from '../../data/personalPlan';
import { addDays, parseIsoDate } from '../date';
import type { GenPlanState, LogEntry, PainRecord, WeightRecord } from '../state';
import { vdotFromRace } from '../training/vdot/calculateVDOT';

export const PERSONAL = {
  raceName: 'Bokeški polumaraton',
  raceDistM: 21097.5,
  goalSec: 5700,
  pb5kSec: 1237,
  /** Polazna tačka za polumaraton: Niš polumaraton (n2d6). Dok nije upisan, polazna je PB na 5K. */
  startingDay: 'n2d6',
  /** Tekst cilja koji se prikazuje umesto vremena. */
  goalText: '1:35:00',
  /** Opis cilja za AI. */
  goalContext: 'Bokeški polumaraton 13.12.2026 — cilj 1:35:00 (4:30/km)'
} as const;

const r1 = (x: number): number => Math.round(x * 10) / 10;

/** Vlasnik se prepoznaje po Supabase ID-u naloga (UUID nije tajna; pravu proveru radi server). */
export const isOwnerUid = (userId: string | null | undefined, adminUid: string): boolean =>
  !!userId && userId === adminUid;

/** Ima li na uređaju unos (urađeno/preskočeno) na ugrađenom planu — ID-jevi 'n…'. */
export function ownsEntries(log: Readonly<Record<string, LogEntry>> | null | undefined): boolean {
  const l = log ?? {};
  for (const id of Object.keys(l)) {
    const v = l[id];
    if (id.charAt(0) === 'n' && v && (v.status === 'done' || v.status === 'skip')) return true;
  }
  return false;
}

export interface PlanAccess {
  hasGenPlan: boolean;
  isOwner: boolean;
  log: Readonly<Record<string, LogEntry>> | null | undefined;
}

/** Ugrađeni plan je vidljiv: nema generisanog, a čovek je vlasnik ili je već upisivao treninge na njega. */
export const personalVisible = (a: PlanAccess): boolean =>
  !a.hasGenPlan && (a.isOwner || ownsEntries(a.log));

/** Nema svog plana i nema nikakvog razloga da gleda ugrađeni: ide pravo u čarobnjaka. */
export const mustMakeOwnPlan = (a: PlanAccess): boolean => !a.hasGenPlan && !personalVisible(a);

/** Gleda tuđ plan sa unosima na njemu: nudi mu se svoj (traka), ne nameće. */
export const foreignPlanWithEntries = (a: PlanAccess): boolean =>
  !a.hasGenPlan && !a.isOwner && ownsEntries(a.log);

/* ------------------------------------------------------------- polazna tačka */

export interface StartingRace {
  vdot: number;
  sec: number;
  km: number;
  date: string | null;
}

const dayDate = (id: string): string | null => {
  for (const w of PERSONAL_WEEKS) {
    const d = w.days.find((x) => x.id === id);
    if (!d) continue;
    const start = parseIsoDate(w.start);
    return start ? addDays(start, d.dow) : null;
  }
  return null;
};
const plannedKm = (id: string): number | null => {
  for (const w of PERSONAL_WEEKS) {
    const d = w.days.find((x) => x.id === id);
    if (d) return typeof d.km === 'number' ? d.km : null;
  }
  return null;
};

/**
 * Upisan rezultat polaznog dana, ili `null`. Traži se ceo polumaraton (bar 20 km) i vreme; kraće trčanje tog dana nije polazna tačka za 21,1 km.
 */
export function startingRace(
  log: Readonly<Record<string, LogEntry>> | null | undefined
): StartingRace | null {
  const l = log?.[PERSONAL.startingDay];
  if (!l || l.status !== 'done' || !(Number(l.sec) > 0)) return null;
  const sec = Number(l.sec);
  const km = l.km != null ? +l.km : plannedKm(PERSONAL.startingDay);
  if (km == null || !(km >= 20 && km <= 25)) return null;
  const v = vdotFromRace(km * 1000, sec);
  if (!Number.isFinite(v) || v < 20 || v > 90) return null;
  const own = [l.runDate, l.ts].find((x) => typeof x === 'string' && /^\d{4}-\d{2}-\d{2}/.test(x));
  return {
    vdot: r1(v),
    sec,
    km,
    date: typeof own === 'string' ? own.slice(0, 10) : dayDate(PERSONAL.startingDay)
  };
}

/** Polazni VDOT: upisana polazna trka, inače PB na 5K. */
export const personalBaselineVdot = (log: Parameters<typeof startingRace>[0]): number =>
  startingRace(log)?.vdot ?? r1(vdotFromRace(5000, PERSONAL.pb5kSec));

export const personalGoalVdot = (): number =>
  r1(vdotFromRace(PERSONAL.raceDistM, PERSONAL.goalSec));

/* ------------------------------------------------------------- plan kao GenPlanState */

const cache = new Map<number, GenPlanState>();

/** Ugrađeni plan u obliku generisanog. `vdot0` je jedino što zavisi od podataka (polazna trka), pa se po njemu i kešira: isti objekat = stabilno memoizovanje u ekranima. */
export function personalPlan(baselineVdot: number): GenPlanState {
  const hit = cache.get(baselineVdot);
  if (hit) return hit;
  const plan: GenPlanState = {
    weeks: PERSONAL_WEEKS,
    pred: PERSONAL_PRED,
    qs: PERSONAL_QS,
    meta: {
      /* bez `vdotGoal`/`weeks`: planska putanja forme se izvodi iz `p5k` redova (kao u starom kodu), ne iz rampe */
      licni: true,
      raceName: PERSONAL.raceName,
      raceDistM: PERSONAL.raceDistM,
      goalSec: PERSONAL.goalSec,
      goalVdot: personalGoalVdot(),
      vdot0: baselineVdot,
      raceDate: PERSONAL_RACE,
      start: PERSONAL_START,
      dayWarnings: []
    } as unknown as GenPlanState['meta']
  };
  cache.set(baselineVdot, plan);
  return plan;
}

export const isPersonalMeta = (meta: unknown): boolean =>
  !!meta && typeof meta === 'object' && (meta as Record<string, unknown>)['licni'] === true;

/* ------------------------------------------------------------- tuđi seed */

/** POTPIS ZATEČENOG SEEDA iz starih verzija — SAMO identifikatori, bez ijednog ličnog podatka. */
export const OLD_SEED_SIGNATURE = {
  log: ['n1d1', 'n1d3', 'n1d4', 'n1d5', 'n1d7', 'n2d1', 'n2d3'],
  knee: ['k1', 'k2', 'k3', 'k4', 'k5', 'k6', 'k7', 'k8', 'k9', 'k10'],
  kg: ['2026-06-22', '2026-06-29'],
  pred: ['p1', 'p2']
} as const;

export interface SeedHolder<V extends { id?: unknown } = { id?: unknown }> {
  log: Record<string, LogEntry>;
  knee: PainRecord[];
  kg: WeightRecord[];
  pred: Record<string, unknown>;
  predLock: Record<string, unknown>;
  vdotLog: V[];
}

/**
 * UKLANJANJE ZATEČENOG TUĐEG SEEDA — hirurški, ne „sve ili ništa": uklanja se TAČNO ono što je prepoznato kao seed, bez obzira na ostalo.
 * - koleno: ID-jevi k1..k10 su nedvosmisleni (ručni unos dobija 'k'+vreme, unos iz treninga 'kt-<idDana>');
 * - masa: dva datuma iz potpisa I bez `src` (sopstveni unosi uvek nose `src`);
 * - dnevnik i tempi: samo ako CEO 'n' (odnosno 'p') prostor staje u potpis, dakle ako čovek nije ništa svoje upisao na ugrađeni plan.
 * Vraća novi objekat; ulaz se ne menja.
 */
export function removeForeignSeed<V extends { id?: unknown }>(
  s: SeedHolder<V>
): { changed: boolean; next: SeedHolder<V> } {
  const P = OLD_SEED_SIGNATURE;
  let changed = false;
  const next: SeedHolder<V> = {
    log: { ...s.log },
    knee: s.knee,
    kg: s.kg,
    pred: { ...s.pred },
    predLock: { ...s.predLock },
    vdotLog: s.vdotLog
  };
  const knee = s.knee.filter((k) => !(k && (P.knee as readonly string[]).includes(String(k.id))));
  if (knee.length !== s.knee.length) {
    next.knee = knee;
    changed = true;
  }
  const kg = s.kg.filter(
    (x) => !(x && x.src == null && (P.kg as readonly string[]).includes(x.date))
  );
  if (kg.length !== s.kg.length) {
    next.kg = kg;
    changed = true;
  }
  const nLog = Object.keys(next.log).filter((k) => k.charAt(0) === 'n');
  if (nLog.length && nLog.every((k) => (P.log as readonly string[]).includes(k))) {
    for (const k of nLog) delete next.log[k];
    changed = true;
  }
  const nPred = Object.keys(next.pred).filter((k) => k.charAt(0) === 'p');
  if (nPred.length && nPred.every((k) => (P.pred as readonly string[]).includes(k))) {
    for (const k of nPred) {
      delete next.pred[k];
      delete next.predLock[k];
    }
    next.vdotLog = s.vdotLog.filter(
      (e) => !(e && (P.pred as readonly string[]).includes(String(e.id)))
    );
    changed = true;
  }
  return { changed, next };
}

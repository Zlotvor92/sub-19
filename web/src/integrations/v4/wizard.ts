/* F9 · SLOJ APLIKACIJA ↔ V4: ODGOVORI ČAROBNJAKA → NOV PLAN V4 (korak 7, INTEGRACIJA.md § 2a, F8 § 9).
   Čarobnjak (postojeći ekrani) daje odgovore u obliku ulaza v2; ovde se samo prevode u `Goal` / `Availability` /
   `RunnerProfile` i plan pravi V4 motor. Ništa se ne odbija osim neispravnog unosa (AGENTS V4 t. 6): sve ostalo dobija
   plan i upozorenja (`header.warnings`), koja ekran prikazuje PRE upisa. Čista funkcija: ne čita store, ne piše. */
import {
  buildState,
  fingerprint,
  plan,
  type Availability,
  type Goal,
  type InputError,
  type PlanDoc,
  type Run,
  type RunnerFacts,
  type RunnerProfile,
  type Warning,
  type Weekday
} from '../../domain/v4/engine';
import { distanceData, toFacts } from './facts';

/** Odgovori čarobnjaka — zajednički deo ulaza v2 sve četiri distance (strukturno, bez uvoza v2). */
export interface WizardAnswers {
  raceDate: string;
  /** `mon` … `sun`. */
  runDays: readonly string[];
  longRunDay?: string | null;
  currentWeeklyKm: number;
  recentResult?: { distanceM: number; timeSec: number; date: string } | null;
  goalTimeSec?: number | null;
  /** 5K v2 ga zove `typicalEasyPaceSecPerKm`, ostale distance `easyPaceSecPerKm`. */
  typicalEasyPaceSecPerKm?: number | null;
  easyPaceSecPerKm?: number | null;
  experience?: 'beginner' | 'regular';
}

/** Oznaka distance aplikacije (`generatorIdFor`) → `DistanceData.id` V4. */
export const V4_DISTANCE: Readonly<Record<string, string>> = Object.freeze({
  '5k': 'fivek',
  '10k': 'tenk',
  hm: 'hm',
  marathon: 'marathon'
});

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
const dayOf = (name: string): Weekday | null => {
  const i = (DAYS as readonly string[]).indexOf(name);
  return i < 0 ? null : (i as Weekday);
};

/** Dan dugog: izabran, inače nedelja, subota, pa poslednji dan trčanja. */
function longDayOf(runDays: readonly Weekday[], chosen: Weekday | null): Weekday {
  if (chosen !== null && runDays.includes(chosen)) return chosen;
  if (runDays.includes(6)) return 6;
  if (runDays.includes(5)) return 5;
  return runDays[runDays.length - 1] ?? 6;
}

export interface WizardGoal {
  goal: Goal;
  availability: Availability;
  profile: RunnerProfile;
}

/** Odgovori → cilj, dani i profil motora. `confirmedRunDays`: trkač je potvrdio traženi broj dana (M6). */
export function wizardGoal(
  distanceId: string,
  a: WizardAnswers,
  confirmedRunDays = false
): WizardGoal {
  const runDays = [...new Set(a.runDays.map(dayOf).filter((d): d is Weekday => d !== null))].sort(
    (x, y) => x - y
  );
  const easy = a.easyPaceSecPerKm ?? a.typicalEasyPaceSecPerKm ?? null;
  const profile: RunnerProfile = {
    /* 0 = obim nepoznat (npr. trčanje/hodanje — čarobnjak ga ne pita); motor tada procenjuje sam, uz upozorenje */
    ...(Number.isFinite(a.currentWeeklyKm) && a.currentWeeklyKm > 0
      ? { weeklyKm: a.currentWeeklyKm }
      : {}),
    ...(easy !== null ? { easyPaceSecPerKm: easy } : {}),
    ...(a.recentResult
      ? {
          recentResult: {
            distanceM: a.recentResult.distanceM,
            timeSec: a.recentResult.timeSec,
            ...(a.recentResult.date ? { date: a.recentResult.date } : {})
          }
        }
      : {}),
    ...(a.experience !== undefined ? { beginner: a.experience === 'beginner' } : {})
  };
  return {
    goal: {
      distanceId,
      raceDate: a.raceDate,
      ...(a.goalTimeSec ? { targetTimeSec: a.goalTimeSec } : {})
    },
    availability: {
      runDays,
      longDay: longDayOf(runDays, a.longRunDay ? dayOf(a.longRunDay) : null),
      ...(confirmedRunDays ? { confirmedRunDays: true } : {})
    },
    profile
  };
}

export type MadePlan =
  | { ok: true; doc: PlanDoc; otisak: string; warnings: Warning[]; facts: RunnerFacts }
  | { ok: false; errors: InputError[] };

/** Nov plan iz odgovora čarobnjaka (+ trčanja iz zapisa aktivnosti i bolovi, kad postoje). Isti ulaz → isti plan. */
export function makePlan(p: {
  /** Oznaka distance aplikacije (`5k`, `10k`, `hm`, `marathon`). */
  distance: string;
  answers: WizardAnswers;
  today: string;
  activities?: readonly Run[];
  knee?: readonly unknown[];
  confirmedRunDays?: boolean;
}): MadePlan {
  const id = V4_DISTANCE[p.distance] ?? p.distance;
  const data = distanceData(id);
  if (data === null)
    return {
      ok: false,
      errors: [
        { code: 'nepoznata-distanca', field: 'goal.distanceId', message: 'Nepoznata distanca.' }
      ]
    };
  const g = wizardGoal(id, p.answers, p.confirmedRunDays === true);
  const facts = toFacts({
    today: p.today,
    availability: g.availability,
    profile: g.profile,
    ...(p.activities !== undefined ? { activities: p.activities } : {}),
    ...(p.knee !== undefined ? { knee: p.knee } : {})
  });
  const r = plan(buildState(facts, g.goal, data), g.goal, data);
  if (!r.ok) return { ok: false, errors: r.errors };
  return {
    ok: true,
    doc: r.doc,
    otisak: fingerprint(r.doc, facts),
    warnings: r.doc.header.warnings,
    facts
  };
}

/** Upozorenje M6 (dan izostavljen zbog kratkih laganih dana) uz koje ekran nudi „Ipak hoću N dana". */
export const DAY_DROPPED = 'dan-izostavljen';

/** Jedno upozorenje kao rečenica za postojeći prikaz (šta je problem · šta znači za trku · šta je potrebno). */
export const warningText = (w: Warning): string =>
  [w.problem, w.meaning, w.proposal].filter((t) => t !== '').join(' ');

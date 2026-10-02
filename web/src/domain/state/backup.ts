/* BACKUP: izvoz i uvoz stanja. Uvoz je GRANICA POVERENJA — fajl je proizvoljan JSON.

   Šta se nikad ne izvozi: OAuth tokeni (Strava, intervals.icu) su po UREĐAJU i ne putuju kroz fajl.
   Šta se nikad ne uvozi: tuđe veze. Stari kod je čuvao postojeću vezu SAMO ako fajl svoju ne nosi; kad je
   nosi, fajl je pobeđivao i tuđ token je završavao u stanju bez ijedne poruke. Nije bilo hipotetično: izvoz je
   ranije skidao samo `strava`, pa svaki stariji backup sadrži intervals.icu OAuth token koji po njihovoj
   dokumentaciji NE ISTIČE — uvoz tuđeg takvog fajla davao je trajan pristup tuđim zdravstvenim podacima
   (HRV, puls u miru, san) i pravo pisanja u tuđ kalendar. Sada se veze uvek zadržavaju iz postojećeg stanja.

   ID-jevi iz fajla završavaju u HTML atributima (`id="ai-go-…"`, `data-swd="…"`): u starom kodu je ID
   `"><img src=x onerror=…>` iz uvezenog backupa izvršavao proizvoljan kod i čitao Supabase sesiju i tokene.
   React ne gradi HTML iz stringova, ali odbrana ostaje na granici: sumnjiv fajl se odbija u celini, pre nego
   što dodirne stanje. */

import { findInvalidId, isValidGenPlan, migrateState } from './migrate';
import type { PersistedState } from './types';

export type BackupFile = {
  app: 'SUB-19';
  exportedAt: string;
  state: Omit<PersistedState, 'strava' | 'icu'>;
};

/** Stanje bez veza (tokena) — sve što sme da ode u fajl ili na server. */
export function backupPayload(state: PersistedState): Omit<PersistedState, 'strava' | 'icu'> {
  const copy = JSON.parse(JSON.stringify(state)) as Partial<PersistedState>;
  delete copy.strava; // access/refresh token
  delete copy.icu; // OAuth token i API ključ
  return copy;
}

export function buildBackup(state: PersistedState, exportedAt: string): BackupFile {
  return { app: 'SUB-19', exportedAt, state: backupPayload(state) };
}

export type ImportFailure =
  /** Nije backup ove aplikacije ili je iz novije verzije. */
  | { ok: false; reason: 'unrecognized' }
  /** Oštećen generisan plan: ništa se ne menja. */
  | { ok: false; reason: 'broken-plan' }
  /** Neispravan identifikator (mesto navedeno u `detail`). */
  | { ok: false; reason: 'bad-id'; detail: string };

export type ImportSuccess = {
  ok: true;
  state: PersistedState;
  /** Šta fajl sadrži — za dijalog potvrde („Uvoz će PREPISATI postojeće podatke"). */
  counts: { workouts: number; pain: number; weight: number };
};

/**
 * Proverava i priprema uvoz. NE menja `current` i NE piše ništa: pozivalac prikazuje potvrdu pa tek onda
 * zamenjuje stanje (i vraća prethodno ako zamena pukne). Veze (`strava`, `icu`) se ZADRŽAVAJU iz `current`.
 */
export function importBackup(raw: unknown, current: PersistedState): ImportFailure | ImportSuccess {
  const wrapped = raw as { state?: unknown } | null;
  const candidate = wrapped && typeof wrapped === 'object' && wrapped.state ? wrapped.state : raw;
  const migrated = migrateState(candidate);
  if (!migrated) return { ok: false, reason: 'unrecognized' };
  if (!isValidGenPlan(migrated.genPlan)) return { ok: false, reason: 'broken-plan' };
  const bad = findInvalidId(migrated);
  if (bad) return { ok: false, reason: 'bad-id', detail: bad };
  const state: PersistedState = {
    ...migrated,
    strava: current.strava ?? null,
    icu: current.icu ?? null
  };
  return {
    ok: true,
    state,
    counts: {
      workouts: Object.keys(state.log).length,
      pain: state.knee.length,
      weight: state.kg.length
    }
  };
}

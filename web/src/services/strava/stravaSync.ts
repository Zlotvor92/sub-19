/* SINHRONIZACIJA SA STRAVE: povuci trčanja, spoji ih sa danima plana, upiši (poštujući ručne korekcije), pa za kvalitetne dane povuci
   streamove i izvedi radne deonice → tempo → forma. Sve ODLUKE su u `domain` (`importedEntry`, `mergeDay`, `realignPlan`,
   `recordAutoPace`, …); ovde je samo tok poziva.

   Stanje se čita jednom, menja na lokalnoj kopiji, i upisuje JEDNOM na kraju — neuspeh usred posla ne ostavlja polovično stanje
   (stari kod je mutirao globalno stanje u hodu). Greška pojedinačnog dana (streamovi) ne obara ceo uvoz; greška spiska aktivnosti da.

   08c, SAMO ZA PLAN v2 — 5K v2, od segmenta 05 10K v2, od HM-05 HM v2 (plan v1 se uvozi bajt-isto): trčanje koje nije upareno sa
   danom plana postaje zapis van plana
   (`vanPlanaV2`, `recordOffPlanRuns`), a pored `lastSync` (spisak preuzet i upisan — isto značenje kao ranije) veza nosi
   `fullSync` (sve aktivnosti perioda preuzete i obrađene: spisak ceo, svaka stavka prepoznata, svaki traženi tok/krug
   preuzet), `fullSyncFrom` i `syncIssues` (šta nije obrađeno, sa danom). Delimičan uspeh ne pomera `fullSync`. */

import { z } from 'zod';
import { addDays, toEpochDay, type IsoDate } from '../../domain/date';
import {
  PERKM_VERSION,
  activityIssue,
  decouplingPerKm,
  detectWorkSegments,
  hasDetails,
  importedEntry,
  kmByDate,
  importedDay,
  perKmDetail,
  perKmStale,
  recordOffPlanRuns,
  runsByDate,
  stravaActivityIssue,
  syncStatus,
  workLapsPace,
  type ActivityStreams,
  type StravaActivity
} from '../../domain/activities';
import {
  recomputeChain,
  recordAutoPace,
  syncSideRecords,
  type WorkPaceContext
} from '../../domain/day';
import {
  planBaselineVdot,
  resolvePlan,
  type ResolvedDay,
  type ResolvedPlan
} from '../../domain/plan';
import { generatorForPlan, tracksOffPlanRuns } from '../../domain/generators/select';
import { planBoundary, recordOutOfPlan } from '../../domain/recovery';
import type {
  AltRecord,
  GenPlanState,
  LogEntry,
  OffPlanRun,
  PainRecord,
  SyncIssue,
  VdotRecord,
  WeightRecord
} from '../../domain/state';
import {
  alignVdotDates,
  matchWeekRows,
  type StoredPredRow
} from '../../domain/training/adaptation';
import type { Result } from '../http';
import { parseLaps, parseStreams } from '../streams';
import type { StravaApi, StravaLinkStore } from './stravaApi';

export { parseLaps, parseStreams };

export interface ImportState {
  genPlan: GenPlanState | null;
  log: Record<string, LogEntry>;
  pred: Record<string, unknown>;
  predLock: Record<string, unknown>;
  vdotLog: VdotRecord[];
  alts: Record<string, AltRecord>;
  moves: Record<string, unknown>;
  vanPlana: Record<string, number>;
  /** 08c: trčanja van plana (samo plan 5K v2); izostavljeno = nema ih. */
  vanPlanaV2?: Record<string, OffPlanRun>;
  knee: PainRecord[];
  kg: WeightRecord[];
}

export interface ImportPorts {
  read(): ImportState;
  /** Jedan upis svega što se promenilo. */
  commit(next: ImportState): void;
}

export interface StravaSyncDeps {
  accountKey?: () => string;
  api: StravaApi;
  link: StravaLinkStore;
  ports: ImportPorts;
  now: () => number;
  /** Danas kao `YYYY-MM-DD`. */
  today: () => string;
}

export type StravaSyncResult =
  { ok: true; imported: number; paces: number; moved: number } | { ok: false; error: string };

const WEEK_MS = 7 * 864e5;

const Activity = z
  .object({
    id: z.union([z.number(), z.string()]),
    name: z.string().nullish(),
    description: z.string().nullish(),
    type: z.string().nullish(),
    sport_type: z.string().nullish(),
    start_date_local: z.string().nullish(),
    distance: z.number().nullish(),
    moving_time: z.number().nullish(),
    average_heartrate: z.number().nullish(),
    max_heartrate: z.number().nullish(),
    total_elevation_gain: z.number().nullish(),
    suffer_score: z.number().nullish(),
    average_cadence: z.number().nullish(),
    average_temp: z.number().nullish()
  })
  .passthrough();

/** Spisak aktivnosti: neispravna stavka se odbacuje, ne obara ceo spisak (Strava ume da vrati `null` u nizu). */
export function parseActivities(raw: unknown): StravaActivity[] | null {
  if (!Array.isArray(raw)) return null;
  const out: StravaActivity[] = [];
  for (const item of raw as unknown[]) {
    const p = Activity.safeParse(item);
    if (p.success) out.push(p.data);
  }
  return out;
}

const HrZones = z.object({
  heart_rate: z
    .object({ zones: z.array(z.object({ min: z.number(), max: z.number() })) })
    .partial()
    .optional()
});

/** 08c: Strava nema tokove/krugove za aktivnost (ručno uneta, bez senzora): 404 ili prazan niz. To je odgovor, ne
 *  neuspeh — inače bi takva aktivnost trajno držala `fullSync` (isto kao `icu-bez-strukture`). */
const nothingThere = (r: Result<unknown>): boolean =>
  r.ok ? Array.isArray(r.data) && r.data.length === 0 : r.status === 404;

export const STREAM_KEYS_QUALITY = 'distance,time,heartrate,cadence,watts,moving,altitude,temp';
export const STREAM_KEYS_EASY = 'distance,heartrate,cadence,time,moving,altitude,temp,watts';

export function createStravaSync(deps: StravaSyncDeps): { run(): Promise<StravaSyncResult> } {
  const { api, link, ports } = deps;

  async function refreshZones(): Promise<void> {
    const owner = deps.accountKey?.();
    const cur = link.get();
    if (!cur) return;
    const last = typeof cur['zonesTs'] === 'number' ? cur['zonesTs'] : 0;
    if (deps.now() - last <= WEEK_MS) return;
    const r = await api.get('/athlete/zones');
    if (!r.ok || deps.accountKey?.() !== owner) return; // dopuna, ne razlog da uvoz stane
    const p = HrZones.safeParse(r.data);
    const zones = p.success ? p.data.heart_rate?.zones : undefined;
    if (!zones?.length) return;
    link.set({
      ...(link.get() ?? cur),
      hrZones: zones.map((x) => ({ min: x.min, max: x.max > 0 ? x.max : null })),
      zonesTs: deps.now()
    });
  }

  async function run(): Promise<StravaSyncResult> {
    const owner = deps.accountKey?.();
    if (!link.get()) return { ok: false, error: 'Strava nije povezana.' };
    const start = ports.read();
    if (!start.genPlan) return { ok: false, error: 'Nema plana.' };
    const s: ImportState = {
      ...start,
      log: { ...start.log },
      pred: { ...start.pred },
      predLock: { ...start.predLock },
      vdotLog: [...start.vdotLog],
      moves: { ...start.moves }
    };
    const genPlan = start.genPlan;
    /* 08c: zapis van plana i `fullSync` samo za plan v2 (5K v2; 10K v2 od 05, HM v2 od HM-05 — ista infrastruktura). */
    const v2 = tracksOffPlanRuns(genPlan);
    const issues: SyncIssue[] = [];
    const resolve = (): ResolvedPlan =>
      resolvePlan(genPlan.weeks, { alts: s.alts, moves: s.moves });
    let plan = resolve();
    const boundary = planBoundary(plan);
    if (!boundary) return { ok: false, error: 'Plan je prazan.' };
    const afterDate = addDays(boundary as IsoDate, -28);
    const after = toEpochDay(afterDate) * 86400;

    await refreshZones();

    const acts: StravaActivity[] = [];
    /* Ceo spisak (poslednja strana nepuna i svaka stavka prepoznata) je istina za svoj period (`recordOffPlanRuns`). */
    let whole = false;
    let unknown = 0;
    for (let page = 1; page <= 4; page++) {
      const r = await api.get(`/athlete/activities?after=${after}&per_page=100&page=${page}`);
      if (!r.ok) return { ok: false, error: r.error };
      const list = parseActivities(r.data);
      if (!list) return { ok: false, error: 'Strava je vratila neočekivan odgovor.' };
      acts.push(...list);
      const raw = Array.isArray(r.data) ? r.data.length : 0;
      unknown += raw - list.length;
      if (raw < 100) {
        whole = true;
        break;
      }
    }
    if (unknown > 0)
      issues.push(activityIssue(null, null, `${unknown} stavki spiska aktivnosti nije prepoznato`));
    if (!whole)
      issues.push(activityIssue(null, null, 'spisak aktivnosti nije preuzet ceo (više od 400)'));
    for (const a of acts) {
      const why = stravaActivityIssue(a);
      if (why) issues.push(activityIssue(String(a.start_date_local ?? '').slice(0, 10), a.id, why));
    }
    const byDate = runsByDate(acts);

    const van = recordOutOfPlan(s.vanPlana, kmByDate(byDate), boundary as IsoDate);
    if (van) s.vanPlana = van;

    /* Pomeri plan PRE glavne petlje da trčanje odmah nađe par. */
    /* Zamena dana pripada generatoru distance plana; plan bez podržane distance se ne preraspoređuje automatski. */
    const generator = generatorForPlan(genPlan);
    const realignInput = {
      weeks: genPlan.weeks,
      alts: s.alts,
      moves: s.moves,
      log: s.log,
      runsByDate: Object.fromEntries(
        Object.entries(byDate).map(([dt, list]) => [
          dt,
          list.map((a) => ({ distance: a.distance ?? 0 }))
        ])
      )
    };
    const realigned = generator
      ? generator.realignPlan(realignInput)
      : { moves: { ...s.moves }, moved: 0 };
    s.moves = realigned.moves;
    plan = resolve();

    const rows = genPlan.pred.filter((r): r is StoredPredRow => typeof r.id === 'string');
    const baseline = planBaselineVdot(genPlan.meta);
    /* Prijem automatskog merenja (tolerancija, lanac) je politika generatora plana (A1). */
    const paceCtx = (d: ResolvedDay): WorkPaceContext => ({
      form: generator,
      rows,
      baselineVdot: baseline,
      hasAlt: !!s.alts[d.id]
    });
    const rowFor = (d: ResolvedDay): string | undefined => {
      if (d.tag !== 'int' && d.tag !== 'tempo') return undefined;
      const week = plan.weeks.find((w) => w.w === d.w);
      return week ? matchWeekRows(week, rows)[d.id]?.[0] : undefined;
    };
    const qsFor = (id: string): number[] | undefined => genPlan.qs?.[id];

    let imported = 0;
    let paces = 0;
    const paired = new Set<string>();
    const writePace = (d: ResolvedDay, rowId: string, pace: number, date: string): void => {
      const r = recordAutoPace(d, rowId, pace, date, s, paceCtx(d));
      s.pred = { ...r.pred };
      s.predLock = { ...r.predLock };
      s.vdotLog = [...r.vdotLog];
      s.log = { ...r.log };
      if (r.written) paces++;
    };

    for (const date of Object.keys(byDate)) {
      const d = plan.byDate.get(date as IsoDate);
      /* trkački dani plana + dan snage (v. `realignPlan`) */
      if (!d || d.rest || (d.km == null && d.tag !== 'snaga')) continue;
      const {
        merged,
        activity: a,
        current
      } = importedDay(byDate[date] ?? [], d.tag, s.log[d.id], d.km, 'strava');
      if (!a || !merged.taken.length) continue;
      for (const x of merged.taken) paired.add(String(x.id));
      const imp = importedEntry(current, date, merged, a);
      s.log[d.id] = imp.entry;
      if (imp.imported) {
        const side = syncSideRecords(s.knee, s.kg, d, imp.entry, deps.today());
        s.knee = side.knee;
        s.kg = side.kg;
        imported++;
      }

      if (d.tag === 'int' || d.tag === 'tempo') {
        const rowId = rowFor(d);
        /* Izvođenje tempa i prikupljanje detalja su dve različite stvari: tempo se piše samo ako ga još nema, a detalji se povlače
           dok god ih nema. I dalje JEDNOM po treningu — `laps`/`perKm` čuvaju rezultat. */
        const smeTempo = !!rowId && !s.predLock[rowId] && s.pred[rowId] == null;
        if (rowId && !hasDetails(s.log[d.id])) {
          /* STRUKTURA SE TRAŽI PO SVIM TRČANJIMA TOG DANA: kad se ujutru trče intervali a uveče lagano, ono bliže planu je po pravilu
             lagano. Kandidati se probaju redom; uzima se PRVI koji zaista ima radne deonice. */
          let st: ActivityStreams | null = null;
          let segs: ReturnType<typeof detectWorkSegments> = null;
          let source = a;
          let failed = false;
          for (const cand of merged.taken) {
            const r = await api.get(
              `/activities/${cand.id}/streams?keys=${STREAM_KEYS_QUALITY}&key_by_type=true`
            );
            if (!r.ok) {
              failed = true;
              if (!nothingThere(r))
                issues.push(activityIssue(date, cand.id, `tokovi nisu preuzeti (${r.error})`));
              break;
            }
            const stK = parseStreams(r.data);
            if (!stK) {
              failed = true;
              if (!nothingThere(r))
                issues.push(activityIssue(date, cand.id, 'tokovi nisu ispravni'));
              break;
            }
            const segK = detectWorkSegments(stK);
            if (!st) {
              st = stK;
              source = cand;
            }
            if (segK && segK.length) {
              st = stK;
              segs = segK;
              source = cand;
              break;
            }
          }
          if (!failed && st) {
            const entry = s.log[d.id] as LogEntry;
            if (segs && segs.length) {
              const totT = segs.reduce((x, y) => x + (y.paceSec * y.distM) / 1000, 0);
              const totD = segs.reduce((x, y) => x + y.distM, 0);
              const t = Math.round(totT / (totD / 1000));
              s.log[d.id] = {
                ...entry,
                ['stravaId']: source.id,
                laps: segs,
                lapsIzvor: 'strava'
              };
              if (t && smeTempo) writePace(d, rowId, t, date);
            } else {
              /* FALLBACK 1: presek po km iz istih streamova (kontinuiran kvalitetni napor koji segmentacija ne razdvaja). */
              const perKm = perKmDetail(st);
              if (perKm.length) s.log[d.id] = { ...entry, perKm };
              /* FALLBACK 2: stari put preko krugova — traži QS spec, koji izmenjen dan nema, pa se preskače. */
              const spec = qsFor(d.id);
              if (spec && smeTempo) {
                const r = await api.get(`/activities/${source.id}/laps`);
                if (r.ok) {
                  const t = workLapsPace(parseLaps(r.data), spec);
                  if (t) writePace(d, rowId, t, date);
                } else if (!nothingThere(r))
                  issues.push(activityIssue(date, source.id, `krugovi nisu preuzeti (${r.error})`));
              }
            }
          }
        }
      } else if (
        (d.tag === 'lako' || d.tag === 'lr' || d.tag === 'trka' || !!s.log[d.id]?.['raceAi']) &&
        s.log[d.id] &&
        perKmStale(s.log[d.id], PERKM_VERSION)
      ) {
        /* Kontinuirana trčanja: presek po km (puls/kadenca/tempo svakog km) za analizu drifta i kadence. Samo jednom. */
        const r = await api.get(
          `/activities/${a.id}/streams?keys=${STREAM_KEYS_EASY}&key_by_type=true`
        );
        const st = r.ok ? parseStreams(r.data) : null;
        if (!st && !nothingThere(r))
          issues.push(
            activityIssue(
              date,
              a.id,
              r.ok ? 'tokovi nisu ispravni' : `tokovi nisu preuzeti (${r.error})`
            )
          );
        const perKm = st ? perKmDetail(st) : [];
        const entry = s.log[d.id];
        if (perKm.length && entry) {
          const hadOld = Array.isArray(entry['perKm']) && (entry['perKm'] as unknown[]).length > 0;
          const next: LogEntry = { ...entry, perKm };
          const dec = decouplingPerKm(perKm);
          if (dec) next['decoupling'] = dec;
          else delete next['decoupling'];
          /* Limit od 2 AI analize postoji zato što „analiza se ne menja za iste podatke". Kad se podaci OSVEŽE novim načinom
             računanja taj razlog ne važi — brojač se resetuje samo kad je zaista postojao STAR zapis koji je zamenjen. */
          if (hadOld) delete next['aiCount'];
          s.log[d.id] = next;
        }
      }
    }

    const aligned = alignVdotDates(s.vdotLog, plan, rows, s.log, (list) =>
      recomputeChain(list, { form: generator, rows, baselineVdot: baseline, hasAlt: false })
    );
    if (aligned.changed) s.vdotLog = aligned.vdotLog;

    if (v2) {
      const off = recordOffPlanRuns({
        current: s.vanPlanaV2 ?? {},
        src: 'strava',
        byDate,
        paired,
        planStart: boundary,
        today: deps.today(),
        window: whole && unknown === 0 ? { from: afterDate, to: deps.today() } : null
      });
      if (off) s.vanPlanaV2 = off;
    }

    if (deps.accountKey?.() !== owner) return { ok: false, error: 'Nalog je promenjen.' };
    ports.commit(s);
    const cur = link.get();
    if (cur)
      link.set({
        ...cur,
        lastSync: deps.now(),
        ...(v2 ? syncStatus(cur, issues, afterDate, deps.now()) : {})
      });
    return { ok: true, imported, paces, moved: realigned.moved };
  }

  return { run };
}

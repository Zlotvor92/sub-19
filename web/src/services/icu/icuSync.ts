/* SINHRONIZACIJA SA intervals.icu: jutarnja merenja (HRV, puls u miru, san), zone pulsa i TRENINZI — primaran izvor kad je veza tu.

   intervals.icu je radne deonice već prepoznao nad izvornim fajlom sa sata, pa daje svaki rep posebno (tempo, GAP, puls, oporavak) umesto
   proseka cele sesije. REDOSLED IZVORA: icu ako je povezan i sme da čita treninge, inače Strava (`services/activitySource`). ODLUKE su u
   `domain` (`icuImportedEntry`, `mergeDay`, `realignPlan`, `icuRoundsToLaps`, `recordAutoPace`, …); ovde je samo tok poziva.

   Stanje se čita jednom, menja na lokalnoj kopiji i upisuje JEDNOM na kraju (i pri prekidu — ono što je do tada izvedeno je ispravno). */

import { addDays, type IsoDate } from '../../domain/date';
import {
  decouplingPerKm,
  icuImportedEntry,
  icuKmByDate,
  icuRoundsToLaps,
  icuRunsByDate,
  icuWorkPace,
  LAPS_VERSION,
  mergeDay,
  needsIcuDetails,
  needsIcuStreams,
  perKmDetail,
  pickClosest,
  realignPlan,
  type IcuActivity
} from '../../domain/activities';
import { recordAutoPace, syncSideRecords, type WorkPaceContext } from '../../domain/day';
import {
  icuCanReadActivities,
  icuCanReadSettings,
  icuConnected,
  type IcuLink
} from '../../domain/icu';
import { planBaselineVdot, resolvePlan, type ResolvedDay } from '../../domain/plan';
import { planBoundary, recordOutOfPlan } from '../../domain/recovery';
import type { LogEntry, WellnessRecord } from '../../domain/state';
import {
  alignVdotDates,
  matchWeekRows,
  type StoredPredRow
} from '../../domain/training/adaptation';
import type { IcuApi } from '../api/icuApi';
import type { ImportPorts, ImportState } from '../strava/stravaSync';
import { parseStreams } from '../streams';

export interface IcuLinkStore {
  get(): IcuLink | null;
  set(v: IcuLink | null): void;
}

export interface WellnessPorts {
  read(): Record<string, WellnessRecord>;
  write(next: Record<string, WellnessRecord>): void;
}

export interface IcuSyncDeps {
  accountKey?: () => string;
  api: IcuApi;
  link: IcuLinkStore;
  ports: ImportPorts;
  wellness: WellnessPorts;
  now: () => number;
  /** Danas kao lokalni `YYYY-MM-DD`. */
  today: () => string;
}

export type IcuResult<T> = ({ ok: true } & T) | { ok: false; error: string };

const WEEK_MS = 7 * 864e5;
export const NO_ACTIVITIES_SCOPE =
  'Veza sa intervals.icu nema dozvolu za treninge. Otkači pa ponovo poveži — dobićeš i treninge, ne samo jutarnja merenja.';
export const ZONES_OLD_LINK =
  'Veza sa intervals.icu je starija od ove funkcije i nema dozvolu za čitanje podešavanja. Otkači pa ponovo poveži intervals.icu — dobićeš i zone pulsa.';

export function createIcuSync(deps: IcuSyncDeps) {
  const { api, link, ports } = deps;

  /** Datum `n` dana pre danas (lokalno), `YYYY-MM-DD`. */
  const daysAgo = (n: number): string => addDays(deps.today() as IsoDate, -n);

  /* ------------------------------------------------------------ jutarnja merenja */

  /** `days` dana unazad do danas. Preklapanje ne smeta: zapisi se upisuju po datumu, pa se isti dan samo prepiše istom vrednošću. */
  async function syncWellness(days: number): Promise<IcuResult<{ n: number }>> {
    const owner = deps.accountKey?.();
    const cur = link.get();
    if (!icuConnected(cur) || !cur) return { ok: false, error: 'intervals.icu nije povezan.' };
    /* LOKALNI kalendarski datum, ne UTC: posle ponoći po lokalnom vremenu UTC je još „juče", pa bi se tražio prozor bez današnjeg dana. */
    const r = await api.wellness(cur, daysAgo(days || 60), deps.today());
    if (deps.accountKey?.() !== owner) return { ok: false, error: 'Nalog je promenjen.' };
    if (!r.ok) return { ok: false, error: r.error };
    const merged = { ...deps.wellness.read(), ...r.data.days };
    deps.wellness.write(merged);
    link.set({ ...(link.get() ?? cur), lastSync: deps.now() });
    return { ok: true, n: Object.keys(r.data.days).length };
  }

  /* ------------------------------------------------------------ zone pulsa */

  /**
   * Zone iz sportskih podešavanja; najviše jednom nedeljno (`force` zaobilazi keš — ko je upravo promenio zone i pritisnuo dugme očekuje
   * ih sada). Greška se PAMTI (`zoneGreska`), ne guta: prva verzija je na svaki neuspeh vraćala `false` bez traga, pa se stvarni uzrok
   * (403 zbog starog opsega) nije video ni korisniku ni meni.
   */
  async function syncZones(force: boolean): Promise<boolean> {
    const owner = deps.accountKey?.();
    const cur = link.get();
    if (!icuConnected(cur) || !cur) return false;
    const remember = (msg: string | null): boolean => {
      const l = link.get();
      if (l) {
        const next = { ...l };
        if (msg) next['zoneGreska'] = msg.slice(0, 300);
        else delete next['zoneGreska'];
        link.set(next);
      }
      return !!msg;
    };
    if (!icuCanReadSettings(cur)) {
      remember(ZONES_OLD_LINK);
      return false;
    }
    const last = typeof cur['zonesTs'] === 'number' ? cur['zonesTs'] : 0;
    if (!force && deps.now() - last < WEEK_MS) return false;
    const r = await api.zones(cur);
    if (deps.accountKey?.() !== owner) return false;
    if (!r.ok) {
      remember(
        r.kind === 'network'
          ? 'Nema veze sa serverom pri povlačenju zona.'
          : /^Greška \d+$/.test(r.error)
            ? `Server je vratio grešku ${r.status ?? ''} pri povlačenju zona.`
            : r.error
      );
      return false;
    }
    if (!r.data.zone || !r.data.zone.length) {
      remember(r.data.reason || 'intervals.icu nije vratio nijednu zonu pulsa za trčanje.');
      return false;
    }
    remember(null);
    const l = { ...(link.get() ?? cur) };
    /* Isti oblik koji čitaju `zoneForHr` i prikaz zona — {min,max} uz naziv. */
    l['hrZones'] = r.data.zone.map((x) => ({
      min: x.min,
      max: x.max != null && x.max > 0 ? x.max : null,
      ime: x.ime
    }));
    l['zonesTs'] = deps.now();
    if (r.data.lthr != null) l['lthr'] = r.data.lthr;
    if (r.data.maxHr != null) l['maxHr'] = r.data.maxHr;
    link.set(l);
    return true;
  }

  /* ------------------------------------------------------------ treninzi */

  async function syncActivities(
    daysBack: number,
    manual: boolean
  ): Promise<IcuResult<{ n: number; details: number; streams: number }>> {
    const owner = deps.accountKey?.();
    const start0 = link.get();
    if (!icuConnected(start0) || !start0)
      return { ok: false, error: 'intervals.icu nije povezan.' };
    if (!icuCanReadActivities(start0)) return { ok: false, error: NO_ACTIVITIES_SCOPE };
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
    const resolve = () => resolvePlan(genPlan.weeks, { alts: s.alts, moves: s.moves });
    let plan = resolve();
    const boundary = planBoundary(plan);
    if (!boundary) return { ok: false, error: 'Plan je prazan.' };

    /* Četiri nedelje pre prvog dana plana — za opterećenje u prvim nedeljama; na dane plana se i dalje kači samo ono što je u planu. */
    const floor = addDays(boundary as IsoDate, -28);
    const asked = daysAgo(daysBack || 45);
    const oldest = asked < floor ? floor : asked;

    const list = await api.activities(start0, oldest, deps.today());
    if (deps.accountKey?.() !== owner) return { ok: false, error: 'Nalog je promenjen.' };
    if (!list.ok) return { ok: false, error: list.error };
    const activities: IcuActivity[] = list.data.activities;
    if (!activities.length) {
      link.set({ ...(link.get() ?? start0), trSync: deps.now() });
      return { ok: true, n: 0, details: 0, streams: 0 };
    }

    /* Isti oblik kao Strava (`distance` u metrima), da `realignPlan` i `pickClosest` rade nepromenjeni: jedno pravilo, oba izvora. */
    const byDate = icuRunsByDate(activities);
    const van = recordOutOfPlan(s.vanPlana, icuKmByDate(byDate), boundary as IsoDate);
    if (van) s.vanPlana = van;
    const realigned = realignPlan({
      weeks: genPlan.weeks,
      alts: s.alts,
      moves: s.moves,
      log: s.log,
      runsByDate: Object.fromEntries(
        Object.entries(byDate).map(([dt, l]) => [dt, l.map((a) => ({ distance: a.distance }))])
      )
    });
    s.moves = realigned.moves;
    plan = resolve();

    const rows = genPlan.pred.filter((r): r is StoredPredRow => typeof r.id === 'string');
    const baseline = planBaselineVdot(genPlan.meta);
    const paceCtx = (d: ResolvedDay): WorkPaceContext => ({
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
    const writePace = (d: ResolvedDay, rowId: string, pace: number, date: string): void => {
      const r = recordAutoPace(d, rowId, pace, date, s, paceCtx(d));
      s.pred = { ...r.pred };
      s.predLock = { ...r.predLock };
      s.vdotLog = [...r.vdotLog];
      s.log = { ...r.log };
    };

    let n = 0;
    const askDetails: Array<{ id: string; dayId: string; d: ResolvedDay }> = [];
    const askStreams: Array<{ id: string; dayId: string; d: ResolvedDay }> = [];
    for (const date of Object.keys(byDate)) {
      const d = plan.byDate.get(date as IsoDate);
      if (!d || d.rest || (d.km == null && d.tag !== 'snaga')) continue;
      /* Isto kao na Strava putanji: sva trčanja tog dana ulaze u obim, `a` je nosilac imena/opisa/ID-ja. */
      const merged = mergeDay(byDate[date] ?? []);
      if (!merged.taken.length) continue;
      const a = pickClosest(merged.taken, d.km);
      const imp = icuImportedEntry(s.log[d.id], date, merged, a);
      s.log[d.id] = imp.entry;
      if (imp.imported) {
        const side = syncSideRecords(s.knee, s.kg, d, imp.entry, deps.today());
        s.knee = side.knee;
        s.kg = side.kg;
        n++;
      }
      /* Detalji se traže za KVALITETNE dane — tu je razlika između „6×800: 3:52/3:54/…" i „prosek 3:55". Traži se i kad tempo već
         postoji: prikupljanje detalja nema veze sa izvođenjem tempa. */
      if (needsIcuDetails(d.tag, a, s.log[d.id])) askDetails.push({ id: a.id, dayId: d.id, d });
      /* KONTINUIRANA TRČANJA (lako/dugo): icu tu nema strukturu, ali bez preseka po km nema ni tempa/pulsa po kilometru ni drifta — traže
         se sirovi tokovi i obrađuju ISTOM funkcijom kao Stravini. */
      if (needsIcuStreams(d.tag, a, s.log[d.id])) askStreams.push({ id: a.id, dayId: d.id, d });
    }

    const finish = (): void => {
      if (deps.accountKey?.() !== owner) return;
      const aligned = alignVdotDates(s.vdotLog, plan, rows, s.log, baseline);
      if (aligned.changed) s.vdotLog = aligned.vdotLog;
      ports.commit(s);
      link.set({ ...(link.get() ?? start0), trSync: deps.now() });
    };

    let details = 0;
    for (let i = 0; i < askDetails.length && i < 24; i += 12) {
      const group = askDetails.slice(i, i + 12);
      const r = await api.details(
        start0,
        group.map((x) => x.id)
      );
      if (!r.ok) {
        if (manual) {
          finish();
          return { ok: false, error: r.error };
        }
        break;
      }
      for (const x of group) {
        const det = r.data.details[x.id];
        if (!det) continue;
        const entry = s.log[x.dayId];
        if (!entry) continue;
        const laps = icuRoundsToLaps(det.rounds, qsFor(x.d.id));
        const next: LogEntry = { ...entry };
        if (laps.length) {
          next['laps'] = laps;
          next['lapsIzvor'] = 'icu';
          next['lapsVer'] = LAPS_VERSION;
          details++;
          if (det.groups.length) next['icuGrupe'] = det.groups;
          else delete next['icuGrupe'];
          s.log[x.dayId] = next;
          const rowId = rowFor(x.d);
          const t = icuWorkPace(laps, qsFor(x.d.id));
          if (rowId && !s.predLock[rowId] && s.pred[rowId] == null && t)
            writePace(x.d, rowId, t, next.runDate || x.d.date);
        } else {
          /* icu nije našao strukturu — kontinuirano trčanje. To je odgovor, ne greška; upisuje se da se ne bi tražilo iznova. */
          next['lapsIzvor'] = 'icu-bez-strukture';
          next['lapsVer'] = LAPS_VERSION;
          s.log[x.dayId] = next;
        }
      }
    }

    /* PO-KM PRESEK ZA KONTINUIRANA TRČANJA. Tokovi su veliki (sat trčanja je ~3600 tačaka po nizu), pa se traži najviše tri po
       sinhronizaciji — a ne traži se ponovo jer `perKm` sa tekućom verzijom ovu granu isključuje. */
    let streams = 0;
    if (askStreams.length) {
      const group = askStreams.slice(0, 3);
      const r = await api.streams(
        start0,
        group.map((x) => x.id)
      );
      if (!r.ok) {
        if (manual) {
          finish();
          return { ok: false, error: r.error };
        }
      } else {
        for (const x of group) {
          const raw = r.data.streams[x.id];
          if (!raw || (typeof raw === 'object' && 'greska' in raw)) continue;
          const entry = s.log[x.dayId];
          if (!entry) continue;
          const st = parseStreams(raw);
          const perKm = st ? perKmDetail(st) : [];
          if (!perKm.length) continue;
          const next: LogEntry = { ...entry, perKm };
          streams++;
          /* icu-ovo `razdvajanje` iz spiska ima prednost (merenje nad celim fajlom); kad ga nema, računa se iz preseka po km. */
          const icuInfo = next['icu'] as { razdvajanje?: unknown } | undefined;
          if (!(icuInfo && icuInfo.razdvajanje != null)) {
            const dec = decouplingPerKm(perKm);
            if (dec) next['decoupling'] = dec;
            else delete next['decoupling'];
          }
          /* Analiza nastala nad golim prosekom više ne važi kad stignu podaci po kilometru — brojač se oslobađa. */
          delete next['aiCount'];
          s.log[x.dayId] = next;
        }
      }
    }

    finish();
    return { ok: true, n, details, streams };
  }

  /** „Povuci sve": merenja, zone, pa treninzi — jednim dodirom. */
  async function syncAll(
    daysBack: number,
    manual: boolean
  ): Promise<
    IcuResult<{
      wellness: number;
      runs: number | null;
      details: number | null;
      activitiesNote: string | null;
    }>
  > {
    const w = await syncWellness(daysBack || 120);
    if (!w.ok) return w;
    /* Pre treninga, jer AI analiza tih treninga zone već koristi. Neuspeh se namerno guta — zone su dopuna. */
    await syncZones(manual);
    const out = {
      ok: true as const,
      wellness: w.n,
      runs: null as number | null,
      details: null as number | null,
      activitiesNote: null as string | null
    };
    if (!icuCanReadActivities(link.get())) {
      out.activitiesNote = 'Veza nema dozvolu za treninge — otkači pa ponovo poveži.';
      return out;
    }
    const t = await syncActivities(Math.min(daysBack || 60, 90), manual);
    if (t.ok) {
      out.runs = t.n;
      out.details = t.details;
    } else out.activitiesNote = t.error;
    return out;
  }

  /**
   * Automatsko povlačenje jutarnjih merenja — jednom dnevno, pri prvom otvaranju. Garmin šalje merenja na intervals.icu tokom noći.
   * Ide 14 dana unazad: sat zna da dopuni ili ispravi merenje unazad, a telefon je mogao biti bez signala. Dan se pamti SAMO na uspeh —
   * da se upiše unapred, jedan neuspeo poziv (avionski režim ujutru) ostavio bi korisnika bez podataka ceo dan.
   */
  let autoRunning = false;
  async function autoSync(online: boolean): Promise<boolean> {
    if (autoRunning) return false;
    const owner = deps.accountKey?.();
    const cur = link.get();
    if (!icuConnected(cur) || !cur || !online) return false;
    const day = deps.today();
    if (cur['autoDan'] === day) return false;
    autoRunning = true;
    let r: IcuResult<{ n: number }> | null = null;
    try {
      r = await syncWellness(14);
    } catch {
      r = null;
    }
    autoRunning = false;
    if (r && r.ok && deps.accountKey?.() === owner) {
      const l = link.get();
      if (l) link.set({ ...l, autoDan: day });
      return true;
    }
    return false;
  }

  return { syncWellness, syncZones, syncActivities, syncAll, autoSync };
}

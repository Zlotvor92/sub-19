/* SAŽETAK ZA TREND ANALIZU. Model ne dobija pun po-krug niz (previše) nego svaki odrađeni trening sažet: datum, tip, tempo, drift, kadenca…
   TEMPO NAPRETKA se računa OVDE, ne prepušta se modelu: merenjem na stvarnoj analizi model je uredno ispisao rast, cilj i rok, a onda ta tri
   broja nije uporedio i zaključio da je cilj „dostizan" iako je tražen tempo napretka bio ~sedam puta veći od ostvarenog. Aritmetika je za jezički
   model najnepouzdaniji deo posla, pa mu se šalje gotov nalaz umesto ulaza za račun. */

import { icuWorkPace } from '../activities';
import { weekPlanKm } from '../day';
import { addDays, diffDays, mondayOnOrBefore, parseIsoDate, type IsoDate } from '../date';
import type { ResolvedPlan } from '../plan';
import type { LogEntry, VdotRecord, WellnessRecord } from '../state/types';
import { predRowsForDay, type StoredPredRow } from '../training/adaptation';
import type { ZoneSource } from '../zones';

export interface TrendInput {
  plan: ResolvedPlan;
  log: Readonly<Record<string, LogEntry>>;
  pred: Readonly<Record<string, unknown>>;
  predLock: Readonly<Record<string, unknown>>;
  predRows: readonly StoredPredRow[];
  qs: Readonly<Record<string, number[]>> | undefined;
  vdotLog: readonly VdotRecord[];
  wellness: Readonly<Record<string, WellnessRecord>> | null | undefined;
  currentZones: ZoneSource;
  today: IsoDate;
  raceDate: IsoDate | null;
  /** Polazni i ciljni VDOT iz plana (`null` kad ih plan ne nosi). */
  baselineVdot: number | null;
  goalVdot: number | null;
}

type Row = Record<string, unknown> & { date: string; tag: string | undefined };
const nums = (arr: unknown[]): number[] => arr as number[];
const mean = (v: number[]): number => v.reduce((s, x) => s + x, 0) / v.length;

function runRow(d: ResolvedPlan['dated'][number], l: LogEntry, i: TrendInput): Row {
  const row: Row = { date: l.runDate || l.ts || d.date, tag: d.tag };
  /* Zaključan ručan unos je EKSPLICITNA korisnikova ispravka ostvarenog tempa — ima prednost nad `laps`, koji mogu biti STARIJI.
     Drift/kadenca i dalje dolaze iz krugova kad postoje: ispravka tempa ne poništava taj (odvojen) signal. */
  const locked = predRowsForDay(i.plan, d, i.predRows).find(
    (r) => i.predLock[r.id] && i.pred[r.id] != null
  );
  if (locked) row['tempo'] = i.pred[locked.id];
  const laps = l['laps'];
  const perKm = l['perKm'];
  if (Array.isArray(laps) && laps.length) {
    const L = laps as Array<Record<string, unknown>>;
    const hrs = nums(L.map((x) => x['avgHr']).filter((x) => x != null));
    const cads = nums(L.map((x) => x['cadence']).filter((x) => x != null));
    /* PROSEK PONDERISAN DISTANCOM, ne prosek proseka (1600 m + 400 m ume da promaši za 18 s/km). */
    if (row['tempo'] == null) {
      const t = icuWorkPace(laps as never, i.qs?.[d.id]);
      if (t) row['tempo'] = t;
    }
    if (hrs.length >= 2) {
      row['driftStart'] = hrs[0];
      row['driftEnd'] = hrs[hrs.length - 1];
      row['drift'] = (hrs[hrs.length - 1] as number) - (hrs[0] as number);
    }
    if (cads.length) row['cadence'] = Math.round(mean(cads));
    /* Što SAMO intervals.icu daje: trend bez ovoga vidi isti tempo na ravnom i uzbrdo, i ne vidi da su se oporavci razvlačili (najraniji znak da serija puca). */
    const gaps = L.filter((x) => +(x['gapSec'] as number) > 0 && +(x['distM'] as number) > 0);
    if (gaps.length === L.length) {
      const dist = gaps.reduce((a, x) => a + +(x['distM'] as number), 0);
      const v = gaps.reduce(
        (a, x) => a + (+(x['gapSec'] as number) * +(x['distM'] as number)) / 1000,
        0
      );
      if (dist > 0) row['gap'] = Math.round(v / (dist / 1000));
    }
    const rests = nums(L.map((x) => x['restSec']).filter((x) => +(x as number) > 0));
    if (rests.length >= 2) {
      row['pauzaPrva'] = rests[0];
      row['pauzaZadnja'] = rests[rests.length - 1];
    }
    if (L.length > 1) row['repova'] = L.length;
  } else if (Array.isArray(perKm) && perKm.length) {
    const K = perKm as Array<Record<string, unknown> | null>;
    const cads = nums(K.map((x) => (x ? x['cadence'] : undefined)).filter((x) => x != null));
    if (cads.length) row['cadence'] = Math.round(mean(cads));
    /* DRIFT SE MERI SAMO NA UPOREDIVOM TEMPU: druga polovina naspram prve, i samo ako su tempom uporedive (±3 %). */
    const v = K.filter(
      (x): x is Record<string, unknown> =>
        !!x && +(x['paceSec'] as number) > 0 && +(x['hr'] as number) > 0
    );
    if (v.length >= 6) {
      const half = Math.floor(v.length / 2);
      const A = v.slice(0, half);
      const B = v.slice(v.length - half);
      const pA = mean(A.map((x) => +(x['paceSec'] as number)));
      const pB = mean(B.map((x) => +(x['paceSec'] as number)));
      if (pA > 0 && Math.abs(pB - pA) / pA <= 0.03) {
        row['driftStart'] = Math.round(mean(A.map((x) => +(x['hr'] as number))));
        row['driftEnd'] = Math.round(mean(B.map((x) => +(x['hr'] as number))));
        row['drift'] = (row['driftEnd'] as number) - (row['driftStart'] as number);
      } else {
        row['progresivno'] = true; // tempo namerno menjan — drift se ne računa
      }
    }
  } else {
    if (row['tempo'] == null && l.km && l.sec) row['tempo'] = Math.round(l.sec / l.km);
    if (l.hr) row['avgHr'] = l.hr;
  }
  if (l.km != null) row['km'] = l.km;
  const dec = l['decoupling'] as { n?: unknown } | null | undefined;
  if (dec && dec.n != null) row['dekuplovanje'] = dec.n;
  /* Mere koje intervals.icu sam izračuna nad celim fajlom (efikasnost kroz vreme je najčistiji pokazatelj aerobnog napretka). */
  const icu = l['icu'] as Record<string, unknown> | null | undefined;
  if (icu) {
    if (icu['efikasnost'] != null) row['efikasnost'] = icu['efikasnost'];
    if (icu['opterecenje'] != null) row['opterecenje'] = icu['opterecenje'];
    if (icu['osecaSe'] != null) row['osecaSe'] = icu['osecaSe'];
  }
  if (l['relEffort'] != null) row['relEffort'] = l['relEffort'];
  if (l['rpe'] != null) row['rpe'] = l['rpe'];
  return row;
}

/** Sažetak narednih nedelja: kvalitetni dani i dugo trčanje (lagani dani nose obim, koji je već dat brojem). */
export function planAhead(plan: ResolvedPlan, today: IsoDate, weeks = 4) {
  const out: Array<{
    nedelja: number;
    od: string;
    km: number;
    deload: boolean;
    kvalitetni: string[];
    dugo: string | null;
  }> = [];
  for (const w of plan.weeks) {
    if (addDays(w.start, 6) < today) continue; // nedelja je prošla
    if (out.length >= (weeks || 4)) break;
    const quality: string[] = [];
    const long: string[] = [];
    for (const d of w.days) {
      if (d.rest || d.tag === 'snaga') continue;
      const text = String(d.desc || '')
        .split('\n')[0]
        ?.replace(/\s*·.*$/, '') as string;
      if (d.tag === 'lr') long.push(`${d.km || 0} km`);
      else if (d.tag !== 'lako' && (d.tag as string) !== 'rw') quality.push(text);
    }
    out.push({
      nedelja: w.w,
      od: w.start,
      km: Math.round(weekPlanKm(w) * 10) / 10,
      deload: /DELOAD/i.test(w.focus || ''),
      kvalitetni: quality,
      dugo: long.join(' + ') || null
    });
  }
  return out;
}

const r2 = (x: number): number => Math.round(x * 100) / 100;

/** Tempo napretka: gotov nalaz („hoću li stići") umesto ulaza za račun. `null` kad je razmak prekratak (< 14 dana) ili nema cilja. */
export function progressRate(
  vl: ReadonlyArray<{ ts?: string; date?: string; vdot: number | null }>,
  goalVdot: number | null,
  today: IsoDate,
  raceDate: IsoDate | null
) {
  if (vl.length < 2 || goalVdot == null || !raceDate) return null;
  const first = vl[0];
  const last = vl[vl.length - 1];
  if (!first || !last || first.vdot == null || last.vdot == null) return null;
  const a = parseIsoDate(first.ts || first.date);
  const b = parseIsoDate(last.ts || last.date);
  if (!a || !b) return null;
  const days = diffDays(a, b);
  if (!(days >= 14)) return null; // prekratko za tvrdnju o tempu
  const weeks = days / 7;
  const toRace = Math.max(diffDays(today, raceDate) / 7, 0.1);
  const made = (last.vdot - first.vdot) / weeks;
  const missing = goalVdot - last.vdot;
  const needed = missing / toRace;
  return {
    odVdot: first.vdot,
    doVdot: last.vdot,
    nedeljaMereno: r2(weeks),
    ostvarenoPoNedelji: r2(made),
    cilj: goalVdot,
    faliDoCilja: r2(missing),
    nedeljaDoTrke: r2(toRace),
    potrebnoPoNedelji: r2(needed),
    /* projekcija na TRENUTNOM tempu — jedini pošten odgovor na „hoću li stići" */
    projekcijaNaTrci: r2(last.vdot + made * toRace)
  };
}

/** Zahtev za trend analizu. Oblik je UGOVOR sa `api/analyze.js`. */
export function buildTrendSummary(i: TrendInput) {
  const rows: Row[] = [];
  for (const d of i.plan.dated) {
    const l = i.log[d.id];
    if (!l || l.status !== 'done') continue;
    rows.push(runRow(d, l, i));
  }
  /* Nedeljni obim — bez njega model ne može da razlikuje „forma stagnira" od „obim je pao zbog bolesti/putovanja". */
  const weekly: Record<string, number> = {};
  for (const r of rows) {
    const km = r['km'] as number | null | undefined;
    const date = parseIsoDate(r.date);
    if (km == null || !r.date || !date) continue;
    const key = mondayOnOrBefore(date);
    weekly[key] = (weekly[key] || 0) + km;
  }
  const volume = Object.keys(weekly)
    .sort()
    .map((k) => ({ od: k, km: Math.round((weekly[k] as number) * 10) / 10 }));
  const vdots = i.vdotLog
    .slice()
    .sort((a, b) => (a.ts < b.ts ? -1 : 1))
    .map((e) => ({ date: e.ts, vdot: e.vdot }));
  /* Oporavak kroz vreme — samo dani koji imaju bar nešto, najviše 120 poslednjih. */
  const recovery = Object.keys(i.wellness ?? {})
    .sort()
    .slice(-120)
    .map((k) => (i.wellness as Record<string, WellnessRecord>)[k])
    .filter(
      (z) =>
        z &&
        (z.hrv != null ||
          z.pulsUMiru != null ||
          z.sanH != null ||
          (z as { ctl?: unknown }).ctl != null)
    );
  return {
    treninzi: rows,
    vdot: vdots,
    baseline: i.baselineVdot,
    cilj: i.goalVdot,
    obim: volume,
    hrZones: i.currentZones.zones,
    hrZonesIzvor: i.currentZones.source,
    oporavak: recovery,
    naredno: planAhead(i.plan, i.today, 4),
    doTrke: i.raceDate ? diffDays(i.today, i.raceDate) : null,
    tempoNapretka: progressRate(vdots, i.goalVdot, i.today, i.raceDate)
  };
}

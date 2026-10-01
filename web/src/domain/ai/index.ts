/* AI ANALIZA TRENINGA: odluke bez ikakvog ulaza/izlaza. AI NIJE kalkulator treninga — plan, tempo, VDOT i raspodela po zonama se računaju
   OVDE (aplikacija ih ume tačno), a model dobija gotove brojeve i samo ih tumači.

   Servis (`services/ai`) vodi posao: start → radi → čitaj. Ovde je šta kartica pokazuje u kom stanju i šta se šalje modelu. Oblik zahteva je
   UGOVOR sa `api/analyze.js` i ne sme se menjati. */

import { fmtClock, pl3 } from '../format';
import { sessKind, type ResolvedDay, type ResolvedPlan } from '../plan';
import type { LogEntry, WellnessRecord } from '../state/types';
import { effectivePace, predRowsForDay, type StoredPredRow } from '../training/adaptation';
import { runTemp, type ForecastCache } from '../weather';
import { wellnessFor } from '../recovery/view';
import { zoneDistribution, zonesForRun, type ZoneSource } from '../zones';

/** Dve analize po treningu: „analiza se ne menja za iste podatke", pa treća košta kvotu bez nove informacije. Server odbija istom logikom. */
export const AI_LIMIT = 2;
/** Posle ovoga se faza „radi" šalje ponovo (slučaj: zahtev nije stigao). Ne troši kvotu — dnevni limit se broji u fazi „start". */
export const AI_RETRY_MS = 5 * 60e3;
/** Posle ovoga se posao proglašava neuspelim i vraća se dugme (slučaj: serverska funkcija umrla usred poziva). */
export const AI_GIVE_UP_MS = 30 * 60e3;
/** Sačuvani tekst analize se seče na ovoliko znakova. */
export const AI_TEXT_MAX = 4000;

/** Koliko analiza SME još da se pokrene za ovaj trening. VLASNIK NEMA LIMIT (kvotu plaća on; ponovno pokretanje mu služi za razvoj). */
export function aiRemaining(log: LogEntry | null | undefined, isOwner: boolean): number {
  if (isOwner) return Infinity;
  const count = Number(log?.['aiCount'] ?? 0) || 0;
  return Math.max(0, AI_LIMIT - count);
}

/** „2 preostale" — ostatak analiza za prikaz na dugmetu; bez ograničenja za vlasnika. */
export function remainingText(n: number): string {
  if (n === Infinity) return 'bez ograničenja';
  return `${n} ${pl3(n, 'preostala', 'preostale', 'preostalih')}`;
}

/** „krug / kruga / krugova". */
export function lapWord(n: number): string {
  const h = n % 100;
  if (h >= 11 && h <= 14) return 'krugova';
  const m = n % 10;
  return m === 1 ? 'krug' : m >= 2 && m <= 4 ? 'kruga' : 'krugova';
}

/**
 * Šta model dobija kao podatak — IMENUJE se izvor, jer nije isti kvalitet: krugovi sa intervals.icu su prepoznati nad izvornim fajlom sa
 * sata (nose GAP i puls po repu), sa Strave ih je prepoznala sama aplikacija iz streamova.
 */
export function aiSourceLabel(log: LogEntry): string {
  const laps = Array.isArray(log['laps']) ? log['laps'].length : 0;
  const perKm = Array.isArray(log['perKm']) ? log['perKm'].length : 0;
  if (laps)
    return `po krugu · ${laps} ${lapWord(laps)}${log['lapsIzvor'] === 'icu' ? ' · intervals.icu' : ''}`;
  if (perKm) return `po kilometru · ${perKm} km`;
  return 'samo prosek cele sesije';
}

/** Analiza se nudi samo za trčanje sa unetim km i vremenom. */
export function canAnalyze(
  day: Pick<ResolvedDay, 'tag'>,
  log: LogEntry | null | undefined
): boolean {
  return (
    (day.tag === 'int' || day.tag === 'tempo' || day.tag === 'lako' || day.tag === 'lr') &&
    !!log?.km &&
    !!log.sec
  );
}

export interface AiJob {
  id: string;
  /** Kad je posao pokrenut (ms). Posao bez oznake je zapisan starijom verzijom — oznaka se postavlja SADA, da ažuriranje usred računanja ne obori analizu koja radi. */
  at?: number;
}

export const aiJobOf = (log: LogEntry | null | undefined): AiJob | null => {
  const p = log?.['aiPosao'] as { id?: unknown; at?: unknown } | undefined | null;
  if (!p || typeof p !== 'object') return null;
  const id = p.id;
  if ((typeof id !== 'string' && typeof id !== 'number') || !id) return null;
  return {
    id: String(id),
    ...(typeof p.at === 'number' && Number.isFinite(p.at) ? { at: p.at } : {})
  };
};

/** Koliko posao traje; `stamp` kad oznaka fali i treba je upisati (starost je tada 0). */
export function aiJobAge(
  log: LogEntry | null | undefined,
  now: number
): { age: number; stamp: boolean } {
  const job = aiJobOf(log);
  if (!job) return { age: 0, stamp: false };
  if (job.at == null) return { age: 0, stamp: true };
  return { age: Math.max(0, now - job.at), stamp: false };
}

export type AiCardView =
  | { kind: 'hidden' }
  /** Kartica je jedan red — sama radnja. */
  | { kind: 'offer'; source: string; remaining: number }
  /** Obe analize su potrošene. */
  | { kind: 'exhausted' }
  | { kind: 'done'; source: string; text: string; error: string | null; remaining: number }
  | { kind: 'running'; source: string; stuck: boolean; previous: string | null };

/**
 * Stanje kartice. POSAO KOJI TRAJE ima prednost UVEK (i kad stari tekst postoji): inače bi posle povratka u aplikaciju izgledalo da se ništa
 * nije pokrenulo, pa bi čovek kliknuo ponovo i potrošio još jednu analizu. Stari tekst ostaje ispod, označen — i dalje je valjan podatak.
 */
export function aiCardView(
  day: Pick<ResolvedDay, 'tag'>,
  log: LogEntry | null | undefined,
  opts: { isOwner: boolean; now: number }
): AiCardView {
  if (!log || !canAnalyze(day, log)) return { kind: 'hidden' };
  const source = aiSourceLabel(log);
  const remaining = aiRemaining(log, opts.isOwner);
  /* Traži se STRING: iz uvezenog backupa `aiText` ume da dođe kao objekat ili broj, a onda bi pisalo „[object Object]". */
  const text = typeof log['aiText'] === 'string' && log['aiText'].trim() ? log['aiText'] : null;
  if (aiJobOf(log)) {
    const stuck = aiJobAge(log, opts.now).age >= AI_RETRY_MS;
    return { kind: 'running', source, stuck, previous: text };
  }
  if (text) {
    const error = typeof log['aiGreska'] === 'string' && log['aiGreska'] ? log['aiGreska'] : null;
    return { kind: 'done', source, text, error, remaining };
  }
  if (!remaining) return { kind: 'exhausted' };
  return { kind: 'offer', source, remaining };
}

/* ------------------------------------------------------------- tekst analize */

export interface MdSegment {
  text: string;
  strong: boolean;
}
/** Paragraf = redovi (razdvojeni `<br>`); red = delovi. */
export type MdParagraph = MdSegment[][];

/**
 * Usko markdown: SAMO `**bold**` i pasusi (prazan red = novi pasus, novi red = prelom). Ništa iz teksta ne postaje oznaka — React ga ispisuje kao
 * tekst, pa ni analiza iz uvezenog backupa ne može da unese HTML.
 */
export function parseAnalysis(text: string | null | undefined): MdParagraph[] {
  if (!text) return [];
  return text.split(/\n\n+/).map((para) =>
    para.split('\n').map((line) => {
      const segs: MdSegment[] = [];
      let last = 0;
      for (const m of line.matchAll(/\*\*(.+?)\*\*/g)) {
        if (m.index > last) segs.push({ text: line.slice(last, m.index), strong: false });
        segs.push({ text: m[1] as string, strong: true });
        last = m.index + m[0].length;
      }
      if (last < line.length) segs.push({ text: line.slice(last), strong: false });
      return segs;
    })
  );
}

/* ------------------------------------------------------------- zahtev za model */

/** Opis cilja AKTIVNOG plana za prompt. Cilj i procena NISU ista stvar i ne smeju se opisati istom rečenicom. */
export function goalContext(
  meta: Readonly<Record<string, unknown>> | null | undefined
): string | null {
  if (!meta) return null;
  const name = typeof meta['raceName'] === 'string' && meta['raceName'] ? meta['raceName'] : 'trka';
  const goal = meta['goalSec'];
  const predicted = meta['predictedSec'];
  if (goal != null && Number.isFinite(goal)) {
    const extra =
      meta['realno'] === false && predicted != null
        ? ` (ambiciozan — procena iz forme je ~${fmtClock(predicted as number)})`
        : '';
    return `${name} — ciljno vreme ${fmtClock(goal as number)}${extra}`;
  }
  return predicted != null
    ? `${name} — procenjeno vreme ~${fmtClock(predicted as number)} (na osnovu unetog PB-a)`
    : name;
}

export interface AiPayloadInput {
  day: ResolvedDay;
  log: LogEntry;
  plan: Pick<ResolvedPlan, 'weeks'>;
  predRows: readonly StoredPredRow[];
  /** `S.pred`: ostvaren tempo radnog dela po ID-ju reda. */
  pred: Readonly<Record<string, unknown>>;
  alts: Readonly<Record<string, { pace?: number | null }>>;
  meta: Readonly<Record<string, unknown>> | null | undefined;
  currentZones: ZoneSource;
  wellness: Readonly<Record<string, WellnessRecord>> | null | undefined;
  forecast: Pick<ForecastCache, 'sati'> | null;
  trainingHour: number;
}

const clock = (sec: number | null | undefined): string =>
  sec == null || !Number.isFinite(sec) ? '—' : fmtClock(sec);
const arrOrNull = (v: unknown): unknown => (Array.isArray(v) && v.length ? v : null);

/**
 * Zahtev za model. Šalje SAMO ono što aplikacija već ima (bez novog poziva ka Strava/intervals.icu). Raspodela po zonama stiže GOTOVA
 * (`zoneUdeo`) — procente računa aplikacija, pa su brojevi u analizi ISTI kao na kartici „Po zonama"; model sam ne deli sekunde.
 */
export function buildAiPayload(i: AiPayloadInput): Record<string, unknown> {
  const { day: d, log: l } = i;
  const mainRow = predRowsForDay(i.plan, d, i.predRows)[0];
  const mainId = mainRow?.id;
  const dataDate = l.runDate || l.ts || d.date;
  const zones = zonesForRun(l as never, i.currentZones);
  const dist = zoneDistribution(l as never, i.currentZones);
  const stored = mainId != null ? i.pred[mainId] : null;
  const temp = runTemp(l, dataDate, i.forecast, i.trainingHour);
  return {
    session: {
      desc: d.desc || '',
      planPace: mainRow ? clock(effectivePace(i.alts as never, d, mainRow.pt)) : '—',
      q: mainRow ? mainRow.q : null,
      tag: d.tag,
      kind: sessKind(d, !!i.alts[d.id]),
      /* ono što je trkač SAM upisao na Stravi za taj dan */
      stravaName: l['stravaName'] || null,
      stravaDesc: l['stravaDesc'] || null
    },
    goalCtx: goalContext(i.meta),
    /* ZONE OVOG TRENINGA, ne zone naloga: kad je raspodela izračunata po granicama iz same aktivnosti, moraju stajati baš te granice. */
    hrZones: zones.zones,
    hrZonesIzvor: zones.source,
    entered: {
      workPace: mainId && stored ? clock(stored as number) : null,
      km: l.km ?? null,
      time: l.sec ? fmtClock(l.sec) : null,
      hr: l.hr ?? null,
      rpe: l['rpe'] ?? null,
      note: l['note'] || '',
      maxHr: l['maxHr'] ?? null,
      elevGain: l['elevGain'] ?? null,
      relEffort: l['relEffort'] ?? null,
      /* Temperatura NOSI IZVOR: prognoza za sat trčanja, a očitavanje sa zgloba samo kao označena rezerva (čita 2–5 °C više od vazduha). */
      temp: temp ?? null,
      decoupling: l['decoupling'] || null,
      /* Isti tempo posle loše noći nije isti trening, a bez ovoga model to ne može da zna. */
      oporavak: wellnessFor(i.wellness, dataDate),
      laps: arrOrNull(l['laps']),
      lapsIzvor: l['lapsIzvor'] || null,
      /* „6×800" kao jedna stavka — model iz toga vidi seriju kao celinu. Samo sa intervals.icu. */
      grupe: arrOrNull(l['icuGrupe']),
      icu: l['icu'] || null,
      zoneUdeo: dist ? { ukupno: dist.total, redovi: dist.rows } : null,
      perKm: arrOrNull(l['perKm'])
    }
  };
}

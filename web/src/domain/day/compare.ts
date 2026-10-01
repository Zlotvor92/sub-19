/* ISTA SESIJA RANIJE. VDOT kriva i predikcija sažimaju SVE u jedan broj, pa se iz njih ne vidi ono što trkača zanima: „isti trening kao
   pre tri nedelje — je li lakši?" Poređenje jabuka sa jabukama je direktniji dokaz napretka od bilo koje izvedene mere.

   ŠTA JE „ISTA SESIJA": isti tip I ista struktura radnog dela (6×800 i 5×1000 su oba „Intervali", ali nisu isti trening). LAGANA TRČANJA
   SE NE POREDE PO TEMPU — na laganom se ide po osećaju; poredi se PULS na tom tempu i DRIFT. Potpis laganog je POJAS DISTANCE, ne struktura.

   Čisto: stanje → model kartice. */

import { icuWorkPace, type PerKmRow } from '../activities';
import { fmtClock, fmtDayMonth, fmtNum, r1 } from '../format';
import { sessKind, type ResolvedDay } from '../plan';
import type { LogEntry } from '../state/types';
import { predRowsForDay, type StoredPredRow } from '../training/adaptation';
import { runTemp, type ForecastCache } from '../weather';
import { driftTone, type RichPart } from './cards';
import { sessionCore } from './planView';

/** Širina pojasa distance u kom se lagana trčanja porede (km). */
export const EASY_BAND_KM = 2;
/** Preko ove razlike tempa (s/km) puls više ne meri istu stvar. */
export const COMPARABLE_PACE_SEC = 10;

export interface CompareContext {
  dated: readonly ResolvedDay[];
  weeks: ReadonlyArray<{ w: number; days: readonly ResolvedDay[] }>;
  log: Readonly<Record<string, LogEntry>>;
  /** `S.pred`: ostvaren tempo radnog dela po ID-ju reda. */
  pred: Readonly<Record<string, unknown>>;
  predRows: readonly StoredPredRow[];
  alts: Readonly<Record<string, unknown>>;
  qs: Readonly<Record<string, number[]>> | undefined;
  forecast: Pick<ForecastCache, 'sati'> | null;
  trainingHour: number;
}

const num = (v: unknown): number | null =>
  v == null || v === '' || typeof v === 'boolean' || !Number.isFinite(+(v as number))
    ? null
    : +(v as number);

export const isEasy = (d: Pick<ResolvedDay, 'tag'> | null | undefined): boolean =>
  !!d && (d.tag === 'lako' || d.tag === 'lr');

/** Potpis sesije: isti potpis = isti stimulus. `null` kad se dan ne može porediti (odmor, bez strukture). */
export function sessionSignature(
  d: ResolvedDay,
  ctx: Pick<CompareContext, 'alts' | 'qs'>
): string | null {
  if (!d || d.rest) return null;
  const kind = sessKind(d, !!ctx.alts[d.id]);
  if (isEasy(d)) {
    const km = +(d.km as number);
    if (!(km > 0)) return null;
    return `${kind}|~${Math.round(km / EASY_BAND_KM) * EASY_BAND_KM}`;
  }
  if (d.tag !== 'int' && d.tag !== 'tempo') return null;
  const ses = d.session as
    | { type?: string; reps?: number | number[]; repM?: number; qKm?: number; repSec?: number }
    | undefined;
  let structure: string | null = null;
  if (ses) {
    if (ses.type === 'int' && ses.reps && ses.repM)
      structure = `${Number(ses.reps)}x${Number(ses.repM)}`;
    else if (ses.type === 'pyramid' && Array.isArray(ses.reps)) structure = ses.reps.join('-');
    else if (ses.type === 'tempo' && ses.qKm) structure = `t${r1(ses.qKm)}`;
    else if (ses.type === 'fartlek' && ses.reps)
      structure = `f${Number(ses.reps)}x${Number(ses.repSec)}`;
  }
  if (!structure) {
    const spec = ctx.qs?.[d.id];
    if (Array.isArray(spec) && spec.length) structure = spec.join('-');
  }
  if (!structure) return null;
  return `${kind}|${structure}`;
}

export interface DayMeasures {
  tempo: number | null;
  gap: number | null;
  hr: number | null;
  drift: number | null;
  temp: number | null;
  tempSource: 'om' | 'sat' | null;
}

const NO_MEASURES: DayMeasures = {
  tempo: null,
  gap: null,
  hr: null,
  drift: null,
  temp: null,
  tempSource: null
};

type Lap = { avgHr?: unknown; gapSec?: unknown; distM?: unknown };

/**
 * Merenja jednog odrađenog dana u obliku u kom se porede — jedno mesto za OBE vrste dana, da današnji broj i onaj od pre tri nedelje
 * nikad ne dođu iz dva računa. Kvalitetna sesija: tempo RADNOG dela (isti broj koji ide u VDOT). Lagano: prosečan tempo celog trčanja.
 */
export function dayMeasures(
  d: ResolvedDay,
  l: LogEntry | undefined,
  ctx: CompareContext
): DayMeasures | null {
  if (!d || !l) return null;
  const easy = isEasy(d);
  let tempo: number | null = null;
  if (easy) {
    const km = num(l.km);
    const sec = num(l.sec);
    if (km != null && sec != null && km > 0 && sec > 0) tempo = Math.round(sec / km);
  } else {
    const rowId = predRowsForDay({ weeks: ctx.weeks as never }, d, ctx.predRows)[0]?.id;
    const stored = rowId != null ? ctx.pred[rowId] : null;
    tempo =
      rowId != null && stored != null
        ? (stored as number)
        : Array.isArray(l['laps']) && l['laps'].length
          ? icuWorkPace(l['laps'] as never, ctx.qs?.[d.id])
          : null;
  }
  const laps: unknown[] = Array.isArray(l['laps']) ? (l['laps'] as unknown[]) : [];
  const gaps = (laps as Array<Lap | null>).filter(
    (y): y is Lap => !!y && +(y.gapSec as number) > 0 && +(y.distM as number) > 0
  );
  const gap =
    !easy && gaps.length && gaps.length === laps.length
      ? Math.round(
          gaps.reduce((a, y) => a + (+(y.gapSec as number) * +(y.distM as number)) / 1000, 0) /
            (gaps.reduce((a, y) => a + +(y.distM as number), 0) / 1000)
        )
      : null;
  const hrs = (laps as Array<Lap | null>)
    .map((y) => (y ? y.avgHr : undefined))
    .filter((y) => num(y) != null)
    .map(Number);
  const hrAvg = num(l.hr);
  const hr =
    !easy && hrs.length
      ? Math.round(hrs.reduce((a, b) => a + b, 0) / hrs.length)
      : hrAvg != null && hrAvg > 0
        ? Math.round(hrAvg)
        : null;
  const dec = l['decoupling'];
  const dr = dec && typeof dec === 'object' ? num((dec as { n?: unknown }).n) : null;
  const t = runTemp(l, l.runDate || l.ts || d.date, ctx.forecast, ctx.trainingHour);
  return {
    tempo,
    gap,
    hr,
    drift: dr != null ? Math.round(dr * 10) / 10 : null,
    temp: t ? t.temp : null,
    tempSource: t ? t.izvor : null
  };
}

export interface EarlierSession extends DayMeasures {
  day: ResolvedDay;
  date: string;
}

/** Ranije odrađene sesije istog potpisa, najnovija prva (najviše `maxN`). */
export function earlierSessions(d: ResolvedDay, ctx: CompareContext, maxN = 3): EarlierSession[] {
  const signature = sessionSignature(d, ctx);
  if (!signature) return [];
  const easy = isEasy(d);
  const out: EarlierSession[] = [];
  for (const x of ctx.dated) {
    if (x.id === d.id) continue;
    if (d.date && x.date && x.date >= d.date) continue; // samo RANIJE
    if (sessionSignature(x, ctx) !== signature) continue;
    const l = ctx.log[x.id];
    if (!l || l.status !== 'done') continue;
    const m = dayMeasures(x, l, ctx);
    if (!m) continue;
    /* Kvalitetnoj sesiji je tempo ceo smisao poređenja; laganom NIJE — ono se poredi po pulsu i driftu. */
    if (easy ? m.hr == null && m.drift == null : !m.tempo) continue;
    out.push({ ...m, day: x, date: l.runDate || l.ts || x.date });
  }
  out.sort((a, b) => (a.date < b.date ? 1 : -1));
  return out.slice(0, maxN || 3);
}

/** Objašnjenje odakle temperature u redovima — samo kad ima šta da se objasni (razlika u izvoru ne sme da izgleda kao razlika u vremenu). */
export function tempSourceNote(
  rows: ReadonlyArray<Pick<DayMeasures, 'temp' | 'tempSource'> | null | undefined>
): string {
  const sources = rows.filter((x) => x && x.temp != null).map((x) => (x as DayMeasures).tempSource);
  if (!sources.length) return '';
  const om = sources.includes('om');
  const watch = sources.includes('sat');
  if (om && watch)
    return 'Temperatura je iz prognoze za sat trčanja; kod starijih trčanja, van prozora prognoze, stoji očitavanje sa sata — ono je 2-5 °C više jer sat stoji uz kožu, pa se ta dva broja ne porede međusobno.';
  if (watch)
    return 'Temperatura je očitavanje sa sata (prognoze za te sate više nema). Sat stoji uz kožu, pa čita 2-5 °C više od vazduha — koristi je kao grubu naznaku.';
  return 'Temperatura je iz prognoze za sat u kom se trčalo, ne sa sata.';
}

const b = (text: string, tone?: RichPart['tone']): RichPart => ({
  tag: 'b',
  text,
  ...(tone ? { tone } : {})
});
const small = (text: string, tone?: RichPart['tone']): RichPart => ({
  tag: 'small',
  text,
  ...(tone ? { tone } : {})
});
const text = (t: string): RichPart => ({ tag: 'text', text: t });

export interface CompareRow {
  /** Datum trčanja (`DD.MM.`). */
  label: string;
  /** Tempo i temperatura pored datuma (samo za lagana). */
  sub: string | null;
  parts: RichPart[];
}
export interface CompareCardModel {
  title: 'Ista sesija ranije' | 'Slično lagano ranije';
  extra: string;
  rows: CompareRow[];
  note: string;
}

/** Razlika sa znakom i bojom. `comparable === false` boji neutralno (poređenje ne važi). */
function difference(
  now: number | null,
  before: number | null,
  dec: number,
  comparable: boolean | undefined
): RichPart[] {
  if (now == null || before == null) return [];
  const f = 10 ** dec;
  const diff = Math.round((now - before) * f) / f;
  const tone: RichPart['tone'] =
    comparable === false ? 'muted' : diff < 0 ? 'green' : diff > 0 ? 'pink' : 'muted';
  const sign = diff < 0 ? '−' : diff > 0 ? '+' : '±';
  return [text(' '), small(`${sign}${fmtNum(Math.abs(diff), dec)}`, tone)];
}

/** Kartica poređenja za današnji dan; `null` kad nema ranijih istih sesija. */
export function sessionCompareCard(d: ResolvedDay, ctx: CompareContext): CompareCardModel | null {
  const earlier = earlierSessions(d, ctx, 3);
  if (!earlier.length) return null;
  const now = dayMeasures(d, ctx.log[d.id] ?? {}, ctx) ?? NO_MEASURES;
  if (isEasy(d)) return easyCard(d, earlier, now, ctx);
  const rows = earlier.map((x): CompareRow => {
    /* Razlika samo kad postoje OBA broja — „−4 s/km" naspram ničega je izmišljen napredak. */
    const diff = now.tempo && x.tempo ? now.tempo - x.tempo : null;
    const tone: RichPart['tone'] =
      diff == null ? 'muted' : diff < -1 ? 'green' : diff > 1 ? 'pink' : 'muted';
    const sign =
      diff == null ? '' : `${diff < 0 ? '−' : diff > 0 ? '+' : '±'}${Math.abs(diff)} s/km`;
    const parts: RichPart[] = [b(x.tempo != null ? fmtClock(x.tempo) : '—')];
    if (x.gap != null && x.tempo != null && Math.abs(x.gap - x.tempo) > 2)
      parts.push(text(' '), small(`GAP ${fmtClock(x.gap)}`));
    if (x.hr != null) parts.push(text(' '), small(`${x.hr} bpm`));
    if (x.temp != null) parts.push(text(' '), small(`${x.temp}°C`));
    if (sign) parts.push(text(' '), small(sign, tone));
    return { label: fmtDayMonth(x.date), sub: null, parts };
  });
  const note = [
    'Poredi se ostvaren tempo RADNOG dela, ne prosek celog trčanja.',
    now.tempo
      ? 'Razlika je u odnosu na današnji.'
      : 'Kad uneseš današnji tempo, prikazaće se i razlika.',
    tempSourceNote([now, ...earlier])
  ]
    .filter(Boolean)
    .join(' ');
  return { title: 'Ista sesija ranije', extra: sessionCore(d), rows, note };
}

function easyCard(
  d: ResolvedDay,
  earlier: EarlierSession[],
  now: DayMeasures,
  _ctx: CompareContext
): CompareCardModel | null {
  /* Bez ijednog pulsa i bez ijednog drifta ostaje samo poređenje tempa laganih trčanja — a to je tačno ono što ništa ne znači. */
  if (![now, ...earlier].some((x) => x.hr != null || x.drift != null)) return null;
  const rows = earlier.map((x): CompareRow => {
    const comparable =
      now.tempo != null && x.tempo != null
        ? Math.abs(now.tempo - x.tempo) <= COMPARABLE_PACE_SEC
        : false;
    const sub = [
      x.tempo != null ? `${fmtClock(x.tempo)}/km` : null,
      x.temp != null ? `${fmtNum(x.temp, 0)} °C` : null
    ]
      .filter(Boolean)
      .join(' · ');
    const parts: RichPart[] =
      x.hr != null
        ? [b(String(x.hr)), text(' '), small('bpm'), ...difference(now.hr, x.hr, 0, comparable)]
        : [small('bez pulsa')];
    /* Drift je DRUGI po važnosti broj u redu. Razlika u driftu se boji UVEK: drift je već odnos tempo/puls. */
    if (x.drift != null)
      parts.push(
        text(' '),
        {
          tag: 'sec',
          text: '· drift ',
          children: [b(`${x.drift > 0 ? '+' : ''}${fmtNum(x.drift, 1)} %`, driftTone(x.drift))]
        },
        ...difference(now.drift, x.drift, 1, true)
      );
    return { label: fmtDayMonth(x.date), sub: sub || null, parts };
  });
  const band = Math.round((+(d.km as number) || 0) / EASY_BAND_KM) * EASY_BAND_KM;
  const notes = [
    'Na laganom se ne poredi tempo — po njemu se ide po osećaju. Poredi se PULS na tom tempu i drift (koliko odnos tempo/puls padne u drugoj polovini). Niži puls i manji drift pri sličnom tempu znače jaču aerobnu bazu.',
    `Razlika u pulsu se boji samo kad je tempo u granici od ${COMPARABLE_PACE_SEC} s/km — inače meri brzinu, ne formu. Vrućina diže puls, zato temperatura stoji uz tempo.`,
    tempSourceNote([now, ...earlier])
  ];
  if (now.hr == null && now.drift == null)
    notes.push('Kad uneseš prosečan puls za danas, prikazaće se i razlika.');
  return {
    title: 'Slično lagano ranije',
    extra: `${sessKind(d, !!_ctx.alts[d.id])} · ~${band} km`,
    rows,
    note: notes.filter(Boolean).join(' ')
  };
}

export type { PerKmRow };

/* KARTICE DANA koje prikazuju ono što je stiglo SAMO od sata i iz oporavka: „Sa sata", „Po zonama", „Jutros". Čisto: zapis → redovi.

   Vrednosti dolaze i iz uvezenog backupa, gde polje ume da bude string ili null — zato sve prolazi kroz `num` (BROJ, ne „nije null"):
   bez toga bi na kartici pisalo „kadenca NaN spm". */

import { fmtNum } from '../format';
import { deviationTone, sleepTone, wellnessFor, type Tone } from '../recovery/view';
import type { WellnessRecord } from '../state/types';
import {
  driftLevel,
  missingZonesReason,
  zoneDistribution,
  zoneForHr,
  type ZoneSource
} from '../zones';
import { runTemp, type ForecastCache } from '../weather';

/** Deo reda: `b` (broj), `small` (dopuna), `text` (obično). `tone` boji samo ono što stvarno nosi značenje. */
export interface RichPart {
  tag: 'b' | 'small' | 'text';
  text: string;
  tone?: Tone;
}
export interface CardRow {
  label: string;
  parts: RichPart[];
}

const num = (v: unknown): number | null =>
  v == null || v === '' || typeof v === 'boolean' || !Number.isFinite(+(v as number))
    ? null
    : +(v as number);

const b = (text: string, tone?: Tone): RichPart => ({ tag: 'b', text, ...(tone ? { tone } : {}) });
const small = (text: string): RichPart => ({ tag: 'small', text });
const text = (t: string): RichPart => ({ tag: 'text', text: t });

/** Boja drifta pulsa — ista skala gde god se broj pojavi (zdrava baza < 5 %, granično 5–8 %, > 8 %). */
export const driftTone = (n: number): Tone => {
  const l = driftLevel(n);
  return l === 'good' ? 'green' : l === 'warn' ? 'amber' : 'red';
};

export interface WatchRowsContext {
  /** Zone koje važe DANAS (za oznaku zone uz maksimalan puls). */
  zones: ZoneSource;
  forecast: Pick<ForecastCache, 'sati'> | null;
  trainingHour: number;
}

type WatchLog = Record<string, unknown> & {
  decoupling?: unknown;
  satTrk?: unknown;
  sec?: unknown;
  temp?: unknown;
  icu?: unknown;
};

/** „Sa sata": samo ono što je sat izmerio. Prazna lista kad nema nijednog podatka — prazan red je samo šum. */
export function watchRows(
  log: WatchLog | null | undefined,
  date: string,
  ctx: WatchRowsContext
): CardRow[] {
  if (!log) return [];
  const rows: CardRow[] = [];
  const cadence = num(log['cadence']);
  if (cadence != null && cadence > 0)
    rows.push({ label: 'kadenca', parts: [b(String(Math.round(cadence))), text(' spm')] });
  const maxHr = num(log['maxHr']);
  if (maxHr != null && maxHr > 0) {
    const z = zoneForHr(maxHr, ctx.zones.zones);
    rows.push({
      label: 'maks. puls',
      parts: [b(String(Math.round(maxHr))), ...(z ? [text(' '), small(`Z${z.n}`)] : [])]
    });
  }
  const gain = num(log['elevGain']);
  if (gain != null && gain > 0)
    rows.push({ label: 'uspon', parts: [b(String(Math.round(gain))), text(' m')] });
  /* Temperatura NOSI IZVOR: vrednost je po pravilu iz prognoze za sat trčanja, a ne sa sata. Zglobno očitavanje je 2–5 °C više od
     vazduha i ne sme da se pročita kao temperatura vazduha. */
  const t = runTemp(log, date, ctx.forecast, ctx.trainingHour);
  if (t) {
    const parts: RichPart[] = [b(String(Math.round(t.temp))), text(' °C')];
    if (t.osecaj != null && Math.abs(t.osecaj - t.temp) >= 1)
      parts.push(text(' '), small(`oseća se ${Math.round(t.osecaj)} °C`));
    parts.push(text(' '), small(t.izvor === 'om' ? `prognoza u ${t.sat}:00` : 'sa sata'));
    rows.push({ label: 'temperatura', parts });
  }
  const effort = num(log['relEffort']);
  if (effort != null && effort > 0)
    rows.push({ label: 'Strava napor', parts: [b(String(Math.round(effort)))] });
  /* Drift pulsa se računa samo kad je tempo bio ravnomeran (±3 %) — inače poređenje ne važi i prikazuje se razlog umesto broja. */
  const dec = log.decoupling;
  if (dec && typeof dec === 'object') {
    const n = num((dec as { n?: unknown }).n);
    const reason = (dec as { razlog?: unknown }).razlog;
    if (n != null)
      rows.push({
        label: 'drift pulsa',
        parts: [b(`${n > 0 ? '+' : ''}${fmtNum(n, 1)} %`, driftTone(n))]
      });
    else if (typeof reason === 'string' && reason)
      rows.push({ label: 'drift pulsa', parts: [small(reason)] });
  }
  return rows;
}

/** „Jutros": HRV, puls u miru, san, svežina za dan trčanja (sa sopstvenom osnovom HRV-a i pulsa). */
export function morningRows(
  wellness: Readonly<Record<string, WellnessRecord>> | null | undefined,
  date: string
): CardRow[] {
  const o = wellnessFor(wellness, date);
  if (!o) return [];
  const rows: CardRow[] = [];
  /* Sve kroz fmtNum: icu vraća svežinu i odstupanja u punoj preciznosti, a i jedna decimala mora imati srpski zarez. */
  const f = (v: unknown): string =>
    v == null || !Number.isFinite(+(v as number)) ? '—' : fmtNum(+(v as number), 1);
  const hrv = o.hrv;
  if (hrv != null) {
    const dev = o.hrvOdstupanje;
    rows.push({
      label: 'HRV',
      parts: [
        b(f(hrv), deviationTone(dev ?? null)),
        ...(dev != null ? [text(' '), small(`${dev >= 0 ? '+' : ''}${f(dev)} %`)] : [])
      ]
    });
  }
  const rhr = o.pulsUMiru;
  if (rhr != null) {
    const dev = o.pulsOdstupanje;
    rows.push({
      label: 'puls u miru',
      parts: [
        b(f(rhr)),
        ...(dev != null ? [text(' '), small(`${dev >= 0 ? '+' : ''}${f(dev)}`)] : [])
      ]
    });
  }
  const sleep = o.sanH;
  if (sleep != null) rows.push({ label: 'san', parts: [b(`${f(sleep)} h`, sleepTone(sleep))] });
  const fresh = o.svezina;
  if (fresh != null) rows.push({ label: 'svežina', parts: [b(f(fresh))] });
  return rows;
}

export interface ZonesCardModel {
  /** „puls · ukupno 45 min" ili „nema podatka". */
  extra: string;
  rows: Array<{ n: number; name: string | null; pct: number; minutes: number }>;
  /** Kad nema raspodele: razlog umesto praznog mesta. */
  reason: string | null;
  note: string;
}

export interface ZonesCardContext {
  current: ZoneSource;
  icuConnected: boolean;
  zoneError: string | null;
}

/**
 * „Po zonama": vreme po zonama pulsa sa intervals.icu. Bez raspodele kartica stoji SAMO kad ima razlog koji vredi izgovoriti.
 * Granice nisu uvek iste kao u Podešavanjima (raspodela se računa po granicama koje su stigle uz sam trening) — to se kaže.
 */
export function zonesCard(
  log: (Record<string, unknown> & { lock?: unknown; icu?: unknown }) | null | undefined,
  ctx: ZonesCardContext
): ZonesCardModel | null {
  const dist = zoneDistribution(log as never, ctx.current);
  if (!dist) {
    const reason = missingZonesReason(log as never, {
      icuConnected: ctx.icuConnected,
      current: ctx.current,
      zoneError: ctx.zoneError
    });
    return reason ? { extra: 'nema podatka', rows: [], reason, note: '' } : null;
  }
  const visible = dist.rows.filter((r) => r.sec > 0);
  if (!visible.length) return null;
  const same =
    ctx.current.source === 'icu' &&
    Array.isArray(ctx.current.zones) &&
    ctx.current.zones.length === dist.zones.length;
  const from = same
    ? 'po tvojim zonama za trčanje (Podešavanja → Tvoje zone pulsa)'
    : 'po granicama zona koje su stigle uz sam taj trening sa intervals.icu — zato mogu da se razlikuju od spiska u Podešavanjima';
  return {
    extra: `puls · ukupno ${Math.round(dist.total / 60)} min`,
    rows: visible.map((r) => ({
      n: r.n,
      name: r.ime,
      pct: r.pct,
      minutes: Math.round(r.sec / 60)
    })),
    reason: null,
    note: `Vreme po zonama pulsa sa intervals.icu, ${from}. Isti brojevi i iste granice idu i u AI analizu.`
  };
}

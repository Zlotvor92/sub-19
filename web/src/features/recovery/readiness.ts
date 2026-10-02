/* STANJE DANAS: jedan odgovor („da li smem da treniram po planu?") sastavljen od signala koje aplikacija VEĆ računa — bol, odnos opterećenja
   (ACWR), HRV, puls u miru, san, svežina. Ovde nema novog pravila ni praga: svaki signal zadržava svoju granicu iz domena, a ukupnu
   ocenu određuje NAJLOŠIJI signal (nema „skora" koji meša nepovezane stvari). Savet „šta da radiš" postoji samo tamo gde ga aplikacija
   već nosi u svom tekstu; za ostalo se ništa ne izmišlja.
   Jutarnji zapis stariji od jednog dana ne ulazi u ocenu: jučerašnji HRV ne govori o današnjem stanju. */

import { diffDays, type IsoDate } from '../../domain/date';
import { fmtDayMonth, fmtKm, fmtNum } from '../../domain/format';
import {
  ACWR_MAX,
  ACWR_RETURN,
  acwrBand,
  acwrText,
  deviationTone,
  freshnessTone,
  sleepTone,
  wellnessFor,
  wellnessSeries,
  type Acwr,
  type AcwrBand,
  type PainStatus,
  type Tone
} from '../../domain/recovery';
import type { WellnessRecord } from '../../domain/state';

export type SignalKey = 'bol' | 'opterecenje' | 'hrv' | 'puls' | 'san' | 'svezina' | 'zapis';

export interface Signal {
  key: SignalKey;
  /** Naslov reda („Opterećenje"). */
  label: string;
  /** Isto, za rečenicu („opterećenje"). */
  short: string;
  /** Izmerena vrednost; `null` kad signal nema jednu brojku (bol). */
  value: string | null;
  /** Stanje rečima — boja nikad ne stoji sama. */
  state: string;
  tone: Tone;
  /** Podatak uz vrednost („akutno 32 km / hronično 28 km"). */
  note: string | null;
  /** Šta ovo znači — jedna rečenica. */
  meaning: string;
  /** Šta da radiš; samo gde aplikacija već ima to pravilo. */
  action: string | null;
  /** Reč za naslov kad ovaj signal odlučuje. */
  word: string;
}

export interface Readiness {
  tone: Tone;
  word: string;
  why: string;
  action: string | null;
  /** Od najlošijeg ka najboljem (u istom stanju zadržan redosled). */
  signals: Signal[];
  /** Signali kojih nema (npr. uređaj nije povezan). */
  missing: string[];
}

const RANK: Readonly<Record<Tone, number>> = { red: 3, amber: 2, green: 1, neutral: 0 };

/** Objašnjenje pojasa opterećenja (isti tekst koristi i kartica „Opterećenje"). */
export function loadMeaning(band: AcwrBand): string {
  const lo = acwrText(ACWR_RETURN);
  const hi = acwrText(ACWR_MAX);
  return {
    low: `Ispod bezbednog pojasa (${lo}–${hi}). Ako ovo nije deload nedelja, obim je pao ispod onoga na šta si navikao.`,
    ok: `U bezbednom pojasu (${lo}–${hi}) — obim raste onoliko koliko telo stiže da podnese.`,
    high: `Iznad gornje ivice pojasa (${hi}). Još nije opasno, ali sledeća nedelja ne bi smela da bude veća od ove.`,
    danger: 'Preko 1,5 — u tom pojasu rizik od povrede naglo raste. Skrati sledeću nedelju.'
  }[band];
}

const BAND_STATE: Readonly<Record<AcwrBand, string>> = {
  low: 'Nizak',
  ok: 'U pojasu',
  high: 'Visok',
  danger: 'Opasno visok'
};
const BAND_TONE: Readonly<Record<AcwrBand, Tone>> = {
  low: 'amber',
  ok: 'green',
  high: 'amber',
  danger: 'red'
};
const BAND_ACTION: Readonly<Record<AcwrBand, string | null>> = {
  low: null,
  ok: null,
  high: 'Sledeća nedelja ne sme da bude veća od ove.',
  danger: 'Skrati sledeću nedelju.'
};

const fin = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const n0 = (x: number): string => fmtNum(x, 0);
const n1 = (x: number): string => fmtNum(x, 1);
const signed1 = (x: number): string => `${x > 0 ? '+' : x < 0 ? '−' : ''}${fmtNum(Math.abs(x), 1)}`;

/** Tekst stanja bola nosi i razlog i savet u jednoj rečenici („… — zakaži pregled." / „… Prati i smanji ako raste."): ovde se razdvajaju. */
export function splitAdvice(s: string): { meaning: string; action: string | null } {
  const dash = s.indexOf(' — ');
  if (dash > 0) {
    const rest = s.slice(dash + 3);
    return {
      meaning: `${s.slice(0, dash)}.`,
      action: rest.charAt(0).toUpperCase() + rest.slice(1)
    };
  }
  const dot = s.indexOf('. ');
  if (dot > 0) return { meaning: s.slice(0, dot + 1), action: s.slice(dot + 2) };
  return { meaning: s, action: null };
}

function painSignal(status: PainStatus): Signal {
  const tone: Tone = status.cls === 'stop' ? 'red' : status.cls === 'warn' ? 'amber' : 'green';
  const adv = tone === 'green' ? { meaning: status.s, action: null } : splitAdvice(status.s);
  return {
    key: 'bol',
    label: 'Bol',
    short: 'bol',
    value: null,
    state: status.t,
    tone,
    note: null,
    meaning: adv.meaning,
    action: adv.action,
    word: tone === 'red' ? (status.t === 'FIZIJATAR' ? 'Fizijatar' : 'Stani') : 'Pazi'
  };
}

function loadSignal(now: Acwr): Signal {
  if (now.ratio == null || now.chronic == null)
    return {
      key: 'opterecenje',
      label: 'Opterećenje',
      short: 'opterećenje',
      value: null,
      state: 'Nema podataka',
      tone: 'neutral',
      note: `akutno ${fmtKm(now.acute)} km`,
      meaning: 'Odnos se računa kad prođe bar jedna nedelja plana sa unetim trčanjem.',
      action: null,
      word: 'Pazi'
    };
  const band = acwrBand(now.ratio);
  return {
    key: 'opterecenje',
    label: 'Opterećenje',
    short: 'opterećenje',
    value: acwrText(now.ratio),
    state: BAND_STATE[band],
    tone: BAND_TONE[band],
    note: `akutno ${fmtKm(now.acute)} km / hronično ${fmtKm(now.chronic)} km`,
    meaning: loadMeaning(band),
    action: BAND_ACTION[band],
    word: band === 'danger' ? 'Skrati' : 'Pazi'
  };
}

/** Signali iz jutarnjeg zapisa. `includeStale`: kartice sa detaljima pokazuju i stari zapis (sa datumom); ocena stanja ga ne koristi. */
export function wellnessSignals(
  wellness: Readonly<Record<string, WellnessRecord>>,
  today: IsoDate,
  includeStale = false
): { signals: Signal[]; missing: string[] } {
  const series = wellnessSeries(wellness, 90);
  const last = series[series.length - 1];
  if (!last) return { signals: [], missing: ['HRV', 'puls u miru', 'san'] };
  const age = diffDays(last.datum as IsoDate, today);
  if (age > 1 && !includeStale)
    return {
      signals: [
        {
          key: 'zapis',
          label: 'Jutarnji zapis',
          short: 'jutarnji zapis',
          value: null,
          state: 'Star zapis',
          tone: 'neutral',
          note: `poslednji ${fmtDayMonth(last.datum)}`,
          meaning: 'Jutarnji zapis je stariji od jednog dana, pa ne ulazi u današnju ocenu.',
          action: null,
          word: 'Pazi'
        }
      ],
      missing: []
    };
  const o = wellnessFor(wellness, last.datum) ?? last;
  const out: Signal[] = [];
  const dev = (o as { hrvOdstupanje?: number }).hrvOdstupanje;
  const base = (o as { hrvBaza7?: number }).hrvBaza7;
  if (fin(o.hrv)) {
    const tone = deviationTone(dev);
    out.push({
      key: 'hrv',
      label: 'HRV',
      short: 'HRV',
      value: n1(o.hrv),
      state: {
        green: 'U granicama',
        amber: 'Ispod osnove',
        red: 'Daleko ispod',
        neutral: 'Nema osnove'
      }[tone],
      tone,
      note: fin(dev)
        ? `${signed1(dev)}% od osnove ${fin(base) ? n1(base) : '—'}`
        : 'osnova traži bar 3 dana',
      meaning:
        tone === 'green'
          ? 'HRV je u granicama tvoje sedmodnevne osnove.'
          : tone === 'neutral'
            ? 'Bez sedmodnevne osnove HRV ne govori ništa.'
            : 'HRV je ispod tvoje sedmodnevne osnove: oporavak zaostaje.',
      action: tone === 'red' ? 'Oporavak zaostaje: lakši dan.' : null,
      word: 'Olakšaj'
    });
  }
  const pdev = (o as { pulsOdstupanje?: number }).pulsOdstupanje;
  const pbase = (o as { pulsBaza7?: number }).pulsBaza7;
  if (fin(o.pulsUMiru)) {
    /* Odstupanje je u OTKUCAJIMA, a `deviationTone` je pisan za procente, pa se množi sa 2 (+2,5 otkucaja je žuta, +5 crvena). */
    const tone: Tone = fin(pdev) ? deviationTone(pdev * 2, true) : 'neutral';
    out.push({
      key: 'puls',
      label: 'Puls u miru',
      short: 'puls u miru',
      value: n0(o.pulsUMiru),
      state: {
        green: 'U granicama',
        amber: 'Iznad osnove',
        red: 'Daleko iznad',
        neutral: 'Nema osnove'
      }[tone],
      tone,
      note: fin(pdev)
        ? `${signed1(pdev)} od osnove ${fin(pbase) ? n1(pbase) : '—'}`
        : 'osnova traži bar 3 dana',
      meaning:
        tone === 'green'
          ? 'Puls u miru je u granicama tvoje osnove.'
          : tone === 'neutral'
            ? 'Bez sedmodnevne osnove puls u miru ne govori ništa.'
            : 'Puls u miru je iznad tvoje osnove; niže je bolje.',
      action: tone === 'red' ? 'Porast od 5+ otkucaja: ako si i umoran, olakšaj dan.' : null,
      word: 'Olakšaj'
    });
  }
  if (fin(o.sanH)) {
    const tone = sleepTone(o.sanH);
    out.push({
      key: 'san',
      label: 'San',
      short: 'san',
      value: `${n1(o.sanH)} h`,
      state: { green: 'Dovoljno', amber: 'Kratak', red: 'Vrlo kratak', neutral: '' }[tone],
      tone,
      note: fin(o.sanOcena) ? `ocena ${n1(o.sanOcena)}` : null,
      meaning:
        tone === 'green'
          ? 'Sedam sati ili više.'
          : tone === 'amber'
            ? 'Manje od sedam sati.'
            : 'Manje od šest sati.',
      action: null,
      word: 'Pazi'
    });
  }
  if (fin(o.svezina)) {
    const tone = freshnessTone(o.svezina);
    out.push({
      key: 'svezina',
      label: 'Svežina',
      short: 'svežina',
      value: n0(o.svezina),
      state: { green: 'Odmoran', amber: 'Umor raste', red: 'Veliki umor', neutral: '' }[tone],
      tone,
      note: fin(o.ctl) && fin(o.atl) ? `forma ${n0(o.ctl)} · umor ${n0(o.atl)}` : null,
      meaning:
        tone === 'green'
          ? 'Skorašnje opterećenje nije veće od dugoročnog.'
          : 'Svežina je negativna: skorašnje opterećenje je veće od dugoročnog.',
      action: null,
      word: 'Pazi'
    });
  }
  return { signals: out, missing: [] };
}

const listOf = (xs: readonly string[]): string =>
  xs.length <= 1 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} i ${xs[xs.length - 1]}`;

export function readinessModel(input: {
  status: PainStatus;
  load: Acwr;
  wellness: Readonly<Record<string, WellnessRecord>>;
  today: IsoDate;
}): Readiness {
  const w = wellnessSignals(input.wellness, input.today);
  const all = [painSignal(input.status), loadSignal(input.load), ...w.signals];
  const signals = all
    .map((s, i) => ({ s, i }))
    .sort((a, b) => RANK[b.s.tone] - RANK[a.s.tone] || a.i - b.i)
    .map((x) => x.s);
  const top = signals[0];
  if (!top || RANK[top.tone] === 0)
    return {
      tone: 'neutral',
      word: 'Nema signala',
      why: 'Nema podataka za procenu stanja.',
      action: null,
      signals,
      missing: w.missing
    };
  if (top.tone === 'green')
    return {
      tone: 'green',
      word: 'Bez upozorenja',
      why: `U granicama: ${listOf(signals.filter((s) => s.tone === 'green').map((s) => s.short))}.`,
      action: 'Radi plan kako piše.',
      signals,
      missing: w.missing
    };
  const others = signals.filter((s) => s !== top && (s.tone === 'amber' || s.tone === 'red'));
  return {
    tone: top.tone,
    word: top.word,
    why: `${top.meaning.toLowerCase().startsWith(top.label.toLowerCase()) ? '' : `${top.label}: `}${top.meaning}${others.length ? ` Još upozorenja: ${listOf(others.map((s) => s.short))}.` : ''}`,
    action: top.action,
    signals,
    missing: w.missing
  };
}

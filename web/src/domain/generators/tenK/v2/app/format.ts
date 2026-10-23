/* 10K v2 → aplikacija: formatiranje teksta prikaznih modela (iste vrednosti kao `tenK/format`,
   posebna kopija). */

import { isIsoDate, weekdayIndex } from './date.ts';

const pad2 = (n: number): string => String(n).padStart(2, '0');

/** Sekunde → `m:ss` ili `h:mm:ss`; nevažeće vreme daje „—". */
export function fmtClock(sec: number | null | undefined): string {
  if (sec == null || !Number.isFinite(sec) || sec < 0) return '—';
  const total = Math.round(sec);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h ? `${h}:${pad2(m)}:${pad2(s)}` : `${m}:${pad2(s)}`;
}

/** Broj sa zarezom kao decimalnim znakom i bez završnih nula; nebrojevna vrednost daje „—". */
export function fmtNum(n: unknown, dec = 1): string {
  if (n == null || typeof n === 'boolean' || typeof n === 'object') return '—';
  const x = +(n as number);
  if (!Number.isFinite(x)) return '—';
  const v = (Math.round(x * 10 ** dec) / 10 ** dec).toFixed(dec);
  return (v.includes('.') ? v.replace(/\.?0+$/, '') : v).replace('.', ',');
}

export const fmtKm = (n: unknown): string => fmtNum(n, 1);

/** „07.03." iz `YYYY-MM-DD`; nevažeći datum daje „—". */
export function fmtDayMonth(iso: string | null | undefined): string {
  if (!isIsoDate(iso)) return '—';
  return `${iso.slice(8, 10)}.${iso.slice(5, 7)}.`;
}

const DOW_SHORT = ['Pon', 'Uto', 'Sre', 'Čet', 'Pet', 'Sub', 'Ned'] as const;

/** Dan u nedelji iz datuma; nevažeći datum daje „—". */
export function dowShort(iso: string | null | undefined): string {
  return isIsoDate(iso) ? (DOW_SHORT[weekdayIndex(iso)] ?? '—') : '—';
}

/** Trajanje: „45 s", „2 min", „1:30 min" (celi minuti bez sekundi). */
export function fmtDuration(sec: number): string {
  if (sec < 60) return `${Math.round(sec)} s`;
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return s ? `${m}:${pad2(s)} min` : `${m} min`;
}

/* Z2 (10K-07) — tekst jezgra kakav vidi korisnik. JEDINO mesto: napomene nedelja i plana, upozorenja, razlozi
   adaptacije i odbijanja prolaze kroz `userText` pre prikaza (app/plan.ts, app/generate.ts, app/adapt.ts,
   app/handoffTarget.ts). Plan jezgra (`tenKV2`) zadržava tehničke oznake (interno polje; validator ih čita). */

/** Interna oznaka pravila: D6, D22b, A3, H17, M7, F4a; niz „A3/A4"; „D11 ispred D7/D31". */
const LABEL = String.raw`\b(?:[DAHMF]\d{1,2}[a-z]?)\b`;
const LABELS = new RegExp(
  String.raw`${LABEL}(?:\/${LABEL})*(?:\s+ispred\s+${LABEL}(?:\/${LABEL})*)?`,
  'g'
);

/** Tekst za korisnika: bez internih oznaka (D6, A3/A4, H17, M7, pouka N, segment N), decimalni zarez, km sa najviše
 *  jednom decimalom, bez „..". */
export function userText(s: string): string {
  let t = s
    .replace(/^Pouka \d+:\s*/u, '')
    .replace(/\s*\(pouka \d+\)/giu, '')
    .replace(/,?\s*\bpouka \d+\b/giu, '')
    .replace(/,?\s*\bsegment \d+[a-z]?\b/giu, '')
    .replace(LABELS, '')
    // Ostaci zagrada i separatora posle uklanjanja oznaka.
    .replace(/\(\s*[,;:]\s*/gu, '(')
    .replace(/\s*[,;:]\s*\)/gu, ')')
    .replace(/\s*\(\s*\)/gu, '')
    .replace(/\s+([,;:.)])/gu, '$1')
    .replace(/ {2,}/gu, ' ')
    // Decimalni zarez (ne u datumima i verzijama: samo cifra.cifra van „v2.5").
    .replace(/(?<![\dv.])(\d+)\.(\d+)(?![\d.])/gu, '$1,$2')
    .replace(/\.{2,}/gu, '.')
    .trim();
  // km: najviše jedna decimala.
  t = t.replace(
    /(\d+),(\d{2,})(\s*km)/gu,
    (_, a: string, b: string, k: string) =>
      `${fmtNum(Number(`${a}.${b}`), 1).replace(/^(\d+)$/u, '$1,0')}${k}`
  );
  // Tekst koji je počinjao velikim slovom (npr. posle uklonjenog prefiksa pouke) ostaje tako.
  return /^\p{Lu}/u.test(s) ? t.charAt(0).toUpperCase() + t.slice(1) : t;
}

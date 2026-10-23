/* Maraton v2 → aplikacija: formatiranje teksta prikaznih modela (iste vrednosti kao `marathon/format`,
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

/* Z2 (MAR-09 t. 6): tekst koji vidi korisnik — bez internih oznaka politike (M7, A3/A4, „pouka N", „Uslov 8", N1…),
   decimalni zarez, km najviše 1 decimala, bez „..". Domen zadržava oznake (validator ih čita, `rule`/`code` ostaju);
   JEDINO mesto prevoda je ova funkcija, aplikacija je zove na svakom izlazu ka korisniku (plan, prilagođavanje,
   odbijanje). */
const LABEL =
  '(?:[MADHCNKOF]\\d{1,2}[a-z]?(?:/[MADHCNKOF]?\\d{1,2}[a-z]?)*|pouk[ae] \\d+[a-z]?(?: i \\d+[a-z]?)?|Uslov \\d+|Faza \\d+[a-z]?|[A-Z0-9]{1,4}-\\d+[a-z]?(?: t\\. ?\\d+)?)';
const LABEL_PART = new RegExp(
  `^(?:kao |isto kao |vidi )?${LABEL}(?:(?: ispred | i | pa | uz |, | )${LABEL})*(?: t\\. ?\\d+)?\\.?$`
);
const LABEL_TAIL = new RegExp(
  `[,;]? (?:kao )?${LABEL}(?:(?: ispred | i |, )${LABEL})*(?=[).;,]|$)`,
  'g'
);

/** Sadržaj zagrade bez delova koji su samo oznake (i golih brojeva iza njih: „pouka 37, 14"); prazno kad ne ostane
    ništa. */
function cleanParen(inner: string): string {
  const parts = inner.split(/([,;] )/);
  const kept: string[] = [];
  let dropped = false;
  for (let i = 0; i < parts.length; i += 2) {
    const p = parts[i]!.trim();
    if (p === '' || LABEL_PART.test(p) || (dropped && /^\d+[a-z]?$/.test(p))) {
      dropped = true;
      continue;
    }
    dropped = false;
    if (kept.length > 0) kept.push(parts[i - 1] ?? ', ');
    kept.push(p.replace(LABEL_TAIL, ''));
  }
  return kept.join('').trim();
}

/** Korisnički tekst iz poruke domena (Z2). */
export function userText(s: string): string {
  let t = s;
  // Zagrade bez ugnježđenih: (M8), (bol, A4; pouka 30), (plafon MP, pouka 14) → (bol), (plafon MP); zagrada
  // funkcije (max(…), min(…)) ostaje.
  for (let k = 0; k < 3; k++)
    t = t.replace(/( ?)\(([^()]*)\)/g, (m, sp: string, inner: string, at: number) => {
      if (sp === '' && at > 0 && /\p{L}/u.test(t[at - 1]!)) return m;
      const c = cleanParen(inner);
      return c === '' ? '' : `${sp}(${c})`;
    });
  t = t
    .replace(LABEL_TAIL, '')
    .replace(/\bQ1:/g, 'Prvi dan kvaliteta:')
    .replace(/\bQ2:/g, 'Drugi dan kvaliteta:')
    // Decimale: km na 1 decimalu, zarez.
    .replace(/(\d+)[.,](\d{2,})(?= km)/g, (_, a: string, b: string) =>
      fmtNum(Number(`${a}.${b}`), 1)
    )
    .replace(/(\d)\.(\d)/g, '$1,$2')
    .replace(/\.{2}(?!\.)/g, '.')
    .replace(/ {2,}/g, ' ')
    .replace(/ ([.,;:])/g, '$1')
    .replace(/[,;]([.)])/g, '$1')
    .trim();
  return t;
}

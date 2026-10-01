/* Formatiranje koje domen mora da zna jer ulazi u PERZISTIRANE opise treninga
   (`day.desc`). Ostatak formatiranja (datumi za prikaz, itd.) živi u `lib/`. */

/** Zaokruživanje na jednu decimalu — jedino zaokruživanje kilometraže u planu. */
export const r1 = (x: number): number => Math.round(x * 10) / 10;

const pad2 = (n: number): string => String(n).padStart(2, '0');

/**
 * Sekunde → `m:ss` ili `h:mm:ss`. Nevažeće vreme (null, nije konačno, negativno)
 * daje „—", nikad „NaN:NaN" (isti dogovor kao stari `fmtClock`).
 */
export function fmtClock(sec: number | null | undefined): string {
  if (sec == null || !Number.isFinite(sec) || sec < 0) return '—';
  const total = Math.round(sec);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h ? `${h}:${pad2(m)}:${pad2(s)}` : `${m}:${pad2(s)}`;
}

/** Srpski oblik množine: 1 → jedan, 2–4 (osim 12–14) → dva, ostalo → pet. */
export function pl3(n: number, jedan: string, dva: string, pet: string): string {
  const m = n % 10;
  const h = n % 100;
  if (m === 1 && h !== 11) return jedan;
  if (m >= 2 && m <= 4 && (h < 12 || h > 14)) return dva;
  return pet;
}

export const brojNedelja = (n: number): string => `${n} ${pl3(n, 'nedelja', 'nedelje', 'nedelja')}`;

/** „Polumaraton" → „polumaraton", „5K" ostaje „5K" (počinje ciframa). */
export function distUReceni(ime: string | null | undefined): string {
  const s = String(ime ?? '');
  return /^\d/.test(s) ? s : s.toLowerCase();
}

/** „07.03." — dan i mesec iz `YYYY-MM-DD`; nevažeći datum daje „—" (stari `fmtD`). */
export function fmtDayMonth(iso: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso ?? ''));
  if (!m) return '—';
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return '—';
  return `${pad2(d)}.${pad2(mo)}.`;
}

/**
 * Broj sa zarezom kao decimalnim znakom i bez završnih nula. NEBROJEVNA VREDNOST DAJE „—", NE „NaN"
 * (stari `fmtKm('abc')` je davao doslovno „NaN km" na kartici dana). Nule se skidaju SAMO iza
 * decimalne tačke: stari regex nad celim stringom je `fmtNum(10, 0)` pretvarao u „1".
 */
export function fmtNum(n: unknown, dec = 1): string {
  if (n == null || typeof n === 'boolean' || typeof n === 'object') return '—';
  const x = +(n as number);
  if (!Number.isFinite(x)) return '—';
  const v = (Math.round(x * 10 ** dec) / 10 ** dec).toFixed(dec);
  return (v.includes('.') ? v.replace(/\.?0+$/, '') : v).replace('.', ',');
}

export const fmtKm = (n: unknown): string => fmtNum(n, 1);

/** „07.03.2026." — pun datum iz `YYYY-MM-DD`; nevažeći daje „—" (stari `fmtDY`). */
export function fmtDayMonthYear(iso: string | null | undefined): string {
  const dm = fmtDayMonth(iso);
  return dm === '—' ? dm : `${dm}${String(iso).slice(0, 4)}.`;
}

/** „dan" / „dana" po poslednjoj cifri (stari `plDan`): 1 → dan, ostalo → dana (11–14 uvek dana). */
export function plDan(n: number): string {
  const m = n % 10;
  const h = n % 100;
  return m === 1 && h !== 11 ? 'dan' : 'dana';
}

/**
 * Vreme iz unosa: „4:33", „1:02:03", ili samo cifre („433" = 4:33, „4233" = 42:33, „10203" = 1:02:03; zarez i tačka
 * su dvotačka). `null` za sve što nije vreme (sekunde > 59, minuti > 59 uz sate, ≥ 100 min bez sati).
 */
export function parseTimeStr(str: unknown): number | null {
  if (!str) return null;
  const s = (typeof str === 'string' ? str : typeof str === 'number' ? String(str) : '')
    .trim()
    .replace(/[,.]/g, ':');
  if (/^\d{3,6}$/.test(s)) {
    const se = +s.slice(-2);
    if (se > 59) return null;
    const rest = s.slice(0, -2);
    if (rest.length <= 2) return +rest * 60 + se;
    const mi = +rest.slice(-2);
    if (mi > 59) return null;
    return +rest.slice(0, -2) * 3600 + mi * 60 + se;
  }
  const m = /^(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/.exec(s);
  if (!m) return null;
  let h = 0;
  let mi: number;
  let se: number;
  if (m[3] != null) {
    h = +(m[1] as string);
    mi = +(m[2] as string);
    se = +m[3];
  } else {
    mi = +(m[1] as string);
    se = +(m[2] as string);
  }
  if (se > 59 || mi > (m[3] != null ? 59 : 99)) return null;
  return h * 3600 + mi * 60 + se;
}

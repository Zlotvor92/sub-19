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

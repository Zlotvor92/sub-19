import { FIVE_K_V2_POLICY } from './policy.ts';

/* 5k-v2.11.0 (Z2): JEDINO mesto formatiranja brojeva u tekstu korisniku (naslovi treninga, napomene, upozorenja,
   razlozi): decimalni zarez, km najviše 1 decimala, trajanje oporavka m:ss. Podaci plana (km, sec) se ne menjaju. */

/** Broj sa najviše `d` decimala, decimalni zarez, bez nula na kraju (12 → „12", 9,64 → „9,6"). */
export function num(x: number, d = 1): string {
  const f = 10 ** d;
  return String(Math.round(x * f + (x >= 0 ? 1e-9 : -1e-9)) / f).replace('.', ',');
}

/** F1 (04-final): poruka „planirano manje od cilja" (napomena nedelje i upozorenje) samo kad je razlika stvarna —
 *  bar 1 km ili bar 3 % cilja, i ne kad su obe vrednosti iste posle zaokruživanja. Jedino mesto ove odluke. */
export function belowTargetShown(plannedKm: number, targetKm: number): boolean {
  const T = FIVE_K_V2_POLICY.tolerance;
  const gap = targetKm - plannedKm;
  if (kmText(plannedKm) === kmText(targetKm)) return false;
  return gap >= T.belowTargetNoticeKm - 1e-9 || gap >= targetKm * T.belowTargetNoticeShare - 1e-9;
}

/** Kilometri u tekstu: najviše 1 decimala. */
export const kmText = (x: number): string => num(x, 1);

/** Trajanje [s] kao m:ss (oporavak 240 s → „4:00"). */
export function mss(sec: number): string {
  const s = Math.round(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * Tekst korisniku (jedini format): km sa najviše 1 decimalom, ostali decimalni brojevi sa zarezom, oporavak „N s" → m:ss.
 * Idempotentno (već formatiran tekst ostaje isti), pa ga konstrukcija i izlaz smeju primeniti više puta.
 */
export function userText(s: string): string {
  return s
    .replace(/(\d+\.\d+)(?=\s*km\b)/g, (x) => kmText(Number(x)))
    .replace(/(oporav\w*) (\d+) s\b/g, (_, w: string, n: string) => `${w} ${mss(Number(n))}`)
    .replace(/(\d)\.(\d)/g, '$1,$2');
}

/** Korisnički tekst rezultata jezgra: poruke, napomene plana, cilj, izmene (naslovi i napomene nedelja su već
 *  formatirani u konstrukciji — workouts.buildWorkout, generate.construct). */
export function userResult<T>(r: T): T {
  const walk = (v: unknown, key: string): unknown => {
    if (typeof v === 'string')
      return key === 'message' || key === 'before' || key === 'after' ? userText(v) : v;
    if (Array.isArray(v))
      return (v as unknown[]).map((x) =>
        key === 'notes' && typeof x === 'string' ? userText(x) : walk(x, '')
      );
    if (v && typeof v === 'object') {
      const o: Record<string, unknown> = {};
      for (const [k, x] of Object.entries(v)) o[k] = walk(x, k);
      return o;
    }
    return v;
  };
  return walk(r, '') as T;
}

/**
 * 5k-v2.15.0 (P8 G3): upozorenja plana za trkača — isto upozorenje (isto pravilo) najviše jednom po planu: prvo sa
 * nedeljom, ostale nedelje zbirno („Slično i u nedeljama …"). Upozorenja u planu (validator, testovi) se ne menjaju;
 * JEDINO mesto ovog prikaza (app/plan.ts).
 */
export function userWarnings(
  ws: readonly { rule: string; message: string; week?: number }[],
  weekOffset = 0
): string[] {
  const groups = new Map<string, { message: string; week?: number }[]>();
  for (const w of ws) (groups.get(w.rule) ?? groups.set(w.rule, []).get(w.rule)!).push(w);
  const label = (n: number): string => String(n + weekOffset);
  const out: string[] = [];
  for (const g of groups.values()) {
    const first = g[0]!;
    if (g.length === 1) {
      out.push(first.message);
      continue;
    }
    const rest = [...new Set(g.slice(1).map((x) => x.week).filter((x): x is number => x !== undefined))];
    const list =
      rest.length <= 1
        ? rest.map(label).join('')
        : `${rest.slice(0, -1).map(label).join(', ')} i ${label(rest[rest.length - 1]!)}`;
    const msg =
      first.week === undefined
        ? first.message
        : first.message.startsWith('Nedelja ')
          ? `Nedelja ${label(first.week)} ${first.message.slice('Nedelja '.length)}`
          : `Nedelja ${label(first.week)}: ${first.message}`;
    out.push(
      rest.length > 0
        ? `${msg} Slično i u ${rest.length === 1 ? 'nedelji' : 'nedeljama'} ${list}.`
        : first.message
    );
  }
  return out;
}

/** 5k-v2.15.0 (P8 G3): preporuka uz „planirano < cilj" (lagan ≤ 0,8 × dugi) — više dana samo kad ih trkač može dodati
    (manje od najvećeg broja dana tabele); inače tvrdnja koju brojevi pokazuju. JEDINO mesto (week.ts, validator). */
export function belowTargetAdvice(days: number, maxDays: number): string {
  return days < maxDays
    ? 'za pun obim treba više dana trčanja'
    : `sa ${days} dana trčanja to je najviše što ova nedelja nosi`;
}

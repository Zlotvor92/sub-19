/* V4 ADAPTERI — OTISAK DIREKTNO IZ STAROG STANJA (SPEC § 9.2). Isti kanonski tekst kao `fingerprint(doc, facts)`
   motora, ali građen iz razrešenog starog plana (plan + `alts` + `moves` + `log`), bez `PlanDoc`-a: km iz starog
   `km`, tekst iz starog opisa, urađeno iz `log.status`, zaključano iz `log.lock`, ručno iz `alts`/`moves`.
   Test: `fingerprintLegacy(stanje) === fingerprint(adopt(stanje))` za svaki uzorak. */
import { readState } from './read';
import { isManual, kindOf, resolveDays } from './shared';

/** Km dana kako ih motor prikazuje: metri → km na 0,1 (isto zaokruživanje kao `summarize`). */
const kmText = (meters: number): string => {
  const step = 0.1;
  const km = Math.round(Math.round(meters / 1000 / step) * step * 10) / 10;
  return km.toFixed(1);
};

const flag = (on: boolean, word: string): string => (on ? word : '-');

/** `null` kad stanje ne može da se pročita (tada i `adopt` vraća `{ error }`). */
export function fingerprintLegacy(input: unknown): string | null {
  const state = readState(input);
  if ('error' in state) return null;
  const days = resolveDays(state)
    .map((r, i) => ({ r, i }))
    .sort((a, b) => (a.r.date < b.r.date ? -1 : a.r.date > b.r.date ? 1 : a.i - b.i))
    .map((e) => e.r);
  return days
    .map((r) => {
      const entry = state.log[r.day.id];
      const meters = r.rest || r.km === null ? 0 : Math.max(0, Math.round(r.km * 1000));
      return [
        r.date,
        r.rest ? 'odmor' : 'trening',
        r.rest ? '-' : kindOf(r.tag, r.mlr),
        kmText(meters),
        r.rest ? '' : (r.desc ?? ''),
        flag(entry?.['status'] === 'done', 'urađeno'),
        flag(entry?.['lock'] === true, 'zaključano'),
        flag(isManual(r), 'ručno')
      ].join(' | ');
    })
    .join('\n');
}

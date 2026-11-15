/* Kanonski zapis za poređenje sa odgovorima starog frontenda (oracle testovi). V1b: golden-master otisak v1 generatora
   (`fixtures/otisak-generatora.json`, `generatorScenarios.ts`) obrisan je zajedno sa v1 generatorima; ostaje samo
   kanonski zapis. Ne uvozi se iz produkcije. */
import { createHash } from 'node:crypto';

/**
 * Kanonski zapis: ključevi sortirani, brojevi na 3 decimale (isto kao stari `kanonski`).
 *
 * Zastavica `taper: true` na nedelji se IZOSTAVLJA: to je jedino polje koje je novi generator dodao izlazu (ENGINE_CHANGES D5), a stari
 * generator je nema — bez ovoga bi svako poređenje sa starim kodom i sa upisanim otiskom padalo samo zbog nje. Da je zastavica tačna
 * (stoji samo na nedeljama čiji opis počinje sa „Taper") proverava `domain/plan/taper.test.ts`.
 */
export function canonical(x: unknown): unknown {
  if (x === null || x === undefined) return null;
  if (typeof x === 'number') return Number.isFinite(x) ? Math.round(x * 1000) / 1000 : String(x);
  if (Array.isArray(x)) return x.map(canonical);
  if (typeof x === 'object') {
    const o: Record<string, unknown> = {};
    for (const k of Object.keys(x).sort()) {
      const v = (x as Record<string, unknown>)[k];
      if (k === 'taper' && v === true) continue;
      o[k] = canonical(v);
    }
    return o;
  }
  return x;
}

export function shaOf(plan: unknown): string {
  return createHash('sha256').update(JSON.stringify(plan)).digest('hex').slice(0, 16);
}

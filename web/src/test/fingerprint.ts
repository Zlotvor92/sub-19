/* Golden-master otisak generatora: kanonski zapis plana + SHA-256, poređeno sa upisanim fixture-om (`fixtures/otisak-generatora.json`, uzet nad starim
   generatorom APP_VERSION 282). Scenarije drži `generatorScenarios.ts`. Ne uvozi se iz produkcije. */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export type { Scenario } from './generatorScenarios';

export const FIXTURE = fileURLToPath(new URL('./fixtures/otisak-generatora.json', import.meta.url));

export interface FingerprintRow {
  sha: string;
  pregled: unknown;
}
export interface FingerprintFile {
  sat: string;
  pocetak: string;
  scenarija: number;
  ukupno: string;
  redovi: Record<string, FingerprintRow>;
}

export function loadFingerprintFile(): FingerprintFile | null {
  if (!existsSync(FIXTURE)) return null;
  return JSON.parse(readFileSync(FIXTURE, 'utf8')) as FingerprintFile;
}

/** Jedan scenario = jedan red (diff u kom se vidi GDE se plan pomerio; v. komentar u `uzmiOtisak` starog alata). */
export function writeFingerprintFile(f: FingerprintFile): void {
  const rows = Object.keys(f.redovi)
    .sort()
    .map((k) => `    ${JSON.stringify(k)}: ${JSON.stringify(f.redovi[k])}`)
    .join(',\n');
  const text =
    '{\n' +
    `  "sat": ${JSON.stringify(f.sat)},\n` +
    `  "pocetak": ${JSON.stringify(f.pocetak)},\n` +
    `  "scenarija": ${f.scenarija},\n` +
    `  "ukupno": ${JSON.stringify(f.ukupno)},\n` +
    `  "redovi": {\n${rows}\n  }\n}\n`;
  writeFileSync(FIXTURE, text);
}

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

import type { StravaSyncResult } from './stravaSync';

/** Poruka posle ručne sinhronizacije. */
export function syncMessage(r: StravaSyncResult | { ok: false; error: string }): string {
  return r.ok
    ? `Sinhronizacija gotova.\nAžurirano trčanja: ${r.imported}\nUpisano tempa u Predikciju: ${r.paces}${r.moved ? `\nAutomatski pomereno (odrađeno drugog dana nego što plan kaže): ${r.moved}` : ''}`
    : `Sync nije uspeo: ${r.error}`;
}

/* V4 · UPIS PLANA KAO RADNJA (F8 § 6.3, INTEGRACIJA.md § 2, korak 6).
   Radnja je čista funkcija „trenutni plan → nov plan" (premeštanje, prihvaćen događaj, automatski korak…). Upis:
     1. učitaj red (doc, rev, otisak);
     2. primeni radnju; ako je otisak isti kao na serveru — nema šta da se piše (isti doc sa dva uređaja NIJE sukob);
     3. uslovni upis po `rev`; na sukob → nazad na 1 (radnja se ponovo primenjuje nad novim planom), najviše `tries` puta.
   Mreža pala usred upisa: ishod `retryable`; ako je server upis ipak primio, ponovni pokušaj vidi isti otisak i
   ništa ne piše dvaput. Odjavljen korisnik: ništa se ne šalje. */
import type { PlanDoc } from '../../domain/v4/engine';
import type { PlanApi, PlanRow } from './planApi';
import type { V4Failure } from './rest';

/** Koliko prethodnih verzija plana ostaje u `plan_v4_verzija` (odluka vlasnika 15. 11. 2026). */
export const VERSIONS_KEPT = 3;

export type PlanAction = (current: PlanDoc | null) => { doc: PlanDoc; otisak: string } | null;

export type CommitResult =
  | { ok: true; row: PlanRow | null; wrote: boolean; tries: number }
  | { ok: false; reason: 'sukob'; tries: number }
  | (V4Failure & { tries: number });

export async function commitAction(
  api: PlanApi,
  action: PlanAction,
  deviceId: string,
  tries = 3
): Promise<CommitResult> {
  for (let i = 1; i <= tries; i++) {
    const loaded = await api.load();
    if (!loaded.ok) return { ...loaded, tries: i };
    const cur = loaded.row;
    const next = action(cur === null ? null : cur.doc);
    if (next === null) return { ok: true, row: cur, wrote: false, tries: i };
    if (cur !== null && cur.otisak === next.otisak)
      return { ok: true, row: cur, wrote: false, tries: i };
    const saved = await api.save(next, cur === null ? null : cur.rev, deviceId);
    if (saved.ok) {
      /* odluka 15. 11. 2026: čuvaju se 3 prethodne verzije; greška čišćenja ne obara upis plana */
      try {
        await api.pruneVersions(VERSIONS_KEPT);
      } catch {
        /* višak verzija ostaje do sledećeg upisa */
      }
      return { ok: true, row: saved.row, wrote: true, tries: i };
    }
    if ('conflict' in saved) continue;
    return { ...saved, tries: i };
  }
  return { ok: false, reason: 'sukob', tries };
}

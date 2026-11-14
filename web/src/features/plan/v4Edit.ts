/* F9 korak 7 · PREMEŠTANJE I RUČNA IZMENA POD ZASTAVICOM V4: postojeći listovi (SwapSheet, AltSheet) zovu ovo kad se
   prikazuje plan iz V4. Izmena je radnja nad planom (`edits.applyMove` / `applyEdit`) → `commitAction`, uz događaj
   `manual-edit` u `plan_v4_dogadjaj`. U `alts` / `moves` / `genPlan` se ništa ne piše. */
import { getApp } from '../../app/appContext';
import type { PlanDoc, PlanEvent } from '../../domain/v4/engine';
import {
  doneFromLog,
  otisakOf,
  type EditContext,
  type EditRefusal,
  type EditResult
} from '../../integrations/v4';
import { useTrainingStore } from '../../stores';
import { useV4Store } from '../../stores/v4Store';

const REFUSAL: Record<EditRefusal, string> = {
  'nema-dana': 'dan nije u planu',
  uradjen: 'dan je odrađen',
  zakljucan: 'dan je zaključan',
  prosao: 'dan je prošao',
  'van-nedelje': 'zamena je moguća samo unutar iste nedelje',
  zauzet: 'drugi dan se ne sme pomeriti',
  'datum-neispravan': 'neispravan datum'
};

/** `null` = sačuvano; inače tekst greške za postojeći prikaz greške lista. */
export async function commitV4Edit(
  shown: PlanDoc,
  edit: (doc: PlanDoc, ctx: EditContext) => EditResult
): Promise<string | null> {
  const v4 = getApp().v4;
  if (v4 === null) return 'V4 nije dostupan';
  const today = useV4Store.getState().today;
  if (today === null) return 'nepoznat današnji dan';
  const ctx: EditContext = { today, done: doneFromLog(useTrainingStore.getState().log) };
  let refused: EditRefusal | null = null;
  let event: PlanEvent | null = null;
  const ok = await v4.commit(
    (cur) => {
      const r = edit(cur ?? shown, ctx);
      if (!r.ok) {
        refused = r.reason;
        return null;
      }
      event = r.event;
      return { doc: r.doc, otisak: otisakOf(r.doc, today) };
    },
    () => (event === null ? [] : [event])
  );
  if (refused !== null) return REFUSAL[refused];
  return ok ? null : 'nema veze sa serverom, pokušaj ponovo';
}

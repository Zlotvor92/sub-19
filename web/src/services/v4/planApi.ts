/* V4 · `plan_v4`: jedan `PlanDoc` po korisniku, USLOVNI upis po `rev` (supabase/v4.sql, okidač `plan_v4_rev`).
   - prvi upis: POST sa `resolution=ignore-duplicates` — ako je drugi uređaj već upisao, server vrati 0 redova = sukob;
   - sledeći: PATCH `?user_id=eq.<uid>&rev=eq.<viđen>` — 0 izmenjenih redova = neko je upisao posle nas = sukob.
   Odluku šta posle sukoba radi `store.ts` (ponovo učitaj, ponovo primeni radnju). */
import { z } from 'zod';
import type { PlanDoc } from '../../domain/v4/engine';
import { eq, failureOf, ODJAVLJEN, type V4Failure, type V4Rest } from './rest';

export interface PlanRow {
  doc: PlanDoc;
  rev: number;
  otisak: string;
}

const Row = z.object({ doc: z.unknown(), rev: z.number(), otisak: z.string() }).passthrough();
const RowList = z.array(Row);

const toRow = (r: z.infer<typeof Row>): PlanRow => ({
  doc: r.doc as PlanDoc,
  rev: r.rev,
  otisak: r.otisak
});

export type LoadResult = { ok: true; row: PlanRow | null } | V4Failure;
export type SaveResult = { ok: true; row: PlanRow } | { ok: false; conflict: true } | V4Failure;

export interface PlanApi {
  load(): Promise<LoadResult>;
  /** `expectedRev = null`: reda još nema (prvi upis). */
  save(
    next: { doc: PlanDoc; otisak: string },
    expectedRev: number | null,
    deviceId: string
  ): Promise<SaveResult>;
}

export function createPlanApi(rest: V4Rest): PlanApi {
  return {
    async load() {
      const uid = await rest.user();
      if (uid === null) return ODJAVLJEN;
      const r = await rest.call(`plan_v4?select=doc,rev,otisak&user_id=${eq(uid)}`, RowList);
      if (!r.ok) return failureOf(r);
      const row = r.data[0];
      return { ok: true, row: row === undefined ? null : toRow(row) };
    },
    async save(next, expectedRev, deviceId) {
      const uid = await rest.user();
      if (uid === null) return ODJAVLJEN;
      const body = {
        user_id: uid,
        doc: next.doc,
        otisak: next.otisak,
        engine_ver: next.doc.engineVersion,
        device_id: deviceId
      };
      const r =
        expectedRev === null
          ? await rest.call('plan_v4', RowList, {
              method: 'POST',
              prefer: 'resolution=ignore-duplicates,return=representation',
              body
            })
          : await rest.call(`plan_v4?user_id=${eq(uid)}&rev=${eq(expectedRev)}`, RowList, {
              method: 'PATCH',
              prefer: 'return=representation',
              body
            });
      if (!r.ok) return failureOf(r);
      const row = r.data[0];
      return row === undefined ? { ok: false, conflict: true } : { ok: true, row: toRow(row) };
    }
  };
}

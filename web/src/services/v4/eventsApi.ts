/* V4 · `plan_v4_dogadjaj`: SAMO DOPISIVANJE. Ključ (user_id, event_id, vrsta); ponovljen upis istog događaja
   (dva uređaja, ponovljen pokušaj posle pada mreže) nije greška — `resolution=ignore-duplicates`. */
import { z } from 'zod';
import type { PlanEvent } from '../../domain/v4/engine';
import { eq, failureOf, ODJAVLJEN, type V4Failure, type V4Rest } from './rest';

/** `odbijeno` / `primenjeno` beleže odluku korisnika o prijavljenom događaju; ostalo je vrsta događaja. */
export type EventRecordKind = PlanEvent['kind'] | 'odbijeno' | 'primenjeno';

export interface EventRecord {
  event: PlanEvent;
  vrsta: EventRecordKind;
  revPlana: number | null;
}

const Rows = z.array(
  z
    .object({
      event_id: z.string(),
      vrsta: z.string(),
      dogadjaj: z.unknown(),
      rev_plana: z.number().nullable()
    })
    .passthrough()
);

export interface EventsApi {
  append(records: readonly EventRecord[], deviceId: string): Promise<{ ok: true } | V4Failure>;
  list(): Promise<{ ok: true; records: EventRecord[] } | V4Failure>;
}

export function createEventsApi(rest: V4Rest): EventsApi {
  return {
    async append(records, deviceId) {
      if (records.length === 0) return { ok: true };
      const uid = await rest.user();
      if (uid === null) return ODJAVLJEN;
      const r = await rest.call(
        'plan_v4_dogadjaj?on_conflict=user_id,event_id,vrsta',
        z.unknown(),
        {
          method: 'POST',
          prefer: 'resolution=ignore-duplicates,return=minimal',
          body: records.map((x) => ({
            user_id: uid,
            event_id: x.event.id,
            vrsta: x.vrsta,
            dogadjaj: x.event,
            rev_plana: x.revPlana,
            device_id: deviceId
          }))
        }
      );
      return r.ok ? { ok: true } : failureOf(r);
    },
    async list() {
      const uid = await rest.user();
      if (uid === null) return ODJAVLJEN;
      const r = await rest.call(
        `plan_v4_dogadjaj?select=event_id,vrsta,dogadjaj,rev_plana&user_id=${eq(uid)}&order=id.asc`,
        Rows
      );
      if (!r.ok) return failureOf(r);
      return {
        ok: true,
        records: r.data.map((x) => ({
          event: x.dogadjaj as PlanEvent,
          vrsta: x.vrsta as EventRecordKind,
          revPlana: x.rev_plana
        }))
      };
    }
  };
}

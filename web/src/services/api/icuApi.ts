/* intervals.icu preko našeg servera (`/api/icu`, `/api/icu-oauth`): intervals.icu ne šalje CORS zaglavlja, pa bi poziv iz pregledača bio
   blokiran. Veza (`athleteId` + token ili stari API ključ) ide u telo svakog poziva, a server je proverava i prosleđuje dalje.

   Odgovori prolaze kroz Zod pre nego što stignu do stanja. Stavka sa neispravnim oblikom se ODBACUJE (spisak ostaje), ne obara ceo odgovor. */

import { z } from 'zod';
import type { IcuActivity } from '../../domain/activities';
import { icuCredentials, type IcuLink } from '../../domain/icu';
import type { WellnessRecord } from '../../domain/state';
import { cleanWellness } from '../../domain/state/clean';
import type { Result } from '../http';
import type { AppApi } from './appApi';

const num = z.number().nullish();
const intArr = z.array(z.number().nullable()).nullish();

const Activity = z
  .object({
    id: z.union([z.string(), z.number()]).transform(String),
    datum: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    sat: num,
    tip: z.string().nullish(),
    naziv: z.string().nullish(),
    opis: z.string().nullish(),
    km: num,
    sec: num,
    hr: num,
    maxHr: num,
    kadenca: num,
    uspon: num,
    temp: num,
    osecaSe: num,
    gapSec: num,
    razdvajanje: num,
    efikasnost: num,
    opterecenje: num,
    intenzitet: num,
    trimp: num,
    korak: num,
    zonePuls: intArr,
    zoneTempo: intArr,
    zoneGranice: intArr
  })
  .passthrough();

const Round = z
  .object({
    tip: z.string().nullish(),
    sec: num,
    paceSec: num,
    distM: num,
    hr: num,
    kadenca: num,
    watts: num,
    gapSec: num,
    maxHr: num,
    minHr: num,
    razdvajanje: num,
    oznaka: z.string().nullish()
  })
  .passthrough();
export type IcuRoundDto = z.infer<typeof Round>;

const Group = z.object({}).passthrough();

const DetailEntry = z.union([
  z.object({ krugovi: z.array(z.unknown()).default([]), grupe: z.array(z.unknown()).default([]) }),
  z.object({ greska: z.literal(true) })
]);

export interface IcuDetail {
  rounds: IcuRoundDto[];
  groups: Array<Record<string, unknown>>;
}

const Wellness = z.object({ dani: z.array(z.unknown()) });
const Activities = z.object({ treninzi: z.array(z.unknown()) });
const Details = z.object({ detalji: z.record(z.string(), z.unknown()) });
const Streams = z.object({ tokovi: z.record(z.string(), z.unknown()) });
const Zones = z.object({
  zone: z
    .array(z.object({ min: z.number(), max: z.number().nullable(), ime: z.string().nullish() }))
    .nullable(),
  lthr: num,
  maxHr: num,
  razlog: z.string().nullish()
});
const AuthUrl = z.object({ url: z.string().min(1) });
const Exchange = z.object({
  athleteId: z.union([z.string(), z.number()]).transform(String),
  token: z.string().min(1),
  scope: z.string().nullish()
});
const Pushed = z.object({ poslato: z.number() }).passthrough();

export interface IcuZones {
  zone: Array<{ min: number; max: number | null; ime: string | null }> | null;
  lthr: number | null;
  maxHr: number | null;
  reason: string | null;
}

export interface IcuEvent {
  [field: string]: unknown;
}

export interface IcuApi {
  wellness(
    link: IcuLink,
    oldest: string,
    newest: string
  ): Promise<Result<{ days: Record<string, WellnessRecord> }>>;
  activities(
    link: IcuLink,
    oldest: string,
    newest: string
  ): Promise<Result<{ activities: IcuActivity[] }>>;
  /** Krugovi za do 12 treninga; ključ je ID treninga, `null` kad je server vratio `greska`. */
  details(
    link: IcuLink,
    ids: readonly string[]
  ): Promise<Result<{ details: Record<string, IcuDetail | null> }>>;
  /** Sirovi tokovi (do 3 treninga) u Stravinom obliku; `null` kad je server vratio `greska`. */
  streams(
    link: IcuLink,
    ids: readonly string[]
  ): Promise<Result<{ streams: Record<string, unknown> }>>;
  zones(link: IcuLink): Promise<Result<IcuZones>>;
  pushWorkouts(
    link: IcuLink,
    events: readonly IcuEvent[],
    replace: boolean
  ): Promise<Result<{ sent: number }>>;
  authUrl(state: string): Promise<Result<{ url: string }>>;
  exchange(code: string): Promise<Result<{ athleteId: string; token: string; scope: string }>>;
}

export function createIcuApi(api: AppApi): IcuApi {
  const body = (
    sta: string,
    link: IcuLink,
    extra: Record<string, unknown> = {}
  ): Record<string, unknown> => ({
    sta,
    athleteId: link['athleteId'],
    ...icuCredentials(link),
    ...extra
  });
  return {
    async wellness(link, oldest, newest) {
      const r = await api.post('/api/icu', body('wellness', link, { oldest, newest }), Wellness);
      if (!r.ok) return r;
      const days: Record<string, WellnessRecord> = {};
      for (const z of r.data.dani) {
        if (!z || typeof z !== 'object' || typeof (z as { datum?: unknown }).datum !== 'string')
          continue;
        const datum = (z as { datum: string }).datum;
        const cleaned = cleanWellness({ [datum]: z });
        const rec = cleaned[datum];
        if (rec) days[datum] = rec;
      }
      return { ok: true, data: { days }, status: r.status };
    },
    async activities(link, oldest, newest) {
      const r = await api.post(
        '/api/icu',
        body('activities', link, { oldest, newest }),
        Activities
      );
      if (!r.ok) return r;
      const out: IcuActivity[] = [];
      for (const item of r.data.treninzi) {
        const p = Activity.safeParse(item);
        if (p.success) out.push(p.data as unknown as IcuActivity);
      }
      return { ok: true, data: { activities: out }, status: r.status };
    },
    async details(link, ids) {
      const r = await api.post('/api/icu', body('activities', link, { detalji: ids }), Details);
      if (!r.ok) return r;
      const out: Record<string, IcuDetail | null> = {};
      for (const [id, v] of Object.entries(r.data.detalji)) {
        const p = DetailEntry.safeParse(v);
        if (!p.success || !('krugovi' in p.data)) {
          out[id] = null;
          continue;
        }
        const rounds: IcuRoundDto[] = [];
        for (const k of p.data.krugovi) {
          const pr = Round.safeParse(k);
          if (pr.success) rounds.push(pr.data);
        }
        const groups: Array<Record<string, unknown>> = [];
        for (const g of p.data.grupe) {
          const pg = Group.safeParse(g);
          if (pg.success) groups.push(pg.data);
        }
        out[id] = { rounds, groups };
      }
      return { ok: true, data: { details: out }, status: r.status };
    },
    async streams(link, ids) {
      const r = await api.post('/api/icu', body('activities', link, { tokovi: ids }), Streams);
      if (!r.ok) return r;
      return { ok: true, data: { streams: r.data.tokovi }, status: r.status };
    },
    async zones(link) {
      const r = await api.post('/api/icu', body('zone', link), Zones);
      if (!r.ok) return r;
      return {
        ok: true,
        data: {
          zone: r.data.zone
            ? r.data.zone.map((z) => ({ min: z.min, max: z.max, ime: z.ime ?? null }))
            : null,
          lthr: r.data.lthr ?? null,
          maxHr: r.data.maxHr ?? null,
          reason: r.data.razlog ?? null
        },
        status: r.status
      };
    },
    async pushWorkouts(link, events, replace) {
      const r = await api.post(
        '/api/icu',
        body('workouts', link, { events, rezim: replace ? 'zameni' : 'azuriraj' }),
        Pushed
      );
      if (!r.ok) return r;
      return { ok: true, data: { sent: r.data.poslato }, status: r.status };
    },
    async authUrl(state) {
      return api.getAuthed(`/api/icu-oauth?akcija=url&state=${encodeURIComponent(state)}`, AuthUrl);
    },
    async exchange(code) {
      const r = await api.post('/api/icu-oauth', { code }, Exchange);
      if (!r.ok) return r;
      return {
        ok: true,
        data: { athleteId: r.data.athleteId, token: r.data.token, scope: r.data.scope ?? '' },
        status: r.status
      };
    }
  };
}

/* STREAMOVI I KRUGOVI sa spoljnih izvora (Strava, intervals.icu → normalizovano na Stravin oblik). Zod na granici: ključ ili stavka sa
   neispravnim telom se preskače, ostalo ostaje. */

import { z } from 'zod';
import type { ActivityStreams, Lap } from '../domain/activities';

const SERIES = [
  'distance',
  'time',
  'heartrate',
  'cadence',
  'watts',
  'altitude',
  'temp',
  'moving'
] as const;
const Series = z.object({ data: z.array(z.unknown()) }).passthrough();

/** Streamovi u obliku `{ ključ: { data: [...] } }`; ključ sa neispravnim telom se preskače. `null` kad nije objekat. */
export function parseStreams(raw: unknown): ActivityStreams | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const out: Record<string, { data: unknown[] }> = {};
  for (const k of SERIES) {
    const p = Series.safeParse((raw as Record<string, unknown>)[k]);
    if (p.success) out[k] = { data: p.data.data };
  }
  return out;
}

const LapShape = z
  .object({
    distance: z.number(),
    moving_time: z.number().nullish(),
    elapsed_time: z.number().nullish()
  })
  .passthrough();

export function parseLaps(raw: unknown): Lap[] {
  if (!Array.isArray(raw)) return [];
  const out: Lap[] = [];
  for (const item of raw as unknown[]) {
    const p = LapShape.safeParse(item);
    if (p.success) out.push(p.data);
  }
  return out;
}

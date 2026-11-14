import type { Backend, Recorded } from './backend';

/* LAŽNE V4 TABELE (supabase/v4.sql) nad postojećim lažnim backendom: `v4_pristup` (zastavica), `plan_v4` sa uslovnim
   upisom po `rev`, `plan_v4_dogadjaj` (samo dopisivanje) i `aktivnost`. Bez prave baze i prave Strave. */

export interface V4Row {
  doc: { weeks: Array<{ days: Array<{ id: string; date: string; origin: string }> }> };
  rev: number;
  otisak: string;
}
export interface V4Fake {
  enabled: boolean;
  row: V4Row | null;
  events: Array<{ event_id: string; vrsta: string }>;
  writes: number;
  /** Trčanja u `aktivnost` (oblik `Run` motora). */
  runs: Array<Record<string, unknown>>;
}

const revOf = (url: string): number | null => {
  const m = /[?&]rev=eq\.(\d+)/.exec(url);
  return m ? Number(m[1]) : null;
};

export function installV4(backend: Backend, enabled = true): V4Fake {
  const fake: V4Fake = { enabled, row: null, events: [], writes: 0, runs: [] };
  backend.api.set('/rest/v1/v4_pristup', () => ({
    body: fake.enabled ? [{ ukljuceno: true }] : []
  }));
  backend.api.set('/rest/v1/plan_v4_dogadjaj', (r: Recorded) => {
    if (r.method === 'GET') return { body: fake.events };
    const rows = (Array.isArray(r.body) ? r.body : [r.body]) as V4Fake['events'];
    for (const x of rows)
      if (!fake.events.some((e) => e.event_id === x.event_id)) fake.events.push(x);
    return { status: 201, body: [] };
  });
  backend.api.set('/rest/v1/aktivnost', (r: Recorded) =>
    r.method === 'GET'
      ? { body: fake.runs.map((run) => ({ id: run['id'], run })) }
      : { status: 201, body: [] }
  );
  backend.api.set('/rest/v1/plan_v4', (r: Recorded) => {
    const b = r.body as { doc: V4Row['doc']; otisak: string } | undefined;
    if (r.method === 'GET') return { body: fake.row ? [fake.row] : [] };
    if (r.method === 'POST') {
      if (fake.row || !b) return { status: 201, body: [] };
      fake.row = { doc: b.doc, otisak: b.otisak, rev: 1 };
      fake.writes++;
      return { status: 201, body: [fake.row] };
    }
    if (r.method === 'PATCH') {
      if (!fake.row || !b || revOf(r.url) !== fake.row.rev) return { body: [] };
      fake.row = { doc: b.doc, otisak: b.otisak, rev: fake.row.rev + 1 };
      fake.writes++;
      return { body: [fake.row] };
    }
    return { status: 405, body: [] };
  });
  return fake;
}

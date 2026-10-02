import { describe, expect, it } from 'vitest';
import { addDays, type IsoDate } from '../../domain/date';
import { adaptGeneratedPlan } from '../../domain/plan/adapt';
import { resolvePlan, type ResolvedPlan } from '../../domain/plan';
import { generatePlan } from '../../domain/training/generator/generatePlan';
import { createIcuApi } from '../api/icuApi';
import { createAppApi } from '../api/appApi';
import type { IcuLink } from '../../domain/icu';
import { createWatchPush } from './icuPush';

/* parity: icuPosalji (app.js) — uslovi odbijanja, telo poziva, zapis `lastPush`, poruke grešaka. Tekst događaja je dokazan u
   `domain/watch` naspram starog koda. */

const TODAY = '2026-02-20';
const plan = (): ResolvedPlan => {
  const start = addDays('2026-02-16' as IsoDate, -3 * 7);
  const a = adaptGeneratedPlan(
    generatePlan({
      startDate: start,
      raceDate: addDays(start, 14 * 7 + 3),
      raceDistM: 10000,
      pb: { distM: 10000, sec: 2570 },
      weeklyKm: 45,
      runDays: 5,
      quality: 2,
      intensity: 'std',
      trainedRecently: true
    })
  );
  if (!a) throw new Error('adapt');
  return resolvePlan(a.weeks, { alts: {}, moves: {} });
};

function make(opts: { link: IcuLink | null; plan?: ResolvedPlan | null; response?: Response }) {
  const calls: Array<{ url: string; body: Record<string, unknown> }> = [];
  let link = opts.link;
  const api = createIcuApi(
    createAppApi({
      fetcher: (url, init) => {
        calls.push({
          url,
          body: JSON.parse(typeof init?.body === 'string' ? init.body : '{}') as Record<
            string,
            unknown
          >
        });
        return Promise.resolve(
          opts.response ??
            new Response(JSON.stringify({ poslato: 9 }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' }
            })
        );
      },
      session: { token: () => Promise.resolve('JWT') }
    })
  );
  const watch = createWatchPush({
    api,
    link: { get: () => link, set: (v) => void (link = v) },
    plan: () => (opts.plan === undefined ? plan() : opts.plan),
    vdot: () => 47,
    now: () => 1234,
    today: () => TODAY
  });
  return { watch, calls, link: () => link };
}

describe('slanje na sat', () => {
  it('bez veze: ne zove server', async () => {
    const m = make({ link: null });
    expect(await m.watch.push(14, false)).toEqual({
      ok: false,
      error: 'intervals.icu nije povezan.'
    });
    expect(m.calls).toHaveLength(0);
  });

  it('bez treninga u periodu: ne zove server', async () => {
    const m = make({ link: { athleteId: 'i1', token: 't' }, plan: null });
    expect(await m.watch.push(14, false)).toEqual({
      ok: false,
      error: 'Nema treninga u tom periodu.'
    });
    expect(m.calls).toHaveLength(0);
  });

  it('uspeh: telo nosi sta/athleteId/token/rezim, a veza dobija lastPush', async () => {
    const m = make({ link: { athleteId: 'i1', token: 't', lastSync: 5 } });
    const r = await m.watch.push(14, false);
    expect(r).toEqual({ ok: true, n: 9 });
    const c = m.calls[0];
    expect(c?.url).toBe('/api/icu');
    expect(c?.body).toMatchObject({
      sta: 'workouts',
      athleteId: 'i1',
      token: 't',
      rezim: 'azuriraj'
    });
    expect(Array.isArray(c?.body['events'])).toBe(true);
    expect(m.link()).toMatchObject({ lastPush: 1234, lastSync: 5, token: 't' });
  });

  it('„Iz početka" šalje rezim zameni; stari API ključ umesto tokena', async () => {
    const m = make({ link: { athleteId: 'i1', apiKey: 'kljuc-12345' } });
    await m.watch.push(14, true);
    expect(m.calls[0]?.body).toMatchObject({ rezim: 'zameni', apiKey: 'kljuc-12345' });
    expect(m.calls[0]?.body['token']).toBeUndefined();
  });

  it('greška servera: poruka sa detaljem, lastPush se NE upisuje', async () => {
    const m = make({
      link: { athleteId: 'i1', token: 't' },
      response: new Response(JSON.stringify({ error: 'Odbijeno', detail: 'No Target' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    });
    const r = await m.watch.push(14, false);
    expect(r).toEqual({ ok: false, error: 'Odbijeno — No Target' });
    expect(m.link()).not.toHaveProperty('lastPush');
  });

  it('pregled je isti skup koji odlazi', async () => {
    const m = make({ link: { athleteId: 'i1', token: 't' } });
    const p = m.watch.preview(14);
    await m.watch.push(14, false);
    expect(m.calls[0]?.body['events']).toEqual(p.events);
    expect(p.events.length).toBeGreaterThan(5);
  });
});

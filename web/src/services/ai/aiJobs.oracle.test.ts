import { beforeAll, describe, expect, it } from 'vitest';
import { loadLegacyApp, type LegacyApp } from '@/test/legacyOracle';
import type { LogEntry } from '../../domain/state';
import { createAppApi } from '../api/appApi';
import { createAiJobs } from './aiJobs';

/* parity: aiProveri, aiPonovoPokreni, aiSacekaj, aiPokupiSve (app.js) — stanja posla, kvota, zaglavljeni poslovi. Mreža je lažna sa obe strane. */

const NOW = '2026-07-14T14:30:00Z';
const NOW_MS = new Date(NOW).getTime();
const j = <T>(x: unknown): T => JSON.parse(JSON.stringify(x)) as T;
let legacy: LegacyApp;
beforeAll(async () => {
  legacy = await loadLegacyApp(NOW);
});
const ctx = (): Record<string, unknown> =>
  (legacy as unknown as { ctx: Record<string, unknown> }).ctx;

interface Reply {
  status: number;
  body: unknown;
}

function make(
  log: Record<string, LogEntry>,
  replies: Reply[],
  opts: { online?: boolean; authed?: boolean } = {}
) {
  const calls: Array<{ posao: string; body: Record<string, unknown> }> = [];
  let i = 0;
  const jobs = createAiJobs({
    api: createAppApi({
      fetcher: (_url, init) => {
        const body = JSON.parse(typeof init?.body === 'string' ? init.body : '{}') as Record<
          string,
          unknown
        >;
        calls.push({ posao: String(body['posao']), body });
        const r = replies[Math.min(i++, replies.length - 1)] as Reply;
        return Promise.resolve(
          new Response(JSON.stringify(r.body), {
            status: r.status,
            headers: { 'Content-Type': 'application/json' }
          })
        );
      },
      session: { token: () => Promise.resolve('JWT') }
    }),
    log: {
      get: (id) => log[id],
      set: (id, e) => void (log[id] = e),
      ids: () => Object.keys(log)
    },
    now: () => NOW_MS,
    online: () => opts.online ?? true,
    isAuthed: () => opts.authed ?? true,
    isOwner: () => false,
    sleep: () => Promise.resolve()
  });
  return { jobs, calls, log };
}

/** Isti odgovor za stari kod (`aiPozovi` je zamenjen). */
const legacyReply = (r: Reply): Record<string, unknown> =>
  r.status >= 200 && r.status < 300
    ? { ok: true, data: r.body }
    : {
        ok: false,
        status: r.status,
        error: (r.body as { error?: string }).error ?? `Greška ${r.status}`
      };

const REPLIES: Reply[] = [
  { status: 404, body: { error: 'Nema posla' } },
  { status: 500, body: { error: 'Greška servera' } },
  { status: 401, body: { error: 'x' } },
  { status: 200, body: { stanje: 'gotovo', tekst: 'Dobro trčanje.' } },
  { status: 200, body: { stanje: 'gotovo', tekst: 'x'.repeat(5000) } },
  { status: 200, body: { stanje: 'gotovo' } },
  { status: 200, body: { stanje: 'greska', greska: 'Model nije odgovorio.' } },
  { status: 200, body: { stanje: 'greska' } },
  { status: 200, body: { stanje: 'radi' } },
  { status: 200, body: { stanje: 'u_toku' } },
  { status: 200, body: {} }
];

describe('AI tok naspram starog koda', () => {
  it('jedno pitanje u bazu: svako stanje odgovora × starost posla × prethodni tekst/brojač', async () => {
    const ages: Array<number | null> = [0, 60e3, 5 * 60e3, 29 * 60e3, 30 * 60e3, 40 * 864e5, null];
    let final = 0;
    let pending = 0;
    let gaveUp = 0;
    let stamped = 0;
    for (const reply of REPLIES)
      for (const age of ages)
        for (const prev of [false, true]) {
          const l: Record<string, unknown> = {
            km: 8,
            sec: 2800,
            aiPosao: age === null ? { id: 'j1' } : { id: 'j1', at: NOW_MS - age },
            ...(prev ? { aiText: 'Stara analiza.', aiCount: 1, aiGreska: 'stara greška' } : {})
          };
          ctx()['__l'] = j(l);
          ctx()['__r'] = legacyReply(reply);
          legacy.evalIn('aiPozovi=async function(){return __r}; S.log["x1"]=__l; 0');
          const oldResult = (await legacy.evalIn('aiProveri({id:"x1"}, S.log["x1"])')) as
            string | null;
          const oldLog = j<Record<string, unknown>>(legacy.evalIn('S.log["x1"]'));

          const m = make({ x1: j<LogEntry>(l) }, [reply]);
          const mine = await m.jobs.check('x1');
          expect(
            mine,
            `${reply.status} ${JSON.stringify(reply.body).slice(0, 40)} ${String(age)} ${prev}`
          ).toBe(oldResult);
          expect(
            j(m.log['x1']),
            `${reply.status} ${JSON.stringify(reply.body).slice(0, 40)} ${String(age)} ${prev}`
          ).toEqual(oldLog);
          if (mine === 'gotovo' || mine === 'greska') final++;
          else pending++;
          if (
            mine === 'greska' &&
            (m.log['x1']?.['aiGreska'] as string | undefined)?.startsWith('Analiza nije završena')
          )
            gaveUp++;
          if (age === null && mine === 'radi') stamped++;
        }
    expect(final).toBeGreaterThan(60);
    expect(pending).toBeGreaterThan(20);
    expect(gaveUp).toBeGreaterThan(5);
    expect(stamped).toBeGreaterThan(5);
  });

  it('bez posla nema poziva; ponovno slanje „radi" ne troši kvotu i resetuje prozor čekanja', async () => {
    const none = make({ x1: { km: 8, sec: 2800 } }, [{ status: 200, body: {} }]);
    expect(await none.jobs.check('x1')).toBeNull();
    expect(none.calls).toHaveLength(0);

    const l: LogEntry = {
      km: 8,
      sec: 2800,
      aiPosao: { id: 'j1', at: NOW_MS - 20 * 60e3 },
      aiCount: 1
    };
    const m = make({ x1: l }, [
      { status: 200, body: {} },
      { status: 200, body: { stanje: 'gotovo', tekst: 'Gotovo.' } }
    ]);
    const r = await m.jobs.retry('x1', { session: { desc: 'x' } });
    expect(r.phase).toBe('gotovo');
    expect(m.calls[0]?.body).toMatchObject({
      posao: 'radi',
      posaoId: 'j1',
      danId: 'x1',
      session: { desc: 'x' }
    });
    expect(m.log['x1']?.['aiCount']).toBe(2); // brojač raste samo kad rezultat stigne
    expect(m.log['x1']?.['aiText']).toBe('Gotovo.');
  });

  it('klik: start → radi (bez čekanja) → citaj; kvota potrošena odbija pre poziva; greška starta se vraća', async () => {
    const ok = make({ x1: { km: 8, sec: 2800 } }, [
      { status: 200, body: { posaoId: 'p9' } },
      { status: 200, body: {} },
      { status: 200, body: { stanje: 'radi' } },
      { status: 200, body: { stanje: 'gotovo', tekst: 'Analiza.' } }
    ]);
    let started = 0;
    const r = await ok.jobs.run('x1', { goalCtx: 'cilj' }, () => started++);
    expect(r).toEqual({ phase: 'gotovo', error: null });
    expect(started).toBe(1);
    expect(ok.calls.map((c) => c.posao)).toEqual(['start', 'radi', 'citaj', 'citaj']);
    expect(ok.calls[1]?.body).toMatchObject({ posaoId: 'p9', danId: 'x1', goalCtx: 'cilj' });
    expect(ok.log['x1']).toMatchObject({ aiText: 'Analiza.', aiCount: 1 });
    expect(ok.log['x1']?.['aiPosao']).toBeUndefined();

    const spent = make({ x1: { km: 8, sec: 2800, aiCount: 2 } }, [{ status: 200, body: {} }]);
    expect(await spent.jobs.run('x1', {})).toEqual({ phase: null, error: null });
    expect(spent.calls).toHaveLength(0);

    const limit = make({ x1: { km: 8, sec: 2800, aiGreska: 'stara' } }, [
      { status: 429, body: { error: 'Dnevni limit', detail: 'još 2h' } }
    ]);
    const lr = await limit.jobs.run('x1', {});
    expect(lr).toEqual({ phase: 'greska', error: 'Dnevni limit — još 2h' });
    expect(limit.log['x1']?.['aiPosao']).toBeUndefined();
  });

  it('pokupi sve: najviše 5 dana, samo online i prijavljen, bez preklapanja', async () => {
    const log: Record<string, LogEntry> = {};
    for (let i = 0; i < 8; i++) log[`d${i}`] = { aiPosao: { id: `j${i}`, at: NOW_MS } };
    log['bez'] = { km: 1 };
    const m = make(log, [{ status: 200, body: { stanje: 'gotovo', tekst: 'T' } }]);
    expect(await m.jobs.collectAll()).toBe(true);
    expect(m.calls).toHaveLength(5);
    expect(Object.values(m.log).filter((e) => e['aiText'] === 'T')).toHaveLength(5);

    const off = make({ d0: { aiPosao: { id: 'j', at: NOW_MS } } }, [{ status: 200, body: {} }], {
      online: false
    });
    expect(await off.jobs.collectAll()).toBe(false);
    const anon = make({ d0: { aiPosao: { id: 'j', at: NOW_MS } } }, [{ status: 200, body: {} }], {
      authed: false
    });
    expect(await anon.jobs.collectAll()).toBe(false);
    expect(off.calls.length + anon.calls.length).toBe(0);
  });
});

import { it, expect } from 'vitest';
import { createAiJobs } from './aiJobs';
import { createAppApi } from '../api/appApi';
import type { LogEntry } from '../../domain/state';
it('AI odgovor posle promene naloga ne menja novi nalog', async () => {
  let account = 'a:1';
  let release!: (value: Response) => void;
  const log: Record<string, LogEntry> = { day: { aiPosao: { id: 'old', at: 1 } } };
  const jobs = createAiJobs({
    api: createAppApi({
      session: { token: () => Promise.resolve('jwt') },
      fetcher: () =>
        new Promise((resolve) => {
          release = resolve;
        })
    }),
    log: {
      get: (id) => log[id],
      set: (id, l) => {
        log[id] = l;
      },
      ids: () => Object.keys(log)
    },
    accountKey: () => account,
    now: () => 10,
    online: () => true,
    isAuthed: () => true,
    isOwner: () => false,
    sleep: () => Promise.resolve()
  });
  const pending = jobs.check('day');
  await Promise.resolve();
  await Promise.resolve();
  account = 'b:2';
  log.day = { aiPosao: { id: 'new', at: 2 }, aiText: 'novi nalog' };
  release(
    new Response(JSON.stringify({ stanje: 'gotovo', tekst: 'tuđa analiza' }), { status: 200 })
  );
  expect(await pending).toBeNull();
  expect(log.day?.['aiText']).toBe('novi nalog');
});

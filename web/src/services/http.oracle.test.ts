import { beforeAll, describe, expect, it } from 'vitest';
import { loadLegacyApp, type LegacyApp } from '@/test/legacyOracle';
import { httpErrorText, readJson, requestJson } from './http';
import { z } from 'zod';

/* parity: `apiJson` (app.js) — poruka za odgovor čije telo NIJE JSON (server pao, stranica posrednika). */

let legacy: LegacyApp;
beforeAll(async () => {
  legacy = await loadLegacyApp('2026-03-01T09:00:00Z');
});

const BODIES = [
  '',
  '   ',
  '<html><body><h1>502 Bad Gateway</h1></body></html>',
  'A server error has occurred\n\nFUNCTION_INVOCATION_TIMEOUT',
  `<p>${'x'.repeat(300)}</p>`,
  'Request Entity Too Large'
];
const STATUSES = [400, 401, 403, 404, 413, 429, 500, 502, 504];

describe('HTTP greška bez JSON tela naspram starog `apiJson`', () => {
  it('ista rečenica za svaki status i svaki oblik tela', async () => {
    let checked = 0;
    for (const status of STATUSES)
      for (const text of BODIES) {
        const expected = (await legacy.evalIn(
          `apiJson({ok:false,status:${status},text:async()=>${JSON.stringify(text)}})`
        )) as { ok: boolean; error: string };
        expect(httpErrorText(status, text), `${status} ${text.slice(0, 20)}`).toBe(expected.error);
        checked++;
      }
    expect(checked).toBe(STATUSES.length * BODIES.length);
  });

  it('requestJson: telo koje nije JSON dobija tu rečenicu; JSON sa porukom ima prednost', async () => {
    const html = new Response('<html>Bad gateway</html>', { status: 502 });
    const r = await requestJson(() => Promise.resolve(html), '/api/x', z.unknown());
    expect(r).toMatchObject({
      ok: false,
      kind: 'http',
      status: 502,
      error: 'Server je vratio grešku (502): Bad gateway'
    });
    const unauth = await requestJson(
      () => Promise.resolve(new Response('', { status: 401 })),
      '/api/x',
      z.unknown()
    );
    expect(unauth).toMatchObject({ error: 'Nisi prijavljen — prijavi se ponovo.' });
    const json = await requestJson(
      () =>
        Promise.resolve(new Response(JSON.stringify({ error: 'Dnevni limit.' }), { status: 429 })),
      '/api/x',
      z.unknown()
    );
    expect(json).toMatchObject({ error: 'Dnevni limit.' });
    const bare = await requestJson(
      () => Promise.resolve(new Response('{}', { status: 500 })),
      '/api/x',
      z.unknown()
    );
    expect(bare).toMatchObject({ error: 'Greška 500' });
  });

  it('readJson: telo koje nije JSON vraća sirov tekst, prazno telo prazan tekst', async () => {
    expect(await readJson(new Response('nije json'))).toEqual({ ok: false, text: 'nije json' });
    expect(await readJson(new Response(''))).toEqual({ ok: false, text: '' });
    expect(await readJson(new Response('{"a":1}'))).toEqual({ ok: true, value: { a: 1 } });
  });
});

import { describe, expect, it } from 'vitest';
import { broadcastAll, createAdminApi, MAX_BROADCAST_ROUNDS, type AdminApi } from './adminApi';
import { createAppApi } from './appApi';

/* parity: api/broadcast.js (ugovor tela i odgovora), bc-svi / openKorisniciSheet u app.js. */

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function make(handler: (body: Record<string, unknown>) => Response, token = 'TOK') {
  const calls: Array<{ url: string; auth: string | undefined; body: Record<string, unknown> }> = [];
  const api = createAdminApi(
    createAppApi({
      fetcher: (url, init) => {
        const body = JSON.parse(typeof init?.body === 'string' ? init.body : '{}') as Record<
          string,
          unknown
        >;
        calls.push({
          url,
          auth: (init?.headers as Record<string, string> | undefined)?.['Authorization'],
          body
        });
        return Promise.resolve(handler(body));
      },
      session: { token: () => Promise.resolve(token) }
    })
  );
  return { api, calls };
}

describe('admin API', () => {
  it('svaka radnja ide na /api/broadcast sa JWT-om i tačnim poljima tela', async () => {
    const c = make((b) => json(200, { ok: true, ...b }));
    await c.api.setChallenge('Trči.');
    await c.api.users();
    await c.api.scheduled();
    await c.api.restore('U9');
    await c.api.ban('U9', false, 'lozinka');
    await c.api.ban('U9', true, 'lozinka');
    await c.api.remove('U9', 'lozinka');
    expect(c.calls.map((x) => x.url)).toEqual(Array(7).fill('/api/broadcast'));
    expect(c.calls.every((x) => x.auth === 'Bearer TOK')).toBe(true);
    expect(c.calls.map((x) => x.body)).toEqual([
      { admin: 'izazov', tekst: 'Trči.' },
      { admin: 'lista' },
      { admin: 'zakazano' },
      { admin: 'ponisti', obrisiId: 'U9' },
      { admin: 'ban', banId: 'U9', ukini: false, lozinka: 'lozinka' },
      { admin: 'ban', banId: 'U9', ukini: true, lozinka: 'lozinka' },
      { admin: 'obrisi', obrisiId: 'U9', lozinka: 'lozinka' }
    ]);
  });

  it('čitanja vraćaju podatke; prazan odgovor je prazan spisak, ne pad', async () => {
    const c = make((b) =>
      b['admin'] === 'lista'
        ? json(200, { ok: true, korisnici: [{ id: 'a', email: 'a@x.rs', jaSam: true }] })
        : json(200, { ok: true })
    );
    expect(await c.api.users()).toEqual({
      ok: true,
      users: [{ id: 'a', email: 'a@x.rs', jaSam: true }]
    });
    expect(await c.api.scheduled()).toEqual({ ok: true, items: [] });
  });

  it('{ok:false} sa HTTP 200 je greška sa porukom servera; HTTP greška takođe', async () => {
    const refused = make(() => json(200, { ok: false, error: 'Pogrešna lozinka.' }));
    expect(await refused.api.remove('U9', 'x')).toEqual({ ok: false, error: 'Pogrešna lozinka.' });
    const forbidden = make(() => json(403, { error: 'Samo vlasnik.' }));
    expect(await forbidden.api.users()).toEqual({ ok: false, error: 'Samo vlasnik.' });
    const bare = make(() => json(200, { ok: false }));
    expect(await bare.api.ban('U9', false, 'x')).toEqual({ ok: false, error: 'Nije uspelo.' });
  });

  it('bez prijave poziv se ne šalje', async () => {
    const c = make(() => json(200, { ok: true }), '');
    const r = await c.api.users();
    expect(r.ok).toBe(false);
    expect(c.calls).toHaveLength(0);
  });

  it('suvi poziv (bez `admin`) ne zahteva ok:true — odgovor je stranica slanja', async () => {
    const c = make(() => json(200, { primalaca: 2, primaoci: ['a@x.rs', 'b@x.rs'] }));
    const r = await c.api.broadcast({});
    expect(r).toEqual({ ok: true, page: { primalaca: 2, primaoci: ['a@x.rs', 'b@x.rs'] } });
    expect(c.calls[0]?.body).toEqual({});
  });
});

interface Page {
  poslato?: number;
  palo?: number;
  sledeciOd?: number | null;
  sledeciPosle?: string | null;
}
function script(pages: Array<Page | { error: string }>) {
  const asked: Array<Record<string, unknown>> = [];
  let i = 0;
  const api: Pick<AdminApi, 'broadcast'> = {
    broadcast(opts) {
      asked.push({ ...opts });
      const p = pages[Math.min(i++, pages.length - 1)] as Page | { error: string };
      return Promise.resolve('error' in p ? { ok: false, error: p.error } : { ok: true, page: p });
    }
  };
  return { api, asked };
}

describe('broadcastAll', () => {
  it('prvi krug ide od 0; nastavak PO ADRESI; zbir poslatih i palih; staje kad nema nastavka', async () => {
    const s = script([
      { poslato: 90, palo: 1, sledeciPosle: 'm@x.rs', sledeciOd: 91 },
      { poslato: 40, palo: 0, sledeciPosle: null, sledeciOd: null }
    ]);
    const seen: number[] = [];
    const r = await broadcastAll(s.api, (p) => seen.push(p.sent));
    expect(r).toEqual({ ok: true, sent: 130, failed: 1 });
    expect(s.asked).toEqual([
      { posalji: true, od: 0 },
      { posalji: true, posle: 'm@x.rs' }
    ]);
    expect(seen).toEqual([0, 90]);
  });

  it('server bez adrese u odgovoru: rezerva je pozicija', async () => {
    const s = script([{ poslato: 3, sledeciOd: 3 }, { poslato: 2 }]);
    expect(await broadcastAll(s.api)).toEqual({ ok: true, sent: 5, failed: 0 });
    expect(s.asked[1]).toEqual({ posalji: true, od: 3 });
  });

  it('prekid usred slanja: vraća koliko je ipak poslato (ponovni poziv nastavlja bez duplikata)', async () => {
    const s = script([{ poslato: 90, sledeciPosle: 'm@x.rs' }, { error: 'Resend pao.' }]);
    expect(await broadcastAll(s.api)).toEqual({ ok: false, error: 'Resend pao.', sent: 90 });
  });

  it('krug koji ništa ne obradi a traži isti nastavak = greška, ne 60 praznih krugova', async () => {
    const s = script([{ poslato: 5, sledeciPosle: 'm@x.rs' }, { sledeciPosle: 'm@x.rs' }]);
    const r = await broadcastAll(s.api);
    expect(r).toEqual({ ok: false, error: 'Server ne napreduje sa slanjem.', sent: 5 });
    expect(s.asked).toHaveLength(2);
  });

  it(`najviše ${MAX_BROADCAST_ROUNDS} krugova`, async () => {
    let n = 0;
    const asked: unknown[] = [];
    const api: Pick<AdminApi, 'broadcast'> = {
      broadcast(opts) {
        asked.push(opts);
        n++;
        return Promise.resolve({ ok: true, page: { poslato: 1, sledeciPosle: `a${n}@x.rs` } });
      }
    };
    const r = await broadcastAll(api);
    expect(asked).toHaveLength(MAX_BROADCAST_ROUNDS);
    expect(r).toEqual({ ok: true, sent: MAX_BROADCAST_ROUNDS, failed: 0 });
  });
});

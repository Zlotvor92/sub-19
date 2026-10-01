import { beforeAll, describe, expect, it } from 'vitest';
import { canonical } from '@/test/fingerprint';
import { firstDiff } from '@/test/firstDiff';
import { loadLegacyApp, type LegacyApp } from '@/test/legacyOracle';
import { identityFromUser, jwtClaims, mergeIdentity, parseAuthHash } from '@/lib/auth';
import { seedState, type PersistedState } from '../state';
import { adoptServerState, decideStartup, toServerPayload } from './index';

/* parity: test/state.test.mjs (sbPayload), test/mreza-rok.test.mjs, test/requireuser-kopije.test.mjs,
   test/bezbednost.test.mjs. Poredi `domain/sync` i `lib/auth` sa starim `sbPayload`, `sbDecide`,
   `sbParseHash`, `sbClaims`, `sbIzKorisnika`. */

function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const j = <T>(x: unknown): T =>
  x === undefined ? (undefined as T) : (JSON.parse(JSON.stringify(x)) as T);

let legacy: LegacyApp;
beforeAll(async () => {
  legacy = await loadLegacyApp('2026-07-12T09:00:00Z');
});
const set = (name: string, v: unknown): void => {
  (legacy as unknown as { ctx: Record<string, unknown> }).ctx[name] = v;
};

function randomState(r: () => number): PersistedState {
  const s = j<PersistedState>(seedState());
  const x = r();
  s.strava =
    x < 0.3
      ? null
      : {
          access_token: 'SECRET-A',
          refresh_token: 'SECRET-R',
          lastSync: r() < 0.5 ? 12345 : null,
          athlete: r() < 0.5 ? { id: 7, name: 'A' } : null,
          scope: r() < 0.5 ? 'read' : null
        };
  s.icu =
    r() < 0.3
      ? null
      : { token: 'ICU-TOKEN', apiKey: 'ICU-KEY', athleteId: 'i1', lastSync: r() < 0.5 ? 99 : null };
  s.ui = { ...s.ui, geo: r() < 0.7 ? { lat: 44.81, lon: 20.46 } : null };
  s.vreme = r() < 0.7 ? { at: 1, lat: 44.81, lon: 20.46, sati: { x: 1 } } : null;
  s.log = { g1d1: { status: 'done', km: 5 } };
  s.knee = [{ date: '2026-07-01', pain: 4 }];
  return s;
}

describe('šta ide na server — naspram starog sbPayload', () => {
  it('200 nasumičnih stanja: ista struktura; nikakav token i nikakva koordinata ne prelaze granicu', () => {
    const r = rng(1);
    for (let i = 0; i < 200; i++) {
      const s = randomState(r);
      set('__s', j(s));
      const old = j<unknown>(legacy.evalIn('sbPayload(__s)'));
      const mine = toServerPayload(s);
      expect(firstDiff(canonical(j(mine)), canonical(old)), `iter ${i}`).toBeNull();
      const text = JSON.stringify(mine);
      for (const secret of ['SECRET-A', 'SECRET-R', 'ICU-TOKEN', 'ICU-KEY', '44.81', '20.46'])
        expect(text, `${secret} ${i}`).not.toContain(secret);
      expect(mine).not.toHaveProperty('vreme');
      expect(mine.ui).not.toHaveProperty('geo');
    }
  });

  it('ne menja ulaz', () => {
    const s = randomState(rng(2));
    const before = JSON.stringify(s);
    toServerPayload(s);
    expect(JSON.stringify(s)).toBe(before);
  });
});

describe('usvajanje stanja sa servera', () => {
  it('veze, lokacija i keš prognoze ostaju na uređaju; sve ostalo dolazi sa servera', () => {
    const device = randomState(rng(3));
    device.strava = { access_token: 'DEV-STRAVA' };
    device.icu = { token: 'DEV-ICU' };
    device.ui = { ...device.ui, geo: { lat: 1, lon: 2 } };
    device.vreme = { at: 5 };
    const server = j<PersistedState>(seedState());
    server.log = { g9d9: { status: 'done' } };
    server.strava = { lastSync: 1 };
    server.icu = { lastSync: 2 };
    const out = adoptServerState(server, device);
    expect(out.strava).toEqual({ access_token: 'DEV-STRAVA' });
    expect(out.icu).toEqual({ token: 'DEV-ICU' });
    expect(out.ui.geo).toEqual({ lat: 1, lon: 2 });
    expect(out.vreme).toEqual({ at: 5 });
    expect(out.log).toEqual({ g9d9: { status: 'done' } });
  });

  it('uređaj bez veza ne dobija veze sa servera; bez lokacije se ne izmišlja', () => {
    const device = j<PersistedState>(seedState());
    const server = {
      ...j<PersistedState>(seedState()),
      strava: { lastSync: 1 },
      icu: { lastSync: 2 }
    };
    const out = adoptServerState(server, device);
    expect(out.strava).toBeNull();
    expect(out.icu).toBeNull();
    expect(out.ui.geo ?? null).toBeNull();
    expect(out.vreme).toBeNull();
  });
});

describe('odluka pri pokretanju — naspram starog sbDecide', () => {
  it('sve kombinacije (prazan server, bez seenAt, isti, noviji tuđi/sopstveni, stariji)', () => {
    const times = [
      null,
      undefined,
      '',
      '2026-07-01T10:00:00Z',
      '2026-07-02T10:00:00Z',
      '2026-06-30T10:00:00Z'
    ];
    const devices = [null, undefined, '', 'dA', 'dB'];
    let n = 0;
    for (const seen of times)
      for (const rem of times)
        for (const remDev of devices)
          for (const mine of devices) {
            const old = legacy.call(
              'sbDecide',
              seen ?? null,
              rem ?? null,
              remDev ?? null,
              mine ?? null
            );
            const mineDecision = decideStartup(
              seen,
              rem ? { at: rem, device: remDev ?? null } : null,
              mine
            );
            expect(mineDecision, JSON.stringify({ seen, rem, remDev, mine })).toBe(old);
            n++;
          }
    expect(n).toBe(6 * 6 * 5 * 5);
  });
});

function b64url(s: string): string {
  return Buffer.from(s, 'utf-8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}
const jwt = (claims: unknown): string =>
  `${b64url('{"alg":"HS256"}')}.${b64url(JSON.stringify(claims))}.sig`;

describe('sesija — naspram starog koda', () => {
  it('jwtClaims: email, id, ime i slika (samo https), ćirilica, pokvaren token', () => {
    const cases: unknown[] = [
      {
        email: 'a@b.rs',
        sub: 'u1',
        user_metadata: {
          full_name: 'Marko Marković',
          avatar_url: 'https://lh3.googleusercontent.com/a'
        }
      },
      {
        email: 'ћирилица@пример.рс',
        sub: 'u2',
        user_metadata: { name: 'Милош', picture: 'https://x/y' }
      },
      {
        email: 'a@b.rs',
        sub: 'u3',
        user_metadata: { avatar_url: 'http://insecure/a', full_name: 5 }
      },
      { sub: 'u4' },
      { sub: 'u5', user_metadata: 'x' },
      {}
    ];
    for (const c of cases) {
      const t = jwt(c);
      set('__t', t);
      const old = j<{
        email: string | null;
        userId: string | null;
        slika: string | null;
        ime: string | null;
      }>(legacy.evalIn('sbClaims(__t)'));
      const mine = jwtClaims(t);
      expect(
        { email: mine.email, userId: mine.userId, slika: mine.picture, ime: mine.name },
        JSON.stringify(c)
      ).toEqual(old);
    }
    for (const bad of ['', 'x', 'a.b.c', 'a.!!!.c', null, undefined]) {
      set('__t', bad ?? undefined);
      const old = j<{ email: null; userId: null; slika: null; ime: null }>(
        legacy.evalIn('sbClaims(__t)')
      );
      expect(jwtClaims(bad as string), String(bad)).toEqual({
        email: old.email,
        userId: old.userId,
        picture: old.slika,
        name: old.ime
      });
    }
  });

  it('parseAuthHash: isti rezultat (istek računat od zadatog sata)', () => {
    const now = legacy.evalIn('Date.now()') as number;
    for (const h of [
      '',
      '#',
      '#foo=1',
      '#access_token=',
      '#access_token=AAA&refresh_token=RRR&expires_in=7200',
      '#access_token=AAA',
      '#access_token=AAA&expires_in=abc',
      null,
      undefined
    ]) {
      const old = j<{ access: string; refresh: string | null; expiresAt: number } | null>(
        legacy.call('sbParseHash', h ?? null)
      );
      const mine = parseAuthHash(h, now);
      /* A5: neupotrebljiv `expires_in` (stari kod: NaN) pada na sat vremena */
      const expected = old && {
        ...old,
        expiresAt:
          Number.isFinite(old.expiresAt) && old.expiresAt !== null ? old.expiresAt : now + 3600_000
      };
      expect(mine, String(h)).toEqual(expected);
    }
  });

  it('identityFromUser + mergeIdentity: slika samo https, prazno ne briše postojeće', () => {
    const users: unknown[] = [
      { user_metadata: { full_name: 'A B', avatar_url: 'https://x/a.png' } },
      { user_metadata: { name: 'C', picture: 'http://x/a.png' } },
      { user_metadata: null },
      null,
      {}
    ];
    for (const u of users) {
      legacy.evalIn('SB.slika="https://old/s.png"; SB.ime="Old"; 0');
      set('__u', j(u));
      const changed = legacy.evalIn('sbIzKorisnika(__u)');
      const oldSb = j<{ slika: string; ime: string }>(legacy.evalIn('SB'));
      const m = mergeIdentity({ picture: 'https://old/s.png', name: 'Old' }, identityFromUser(u));
      expect(m.changed, JSON.stringify(u)).toBe(changed);
      expect({ slika: m.value.picture, ime: m.value.name }, JSON.stringify(u)).toEqual({
        slika: oldSb.slika,
        ime: oldSb.ime
      });
    }
  });
});

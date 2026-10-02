import { describe, expect, it } from 'vitest';
import { createKeyValueStore } from './storage/kv';
import { ICU_STATE_KEY, STRAVA_STATE_KEY } from './storage/keys';
import { checkOAuthState, classifyOAuthReturn, makeOAuthState, stravaAuthorizeUrl } from './oauth';

/* parity: stravaMakeState/stravaCheckState, icuMakeState/icuCheckState, handleOAuthReturn (app.js), test/bezbednost.test.mjs. */

const kv = () => createKeyValueStore();

describe('OAuth povratak', () => {
  it('state je jednokratan: drugi pokušaj sa istim vrednostima je odbijen', () => {
    const k = kv();
    const st = makeOAuthState(k, 'strava', () => 'S1', 1000);
    expect(checkOAuthState(k, 'strava', st, 2000)).toBe(true);
    expect(checkOAuthState(k, 'strava', st, 2000)).toBe(false);
    expect(k.get(STRAVA_STATE_KEY)).toBeNull();
  });

  it('istekao (10 min), pogrešan, prazan ili tuđ servis: odbijeno, a ključ se briše', () => {
    for (const [got, at, kind] of [
      ['S1', 1000 + 600_001, 'strava'],
      ['TUDJ', 2000, 'strava'],
      ['', 2000, 'strava'],
      ['S1', 2000, 'icu']
    ] as const) {
      const k = kv();
      makeOAuthState(k, 'strava', () => 'S1', 1000);
      expect(checkOAuthState(k, kind, got, at)).toBe(false);
    }
    const k = kv();
    makeOAuthState(k, 'strava', () => 'S1', 1000);
    checkOAuthState(k, 'strava', 'x', 2000);
    expect(k.get(STRAVA_STATE_KEY)).toBeNull();
  });

  it('klasifikacija: bez code nije povratak; Strava i intervals.icu se razlikuju po sačuvanom state-u; link sa strane se odbija', () => {
    const k = kv();
    expect(classifyOAuthReturn('', k, 0)).toEqual({ kind: 'none' });
    expect(classifyOAuthReturn('?foo=1', k, 0)).toEqual({ kind: 'none' });

    makeOAuthState(k, 'strava', () => 'SS', 1000);
    expect(classifyOAuthReturn('?code=C1&scope=read&state=SS', k, 2000)).toEqual({
      kind: 'ok',
      service: 'strava',
      code: 'C1',
      scope: 'read'
    });

    makeOAuthState(k, 'icu', () => 'II', 1000);
    expect(classifyOAuthReturn('?code=C2&state=II', k, 2000)).toEqual({
      kind: 'ok',
      service: 'icu',
      code: 'C2',
      scope: ''
    });

    // napadač: tuđ kod sa nepoznatim state-om
    makeOAuthState(k, 'strava', () => 'SS', 1000);
    expect(classifyOAuthReturn('?code=NJEGOV&state=NAPADAC', k, 2000)).toEqual({
      kind: 'rejected',
      service: 'strava'
    });
    expect(classifyOAuthReturn('?code=NJEGOV', k, 2000)).toEqual({
      kind: 'rejected',
      service: 'strava'
    });
  });

  it('povratak intervals.icu ne troši Stravin state i obrnuto', () => {
    const k = kv();
    makeOAuthState(k, 'strava', () => 'SS', 1000);
    makeOAuthState(k, 'icu', () => 'II', 1000);
    expect(classifyOAuthReturn('?code=C&state=II', k, 2000)).toMatchObject({
      kind: 'ok',
      service: 'icu'
    });
    expect(k.get(STRAVA_STATE_KEY)).not.toBeNull();
    expect(k.get(ICU_STATE_KEY)).toBeNull();
    expect(classifyOAuthReturn('?code=C&state=SS', k, 2000)).toMatchObject({
      kind: 'ok',
      service: 'strava'
    });
  });

  it('adresa za Stravu: redirect na koren sa kosom crtom, state kodiran', () => {
    expect(stravaAuthorizeUrl('259960', 'https://sub-19.vercel.app', 'a b')).toBe(
      'https://www.strava.com/oauth/authorize?client_id=259960&response_type=code&redirect_uri=https%3A%2F%2Fsub-19.vercel.app%2F&approval_prompt=auto&scope=activity:read_all&state=a%20b'
    );
  });
});

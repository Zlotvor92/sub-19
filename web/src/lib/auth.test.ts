import { describe, expect, it } from 'vitest';
import {
  TOKEN_REFRESH_MARGIN_MS,
  checkLoginReturn,
  isBannedResponse,
  refreshVerdict,
  tokenNeedsRefresh
} from './auth';

/* parity: test/mreza-rok.test.mjs, test/bezbednost.test.mjs (nonce prijave). */

describe('osvežavanje tokena', () => {
  it('izričito odbijanje (400/401/403) je MRTVA sesija; mreža i 5xx NISU — jedan tunel ne sme da te odjavi', () => {
    for (const s of [400, 401, 403]) expect(refreshVerdict(s)).toBe('dead');
    for (const s of [500, 502, 503, 504, 0, 429, 404]) expect(refreshVerdict(s)).toBe('unknown');
    expect(refreshVerdict(200)).toBe('ok');
  });
  it('osvežava se minut pre isteka', () => {
    const exp = 1_000_000;
    expect(tokenNeedsRefresh(exp, exp - TOKEN_REFRESH_MARGIN_MS - 1)).toBe(false);
    expect(tokenNeedsRefresh(exp, exp - TOKEN_REFRESH_MARGIN_MS)).toBe(true);
    expect(tokenNeedsRefresh(exp, exp + 5)).toBe(true);
  });
  it('zabrana naloga se prepoznaje po tekstu u telu odgovora', () => {
    expect(isBannedResponse({ msg: 'User is banned' })).toBe(true);
    expect(isBannedResponse({ msg: 'Pristup zabranjen' })).toBe(true);
    expect(isBannedResponse({ msg: 'invalid JWT' })).toBe(false);
    expect(isBannedResponse(undefined)).toBe(false);
  });
});

describe('povratak sa prijave (CSRF nonce)', () => {
  const saved = { st: 'abc123', exp: 2_000 };
  it('stigao i poklapa se → prihvati i zapamti da nonce radi', () => {
    expect(checkLoginReturn(saved, 'abc123', false, 1_000)).toEqual({
      accept: true,
      rememberNonceWorks: true
    });
  });
  it('stigao a ne poklapa se → ODBIJ', () => {
    expect(checkLoginReturn(saved, 'tuđ', false, 1_000).accept).toBe(false);
    expect(checkLoginReturn(saved, 'tuđ', true, 1_000).accept).toBe(false);
  });
  it('nije stigao a aplikacija zna da inače radi → ODBIJ (downgrade nije moguć)', () => {
    expect(checkLoginReturn(saved, null, true, 1_000).accept).toBe(false);
  });
  it('nije stigao a to još nije viđeno → prihvati po starom (uvođenje ne sme da zaključa naloge)', () => {
    expect(checkLoginReturn(saved, null, false, 1_000)).toEqual({
      accept: true,
      rememberNonceWorks: false
    });
  });
  it('bez sačuvanog markera ili posle isteka roka nema prihvatanja', () => {
    expect(checkLoginReturn(null, 'abc123', false, 1_000).accept).toBe(false);
    expect(checkLoginReturn({}, 'abc123', false, 1_000).accept).toBe(false);
    expect(checkLoginReturn(saved, 'abc123', false, 2_001).accept).toBe(false);
  });
});

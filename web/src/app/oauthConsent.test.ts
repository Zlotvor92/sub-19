import { describe, expect, it } from 'vitest';
import { CONSENT_WINDOW_MS, captureConsent, clearConsent, pendingConsent } from './oauthConsent';

function memory() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    size: () => m.size
  };
}

const ID = 'Ab3dEf6hIj9kLm2nOp5qRs8tUv1wXy4z';

describe('zahtev Claude konektora koji čeka odobrenje', () => {
  it('pamti se samo sa korena i `authorization_id`, i preživljava povratak sa prijave', () => {
    const s = memory();
    expect(captureConsent({ pathname: '/', search: '?sbn=abc' }, s, 0)).toBe(false);
    expect(captureConsent({ pathname: '/plan', search: `?authorization_id=${ID}` }, s, 0)).toBe(
      false
    );
    expect(s.size()).toBe(0);
    expect(captureConsent({ pathname: '/', search: `?authorization_id=${ID}` }, s, 0)).toBe(true);
    expect(pendingConsent(s, 1000)).toBe(ID);
  });

  it('ističe posle prozora i tada se briše', () => {
    const s = memory();
    captureConsent({ pathname: '/', search: `?authorization_id=${ID}` }, s, 0);
    expect(pendingConsent(s, CONSENT_WINDOW_MS + 1)).toBeNull();
    expect(s.size()).toBe(0);
  });

  it('ID neobičnog oblika se ne pamti (adresa se i dalje čisti)', () => {
    const s = memory();
    expect(captureConsent({ pathname: '/', search: '?authorization_id=../x?y' }, s, 0)).toBe(true);
    expect(pendingConsent(s, 0)).toBeNull();
  });

  it('oštećen zapis = nema zahteva; brisanje radi', () => {
    const s = memory();
    s.setItem('sub20-oauth-odobrenje', '{');
    expect(pendingConsent(s, 0)).toBeNull();
    captureConsent({ pathname: '/', search: `?authorization_id=${ID}` }, s, 0);
    clearConsent(s);
    expect(pendingConsent(s, 0)).toBeNull();
  });
});

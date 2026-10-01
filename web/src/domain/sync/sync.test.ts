import { describe, expect, it } from 'vitest';
import { canPush, decideStartup, isForeignNewer, PUSH_DEBOUNCE_MS } from './index';

/* parity: test/mreza-rok.test.mjs, test/requireuser-kopije.test.mjs, test/istorija.test.mjs.
   Brojčana jednakost `decideStartup` sa starim `sbDecide` je u `sync.oracle.test.ts`. Ovde su ZAMKE koje je
   korisnik već jednom platio: gubitak kilaže i povreda, i lažno pitanje o sukobu na jedinom uređaju. */

const T1 = '2026-07-01T10:00:00Z';
const T2 = '2026-07-02T10:00:00Z';

describe('odluka pri pokretanju', () => {
  it('server prazan → pošalji; server isti → ok', () => {
    expect(decideStartup(T1, null, 'dA')).toBe('push');
    expect(decideStartup(null, null, 'dA')).toBe('push');
    expect(decideStartup(T1, { at: T1, device: 'dB' }, 'dA')).toBe('ok');
  });
  it('tuđe novije se PITA, ne gazi', () => {
    expect(decideStartup(T1, { at: T2, device: 'dB' }, 'dA')).toBe('ask');
    expect(decideStartup(null, { at: T2, device: 'dB' }, 'dA')).toBe('ask');
  });
  it('sopstveno novije NIJE sukob (odgovor na push nikad nije stigao jer je telefon zamrznuo aplikaciju)', () => {
    expect(decideStartup(T1, { at: T2, device: 'dA' }, 'dA')).toBe('ok');
  });
  it('bez imena uređaja pita se (nema dokaza da je sopstveno)', () => {
    expect(decideStartup(T1, { at: T2, device: null }, 'dA')).toBe('ask');
    expect(decideStartup(T1, { at: T2, device: 'dA' }, null)).toBe('ask');
  });
});

describe('provera pre SVAKOG upisa', () => {
  it('tuđ noviji zapis diže sukob; sopstveni i stariji ne', () => {
    expect(isForeignNewer({ at: T2, device: 'dB' }, T1, 'dA')).toBe(true);
    expect(isForeignNewer({ at: T2, device: 'dA' }, T1, 'dA')).toBe(false);
    expect(isForeignNewer({ at: T1, device: 'dB' }, T1, 'dA')).toBe(false);
    expect(isForeignNewer({ at: T1, device: 'dB' }, T2, 'dA')).toBe(false);
  });
  it('bez saznanja o serveru ili bez imena uređaja ne blokira upis (offline-first, pozadinski red ponavlja)', () => {
    expect(isForeignNewer(null, T1, 'dA')).toBe(false);
    expect(isForeignNewer(undefined, T1, 'dA')).toBe(false);
    expect(isForeignNewer({ at: T2, device: 'dB' }, null, 'dA')).toBe(false);
    expect(isForeignNewer({ at: T2, device: null }, T1, 'dA')).toBe(false);
  });
  it('poređenje je po vremenu, ne po niski (isto vreme u drugom zapisu nije novije)', () => {
    expect(
      isForeignNewer({ at: '2026-07-02T10:00:00.000Z', device: 'dB' }, '2026-07-02T10:00:00Z', 'dA')
    ).toBe(false);
  });
});

describe('zabrana upisa', () => {
  const ok = { authenticated: true, loadFailed: false, conflictOpen: false };
  it('upis ide samo prijavljenom korisniku bez otvorenog sukoba i bez neuspelog učitavanja', () => {
    expect(canPush(ok)).toBe('go');
    expect(canPush({ ...ok, authenticated: false })).toBe('skip');
  });
  it('PRAZNO STANJE NE PREGAZI SERVER: neuspelo učitavanje blokira upis', () => {
    expect(canPush({ ...ok, loadFailed: true })).toBe('skip');
  });
  it('dok traje pitanje o sukobu, ništa se ne šalje (kilaža i povrede se unose ručno i nigde drugde ne postoje)', () => {
    expect(canPush({ ...ok, conflictOpen: true })).toBe('skip');
  });
  it('odloženi upis je 4 s (save() se zove i na svaki taster)', () => {
    expect(PUSH_DEBOUNCE_MS).toBe(4000);
  });
});

import { describe, expect, it } from 'vitest';
import { shouldShowSplash } from './splash';

/* parity: `uvodniEkran` na vrhu app.js. */

const mem = () => {
  const d = new Map<string, string>();
  return {
    getItem: (k: string) => d.get(k) ?? null,
    setItem: (k: string, v: string) => void d.set(k, v)
  };
};

describe('uvodni ekran', () => {
  it('prvi start u kartici: vidi se; svaki sledeći (osvežavanje, „Osveži", povratak) ne', () => {
    const storage = mem();
    expect(shouldShowSplash({ storage, reducedMotion: false })).toBe(true);
    expect(shouldShowSplash({ storage, reducedMotion: false })).toBe(false);
    expect(storage.getItem('sub20-uvod')).toBe('1');
  });
  it('isključeno kretanje ga preskače, ali zastavica se ipak upisuje', () => {
    const storage = mem();
    expect(shouldShowSplash({ storage, reducedMotion: true })).toBe(false);
    expect(storage.getItem('sub20-uvod')).toBe('1');
  });
  it('skladište zabranjeno (privatni režim): uvod se vidi, ništa ne puca', () => {
    const broken = {
      getItem: () => {
        throw new Error('zabranjeno');
      },
      setItem: () => {
        throw new Error('zabranjeno');
      }
    };
    expect(shouldShowSplash({ storage: broken, reducedMotion: false })).toBe(true);
    expect(shouldShowSplash({ reducedMotion: false })).toBe(true);
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SCRIPT from '../../public/tema.js?raw';
import { THEME_COLOR, THEME_KEY, applyTheme, readTheme, saveTheme, subscribeTheme } from './theme';

/* Tema je svojstvo UREĐAJA: živi u localStorage-u, ne u sinhronizovanom stanju. `public/tema.js` radi isto pre prvog iscrtavanja — ovde se drži da se dva
   zapisa ne razilaze (ključ, vrednosti, boje trake pregledača). */

const mem = (init: Record<string, string> = {}) => {
  const d = new Map(Object.entries(init));
  return {
    getItem: (k: string) => d.get(k) ?? null,
    setItem: (k: string, v: string) => void d.set(k, v),
    removeItem: (k: string) => void d.delete(k),
    d
  };
};

beforeEach(() => {
  document.head.innerHTML = `<meta name="theme-color" content="#f6f7f5" media="(prefers-color-scheme: light)"><meta name="theme-color" content="#0f1612" media="(prefers-color-scheme: dark)">`;
  document.documentElement.removeAttribute('data-theme');
});
afterEach(() => {
  document.head.innerHTML = '';
  document.documentElement.removeAttribute('data-theme');
});

const colors = (): string[] =>
  Array.from(document.querySelectorAll('meta[name="theme-color"]')).map(
    (m) => m.getAttribute('content') ?? ''
  );

describe('readTheme', () => {
  it('samo „light“ i „dark“ su izbor; sve ostalo je „prati sistem“', () => {
    expect(readTheme(mem({ [THEME_KEY]: 'dark' }))).toBe('dark');
    expect(readTheme(mem({ [THEME_KEY]: 'light' }))).toBe('light');
    expect(readTheme(mem({ [THEME_KEY]: 'auto' }))).toBe('auto');
    expect(readTheme(mem({ [THEME_KEY]: 'plava' }))).toBe('auto');
    expect(readTheme(mem())).toBe('auto');
    expect(readTheme(undefined)).toBe('auto');
  });

  it('zabranjeno skladište ne obara čitanje', () => {
    expect(
      readTheme({
        getItem: () => {
          throw new Error('SecurityError');
        }
      })
    ).toBe('auto');
  });
});

describe('applyTheme', () => {
  it('ručni izbor postavlja atribut i obe trake pregledača na istu boju', () => {
    applyTheme('dark', document, () => false);
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(colors()).toEqual([THEME_COLOR.dark, THEME_COLOR.dark]);
    applyTheme('light', document, () => true);
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(colors()).toEqual([THEME_COLOR.light, THEME_COLOR.light]);
  });

  it('„prati sistem“ skida atribut i vraća svetlu/tamnu traku po svom `media` pravilu', () => {
    applyTheme('dark', document, () => false);
    applyTheme('auto', document, () => true);
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
    expect(colors()).toEqual([THEME_COLOR.light, THEME_COLOR.dark]);
  });
});

describe('saveTheme', () => {
  it('čuva izbor i odmah ga primenjuje; „prati sistem“ briše zapis', () => {
    const st = mem();
    saveTheme('dark', st, document);
    expect(st.d.get(THEME_KEY)).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    saveTheme('auto', st, document);
    expect(st.d.has(THEME_KEY)).toBe(false);
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });

  it('javlja pretplatnicima; odjava prekida obaveštavanje', () => {
    const fn = vi.fn();
    const off = subscribeTheme(fn);
    saveTheme('light', mem(), document);
    expect(fn).toHaveBeenCalledTimes(1);
    off();
    saveTheme('dark', mem(), document);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('zabranjeno skladište (privatni režim): promena ipak važi dok je stranica otvorena', () => {
    const broken = {
      setItem: () => {
        throw new Error('QuotaExceeded');
      },
      removeItem: () => {
        throw new Error('QuotaExceeded');
      }
    };
    expect(() => saveTheme('dark', broken, document)).not.toThrow();
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });
});

describe('public/tema.js (pre prvog iscrtavanja) se slaže sa lib/theme.ts', () => {
  const script = SCRIPT;
  const run = (stored: string | null): void => {
    const store = stored == null ? {} : { [THEME_KEY]: stored };
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => (k in store ? (store as Record<string, string>)[k] : null)
    });
    /* Izvršava STVARNU skriptu (ne kopiju njene logike), kao `uvod.test.ts`. */
    /* eslint-disable-next-line @typescript-eslint/no-implied-eval */
    (new Function(script) as () => void)();
    vi.unstubAllGlobals();
  };

  it('koristi isti ključ i iste boje trake', () => {
    expect(script).toContain(`'${THEME_KEY}'`);
    expect(script).toContain(`'${THEME_COLOR.dark}'`);
    expect(script).toContain(`'${THEME_COLOR.light}'`);
  });

  it('tamna i svetla se primenjuju, ostalo ne dira ništa', () => {
    run('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(colors()).toEqual([THEME_COLOR.dark, THEME_COLOR.dark]);
    run('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(colors()).toEqual([THEME_COLOR.light, THEME_COLOR.light]);
    document.documentElement.removeAttribute('data-theme');
    run('nesto');
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
    run(null);
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });
});

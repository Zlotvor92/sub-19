import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SCRIPT from '../../public/uvod.js?raw';

/* parity: test/uvod.test.mjs („Uvodni ekran — kad se prikazuje"). Izvršava se STVARNI `public/uvod.js` nad jsdom dokumentom. */

/** Izvršava STVARNU skriptu (ne kopiju njene logike) — jedino mesto u testovima gde je `Function` opravdan. */
function execute(): void {
  /* eslint-disable-next-line @typescript-eslint/no-implied-eval */
  const fn = new Function(SCRIPT) as () => void;
  fn();
}

function run(
  opts: { seen?: boolean; reduced?: boolean; broken?: boolean } = {}
): HTMLElement | null {
  document.body.innerHTML = '<div id="uvod"></div><div id="root"></div>';
  document.body.className = '';
  sessionStorage.clear();
  if (opts.seen) sessionStorage.setItem('sub20-uvod', '1');
  window.matchMedia = ((q: string) => ({
    matches: !!opts.reduced && q.includes('reduce'),
    media: q
  })) as unknown as typeof window.matchMedia;
  if (opts.broken)
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('zabranjeno');
    });
  execute();
  return document.getElementById('uvod');
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('uvodni ekran — kad se prikazuje', () => {
  it('hladan start: ostaje na ekranu i zaključa skrolovanje', () => {
    const el = run();
    expect(el).not.toBeNull();
    expect(document.body.classList.contains('uvod-radi')).toBe(true);
  });

  it('hladan start upisuje trag, da se drugi put ne ponovi', () => {
    run();
    expect(sessionStorage.getItem('sub20-uvod')).toBe('1');
  });

  it('toplo pokretanje (osvežavanje, povratak iz pozadine, „Osveži"): sklanja se odmah', () => {
    const el = run({ seen: true });
    expect(el).toBeNull();
    expect(document.body.classList.contains('uvod-radi')).toBe(false);
  });

  it('smanjeno kretanje: sklanja se odmah, i na hladnom startu, a trag se ipak upisuje', () => {
    expect(run({ reduced: true })).toBeNull();
    expect(sessionStorage.getItem('sub20-uvod')).toBe('1');
  });

  it('sam se uklanja posle 1,55 s (posle kraja CSS animacije, ne pre) i otključava skrol', () => {
    run();
    vi.advanceTimersByTime(1549);
    expect(document.getElementById('uvod')).not.toBeNull();
    vi.advanceTimersByTime(2);
    expect(document.getElementById('uvod')).toBeNull();
    expect(document.body.classList.contains('uvod-radi')).toBe(false);
  });

  it('dodir preskače: klasa `gasi`, uklanjanje posle 0,24 s, stari rok je otkazan', () => {
    const el = run() as HTMLElement;
    el.dispatchEvent(new Event('pointerdown'));
    expect(el.classList.contains('gasi')).toBe(true);
    vi.advanceTimersByTime(239);
    expect(document.getElementById('uvod')).not.toBeNull();
    vi.advanceTimersByTime(2);
    expect(document.getElementById('uvod')).toBeNull();
    // drugi dodir (jednokratan slušalac) ne radi ništa
    el.dispatchEvent(new Event('pointerdown'));
    vi.advanceTimersByTime(5000);
    expect(document.body.classList.contains('uvod-radi')).toBe(false);
  });

  it('privatni režim (sessionStorage zabranjen): uvod se vidi, ništa ne puca', () => {
    expect(() => run({ broken: true })).not.toThrow();
    expect(document.getElementById('uvod')).not.toBeNull();
  });

  it('stranica bez #uvod: skripta ćuti', () => {
    document.body.innerHTML = '';
    expect(execute).not.toThrow();
  });
});

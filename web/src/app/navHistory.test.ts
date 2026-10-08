import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useUIStore } from '../stores/uiStore';
import { startNavHistory, navBack, type NavHistory } from './navHistory';

/* Lažna istorija pregledača: pamti unose, a `back`/`go` šalju `popstate` SINHRONO (pravi pregledač to radi asinhrono, ali redosled je isti). */
function fakeWindow() {
  const listeners = new Set<() => void>();
  let index = 0;
  let size = 1;
  const win = {
    history: {
      pushState: () => {
        index += 1;
        size = index + 1;
      },
      go: (d: number) => {
        index = Math.max(0, Math.min(size - 1, index + d));
        for (const l of [...listeners]) l();
      },
      back: () => win.history.go(-1)
    },
    addEventListener: (_t: 'popstate', fn: () => void) => void listeners.add(fn),
    removeEventListener: (_t: 'popstate', fn: () => void) => void listeners.delete(fn)
  };
  return { win, pos: () => index };
}

const ui = () => useUIStore.getState();
let nav: NavHistory | null = null;

beforeEach(() => {
  useUIStore.setState({ tab: 'danas', screens: [], sheet: null });
});
afterEach(() => {
  nav?.stop();
  nav = null;
});

describe('istorija ekrana', () => {
  it('svaki otvoren ekran dobija jedan unos, a taster „Nazad“ zatvara ekran, ne aplikaciju', () => {
    const f = fakeWindow();
    nav = startNavHistory(f.win);
    ui().openScreen({ kind: 'trening', props: { id: 'g1d1' } });
    ui().openScreen({ kind: 'forma' });
    expect(nav.depth()).toBe(2);
    expect(f.pos()).toBe(2);
    f.win.history.back(); // pravi taster
    expect(ui().screens.map((s) => s.kind)).toEqual(['trening']);
    expect(nav.depth()).toBe(1);
    f.win.history.back();
    expect(ui().screens).toEqual([]);
    expect(f.pos()).toBe(0);
  });

  it('list se zatvara pre ekrana ispod njega', () => {
    const f = fakeWindow();
    nav = startNavHistory(f.win);
    ui().openScreen({ kind: 'trening', props: { id: 'g1d1' } });
    ui().openSheet({ kind: 'swap', props: { w: 1 } });
    expect(nav.depth()).toBe(2);
    f.win.history.back();
    expect(ui().sheet).toBeNull();
    expect(ui().screens).toHaveLength(1);
  });

  it('promena taba zatvara ekrane i vraća istoriju jednim skokom, bez zatvaranja bilo čega drugog', () => {
    const f = fakeWindow();
    nav = startNavHistory(f.win);
    ui().openScreen({ kind: 'plan-pregled' });
    ui().openScreen({ kind: 'trening', props: { id: 'x' } });
    ui().setTab('ti');
    expect(ui().screens).toEqual([]);
    expect(nav.depth()).toBe(0);
    expect(f.pos()).toBe(0);
    ui().openScreen({ kind: 'profil' });
    expect(ui().screens).toHaveLength(1);
    expect(f.pos()).toBe(1);
  });

  it('dugme „Nazad“ u aplikaciji ide istim putem kao sistemski taster', () => {
    const f = fakeWindow();
    nav = startNavHistory(f.win);
    ui().openScreen({ kind: 'oporavak' });
    navBack();
    expect(ui().screens).toEqual([]);
    expect(f.pos()).toBe(0);
  });

  it('otvaranje ekrana iz lista zamenjuje list (isti broj slojeva, nijedan nov unos)', () => {
    const f = fakeWindow();
    nav = startNavHistory(f.win);
    ui().openSheet({ kind: 'alt', props: { id: 'x' } });
    expect(nav.depth()).toBe(1);
    ui().openScreen({ kind: 'trening', props: { id: 'x' } });
    expect(ui().sheet).toBeNull();
    expect(nav.depth()).toBe(1);
  });

  it('bez ijednog sloja taster „Nazad“ ne dira stanje (aplikaciju napušta pregledač)', () => {
    const f = fakeWindow();
    nav = startNavHistory(f.win);
    f.win.history.go(0);
    expect(ui().screens).toEqual([]);
    expect(nav.depth()).toBe(0);
  });
});

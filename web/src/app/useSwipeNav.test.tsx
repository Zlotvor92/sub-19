import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Ambient, Page, Tabbar } from '../components/ui/Shell';
import { TABS, useUIStore } from '../stores/uiStore';
import { useSwipeNav } from './useSwipeNav';

/* parity: blok „PREVLAČENJE" (app.js) + test/prevlacenje.test.mjs — ponašanje slušalaca dodira nad pravim DOM-om. */

function Harness({ enabled = true }: { enabled?: boolean }) {
  useSwipeNav(enabled);
  const tab = useUIStore((s) => s.tab);
  const entering = useUIStore((s) => s.entering);
  const peek = useUIStore((s) => s.peek);
  return (
    <div>
      <Ambient tab={tab} settingsOpen={false} />
      <header />
      <main>
        {TABS.map((t) => (
          <Page key={t} id={t} active={t === tab} entering={t === entering} peek={t === peek}>
            <span data-testid={`sadrzaj-${t}`}>{t}</span>
            {t === 'danas' ? <input aria-label="polje" /> : null}
          </Page>
        ))}
      </main>
      <Tabbar />
    </div>
  );
}

const fire = (
  type: string,
  points: Array<[number, number]>,
  target: Element = document.body
): Event => {
  const e = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(e, 'touches', {
    value: points.map(([x, y]) => ({ clientX: x, clientY: y }))
  });
  act(() => {
    target.dispatchEvent(e);
  });
  return e;
};
const drag = (from: number, to: number, y = 300): Event => {
  fire('touchstart', [[from, y]]);
  const moved = fire('touchmove', [[to, y]]);
  return moved;
};
const settle = (): void => {
  act(() => {
    vi.advanceTimersByTime(700);
  });
};
const tab = (): string => useUIStore.getState().tab;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
  useUIStore.setState({ tab: 'danas', peek: null, entering: null });
  Object.defineProperty(window, 'innerWidth', { value: 400, configurable: true });
});
afterEach(() => {
  vi.useRealTimers();
  Reflect.deleteProperty(window, 'matchMedia');
});

describe('prevlačenje između tabova', () => {
  it('prst ulevo dovoljno daleko: susedni ekran se izvlači u kadar, a po dovršetku postaje aktivan (bez ponovne ulazne animacije)', () => {
    render(<Harness />);
    const e = drag(300, 150); // dx = -150 ≥ 28% od 400
    expect(e.defaultPrevented).toBe(true); // uspravno skrolovanje se odbija
    expect(useUIStore.getState().peek).toBe('plan');
    expect(screen.getByTestId('sadrzaj-plan')).toBeInTheDocument(); // sadržaj postoji pre ulaska
    const plan = document.getElementById('pg-plan') as HTMLElement;
    expect(plan.classList.contains('dolazi')).toBe(true);
    expect(plan.style.transform).toBe('translate3d(250.0px,0,0)'); // dx + širina
    expect((document.getElementById('pg-danas') as HTMLElement).style.transform).toBe(
      'translate3d(-150.0px,0,0)'
    );
    fire('touchend', []);
    // ikonica se menja PO PUŠTANJU, pre nego što ekran legne
    expect(document.querySelector('nav button.on')?.getAttribute('data-pg')).toBe('plan');
    expect(tab()).toBe('danas');
    settle();
    expect(tab()).toBe('plan');
    expect(useUIStore.getState().entering).toBeNull(); // doklizao je prstom — kartice se ne slažu po drugi put
    expect(useUIStore.getState().peek).toBeNull();
    expect(document.getElementById('pg-plan')?.classList.contains('dolazi')).toBe(false);
    expect(document.getElementById('pg-plan')?.getAttribute('style') ?? '').not.toContain(
      'transform'
    );
    expect(screen.queryByTestId('sadrzaj-danas')).toBeNull();
  });

  it('prst udesno vraća na prethodni tab', () => {
    useUIStore.setState({ tab: 'opor' });
    render(<Harness />);
    drag(50, 250);
    expect(useUIStore.getState().peek).toBe('plan');
    fire('touchend', []);
    settle();
    expect(tab()).toBe('plan');
  });

  it('prekratak pokret: ekran se vraća, tab ostaje, ništa ne visi', () => {
    render(<Harness />);
    drag(300, 220); // dx = -80 < 112
    fire('touchend', []);
    expect(document.querySelector('nav button.on')?.getAttribute('data-pg')).toBe('danas');
    settle();
    expect(tab()).toBe('danas');
    expect(useUIStore.getState().peek).toBeNull();
    expect(document.getElementById('pg-plan')?.classList.contains('dolazi')).toBe(false);
    expect(document.getElementById('pg-danas')?.getAttribute('style') ?? '').not.toContain(
      'transform'
    );
  });

  it('brz flik prolazi i pre praga', () => {
    render(<Harness />);
    fire('touchstart', [[300, 300]]);
    act(() => {
      vi.advanceTimersByTime(10);
    });
    fire('touchmove', [[260, 300]]);
    act(() => {
      vi.advanceTimersByTime(10);
    });
    fire('touchmove', [[240, 300]]); // 20 px za 10 ms = 2 px/ms, dx = -60
    fire('touchend', []);
    settle();
    expect(tab()).toBe('plan');
  });

  it('uspravan pokret je skrol: ne menja tab i ne odbija se', () => {
    render(<Harness />);
    fire('touchstart', [[300, 300]]);
    const e = fire('touchmove', [[290, 200]]);
    expect(e.defaultPrevented).toBe(false);
    fire('touchend', []);
    settle();
    expect(tab()).toBe('danas');
    expect(useUIStore.getState().peek).toBeNull();
  });

  it('kraj niza: nema susednog ekrana, ekran samo popusti pa se vrati', () => {
    render(<Harness />);
    drag(100, 380); // prst udesno na prvom tabu, dx = +280
    expect(useUIStore.getState().peek).toBeNull();
    expect((document.getElementById('pg-danas') as HTMLElement).style.transform).toBe(
      'translate3d(70.0px,0,0)' // 280 × 0,34 = 95 → ograničeno na 70
    );
    fire('touchend', []);
    settle();
    expect(tab()).toBe('danas');
    expect(document.getElementById('pg-danas')?.getAttribute('style') ?? '').not.toContain(
      'transform'
    );
  });

  it('dodir koji počinje u polju za unos ili u pomerljivoj traci pripada njima', () => {
    render(<Harness />);
    const input = screen.getByLabelText('polje');
    fire('touchstart', [[300, 300]], input);
    const e = fire('touchmove', [[100, 300]]);
    expect(e.defaultPrevented).toBe(false);
    fire('touchend', []);
    expect(tab()).toBe('danas');

    const strip = document.createElement('div');
    strip.style.overflowX = 'auto';
    Object.defineProperty(strip, 'scrollWidth', { value: 900 });
    Object.defineProperty(strip, 'clientWidth', { value: 300 });
    document.body.append(strip);
    fire('touchstart', [[300, 300]], strip);
    expect(fire('touchmove', [[100, 300]]).defaultPrevented).toBe(false);
    fire('touchend', []);
    expect(tab()).toBe('danas');
    // skraćen tekst (širi od okvira, ali bez `overflow-x: auto|scroll`) NIJE pomerljiv
    const clipped = document.createElement('div');
    clipped.style.overflowX = 'hidden';
    Object.defineProperty(clipped, 'scrollWidth', { value: 900 });
    Object.defineProperty(clipped, 'clientWidth', { value: 300 });
    document.body.append(clipped);
    fire('touchstart', [[300, 300]], clipped);
    expect(fire('touchmove', [[100, 300]]).defaultPrevented).toBe(true);
    fire('touchend', []);
    settle();
    expect(tab()).toBe('plan');
    strip.remove();
    clipped.remove();
  });

  it('dva prsta (zumiranje) ne pokreću prevlačenje; drugi prst usred pokreta vraća ekran bez promene taba', () => {
    render(<Harness />);
    fire('touchstart', [
      [300, 300],
      [200, 300]
    ]);
    expect(
      fire('touchmove', [
        [100, 300],
        [100, 300]
      ]).defaultPrevented
    ).toBe(false);
    fire('touchend', []);

    fire('touchstart', [[300, 300]]);
    fire('touchmove', [[120, 300]]);
    expect(useUIStore.getState().peek).toBe('plan');
    fire('touchmove', [
      [120, 300],
      [50, 300]
    ]);
    settle();
    expect(tab()).toBe('danas');
    expect(useUIStore.getState().peek).toBeNull();
    expect(document.getElementById('pg-plan')?.classList.contains('dolazi')).toBe(false);
  });

  it('isključeno kretanje: tab se menja bez pomeranja, susedni se ne iscrtava', () => {
    window.matchMedia = ((q: string) => ({
      matches: q.includes('reduce'),
      media: q
    })) as unknown as typeof window.matchMedia;
    render(<Harness />);
    drag(300, 100);
    expect(useUIStore.getState().peek).toBeNull();
    expect((document.getElementById('pg-danas') as HTMLElement).style.transform).toBe('');
    fire('touchend', []);
    expect(tab()).toBe('plan'); // odmah, bez čekanja
  });

  it('kad nešto pokriva ekran (list, čarobnjak, kapija, uvod), prevlačenje je isključeno', () => {
    render(<Harness enabled={false} />);
    const e = drag(300, 100);
    expect(e.defaultPrevented).toBe(false);
    fire('touchend', []);
    settle();
    expect(tab()).toBe('danas');
  });

  it('novi dodir dok prethodni prelazak još leti: prethodni se dovršava ODMAH', () => {
    render(<Harness />);
    drag(300, 100);
    fire('touchend', []); // leti ka „plan"
    expect(tab()).toBe('danas');
    fire('touchstart', [[200, 300]]); // novi dodir
    expect(tab()).toBe('plan');
    fire('touchend', []);
  });

  it('ako je tab promenjen na drugi način dok ekran leti, zakasneli prelazak ne vuče nazad', () => {
    render(<Harness />);
    drag(300, 100);
    fire('touchend', []);
    act(() => useUIStore.getState().setTab('pred'));
    settle();
    expect(tab()).toBe('pred');
  });

  it('ambijentalno svetlo prati prst, a posle puštanja se vraća na klase', () => {
    render(<Harness />);
    drag(300, 100); // 200/400 = pola puta
    const amb = document.getElementById('ambijent') as HTMLElement;
    expect(amb.classList.contains('vuce')).toBe(true);
    expect(amb.querySelector<HTMLElement>('i[data-t="danas"]')?.style.opacity).toBe('0.5');
    expect(amb.querySelector<HTMLElement>('i[data-t="plan"]')?.style.opacity).toBe('0.5');
    fire('touchend', []);
    expect(amb.classList.contains('vuce')).toBe(false);
    expect(amb.querySelector<HTMLElement>('i[data-t="plan"]')?.style.opacity).toBe('');
    settle();
    expect(amb.querySelector('i.on')?.getAttribute('data-t')).toBe('plan');
  });
});

describe('ulazna animacija pri dodiru na ikonicu', () => {
  it('menjanje taba dodirom slaže kartice (`uskoci`) ~0,9 s; isti tab ne', () => {
    render(<Harness />);
    act(() => useUIStore.getState().setTab('plan'));
    expect(document.getElementById('pg-plan')?.classList.contains('uskoci')).toBe(true);
    act(() => {
      vi.advanceTimersByTime(899);
    });
    expect(document.getElementById('pg-plan')?.classList.contains('uskoci')).toBe(true);
    act(() => {
      vi.advanceTimersByTime(2);
    });
    expect(document.getElementById('pg-plan')?.classList.contains('uskoci')).toBe(false);
    act(() => useUIStore.getState().setTab('plan'));
    expect(document.getElementById('pg-plan')?.classList.contains('uskoci')).toBe(false);
  });
});

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useUIStore } from '../stores/uiStore';
import { useToday } from './useToday';

/* parity: test/danas.test.mjs (TODAY prati stvarni datum posle ponoći; povratak u aplikaciju osvežava dan). Sat se zamrzava sa `vi.setSystemTime`. */

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
  useUIStore.setState({ today: '' });
});
afterEach(() => vi.useRealTimers());

const at = (iso: string): void => {
  vi.setSystemTime(new Date(iso));
};

describe('„danas" dok aplikacija stoji otvorena', () => {
  it('prvi prikaz uzima LOKALNI datum', () => {
    at('2026-03-01T22:30:00');
    const { result } = renderHook(() => useToday());
    expect(result.current).toBe('2026-03-01');
  });

  it('prelazak ponoći: tajmer menja datum čim prođe ponoć, bez ijednog dodira', () => {
    at('2026-03-01T23:59:00');
    const { result } = renderHook(() => useToday());
    expect(result.current).toBe('2026-03-01');
    act(() => {
      vi.advanceTimersByTime(59_000); // 23:59:59 — još je isti dan
    });
    expect(result.current).toBe('2026-03-01');
    act(() => {
      vi.advanceTimersByTime(2_000); // 00:00:01
    });
    expect(result.current).toBe('2026-03-02');
  });

  it('tajmer se prezakazuje: sledeća ponoć se hvata i posle prve', () => {
    at('2026-03-01T23:59:30');
    const { result } = renderHook(() => useToday());
    act(() => {
      vi.advanceTimersByTime(31_000);
    });
    expect(result.current).toBe('2026-03-02');
    act(() => {
      vi.advanceTimersByTime(24 * 3600_000);
    });
    expect(result.current).toBe('2026-03-03');
  });

  it('povratak u aplikaciju (tajmer nije preživeo pozadinu): `visibilitychange` osvežava dan', () => {
    at('2026-03-01T20:00:00');
    const { result } = renderHook(() => useToday());
    at('2026-03-02T07:00:00'); // sat je otišao napred dok je tajmer spavao
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(result.current).toBe('2026-03-01'); // skrivena stranica ne osvežava
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(result.current).toBe('2026-03-02');
  });

  it('isti dan: ništa se ne menja (nema suvišnog iscrtavanja)', () => {
    at('2026-03-01T10:00:00');
    let renders = 0;
    renderHook(() => {
      renders++;
      return useToday();
    });
    const before = renders;
    at('2026-03-01T10:05:00');
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(renders).toBe(before);
  });

  it('skidanje: tajmer i slušalac nestaju', () => {
    at('2026-03-01T23:59:50');
    const { unmount } = renderHook(() => useToday());
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});

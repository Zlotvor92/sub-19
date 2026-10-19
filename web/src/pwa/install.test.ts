import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createElement } from 'react';
import {
  captureInstallPrompt,
  installKind,
  useInstallStore,
  type InstallPromptEvent
} from './install';
import { InstallButton } from '../components/ui/InstallButton';
import { AuthGate } from '../components/ui/Shell';
import { InstallSheet } from '../features/install/InstallSheet';
import { useUIStore } from '../stores/uiStore';

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15';
const IPAD = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15';
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/129.0';
const DESKTOP = 'Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0';

afterEach(() => {
  vi.restoreAllMocks();
  useInstallStore.setState({ prompt: null, installed: false });
  useUIStore.getState().closeSheet();
});

describe('installKind', () => {
  const env = { standalone: false, ua: ANDROID, touch: 5, hasPrompt: false };

  it('instalirana aplikacija nikad ne dobija dugme', () => {
    expect(installKind({ ...env, standalone: true, hasPrompt: true })).toBeNull();
  });

  it('događaj pregledača ima prednost pred uputstvom', () => {
    expect(installKind({ ...env, hasPrompt: true })).toBe('prompt');
    expect(installKind({ ...env, ua: DESKTOP, touch: 0, hasPrompt: true })).toBe('prompt');
  });

  it('iPhone i iPad (predstavlja se kao Mac, ali na dodir) dobijaju korake za Podeli', () => {
    expect(installKind({ ...env, ua: IPHONE })).toBe('ios');
    expect(installKind({ ...env, ua: IPAD, touch: 5 })).toBe('ios');
    expect(installKind({ ...env, ua: IPAD, touch: 0 })).toBeNull();
  });

  it('Android bez događaja dobija meni pregledača; računar bez događaja ništa', () => {
    expect(installKind(env)).toBe('android');
    expect(installKind({ ...env, ua: DESKTOP, touch: 0 })).toBeNull();
  });
});

function fakePrompt(outcome: 'accepted' | 'dismissed' = 'accepted') {
  const e = new Event('beforeinstallprompt', { cancelable: true }) as InstallPromptEvent;
  const prompt = vi.fn(() => Promise.resolve());
  Object.assign(e, { prompt, userChoice: Promise.resolve({ outcome }) });
  return { e, prompt };
}

describe('captureInstallPrompt', () => {
  it('čuva događaj (gasi Chrome-ovu traku) i briše ga posle instalacije', () => {
    captureInstallPrompt(window);
    const { e } = fakePrompt();
    window.dispatchEvent(e);
    expect(e.defaultPrevented).toBe(true);
    expect(useInstallStore.getState().prompt).toBe(e);
    window.dispatchEvent(new Event('appinstalled'));
    expect(useInstallStore.getState().prompt).toBeNull();
  });
});

describe('InstallButton', () => {
  const ua = (s: string) => vi.spyOn(window.navigator, 'userAgent', 'get').mockReturnValue(s);

  it('računar bez događaja: nema dugmeta', () => {
    ua(DESKTOP);
    render(createElement(InstallButton));
    expect(screen.queryByRole('button', { name: 'Instaliraj' })).toBeNull();
  });

  it('sa događajem: jedan dodir otvara sistemski dijalog, bez lista', async () => {
    ua(DESKTOP);
    const { e, prompt } = fakePrompt();
    useInstallStore.getState().set(e);
    render(createElement(InstallButton));
    await userEvent.click(screen.getByRole('button', { name: 'Instaliraj' }));
    await act(async () => {});
    expect(prompt).toHaveBeenCalledOnce();
    expect(useInstallStore.getState().prompt).toBeNull();
    expect(useUIStore.getState().sheet).toBeNull();
  });

  it('iPhone: dodir otvara list sa koracima', async () => {
    ua(IPHONE);
    render(createElement(InstallButton));
    await userEvent.click(screen.getByRole('button', { name: 'Instaliraj' }));
    expect(useUIStore.getState().sheet).toEqual({ kind: 'install', props: { kind: 'ios' } });
  });
});

describe('InstallSheet', () => {
  it('iPhone: koraci za Podeli i razlog (obaveštenja)', () => {
    render(createElement(InstallSheet, { kind: 'ios' }));
    expect(screen.getByText('Add to Home Screen')).toBeTruthy();
    const imgs = [...document.querySelectorAll<HTMLImageElement>('.sh-steps img')];
    expect(imgs).toHaveLength(4);
    /* Da fajlovi postoje u public/, drži `install-images.node.test.ts`. */
    for (const img of imgs)
      expect(img.getAttribute('src')).toMatch(/^\.\/instaliraj\/ios-\d-.+\.webp$/);
    expect(screen.getByText(/podsetnici za trening/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'U redu' })).toBeTruthy();
  });
});

describe('AuthGate', () => {
  const ua = (s: string) => vi.spyOn(window.navigator, 'userAgent', 'get').mockReturnValue(s);

  it('iPhone u Safariju: prvo instalacija sa koracima; prijava u pregledaču je sporedni izlaz', async () => {
    ua(IPHONE);
    const onLogin = vi.fn();
    render(createElement(AuthGate, { message: '', onLogin }));
    expect(screen.getByRole('heading', { name: 'Prvo instaliraj sub20' })).toBeTruthy();
    expect(screen.getByText('Add to Home Screen')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Prijavi se Google nalogom' })).toBeNull();
    await userEvent.click(
      screen.getByRole('button', { name: 'Ne mogu da instaliram — prijavi me u pregledaču' })
    );
    expect(onLogin).toHaveBeenCalledOnce();
  });

  it('posle instalacije iz Chrome-a: upućuje na aplikaciju sa početnog ekrana', () => {
    ua(ANDROID);
    useInstallStore.setState({ installed: true });
    render(createElement(AuthGate, { message: '', onLogin: vi.fn() }));
    expect(screen.getByRole('status').textContent).toMatch(/Otvori sub20 sa početnog ekrana/);
  });

  it('računar: obična prijava', () => {
    ua(DESKTOP);
    render(createElement(AuthGate, { message: '', onLogin: vi.fn() }));
    expect(screen.getByRole('heading', { name: 'Prijavi se da nastaviš' })).toBeTruthy();
  });
});

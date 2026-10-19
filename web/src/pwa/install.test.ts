import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createElement } from 'react';
import {
  INSTALL_SESSION_KEY,
  captureInstallPrompt,
  firstInSession,
  installKind,
  useInstallStore,
  type InstallPromptEvent
} from './install';
import { InstallSheet } from '../features/install/InstallSheet';
import { useUIStore } from '../stores/uiStore';

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15';
const IPAD = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15';
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/129.0';
const DESKTOP = 'Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0';

afterEach(() => {
  useInstallStore.getState().set(null);
  useUIStore.getState().closeSheet();
  window.sessionStorage.clear();
});

describe('installKind', () => {
  const env = { standalone: false, ua: ANDROID, touch: 5, hasPrompt: false };

  it('instalirana aplikacija nikad ne dobija list', () => {
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

describe('firstInSession', () => {
  it('prvi put da, posle (i posle osvežavanja kartice) ne', () => {
    expect(firstInSession(window)).toBe(true);
    expect(window.sessionStorage.getItem(INSTALL_SESSION_KEY)).toBe('1');
    expect(firstInSession(window)).toBe(false);
  });

  it('bez sessionStorage-a (privatni režim) list se vidi svaki put', () => {
    const w = {
      get sessionStorage(): Storage {
        throw new Error('SecurityError');
      }
    };
    expect(firstInSession(w)).toBe(true);
    expect(firstInSession(w)).toBe(true);
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

describe('InstallSheet', () => {
  it('„Instaliraj" otvara sistemski dijalog, troši događaj i zatvara list', async () => {
    const { e, prompt } = fakePrompt();
    useInstallStore.getState().set(e);
    useUIStore.getState().openSheet({ kind: 'install', props: { kind: 'prompt' } });
    render(createElement(InstallSheet, { kind: 'prompt' }));
    await userEvent.click(screen.getByRole('button', { name: 'Instaliraj' }));
    await act(async () => {});
    expect(prompt).toHaveBeenCalledOnce();
    expect(useInstallStore.getState().prompt).toBeNull();
    expect(useUIStore.getState().sheet).toBeNull();
  });

  it('iPhone: koraci za Podeli i razlog (obaveštenja), bez dugmeta Instaliraj', () => {
    render(createElement(InstallSheet, { kind: 'ios' }));
    expect(screen.getByText('Dodaj na početni ekran')).toBeTruthy();
    expect(screen.getByText(/podsetnici za trening/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Instaliraj' })).toBeNull();
    expect(screen.getByRole('button', { name: 'U redu' })).toBeTruthy();
  });
});

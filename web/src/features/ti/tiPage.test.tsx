import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { adaptGeneratedPlan } from '../../domain/plan/adapt';
import { seedState, type PersistedState } from '../../domain/state';
import { generatePlan } from '../../domain/training/generator/generatePlan';
import { ADMIN_UID } from '../../services/config';
import { THEME_KEY } from '../../lib/theme';
import { setApp } from '../../app/appContext';
import { createApp } from '../../app/createApp';
import { createKeyValueStore, type StorageLike } from '../../services/storage/kv';
import { hydratePersisted } from '../../stores';
import { useAuthStore } from '../../stores/authStore';
import { useUIStore } from '../../stores/uiStore';
import { AboutScreen, AppearanceScreen } from './screens';
import TiPage from './index';

/* Ti: ko si, koji je cilj i spisak sa jednim redom po temi. Ništa se ne podešava na početnoj — svaki red vodi na svoj ekran. */

function freshState(): PersistedState {
  const s = JSON.parse(JSON.stringify(seedState())) as PersistedState;
  const a = adaptGeneratedPlan(
    generatePlan({
      startDate: '2026-01-05',
      raceDate: '2026-04-12',
      raceDistM: 10000,
      pb: { distM: 10000, sec: 2700 },
      goalSec: 2520,
      weeklyKm: 40,
      runDays: 5,
      quality: 2,
      intensity: 'std',
      trainedRecently: true
    })
  );
  if (!a) throw new Error('plan');
  s.genPlan = { ...a, ulaz: { raceDistM: 10000, pb: { distM: 10000, sec: 2700 } } };
  return s;
}

class Mem implements StorageLike {
  d = new Map<string, string>();
  getItem(k: string): string | null {
    return this.d.get(k) ?? null;
  }
  setItem(k: string, v: string): void {
    this.d.set(k, v);
  }
  removeItem(k: string): void {
    this.d.delete(k);
  }
}

beforeEach(() => {
  setApp(
    createApp({
      kv: createKeyValueStore(new Mem()),
      fetcher: () => Promise.resolve(new Response('{}', { status: 404 })),
      now: () => Date.UTC(2026, 0, 14, 10, 0, 0),
      today: () => '2026-01-14',
      supabaseUrl: 'https://x.supabase.co',
      anonKey: 'anon',
      appVersion: '283',
      location: { hash: '', search: '', origin: 'https://sub-19.vercel.app', pathname: '/' },
      navigate: () => undefined,
      online: () => true
    })
  );
  hydratePersisted(freshState());
  useUIStore.setState({ today: '2026-01-14', screens: [], sheet: null, confirm: null });
  useAuthStore.setState({ configured: true, hasSession: false, userId: null, email: null });
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
});
afterEach(() => {
  cleanup();
  setApp(null);
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
});

describe('Ti (početna taba)', () => {
  it('neprijavljen: kaže gde su podaci; cilj i polazni rezultat su na vidiku', () => {
    render(<TiPage />);
    expect(screen.getByRole('heading', { level: 1, name: 'Ti' })).toBeInTheDocument();
    expect(screen.getByText('Nisi prijavljen')).toBeInTheDocument();
    expect(screen.getByText('Podaci su samo na ovom uređaju')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Trenutni cilj 42:00/ })).toBeInTheDocument();
    expect(screen.getByText('Polazni rezultat 10 km · 45:00')).toBeInTheDocument();
  });

  it('prijavljen: pokazuje nalog', () => {
    useAuthStore.setState({ hasSession: true, email: 'tester@x.rs' });
    render(<TiPage />);
    expect(screen.getByText('tester@x.rs')).toBeInTheDocument();
    expect(screen.getByText('Podaci se čuvaju na serveru')).toBeInTheDocument();
  });

  it('svaki red vodi na svoj ekran (jedan nivo dubine), cilj takođe', async () => {
    const user = userEvent.setup();
    render(<TiPage />);
    const go = async (name: RegExp, kind: string): Promise<void> => {
      await user.click(screen.getByRole('button', { name }));
      expect(useUIStore.getState().screens.at(-1)?.kind).toBe(kind);
    };
    await go(/^Trenutni cilj/, 'cilj');
    await go(/^Moj profil/, 'profil');
    await go(/^Zone i postavke treninga/, 'postavke-treninga');
    await go(/^Povezani servisi/, 'servisi');
    await go(/^Obaveštenja/, 'obavestenja');
    await go(/^Izgled aplikacije/, 'izgled');
    await go(/^Privatnost i podaci/, 'privatnost');
    await go(/^O aplikaciji/, 'o-aplikaciji');
  });

  it('red „Vlasnik“ vidi samo vlasnik', () => {
    const user = render(<TiPage />);
    expect(screen.queryByRole('button', { name: /^Vlasnik/ })).toBeNull();
    user.unmount();
    useAuthStore.setState({ hasSession: true, userId: ADMIN_UID });
    render(<TiPage />);
    expect(screen.getByRole('button', { name: /^Vlasnik/ })).toBeInTheDocument();
  });

  it('bez plana nema bloka sa ciljem, a ostalo radi', () => {
    hydratePersisted(JSON.parse(JSON.stringify(seedState())) as PersistedState);
    useAuthStore.setState({ userId: 'neko-drugi' });
    render(<TiPage />);
    expect(screen.queryByRole('button', { name: /^Trenutni cilj/ })).toBeNull();
    expect(screen.getByRole('button', { name: /^Moj profil/ })).toBeInTheDocument();
  });
});

describe('Izgled aplikacije', () => {
  it('podrazumevano prati sistem; izbor se čuva po uređaju i odmah primenjuje', async () => {
    const user = userEvent.setup();
    render(<AppearanceScreen />);
    expect(screen.getByRole('button', { name: 'Prati sistem' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    await user.click(screen.getByRole('button', { name: 'Tamna' }));
    expect(localStorage.getItem(THEME_KEY)).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(screen.getByRole('button', { name: 'Tamna' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('button', { name: 'Svetla' }));
    expect(localStorage.getItem(THEME_KEY)).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    await user.click(screen.getByRole('button', { name: 'Prati sistem' }));
    expect(localStorage.getItem(THEME_KEY)).toBeNull();
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });

  it('red na početnoj Ti pokazuje izabranu temu čim se promeni', async () => {
    const user = userEvent.setup();
    render(
      <>
        <TiPage />
        <AppearanceScreen />
      </>
    );
    expect(
      screen.getByRole('button', { name: /^Izgled aplikacije\s*Prati sistem/ })
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Tamna' }));
    expect(screen.getByRole('button', { name: /^Izgled aplikacije\s*Tamna/ })).toBeInTheDocument();
  });

  it('izbor ne ide u sinhronizovano stanje (oblik stanja se zbog izgleda ne dira)', async () => {
    const user = userEvent.setup();
    render(<AppearanceScreen />);
    const { collectPersisted } = await import('../../stores');
    const before = JSON.stringify(collectPersisted());
    await user.click(screen.getByRole('button', { name: 'Tamna' }));
    expect(JSON.stringify(collectPersisted())).toBe(before);
  });
});

describe('O aplikaciji', () => {
  it('verzija, šema i broj zapisa na uređaju; veze ka uputstvu i politici privatnosti', () => {
    render(<AboutScreen />);
    expect(screen.getByRole('heading', { level: 1, name: 'O aplikaciji' })).toBeInTheDocument();
    expect(screen.getByText(/^Verzija .* · šema v\d+/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Uputstvo/ })).toHaveAttribute(
      'href',
      './uputstvo.html'
    );
    expect(screen.getAllByRole('link', { name: /Politika privatnosti/ })[0]).toHaveAttribute(
      'href',
      './privacy.html'
    );
  });
});

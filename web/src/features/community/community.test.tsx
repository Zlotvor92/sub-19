import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setApp } from '../../app/appContext';
import type { App } from '../../app/createApp';
import { cleanProfiles } from '../../domain/community';
import { useAuthStore } from '../../stores/authStore';
import { useCommunityStore } from '../../stores/communityStore';
import { useUIStore } from '../../stores/uiStore';
import Page from './index';

/* parity: renderZajednica, zajSpisak, zajProfil (app.js) — poredi se TEKST ekrana sa starim HTML-om (isti redosled i isti sadržaj); stanja ekrana. */

function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rawProfiles = (n: number): unknown[] => {
  const r = rng(5);
  return Array.from({ length: n }, (_, i) => ({
    user_id: `u${i}`,
    vidljiv: true,
    nadimak: i % 4 === 3 ? null : ['Marko', 'Ana Marija', 'Jelena', 'Petar'][i % 4],
    avatar_url: i % 3 === 0 ? 'https://lh3.googleusercontent.com/a/x=s96-c' : null,
    cilj: ['5K', '10K', '21K', '42K'][i % 4],
    trka_datum: '2026-12-13',
    nedelja_br: 5 + i,
    nedelja_od: 14,
    vdot: r() < 0.9 ? 44 + Math.round(r() * 80) / 10 : null,
    vdot_pocetni: r() < 0.9 ? 43 + Math.round(r() * 30) / 10 : null,
    test3k_sec: r() < 0.7 ? 640 + Math.floor(r() * 200) : null,
    km_nedelja: r() < 0.9 ? Math.round(r() * 600) / 10 : null,
    plan_pct: r() < 0.9 ? Math.floor(r() * 101) : null,
    niz_dana: Math.floor(r() * 40),
    izazov_od: i % 5 === 4 ? null : 4 + (i % 3),
    izazov_ura: Math.floor(r() * 7),
    znacke: i % 2 ? ['Niz 7 dana', 'Test na 3 km'] : [],
    trcanja:
      i % 3 === 1
        ? []
        : [
            { d: '2026-07-10', t: 'Lako', o: '8 km', p: '5:30 /km' },
            { d: '2026-07-08', t: 'Intervali', o: '10 km', p: '—' }
          ]
  }));
};

const text = (el: Element): string => (el.textContent ?? '').replace(/\s+/g, ' ').trim();

const community = { refreshIfDue: vi.fn(), load: vi.fn() };
beforeEach(() => {
  community.refreshIfDue.mockReset();
  community.load.mockReset();
  setApp({ community } as unknown as App);
  useAuthStore.setState({ hasSession: true, userId: 'u2' });
  useCommunityStore.setState({
    zajed: { vidljiv: true, nadimak: '' },
    profiles: null,
    challenge: null,
    loading: false,
    error: null,
    loadedAt: 0,
    filter: 'sve',
    measure: 't3k',
    opened: null
  });
  useUIStore.setState({ sheet: null });
});
afterEach(() => setApp(null));

describe('Zajednica — ekran', () => {
  it('stanja: bez naloga, isključena, povlači se, greška sa razlogom i ponovnim pokušajem', async () => {
    act(() => useAuthStore.setState({ hasSession: false }));
    const a = render(<Page />);
    expect(text(a.container)).toBe(
      'ZajednicaZajednica traži nalog, jer se spisak čuva na serveru.Prijavi se u Podešavanjima.'
    );
    a.unmount();

    act(() => useAuthStore.setState({ hasSession: true }));
    act(() => useCommunityStore.setState({ zajed: { vidljiv: false, nadimak: '' } }));
    const b = render(<Page />);
    expect(screen.getByText('isključena')).toBeInTheDocument();
    expect(screen.getByText(/ne vidiš tuđe profile/)).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Uključi u Podešavanjima' }));
    expect(useUIStore.getState().sheet).toMatchObject({ kind: 'settings' });
    expect(community.refreshIfDue).not.toHaveBeenCalled(); // isključena: ništa tuđe se ne povlači
    b.unmount();

    act(() => useCommunityStore.setState({ zajed: { vidljiv: true, nadimak: '' }, loading: true }));
    const c = render(<Page />);
    expect(screen.getByText('Povlačim spisak…')).toBeInTheDocument();
    expect(community.refreshIfDue).toHaveBeenCalled();
    c.unmount();

    act(() => useCommunityStore.setState({ loading: false, error: 'nema-tabele' }));
    const d = render(<Page />);
    expect(screen.getByText(/Tabele Zajednice još nema u bazi/)).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Pokušaj ponovo' }));
    expect(community.load).toHaveBeenCalledTimes(1);
    d.unmount();
  });

  it('klik na red otvara profil, „← Zajednica" vraća; tuđa adresa slike koja nije https se ne postavlja', async () => {
    const profiles = cleanProfiles([
      ...rawProfiles(3),
      { user_id: 'evil', nadimak: 'Zlo', avatar_url: 'https://x.rs/a&#34;;position:fixed' }
    ]);
    act(() => useCommunityStore.setState({ profiles }));
    const view = render(<Page />);
    expect(view.container.querySelectorAll('.zav i').length).toBe(3); // samo u0 ima ispravnu adresu (po jednom u tri liste)
    expect(view.container.innerHTML).not.toContain('position:fixed');
    const user = userEvent.setup();
    await user.click(
      screen.getAllByRole('button').find((b) => /Marko/.test(b.textContent ?? '')) as HTMLElement
    );
    expect(useCommunityStore.getState().opened).toBe('u0');
    await user.click(screen.getByRole('button', { name: '← Zajednica' }));
    await waitFor(() => expect(useCommunityStore.getState().opened).toBeNull());
  });
});

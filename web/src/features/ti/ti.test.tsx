import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeSupabase, type FakeSupabase } from '@/test/fakeSupabase';
import { adaptGeneratedPlan } from '../../domain/plan/adapt';
import type { GeoPort } from '../../services/weather/weatherSync';
import { seedState, type PersistedState } from '../../domain/state';
import { generatePlan } from '../../domain/training/generator/generatePlan';
import type { PlanGenerationInput } from '../../domain/training/types';
import { setApp } from '../../app/appContext';
import { createApp } from '../../app/createApp';
import { collectPersisted, hydratePersisted, useTrainingStore } from '../../stores';
import { useAuthStore } from '../../stores/authStore';
import { useUIStore } from '../../stores/uiStore';
import { ADMIN_UID } from '../../services/config';
import { LS_KEY, SB_KEY } from '../../services/storage/keys';
import { createKeyValueStore, type StorageLike } from '../../services/storage/kv';
import { emptySession } from '../../services/supabase/session';
import { AdjustPlan } from '../plan/AdjustPlan';
import { Advisories } from '../today/Advisories';
import { SheetHost } from '../sheets';
import {
  GoalScreen,
  IcuScreen,
  OwnerScreen,
  PrivacyScreen,
  ProfileScreen,
  ServicesScreen,
  StravaScreen,
  TrainingSettingsScreen,
  WatchScreen
} from './screens';
import TiPage from './index';

const download = vi.hoisted(() => vi.fn());
vi.mock('../../lib/download', () => ({ downloadText: download }));

/* parity: openSettings, openObrisiNalogSheet, openBugSheet, openIstorijaSheet, exportBackup/importBackup (app.js) — sada ekrani taba Ti (profil, cilj, zone i
   vreme, servisi, privatnost i podaci, vlasnik) i listovi (brisanje naloga, prijava problema, ranije verzije). Radnje nad planom (preračunavanje, novi plan)
   su u Plan → Prilagodi plan. Zajednica i njena podešavanja više ne postoje u aplikaciji. */

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
const b64 = (o: unknown): string =>
  btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(o))))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
const token = `${b64({ alg: 'x' })}.${b64({ sub: 'u1', email: 'tester@x.rs' })}.s`;

const INPUT: PlanGenerationInput = {
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
};
function stateWithPlan(): PersistedState {
  const s = JSON.parse(JSON.stringify(seedState())) as PersistedState;
  const a = adaptGeneratedPlan(generatePlan(INPUT));
  if (!a) throw new Error('plan');
  s.genPlan = { ...a, ulaz: INPUT };
  return s;
}

interface Ctx {
  fake: FakeSupabase;
  store: Mem;
  extra: Array<{ url: string; init: RequestInit }>;
  api: Map<string, (init: RequestInit) => Response>;
  navigate: ReturnType<typeof vi.fn>;
  app: ReturnType<typeof createApp>;
}
function boot(signedIn: boolean, state: PersistedState = stateWithPlan(), geo?: GeoPort): Ctx {
  const fake = createFakeSupabase();
  const store = new Mem();
  store.setItem(LS_KEY, JSON.stringify(state));
  if (signedIn)
    store.setItem(
      SB_KEY,
      JSON.stringify({
        ...emptySession('dME'),
        access: token,
        refresh: 'R1',
        userId: 'u1',
        email: 'tester@x.rs',
        expiresAt: fake.clock.value + 3600_000
      })
    );
  const extra: Ctx['extra'] = [];
  const api = new Map<string, (init: RequestInit) => Response>();
  const navigate = vi.fn();
  const app = createApp({
    kv: createKeyValueStore(store),
    fetcher: (url, init) => {
      if (
        url.startsWith('/api/') ||
        url.startsWith('https://www.strava.com') ||
        url.startsWith('https://api.open-meteo.com') ||
        url.includes('/rest/v1/zajednica')
      ) {
        extra.push({ url, init: init ?? {} });
        const h = [...api].find(([prefix]) => url.startsWith(prefix))?.[1];
        return Promise.resolve(h ? h(init ?? {}) : new Response('{}', { status: 404 }));
      }
      return fake.fetcher(url, init);
    },
    now: () => fake.clock.value,
    today: () => '2026-01-14',
    supabaseUrl: 'https://x.supabase.co',
    anonKey: 'anon',
    appVersion: '283',
    location: { hash: '', search: '', origin: 'https://sub-19.vercel.app', pathname: '/' },
    navigate,
    online: () => true,
    ...(geo ? { geo } : {})
  });
  setApp(app);
  return { fake, store, extra, api, navigate, app };
}
const bodyText = (init: RequestInit | undefined): string =>
  typeof init?.body === 'string' ? init.body : '{}';
const c0 = (): number => Date.UTC(2026, 6, 12, 10, 0, 0); // sat lažnog servera
const json = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const open = (kind: string): void => {
  act(() => useUIStore.getState().openSheet({ kind }));
};
/** Ekran + mesto za listove koje on otvara. */
const Host = ({ children }: { children?: ReactNode }) => (
  <>
    {children}
    <div id="sheet">
      <SheetHost />
    </div>
  </>
);
const Screen = () => <Host />;

beforeEach(() => {
  download.mockReset();
  hydratePersisted(seedState());
  useUIStore.setState({
    today: '2026-01-14',
    sheet: null,
    confirm: null,
    wizard: false,
    screens: []
  });
  useAuthStore.setState({
    configured: true,
    hasSession: false,
    gate: null,
    ready: true,
    email: null
  });
});
afterEach(() => setApp(null));

describe('Moj profil', () => {
  it('neprijavljen: kaže da nije prijavljen, dugme prijave vodi na Google', async () => {
    const user = userEvent.setup();
    const c = boot(false);
    render(
      <Host>
        <ProfileScreen />
      </Host>
    );
    expect(screen.getByText('Nisi prijavljen')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Prijavi se Google nalogom' }));
    expect(c.navigate).toHaveBeenCalledWith(
      expect.stringContaining('/auth/v1/authorize?provider=google')
    );
  });

  it('prijavljen: nalog, „Sinhronizuj" šalje na server, odjava traži potvrdu', async () => {
    const user = userEvent.setup();
    const c = boot(true);
    useAuthStore.setState({ hasSession: true, email: 'tester@x.rs' });
    render(
      <Host>
        <ProfileScreen />
      </Host>
    );
    expect(screen.getAllByText('tester@x.rs').length).toBeGreaterThan(0);
    await user.click(screen.getByRole('button', { name: 'Sinhronizuj' }));
    await waitFor(() => expect(c.fake.count('/rest/v1/user_state', 'POST')).toBeGreaterThan(0));
    await user.click(screen.getByRole('button', { name: 'Odjavi se' }));
    expect(useUIStore.getState().confirm?.text).toBe('Odjaviti se? Podaci na ovom uređaju ostaju.');
    act(() => useUIStore.getState().confirm?.resolve(true));
    await waitFor(() => expect(useAuthStore.getState().hasSession).toBe(false));
    expect(c.app.session.isAuthed()).toBe(false);
  });

  it('trkačko iskustvo: ono što je plan dobio pri pravljenju; ugrađeni plan to ne nosi', () => {
    boot(false);
    const first = render(
      <Host>
        <ProfileScreen />
      </Host>
    );
    expect(screen.getByText('Trkačko iskustvo')).toBeInTheDocument();
    expect(first.container.querySelectorAll('.facts > div').length).toBeGreaterThan(2);
    first.unmount();
    boot(false, JSON.parse(JSON.stringify(seedState())) as PersistedState);
    render(
      <Host>
        <ProfileScreen />
      </Host>
    );
    expect(screen.getByText(/Koristiš ugrađeni plan/)).toBeInTheDocument();
  });
});

describe('Privatnost i podaci', () => {
  it('izvoz backupa: preuzima fajl bez tokena, beleži datum, a upozorenje na Danas nestaje', async () => {
    const user = userEvent.setup();
    boot(false, {
      ...stateWithPlan(),
      strava: { access: 'STRAVA-SECRET' },
      icu: { athleteId: 'i1', token: 'icu-tok', lastPush: 1 },
      ui: { ...stateWithPlan().ui, lastBackup: '2026-01-01' }
    });
    useAuthStore.setState({ configured: false });
    render(
      <>
        <Advisories today="2026-01-14" />
        <PrivacyScreen />
      </>
    );
    expect(screen.getByText('Uradi backup podataka')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Izvezi backup' }));
    expect(download).toHaveBeenCalledTimes(1);
    const [name, text] = download.mock.calls[0] as [string, string];
    expect(name).toBe('sub19-backup-2026-01-14.json');
    expect(text).not.toContain('STRAVA-SECRET');
    expect(text).not.toContain('icu-tok');
    expect(collectPersisted().ui.lastBackup).toBe('2026-01-14');
    await waitFor(() => expect(screen.queryByText('Uradi backup podataka')).toBeNull());
    expect(screen.getByText(/^Poslednji backup: /)).toBeInTheDocument();
  });

  it('uvoz backupa: potvrda sa brojevima; potvrđen uvoz prepisuje podatke; pokvaren fajl se odbija bez promene', async () => {
    const user = userEvent.setup();
    boot(false);
    useAuthStore.setState({ configured: false });
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    const { container } = render(<PrivacyScreen />);
    const input = container.querySelector('#s-file') as HTMLInputElement;

    const bad = new File(
      ['{"app":"SUB-19","state":{"v":11,"log":{"\\"><img>":{"status":"done"}}}}'],
      'bad.json',
      {
        type: 'application/json'
      }
    );
    await user.upload(input, bad);
    await waitFor(() =>
      expect(alert).toHaveBeenCalledWith(expect.stringMatching(/neispravan identifikator/))
    );
    expect(Object.keys(useTrainingStore.getState().log)).toEqual([]);

    const good = JSON.stringify({
      app: 'SUB-19',
      state: { ...stateWithPlan(), log: { g1d1: { status: 'done', km: 5 } } }
    });
    await user.upload(input, new File([good], 'good.json', { type: 'application/json' }));
    await waitFor(() => expect(useUIStore.getState().confirm).not.toBeNull());
    expect(useUIStore.getState().confirm?.text).toMatch(
      /Uvoz će PREPISATI postojeće podatke\.\n\nU fajlu: 1 trening,/
    );
    act(() => useUIStore.getState().confirm?.resolve(true));
    await waitFor(() => expect(useTrainingStore.getState().log['g1d1']).toMatchObject({ km: 5 }));
    expect(await screen.findByText('Backup je uvezen.')).toBeInTheDocument();
    alert.mockRestore();
  });

  it('neprijavljenom kaže da je backup jedina kopija; prijavljenom nudi ranije verzije, prijavu problema i brisanje naloga', async () => {
    const user = userEvent.setup();
    boot(false);
    const out = render(
      <Host>
        <PrivacyScreen />
      </Host>
    );
    expect(screen.getByText(/samo na ovom uređaju/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ranije verzije' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Obriši nalog/ })).toBeNull();
    out.unmount();

    boot(true);
    useAuthStore.setState({ hasSession: true, email: 'tester@x.rs' });
    render(
      <Host>
        <PrivacyScreen />
      </Host>
    );
    await user.click(screen.getByRole('button', { name: 'Ranije verzije' }));
    expect(useUIStore.getState().sheet?.kind).toBe('history');
    act(() => useUIStore.getState().closeSheet());
    await user.click(screen.getByRole('button', { name: /Obriši nalog/ }));
    expect(useUIStore.getState().sheet?.kind).toBe('delete-account');
  });
});

describe('Cilj', () => {
  it('promena cilja: samo nedelje koje tek dolaze; potvrda; plan se zamenjuje, prošlost ostaje', async () => {
    const user = userEvent.setup();
    boot(false);
    useAuthStore.setState({ configured: false });
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    const before = useTrainingStore.getState().genPlan;
    render(<GoalScreen />);
    expect(screen.getByText('42:00')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Novo ciljno vreme'), '41:00');
    await user.click(screen.getByRole('button', { name: 'Promeni cilj' }));
    await waitFor(() => expect(useUIStore.getState().confirm).not.toBeNull());
    expect(useUIStore.getState().confirm?.text).toMatch(/^Promeniti ciljno vreme na 41:00\?/);
    act(() => useUIStore.getState().confirm?.resolve(true));
    await waitFor(() => expect(useTrainingStore.getState().genPlan).not.toBe(before));
    const after = useTrainingStore.getState().genPlan;
    expect((after?.meta as { goalSec?: number }).goalSec).toBe(2460);
    expect(after?.weeks[0]).toEqual(before?.weeks[0]); // N1 je prošla (14.1. je u N2)
    expect(alert).toHaveBeenCalledWith(expect.stringMatching(/^Cilj promenjen\./));
    alert.mockRestore();
  });

  it('generisan plan bez sačuvanih polaznih podataka: kaže zašto se cilj ne menja, ne laže da je ugrađen', () => {
    const s = stateWithPlan();
    if (s.genPlan) delete (s.genPlan as { ulaz?: unknown }).ulaz;
    boot(false, s);
    useAuthStore.setState({ configured: false });
    render(<GoalScreen />);
    expect(screen.getByText(/nema sačuvane polazne podatke/)).toBeInTheDocument();
    expect(screen.queryByText(/Ugrađeni plan ima svoj cilj/)).toBeNull();
    expect(screen.queryByLabelText('Novo ciljno vreme')).toBeNull();
  });

  it('nemoguć unos se odbija porukom, plan se ne menja', async () => {
    const user = userEvent.setup();
    boot(false);
    useAuthStore.setState({ configured: false });
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    const before = useTrainingStore.getState().genPlan;
    render(<GoalScreen />);
    await user.click(screen.getByRole('button', { name: 'Promeni cilj' }));
    expect(alert).toHaveBeenCalledWith(expect.stringMatching(/^Unesi ciljno vreme/));
    expect(useUIStore.getState().confirm).toBeNull();
    expect(useTrainingStore.getState().genPlan).toBe(before);
    alert.mockRestore();
  });

  it('ugrađeni plan: cilj se ne menja, nudi se novi plan', async () => {
    const user = userEvent.setup();
    boot(false, JSON.parse(JSON.stringify(seedState())) as PersistedState);
    useAuthStore.setState({ configured: true, hasSession: true, userId: ADMIN_UID });
    render(<GoalScreen />);
    expect(screen.queryByLabelText('Novo ciljno vreme')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Generiši novi plan' }));
    expect(useUIStore.getState().wizard).toBe(true);
  });
});

describe('Plan → Prilagodi plan: preračunavanje i novi plan', () => {
  const withForm = (vdot: number, measurements: number): PersistedState => {
    const s = stateWithPlan();
    s.vdotLog = Array.from({ length: measurements }, (_, i) => ({
      id: `t${i}`,
      ts: `2026-01-0${i + 6}`,
      vdot,
      prev: null,
      delta: null,
      measured: vdot
    }));
    return s;
  };
  const run = async (state: PersistedState) => {
    const user = userEvent.setup();
    boot(false, state);
    useAuthStore.setState({ configured: false });
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    render(<AdjustPlan />);
    await user.click(screen.getByRole('button', { name: /^Preračunaj plan prema formi/ }));
    return alert;
  };

  it('bez merenja forme: objašnjava zašto, plan se ne menja', async () => {
    const before = stateWithPlan().genPlan;
    const alert = await run(stateWithPlan());
    expect(alert).toHaveBeenCalledWith(expect.stringMatching(/bar 3 izmerena rezultata/));
    expect(useUIStore.getState().confirm).toBeNull();
    expect(useTrainingStore.getState().genPlan).toEqual(before);
    alert.mockRestore();
  });

  it('forma se slaže sa planom: kaže da nema šta da se preračuna', async () => {
    const planVdot = (stateWithPlan().genPlan?.meta as { vdot0: number }).vdot0;
    const alert = await run(withForm(planVdot, 3));
    expect(alert).toHaveBeenCalledWith(expect.stringMatching(/se slažu/));
    expect(useUIStore.getState().confirm).toBeNull();
    alert.mockRestore();
  });

  it('forma se razilazi: potvrda sa brojevima, pa preračunavanje; prošla nedelja ostaje, polazna forma lanca se čuva', async () => {
    const state = withForm(56, 3);
    const before = state.genPlan;
    const baseVdot = (before?.meta as { vdot0: number }).vdot0;
    const alert = await run(state);
    await waitFor(() => expect(useUIStore.getState().confirm).not.toBeNull());
    const text = useUIStore.getState().confirm?.text ?? '';
    expect(text).toMatch(/^Preračunati preostali plan prema izmerenoj formi\?/);
    expect(text).toMatch(/Izmerena forma: VDOT 56 · plan je očekivao: VDOT 45,3/);
    expect(text).toMatch(/Nema vraćanja/);
    act(() => useUIStore.getState().confirm?.resolve(true));
    await waitFor(() => expect(useTrainingStore.getState().genPlan).not.toEqual(before));
    const after = useTrainingStore.getState().genPlan;
    expect(after?.weeks[0]).toEqual(before?.weeks[0]); // N1 je prošla (14.1. je u N2)
    const m = after?.meta as { vdotBase?: number; recalWeek?: number; vdotAtRecal?: number };
    expect(m.vdotBase).toBe(baseVdot);
    expect(m.recalWeek).toBe(2);
    expect(m.vdotAtRecal).toBe(56);
    expect(useTrainingStore.getState().vdotLog).toHaveLength(3); // lanac forme se ne dira
    expect(alert).toHaveBeenCalledWith(expect.stringMatching(/^Plan preračunat\./));
    alert.mockRestore();
  });

  it('odustajanje u potvrdi ne menja ništa', async () => {
    const state = withForm(56, 3);
    const alert = await run(state);
    await waitFor(() => expect(useUIStore.getState().confirm).not.toBeNull());
    act(() => useUIStore.getState().confirm?.resolve(false));
    await waitFor(() => expect(useUIStore.getState().confirm).toBeNull());
    expect(useTrainingStore.getState().genPlan).toEqual(state.genPlan);
    alert.mockRestore();
  });

  it('nov plan: potvrda; plan i unosi uz njega nestaju, otvara se čarobnjak', async () => {
    const user = userEvent.setup();
    boot(false);
    useAuthStore.setState({ configured: false });
    act(() => useTrainingStore.getState().patchLog('g1d1', { status: 'done' }));
    render(<AdjustPlan />);
    await user.click(screen.getByRole('button', { name: /Napravi novi plan/ }));
    expect(useUIStore.getState().confirm?.text).toMatch(/TRAJNO brišu/);
    act(() => useUIStore.getState().confirm?.resolve(true));
    await waitFor(() => expect(useTrainingStore.getState().genPlan).toBeNull());
    expect(useTrainingStore.getState().log).toEqual({});
    expect(useUIStore.getState().wizard).toBe(true);
  });
});

describe('Strava', () => {
  it('nije povezana: prva stvar koja čeka; dugme vodi na Stravu', async () => {
    const user = userEvent.setup();
    const c = boot(false);
    useAuthStore.setState({ configured: false });
    render(<StravaScreen />);
    await user.click(screen.getByRole('button', { name: 'Poveži Stravu' }));
    expect(c.navigate).toHaveBeenCalledWith(
      expect.stringContaining('https://www.strava.com/oauth/authorize')
    );
  });

  it('„Pravila uvoza" kažu ono što kod radi: dva trčanja istog dana se SABIRAJU (stari tekst je tvrdio da se bira bliže planu)', async () => {
    const user = userEvent.setup();
    boot(false, { ...stateWithPlan(), strava: { access: 'A', refresh: 'R', expiresAt: 4e9 } });
    useAuthStore.setState({ configured: false });
    render(<StravaScreen />);
    await user.click(screen.getByText('Pravila uvoza'));
    expect(screen.getByText(/oba se broje u kilometražu/)).toBeInTheDocument();
    expect(screen.queryByText(/uzima se ono bliže planiranoj/)).toBeNull();
  });

  it('povezana: spisak servisa je pokazuje; uvoz traži/šalje i javlja ishod; otkačivanje traži potvrdu i čuva podatke', async () => {
    const user = userEvent.setup();
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    const c = boot(false, {
      ...stateWithPlan(),
      strava: {
        access: 'AT',
        refresh: 'RT',
        expiresAt: Math.floor(c0() / 1000) + 21600,
        athlete: 'Mika',
        lastSync: 0,
        zonesTs: c0(),
        hrZones: [
          { min: 0, max: 130 },
          { min: 130, max: null }
        ]
      }
    });
    useAuthStore.setState({ configured: false });
    c.api.set('https://www.strava.com/api/v3/athlete/activities', () => json(200, []));

    const list = render(<ServicesScreen />);
    expect(screen.getByText(/Mika · uvoz/)).toBeInTheDocument();
    list.unmount();

    const zones = render(<TrainingSettingsScreen />);
    expect(screen.getByText('0–130 bpm')).toBeInTheDocument();
    expect(screen.getByText('130+ bpm')).toBeInTheDocument();
    zones.unmount();

    render(<StravaScreen />);
    await user.click(screen.getByRole('button', { name: 'Uvezi trčanja' }));
    await waitFor(() =>
      expect(alert).toHaveBeenCalledWith(expect.stringMatching(/^Sinhronizacija gotova\./))
    );
    await user.click(screen.getByRole('button', { name: 'Otkači' }));
    expect(useUIStore.getState().confirm?.text).toMatch(/^Otkači Stravu\?/);
    act(() => useUIStore.getState().confirm?.resolve(true));
    await waitFor(() => expect(collectPersisted().strava).toBeNull());
    expect(Object.keys(useTrainingStore.getState().log)).toEqual([]); // uvezeni podaci ostaju (ovde ih nije ni bilo)
    alert.mockRestore();
  });
});

describe('intervals.icu i slanje na sat', () => {
  const linked = {
    athleteId: 'i77',
    token: 'icu-tok',
    scope: 'ACTIVITY:READ,WELLNESS:READ,SETTINGS:READ,CALENDAR:WRITE',
    lastSync: null
  };

  it('nije povezan: OAuth traži adresu sa servera i vodi na nju; ručni ključ proverava ID i dužinu pre poziva', async () => {
    const user = userEvent.setup();
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    const c = boot(true);
    useAuthStore.setState({ hasSession: true, configured: true });
    c.api.set('/api/icu-oauth', () =>
      json(200, { url: 'https://intervals.icu/oauth/authorize?x=1' })
    );
    render(<IcuScreen />);
    await user.click(document.querySelector('#icu-oauth') as HTMLElement);
    await waitFor(() =>
      expect(c.navigate).toHaveBeenCalledWith('https://intervals.icu/oauth/authorize?x=1')
    );
    expect(c.extra.some((e) => e.url.startsWith('/api/icu-oauth?akcija=url&state='))).toBe(true);

    await user.click(screen.getByText('Ručno povezivanje (ako gornje ne radi)'));
    await user.click(document.querySelector('#icu-on') as HTMLElement);
    expect(alert).toHaveBeenLastCalledWith('ID sportiste izgleda kao broj, npr. i123456.');
    await user.type(document.querySelector('#icu-id') as HTMLElement, 'i5');
    await user.type(document.querySelector('#icu-key') as HTMLElement, 'kratko');
    await user.click(document.querySelector('#icu-on') as HTMLElement);
    expect(alert).toHaveBeenLastCalledWith('API ključ deluje prekratak.');
    expect(c.extra.filter((e) => e.url === '/api/icu')).toHaveLength(0);
    alert.mockRestore();
  });

  it('povezan: „Povuci sve" imenuje šta je stiglo; otkačivanje traži potvrdu', async () => {
    const user = userEvent.setup();
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    const c = boot(true, { ...stateWithPlan(), icu: linked });
    useAuthStore.setState({ configured: true, hasSession: true, email: 'tester@x.rs' });
    c.api.set('/api/icu', (init) => {
      const sta = (JSON.parse(bodyText(init)) as { sta: string }).sta;
      if (sta === 'wellness') return json(200, { dani: [] });
      if (sta === 'zone') return json(200, { zone: null, razlog: null });
      return json(200, { treninzi: [] });
    });
    render(<IcuScreen />);
    expect(screen.getByText(/odobreno na intervals.icu/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Povuci sve' }));
    expect(
      await screen.findByRole('button', { name: /merenja 0 · trčanja 0 · krugovi 0 ✓/ })
    ).toBeInTheDocument();
    await user.click(document.querySelector('#icu-off') as HTMLElement);
    expect(useUIStore.getState().confirm?.text).toBe(
      'Otkačiti intervals.icu? Već povučeni podaci ostaju.'
    );
    act(() => useUIStore.getState().confirm?.resolve(true));
    await waitFor(() => expect(collectPersisted().icu).toBeNull());
    alert.mockRestore();
  });

  it('slanje na sat: pregled pokazuje tačno ono što odlazi; slanje traži potvrdu, pamti vreme i javlja ishod', async () => {
    const user = userEvent.setup();
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    const c = boot(true, { ...stateWithPlan(), icu: linked });
    useAuthStore.setState({ configured: true, hasSession: true, email: 'tester@x.rs' });
    c.api.set('/api/icu', () => json(200, { poslato: 7 }));
    render(<WatchScreen />);
    await user.click(document.querySelector('#icu-vidi') as HTMLElement);
    const box = document.querySelector('#icu-pregled') as HTMLElement;
    expect(box.querySelectorAll('pre').length).toBeGreaterThan(3);
    expect(box.textContent).toMatch(/Šalj(e se|u se) /);

    await user.click(document.querySelector('#icu-push') as HTMLElement);
    expect(useUIStore.getState().confirm?.text).toMatch(
      /^Poslati \d+ .* u intervals\.icu kalendar\?/
    );
    act(() => useUIStore.getState().confirm?.resolve(true));
    expect(await screen.findByRole('button', { name: 'Poslato 7 ✓' })).toBeInTheDocument();
    const sent = c.extra.find((e) => e.url === '/api/icu');
    expect(JSON.parse(bodyText(sent?.init))).toMatchObject({
      sta: 'workouts',
      athleteId: 'i77',
      token: 'icu-tok',
      rezim: 'azuriraj'
    });
    await waitFor(() =>
      expect(typeof (collectPersisted().icu as { lastPush?: unknown }).lastPush).toBe('number')
    );
    alert.mockRestore();
  });

  it('greška servera pri slanju: poruka sa detaljem, vreme slanja se ne upisuje', async () => {
    const user = userEvent.setup();
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    const c = boot(true, { ...stateWithPlan(), icu: linked });
    useAuthStore.setState({ configured: true, hasSession: true, email: 'tester@x.rs' });
    c.api.set('/api/icu', () => json(400, { error: 'Odbijeno', detail: 'No Target' }));
    render(<WatchScreen />);
    await user.click(document.querySelector('#icu-push') as HTMLElement);
    act(() => useUIStore.getState().confirm?.resolve(true));
    await waitFor(() => expect(alert).toHaveBeenCalledWith('Odbijeno — No Target'));
    expect(collectPersisted().icu).not.toHaveProperty('lastPush');
    alert.mockRestore();
  });
});

describe('Vreme i lokacija (Zone i postavke treninga)', () => {
  const okGeo: GeoPort = {
    available: () => true,
    denied: () => Promise.resolve(false),
    position: () => Promise.resolve({ lat: 44.80412, lon: 20.4649 }),
    inApp: () => false
  };
  const forecast = {
    hourly: {
      time: ['2026-01-14T18:00'],
      temperature_2m: [31],
      apparent_temperature: [34],
      relative_humidity_2m: [40],
      wind_speed_10m: [5],
      precipitation_probability: [0]
    }
  };

  it('uključivanje: koordinate se zaokružuju i čuvaju, prognoza stiže direktno sa Open-Meteo', async () => {
    const user = userEvent.setup();
    const c = boot(false, stateWithPlan(), okGeo);
    useAuthStore.setState({ configured: false });
    c.api.set('https://api.open-meteo.com/', () => json(200, forecast));
    render(<TrainingSettingsScreen />);
    expect(screen.getByRole('button', { name: 'Uključi lokaciju' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Osveži prognozu' })).toBeNull();
    await user.click(document.querySelector('#vr-on') as HTMLElement);
    await waitFor(() => expect(collectPersisted().ui.geo).toEqual({ lat: 44.8, lon: 20.46 }));
    await waitFor(() => expect(collectPersisted().vreme).not.toBeNull());
    const call = c.extra.find((e) => e.url.startsWith('https://api.open-meteo.com/'));
    expect(call?.url).toContain('latitude=44.8&longitude=20.46');
    expect(c.extra.some((e) => e.url.startsWith('/api/'))).toBe(false); // koordinate NIKAD ne idu na naš server
    expect(await screen.findByLabelText('U koliko sati obično trčiš')).toHaveValue('18');
  });

  it('sat treninga se pamti; isključivanje briše koordinate i prognozu', async () => {
    const user = userEvent.setup();
    boot(false, {
      ...stateWithPlan(),
      vreme: { at: 1, lat: 1, lon: 2, sati: {} },
      ui: { ...stateWithPlan().ui, geo: { lat: 1, lon: 2 } }
    });
    useAuthStore.setState({ configured: false });
    render(<TrainingSettingsScreen />);
    await user.selectOptions(screen.getByLabelText('U koliko sati obično trčiš'), '7');
    expect(collectPersisted().ui.satTreninga).toBe(7);
    await user.click(document.querySelector('#vr-off') as HTMLElement);
    expect(collectPersisted().ui.geo).toBeNull();
    expect(collectPersisted().vreme).toBeNull();
  });

  it('odbijena lokacija: poruka, ništa se ne čuva', async () => {
    const user = userEvent.setup();
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    boot(false, stateWithPlan(), {
      ...okGeo,
      position: () => Promise.reject(Object.assign(new Error('x'), { code: 1 }))
    });
    useAuthStore.setState({ configured: false });
    render(<TrainingSettingsScreen />);
    await user.click(document.querySelector('#vr-on') as HTMLElement);
    await waitFor(() =>
      expect(alert).toHaveBeenCalledWith(expect.stringMatching(/^Pristup lokaciji je odbijen\./))
    );
    expect(collectPersisted().ui.geo).toBeNull();
    alert.mockRestore();
  });
});

describe('Brisanje naloga', () => {
  it('dugme je zaključano dok se ne ukuca potvrda (Š→S, malim slovima); uspeh briše lokalne podatke i vraća kapiju', async () => {
    const user = userEvent.setup();
    const c = boot(true);
    c.api.set('/api/delete-account', () => json(200, { ok: true, obrisano: [] }));
    open('delete-account');
    render(<Screen />);
    const go = screen.getByRole('button', { name: 'Obriši nalog' });
    expect(go).toBeDisabled();
    await user.type(screen.getByLabelText('Potvrda brisanja'), 'obriši nalo');
    expect(go).toBeDisabled();
    await user.type(screen.getByLabelText('Potvrda brisanja'), 'g');
    expect(go).toBeEnabled();
    await user.click(go);
    await waitFor(() =>
      expect(useAuthStore.getState().gate).toBe('Nalog i svi podaci su obrisani.')
    );
    expect(JSON.parse(c.extra[0]?.init.body as string)).toEqual({ potvrda: 'OBRISI NALOG' });
    expect(c.store.getItem(LS_KEY)).toBeNull();
    expect(useTrainingStore.getState().genPlan).toBeNull();
    expect(useUIStore.getState().sheet).toBeNull();
  });

  it('greška servera: poruka se prikazuje, NIŠTA se lokalno ne briše', async () => {
    const user = userEvent.setup();
    const c = boot(true);
    c.api.set('/api/delete-account', () =>
      json(500, { error: 'Brisanje podataka nije uspelo — nalog nije obrisan.' })
    );
    open('delete-account');
    render(<Screen />);
    await user.type(screen.getByLabelText('Potvrda brisanja'), 'OBRISI NALOG');
    await user.click(screen.getByRole('button', { name: 'Obriši nalog' }));
    expect(await screen.findByText(/nalog nije obrisan/)).toBeInTheDocument();
    expect(c.store.getItem(LS_KEY)).not.toBeNull();
    expect(useTrainingStore.getState().genPlan).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Obriši nalog' })).toBeEnabled();
  });
});

describe('Prijava problema i ranije verzije', () => {
  it('prazan opis se odbija pre slanja; poslato se potvrđuje', async () => {
    const user = userEvent.setup();
    const c = boot(true);
    c.api.set('/api/report-bug', () => json(200, { ok: true }));
    open('bug');
    render(<Screen />);
    await user.click(screen.getByRole('button', { name: 'Pošalji' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Napiši šta se desilo.');
    expect(c.extra).toHaveLength(0);
    await user.type(screen.getByLabelText('Opis problema'), 'ne radi');
    await user.click(screen.getByRole('button', { name: 'Pošalji' }));
    expect(await screen.findByRole('button', { name: 'Poslato ✓' })).toBeInTheDocument();
    const body = JSON.parse(c.extra[0]?.init.body as string) as {
      description: string;
      context: { version: string };
    };
    expect(body.description).toBe('ne radi');
    expect(body.context.version).toBe('288');
  });

  it('ranije verzije: spisak sa servera, „Vrati" traži potvrdu i vraća stanje', async () => {
    const user = userEvent.setup();
    const c = boot(true);
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    c.fake.row = {
      data: stateWithPlan(),
      updated_at: '2026-01-10T10:00:00.000Z',
      device_id: 'dME'
    };
    c.fake.history = [
      {
        id: 3,
        napravljeno: '2026-01-02T08:30:00.000Z',
        app_version: '280',
        device_id: 'dDRUGI',
        data: { ...stateWithPlan(), log: { stara: { status: 'done' } } }
      }
    ];
    open('history');
    render(<Screen />);
    expect(await screen.findByText(/drugi uređaj/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Vrati' }));
    expect(useUIStore.getState().confirm?.text).toMatch(/^Vratiti podatke na /);
    act(() => useUIStore.getState().confirm?.resolve(true));
    await waitFor(() =>
      expect(useTrainingStore.getState().log).toEqual({ stara: { status: 'done' } })
    );
    expect(alert).toHaveBeenCalledWith(expect.stringMatching(/^Vraćeno na /));
    alert.mockRestore();
  });

  it('ranije verzije: server ne odgovara → poruka i „Pokušaj ponovo"', async () => {
    const c = boot(true);
    c.fake.offline = true;
    open('history');
    render(<Screen />);
    expect(await screen.findByText('Nema veze sa serverom.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pokušaj ponovo' })).toBeInTheDocument();
  });
});

describe('Vlasnik (samo vlasnik)', () => {
  const asOwner = (): void => {
    useAuthStore.setState({
      configured: true,
      hasSession: true,
      userId: ADMIN_UID,
      email: 'Vlasnik@X.rs'
    });
  };
  const send = (c: Ctx, fn: (b: Record<string, unknown>) => Response) =>
    c.api.set('/api/broadcast', (init) =>
      fn(JSON.parse(bodyText(init)) as Record<string, unknown>)
    );
  const bodies = (c: Ctx): Array<Record<string, unknown>> =>
    c.extra
      .filter((e) => e.url === '/api/broadcast')
      .map((e) => JSON.parse(bodyText(e.init)) as Record<string, unknown>);

  it('običan korisnik ne vidi red „Vlasnik“ ni ekran; vlasnik vidi oba', () => {
    boot(true);
    useAuthStore.setState({ configured: true, hasSession: true, userId: 'u1' });
    const first = render(<TiPage />);
    expect(screen.queryByText('Vlasnik')).toBeNull();
    first.unmount();
    const screenView = render(<OwnerScreen />);
    expect(screenView.container).toBeEmptyDOMElement();
    screenView.unmount();

    asOwner();
    const row = render(<TiPage />);
    expect(screen.getByText('Vlasnik')).toBeInTheDocument();
    row.unmount();
    render(<OwnerScreen />);
    expect(screen.getByRole('heading', { name: 'Obaveštenje korisnicima' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Korisnici' })).toBeInTheDocument();
  });

  it('spisak adresa: suvi poziv, BCC napomena, prazan spisak kaže da nema naloga', async () => {
    const user = userEvent.setup();
    const c = boot(true);
    asOwner();
    send(c, () => json(200, { primalaca: 2, primaoci: ['a@x.rs', 'b@x.rs'] }));
    render(<OwnerScreen />);
    await user.click(screen.getByRole('button', { name: /Spisak adresa/ }));
    expect(await screen.findByDisplayValue('a@x.rs, b@x.rs')).toBeInTheDocument();
    expect(screen.getByText(/2 adrese/)).toBeInTheDocument();
    expect(bodies(c)).toEqual([{}]); // ništa se ne šalje
  });

  it('proba na mene: šalje SAMO na adresu iz prijavljene sesije (malim slovima)', async () => {
    const user = userEvent.setup();
    const c = boot(true);
    asOwner();
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    send(c, () => json(200, { poslato: 1, palo: 0, sledeciOd: null }));
    render(<OwnerScreen />);
    await user.click(screen.getByRole('button', { name: 'Proba na mene' }));
    await waitFor(() => expect(alert).toHaveBeenCalled());
    expect(bodies(c)).toEqual([{ posalji: true, samoNa: ['vlasnik@x.rs'] }]);
    expect(alert).toHaveBeenCalledWith('Poslato na vlasnik@x.rs. Proveri sanduče — i spam.');
    alert.mockRestore();
  });

  it('pošalji svima: prvo prebroji, pita; odbijeno = ništa nije poslato; potvrđeno = krugovi po adresi', async () => {
    const user = userEvent.setup();
    const c = boot(true);
    asOwner();
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    send(c, (b) => {
      if (!b['posalji']) return json(200, { primalaca: 130, primaoci: [] });
      return b['posle']
        ? json(200, { poslato: 40, palo: 0, sledeciPosle: null, sledeciOd: null })
        : json(200, { poslato: 90, palo: 1, sledeciPosle: 'm@x.rs', sledeciOd: 91 });
    });
    render(<OwnerScreen />);

    await user.click(screen.getByRole('button', { name: 'Pošalji svima…' }));
    await waitFor(() => expect(useUIStore.getState().confirm).not.toBeNull());
    expect(useUIStore.getState().confirm?.text).toMatch(/^Poslati uputstvo na 130 adresa\?/);
    act(() => useUIStore.getState().confirm?.resolve(false));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Pošalji svima…' })).toBeEnabled()
    );
    expect(bodies(c).filter((b) => b['posalji'])).toEqual([]);

    await user.click(screen.getByRole('button', { name: 'Pošalji svima…' }));
    await waitFor(() => expect(useUIStore.getState().confirm).not.toBeNull());
    act(() => useUIStore.getState().confirm?.resolve(true));
    await waitFor(() => expect(alert).toHaveBeenCalledWith('Poslato: 130 · nije stiglo: 1'));
    expect(bodies(c).filter((b) => b['posalji'])).toEqual([
      { posalji: true, od: 0 },
      { posalji: true, posle: 'm@x.rs' }
    ]);
    alert.mockRestore();
  });

  it('korisnici: spisak, zabrana na jedan dodir, brisanje na dva sa lozinkom; sebe ne možeš', async () => {
    const user = userEvent.setup();
    const c = boot(true);
    asOwner();
    let banned = false;
    send(c, (b) => {
      switch (b['admin']) {
        case 'lista':
          return json(200, {
            ok: true,
            korisnici: [
              { id: ADMIN_UID, email: 'vlasnik@x.rs', jaSam: true, imaPodatke: true },
              {
                id: 'U2',
                email: 'ana@x.rs',
                poslednjaPrijava: '2026-01-10T08:00:00Z',
                imaPodatke: false,
                zabranjen: banned
              }
            ]
          });
        case 'zakazano':
          return json(200, { ok: true, zakazano: [] });
        default:
          if (b['admin'] === 'ban') banned = !b['ukini'];
          return json(200, { ok: true });
      }
    });
    open('users');
    render(<Screen />);
    expect(await screen.findByText('ana@x.rs')).toBeInTheDocument();
    expect(screen.getByText('2 naloga')).toBeInTheDocument();
    // vlasnik nema dugmad za sebe: samo jedan red ima Zabrani/Obriši
    expect(screen.getAllByRole('button', { name: 'Zabrani' })).toHaveLength(1);

    await user.type(document.querySelector('#ku-loz') as HTMLElement, 'tajna');
    await user.click(screen.getByRole('button', { name: 'Zabrani' }));
    expect(await screen.findByRole('button', { name: 'Odbrani' })).toBeInTheDocument();
    expect(bodies(c).find((b) => b['admin'] === 'ban')).toEqual({
      admin: 'ban',
      banId: 'U2',
      ukini: false,
      lozinka: 'tajna'
    });

    await user.click(screen.getByRole('button', { name: 'Obriši' }));
    expect(screen.getByRole('button', { name: 'Sigurno?' })).toBeInTheDocument();
    expect(bodies(c).some((b) => b['admin'] === 'obrisi')).toBe(false); // prvi dodir ne briše
    await user.click(screen.getByRole('button', { name: 'Sigurno?' }));
    await waitFor(() =>
      expect(bodies(c).find((b) => b['admin'] === 'obrisi')).toEqual({
        admin: 'obrisi',
        obrisiId: 'U2',
        lozinka: 'tajna'
      })
    );
  });

  it('korisnici: greška servera (pogrešna lozinka) se prikazuje; označeni za brisanje se vraćaju', async () => {
    const user = userEvent.setup();
    const c = boot(true);
    asOwner();
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    send(c, (b) => {
      if (b['admin'] === 'lista')
        return json(200, { ok: true, korisnici: [{ id: 'U2', email: 'ana@x.rs' }] });
      if (b['admin'] === 'zakazano')
        return json(200, {
          ok: true,
          zakazano: [{ user_id: 'U3', email: 'bojan@x.rs', izvrsi_posle: '2026-01-20T00:00:00Z' }]
        });
      if (b['admin'] === 'ban') return json(200, { ok: false, error: 'Pogrešna lozinka.' });
      return json(200, { ok: true });
    });
    open('users');
    render(<Screen />);
    expect(await screen.findByText('Označeno za brisanje')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Zabrani' }));
    await waitFor(() => expect(alert).toHaveBeenCalledWith('Pogrešna lozinka.'));
    await user.click(screen.getByRole('button', { name: 'Poništi' }));
    await waitFor(() =>
      expect(bodies(c).find((b) => b['admin'] === 'ponisti')).toEqual({
        admin: 'ponisti',
        obrisiId: 'U3'
      })
    );
    alert.mockRestore();
  });
});

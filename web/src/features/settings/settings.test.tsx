import type * as Config from '../../services/config';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
import { SheetHost } from '../sheets';

const download = vi.hoisted(() => vi.fn());
vi.mock('../../lib/download', () => ({ downloadText: download }));

/* Zajednica je UGAŠENA u izdanju (`COMMUNITY_ENABLED = false`). Testovi ovog fajla koji je pominju drže da kod iza prekidača i dalje radi kad se
   prekidač vrati (ovde je podrazumevano uključen); ugašeno stanje je proveren posebnim opisom ispod, prebacivanjem `flag.community`. */
const flag = vi.hoisted(() => ({ community: true }));
vi.mock('../../services/config', async (orig) => {
  const actual = await orig<typeof Config>();
  return Object.defineProperty({ ...actual }, 'COMMUNITY_ENABLED', {
    enumerable: true,
    get: () => flag.community
  });
});

/* parity: openSettings, openObrisiNalogSheet, openBugSheet, openIstorijaSheet, exportBackup/importBackup (app.js). */

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
const open = (kind = 'settings'): void => {
  act(() => useUIStore.getState().openSheet({ kind }));
};
const Screen = () => (
  <div id="sheet">
    <SheetHost />
  </div>
);

beforeEach(() => {
  download.mockReset();
  hydratePersisted(seedState());
  useUIStore.setState({ today: '2026-01-14', sheet: null, confirm: null, wizard: false });
  useAuthStore.setState({
    configured: true,
    hasSession: false,
    gate: null,
    ready: true,
    email: null
  });
});
afterEach(() => setApp(null));

describe('Podešavanja', () => {
  it('neprijavljen: vrh kaže šta čeka (nalog pa backup), dugme prijave vodi na Google', async () => {
    const user = userEvent.setup();
    const c = boot(false);
    open();
    render(<Screen />);
    expect(screen.getByText('Četiri stvari čekaju')).toBeInTheDocument();
    expect(screen.getByText(/Nalog čuva plan i istoriju/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Prijavi se' }));
    expect(c.navigate).toHaveBeenCalledWith(
      expect.stringContaining('/auth/v1/authorize?provider=google')
    );
  });

  it('izvoz backupa: preuzima fajl bez tokena, beleži datum, i vrh prelazi na „Sve je povezano"', async () => {
    const user = userEvent.setup();
    boot(false, {
      ...stateWithPlan(),
      strava: { access: 'STRAVA-SECRET' },
      icu: { athleteId: 'i1', token: 'icu-tok', lastPush: 1 }
    });
    // neprijavljen, a nalog je potreban samo kad je podešen — isključi „nalog" stavku
    useAuthStore.setState({ configured: false });
    open();
    render(<Screen />);
    await user.click(screen.getByText('Nalog', { selector: 'button' }));
    await user.click(screen.getByText('Podaci', { selector: 'b' }));
    await user.click(document.querySelector('#hero-backup') as HTMLElement); // vrh ekrana radi isto što i dugme u sekciji
    expect(download).toHaveBeenCalledTimes(1);
    const [name, text] = download.mock.calls[0] as [string, string];
    expect(name).toBe('sub19-backup-2026-01-14.json');
    expect(text).not.toContain('STRAVA-SECRET');
    expect(collectPersisted().ui.lastBackup).toBe('2026-01-14');
    expect(await screen.findByText('Sve je povezano')).toBeInTheDocument();
  });

  it('uvoz backupa: potvrda sa brojevima; potvrđen uvoz prepisuje podatke; pokvaren fajl se odbija bez promene', async () => {
    const user = userEvent.setup();
    boot(false);
    useAuthStore.setState({ configured: false });
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    open();
    const { container } = render(<Screen />);
    await user.click(screen.getByText('Nalog', { selector: 'button' }));
    await user.click(screen.getByText('Podaci', { selector: 'b' }));
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
    expect(useUIStore.getState().sheet).toBeNull();
    alert.mockRestore();
  });

  it('prijavljen: nalog, „Sinhronizuj" šalje na server, odjava traži potvrdu', async () => {
    const user = userEvent.setup();
    const c = boot(true);
    useAuthStore.setState({ hasSession: true, email: 'tester@x.rs' });
    open();
    render(<Screen />);
    await user.click(screen.getByText('Nalog', { selector: 'button' }));
    expect(screen.getByText('tester@x.rs')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Sinhronizuj' }));
    await waitFor(() => expect(c.fake.count('/rest/v1/user_state', 'POST')).toBeGreaterThan(0));
    await user.click(screen.getByRole('button', { name: 'Odjavi se' }));
    expect(useUIStore.getState().confirm?.text).toBe('Odjaviti se? Podaci na ovom uređaju ostaju.');
    act(() => useUIStore.getState().confirm?.resolve(true));
    await waitFor(() => expect(useAuthStore.getState().hasSession).toBe(false));
    expect(c.app.session.isAuthed()).toBe(false);
  });

  it('promena cilja: samo nedelje koje tek dolaze; potvrda; plan se zamenjuje, prošlost ostaje', async () => {
    const user = userEvent.setup();
    boot(false);
    useAuthStore.setState({ configured: false });
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    const before = useTrainingStore.getState().genPlan;
    open();
    render(<Screen />);
    await user.click(screen.getByText('Trening', { selector: 'button' }));
    await user.click(screen.getByText('Plan', { selector: 'b' }));
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

  describe('preračunavanje plana prema formi', () => {
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
      open();
      render(<Screen />);
      await user.click(screen.getByText('Trening', { selector: 'button' }));
      await user.click(screen.getByText('Plan', { selector: 'b' }));
      await user.click(screen.getByRole('button', { name: 'Preračunaj plan prema formi' }));
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
  });

  it('nov plan: potvrda; plan i unosi uz njega nestaju, otvara se čarobnjak', async () => {
    const user = userEvent.setup();
    boot(false);
    useAuthStore.setState({ configured: false });
    act(() => useTrainingStore.getState().patchLog('g1d1', { status: 'done' }));
    open();
    render(<Screen />);
    await user.click(screen.getByText('Trening', { selector: 'button' }));
    await user.click(screen.getByText('Plan', { selector: 'b' }));
    await user.click(screen.getByRole('button', { name: /Napravi novi plan/ }));
    expect(useUIStore.getState().confirm?.text).toMatch(/TRAJNO brišu/);
    act(() => useUIStore.getState().confirm?.resolve(true));
    await waitFor(() => expect(useTrainingStore.getState().genPlan).toBeNull());
    expect(useTrainingStore.getState().log).toEqual({});
    expect(useUIStore.getState().wizard).toBe(true);
  });
});

describe('Strava u podešavanjima', () => {
  it('nije povezana: prva stvar koja čeka; dugme vodi na Stravu', async () => {
    const user = userEvent.setup();
    const c = boot(false);
    useAuthStore.setState({ configured: false });
    open();
    render(<Screen />);
    await user.click(screen.getByText('Veze', { selector: 'button' }));
    await user.click(document.querySelector('#st-on') as HTMLElement);
    expect(c.navigate).toHaveBeenCalledWith(
      expect.stringContaining('https://www.strava.com/oauth/authorize')
    );
  });

  it('„Pravila uvoza" kažu ono što kod radi: dva trčanja istog dana se SABIRAJU (stari tekst je tvrdio da se bira bliže planu)', async () => {
    const user = userEvent.setup();
    boot(false, { ...stateWithPlan(), strava: { access: 'A', refresh: 'R', expiresAt: 4e9 } });
    useAuthStore.setState({ configured: false });
    open();
    render(<Screen />);
    await user.click(screen.getByText('Veze', { selector: 'button' }));
    await user.click(screen.getByText('Pravila uvoza'));
    expect(screen.getByText(/oba se broje u kilometražu/)).toBeInTheDocument();
    expect(screen.queryByText(/uzima se ono bliže planiranoj/)).toBeNull();
  });

  it('povezana: uvoz traži/šalje i prikazuje sažetak; otkačivanje traži potvrdu i čuva podatke', async () => {
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
    open();
    render(<Screen />);
    await user.click(screen.getByText('Veze', { selector: 'button' }));
    expect(screen.getByText(/Mika · uvoz/)).toBeInTheDocument();
    await user.click(screen.getByText('Tvoje zone pulsa'));
    expect(screen.getByText('0–130 bpm')).toBeInTheDocument();
    expect(screen.getByText('130+ bpm')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Uvezi trčanja' }));
    await waitFor(() =>
      expect(alert).toHaveBeenCalledWith(expect.stringMatching(/^Sinhronizacija gotova\./))
    );
    // sheet se zatvara posle uvoza (kao u starom kodu)
    await waitFor(() => expect(useUIStore.getState().sheet).toBeNull());
    open();
    await user.click(screen.getByText('Veze', { selector: 'button' }));
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
    open();
    render(<Screen />);
    await user.click(screen.getByText('Veze', { selector: 'button' }));
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
    open();
    render(<Screen />);
    await user.click(screen.getByText('Veze', { selector: 'button' }));
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
    open();
    render(<Screen />);
    await user.click(screen.getByText('Veze', { selector: 'button' }));
    await user.click(screen.getByText('Slanje na sat', { selector: 'b' }));
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
    open();
    render(<Screen />);
    await user.click(screen.getByText('Veze', { selector: 'button' }));
    await user.click(screen.getByText('Slanje na sat', { selector: 'b' }));
    await user.click(document.querySelector('#icu-push') as HTMLElement);
    act(() => useUIStore.getState().confirm?.resolve(true));
    await waitFor(() => expect(alert).toHaveBeenCalledWith('Odbijeno — No Target'));
    expect(collectPersisted().icu).not.toHaveProperty('lastPush');
    alert.mockRestore();
  });
});

describe('Vreme', () => {
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
    open();
    render(<Screen />);
    await user.click(screen.getByText('Trening', { selector: 'button' }));
    await user.click(screen.getByText('Vreme', { selector: 'b' }));
    expect(screen.getByText('lokacija nije uključena')).toBeInTheDocument();
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
    open();
    render(<Screen />);
    await user.click(screen.getByText('Trening', { selector: 'button' }));
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
    open();
    render(<Screen />);
    await user.click(screen.getByText('Trening', { selector: 'button' }));
    await user.click(screen.getByText('Vreme', { selector: 'b' }));
    await user.click(document.querySelector('#vr-on') as HTMLElement);
    await waitFor(() =>
      expect(alert).toHaveBeenCalledWith(expect.stringMatching(/^Pristup lokaciji je odbijen\./))
    );
    expect(collectPersisted().ui.geo).toBeNull();
    alert.mockRestore();
  });
});

describe('Zajednica u podešavanjima', () => {
  it('uključivanje šalje profil i pamti stanje; neuspeh vraća prekidač i kaže šta da se uradi', async () => {
    const user = userEvent.setup();
    const c = boot(true, { ...stateWithPlan(), zajed: { vidljiv: false, nadimak: 'Marko' } });
    useAuthStore.setState({
      configured: true,
      hasSession: true,
      userId: 'u1',
      name: 'Marko Marković',
      picture: null
    });
    c.api.set(
      'https://x.supabase.co/rest/v1/zajednica_profil',
      () => new Response(null, { status: 404 })
    );
    open();
    render(<Screen />);
    await user.click(screen.getByText('App', { selector: 'button' }));
    await user.click(screen.getByText('Zajednica', { selector: 'b' }));
    expect(screen.getByText('isključena')).toBeInTheDocument();
    await user.click(document.querySelector('#zaj-tgl') as HTMLElement);
    expect(await screen.findByText(/Tabele Zajednice još nema u bazi/)).toBeInTheDocument();
    expect(collectPersisted().zajed.vidljiv).toBe(false); // nije prošlo na serveru → ništa se ne pamti

    c.api.set(
      'https://x.supabase.co/rest/v1/zajednica_profil',
      () => new Response(null, { status: 201 })
    );
    await user.click(document.querySelector('#zaj-tgl') as HTMLElement);
    await waitFor(() => expect(collectPersisted().zajed.vidljiv).toBe(true));
    const post = c.extra.filter((e) => e.url.includes('/rest/v1/zajednica_profil')).at(-1);
    expect(post?.init.method).toBe('POST');
    expect(JSON.parse(bodyText(post?.init))).toMatchObject({
      user_id: 'u1',
      vidljiv: true,
      nadimak: 'Marko'
    });
    expect(await screen.findByRole('button', { name: 'Isključi Zajednicu' })).toBeInTheDocument();
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
    expect(body.context.version).toBe('287');
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

describe('Admin (samo vlasnik)', () => {
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

  it('običan korisnik ne vidi grupu Admin; vlasnik vidi', async () => {
    const user = userEvent.setup();
    boot(true);
    useAuthStore.setState({ configured: true, hasSession: true, userId: 'u1' });
    open();
    const first = render(<Screen />);
    expect(screen.queryByText('Admin', { selector: 'button' })).toBeNull();
    first.unmount();
    asOwner();
    render(<Screen />);
    await user.click(screen.getByText('Admin', { selector: 'button' }));
    expect(screen.getByText('Obaveštenje korisnicima', { selector: 'b' })).toBeInTheDocument();
    expect(screen.getByText('Korisnici', { selector: 'b' })).toBeInTheDocument();
  });

  it('spisak adresa: suvi poziv, BCC napomena, prazan spisak kaže da nema naloga', async () => {
    const user = userEvent.setup();
    const c = boot(true);
    asOwner();
    send(c, () => json(200, { primalaca: 2, primaoci: ['a@x.rs', 'b@x.rs'] }));
    open();
    render(<Screen />);
    await user.click(screen.getByText('Admin', { selector: 'button' }));
    await user.click(screen.getByText('Obaveštenje korisnicima', { selector: 'b' }));
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
    open();
    render(<Screen />);
    await user.click(screen.getByText('Admin', { selector: 'button' }));
    await user.click(screen.getByText('Obaveštenje korisnicima', { selector: 'b' }));
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
    open();
    render(<Screen />);
    await user.click(screen.getByText('Admin', { selector: 'button' }));
    await user.click(screen.getByText('Obaveštenje korisnicima', { selector: 'b' }));

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

  it('izazov nedelje: premalo/previše znakova se odbija bez poziva; uspeh upisuje tekst u store', async () => {
    const user = userEvent.setup();
    const c = boot(true);
    asOwner();
    send(c, (b) => json(200, { ok: true, tekst: b['tekst'] }));
    open();
    render(<Screen />);
    await user.click(screen.getByText('App', { selector: 'button' }));
    await user.click(screen.getByText('Izazov nedelje · samo ti', { selector: 'summary' }));
    const input = document.querySelector('#zaj-izazov') as HTMLInputElement;
    await user.clear(input);
    await user.type(input, 'ab');
    await user.click(document.querySelector('#zaj-izazov-cuvaj') as HTMLElement);
    expect(screen.getByText('Izazov mora imati između 3 i 160 znakova.')).toBeInTheDocument();
    expect(bodies(c)).toEqual([]);
    await user.type(input, 'c  ');
    await user.click(document.querySelector('#zaj-izazov-cuvaj') as HTMLElement);
    expect(await screen.findByText(/^Sačuvano\./)).toBeInTheDocument();
    expect(bodies(c)).toEqual([{ admin: 'izazov', tekst: 'abc' }]);
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

describe('Zajednica ugašena (prekidač isključen)', () => {
  afterEach(() => {
    flag.community = true;
  });

  it('u podešavanjima nema sekcije, prekidača, nadimka ni izazova; ostale sekcije grupe „App" ostaju', async () => {
    flag.community = false;
    const user = userEvent.setup();
    boot(true, { ...stateWithPlan(), zajed: { vidljiv: false, nadimak: 'Marko' } });
    useAuthStore.setState({
      configured: true,
      hasSession: true,
      userId: ADMIN_UID,
      name: 'Marko Marković',
      picture: null
    });
    open();
    render(<Screen />);
    await user.click(screen.getByText('App', { selector: 'button' }));
    expect(screen.getByText('Obaveštenja', { selector: 'b' })).toBeInTheDocument();
    expect(screen.queryByText('Zajednica', { selector: 'b' })).toBeNull();
    expect(document.querySelector('#zaj-tgl')).toBeNull();
    expect(document.querySelector('#zaj-nadimak')).toBeNull();
    expect(screen.queryByText(/izazov/i)).toBeNull();
  });
});

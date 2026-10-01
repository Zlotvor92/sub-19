import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeSupabase, type FakeSupabase } from '@/test/fakeSupabase';
import { adaptGeneratedPlan } from '../../domain/plan/adapt';
import { seedState, type PersistedState } from '../../domain/state';
import { generatePlan } from '../../domain/training/generator/generatePlan';
import type { PlanGenerationInput } from '../../domain/training/types';
import { setApp } from '../../app/appContext';
import { createApp } from '../../app/createApp';
import { collectPersisted, hydratePersisted, useTrainingStore } from '../../stores';
import { useAuthStore } from '../../stores/authStore';
import { useUIStore } from '../../stores/uiStore';
import { LS_KEY, SB_KEY } from '../../services/storage/keys';
import { createKeyValueStore, type StorageLike } from '../../services/storage/kv';
import { emptySession } from '../../services/supabase/session';
import { SheetHost } from '../sheets';

const download = vi.hoisted(() => vi.fn());
vi.mock('../../lib/download', () => ({ downloadText: download }));

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
function boot(signedIn: boolean, state: PersistedState = stateWithPlan()): Ctx {
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
      if (url.startsWith('/api/') || url.startsWith('https://www.strava.com')) {
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
    online: () => true
  });
  setApp(app);
  return { fake, store, extra, api, navigate, app };
}
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
    expect(screen.getByText('Tri stvari čekaju')).toBeInTheDocument();
    expect(screen.getByText(/Nalog čuva plan i istoriju/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Prijavi se' }));
    expect(c.navigate).toHaveBeenCalledWith(
      expect.stringContaining('/auth/v1/authorize?provider=google')
    );
  });

  it('izvoz backupa: preuzima fajl bez tokena, beleži datum, i vrh prelazi na „Sve je povezano"', async () => {
    const user = userEvent.setup();
    boot(false, { ...stateWithPlan(), strava: { access: 'STRAVA-SECRET' } });
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
    expect(body.context.version).toBe('283');
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

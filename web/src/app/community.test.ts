import { beforeEach, describe, expect, it } from 'vitest';
import { adaptGeneratedPlan } from '../domain/plan/adapt';
import { seedState, type PersistedState } from '../domain/state';
import { generatePlan } from '../domain/training/generator/generatePlan';
import { createCommunityApi } from '../services/community/communityApi';
import type { SessionManager } from '../services/supabase/session';
import { hydratePersisted } from '../stores';
import { useCommunityStore } from '../stores/communityStore';
import { createCommunity } from './community';

/* parity: zajPostavi, zajUpisi, zajObrisi, zajUcitaj, zajMozdaOsvezi (app.js). Šta izlazi iz naloga je dokazano u `domain/community`. */

const NOW = 1_800_000_000_000;
type Reply = { status: number; body?: unknown };

function stateWithPlan(): PersistedState {
  const s = JSON.parse(JSON.stringify(seedState())) as PersistedState;
  const a = adaptGeneratedPlan(
    generatePlan({
      startDate: '2026-01-05',
      raceDate: '2026-04-12',
      raceDistM: 10000,
      pb: { distM: 10000, sec: 2700 },
      weeklyKm: 40,
      runDays: 5,
      quality: 2,
      intensity: 'std',
      trainedRecently: true
    })
  );
  if (!a) throw new Error('plan');
  s.genPlan = a;
  return s;
}

function make(
  opts: {
    authed?: boolean;
    online?: boolean;
    replies?: Reply[];
    now?: () => number;
    enabled?: boolean;
  } = {}
) {
  const calls: Array<{
    url: string;
    method: string;
    headers: Record<string, string>;
    body: unknown;
  }> = [];
  let i = 0;
  const session = {
    state: {
      userId: 'u1',
      access: 'ACC',
      ime: 'Marko Marković',
      slika: 'https://lh3.googleusercontent.com/a/x=s96-c'
    },
    ensure: () => Promise.resolve(opts.authed ?? true),
    isAuthed: () => opts.authed ?? true
  } as unknown as SessionManager;
  const api = createCommunityApi({
    fetcher: (url, init) => {
      calls.push({
        url,
        method: init?.method ?? 'GET',
        headers: (init?.headers ?? {}) as Record<string, string>,
        body: typeof init?.body === 'string' ? JSON.parse(init.body) : null
      });
      const r = (opts.replies ?? [{ status: 200, body: [] }])[
        Math.min(i++, (opts.replies?.length ?? 1) - 1)
      ] as Reply;
      return Promise.resolve(
        new Response(r.status === 204 ? null : JSON.stringify(r.body ?? []), {
          status: r.status,
          headers: { 'Content-Type': 'application/json' }
        })
      );
    },
    session,
    supabaseUrl: 'https://x.supabase.co',
    anonKey: 'ANON'
  });
  const community = createCommunity({
    api,
    session,
    now: opts.now ?? (() => NOW),
    today: () => '2026-02-20',
    online: () => opts.online ?? true,
    ...(opts.enabled === undefined ? {} : { enabled: () => opts.enabled as boolean })
  });
  return { community, calls };
}

beforeEach(() => {
  hydratePersisted(stateWithPlan());
  useCommunityStore.setState({
    zajed: { vidljiv: false, nadimak: '' },
    profiles: null,
    challenge: null,
    loading: false,
    error: null,
    loadedAt: 0,
    opened: null
  });
});

describe('Zajednica — tok', () => {
  it('uključivanje: upis sa merge-duplicates, samo nabrojana polja; stanje se čuva tek kad server primi', async () => {
    const m = make({ replies: [{ status: 201 }] });
    expect(await m.community.setVisible(true)).toEqual({ ok: true });
    expect(useCommunityStore.getState().zajed.vidljiv).toBe(true);
    const c = m.calls[0];
    expect(c?.url).toBe('https://x.supabase.co/rest/v1/zajednica_profil');
    expect(c?.method).toBe('POST');
    expect(c?.headers['Prefer']).toBe('resolution=merge-duplicates,return=minimal');
    expect(c?.headers['Authorization']).toBe('Bearer ACC');
    const keys = Object.keys(c?.body as object).sort();
    expect(keys).toEqual(
      [
        'avatar_url',
        'cilj',
        'izazov_od',
        'izazov_ura',
        'km_nedelja',
        'nadimak',
        'nedelja_br',
        'nedelja_od',
        'niz_dana',
        'plan_pct',
        'test3k_sec',
        'trcanja',
        'trka_datum',
        'user_id',
        'vdot',
        'vdot_pocetni',
        'vidljiv',
        'znacke'
      ].sort()
    );
    expect(c?.body).toMatchObject({ user_id: 'u1', vidljiv: true, nadimak: 'Marko', cilj: '10K' });
  });

  it('neuspeh: stanje se VRAĆA i razlog je rečenica sa sledećim korakom (404 → SQL fajl)', async () => {
    const m = make({ replies: [{ status: 404 }] });
    const r = await m.community.setVisible(true);
    expect(r).toEqual({ ok: false, reason: 'nema-tabele' });
    expect(useCommunityStore.getState().zajed.vidljiv).toBe(false);

    const off = make({ replies: [{ status: 503 }], online: false });
    const r2 = await off.community.setVisible(true);
    expect(r2).toEqual({ ok: false, reason: 'mreza' });
    expect(useCommunityStore.getState().zajed.vidljiv).toBe(false);
  });

  it('isključivanje BRIŠE red (DELETE po user_id), ne postavlja vidljiv=false; spisak se prazni', async () => {
    useCommunityStore.setState({
      zajed: { vidljiv: true, nadimak: '' },
      profiles: [],
      opened: 'x'
    });
    const m = make({ replies: [{ status: 204 }] });
    expect(await m.community.setVisible(false)).toEqual({ ok: true });
    expect(m.calls[0]).toMatchObject({
      method: 'DELETE',
      url: 'https://x.supabase.co/rest/v1/zajednica_profil?user_id=eq.u1'
    });
    expect(useCommunityStore.getState()).toMatchObject({ profiles: null, opened: null });
    expect(useCommunityStore.getState().zajed.vidljiv).toBe(false);
  });

  it('nadimak se šalje samo ako je profil već vidljiv', async () => {
    const hidden = make({ replies: [{ status: 201 }] });
    hidden.community.setNickname('  Novi  ');
    await Promise.resolve();
    expect(hidden.calls).toHaveLength(0);
    expect(useCommunityStore.getState().zajed.nadimak).toBe('Novi');

    useCommunityStore.setState({ zajed: { vidljiv: true, nadimak: '' } });
    const shown = make({ replies: [{ status: 201 }] });
    shown.community.setNickname('x'.repeat(40));
    await new Promise((r) => setTimeout(r, 0));
    expect(shown.calls).toHaveLength(1);
    expect((shown.calls[0]?.body as { nadimak: string }).nadimak).toBe('x'.repeat(24));
  });

  it('povlačenje: profili se čiste na ulazu, izazov stiže, razlog greške se pamti', async () => {
    useCommunityStore.setState({ zajed: { vidljiv: true, nadimak: '' } });
    const ok = make({
      replies: [
        {
          status: 200,
          body: [{ user_id: 'a', vdot: [], plan_pct: '50', znacke: 'x' }, { nema: 'user_id' }]
        },
        { status: 200, body: [{ tekst: 'Izazov!' }] }
      ]
    });
    await ok.community.load();
    const st = useCommunityStore.getState();
    expect(st.profiles).toEqual([
      expect.objectContaining({ user_id: 'a', vdot: null, plan_pct: 50, znacke: [] })
    ]);
    expect(st.challenge).toBe('Izazov!');
    expect(st.loadedAt).toBe(NOW);
    expect(ok.calls[0]?.url).toBe(
      'https://x.supabase.co/rest/v1/zajednica_profil?select=*&vidljiv=is.true'
    );

    useCommunityStore.setState({ profiles: null, error: null });
    const bad = make({ replies: [{ status: 404 }, { status: 404 }] });
    await bad.community.load();
    expect(useCommunityStore.getState()).toMatchObject({ error: 'nema-tabele', loading: false });
  });

  it('osvežavanje pri ulasku u tab: najviše na pet minuta i nikad dok je isključena', async () => {
    const off = make();
    off.community.refreshIfDue();
    expect(off.calls).toHaveLength(0);

    useCommunityStore.setState({
      zajed: { vidljiv: true, nadimak: '' },
      profiles: [],
      loadedAt: NOW - 4 * 60_000
    });
    const fresh = make();
    fresh.community.refreshIfDue();
    expect(fresh.calls).toHaveLength(0);

    useCommunityStore.setState({ loadedAt: NOW - 6 * 60_000 });
    const stale = make();
    stale.community.refreshIfDue();
    await new Promise((r) => setTimeout(r, 0));
    expect(stale.calls.length).toBeGreaterThan(0);

    useCommunityStore.setState({ profiles: null });
    const none = make({ authed: false });
    none.community.refreshIfDue();
    expect(none.calls).toHaveLength(0);
  });
});

describe('Zajednica — ugašena funkcija (prekidač isključen)', () => {
  const on = { zajed: { vidljiv: true, nadimak: 'Mare' }, profiles: [], loadedAt: 0 };

  it('ništa se ne upisuje, ne učitava i ne uključuje', async () => {
    useCommunityStore.setState(on);
    const m = make({ enabled: false });
    m.community.publishOnStart();
    m.community.refreshIfDue();
    m.community.setNickname('Novi');
    expect(await m.community.publish()).toMatchObject({ ok: false });
    expect(await m.community.setVisible(true)).toMatchObject({ ok: false });
    await new Promise((r) => setTimeout(r, 0));
    expect(m.calls).toHaveLength(0);
  });

  it('ko je ranije bio vidljiv, pri pokretanju se povlači: DELETE sopstvenog reda, pa tek onda vidljiv=false', async () => {
    useCommunityStore.setState({ ...on, opened: 'x', profiles: [] });
    const m = make({ enabled: false, replies: [{ status: 204 }] });
    await m.community.withdrawIfDisabled();
    expect(m.calls).toHaveLength(1);
    expect(m.calls[0]).toMatchObject({
      method: 'DELETE',
      url: 'https://x.supabase.co/rest/v1/zajednica_profil?user_id=eq.u1'
    });
    expect(useCommunityStore.getState().zajed.vidljiv).toBe(false);
    expect(useCommunityStore.getState()).toMatchObject({ profiles: null, opened: null });
  });

  it('server ne primi brisanje: ostaje vidljiv=true (da se pokuša sledeći put), ne laže da je povučeno', async () => {
    useCommunityStore.setState(on);
    const m = make({ enabled: false, replies: [{ status: 500 }] });
    await m.community.withdrawIfDisabled();
    expect(m.calls).toHaveLength(1);
    expect(useCommunityStore.getState().zajed.vidljiv).toBe(true);
  });

  it('bez poziva ako nije bio vidljiv, ako nije prijavljen, i uvek kad je funkcija uključena', async () => {
    useCommunityStore.setState({ zajed: { vidljiv: false, nadimak: '' } });
    const a = make({ enabled: false });
    await a.community.withdrawIfDisabled();
    useCommunityStore.setState(on);
    const b = make({ enabled: false, authed: false });
    await b.community.withdrawIfDisabled();
    const c = make({ enabled: true, replies: [{ status: 204 }] });
    await c.community.withdrawIfDisabled();
    expect(a.calls.length + b.calls.length + c.calls.length).toBe(0);
    expect(useCommunityStore.getState().zajed.vidljiv).toBe(true);
  });
});

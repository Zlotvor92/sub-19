import { describe, expect, it } from 'vitest';
import { ADOPT_WARNING_CODE } from '../integrations/v4';
import { SAMPLES } from '../integrations/v4/samples.test-data';
import { commitAction, type PlanApi, type PlanRow } from '../services/v4';
import { kindOfStoredPlan } from '../stores/detect';
import { adoptionOf } from './integrations';

/* Drugo puštanje, korak 1 (BRISANJE-PLAN § 2a): trajno preuzimanje v2 i ličnog plana u `plan_v4`. */
const sample = (prefix: string) => {
  const s = SAMPLES.find((x) => x.name.startsWith(prefix));
  if (!s) throw new Error(`nema uzorka ${prefix}`);
  return s;
};

/** Lažan `plan_v4`: uslovni upis po `rev` (kao baza), brojač upisa. */
function fakePlanApi(): PlanApi & { row: PlanRow | null; saves: number } {
  const api = {
    row: null as PlanRow | null,
    saves: 0,
    load: () => Promise.resolve({ ok: true as const, row: api.row }),
    pruneVersions: () => Promise.resolve(true),
    save: (next: { doc: PlanRow['doc']; otisak: string }, expectedRev: number | null) => {
      if ((api.row?.rev ?? null) !== expectedRev)
        return Promise.resolve({ ok: false as const, conflict: true as const });
      api.saves++;
      api.row = { ...next, rev: (api.row?.rev ?? 0) + 1 };
      return Promise.resolve({ ok: true as const, row: api.row });
    }
  };
  return api;
}

describe('trajno preuzimanje (adoptionOf + commitAction)', () => {
  it('v2 plan sa budućom trkom → upis u plan_v4 + događaj „preuzeto"; drugi uređaj ne piše ponovo', async () => {
    const s = sample('v2-hm-a');
    const kind = kindOfStoredPlan({ genPlan: s.snap.plan, isOwner: false }, s.today);
    expect(kind).toBe('v2');
    const a = adoptionOf(kind, s.snap, s.today);
    if (a?.kind !== 'upis') throw new Error(String(a?.kind));
    expect(a.event).toMatchObject({ id: `preuzeto:${s.today}`, format: 'v2', isti: true });
    expect(a.doc.header.warnings.some((w) => w.code === ADOPT_WARNING_CODE)).toBe(false);
    const api = fakePlanApi();
    const first = await commitAction(api, a.action, 'uredjaj-1');
    expect(first).toMatchObject({ ok: true, wrote: true });
    expect(api.row?.doc).toEqual(a.doc);
    /* drugi uređaj (isti plan, isti dan) ili drugo otvaranje: red postoji → ništa se ne piše, nije sukob */
    const b = adoptionOf(kind, s.snap, s.today);
    if (b?.kind !== 'upis') throw new Error(String(b?.kind));
    const second = await commitAction(api, b.action, 'uredjaj-2');
    expect(second).toMatchObject({ ok: true, wrote: false });
    expect(api.saves).toBe(1);
  });

  it('dva uređaja istovremeno: posle sukoba drugi vidi red i ne piše', async () => {
    const s = sample('v2-5k-a');
    const a = adoptionOf('v2', s.snap, s.today);
    if (a?.kind !== 'upis') throw new Error(String(a?.kind));
    const api = fakePlanApi();
    const stale = { ...api, load: () => Promise.resolve({ ok: true as const, row: null }) };
    let firstLoad = true;
    const racing: PlanApi = {
      ...api,
      load: () => {
        if (firstLoad) {
          firstLoad = false;
          return stale.load();
        }
        return api.load();
      },
      save: (n, r, d) => api.save(n, r, d)
    };
    await commitAction(api, a.action, 'uredjaj-1');
    const r = await commitAction(racing, a.action, 'uredjaj-2');
    expect(r).toMatchObject({ ok: true, wrote: false });
    expect(api.saves).toBe(1);
  });

  it('lični plan → upis (vlasnik)', () => {
    const s = sample('personal-fresh');
    expect(kindOfStoredPlan({ genPlan: null, isOwner: true }, s.today)).toBe('licni');
    const a = adoptionOf('licni', s.snap, s.today);
    expect(a?.kind).toBe('upis');
    if (a?.kind === 'upis') expect(a.doc.header.protected).toBe(true);
  });

  it('stari format, prošla trka, nepoznat, nema → ništa se ne preuzima', () => {
    const s = sample('legacy-hm-fresh');
    for (const k of ['stari', 'v2-prosla-trka', 'nepoznat', 'nema'] as const)
      expect(adoptionOf(k, s.snap, s.today)).toBeNull();
  });

  it('greška adaptera → ništa se ne upisuje, beleži se događaj „preuzeto-greska"', () => {
    const s = sample('v2-hm-a');
    const broken = { ...s.snap, plan: { ...s.snap.plan!, weeks: 'x' } as never };
    const a = adoptionOf('v2', broken, s.today);
    expect(a).toMatchObject({
      kind: 'greska',
      event: { id: `preuzeto-greska:${s.today}`, format: 'v2', code: 'oblik-neispravan' }
    });
    expect(a && 'action' in a).toBe(false);
  });
});

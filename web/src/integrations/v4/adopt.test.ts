import { describe, expect, it } from 'vitest';
import { personalPlan } from '../../domain/personal';
import { adopt as adoptPlanReal, fingerprintLegacy } from '../../domain/v4/adapters';
import { fingerprint } from '../../domain/v4/engine';
import { adapterInput, adoptActive, type AdoptSnapshot } from './adopt';
import { clone, deepFreeze, SAMPLES } from './samples.test-data';

const empty = (plan: AdoptSnapshot['plan']): AdoptSnapshot => ({
  plan,
  log: {},
  alts: {},
  moves: {},
  vanPlana: {},
  knee: []
});

describe('preuzimanje: otisak pre = otisak posle', () => {
  it('pokriva sve formate i sve četiri distance', () => {
    const seen = new Set(
      SAMPLES.map((s) => {
        const r = adoptActive(s.snap, s.today);
        return r.status === 'preuzet'
          ? `${r.doc.header.policyId.replace(/-[ab]$/, '')}|${r.doc.header.goal.distanceId}`
          : r.status;
      })
    );
    for (const d of ['fivek', 'tenk', 'hm', 'marathon']) {
      expect(seen.has(`adopted:v2|${d}`), d).toBe(true);
      expect(seen.has(`adopted:legacy|${d}`), d).toBe(true);
    }
    expect([...seen].some((x) => x.startsWith('adopted:personal|'))).toBe(true);
  });

  describe.each(SAMPLES)('$name', ({ snap, today }) => {
    const frozen = deepFreeze(clone(snap));
    const r = adoptActive(frozen, today);

    it('preuzet, otisak isti kao pre preuzimanja', () => {
      expect(r.status).toBe('preuzet');
      if (r.status !== 'preuzet') return;
      expect(r.fingerprint).toBe(fingerprintLegacy(adapterInput(frozen)));
      expect(r.fingerprint).toBe(fingerprint(r.doc, r.facts));
    });

    it('ulaz se ne menja; drugi poziv daje isti dokument', () => {
      expect(JSON.stringify(frozen)).toBe(JSON.stringify(snap));
      const again = adoptActive(frozen, today);
      expect(again.status === 'preuzet' && r.status === 'preuzet' && again.fingerprint).toBe(
        r.status === 'preuzet' && r.fingerprint
      );
    });
  });
});

describe('lični plan vlasnika (ugrađen, kako ga aplikacija računa danas)', () => {
  it.each([42, 47.5, 52])('VDOT %s: preuzet, zaštićen, otisak isti', (vdot) => {
    const plan = personalPlan(vdot);
    const today = plan.weeks[0]?.start ?? '2026-10-01';
    const snap = deepFreeze(clone(empty(plan)));
    const r = adoptActive(snap, today);
    expect(r.status).toBe('preuzet');
    if (r.status !== 'preuzet') return;
    expect(r.doc.header.policyId).toBe('adopted:personal');
    expect(r.doc.header.protected).toBe(true);
    expect(r.fingerprint).toBe(fingerprintLegacy(adapterInput(snap)));
  });
});

describe('ishodi koji nisu preuzimanje', () => {
  it('nema plana', () => {
    expect(adoptActive(empty(null), '2026-11-16')).toEqual({ status: 'nema-plana' });
  });

  it('neispravan plan → greška adaptera, bez izuzetka', () => {
    const r = adoptActive(empty({ weeks: 'x' } as never), '2026-11-16');
    expect(r.status).toBe('greska');
  });

  it('različit otisak → plan se NE preuzima (ostaje stari prikaz)', () => {
    const s = SAMPLES[0];
    if (s === undefined) throw new Error('nema uzorka');
    const r = adoptActive(s.snap, s.today, {
      adopt: (input, today) => adoptPlanReal(input, today),
      fingerprintLegacy: () => 'staro',
      fingerprint: () => 'novo'
    });
    expect(r).toEqual({ status: 'otisak-razlicit', before: 'staro', after: 'novo' });
  });
});

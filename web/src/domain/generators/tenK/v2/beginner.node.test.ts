/* D28 — početnik (dani, nedelje, obim, uvod, jedan kvalitet, prvi nivo, rast, vrh, dugi 90 min, WU/CD prvi
   pojas); D29 — trčanje/hodanje; D31 — T kontinuirano od 1,5 km pri malom obimu (izgradnja, rasterećenje,
   taper); D32 — početnik bez testa. Brojevi iz odluka, ne iz koda generatora. */

import { describe, expect, it } from 'vitest';
import { generateTenKV2 } from './generate.ts';
import { planRule } from './policy.ts';
import { startLevel } from './quality.ts';
import { inputOf, SCHEDULES_BY_DAYS } from './testInputs.ts';
import type { PlanWeek, ReasonCode, TenKV2Plan } from './types.ts';
import { validatePlan } from './validate.ts';
import { doseOf, ladderLevels } from './workouts.ts';

const beg = (
  days: 3 | 4 | 5 | 6,
  o: { weeks: number; km: number; easy?: number; vdot?: number; s?: 'A' | 'B' | 'C' }
): Record<string, unknown> => {
  const sc = SCHEDULES_BY_DAYS[days][o.s ?? 'A'];
  const base = inputOf({
    weeks: o.weeks,
    km: o.km,
    vdot: o.vdot ?? 40,
    days: sc.days,
    long: sc.long
  });
  return {
    ...base,
    ...(o.easy ? { recentResult: null, easyPaceSecPerKm: o.easy } : {}),
    experience: 'beginner'
  };
};
const plan = (raw: Record<string, unknown>): TenKV2Plan => {
  const r = generateTenKV2(raw);
  if (!r.ok) throw new Error(JSON.stringify(r.reasons));
  return r.plan;
};
const codes = (raw: unknown): ReasonCode[] => {
  const r = generateTenKV2(raw);
  return r.ok ? [] : r.reasons.map((x) => x.code);
};
const errors = (p: TenKV2Plan): string[] =>
  validatePlan(p)
    .filter((v) => v.severity === 'error')
    .map((v) => v.rule);
const steady = (w: PlanWeek): boolean =>
  !w.deload && (w.phase === 'base' || w.phase === 'development' || w.phase === 'specific');
const quality = (w: PlanWeek) => w.days.filter((d) => d.workout.kind === 'quality');

describe('D28: početnik — ulaz', () => {
  it('3–4 dana, 10–18 nedelja, obim 3 dana 15–30, 4 dana 18–35 km; podrazumevano regular', () => {
    for (const raw of [
      beg(3, { weeks: 10, km: 15 }),
      beg(3, { weeks: 18, km: 30 }),
      beg(4, { weeks: 10, km: 18 }),
      beg(4, { weeks: 18, km: 35 }),
      beg(3, { weeks: 12, km: 15, easy: 510 }),
      beg(4, { weeks: 12, km: 35, easy: 330 })
    ])
      expect(codes(raw)).toEqual([]);
    const reg = inputOf({ weeks: 12, km: 35, vdot: 45, days: SCHEDULES_BY_DAYS[4].A.days });
    expect(JSON.stringify(generateTenKV2(reg))).toBe(
      JSON.stringify(generateTenKV2({ ...reg, experience: 'regular' }))
    );
    expect(codes({ ...reg, experience: 'expert' })).toEqual(['INPUT_SHAPE']);
  });

  it('odbijanja: 5–6 dana (preporuka 3–4), 8–9 nedelja, obim ispod (preporuka 5K) / iznad opsega', () => {
    const r5 = generateTenKV2(beg(5, { weeks: 12, km: 30 }));
    expect(!r5.ok && r5.reasons.map((x) => [x.code, x.message])).toEqual([
      [
        'BEGINNER_DAYS',
        'Početnik: 10K plan radi sa 3–4 dana trčanja (izabrano 5); preporuka 3–4 dana.'
      ]
    ]);
    expect(codes(beg(6, { weeks: 12, km: 35 }))).toEqual(['BEGINNER_DAYS']);
    expect(codes(beg(3, { weeks: 9, km: 20 }))).toEqual(['BEGINNER_SHORT']);
    const r8 = generateTenKV2(beg(4, { weeks: 8, km: 20 }));
    expect(!r8.ok && r8.reasons[0]!.message).toMatch(/najmanje 10 nedelja \(izabrano 8\)/);
    const r12 = generateTenKV2(beg(3, { weeks: 12, km: 12 }));
    expect(!r12.ok && r12.reasons.map((x) => x.code)).toEqual(['WEEKLY_KM_TOO_LOW']);
    expect(!r12.ok && r12.reasons[0]!.message).toMatch(/ispod 15 km — preporuka je 5K plan/);
    expect(codes(beg(4, { weeks: 12, km: 17.9 }))).toEqual(['WEEKLY_KM_TOO_LOW']);
    expect(codes(beg(3, { weeks: 12, km: 30.1 }))).toEqual(['WEEKLY_KM_TOO_HIGH']);
    expect(codes(beg(4, { weeks: 12, km: 36 }))).toEqual(['WEEKLY_KM_TOO_HIGH']);
    expect(codes(beg(4, { weeks: 7, km: 20 }))).toEqual(['PLAN_TOO_SHORT']);
  });
});

describe('D28: početnik — plan', () => {
  it('ned 1–2 uvod bez kvaliteta (dan kvaliteta lagan); zatim jedan kvalitet nedeljno, lestvica T kont. → T cruise → RP, bez I/R', () => {
    for (const days of [3, 4] as const) {
      const p = plan(beg(days, { weeks: 14, km: days === 3 ? 25 : 30, vdot: 40 }));
      expect(p.pattern.q2).toBeNull();
      for (const w of p.weeks.slice(0, 2)) {
        expect(quality(w)).toEqual([]);
        expect(w.days.find((d) => d.weekday === p.pattern.q1)!.role).toBe('easy');
        expect(w.days.filter((d) => d.role === 'easy').length).toBe(days - 1);
        expect(w.notes.some((n) => n.startsWith('Uvod: '))).toBe(true);
      }
      const ladders = p.weeks
        .filter(steady)
        .slice(2)
        .map((w) => quality(w).map((d) => d.workout.dose!.ladder));
      for (const l of ladders) expect(l.length).toBe(1);
      expect([...new Set(ladders.flat())]).toEqual(['T_continuous', 'T_cruise', 'RP']);
      for (const w of p.weeks) {
        expect(quality(w).length).toBeLessThanOrEqual(1);
        for (const d of quality(w)) expect(['I', 'R']).not.toContain(d.workout.dose!.zone);
      }
      // 4 dana: 1 kvalitet + 2 lagana + dugi; lagani jednaki (D19).
      if (days === 4)
        for (const w of p.weeks.filter(steady).slice(2)) {
          const e = w.days
            .filter((d) => d.role === 'easy')
            .map((d) => Math.round(d.workout.km * 10));
          expect(e.length).toBe(2);
          expect(Math.abs(e[0]! - e[1]!)).toBeLessThanOrEqual(1);
        }
      expect(errors(p)).toEqual([]);
    }
  });

  it('D16 ne važi: početni nivo = prvi nivo lestvice (D31: prva nedelja kvaliteta T 1,5 km)', () => {
    expect(doseOf(startLevel('T_continuous', 50)!)).toBe(3000);
    expect(doseOf(startLevel('T_continuous', 50, true)!)).toBe(1500);
    const p = plan(beg(4, { weeks: 14, km: 35, vdot: 40 }));
    expect(quality(p.weeks[2]!)[0]!.workout.dose!.doseM).toBe(1500);
  });

  it('rast +5 % (min 1,0, max 2,0 km); vrh = min(1,3 × start, start + 10, max nedelje); dugi ≤ 90 min sporim E; WU/CD 15/10 min', () => {
    const g = plan(beg(4, { weeks: 18, km: 35, vdot: 45 }));
    const t = g.weeks.filter(steady).map((w) => w.targetKm);
    // 35 → +1,8 (5 % = 1,75) → +1,8 → +1,9; redovan plan: +2,1 (6 %).
    expect(t.slice(0, 4)).toEqual([35, 36.8, 38.6, 40.5]);
    expect(g.peakCapKm).toBe(45);
    const p = plan(beg(4, { weeks: 18, km: 35, vdot: 30 }));
    const p15 = plan(beg(3, { weeks: 12, km: 15, easy: 450 }));
    expect(
      p15.weeks
        .filter(steady)
        .map((w) => w.targetKm)
        .slice(0, 3)
    ).toEqual([15, 16, 17]);
    expect(p15.peakCapKm).toBe(19.5);
    expect(plan(beg(3, { weeks: 12, km: 30, vdot: 40 })).peakCapKm).toBe(39);
    for (const q of [p, p15])
      for (const w of q.weeks)
        for (const d of w.days) {
          if (d.role === 'long')
            expect(d.workout.km * q.paces.E.slow).toBeLessThanOrEqual(5400 + 1e-6);
          if (d.workout.kind === 'quality' || d.workout.kind === 'test')
            expect([d.workout.segments[0]!.sec, d.workout.segments.at(-1)!.sec]).toEqual([
              900, 600
            ]);
        }
    // 35 km, VDOT 30: dugi seče 90 min (redovan plan bi imao 105 min).
    expect(
      Math.max(
        ...p.weeks.flatMap((w) => w.days.filter((d) => d.role === 'long').map((d) => d.workout.km))
      )
    ).toBe(Math.floor((5400 / p.paces.E.slow) * 10) / 10);
  });

  it('osnova tempa: rezultat ≤ 84 dana i VDOT ≥ 30 → VDOT; bez rezultata → po osećaju sa testom', () => {
    const r = plan(beg(4, { weeks: 14, km: 25, vdot: 35 }));
    expect([r.paceBasis, r.weeks.some((w) => w.test)]).toEqual(['result', false]);
    const f = plan(beg(4, { weeks: 10, km: 18, easy: 480 }));
    expect([f.paceBasis, f.weeks.filter((w) => w.test).map((w) => w.index)]).toEqual(['feel', []]);
  });

  it('validator hvata: kvalitet u uvodu, WU 20 min, dugi > 90 min, rast > 5 %, nedelja bez kvaliteta kad prvi nivo staje', () => {
    const fresh = (): TenKV2Plan => plan(beg(4, { weeks: 14, km: 35, vdot: 40 }));
    const a = fresh();
    const q = quality(a.weeks[2]!)[0]!;
    const e = a.weeks[0]!.days.find((d) => d.weekday === q.weekday)!;
    e.role = 'q1';
    e.hard = true;
    expect(errors(a)).toContain('ROLES');
    const b = fresh();
    (quality(b.weeks[2]!)[0]!.workout.segments[0] as { sec: number }).sec = 1200;
    expect(errors(b)).toContain('WARMUP');
    const c = fresh();
    // 15 km × sporim E (VDOT 40) ≈ 101 min: > 90 min (početnik), < 105 min (redovan).
    c.weeks[2]!.days.find((d) => d.role === 'long')!.workout.km = 15;
    expect(15 * c.paces.E.slow).toBeGreaterThan(5400);
    expect(15 * c.paces.E.slow).toBeLessThan(6300);
    expect(errors(c)).toContain('LONG_DURATION');
    const d = fresh();
    d.weeks[1]!.nominalKm = 38;
    expect(errors(d)).toContain('VOLUME_RULE');
    const g = fresh();
    const w = g.weeks[2]!;
    const qd = quality(w)[0]!;
    qd.role = 'easy';
    qd.hard = false;
    qd.workout = w.days.find((x) => x.role === 'easy')!.workout;
    w.notes.push('Bez kvaliteta: test');
    expect(errors(g)).toContain('BUILD_NO_QUALITY');
  });

  it('pravilo plana početnika je jedno mesto (planRule): redovan red D17 bez izmene', () => {
    expect(planRule(4, 'regular')!.introWeeks).toBe(0);
    expect(planRule(4, 'beginner')!.introWeeks).toBe(2);
  });
});

const t = (w: PlanWeek): string =>
  quality(w)
    .map((d) => {
      const x = d.workout.dose!;
      const st = x.structure;
      return `${x.ladder}:${st.form === 'continuous' ? st.km : `${st.form === 'reps' ? st.reps : 0}x${st.form === 'reps' ? st.repM : 0}`}`;
    })
    .join() || '-';

describe('D31: početnik — T kontinuirano od 1,5 km pri malom obimu', () => {
  it('lestvica T kontinuirano početnika [1,5; 2,0; 2,5; …]; redovna lestvica i D16 nepromenjeni', () => {
    const km = (b: boolean): number[] => ladderLevels('T_continuous', b).map((x) => doseOf(x));
    expect(km(true)).toEqual([1500, 2000, 2500, 3000, 3500, 4000, 4500, 5000]);
    expect(km(false)).toEqual([2000, 2500, 3000, 3500, 4000, 4500, 5000]);
    expect(ladderLevels('T_cruise', true)).toEqual(ladderLevels('T_cruise'));
    expect(startLevel('T_continuous', 14.9, true)).toBeNull();
    expect(doseOf(startLevel('T_continuous', 15, true)!)).toBe(1500);
    expect(startLevel('T_continuous', 19.9)).toBeNull();
  });

  it('3 dana, 15 km, 12 ned (7:30): T 1,5 km u svakoj nedelji izgradnje posle uvoda (razvoj/specifično umesto T cruise 2,0 / RP 2,4 km); rasterećenje ned 4 bez kvaliteta, ned 9 T 1,5 km; taper bez kvaliteta', () => {
    const p = plan(beg(3, { weeks: 12, km: 15, easy: 450 }));
    expect(p.weeks.map(t)).toEqual([
      '-',
      '-',
      'T_continuous:1.5',
      '-',
      'T_continuous:1.5',
      'T_continuous:1.5',
      'T_continuous:1.5',
      'T_continuous:1.5',
      'T_cruise:1.5',
      'T_continuous:1.5',
      '-',
      '-'
    ]);
    const build = p.weeks.filter(steady).filter((w) => w.index > 2);
    expect(build.map((w) => w.targetKm)).toEqual([17, 18, 19, 19.5, 19.5, 19.5]);
    for (const w of build.filter((x) => x.phase !== 'base'))
      expect(
        w.notes.some((n) => n.startsWith('T kontinuirano (D31)')),
        `ned ${w.index}`
      ).toBe(true);
    // Ned 4: 0,8 × 17 = 13,6 km, plafon 1,36 km < 1,5 km; ned 9: 15,6 km, plafon 1,56 km. Taper 0,75 ×
    // 19,5 = 14,6 km: ni RP 2,0 ni T 1,5 km ne staju.
    expect([p.weeks[3]!.targetKm, p.weeks[8]!.targetKm, p.weeks[10]!.targetKm]).toEqual([
      13.6, 15.6, 14.6
    ]);
    const w = (rule: string): number[] =>
      p.warnings.filter((x) => x.rule === rule).map((x) => x.week!);
    expect([w('BUILD_NO_QUALITY'), w('DELOAD_NO_QUALITY'), w('TAPER_NO_QUALITY')]).toEqual([
      [],
      [4],
      [11]
    ]);
    expect(errors(p)).toEqual([]);
  });

  it('4 dana, 18 km, 10 ned (8:00): specifično T 2,0 km ↔ 2 × 1000 m (RP 2,4 km > plafon); rasterećenje T 1,5 km (≈ 60 % od 2,0, min 1,5); taper T 1,5 km (RP 2 × 1000 m > plafon), bez oštrenja', () => {
    const p = plan(beg(4, { weeks: 10, km: 18, easy: 480 }));
    expect(p.weeks.map(t)).toEqual([
      '-',
      '-',
      'T_continuous:1.5',
      'T_cruise:2x1000',
      'T_cruise:1.5',
      'T_continuous:2',
      'T_continuous:2x1000',
      'T_continuous:2',
      'T_continuous:1.5',
      '-'
    ]);
    expect(p.weeks.slice(5, 8).map((w) => w.targetKm)).toEqual([22.1, 23.2, 23.4]);
    expect(p.weeks[8]!.notes.some((n) => n.startsWith('Taper (D31)'))).toBe(true);
    expect(p.weeks[9]!.days.some((d) => d.role === 'sharpener')).toBe(false);
    expect(errors(p)).toEqual([]);
  });

  it('odstupanje: T 1,5 km nema drugu strukturu — ponavljanje uz napomenu i u bazi (3 dana, 18 ned, 15 km: ned 3 / 5 / 6)', () => {
    const p = plan(beg(3, { weeks: 18, km: 15, easy: 450 }));
    const base = p.weeks.filter((w) => w.phase === 'base' && steady(w) && w.index > 2);
    expect(base.map((w) => [w.index, w.targetKm, t(w)])).toEqual([
      [3, 17, 'T_continuous:1.5'],
      [5, 18, 'T_continuous:1.5'],
      [6, 19, 'T_continuous:1.5']
    ]);
    for (const w of base.slice(1)) {
      expect(quality(w)[0]!.workout.dose!.step).toBe('repeat');
      expect(w.notes.some((n) => n.includes('T 1,5 km ponovljen'))).toBe(true);
    }
    expect(errors(p)).toEqual([]);
    const q = plan(beg(3, { weeks: 18, km: 15, easy: 450 }));
    q.weeks[4]!.notes = q.weeks[4]!.notes.filter((n) => !n.includes('ponovljen'));
    expect(errors(q)).toEqual(expect.arrayContaining(['IDENTICAL_WEEKS', 'BASE_PLATEAU']));
  });

  it('validator hvata: T kontinuirano kad lestvica faze staje, lestvica faze kad ne staje, pogrešan T tapera, rasterećenje T 2,0 umesto 1,5 km', () => {
    const fresh = (): TenKV2Plan => plan(beg(4, { weeks: 10, km: 18, easy: 480 }));
    const a = fresh();
    quality(a.weeks[3]!)[0]!.workout.dose!.ladder = 'T_continuous';
    expect(errors(a)).toContain('PHASE_QUALITY');
    const b = fresh();
    quality(b.weeks[5]!)[0]!.workout.dose!.ladder = 'RP';
    expect(errors(b)).toContain('PHASE_QUALITY');
    const c = fresh();
    quality(c.weeks[8]!)[0]!.workout.dose!.doseM = 2000;
    expect(errors(c)).toContain('TAPER_QUALITY');
    const d = fresh();
    quality(d.weeks[4]!)[0]!.workout.dose!.doseM = 2000;
    expect(errors(d)).toContain('DELOAD_CONTENT');
  });
});

describe('D32: početnik bez testa', () => {
  it('plan po osećaju početnika nema test; napomena plana; bez ocene cilja i prognoze; rasterećenje bez skraćenog dugog i cilja naviše', () => {
    for (const raw of [
      beg(3, { weeks: 12, km: 15, easy: 450 }),
      beg(4, { weeks: 10, km: 18, easy: 480 }),
      beg(3, { weeks: 14, km: 20, easy: 390 })
    ]) {
      const p = plan(raw);
      expect(p.paceBasis).toBe('feel');
      expect(p.weeks.some((w) => w.test || w.days.some((d) => d.role === 'test'))).toBe(false);
      expect(p.notes.some((n) => n.startsWith('Početnik bez testa 5 km (D32)'))).toBe(true);
      expect([p.goal, p.predicted10kSec]).toEqual([null, null]);
      expect(p.warnings.some((x) => x.rule === 'TEST_DELOAD_LONG')).toBe(false);
      for (const w of p.weeks.filter((x) => x.deload)) {
        expect(w.fitted, `ned ${w.index}`).not.toBe('up');
        const long = w.days.find((d) => d.role === 'long')!.workout.km;
        expect(long).toBeGreaterThanOrEqual(4);
      }
      expect(errors(p)).toEqual([]);
    }
  });

  it('validator hvata test u planu početnika (TEST)', () => {
    const p = plan(beg(3, { weeks: 12, km: 15, easy: 450 }));
    p.weeks[3]!.test = true;
    expect(errors(p)).toContain('TEST');
    const q = plan(beg(4, { weeks: 10, km: 18, easy: 480 }));
    const d = quality(q.weeks[2]!)[0]!;
    d.role = 'test';
    expect(errors(q)).toContain('TEST');
  });
});

describe('D29: trčanje/hodanje', () => {
  it('runWalk true → RUN_WALK_NOT_SUPPORTED (i za početnika); runWalk false → plan', () => {
    const raw = inputOf({ weeks: 12, km: 30, vdot: 40, days: SCHEDULES_BY_DAYS[4].A.days });
    const r = generateTenKV2({ ...raw, runWalk: true });
    expect(!r.ok && r.reasons).toEqual([
      {
        code: 'RUN_WALK_NOT_SUPPORTED',
        message: '10K plan traži neprekidno trčanje ≥ 30 min; preporuka: 5K plan (trčanje/hodanje).'
      }
    ]);
    expect(codes({ ...beg(3, { weeks: 12, km: 15 }), runWalk: true })).toEqual([
      'RUN_WALK_NOT_SUPPORTED'
    ]);
    expect(codes({ ...raw, runWalk: false })).toEqual([]);
    expect(codes({ ...raw, runWalk: 'da' })).toEqual(['INPUT_SHAPE']);
  });
});

import { describe, expect, it } from 'vitest';
import {
  generate,
  renderText,
  V3InputError,
  type PlanDoc,
  type V3Input,
  type Weekday
} from './index.ts';

/* HM v3 — invarijante nad mrežom ≈ 400 ulaza (3–6 dana, 15–90 km, 6–24 nedelje, tri porodice).
   Meri oblik plana brojevima (GAP § 2–3): vrh i silazak, lestvica dugog i bloka RP, provera forme, neponavljanje,
   trkačka nedelja, početnik; i upotrebljivost (čuvar bez nalaza). */

const DAYS: Record<number, Weekday[]> = {
  3: ['tue', 'thu', 'sun'],
  4: ['tue', 'thu', 'sat', 'sun'],
  5: ['mon', 'tue', 'thu', 'sat', 'sun'],
  6: ['mon', 'tue', 'wed', 'thu', 'sat', 'sun']
};
const ALT: Record<number, { days: Weekday[]; long: Weekday }> = {
  3: { days: ['mon', 'wed', 'sat'], long: 'sat' },
  4: { days: ['mon', 'wed', 'fri', 'sat'], long: 'sat' },
  5: { days: ['mon', 'tue', 'wed', 'fri', 'sat'], long: 'sat' },
  6: { days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'], long: 'sat' }
};
const FAMILIES = [
  {
    name: 'rezultat',
    make: (i: number): Partial<V3Input> => ({
      recentResult: { distanceM: 10000, timeSec: [2400, 3000, 3600][i % 3]! }
    })
  },
  {
    name: 'osećaj',
    make: (i: number): Partial<V3Input> => ({ easyPaceSecPerKm: [330, 390, 450][i % 3]! })
  },
  {
    name: 'početnik',
    make: (i: number): Partial<V3Input> =>
      i % 2
        ? { beginner: true, easyPaceSecPerKm: [400, 450][i % 2]! }
        : { beginner: true, recentResult: { distanceM: 10000, timeSec: 3600 } }
  }
];

function iso(day: number): string {
  return new Date(Date.UTC(2026, 10, 2) + day * 86_400_000).toISOString().slice(0, 10);
}

const grid: { label: string; input: V3Input }[] = [];
let n = 0;
for (const d of [3, 4, 5, 6])
  for (const km of [15, 25, 40, 60, 90])
    for (const weeks of [6, 8, 10, 12, 16, 20, 24])
      for (const f of FAMILIES) {
        n++;
        const alt = n % 3 === 0;
        const input: V3Input = {
          startDate: iso(0),
          raceDate: iso(7 * (weeks - 1) + 6),
          runDays: alt ? ALT[d]!.days : DAYS[d]!,
          longRunDay: alt ? ALT[d]!.long : 'sun',
          weeklyKm: f.name === 'početnik' ? Math.min(km, 45) : km,
          beginner: false,
          recentLongRunKm: n % 4 === 0 ? Math.round(km * 0.3) : null,
          goalTimeSec: n % 5 === 0 ? 6000 : null,
          ...f.make(n)
        };
        grid.push({
          label: `${f.name} ${d}d ${input.weeklyKm}km ${weeks}n${alt ? ' alt' : ''}`,
          input
        });
      }

const plans = grid.map((g) => ({ ...g, doc: generate(g.input) }));
const nonRest = (doc: PlanDoc) =>
  doc.weeks.filter((w) => w.kind === 'build' || w.kind === 'peak' || w.kind === 'post-peak');
const longOf = (w: PlanDoc['weeks'][number]) =>
  w.days.find((d) => d.session.kind === 'long')?.session;

describe('HM v3 — mreža invarijanti', () => {
  it('mreža ima 300–450 ulaza i svaki daje plan', () => {
    expect(plans.length).toBeGreaterThanOrEqual(300);
    expect(plans.length).toBeLessThanOrEqual(450);
    for (const p of plans) expect(p.doc.weeks.length, p.label).toBeGreaterThanOrEqual(6);
  });

  it('čuvar bezbednosti nema nalaza', () => {
    const bad = plans
      .filter((p) => p.doc.guard.length)
      .map(
        (p) =>
          `${p.label}: ${p.doc.guard.map((f) => `${f.check} ${f.week} ${f.message}`).join('; ')}`
      );
    expect(bad).toEqual([]);
  });

  it('plan nosi policy, fazu svake nedelje, i čitljiv ispis', () => {
    for (const p of plans) {
      expect(p.doc.policyId).toBe('hm-v3');
      for (const w of p.doc.weeks) expect(w.phase, p.label).toBeTruthy();
      expect(renderText(p.doc)).toContain('NEDELJA 1 ');
    }
  });

  it('vrh i silazak: najteža nedelja po minutima rada 3 nedelje pred trku (≤ 9 ned: 2), sledeća ≤ 85 %, taper ≤ 60 %, trkačka 6–12 min', () => {
    for (const { doc, label } of plans) {
      const N = doc.weeks.length;
      const peakAt = N >= 10 ? N - 3 : N - 2;
      const work = doc.weeks.map((w) => w.workMin);
      const peak = work[peakAt - 1]!;
      expect(Math.max(...work), label).toBe(peak);
      if (N >= 10) expect(work[N - 3]!, label).toBeLessThanOrEqual(0.85 * peak + 0.5);
      expect(work[N - 2]!, label).toBeLessThanOrEqual(0.6 * peak + 0.5);
      expect(work[N - 1]!, label).toBeGreaterThanOrEqual(5.5);
      expect(work[N - 1]!, label).toBeLessThanOrEqual(12.5);
    }
  });

  it('dugi: kreće od ≤ 0,85 najdužeg, raste do vrha; najduži u nedelji vrha; talas u specifičnoj fazi', () => {
    for (const { doc, label } of plans) {
      const N = doc.weeks.length;
      const longs = doc.weeks.map((w) => longOf(w)?.km ?? 0);
      const max = Math.max(...longs);
      expect(longs[0]!, label).toBeLessThanOrEqual(0.85 * max + 0.5);
      const peakAt = N >= 10 ? N - 3 : N - 2;
      expect(longs[peakAt - 1], label).toBe(max);
      const build = doc.weeks
        .filter((w) => w.kind === 'build' && w.phase !== 'specifična')
        .map((w) => longOf(w)?.km ?? 0);
      if (build.length >= 3)
        expect(build[build.length - 1]!, label).toBeGreaterThanOrEqual(build[0]!);
      expect(max, label).toBeGreaterThan(longs[0]!);
      if (N >= 10 && doc.family !== 'beginner') {
        const wave = longs[N - 7]!; // N-6: dole u talasu
        expect(wave, label).toBeLessThanOrEqual(0.88 * Math.max(longs[N - 8]!, longs[N - 6]!));
      }
    }
  });

  it('blok RP u dugom raste do najdužeg u nedelji vrha (redovan, ≥ 10 ned: 4 → 6 → ≥ 7 km)', () => {
    for (const { doc, label } of plans) {
      const N = doc.weeks.length;
      if (N < 10 || doc.family === 'beginner') continue;
      const block = (i: number): number => longOf(doc.weeks[i - 1]!)?.segments[1]?.km ?? 0;
      const b = [block(N - 7), block(N - 5), block(N - 3)];
      expect(b[0], label).toBeGreaterThan(0);
      expect(b[1]!, label).toBeGreaterThan(b[0]!);
      expect(b[2]!, label).toBeGreaterThanOrEqual(b[1]!);
      expect(
        Math.max(...doc.weeks.map((w, i) => (longOf(w)?.zone === 'RP' ? block(i + 1) : 0))),
        label
      ).toBe(b[2]);
    }
  });

  it('nijedna ne-rasteretna nedelja nije ista kao prethodna; ista doza iste zone najviše 2 nedelje zaredom', () => {
    for (const { doc, label } of plans) {
      const nr = nonRest(doc);
      const sig = (w: PlanDoc['weeks'][number]) =>
        w.days
          .map(
            (d) =>
              `${d.session.kind}:${d.session.zone}:${Math.round(d.session.workMin)}:${d.session.kind === 'long' ? d.session.km : ''}:${d.session.text.replace(/[\d,]+ km/g, '')}`
          )
          .join('|');
      for (let i = 1; i < nr.length; i++)
        if (nr[i]!.index === nr[i - 1]!.index + 1)
          expect(sig(nr[i]!), `${label} ned ${nr[i]!.index}`).not.toBe(sig(nr[i - 1]!));
      for (const z of ['T', 'I', 'RP'] as const) {
        let run = 0;
        let prev = -1;
        for (const w of nr) {
          const dose = w.days
            .filter((d) => d.session.kind === 'quality' && d.session.zone === z)
            .map((d) => Math.round(d.session.workMin))[0];
          run = dose !== undefined && dose === prev ? run + 1 : 1;
          prev = dose ?? -1;
          if (dose !== undefined)
            expect(run, `${label} ${z} ned ${w.index}`).toBeLessThanOrEqual(2);
        }
      }
    }
  });

  it('T raste pa menja oblik: plan sa ≥ 4 T treninga ima i deonice i T u komadu', () => {
    for (const { doc, label } of plans) {
      const t = doc.weeks.flatMap((w) =>
        w.days
          .filter((d) => d.session.kind === 'quality' && d.session.zone === 'T')
          .map((d) => d.session.text)
      );
      if (t.length < 4) continue;
      expect(
        t.some((x) => /u komadu/.test(x)),
        label
      ).toBe(true);
      expect(
        t.some((x) => / × /.test(x)),
        label
      ).toBe(true);
    }
  });

  it('provera forme (≥ 8 nedelja) u rasteretnoj nedelji, sa rečenicom šta rezultat znači; plan po osećaju ima test pre nje (≥ 12 ned)', () => {
    for (const { doc, label } of plans) {
      const N = doc.weeks.length;
      if (N < 8) continue;
      const check = doc.weeks.filter((w) =>
        w.days.some((d) => d.session.kind === 'check' && /PRIPREMNA/.test(d.session.text))
      );
      expect(check.length, label).toBe(1);
      expect(check[0]!.kind, label).toBe('rest');
      expect(check[0]!.notes.join(' '), label).toMatch(/Pripremna trka .*(potvrđuje|prognoza)/);
      // plan po osećaju: test pre provere (ili je provera već u 4. nedelji i ona daje tempa)
      if (doc.paces.estimated && N >= 12)
        expect(
          doc.weeks.some((w) => w.days.some((d) => /^TEST/.test(d.session.text))) ||
            check[0]!.index <= 4,
          label
        ).toBe(true);
    }
  });

  it('trkačka nedelja ima plan trke; dugi ≥ 90 min nosi unos; trka je poslednja', () => {
    for (const { doc, label } of plans) {
      const last = doc.weeks[doc.weeks.length - 1]!;
      expect(last.notes.join(' '), label).toMatch(/TRKA: prvih 5 km/);
      expect(last.days[last.days.length - 1]!.session.kind, label).toBe('race');
      for (const w of doc.weeks)
        for (const d of w.days)
          if (d.session.kind === 'long' && d.session.min >= 90)
            expect(d.session.note ?? '', label).toMatch(/unos/);
    }
  });

  it('upotrebljivost: nema praznog treninga, lagan < dugi, nedelja ≥ 3 treninga, kvalitet ima rad', () => {
    for (const { doc, label } of plans)
      for (const w of doc.weeks) {
        const long = longOf(w);
        if (w.kind !== 'race')
          expect(w.days.length, `${label} ned ${w.index}`).toBeGreaterThanOrEqual(3);
        for (const d of w.days) {
          expect(d.session.km, label).toBeGreaterThan(0);
          if (d.session.kind === 'quality') expect(d.session.workMin, label).toBeGreaterThan(1);
          if (long && d.session.kind === 'easy')
            expect(d.session.km, `${label} ned ${w.index}`).toBeLessThanOrEqual(long.km);
        }
      }
  });

  it('početnik: vrh ≤ start × 2,0, dugi ≤ 2 h 05 (+ 3 min), hod-trk za lagan ≥ 7:00/km', () => {
    for (const { doc, label, input } of plans) {
      if (!input.beginner) continue;
      expect(doc.peakKm, label).toBeLessThanOrEqual(input.weeklyKm * 2 + 1);
      for (const w of doc.weeks)
        for (const d of w.days)
          if (d.session.kind === 'long') {
            expect(d.session.min, label).toBeLessThanOrEqual(128);
            if (doc.paces.easy >= 420 && d.session.min >= 90)
              expect(d.session.note ?? '', label).toMatch(/hoda/);
          }
    }
  });

  it('neispravan unos se odbija; kratka/mala priprema daje plan sa preporukom', () => {
    const base = grid[0]!.input;
    expect(() => generate({ ...base, raceDate: base.startDate })).toThrow(V3InputError);
    expect(() => generate({ ...base, runDays: ['tue', 'sun'] })).toThrow(V3InputError);
    expect(() => generate({ ...base, longRunDay: 'wed' })).toThrow(V3InputError);
    expect(() => generate({ ...base, recentResult: null, easyPaceSecPerKm: null })).toThrow(
      V3InputError
    );
    const short = plans.find((p) => p.doc.weeks.length === 6 && p.input.runDays.length === 3)!;
    expect(short.doc.recommendations.join(' ')).toMatch(/kratka/);
    expect(short.doc.recommendations.join(' ')).toMatch(/3 dana/);
  });
});

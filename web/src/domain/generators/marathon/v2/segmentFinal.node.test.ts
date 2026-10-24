import { describe, expect, it } from 'vitest';
import { userText } from './app/format.ts';
import { generateMarathonV2 } from './generate.ts';
import { longRuleOf } from './lengths.ts';
import { MARATHON_V2_POLICY as P, planRule } from './policy.ts';
import { inputOf } from './testInputs.ts';
import type { MarathonV2Plan, Weekday } from './types.ts';
import { belowTargetShown, technicalNote } from './volume.ts';

/* Poslednje ispravke (docs/generators-v2/audit/fixes/04-final.md): F1 tekst korisniku, F2 dugi početnika, F3 nemoguć
   skorašnji najduži trk. */

const D3: Weekday[] = ['tue', 'thu', 'sun'];
const D4: Weekday[] = ['tue', 'thu', 'sat', 'sun'];
const D5: Weekday[] = ['mon', 'tue', 'thu', 'sat', 'sun'];
const D6: Weekday[] = ['mon', 'tue', 'wed', 'thu', 'sat', 'sun'];

const planOf = (o: Parameters<typeof inputOf>[0]): MarathonV2Plan => {
  const g = generateMarathonV2(inputOf(o));
  if (!g.ok) throw new Error(g.reasons.map((r) => `${r.code}: ${r.message}`).join(' | '));
  return g.plan;
};
const longs = (p: MarathonV2Plan) =>
  p.weeks.flatMap((w) => w.days.filter((d) => d.role === 'long').map((d) => ({ w, d })));
const longest = (p: MarathonV2Plan): number => Math.max(...longs(p).map((x) => x.d.workout.km));

/** Sav tekst plana koji korisnik vidi (app: userText; tehnička napomena nedelje se ne prikazuje). */
const shown = (p: MarathonV2Plan): string[] =>
  [
    ...(p.goal ? [p.goal.message] : []),
    ...p.notes,
    ...p.warnings.map((w) => w.message),
    ...p.weeks.flatMap((w) => w.notes.filter((n) => !technicalNote(n)))
  ].map(userText);

const FORBIDDEN = [
  /\b[MADLHN]\d{1,2}[a-z]?\b/,
  /pouk[ae]/,
  /segment/i,
  /T_cruise|T_continuous/,
  /plafon zone/,
  /ne-rasteretn/,
  /[Cc]ilj po pravilu/,
  /konstrukcij/,
  /max\(|min\(/,
  /\b[A-Z]{2,}_[A-Z_]+\b/,
  /\d\.\d/
];

describe('F1: tekst korisniku', () => {
  it('bez internih oznaka, formula i kodova; decimalni zarez (mreža profila)', () => {
    const bad: string[] = [];
    for (const [days, km] of [
      [D3, 30],
      [D3, 45],
      [D4, 35],
      [D4, 50],
      [D4, 65],
      [D5, 60],
      [D6, 110]
    ] as const)
      for (const weeks of [12, 18])
        for (const pace of [{ vdot: 40 }, { vdot: 58 }, { easyPace: 360 }])
          for (const recentLongRunKm of [undefined, 10, 18]) {
            const g = generateMarathonV2(inputOf({ weeks, km, days, ...pace, recentLongRunKm }));
            const texts = g.ok ? shown(g.plan) : g.reasons.map((r) => userText(r.message));
            for (const t of texts)
              for (const re of FORBIDDEN) if (re.test(t)) bad.push(`${re}: ${t}`);
          }
    expect(bad).toEqual([]);
  });

  it('primeri prevoda: oznake, formula skoka dugog, rasterećenje, taper', () => {
    expect(
      userText(
        'Dugi 11,0 km = plafon skoka max(1,1 × L; L + 1,0 km), L = 10,0 km (najduže dugo trčanje prethodne 4 nedelje ili skorašnje najduže trčanje) (M13a).'
      )
    ).toBe(
      'Dugi 11,0 km: dugo trčanje raste najviše 10 % ili 1 km nedeljno od najdužeg u prethodne 4 nedelje ili skorašnjeg najdužeg (10,0 km).'
    );
    expect(
      userText(
        'Rasterećenje: cilj 28,6 km, jedan kvalitet (T), dugi 0,8 × poslednji ne-rasteretni (M5).'
      )
    ).toBe(
      'Rasterećenje: cilj 28,6 km, jedan kvalitet (T), dugi 0,8 × poslednjeg dugog pre rasterećenja.'
    );
    expect(
      userText('Taper N−1: MP 6000 m > 20 % cilja 27 km — minimum tapera ispred plafona (M7a).')
    ).toBe(
      'Taper (nedelja pre trke): MP 6000 m je više od 20 % nedelje od 27 km — u taperu najmanja MP doza ima prednost nad tom granicom.'
    );
  });

  it('„Vrh X km umesto do X km" se ne prikazuje kad su vrednosti iste', () => {
    const p = planOf({ weeks: 18, km: 50, days: D4, vdot: 45 });
    const cap = p.notes.find((n) => n.includes('ne nose ovaj obim'))!;
    expect(cap).toBeDefined();
    expect(p.peakKm).toBe(p.peakCapKm);
    expect(cap).not.toContain('umesto do');
    expect(p.warnings.find((w) => w.rule === 'CAPACITY_LIMITED')!.message).toBe(cap);
  });

  it('„planirano < cilj" samo za razliku ≥ 1 km ili ≥ 3 % cilja', () => {
    expect(belowTargetShown(32.4, 32.4)).toBe(false);
    expect(belowTargetShown(40.5, 41)).toBe(false);
    expect(belowTargetShown(40, 41)).toBe(true);
    expect(belowTargetShown(19.3, 20)).toBe(true);
  });

  it('stvarni razlog kratkog dugog: skok dugog, ne udeo', () => {
    // 3 dana / 30 km / 12 nedelja, skorašnji najduži 8 km: dugi raste postepeno od 8 km.
    const p = planOf({ weeks: 12, km: 30, days: D3, vdot: 45, recentLongRunKm: 8 });
    const w = p.warnings.find((x) => x.rule === 'MARATHON_LONG_SHORT');
    expect(w?.message).toContain('postepen rast dugog trčanja');
    expect(w?.message).not.toContain('udeo dugog');
  });
});

describe('F2: najduži dugi početnika', () => {
  it('poslednje 3 nedelje izgradnje pred taperom (ne rasterećenje): dugi do 50 % i 180 min; ostale nedelje 40 % / 150 min', () => {
    const input = inputOf({ weeks: 20, km: 30, days: D4, easyPace: 420, experience: 'beginner' });
    const p = planOf({ weeks: 20, km: 30, days: D4, easyPace: 420, experience: 'beginner' });
    const rule = planRule(4, 'beginner')!;
    const taper = p.weeks.find((w) => w.phase === 'taper')!.index;
    for (const w of p.weeks) {
      const r = longRuleOf(rule, true, p.weeks, w.index);
      const peak = w.index >= taper - 3 && w.index < taper && !w.deload;
      expect(r.longMaxShare, `ned ${w.index}`).toBe(peak ? 0.5 : rule.longMaxShare);
      expect(r.longMaxSec ?? P.lengths.longMaxSec).toBe(peak ? 10800 : P.lengths.longMaxSec);
    }
    // Pre: 18,0 km (udeo 40 %); posle: duži, uz skok dugog.
    expect(longest(p)).toBeGreaterThan(18);
    expect(input.experience).toBe('beginner');
    const w = p.warnings.find((x) => x.rule === 'MARATHON_LONG_SHORT')!;
    expect(w.message).toBe(
      `Najduže dugo trčanje u planu je ${String(longest(p)).replace('.', ',')} km; za maraton se preporučuje bar 26 km — duža priprema ili veći nedeljni obim bi pomogli. Početnik: cilj je završiti maraton.`
    );
  });

  it('kad priprema i obim dozvoljavaju: vrh dugog ≥ 26 km', () => {
    const p = planOf({ weeks: 20, km: 45, days: D5, easyPace: 360, experience: 'beginner' });
    expect(longest(p)).toBeGreaterThanOrEqual(26);
    expect(p.warnings.some((x) => x.rule === 'MARATHON_LONG_SHORT')).toBe(false);
  });

  it('ne-početnik: pravilo dugog nepromenjeno (isti objekat)', () => {
    const rule = planRule(4)!;
    const p = planOf({ weeks: 18, km: 50, days: D4, vdot: 45 });
    for (const w of p.weeks) expect(longRuleOf(rule, false, p.weeks, w.index)).toBe(rule);
  });
});

describe('F3: nemoguć skorašnji najduži trk', () => {
  it('kraći od nedeljnog obima / 7 → RECENT_LONG_INVALID sa oba broja', () => {
    const g = generateMarathonV2(
      inputOf({ weeks: 16, km: 65, days: D4, vdot: 58, recentLongRunKm: 8 })
    );
    expect(g.ok).toBe(false);
    if (g.ok) return;
    const r = g.reasons.find((x) => x.code === 'RECENT_LONG_INVALID')!;
    expect(r.message).toBe(
      'Skorašnje najduže trčanje 8 km je prekratko za trenutni nedeljni obim 65 km (ni sa 7 dana trčanja nedelja ne može biti tolika) — proveri unos.'
    );
  });

  it('granica je 7 dana (ne broj dana plana); na granici i iznad prolazi', () => {
    const at = generateMarathonV2(
      inputOf({ weeks: 16, km: 35, days: D4, vdot: 45, recentLongRunKm: 5 })
    );
    expect(!at.ok && at.reasons.some((x) => x.code === 'RECENT_LONG_INVALID')).toBe(false);
    const g = generateMarathonV2(
      inputOf({ weeks: 16, km: 42, days: D3, vdot: 45, recentLongRunKm: 5.9 })
    );
    expect(!g.ok && g.reasons.some((x) => x.code === 'RECENT_LONG_INVALID')).toBe(true);
  });
});

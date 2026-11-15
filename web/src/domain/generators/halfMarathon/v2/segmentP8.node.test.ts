/* Segment P8 (hm-v2.11.0) — ispravke po slepoj oceni i izveštaju glavnog trenera: G1 plafon vrha i rast do kraja
   razvoja, G2 najniži nivo lestvice staje, G4 plafon treninga u minutima, G5 oštrenje ≤ 12 min i rasterećenje ≈ 60 %
   iste zone, G6 lagan ≤ 0,70 × dugi (4+ dana), G7 nedelja testa, HM (b) ≤ 22 % vremena u trkačkom tempu u nedelji sa
   blokom. Nezavisno od funkcija konstruktora (brojevi pravila upisani ovde). */

import { describe, expect, it } from 'vitest';
import { generateHmV2 } from './generate.ts';
import { deloadDose } from './quality.ts';
import { planRule } from './policy.ts';
import { beginnerInputs, feelInputs, grid02Inputs } from './testInputs.ts';
import type { HmV2Plan, PlanDay, PlanWeek } from './types.ts';
import { userText } from './userText.ts';
import { userWeekNotes } from './volume.ts';

const SAMPLE = [
  ...grid02Inputs().filter((_, i) => i % 61 === 0),
  ...feelInputs().filter((_, i) => i % 67 === 0),
  ...beginnerInputs().filter((_, i) => i % 29 === 0)
];
const plans: { id: string; plan: HmV2Plan }[] = SAMPLE.map((g) => {
  const r = generateHmV2(g.input);
  if (!r.ok) throw new Error(`${g.id}: ${JSON.stringify(r.reasons)}`);
  return { id: g.id, plan: r.plan };
});
const isBuild = (w: PlanWeek): boolean => ['base', 'development', 'specific'].includes(w.phase);
const workSec = (d: PlanDay, zone?: string): number =>
  d.workout.segments
    .filter((s) => (s.kind === 'rep' || s.kind === 'continuous') && (!zone || s.zone === zone))
    .reduce((a, s) => a + s.sec, 0);
const weekSec = (w: PlanWeek): number =>
  w.days.filter((d) => d.countsToWeek).reduce((a, d) => a + d.workout.sec, 0);
const midE = (p: HmV2Plan): number => (p.paces.E.fast + p.paces.E.slow) / 2;
const beginner = (p: HmV2Plan): boolean => p.input.experience === 'beginner';
const FIRST_M: Record<string, number> = {
  R: 1200,
  I: 2000,
  T_continuous: 2000,
  T_cruise: 2400,
  RP: 4000
};

describe('P8: uzorak', () => {
  it('uzorak pokriva redovan plan, po osećaju i početnika; 0 odbijanja', () => {
    expect(plans.length).toBeGreaterThan(400);
    expect(plans.some((x) => beginner(x.plan))).toBe(true);
    expect(plans.some((x) => x.plan.paceBasis === 'feel')).toBe(true);
  });
});

describe('P8-G4: plafon jednog treninga u minutima rada', () => {
  it('T ≤ 30 min (cilj ≥ 80 km: 40), I ≤ 20 min za VDOT < 40 inače 24, RP usred nedelje ≤ 45 min — ili prvi nivo lestvice', () => {
    let rpAtCap = 0;
    for (const { id, plan } of plans)
      for (const w of plan.weeks.filter((x) => x.phase !== 'race'))
        for (const d of w.days.filter((x) => x.role === 'q1' || x.role === 'q2')) {
          const dose = d.workout.dose!;
          const max =
            dose.zone === 'T'
              ? w.targetKm >= 80
                ? 2400
                : 1800
              : dose.zone === 'I'
                ? plan.paces.vdot < 40
                  ? 1200
                  : 1440
                : dose.zone === 'RP'
                  ? 2700
                  : Infinity;
          const first =
            dose.doseM <= (beginner(plan) && dose.zone === 'T' ? 2400 : FIRST_M[dose.ladder]!);
          if (!first)
            expect(workSec(d), `${id} ned ${w.index} ${dose.zone}`).toBeLessThanOrEqual(max + 3);
          if (dose.zone === 'RP' && workSec(d) > 2400) rpAtCap++;
        }
    // Plafon stvarno seče: uzorak ima RP treninge od 40–45 min.
    expect(rpAtCap).toBeGreaterThan(0);
  });
});

describe('P8-G5: oštrenje i rasterećenje', () => {
  it('oštrenje: dve jednake deonice, deljive sa 100 m, 400–2000 m, ukupno ≤ 12 min rada; najduža koja staje', () => {
    let n = 0;
    for (const { id, plan } of plans) {
      const s = plan.weeks.at(-1)!.days.find((d) => d.role === 'sharpener');
      if (!s) continue;
      n++;
      const reps = s.workout.segments.filter((x) => x.kind === 'rep');
      expect(reps.length, id).toBe(2);
      const m = Math.round(reps[0]!.km * 1000);
      expect(Math.round(reps[1]!.km * 1000), id).toBe(m);
      expect(m % 100, id).toBe(0);
      expect(m, id).toBeGreaterThanOrEqual(400);
      expect(m, id).toBeLessThanOrEqual(2000);
      expect(workSec(s), id).toBeLessThanOrEqual(722);
      if (m < 2000) expect(((2 * (m + 100)) / 1000) * plan.paces.RP, id).toBeGreaterThan(720);
    }
    expect(n).toBeGreaterThan(plans.length * 0.9);
  });

  it('rasterećenje plana sa jednim kvalitetom: T ≈ 60 % poslednje T doze, ne doze slota (RP)', () => {
    const rule = planRule(3, 'regular')!;
    const d = deloadDose(
      {
        q1: { ladder: 'RP', doseM: 8000, structure: { form: 'reps', reps: 2, repM: 4000 } },
        q2: null,
        t: 4000
      },
      'specific',
      rule
    );
    expect(d.doseM).toBeLessThanOrEqual(0.6 * 4000 + 1e-6);
  });
});

describe('P8-G1: plafon vrha i rast do kraja razvoja', () => {
  it('vrh ≤ start × faktor po dužini pripreme i ≤ satni plafon (ili = start); korak rasta ≥ 3 % ili ga nema', () => {
    let capped = 0;
    for (const { id, plan } of plans) {
      const n = plan.weeks.length;
      const factor = n <= 12 ? 1.3 : n <= 15 ? 1.35 : 1.4;
      const hours = plan.paces.vdot < 40 ? 7.5 : plan.paces.vdot < 50 ? 8.5 : 9.5;
      const hourKm = (hours * 3600) / midE(plan);
      const cap = Math.max(plan.startKm, Math.min(plan.startKm * factor, hourKm));
      expect(plan.peakCapKm, id).toBeLessThanOrEqual(cap + 1e-6);
      if (plan.peakCapKm < plan.startKm * 1.4 - 0.11) capped++;
      const nd = plan.weeks.filter((w) => isBuild(w) && !w.deload);
      for (let i = 1; i < nd.length; i++) {
        const [a, b] = [nd[i - 1]!, nd[i]!];
        // Nedelje na izvodljivom cilju (kapacitet) nisu korak po pravilu.
        if (a.fitted || b.fitted || b.targetKm <= a.targetKm) continue;
        expect(b.targetKm - a.targetKm, `${id} ned ${b.index}`).toBeGreaterThanOrEqual(
          0.03 * a.targetKm - 0.051
        );
      }
    }
    expect(capped).toBeGreaterThan(0);
  });

  it('rast je raspoređen: plan bez spuštenih nedelja ne dostiže vrh pre pretposlednje ne-rasteretne nedelje baze/razvoja', () => {
    let checked = 0;
    for (const { id, plan } of plans) {
      const nd = plan.weeks.filter(
        (w) => !w.deload && (w.phase === 'base' || w.phase === 'development')
      );
      if (plan.weeks.some((w) => w.fitted) || plan.peakKm <= plan.startKm || nd.length < 4)
        continue;
      const first = plan.weeks.find((w) => isBuild(w) && w.targetKm === plan.peakKm)!;
      checked++;
      expect(first.index, id).toBeGreaterThanOrEqual(nd[nd.length - 2]!.index);
    }
    expect(checked).toBeGreaterThan(50);
  });
});

describe('P8-G2: najniži nivo lestvice uvek staje', () => {
  it('početnik ima trkački tempo u specifičnoj fazi; taper ima trkački tempo kad nedelja može da se sastavi', () => {
    let begRp = 0;
    let begN = 0;
    let taperNoRp = 0;
    for (const { id, plan } of plans) {
      const rp = (w: PlanWeek): boolean => w.days.some((d) => d.workout.dose?.zone === 'RP');
      if (beginner(plan)) {
        begN++;
        if (plan.weeks.some((w) => w.phase === 'specific' && rp(w))) begRp++;
      }
      const t = plan.weeks.find((w) => w.phase === 'taper')!;
      if (!rp(t)) {
        taperNoRp++;
        // Bez trkačkog tempa samo taper bez ikakvog kvaliteta ili T početnika — mali obim (najmanje doze ne staju).
        expect(t.targetKm, id).toBeLessThan(26.7);
      }
    }
    expect(begRp).toBe(begN);
    expect(taperNoRp).toBeLessThan(plans.length * 0.03);
  });

  it('doza iznad udela H11 je samo prvi nivo lestvice (ne viši)', () => {
    let floors = 0;
    for (const { id, plan } of plans)
      for (const w of plan.weeks.filter((x) => x.phase !== 'race' && !x.deload))
        for (const d of w.days.filter((x) => x.role === 'q1' || x.role === 'q2')) {
          const dose = d.workout.dose!;
          const share =
            dose.zone === 'R'
              ? 0.05
              : dose.zone === 'I'
                ? 0.08
                : dose.zone === 'T'
                  ? 0.1
                  : w.targetKm >= 40
                    ? 0.2
                    : 0.15;
          if (dose.doseM <= Math.floor(share * w.targetKm * 1000 + 1e-6)) continue;
          floors++;
          expect(dose.doseM, `${id} ned ${w.index} ${dose.ladder}`).toBeLessThanOrEqual(
            FIRST_M[dose.ladder]!
          );
        }
    expect(floors).toBeGreaterThan(0);
  });
});

describe('P8-G6: lagan dan prema dugom', () => {
  it('4+ dana: lagan ≤ 0,70 × dugi u ne-rasteretnoj nedelji izgradnje (3 dana ≤ 0,80); izuzetak nedelja na minimumu', () => {
    let over7 = 0;
    for (const { id, plan } of plans) {
      const days = plan.input.runDays.length;
      const rule = planRule(days, beginner(plan) ? 'beginner' : 'regular')!;
      for (const w of plan.weeks.filter((x) => isBuild(x) && !x.deload)) {
        if (w.targetKm <= rule.weekMinKm) continue;
        const long = w.days.find((d) => d.role === 'long')!.workout.km;
        for (const d of w.days.filter((x) => x.role === 'easy')) {
          // Odluka posle STOP: plan sa oznakom početnika 0,80 bez obzira na broj dana.
          const share = days >= 4 && !beginner(plan) ? 0.7 : 0.8;
          expect(d.workout.km, `${id} ned ${w.index}`).toBeLessThanOrEqual(
            Math.floor(share * long * 10 + 1e-9) / 10
          );
          if (d.workout.km > 0.7 * long + 1e-9) over7++;
        }
      }
    }
    // Samo plan sa 3 dana sme iznad 0,70.
    expect(over7).toBeGreaterThan(0);
  });
});

describe('P8-G7: nedelja testa', () => {
  it('test je jedini kvalitet nedelje i ne ide pre nedelje 4; plan u kome bi pao ranije nema test (napomena)', () => {
    let tests = 0;
    let none = 0;
    for (const { id, plan } of plans) {
      const tw = plan.weeks.filter((w) => w.days.some((d) => d.role === 'test'));
      expect(tw.length, id).toBeLessThanOrEqual(1);
      if (tw.length === 0) {
        // STOP S5: plan po osećaju koji nije početnik uvek ima test (10–12 nedelja: prva nedelja razvoja).
        if (plan.paceBasis === 'feel' && !beginner(plan)) none++;
        continue;
      }
      tests++;
      expect(tw[0]!.index, id).toBeGreaterThanOrEqual(4);
      expect(
        tw[0]!.days.filter((d) => d.workout.kind === 'quality'),
        id
      ).toEqual([]);
    }
    expect(tests).toBeGreaterThan(100);
    expect(none).toBe(0);
  });
});

describe('P8-HM (b): nedelja sa blokom', () => {
  it('rad u trkačkom tempu (RP trening + blok) ≤ 22 % vremena nedelje', () => {
    let blocks = 0;
    for (const { id, plan } of plans)
      for (const w of plan.weeks) {
        const long = w.days.find((d) => d.role === 'long');
        if (!long || long.workout.workKm.RP <= 0) continue;
        blocks++;
        const rp = w.days.reduce((a, d) => a + workSec(d, 'RP'), 0);
        // Vreme nedelje po pravilu: lagani srednjim laganim tempom (ubrzanja ne menjaju dužinu dana).
        const sec = w.days.reduce(
          (a, d) => a + (d.role === 'easy' ? d.workout.km * midE(plan) : d.workout.sec),
          0
        );
        expect(rp / sec, `${id} ned ${w.index}`).toBeLessThanOrEqual(0.22 + 0.002);
        expect(weekSec(w)).toBeGreaterThan(0);
      }
    expect(blocks).toBeGreaterThan(100);
  });
});

describe('P8-G3: tekst za trkača', () => {
  it('tekst koji korisnik vidi nema interne oznake ni reči sastavljanja', () => {
    const BAD =
      /nije izvodljiv|odstupanje|cilj po pravilu|pouk[aeiu] \d|\bHI?\d+\b|\(F\d\)|segment \d|rezultat koristi adaptacija/i;
    for (const { id, plan } of plans) {
      const texts = [
        ...plan.notes.map(userText),
        ...plan.warnings.map((v) => userText(v.message)),
        ...plan.weeks.flatMap((w) => userWeekNotes(w))
      ];
      for (const t of texts) expect(BAD.test(t), `${id}: ${t}`).toBe(false);
    }
  });

  it('napomena tapera ne tvrdi „≈ 60 %" za najmanju dozu bez objašnjenja', () => {
    let floor = 0;
    for (const { id, plan } of plans) {
      const t = plan.weeks.find((w) => w.phase === 'taper')!;
      const rp = t.days.find((d) => d.workout.dose?.zone === 'RP');
      const last = plan.weeks
        .filter((w) => isBuild(w) && !w.deload)
        .flatMap((w) =>
          w.days.filter(
            (d) => (d.role === 'q1' || d.role === 'q2') && d.workout.dose?.zone === 'RP'
          )
        )
        .pop();
      if (!rp || !last || rp.workout.dose!.doseM <= 0.6 * last.workout.dose!.doseM + 1e-6) continue;
      floor++;
      expect(t.notes.join(' '), id).toContain('najmanja doza u trkačkom tempu');
    }
    // K3-B: taper RP je uvek ≤ 60 % poslednje doze (kraća struktura van lestvice) — slučaja „najmanja doza iznad
    // 60 %" više nema (bilo > 0).
    expect(floor).toBe(0);
  });
});

describe('P8 završetak (hm-v2.12.0): odluke po STOP-u', () => {
  it('G8: dugi početnika ≤ max(udeo reda; min(50 % cilja, 16 km)) i u uzorku prelazi udeo reda', () => {
    let over = 0;
    let reach16 = 0;
    for (const { id, plan } of plans.filter((x) => beginner(x.plan))) {
      const row = planRule(plan.input.runDays.length, 'beginner')!.longMaxShare;
      let longest = 0;
      for (const w of plan.weeks.filter((x) => x.phase !== 'race')) {
        const l = w.days.find((d) => d.role === 'long')!.workout.km;
        longest = Math.max(longest, l);
        expect(l, `${id} ned ${w.index}`).toBeLessThanOrEqual(
          Math.max(row * w.targetKm, Math.min(0.5 * w.targetKm, 16)) + 1e-9
        );
        if (l > row * w.targetKm + 0.05) over++;
      }
      if (longest >= 16) reach16++;
    }
    expect(over).toBeGreaterThan(0);
    expect(reach16).toBeGreaterThan(0);
  });

  it('G6 početnik: lagan ≤ 0,80 × dugi; planirani vrh nije ispod 0,9 × granice vrha', () => {
    for (const { id, plan } of plans.filter((x) => beginner(x.plan))) {
      const peak = Math.max(
        ...plan.weeks.filter((w) => isBuild(w) && !w.deload).map((w) => w.plannedKm)
      );
      expect(peak, id).toBeGreaterThanOrEqual(0.9 * plan.peakCapKm);
    }
  });

  it('mesto testa: plan sa rezultatom — pretposlednja ne-rasteretna nedelja razvoja (≥ 4); po osećaju 10–12 ned — prva nedelja razvoja', () => {
    let result = 0;
    let shortFeel = 0;
    for (const { id, plan } of plans.filter((x) => !beginner(x.plan))) {
      const tw = plan.weeks.find((w) => w.days.some((d) => d.role === 'test'));
      const dev = plan.weeks.filter((w) => w.phase === 'development' && !w.deload && w.index >= 4);
      if (plan.paceBasis !== 'feel') {
        if (plan.weeks.length < 12) continue;
        result++;
        expect(tw!.index, id).toBe(dev.length >= 2 ? dev[dev.length - 2]!.index : dev[0]!.index);
      } else if (plan.weeks.length <= 12) {
        shortFeel++;
        expect(tw!.index, id).toBe(dev[0]!.index);
        expect(tw!.phase, id).toBe('development');
      } else expect(tw!.phase, id).toBe('base');
    }
    expect(result).toBeGreaterThan(50);
    expect(shortFeel).toBeGreaterThan(0);
  });
});

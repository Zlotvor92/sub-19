import { describe, expect, it } from 'vitest';
import { buildState, guard, plan, validate } from './index';
import { build, facts, goalAt, grid, HALF_M } from './testdata/helpers';
import { SYNTHETIC } from './testdata/synthetic';
import type { Goal, InputErrorCode, RunnerFacts, Warning } from './types';

/* Gde ulaz sam traži nalaz (motor ne odbija, čuvar prijavljuje):
   - 1–2 dana trčanja: nedelja ne može da stigne do cilja ni do 3 treninga; udeo brzog rada i skok su posledica;
   - 3 dana: kvalitet + dugi pojedu cilj pa lagan dan otpada (ispod cilja, manje od 3 treninga);
   - obim po danu trčanja van razumnog (> 70 ili < 25 bodova po danu): plafoni laganih dana, lagan dan uz kratak dugi;
     ispod 25 i skok — svaki traženi dan ostaje na najkraćem trčanju (krug 2, R4), pa nedelja pređe pravilo rasta;
   - plan koji počinje u rampi posle trke: prve nedelje posle rampe su ispod cilja (dugi kreće od trajanja trke). */
function allowed(
  check: string,
  runDays: number,
  perDay: number,
  afterRace: boolean,
  weekIndex: number | null
): boolean {
  if (runDays <= 2)
    return ['ispod-cilja', 'min-nedelja', 'brz-udeo', 'skok', 'taper', 'lagan-dugi'].includes(
      check
    );
  if (runDays === 3 && ['ispod-cilja', 'min-nedelja'].includes(check)) return true;
  if (perDay > 70) return check === 'ispod-cilja';
  if (perDay < 25) return ['ispod-cilja', 'lagan-dugi', 'skok'].includes(check);
  return afterRace && check === 'ispod-cilja' && (weekIndex ?? 99) <= 4;
}

describe('čuvar na mreži ispravnih ulaza (SPEC § 8.2)', () => {
  it('bez nalaza, osim tamo gde ulaz to traži', () => {
    let clean = 0;
    for (const c of grid()) {
      const b = build(c.facts, c.goal);
      const runDays = c.facts.availability.runDays.length;
      const perDay = b.doc.header.decisions.baseLoad / runDays;
      const findings = guard(b.doc, b.state, SYNTHETIC);
      if (findings.length === 0) clean += 1;
      for (const f of findings) {
        expect(
          allowed(f.check, runDays, perDay, c.facts.runs.length > 0, f.weekIndex),
          `${c.name}: ${f.check} @${String(f.weekIndex)}`
        ).toBe(true);
      }
    }
    expect(clean).toBeGreaterThan(80);
  });

  it('nijedan nalaz o dozi, dugom, praznom treningu, uzastopnim teškim danima ni trci', () => {
    const never = [
      'doza-plafon',
      'dugi-plafon',
      'dugi-korak',
      'prazan',
      'teski-uzastopno',
      'trka',
      'nema-treninga',
      'rucno'
    ];
    for (const c of grid()) {
      const b = build(c.facts, c.goal);
      const hit = guard(b.doc, b.state, SYNTHETIC).filter((f) => never.includes(f.check));
      expect(
        hit.map((f) => `${f.check}@${String(f.weekIndex)}`),
        c.name
      ).toEqual([]);
    }
  });

  it('čuvar prijavljuje ručno pokvaren plan, ali ga ne menja', () => {
    const b = build(facts(), goalAt('2027-01-24'));
    const broken = structuredClone(b.doc);
    const week = broken.weeks[2];
    const quality = week?.days.find((d) => d.workout?.kind === 'quality');
    const next = week?.days.find((d) => d.date > (quality?.date ?? ''));
    if (quality?.workout == null || next === undefined) throw new Error('nema dana');
    next.workout = { ...quality.workout, workSec: 5000 };
    next.origin = 'manual';
    const before = JSON.stringify(broken);
    const findings = guard(broken, b.state, SYNTHETIC);
    expect(findings.some((f) => f.check === 'rucno' && f.message.startsWith('doza-plafon'))).toBe(
      true
    );
    expect(findings.some((f) => f.message.includes('uzastopnim'))).toBe(true);
    expect(JSON.stringify(broken)).toBe(before);
  });
});

describe('odbija se samo neispravan unos (SPEC § 8.1)', () => {
  const goal = goalAt('2027-01-24');
  const reject = (f: RunnerFacts, g: Goal): InputErrorCode[] => {
    const result = plan(buildState(f, g, SYNTHETIC), g, SYNTHETIC);
    expect(result.ok).toBe(false);
    const fromFacts = validate(f, g, SYNTHETIC).map((e) => e.code);
    return result.ok ? [] : [...new Set([...result.errors.map((e) => e.code), ...fromFacts])];
  };

  it.each<[string, Partial<RunnerFacts>, Partial<Goal>, InputErrorCode]>([
    ['datum koji ne postoji', {}, { raceDate: '2027-02-30' }, 'datum-neispravan'],
    ['datum u pogrešnom obliku', {}, { raceDate: '24.1.2027' }, 'datum-neispravan'],
    ['danas neispravno', { today: '2026-13-01' }, {}, 'datum-neispravan'],
    ['trka danas', {}, { raceDate: '2026-11-15' }, 'trka-u-proslosti'],
    ['trka u prošlosti', {}, { raceDate: '2026-10-01' }, 'trka-u-proslosti'],
    ['početak posle trke', {}, { startDate: '2027-02-01' }, 'datum-neispravan'],
    ['nula dana', { availability: { runDays: [], longDay: 6 } }, {}, 'nema-dana'],
    ['dugi van dana', { availability: { runDays: [1, 3], longDay: 6 } }, {}, 'dugi-van-dana'],
    ['km nula', { profile: { weeklyKm: 0 } }, {}, 'broj-neispravan'],
    ['km nije broj', { profile: { weeklyKm: Number.NaN } }, {}, 'broj-neispravan'],
    ['tempo negativan', { profile: { easyPaceSecPerKm: -300 } }, {}, 'broj-neispravan'],
    [
      'rezultat beskonačan',
      { profile: { recentResult: { distanceM: 5000, timeSec: Number.POSITIVE_INFINITY } } },
      {},
      'broj-neispravan'
    ],
    ['ciljno vreme nula', {}, { targetTimeSec: 0 }, 'broj-neispravan'],
    ['druga distanca', {}, { distanceId: 'nesto-drugo' }, 'nepoznata-distanca']
  ])('%s', (_name, f, g, code) => {
    expect(reject(facts(f), { ...goal, ...g })).toContain(code);
  });

  it('trčanje sa neispravnim trajanjem odbija provera činjenica', () => {
    const f = facts({ runs: [{ id: 'x', date: '2026-11-10', distanceM: 5000, durationSec: 0 }] });
    expect(validate(f, goal, SYNTHETIC).map((e) => e.code)).toContain('broj-neispravan');
  });
});

const sentences = (w: Warning): string[] => [w.problem, w.meaning, w.proposal];

describe('sve se pravi uz upozorenje (AGENTS t. 6)', () => {
  const marathonLength = {
    ...SYNTHETIC,
    id: 'syn42',
    distanceM: 42195,
    label: 'probna trka 42,2 km',
    adequate: {
      minWeeks: 16,
      minPeakWeeklyKm: 55,
      minRunDays: 4,
      minLongKm: 28,
      shorter: { distanceId: 'syn21', label: 'probna trka 21,1 km' }
    }
  };
  const goal: Goal = { distanceId: 'syn42', raceDate: '2026-12-06' };
  const f = facts({ availability: { runDays: [6], longDay: 6 }, profile: { weeklyKm: 5 } });
  const state = buildState(f, goal, marathonLength);
  const result = plan(state, goal, marathonLength);

  it('42,2 km za 3 nedelje, 1 dan, 5 km nedeljno → plan, ne odbijanje', () => {
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.doc.weeks).toHaveLength(3);
    expect(
      result.doc.weeks.flatMap((w) => w.days).filter((d) => d.workout !== null).length
    ).toBeGreaterThanOrEqual(3);
  });

  it('upozorenja: kratka priprema, mali obim, malo dana, kratak dugi, nema podataka', () => {
    if (!result.ok) throw new Error('odbijeno');
    const codes = result.doc.header.warnings.map((w) => w.code);
    expect(codes).toEqual(
      expect.arrayContaining([
        'kratka-priprema',
        'mali-obim',
        'malo-dana',
        'kratak-dugi',
        'nema-podataka'
      ])
    );
  });

  it('svako upozorenje ima tri rečenice i predlog sa brojem', () => {
    if (!result.ok) throw new Error('odbijeno');
    for (const w of result.doc.header.warnings) {
      for (const s of sentences(w)) {
        expect(s.length, w.code).toBeGreaterThan(25);
        expect(s.trim().endsWith('.'), `${w.code}: ${s}`).toBe(true);
      }
      expect(/\d/.test(w.proposal), `${w.code}: ${w.proposal}`).toBe(true);
    }
    const short = result.doc.header.warnings.find((w) => w.code === 'kratka-priprema');
    expect(short?.problem).toContain('3 nedelje');
    expect(short?.proposal).toContain('16 nedelja');
    expect(short?.proposal).toContain('probna trka 21,1 km');
    expect(short?.suggest).toEqual({ weeks: 16, distanceId: 'syn21' });
    expect(result.doc.header.warnings.find((w) => w.code === 'malo-dana')?.suggest).toEqual({
      runDays: 4
    });
  });

  it('početnik bez ijednog podatka dobija plan po osećaju i upozorenje', () => {
    const g = goalAt('2027-01-24');
    const empty = facts({ profile: { beginner: true } });
    const b = build(empty, g);
    expect(b.doc.header.paces.byFeel).toBe(true);
    expect(b.doc.header.form.start.vdot).toBe(30);
    expect(b.doc.header.warnings.map((w) => w.code)).toContain('nema-podataka');
    expect(b.doc.weeks.every((w) => w.days.some((d) => d.workout !== null))).toBe(true);
  });

  it('cilj brži od raspona → upozorenje sa realnim rasponom', () => {
    const g = goalAt('2027-01-24', { targetTimeSec: 1800 });
    const b = build(facts(), g);
    const w = b.doc.header.warnings.find((x) => x.code === 'cilj-van-raspona');
    expect(w?.problem).toContain('30:00');
    expect(w?.meaning).toMatch(/\d+:\d\d–\d+:\d\d/);
    const fine = build(
      facts({ profile: { weeklyKm: 30, recentResult: { distanceM: HALF_M, timeSec: 6060 } } }),
      goalAt('2027-01-24', { targetTimeSec: 2400 })
    );
    expect(fine.doc.header.warnings.map((x) => x.code)).not.toContain('cilj-van-raspona');
  });
});

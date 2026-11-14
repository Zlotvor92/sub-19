import { describe, expect, it } from 'vitest';
import { addDays } from './dates';
import { count, DAYS, KM, MINUTES, WEEKS, WORKOUTS } from './format';
import { weekCost } from './guard';
import { buildState, canonical, deriveEvents, paceCtxOf, plan, replan, summarize } from './index';
import { EXAMPLE } from './testdata/example';
import { advance, build, facts, goalAt, grid, runsAsPlanned } from './testdata/helpers';
import { SYNTHETIC } from './testdata/synthetic';
import type {
  DistanceData,
  Goal,
  PlanDay,
  PlanDoc,
  Run,
  RunnerFacts,
  RunnerState,
  Warning
} from './types';

/* ČETVRTI KRUG i dodatak trećem (zahtevi polumaratona i adaptera, prihvatio organizator). */

const NUMBERS = [1, 2, 5, 11, 21, 22];
const days = (doc: PlanDoc): PlanDay[] => doc.weeks.flatMap((w) => w.days);

function make(
  f: RunnerFacts,
  goal: Goal,
  data: DistanceData
): { doc: PlanDoc; state: RunnerState } {
  const state = buildState(f, goal, data);
  const result = plan(state, goal, data);
  if (!result.ok) throw new Error('plan odbijen');
  return { doc: result.doc, state };
}

/** Posle „za", „planiraj", „imaš" broj nedelja mora biti u akuzativu; svuda drugde u nominativu. */
function caseErrors(text: string): string[] {
  const errors: string[] = [];
  for (const m of text.matchAll(/(?:(za|planiraj|imaš) )?(?<![\d,.:])(\d+) (nedelj[a-z]+)/g)) {
    const n = Number(m[2]);
    const want = count(n, WEEKS, m[1] === undefined ? 'nom' : 'acc');
    if (`${String(n)} ${m[3] ?? ''}` !== want) errors.push(m[0]);
  }
  for (const m of text.matchAll(/(?<![\d,.:])(\d+) (dan[a-z]*)(?![a-zčćšđž])/g)) {
    if (`${m[1] ?? ''} ${m[2] ?? ''}` !== count(Number(m[1]), DAYS)) errors.push(m[0]);
  }
  return errors;
}

const texts = (w: Warning): string => `${w.problem} ${w.meaning} ${w.proposal}`;

describe('A: padež uz broj', () => {
  it('nominativ i akuzativ za nedelju, dan, kilometar, minut, trening', () => {
    expect(NUMBERS.map((n) => count(n, WEEKS, 'acc'))).toEqual([
      '1 nedelju',
      '2 nedelje',
      '5 nedelja',
      '11 nedelja',
      '21 nedelju',
      '22 nedelje'
    ]);
    expect(NUMBERS.map((n) => count(n, WEEKS))).toEqual([
      '1 nedelja',
      '2 nedelje',
      '5 nedelja',
      '11 nedelja',
      '21 nedelja',
      '22 nedelje'
    ]);
    for (const kase of ['nom', 'acc'] as const) {
      expect(NUMBERS.map((n) => count(n, DAYS, kase))).toEqual([
        '1 dan',
        '2 dana',
        '5 dana',
        '11 dana',
        '21 dan',
        '22 dana'
      ]);
      expect(NUMBERS.map((n) => count(n, KM, kase))).toEqual([
        '1 kilometar',
        '2 kilometra',
        '5 kilometara',
        '11 kilometara',
        '21 kilometar',
        '22 kilometra'
      ]);
      expect(NUMBERS.map((n) => count(n, MINUTES, kase))).toEqual([
        '1 minut',
        '2 minuta',
        '5 minuta',
        '11 minuta',
        '21 minut',
        '22 minuta'
      ]);
      expect(NUMBERS.map((n) => count(n, WORKOUTS, kase))).toEqual([
        '1 trening',
        '2 treninga',
        '5 treninga',
        '11 treninga',
        '21 trening',
        '22 treninga'
      ]);
    }
  });

  it('tekstovi upozorenja: „imaš / planiraj N nedelj…" u akuzativu za n = 1, 2, 5, 11, 21, 22', () => {
    let checked = 0;
    for (const n of NUMBERS) {
      for (const weeks of [1, 2, 5]) {
        const data: DistanceData = {
          ...SYNTHETIC,
          adequate: {
            ...SYNTHETIC.adequate,
            minWeeks: n + weeks,
            minPeakWeeklyKm: 80,
            minLongKm: 30
          }
        };
        const goal = goalAt(addDays('2026-11-22', 7 * (weeks - 1)));
        const { doc } = make(facts(), goal, data);
        const all = doc.header.warnings.map(texts).join(' ');
        expect(caseErrors(all), `${String(n)}/${String(weeks)}: ${all}`).toEqual([]);
        expect(all).toContain(`imaš ${count(n + weeks, WEEKS, 'acc')} pripreme`);
        /* Z7 (krug 7): „planiraj N" samo kad probni plan to potvrđuje; inače se imenuje uzrok */
        expect(all).toMatch(/Za sledeću trku planiraj \d+ nedelj|Duža priprema ovde ne pomaže/);
        checked += 1;
      }
    }
    expect(checked).toBe(18);
    expect(caseErrors('Produži pripremu za 1 nedelja.')).toEqual(['za 1 nedelja']);
  });

  it('tekstovi promena: broj dana u pravom obliku za pauze od 3 do 22 dana i svaki razlog', () => {
    const b = build(facts(), goalAt('2027-03-07'));
    for (const length of [3, 4, 5, 7, 11, 14, 21, 22]) {
      for (const reason of ['bolest', 'put', 'nepoznato'] as const) {
        const today = '2026-12-27';
        const from = addDays(today, -(length - 1));
        const state = advance(b, today, {
          runs: runsAsPlanned(b.doc, addDays(from, -1)),
          pauses: [{ from, to: today, reason }]
        });
        const result = replan(b.doc, state, deriveEvents(b.doc, state), SYNTHETIC);
        const all = result.changes.map((c) => c.reason).join(' ');
        /* R19 (odluka organizatora): pauza do 4 dana nema rampu — propušteno je propušteno, sledeća nedelja je plan */
        if (length <= 4) {
          expect(result.changes, `${String(length)} ${reason}`).toEqual([]);
          continue;
        }
        expect(all.length, `${String(length)} ${reason}`).toBeGreaterThan(0);
        expect(caseErrors(all), `${String(length)} ${reason}: ${all.slice(0, 200)}`).toEqual([]);
        expect(all).toContain(`trajala je ${count(length, DAYS)}`);
      }
    }
  });
});

describe('B: upozorenja o obimu i dugom — šta može sada, šta za sledeći ciklus', () => {
  const data: DistanceData = {
    ...SYNTHETIC,
    adequate: { ...SYNTHETIC.adequate, minPeakWeeklyKm: 50, minLongKm: 20 }
  };
  /* 55 km nedeljno na 3 dana: plan ne staje u dane, pa četvrti dan stvarno diže vrh. */
  const three = facts({
    availability: { runDays: [1, 3, 6], longDay: 6 },
    profile: { weeklyKm: 55, recentResult: { distanceM: 10000, timeSec: 2520 } }
  });
  const b = make(three, goalAt('2027-01-24'), {
    ...data,
    adequate: { ...data.adequate, minPeakWeeklyKm: 70, minLongKm: 26 }
  });
  const find = (code: string): Warning | undefined =>
    b.doc.header.warnings.find((w) => w.code === code);
  const weekKm = (doc: PlanDoc): number[] => {
    const ctx = paceCtxOf(doc.header);
    return doc.weeks.map((x) =>
      x.days.reduce(
        (sum, d) => sum + (d.workout?.kind === 'race' ? 0 : summarize(d.workout, ctx).km),
        0
      )
    );
  };

  it('`mali-obim`: još jedan dan uz isti datum (brojevi iz probnog plana) + sledeći ciklus', () => {
    const w = find('mali-obim');
    expect(w?.proposal).toMatch(
      /^Uz isti datum trke dodaj 4\. dan laganog trčanja od oko \d+ min — vrh tada ide do [\d,]+ km nedeljno(, a dugi do [\d,]+ km)?( — i dalje ispod [\d,]+ km, pa trku počni sporije nego što forma na kraćim deonicama nudi)?\. (Za sledeću trku planiraj \d+ nedelj\w+ pripreme — obim tada bezbedno stiže do [\d,]+ km nedeljno|Duža priprema ovde ne pomaže: .+ km)\.$/
    );
    expect(w?.proposal).not.toMatch(/Produži pripremu/);
    const offered = Number(
      (/vrh tada ide do ([\d,]+) km/.exec(w?.proposal ?? '')?.[1] ?? '0').replace(',', '.')
    );
    expect(offered).toBeGreaterThan(Math.max(...weekKm(b.doc)));
  });
  it('`kratak-dugi`: isto — nikad samo „produži pripremu"', () => {
    const w = find('kratak-dugi');
    expect(w?.proposal).toMatch(/^Uz isti datum trke /);
    expect(w?.proposal).toMatch(/Za sledeću trku |Duža priprema ovde ne pomaže/);
    expect(/\d/.test(w?.proposal ?? '')).toBe(true);
  });

  it('sa 7 dana nema „dodaj dan": kaže šta obim znači za ovu trku', () => {
    const seven = make(
      facts({ availability: { runDays: [0, 1, 2, 3, 4, 5, 6], longDay: 6 } }),
      goalAt('2027-01-24'),
      data
    );
    const w = seven.doc.header.warnings.find((x) => x.code === 'mali-obim');
    expect(w?.proposal).toMatch(
      /^Uz isti datum trke obim ne može bezbedno iznad [\d,]+ km nedeljno/
    );
    expect(w?.proposal).toMatch(/Za sledeću trku planiraj|Duža priprema ovde ne pomaže/);
  });

  it('razlika do adekvatnog ispod 5 % se ne prikazuje', () => {
    const plain = make(facts(), goalAt('2027-01-24'), SYNTHETIC);
    const ctx = paceCtxOf(plain.doc.header);
    const peak = Math.max(...weekKm(plain.doc));
    const long = Math.max(
      ...days(plain.doc).map((d) => (d.workout?.kind === 'long' ? summarize(d.workout, ctx).km : 0))
    );
    const withMin = (share: number): string[] =>
      make(facts(), goalAt('2027-01-24'), {
        ...SYNTHETIC,
        adequate: { ...SYNTHETIC.adequate, minPeakWeeklyKm: peak / share, minLongKm: long / share }
      }).doc.header.warnings.map((w) => w.code);
    expect(withMin(0.97)).not.toContain('mali-obim');
    expect(withMin(0.97)).not.toContain('kratak-dugi');
    expect(withMin(0.9)).toEqual(expect.arrayContaining(['mali-obim', 'kratak-dugi']));
  });
});

describe('C–D: rast dugog i zaokruživanje deonica', () => {
  it('dugi raste od nezaokružene odluke: korak između uzastopnih nedelja gradnje je ceo `longStepSec`', () => {
    const goal: Goal = { distanceId: EXAMPLE.id, raceDate: '2027-03-07' };
    /* Udeo dugog u nedelji isključen (1): test meri samo lanac koraka, ne plafon udela (krug 2, R4). */
    const slow: DistanceData = {
      ...EXAMPLE,
      safety: {
        ...EXAMPLE.safety,
        longStepSec: 290,
        longShareByRunDays: { '1': 1 }
      }
    };
    const { doc } = make(facts(), goal, slow);
    const d = doc.header.decisions;
    let chained = 0;
    doc.weeks.forEach((w, i) => {
      /* Rasterećenje ima svoj plafon (≤ `longFactor` × dugi prethodne nedelje), nije deo lanca koraka. */
      if (w.intent.long === null || w.intent.kind === 'recovery') return;
      const wanted = Math.round((w.intent.long.lenPct * d.longMaxSec) / 60) * 60;
      const before = Math.max(
        d.longStartSec,
        ...doc.weeks.slice(Math.max(0, i - 3), i).map((x) => x.longSec)
      );
      if (w.longSec < wanted) {
        /* odluka je na ceo minut; bez gubitka od zaokruživanja na 0,5 km (≈ 3 min) */
        expect(Math.abs(w.longSec - (before + 290)), String(w.index)).toBeLessThanOrEqual(30);
        chained += 1;
      }
    });
    expect(chained).toBeGreaterThan(4);
  });
  it('zaokruživanje na 500 m ili 60 s ne spušta rad ispod najmanje doze (mreža)', () => {
    let checked = 0;
    for (const c of grid().filter((_, i) => i % 2 === 0)) {
      const b = build(c.facts, c.goal);
      const ctx = paceCtxOf(b.doc.header);
      for (const day of days(b.doc)) {
        const w = day.workout;
        if (w === null || w.workSec === 0 || w.kind === 'race' || w.kind === 'test') continue;
        expect(summarize(w, ctx).workSec, `${c.name} ${day.date} ${w.text}`).toBeGreaterThanOrEqual(
          SYNTHETIC.safety.minDoseSec - 1
        );
        checked += 1;
      }
    }
    expect(checked).toBeGreaterThan(500);
  });
});

describe('E: plan koji počinje u rampi posle trke', () => {
  const goal: Goal = { distanceId: EXAMPLE.id, raceDate: '2027-01-24' };
  const race: Run = {
    id: 'trka',
    date: '2026-11-15',
    distanceM: 21097.5,
    durationSec: 6060,
    effort: 'race'
  };
  const fresh = make(facts(), goal, EXAMPLE);
  const after = make(facts({ runs: [race] }), goal, EXAMPLE);

  it('baza je obim PRE trke (trka je ne podiže); trka ulazi u „najduže skorašnje" sa 60 % trajanja', () => {
    /* Krug 3 (O2): jedna trka nije merodavna istorija — baza ostaje izjava. */
    expect(after.state.load.seeded).toBe(true);
    expect(after.state.load.chronic).toBe(fresh.state.load.chronic);
    const base = after.doc.header.decisions.baseLoad;
    expect(Math.abs(base - fresh.doc.header.decisions.baseLoad)).toBeLessThan(6);
    expect(after.state.longestRecentSec).toBe(Math.round(0.6 * race.durationSec));
    expect(after.doc.header.decisions.longStartSec).toBe(3660);
    const effort = after.doc.header.adjustments?.find((x) => x.kind === 'effort');
    /* R20 (A1): bez istorije dugih „poslednji dugi" posle trke je polazni dugi plana (ne 60 % trke) */
    expect(effort).toMatchObject({ lastLongSec: 3660 });
  });
  it('posle rampe pravilo rasta gradi od baze pre trke: nema skoka obima, nedelje rampe ne ulaze u `m`', () => {
    const base = after.doc.header.decisions.baseLoad;
    const { maxWeeklyRampPct, minRampLoad } = EXAMPLE.safety;
    const ctx = paceCtxOf(after.doc.header);
    const seen: number[] = [];
    after.doc.weeks.forEach((w, i) => {
      /* krug 5: nedelja koja počinje poslednjim danom rampe nije u rampi (3. nedelja ulazi u `m`) */
      if (i < 2) return;
      /* Pravilo rasta meri obim — od kruga 4 km nedelje u minutima laganog tempa (S2). */
      const minutes = (weekCost(w, goal.raceDate, ctx).km * ctx.paces.easy) / 60;
      const m = Math.max(base, ...seen.slice(-3));
      if (w.intent.kind === 'build' || w.intent.kind === 'peak') {
        const rule = Math.max(m * (1 + maxWeeklyRampPct), m + minRampLoad);
        expect(minutes, String(w.index)).toBeLessThanOrEqual(rule + 3);
      }
      seen.push(minutes);
    });
    /* 3. nedelja (rampa se završava njenim prvim danom): cilj je uz bazu, ne uz vrh šablona. */
    const third = after.doc.weeks[2];
    const thirdMin = third === undefined ? 0 : weekCost(third, goal.raceDate, ctx).durationSec / 60;
    expect(thirdMin).toBeLessThanOrEqual(base * (1 + maxWeeklyRampPct) + 3);
    expect(third?.targetLoad ?? 0).toBeLessThanOrEqual(fresh.doc.weeks[2]?.targetLoad ?? 0);
  });
  it('dugi u rampi: ≤ 75 % reference samo dok je f < 0,8; posle toga rampa i lanac, bez skoka', () => {
    const ctx = paceCtxOf(after.doc.header);
    const km = (date: string): number =>
      summarize(days(after.doc).find((d) => d.date === date)?.workout ?? null, ctx).km;
    const sec = (date: string): number =>
      summarize(days(after.doc).find((d) => d.date === date)?.workout ?? null, ctx).durationSec;
    /* 22. 11.: n = 7, f = 0,68 → plafon 75 % od 61 min; 29. 11.: n = 14, f = 0,96 → bez plafona. */
    expect(sec('2026-11-22')).toBeLessThanOrEqual(0.75 * 3636 + 1);
    /* krug 10 (stavka 5): druga nedelja posle trke na ciljnoj dužini — dugi ≤ 70 % planiranog */
    expect(km('2026-11-22')).toBeGreaterThanOrEqual(5);
    expect(km('2026-11-22')).toBeLessThanOrEqual(8);
    /* R20 (A1): povratak po nedeljama (60 / 80 %); dugi druge nedelje raste najviše + 20 min od prvog */
    expect(sec('2026-11-29')).toBeLessThanOrEqual(sec('2026-11-22') + 1200 + 60);
    expect(km('2026-11-29')).toBeGreaterThanOrEqual(5);
    expect(km('2026-12-06')).toBeGreaterThanOrEqual(km('2026-11-29'));
    /* R18 (stavka 5): oporavak posle TRKE nije povratak posle pauze — posle oporavka dugi se vraća lancu plana (bez
       R2 izlaska od skraćenog dugog), ali nije duži od same trke */
    expect(km('2026-12-06')).toBeLessThanOrEqual(race.distanceM / 1000);
    const history: Run[] = [
      { id: 'dugi', date: '2026-11-01', distanceM: 18000, durationSec: 6400 },
      race
    ];
    const withLong = make(facts({ runs: history }), goal, EXAMPLE);
    const effort = withLong.doc.header.adjustments?.find((x) => x.kind === 'effort');
    expect(effort).toMatchObject({ lastLongSec: 6400 });
    expect(withLong.state.longestRecentSec).toBe(6400);
  });
});

describe('9–11: zahtevi adaptera', () => {
  const b = build(facts(), goalAt('2027-01-24'));

  it('dan bez ijednog koraka (preuzet dan snage) nije planirano trčanje: ni `missed` ni izvedena pauza', () => {
    const strength = (day: PlanDay): PlanDay =>
      day.workout === null
        ? day
        : {
            ...day,
            origin: 'adopted',
            workout: { kind: 'other', stimulus: null, workSec: 0, steps: [], text: 'snaga 30 min' }
          };
    const doc: PlanDoc = {
      ...b.doc,
      weeks: b.doc.weeks.map((w) => ({ ...w, days: w.days.map(strength) }))
    };
    const state = advance(b, '2026-12-01');
    expect(deriveEvents(b.doc, state).length).toBeGreaterThan(0);
    expect(deriveEvents(doc, state)).toEqual([]);
    expect(
      buildState({ ...b.facts, today: '2026-12-01' }, b.goal, SYNTHETIC, undefined, doc).pauses
    ).toEqual([]);
  });

  it('`header.legacy` ulazi u kanonski zapis, motor ga ne čita ni ne gubi', () => {
    const doc: PlanDoc = {
      ...b.doc,
      header: { ...b.doc.header, legacy: { verzija: 282, meta: { licni: true } } }
    };
    expect(canonical(doc)).toContain('"legacy":{"meta":{"licni":true},"verzija":282}');
    expect(replan(doc, b.state, [], SYNTHETIC).doc).toBe(doc);
    const pain = replan(
      doc,
      b.state,
      [{ id: 'pain:2026-11-15:5', date: '2026-11-15', kind: 'pain', level: 5 }],
      SYNTHETIC
    );
    expect(pain.changes.length).toBeGreaterThan(0);
    expect(pain.doc.header.legacy).toEqual({ verzija: 282, meta: { licni: true } });
  });

  it('rupa u istoriji posle preuzimanja ne okida izveden umor (traži 7 dana ≥ 1,2 × B)', () => {
    const today = '2026-12-02';
    /* Stara trčanja, pa rupa, pa četiri dana: umor / baza skače, ali nedelja nije teška. */
    const planned = runsAsPlanned(b.doc, today);
    const old = planned
      .filter((r) => r.date <= '2026-11-17')
      .map((r) => ({ ...r, date: addDays(r.date, -40), id: `${r.id}-staro` }));
    const recent = planned.filter((r) => r.date >= '2026-11-29');
    const profile = { recentResult: { distanceM: 21097.5, timeSec: 6060 } };
    const state = advance(b, today, { profile, runs: [...old, ...recent] });
    /* Krug 3 (O2): četiri dana posle rupe nisu merodavna istorija — baza je izjava, izvedenog umora nema. */
    expect(state.load.seeded).toBe(true);
    const adopted: PlanDoc = { ...b.doc, header: { ...b.doc.header, eventsFrom: today } };
    expect(deriveEvents(adopted, state).map((e) => e.kind)).not.toContain('fatigue');
  });
});

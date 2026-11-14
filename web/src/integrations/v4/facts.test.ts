import { describe, expect, it } from 'vitest';
import { buildState, validate, type Run } from '../../domain/v4/engine';
import { DISTANCES, distanceData, linkActivities, mergeRuns, painFromKnee, toFacts } from './facts';
import { adoptSample, clone, deepFreeze, SAMPLES, TODAY } from './samples.test-data';

const run = (id: string, date: string, extra: Partial<Run> = {}): Run => ({
  id,
  date,
  distanceM: 8000,
  durationSec: 2880,
  ...extra
});

describe('distance', () => {
  it('sve četiri distance po oznaci, nepoznata → null', () => {
    expect(Object.keys(DISTANCES).sort()).toEqual(['fivek', 'hm', 'marathon', 'tenk']);
    for (const id of Object.keys(DISTANCES)) expect(distanceData(id)?.id).toBe(id);
    expect(distanceData('ultra')).toBeNull();
    expect(distanceData('toString')).toBeNull();
  });
});

describe('bol iz `knee`', () => {
  it('isto kao adapter na svim uzorcima preuzimanja', () => {
    for (const s of SAMPLES) {
      const r = adoptSample(s);
      expect(painFromKnee(s.snap.knee), s.name).toEqual(r.facts.pain);
    }
  });

  it('preskače neispravno, sortira po datumu, deo tela opciono', () => {
    expect(
      painFromKnee([
        { date: '2026-11-10T08:00', pain: 4, part: 'koleno' },
        { date: '2026-11-02', pain: 2 },
        { date: 'juče', pain: 3 },
        { date: '2026-11-03', pain: 0 },
        { date: '2026-11-04', pain: 11 },
        null,
        'x'
      ])
    ).toEqual([
      { date: '2026-11-02', level: 2 },
      { date: '2026-11-10', level: 4, part: 'koleno' }
    ]);
  });
});

describe('spajanje trčanja', () => {
  it('unos dana otpada kad aktivnost nosi isti dan; van plana otpada uz aktivnost tog dana', () => {
    const adopted = [
      run('log:w1d1', '2026-11-02', { dayId: 'w1d1' }),
      run('log:w1d3', '2026-11-04', { dayId: 'w1d3' }),
      run('van:2026-10-28', '2026-10-28'),
      run('van2:strava:9', '2026-10-25')
    ];
    const acts = [
      run('strava:1', '2026-11-02', { dayId: 'w1d1', avgHr: 140 }),
      run('strava:2', '2026-10-28'),
      run('strava:9', '2026-10-25')
    ];
    expect(mergeRuns(adopted, acts).map((r) => r.id)).toEqual([
      'strava:9',
      'strava:2',
      'strava:1',
      'log:w1d3'
    ]);
  });

  it('isti id: važi aktivnost, dan se zadržava iz preuzetog', () => {
    const out = mergeRuns(
      [run('strava:5', '2026-11-02', { dayId: 'w1d1' })],
      [run('strava:5', '2026-11-02', { avgHr: 150 })]
    );
    expect(out).toEqual([run('strava:5', '2026-11-02', { avgHr: 150, dayId: 'w1d1' })]);
  });
});

describe('toFacts', () => {
  it('bez dana trčanja motor odbija unos (nema-dana), ne sloj', () => {
    const facts = toFacts({ today: TODAY });
    const data = DISTANCES['hm'];
    if (data === undefined) throw new Error('hm');
    const codes = validate(facts, { distanceId: 'hm', raceDate: '2027-03-01' }, data).map(
      (e) => e.code
    );
    expect(codes).toContain('nema-dana');
  });

  it('preuzeto + aktivnosti: dani i profil iz preuzetog, bol iz `knee`, ulaz se ne menja', () => {
    const s = SAMPLES.find((x) => x.snap.knee.length > 0) ?? SAMPLES[0];
    if (s === undefined) throw new Error('nema uzorka');
    const r = adoptSample(s);
    const input = deepFreeze(
      clone({
        today: s.today,
        adopted: r.facts,
        knee: [...s.snap.knee],
        activities: [run('strava:77', s.today)]
      })
    );
    const a = toFacts(input);
    const b = toFacts(input);
    expect(a).toEqual(b);
    expect(a.availability).toEqual(r.facts.availability);
    expect(a.profile).toEqual(r.facts.profile);
    expect(a.pain).toEqual(r.facts.pain);
    expect(a.runs.map((x) => x.id)).toContain('strava:77');
    const dates = a.runs.map((x) => x.date);
    expect(dates).toEqual([...dates].sort());
  });

  /* NALAZ za V4 (F9 etapa 2a) rešen u R24 (7a): odrađen dan bez km/vremena ostaje odrađen bez `Run`-a 0 m / 0 s
     (planirana dužina i trajanje kao procena), pa `validate` nema šta da odbije. */
  it('činjenice preuzetog plana prolaze kroz `buildState` (bez grešaka ulaza)', () => {
    for (const s of SAMPLES) {
      const r = adoptSample(s);
      const data = distanceData(r.doc.header.goal.distanceId);
      expect(data, s.name).not.toBeNull();
      if (data === null) continue;
      const facts = toFacts({ today: s.today, adopted: r.facts, knee: s.snap.knee });
      const state = buildState(facts, r.doc.header.goal, data, undefined, r.doc);
      for (const e of state.inputErrors ?? []) {
        /* Plan posle trke: motor ispravno odbija ponovno planiranje (sloj tada ne zove `replan`). */
        const finished = e.code === 'trka-u-proslosti' && s.today > r.doc.header.goal.raceDate;
        expect(finished, `${s.name}: ${e.code} ${e.field}`).toBe(true);
      }
    }
  });
});

describe('aktivnosti uz `log` i `vanPlana`: trčanje se ne broji dvaput', () => {
  it('aktivnost dobija dan iz `log.stravaId`; `log:` i `van:` istog trčanja otpadaju', () => {
    const acts = linkActivities(
      [
        run('strava:9', '2026-11-02'),
        run('strava:10', '2026-10-28'),
        run('strava:11', '2026-11-05')
      ],
      { w1d1: { status: 'done', km: 8, stravaId: 9 }, w1d3: { status: 'done', km: 6 } }
    );
    expect(acts.map((a) => a.dayId)).toEqual(['w1d1', undefined, undefined]);
    const adopted = [
      run('log:w1d1', '2026-11-02', { dayId: 'w1d1' }),
      run('log:w1d3', '2026-11-04', { dayId: 'w1d3' }),
      run('van:2026-10-28', '2026-10-28')
    ];
    expect(mergeRuns(adopted, acts).map((r) => r.id)).toEqual([
      'strava:10',
      'strava:9',
      'log:w1d3',
      'strava:11'
    ]);
  });
});

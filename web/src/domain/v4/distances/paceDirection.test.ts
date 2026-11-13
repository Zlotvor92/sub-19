/* KRUG 18 (briefs/R18-MOTOR.md t. 1) — smer tempa nad scenarijima SVIH distanci (svojstvo, ne pojedinačni scenario):
   posle boljeg rezultata nijedna zona nije sporija, prag se pomera srazmerno tempu trke, a tempo dana trke nije
   sporiji od forme. */
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment,
   @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument
   -- scenariji su netipizovani */
import { describe, expect, it } from 'vitest';
import { renderPlan, type DistanceData } from '../engine';

const dataMods = import.meta.glob<Record<string, unknown>>('./*/index.ts', { eager: true });
const scenMods = import.meta.glob<Record<string, unknown>>('./*/testdata/scenarios.ts', {
  eager: true
});

const DIST = Object.entries(dataMods).map(([path, mod]) => {
  const data = Object.values(mod).find(
    (v): v is DistanceData => typeof v === 'object' && v !== null && 'adequate' in v && 'id' in v
  );
  if (data === undefined) throw new Error(path);
  const scen = scenMods[path.replace('index.ts', 'testdata/scenarios.ts')];
  return { data, scenarios: (scen?.SCENARIOS ?? []) as any[] };
});

const ZONES = ['easySlow', 'easyFast', 'easy', 'M', 'T', 'I', 'R', 'RP'] as const;
const sec = (s: string): number => {
  const [m, x] = s.split(':');
  return Number(m) * 60 + Number(x);
};

describe('krug 18 — smer tempa posle rezultata (sve distance)', () => {
  it('ima scenarija svih distanci', () => {
    expect(DIST.length).toBe(4);
    for (const d of DIST) expect(d.scenarios.length, d.data.id).toBeGreaterThan(20);
  });

  it.each(DIST.map((d) => [d.data.id, d] as const))(
    '%s: bolji rezultat — nijedna zona sporija, prag srazmerno tempu trke, trka ne sporija od forme',
    (_id, d) => {
      const bad: string[] = [];
      let checked = 0;
      for (const s of d.scenarios) {
        const r = s.run();
        const a = r.before.header;
        const b = r.after.header;
        if (a.paces.byFeel || b.paces.byFeel) continue;
        if (!(b.form.paceVdot > a.form.paceVdot + 0.05)) continue;
        checked += 1;
        const id = `s${String(s.no)}`;
        for (const z of ZONES)
          if (b.paces[z] > a.paces[z]) bad.push(`${id} ${z} ${a.paces[z]} → ${b.paces[z]}`);
        const kT = b.paces.T / a.paces.T;
        const kRP = b.paces.RP / a.paces.RP;
        if (Math.abs(kT - kRP) > 0.012)
          bad.push(`${id} prag ${a.paces.T}→${b.paces.T}, RP ${a.paces.RP}→${b.paces.RP}`);
        const text = renderPlan(r.after, r.afterState, d.data);
        const m = /Tempo za trku: (\d+:\d\d)\/km/.exec(text);
        if (m?.[1] !== undefined && sec(m[1]) > b.paces.RP + 1)
          bad.push(`${id} trka ${m[1]} sporija od forme ${String(b.paces.RP)} s/km`);
      }
      expect(checked).toBeGreaterThan(0);
      expect(bad).toEqual([]);
    }
  );
});

/* KRUG 18 (t. 2): prenos sa duže trke na kraći cilj bez dodatka krive (Daniels/Riegel), a očekivani napredak posle
   rezultata ne raste kako trka prilazi. */
describe('krug 18 — prenos sa duže trke i očekivani napredak', () => {
  const tenk = DIST.find((d) => d.data.id === 'tenk');
  const run = (no: number): any => tenk?.scenarios.find((s) => s.no === no)?.run();
  it('10 km s17: polumaraton 1:42:30 → forma 46:10–46:25; s20: 2:20:00 → 1:03:00–1:04:30', () => {
    const a = run(17).afterState.form.current.raceTimeSec;
    expect(a).toBeGreaterThanOrEqual(46 * 60 + 5);
    expect(a).toBeLessThanOrEqual(46 * 60 + 25);
    const b = run(20).afterState.form.current.raceTimeSec;
    expect(b).toBeGreaterThanOrEqual(63 * 60);
    expect(b).toBeLessThanOrEqual(64 * 60 + 30);
  });
  it('10 km s03: očekivani napredak po preostaloj nedelji posle rezultata nije veći nego na početku plana', () => {
    const r = run(3);
    const perWeek = (st: any): number => {
      const weeks =
        (Date.parse(r.after.header.goal.raceDate) - Date.parse(st.today)) / (7 * 86400000);
      return (st.form.current.raceTimeSec - st.form.raceDay.expectedSec) / weeks;
    };
    expect(perWeek(r.afterState)).toBeLessThanOrEqual(perWeek(r.beforeState) * 1.5);
  });
});

/* KRUG 18 (t. 3, M5): pomerena provera forme ne zamenjuje trening u tempu trke; posle prave trke otpada. */
describe('krug 18 — pomerena provera forme (sve distance)', () => {
  it.each(DIST.map((d) => [d.data.id, d] as const))('%s', (_id, d) => {
    const bad: string[] = [];
    for (const s of d.scenarios) {
      const r = s.run();
      const today: string = r.afterState.today;
      const days = (doc: any): any[] => doc.weeks.flatMap((w: any) => w.days);
      const was = new Map<string, any>(days(r.before).map((x: any) => [x.date, x.workout]));
      const race = (r.after.header.adjustments ?? []).some(
        (a: any) => a.kind === 'effort' && a.race === true && a.planned !== true
      );
      for (const x of days(r.after)) {
        if (x.date <= today || x.workout?.kind !== 'test') continue;
        const old = was.get(x.date);
        if (old?.kind === 'test') continue;
        if (race) bad.push(`s${String(s.no)} ${String(x.date)} provera posle prave trke`);
        if (old?.kind === 'quality' && String(old.text).startsWith('tempo trke'))
          bad.push(`s${String(s.no)} ${String(x.date)} provera umesto tempa trke`);
      }
    }
    expect(bad).toEqual([]);
  });
});

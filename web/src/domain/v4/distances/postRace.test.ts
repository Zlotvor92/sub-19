/* R22 (A1) — svojstvo nad scenarijima i profilima SVIH distanci: posle trke (neplanirana trka iz zaglavlja, pripremna
   trka iz plana sa ≥ 75 min punog napora) dani 1–3 su odmor ili ravnomerno lagano ≤ 30 min (bez ubrzanja i dodataka),
   a prvih 7 dana posle trke duže od 40 min (osim kratke trke van plana, E5) ≤ 60 % referentne nedelje (pripremna trka iz plana: ≤ 70 % najveće od tri
   nedelje pre nje, ili lagani dani 4–7 na najmanjem trajanju — dugi i broj dana ostaju). Pripremna trka nije u prve 3 nedelje povratka posle prekida (MAR s07). */
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment,
   @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument,
   @typescript-eslint/no-unsafe-return -- scenariji su netipizovani */
import { describe, expect, it } from 'vitest';
import { addDays, mondayOf } from '../engine/dates';
import * as E from '../engine';
import { paceCtxOf, summarize, type DistanceData } from '../engine';
import { estimateForm } from '../fitness';
import { weekCost } from '../engine/guard';
import { pauseLength } from '../engine/readiness';
import { minEasyOf } from '../engine/decide';

const dataMods = import.meta.glob<Record<string, unknown>>('./*/index.ts', { eager: true });
const scenMods = import.meta.glob<Record<string, unknown>>('./*/testdata/scenarios.ts', {
  eager: true
});
const profMods = import.meta.glob<Record<string, unknown>>('./*/testdata/profiles.ts', {
  eager: true
});

const DIST = Object.entries(dataMods).map(([path, mod]) => {
  const data = Object.values(mod).find(
    (v): v is DistanceData => typeof v === 'object' && v !== null && 'adequate' in v && 'id' in v
  );
  if (data === undefined) throw new Error(path);
  const scen = scenMods[path.replace('index.ts', 'testdata/scenarios.ts')];
  const prof = profMods[path.replace('index.ts', 'testdata/profiles.ts')];
  return {
    data,
    scenarios: (scen?.SCENARIOS ?? []) as any[],
    profiles: (prof?.PROFILES ?? []) as any[],
    factsOf: prof?.factsOf as (p: any) => any
  };
});

interface Case {
  tag: string;
  doc: any;
  state: any;
  /** Plan posle ponovnog planiranja (scenario), ne nov plan. */
  replan: boolean;
}

function cases(d: (typeof DIST)[number]): Case[] {
  const out: Case[] = [];
  for (const s of d.scenarios) {
    const r = s.run();
    out.push({ tag: `s${String(s.no)}`, doc: r.after, state: r.afterState, replan: true });
  }
  for (const p of d.profiles) {
    const state = E.buildState(d.factsOf(p), p.goal, d.data, estimateForm);
    const r = E.plan(state, p.goal, d.data);
    if (r.ok) out.push({ tag: String(p.id), doc: r.doc, state, replan: false });
  }
  return out;
}

function check(c: Case, data: DistanceData): string[] {
  const bad: string[] = [];
  const doc = c.doc;
  const pace = paceCtxOf(doc.header);
  const race: string = doc.header.goal.raceDate;
  const today: string = c.state.today;
  const done = new Set((c.state.runs as any[]).map((x) => x.dayId));
  const days: any[] = doc.weeks.flatMap((w: any) => w.days);
  const at = (date: string): any => days.find((x) => x.date === date);
  const races: { date: string; sec: number; limit: number | null; prep: boolean }[] = [];
  for (const a of (doc.header.adjustments ?? []) as any[])
    if (a.kind === 'effort' && a.race === true) {
      const ref = a.refWeekKm ?? c.state.profile.weeklyKm ?? 0;
      races.push({
        date: a.date,
        sec: a.durationSec,
        limit: a.planned !== true && a.durationSec > 2400 ? 0.6 * ref : null,
        prep: false
      });
    }
  doc.weeks.forEach((w: any, wi: number) => {
    for (const x of w.days) {
      if (x.workout?.kind !== 'test' || x.workout.workSec < 4500 || x.date >= race) continue;
      if (races.some((r) => r.date === x.date)) continue;
      const prev = doc.weeks
        .slice(Math.max(0, wi - 3), wi)
        .map((y: any) => weekCost(y, race, pace).km);
      races.push({
        date: x.date,
        sec: x.workout.workSec,
        limit: 0.7 * Math.max(0, ...prev),
        prep: true
      });
    }
  });
  for (const r of races) {
    for (let k = 1; k <= 3; k += 1) {
      const x = at(addDays(r.date, k));
      if (x === undefined || x.date <= today || done.has(x.id) || x.workout === null) continue;
      if (x.date >= race || x.origin === 'manual' || x.locked) continue;
      const w = x.workout;
      const sec = summarize(w, pace).durationSec;
      if (w.kind !== 'easy' || w.steps.length !== 1 || sec > 1830)
        bad.push(`${c.tag} ${String(x.date)} dan ${String(k)} posle trke: ${String(w.text)}`);
    }
    if (r.limit === null || addDays(r.date, 7) >= addDays(mondayOf(race), -7)) continue;
    /* pripremna trka dalje od 28 dana u ponovnom planiranju: posle više događaja rep plana ostaje prvobitan (Z10),
       granica važi kad uđe u 28 dana (nov plan: uvek) */
    if (c.replan && r.prep && r.date > addDays(today, 28)) continue;
    /* samo kad su svi dani budući (plan ih je mogao oblikovati) */
    const ds = Array.from({ length: 7 }, (_, i) => at(addDays(r.date, i + 1)));
    if (ds.some((x) => x === undefined || x.date <= today)) continue;
    const km = ds.reduce((s, x) => s + summarize(x.workout, pace).km, 0);
    /* pripremna trka iz plana: dugi i broj dana ostaju — dovoljno je da su lagani dani 4–7 na najmanjem trajanju */
    const floor = minEasyOf(
      data.safety,
      doc.header.decisions.level,
      doc.header.decisions.runDays.length
    );
    const atFloor = ds
      .slice(3)
      .every(
        (x) => x.workout?.kind !== 'easy' || summarize(x.workout, pace).durationSec <= floor + 360
      );
    if (km > r.limit + 0.5 + 0.01 && !(r.prep && atFloor))
      bad.push(
        `${c.tag} 7 dana posle trke ${String(r.date)}: ${km.toFixed(1)} > ${r.limit.toFixed(1)} km`
      );
  }
  /* pripremna trka nije u prve 3 nedelje povratka posle pauze > 4 dana */
  for (const a of (doc.header.adjustments ?? []) as any[]) {
    if (a.kind !== 'pause' || pauseLength(a.from, a.to) <= 4) continue;
    for (const x of days)
      if (
        x.workout?.kind === 'test' &&
        x.workout.workSec >= 4500 &&
        x.date > a.to &&
        x.date <= addDays(a.to, 21) &&
        x.date > today
      )
        bad.push(
          `${c.tag} pripremna trka ${String(x.date)} u 3 nedelje posle pauze do ${String(a.to)}`
        );
  }
  return bad;
}

describe('R22 (A1) — oporavak posle trke (sve distance, scenariji i profili)', () => {
  it.each(DIST.map((d) => [d.data.id, d] as const))(
    '%s: dani 1–3 odmor ili lagano ≤ 30 min, prvih 7 dana ≤ 60 % (pripremna ≤ 70 %)',
    (_id, d) => {
      const bad = cases(d).flatMap((c) => check(c, d.data));
      expect(bad).toEqual([]);
    },
    60_000
  );
});

/* R24 (M4) — posle pripremne trke iz plana (pun napor ≥ 75 min) dugi 6–8. dana ne raste preko poslednjeg dugog pre
   nje, osim kad je poslednji dugi u prozoru događaja ili dve nedelje posle njega (dugi tek raste
   nazad); svojstvo nad profilima i scenarijima SVIH distanci. (c) početnik u planu od dana posle trke (HM s19):
   nedelja 2 ≤ 75 % uobičajenog obima; (d) taj plan nema „forma traži više brzog rada" (HM s18). */
import { adjustmentWindow } from '../engine/readiness';

function m4Bad(c: Case): string[] {
  const bad: string[] = [];
  const doc = c.doc;
  const pace = paceCtxOf(doc.header);
  const race: string = doc.header.goal.raceDate;
  const days: any[] = doc.weeks.flatMap((w: any) => w.days);
  const done = new Set((c.state.runs as any[]).map((x) => x.dayId));
  const windowed = (date: string): boolean =>
    ((doc.header.adjustments ?? []) as any[]).some((a) => {
      const w = adjustmentWindow(a);
      return w !== null && date >= w.from && date <= addDays(w.to, 14);
    });
  for (const t of days) {
    if (t.workout?.kind !== 'test' || t.workout.workSec < 4500 || t.date >= race) continue;
    const before = days.filter(
      (x) => x.date < t.date && x.date >= addDays(t.date, -21) && x.workout?.kind === 'long'
    );
    const lastDay = before[before.length - 1];
    if (lastDay === undefined || windowed(lastDay.date)) continue;
    const last = summarize(lastDay.workout, pace).durationSec;
    for (const x of days) {
      if (x.date < addDays(t.date, 6) || x.date > addDays(t.date, 8)) continue;
      if (x.workout?.kind !== 'long' || x.date <= c.state.today || done.has(x.id) || x.locked)
        continue;
      if (x.origin === 'manual') continue;
      const sec = summarize(x.workout, pace).durationSec;
      if (sec > last + 60)
        bad.push(
          `${c.tag} dugi ${String(x.date)} ${String(Math.round(sec / 60))} > ${String(Math.round(last / 60))} min`
        );
    }
  }
  return bad;
}

describe('R24 (M4) — dugi posle pripremne trke ne raste (sve distance)', () => {
  it.each(DIST.map((d) => [d.data.id, d] as const))(
    '%s: dugi 6–8. dana ≤ poslednji dugi pre trke',
    (_id, d) => {
      expect(cases(d).flatMap((c) => m4Bad(c))).toEqual([]);
    },
    60_000
  );

  it('MAR p11 (ned 16): dugi posle pripremnog polumaratona ne raste preko 2 h 20 (bio 2 h 25)', () => {
    const d = DIST.find((x) => x.data.id === 'marathon');
    const c = d === undefined ? undefined : cases(d).find((x) => x.tag === 'p11');
    if (c === undefined) throw new Error('p11');
    const pace = paceCtxOf(c.doc.header);
    const day = (c.doc.weeks as any[])
      .flatMap((w) => w.days)
      .find((x: any) => x.date === '2027-02-21');
    expect(day.workout.kind).toBe('long');
    expect(summarize(day.workout, pace).durationSec).toBeLessThanOrEqual(8400 + 60);
  });

  it('HM s19: nedelja 2 početnika ≤ 75 % uobičajenog obima; HM s18 bez „forma traži više brzog rada"', () => {
    const d = DIST.find((x) => x.data.id === 'hm');
    if (d === undefined) throw new Error('hm');
    const all = cases(d);
    const s19 = all.find((x) => x.tag === 's19');
    const s18 = all.find((x) => x.tag === 's18');
    if (s19 === undefined || s18 === undefined) throw new Error('s18/s19');
    const pace = paceCtxOf(s19.doc.header);
    const w2 = s19.doc.weeks[1];
    const ref =
      (s19.doc.header.adjustments as any[]).find((a) => a.kind === 'effort').refWeekKm ??
      s19.state.profile.weeklyKm;
    expect(weekCost(w2, s19.doc.header.goal.raceDate, pace).km).toBeLessThanOrEqual(
      0.75 * ref + 0.5
    );
    expect(weekCost(w2, s19.doc.header.goal.raceDate, pace).km).toBeLessThanOrEqual(15);
    expect((s18.doc.header.warnings as any[]).some((w) => w.code === 'obim-za-nivo')).toBe(false);
  });
});

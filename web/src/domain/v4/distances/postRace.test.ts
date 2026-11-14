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

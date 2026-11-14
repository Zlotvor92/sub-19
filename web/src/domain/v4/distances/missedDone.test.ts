/* R24 (M1) — svojstvo nad scenarijima E3 i E7 SVIH distanci: posle propuštenog ključnog dugog svaki budući dugi je
   najviše najduži odrađeni dugi (5 nedelja pre nedelje poslednjeg propuštenog) + 20 min, a blok najviše 1,5 × najveći
   odrađeni blok iste vrste (bez odrađenog: doza prvog propuštenog bloka); lanac — budući dugi postaje merilo
   sledećeg. Tvrdnje: MAR s12 (ned 15 ≤ 2 h 55, blok ≤ 27 min), s25 (ned 7 blok 5,5 km, ned 9 ≤ 8,5 km), s11
   (ned 21 ≤ 3 h, blok ≤ 27 min). */
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment,
   @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument,
   @typescript-eslint/no-unsafe-return -- scenariji su netipizovani */
import { describe, expect, it } from 'vitest';
import { paceCtxOf, summarize, type DistanceData } from '../engine';
import { addDays, mondayOf } from '../engine/dates';

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

function bad(s: any): string[] {
  const out: string[] = [];
  const r = s.run();
  const doc = r.after;
  const st = r.afterState;
  const pace = paceCtxOf(doc.header);
  const days: any[] = doc.weeks.flatMap((w: any) => w.days);
  const ran = new Map(
    (st.runs as any[]).filter((x) => x.dayId !== undefined).map((x) => [x.dayId, x])
  );
  const key = (w: any): string | null =>
    w.kind === 'long' && w.workSec > 0 ? String(w.stimulus ?? w.libraryId) : null;
  const past = days.filter((d) => d.date <= st.today && d.workout?.kind === 'long');
  const missed = past.filter((d) => !ran.has(d.id));
  if (missed.length === 0) return out;
  const from = addDays(mondayOf(missed[missed.length - 1].date), -35);
  let maxLong = 0;
  const maxBlock = new Map<string, number>();
  const first = new Map<string, number>();
  for (const d of past) {
    const k = key(d.workout);
    const run = ran.get(d.id);
    if (run === undefined) {
      if (k !== null && !first.has(k)) first.set(k, d.workout.workSec);
      continue;
    }
    if (d.date >= from) maxLong = Math.max(maxLong, run.durationSec);
    if (k !== null) maxBlock.set(k, Math.max(maxBlock.get(k) ?? 0, d.workout.workSec));
  }
  if (maxLong === 0 || first.size === 0) return out;
  for (const d of days) {
    if (d.date <= st.today || d.workout?.kind !== 'long' || d.origin === 'manual' || d.locked)
      continue;
    const sec = summarize(d.workout, pace).durationSec;
    const k = key(d.workout);
    if (sec > maxLong + 1200 + 120)
      out.push(
        `s${String(s.no)} ${String(d.date)} dugi ${String(Math.round(sec / 60))} > ${String(Math.round((maxLong + 1200) / 60))} min`
      );
    if (k !== null) {
      const done = maxBlock.get(k) ?? 0;
      const cap = done > 0 ? 1.5 * done : (first.get(k) ?? Number.POSITIVE_INFINITY);
      if (d.workout.workSec > cap + 60)
        out.push(
          `s${String(s.no)} ${String(d.date)} blok ${String(Math.round(d.workout.workSec / 60))} > ${String(Math.round(cap / 60))} min`
        );
      maxBlock.set(k, Math.max(done, d.workout.workSec));
    }
    maxLong = Math.max(maxLong, sec);
  }
  return out;
}

describe('R24 (M1) — posle propuštenog ključnog dugi se meri prema odrađenom (sve distance)', () => {
  it.each(DIST.map((d) => [d.data.id, d] as const))(
    '%s: E3/E7 — dugi ≤ najduži odrađeni + 20 min, blok ≤ max(1,5 × odrađeni, prvi propušteni)',
    (_id, d) => {
      const sc = d.scenarios.filter((s) => /^E[37]:/.test(String(s.title)));
      expect(sc.flatMap(bad)).toEqual([]);
    },
    120_000
  );

  it('MAR s12, s25, s11: brojevi iz naloga', () => {
    const d = DIST.find((x) => x.data.id === 'marathon');
    const run = (no: number): any => d?.scenarios.find((s) => s.no === no)?.run();
    const at = (r: any, date: string): any => {
      const day = (r.after.weeks as any[]).flatMap((w) => w.days).find((x: any) => x.date === date);
      return {
        sec: summarize(day.workout, paceCtxOf(r.after.header)).durationSec,
        work: day.workout.workSec,
        text: String(day.workout.text)
      };
    };
    const s12 = at(run(12), '2027-02-14');
    expect(s12.sec).toBeLessThanOrEqual(2 * 3600 + 55 * 60 + 60);
    expect(s12.work).toBeLessThanOrEqual(27 * 60 + 30);
    const r25 = run(25);
    expect(at(r25, '2026-12-20').text).toContain('5,5 km u tempu');
    const n9 = at(r25, '2027-01-03').text.match(/poslednjih ([\d,]+) km/);
    expect(Number(String(n9?.[1] ?? '99').replace(',', '.'))).toBeLessThanOrEqual(8.5);
    const s11 = at(run(11), '2027-03-28');
    expect(s11.sec).toBeLessThanOrEqual(3 * 3600 + 60);
    expect(s11.work).toBeLessThanOrEqual(27 * 60 + 30);
  });
});

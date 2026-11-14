/* R20 (A1) — svojstvo nad scenarijima SVIH distanci: posle svakog događaja sa prekidom (pauza > 4 dana, bol ≥ 4,
   neplanirana trka) dugi raste najviše + 20 min ili + 15 % (veće) od poslednjeg odrađenog i od najdužeg posle
   prekida, u 6 nedelja posle prekida; prvi brzi trening svake vrste u 14 dana od prvog brzog posle prekida ≤ 70 % doze iz
   plana i ≤ poslednji odrađeni iste vrste (osim kad je već na najmanjoj dozi unosa); blok u dugom ≤ poslednji
   odrađeni blok. */
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment,
   @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument,
   @typescript-eslint/no-unsafe-return -- scenariji su netipizovani */
import { describe, expect, it } from 'vitest';
import { buildCtx } from '../engine/build';
import { addDays } from '../engine/dates';
import { paceCtxOf, summarize, type DistanceData } from '../engine';
import { minDoseOf, mainZone, realize } from '../engine/select';
import { pauseLength } from '../engine/readiness';

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

/** Poslednji dan prekida iz uzroka koje je događaj dodao (posle-plan prema pre-plan). */
function breakZero(r: any): string | null {
  const old = new Set(((r.before.header.adjustments ?? []) as any[]).map((a) => JSON.stringify(a)));
  let zero: string | null = null;
  for (const a of (r.after.header.adjustments ?? []) as any[]) {
    if (old.has(JSON.stringify(a))) continue;
    const z =
      a.kind === 'pause' && pauseLength(a.from, a.to) > 4
        ? a.to
        : a.kind === 'pain' && a.level > 3
          ? a.date
          : a.kind === 'effort' && a.planned !== true
            ? a.date
            : null;
    if (z !== null && (zero === null || z > zero)) zero = z;
  }
  return zero;
}

describe('R20 (A1) — jedna rampa posle prekida (sve distance)', () => {
  it.each(DIST.map((d) => [d.data.id, d] as const))(
    '%s: dugi ≤ + 20 min / + 15 % u 6 nedelja posle prekida; prvi brzi ≤ 70 % i ≤ poslednji odrađeni',
    (_id, d) => {
      const bad: string[] = [];
      let seen = 0;
      for (const s of d.scenarios) {
        const r = s.run();
        const zero0 = breakZero(r);
        if (zero0 === null) continue;
        seen += 1;
        const tag = `s${String(s.no)}`;
        const today: string = r.afterState.today;
        const zero = zero0 > today ? zero0 : today;
        const pace = paceCtxOf(r.after.header);
        const ctx = buildCtx(r.after.header, d.data);
        const done = new Set((r.afterState.runs as any[]).map((x) => x.dayId));
        const days = (doc: any): any[] => doc.weeks.flatMap((w: any) => w.days);
        const dur = (w: any): number => summarize(w, pace).durationSec;
        const defOf = (w: any): any => d.data.library.find((x) => x.id === w.libraryId);
        const key = (w: any): string | null => {
          const def = w === null ? undefined : defOf(w);
          if (def === undefined) return null;
          if (w.kind === 'quality') return `q:${String(def.stimulus)}@${String(mainZone(def.main))}`;
          if (w.kind === 'long' && w.workSec > 0)
            return `l:${String(def.stimulus)}@${String(mainZone(def.main))}`;
          return null;
        };
        const old = new Map(days(r.before).map((x: any) => [x.date, x]));
        const lastDone = new Map<string, number>();
        let lastLong = 0;
        for (const x of days(r.after)) {
          if (x.date > today || x.workout === null || !done.has(x.id)) continue;
          if (x.workout.kind === 'long') lastLong = dur(x.workout);
          const k = key(x.workout);
          if (k !== null) lastDone.set(k, x.workout.workSec);
        }
        const free = (x: any): boolean =>
          x.date > zero && x.origin !== 'manual' && !x.locked && !done.has(x.id);
        /* dugi */
        let base = lastLong;
        let running = 0;
        for (const w of r.after.weeks as any[]) {
          if (w.intent.kind === 'taper' || w.intent.kind === 'race' || w.start > addDays(zero0, 42))
            break;
          const ld = w.days.find((x: any) => x.workout?.kind === 'long' && x.date > zero0);
          if (ld === undefined) continue;
          const sec = dur(ld.workout);
          const cap = base + Math.max(1200, 0.15 * base);
          if (base > 0 && free(ld) && sec > cap + 120)
            bad.push(
              `${tag} ${String(ld.date)} dugi ${String(Math.round(sec / 60))} > ${String(Math.round(cap / 60))} min`
            );
          running = Math.max(running, sec);
          base = running;
        }
        /* prvi brzi svake vrste */
        const keys = new Set<string>();
        let first: string | null = null;
        for (const w of r.after.weeks as any[]) {
          if (w.intent.kind === 'taper' || w.intent.kind === 'race') break;
          for (const x of w.days) {
            if (x.date <= zero0 || x.workout === null) continue;
            const k = key(x.workout);
            if (k === null) continue;
            first ??= x.date as string;
            const inWindow = x.date <= addDays(first, 14);
            if (!inWindow && (x.workout.kind !== 'long' || !lastDone.has(k))) continue;
            if (keys.has(k)) continue;
            keys.add(k);
            if (!free(x)) continue;
            const prev = old.get(x.date)?.workout;
            const planned = prev != null && key(prev) === k ? prev.workSec : null;
            /* na najmanjoj dozi: najmanja ostvariva doza unosa (deonice: najmanja smislena doza distance) */
            const def = defOf(x.workout);
            const min =
              def.main.kind === 'reps'
                ? d.data.safety.minDoseSec
                : (realize(
                    {
                      type: 'quality',
                      def,
                      dose: minDoseOf(def, ctx),
                      slot: { place: 'quality', stimulus: def.stimulus, index: 1, phase: 'build' }
                    },
                    ctx
                  )?.workSec ?? 0);
            const atMin = x.workout.kind === 'quality' && x.workout.workSec <= min + 30;
            if (inWindow && planned !== null && !atMin && x.workout.workSec > 0.7 * planned + 30)
              bad.push(
                `${tag} ${String(x.date)} ${k} ${String(x.workout.workSec)} > 70 % od ${String(planned)}`
              );
            const ld = lastDone.get(k);
            if (ld !== undefined && !atMin && x.workout.workSec > ld + 30)
              bad.push(
                `${tag} ${String(x.date)} ${k} ${String(x.workout.workSec)} > odrađeni ${String(ld)}`
              );
          }
        }
      }
      expect(seen).toBeGreaterThan(0);
      expect(bad).toEqual([]);
    }
  );
});

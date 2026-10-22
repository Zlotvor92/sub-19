/* 5K v2 → aplikacija: NAPREDAK → FORMA za plan v2 (segment 08b). Istorija VDOT-a samo iz REZULTATA (rezultat ulaza
   plana, primenjeni rezultati adaptacije, novi rezultati koji čekaju prilagođavanje) i ocena cilja v2 doslovno. Lanac
   forme iz treninga (v1) se ne koristi. */

import { raceTimeForVdot, vdotFromResult } from '../paces.ts';
import { FIVE_K_V2_POLICY as P } from '../policy.ts';
import { baseVdot, vdotAt } from '../steps.ts';
import type { FiveKV2Plan } from '../types.ts';
import type { GenPlanState, IsoDate, LogEntry, T3kRecord } from '../../exchange.ts';
import { v2Of } from './adapt.ts';
import { diffDays } from './date.ts';
import { buildFacts } from './facts.ts';
import { goalOf, prefixOf } from './plan.ts';

export interface FormPointV2 {
  date: string;
  vdot: number;
  kind: 'start' | 'test' | 'race';
  label: string;
  /** used = tempo plana ga koristi; pending = noviji, čeka prilagođavanje; old = stariji od rezultata u upotrebi ili od
   *  12 nedelja (ne menja tempo). */
  status: 'used' | 'pending' | 'old';
}
export interface FormHistoryV2 {
  points: FormPointV2[];
  /** VDOT plana u tekućoj nedelji; `null` = plan po osećaju ili trčanje/hodanje. */
  current: number | null;
  predicted5kSec: number | null;
  mode: 'vdot' | 'feel' | 'runWalk';
  goal: { status: string; label: string; message: string } | null;
}

const mmss = (sec: number): string =>
  `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}`;
const round1 = (x: number): number => Math.round(x * 10) / 10;

export function formHistory(src: {
  plan: GenPlanState;
  today: IsoDate;
  tests?: readonly T3kRecord[];
  log?: Readonly<Record<string, LogEntry>>;
}): FormHistoryV2 | null {
  const v2 = v2Of(src.plan);
  if (!v2) return null;
  const goal = goalOf(v2) ?? null;
  const cont: FiveKV2Plan | null = v2.planType === 'runWalk' ? (v2.continuous?.plan ?? null) : v2;
  const points: FormPointV2[] = [];
  const used = new Set<string>();
  // 3h: plan cilja predaje nosi nedelje izvora ispred; prikazni broj nedelje = `offset + fromWeek` (kao kalendar).
  const off = prefixOf(src.plan)?.offset ?? 0;
  if (cont) {
    const input = cont.input;
    const base = baseVdot(input);
    if (base !== null && input.recentResult) {
      const r = input.recentResult;
      points.push({
        date: r.date,
        vdot: base,
        kind: 'start',
        label: `${r.distanceM / 1000}K ${mmss(r.timeSec)} (rezultat iz čarobnjaka)`,
        status: 'used'
      });
    }
    for (const s of cont.adaptation?.steps ?? [])
      if (s.result && s.vdot !== null) {
        used.add(`${s.result.date}|${s.result.distM}|${s.result.sec}`);
        points.push({
          date: s.result.date,
          vdot: s.vdot,
          kind: s.result.kind,
          label: `${s.result.kind === 'test' ? 'Test' : 'Trka'} ${s.result.distM / 1000}K ${mmss(s.result.sec)} — tempo od nedelje ${off + s.fromWeek}`,
          status: 'used'
        });
      }
  }
  // Rezultati iz aplikacije koji još nisu u planu (isti prevod kao adaptacija).
  const lastUsed =
    points
      .map((p) => p.date)
      .sort()
      .at(-1) ?? null;
  const facts = buildFacts(
    { today: src.today, plan: src.plan, log: src.log ?? {}, tests: src.tests ?? [] },
    v2
  ).facts.results;
  for (const r of facts) {
    if (used.has(`${r.date}|${r.distM}|${r.sec}`)) continue;
    const fresh = diffDays(r.date as IsoDate, src.today) <= P.adapt.resultMaxAgeDays;
    const newer = lastUsed === null || r.date > lastUsed;
    points.push({
      date: r.date,
      vdot: round1(vdotFromResult(r.distM, r.sec)),
      kind: r.kind,
      label: `${r.kind === 'test' ? 'Test' : 'Trka'} ${r.distM / 1000}K ${mmss(r.sec)}${
        v2.planType === 'runWalk' && !cont
          ? ' — plan trčanje/hodanje ne koristi tempo'
          : fresh && newer
            ? ' — čeka prilagođavanje plana'
            : ' — ne menja tempo (stariji od rezultata u upotrebi ili od 12 nedelja)'
      }`,
      status: fresh && newer && cont ? 'pending' : 'old'
    });
  }
  points.sort((a, b) => a.date.localeCompare(b.date));
  let current: number | null = null;
  if (cont) {
    const i = cont.weeks.findIndex((w) => w.startDate <= src.today && src.today <= w.endDate);
    const week = i >= 0 ? i + 1 : src.today < cont.weeks[0]!.startDate ? 1 : cont.weeks.length;
    current = vdotAt(cont.input, cont.adaptation?.steps ?? [], week);
  }
  return {
    points,
    current,
    predicted5kSec: current === null ? null : raceTimeForVdot(current, P.paces.raceDistanceM),
    mode: !cont ? 'runWalk' : current === null ? 'feel' : 'vdot',
    goal: goal ? { status: goal.status, label: goal.label, message: goal.message } : null
  };
}

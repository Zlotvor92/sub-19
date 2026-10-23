/* Maraton v2 → aplikacija: NAPREDAK → FORMA za plan v2 (segment MAR-06). Istorija VDOT-a samo iz REZULTATA (rezultat ulaza plana,
   primenjeni rezultati adaptacije, novi rezultati koji čekaju prilagođavanje) i ocena cilja v2 doslovno. Lanac forme iz
   treninga (v1) se ne koristi. Obrazac je kopija HM v2 (06), ne uvoz. Test 3 km nije rezultat maratona v2
   (A1, M18), pa nije ni tačka forme. Prognoza maratona: iz MP tempa nedelje (pacesAt — VDOT umanjen za korekciju obima M2,
   isto kao plan). */

import { prevResultOf, resultFates } from '../assess.ts';
import { mustDay } from '../dates.ts';
import { checkInput } from '../input.ts';
import { predictedMarathon, round1, vdotFromResult } from '../paces.ts';
import { MARATHON_V2_POLICY as P } from '../policy.ts';
import { basisAt, pacesAt } from '../steps.ts';
import { v2Of } from './adapt.ts';
import { buildFacts } from './facts.ts';
import { goalOf } from './plan.ts';
import type { AppPlan, IsoDate, LogEntry } from './types.ts';

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
  /** VDOT plana u tekućoj nedelji; `null` = plan po osećaju. */
  current: number | null;
  predictedMarathonSec: number | null;
  mode: 'vdot' | 'feel';
  /** Primenjen rezultat čiji tempo važi tek od sledeće nedelje (A1): nedelja i VDOT; `null` = nema takvog. */
  next: { week: number; vdot: number } | null;
  goal: { status: string; label: string; message: string } | null;
}

const mmss = (sec: number): string => {
  const s = Math.round(sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
};
const dist = (m: number): string =>
  m === 21097.5 ? 'polumaraton' : m === 42195 ? 'maraton' : `${m / 1000} km`;

export function formHistory(src: {
  plan: AppPlan;
  today: IsoDate;
  log?: Readonly<Record<string, LogEntry>>;
}): FormHistoryV2 | null {
  const v2 = v2Of(src.plan);
  if (!v2) return null;
  const chk = checkInput(v2.input);
  if (!chk.ok) return null;
  const goal = goalOf(v2) ?? null;
  const points: FormPointV2[] = [];
  const used = new Set<string>();
  const r = v2.input.recentResult;
  if (chk.pace.kind === 'result' && r) {
    points.push({
      date: r.date,
      vdot: round1(chk.pace.vdotRaw),
      kind: 'start',
      label: `${dist(r.distanceM)} ${mmss(r.timeSec)} (rezultat iz čarobnjaka)`,
      status: 'used'
    });
  }
  const steps = v2.adaptation?.steps ?? [];
  for (const s of steps)
    if (s.result && s.vdot !== null) {
      used.add(`${s.result.date}|${s.result.distM}|${s.result.sec}`);
      points.push({
        date: s.result.date,
        vdot: s.vdot,
        kind: s.result.kind,
        label: `${s.result.kind === 'test' ? 'Test' : 'Trka'} ${dist(s.result.distM)} ${mmss(s.result.sec)} — tempo od nedelje ${s.fromWeek}`,
        status: 'used'
      });
    }
  // Rezultati iz aplikacije koji još nisu u planu (isti prevod kao adaptacija); status iz odluke jezgra (Z3,
  // assess.resultFates — ista funkcija kao adaptacija).
  const facts = buildFacts({ today: src.today, plan: src.plan, log: src.log ?? {} }, v2).facts
    .results;
  const fates = resultFates(facts, prevResultOf(v2), mustDay(src.today));
  for (const x of facts) {
    if (used.has(`${x.date}|${x.distM}|${x.sec}`)) continue;
    const f = fates.get(x);
    points.push({
      date: x.date,
      vdot: round1(vdotFromResult(x.distM, x.sec)),
      kind: x.kind,
      label: `${x.kind === 'test' ? 'Test' : 'Trka'} ${dist(x.distM)} ${mmss(x.sec)}${
        f === 'apply'
          ? ' — čeka prilagođavanje plana'
          : f === 'range'
            ? ` — VDOT van ${P.input.vdotMin}–${P.input.vdotMax}, ne menja tempo`
            : ' — ne menja tempo (stariji od rezultata u upotrebi ili od 12 nedelja)'
      }`,
      status: f === 'apply' ? 'pending' : 'old'
    });
  }
  points.sort((a, b) => a.date.localeCompare(b.date));
  const i = v2.weeks.findIndex((w) => w.startDate <= src.today && src.today <= w.endDate);
  const week = i >= 0 ? i + 1 : src.today < v2.weeks[0]!.startDate ? 1 : v2.weeks.length;
  const feel = basisAt(chk.pace, steps, week) === 'feel';
  const paces = pacesAt(chk.pace, steps, week, chk.input.currentWeeklyKm);
  const later = steps.filter((s) => s.vdot !== null && s.fromWeek > week).at(-1);
  return {
    points,
    current: feel ? null : paces.vdot,
    predictedMarathonSec: feel ? null : predictedMarathon(paces),
    mode: feel ? 'feel' : 'vdot',
    next: later ? { week: later.fromWeek, vdot: later.vdot! } : null,
    goal: goal ? { status: goal.status, label: goal.label, message: goal.message } : null
  };
}

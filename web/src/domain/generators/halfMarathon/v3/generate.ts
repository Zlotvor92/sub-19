/* HM v3 (pilot) — ulaz: v2 provera ulaza i tempa; oblik: šablon (templates.ts); brojevi: scale.ts; nedelje: build.ts;
   čuvar: guard.ts. Izlaz je isti oblik plana kao v2 (HmV2Plan), policyVersion hm-v3.0.0-pilot. Bez adaptacije. */

import { checkInput } from './fromV2/input.ts';
import { assessGoal, feelPaces, pacesFromVdot, predictedHm } from './fromV2/paces.ts';
import { HM_V2_POLICY as P } from './fromV2/policy.ts';
import type { GenerateResult, HmV2Plan, Violation } from './fromV2/types.ts';
import { buildWeeks, framesOf, rampSteps } from './build.ts';
import { guard } from './guard.ts';
import { scaleOf } from './scale.ts';
import { BEGINNER, REGULAR } from './templates.ts';

export const HM_V3_POLICY = { id: 'hm-v3', version: 'hm-v3.0.0-pilot' } as const;

const weeksAcc = (n: number): string =>
  `${n} ${n % 10 === 1 && n % 100 !== 11 ? 'nedelju' : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? 'nedelje' : 'nedelja'}`;

/** W1-C: rečenica plana van opsega dužine (isti tekst kao v2). */
function lengthWarning(weeks: number, min: number): string | null {
  const max = P.input.weeksMax;
  if (weeks < min)
    return `Skraćena priprema: plan ima ${weeksAcc(weeks)}, a za pun ciklus za polumaraton preporučuje se najmanje ${min}. Plan je napravljen za izabrani datum, ali nema vremena za sve faze pripreme i ne garantuje spremnost ni ciljno vreme. Ne nadoknađuj kraći rok naglim povećanjem obima ili intenziteta.`;
  if (weeks > max) {
    const k = weeks - max;
    const first =
      k === 1 ? 'prva nedelja je' : k < 5 ? `prve ${k} nedelje su` : `prvih ${k} nedelja je`;
    return `Plan je duži od preporučenih ${max} nedelja: ${first} osnovna priprema na sadašnjem obimu, a puna priprema za polumaraton počinje u nedelji ${k + 1}.`;
  }
  return null;
}

export type GenerateV3Result = GenerateResult & { findings?: Violation[] };

export function generateHmV3(raw: unknown): GenerateV3Result {
  const chk = checkInput(raw);
  if (!chk.ok) return chk;
  const { input, weeks, pace, pattern, rule } = chk;
  const feel = pace.kind === 'feel';
  const p = pace.kind === 'result' ? pacesFromVdot(pace.vdotRaw) : feelPaces(pace.easySecPerKm);
  const t = rule.beginner ? BEGINNER : REGULAR;
  const frames = framesOf(t, input, weeks, feel);
  const scale = scaleOf(t, rule, p, input.currentWeeklyKm, weeks, rampSteps(frames));
  const goal = input.goalTimeSec ? assessGoal(p.vdot, input.goalTimeSec, weeks) : null;
  const predictedSec = feel ? null : predictedHm(p);
  const planWeeks = buildWeeks(frames, {
    t,
    input,
    rule,
    pattern,
    p,
    feel,
    scale,
    checkVdot: feel ? null : (goal?.goalVdot ?? p.vdot),
    goalSec: input.goalTimeSec ?? null,
    predictedSec
  });
  const notes = [...scale.notes];
  if (feel)
    notes.push(
      'Plan po osećaju: brza tempa su procena iz laganog tempa i služe kao orijentir do provere forme; vodi se opisom napora (RPE).'
    );
  const lw = lengthWarning(weeks, rule.weeksMin);
  if (lw) notes.push(lw);
  const plan: HmV2Plan = {
    policyId: HM_V3_POLICY.id,
    policyVersion: HM_V3_POLICY.version,
    input,
    vdot: p.vdot,
    ...(feel ? { paceBasis: 'feel' as const } : {}),
    paces: p,
    predictedHmSec: predictedSec,
    goal,
    pattern,
    startKm: input.currentWeeklyKm,
    peakCapKm: scale.peakKm,
    peakKm: Math.max(...planWeeks.map((w) => w.targetKm)),
    notes,
    weeks: planWeeks,
    warnings: lw ? [{ rule: 'PLAN_LENGTH', severity: 'warning', message: lw }] : []
  };
  const findings = guard(plan, rule, scale);
  plan.warnings.push(...findings);
  return { ok: true, plan, findings };
}

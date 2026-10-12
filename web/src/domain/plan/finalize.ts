/** Final projection, after guards and preservation. Never rewrite protected day records. */
import { addDays, parseIsoDate, type IsoDate } from '../date';
import { r1 } from '../format';
import type { GenPlanState, StoredWeek } from '../state';
import { profileFor } from '../training/distances';
import { assessPreparation } from '../training/generator/athleteAssessment';
import { deliveredWeekFocus } from '../training/generator/focus';
import type { Day, Week } from '../training/types';
import { describePrescription } from './describe';
import type { ReplanContext } from './future';
import { resolvePlan } from './resolve';

export interface FinalizationOptions {
  returnWindow?: { start: IsoDate; end: IsoDate; requiredWeeks: number };
}

/** Resolve overlays for display/aggregates; their retained session is measurement history only. */
export function deliveredWeeks(plan: GenPlanState, today: IsoDate, ctx: ReplanContext): Week[] {
  const view = resolvePlan(plan.weeks, { alts: ctx.alts ?? {}, moves: ctx.moves ?? {} });
  const origins = new Map(plan.weeks.flatMap((w) => w.days).map((d) => [d.id, d]));
  return plan.weeks.map((w) => {
    const end = addDays(parseIsoDate(w.start)!, 7);
    const days = view.dated
      .filter((d) => d.date > today && d.date >= w.start && d.date < end)
      .map((d): Day => {
        if (d.rest) return { dow: d.dow + 1, rest: true, desc: d.desc };
        if (!ctx.alts?.[d.id]) return { ...origins.get(d.id)!, dow: d.dow + 1 };
        return {
          id: d.id,
          dow: d.dow + 1,
          tag: d.tag,
          km: d.km,
          desc: d.desc,
          ...(d.tag === 'rw' && d.runWalk ? { runWalk: d.runWalk } : {})
        } as Day;
      });
    return { ...w, days, vol: r1(days.reduce((n, d) => n + (d.km ?? 0), 0)) };
  });
}

export function finalizeFuturePlan(
  plan: GenPlanState,
  today: IsoDate,
  ctx: ReplanContext,
  protectedDays: ReadonlySet<string>,
  conflicts: string[],
  options: FinalizationOptions = {}
): GenPlanState {
  if (!plan.meta) return plan;
  const meta = { ...plan.meta };
  const profile = profileFor(meta.raceDistM);
  const view = resolvePlan(plan.weeks, { alts: ctx.alts ?? {}, moves: ctx.moves ?? {} });
  let weeks: StoredWeek[] = plan.weeks.map((w) => ({
    ...w,
    days: w.days.map((d) => {
      if (!d.id || protectedDays.has(d.id) || (view.byId.get(d.id)?.date ?? today) <= today)
        return d;
      return { ...d, desc: describePrescription(d, meta) } as typeof d;
    })
  }));
  const delivered = deliveredWeeks({ ...plan, weeks }, today, ctx);
  weeks = weeks.map((w, i) => {
    if (addDays(parseIsoDate(w.start)!, 6) <= today) return plan.weeks[i]!;
    return {
      ...w,
      focus: deliveredWeekFocus(delivered[i]!.days, {
        isDeload: w.deload,
        isTaper1: !!w.taper,
        isTaper2: false,
        isRace: delivered[i]!.days.some((d) => d.tag === 'trka'),
        isBase: false
      })
    };
  });
  const previousReasons = new Set(meta.preparation?.reasons ?? []);
  if (profile)
    meta.preparation = assessPreparation(
      { weeks: delivered, pred: plan.pred, qs: plan.qs ?? {}, meta },
      profile.product.minPeakKm
    );
  const futureWeeks = delivered.filter((w) =>
    w.days.some((d) => !d.rest && d.km != null && d.tag !== 'trka')
  );
  let easyWeeks = 0;
  for (const w of futureWeeks) {
    if (w.days.some(isDemanding)) break;
    easyWeeks++;
  }
  const warnings = meta.dayWarnings.filter(
    (s) =>
      !previousReasons.has(s) &&
      !/^(Posle pauze od |Potvrđena pauza: .*sa \d+ početne nedelje|Povratni period |Isporučeni vrhunac |Najduže planirano trčanje je |Vrhunac plana je oko |Plan daje JEDAN kvalitetan trening |Tražio si .*plan prve nedelje|Na \d+ dana trčanja plan realno dostiže oko |Finalni preostali plan:)/.test(
        s
      )
  );
  if (meta.preparation)
    meta.preparation.demandingDaysMax = Math.max(
      0,
      ...delivered
        .filter((w) => !w.taper && w.w < meta.weeks)
        .map((w) => w.days.filter(isDemanding).length)
    );
  const peak = meta.preparation?.peakWeeklyKm ?? 0;
  warnings.push(
    `Finalni preostali plan: vrhunac ${peak} km/ned; ${easyWeeks} početnih kalendarskih nedelja sa trčanjem bez kvalitetnog rada i ubrzanja (prva može biti delimična).`
  );
  const window = options.returnWindow;
  let returnWarning: string | undefined;
  if (window) {
    for (const d of view.dated) {
      if (
        !protectedDays.has(d.id) ||
        d.date <= today ||
        d.date < window.start ||
        d.date >= window.end
      )
        continue;
      const demanding = ctx.alts?.[d.id]
        ? ['tempo', 'int', 'test', 'trka'].includes(d.tag ?? '')
        : isDemanding(d);
      if (demanding)
        conflicts.push(
          `Konflikt povratne politike: sačuvan zaštićen trening ${d.id} (${d.date}) sadrži kvalitet ili ubrzanja u periodu predviđenom za lagano trčanje. Proveri i ručno odluči o izmeni; zapis nije prepisan.`
        );
    }
    returnWarning = `Povratni period ${window.start}–${addDays(window.end, -1)}: bez kvaliteta i ubrzanja. Finalni plan ima ${easyWeeks} početnih lakih nedelja; zaštićeni konflikti su posebno navedeni.`;
    warnings.push(returnWarning);
  } else if (meta.athlete?.qualityReadiness === 'returning') {
    warnings.push(
      `Posle pauze od ${meta.athlete.breakWeeks} nedelja finalni plan ima ${easyWeeks} početnih lakih kalendarskih nedelja. Stari PB ostaje referenca; proveri formu pre zahtevnijeg rada.`
    );
  }
  warnings.push(...(meta.preparation?.reasons ?? []), ...conflicts);
  meta.dayWarnings = [...new Set(warnings)];
  meta.finalization = {
    cutoff: today,
    initialEasyWeeks: easyWeeks,
    peakWeeklyKm: peak,
    ...(window ? { returnWindow: window, returnWarning } : {})
  };
  return { ...plan, weeks, meta };
}

export const isDemanding = (d: {
  rest?: boolean;
  tag?: string;
  session?: unknown;
  finish?: unknown;
  strides?: unknown;
}): boolean =>
  !d.rest &&
  (!!d.session ||
    !!d.finish ||
    !!d.strides ||
    ['tempo', 'int', 'test', 'trka'].includes(d.tag ?? ''));

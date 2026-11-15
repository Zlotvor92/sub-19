/* F9 · VRAĆANJE RUČNIH IZMENA (korak 7, § 2d): „Vrati raspored nedelje na plan" i „vrati trening na plan" nad planom
   V4. Pandan `edits.applyMove` / `applyEdit`: isti uslovi (urađen, zaključan i prošao dan se ne dira), deterministički
   događaj `manual-edit`. Vraćanjem dan dobija poreklo kakvo je imao pre ručne izmene (poreklo plana: `template` za
   generisan, `adopted` za preuzet), pa je otisak posle vraćanja isti kao pre izmene. Čiste funkcije. */
import type { DayId, DayOrigin, PlanDay, PlanDoc, PlanEvent } from '../../domain/v4/engine';
import type { EditContext, EditResult } from './edits';

/** Poreklo koje je plan dao danima: najčešće ne-ručno poreklo u dokumentu; bez takvih dana `template`. */
function planOrigin(doc: PlanDoc): DayOrigin {
  let template = 0;
  let adopted = 0;
  for (const w of doc.weeks)
    for (const d of w.days) {
      if (d.origin === 'template') template++;
      else if (d.origin === 'adopted') adopted++;
    }
  return adopted > template ? 'adopted' : 'template';
}

const editable = (d: PlanDay, ctx: EditContext): boolean =>
  !ctx.done.has(d.id) && !d.locked && d.date >= ctx.today;

function eventOf(today: string, dayId: DayId): PlanEvent & { kind: 'manual-edit' } {
  return { id: `manual-edit:${today}:${dayId}:vrati`, date: today, kind: 'manual-edit', dayId };
}

function sortDays(days: PlanDay[]): PlanDay[] {
  return days.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/** Dan posle vraćanja: bez pomeranja i bez izmene dobija poreklo plana. */
function settle(d: PlanDay, origin: DayOrigin): PlanDay {
  if (d.origin === 'manual' && d.movedFrom === undefined && d.base === undefined)
    return { ...d, origin };
  return d;
}

/** Svi pomereni dani nedelje `w` (1…) se vraćaju na prvobitne datume. Odbija se ako bi se dirao urađen, zaključan ili
 *  prošao dan (ili prvobitni datum u prošlosti). */
export function undoWeekMoves(doc: PlanDoc, weekIndex: number, ctx: EditContext): EditResult {
  const week = doc.weeks[weekIndex];
  if (week === undefined) return { ok: false, reason: 'nema-dana' };
  /* i dan koji je pomeren pa vraćen na svoj datum (`applyMove` mu briše `movedFrom`, a poreklo ostaje ručno) */
  const moved = week.days.filter(
    (d) =>
      d.movedFrom !== undefined ||
      (d.origin === 'manual' && d.base === undefined && editable(d, ctx))
  );
  if (moved.length === 0) return { ok: false, reason: 'nema-dana' };
  for (const d of moved) {
    if (ctx.done.has(d.id)) return { ok: false, reason: 'uradjen' };
    if (d.locked) return { ok: false, reason: 'zakljucan' };
    if (!editable(d, ctx) || (d.movedFrom !== undefined && d.movedFrom < ctx.today))
      return { ok: false, reason: 'prosao' };
  }
  const origin = planOrigin(doc);
  const ids = new Set(moved.map((d) => d.id));
  const weeks = doc.weeks.map((w, i) => {
    if (i !== weekIndex) return w;
    return {
      ...w,
      days: sortDays(
        w.days.map((d) => {
          if (!ids.has(d.id)) return d;
          const back: PlanDay = { ...d, date: d.movedFrom ?? d.date };
          delete back.movedFrom;
          return settle(back, origin);
        })
      )
    };
  });
  const first = moved[0];
  return { ok: true, doc: { ...doc, weeks }, event: eventOf(ctx.today, first?.id ?? '') };
}

/** Ručna izmena sadržaja dana se poništava: dan dobija sadržaj iz `base`. */
export function undoEdit(doc: PlanDoc, dayId: DayId, ctx: EditContext): EditResult {
  const day = doc.weeks.flatMap((w) => w.days).find((d) => d.id === dayId);
  if (day === undefined || day.base === undefined) return { ok: false, reason: 'nema-dana' };
  if (ctx.done.has(dayId)) return { ok: false, reason: 'uradjen' };
  if (day.locked) return { ok: false, reason: 'zakljucan' };
  if (day.date < ctx.today) return { ok: false, reason: 'prosao' };
  const origin = planOrigin(doc);
  const weeks = doc.weeks.map((w) => ({
    ...w,
    days: w.days.map((d) => {
      if (d.id !== dayId) return d;
      const back: PlanDay = { ...d, workout: d.base ?? null };
      delete back.base;
      return settle(back, origin);
    })
  }));
  return { ok: true, doc: { ...doc, weeks }, event: eventOf(ctx.today, dayId) };
}

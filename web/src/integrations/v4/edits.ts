/* F9 · SLOJ APLIKACIJA ↔ V4: RUČNA IZMENA I PREMEŠTANJE KAO ČINJENICA (F8 § 9.5, odluka vlasnika 3).
   Sloj upisuje izmenu u `PlanDoc` (datum, `movedFrom`, `origin: 'manual'`, `base`) i vraća događaj `manual-edit`;
   ostatak nedelje presloži motor (`replan`). Urađen, zaključan i prošao dan se ne menjaju. Čiste funkcije. */
import type {
  Availability,
  DayId,
  IsoDate,
  PlanDay,
  PlanDoc,
  PlanEvent,
  PlanWeek,
  Run,
  Weekday,
  Workout
} from '../../domain/v4/engine';

/** Urađeno = trčanje vezano za dan plana (isto pravilo kao motor, SPEC § 1.2). */
export const doneFrom = (runs: readonly Run[]): Set<DayId> =>
  new Set(runs.flatMap((r) => (r.dayId === undefined ? [] : [r.dayId])));

export type EditRefusal =
  'nema-dana' | 'uradjen' | 'zakljucan' | 'prosao' | 'van-nedelje' | 'zauzet' | 'datum-neispravan';

export type EditResult =
  | { ok: true; doc: PlanDoc; event: PlanEvent & { kind: 'manual-edit' } }
  | { ok: false; reason: EditRefusal };

export interface EditContext {
  today: IsoDate;
  done: ReadonlySet<DayId>;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const isDate = (d: string): boolean => {
  if (!DATE.test(d)) return false;
  const t = Date.parse(`${d}T00:00:00Z`);
  return !Number.isNaN(t) && new Date(t).toISOString().slice(0, 10) === d;
};

const plusDays = (d: IsoDate, n: number): IsoDate => {
  const t = new Date(`${d}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
};

/** 0 = ponedeljak … 6 = nedelja. */
export const weekdayOf = (d: IsoDate): Weekday =>
  ((new Date(`${d}T00:00:00Z`).getUTCDay() + 6) % 7) as Weekday;

/** Dan koji korisnik sme da dira: nije urađen, nije zaključan, nije prošao (današnji sme). */
function refusal(day: PlanDay, ctx: EditContext): EditRefusal | null {
  if (ctx.done.has(day.id)) return 'uradjen';
  if (day.locked) return 'zakljucan';
  if (day.date < ctx.today) return 'prosao';
  return null;
}

function find(doc: PlanDoc, dayId: DayId): { week: PlanWeek; day: PlanDay } | null {
  for (const week of doc.weeks) {
    const day = week.days.find((d) => d.id === dayId);
    if (day !== undefined) return { week, day };
  }
  return null;
}

/** Determinističan id: isti dokument + ista radnja = isti id; ponovljena izmena istog dana istog dana dobija redni broj. */
function eventFor(doc: PlanDoc, dayId: DayId, today: IsoDate): PlanEvent & { kind: 'manual-edit' } {
  const prefix = `manual-edit:${today}:${dayId}`;
  const n = doc.header.appliedEvents.filter(
    (id) => id === prefix || id.startsWith(`${prefix}:`)
  ).length;
  return { id: n === 0 ? prefix : `${prefix}:${n}`, date: today, kind: 'manual-edit', dayId };
}

const withDays = (doc: PlanDoc, change: (d: PlanDay) => PlanDay): PlanDoc => ({
  ...doc,
  weeks: doc.weeks.map((w) => ({
    ...w,
    days: w.days.map(change).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
  }))
});

/**
 * Premeštanje dana na drugi datum ISTE nedelje (zamena dana u aplikaciji). Ako je ciljni datum zauzet, dan koji tu
 * stoji prelazi na stari datum (kao `swapDays`) — samo ako i njega korisnik sme da dira. Premešten dan postaje
 * `origin: 'manual'` i nosi `movedFrom` = prvobitni datum; drugi dan menja samo datum (motor ga i dalje sme da presloži).
 */
export function applyMove(
  doc: PlanDoc,
  dayId: DayId,
  toDate: IsoDate,
  ctx: EditContext
): EditResult {
  if (!isDate(toDate)) return { ok: false, reason: 'datum-neispravan' };
  const hit = find(doc, dayId);
  if (hit === null) return { ok: false, reason: 'nema-dana' };
  const { week, day } = hit;
  const own = refusal(day, ctx);
  if (own !== null) return { ok: false, reason: own };
  if (toDate < week.start || toDate > plusDays(week.start, 6))
    return { ok: false, reason: 'van-nedelje' };
  if (toDate < ctx.today) return { ok: false, reason: 'prosao' };
  if (toDate === day.date) return { ok: false, reason: 'zauzet' };
  const other = week.days.find((d) => d.date === toDate);
  if (other !== undefined && refusal(other, ctx) !== null) return { ok: false, reason: 'zauzet' };
  const from = day.date;
  const next = withDays(doc, (d) => {
    if (d.id === day.id) {
      const original = d.movedFrom ?? from;
      const moved: PlanDay = { ...d, date: toDate, origin: 'manual' };
      if (original === toDate) delete moved.movedFrom;
      else moved.movedFrom = original;
      return moved;
    }
    if (other !== undefined && d.id === other.id) {
      const original = d.movedFrom ?? d.date;
      const swapped: PlanDay = { ...d, date: from };
      if (original === from) delete swapped.movedFrom;
      else swapped.movedFrom = original;
      return swapped;
    }
    return d;
  });
  return { ok: true, doc: next, event: eventFor(doc, dayId, ctx.today) };
}

/** Ručna izmena sadržaja dana (`null` = odmor). `base` čuva PRVI sadržaj pre ručnih izmena, za vraćanje. */
export function applyEdit(
  doc: PlanDoc,
  dayId: DayId,
  workout: Workout | null,
  ctx: EditContext
): EditResult {
  const hit = find(doc, dayId);
  if (hit === null) return { ok: false, reason: 'nema-dana' };
  const own = refusal(hit.day, ctx);
  if (own !== null) return { ok: false, reason: own };
  const next = withDays(doc, (d) => {
    if (d.id !== dayId) return d;
    const base = d.origin === 'manual' && d.base !== undefined ? d.base : d.workout;
    return { ...d, workout, origin: 'manual', base };
  });
  return { ok: true, doc: next, event: eventFor(doc, dayId, ctx.today) };
}

/**
 * „Ubuduće dugi subotom?" (F8 § 9.5): kad je korisnik dugi trening dve nedelje zaredom ručno premestio na isti dan u
 * nedelji koji nije `availability.longDay`, vraća taj dan (ponuda se prikazuje jednom; pamti je pozivalac).
 */
export function longDayOffer(doc: PlanDoc, availability: Availability): Weekday | null {
  const moved = doc.weeks.map((w) => {
    const long = w.days.find(
      (d) => d.workout?.kind === 'long' && d.origin === 'manual' && d.movedFrom !== undefined
    );
    return long === undefined ? null : weekdayOf(long.date);
  });
  for (let i = moved.length - 1; i > 0; i--) {
    const a = moved[i - 1];
    const b = moved[i];
    if (a === null || a === undefined || b === null || b === undefined) continue;
    if (a === b && b !== availability.longDay && availability.runDays.includes(b)) return b;
  }
  return null;
}

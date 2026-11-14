/* KRUG 10 — povratak posle događaja: provere nad planom bez imena distance (koriste ih testovi distanci). */
import { addDays, mondayOf } from '../dates';
import { weekCost } from '../guard';
import { paceCtxOf, summarize } from '../load';
import type { PlanDoc, PlanWeek } from '../types';

/** Najmanje nedelja do nedelje −2 da bi se plan posle bolesti vratio na prvobitan (3–4 nedelje povratka + 1). */
const RETURN_MIN_WEEKS = 5;

const longOf = (w: PlanWeek, doc: PlanDoc): number => {
  const ctx = paceCtxOf(doc.header);
  return Math.max(
    0,
    ...w.days.map((d) => (d.workout?.kind === 'long' ? summarize(d.workout, ctx).durationSec : 0))
  );
};

/** Nedelja posle izmene jednaka prvobitnoj (± 0,5 km, ± 1 min dugog; obe merene tempima novog plana). */
function same(a: PlanWeek, b: PlanWeek, after: PlanDoc): boolean {
  const ctx = paceCtxOf(after.header);
  const race = after.header.goal.raceDate;
  return (
    Math.abs(weekCost(a, race, ctx).km - weekCost(b, race, ctx).km) <= 0.5 &&
    Math.abs(longOf(a, after) - longOf(b, after)) <= 60
  );
}

/** Stavka 3: posle događaja nijedna nedelja (od sledeće) nije veća od prvobitne iste nedelje; nedelja −2 ne raste. */
export function noCatchUp(id: string, before: PlanDoc, after: PlanDoc, today: string): string[] {
  const bad: string[] = [];
  const ctx = paceCtxOf(after.header);
  const race = after.header.goal.raceDate;
  const m2 = addDays(mondayOf(race), -14);
  for (const w of after.weeks) {
    if (w.start <= today || w.intent.kind === 'race') continue;
    const old = before.weeks.find((x) => x.start === w.start);
    if (old === undefined) continue;
    const a = weekCost(w, race, ctx).km;
    const b = weekCost(old, race, ctx).km;
    if (a > b + 0.5)
      bad.push(
        `${id} n${String(w.index)}${w.start === m2 ? ' (−2)' : ''} ${a.toFixed(1)} > ${b.toFixed(1)} km`
      );
  }
  return bad;
}

/** Stavka 2: dok se plan ne vrati na prvobitan, dugi posle događaja ≤ + 25 % ili + 20 min od poslednjeg dugog pre
    njega (merilo: poslednji dugi u novom planu, i preko nedelja bez dugog). */
export function longCapAfterEvent(
  id: string,
  before: PlanDoc,
  after: PlanDoc,
  today: string
): string[] {
  const bad: string[] = [];
  let last = 0;
  let back = false;
  for (const w of after.weeks) {
    const l = longOf(w, after);
    /* tekuća nedelja se meri kad joj je dugi posle danas */
    const longDay = w.days.find((d) => d.workout?.kind === 'long');
    const past = addDays(w.start, 6) <= today || (longDay !== undefined && longDay.date <= today);
    if (past || back || w.intent.kind === 'race') {
      if (l > 0) last = l;
      continue;
    }
    const old = before.weeks.find((x) => x.start === w.start);
    if (old !== undefined && same(w, old, after)) {
      back = true;
      continue;
    }
    /* krug 12 (M2): najteža nedelja pred trku posle prekida zadržava ≥ 85 % dugog — namerno, nije skok */
    const peak =
      old !== undefined &&
      w.intent.kind !== 'taper' &&
      longOf(old, before) > 0 &&
      l <= longOf(old, before) + 60 &&
      l >= 0.8 * longOf(old, before);
    if (!peak && last > 0 && l > Math.max(1.25 * last, last + 1200) + 60)
      bad.push(
        `${id} n${String(w.index)} dugi ${String(Math.round(last / 60))} → ${String(Math.round(l / 60))} min`
      );
    if (l > 0) last = l;
  }
  return bad;
}

/** Stavka 1: posle pauze plan se vraća na prvobitan (nikad trajno niže) — od neke nedelje pre sužavanja do trke
    sve nedelje su jednake prvobitnim. */
export function returnsToOriginal(
  id: string,
  before: PlanDoc,
  after: PlanDoc,
  today: string
): string[] {
  const race = after.header.goal.raceDate;
  const m2 = addDays(mondayOf(race), -14);
  const tail = after.weeks.filter((w) => w.start > today && w.start <= m2);
  /* kasna bolest (manje od 5 nedelja do nedelje −2) se ne vraća pre sužavanja — stavka 5 i test 3 */
  if (tail.length < RETURN_MIN_WEEKS) return [];
  const lastIdx = tail.length - 1;
  const lastW = tail[lastIdx];
  const old = lastW === undefined ? undefined : before.weeks.find((x) => x.start === lastW.start);
  if (lastW === undefined || old === undefined) return [];
  return same(lastW, old, after)
    ? []
    : [`${id} n${String(lastW.index)} (−2) nije vraćena na prvobitnu`];
}

/** Stavke 6 i 9: napomene za dan trke — tempo trke isti kao u treninzima (bez cilja), a pominje se POSLEDNJA provera
    forme pred trkom. Vraća opise prekršaja. */
export function raceNoteSource(id: string, doc: PlanDoc, text: string): string[] {
  const bad: string[] = [];
  const lines = text.split('\n');
  const at = lines.findIndex((l) => l.includes('TRKA:'));
  const notes: string[] = [];
  for (let j = at + 1; j < lines.length && (lines[j] ?? '').includes('napomena'); j += 1)
    notes.push(lines[j] ?? '');
  const joined = notes.join(' ');
  const h = doc.header;
  /* R20 B4: uz upozorenje „počni sporije" tempo za trku je oprezniji od tempa u treninzima (rečenica to kaže) */
  const cautious = joined.includes('oprezno, sporija polovina raspona');
  if (!h.paces.byFeel && h.goal.targetTimeSec === undefined && !cautious) {
    const p = Math.round(h.paces.RP);
    const pace = `${String(Math.floor(p / 60))}:${String(p % 60).padStart(2, '0')}/km`;
    if (!joined.includes(pace)) bad.push(`${id} napomena bez tempa trke ${pace}`);
  }
  const tests = doc.weeks
    .flatMap((w) => w.days)
    .filter((d) => d.workout?.kind === 'test' && d.date < h.goal.raceDate)
    .map((d) => d.date);
  const last = tests[tests.length - 1];
  /* ranije provere se ne pominju (samo poslednja) */
  for (const d of tests.slice(0, -1)) {
    const [, m, dd] = d.split('-');
    const shown = `${String(Number(dd))}. ${String(Number(m))}.`;
    if (
      last !== undefined &&
      last !== d &&
      (joined.includes(`forme ${shown}`) || joined.includes(`(${shown})`))
    )
      bad.push(`${id} napomena pominje raniju proveru ${shown}`);
  }
  return bad;
}

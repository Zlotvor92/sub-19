/* ČAROBNJAK ZA PLAN (onboarding): stanje unosa, provere i izračunavanja — bez DOM-a. Ekran (`features/onboarding`) samo crta. */

import { mondayOnOrBefore, parseIsoDate, diffDays, type IsoDate } from '../date';
import { brojNedelja, distUReceni, fmtClock, pl3 } from '../format';
import { generatePlan } from '../training/generator/generatePlan';
import { assess } from '../training/generator/assess';
import { profileFor } from '../training/distances';
import { vdotFromRace } from '../training/vdot/calculateVDOT';
import { paceForZone } from '../training/vdot/paceForZone';
import type { Intensity, PlanGenerationInput } from '../training/types';

export const TOTAL_STEPS = 4;
/** Od ove distance (m) vreme se unosi i u satima (polumaraton, maraton). */
export const HOURS_FROM = 21097;
/** Verodostojan opseg skorašnjeg rezultata po distanci (s). */
export const PB_SANITY: Record<number, readonly [number, number]> = {
  5000: [720, 5999],
  10000: [1500, 5999],
  21097.5: [3300, 14400],
  42195: [6900, 25200]
};
export const INTENSITIES: ReadonlyArray<readonly [Intensity, string]> = [
  ['kons', 'Konzervativno'],
  ['std', 'Standardno'],
  ['agr', 'Agresivno']
];

export interface WizardState {
  raceDist: number;
  raceDate: string;
  pbDist: number;
  pbH: string;
  pbMin: string;
  pbSec: string;
  weeklyKm: string;
  trainedRecently: boolean;
  runDays: number;
  quality: number;
  runDows: number[];
  lrDow: number | null;
  lrDowManual: boolean;
  qDays: number[];
  /** Tempo napretka FORME (rast VDOT-a). */
  intensity: Intensity;
  /** Tempo rasta OBIMA (nedeljni koraci) — poseban izbor od `intensity`. */
  volIntensity: Intensity;
  goalH: string;
  goalMin: string;
  goalSec: string;
}

export const initialWizard = (): WizardState => ({
  raceDist: 5000,
  raceDate: '',
  pbDist: 5000,
  pbH: '',
  pbMin: '',
  pbSec: '',
  weeklyKm: '',
  trainedRecently: true,
  runDays: 4,
  quality: 2,
  runDows: [],
  lrDow: 7,
  lrDowManual: false,
  qDays: [],
  intensity: 'std',
  volIntensity: 'std',
  goalH: '',
  goalMin: '',
  goalSec: ''
});

/** Samo cifre, najviše `n` (polja za vreme). */
export const clampDigits = (v: string, n: number): string =>
  String(v).replace(/\D/g, '').slice(0, n);

export const usesHours = (distM: number): boolean => distM >= HOURS_FROM;

function totalSec(h: string, min: string, sec: string, withHours: boolean): number | null {
  const hh = withHours ? +h || 0 : 0;
  const m = +min;
  const s = +sec;
  if (min === '' || sec === '' || Number.isNaN(m) || Number.isNaN(s) || s > 59) return null;
  if (withHours && m > 59) return null;
  const t = hh * 3600 + m * 60 + s;
  return t > 0 ? t : null;
}
export const pbTotalSec = (w: WizardState): number | null =>
  totalSec(w.pbH, w.pbMin, w.pbSec, usesHours(w.pbDist));
export const goalTotalSec = (w: WizardState): number | null =>
  totalSec(w.goalH, w.goalMin, w.goalSec, usesHours(w.raceDist));

export function pbSanityOk(w: WizardState): boolean {
  const t = pbTotalSec(w);
  if (t == null) return false;
  const [lo, hi] = PB_SANITY[w.pbDist] ?? [60, 99999];
  return t >= lo && t <= hi;
}

export function pbSanityMessage(w: WizardState): string {
  const t = pbTotalSec(w);
  if (t == null) return '';
  const [lo, hi] = PB_SANITY[w.pbDist] ?? [0, 0];
  if (t < lo) return 'Vreme je brže od realnog opsega za izabranu distancu — proveri unos.';
  if (t > hi) return 'Vreme je sporije od opsega koji plan podržava za tu distancu — proveri unos.';
  return '';
}

/**
 * Broj nedelja do trke — ISTA formula kao u `generatePlan` (`floor((trka − ponedeljak tekuće nedelje)/7) + 1`), ne
 * sopstvena: razlika je do DVE nedelje, pa je napomena u sredu govorila „5 nedelja, plan će biti skraćen" dok je generator
 * pravio pun ciklus od 7. `null` kad datuma nema ili je u prošlosti.
 */
export function weeksToRace(raceDate: string, today: string): number | null {
  const race = parseIsoDate(raceDate);
  const t = parseIsoDate(today);
  if (!race || !t) return null;
  const days = diffDays(mondayOnOrBefore(t), race);
  const w = Math.floor(days / 7) + 1;
  return w > 0 ? w : null;
}

export function stepValid(w: WizardState, step: number): boolean {
  if (step === 1) return !!w.raceDate;
  if (step === 2) return pbSanityOk(w);
  if (step === 3) return w.weeklyKm !== '' && +w.weeklyKm > 0;
  return true;
}

/** Napomena pod datumom trke (HTML-slobodan oblik: delovi teksta, podebljano označeno posebno). */
export type WeeksHint =
  | { kind: 'none' }
  | { kind: 'this-week' }
  | { kind: 'too-short'; weeks: number; name: string; minWeeks: number }
  | { kind: 'enough'; weeks: number; nameInSentence: string };

export function weeksHint(w: WizardState, today: string): WeeksHint {
  if (!w.raceDate) return { kind: 'none' };
  const wks = weeksToRace(w.raceDate, today);
  if (wks == null) return { kind: 'none' };
  const prof = profileFor(w.raceDist) ?? profileFor(5000);
  if (!prof) return { kind: 'none' };
  if (wks < 1) return { kind: 'this-week' };
  if (wks < prof.product.minWeeks)
    return {
      kind: 'too-short',
      weeks: wks,
      name: prof.product.name,
      minWeeks: prof.product.minWeeks
    };
  return { kind: 'enough', weeks: wks, nameInSentence: distUReceni(prof.product.name) };
}

export interface OutlookRow {
  k: Intensity;
  label: string;
  sec: number;
  vdot: number;
}
export type Outlook =
  | null
  | { short: true; weeks: number; minWeeks: number; name: string }
  | { short: false; rows: OutlookRow[]; weeks: number; name: string; goal: number | null };

/** Predviđanje na dan trke za sva tri intenziteta — iste funkcije kao generator (`assess`), ne paralelna matematika. */
export function outlook(w: WizardState, today: string): Outlook {
  const pbSec = pbTotalSec(w);
  const weeks = weeksToRace(w.raceDate, today);
  if (pbSec == null || !pbSanityOk(w) || weeks == null) return null;
  const prof = profileFor(w.raceDist);
  if (!prof) return null;
  if (weeks < prof.product.minWeeks)
    return { short: true, weeks, minWeeks: prof.product.minWeeks, name: prof.product.name };
  const pb = { distM: w.pbDist, sec: pbSec };
  const rows = INTENSITIES.map(([k, label]) => {
    const a = assess(pb, weeks, k, null, w.raceDist);
    return { k, label, sec: a.predictedSec, vdot: a.vdotGoal };
  });
  return { short: false, rows, weeks, name: prof.product.name, goal: goalTotalSec(w) };
}

export interface Verdict {
  tone: 'good' | 'warn' | 'bad';
  /** Naglašeni deo, pa običan tekst. */
  lead: string;
  rest: string;
}

/** Ocena ciljnog vremena naspram predviđanja. Isti tekstovi kao u starom kodu. */
export function goalVerdict(
  o: Extract<Outlook, { short: false }>,
  selected: Intensity
): Verdict | null {
  const goal = o.goal;
  if (goal == null) return null;
  const reach = o.rows.find((r) => r.sec <= goal);
  const sel = o.rows.find((r) => r.k === selected);
  const agr = o.rows[o.rows.length - 1];
  if (!agr) return null;
  if (!reach) {
    const diff = agr.sec - goal;
    return {
      tone: 'bad',
      lead: `Cilj ${fmtClock(goal)} nije realan za ovaj plan.`,
      rest: ` Brži je ${fmtClock(diff)} i od najagresivnijeg scenarija (${fmtClock(agr.sec)}). Realno bi tražio više nedelja ili veći nedeljni obim.`
    };
  }
  let lead: string;
  let rest: string;
  let tone: Verdict['tone'] = 'good';
  if (reach.k === o.rows[0]?.k) {
    lead = `Cilj ${fmtClock(goal)} je dostižan i najopreznijim pristupom`;
    rest = ` (${fmtClock(reach.sec)}). Slobodno ciljaj brže.`;
  } else if (reach.k === 'agr') {
    tone = 'warn';
    lead = `Cilj ${fmtClock(goal)} je na granici`;
    rest = ` — dostiže ga samo Agresivno (${fmtClock(reach.sec)}), a to je realno uglavnom uz nizak trenažni staž ili paralelan gubitak telesne mase.`;
  } else {
    lead = `Cilj ${fmtClock(goal)} je realan`;
    rest = ` — dostiže ga ${reach.label} (${fmtClock(reach.sec)}).`;
  }
  if (sel && sel.sec > goal)
    rest += ` Trenutno je izabrano ${sel.label} (${fmtClock(sel.sec)}) — prebaci na ${reach.label}.`;
  return { tone, lead, rest };
}

/** Pun ulaz generatora iz stanja čarobnjaka (`null` dok obavezna polja nisu popunjena). */
export function toGenerationInput(w: WizardState, today: string): PlanGenerationInput | null {
  const pbSec = pbTotalSec(w);
  if (pbSec == null || !pbSanityOk(w) || !w.raceDate || !(+w.weeklyKm > 0)) return null;
  return {
    startDate: today,
    raceDate: w.raceDate,
    raceDistM: w.raceDist,
    pb: { distM: w.pbDist, sec: pbSec },
    weeklyKm: +w.weeklyKm,
    runDays: w.runDays,
    quality: w.quality,
    ...(w.lrDow != null ? { lrDow: w.lrDow } : {}),
    qDows: [...w.qDays],
    runDows: [...w.runDows],
    intensity: w.intensity,
    volIntensity: w.volIntensity,
    goalSec: goalTotalSec(w),
    trainedRecently: w.trainedRecently
  };
}

/**
 * Upozorenja generatora za TRENUTNI unos (probni plan, čita `meta.dayWarnings`). `_noSuggest` se NE šalje: predlog „trebalo bi
 * ti N dana" je najkorisniji deo. `null` dok unos nije potpun ili plan ne može da se napravi. Skupo (generator rekurzivno proba
 * do 6 varijanti): ekran ga poziva tek posle 250 ms tišine.
 */
export function wizardWarnings(w: WizardState, today: string): string[] | null {
  const input = toGenerationInput(w, today);
  if (!input) return null;
  try {
    const p = generatePlan(input);
    if ('error' in p) return null;
    return p.meta.dayWarnings || [];
  } catch {
    return null;
  }
}

export interface FormPreview {
  vdot: number;
  /** Udeo prstena (0–1) u opsegu VDOT 25–65. */
  fraction: number;
  paces: Array<{ label: string; sec: number }>;
}

/** Forma iz rezultata i tempovi koji IZLAZE iz nje — pokazuje zašto se rezultat uopšte unosi. */
export function formPreview(w: WizardState): FormPreview | null {
  const sec = pbTotalSec(w);
  if (sec == null || !pbSanityOk(w)) return null;
  const vdot = vdotFromRace(w.pbDist, sec);
  return {
    vdot,
    fraction: Math.max(0, Math.min(1, (vdot - 25) / (65 - 25))),
    paces: (
      [
        ['Lako', 'E'],
        ['Tempo', 'T'],
        ['Interval', 'I'],
        ['Rep', 'R']
      ] as const
    ).map(([label, z]) => ({ label, sec: paceForZone(vdot, z) }))
  };
}

/**
 * Usklađivanje izbora dana: izabrani konkretni dani (≥ 2) ODREĐUJU broj dana trčanja, dan dugog trčanja i dani za kvalitet
 * ograničeni su na njih (ne može kvalitet u dan kada se ne trči). Dok korisnik SAM ne izabere dan dugog trčanja, drži se na
 * poslednjem izabranom i preračunava na svaku izmenu. Čista funkcija: vraća novo stanje.
 */
export function syncRunDays(w: WizardState): WizardState {
  const sel = [...w.runDows].sort((a, b) => a - b);
  const on = sel.length >= 2;
  const next: WizardState = { ...w, runDows: sel, qDays: [...w.qDays] };
  if (on) next.runDays = sel.length;
  const available = (d: number): boolean => !on || sel.includes(d);
  if (next.lrDow != null && !available(next.lrDow)) next.lrDow = null;
  if (on && (!next.lrDowManual || next.lrDow == null || !sel.includes(next.lrDow)))
    next.lrDow = sel[sel.length - 1] ?? null;
  next.qDays = next.qDays.filter((d) => available(d) && d !== next.lrDow);
  return next;
}

/** Dani dostupni za dugo trčanje / kvalitet (za onemogućavanje dugmadi). */
export function availableDays(w: WizardState): {
  lr: (d: number) => boolean;
  quality: (d: number) => boolean;
} {
  const on = w.runDows.length >= 2;
  const ok = (d: number): boolean => !on || w.runDows.includes(d);
  return { lr: ok, quality: (d) => ok(d) && d !== w.lrDow };
}

/** Kvalitet: ne više dana nego kvaliteta nedeljno (najstariji izbor ispada). */
export function trimQualityDays(qDays: readonly number[], quality: number): number[] {
  const out = [...qDays];
  while (out.length > quality) out.shift();
  return out;
}

export const runDaysLabel = (n: number): string => pl3(n, 'dan', 'dana', 'dana');
export { brojNedelja };
export type { IsoDate };

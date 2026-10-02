/* Raspored dana u nedelji: koji dan je dugo trčanje, kvalitet, lak dan, srednje-dugo, odmor.
   [H]/[P]: nema objavljene konstante za „koliko kvalitetnih za koliki broj dana";
   etalon je dokazan samo za 4 dana / 2 kvaliteta (kod starog generatora to kaže). */

import { DEFAULT_LONG_RUN_DOW } from '../constants/product';

export type SlotRole = 'rest' | 'lr' | 'q1' | 'q2' | 'easy' | 'mlr';
export type DaySlots = Record<number, SlotRole>;

export interface DayPreferences {
  lrDow?: number | undefined;
  qDows?: readonly number[] | undefined;
  runDows?: readonly number[] | undefined;
}

const DOW_NAMES = ['Pon', 'Uto', 'Sre', 'Čet', 'Pet', 'Sub', 'Ned'] as const;
const dowName = (d: number): string => DOW_NAMES[d - 1] ?? '?';

/** Izbor dana za lagana trčanja kad korisnik nije izabrao konkretne dane. */
const EASY_DAY_ORDER = [1, 3, 5, 2, 6, 4, 7] as const;

/** Dani 1–7 iz opcionog niza; sve što nije konačan broj se odbacuje (nepouzdan ulaz, ne NaN). */
const asDays = (a: readonly number[] | undefined): number[] =>
  (Array.isArray(a) ? (a as unknown[]) : [])
    .filter((x): x is number => typeof x === 'number' && Number.isFinite(x))
    .map(Math.round)
    .filter((d) => d >= 1 && d <= 7);

/**
 * Promenljiv broj dana trčanja (2–7) i broj kvalitetnih sesija (1–2). Kvalitet
 * ≤1 kad je ≤3 dana (nema prostora za oporavak između dva teška). Dugo trčanje
 * je `lrDow` (podrazumevano nedelja). Kvalitet ide na proporcionalne pozicije
 * unutar preostalih dana. `wantMidweekLong` traži još jedan duži dan (HM, 42K).
 */
export function buildDaySlots(
  runDaysIn: number,
  qualityCount: number,
  prefs: DayPreferences | null | undefined,
  wantMidweekLong: boolean
): DaySlots {
  const runDays = Math.max(2, Math.min(7, Math.round(runDaysIn)));
  const effQ = runDays <= 3 ? Math.min(qualityCount, 1) : Math.min(qualityCount, 2);
  const lrPref = prefs?.lrDow;
  const lrDow =
    typeof lrPref === 'number' && lrPref >= 1 && lrPref <= 7
      ? Math.round(lrPref)
      : DEFAULT_LONG_RUN_DOW;

  const slots: DaySlots = {
    1: 'rest',
    2: 'rest',
    3: 'rest',
    4: 'rest',
    5: 'rest',
    6: 'rest',
    7: 'rest'
  };
  slots[lrDow] = 'lr';

  let qSel = asDays(prefs?.qDows).filter((d) => d !== lrDow);
  qSel = [...new Set(qSel)].slice(0, effQ).sort((a, b) => a - b);

  /* Izbor konkretnih dana trčanja: ako su izabrani, koriste se TAČNO ti. */
  let runSel = [...new Set(asDays(prefs?.runDows))].sort((a, b) => a - b);

  let chosen: number[];
  if (runSel.length >= 2) {
    /* LR i kvalitet moraju biti među izabranim danima — UI to sprečava, ali
       podatak može stići iz backupa starije verzije. */
    if (!runSel.includes(lrDow)) runSel.push(lrDow);
    runSel = [...new Set(runSel)].sort((a, b) => a - b);
    qSel = qSel.filter((d) => runSel.includes(d));
    chosen = runSel.filter((d) => d !== lrDow).sort((a, b) => a - b);
  } else {
    const order = EASY_DAY_ORDER.filter((d) => d !== lrDow && !qSel.includes(d));
    const need = runDays - 1 - qSel.length;
    chosen = qSel.concat(order.slice(0, Math.max(need, 0))).sort((a, b) => a - b);
  }

  const len = chosen.length;
  if (qSel.length) {
    /* eksplicitan izbor: raniji dan = q1 (VO2 familija), kasniji = q2 (prag) */
    chosen.forEach((dow) => {
      if (dow === qSel[0]) slots[dow] = 'q1';
      else if (qSel[1] != null && dow === qSel[1]) slots[dow] = 'q2';
      else slots[dow] = 'easy';
    });
    /* izabran samo 1 a effQ=2 — drugi kvalitet ide proporcionalno na preostale */
    if (qSel.length === 1 && effQ === 2) {
      const rest = chosen.filter((d) => slots[d] === 'easy');
      if (rest.length) {
        const pick = rest[Math.min(rest.length - 1, Math.round((rest.length * 2) / 3))];
        if (pick !== undefined) slots[pick] = 'q2';
      }
    }
  } else {
    const idx = (num: number, den: number): number =>
      Math.min(len - 1, Math.max(0, Math.round((len * num) / den)));
    let qIdx: number[] = [];
    if (effQ === 2) qIdx = [idx(1, 3), idx(2, 3)];
    else if (effQ === 1) qIdx = [idx(1, 2)];
    qIdx = [...new Set(qIdx)];
    chosen.forEach((dow, i) => {
      if (qIdx[0] === i) slots[dow] = 'q1';
      else if (qIdx[1] === i) slots[dow] = 'q2';
      else slots[dow] = 'easy';
    });
  }

  /* Srednje-dugo trčanje uzima LAGAN dan najdalje od dugog (ciklično — nedelja je prsten).
     Izbegava se samo DVA DUGA TRČANJA JEDNO UZ DRUGO; uz kvalitetni dan se NE izbegava
     (Pfitzingerov obrazac). Ako laganih dana nema, MLR se ne ubacuje. */
  if (wantMidweekLong) {
    const easy = [1, 2, 3, 4, 5, 6, 7].filter((d) => slots[d] === 'easy');
    if (easy.length >= 2) {
      const neighbours = (d: number): number[] => [d === 1 ? 7 : d - 1, d === 7 ? 1 : d + 1];
      const beside = (d: number): number => (neighbours(d).some((x) => slots[x] === 'lr') ? 1 : 0);
      const distance = (d: number): number => {
        const x = Math.abs(d - lrDow);
        return Math.min(x, 7 - x);
      };
      const best = easy
        .map((d) => ({ d, touching: beside(d), far: distance(d) }))
        .sort((a, b) => a.touching - b.touching || b.far - a.far)[0];
      if (best) slots[best.d] = 'mlr';
    }
  }
  return slots;
}

/**
 * Upozorenja za korisnički izbor dana — NE blokira (sve je izmenjivo), samo
 * kaže. Teški dani zaredom (kvalitet ili LR, uključujući prelaz Ned→Pon) i dva
 * duga trčanja zaredom. Srednje-dugo uz kvalitet se NE broji (to je obrazac,
 * ne greška — upozorenje koje se javi skoro uvek je šum).
 */
export function dayPreferenceWarnings(slots: DaySlots): string[] {
  const hard = (d: number): boolean => slots[d] === 'q1' || slots[d] === 'q2' || slots[d] === 'lr';
  const out: string[] = [];
  for (let d = 1; d <= 7; d++) {
    const nxt = d === 7 ? 1 : d + 1;
    if (hard(d) && hard(nxt)) {
      out.push(
        `Teški dani zaredom: ${dowName(d)} → ${dowName(nxt)} — hard/easy princip preporučuje lak dan ili odmor između.`
      );
    }
  }
  for (let d = 1; d <= 7; d++) {
    const nxt = d === 7 ? 1 : d + 1;
    if (
      (slots[d] === 'mlr' && slots[nxt] === 'lr') ||
      (slots[d] === 'lr' && slots[nxt] === 'mlr')
    ) {
      out.push(
        `Dva duga trčanja zaredom: ${dowName(d)} → ${dowName(nxt)} — dugo i srednje-dugo trčanje traže lak dan između.`
      );
    }
  }
  return out;
}

/** Snaga ide na prvi slobodan („rest") dan Pon–Sub; `null` ako ga nema. */
export function pickStrengthDay(slots: DaySlots): number | null {
  for (let d = 1; d <= 6; d++) if (slots[d] === 'rest') return d;
  return null;
}

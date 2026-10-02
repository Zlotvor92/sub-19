import { beforeAll, describe, expect, it } from 'vitest';
import { canonical } from '@/test/fingerprint';
import { firstDiff } from '@/test/firstDiff';
import { loadLegacyApp, type LegacyApp } from '@/test/legacyOracle';
import { addDays, type IsoDate } from '../date';
import { generatePlan } from '../training/generator/generatePlan';
import {
  goalTotalSec,
  initialWizard,
  outlook,
  pbSanityMessage,
  pbSanityOk,
  pbTotalSec,
  stepValid,
  toGenerationInput,
  weeksToRace,
  wizardWarnings,
  formPreview,
  type WizardState
} from './index';

/* parity: test/uvod.test.mjs, test/licni-plan.test.mjs (čarobnjak). Poredi `domain/onboarding` sa starim `pbTotalSec`,
   `pbSanityOk/Msg`, `wizWeeks`, `outlookData`, `wizardWarnings`, `obStepValid`, `updateVdotPreview` (matematika). */

function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const j = <T>(x: unknown): T => JSON.parse(JSON.stringify(x)) as T;
const pick = <T>(r: () => number, xs: readonly T[]): T => xs[Math.floor(r() * xs.length)] as T;

let legacy: LegacyApp;
let TODAY: IsoDate;
beforeAll(async () => {
  legacy = await loadLegacyApp('2026-01-07T09:00:00Z');
  TODAY = legacy.evalIn('todayStr()') as IsoDate;
});

function randomWizard(r: () => number): WizardState {
  const w = initialWizard();
  w.raceDist = pick(r, [5000, 10000, 21097.5, 42195]);
  w.pbDist = pick(r, [5000, 10000, 21097.5, 42195]);
  w.raceDate = r() < 0.1 ? '' : addDays(TODAY, Math.floor(r() * 220));
  const long = w.pbDist >= 21097;
  w.pbH = long ? String(Math.floor(r() * 5)) : '';
  w.pbMin = r() < 0.05 ? '' : String(long ? Math.floor(r() * 62) : 12 + Math.floor(r() * 60));
  w.pbSec = r() < 0.05 ? '' : String(Math.floor(r() * 62));
  w.weeklyKm = r() < 0.1 ? '' : String(Math.floor(r() * 130));
  w.trainedRecently = r() < 0.7;
  w.runDays = 2 + Math.floor(r() * 6);
  w.quality = 1 + Math.floor(r() * 2);
  w.intensity = pick(r, ['kons', 'std', 'agr'] as const);
  w.lrDow = 1 + Math.floor(r() * 7);
  if (r() < 0.3) w.runDows = [1, 3, 5, 7].filter(() => r() < 0.8);
  if (r() < 0.3) w.qDays = [2, 4].filter(() => r() < 0.7);
  if (r() < 0.5) {
    const lg = w.raceDist >= 21097;
    w.goalH = lg ? String(1 + Math.floor(r() * 5)) : '';
    w.goalMin = String(Math.floor(r() * 62));
    w.goalSec = String(Math.floor(r() * 62));
  }
  return w;
}

const legacyWiz = (w: WizardState): void => {
  (legacy as unknown as { ctx: Record<string, unknown> }).ctx['__w'] = j(w);
  legacy.evalIn('wiz=__w; 0');
};

describe('čarobnjak naspram starog koda', () => {
  it('600 nasumičnih unosa: vreme, provera, nedelje, korak, predviđanje, forma', () => {
    const r = rng(11);
    let outlooks = 0;
    for (let i = 0; i < 600; i++) {
      const w = randomWizard(r);
      legacyWiz(w);
      const where = `iter ${i}`;
      expect(pbTotalSec(w), `pb ${where}`).toBe(legacy.evalIn('pbTotalSec()'));
      expect(goalTotalSec(w), `cilj ${where}`).toBe(legacy.evalIn('goalTotalSec()'));
      expect(pbSanityOk(w), `sanity ${where}`).toBe(legacy.evalIn('pbSanityOk()'));
      expect(pbSanityMessage(w), `poruka ${where}`).toBe(legacy.evalIn('pbSanityMsg()'));
      expect(weeksToRace(w.raceDate, TODAY), `nedelje ${where}`).toBe(legacy.evalIn('wizWeeks()'));
      for (const step of [1, 2, 3, 4])
        expect(stepValid(w, step), `korak ${step} ${where}`).toBe(
          legacy.evalIn(`obStepValid(${step})`)
        );
      const old = j<{
        short?: boolean;
        rows?: Array<{ k: string; lbl: string; sec: number; vdot: number }>;
        weeks?: number;
        name?: string;
        minWeeks?: number;
        goal?: number | null;
      } | null>(legacy.evalIn('outlookData()'));
      const mine = outlook(w, TODAY);
      if (!old) expect(mine, `predviđanje ${where}`).toBeNull();
      else if (old.short)
        expect(mine, where).toEqual({
          short: true,
          weeks: old.weeks,
          minWeeks: old.minWeeks,
          name: old.name
        });
      else {
        expect(
          mine && !mine.short
            ? {
                rows: mine.rows.map((x) => ({ k: x.k, lbl: x.label, sec: x.sec, vdot: x.vdot })),
                weeks: mine.weeks,
                name: mine.name,
                goal: mine.goal
              }
            : mine,
          `predviđanje ${where}`
        ).toEqual(old);
        outlooks++;
      }
    }
    expect(outlooks).toBeGreaterThan(100);
  });

  it('upozorenja generatora: ista lista (60 unosa; skupo pa manje)', () => {
    const r = rng(12);
    let lists = 0;
    for (let i = 0; i < 60; i++) {
      const w = randomWizard(r);
      legacyWiz(w);
      const old = j<string[] | null>(legacy.evalIn('wizardWarnings()'));
      const mine = wizardWarnings(w, TODAY);
      if (mine === null && old !== null) {
        /* NAMERNA RAZLIKA (ENGINE_CHANGES G-ciljno vreme): stari generator prihvata nemoguć cilj (npr. 5K za 10:38), novi ga
           odbija greškom — pa probni plan ne postoji. */
        const input = toGenerationInput(w, TODAY);
        expect(input && 'error' in generatePlan(input), `iter ${i}`).toBe(true);
        continue;
      }
      expect(firstDiff(canonical(mine), canonical(old)), `iter ${i}`).toBeNull();
      if (mine && mine.length) lists++;
    }
    expect(lists, 'uzorak mora da sadrži stvarna upozorenja').toBeGreaterThan(3);
  });

  it('forma iz rezultata: isti VDOT i isti tempo zona', () => {
    const r = rng(13);
    for (let i = 0; i < 100; i++) {
      const w = randomWizard(r);
      if (!pbSanityOk(w)) continue;
      const p = formPreview(w);
      const sec = pbTotalSec(w) as number;
      expect(p?.vdot).toBe(legacy.call('vdotFromRace', w.pbDist, sec));
      for (const [label, z] of [
        ['Lako', 'E'],
        ['Tempo', 'T'],
        ['Interval', 'I'],
        ['Rep', 'R']
      ] as const)
        expect(p?.paces.find((x) => x.label === label)?.sec, `${label} ${i}`).toBe(
          legacy.call('paceForZone', p?.vdot, z)
        );
    }
  });
});

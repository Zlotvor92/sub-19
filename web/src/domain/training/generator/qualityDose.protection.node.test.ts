import { generatePlan } from '@/test/generators';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { PlanGenerationInput } from '../types';

const QA_BASE = {
  startDate: '2026-10-12',
  raceDate: '2027-01-31',
  breakWeeks: 0,
  quality: 2,
  intensity: 'std',
  volIntensity: 'std',
  trainedRecently: true,
  lrDow: 7
} as const;
const plan = (inp: PlanGenerationInput) => {
  const p = generatePlan(structuredClone(inp));
  if ('error' in p) throw new Error(p.error);
  return p;
};

describe('beginner, returning and developing protection follows the reviewed completed-segment baseline', () => {
  /* U04 retains its 38ecc08 hash. U01/U06 include completed step 7: conditional run/walk
     transition, removed early strides, effort-first descriptions and explicit current return readiness.
     Numeric weeks and predictions match the integrated completed-step baseline; independent
     runWalkAndForm/fatigue regressions verify these deliberate semantic changes. */
  const LOCKED: Record<string, { sha: string; input: PlanGenerationInput }> = {
    U01: {
      sha: '93f00602b617',
      input: {
        startDate: '2026-10-12',
        raceDate: '2027-01-03',
        raceDistM: 5000,
        pb: { distM: 5000, sec: 2100, date: '2026-09-13' },
        weeklyKm: 8,
        recentLongRunKm: 3,
        consistentWeeks: 0,
        breakWeeks: 0,
        qualityExperience: 'none',
        runDays: 3,
        quality: 1,
        intensity: 'kons',
        volIntensity: 'kons',
        trainedRecently: false,
        goalSec: 1800,
        lrDow: 7
      }
    },
    U04: {
      sha: '355c527a8923',
      input: {
        ...QA_BASE,
        raceDistM: 10000,
        pb: { distM: 5000, sec: 1500, date: '2026-09-20' },
        weeklyKm: 25,
        recentLongRunKm: 8,
        consistentWeeks: 8,
        qualityExperience: 'none',
        runDays: 4,
        goalSec: 3000
      }
    },
    U06: {
      sha: '3857db62e272',
      input: {
        startDate: '2026-10-12',
        raceDate: '2027-01-31',
        raceDistM: 10000,
        pb: { distM: 5000, sec: 1620, date: '2025-10-12' },
        weeklyKm: 15,
        recentLongRunKm: 4,
        consistentWeeks: 1,
        breakWeeks: 8,
        qualityExperience: 'some',
        runDays: 3,
        quality: 1,
        intensity: 'std',
        volIntensity: 'kons',
        trainedRecently: false,
        goalSec: 3600,
        lrDow: 7
      }
    }
  };
  for (const [id, { sha, input }] of Object.entries(LOCKED))
    it(`${id} plan matches its reviewed baseline`, () => {
      const p = plan(input);
      expect(p.meta.athlete?.qualityReadiness).not.toBe('experienced');
      expect(createHash('sha256').update(JSON.stringify(p)).digest('hex').slice(0, 12)).toBe(sha);
    });
});

describe('experienced taper and race weeks keep their previous sessions', () => {
  /* SHA-256 of the taper + race week session days from docs/qa/session-purpose (38ecc08).
     The experienced policy changes build weeks only; taper sessions stay identical.
     HM (U08) is excluded since the HM progression segment: its taper is now derived from the
     HM target doses (hmProgression.test.ts locks that taper's shape instead). */
  const EXPERIENCED: Record<string, { sha: string; input: PlanGenerationInput }> = {
    U03: {
      sha: '430d6a2f61b5',
      input: {
        ...QA_BASE,
        raceDistM: 5000,
        pb: { distM: 5000, sec: 1235, date: '2026-09-20' },
        weeklyKm: 50,
        recentLongRunKm: 14,
        consistentWeeks: 24,
        qualityExperience: 'experienced',
        runDays: 5,
        goalSec: 1139
      }
    },
    U05: {
      sha: 'b28d5f7dfc7e',
      input: {
        ...QA_BASE,
        raceDistM: 10000,
        pb: { distM: 10000, sec: 2700, date: '2026-09-20' },
        weeklyKm: 45,
        recentLongRunKm: 14,
        consistentWeeks: 24,
        qualityExperience: 'experienced',
        runDays: 5,
        goalSec: 2520
      }
    },
    U10: {
      sha: '90bc98294c4a',
      input: {
        ...QA_BASE,
        raceDate: '2027-02-28',
        raceDistM: 42195,
        pb: { distM: 42195, sec: 13500, date: '2026-09-20' },
        weeklyKm: 60,
        recentLongRunKm: 24,
        consistentWeeks: 32,
        qualityExperience: 'experienced',
        runDays: 5,
        goalSec: 12600
      }
    }
  };
  for (const [id, { sha, input }] of Object.entries(EXPERIENCED))
    it(`${id} taper/race sessions are identical to the previous segment`, () => {
      const p = plan(input);
      expect(p.meta.athlete?.qualityReadiness).toBe('experienced');
      const n = p.weeks.length;
      const taper = p.weeks
        .filter((w, i) => w.taper || i === n - 1)
        .map((w) => ({ w: w.w, s: w.days.filter((d) => d.session) }));
      expect(createHash('sha256').update(JSON.stringify(taper)).digest('hex').slice(0, 12)).toBe(
        sha
      );
    });
});

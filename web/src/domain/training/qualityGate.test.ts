import { describe, expect, it } from 'vitest';
import { parseIsoDate } from '../date';
import type {
  ExecutionAnalysis,
  ExecutionWeek
} from '@/domain/generators/fiveK/training/execution';
import * as fiveK_training_qualityGate from '@/domain/generators/fiveK/training/qualityGate';
import * as tenK_training_qualityGate from '@/domain/generators/tenK/training/qualityGate';
import * as halfMarathon_training_qualityGate from '@/domain/generators/halfMarathon/training/qualityGate';
import * as marathon_training_qualityGate from '@/domain/generators/marathon/training/qualityGate';

/* Isti test nad kopijom svakog generatora (svaki generator ima sopstvenu implementaciju). */
const COPIES = [
  [
    '5K',
    {
      hasRecentMeasuredForm: fiveK_training_qualityGate.hasRecentMeasuredForm,
      qualityEntryGate: fiveK_training_qualityGate.qualityEntryGate
    }
  ],
  [
    '10K',
    {
      hasRecentMeasuredForm: tenK_training_qualityGate.hasRecentMeasuredForm,
      qualityEntryGate: tenK_training_qualityGate.qualityEntryGate
    }
  ],
  [
    'HM',
    {
      hasRecentMeasuredForm: halfMarathon_training_qualityGate.hasRecentMeasuredForm,
      qualityEntryGate: halfMarathon_training_qualityGate.qualityEntryGate
    }
  ],
  [
    'maraton',
    {
      hasRecentMeasuredForm: marathon_training_qualityGate.hasRecentMeasuredForm,
      qualityEntryGate: marathon_training_qualityGate.qualityEntryGate
    }
  ]
] as const;

describe.each(COPIES)('%s kopija', (_copy, { hasRecentMeasuredForm, qualityEntryGate }) => {
  const week = (over: Partial<ExecutionWeek>): ExecutionWeek => ({
    start: parseIsoDate('2026-11-02')!,
    end: parseIsoDate('2026-11-08')!,
    plannedKm: 12,
    actualKm: 11,
    completed: 3,
    missed: 0,
    unknown: 0,
    statusCoverage: 1,
    volumeCoverage: 1,
    ...over
  });
  const analysis = (weeks: ExecutionWeek[], easyHighRpeCount = 0): ExecutionAnalysis =>
    ({ completeWeeks: weeks, easyHighRpeCount }) as ExecutionAnalysis;

  describe('kapija za zahtevniji rad uz nepotvrđenu formu', () => {
    const good = analysis([week({}), week({})]);

    it('otvara se samo uz obim, bez bola i uz merenu formu', () => {
      const open = qualityEntryGate({ analysis: good, formConfirmed: true });
      expect(open.open).toBe(true);
      expect(open.unmet).toEqual([]);
    });

    it('stari PB sam ne otvara kapiju, čak ni uz odrađen obim', () => {
      const r = qualityEntryGate({ analysis: good, formConfirmed: false });
      expect(r.open).toBe(false);
      expect(r.unmet.join(' ')).toMatch(/Forma potvrđena merenjem/);
    });

    it('nedovoljan obim, bol i preteški laki treninzi drže kapiju zatvorenom', () => {
      const low = qualityEntryGate({
        analysis: analysis([week({ actualKm: 5 }), week({})]),
        formConfirmed: true
      });
      expect(low.unmet.join(' ')).toMatch(/bar 75%/);
      expect(qualityEntryGate({ analysis: good, formConfirmed: true, recentPainMax: 4 }).open).toBe(
        false
      );
      expect(
        qualityEntryGate({ analysis: analysis([week({}), week({})], 2), formConfirmed: true }).open
      ).toBe(false);
    });

    it('neupisani kilometri su nepoznati: ni ispunjeni ni neuspeh, ali kapija ostaje zatvorena', () => {
      const r = qualityEntryGate({
        analysis: analysis([week({ volumeCoverage: 0.3, actualKm: 0 }), week({})]),
        formConfirmed: true
      });
      expect(r.unknown).toHaveLength(1);
      expect(r.unmet).toEqual([]);
      expect(r.open).toBe(false);
    });
  });

  describe('merena forma', () => {
    it('kontrolni test ili izmeren zapis u poslednjih 90 dana potvrđuje, stariji ne', () => {
      const today = '2026-11-25';
      expect(
        hasRecentMeasuredForm(today, { t3k: [{ id: 'a', date: '2026-10-20', sec: 700 }] })
      ).toBe(true);
      expect(
        hasRecentMeasuredForm(today, { t3k: [{ id: 'a', date: '2026-07-01', sec: 700 }] })
      ).toBe(false);
      const rec = (ts: string, measured: number | null) => ({
        id: 1,
        ts,
        vdot: 40,
        prev: null,
        delta: null,
        measured
      });
      expect(hasRecentMeasuredForm(today, { vdotLog: [rec('2026-11-01T10:00:00Z', 40)] })).toBe(
        true
      );
      expect(hasRecentMeasuredForm(today, { vdotLog: [rec('2026-11-01T10:00:00Z', null)] })).toBe(
        false
      );
      expect(hasRecentMeasuredForm(today, {})).toBe(false);
    });
  });
});

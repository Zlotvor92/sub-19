import { describe, expect, it } from 'vitest';
import type { ReferenceRow } from '@/test/fiveK/reference';
import { formPreview, initialWizard } from '../onboarding';
import { formPreviewFlows, guidanceFlows, type GuidanceApi } from '@/test/guidance/scenarios';
import { loadGuidanceReference, rowsOf } from '@/test/guidance/reference';
import * as fiveK from './fiveK';
import * as halfMarathon from './halfMarathon';
import * as marathon from './marathon';
import * as tenK from './tenK';

/* PRENOS ZAJEDNIČKE TRENERSKE LOGIKE U SVAKI GENERATOR (posle segmenta 5/5).

   Predlog izmene plana zbog bola i prekida, automatska zamena dana, izvoz na sat, tempo uz vrućinu, ciljni napor i tempo
   po zoni su do prenosa bili jedna aplikaciona implementacija za sve distance. Sada svaki generator ima sopstvenu kopiju.
   Referenca (`src/test/fixtures/guidance-reference.json.gz`) je snimljena iz aplikacionog koda pre prenosa (`ae6b43a`);
   SVAKA od četiri kopije mora dati tačno isti zapis na svim tokovima (planovi sve četiri distance i ugrađeni lični plan).
   Nijedno polje nije izuzeto. */

type Mod = typeof fiveK;
const GENERATORS: [string, Mod][] = [
  ['5K', fiveK],
  ['10K', tenK as unknown as Mod],
  ['HM', halfMarathon as unknown as Mod],
  ['maraton', marathon as unknown as Mod]
];

const apiOf = (m: Mod): GuidanceApi =>
  ({
    injuryProposal: m.injuryProposal,
    applyInjuryProposal: m.applyInjuryProposal,
    runWalkForPain: m.runWalkForPain,
    realignPlan: m.realignPlan,
    workoutsForWatch: m.workoutsForWatch,
    thresholdPace: m.thresholdPace,
    dayWorkoutText: m.dayWorkoutText,
    sessionFromDescription: m.sessionFromDescription,
    weatherCard: m.weatherCard,
    targetPace: m.targetPace,
    heatFor: m.heatFor,
    heatAdvice: m.heatAdvice,
    heatAdjustedPace: m.heatAdjustedPace,
    rpeTarget: m.rpeTarget,
    paceForZone: m.paceForZone
  }) as unknown as GuidanceApi;

function diff(actual: Record<string, ReferenceRow>, expected: Record<string, ReferenceRow>) {
  const out: string[] = [];
  for (const [name, ref] of Object.entries(expected)) {
    const got = actual[name];
    if (!got) out.push(`NEDOSTAJE: ${name}`);
    else if (got.full !== ref.full || got.pure !== ref.pure) out.push(name);
  }
  for (const name of Object.keys(actual)) if (!expected[name]) out.push(`NOVO: ${name}`);
  return out;
}

const reference = loadGuidanceReference();

describe('trenerska logika van plana: svaki generator ima svoju kopiju, ponašanje očuvano', () => {
  it('referenca postoji i uzeta je iz aplikacionog koda pre prenosa', () => {
    expect(reference?.baselineSha).toBe('ae6b43a');
    expect(Object.keys(reference?.flows ?? {}).length).toBe(14744);
  });

  for (const [name, mod] of GENERATORS)
    it(`${name}: tačan zapis = referenca`, { timeout: 600_000 }, () => {
      expect(diff(rowsOf(guidanceFlows(apiOf(mod))), reference!.flows)).toEqual([]);
    });

  /* Pregled forme u čarobnjaku sada računa tempo generatora izabrane ciljne distance. Jedina namerna razlika: ciljna
     distanca bez generatora (7000 m) više nema tempo po zonama (`null`) — čarobnjak takvu distancu ne nudi. */
  it('pregled forme u čarobnjaku: isto za sve podržane distance; nepodržana nema generator', () => {
    const now = rowsOf(formPreviewFlows(formPreview, initialWizard as never));
    const changed = diff(now, reference!.formPreview);
    expect(changed.every((n) => n.startsWith('forma 7000 '))).toBe(true);
    for (const n of changed)
      expect(now[n]?.full).toBe(rowsOf([{ name: n, value: null, pure: true }])[n]?.full);
  });
});

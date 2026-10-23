/* OCENA CILJA GENERATORA (5k-v2): „nedovoljno podataka", „orijentir", „završiti"… prikazuje se DOSLOVNO, uz poruku
   generatora. Kad plan ocenu nema (stariji planovi), ništa se ne crta — prognoza se ne izmišlja. */

import type { GenPlanState } from '../../domain/state';

export function GoalAssessmentLine({ meta }: { meta: GenPlanState['meta'] | null | undefined }) {
  const g = meta?.goalAssessment;
  if (!g || typeof g.label !== 'string' || typeof g.message !== 'string') return null;
  return (
    <p className="note-src" id="goal-assessment">
      Cilj: <b>{g.label}</b> — {g.message}
    </p>
  );
}

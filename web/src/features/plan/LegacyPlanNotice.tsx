import { Notice } from '../../components/ui/primitives';
import { LEGACY_PLAN, isLegacyPlan } from '../../domain/generators/select';
import { useTrainingStore } from '../../stores';
import { startNewPlan } from './planActions';

/* V1b — PLAN STAROG GENERATORA (v1 obrisan): plan se i dalje prikazuje i unos radi (prikaz je u `domain/plan`), ali ga
   nijedan generator ne prilagođava. Jedna poruka i jedna radnja: „Generiši nov plan" (potvrda kaže šta se briše a šta
   ostaje, `startNewPlan`). Stanje se ne migrira. Ugrađeni lični plan vlasnika nije stari plan (`isLegacyPlan`). */
export const LEGACY_PLAN_ID = 'legacy-plan';

export function LegacyPlanNotice({ id = LEGACY_PLAN_ID }: { id?: string }) {
  const legacy = useTrainingStore((s) => isLegacyPlan(s.genPlan));
  if (!legacy) return null;
  return (
    <Notice
      id={id}
      tone="warn"
      title={LEGACY_PLAN}
      actions={[{ label: 'Generiši nov plan', onClick: startNewPlan }]}
    >
      Treninzi i unosi se vide kao i do sada. Prilagođavanje, predlozi i promena cilja rade samo za
      plan koji pravi trenutni generator.
    </Notice>
  );
}

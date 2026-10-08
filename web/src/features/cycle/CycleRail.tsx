import { memo } from 'react';
import { plDan } from '../../domain/format';
import { Icon } from '../../components/ui/icons';
import { PHASE_COLOR, type CycleModel, type PhaseKey } from './cycle';

const PHASE_NAME: Readonly<Record<PhaseKey, string>> = {
  BAZA: 'Baza',
  RAZVOJ: 'Razvoj',
  VRHUNAC: 'Vrhunac',
  TAPER: 'Taper',
  TRKA: 'Trka'
};

/** Rečenica za čitač ekrana: isto što traka pokazuje, bez oslanjanja na boju. */
export function cycleLabel(model: CycleModel, daysToRace: number | null): string {
  const c = model.current;
  const race =
    daysToRace == null
      ? ''
      : daysToRace > 0
        ? `, ${daysToRace} ${plDan(daysToRace)} do trke`
        : daysToRace === 0
          ? ', danas je trka'
          : ', trka je prošla';
  return c
    ? `Ciklus: nedelja ${c.w} od ${model.total}, faza ${PHASE_NAME[c.phase]}${c.deload ? ' (rasterećenje)' : ''}${race}.`
    : `Ciklus: plan od ${model.total} nedelja${race}.`;
}

/** Pregled cele pripreme u jednoj liniji: jedan segment po nedelji, tonovi po fazi, tekuća nedelja uzdignuta, rasterećenje niže, zastavica trke. */
export const CycleRail = memo(function CycleRail({
  model,
  daysToRace
}: {
  model: CycleModel | null;
  daysToRace: number | null;
}) {
  if (!model || !model.weeks.length) return null;
  return (
    <div className="rail" role="img" aria-label={cycleLabel(model, daysToRace)}>
      {model.weeks.map((w) => (
        <i
          key={w.w}
          data-s={w.state}
          {...(w.deload ? { 'data-deload': '' } : {})}
          style={{ ['--c' as string]: PHASE_COLOR[w.phase] }}
        />
      ))}
      <span className="flag" aria-hidden="true">
        <Icon name="flag" size={16} />
      </span>
    </div>
  );
});

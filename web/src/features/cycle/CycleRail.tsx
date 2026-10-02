import { memo } from 'react';
import { plDan } from '../../domain/format';
import { Icon } from '../../components/ui/icons';
import { PHASE_COLOR, cycleCaption, type CycleModel, type PhaseKey } from './cycle';

const PHASE_NAME: Readonly<Record<PhaseKey, string>> = {
  BAZA: 'Baza',
  RAZVOJ: 'Razvoj',
  VRHUNAC: 'Vrhunac',
  TAPER: 'Taper',
  TRKA: 'Trka'
};

/** Natpis u zaglavlju: „N6/12 · RAZVOJ · 46 d". Pre početka i posle kraja plana nema faze. */
export function CycleCaption({
  model,
  daysToRace,
  startLabel
}: {
  model: CycleModel | null;
  daysToRace: number | null;
  startLabel: string;
}) {
  if (!model) return null;
  const cap = cycleCaption(model);
  if (!cap)
    return <>{daysToRace != null && daysToRace < 0 ? 'Plan završen' : `Start ${startLabel}`}</>;
  return (
    <>
      {cap.week} · <b style={{ ['--c' as string]: PHASE_COLOR[cap.phase] }}>{cap.phase}</b>
      {daysToRace == null ? '' : daysToRace === 0 ? ' · danas je trka' : ` · ${daysToRace} d`}
    </>
  );
}

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
    ? `Ciklus: nedelja ${c.w} od ${model.total}, faza ${PHASE_NAME[c.phase]}${c.deload ? ' (rasterećenje)' : ''}${race}. Otvori plan.`
    : `Ciklus: plan od ${model.total} nedelja${race}. Otvori plan.`;
}

/** Trajni prikaz pozicije u ciklusu: jedan segment po nedelji, boja faze, tekuća nedelja uzdignuta, rasterećenje niže, zastavica trke. */
export const CycleRail = memo(function CycleRail({
  model,
  daysToRace,
  onOpen
}: {
  model: CycleModel | null;
  daysToRace: number | null;
  onOpen: () => void;
}) {
  if (!model || !model.weeks.length) return null;
  return (
    <button
      type="button"
      className="rail"
      aria-label={cycleLabel(model, daysToRace)}
      onClick={onOpen}
    >
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
    </button>
  );
});

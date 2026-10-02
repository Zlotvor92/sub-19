import { fmtKm } from '../../domain/format';
import { PHASE_COLOR, type CycleModel } from './cycle';

const STATE_LABEL = { done: 'završeno', now: 'u toku', future: '' } as const;

/** Faze ciklusa u jednom pogledu: tačka u boji faze + naziv + nedelje + ostvareni/planirani km. Stanje je i rečju, ne samo bojom. */
export function PhaseList({ model }: { model: CycleModel }) {
  return (
    <ul className="phases">
      {model.phases.map((p) => (
        <li
          key={p.key}
          className={`phase ${p.state}`}
          style={{ ['--c' as string]: PHASE_COLOR[p.key] }}
        >
          <i className="led" aria-hidden="true" />
          <b>{p.key}</b>
          <span className="rng">
            N{p.from}
            {p.to > p.from ? `–${p.to}` : ''}
          </span>
          <span className="st">{STATE_LABEL[p.state]}</span>
          <span className="km num">
            {p.state === 'future' ? '' : `${fmtKm(p.realKm)} / `}
            {fmtKm(p.planKm)} km
          </span>
        </li>
      ))}
    </ul>
  );
}

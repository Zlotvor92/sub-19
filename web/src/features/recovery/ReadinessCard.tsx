import { StatusBadge } from '../../components/ui/Badge';
import { toBadge } from './cards';
import type { Readiness } from './readiness';

/* STANJE DANAS: odgovor, razlog, savet — pa svi signali sa svojom brojkom i stanjem rečima. Najlošiji signal je prvi i on odlučuje. Jedino mesto na kome
   se signali oporavka prikazuju kao brojevi; grafikoni ispod nose samo kretanje kroz vreme. */
export function ReadinessCard({ model }: { model: Readiness }) {
  const { tone } = model;
  return (
    <section className={`ready ${tone}`} aria-labelledby="rd-h">
      <div className="section-h">
        <h2 id="rd-h">Stanje danas</h2>
        <span>{model.signals.length} signala</span>
      </div>
      <p className={`rd-a ${tone}`}>{model.word}</p>
      <p className="vd-line">{model.why}</p>
      {model.action ? (
        <p className="rd-do">
          <span className="eyebrow">Šta da radiš</span>
          {model.action}
        </p>
      ) : null}
      <ul className="sigs">
        {model.signals.map((s, i) => (
          <li
            key={s.key}
            className={i === 0 && tone !== 'green' && tone !== 'neutral' ? 'top' : undefined}
          >
            <div className="sig-main">
              <b>
                {s.label}
                {i === 0 && tone !== 'green' && tone !== 'neutral' ? (
                  <span className="sr-only"> — odlučuje</span>
                ) : null}
              </b>
              {s.note ? <span>{s.note}</span> : null}
            </div>
            <div className="sig-side">
              {s.value ? <b className="num">{s.value}</b> : null}
              <StatusBadge tone={toBadge(s.tone)}>{s.state}</StatusBadge>
            </div>
          </li>
        ))}
      </ul>
      <p className="note-src">
        Odlučuje najlošiji signal; jedinstvenog „skora“ nema, jer svaki signal ima svoju granicu.
        {model.missing.length ? ` Nema podataka: ${model.missing.join(', ')}.` : ''}
      </p>
    </section>
  );
}

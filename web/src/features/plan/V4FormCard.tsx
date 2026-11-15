import { Disclosure } from '../../components/ui/Disclosure';
import { clock, formView, shortDate } from '../../integrations/v4';
import { useV4Live } from '../v4/useV4Live';

/* F9 korak 8 · KARTICA FORMA (F8 § 1, § 3): polazna forma, današnja procena iz trčanja, očekivano vreme i raspon na
   dan trke i „Zašto se promenilo". Samo kad se prikazuje plan iz V4; postojeći blokovi (`plan-warn`, `Disclosure`). */
const CONFIDENCE: Record<string, string> = {
  visoka: 'pouzdanost visoka — imaš trku ili test u poslednjih 6 nedelja',
  srednja: 'pouzdanost srednja — rezultat je stariji, treninzi ga potvrđuju',
  niska: 'pouzdanost niska — procena iz laganih trčanja; jedan test je menja'
};

export function V4FormCard() {
  const live = useV4Live();
  if (live === null) return null;
  const v = formView(live);
  return (
    <div className="plan-warn" id="v4-form">
      <Disclosure title={`Forma · ${v.distanceLabel}`} meta={clock(v.raceDay.expectedSec)} open>
        <p className="note-src" id="v4-form-today">
          Danas: {clock(v.today.timeSec)} ({CONFIDENCE[v.today.confidence] ?? v.today.confidence})
        </p>
        <p className="note-src" id="v4-form-race">
          Na dan trke: {clock(v.raceDay.expectedSec)} · raspon {clock(v.raceDay.lowSec)} –{' '}
          {clock(v.raceDay.highSec)}
        </p>
        <p className="note-src">
          Polazna forma: {clock(v.start.timeSec)} ({shortDate(v.start.asOf)})
        </p>
      </Disclosure>
      {v.why.length > 0 ? (
        <Disclosure title="Zašto se promenilo" meta={String(v.why.length)}>
          {v.why.map((x, i) => (
            <p className="note-src" key={`${x.date}:${i}`}>
              {shortDate(x.date)} — {x.reason}
            </p>
          ))}
        </Disclosure>
      ) : null}
    </div>
  );
}

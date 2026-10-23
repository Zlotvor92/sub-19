import { useState } from 'react';
import { Section } from '../../components/ui/primitives';
import { fmtClock } from '../../domain/format';
import { useTrainingStore } from '../../stores';
import { setMarathonV2TestResult, marathonV2TestSec } from '../../stores/marathonV2Actions';

/* REZULTAT TESTA 5 km (plan maratona v2, segment MAR-06, kopija obrasca HM v2): vreme same deonice testa (bez
   zagrevanja i hlađenja) upisuje se na unos odrađenog dana testa. To je činjenica za prilagođavanje: tempo plana se
   menja tek kroz Plan → Prilagodi plan (pregled i potvrda), od sledeće nedelje. */
export function MarathonV2TestResult({ dayId }: { dayId: string }) {
  const entry = useTrainingStore((s) => s.log[dayId]);
  const saved = marathonV2TestSec(entry);
  const [raw, setRaw] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const done = entry?.status === 'done';
  const save = (value: string): void => {
    const r = setMarathonV2TestResult(dayId, value);
    if (!r.ok) {
      setError(r.reason);
      setMessage('');
      return;
    }
    setError('');
    setRaw('');
    setMessage(
      r.sec === null
        ? 'Vreme testa je obrisano.'
        : `Upisano: 5 km za ${fmtClock(r.sec)}. Tempo plana menjaš u Plan → Prilagodi plan.`
    );
  };
  return (
    <Section title="Rezultat testa 5 km" id="v2-test-result">
      {saved !== null ? (
        <p className="prop-m" id="v2-test-saved">
          5 km: <b className="num">{fmtClock(saved)}</b>
        </p>
      ) : null}
      {done ? (
        <>
          <div className="f-field">
            <label htmlFor="v2-test-sec">Vreme 5 km (samo test, bez zagrevanja i hlađenja)</label>
            <input
              id="v2-test-sec"
              inputMode="numeric"
              placeholder="mm:ss"
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
            />
          </div>
          <div className="btnrow start">
            <button type="button" className="btn" onClick={() => save(raw)}>
              Sačuvaj vreme testa
            </button>
            {saved !== null ? (
              <button type="button" className="btn ghost" onClick={() => save('')}>
                Obriši vreme testa
              </button>
            ) : null}
          </div>
        </>
      ) : (
        <p className="note-src">Prvo upiši odrađen trening (km i vreme), pa ovde vreme 5 km.</p>
      )}
      <p className="note-src">
        Iz rezultata plan dobija tempo umesto procene: posle upisa otvori Plan → Prilagodi plan.
      </p>
      {error ? <p role="alert">{error}</p> : null}
      {message ? <p role="status">{message}</p> : null}
    </Section>
  );
}

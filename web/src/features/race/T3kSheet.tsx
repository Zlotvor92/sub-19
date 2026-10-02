import { useState } from 'react';
import { fmtClock, fmtDayLong, fmtNum, parseTimeStr } from '../../domain/format';
import { raceRefs } from '../../domain/race';
import { T3K_DIST_M, T3K_SEC_MIN } from '../../domain/training/constants/product';
import { t3kVdot } from '../../domain/training/test3k';
import { t3kPossible, t3kSlowest } from '../../domain/training/vdot/limits';
import { raceTimeForVdot } from '../../domain/training/vdot/racePrediction';
import { confirmAction } from '../../app/confirm';
import { useActiveGenPlan, useTrainingStore } from '../../stores';
import { addTest, editTest, removeTest } from '../../stores/raceActions';
import { useUIStore } from '../../stores/uiStore';

/* Granice se ČITAJU iz istog pravila po kome se i odlučuje, ne kucaju se ponovo u tekst: rečenica koja se raziđe sa proverom je gora
   od nikakve. Ista rečenica na oba mesta (živa provera i dugme). */
const rangeError = (): string =>
  `Vreme za 3 km mora biti između ${fmtClock(T3K_SEC_MIN)} i ${fmtClock(t3kSlowest())}. Brže od ${fmtClock(T3K_SEC_MIN)} je preko svetskog rekorda — proveri da nije omaška u kucanju.`;
const EMPTY = 'Unesi vreme pa se ispod prikaže šta znači.';

/* TEST NA 3 KM: živa provera — čovek mora da vidi šta je uneo PRE nego što sačuva, jer se iz ovog jednog broja forma pomera više nego
   iz bilo čega drugog. */
export function T3kSheet({ id, today }: { id: string | null; today: string }) {
  const existing = useTrainingStore((s) => (id ? s.t3k.find((x) => x && x.id === id) : undefined));
  const meta = useActiveGenPlan()?.meta;
  const closeSheet = useUIStore((s) => s.closeSheet);
  const [date, setDate] = useState(existing?.date ?? today);
  const [time, setTime] = useState(existing ? fmtClock(existing.sec) : '');
  if (id && !existing) return null;
  const refs = raceRefs(meta);
  const sec = parseTimeStr(time);
  const ok = sec != null && t3kPossible(sec);
  const out = ok
    ? (() => {
        const v = t3kVdot(sec) as number;
        return `Tempo ${fmtClock(Math.round(sec / 3))}/km · VDOT ${fmtNum(v, 1)} · predikcija ${fmtClock(Math.round(raceTimeForVdot(v, refs.raceDistM)))}`;
      })()
    : time.trim()
      ? rangeError()
      : EMPTY;

  const save = (): void => {
    if (sec == null || !ok) {
      window.alert(rangeError());
      return;
    }
    const d = date || today;
    if (id) editTest(id, d, sec);
    else addTest(d, sec, Math.random().toString(36).slice(2, 7));
    closeSheet();
  };

  return (
    <>
      <div className="sh-t">
        {id && existing ? `Test 3 km — ${fmtDayLong(existing.date)}` : 'Novi test na 3 km'}
      </div>
      <div className="sh-s">Vreme na {T3K_DIST_M} m, istrčano kao trka</div>
      <div className="f-grid">
        <div className="f-field">
          <label htmlFor="t3-date">Datum</label>
          <input type="date" id="t3-date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="f-field">
          <label htmlFor="t3-time">Vreme</label>
          <input
            type="text"
            inputMode="numeric"
            id="t3-time"
            placeholder="11:42"
            value={time}
            onChange={(e) => setTime(e.target.value)}
          />
        </div>
      </div>
      <div className="note-src" id="t3-out" role="status">
        {out}
      </div>
      <div className="btnrow">
        <button type="button" className="btn" onClick={save}>
          {id ? 'Sačuvaj izmenu' : 'Sačuvaj'}
        </button>
        {id ? (
          <button
            type="button"
            className="btn danger"
            onClick={() => {
              void confirmAction('Obrisati ovaj test? Forma se preračunava bez njega.').then(
                (yes) => {
                  if (!yes) return;
                  removeTest(id);
                  closeSheet();
                }
              );
            }}
          >
            Obriši test
          </button>
        ) : null}
      </div>
      <div className="note-src">
        Trči kao pravu trku, ali bez pritiska — cilj je tačna procena forme, ne rekord. Isti uslovi
        (staza, doba dana) daju uporediv rezultat.
      </div>
    </>
  );
}

import { useMemo, useState } from 'react';
import { fmtClock, fmtDayMonth, fmtKm } from '../../domain/format';
import { ScreenFrame } from '../../components/ui/Shell';
import { Row } from '../../components/ui/primitives';
import { dowShort } from '../../domain/format';
import { useResolvedPlan, useTrainingStore } from '../../stores';
import { useUIStore } from '../../stores/uiStore';
import { activityRows, SOURCE_TEXT } from './model';

const PAGE = 30;

/* SVE AKTIVNOSTI: istorija odrađenog, najnovije prvo, iz dnevnika koji aplikacija već vodi (ručni unosi + uvoz sa Strave i intervals.icu). Dodir otvara
   Detalje treninga tog dana (unos, analiza), a unos van plana (ručno uneta trka) otvara Analizu trke. */
export function ActivitiesScreen() {
  const plan = useResolvedPlan();
  const log = useTrainingStore((s) => s.log);
  const alts = useTrainingStore((s) => s.alts);
  const openScreen = useUIStore((s) => s.openScreen);
  const [shown, setShown] = useState(PAGE);
  const rows = useMemo(() => (plan ? activityRows(plan, log, alts) : []), [plan, log, alts]);
  if (!plan) return null;
  return (
    <ScreenFrame>
      <header className="screen-head">
        <h1>Sve aktivnosti</h1>
        <p>
          {rows.length ? `${rows.length} ${rows.length === 1 ? 'aktivnost' : 'aktivnosti'}` : ''}
        </p>
      </header>
      {rows.length ? (
        <>
          <div className="rows">
            {rows.slice(0, shown).map((a) => (
              <Row
                key={a.id}
                title={a.title}
                sub={
                  <>
                    {a.date
                      ? `${dowShort(a.date.slice(0, 10))} ${fmtDayMonth(a.date.slice(0, 10))} · `
                      : ''}
                    {[
                      a.km != null ? `${fmtKm(a.km)} km` : '',
                      a.paceSec != null ? `${fmtClock(a.paceSec)} /km` : '',
                      a.hr != null ? `${Math.round(a.hr)} bpm` : ''
                    ]
                      .filter(Boolean)
                      .join(' · ') || 'odrađeno'}
                    <br />
                    {SOURCE_TEXT[a.source]}
                  </>
                }
                onClick={() =>
                  a.dayId
                    ? openScreen({ kind: 'trening', props: { id: a.dayId } })
                    : openScreen({ kind: 'analiza-trke', props: { id: a.id } })
                }
              />
            ))}
          </div>
          {rows.length > shown ? (
            <div className="btnrow">
              <button
                type="button"
                className="btn ghost block"
                onClick={() => setShown(shown + PAGE)}
              >
                Prikaži starije
              </button>
            </div>
          ) : null}
        </>
      ) : (
        <p className="empty">
          Još nema odrađenih treninga. Kad završiš trening ili povežeš Stravu, pojaviće se ovde.
        </p>
      )}
    </ScreenFrame>
  );
}

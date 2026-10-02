import type { LogField } from '../../domain/day';
import type { ResolvedDay, ResolvedPlan } from '../../domain/plan';
import { requestPersist, useTrainingStore } from '../../stores';
import { editField, enterPace, predRowsForDay, storedRows } from '../../stores/dayActions';
import { EntryForm } from './EntryForm';

/* Forma za unos povezana sa store-ovima — ista na ekranu Danas i u listu dana u Planu. */
export function DayEntry({
  day,
  plan,
  today
}: {
  day: ResolvedDay;
  plan: ResolvedPlan;
  today: string;
}) {
  const entry = useTrainingStore((s) => s.log[day.id]);
  const pred = useTrainingStore((s) => s.pred);
  const alts = useTrainingStore((s) => s.alts);
  const vdotLog = useTrainingStore((s) => s.vdotLog);
  return (
    <EntryForm
      key={day.id}
      day={day}
      entry={entry}
      today={today}
      rows={predRowsForDay(plan, day, storedRows())}
      pred={pred}
      alts={alts}
      vdotLog={vdotLog}
      onField={(f: LogField, raw) => editField(day, f, raw, today)}
      onPace={(id, raw) => void enterPace(day, id, raw)}
      onBlur={() => requestPersist('now')}
    />
  );
}

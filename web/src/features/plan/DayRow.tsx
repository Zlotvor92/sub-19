import { fmtClock, fmtKm } from '../../domain/format';
import { dayLabel, type ResolvedDay } from '../../domain/plan';
import type { AltRecord, LogEntry } from '../../domain/state';
import { Icon } from '../../components/ui/icons';
import { dayOfMonth, dowLong, dowLongCap } from '../../lib/dates';
import { sessionView } from '../session/sessionModel';

export type DayRowState = 'done' | 'skip' | 'miss' | 'today' | 'next' | 'rest';

/** Stanje dana za prikaz: završen, preskočen, propušten (prošao, nije odrađen), današnji, predstojeći ili odmor. */
export function dayRowState(
  day: ResolvedDay,
  entry: LogEntry | undefined,
  today: string
): DayRowState {
  if (day.rest) return day.date === today ? 'today' : 'rest';
  if (entry?.status === 'done') return 'done';
  if (entry?.status === 'skip') return 'skip';
  if (day.date === today) return 'today';
  if (day.date && day.date < today) return 'miss';
  return 'next';
}

const STATE_TEXT: Partial<Record<DayRowState, string>> = {
  done: 'završeno',
  skip: 'preskočeno',
  miss: 'nije odrađeno'
};

/**
 * RED DANA: dan i datum levo, vrsta treninga i ono što o njemu treba znati u sredini, stanje desno. Završen = kvačica, preskočen = oznaka preskoka,
 * propušten = reč, današnji = istaknut red, budući = strelica. Odmor je tih (bez strelice). Ceo red je dugme (≥ 60 px) koje otvara Detalje treninga.
 */
export function DayRow({
  day,
  entry,
  alt,
  today,
  easyPaceSec,
  onOpen
}: {
  day: ResolvedDay;
  entry: LogEntry | undefined;
  alt: AltRecord | undefined;
  today: string;
  easyPaceSec: number | null;
  onOpen: () => void;
}) {
  const state = dayRowState(day, entry, today);
  const isToday = day.date === today;
  const title = day.rest ? 'Odmor' : dayLabel(day, !!alt);
  const view = day.rest ? null : sessionView(day, { alt, easyPaceSec });
  const parts: string[] = [];
  /* Struktura sesije („6×1000 m @ 4:10/km“) je ono što čovek traži u listi nedelje; ostalo (km, stanje) ide posle nje. */
  const core = view?.rows && view.core && view.core !== title ? view.core : null;
  if (core) parts.push(core);
  if (!day.rest && day.km != null) parts.push(`${fmtKm(day.km)} km`);
  const stateText = STATE_TEXT[state];
  if (stateText) parts.push(stateText);
  else if (!core && view?.paceSec != null) parts.push(`${fmtClock(view.paceSec)} /km`);
  else if (day.rest && day.desc) parts.push(day.desc.split('\n')[0] ?? '');
  const quiet = state === 'rest' || state === 'miss';
  return (
    <button
      type="button"
      className={`row plan-row s-${state}${isToday ? ' is-today' : ''}`}
      onClick={onOpen}
      aria-current={isToday ? 'date' : undefined}
    >
      <span className="pr-d">
        <span className="pr-dow">
          {isToday ? (
            <>
              Danas<span aria-hidden="true"> • </span>
              <span className="sr-only">, </span>
              {dowLong(day.date)}
            </>
          ) : day.date ? (
            dowLongCap(day.date)
          ) : (
            'Test'
          )}
        </span>
        {day.date ? <span className="pr-num num">{dayOfMonth(day.date)}</span> : null}
      </span>
      <span className="pr-m">
        <span className={`pr-t${quiet ? ' quiet' : ''}`}>
          {day.test ? 'Test 3 km (opciono)' : title}
        </span>
        {parts.length ? <span className="pr-s">{parts.join(' · ')}</span> : null}
      </span>
      <span className="pr-end" aria-hidden="true">
        {state === 'done' ? (
          <span className="tick">
            <Icon name="check" size={16} strokeWidth={2.6} />
          </span>
        ) : state === 'skip' ? (
          <Icon name="skip" size={18} />
        ) : (
          <Icon name="chevron" size={18} />
        )}
      </span>
    </button>
  );
}

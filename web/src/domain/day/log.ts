/* UNOS U DNEVNIK TRENINGA: polja forme → `LogEntry`, i izvedeni zapisi o bolu/težini.

   Pravila iz starog `bindForm`:
   - km i kg: decimalni zarez; ne-broj postaje `null` (ne nula);
   - vreme: `parseTimeStr` („4233" = 42:33);
   - RUČNA KOREKCIJA IMA TRAJNU PREDNOST: trčanje uvezeno sa Strave/icu-a, pa ručno izmenjeno u km/vreme/puls, dobija `lock` i
     sinhronizacija ga više ne prepisuje;
   - bol (`knee`) i težina (`kg`) uneti uz trening se izvode u zasebne zapise (`kt-<dan>` / `src: <dan>`), da se vide u oporavku. */

import { leadingNumber } from '../lib/number';
import { fmtClock, parseTimeStr } from '../format';
import type { ResolvedDay } from '../plan/types';
import type { LogEntry, PainRecord, WeightRecord } from '../state/types';

export type LogField = 'km' | 'sec' | 'hr' | 'rpe' | 'knee' | 'kg' | 'ts' | 'note';

const finite = (n: number): boolean => Number.isFinite(n);

/** Novo stanje zapisa posle izmene jednog polja forme. `raw` je tekst iz polja. */
export function applyLogField(
  entry: LogEntry | undefined,
  field: LogField,
  raw: string,
  fallbackStatus: string
): LogEntry {
  const l: LogEntry = entry ? { ...entry } : { status: fallbackStatus };
  const v = raw.trim();
  if (field === 'km' || field === 'kg') {
    const n = leadingNumber(v.replace(',', '.'));
    l[field] = v !== '' && finite(n) ? n : null;
  } else if (field === 'sec') {
    l.sec = parseTimeStr(v);
  } else if (field === 'hr') {
    const n = parseInt(v, 10);
    l.hr = finite(n) ? n : null;
  } else if (field === 'rpe' || field === 'knee') {
    // Legacy je upisivao NaN (koji JSON pretvara u null); ovde odmah null.
    const n = +raw;
    l[field] = raw === '' || !finite(n) ? null : n;
  } else if (field === 'ts') {
    if (raw) l.ts = raw;
  } else {
    l.note = raw;
  }
  if (l['src'] === 'strava' && (field === 'km' || field === 'sec' || field === 'hr')) l.lock = true;
  return l;
}

/** Prosečan tempo (s/km) iz upisanog; `null` bez km ili vremena. */
export const averagePace = (l: Pick<LogEntry, 'km' | 'sec'> | undefined): number | null =>
  l && l.km && l.sec ? l.sec / l.km : null;

/**
 * Bol i težina uneti uz trening → zapisi u oporavku. Stari zapisi tog dana se zamenjuju; sortira se po datumu. Vraća NOVE nizove.
 */
export function syncSideRecords(
  knee: readonly PainRecord[],
  kg: readonly WeightRecord[],
  day: Pick<ResolvedDay, 'id' | 'date' | 'km'>,
  l: LogEntry | undefined,
  today: string
): { knee: PainRecord[]; kg: WeightRecord[] } {
  if (!l) return { knee: [...knee], kg: [...kg] };
  const kid = `kt-${day.id}`;
  const date = (typeof l.ts === 'string' && l.ts) || day.date || today;
  const k = knee.filter((x) => x.id !== kid);
  if (l['knee'] != null)
    k.push({
      id: kid,
      src: day.id,
      date,
      act: day.km != null ? 'Trčanje' : 'Snaga',
      pain: l['knee'] as number,
      note: (typeof l.note === 'string' && l.note) || ''
    });
  const w = kg.filter((x) => x.src !== day.id);
  if (l['kg'] != null) w.push({ date, kg: l['kg'] as number, src: day.id });
  const byDate = (a: { date: string }, b: { date: string }): number => (a.date < b.date ? -1 : 1);
  return { knee: k.sort(byDate), kg: w.sort(byDate) };
}

/** Dugmad „Završi / Preskoči / Vrati": status, a pri završetku i datum trčanja (ako ga nema). */
export function setDayStatus(
  entry: LogEntry | undefined,
  status: 'done' | 'skip' | 'pending',
  dayDate: string | undefined,
  today: string
): LogEntry {
  const l: LogEntry = { ...(entry ?? {}), status };
  if (status === 'done' && !l.ts) l.ts = dayDate || today;
  return l;
}

/** Tekst polja za prikaz u formi (obrnuto od `applyLogField`): decimalni zarez, vreme kao m:ss. */
export function fieldText(entry: LogEntry | undefined, field: LogField, fallbackDate = ''): string {
  const l = entry;
  if (field === 'km' || field === 'kg') {
    const v = l?.[field];
    return typeof v === 'number' || typeof v === 'string' ? String(v).replace('.', ',') : '';
  }
  if (field === 'sec') return l?.sec ? fmtClock(l.sec) : '';
  if (field === 'hr' || field === 'rpe' || field === 'knee') {
    const v = l?.[field];
    return typeof v === 'number' || typeof v === 'string' ? String(v) : '';
  }
  if (field === 'ts') return l?.ts || fallbackDate;
  return typeof l?.note === 'string' ? l.note : '';
}

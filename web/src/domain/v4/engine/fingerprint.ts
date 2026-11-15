/* V4 — KANONSKA SERIJALIZACIJA I OTISAK (SPEC § 6.1, § 9.2). */
import { doneIds } from './done';
import { paceCtxOf, summarize } from './load';
import type { FingerprintFn, JsonValue, PlanDoc } from './types';

function sortKeys(value: unknown): JsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (Array.isArray(value)) return value.map(sortKeys);
  if (typeof value === 'object') {
    const out: { [key: string]: JsonValue } = {};
    for (const key of Object.keys(value).sort()) {
      const item: unknown = (value as Record<string, unknown>)[key];
      if (item !== undefined) out[key] = sortKeys(item);
    }
    return out;
  }
  return null;
}

/** JSON sa stalnim redosledom ključeva: isti podatak → isti bajtovi. */
export function canonical(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

export function serializePlan(doc: PlanDoc): string {
  return canonical(doc);
}

const flag = (on: boolean, word: string): string => (on ? word : '-');

/** Otisak plana (§ 9.2): red po danu, hronološki. Preuzimanje ne sme da ga promeni. */
export const fingerprint: FingerprintFn = (doc, facts) => {
  const ctx = paceCtxOf(doc.header);
  const done = doneIds(facts.runs);
  const days = doc.weeks
    .flatMap((w) => w.days)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return days
    .map((day) =>
      [
        day.date,
        day.workout === null ? 'odmor' : 'trening',
        day.workout?.kind ?? '-',
        summarize(day.workout, ctx).km.toFixed(1),
        day.workout?.text ?? '',
        flag(done.has(day.id), 'urađeno'),
        flag(day.locked, 'zaključano'),
        flag(day.origin === 'manual', 'ručno')
      ].join(' | ')
    )
    .join('\n');
};

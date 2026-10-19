/** Plan-only revisions. Actual execution, measured predictions and service credentials stay
 * in PersistedState and must never travel into these snapshots. Dates are injected by callers. */
import { isIsoDate } from '../date';
import { isValidGenPlan, type GenPlanState } from '../state';

export type PlanRevisionReason = 'goal' | 'fitness' | 'execution' | 'pace' | 'restore';
export interface PlanRevision {
  id: string;
  reason: PlanRevisionReason;
  date: string;
  summary: string;
  snapshot: GenPlanState;
}
export interface PlanRevisionDetails {
  reason: PlanRevisionReason;
  date: string;
  summary: string;
}

export const PLAN_REVISION_LIMIT = 5;
const HISTORY = 'planRevisions';
const COUNTER = 'planRevisionCounter';
const REASONS: readonly string[] = ['goal', 'fitness', 'execution', 'pace', 'restore'];
/** 08b: `fiveKV2` (plan 5K v2 doslovno) je deo definicije plana v2 — bez njega se sačuvana verzija ne može vratiti.
 *  Isto `tenKV2` (10K v2, segment 05) i `hmV2` (HM v2, segment HM-05). Planovi bez polja (svi ostali) se kopiraju kao
 *  ranije. */
const PLAN_FIELDS = ['weeks', 'pred', 'qs', 'meta', 'ulaz', 'fiveKV2', 'tenKV2', 'hmV2'] as const;
const MAX_COUNTER = 1_000_000_000;

const object = (value: unknown): value is Record<string, unknown> =>
  value !== null &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);

/** Bounded JSON clone, without invoking getters/toJSON or retaining input references. */
function cloneJson(value: unknown, maxChars = 250_000): unknown {
  let nodes = 0;
  let chars = 0;
  const ancestors = new Set<object>();
  const visit = (v: unknown, depth: number): unknown => {
    if (++nodes > 30_000 || depth > 32) throw new RangeError('Plan je prevelik.');
    if (v === null || typeof v === 'boolean') return v;
    if (typeof v === 'number') {
      if (!Number.isFinite(v)) throw new RangeError('Neispravan broj u planu.');
      return v;
    }
    if (typeof v === 'string') {
      chars += v.length;
      if (chars > maxChars) throw new RangeError('Plan je prevelik.');
      return v;
    }
    if (!Array.isArray(v) && !object(v)) throw new TypeError('Plan mora biti JSON podatak.');
    if (ancestors.has(v)) throw new TypeError('Plan sadrži kružnu referencu.');
    ancestors.add(v);
    let result: unknown;
    if (Array.isArray(v)) {
      if (v.length > 4096) throw new RangeError('Niz u planu je prevelik.');
      result = Array.from({ length: v.length }, (_, i) => {
        const d = Object.getOwnPropertyDescriptor(v, String(i));
        if (d && !('value' in d)) throw new TypeError('Plan ne sme sadržati getter.');
        return d?.value === undefined ? null : visit(d.value, depth + 1);
      });
    } else {
      const keys = Object.keys(v);
      if (keys.length > 4096) throw new RangeError('Objekat u planu je prevelik.');
      const out: Record<string, unknown> = {};
      for (const key of keys) {
        chars += key.length;
        if (chars > maxChars) throw new RangeError('Plan je prevelik.');
        const d = Object.getOwnPropertyDescriptor(v, key);
        if (!d || !('value' in d)) throw new TypeError('Plan ne sme sadržati getter.');
        if (d.value !== undefined)
          Object.defineProperty(out, key, {
            value: visit(d.value, depth + 1),
            enumerable: true,
            writable: true,
            configurable: true
          });
      }
      result = out;
    }
    ancestors.delete(v);
    return result;
  };
  return visit(value, 0);
}

/** Only the plan definition is copied; nested extension fields remain JSON-compatible. */
function snapshotOf(value: unknown): GenPlanState | null {
  if (!object(value)) return null;
  try {
    const selected: Record<string, unknown> = {};
    for (const field of PLAN_FIELDS) {
      const d = Object.getOwnPropertyDescriptor(value, field);
      if (d && !('value' in d)) return null;
      if (d?.value !== undefined) selected[field] = d.value;
    }
    const cloned = cloneJson(selected);
    if (!object(cloned)) return null;
    const weeks = cloned['weeks'];
    const pred = cloned['pred'];
    if (!Array.isArray(weeks) || weeks.length > 128 || !Array.isArray(pred)) return null;
    if (
      weeks.some(
        (week) =>
          !object(week) ||
          !Number.isInteger(week['w']) ||
          typeof week['focus'] !== 'string' ||
          typeof week['deload'] !== 'boolean' ||
          !Array.isArray(week['days']) ||
          week['days'].length > 14
      )
    )
      return null;
    return isValidGenPlan(cloned) ? cloned : null;
  } catch {
    return null;
  }
}

function revisionSequence(id: string): number {
  const n = Number(/^r(\d+)-/.exec(id)?.[1]);
  return Number.isSafeInteger(n) && n > 0 && n <= MAX_COUNTER ? n : 0;
}

/** Old clients/plans need no migration. Corrupt, recursive and oversized entries are ignored.
 * Returned revisions are oldest first and are independent copies, safe for preview callers. */
export function getPlanRevisions(current: unknown): PlanRevision[] {
  if (!object(current)) return [];
  const d = Object.getOwnPropertyDescriptor(current, HISTORY);
  if (!d || !('value' in d)) return [];
  const raw: unknown = d.value;
  if (!Array.isArray(raw) || raw.length > 1000) return [];
  const result: PlanRevision[] = [];
  const ids = new Set<string>();
  // A bounded tail scan avoids unbounded validation of imported history.
  for (let i = raw.length - 1; i >= Math.max(0, raw.length - 20); i--) {
    const itemDescriptor = Object.getOwnPropertyDescriptor(raw, String(i));
    if (!itemDescriptor || !('value' in itemDescriptor)) continue;
    const item: unknown = itemDescriptor.value;
    if (!object(item)) continue;
    const read = (key: string): unknown => {
      const descriptor = Object.getOwnPropertyDescriptor(item, key);
      return descriptor && 'value' in descriptor ? descriptor.value : undefined;
    };
    const id = read('id');
    const reason = read('reason');
    const date = read('date');
    const summary = read('summary');
    if (
      typeof id !== 'string' ||
      id.length > 100 ||
      !revisionSequence(id) ||
      ids.has(id) ||
      typeof reason !== 'string' ||
      !REASONS.includes(reason) ||
      !isIsoDate(date) ||
      typeof summary !== 'string' ||
      !summary.trim() ||
      summary.length > 500
    )
      continue;
    const snapshot = snapshotOf(read('snapshot'));
    if (!snapshot) continue;
    ids.add(id);
    result.unshift({ id, reason: reason as PlanRevisionReason, date, summary, snapshot });
    if (result.length === PLAN_REVISION_LIMIT) break;
  }
  return result;
}

function detailsValid(details: PlanRevisionDetails): boolean {
  return (
    REASONS.includes(details.reason) &&
    isIsoDate(details.date) &&
    typeof details.summary === 'string' &&
    details.summary.trim().length > 0 &&
    details.summary.length <= 500
  );
}

function summaryHash(details: PlanRevisionDetails): string {
  let hash = 2166136261;
  for (const character of `${details.reason}|${details.date}|${details.summary}`)
    hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  return (hash >>> 0).toString(36);
}

/** Records BEFORE as a revision of AFTER. Does not modify either input or execution history.
 * Invalid caller metadata throws; an unusable old plan simply cannot provide a snapshot. */
export function recordPlanRevision(
  before: GenPlanState,
  after: GenPlanState,
  details: PlanRevisionDetails
): GenPlanState {
  if (!detailsValid(details)) throw new RangeError('Neispravni podaci o verziji plana.');
  const afterFields: Record<string, unknown> = {};
  for (const key of Object.keys(after)) {
    if (key === HISTORY || key === COUNTER) continue;
    const d = Object.getOwnPropertyDescriptor(after, key);
    if (!d || !('value' in d)) throw new TypeError('Plan ne sme sadržati getter.');
    Object.defineProperty(afterFields, key, { ...d });
  }
  const next = cloneJson(afterFields, 1_000_000) as GenPlanState;
  const history = getPlanRevisions(before);
  const rawCounter = Object.getOwnPropertyDescriptor(before, COUNTER)?.value as unknown;
  const previousCounter =
    typeof rawCounter === 'number' &&
    Number.isSafeInteger(rawCounter) &&
    rawCounter >= 0 &&
    rawCounter < MAX_COUNTER
      ? rawCounter
      : 0;
  const sequence = Math.max(previousCounter, ...history.map((r) => revisionSequence(r.id))) + 1;
  const snapshot = snapshotOf(before);
  if (snapshot && sequence <= MAX_COUNTER) {
    history.push({
      id: `r${sequence}-${details.date}-${summaryHash(details)}`,
      reason: details.reason,
      date: details.date,
      summary: details.summary,
      snapshot
    });
    next[COUNTER] = sequence;
  } else next[COUNTER] = previousCounter;
  next[HISTORY] = history.slice(-PLAN_REVISION_LIMIT);
  return next;
}

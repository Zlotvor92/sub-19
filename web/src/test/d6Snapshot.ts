/** D6 intentionally changes generated workouts. Record complete new outputs, while
 * legacy oracle inputs remain frozen; independent invariants check the new rules. */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect } from 'vitest';
import { canonical, shaOf } from './fingerprint';

export function d6Snapshot(group: string, key: string, value: unknown): void {
  const file = fileURLToPath(new URL(`./fixtures/d6-${group}.json`, import.meta.url));
  const rows = (existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {}) as Record<
    string,
    string
  >;
  const sha = shaOf(canonical(JSON.parse(JSON.stringify(value))));
  if (process.env['UPDATE_FINGERPRINT'] === '1') {
    rows[key] = sha;
    writeFileSync(file, JSON.stringify(rows, null, 2) + '\n');
  } else expect(sha, `D6 ${group}: ${key}`).toBe(rows[key]);
}

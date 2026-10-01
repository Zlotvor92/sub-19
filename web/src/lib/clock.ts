/* SAT. Domen ne čita sat; ovde je jedino mesto gde se „danas" izvodi iz pregledača. */

const pad2 = (n: number): string => String(n).padStart(2, '0');

/** LOKALNI kalendarski datum (`YYYY-MM-DD`), ne UTC: `toISOString()` posle ponoći po lokalnom vremenu daje juče. */
export function localDate(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Milisekunde do prve sekunde posle sledeće ponoći (lokalno). */
export function msUntilMidnight(now: Date = new Date()): number {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1);
  return Math.max(1000, next.getTime() - now.getTime());
}

/* Prva putanja na kojoj se dva JSON-oblika razlikuju — za čitljive poruke u diferencijalnim testovima
   (poređenje celog plana kroz `toBe` ispisuje desetine hiljada znakova). */
export function firstDiff(a: unknown, b: unknown, path = ''): string | null {
  if (JSON.stringify(a) === JSON.stringify(b)) return null;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) {
    return `${path}: ${JSON.stringify(a)} ≠ ${JSON.stringify(b)}`;
  }
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) {
    const d = firstDiff(
      (a as Record<string, unknown>)[k],
      (b as Record<string, unknown>)[k],
      `${path}/${k}`
    );
    if (d) return d;
  }
  return `${path}: oblik se razlikuje`;
}

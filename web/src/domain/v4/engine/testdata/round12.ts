/* KRUG 12 — opšte provere motora nad scenarijima (podatke daje distanca). */
/* eslint-disable @typescript-eslint/no-explicit-any,
   @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment -- scenariji su netipizovani */

/** M1: kad se tempa plana promene, izmena to kaže (stavka „tempa" u zaglavlju) — nema „PROMENA: 0" uz nova tempa. */
export function pacesAnnounced(label: string, r: any): string[] {
  const p0 = r.before.header.paces;
  const p1 = r.after.header.paces;
  const same = p0.byFeel === p1.byFeel && p0.T === p1.T && p0.RP === p1.RP;
  if (same) return [];
  const told = (r.changes as any[]).some((c) => c.scope === 'zaglavlje' && c.what === 'tempa');
  return told ? [] : [`${label}: tempa promenjena bez rečenice`];
}

/** M2: najteža nedelja do trke (pre sužavanja) posle prekida je spuštena, ne obrisana — obim ≥ 80 % i ≤ prvobitnog.
    Takva nedelja nije „skok" povratka (R2), nego namerno zadržan vrh. `origKms` su km prvobitnih nedelja. */
export function keptPeak(
  origKms: readonly number[],
  kinds: readonly string[],
  i: number,
  base: number,
  km: number
): boolean {
  const orig = origKms[i];
  if (orig === undefined) return false;
  const span = origKms.filter(
    (_, k) =>
      k >= Math.max(base, i) &&
      kinds[k] !== 'taper' &&
      kinds[k] !== 'race' &&
      k < origKms.length - 1
  );
  if (span.length === 0 || orig < 0.95 * Math.max(...span)) return false;
  return km >= 0.8 * orig - 0.5 && km <= orig + 0.5;
}

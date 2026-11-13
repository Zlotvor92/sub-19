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

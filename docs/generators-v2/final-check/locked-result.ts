// Organizator (MAR-07b): nov rezultat (faster/slower) kraj nedelje k + zaključan prvi dan kvaliteta nedelje k+1 → odbijanje? Iz web/: node ../docs/generators-v2/final-check/locked-result.ts [5K|10K|HM|MAR]
import { DISTS } from "/home/user/sub-19/docs/generators-v2/final-check/lib.ts";
const only = process.argv[2];
for (const d of DISTS) {
  if (only && d.name !== only) continue;
  const all = d.all(); let n = 0, rej = 0; const codes: Record<string, number> = {}; const ex: string[] = [];
  for (const [i, b] of all.entries()) {
    if (i % 151 !== 0) continue;
    const g: any = d.generate(b.input); if (!g.ok || g.plan.vdot == null) continue; const p = g.plan; const N = p.weeks.length;
    for (let k = 1; k < N - 3; k += 2) {
      const at = p.weeks[k].endDate; const next = p.weeks[k + 1];
      const q = next.days.find((x: any) => x.role === 'q1' || (x.hard && !['long', 'race', 'test'].includes(x.role)));
      if (!q) continue;
      for (const s of ['faster', 'slower'] as const) {
        const f: any = d.facts(p, s as any, at); f.lockedDayIds = [q.date];
        const a: any = d.adapt(p, f, at); n++;
        if (!a.ok) { rej++; for (const x of a.reasons) { const c = x.message.slice(0, 50); codes[c] = (codes[c] ?? 0) + 1; } if (ex.length < 2) ex.push(`${b.id} ${s} asOf ${at} lock ${q.date}`); }
      }
    }
  }
  console.log(d.name, { tokova: n, odbijeno: rej }, Object.entries(codes).slice(0, 3)); for (const e of ex) console.log('  ', e);
}

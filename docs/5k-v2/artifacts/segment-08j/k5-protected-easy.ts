import { addDays, distOf, SCENARIOS, sampleBases, wedOf } from "/home/user/sub-19/docs/generators-v2/final-check/lib.ts";
import { mergeFacts } from "/home/user/sub-19/docs/generators-v2/final-check/pre-lib.ts";
const d = distOf('5K');
const { bases } = sampleBases(d, { R: 30, F: 30, B: 20 });
let n = 0, prot = 0, other = 0; const ex: string[] = [];
for (const [bi, b] of bases.entries()) {
  const g: any = d.generate(b.input); if (!g.ok) continue; const p = g.plan; const N = p.weeks.length;
  const opts: [string, string][] = [["w2wed", wedOf(p.weeks[1].startDate)], ["w3end", p.weeks[2].endDate], ["m", wedOf(p.weeks[Math.floor(N / 2) - 1].startDate)], ["e", p.weeks[N - 5].endDate]];
  const [, at] = opts[bi % 4]!;
  for (const s1 of SCENARIOS) {
    const f1 = d.facts(p, s1, at); const r1: any = d.adapt(p, f1, at); if (!r1.ok) continue;
    for (const off of [3, 7]) {
      const at2 = addDays(at, off); if (at2 >= p.input.raceDate) continue;
      for (const s2 of SCENARIOS) { if (s2 === s1) continue;
        const f = mergeFacts(f1, d.facts(r1.plan, s2, at2)); const r2: any = d.adapt(r1.plan, f, at2); if (!r2.ok) continue;
        const locked = new Set((f as any).lockedDayIds ?? []);
        for (const w of r2.plan.weeks) {
          const fut = w.days.filter((x: any) => x.date > at2); const long = fut.find((x: any) => x.role === 'long'); if (!long) continue;
          const bad = fut.filter((x: any) => x.role === 'easy' && x.workout.km > long.workout.km + 1e-6);
          if (!bad.length) continue; n++;
          if (bad.every((x: any) => locked.has(x.date))) prot++; else { other++; if (ex.length < 5) ex.push(`${b.id} ${s1}+${off}/${s2} w${w.index}`); }
        }
      }
    }
  }
}
console.log({ weeks: n, protectedEasy: prot, other, ex });

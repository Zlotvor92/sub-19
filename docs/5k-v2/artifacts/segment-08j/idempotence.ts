import { earlyFacts, earlyGridBases } from '/home/user/sub-19/web/src/domain/generators/fiveK/v2/testInputs.ts';
import { generateFiveKV2 } from '/home/user/sub-19/web/src/domain/generators/fiveK/v2/generate.ts';
import { adaptFiveKV2 } from '/home/user/sub-19/web/src/domain/generators/fiveK/v2/adapt.ts';
import { addDays, mustDay } from '/home/user/sub-19/web/src/domain/generators/fiveK/v2/dates.ts';
const S1 = ['under50', 'over120', 'pause10', 'pause20', 'pause35', 'chain', 'painPause'];
let n = 0, rej = 0, tgt = 0, days = 0, wk = 0; const ex: string[] = [];
const bases = earlyGridBases().filter((_, i) => i % 4 === 0);
for (const [bi, b] of bases.entries()) {
  const p: any = (generateFiveKV2(b.input) as any).plan; const N = p.weeks.length;
  const ats = [p.weeks[1].startDate, p.weeks[2].endDate, p.weeks[Math.floor(N / 2) - 1].startDate, p.weeks[N - 5].endDate];
  const at = ats[bi % 4];
  for (const s1 of S1) {
    const f1 = earlyFacts(p, s1 as any, at); const r1: any = adaptFiveKV2(p, f1, at); if (!r1.ok) continue;
    for (const off of [3, 7]) {
      const at2 = addDays(at, off); if (at2 >= p.input.raceDate) continue;
      const r2: any = adaptFiveKV2(r1.plan, f1, at2); n++;
      if (!r2.ok) { rej++; continue; }
      const after = (pl: any) => pl.weeks.filter((w: any) => mustDay(w.startDate) > mustDay(at2));
      const A = after(r1.plan), B = after(r2.plan);
      if (JSON.stringify(A.map((w: any) => w.targetKm)) !== JSON.stringify(B.map((w: any) => w.targetKm))) { tgt++; if (ex.length < 4) ex.push(`T ${b.id} ${s1} ${at} +${off}`); }
      if (JSON.stringify(A.map((w: any) => w.days)) !== JSON.stringify(B.map((w: any) => w.days))) { days++; if (ex.length < 8) ex.push(`D ${b.id} ${s1} ${at} +${off}`); }
      if (JSON.stringify(A) !== JSON.stringify(B)) { wk++; if (ex.length < 3) ex.push(`W ${b.id} ${s1} ${at} +${off}`); }
    }
  }
}
console.log({ plans: bases.length, n, rej, tgt, days, wk, ex });

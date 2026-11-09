/* P1-STOP K6 — potrebno sniženje cilja da nedelja B stane (week.ts oznaka P1GAP iz s1s2-wip.patch). Iz web/: P1_DEBUG_GAP=1 P1_EXP_MAIN=1 node ../docs/generators-v2/perfection/P1/gap.ts */
import { grid } from "../P0/common.ts";
import { generateHmV2 } from "../../../../web/src/domain/generators/halfMarathon/v2/generate.ts";
const orig = console.log; const gaps: Record<string, number[]> = {}; let none = 0;
for (const c of grid("HM")) {
  const lines: string[] = []; console.log = (m: string) => { lines.push(m); };
  const r = generateHmV2(c.input); console.log = orig; if (!r.ok) continue;
  for (const w of r.plan.weeks) {
    const l = lines.filter((x) => x.startsWith(`P1GAP ${w.index} t${Math.round(w.targetKm * 10)} `)).pop();
    if (!l) continue; const g = l.split("gap")[1]!;
    if (g === "none") { none++; continue; }
    (gaps[`${c.family} d${c.days}`] ??= []).push(Number(g) / 10);
  }
}
for (const [k, v] of Object.entries(gaps)) { const s = v.sort((a, b) => a - b); orig(`${k}: n ${s.length}, potrebno sniženje cilja [km] medijana ${s[Math.floor(s.length / 2)]}, max ${s[s.length - 1]}`); }
orig(`bez izvodljivog cilja: ${none}`);

/* Ugao 4 (jedan vlasnik), HM — dve provere iste stvari na strani provere: validate.ts (validator jezgra) i
   adaptInvariants.ts (nezavisna invarijanta testova adaptacije). Razlike u definiciji:
   (a) „nedelja < minimum": validator izuzima nedelju sa danima bola ILI odmora (validate.ts:607, 622–627 →
       WEEK_MIN_LIMITS upozorenje); adaptInvariants izuzima samo dane odmora (adaptInvariants.ts:119).
   (b) „povratni rast": adaptInvariants.ts:343 redovan rast početnika = min(40, max(10, 5 %)) [0,1 km]; vlasnik
       volume.growth10 + planRule (početnik growthMaxKm 2,0 → 20).
   Tokovi: planovi rane mreže (adaptInputs.earlyBases, svaki STRIDE-ti) × asOf rane mreže (earlyAsOfs) × bol 5/8,
   pauza 10 + bol 5, i lanac bol 5 → bol 5 sedam dana kasnije. Bez slučajnosti.
   Pokretanje iz web/: node ../docs/generators-v2/audit/owner/hm-inv-vs-val.ts [r f b] */
import { adaptHmV2 } from '../../../../web/src/domain/generators/halfMarathon/v2/adapt.ts';
import { generateHmV2 } from '../../../../web/src/domain/generators/halfMarathon/v2/generate.ts';
import { adaptInvariants } from '../../../../web/src/domain/generators/halfMarathon/v2/adaptInvariants.ts';
import { earlyAsOfs, earlyBases, earlyFacts } from '../../../../web/src/domain/generators/halfMarathon/v2/adaptInputs.ts';
import { addDays } from '../../../../web/src/domain/generators/halfMarathon/v2/dates.ts';
import { growth10 } from '../../../../web/src/domain/generators/halfMarathon/v2/volume.ts';
import { planRule } from '../../../../web/src/domain/generators/halfMarathon/v2/policy.ts';

const [r, f, b] = (process.argv.slice(2).length === 3 ? process.argv.slice(2) : ['8', '8', '4']).map(Number);
const bases = earlyBases({ r: r!, f: f!, b: b! });
let flows = 0, ok = 0;
const cnt: Record<string, number> = {};
const ex: Record<string, string> = {};
const add = (k: string, e: string) => { cnt[k] = (cnt[k] ?? 0) + 1; ex[k] ??= e; };
for (const base of bases) {
  const g: any = generateHmV2(base.input);
  if (!g.ok) continue;
  for (const { tag, asOf } of earlyAsOfs(g.plan)) {
    for (const s of ['pain5', 'pain8', 'pause10pain5'] as const) {
      const facts = earlyFacts(g.plan, s, asOf);
      const a: any = adaptHmV2(g.plan, facts, asOf);
      flows++;
      if (!a.ok) { add(`odbijeno:${s}`, `${base.id} ${tag} ${asOf}`); continue; }
      ok++;
      let plan = a.plan, before = g.plan, at = asOf, fx: any = facts;
      // lanac: isti bol ponovo posle 7 dana
      const asOf2 = addDays(asOf, 7);
      if (asOf2 < g.plan.input.raceDate) {
        const f2 = earlyFacts(a.plan, 'pain5', asOf2);
        const a2: any = adaptHmV2(a.plan, f2, asOf2);
        flows++;
        if (a2.ok) { ok++; checkPair(base.id, `${tag}+7`, a.plan, a2.plan, asOf2, f2); }
      }
      checkPair(base.id, tag, before, plan, at, fx);
    }
  }
}
function checkPair(id: string, tag: string, before: any, after: any, asOf: string, facts: any) {
  const inv = adaptInvariants(before, after, asOf, facts);
  const minBad = inv.filter((x) => x.startsWith('nedelja < minimum'));
  for (const m of minBad) {
    const wi = Number(m.split('ned ')[1]);
    const w = after.weeks[wi - 1];
    const hasWarn = after.warnings.some((v: any) => v.rule === 'WEEK_MIN_LIMITS' && v.week === wi);
    add(`inv „nedelja < minimum" ${hasWarn ? 'uz validator WEEK_MIN_LIMITS' : 'bez upozorenja'}`, `${id} ${tag} asOf ${asOf} ned ${wi}: planirano ${w.plannedKm} < min, bol ${w.limits?.pain?.length ?? 0} d, odmor ${w.limits?.rest?.length ?? 0} d`);
  }
  for (const x of inv.filter((x) => !x.startsWith('nedelja < minimum'))) add(`inv ostalo: ${x.replace(/[0-9-]+/g, '#')}`, `${id} ${tag} ${asOf}: ${x}`);
}
// (b) algebarski: granica redovnog rasta početnika.
const beg = planRule(5, 'beginner')!;
let bDiff = 0, bFirst: number | null = null;
for (let prev = 200; prev <= 600; prev++) {
  const own = growth10(prev, beg);
  const inv = Math.min(40, Math.max(10, Math.round(prev * 0.05)));
  if (own !== inv) { bDiff++; bFirst ??= prev; }
}
console.log(JSON.stringify({ stride: { r, f, b }, bases: bases.length, flows, ok, cnt, beginnerGrowth: { prev10Checked: 401, diverge: bDiff, fromPrev10: bFirst } }, null, 1));
for (const [k, v] of Object.entries(ex)) console.log(`${k}: ${v}`);

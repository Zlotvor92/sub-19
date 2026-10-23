/* Ugao 4 (jedan vlasnik), HM — „upisani plan nema dugog ne-rasteretne izgradnje" (K3) ima dve definicije:
   assess.ts:441–445 (`noLong`) gleda PRETHODNI plan (`plan.weeks`, pre ovog koraka), a konstruktor
   (generate.ts:246, lastLong10 iz upisanih dana NOVOG plana) vidi nedelju 1 bez dugog kad odmor istog koraka
   pokrije dan dugog. Tok u JEDNOM koraku: bol 8 (odmor asOf+1…+3 pokriva dugi ned 1) + umor (zapisi asOf − 1, − 2)
   → rasterećenje ned 2 bez reference. Bez slučajnosti.
   Argumenti: [STRIDE] [recentLongRunKm lista]. Pokretanje iz web/: node ../docs/generators-v2/audit/owner/hm-deloadref1.ts 40 */
import { adaptHmV2 } from '../../../../web/src/domain/generators/halfMarathon/v2/adapt.ts';
import { generateHmV2 } from '../../../../web/src/domain/generators/halfMarathon/v2/generate.ts';
import { addDays } from '../../../../web/src/domain/generators/halfMarathon/v2/dates.ts';
import { grid02Inputs, feelInputs, beginnerInputs } from '../../../../web/src/domain/generators/halfMarathon/v2/testInputs.ts';

const STRIDE = Number(process.argv[2] ?? 1);
const RECENT = (process.argv[3] ?? '').split(',').filter(Boolean).map(Number);
const bases = [
  ...grid02Inputs().map((g) => ({ id: g.id, input: g.input })),
  ...feelInputs().map((g) => ({ id: g.id, input: g.input })),
  ...beginnerInputs().map((g) => ({ id: g.id, input: g.input }))
].filter((_, i) => i % STRIDE === 0);
let flows = 0;
const out: Record<string, number> = {};
const ex: Record<string, string> = {};
for (const b0 of bases)
  for (const rk of RECENT.length ? RECENT : [null]) {
    const b = rk === null ? b0 : { id: `${b0.id}-rl${rk}`, input: { ...b0.input, recentLongRunKm: rk } };
    const g: any = generateHmV2(b.input);
    if (!g.ok) continue;
    const long1 = g.plan.weeks[0].days.find((d: any) => d.role === 'long');
    if (!long1) continue;
    const asOf = addDays(long1.date, -3);
    if (asOf < g.plan.input.startDate) continue;
    flows++;
    const facts = {
      workouts: [
        { date: asOf, km: 0, durationSec: 0, completed: false, pain: 8 },
        { date: addDays(asOf, -1), km: 6, durationSec: 2400, completed: true, rpe: 8 },
        { date: addDays(asOf, -2), km: 6, durationSec: 2400, completed: true, rpe: 7 }
      ]
    };
    const a: any = adaptHmV2(g.plan, facts, asOf);
    const k = a.ok
      ? `ok deload2=${a.plan.weeks[1].deload} ref=${a.plan.adaptation.steps.at(-1).deloadRefLongKm ?? '—'}`
      : `REJ ${a.reasons.map((r: any) => r.code + (r.week ? '@' + r.week : '')).join(',')}`;
    out[k] = (out[k] ?? 0) + 1;
    ex[k] ??= `${b.id} asOf ${asOf}: ${a.ok ? '' : a.reasons.map((r: any) => r.message).join(' | ').slice(0, 300)}`;
  }
console.log(JSON.stringify({ stride: STRIDE, recent: RECENT, flows, out }, null, 1));
for (const [k, v] of Object.entries(ex)) console.log(`${k}: ${v}`);

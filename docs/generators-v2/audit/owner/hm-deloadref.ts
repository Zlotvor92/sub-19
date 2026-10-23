/* Ugao 4 (jedan vlasnik), HM — „dugi reference rasterećenja" (K3, steps.deloadRefLong10) ima dve definicije:
   konstruktor (generate.ts:246) čita deloadRefLong10(steps, frame.index) za SVAKU rasteretnu nedelju dok nema
   upisanog dugog ne-rasteretne izgradnje (lastLong10 ostaje null), a validator (validate.ts:1288) jednom upiše
   lastLong10 = deloadRefLong10(steps, w.index) i zadržava ga za sledeće rasterećenje. Razilaze se kad dva
   rasterećenja dolaze bez upisanog dugog izgradnje između njih (oba sa svojom referencom).
   Tok: (1) bol 8 u nedelji 1 tako da odmor pokrije dan dugog; (2) umor u nedelji 1 (zapisi pre bola) → rasterećenje ned 2 (K3);
   (3) umor u nedelji 2 → rasterećenje ned 3 (K3, druga referenca). Bez slučajnosti (deterministički ulazi).
   Argumenti: [STRIDE (svaki n-ti plan mreža 02/03/početnik)] [recentLongRunKm, lista sa zarezom; prazno = bez].
   Pokretanje iz web/: node ../docs/generators-v2/audit/owner/hm-deloadref.ts 1 || ... hm-deloadref.ts 20 6,8,10,12,14 */
import { adaptHmV2 } from '../../../../web/src/domain/generators/halfMarathon/v2/adapt.ts';
import { generateHmV2 } from '../../../../web/src/domain/generators/halfMarathon/v2/generate.ts';
import { addDays, weekdayOf } from '../../../../web/src/domain/generators/halfMarathon/v2/dates.ts';
import {
  grid02Inputs,
  feelInputs,
  beginnerInputs
} from '../../../../web/src/domain/generators/halfMarathon/v2/testInputs.ts';

type R = { ok: boolean; plan?: any; reasons?: any[]; violations?: any[] };
const fat = (d1: string, d2: string) => ({
  workouts: [
    { date: d1, km: 6, durationSec: 2400, completed: true, rpe: 8 },
    { date: d2, km: 6, durationSec: 2400, completed: true, rpe: 7 }
  ]
});

const STRIDE = Number(process.argv[2] ?? 1);
const RECENT = (process.argv[3] ?? "").split(",").filter(Boolean).map(Number);
const bases = [
  ...grid02Inputs().map((g) => ({ id: g.id, input: g.input })),
  ...feelInputs().map((g) => ({ id: g.id, input: g.input })),
  ...beginnerInputs().map((g) => ({ id: g.id, input: g.input }))
].filter((_, i) => i % STRIDE === 0);

let flows = 0;
let reached = 0;
const byCode = new Map<string, number>();
const examples: string[] = [];
const firstOf = new Map<string, string>();
for (const b0 of bases) for (const rk of RECENT.length ? RECENT : [null]) {
  const b = rk === null ? b0 : { id: `${b0.id}-rl${rk}`, input: { ...b0.input, recentLongRunKm: rk } };
  const g = generateHmV2(b.input) as R;
  if (!g.ok) continue;
  const p0 = g.plan;
  const w1 = p0.weeks[0];
  const long1 = w1.days.find((d: any) => d.role === 'long');
  if (!long1) continue;
  // (1) bol 8 na asOf = 3 dana pre dana dugog ned 1 (odmor asOf+1..+3 pokriva dugi).
  const asOf1 = addDays(long1.date, -3);
  if (asOf1 < p0.input.startDate) continue;
  flows++;
  const s1 = adaptHmV2(p0, { workouts: [{ date: asOf1, km: 0, durationSec: 0, completed: false, pain: 8 }] }, asOf1) as R;
  if (!s1.ok) continue;
  if (s1.plan.weeks[0].days.some((d: any) => d.role === 'long')) continue;
  // (2) umor u nedelji 1 (zapisi bez dayId) → rasterećenje ned 2.
  const asOf2 = w1.endDate;
  // zapisi umora pre bola (asOf1 − 1, − 2): ne trči se u danima odmora.
  const s2 = adaptHmV2(s1.plan, fat(addDays(asOf1, -1), addDays(asOf1, -2)), asOf2) as R;
  if (!s2.ok) continue;
  const st2 = s2.plan.adaptation.steps.at(-1);
  if (!s2.plan.weeks[1].deload || st2.deloadRefLongKm === undefined) continue;
  // (3) umor u nedelji 2 → rasterećenje ned 3.
  const asOf3 = s2.plan.weeks[1].endDate;
  const s3 = adaptHmV2(s2.plan, fat(addDays(asOf3, -1), addDays(asOf3, -3)), asOf3) as R;
  const st3 = s3.ok ? s3.plan.adaptation.steps.at(-1) : null;
  // Tok je „dostigao" uslov kad korak 3 traži rasterećenje ned 3 sa sopstvenom referencom; kod odbijanja
  // to proveravamo ponovo kroz assess-ishod (PLAN_VIOLATES_POLICY i violations).
  // Odbijanje iz construct (validator u konstruktoru): violations prazno, pravilo je prefiks poruke „RULE: …".
  const viol = [
    ...(s3.violations ?? []).filter((v: any) => v.severity === 'error').map((v: any) => v.rule),
    ...(s3.reasons ?? []).filter((r: any) => r.code === 'PLAN_VIOLATES_POLICY' && /^[A-Z0-9_]+: /.test(r.message)).map((r: any) => r.message.split(':')[0])
  ];
  const msgs = (s3.reasons ?? []).filter((r: any) => r.message.startsWith('DELOAD_LONG')).map((r: any) => `ned ${r.week}: ${r.message}`);
  const key = s3.ok ? (st3.deload && st3.deloadRefLongKm !== undefined ? 'ok-K3x2' : 'ok-other') : `REJ:${(s3.reasons ?? []).map((r: any) => r.code).join(',')}:${[...new Set(viol)].join(',')}`;
  byCode.set(key, (byCode.get(key) ?? 0) + 1);
  if (!s3.ok && !firstOf.has(key))
    firstOf.set(key, `${b.id} asOf ${asOf1}/${asOf2}/${asOf3}: ${(s3.reasons ?? []).map((r: any) => r.message).join(' | ').slice(0, 260)}`);
  if (!s3.ok && viol.includes('DELOAD_LONG')) {
    reached++;
    if (examples.length < 3)
      examples.push(
        `${b.id} asOf ${asOf1}/${asOf2}/${asOf3} ref2=${st2.deloadRefLongKm} — ${[...(s3.violations ?? []).filter((v: any) => v.rule === 'DELOAD_LONG').map((v: any) => `ned ${v.week}: ${v.message}`), ...msgs].join(' | ')} | gen L1/L2 = ${p0.weeks[0].days.find((d: any) => d.role === 'long')?.workout.km}/${p0.weeks[1].days.find((d: any) => d.role === 'long')?.workout.km}`
      );
  }
}
console.log(JSON.stringify({ stride: STRIDE, bases: bases.length, flows, deloadLongRejected: reached, outcomes: Object.fromEntries(byCode) }, null, 1));
for (const e of examples) console.log(e);
for (const [k, e] of firstOf) console.log(`prvi ${k}: ${e}`);

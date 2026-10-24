/* Ugao 4 (jedan vlasnik), HM — „da li se rezultat primenjuje" (A1) ima dve definicije:
   vlasnik assess.ts:296–321 (≤ 84 dana, noviji od rezultata u upotrebi, VDOT 30–80 → inače RESULT_IGNORED) i
   app/form.ts:94–106 (Forma: „čeka prilagođavanje plana" = svež ≤ 84 dana i noviji od poslednjeg primenjenog — BEZ
   opsega VDOT-a). Ulaz: plan početnika po osećaju (mreža 03 početnik / adaptBases beg-*), trka 5 km u nedelji 2 sa
   vremenom ispod VDOT 30 (realan početnik: VDOT ≤ 45, lagan ≥ 330 s/km). Upoređuje se oznaka Forme pre i posle
   adaptacije sa ishodom adaptHmV2. Bez slučajnosti.
   Pokretanje iz web/: node ../docs/generators-v2/audit/owner/hm-form-result.ts */
import { adaptHmV2 } from '../../../../web/src/domain/generators/halfMarathon/v2/adapt.ts';
import { generateHmV2 } from '../../../../web/src/domain/generators/halfMarathon/v2/generate.ts';
import { addDays } from '../../../../web/src/domain/generators/halfMarathon/v2/dates.ts';
import { round1, vdotFromResult } from '../../../../web/src/domain/generators/halfMarathon/v2/paces.ts';
import { adaptBases } from '../../../../web/src/domain/generators/halfMarathon/v2/adaptInputs.ts';
import { generatedPlan, storedPlan } from '../../../../web/src/domain/generators/halfMarathon/v2/app/plan.ts';
import { formHistory } from '../../../../web/src/domain/generators/halfMarathon/v2/app/form.ts';
import { adaptPreview } from '../../../../web/src/domain/generators/halfMarathon/v2/app/adapt.ts';

const raceLog = (date: string, sec: number) => ({
  status: 'done',
  km: 5,
  sec,
  ts: date,
  raceAi: { context: { date, distanceM: 5000, officialSec: sec, intent: 'race' } }
});

let n = 0;
let diverge = 0;
const rows: string[] = [];
// Vremena 5 km: 30:00 … 45:00 (korak 1 min) — VDOT ≈ 30,9 … 19,x.
for (const b of adaptBases()) {
  const g: any = generateHmV2(b.input);
  if (!g.ok) continue;
  for (let min = 30; min <= 45; min++) {
    const sec = min * 60;
    const vdot = round1(vdotFromResult(5000, sec));
    const day = addDays(g.plan.weeks[1].startDate, 2);
    const today = addDays(day, 1);
    const app: any = storedPlan(generatedPlan(g.plan));
    const log = { trka: raceLog(day, sec) };
    const f0: any = formHistory({ plan: app, today, log } as any);
    const p0 = f0?.points.find((p: any) => p.kind === 'race');
    const a: any = adaptHmV2(g.plan, { results: [{ distM: 5000, sec, date: day, kind: 'race' }] }, today);
    const ignored = a.ok && a.reasons.some((r: any) => r.condition === 'RESULT_IGNORED');
    const prev: any = adaptPreview({ plan: app, today, log } as any);
    const applied = prev.ok ? prev.result : null;
    const f1: any = applied ? formHistory({ plan: applied, today, log } as any) : null;
    const p1 = f1?.points.find((p: any) => p.kind === 'race');
    n++;
    const bad = ignored && (p0?.status === 'pending' || p1?.status === 'pending');
    if (bad) diverge++;
    if (bad && rows.length < 4)
      rows.push(
        `${b.id} 5 km ${min}:00 (VDOT ${vdot}) ${day}: adaptHmV2 → RESULT_IGNORED; Forma pre: ${p0?.status} „${p0?.label}"; posle primene: ${p1?.status}`
      );
  }
}
console.log(JSON.stringify({ flows: n, formPendingButIgnored: diverge }));
for (const r of rows) console.log(r);

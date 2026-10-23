/* HM-09 stavka 6 (Z4) — vraćanje revizije (app/adapt.ts restoreMerge) po obrascu audit/owner/tenK-restore.ts:
   g = generate(baza); snimak = g (rev1) ILI adapt(g, 'none', asOf1 − 3) (rev-adapted); trenutni = adapt(snimak,
   scenario, asOf1); vraćanje danas = asOf1 + k; pa validatePlan(jezgro vraćenog) i sledeća adaptacija
   adaptHmV2(vraćen, {}, danas). k = 0: neposredno poništavanje (vraćanje istog dana, bez novih zapisa). Bez slučajnosti (adaptBases × asOfs04[sreda ned 2, kraj ned 6] × scenariji × k).
   Iz web/: node ../docs/hm-v2/artifacts/segment-09/hm-restore.ts */

const V2 = '../../../../web/src/domain/generators/halfMarathon/v2';
const { generateHmV2 } = await import(`${V2}/generate.ts`);
const { adaptHmV2 } = await import(`${V2}/adapt.ts`);
const { validatePlan } = await import(`${V2}/validate.ts`);
const { addDays } = await import(`${V2}/dates.ts`);
const T = await import(`${V2}/adaptInputs.ts`);
const { restoreMerge } = await import(`${V2}/app/adapt.ts`);
const { generatedPlan, storedPlan } = await import(`${V2}/app/plan.ts`);

const store = (p: unknown) => storedPlan(generatedPlan(p));
const SC = ['none', 'under50', 'pause10', 'pause20', 'pain5', 'fatigue', 'faster', 'locked'] as const;
const stat = { controlRejected: 0, flows: 0, refused: 0, restored: 0, invalid: 0, nextRejected: 0, undoFlows: 0, undoRestored: 0 };
const why: Record<string, number> = {};
const rules: Record<string, number> = {};
const nextCodes: Record<string, number> = {};
const ex: string[] = [];
const byFlow: Record<string, number> = {};
const nextEx: string[] = [];
for (const b of T.adaptBases()) {
  const g = generateHmV2(b.input);
  if (!g.ok) continue;
  const w = g.plan.weeks;
  for (const asOf1 of [addDays(w[1].startDate, 2), w[5].endDate]) {
    for (const snapKind of ['rev1', 'rev-adapted'] as const) {
      let snapCore = g.plan;
      if (snapKind === 'rev-adapted') {
        const a0 = adaptHmV2(g.plan, {}, addDays(asOf1, -3));
        if (!a0.ok) continue;
        snapCore = a0.plan;
      }
      for (const s of SC) {
        const cur = adaptHmV2(snapCore, T.factsOf(snapCore, s, asOf1), asOf1);
        if (!cur.ok) continue;
        for (const k of [0, 1, 4, 8]) {
          const today = addDays(asOf1, k);
          stat.flows++;
          if (!adaptHmV2(cur.plan, {}, today).ok) stat.controlRejected++;
          const r = restoreMerge(store(cur.plan), store(snapCore), today, {});
          const conflicts = (r.meta as { futureChanges?: { conflicts: string[] } }).futureChanges?.conflicts ?? [];
          if (k === 0) stat.undoFlows++;
          if (conflicts.length) { stat.refused++; const w = conflicts[0].replace(/[0-9]+([.,][0-9]+)?/g, '#').slice(0, 110); why[w] = (why[w] ?? 0) + 1; continue; }
          if (k === 0) stat.undoRestored++;
          stat.restored++;
          const core = (r as { hmV2: unknown }).hmV2;
          const errs = validatePlan(core).filter((v: { severity: string }) => v.severity === 'error');
          if (errs.length) {
            stat.invalid++;
            for (const e of new Set(errs.map((v: { rule: string }) => v.rule))) rules[e as string] = (rules[e as string] ?? 0) + 1;
            if (ex.length < 6) ex.push(`${b.id} ${asOf1} ${snapKind} ${s} +${k}: ${errs.slice(0, 2).map((v: { rule: string; week?: number; message: string }) => `${v.rule}@${v.week}: ${v.message}`).join(' | ')}`);
          }
          const next = adaptHmV2(core, {}, today);
          if (!next.ok) {
            stat.nextRejected++;
            const key = `${snapKind}/${s}`;
            byFlow[key] = (byFlow[key] ?? 0) + 1;
            if (nextEx.length < 4) nextEx.push(`${b.id} ${asOf1} ${snapKind} ${s} danas=${today}: ${next.reasons.slice(0, 2).map((x: { message: string }) => x.message).join(' | ')}`);
            for (const v of next.violations.filter((x: { severity: string }) => x.severity === 'error')) nextCodes[v.rule] = (nextCodes[v.rule] ?? 0) + 1;
            for (const x of next.reasons) nextCodes[x.code] = (nextCodes[x.code] ?? 0) + 1;
          }
        }
      }
    }
  }
}
console.log(JSON.stringify(stat));
console.log('razlozi odbijanja:', JSON.stringify(why, null, 1));
console.log('greške validatora na vraćenom planu (broj tokova po pravilu):', JSON.stringify(rules));
console.log('sledeća adaptacija odbijena (pravilo/kod → broj):', JSON.stringify(nextCodes));
for (const e of ex) console.log('  ' + e);
console.log('sledeća adaptacija odbijena po (snimak/scenario):', JSON.stringify(byFlow));
for (const e of nextEx) console.log('  ' + e);

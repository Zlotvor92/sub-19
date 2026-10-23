/* Ugao 4, maraton v2 — dve definicije „spajanja prošlosti i budućnosti":
   (1) jezgro written.ts:73 writtenWeeks (adaptacija; cela prošla nedelja različita od sastavljene → mixedWeeks);
   (2) app/adapt.ts:190 restoreMerge (vraćanje revizije, graftFuturePlan): cela prošla nedelja iz trenutnog plana BEZ
       oznake mešovite (app/adapt.ts:228), cilj/faza/koraci adaptacije iz sačuvane verzije, bez validatePlan; oznaka
       politike meta = tekuća P.version (app/plan.ts:309 stampPlan), jezgro nosi verziju snimka.
   Tok: g = generate(baza); trenutni = adapt(g, scenario, asOf1); snimak = g (revizija 1) ILI adapt(g, 'none', asOf0)
   (revizija sa koracima); vraćanje danas = asOf1 + k; pa validatePlan(jezgro vraćenog) i sledeća adaptacija
   adaptMarathonV2(vraćen, {}, danas). Bez slučajnosti (pune mreže: adaptBases × scenariji × asOf × k).
   Iz web/: node ../docs/marathon-v2/artifacts/segment-09/mar-restore.ts (MAR-09, obrazac owner/tenK-restore.ts) */

const V2 = '../../../../web/src/domain/generators/marathon/v2';
const { generateMarathonV2 } = await import(`${V2}/generate.ts`);
const { adaptMarathonV2 } = await import(`${V2}/adapt.ts`);
const { validatePlan } = await import(`${V2}/validate.ts`);
const { addDays } = await import(`${V2}/dates.ts`);
const T = await import(`${V2}/testInputs.ts`);
const { restoreMerge } = await import(`${V2}/app/adapt.ts`);
const { generatedPlan, storedPlan } = await import(`${V2}/app/plan.ts`);

const store = (p: unknown) => storedPlan(generatedPlan(p));
const SC = ['none', 'under50', 'pause10', 'pause20', 'pain5', 'fatigue', 'faster', 'locked'] as const;
const stat = { controlRejected: 0, flows: 0, refused: 0, restored: 0, invalid: 0, nextRejected: 0, stampMismatch: 0 };
const rules: Record<string, number> = {};
const nextCodes: Record<string, number> = {};
const ex: string[] = [];
const byFlow: Record<string, number> = {};
const nextEx: string[] = [];
for (const b of T.adaptBases()) {
  const g = generateMarathonV2(b.input);
  if (!g.ok) continue;
  for (const kind of ['w2end', 'w6wed'] as const) {
    const asOf1 = kind === 'w2end' ? g.plan.weeks[1].endDate : addDays(g.plan.weeks[5].startDate, 2);
    for (const snapKind of ['rev1', 'rev-adapted'] as const) {
      let snapCore = g.plan;
      if (snapKind === 'rev-adapted') {
        const a0 = adaptMarathonV2(g.plan, {}, addDays(asOf1, -3));
        if (!a0.ok) continue;
        snapCore = a0.plan;
      }
      for (const s of SC) {
        const cur = adaptMarathonV2(snapCore, T.factsOf(snapCore, s, asOf1), asOf1);
        if (!cur.ok) continue;
        for (const k of [1, 4, 8]) {
          const today = addDays(asOf1, k);
          stat.flows++;
          // Kontrola: ista adaptacija trenutnog plana bez vraćanja.
          if (!adaptMarathonV2(cur.plan, {}, today).ok) stat.controlRejected++;
          const r = restoreMerge(store(cur.plan), store(snapCore), today, {});
          const conflicts = (r.meta as { futureChanges?: { conflicts: string[] } }).futureChanges?.conflicts ?? [];
          if (conflicts.length) { stat.refused++; continue; }
          stat.restored++;
          const core = (r as { marathonV2: { policyVersion: string } }).marathonV2;
          if ((r.meta as { policyVersion: string }).policyVersion !== core.policyVersion) stat.stampMismatch++;
          const errs = validatePlan(core).filter((v: { severity: string }) => v.severity === 'error');
          if (errs.length) {
            stat.invalid++;
            for (const e of new Set(errs.map((v: { rule: string }) => v.rule))) rules[e as string] = (rules[e as string] ?? 0) + 1;
            if (ex.length < 6) ex.push(`${b.id} ${kind} ${snapKind} ${s} +${k}: ${errs.slice(0, 2).map((v: { rule: string; week?: number; message: string }) => `${v.rule}@${v.week}: ${v.message}`).join(' | ')}`);
          }
          const next = adaptMarathonV2(core, {}, today);
          if (!next.ok) {
            stat.nextRejected++;
            const key = `${snapKind}/${s}`;
            byFlow[key] = (byFlow[key] ?? 0) + 1;
            if (nextEx.length < 4) nextEx.push(`${b.id} ${kind} ${snapKind} ${s} danas=${today}: ${next.reasons.slice(0, 2).map((x: { message: string }) => x.message).join(' | ')}`);
            for (const v of next.violations.filter((x: { severity: string }) => x.severity === 'error')) nextCodes[v.rule] = (nextCodes[v.rule] ?? 0) + 1;
            for (const x of next.reasons) nextCodes[x.code] = (nextCodes[x.code] ?? 0) + 1;
          }
        }
      }
    }
  }
}
console.log(JSON.stringify(stat));
console.log('greške validatora na vraćenom planu (broj tokova po pravilu):', JSON.stringify(rules));
console.log('sledeća adaptacija odbijena (pravilo/kod → broj):', JSON.stringify(nextCodes));
for (const e of ex) console.log('  ' + e);
console.log('sledeća adaptacija odbijena po (snimak/scenario):', JSON.stringify(byFlow));
for (const e of nextEx) console.log('  ' + e);

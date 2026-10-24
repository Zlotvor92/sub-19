/* 5K-09, Z4: vraćanje revizije (app/adapt.ts restoreMerge) po obrascu owner/tenK-restore.ts.
   Tok: g = generate(mreža adaptacije); trenutni = adapt(g, scenario, asOf1); snimak = g (rev1) ili adapt(g, {}, asOf1−3)
   (rev-adapted) — snimak je verzija tik pre poslednje adaptacije; vraćanje danas = asOf1 + k, k = 0 je neposredno
   poništavanje (bez novih zapisa posle; mora da prođe); zatim validatePlan(jezgro vraćenog) i sledeća adaptacija
   adapt(vraćen, {}, danas). Odbijena vraćanja: broj i razlozi (meta.futureChanges.problems, app/adapt.restoreProblems).
   Iz web/: node ../docs/generators-v2/audit/fixes/5K/fiveK-restore.ts */
const V2 = '../../../../../web/src/domain/generators/fiveK/v2';
const { generateFiveKV2 } = await import(`${V2}/generate.ts`);
const { adaptFiveKV2 } = await import(`${V2}/adapt.ts`);
const { validatePlan } = await import(`${V2}/validate.ts`);
const { addDays } = await import(`${V2}/dates.ts`);
const T = await import(`${V2}/testInputs.ts`);
const { restoreMerge } = await import(`${V2}/app/adapt.ts`);
const { generatedPlan, storedPlan } = await import(`${V2}/app/plan.ts`);

const store = (p: unknown) => storedPlan(generatedPlan(p));
type Plan = { weeks: { days: { date: string; countsToWeek: boolean; workout: { km: number; sec: number } }[] }[] };
const scen = (p: Plan, s: string, asOf: string): Record<string, unknown> => {
  const done = T.doneFacts(p, asOf);
  if (s === 'none') return { workouts: done };
  if (s === 'under50') return { workouts: done.map((x: { km: number; durationSec: number }) => ({ ...x, km: Math.round(x.km * 5) / 10, durationSec: Math.round(x.durationSec / 2) })) };
  if (s.startsWith('pause')) return { workouts: T.doneFacts(p, addDays(asOf, -Number(s.slice(5)))) };
  if (s === 'pain5') return { workouts: done.map((x: object, i: number, a: object[]) => (i === a.length - 1 ? { ...x, pain: 5 } : x)) };
  if (s === 'fatigue') return { workouts: done.map((x: object, i: number, a: object[]) => (i >= a.length - 2 ? { ...x, rpe: 8 } : x)) };
  return {};
};
const SC = ['none', 'under50', 'pause10', 'pause20', 'pain5', 'fatigue'];
const stat = { flows: 0, controlRejected: 0, refused: 0, refusedImmediate: 0, restored: 0, invalid: 0, nextRejected: 0 };
const why: Record<string, number> = {};
const rules: Record<string, number> = {};
const ex: string[] = [];
for (const b of T.adaptNetwork()) {
  const g = generateFiveKV2(b.input);
  if (!g.ok) continue;
  const n = g.plan.weeks.length;
  for (const k1 of [2, Math.max(3, Math.floor(n / 2))]) {
    const asOf1 = addDays(g.plan.weeks[k1 - 1].startDate, 6);
    for (const snapKind of ['rev1', 'rev-adapted']) {
      let snap = g.plan;
      if (snapKind === 'rev-adapted') {
        const a0 = adaptFiveKV2(g.plan, {}, addDays(asOf1, -3));
        if (!a0.ok) continue;
        snap = a0.plan;
      }
      for (const s of SC) {
        const cur = adaptFiveKV2(snap, scen(snap, s, asOf1), asOf1);
        if (!cur.ok) continue;
        for (const k of [0, 1, 4, 8]) {
          const today = addDays(asOf1, k);
          stat.flows++;
          if (!adaptFiveKV2(cur.plan, {}, today).ok) stat.controlRejected++;
          const r = restoreMerge(store(cur.plan), store(snap), today, {});
          const fc = (r.meta as { futureChanges?: { conflicts: string[]; problems?: string[] } }).futureChanges;
          if (fc?.conflicts.length) {
            stat.refused++;
            if (k === 0) stat.refusedImmediate++;
            for (const x of fc.problems ?? ['?']) why[x] = (why[x] ?? 0) + 1;
            continue;
          }
          stat.restored++;
          const core = (r as { fiveKV2: unknown }).fiveKV2;
          const errs = validatePlan(core).filter((v: { severity: string }) => v.severity === 'error');
          if (errs.length) {
            stat.invalid++;
            for (const e of new Set(errs.map((v: { rule: string }) => v.rule))) rules[e as string] = (rules[e as string] ?? 0) + 1;
            if (ex.length < 6) ex.push(`${b.id} ${snapKind} ${s} asOf ${asOf1} +${k}: ${errs.slice(0, 2).map((v: { rule: string; week?: number; message: string }) => `${v.rule}@${v.week}: ${v.message}`).join(' | ')}`);
          }
          const nx = adaptFiveKV2(core, {}, today);
          if (!nx.ok) { stat.nextRejected++; if (ex.length < 12) ex.push(`NEXT ${b.id} ${snapKind} ${s} asOf ${asOf1} +${k}: ${JSON.stringify(nx.reasons).slice(0, 300)} ${JSON.stringify((nx.violations ?? []).filter((v: { severity: string }) => v.severity === "error")).slice(0, 400)}`); }
        }
      }
    }
  }
}
console.log(JSON.stringify(stat));
console.log('greške validatora na vraćenom planu:', JSON.stringify(rules));
console.log('razlozi odbijenih vraćanja (pravilo/kod → broj tokova):', JSON.stringify(why));
for (const e of ex) console.log('  ' + e);

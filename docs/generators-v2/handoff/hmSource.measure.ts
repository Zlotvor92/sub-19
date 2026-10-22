/* Faza 3, 3c-dopuna 2 — tok HM v2 IZVOR → 10K v1 / 5K v1 (prekidači isključeni) kroz PRAVI kod (`preparationForPlan`:
   odluka, izbor kroz `basisFromPlan` i kroz `executionBasis`) nad sačuvanim planom HM v2 posle adaptacije sa ponudom.
   Sačuvan plan nosi snimak izmena (`hmV2Edits`) kao posle pregleda adaptacije. Uzorak: 4a mreže HM v2 (193/97/29),
   asOf kraj ned. 2 i ⌊N/2⌋, scenariji pause35, pause20, painPause, test5k, slower, under50.
   Meri: ponude, izbore (uspeh, razlozi), dupli datum/id, id ≠ izvor istog datuma, curenje (`hmV2`, meta v2 jednaka
   izvoru, `hmV2Edits`); heš svakog izbora (bez `hmV2Edits` u meta) za poređenje pre/posle (TAG=before|after) i
   `newPb` = poslednji rezultat do starta ulaza ugovora (ulaz ili korak) ≠ rezultat ulaza. Iz web/:
   TAG=after npx vitest run --config ../docs/generators-v2/handoff/vitest.measure.config.mjs hmSource */
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import * as select from '../../../web/src/domain/generators/select';
import { shorterOffer } from '../../../web/src/domain/generators/halfMarathon/v2/shorter';
import { generatedPlan, storedPlan } from '../../../web/src/domain/generators/halfMarathon/v2/app/plan';
import { addDays, distOf, sampleBases } from '../final-check/lib';

declare const test: (name: string, fn: () => void, timeout?: number) => void;
const TAG = process.env['TAG'] ?? 'after';
/** `pause35+test5k`: pauza 35 d (ponuda) + rezultat testa 5 km iz koraka adaptacije (P2: rezultat koraka). */
const SC = ['pause35', 'pause20', 'painPause', 'test5k', 'slower', 'under50', 'pause35+test5k'] as const;
const KEYS = ['vdot', 'paceBasis', 'predictedHmSec', 'goalVdot', 'goalAssessment'];
type St = { weeks: { start: string; days: { dow: number; id?: string }[] }[]; meta?: Record<string, unknown> } & Record<string, unknown>;
type R = { distanceM?: number; distM?: number; timeSec?: number; sec?: number; date: string };
const dated = (p: St) => p.weeks.flatMap((w) => w.days.map((d) => [addDays(w.start, d.dow), d.id] as const));
const cls = (s: string) => s.replace(/[0-9]+([.,][0-9]+)?/g, '#').slice(0, 90);
const inc = (o: Record<string, number>, k: string) => (o[k] = (o[k] ?? 0) + 1);
const sha = (x: unknown) => createHash('sha256').update(JSON.stringify(x)).digest('hex').slice(0, 16);

/** Kopija pravila `lastResult` (3e) — merenje ne uvozi novu funkciju, da radi i nad kodom pre izmene. */
function last(v2: { input: { recentResult?: R | null }; adaptation?: { steps: { result: R | null }[] } }, on: string) {
  const r = v2.input.recentResult;
  let best = r && r.date <= on ? { distM: r.distanceM, sec: r.timeSec, date: r.date } : null;
  for (const s of v2.adaptation?.steps ?? [])
    if (s.result && s.result.date <= on && (!best || s.result.date >= best.date)) best = { distM: s.result.distM, sec: s.result.sec, date: s.result.date };
  return best;
}

test('3c-dopuna 2: HM v2 → v1 kroz pravi kod', () => {
  const hm = distOf('HM');
  const { bases } = sampleBases(hm, { R: 193, F: 97, B: 29 });
  const t = () => ({ choices: 0, ok: 0, duplicateDates: 0, duplicateIds: 0, idMismatch: 0, leakPlanKey: 0, leakMeta: 0, leakEdits: 0, rejected: {} as Record<string, number> });
  const out = { tag: TAG, plans: 0, flows: 0, offers: 0, newPbBasis: 0, newPbExec: 0, '10K v1': t(), '5K v1': t(), '10K v1 exec': t(), '5K v1 exec': t(), hashes: {} as Record<string, string>, newPb: {} as Record<string, boolean> };
  for (const b of bases) {
    const g = hm.generate(b.input);
    if (!g.ok) continue;
    out.plans++;
    const p = g.plan;
    const N = p.weeks.length;
    for (const at of [p.weeks[1]!.endDate, p.weeks[Math.floor(N / 2) - 1]!.endDate])
      for (const s of SC) {
        out.flows++;
        const facts =
          s === 'pause35+test5k'
            ? { ...hm.facts(p, 'pause35', at), results: hm.facts(p, 'test5k', at)['results'] }
            : hm.facts(p, s, at);
        const r = hm.adapt(p, facts, at);
        if (!r.ok || !shorterOffer(r.plan as never, at)) continue;
        out.offers++;
        const st = select.stampForStorage(storedPlan(generatedPlan(r.plan as never)) as never) as unknown as St;
        const src = { ...st, meta: { ...st.meta, hmV2Edits: { alts: {}, moves: {} } } } as St;
        const idOf = new Map(dated(src));
        const ctx = { log: {}, alts: {}, moves: {} };
        const prep = select.preparationForPlan(src as never)!;
        const v2 = r.plan as unknown as Parameters<typeof last>[0] & { input: { startDate: string } };
        const inRes = v2.input.recentResult ? JSON.stringify({ distM: v2.input.recentResult.distanceM, sec: v2.input.recentResult.timeSec, date: v2.input.recentResult.date }) : 'null';
        const basis = prep.basisFromPlan(src as never, at as never)!;
        const ex = select.HALF_MARATHON_V2_GENERATOR.executionBasis(src as never, at as never, null as never, { weeklyKm: Number(p.input.currentWeeklyKm) });
        for (const [mode, bs, start] of [['', basis, v2.input.startDate], [' exec', 'error' in ex ? null : ex, addDays(at, 1)]] as const) {
          if (!bs) continue;
          const np = JSON.stringify(last(v2, start)) !== inRes;
          if (np) mode ? out.newPbExec++ : out.newPbBasis++;
          for (const dist of [10000, 5000]) {
            const name = `${dist === 10000 ? '10K' : '5K'} v1${mode}` as '10K v1';
            const tt = out[name];
            tt.choices++;
            const key = `${b.id} ${at} ${s} ${name}`;
            out.newPb[key] = np;
            const c = prep.buildPreparationChoice(src as never, at as never, bs as never, { kind: 'shorter', raceDistM: dist }, ctx as never);
            if ('error' in c) {
              inc(tt.rejected, cls(c.error));
              // Tekst V1_TARGET_NEEDS_RESULT je promenjen u ovoj dopuni: u hešu je zamenjen istim znakom.
              out.hashes[key] = 'E:' + sha(c.error.replace(/traži rezultat trke ili testa.*$/, 'NEEDS_RESULT'));
              continue;
            }
            tt.ok++;
            const res = select.stampForStorage(c.result) as unknown as St;
            const dd = dated(res);
            if (new Set(dd.map(([x]) => x)).size !== dd.length) tt.duplicateDates++;
            if (new Set(dd.map(([, x]) => x)).size !== dd.length) tt.duplicateIds++;
            if (dd.some(([x, id]) => idOf.has(x) && idOf.get(x) !== id)) tt.idMismatch++;
            if ('hmV2' in res) tt.leakPlanKey++;
            if (KEYS.some((k) => res.meta?.[k] !== undefined && JSON.stringify(res.meta[k]) === JSON.stringify(src.meta?.[k]))) tt.leakMeta++;
            if (res.meta?.['hmV2Edits'] !== undefined) tt.leakEdits++;
            const { hmV2Edits: _e, ...meta } = (c.result as St).meta ?? {};
            out.hashes[key] = sha({ ...c, result: { ...(c.result as object), meta } });
          }
        }
      }
  }
  writeFileSync(new URL(`./hmSource-${TAG}.json`, import.meta.url), JSON.stringify(out, null, 1) + '\n');
}, 3_600_000);

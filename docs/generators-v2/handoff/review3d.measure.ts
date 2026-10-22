/* REVIEW-3 eksperiment D: plan cilja v2 sa prefiksom izvora (HM v2 → 10K v2, 3d-10K) + test 5 km posle predaje →
   prilagođavanje → Napredak/Forma (`tenKV2FormHistory`): broj nedelje u tekstu („tempo od nedelje N", `next.week`)
   prema broju te nedelje u planu za upis (`w`, offset + index, „Nedelja N od M" u kalendaru).
   Iz web/: npx vitest run --config ../docs/generators-v2/handoff/vitest.measure.config.mjs review3d */
import { writeFileSync } from 'node:fs';
import * as select from '../../../web/src/domain/generators/select';
import { shorterOffer } from '../../../web/src/domain/generators/halfMarathon/v2/shorter';
import { generatedPlan, storedPlan } from '../../../web/src/domain/generators/halfMarathon/v2/app/plan';
import { addDays, distOf, sampleBases } from '../final-check/lib';
declare const test: (name: string, fn: () => void, timeout?: number) => void;
type Day = { dow: number; id: string; tag?: string } & Record<string, unknown>;
type St = { weeks: { w: number; start: string; days: Day[] }[]; meta: Record<string, unknown> } & Record<string, unknown>;
test('D', () => {
  const hm = distOf('HM');
  const { bases } = sampleBases(hm, { R: 60, F: 30, B: 10 });
  const out = { targets: 0, withTest: 0, adapted: 0, labelMismatch: 0, nextMismatch: 0, previewWeekOk: 0, ex: [] as unknown[] };
  for (const b of bases) {
    const g = hm.generate(b.input);
    if (!g.ok) continue;
    const p = g.plan;
    const at = p.weeks[2]!.endDate as string;
    const r = hm.adapt(p, hm.facts(p, 'pause35', at), at);
    if (!r.ok || !shorterOffer(r.plan as never, at)) continue;
    const src = select.stampForStorage(storedPlan(generatedPlan(r.plan as never)) as never) as never;
    const prep = select.preparationForPlan(src, { fiveKV2: false, tenKV2: true })!;
    const basis = prep.basisFromPlan(src, at as never)!;
    const c = prep.buildPreparationChoice(src, at as never, basis, { kind: 'shorter', raceDistM: 10000 }, { log: {}, alts: {}, moves: {} } as never);
    if ('error' in c) continue;
    const T = select.stampForStorage(c.result) as unknown as St;
    if (!('tenKV2Prefix' in T)) continue;
    out.targets++;
    const days = T.weeks.flatMap((w) => w.days.map((d) => ({ w: w.w, date: addDays(w.start, d.dow), d })));
    const t = days.find((x) => x.date > at && x.d.tag === 'test');
    if (!t) continue;
    out.withTest++;
    const log: Record<string, unknown> = {};
    for (const x of days) if (x.date > at && x.date < t.date && x.d.kind !== 'rest' && x.d.id) log[x.d.id] = { status: 'done', km: 6, sec: 2100, ts: x.date };
    log[t.d.id] = { status: 'done', km: 9, sec: 3000, ts: t.date, test5kSec: 1380 };
    const pv = select.tenKV2AdaptPreview(T as never, t.date as never, { log, alts: {}, moves: {} } as never) as unknown as { ok: boolean; result: St; weeks: { week: number }[]; reasons: { message: string; applied?: boolean }[]; needed: string[] };
    if (!pv.ok) continue;
    out.adapted++;
    const R = select.stampForStorage(pv.result as never) as unknown as St;
    const off = (R['tenKV2Prefix'] as { offset: number }).offset;
    const f = select.tenKV2FormHistory({ plan: R as never, today: addDays(t.date, 1) as never, log: log as never }) as unknown as { points: { label: string }[]; next: { week: number } | null };
    const lab = f.points.map((x) => x.label).find((l) => / od nedelje (\d+)/.test(l));
    const n = lab ? Number(/ od nedelje (\d+)/.exec(lab)![1]) : null;
    // nedelja posle testa u planu za upis (broj w, kalendar)
    const calWeekAfterTest = R.weeks.find((w) => w.start > t.date)?.w ?? null;
    if (n !== null && calWeekAfterTest !== null && n !== calWeekAfterTest) out.labelMismatch++;
    if (out.ex.length < 3) out.ex.push({ base: b.id, at, test: t.date, testWeekW: t.w, offset: off, label: lab, calWeekAfterTest, next: f.next, previewWeeks: pv.weeks.map((w) => w.week), reasonWeeks: pv.reasons.filter((x) => x.applied).map((x) => x.message).filter((m) => /nedelj/.test(m)), needed: pv.needed });
  }
  writeFileSync((process.env.OUT_DIR ?? '.') + '/review3d.json', JSON.stringify(out, null, 1));
}, 3_600_000);

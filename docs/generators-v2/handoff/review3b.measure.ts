/* REVIEW-3 eksperiment B: HM v2 izvor (4a mreža, pauza 35 d) → 5K v2 / 10K v1 / 5K v1 kroz pravi kod
   (`preparationForPlan` → odluka → izbor), asOf SVAKI dan u 3 nedelje (sredina nedelje, ne samo kraj) i 0–13 dana pre
   trke. Proverava: dupli datum/id, rupa/preklop nedelja, w uzastopan, prošli dani = izvor (id+sadržaj), id izvora na
   drugom datumu (dnevnik na pogrešnom danu), dani asOf+1..start−1 = izvor (O6b), trka u planu.
   Iz web/: npx vitest run --config ../docs/generators-v2/handoff/vitest.measure.config.mjs review3b */
import { writeFileSync } from 'node:fs';
import * as select from '../../../web/src/domain/generators/select';
import { shorterOffer } from '../../../web/src/domain/generators/halfMarathon/v2/shorter';
import { generatedPlan, storedPlan } from '../../../web/src/domain/generators/halfMarathon/v2/app/plan';
import { addDays, distOf, sampleBases } from '../final-check/lib';
declare const process: { env: Record<string, string | undefined> };
declare const test: (name: string, fn: () => void, timeout?: number) => void;
type Day = { dow: number; id?: string } & Record<string, unknown>;
type St = { weeks: { w: number; start: string; days: Day[] }[]; meta?: Record<string, unknown> } & Record<string, unknown>;
const dated = (p: St) => p.weeks.flatMap((w) => w.days.map((d) => ({ date: addDays(w.start, d.dow), d })));
const strip = (d: Day) => JSON.stringify({ ...d, dow: undefined });
const inc = (o: Record<string, number>, k: string) => (o[k] = (o[k] ?? 0) + 1);
test('B', () => {
  const hm = distOf('HM');
  const { bases } = sampleBases(hm, { R: Number(process.env.R ?? 60), F: Number(process.env.F ?? 30), B: Number(process.env.B ?? 10) });
  const T = () => ({ ok: 0, dupDate: 0, dupId: 0, weekGap: 0, wSeq: 0, pastDiff: 0, idOtherDate: 0, gapDaysDiff: 0, noRace: 0, err: {} as Record<string, number>, ex: [] as unknown[] });
  const out = { gen: 0, raceDow: {} as Record<string, number>, flows: 0, offers: 0, raceSat: 0, raceSun: 0, decisions: {} as Record<string, number>, '5K v2': T(), '10K v1': T(), '5K v1': T() };
  for (const b of bases) {
    const shift = Number(process.env.RACE_SHIFT ?? 0);
    const inp = shift ? { ...b.input, raceDate: addDays(String(b.input['raceDate']), shift), startDate: addDays(String(b.input['startDate']), shift) } : b.input;
    const g = hm.generate(inp);
    if (!g.ok) continue;
    out.gen++; inc(out.raceDow, String(new Date(g.plan.input.raceDate + 'T00:00:00Z').getUTCDay()));
    const p = g.plan;
    const N = p.weeks.length;
    const race = p.input.raceDate;
    const dows = new Date(race + 'T00:00:00Z').getUTCDay();
    const ats = new Set<string>();
    for (const wi of [2, Math.floor(N / 2)]) for (let k = 0; k < 7; k++) ats.add(addDays(p.weeks[wi]!.startDate as string, k));
    for (let k = 1; k <= 13; k++) ats.add(addDays(race, -k));
    for (const at of ats) {
      out.flows++;
      const r = hm.adapt(p, hm.facts(p, 'pause35', at), at);
      if (!r.ok || !shorterOffer(r.plan as never, at)) continue;
      out.offers++;
      if (dows === 6) out.raceSat++; if (dows === 0) out.raceSun++;
      const src = select.stampForStorage(storedPlan(generatedPlan(r.plan as never)) as never) as unknown as St;
      const sd = dated(src);
      const byDate = new Map(sd.map((x) => [x.date, x.d]));
      const dateOfId = new Map(sd.map((x) => [x.d.id, x.date]));
      const ctx = { log: {}, alts: {}, moves: {} };
      for (const [flags, names] of [[{ fiveKV2: true }, { 5000: '5K v2', 10000: '10K v1' }], [{ fiveKV2: false }, { 5000: '5K v1', 10000: '10K v1' }]] as const) {
        const prep = select.preparationForPlan(src as never, flags)!;
        if (!prep.isLimitedLongPreparation(src.meta as never, src as never)) { inc(out.decisions, 'notLimited'); continue; }
        const basis = prep.basisFromPlan(src as never, at as never)!;
        const d = prep.preparationDecision(src as never, at as never, basis, ctx as never, 'limited', undefined);
        inc(out.decisions, JSON.stringify(flags) + (d.options.map((o) => o.id).join(',') || '—'));
        for (const dist of [5000, 10000] as const) {
          const name = names[dist];
          if (flags.fiveKV2 === false && dist === 10000) continue; // isti 10K v1 već brojan
          const t = out[name];
          const c = prep.buildPreparationChoice(src as never, at as never, basis, { kind: 'shorter', raceDistM: dist }, ctx as never);
          if ('error' in c) { inc(t.err, c.error.slice(0, 70)); continue; }
          t.ok++;
          const res = select.stampForStorage(c.result) as unknown as St;
          const rd = dated(res);
          const bad: string[] = [];
          if (new Set(rd.map((x) => x.date)).size !== rd.length) { t.dupDate++; bad.push('dupDate'); }
          if (new Set(rd.map((x) => x.d.id)).size !== rd.length) { t.dupId++; bad.push('dupId'); }
          for (let i = 1; i < res.weeks.length; i++) {
            if (addDays(res.weeks[i - 1]!.start, 7) !== res.weeks[i]!.start) { t.weekGap++; bad.push('weekGap@' + i); break; }
          }
          for (let i = 1; i < res.weeks.length; i++) if (res.weeks[i]!.w !== res.weeks[i - 1]!.w + 1) { t.wSeq++; bad.push('wSeq@' + i + ':' + res.weeks[i - 1]!.w + '→' + res.weeks[i]!.w); break; }
          if (rd.some((x) => x.date <= at && (!byDate.has(x.date) || strip(byDate.get(x.date)!) !== strip(x.d)))) { t.pastDiff++; bad.push('pastDiff'); }
          if (rd.some((x) => x.d.id && dateOfId.has(x.d.id) && dateOfId.get(x.d.id) !== x.date)) { t.idOtherDate++; bad.push('idOtherDate'); }
          if (name === '5K v2') {
            const pre = res['fiveKV2Prefix'] as { weeks: { start: string }[] };
            const start = addDays(pre.weeks[pre.weeks.length - 1]!.start, 7);
            if (rd.some((x) => x.date > at && x.date < start && (!byDate.has(x.date) || strip(byDate.get(x.date)!) !== strip(x.d)))) { t.gapDaysDiff++; bad.push('gapDaysDiff'); }
          }
          const last = res.weeks[res.weeks.length - 1]!;
          if (!(last.start <= race && addDays(last.start, 6) >= race)) { t.noRace++; bad.push('noRace'); }
          if (bad.length && t.ex.length < 3) t.ex.push({ base: b.id, at, race, bad, srcStart: src.weeks[0]!.start, resWeeks: res.weeks.map((w) => [w.w, w.start]) });
        }
      }
    }
  }
  writeFileSync('/tmp/claude-0/-home-user-sub-19/937e1701-d1dc-5134-b9ff-d6884fb03dcc/scratchpad/review3b' + (process.env.RACE_SHIFT ?? '') + '.json', JSON.stringify(out, null, 1));
}, 3_600_000);

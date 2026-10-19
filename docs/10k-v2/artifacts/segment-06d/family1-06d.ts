/* Segment 06d: dokaz porodice 1 (prošlost = upisani dani) za promenjene prihvaćene tokove. Po toku: nedelje i dani
   koji se razlikuju pre (<koren pre>) / posle (ovaj repozitorijum) i zaštićeni prošli dani (≤ asOf) čiji se SASTAVLJENI oblik
   (construct bez prior = stara prošlost) razlikuje od UPISANOG (prethodni plan). Pokretanje iz web/:
     node ../docs/10k-v2/artifacts/segment-06d/family1-06d.ts <koren pre> <ključevi.json> <izlaz.json>
   Ključ: 04/<plan>/<asOf>/<scenario> (mreža 04) ili S|N7/<plan>/<w#wed|w#end|w#end-3>/<scenario> (measure-06d). */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const [rootBefore, keysFile, outFile] = process.argv.slice(2);
const HERE = new URL('../../../../web/src/domain/generators/tenK/v2/', import.meta.url).href;
const O = `${resolve(rootBefore!)}/web/src/domain/generators/tenK/v2/`;
const T = await import(HERE + 'testInputs.ts');
const N = {
  gen: await import(HERE + 'generate.ts'),
  adapt: (await import(HERE + 'adapt.ts')).adaptTenKV2
};
const oldAdapt = (await import(O + 'adapt.ts')).adaptTenKV2;
const { adaptInvariants } = await import(HERE + 'adaptInvariants.ts');
const { addDays, weekdayOf, mustDay } = await import(HERE + 'dates.ts');
const keys: string[] = JSON.parse(readFileSync(keysFile!, 'utf8'));
const all = [
  ...T.gridInputs(),
  ...([3, 4, 5, 6] as const).flatMap((d) => T.feelGridInputs(d)),
  ...([3, 4] as const).flatMap((d) => T.beginnerGridInputs(d)),
  ...T.adaptBases()
];
const back = (a: string, n: number) => addDays(a, -n);
const sFacts: Record<string, (p: any, a: string) => unknown> = {
  pause10: (_p, a) => ({
    breaks: [{ kind: 'break', from: back(a, 9), to: a }]
  }),
  pause20: (_p, a) => ({
    breaks: [{ kind: 'break', from: back(a, 19), to: a }]
  }),
  pause35: (_p, a) => ({
    breaks: [{ kind: 'break', from: back(a, 34), to: a }]
  }),
  pain5: (_p, a) => T.painFacts(a, 5),
  pain8: (_p, a) => T.painFacts(a, 8),
  pause10pain5: (_p, a) => ({
    breaks: [{ kind: 'break', from: back(a, 9), to: a }],
    ...T.painFacts(a, 5)
  }),
  under: (p, a) => ({
    workouts: T.runsIn(p, back(a, 6), back(a, 6)),
    coverage: { from: back(a, 6), to: a, complete: true }
  }),
  over: (p, a) => ({
    workouts: T.runsIn(p, back(a, 6), a, 1.2),
    coverage: { from: back(a, 6), to: a, complete: true }
  }),
  fatigue: (p, a) => T.reliefFacts(p, 'fatigue', a),
  test5k: (p, a) => T.factsOf(p, 'test5k', a),
  faster: (p, a) => T.factsOf(p, 'faster', a),
  slower: (p, a) => T.factsOf(p, 'slower', a)
};
const dayStr = (d: any) =>
  d
    ? `${d.role}:${d.workout.km}${d.workout.dose ? `[${d.workout.dose.zone}${d.workout.dose.doseM}]` : ''}`
    : '—';
const res: any[] = [];
let explained = 0;
for (const key of keys) {
  const [g, id, tag, s] = key.split('/');
  const p0 = N.gen.generateTenKV2(all.find((x: any) => x.id === id)!.input).plan;
  let asOf: string;
  let facts: unknown;
  if (g === '04') {
    asOf = T.asOfOf(p0, tag);
    facts = T.factsOf(p0, s, asOf);
  } else {
    const wk = p0.weeks[+tag!.match(/\d+/)![0] - 1];
    asOf = tag!.endsWith('end-3') ? back(wk.endDate, 3) : wk.endDate;
    if (tag!.endsWith('wed')) {
      asOf = wk.startDate;
      while (weekdayOf(asOf) !== 'wed') asOf = addDays(asOf, 1);
    }
    facts = sFacts[s!]!(p0, asOf);
  }
  let a = N.adapt(p0, facts, asOf);
  let o = oldAdapt(p0, facts, asOf);
  let base = p0;
  if (s === 'chain') {
    // Lanac (mreža 04): drugi korak 7 dana kasnije, manjak 50 % poslednjih 7 dana; prošlost drugog koraka je
    // plan posle prvog (novi kod).
    const a2 = addDays(asOf, 7);
    const cf = (p: any) => ({
      workouts: [
        ...T.runsIn(p, addDays(a2, -13), addDays(a2, -7)),
        ...T.runsIn(p, addDays(a2, -6), a2, 0.5)
      ],
      coverage: { from: addDays(a2, -13), to: a2, complete: true }
    });
    base = a.plan;
    facts = cf(a.plan);
    a = N.adapt(a.plan, facts, a2);
    o = oldAdapt(o.plan, cf(o.plan), a2);
    asOf = a2;
  }
  if (!a.ok || !o.ok) throw new Error(`${key}: nije prihvaćen`);
  // Sastavljena prošlost = construct bez prior (stari put).
  const c0 = N.gen.construct(p0.input, a.plan.adaptation.steps);
  const t = mustDay(asOf);
  const pastDiff: string[] = [];
  if (c0.ok)
    for (const w of base.weeks)
      for (const d of w.days)
        if (mustDay(d.date) <= t) {
          const cd = c0.plan.weeks[w.index - 1].days.find((x: any) => x.date === d.date);
          if (JSON.stringify(cd) !== JSON.stringify(d))
            pastDiff.push(
              `ned ${w.index} ${d.date}: upisano ${dayStr(d)} / sastavljeno ${dayStr(cd)}`
            );
        }
  const changed: string[] = [];
  a.plan.weeks.forEach((w: any, i: number) => {
    const ow = o.plan.weeks[i];
    if (JSON.stringify(w.days) !== JSON.stringify(ow.days))
      changed.push(
        `ned ${w.index} (${w.phase}): ${ow.days.map(dayStr).join(' ')} → ${w.days.map(dayStr).join(' ')}`
      );
  });
  if (pastDiff.length > 0) explained++;
  // Smer promene (posle asOf): dugi tapera, doza rasterećenja i tapera (zbir m kvaliteta), dugi rasterećenja.
  const after = (p: any) => p.weeks.filter((w: any) => mustDay(w.endDate) > t);
  const long = (w: any) => w?.days.find((d: any) => d.role === 'long')?.workout.km ?? 0;
  const dose = (w: any) =>
    w.days.reduce((x: number, d: any) => x + (d.workout.dose?.doseM ?? 0), 0);
  const cmp = (x: number, y: number) => (y > x ? 'viši' : y < x ? 'niži' : 'isti');
  const tw = (p: any) => after(p).find((w: any) => w.phase === 'taper');
  const dl = (p: any) => after(p).filter((w: any) => w.deload);
  const dir = {
    taperLong: tw(o.plan) && tw(a.plan) ? cmp(long(tw(o.plan)), long(tw(a.plan))) : 'nema',
    taperDose: tw(o.plan) && tw(a.plan) ? cmp(dose(tw(o.plan)), dose(tw(a.plan))) : 'nema',
    deloadDose: dl(o.plan).length
      ? cmp(
          dl(o.plan).reduce((x: number, w: any) => x + dose(w), 0),
          dl(a.plan).reduce((x: number, w: any) => x + dose(w), 0)
        )
      : 'nema',
    deloadLong: dl(o.plan).length
      ? cmp(
          dl(o.plan).reduce((x: number, w: any) => x + long(w), 0),
          dl(a.plan).reduce((x: number, w: any) => x + long(w), 0)
        )
      : 'nema',
    buildDose: cmp(
      after(o.plan)
        .filter((w: any) => !w.deload && w.phase !== 'taper' && w.phase !== 'race')
        .reduce((x: number, w: any) => x + dose(w), 0),
      after(a.plan)
        .filter((w: any) => !w.deload && w.phase !== 'taper' && w.phase !== 'race')
        .reduce((x: number, w: any) => x + dose(w), 0)
    )
  };
  const inv = adaptInvariants(base, a.plan, asOf, facts as any);
  res.push({
    key,
    asOf,
    pastDiff: pastDiff.slice(0, 4),
    changed: changed.slice(0, 3),
    dir,
    inv: inv.slice(0, 3)
  });
}
const dist: Record<string, Record<string, number>> = {};
for (const r of res)
  for (const [k, v] of Object.entries(r.dir))
    (dist[k] ??= {})[v as string] = (dist[k]![v as string] ?? 0) + 1;
const invBad = res.filter((r) => r.inv.length > 0).map((r) => `${r.key}: ${r.inv.join(' | ')}`);
writeFileSync(
  outFile!,
  JSON.stringify({ flows: res.length, explained, dist, invBad, res }, null, 1) + '\n'
);
console.log(JSON.stringify(dist), 'Uslov 8 (adaptInvariants) prekršaja:', invBad.length);
console.log(res.length, 'objašnjeno', explained);

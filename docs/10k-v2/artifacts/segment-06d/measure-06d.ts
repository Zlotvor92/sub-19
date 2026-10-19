/* Segment 06d (10k-v2.5.1, N7): merenje odbijanja adaptacije rano i sredinom plana, tok po tok. Pokretanje iz web/:
     node ../docs/10k-v2/artifacts/segment-06d/measure-06d.ts <izlaz.json> [<koren checkouta>]
   <koren checkouta> (podrazumevano ovaj repozitorijum) = čiji se tenK/v2 meri (pre izmene: git worktree vrha
   grane, `ln -s "$PWD/node_modules" <wt>/web/node_modules`). Radi u 4 procesa (deo i/4 po indeksu plana).

   Dve mreže:
   - N7 (pretraga organizatora): feelGridInputs(3..6) svaki 7.; asOf = kraj nedelje w i kraj − 3, w = 1 … (nedelja
     testa − 1); pause10, pause20, pain5, pain8, pause10pain5, under = 61 104 toka.
   - S (šira): gridInputs svaki 12., feel svaki 7., beginner svaki 3.; asOf = sreda i kraj svake nedelje 1 … N − 2;
     pause10, pause20, pause35, pain5, pain8, pause10pain5, under, over (120 % poslednjih 7 dana), fatigue,
     test5k, faster, slower (testInputs.factsOf / reliefFacts).
   Po toku: prihvaćen → heš bez oznake verzije (testInputs.planHash06c); odbijen → klasa (K1: VOLUME_RULE „bez
   oznake" u rasterećenju sa testom osnovnog plana; K2: TAPER_LONG; inače „novo:<pravila>") + primer. Izlaz: zbir po
   mreži/scenariju/klasi, primeri, heševi po toku (za regresiju, compare-06d.ts). */

import { fork } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SHARDS = 4;
const [outArg, rootArg, shardArg] = process.argv.slice(2);
const ROOT = resolve(rootArg ?? fileURLToPath(new URL('../../../../', import.meta.url)));
const V = `${ROOT}/web/src/domain/generators/tenK/v2/`;

type Flow = {
  key: string;
  grid: 'N7' | 'S';
  scen: string;
  ok: boolean;
  hash?: number;
  cls?: string;
  ex?: string;
};

async function runShard(shard: number): Promise<Flow[]> {
  const { generateTenKV2 } = await import(V + 'generate.ts');
  const { adaptTenKV2 } = await import(V + 'adapt.ts');
  const { addDays, weekdayOf } = await import(V + 'dates.ts');
  const T = await import(V + 'testInputs.ts');
  const back = (a: string, n: number): string => addDays(a, -n);
  const brk = (a: string, n: number) => [{ kind: 'break', from: back(a, n - 1), to: a }];
  const scen: Record<string, (p: any, a: string) => unknown> = {
    pause10: (_p, a) => ({ breaks: brk(a, 10) }),
    pause20: (_p, a) => ({ breaks: brk(a, 20) }),
    pause35: (_p, a) => ({ breaks: brk(a, 35) }),
    pain5: (_p, a) => T.painFacts(a, 5),
    pain8: (_p, a) => T.painFacts(a, 8),
    pause10pain5: (_p, a) => ({ breaks: brk(a, 10), ...T.painFacts(a, 5) }),
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
  const N7_SCEN = ['pause10', 'pause20', 'pain5', 'pain8', 'pause10pain5', 'under'];
  const every = <X>(xs: X[], n: number): X[] => xs.filter((_, i) => i % n === 0);
  const feel = every(
    ([3, 4, 5, 6] as const).flatMap((d) => T.feelGridInputs(d)),
    7
  );
  const plans: { id: string; input: unknown; n7: boolean }[] = [
    ...every(T.gridInputs(), 12).map((c: any) => ({
      id: c.id,
      input: c.input,
      n7: false
    })),
    ...feel.map((c: any) => ({ id: c.id, input: c.input, n7: true })),
    ...every(
      ([3, 4] as const).flatMap((d) => T.beginnerGridInputs(d)),
      3
    ).map((c: any) => ({ id: c.id, input: c.input, n7: false }))
  ];
  // MEASURE_FAMILY=R|F|B: samo planovi te porodice (ponovljeno merenje dela mreže posle izmene koja dira samo nju).
  const fam = process.env['MEASURE_FAMILY'];
  const famOf = (id: string): string =>
    id.startsWith('f-') ? 'F' : id.startsWith('b-') ? 'B' : 'R';
  const out: Flow[] = [];
  const classify = (p0: any, r: any): { cls: string; ex: string } => {
    const errs: { rule: string; message: string; week?: number }[] = r.violations?.length
      ? r.violations.filter((v: any) => v.severity === 'error')
      : r.reasons.map((x: any) => {
          const m = /^([A-Z_0-9]+): (.*)$/.exec(x.message);
          return m
            ? { rule: m[1]!, message: m[2]!, week: x.week }
            : { rule: x.code, message: x.message, week: x.week };
        });
    const k1 = (e: any) =>
      e.rule === 'VOLUME_RULE' &&
      /bez oznake/.test(e.message) &&
      p0.weeks[e.week - 1]?.deload &&
      p0.weeks[e.week - 1]?.test;
    const rules = [
      ...new Set(errs.map((e) => (k1(e) ? 'K1' : e.rule === 'TAPER_LONG' ? 'K2' : e.rule)))
    ].sort();
    const cls = rules.every((x) => x === 'K1' || x === 'K2')
      ? rules.join('+')
      : `novo:${rules.join('+')}`;
    return {
      cls,
      ex: errs.map((e) => `ned ${e.week ?? '—'} ${e.rule}: ${e.message}`).join(' | ')
    };
  };
  const run = (grid: 'N7' | 'S', id: string, p0: any, s: string, a: string, tag: string): void => {
    const r = adaptTenKV2(p0, scen[s]!(p0, a), a);
    const key = `${grid}/${id}/${tag}/${s}`;
    if (r.ok) out.push({ key, grid, scen: s, ok: true, hash: T.planHash06c(r) });
    else out.push({ key, grid, scen: s, ok: false, ...classify(p0, r) });
  };
  plans.forEach((c, i) => {
    if (i % SHARDS !== shard || (fam && famOf(c.id) !== fam)) return;
    const g = generateTenKV2(c.input);
    if (!g.ok) throw new Error(`generate ${c.id}`);
    const p0 = g.plan;
    const N = p0.weeks.length;
    if (c.n7) {
      const tw = p0.weeks.find((w: any) => w.test)?.index;
      if (tw)
        for (let w = 1; w < tw; w++) {
          const end = p0.weeks[w - 1].endDate;
          for (const [tag, a] of [
            [`w${w}end`, end],
            [`w${w}end-3`, back(end, 3)]
          ] as const)
            for (const s of N7_SCEN) run('N7', c.id, p0, s, a, tag);
        }
    }
    for (let w = 1; w <= N - 2; w++) {
      const wk = p0.weeks[w - 1];
      let wed = wk.startDate;
      while (weekdayOf(wed) !== 'wed') wed = addDays(wed, 1);
      for (const [tag, a] of [
        [`w${w}wed`, wed],
        [`w${w}end`, wk.endDate]
      ] as const)
        for (const s of Object.keys(scen)) run('S', c.id, p0, s, a, tag);
    }
  });
  return out;
}

if (shardArg !== undefined) {
  const flows = await runShard(Number(shardArg));
  process.send!(flows, () => process.exit(0));
} else {
  const t0 = Date.now();
  const self = fileURLToPath(import.meta.url);
  const parts = await Promise.all(
    Array.from(
      { length: SHARDS },
      (_, i) =>
        new Promise<Flow[]>((res, rej) => {
          const ch = fork(self, [outArg ?? '-', ROOT, String(i)], {
            serialization: 'advanced'
          });
          ch.on('message', (m) => res(m as Flow[]));
          ch.on('exit', (code) => code !== 0 && rej(new Error(`deo ${i}: izlaz ${code}`)));
        })
    )
  );
  const flows = parts.flat().sort((a, b) => (a.key < b.key ? -1 : 1));
  const stat: Record<string, Record<string, number>> = {};
  const examples: Record<string, string[]> = {};
  for (const f of flows) {
    const g = (stat[`${f.grid}/${f.scen}`] ??= { tokova: 0, odbijeno: 0 });
    g.tokova!++;
    const t = (stat[`${f.grid}/UKUPNO`] ??= { tokova: 0, odbijeno: 0 });
    t.tokova!++;
    if (f.ok) continue;
    g.odbijeno!++;
    t.odbijeno!++;
    g[f.cls!] = (g[f.cls!] ?? 0) + 1;
    t[f.cls!] = (t[f.cls!] ?? 0) + 1;
    const e = (examples[`${f.grid}/${f.cls}`] ??= []);
    if (e.length < 6) e.push(`${f.key}: ${f.ex}`);
  }
  const hashes = Object.fromEntries(flows.map((f) => [f.key, f.ok ? f.hash : `X:${f.cls}`]));
  const sec = Math.round((Date.now() - t0) / 1000);
  writeFileSync(
    resolve(outArg!),
    JSON.stringify({ root: ROOT, sec, stat, examples, hashes }) + '\n'
  );
  console.log(JSON.stringify({ sec, stat, examples }, null, 1));
}

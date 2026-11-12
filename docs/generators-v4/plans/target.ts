/* Poređenje V4 sa ciljnim planovima trenera (docs/generators-v2/perfection/target/HM/, krug 3: META).
   Pokretanje iz korena:  node docs/generators-v4/plans/target.ts [--md]
   Po nedelji: km, dugi (km), blok u dugom (km), kvaliteti (vrsta i minuti rada) — cilj / V4 / razlika, i provera
   tolerancija organizatora: km ± 8 %, dugi ± 1,5 km, isti broj i vrsta kvaliteta, doza ± 20 %. */
import { registerHooks } from 'node:module';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

registerHooks({
  resolve(specifier, context, next) {
    try {
      return next(specifier, context);
    } catch (error) {
      if (specifier.startsWith('.')) return next(`${specifier}.ts`, context);
      throw error;
    }
  }
});
const here = dirname(fileURLToPath(import.meta.url));
const v4 = join(here, '../../../web/src/domain/v4');
const E = await import(join(v4, 'engine/index.ts'));
const { estimateForm } = await import(join(v4, 'fitness/index.ts'));
const { hm } = await import(join(v4, 'distances/hm/index.ts'));
const { PROFILES, factsOf } = await import(join(v4, 'distances/hm/testdata/profiles.ts'));

/* eslint-disable @typescript-eslint/no-explicit-any */
type Any = any;
/** Kvalitet: R brzina/brda, T prag, I intervali, RP tempo trke, O oštrenje, X provera/trka; broj = min rada (0 = bez doze). */
type Q = [string, number];
type W = [number, number, number, Q[]]; // km, dugi km, blok km, kvaliteti
const TARGETS: Record<string, W[]> = {
  p01: [
    [40, 15, 0, [['R', 0], ['T', 14]]], [42, 16, 0, [['R', 0], ['T', 19]]], [44, 17, 0, [['R', 0], ['T', 24]]],
    [35, 14, 0, [['T', 9]]], [47, 18, 0, [['R', 0], ['T', 24]]], [50, 19, 0, [['I', 17], ['T', 28]]],
    [52, 20, 0, [['I', 22], ['T', 28]]], [42, 12, 0, [['R', 0], ['X', 0]]], [55, 21, 0, [['T', 33]]],
    [55, 20, 6, [['RP', 29]]], [55, 22, 0, [['RP', 39], ['T', 23]]], [44, 16, 0, [['T', 14]]],
    [56, 21, 10, [['RP', 44]]], [50, 18, 4, [['RP', 29], ['T', 14]]], [38, 13, 0, [['RP', 24], ['T', 9]]],
    [18, 0, 0, [['O', 12]]]
  ],
  p04: [
    [54, 16, 0, [['R', 0], ['T', 23]]], [55, 17, 0, [['R', 0], ['T', 28]]], [56, 18, 0, [['R', 0], ['T', 28]]],
    [45, 14, 0, [['T', 17]]], [57, 18, 0, [['R', 0], ['T', 34]]], [58, 19, 0, [['R', 0], ['T', 34]]],
    [59, 19, 0, [['R', 0], ['T', 34]]], [47, 12, 0, [['R', 0], ['X', 0]]], [60, 19, 0, [['I', 16], ['T', 34]]],
    [61, 20, 0, [['I', 20], ['T', 28]]], [62, 17, 0, [['I', 16], ['T', 34]]], [50, 15, 0, [['T', 17]]],
    [63, 20, 4, [['RP', 24]]], [63, 17, 0, [['RP', 35], ['T', 28]]], [63, 20, 6, [['RP', 35]]],
    [50, 15, 0, [['T', 17]]], [63, 21, 8, [['RP', 35]]], [56, 17, 4, [['RP', 29], ['T', 17]]],
    [43, 12, 0, [['RP', 21], ['T', 11]]], [20, 0, 0, [['O', 12]]]
  ],
  p11: [
    [20, 8, 0, []], [21.5, 9, 0, []], [23, 9.5, 0, []], [18, 7.5, 0, []], [24.5, 10, 0, [['T', 10]]],
    [26, 11, 0, [['T', 10]]], [27.5, 12, 0, [['T', 15]]], [22, 9, 0, []], [29, 12.5, 0, [['T', 16]]],
    [31, 13.5, 0, [['T', 15]]], [33, 14.5, 0, [['T', 18]]], [26, 8, 0, [['X', 0]]], [34, 15, 0, [['T', 20]]],
    [37, 16, 0, [['T', 20]]], [38, 14, 3, [['RP', 24]]], [30, 11, 0, [['T', 10]]], [40, 17.5, 0, [['RP', 24]]],
    [36, 14, 4, [['RP', 26]]], [27, 10, 0, [['RP', 14]]], [12, 0, 0, [['O', 6]]]
  ],
  p12: [
    [45, 14, 0, []], [47, 15, 0, []], [49, 16, 0, [['T', 12]]], [39, 12, 0, [['X', 0]]], [51, 16.5, 0, [['T', 17]]],
    [53, 17, 0, [['T', 18]]], [55, 18, 0, [['T', 19]]], [44, 11, 0, [['X', 0]]], [57, 18.5, 0, [['T', 23]]],
    [59, 19, 0, [['T', 28]]], [59, 17, 3, [['RP', 24]]], [47, 14, 0, [['T', 12]]], [59, 19, 5, [['RP', 37]]],
    [53, 16, 0, [['RP', 31]]], [41, 11, 0, [['RP', 22]]], [19, 0, 0, [['O', 6]]]
  ]
};
const KIND: Record<string, string> = {
  brzina: 'R', prag: 'T', 'prag-p': 'T', intervali: 'I', 'tempo-trke': 'RP', ostrenje: 'O',
  kontrola: 'X', 'kontrola-rana': 'X'
};
const f = (x: number): string => (Math.round(x * 10) / 10).toFixed(1).replace('.', ',').replace(',0', '');
const md = process.argv.includes('--md');
const lines: string[] = [];
let totalOk = 0;
let total = 0;
for (const id of Object.keys(TARGETS)) {
  const p = PROFILES.find((x: Any) => x.id === id);
  const state = E.buildState(factsOf(p), p.goal, hm, estimateForm);
  const res = E.plan(state, p.goal, hm);
  const doc = res.doc;
  const ctx = E.paceCtxOf(doc.header);
  lines.push(`### ${id}`, '', '| ned | km cilj/V4 | dugi | blok | kvalitet cilj | kvalitet V4 | odstupa |', '|---|---|---|---|---|---|---|');
  TARGETS[id]?.forEach((t, i) => {
    const w = doc.weeks[i];
    let km = 0; let long = 0; let block = 0;
    const qs: Q[] = [];
    for (const d of w.days) {
      const x = d.workout;
      if (x === null || x.kind === 'race') continue;
      const c = E.summarize(x, ctx);
      km += c.km;
      if (x.kind === 'long') { long = c.km; if (x.stimulus === 'dugi-rp') block = (c.workSec / 60) / (ctx.paces.RP / 60); }
      if (x.kind === 'quality' || x.kind === 'test') qs.push([KIND[x.stimulus ?? ''] ?? '?', Math.round(c.workSec / 60)]);
    }
    const bad: string[] = [];
    if (Math.abs(km - t[0]) > 0.08 * t[0]) bad.push('km');
    if (Math.abs(long - t[1]) > 1.5) bad.push('dugi');
    if (Math.abs(block - t[2]) > 1.5) bad.push('blok');
    const want = t[3].map((q) => q[0]).sort().join('+');
    const got = qs.map((q) => q[0]).sort().join('+');
    if (want !== got) bad.push('vrsta');
    else for (const q of t[3]) {
      if (q[1] === 0) continue;
      const g = qs.find((x) => x[0] === q[0]);
      if (g !== undefined && Math.abs(g[1] - q[1]) > 0.2 * q[1]) bad.push(`doza ${q[0]}`);
    }
    total += 1;
    if (bad.length === 0) totalOk += 1;
    const qt = (a: Q[]): string => a.map((q) => (q[1] > 0 ? `${q[0]} ${String(q[1])}` : q[0])).join(', ') || '—';
    lines.push(`| ${String(i + 1)} | ${f(t[0])} / ${f(km)} | ${f(t[1])} / ${f(long)} | ${f(t[2])} / ${f(block)} | ${qt(t[3])} | ${qt(qs)} | ${bad.join(', ') || '✔'} |`);
  });
  lines.push('');
}
lines.push(`Nedelja u svim tolerancijama: ${String(totalOk)} od ${String(total)}.`);
const text = lines.join('\n');
if (md) writeFileSync(join(here, 'HM/target-compare.md'), `# V4 prema ciljnim planovima trenera\n\n${text}\n`);
console.log(text);

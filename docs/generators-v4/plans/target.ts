/* Poređenje V4 sa ciljnim planovima trenera (polumaraton: docs/generators-v2/perfection/target/HM/, krug 3: META;
   10 km: docs/generators-v4/coach/target/10K/; 5 km: coach/target/5K/). Pokretanje iz korena:
   node docs/generators-v4/plans/target.ts [--dist tenk|fivek] [--md]
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
const { loadDist } = await import(join(here, 'dist.ts'));
const D = await loadDist(v4, process.argv);
const hm = D.data;
const { PROFILES, factsOf } = D;

/* eslint-disable @typescript-eslint/no-explicit-any */
type Any = any;
/** Kvalitet: R brzina/brda, T prag, I intervali, RP tempo trke, O oštrenje, X provera/trka; broj = min rada (0 = bez doze). */
type Q = [string, number];
type W = [number, number, number, Q[]]; // km, dugi km, blok km, kvaliteti
const TARGETS_HM: Record<string, W[]> = {
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
/* 10 km (coach/target/10K/p01, p03, p06, p11): „blok" = završnica u dugom (km u pragu ili tempu trke); brzina i
   usponi bez doze; usponi kao dodatak lakog dana se ne broje kao kvalitet */
const TARGETS_TENK: Record<string, W[]> = {
  p01: [
    [40, 13, 0, [['R', 0], ['T', 14]]], [42, 14, 0, [['R', 0], ['T', 16]]], [44, 15, 0, [['R', 0], ['T', 19]]],
    [35, 12, 0, [['T', 9]]], [46, 15.5, 0, [['R', 0], ['T', 23]]], [48, 16, 0, [['I', 14], ['T', 24]]],
    [50, 16.5, 0, [['I', 17], ['T', 28]]], [40, 13, 0, [['T', 14]]], [52, 17, 0, [['I', 22], ['T', 28]]],
    [44, 12, 0, [['R', 0], ['X', 0]]], [50, 16, 3, [['RP', 23]]], [41, 13, 0, [['RP', 14]]],
    [53, 16, 3, [['RP', 28], ['I', 17]]], [49, 15, 0, [['RP', 29], ['T', 14]]], [38, 12, 0, [['RP', 14], ['T', 12]]],
    [17, 0, 0, [['O', 11]]]
  ],
  p03: [
    [20, 9, 0, [['T', 12]]], [21.5, 9.5, 0, [['T', 12]]], [23, 10, 0, [['T', 18]]], [18, 8, 0, [['T', 10]]],
    [24.5, 10.5, 0, [['T', 19]]], [26, 11.5, 0, [['T', 18]]], [27.5, 12.5, 1.3, [['T', 24]]], [21, 8, 0, [['X', 0]]],
    [28, 12.5, 1.7, [['RP', 21]]], [26, 11.5, 0, [['RP', 19]]], [20, 9, 0, [['RP', 12]]], [9, 0, 0, [['O', 6]]]
  ],
  p06: [
    [30, 10, 0, [['R', 0], ['T', 11]]], [32, 11, 0, [['I', 8], ['T', 15]]], [35, 12, 0, [['I', 14], ['T', 19]]],
    [37, 13, 2.7, [['RP', 17], ['T', 23]]], [30, 10, 0, [['R', 0], ['X', 0]]], [39, 13, 2.7, [['RP', 22]]],
    [31, 10, 0, [['RP', 11], ['T', 10]]], [14, 0, 0, [['O', 9]]]
  ],
  p11: [
    [15, 6.5, 0, []], [16, 7, 0, []], [17, 7.5, 0, []], [14, 6, 0, []], [18, 8, 0, [['T', 10]]],
    [19, 8.5, 0, [['T', 6]]], [20, 9, 0, [['T', 10]]], [16, 7, 0, []], [21, 9.5, 0, [['T', 15]]],
    [22.5, 10, 0, [['T', 16]]], [24, 10.5, 0, [['T', 15]]], [18, 7, 0, [['X', 0]]], [25.5, 11.5, 0, [['T', 18]]],
    [26, 12, 0, [['RP', 17]]], [27, 12, 1.8, [['RP', 22]]], [24, 10.5, 0, [['RP', 18]]], [19, 8, 0, [['RP', 11]]],
    [8, 0, 0, [['O', 3]]]
  ]
};
/* 5 km (coach/target/5K/p01, p04, p08, p11): „blok" = završnih 8–10 min dugog u pragu (km); brzina, usponi 45 s i R u
   rasterećenju bez doze; lagan dan sa ubrzanjima/usponima nije kvalitet; fartlek početnika je T */
const TARGETS_FIVEK: Record<string, W[]> = {
  p01: [
    [40, 13, 0, [['R', 0], ['T', 14]]], [42, 14, 0, [['R', 0], ['T', 19]]], [44, 15, 0, [['R', 0], ['T', 23]]],
    [35, 12, 0, [['R', 0]]], [45, 15, 0, [['I', 14], ['T', 19]]], [47, 16, 0, [['I', 17], ['T', 23]]],
    [48, 16, 2.1, [['I', 22], ['T', 23]]], [37, 10, 0, [['R', 0], ['X', 0]]], [45, 15, 0, [['RP', 22]]],
    [43, 14, 0, [['RP', 20], ['R', 0]]], [34, 11, 0, [['RP', 13], ['T', 10]]], [16, 0, 0, [['O', 7]]]
  ],
  p04: [
    [44, 11, 0, [['R', 0], ['T', 14]]], [45, 11.5, 0, [['R', 0], ['T', 23]]], [46, 12, 0, [['R', 0], ['T', 27]]],
    [37, 9.5, 0, [['R', 0]]], [46, 12.5, 0, [['R', 10], ['T', 23]]], [47, 13, 0, [['R', 0], ['T', 28]]],
    [48, 13.5, 0, [['R', 12], ['T', 28]]], [38, 9, 0, [['R', 0], ['X', 0]]], [47, 14, 0, [['I', 12]]],
    [49, 14, 0, [['I', 18], ['T', 23]]], [50, 14, 1.8, [['I', 20], ['T', 23]]], [40, 10, 0, [['I', 8]]],
    [49, 13, 0, [['RP', 22], ['R', 12]]], [46, 12, 0, [['RP', 20], ['R', 0]]], [38, 10, 0, [['RP', 13], ['T', 9]]],
    [20, 0, 0, [['O', 9]]]
  ],
  p08: [
    [32, 13, 0, [['R', 0]]], [33, 13.5, 0, [['T', 14]]], [34, 14, 0, [['R', 0], ['T', 14]]], [27, 11, 0, [['R', 0]]],
    [34, 14, 1.7, [['T', 19]]], [35, 14.5, 0, [['R', 10], ['T', 14]]], [35, 15, 2.1, [['T', 22]]],
    [28, 10, 0, [['X', 0]]], [35, 14, 0, [['I', 14], ['T', 14]]], [36, 15, 0, [['I', 17]]],
    [36, 15, 2.1, [['I', 21]]], [28, 11, 0, [['I', 9]]], [35, 14, 0, [['RP', 22], ['R', 7]]],
    [33, 13, 0, [['RP', 19]]], [27, 11, 0, [['RP', 13]]], [11, 0, 0, [['O', 7]]]
  ],
  p11: [
    [12, 5, 0, []], [13, 5.5, 0, []], [14, 6, 0, []], [11, 5, 0, []], [15, 6.5, 0, [['T', 5]]], [16, 7, 0, []],
    [17, 7.5, 0, [['T', 10]]], [13, 5, 0, [['X', 0]]], [17.5, 8, 0, [['T', 12]]], [18.5, 8.5, 0, [['T', 12]]],
    [19.5, 9, 0, [['T', 15]]], [15, 7, 0, []], [19, 8.5, 0, [['RP', 17]]], [18, 8, 0, [['RP', 16]]],
    [14, 6, 0, [['RP', 10]]], [6, 0, 0, [['O', 3]]]
  ]
};
const TARGETS = D.key === 'hm' ? TARGETS_HM : D.key === 'fivek' ? TARGETS_FIVEK : TARGETS_TENK;
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
      if (x.kind === 'long') { long = c.km; if (x.stimulus === 'dugi-rp') block = (c.workSec / 60) / (ctx.paces.RP / 60); if (x.stimulus === 'dugi-prag') block = (c.workSec / 60) / (ctx.paces.T / 60); }
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
if (md) writeFileSync(join(here, D.outDir, 'target-compare.md'), `# V4 prema ciljnim planovima trenera${D.key === 'hm' ? '' : ` — ${D.name}`}\n\n${text}\n`);
console.log(text);

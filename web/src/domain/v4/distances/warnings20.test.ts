/* R20 B6 (briefs/R20.md, MOTOR B) — upozorenja i napomene nad SVIM distancama (svojstvo):
   (a) trkaču sa < 3 meseca staža ili tegobom u poslednjih 12 meseci plan ne predlaže dodatni dan;
   (b) napomena sa `onlyLongest` (oprema na najdužem dugom) stoji u planu najviše jednom;
   (c) `dan-izostavljen` ne navodi nedelje sužavanja (manje treninga tamo je namera). */
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment,
   @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument,
   @typescript-eslint/no-unsafe-return
   -- profili su netipizovani */
import { describe, expect, it } from 'vitest';
import { buildState, plan, type DistanceData } from '../engine';
import { estimateForm } from '../fitness';

const dataMods = import.meta.glob<Record<string, unknown>>('./*/index.ts', { eager: true });
const profMods = import.meta.glob<Record<string, unknown>>('./*/testdata/profiles.ts', {
  eager: true
});
const DIST = Object.entries(dataMods).map(([path, mod]) => {
  const data = Object.values(mod).find(
    (v): v is DistanceData => typeof v === 'object' && v !== null && 'adequate' in v && 'id' in v
  );
  if (data === undefined) throw new Error(path);
  const p = profMods[path.replace('index.ts', 'testdata/profiles.ts')] as any;
  return { data, profiles: p.PROFILES as any[], factsOf: p.factsOf as (x: any) => any };
});

const build = (d: (typeof DIST)[number], p: any, extra: any = {}): any => {
  const facts = { ...d.factsOf(p), ...extra, profile: { ...p.profile, ...(extra.profile ?? {}) } };
  const res = plan(buildState(facts, p.goal, d.data, estimateForm), p.goal, d.data);
  if (!res.ok) throw new Error(String(p.id));
  return res.doc;
};

describe('R20 B6 — upozorenja i napomene (sve distance)', () => {
  it.each(DIST.map((d) => [d.data.id, d] as const))('%s', (_id, d) => {
    const bad: string[] = [];
    for (const p of d.profiles) {
      for (const extra of [
        { profile: { yearsRunning: 0.1 } },
        {
          painHistory: [{ date: '2026-06-01', part: 'koleno', level: 5, resolvedOn: '2026-07-01' }]
        }
      ]) {
        const doc = build(d, p, extra);
        for (const w of doc.header.warnings)
          if (/[Dd]odaj \d\. dan/.test(String(w.proposal)))
            bad.push(`${String(p.id)} ${String(w.code)}: dodatni dan`);
      }
      const doc = build(d, p);
      for (const rule of d.data.noteRules.filter((r) => r.onlyLongest === true)) {
        const text = d.data.texts[rule.text];
        const n = doc.weeks
          .flatMap((w: any) => w.days)
          .filter((x: any) => (x.workout?.notes ?? []).includes(text)).length;
        if (n > 1) bad.push(`${String(p.id)} ${rule.text} × ${String(n)}`);
      }
      const taper = new Set(
        doc.weeks.filter((w: any) => w.intent.kind === 'taper').map((w: any) => String(w.index))
      );
      for (const w of doc.header.warnings.filter((x: any) => x.code === 'dan-izostavljen')) {
        const listed = [...String(w.problem).matchAll(/(\d+)\./g)].map((m) => m[1] ?? '');
        if (listed.length > 0 && listed.every((i) => taper.has(i)))
          bad.push(`${String(p.id)} dan-izostavljen samo u sužavanju`);
      }
    }
    expect(bad).toEqual([]);
  });
});

/* Pouka 35 (10K 06f/06g): mreža generatora — zajednički kod za p35.node.test.ts (deo 1) i p35.<k>.full.node.test.ts.
   Brz nivo: planovi pouke 35 sa 7ba9717 (P35_PLANS, 966 id-jeva); pun nivo: sve mreže (01, 02, F, B) u P35_PARTS
   delova (`part`). Po planu: generator prihvata, nijedna nedelja izgradnje sa 2 dana kvaliteta i danom kvaliteta
   dužim od dugog, plan pouke 35 ima nedelju sa drugim danom kvaliteta laganim; broj takvih nedelja: brz 1854, pun po
   delu P35_DROPPED (zbir 1854). Podela zbog vremena CI-ja (06g: jedan test celog skupa > 120 s pod opterećenjem). */

import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { FULL, part } from '@/test/level';
import { generateTenKV2 } from './generate.ts';
import { CHANGED_08, GRID_TIMEOUT, missingParts, P35_PLANS } from './level.harness.node.test.ts';
import { beginnerGridInputs, feelGridInputs, grid02Inputs, gridInputs } from './testInputs.ts';
import type { PlanWeek } from './types.ts';
import { P35_DROP, P35_KEEP, qualityOverLong } from './week.ts';

export const P35_PARTS = 4;
/** Nedelje sa drugim danom kvaliteta laganim po delu punog nivoa (zbir = 1854 = brz nivo). */
export const P35_DROPPED = [413, 413, 514, 514] as const;
const HERE = fileURLToPath(new URL('./', import.meta.url));
const BUILD = new Set(['base', 'development', 'specific']);
const steady = (w: PlanWeek): boolean => BUILD.has(w.phase) && !w.deload;
const p35 = (w: PlanWeek): boolean => w.notes.some((n) => n.startsWith(P35_DROP));

const ALL = () => [
  ...gridInputs(),
  ...([3, 4, 5, 6] as const).flatMap((d) => grid02Inputs(d)),
  ...([3, 4, 5, 6] as const).flatMap((d) => feelGridInputs(d)),
  ...([3, 4] as const).flatMap((d) => beginnerGridInputs(d))
];

/** Describe mreže pouke 35 (brz: planovi pouke 35; pun: deo `partIndex`). */
export function describeP35Grid(title: string, partIndex: number): void {
  describe(title, () => {
    it(
      `planovi pouke 35 sa 7ba9717 (${P35_PLANS.size}) — nijedna nedelja izgradnje sa 2 dana kvaliteta i danom kvaliteta dužim od dugog; ${FULL ? `pun: deo ${partIndex}/${P35_PARTS} svih mreža` : 'brz: ti planovi'}`,
      () => {
        const all = ALL();
        const cases = FULL
          ? part(all, partIndex, P35_PARTS)
          : all.filter((c) => P35_PLANS.has(c.id));
        if (!FULL) expect(cases.length).toBeGreaterThanOrEqual(P35_PLANS.size);
        else if (partIndex === 1) expect(missingParts(HERE, 'p35', P35_PARTS)).toEqual([]);
        const bad: string[] = [];
        let dropped = 0;
        for (const c of cases) {
          const r = generateTenKV2(c.input);
          if (!r.ok) {
            bad.push(`${c.id}: odbijen`);
            continue;
          }
          for (const w of r.plan.weeks.filter(steady)) {
            // 10K-08: dva ostaju uz napomenu P35_KEEP (nedelja sa jednim nije izvodljiva — validator: upozorenje).
            if (qualityOverLong(w.days) && !w.notes.includes(P35_KEEP))
              bad.push(`${c.id} ned ${w.index}`);
            if (p35(w)) dropped++;
          }
          // 10K-08: plan promenjen prema b9c4728 (T1) ne mora više imati nedelju pouke 35.
          if (P35_PLANS.has(c.id) && !CHANGED_08.gen[c.id] && !r.plan.weeks.some(p35)) bad.push(`${c.id}: bez pouke 35`);
        }
        expect(bad.slice(0, 10)).toEqual([]);
        // Nedelje sa drugim danom kvaliteta laganim (na 7ba9717 2022 nedelje sa 2 kvaliteta dužim od dugog; posle
        // prve takve nedelje progresija q2 kreće kasnije, pa deo kasnijih ne treba).
        expect(P35_DROPPED.reduce((a, b) => a + b, 0)).toBe(1854);
        expect(dropped).toBe(FULL ? P35_DROPPED[partIndex - 1] : 1854);
      },
      GRID_TIMEOUT
    );
  });
}

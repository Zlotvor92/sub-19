/* Mreža 02 (planovi sa rezultatom): dana 3/4/5/6 × nedelje 8–18 × obim po broju dana (D17, korak 5 km) ×
   VDOT {30..70} × 3 rasporeda × trka sub/ned = 15 840 planova: 0 odbijanja, 0 grešaka validatora,
   deterministički, = bazna linija segment03.baseline.json (10k-v2.3.0). Invarijante nezavisno od validatora
   (gridInvariants.ts). Regresija prema 21c03f1 (10k-v2.2.1): redovi segment02b.baseline.json i heševi
   celih planova segment03.plan-hashes-21c03f1.json; promena samo od D30a (RP deonice ≥ 800 m) ili D30b
   (Uslov 8 trkačke nedelje sa trkom). Vrh prema 49ad476 (segment02.baseline.json): niži samo u 12 planova.
   Segment 03b (10k-v2.3.1): ceo plan bajt-isti kao 81bd351 (segment03b.plan-hashes-81bd351.json).

   Nivo testova (grid02.harness.node.test.ts): brz — uzorak svih brojeva dana; pun — deo 1 (3 dana), delovi 2…4
   (4, 5, 6 dana): grid.<k>.full.node.test.ts. Snimanje baznih linija (TEN_K_V2_WRITE_BASELINE=1) samo uz
   TEST_FULL=1 i samo ovaj fajl (ceo skup). */

import { expect, it } from 'vitest';
import { FULL, part } from '@/test/level';
import { describeGrid02, GRID02_PARTS, WRITE } from './grid02.harness.node.test.ts';
import { addDays, weekdayOf } from './dates.ts';
import { generateTenKV2 } from './generate.ts';
import { DAYS } from './gridInvariants.ts';
import { grid02Inputs } from './testInputs.ts';

describeGrid02(
  'mreža 02 sa rezultatom: 15 840 planova (3/4/5/6 dana × 8–18 ned)',
  FULL && !WRITE ? part(DAYS, 1, GRID02_PARTS) : DAYS,
  () => {
    it('D20 trkačka nedelja (6 dana): otpada dugi, pa najraniji lagan dan', () => {
      const r = generateTenKV2(
        grid02Inputs(6).find((g) => g.id === 'd6-12w-50km-v45-B-sat')!.input
      );
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      const w = r.plan.weeks.at(-1)!;
      // Nedelja ned–sub, trka sub (nije dan trčanja): dani ned, pon, uto, sre, čet, pet → otpadaju ned (dugi)
      // i pon (najraniji lagan); ostaju uto, sre, čet, pet + trka.
      expect(w.days.map((d) => `${d.weekday}:${d.role}`)).toEqual([
        'tue:easy',
        'wed:sharpener',
        'thu:easy',
        'fri:eve',
        'sat:race'
      ]);
      expect(weekdayOf(addDays(w.startDate, 6))).toBe('sat');
    });
  }
);

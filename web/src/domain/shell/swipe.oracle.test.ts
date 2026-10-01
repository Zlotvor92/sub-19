import { beforeAll, describe, expect, it } from 'vitest';
import { loadLegacyApp, type LegacyApp } from '@/test/legacyOracle';
import { TABS } from '../../stores/uiStore';
import {
  SWIPE_AXIS_RATIO,
  SWIPE_EDGE_MAX_PX,
  SWIPE_EDGE_RESIST,
  SWIPE_FLING_PX_MS,
  SWIPE_FRACTION,
  SWIPE_MS_MAX,
  SWIPE_MS_MIN
} from './swipe';

/* parity: konstante i redosled iz bloka „PREVLAČENJE" (app.js). Logika odluke je u starom kodu ugrađena u dodirne slušaoce (nije pozivljiva),
   pa je pokriva `swipe.test.ts` na ručno izvedenim vrednostima. */

let legacy: LegacyApp;
beforeAll(async () => {
  legacy = await loadLegacyApp('2026-03-01T09:00:00Z');
});

describe('prevlačenje: konstante i redosled naspram starog koda', () => {
  it('praga, brzina, ugao, otpor i granice trajanja su iste', () => {
    expect(legacy.evalIn('[PV_DEO,PV_BRZINA,PV_UGAO,PV_OTPOR,PV_RUB,PV_MS_MIN,PV_MS_MAX]')).toEqual(
      [
        SWIPE_FRACTION,
        SWIPE_FLING_PX_MS,
        SWIPE_AXIS_RATIO,
        SWIPE_EDGE_RESIST,
        SWIPE_EDGE_MAX_PX,
        SWIPE_MS_MIN,
        SWIPE_MS_MAX
      ]
    );
  });
  it('redosled tabova je isti kao ključevi `PAGES`', () => {
    expect(legacy.evalIn('TAB_RED')).toEqual([...TABS]);
  });
});

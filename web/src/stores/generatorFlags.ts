/* PREKIDAČI v2 U APLIKACIJI (5K: 08a, 10K: segment 05, HM: segment HM-05): čitaju podešavanje korisnika
   (`ui.generatorV2FiveK`, `ui.generatorV2TenK`, `ui.generatorV2HalfMarathon`, idu uz stanje kao ostala podešavanja) i
   razvojni override (`VITE_FIVEK_V2`, `VITE_TENK_V2`, `VITE_HM_V2`), a odluku donosi domen (`domain/generators/flags.ts`,
   jedino mesto odluke). */

import { useMemo } from 'react';
import {
  FIVE_K_V2_ENV,
  FIVE_K_V2_SETTING,
  HM_V2_ENV,
  HM_V2_SETTING,
  TEN_K_V2_ENV,
  TEN_K_V2_SETTING,
  fiveKV2Enabled,
  fiveKV2ToggleVisible,
  generatorFlags,
  hmV2Enabled,
  hmV2ToggleVisible,
  tenKV2Enabled,
  tenKV2ToggleVisible
} from '../domain/generators/flags';
import type { GeneratorFlags } from '../domain/generators/select';
import { useIsOwner } from './owner';
import { useSettingsStore } from './settingsStore';

const env = import.meta.env as Record<string, string | undefined>;
const devOverride = (): unknown => env[FIVE_K_V2_ENV];
const tenKDevOverride = (): unknown => env[TEN_K_V2_ENV];
const hmDevOverride = (): unknown => env[HM_V2_ENV];

/** Prekidači za nov plan u ovom trenutku (radnje van React-a). */
export const currentGeneratorFlags = (): GeneratorFlags => {
  const ui = useSettingsStore.getState().ui;
  return generatorFlags(
    { setting: ui[FIVE_K_V2_SETTING], devOverride: devOverride() },
    { setting: ui[TEN_K_V2_SETTING], devOverride: tenKDevOverride() },
    { setting: ui[HM_V2_SETTING], devOverride: hmDevOverride() }
  );
};

/** Prekidači za nov plan (ekrani): prate podešavanje. */
export function useGeneratorFlags(): GeneratorFlags {
  const setting = useSettingsStore((s) => s.ui[FIVE_K_V2_SETTING]);
  const tenK = useSettingsStore((s) => s.ui[TEN_K_V2_SETTING]);
  const hm = useSettingsStore((s) => s.ui[HM_V2_SETTING]);
  return useMemo(
    () =>
      generatorFlags(
        { setting, devOverride: devOverride() },
        { setting: tenK, devOverride: tenKDevOverride() },
        { setting: hm, devOverride: hmDevOverride() }
      ),
    [setting, tenK, hm]
  );
}

/** Stanje podešavanja (za prekidač u Podešavanjima) i da li ga razvojni override nadjačava. */
export function useFiveKV2Setting(): { on: boolean; setting: boolean; forced: boolean } {
  const setting = useSettingsStore((s) => s.ui[FIVE_K_V2_SETTING]) === true;
  const on = fiveKV2Enabled({ setting, devOverride: devOverride() });
  const forced = on !== setting;
  return { on, setting, forced };
}

export const setFiveKV2Setting = (on: boolean): void =>
  useSettingsStore.getState().patchUi({ [FIVE_K_V2_SETTING]: on });

/** 08b: da li se prekidač nudi u podešavanjima (razvoj ili administrator). */
export function useFiveKV2ToggleVisible(): boolean {
  const owner = useIsOwner();
  return fiveKV2ToggleVisible({ devOverride: devOverride(), isAdmin: owner });
}

/** 10K v2: stanje podešavanja i da li ga razvojni override nadjačava. */
export function useTenKV2Setting(): { on: boolean; setting: boolean; forced: boolean } {
  const setting = useSettingsStore((s) => s.ui[TEN_K_V2_SETTING]) === true;
  const on = tenKV2Enabled({ setting, devOverride: tenKDevOverride() });
  return { on, setting, forced: on !== setting };
}

export const setTenKV2Setting = (on: boolean): void =>
  useSettingsStore.getState().patchUi({ [TEN_K_V2_SETTING]: on });

/** 10K v2: prekidač se nudi samo razvoju (postavljen `VITE_TENK_V2`) ili administratoru. */
export function useTenKV2ToggleVisible(): boolean {
  const owner = useIsOwner();
  return tenKV2ToggleVisible({ devOverride: tenKDevOverride(), isAdmin: owner });
}

/** HM v2 (segment HM-05): stanje podešavanja i da li ga razvojni override nadjačava. */
export function useHmV2Setting(): { on: boolean; setting: boolean; forced: boolean } {
  const setting = useSettingsStore((s) => s.ui[HM_V2_SETTING]) === true;
  const on = hmV2Enabled({ setting, devOverride: hmDevOverride() });
  return { on, setting, forced: on !== setting };
}

export const setHmV2Setting = (on: boolean): void =>
  useSettingsStore.getState().patchUi({ [HM_V2_SETTING]: on });

/** HM v2: prekidač se nudi samo razvoju (postavljen `VITE_HM_V2`) ili administratoru. */
export function useHmV2ToggleVisible(): boolean {
  const owner = useIsOwner();
  return hmV2ToggleVisible({ devOverride: hmDevOverride(), isAdmin: owner });
}

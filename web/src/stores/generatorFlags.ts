/* PREKIDAČI v2 U APLIKACIJI (5K: 08a, 10K: segment 05, HM: segment HM-05, maraton: MAR-05): čitaju podešavanje
   korisnika (`ui.generatorV2FiveK`, `ui.generatorV2TenK`, `ui.generatorV2HalfMarathon`, `ui.generatorV2Marathon`, idu uz
   stanje kao ostala podešavanja) i razvojni override (`VITE_FIVEK_V2`, `VITE_TENK_V2`, `VITE_HM_V2`, `VITE_MARATHON_V2`),
   a odluku donosi domen (`domain/generators/flags.ts`, jedino mesto odluke).
   Uključenje za sve korisnike: produkcijski build postavlja `VITE_V2_DEFAULT_ON=1` (vercel.json), pa korisnik koji
   podešavanje nikad nije menjao dobija v2 (nesačuvano podešavanje = uključeno). Sačuvano `false` (administrator) i
   razvojni override i dalje važe; testovi i E2E ne postavljaju promenljivu i ostaju na starom podrazumevanom. */

import { useMemo } from 'react';
import {
  FIVE_K_V2_ENV,
  FIVE_K_V2_SETTING,
  HM_V2_ENV,
  HM_V2_SETTING,
  MARATHON_V2_ENV,
  MARATHON_V2_SETTING,
  TEN_K_V2_ENV,
  TEN_K_V2_SETTING,
  fiveKV2Enabled,
  fiveKV2ToggleVisible,
  generatorFlags,
  hmV2Enabled,
  hmV2ToggleVisible,
  marathonV2Enabled,
  marathonV2ToggleVisible,
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
const marathonDevOverride = (): unknown => env[MARATHON_V2_ENV];
/** Nesačuvano podešavanje (`undefined`) = uključeno kad je build postavio `VITE_V2_DEFAULT_ON=1`. */
const settingOf = (v: unknown): unknown =>
  v === undefined ? env['VITE_V2_DEFAULT_ON'] === '1' : v;

/** Prekidači za nov plan u ovom trenutku (radnje van React-a). */
export const currentGeneratorFlags = (): GeneratorFlags => {
  const ui = useSettingsStore.getState().ui;
  return generatorFlags(
    { setting: settingOf(ui[FIVE_K_V2_SETTING]), devOverride: devOverride() },
    { setting: settingOf(ui[TEN_K_V2_SETTING]), devOverride: tenKDevOverride() },
    { setting: settingOf(ui[HM_V2_SETTING]), devOverride: hmDevOverride() },
    { setting: settingOf(ui[MARATHON_V2_SETTING]), devOverride: marathonDevOverride() }
  );
};

/** Prekidači za nov plan (ekrani): prate podešavanje. */
export function useGeneratorFlags(): GeneratorFlags {
  const setting = settingOf(useSettingsStore((s) => s.ui[FIVE_K_V2_SETTING]));
  const tenK = settingOf(useSettingsStore((s) => s.ui[TEN_K_V2_SETTING]));
  const hm = settingOf(useSettingsStore((s) => s.ui[HM_V2_SETTING]));
  const marathon = settingOf(useSettingsStore((s) => s.ui[MARATHON_V2_SETTING]));
  return useMemo(
    () =>
      generatorFlags(
        { setting, devOverride: devOverride() },
        { setting: tenK, devOverride: tenKDevOverride() },
        { setting: hm, devOverride: hmDevOverride() },
        { setting: marathon, devOverride: marathonDevOverride() }
      ),
    [setting, tenK, hm, marathon]
  );
}

/** Stanje podešavanja (za prekidač u Podešavanjima) i da li ga razvojni override nadjačava. */
export function useFiveKV2Setting(): { on: boolean; setting: boolean; forced: boolean } {
  const setting = settingOf(useSettingsStore((s) => s.ui[FIVE_K_V2_SETTING])) === true;
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
  const setting = settingOf(useSettingsStore((s) => s.ui[TEN_K_V2_SETTING])) === true;
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
  const setting = settingOf(useSettingsStore((s) => s.ui[HM_V2_SETTING])) === true;
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

/** Maraton v2 (segment MAR-05): stanje podešavanja i da li ga razvojni override nadjačava. */
export function useMarathonV2Setting(): { on: boolean; setting: boolean; forced: boolean } {
  const setting = settingOf(useSettingsStore((s) => s.ui[MARATHON_V2_SETTING])) === true;
  const on = marathonV2Enabled({ setting, devOverride: marathonDevOverride() });
  return { on, setting, forced: on !== setting };
}

export const setMarathonV2Setting = (on: boolean): void =>
  useSettingsStore.getState().patchUi({ [MARATHON_V2_SETTING]: on });

/** Maraton v2: prekidač se nudi samo razvoju (postavljen `VITE_MARATHON_V2`) ili administratoru. */
export function useMarathonV2ToggleVisible(): boolean {
  const owner = useIsOwner();
  return marathonV2ToggleVisible({ devOverride: marathonDevOverride(), isAdmin: owner });
}

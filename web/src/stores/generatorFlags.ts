/* PREKIDAČ 5K v2 U APLIKACIJI: čita podešavanje korisnika (`ui.generatorV2FiveK`, ide uz stanje kao ostala podešavanja)
   i razvojni override (`VITE_FIVEK_V2`), a odluku donosi domen (`domain/generators/flags.ts`, jedino mesto odluke). */

import { useMemo } from 'react';
import {
  FIVE_K_V2_ENV,
  FIVE_K_V2_SETTING,
  fiveKV2Enabled,
  generatorFlags
} from '../domain/generators/flags';
import type { GeneratorFlags } from '../domain/generators/select';
import { useSettingsStore } from './settingsStore';

const env = import.meta.env as Record<string, string | undefined>;
const devOverride = (): unknown => env[FIVE_K_V2_ENV];

/** Prekidači za nov plan u ovom trenutku (radnje van React-a). */
export const currentGeneratorFlags = (): GeneratorFlags =>
  generatorFlags({
    setting: useSettingsStore.getState().ui[FIVE_K_V2_SETTING],
    devOverride: devOverride()
  });

/** Prekidači za nov plan (ekrani): prate podešavanje. */
export function useGeneratorFlags(): GeneratorFlags {
  const setting = useSettingsStore((s) => s.ui[FIVE_K_V2_SETTING]);
  return useMemo(() => generatorFlags({ setting, devOverride: devOverride() }), [setting]);
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

import { useSyncExternalStore } from 'react';
import { readTheme, saveTheme, subscribeTheme, type ThemePref } from './theme';

const storage = (): Storage | undefined => {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
};

/** Tekući izbor teme i način da se promeni. */
export function useTheme(): [ThemePref, (pref: ThemePref) => void] {
  const pref = useSyncExternalStore(
    subscribeTheme,
    () => readTheme(storage()),
    (): ThemePref => 'auto'
  );
  return [pref, (p) => saveTheme(p, storage())];
}

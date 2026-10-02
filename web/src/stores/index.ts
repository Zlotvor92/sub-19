/* Sklapanje i raspodela PersistedState-a između store-ova. */

import type { PersistedState } from '../domain/state';
import { SCHEMA_VERSION } from '../domain/state';
import { useCommunityStore, communitySliceFrom } from './communityStore';
import { extrasOf, pickKnown, RECOVERY_KEYS, TRAINING_KEYS, withoutPersist } from './persistence';
import { useRecoveryStore } from './recoveryStore';
import { settingsSliceFrom, useSettingsStore } from './settingsStore';
import { useTrainingStore } from './trainingStore';

/** Sve store-ove u jedan `PersistedState` (za upis na uređaj / server). */
export function collectPersisted(): PersistedState {
  const t = useTrainingStore.getState();
  const r = useRecoveryStore.getState();
  const s = useSettingsStore.getState();
  const c = useCommunityStore.getState();
  const training = Object.fromEntries(TRAINING_KEYS.map((k) => [k, t[k]]));
  const recovery = Object.fromEntries(RECOVERY_KEYS.map((k) => [k, r[k]]));
  return {
    ...s.extras,
    v: SCHEMA_VERSION,
    ...training,
    ...recovery,
    ui: s.ui,
    vreme: s.vreme,
    strava: s.strava,
    icu: s.icu,
    zajed: c.zajed
  } as PersistedState;
}

/** Raspodela učitanog / sa servera usvojenog stanja po store-ovima. NE okida upis. */
export function hydratePersisted(state: PersistedState): void {
  withoutPersist(() => {
    useTrainingStore.getState().hydrate(pickKnown(state, TRAINING_KEYS));
    useRecoveryStore.getState().hydrate(pickKnown(state, RECOVERY_KEYS));
    useSettingsStore.getState().hydrate(settingsSliceFrom(state));
    useCommunityStore.getState().hydrate(communitySliceFrom(state));
  });
}

export { extrasOf };
export * from './persistence';
export {
  activeGenPlan,
  useActiveGenPlan,
  useResolvedPlan,
  useTrainingStore
} from './trainingStore';
export { useRecoveryStore } from './recoveryStore';
export { useSettingsStore, useStravaConnected, useIcuConnected } from './settingsStore';
export { useCommunityStore } from './communityStore';

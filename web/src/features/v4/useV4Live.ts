/* F9 korak 8: živo stanje plana V4 (forma iz trčanja) za ekrane. `null` kad se ne prikazuje plan iz V4. */
import { useMemo } from 'react';
import { liveState, type Live } from '../../integrations/v4';
import { useTrainingStore, useV4Doc } from '../../stores';
import { useRecoveryStore } from '../../stores/recoveryStore';
import { useV4Store } from '../../stores/v4Store';

export function useV4Live(): Live | null {
  const doc = useV4Doc();
  const runs = useV4Store((s) => s.runs);
  const today = useV4Store((s) => s.today);
  const log = useTrainingStore((s) => s.log);
  const knee = useRecoveryStore((s) => s.knee);
  return useMemo(() => {
    if (doc === null || today === null) return null;
    try {
      return liveState({ doc, today, runs, log, knee });
    } catch {
      return null; // V4 ne sme da obori ekran
    }
  }, [doc, today, runs, log, knee]);
}

import { useEffect, useRef } from 'react';
import { firstInSession, installKind, isStandalone, useInstallStore } from '../pwa/install';
import { useUIStore } from '../stores/uiStore';

/* Kad otvoriti list „Instaliraj" (v. `pwa/install`): jednom po hladnom startu, tek kad je aplikacija mirna (`free`: prijavljen, ima plan, ništa
   drugo nije otvoreno). Posle uvodne animacije (1,55 s), a na Androidu bez događaja čeka se duže — `beforeinstallprompt` ume da stigne
   sekund-dva posle učitavanja, a dugme je bolje od uputstva. Kad događaj stigne, odbrojavanje kreće ispočetka sa njim. */
const WAIT_MS = 2500;
const WAIT_ANDROID_MS = 6000;

export function useInstallOffer(free: boolean): void {
  const prompt = useInstallStore((s) => s.prompt);
  const done = useRef(false);

  useEffect(() => {
    if (!free || done.current) return;
    const kind = installKind({
      standalone: isStandalone(window),
      ua: navigator.userAgent,
      touch: navigator.maxTouchPoints || 0,
      hasPrompt: !!prompt
    });
    if (!kind) return;
    const t = setTimeout(
      () => {
        done.current = true;
        if (!firstInSession(window)) return;
        useUIStore.getState().openSheet({ kind: 'install', props: { kind } });
      },
      kind === 'android' ? WAIT_ANDROID_MS : WAIT_MS
    );
    return () => clearTimeout(t);
  }, [free, prompt]);
}

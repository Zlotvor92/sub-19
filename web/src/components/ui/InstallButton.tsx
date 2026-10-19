import { useState } from 'react';
import { installKind, isStandalone, useInstallStore, type InstallKind } from '../../pwa/install';
import { useUIStore } from '../../stores/uiStore';

/** Da li i kako se aplikacija može instalirati iz ovog pregledača; `install` otvara sistemski dijalog kad ga pregledač nudi. */
export function useInstall(): {
  kind: InstallKind | null;
  installed: boolean;
  busy: boolean;
  install: () => Promise<void>;
} {
  const prompt = useInstallStore((s) => s.prompt);
  const installed = useInstallStore((s) => s.installed);
  const [busy, setBusy] = useState(false);
  const kind = installKind({
    standalone: isStandalone(window),
    ua: navigator.userAgent,
    touch: navigator.maxTouchPoints || 0,
    hasPrompt: !!prompt
  });
  const install = async (): Promise<void> => {
    if (!prompt) return;
    setBusy(true);
    try {
      await prompt.prompt();
      await prompt.userChoice;
    } catch {
      /* odbijeno ili već iskorišćeno */
    }
    /* Događaj se može upotrebiti samo jednom; ako je odbijen, dalje se nudi uputstvo. */
    useInstallStore.getState().set(null);
    setBusy(false);
  };
  return { kind, installed, busy, install };
}

/* DUGME „INSTALIRAJ" u gornjem redu taba — stoji dok god je aplikacija otvorena u pregledaču. Kad pregledač ponudi instalaciju
   (`beforeinstallprompt`), jedan dodir otvara sistemski dijalog; inače (iPhone, Android bez događaja) otvara list sa koracima. U instaliranoj
   aplikaciji i na računaru bez događaja ne postoji. */
export function InstallButton() {
  const { kind, busy, install } = useInstall();
  if (!kind) return null;
  const onClick = (): void => {
    if (kind === 'prompt') void install();
    else useUIStore.getState().openSheet({ kind: 'install', props: { kind } });
  };
  return (
    <button type="button" className="btn sm install-btn" disabled={busy} onClick={onClick}>
      Instaliraj
    </button>
  );
}

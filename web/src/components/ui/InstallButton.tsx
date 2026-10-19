import { useState } from 'react';
import { installKind, isStandalone, useInstallStore } from '../../pwa/install';
import { useUIStore } from '../../stores/uiStore';

/* DUGME „INSTALIRAJ" u gornjem redu taba — stoji dok god je aplikacija otvorena u pregledaču. Kad pregledač ponudi instalaciju
   (`beforeinstallprompt`), jedan dodir otvara sistemski dijalog; inače (iPhone, Android bez događaja) otvara list sa koracima. U instaliranoj
   aplikaciji i na računaru bez događaja ne postoji. `onSteps` zamenjuje list tamo gde se on ne vidi (ekran za prijavu stoji iznad njega). */
export function InstallButton({ onSteps }: { onSteps?: (kind: 'ios' | 'android') => void } = {}) {
  const prompt = useInstallStore((s) => s.prompt);
  const [busy, setBusy] = useState(false);
  const kind = installKind({
    standalone: isStandalone(window),
    ua: navigator.userAgent,
    touch: navigator.maxTouchPoints || 0,
    hasPrompt: !!prompt
  });
  if (!kind) return null;

  const onClick = async (): Promise<void> => {
    if (!prompt) {
      if (kind === 'prompt') return;
      if (onSteps) onSteps(kind);
      else useUIStore.getState().openSheet({ kind: 'install', props: { kind } });
      return;
    }
    setBusy(true);
    try {
      await prompt.prompt();
      await prompt.userChoice;
    } catch {
      /* odbijeno ili već iskorišćeno */
    }
    /* Događaj se može upotrebiti samo jednom; ako je odbijen, dugme prelazi na uputstvo. */
    useInstallStore.getState().set(null);
    setBusy(false);
  };

  return (
    <button
      type="button"
      className="btn sm install-btn"
      disabled={busy}
      onClick={() => void onClick()}
    >
      Instaliraj
    </button>
  );
}

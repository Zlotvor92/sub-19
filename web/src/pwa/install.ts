import { create } from 'zustand';

/* INSTALACIJA IZ PREGLEDAČA. Dok je aplikacija otvorena u pregledaču (ne instalirana), gornji red taba nosi dugme „Instaliraj"
   (`components/ui/InstallButton`). Tri puta do instalacije:
   - `prompt`: pregledač je poslao `beforeinstallprompt` (Chrome/Edge/Samsung na Androidu i računaru) — dodir otvara sistemski dijalog;
   - `ios`: iPhone/iPad nemaju API za instalaciju, samo Podeli → Dodaj na početni ekran — dodir otvara list sa koracima;
   - `android`: Android bez događaja (Firefox, ili Chrome koji ga još nije poslao) — list sa menijem pregledača. */

export type InstallKind = 'prompt' | 'ios' | 'android';

/** Ono što `beforeinstallprompt` nosi; nije u standardnim tipovima DOM-a. */
export interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function installKind(env: {
  standalone: boolean;
  ua: string;
  touch: number;
  hasPrompt: boolean;
}): InstallKind | null {
  if (env.standalone) return null;
  if (env.hasPrompt) return 'prompt';
  /* iPadOS se od verzije 13 predstavlja kao Mac; razlikuje ga ekran na dodir. */
  if (/iPad|iPhone|iPod/.test(env.ua) || (/Macintosh/.test(env.ua) && env.touch > 1)) return 'ios';
  if (/Android/.test(env.ua)) return 'android';
  /* Računar bez događaja (Firefox, Safari): nema jednog puta koji vredi objašnjavati. */
  return null;
}

interface InstallState {
  prompt: InstallPromptEvent | null;
  /** Pregledač je javio `appinstalled`: aplikacija je na početnom ekranu, ali ova kartica je i dalje pregledač. */
  installed: boolean;
  set: (prompt: InstallPromptEvent | null) => void;
}

export const useInstallStore = create<InstallState>()((set) => ({
  prompt: null,
  installed: false,
  set: (prompt) => set({ prompt })
}));

/** Hvata događaj PRE Reacta: pregledač ga šalje jednom, ubrzo posle učitavanja, i ne ponavlja ga. `preventDefault` gasi Chrome-ovu malu traku — dugme je zamenjuje. */
export function captureInstallPrompt(w: Window): void {
  w.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    useInstallStore.getState().set(e as InstallPromptEvent);
  });
  w.addEventListener('appinstalled', () =>
    useInstallStore.setState({ prompt: null, installed: true })
  );
}

/** Da li aplikacija već radi instalirana (PWA ili Android paket — TWA se predstavlja preko `android-app://` referera). */
export function isStandalone(w: Window): boolean {
  try {
    if (w.document.referrer.startsWith('android-app://')) return true;
    if ((w.navigator as unknown as { standalone?: unknown }).standalone === true) return true;
    return !!w.matchMedia?.('(display-mode: standalone)').matches;
  } catch {
    return false;
  }
}

import { create } from 'zustand';

/* POZIV NA INSTALACIJU. Ko otvori aplikaciju u pregledaču (ne instaliranu), pri svakom hladnom startu dobija list „Instaliraj". Zatvaranje ga
   sklanja do sledećeg otvaranja kartice: oznaka je u `sessionStorage`, isto kao uvodni ekran, pa osvežavanje strane NE pali list ponovo.
   Tri puta do instalacije:
   - `prompt`: pregledač je poslao `beforeinstallprompt` (Chrome/Edge/Samsung na Androidu i računaru) — jedno dugme otvara sistemski dijalog;
   - `ios`: iPhone/iPad nemaju API za instalaciju, samo Podeli → Dodaj na početni ekran — list pokazuje korake;
   - `android`: Android bez događaja (Firefox, ili Chrome koji ga još nije poslao) — list pokazuje meni pregledača. */

export type InstallKind = 'prompt' | 'ios' | 'android';

/** Ono što `beforeinstallprompt` nosi; nije u standardnim tipovima DOM-a. */
export interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const INSTALL_SESSION_KEY = 'sub20-instaliraj';

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
  set: (prompt: InstallPromptEvent | null) => void;
}

export const useInstallStore = create<InstallState>()((set) => ({
  prompt: null,
  set: (prompt) => set({ prompt })
}));

/** Hvata događaj PRE Reacta: pregledač ga šalje jednom, ubrzo posle učitavanja, i ne ponavlja ga. `preventDefault` gasi Chrome-ovu malu traku — list je zamenjuje. */
export function captureInstallPrompt(w: Window): void {
  w.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    useInstallStore.getState().set(e as InstallPromptEvent);
  });
  w.addEventListener('appinstalled', () => useInstallStore.getState().set(null));
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

/** Prvi put u ovoj kartici? Ujedno beleži da jeste. Bez `sessionStorage` (privatni režim) list se vidi svaki put — bezopasno. */
export function firstInSession(w: Pick<Window, 'sessionStorage'>): boolean {
  try {
    const storage = w.sessionStorage;
    if (storage.getItem(INSTALL_SESSION_KEY) === '1') return false;
    storage.setItem(INSTALL_SESSION_KEY, '1');
  } catch {
    /* privatni režim */
  }
  return true;
}

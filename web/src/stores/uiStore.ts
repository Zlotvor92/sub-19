/* EFEMERNO STANJE EKRANA: tab, otvoreni ekrani (stek iznad taba), list (sheet), dijalozi potvrde, banneri. NE perzistira se (osim tab-a u
   sessionStorage-u, što radi `app/tabs`). */

import { create } from 'zustand';

/** Četiri taba. Zajednica je ugašena i nema svoj tab (`COMMUNITY_ENABLED`); stari `opor` i `pred` su aliasi u `app/tabs`. */
export const TABS = ['danas', 'plan', 'napredak', 'ti'] as const;
export type Tab = (typeof TABS)[number];
export const isTab = (x: unknown): x is Tab =>
  typeof x === 'string' && (TABS as readonly string[]).includes(x);

export interface ScreenRequest {
  /** Identifikator ekrana (`trening`, `forma`, `servisi`, …) — registar ekrana ga mapira na prikaz. */
  kind: string;
  props?: Record<string, unknown>;
}

export interface SheetRequest {
  /** Identifikator sadržaja (`alt`, `swap`, `t3k`, …) — komponenta ga mapira na prikaz. */
  kind: string;
  props?: Record<string, unknown>;
}

export interface ConfirmRequest {
  id: number;
  text: string;
  /** Ključ pitanja: drugi dodir na isto pitanje u roku važi kao potvrda kad je dijalog progutan. */
  key?: string;
  resolve: (ok: boolean) => void;
}

export type BannerKind = 'upozorenje' | 'greska' | 'info';
export interface Banner {
  id: string;
  kind: BannerKind;
  title: string;
  body?: string;
  actions?: Array<{ id: string; label: string; ghost?: boolean }>;
}

export interface UiState {
  tab: Tab;
  /** Ekrani otvoreni iznad taba (detalji treninga, pregled plana, …); poslednji je na vrhu. Prazno = koren taba. */
  screens: ScreenRequest[];
  sheet: SheetRequest | null;
  confirm: ConfirmRequest | null;
  banners: Banner[];
  /** Kad se promeni, ekran se ponovo iscrtava (prelazak preko ponoći). */
  today: string;
  /** Čarobnjak za plan je otvoren preko cele aplikacije. */
  wizard: boolean;
  /** Susedni tab koji se iscrtava dok ga prst vuče u kadar (prevlačenje). */
  peek: Tab | null;
}

export interface UiActions {
  /** Promena taba vraća na njegov koren (otvoreni ekrani se zatvaraju). `glided`: ekran je već doklizao prstom. */
  setTab: (tab: Tab, opts?: { glided?: boolean }) => void;
  setPeek: (tab: Tab | null) => void;
  openScreen: (screen: ScreenRequest) => void;
  /** Zatvara vrhunski ekran (jedan korak nazad). */
  closeScreen: () => void;
  openSheet: (sheet: SheetRequest) => void;
  closeSheet: () => void;
  setConfirm: (c: ConfirmRequest | null) => void;
  pushBanner: (b: Banner) => void;
  removeBanner: (id: string) => void;
  setToday: (today: string) => void;
  setWizard: (open: boolean) => void;
}

export const useUIStore = create<UiState & UiActions>()((set, get) => ({
  tab: 'danas',
  screens: [],
  sheet: null,
  confirm: null,
  banners: [],
  today: '',
  wizard: false,
  peek: null,
  setTab(tab) {
    set({ tab, screens: [], peek: null });
  },
  setPeek(peek) {
    set({ peek });
  },
  openScreen(screen) {
    set({ screens: [...get().screens, screen], sheet: null });
  },
  closeScreen() {
    const cur = get().screens;
    if (cur.length) set({ screens: cur.slice(0, -1) });
  },
  openSheet(sheet) {
    set({ sheet });
  },
  closeSheet() {
    set({ sheet: null });
  },
  setConfirm(confirm) {
    set({ confirm });
  },
  pushBanner(b) {
    /* Isti id se ne dupla (traka sukoba, oštećenog zapisa…). */
    if (get().banners.some((x) => x.id === b.id)) return;
    set({ banners: [...get().banners, b] });
  },
  removeBanner(id) {
    set({ banners: get().banners.filter((b) => b.id !== id) });
  },
  setToday(today) {
    set({ today });
  },
  setWizard(wizard) {
    set({ wizard });
  }
}));

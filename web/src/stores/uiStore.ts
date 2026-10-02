/* EFEMERNO STANJE EKRANA: tab, otvoren list (sheet), dijalozi potvrde, banneri. NE perzistira se (osim tab-a u
   sessionStorage-u, što radi `app/tabs`). */

import { create } from 'zustand';
import { COMMUNITY_ENABLED } from '../services/config';

/** Svi ekrani koje kod poznaje (Zajednica ostaje u kodu, ali se ne prikazuje dok je ugašena — v. `COMMUNITY_ENABLED`). */
export const TABS = ['danas', 'plan', 'opor', 'pred', 'zajed'] as const;
export type Tab = (typeof TABS)[number];
/** Ekrani koje čovek stvarno vidi: traka tabova, prevlačenje i vraćanje poslednjeg taba rade samo nad ovim spiskom. */
export const VISIBLE_TABS: readonly Tab[] = COMMUNITY_ENABLED
  ? TABS
  : TABS.filter((t) => t !== 'zajed');
export const isTab = (x: unknown): x is Tab =>
  typeof x === 'string' && (VISIBLE_TABS as readonly string[]).includes(x);

export interface SheetRequest {
  /** Identifikator sadržaja (`settings`, `alt`, `knee`, …) — komponenta ga mapira na prikaz. */
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
  sheet: SheetRequest | null;
  confirm: ConfirmRequest | null;
  banners: Banner[];
  /** Kad se promeni, ekran se ponovo iscrtava (prelazak preko ponoći). */
  today: string;
  /** Čarobnjak za plan je otvoren preko cele aplikacije. */
  wizard: boolean;
  /** Tab čije se kartice upravo slažu (klasa `uskoci`, ~0,9 s) — samo kad se tab stvarno menja dodirom, ne prstom ni pri iscrtavanju. */
  entering: Tab | null;
  /** Susedni tab koji se iscrtava dok ga prst vuče u kadar (prevlačenje). */
  peek: Tab | null;
}

export interface UiActions {
  /** `glided`: ekran je već doklizao prstom i bio je pred očima, pa se ulazna animacija ne igra po drugi put. */
  setTab: (tab: Tab, opts?: { glided?: boolean }) => void;
  setPeek: (tab: Tab | null) => void;
  openSheet: (sheet: SheetRequest) => void;
  closeSheet: () => void;
  setConfirm: (c: ConfirmRequest | null) => void;
  pushBanner: (b: Banner) => void;
  removeBanner: (id: string) => void;
  setToday: (today: string) => void;
  setWizard: (open: boolean) => void;
}

export const ENTERING_MS = 900;
let enteringTimer: ReturnType<typeof setTimeout> | undefined;

export const useUIStore = create<UiState & UiActions>()((set, get) => ({
  tab: 'danas',
  sheet: null,
  confirm: null,
  banners: [],
  today: '',
  wizard: false,
  entering: null,
  peek: null,
  setTab(tab, opts) {
    const changed = get().tab !== tab;
    clearTimeout(enteringTimer);
    const entering = changed && !opts?.glided ? tab : null;
    set({ tab, entering, peek: null });
    /* Rok mora da preživi NAJDUŽU animaciju na `uskoci` (crtanje linija na grafikonima: .08 + .75 s), inače linija „pukne" u pun potez. */
    if (entering) {
      enteringTimer = setTimeout(() => {
        if (get().entering === entering) set({ entering: null });
      }, ENTERING_MS);
    }
  },
  setPeek(peek) {
    set({ peek });
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

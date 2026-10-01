/* EFEMERNO STANJE EKRANA: tab, otvoren list (sheet), dijalozi potvrde, banneri. NE perzistira se (osim tab-a u
   sessionStorage-u, što radi `app/tabs`). */

import { create } from 'zustand';

export const TABS = ['danas', 'plan', 'opor', 'pred', 'zajed'] as const;
export type Tab = (typeof TABS)[number];
export const isTab = (x: unknown): x is Tab =>
  typeof x === 'string' && (TABS as readonly string[]).includes(x);

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
}

export interface UiActions {
  setTab: (tab: Tab) => void;
  openSheet: (sheet: SheetRequest) => void;
  closeSheet: () => void;
  setConfirm: (c: ConfirmRequest | null) => void;
  pushBanner: (b: Banner) => void;
  removeBanner: (id: string) => void;
  setToday: (today: string) => void;
}

export const useUIStore = create<UiState & UiActions>()((set, get) => ({
  tab: 'danas',
  sheet: null,
  confirm: null,
  banners: [],
  today: '',
  setTab(tab) {
    set({ tab });
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
  }
}));

/* PRIJAVA (Supabase, Google): ogledalo sesije za UI. Tokeni se NE drže ovde — ostaju u `SessionManager` (skladište `sub19_sb`);
   komponente vide samo status i identitet. `gate` je poruka kapije (obavezan nalog): `null` = propušta. */

import { create } from 'zustand';

export interface AuthState {
  /** Supabase je podešen (URL + ključ); inače aplikacija radi bez naloga. */
  configured: boolean;
  /** Sesija postoji (refresh token) — kapija propušta i bez signala. */
  hasSession: boolean;
  userId: string | null;
  email: string | null;
  name: string | null;
  picture: string | null;
  /** `null` = kapija otvorena; string (može prazan) = kapija zatvorena, sa porukom. */
  gate: string | null;
  /** Pokretanje je gotovo (sesija proverena). Do tada se ne crta ni kapija ni sadržaj. */
  ready: boolean;
}

export interface AuthActions {
  set: (patch: Partial<AuthState>) => void;
}

export const useAuthStore = create<AuthState & AuthActions>()((set) => ({
  configured: false,
  hasSession: false,
  userId: null,
  email: null,
  name: null,
  picture: null,
  gate: null,
  ready: false,
  set(patch) {
    set(patch);
  }
}));

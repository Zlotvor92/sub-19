/* KLJUČEVI LOKALNOG SKLADIŠTA. Isti su kao u starom kodu: novi frontend radi na ISTOM domenu, pa čita podatke koje
   je stari upisao (korisnik ne sme da izgubi stanje ni sesiju pri prelasku). Menjanje ijednog znači gubitak podataka. */

/** Glavno stanje (`PersistedState`, schema v11). */
export const LS_KEY = 'sub19-v1';
/** Sirov tekst stanja koje nije moglo da se pročita — „spašeno", pre nego što ga sledeći upis pregazi. */
export const LS_RESCUE_KEY = `${LS_KEY}-osteceno`;
/** Supabase sesija. ODVOJENO od `LS_KEY`: uvoz backupa menja stanje, a sesija mora da preživi. */
export const SB_KEY = 'sub19_sb';
/** Nonce prijave (CSRF), traje 3 minuta. */
export const SB_STATE_KEY = 'sub19_sb_state';
/** Zapamćeno da nonce prolazi kroz Supabase na ovom deployu (posle prve uspešne prijave se zahteva). */
export const SB_NONCE_OK_KEY = 'sub19_sb_nonce_ok';
export const STRAVA_STATE_KEY = 'sub19_st_state';
export const ICU_STATE_KEY = 'sub19-icu-state';
/** Poslednji tab. */
export const TAB_KEY = 'sub19-tab';
/** Uvodni ekran viđen u ovoj sesiji (sessionStorage). */
export const INTRO_SEEN_KEY = 'sub20-uvod';

/** Sve što „zaboravi sve na ovom uređaju" briše (v. `lokalnoZaboraviSve`). */
export const ALL_LOCAL_KEYS = [
  LS_KEY,
  LS_RESCUE_KEY,
  SB_KEY,
  SB_STATE_KEY,
  ICU_STATE_KEY,
  STRAVA_STATE_KEY
] as const;

export const SB_LOGIN_WINDOW_MS = 3 * 60 * 1000;

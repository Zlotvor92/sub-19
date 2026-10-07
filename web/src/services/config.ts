/* KONFIGURACIJA — samo JAVNE vrednosti.

   Supabase URL i „publishable" ključ su javni po dizajnu (isti su i u starom `app.js`); bezbednost drži RLS u bazi,
   ne tajnost ključa. SERVICE-ROLE KLJUČ NIKAD NE SME U FRONTEND. Promenljive okruženja (`VITE_*`) su neobavezne:
   bez njih važe iste vrednosti kao u produkciji, pa deploy na POSTOJEĆI Vercel projekat ne traži novo podešavanje. */

const env = import.meta.env as Record<string, string | undefined>;

export const SUPABASE_URL = env['VITE_SUPABASE_URL'] || 'https://clnsxvtulvoeqakchydz.supabase.co';
export const SUPABASE_ANON_KEY =
  env['VITE_SUPABASE_ANON_KEY'] || 'sb_publishable_aMLazdC_D_brROmOml1T7g_BM8j_ntj';

/** Javni Strava client id (isti kao u starom kodu; secret je samo na serveru, u `/api/auth`). */
export const STRAVA_CLIENT_ID = env['VITE_STRAVA_CLIENT_ID'] || '259960';

/**
 * Verzija aplikacije. Mora se poklapati sa `APP_VERSION` u `sw.js` — to je kontrakt koji proverava
 * `test/sw-azuriranje.test.mjs` u starom kodu, a ovde `scripts/check-sw-version`. Server je upisuje uz stanje.
 */
export const APP_VERSION = env['VITE_APP_VERSION'] || '285';

/**
 * ZAJEDNICA JE UGAŠENA (odluka proizvoda): nema taba, nema sekcije u podešavanjima, nema poziva ka tabeli zajednice.
 * Kod (ekran, servis, store, domen) ostaje netaknut iza ovog prekidača — vraćanje je `true` i novo izdanje.
 * Dok je ugašena, aplikacija pri pokretanju povlači sopstveni javni red (ako je ranije bio uključen) i gasi `vidljiv`:
 * profil koji niko ne osvežava, a niko ne može da ukloni, ne sme da ostane javan.
 */
export const COMMUNITY_ENABLED = false;

/** Uvek isto: `ADMIN_UID` odlučuje SAMO o prikazu dugmadi; stvarnu proveru radi server. */
export const ADMIN_UID = '0403f8fb-a643-4d4e-843d-f71199a0d6f9';

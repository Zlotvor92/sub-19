import { INTRO_SEEN_KEY } from '../services/storage/keys';

/* UVODNI EKRAN SE PRIKAZUJE SAMO PRI HLADNOM STARTU. `sessionStorage` traje koliko i kartica (odnosno koliko instalirana aplikacija stoji otvorena), pa
   osvežavanje strane, povratak iz pozadine i `location.reload()` posle „Osveži" NE pale uvod ponovo. Isključeno kretanje ga preskače. Odluka se donosi JEDNOM,
   pre prvog iscrtavanja (ne u inicijalizatoru stanja — StrictMode ga zove dvaput, a drugi poziv bi video upisanu zastavicu i ugasio uvod). */

export interface SplashDeps {
  storage?: Pick<Storage, 'getItem' | 'setItem'>;
  reducedMotion: boolean;
}

export function shouldShowSplash({ storage, reducedMotion }: SplashDeps): boolean {
  let seen = false;
  try {
    seen = storage?.getItem(INTRO_SEEN_KEY) === '1';
    storage?.setItem(INTRO_SEEN_KEY, '1');
  } catch {
    /* privatni režim ume da zabrani sessionStorage — tad se uvod vidi svaki put, što je bezopasno */
  }
  return !seen && !reducedMotion;
}

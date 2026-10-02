import { isTab, type Tab } from '../stores/uiStore';
import { TAB_KEY } from '../services/storage/keys';

/* POČETNA STRANA. Prečice na ikonici (manifest nudi `./?tab=plan`) i push deep-link čitaju `?tab=`; nepoznata vrednost tiho pada na
   Danas — ovo je ulaz sa strane i ne sme da obori otvaranje. Otvoren ekran PREŽIVLJAVA ponovno učitavanje (ažuriranje se završava
   `location.reload()`), zato se pamti u sessionStorage; privatni režim ume da ga zabrani — tada Danas. */

export function initialTab(search: string, storage?: Pick<Storage, 'getItem'>): Tab {
  try {
    const t = new URLSearchParams(search).get('tab');
    if (isTab(t)) return t;
  } catch {
    /* pada na sledeći izvor */
  }
  try {
    const z = storage?.getItem(TAB_KEY);
    if (isTab(z)) return z;
  } catch {
    /* privatni režim */
  }
  return 'danas';
}

export function rememberTab(tab: Tab, storage?: Pick<Storage, 'setItem'>): void {
  try {
    storage?.setItem(TAB_KEY, tab);
  } catch {
    /* privatni režim */
  }
}

/** Oblik ID-a dana (isti kao `ID_OBLIK` u starom kodu): adresa iz obaveštenja se otvara bez pitanja, pa oblik mora da se proveri. */
export const DAY_ID_SHAPE = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * ULAZ IZ OBAVEŠTENJA: `./?dan=<id>`. „Analiza je gotova" je ranije vodila na `?tab=danas`, a analiza živi u listu SVOG dana, koji najčešće nije
 * današnji (analizira se trening istrčan juče). `null` kad adrese nema ili ID nije ispravnog oblika (podmetnut ID ne može da izađe iz aplikacije).
 */
export function dayFromSearch(search: string): string | null {
  try {
    const id = new URLSearchParams(search).get('dan');
    return id && DAY_ID_SHAPE.test(id) ? id : null;
  } catch {
    return null;
  }
}

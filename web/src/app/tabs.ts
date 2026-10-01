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

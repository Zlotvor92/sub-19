import { isTab, type ScreenRequest, type Tab } from '../stores/uiStore';
import { TAB_KEY } from '../services/storage/keys';

/* POČETNA STRANA. Prečice na ikonici (manifest nudi `./?tab=plan`) i push deep-link čitaju `?tab=`; nepoznata vrednost tiho pada na
   Danas — ovo je ulaz sa strane i ne sme da obori otvaranje. Otvoren ekran PREŽIVLJAVA ponovno učitavanje (ažuriranje se završava
   `location.reload()`), zato se pamti u sessionStorage; privatni režim ume da ga zabrani — tada Danas.

   STARI NAZIVI TABOVA: ranije su postojali `opor` (Oporavak) i `pred` (Trka). Linkovi sa ikonice i zapamćen ekran u već otvorenim karticama
   ih i dalje nose, pa se preusmeravaju na Napredak (adresa još i otvara ekran koji je tab ranije pokazivao). */

export interface Route {
  tab: Tab;
  /** Ekran koji adresa otvara iznad taba (samo za stare nazive `opor` i `pred`). */
  screen?: ScreenRequest;
}

const ALIASES: Readonly<Record<string, Route>> = {
  opor: { tab: 'napredak', screen: { kind: 'oporavak' } },
  pred: { tab: 'napredak', screen: { kind: 'forma' } }
};

const route = (name: unknown): Route | null => {
  if (isTab(name)) return { tab: name };
  if (typeof name === 'string' && Object.prototype.hasOwnProperty.call(ALIASES, name))
    return ALIASES[name] ?? null;
  return null;
};

export function initialRoute(search: string, storage?: Pick<Storage, 'getItem'>): Route {
  try {
    const r = route(new URLSearchParams(search).get('tab'));
    if (r) return r;
  } catch {
    /* pada na sledeći izvor */
  }
  try {
    const r = route(storage?.getItem(TAB_KEY));
    if (r) return { tab: r.tab };
  } catch {
    /* privatni režim */
  }
  return { tab: 'danas' };
}

export const initialTab = (search: string, storage?: Pick<Storage, 'getItem'>): Tab =>
  initialRoute(search, storage).tab;

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
 * ULAZ IZ OBAVEŠTENJA: `./?dan=<id>`. „Analiza je gotova" je ranije vodila na `?tab=danas`, a analiza živi u ekranu SVOG dana, koji najčešće nije
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

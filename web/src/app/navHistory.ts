import { useUIStore } from '../stores/uiStore';

/* TASTER „NAZAD“ (Android, iOS ivica, Alt+←) ZATVARA EKRAN, NE APLIKACIJU. Svaki otvoren ekran i svaki list dobija jedan unos u istoriji pregledača;
   dugme „Nazad“ u aplikaciji poziva `history.back()`, pa je put isti kao kod sistemskog tastera. Aplikacija nema rute (adresa se ne menja), zato su
   unosi samo pregrade u istoriji i broji ih ovaj modul, ne adresa.

   Pravilo: broj unosa koje smo mi napravili (`depth`) uvek je jednak broju otvorenih „slojeva“ (ekrani + list). Sloj koji se otvori dobija unos;
   sloj koji se zatvori nekim drugim putem (promena taba, „Sačuvaj“ u listu) vraća istoriju jednim skokom `history.go(-n)`, a događaj `popstate`
   koji taj skok izazove se prepoznaje po brojaču `expecting` i ne zatvara ništa drugo. Pravi taster „Nazad“ dolazi bez očekivanja: zatvara
   najviši sloj (list pre ekrana). Kad nema nijednog sloja, taster ostavlja aplikaciju, kao i sada. */

interface HistoryLike {
  pushState(state: unknown, title: string): void;
  go(delta: number): void;
  back(): void;
}
interface WindowLike {
  history: HistoryLike;
  addEventListener(type: 'popstate', fn: () => void): void;
  removeEventListener(type: 'popstate', fn: () => void): void;
}

export interface NavHistory {
  /** Jedan korak nazad: preko istorije kad ona prati sloj, inače direktno u stanju ekrana. */
  back(): void;
  stop(): void;
  /** Samo za testove: koliko unosa trenutno držimo. */
  depth(): number;
}

type UiLike = Pick<typeof useUIStore, 'getState' | 'subscribe'>;

export function startNavHistory(win: WindowLike, ui: UiLike = useUIStore): NavHistory {
  let depth = 0;
  let expecting = 0;
  const layers = (): number => {
    const s = ui.getState();
    return s.screens.length + (s.sheet ? 1 : 0);
  };
  const sync = (): void => {
    const want = layers();
    if (want > depth) {
      for (let i = depth; i < want; i++) win.history.pushState({ sub20: i + 1 }, '');
      depth = want;
    } else if (want < depth) {
      const n = depth - want;
      depth = want;
      expecting += 1;
      win.history.go(-n);
    }
  };
  const onPop = (): void => {
    if (expecting > 0) {
      expecting -= 1;
      return;
    }
    if (depth <= 0) return;
    depth -= 1;
    const s = ui.getState();
    if (s.sheet) s.closeSheet();
    else s.closeScreen();
  };
  const unsub = ui.subscribe(sync);
  win.addEventListener('popstate', onPop);
  sync();
  const api: NavHistory = {
    back() {
      if (depth > 0) win.history.back();
      else ui.getState().closeScreen();
    },
    stop() {
      unsub();
      win.removeEventListener('popstate', onPop);
      if (active === api) active = null;
    },
    depth: () => depth
  };
  active = api;
  return api;
}

let active: NavHistory | null = null;

/** „Nazad“ iz aplikacije (dugme u zaglavlju ekrana). Bez pokrenutog praćenja (testovi, SSR) zatvara samo ekran. */
export function navBack(): void {
  if (active) active.back();
  else useUIStore.getState().closeScreen();
}

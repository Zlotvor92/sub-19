/* TEMA APLIKACIJE: sistem (podrazumevano) / svetla / tamna. Izbor je svojstvo UREĐAJA (telefon u tamnoj temi, laptop u svetloj), pa živi u
   localStorage-u, a NE u sinhronizovanom stanju korisnika — oblik stanja (SCHEMA 11) se zbog izgleda ne dira. `public/tema.js` primenjuje isti
   izbor pre prvog iscrtavanja; ovde je isti rečnik i isto bojenje trake pregledača. */

export type ThemePref = 'auto' | 'light' | 'dark';
export const THEME_KEY = 'sub20-tema';
export const THEME_LABEL: Readonly<Record<ThemePref, string>> = {
  auto: 'Prati sistem',
  light: 'Svetla',
  dark: 'Tamna'
};
export const THEME_COLOR = { light: '#f6f7f5', dark: '#0f1612' } as const;

/** Zapamćeni izbor; sve što nije „svetla“/„tamna“ je „prati sistem“. */
export function readTheme(storage?: Pick<Storage, 'getItem'>): ThemePref {
  try {
    const v = storage?.getItem(THEME_KEY);
    return v === 'light' || v === 'dark' ? v : 'auto';
  } catch {
    return 'auto';
  }
}

/** Primenjuje izbor na dokument: atribut na <html> i boju trake pregledača. Vraća ono što je primenjeno. */
export function applyTheme(
  pref: ThemePref,
  doc: Pick<Document, 'documentElement' | 'querySelectorAll'> = document,
  prefersDark: () => boolean = () => {
    try {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    } catch {
      return false;
    }
  }
): void {
  const root = doc.documentElement;
  if (pref === 'auto') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', pref);
  const effective = pref === 'auto' ? (prefersDark() ? 'dark' : 'light') : pref;
  for (const m of Array.from(doc.querySelectorAll('meta[name="theme-color"]'))) {
    /* Pri „prati sistem“ ostaju dve trake sa `media`; pri ručnom izboru obe nose istu boju. */
    if (pref === 'auto') {
      const dark = (m.getAttribute('media') ?? '').includes('dark');
      m.setAttribute('content', dark ? THEME_COLOR.dark : THEME_COLOR.light);
    } else {
      m.setAttribute('content', THEME_COLOR[effective]);
    }
  }
}

const listeners = new Set<() => void>();

/** Pretplata na promenu izbora (za `useSyncExternalStore`): ekrani koji prikazuju izbor ostaju tačni i kad stoje „ispod“ drugog ekrana. */
export function subscribeTheme(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Čuva izbor i odmah ga primenjuje. Zabranjeno skladište (privatni režim) ne sme da obori promenu u toj sesiji. */
export function saveTheme(
  pref: ThemePref,
  storage?: Pick<Storage, 'setItem' | 'removeItem'>,
  doc?: Pick<Document, 'documentElement' | 'querySelectorAll'>
): void {
  try {
    if (pref === 'auto') storage?.removeItem(THEME_KEY);
    else storage?.setItem(THEME_KEY, pref);
  } catch {
    /* privatni režim: promena važi dok je stranica otvorena */
  }
  applyTheme(pref, doc);
  for (const l of [...listeners]) l();
}

/* PODEŠAVANJA: grupe sekcija, „šta čeka" na vrhu ekrana i podsetnik za backup. Čisto: stanje → odluka.

   Vrh ekrana odgovara na JEDNO pitanje: je li sve u redu? Ako jeste — piše da jeste. Ako nije — imenuje PRVU stvar koja čeka i daje
   dugme koje je odmah obavlja, umesto da se sedam sekcija otvara jedna po jedna da bi se to otkrilo. Redosled stavki nije
   proizvoljan: svaka sledeća ima smisla tek kad prethodna radi (bez naloga nema servera, bez intervals.icu nema slanja na sat). */

import { addDays, parseIsoDate } from '../date';
import { brojTreninga, pl3 } from '../format';

export type SettingsGroupId = 'nalog' | 'trening' | 'veze' | 'app' | 'admin';

export interface SettingsGroup {
  id: SettingsGroupId;
  /** Natpis na segmentu. */
  label: string;
  /** Naslov ispod segmenata. */
  title: string;
  /** Nazivi sekcija koje grupa nosi. */
  sections: readonly string[];
}

export const SETTINGS_GROUPS: readonly SettingsGroup[] = [
  { id: 'nalog', label: 'Nalog', title: 'Nalog i podaci', sections: ['Nalog', 'Podaci'] },
  { id: 'trening', label: 'Trening', title: 'Trening', sections: ['Plan', 'Vreme'] },
  {
    id: 'veze',
    label: 'Veze',
    title: 'Veze sa servisima',
    sections: ['Strava', 'intervals.icu', 'Slanje na sat']
  },
  { id: 'app', label: 'App', title: 'U aplikaciji', sections: ['Obaveštenja', 'Zajednica'] },
  {
    id: 'admin',
    label: 'Admin',
    title: 'Admin · vidiš samo ti',
    sections: ['Obaveštenje korisnicima', 'Korisnici']
  }
];

/** Grupa kojoj sekcija pripada; nepoznata ide u „App". */
export function groupForSection(name: string): SettingsGroupId {
  return SETTINGS_GROUPS.find((g) => g.sections.includes(name))?.id ?? 'app';
}

export interface SettingsFlags {
  /** Prijava je podešena (Supabase URL + ključ). */
  accountConfigured: boolean;
  signedIn: boolean;
  stravaConnected: boolean;
  icuConnected: boolean;
  watchPushed: boolean;
  /** Backup je urađen i nije zastareo (ili je nalog na serveru, pa backup nije neophodan). */
  backupOk: boolean;
  hasBackupDate: boolean;
}

export interface SettingsItem {
  key: 'nalog' | 'strava' | 'icu' | 'sat' | 'backup';
  name: string;
  ok: boolean;
  /** Natpis dugmeta koje radnju obavlja odmah. */
  action: string;
  text: string;
}

export interface SettingsHero {
  items: SettingsItem[];
  waiting: SettingsItem[];
  first: SettingsItem | null;
}

export function settingsHero(f: SettingsFlags): SettingsHero {
  const items: Array<SettingsItem & { applies: boolean }> = [
    {
      key: 'nalog',
      name: 'Nalog',
      applies: f.accountConfigured,
      ok: f.signedIn,
      action: 'Prijavi se',
      text: 'Nalog čuva plan i istoriju na serveru, pa ih ne gubiš sa telefonom.'
    },
    {
      key: 'strava',
      name: 'Strava',
      applies: true,
      ok: f.stravaConnected,
      action: 'Poveži Stravu',
      text: 'Bez Strave se svako trčanje unosi ručno — distanca, vreme i puls stižu sami.'
    },
    {
      key: 'icu',
      name: 'intervals.icu',
      applies: true,
      ok: f.icuConnected,
      action: 'Poveži intervals.icu',
      text: 'HRV, puls u miru i san koje Garmin već šalje na intervals.icu stoje nepovučeni.'
    },
    {
      key: 'sat',
      name: 'Slanje na sat',
      applies: f.icuConnected,
      ok: f.watchPushed,
      action: 'Pošalji na sat',
      text: 'Treninzi još nisu poslati na sat — plan za narednih 14 dana čeka.'
    },
    /* Prijavljenom ovde ništa ne čeka: server nosi i podatke i ranije verzije. Neprijavljenom je backup jedina kopija. */
    {
      key: 'backup',
      name: 'Podaci',
      applies: true,
      ok: f.backupOk,
      action: 'Izvezi backup',
      text: f.hasBackupDate
        ? 'Od poslednjeg backupa je prošlo dosta — napravi novi.'
        : 'Backup još nije napravljen.'
    }
  ];
  const shown = items.filter((x) => x.applies).map(({ applies: _a, ...rest }) => rest);
  const waiting = shown.filter((x) => !x.ok);
  return { items: shown, waiting, first: waiting[0] ?? null };
}

const COUNT_WORD = ['nijedna', 'Jedna', 'Dve', 'Tri', 'Četiri', 'Pet', 'Šest'];

/** „Dve stvari čekaju" / „Jedna stvar čeka" / „Pet stvari čeka". */
export function waitingText(n: number): string {
  const word = COUNT_WORD[n] ?? String(n);
  return `${word} ${n === 1 ? 'stvar čeka' : n < 5 ? 'stvari čekaju' : 'stvari čeka'}`;
}

/**
 * Podsetnik za backup: nedelju dana od poslednjeg backupa (a bez njega od prvog otvaranja). Prijavljenom ga nema (server nosi podatke),
 * a odlaganje ga pomera do navedenog datuma.
 */
export function backupDue(
  today: string,
  ui: { lastBackup?: string | null; firstRun?: string | null; snooze?: string | null },
  signedIn: boolean
): boolean {
  if (signedIn) return false;
  const base = parseIsoDate(ui.lastBackup || ui.firstRun || '');
  if (!base) return false;
  if (ui.snooze && today < ui.snooze) return false;
  return today >= addDays(base, 7);
}

/** „12 treninga · 3 zapisa o bolu · 8 merenja mase · 4 tempa radnog dela" — ispod naslova Podešavanja. */
export function dataCounts(n: {
  workouts: number;
  pain: number;
  weight: number;
  paces: number;
}): string {
  return `${brojTreninga(n.workouts)} · ${n.pain} ${pl3(n.pain, 'zapis', 'zapisa', 'zapisa')} o bolu · ${n.weight} ${pl3(n.weight, 'merenje', 'merenja', 'merenja')} mase · ${n.paces} ${pl3(n.paces, 'tempo', 'tempa', 'tempa')} radnog dela`;
}

/* ------------------------------------------------------------- objava „novo" */

export interface Announcement {
  /** IME objave, ne broj verzije: da se pamtila verzija, traka bi se vratila pri sledećem ažuriranju iako je već pročitana. */
  key: string;
  /** Datum objave: novom korisniku (prvo otvaranje posle ovog datuma) objava nije novost nego zatečeno stanje. */
  from: string;
  title: string;
  text: string;
  button: string;
}

/** PROIZVODNA ODLUKA (ne nauka): jedna objava u jednom trenutku. Kad prođe, postavi se na `null` i traka nestaje svima. */
export const ANNOUNCEMENT: Announcement | null = {
  key: 'zajednica',
  from: '2026-08-08',
  title: 'Novo: Zajednica',
  text: 'Nedeljni izazov i tabela sa ostalima koji trče po planu. Uključuje se ručno — podrazumevano je isključena.',
  button: 'Pogledaj'
};

/**
 * Objava koja se prikazuje, ili `null`. NE pokazuje se: neprijavljenom (Zajednica traži nalog, pa bi dugme vodilo na ekran koji za njega ne
 * postoji), onome ko je objavu već video, i novom korisniku.
 */
export function announcementToShow(
  announcement: Announcement | null,
  signedIn: boolean,
  ui: { novo?: unknown; firstRun?: unknown }
): Announcement | null {
  if (!announcement || !signedIn) return null;
  if (ui.novo === announcement.key) return null;
  if (typeof ui.firstRun === 'string' && ui.firstRun && ui.firstRun >= announcement.from)
    return null;
  return announcement;
}

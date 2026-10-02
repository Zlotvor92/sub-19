/* ZAJEDNICA: odluke bez ikakvog ulaza/izlaza. Do ovog bloka je sve u aplikaciji isključivo lično, pa važi jedno pravilo iznad svih ostalih:

     NIŠTA NE IZLAZI IZ NALOGA DOK ČOVEK SAM NE UKLJUČI, I IZLAZI SAMO ONO ŠTO `communityPayload` IZRIČITO NABROJI.

   `communityPayload` je JEDINA tačka kroz koju podaci odlaze u tabelu zajednica_profil. Gradi se nabrajanjem polja, nikad kopiranjem stanja,
   jer bi svako buduće polje tada izašlo samo zato što je dodato. ŠTA NIKAD NE ULAZI: HRV, puls u miru, san, težina, mapa bolova, beleške sa
   treninga, puls na treningu, AI analiza, e-adresa — tih kolona nema ni u bazi (supabase/zajednica.sql).

   BROJEVI SE PROVERAVAJU PRE SLANJA: baza ima `check` opsege na svakoj koloni; vrednost van opsega ne bi pokvarila samo to polje nego bi oborila
   CEO upis. Zato `inRange` pretvara sve sumnjivo u `null` — polje koje nedostaje je uvek bolje od upisa koji ne prolazi.

   TUĐ PROFIL SE ČISTI NA ULAZU kao i sve sa servera (`cleanProfile`): red je upisao DRUGI korisnik. */

import type { IsoDate } from '../date';
import { streak, weekRealKm, weekRunCount, weekRunDone } from '../day';
import { fmtClock, fmtKm, fmtNum, r1 } from '../format';
import { tagName, type ResolvedPlan } from '../plan';
import type { LogEntry, T3kRecord, VdotRecord } from '../state/types';
import { t3kSeries } from '../training/test3k';

export const RECENT_RUNS_MAX = 8;
export const NICKNAME_MAX = 24;
/** Najčešće osvežavanje spiska pri ulasku u tab (ms). */
export const REFRESH_AFTER_MS = 300_000;

/** Isti opsezi kao `check` ograničenja u supabase/zajednica.sql. Kad se tamo promene, moraju i ovde. */
export const RANGES = {
  vdot: [20, 85],
  vdot_pocetni: [20, 85],
  test3k_sec: [480, 2400],
  km_nedelja: [0, 300],
  plan_pct: [0, 100],
  niz_dana: [0, 3650],
  nedelja_br: [1, 104],
  nedelja_od: [1, 104],
  izazov_od: [0, 21],
  izazov_ura: [0, 21]
} as const;
export type RangeKey = keyof typeof RANGES;

export function inRange(v: unknown, key: RangeKey): number | null {
  const o = RANGES[key];
  if (typeof v !== 'number' || !Number.isFinite(v)) return null;
  const z = r1(v);
  return z >= o[0] && z <= o[1] ? z : null;
}

export type Goal = '5K' | '10K' | '21K' | '42K';
/** Ciljna distanca → oznaka za filter. Pragovi su na pola puta između standardnih distanci. */
export function goalBucket(raceDistM: number | null | undefined): Goal | null {
  const m = raceDistM ?? 0;
  if (!(m > 0)) return null;
  if (m >= 30000) return '42K';
  if (m >= 15000) return '21K';
  if (m >= 8000) return '10K';
  return '5K';
}

/** Ime na spisku: nadimak ima prednost; bez njega SAMO PRVO IME sa Google naloga (puno ime i prezime je više nego što je čovek tražio). */
export function displayName(
  nick: string | null | undefined,
  googleName: string | null | undefined
): string | null {
  const n = (nick ?? '').trim();
  if (n) return n.slice(0, NICKNAME_MAX);
  const g = (googleName ?? '').trim();
  return g ? (g.split(/\s+/)[0] as string).slice(0, NICKNAME_MAX) : null;
}

export interface CommunityInput {
  userId: string | null;
  googleName: string | null;
  picture: string | null;
  nickname: string;
  plan: ResolvedPlan;
  log: Readonly<Record<string, LogEntry>>;
  today: IsoDate;
  vdotLog: readonly VdotRecord[];
  t3k: readonly T3kRecord[];
  currentVdot: number | null;
  raceDistM: number | null;
  raceDate: IsoDate | null;
}

type RunDay = ResolvedPlan['dated'][number];

/** Doslednost od početka plana: odrađeni trkački treninzi / oni kojima je rok prošao. Snaga i odmor se ne broje. */
export function consistency(
  plan: ResolvedPlan,
  log: Readonly<Record<string, LogEntry>>,
  today: string
): number | null {
  let due = 0;
  let done = 0;
  for (const d of plan.dated) {
    if (d.date > today) break;
    if (d.rest || d.tag === 'snaga' || (d.tag as string) === 'trka') continue;
    due++;
    if (log[d.id]?.status === 'done') done++;
  }
  return due ? Math.round((done * 100) / due) : null;
}

/** Poslednja trčanja — datum, tip, dužina, tempo. NIŠTA VIŠE (beleške, puls i osećaj ostaju u nalogu). */
export function recentRuns(
  plan: ResolvedPlan,
  log: Readonly<Record<string, LogEntry>>,
  today: string
) {
  const out: Array<{ d: string; t: string; o: string; p: string }> = [];
  for (let i = plan.dated.length - 1; i >= 0 && out.length < RECENT_RUNS_MAX; i--) {
    const d = plan.dated[i] as RunDay;
    if (d.date > today || d.rest || d.tag === 'snaga') continue;
    if (log[d.id]?.status !== 'done') continue;
    const l = log[d.id] ?? {};
    const km = l.km != null ? l.km : d.km != null ? d.km : null;
    const sec = l.sec;
    out.push({
      d: d.date,
      t: tagName(d.tag).slice(0, 24),
      o: km != null ? `${fmtKm(km)} km` : '—',
      p:
        km != null && km > 0 && sec != null && sec > 0
          ? `${fmtClock(Math.round(sec / km))} /km`
          : '—'
    });
  }
  return out;
}

/** Značke — sve iz onoga što aplikacija već zna. */
export function badges(
  input: Pick<CommunityInput, 'plan' | 'log' | 'today' | 't3k' | 'raceDate'>
): string[] {
  const out: string[] = [];
  const run = input.raceDate ? streak(input.plan, input.log, input.today, input.raceDate) : 0;
  if (run >= 7) out.push('Niz 7 dana');
  if (run >= 30) out.push('Niz 30 dana');
  if (t3kSeries(input.t3k).length) out.push('Test na 3 km');
  /* Nedelja u kojoj je odrađeno sve što je planirano — ZAVRŠENA nedelja, ne tekuća (u tekućoj je „sve odrađeno" tačno i u ponedeljak ujutru). */
  for (const w of input.plan.weeks) {
    if (addDaysIso(w.start, 6) >= input.today) continue;
    const n = weekRunCount(w, input.log);
    if (n > 0 && weekRunDone(w, input.log) === n) {
      out.push('Nedelja 100%');
      break;
    }
  }
  const race = input.plan.dated.find((d) => (d.tag as string) === 'trka');
  if (race && input.log[race.id]?.status === 'done') out.push('Trka odrađena');
  return out;
}

function addDaysIso(date: string, n: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export interface CommunityRow {
  user_id: string | null;
  vidljiv: true;
  nadimak: string | null;
  avatar_url: string | null;
  cilj: Goal | null;
  trka_datum: string | null;
  nedelja_br: number | null;
  nedelja_od: number | null;
  vdot: number | null;
  vdot_pocetni: number | null;
  test3k_sec: number | null;
  km_nedelja: number | null;
  plan_pct: number | null;
  niz_dana: number | null;
  izazov_od: number | null;
  izazov_ura: number | null;
  znacke: string[];
  trcanja: Array<{ d: string; t: string; o: string; p: string }>;
}

/** JEDINA tačka kroz koju podaci izlaze iz naloga. V. zaglavlje modula. */
export function communityPayload(i: CommunityInput): CommunityRow {
  const week = i.plan.weeks.find((w) => i.today >= w.start && i.today <= addDaysIso(w.start, 6));
  const vl = i.vdotLog.filter((e) => e && typeof e.vdot === 'number');
  const t3 = t3kSeries(i.t3k);
  const fastest = t3.length ? Math.min(...t3.map((t) => t.sec)) : null;
  const name = displayName(i.nickname, i.googleName);
  return {
    user_id: i.userId,
    vidljiv: true,
    /* Nadimak kraći od dva znaka baza odbija; radije `null` (pa se prikazuju inicijali) nego da ceo upis padne. */
    nadimak: name && name.length >= 2 ? name : null,
    avatar_url: typeof i.picture === 'string' && /^https:\/\//.test(i.picture) ? i.picture : null,
    cilj: goalBucket(i.raceDistM),
    trka_datum: i.raceDate,
    nedelja_br: week ? inRange(week.w, 'nedelja_br') : null,
    nedelja_od: inRange(i.plan.weeks.length, 'nedelja_od'),
    vdot: inRange(i.currentVdot, 'vdot'),
    vdot_pocetni: vl.length ? inRange((vl[0] as VdotRecord).vdot, 'vdot_pocetni') : null,
    test3k_sec: fastest != null ? inRange(Math.round(fastest), 'test3k_sec') : null,
    km_nedelja: week ? inRange(weekRealKm(week, i.log), 'km_nedelja') : null,
    plan_pct: inRange(consistency(i.plan, i.log, i.today), 'plan_pct'),
    niz_dana: inRange(i.raceDate ? streak(i.plan, i.log, i.today, i.raceDate) : 0, 'niz_dana'),
    izazov_od: week ? inRange(weekRunCount(week, i.log), 'izazov_od') : null,
    izazov_ura: week ? inRange(weekRunDone(week, i.log), 'izazov_ura') : null,
    znacke: badges(i),
    trcanja: recentRuns(i.plan, i.log, i.today)
  };
}

/* ------------------------------------------------------------- tuđi profili */

/**
 * Broj iz tuđeg profila, spreman za prikaz. NIZ NIJE BROJ, iako se ponaša kao broj (`+[]` je 0), isto važi za `true`/`false`. Prolazi samo
 * ono što JESTE broj ili niz znakova koji ceo predstavlja broj; sve ostalo je `null` i nestaje iz prikaza.
 */
export function toNum(v: unknown): number | null {
  if (v == null || v === '' || typeof v === 'boolean' || typeof v === 'object') return null;
  const n = +(v as number);
  return Number.isFinite(n) ? n : null;
}

const NUMERIC = [
  'vdot',
  'vdot_pocetni',
  'test3k_sec',
  'km_nedelja',
  'plan_pct',
  'niz_dana',
  'izazov_od',
  'izazov_ura',
  'nedelja_br',
  'nedelja_od'
] as const;

export interface Profile {
  user_id: string;
  nadimak?: string | null;
  avatar_url?: string | null;
  cilj?: string | null;
  trka_datum?: string | null;
  znacke: unknown[];
  trcanja: unknown[];
  vdot: number | null;
  vdot_pocetni: number | null;
  test3k_sec: number | null;
  km_nedelja: number | null;
  plan_pct: number | null;
  niz_dana: number | null;
  izazov_od: number | null;
  izazov_ura: number | null;
  nedelja_br: number | null;
  nedelja_od: number | null;
  [field: string]: unknown;
}

export function cleanProfile(p: unknown): Profile | null {
  if (!p || typeof p !== 'object') return null;
  const o = p as Record<string, unknown>;
  if (typeof o['user_id'] !== 'string' || !o['user_id']) return null;
  const c: Record<string, unknown> = { ...o };
  for (const k of NUMERIC) c[k] = toNum(c[k]);
  c['znacke'] = Array.isArray(c['znacke']) ? c['znacke'] : [];
  c['trcanja'] = Array.isArray(c['trcanja']) ? c['trcanja'] : [];
  return c as Profile;
}

export const cleanProfiles = (rows: unknown): Profile[] =>
  (Array.isArray(rows) ? rows : []).map(cleanProfile).filter((p): p is Profile => !!p);

/** Adresa slike propuštena kroz usko sito: `&` i `#` se odbijaju, pa se numerički HTML entitet ne može ni sastaviti (CSS injekcija preko tuđeg `avatar_url`). */
export function safeImageUrl(u: unknown): string | null {
  if (typeof u !== 'string') return null;
  return /^https:\/\/[a-zA-Z0-9.-]+\/[A-Za-z0-9\-._~:/[\]@!$*+,=%]*$/.test(u) ? u : null;
}

const COLORS = ['#5AFFBE', '#5AE0FF', '#FF6BA6', '#FFC062', '#A98BFF', '#8CE99A', '#FF9E7A'];
/** Boja kruga iz identifikatora — ista osoba uvek ista boja, bez ijedne kolone u bazi. */
export function avatarColor(id: unknown): string {
  let h = 0;
  const s = typeof id === 'string' || typeof id === 'number' ? String(id) : '';
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return COLORS[h % COLORS.length] as string;
}

export function initials(name: unknown): string {
  const parts = (typeof name === 'string' || typeof name === 'number' ? String(name) : '?')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return (((parts[0] ?? '?')[0] as string) + ((parts[1] ?? '')[0] ?? '')).toUpperCase();
}

/** Ime pod kojim se neko prikazuje (jedno mesto: naslov reda i inicijali u krugu). */
export const profileName = (p: { nadimak?: unknown } | null | undefined): string =>
  (p && typeof p.nadimak === 'string' && p.nadimak) || 'Trkač';

/** Napredak = pomak od SOPSTVENOG početka (početnik pobeđuje iskusnog). */
export const progressOf = (p: Pick<Profile, 'vdot' | 'vdot_pocetni'>): number =>
  typeof p.vdot === 'number' && typeof p.vdot_pocetni === 'number'
    ? r1(p.vdot - p.vdot_pocetni)
    : 0;

/* ------------------------------------------------------------- rang-liste */

export type MeasureKey = 't3k' | 'nap' | 'dosl';
export interface Measure {
  key: MeasureKey;
  label: string;
  hint: string;
  sort(p: Profile): number;
  value(p: Profile): string;
}

const T3K_MEASURE: Measure = {
  key: 't3k',
  label: 'Test 3 km',
  hint: 'najbrži gore',
  sort: (p) => (p.test3k_sec != null ? p.test3k_sec : 1e9),
  value: (p) => (p.test3k_sec != null ? fmtClock(p.test3k_sec) : '—')
};

/** Tri merila, i to je namerno tri: brzina (uvek vode isti), napredak od sopstvenog početka i doslednost (disciplina ne zavisi od talenta). */
export const MEASURES: readonly Measure[] = [
  T3K_MEASURE,
  {
    key: 'nap',
    label: 'Napredak',
    hint: 'od početka plana',
    sort: (p) => -progressOf(p),
    value: (p) => {
      const n = progressOf(p);
      return `${n > 0 ? '+' : ''}${fmtNum(n, 1)} VDOT`;
    }
  },
  {
    key: 'dosl',
    label: 'Doslednost',
    hint: 'plan odrađen',
    sort: (p) => -(p.plan_pct != null ? p.plan_pct : -1),
    value: (p) => (p.plan_pct != null ? `${p.plan_pct} %` : '—')
  }
];

export const measureFor = (key: string): Measure =>
  MEASURES.find((m) => m.key === key) ?? T3K_MEASURE;

export const GOAL_FILTERS: ReadonlyArray<readonly [string, string]> = [
  ['sve', 'Sve'],
  ['5K', '5K'],
  ['10K', '10K'],
  ['21K', '21K'],
  ['42K', '42K']
];

export const filterProfiles = (list: readonly Profile[], filter: string): Profile[] =>
  list.filter((p) => filter === 'sve' || p.cilj === filter);

export const rankProfiles = (list: readonly Profile[], m: Measure): Profile[] =>
  list.slice().sort((a, b) => m.sort(a) - m.sort(b));

/** Podnaslov reda: cilj · nedelja X / Y · trka DD.MM. */
export function profileSubtitle(p: Profile, fmtDate: (iso: string) => string): string {
  return [
    p.cilj || '—',
    p.nedelja_br && p.nedelja_od ? `nedelja ${p.nedelja_br} / ${p.nedelja_od}` : null,
    p.trka_datum ? `trka ${fmtDate(p.trka_datum)}` : null
  ]
    .filter(Boolean)
    .join(' · ');
}

/** Izazov se rangira po UDELU odrađenog, ne po broju — inače bi onaj sa šest treninga uvek bio ispred onoga sa četiri. */
export const challengeShare = (p: Pick<Profile, 'izazov_od' | 'izazov_ura'>): number =>
  p.izazov_od != null && p.izazov_od > 0 ? (p.izazov_ura || 0) / p.izazov_od : 0;

export function challengeList(list: readonly Profile[]): { rows: Profile[]; finished: number } {
  const rows = list
    .slice()
    .filter((p) => p.izazov_od != null && p.izazov_od > 0)
    .sort((a, b) => challengeShare(b) - challengeShare(a));
  return {
    rows,
    finished: rows.filter((p) => (p.izazov_ura as number) >= (p.izazov_od as number)).length
  };
}

/* ------------------------------------------------------------- poruke */

export type FailReason = 'nema-tabele' | 'nema-prava' | 'server' | 'nepoznato' | 'mreza';

/** PostgREST na nepostojeću tabelu vraća 404 — jedini ishod koji se ne rešava ponavljanjem nego puštanjem SQL fajla. */
export function reasonFromStatus(status: number): FailReason {
  if (status === 404) return 'nema-tabele';
  if (status === 401 || status === 403) return 'nema-prava';
  if (status >= 500) return 'server';
  return 'nepoznato';
}

/** Jedna rečenica po razlogu — svaka kaže sledeći korak, ne samo šta ne valja. */
export function reasonMessage(reason: string | null | undefined): string {
  if (reason === 'nema-tabele' || reason === 'nema-prava')
    return 'Tabele Zajednice još nema u bazi. Supabase → SQL Editor → nalepi ceo supabase/zajednica.sql → Run, pa probaj opet.';
  if (reason === 'mreza')
    return 'Nema veze sa internetom. Ovo mora da stigne do servera, pa ništa nije promenjeno.';
  if (reason === 'server')
    return 'Server trenutno ne odgovara. Ništa nije promenjeno — probaj za koji minut.';
  return 'Nije uspelo. Ništa nije promenjeno.';
}

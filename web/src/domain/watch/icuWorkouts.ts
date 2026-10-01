/* PLANIRANI TRENINZI ZA SAT (intervals.icu → Garmin Connect → sat). Čisto: dan plana → tekst u sintaksi intervals.icu.

   Zamke koje su ovde već ugrađene (učene na stvarnim greškama):
   - `m` znači MINUTE, ne metre; metri se pišu `500mtr`;
   - apsolutan tempo je `4:11/km Pace`; opseg ide SPORIJI pa BRŽI (`7:15-7:00/km Pace`), jedinica samo jednom, na kraju;
   - blok ponavljanja se uvodi zaglavljem `Radni deo 5x`, uz PRAZAN red pre i posle bloka (sekcije se spajaju praznim redom);
   - OPORAVAK IZMEĐU DEONICA NE SME NA LAGAN (E) TEMPO: pauza je hod ili lagano kaskanje, pa sat ne sme da pišti „ubrzaj". Ipak nosi
     broj — korak bez cilja se ne prepoznaje i ume da obori strukturu celog treninga — ali POŠTEN: hod 9:00–13:00/km, kaskanje 6:30–7:30/km;
   - BEZ APSOLUTNOG LAGANOG TEMPA SE DAN NE ŠALJE. Zonski cilj („Z2 Pace") radi samo ako korisnik ima podešene zone trčanja; ko ih nema
     dobija korak bez tempa — i to tiho. Bolje je dan preskočiti i reći to;
   - lagan deo je RASPON (E tempo + 40 s/km), ne jedan broj: jedan broj je na satu značio stalno pištanje na zagrevanju i smirivanju;
   - TIME TRIAL i slični dani sa opsegom tempa se ne šalju kao struktura (sat bi dobio pogrešan broj).
   Konstante raspona i kaskanja/hoda su PROIZVODNA ODLUKA (nisu merenje). */

import { addDays } from '../date';
import type { ResolvedDay, ResolvedPlan } from '../plan/types';
import { RECOVERY_JOG } from '../training/sessions/calc';
import { paceForZone } from '../training/vdot/paceForZone';

export const EASY_RANGE_SEC = 40;
export const JOG_FROM = 390;
export const JOG_TO = 450;
export const WALK_FROM = 540;
export const WALK_TO = 780;
export const WORKOUT_ID_PREFIX = 'sub19-';

const clock = (x: number): string =>
  `${Math.floor(x / 60)}:${String(Math.round(x % 60)).padStart(2, '0')}`;

/** Tempo u sintaksi intervals.icu; `null` kad tempa nema. */
export function icuPace(sec: number | null | undefined, sec2?: number | null): string | null {
  if (!((sec ?? 0) > 0)) return null;
  const a = sec as number;
  return (sec2 ?? 0) > 0 && sec2 !== a
    ? `${clock(Math.max(a, sec2 as number))}-${clock(Math.min(a, sec2 as number))}/km Pace`
    : `${clock(a)}/km Pace`;
}

export function icuDuration(sec: number | null | undefined): string {
  if (!((sec ?? 0) > 0)) return '1m';
  const s = sec as number;
  if (s % 60 === 0) return `${s / 60}m`;
  return s < 90 ? `${s}s` : `${Math.round(s / 60)}m`;
}

export function icuDistance(km: number | null | undefined): string | null {
  if (!((km ?? 0) > 0)) return null;
  const k = km as number;
  return k < 1 ? `${Math.round(k * 1000)}mtr` : `${Math.round(k * 100) / 100}km`;
}

function recovery(kind: string, restSec: number, jog = false): string {
  const isJog = jog || RECOVERY_JOG.includes(kind);
  return isJog
    ? `- Oporavak kaskanje ${icuDuration(restSec)} ${icuPace(JOG_FROM, JOG_TO)}`
    : `- Pauza hod ${icuDuration(restSec)} ${icuPace(WALK_FROM, WALK_TO)}`;
}

/** Struktura sesije za izvoz: generisana sesija ili ona izvučena iz TEKSTA opisa — isti oblik, pa su polja opciona. */
export interface WatchSession {
  type: string;
  kind: string;
  wuKm: number;
  cdKm: number;
  paceSec: number;
  paceSec2?: number | null;
  restSec?: number;
  reps?: number | number[];
  repM?: number;
  repSec?: number;
  qKm?: number;
  easyPaceSec?: number;
}

/**
 * STRUKTURA IZ OPISA — za planove čija sesija nije objekat (ručno izmenjen dan). Opis se rašlanjuje u istu strukturu koju generator inače
 * daje, pa dalje sve ide istim putem. `null` kad nema ni jednog tempa ili kad je običan trčanje.
 */
export function sessionFromDescription(
  desc: string | null | undefined,
  tag: string | undefined
): WatchSession | null {
  const t = String(desc ?? '').split('\n')[0] ?? '';
  if (!t) return null;
  const num = (x: string): number => +String(x).replace(',', '.');
  const secs = (m: string, s: string): number => +m * 60 + +s;
  const wu = /([\d.,]+)\s*km\s*WU/i.exec(t);
  const cd = /([\d.,]+)\s*km\s*CD/i.exec(t);
  const pause = /\(\s*([\d.,]+)\s*(min|s)\b/i.exec(t);
  const restSec = pause
    ? Math.round(num(pause[1] as string) * (/min/i.test(pause[2] as string) ? 60 : 1))
    : 90;
  /* ODSECI ZAGREVANJE I SMIRIVANJE PRE TRAŽENJA RADNOG DELA: bez toga „2 km WU + 4 km @ 4:22/km + 2 km CD" daje 2 km tempa umesto 4. */
  const work = t
    .replace(/^.*?[\d.,]+\s*km\s*WU\s*\+?/i, '')
    .replace(/\+\s*[\d.,]+\s*km\s*CD.*$/i, '')
    .replace(/·.*$/, '');
  const range = /(\d+):(\d\d)\s*[–—-]\s*(\d+):(\d\d)\s*\/km/.exec(work);
  const single = /@\s*~?(\d+):(\d\d)/.exec(work);
  if (!range && !single) return null;
  const paceSec = range
    ? secs(range[1] as string, range[2] as string)
    : secs((single as RegExpExecArray)[1] as string, (single as RegExpExecArray)[2] as string);
  const paceSec2 = range ? secs(range[3] as string, range[4] as string) : null;
  const kind =
    tag === 'tempo' ? (/broken|isprekid/i.test(t) ? 'Tempo isprekidan' : 'Tempo') : 'Intervali';
  const base = {
    kind,
    wuKm: wu ? num(wu[1] as string) : 0,
    cdKm: cd ? num(cd[1] as string) : 0,
    paceSec,
    paceSec2
  };
  /* ponavljanja: „6×800 m", „2×2.5 km" */
  const rep = /(\d+)\s*[×x]\s*([\d.,]+)\s*(km|m)\b/i.exec(work);
  if (rep) {
    const unitM = /^m$/i.test(rep[3] as string)
      ? num(rep[2] as string)
      : num(rep[2] as string) * 1000;
    return { type: 'int', ...base, reps: +(rep[1] as string), repM: Math.round(unitM), restSec };
  }
  /* više različitih deonica na istom tempu: „4 km + 2 km @ ~4:25/km" */
  const parts = [...work.matchAll(/([\d.,]+)\s*km/gi)]
    .map((m) => num(m[1] as string))
    .filter((x) => x > 0);
  if (parts.length > 1)
    return { type: 'pyramid', ...base, reps: parts.map((x) => Math.round(x * 1000)), restSec };
  if (parts.length === 1) return { type: 'tempo', ...base, qKm: parts[0] as number };
  return null; // običan trčanje — ide kao jedan korak na laganom tempu
}

type DayForWatch = Pick<ResolvedDay, 'rest' | 'tag' | 'desc' | 'km' | 'mlr' | 'session'>;

/** Tekst jednog dana u sintaksi intervals.icu; `null` za dane koje nema smisla slati. `easy` je lagan (E) tempo u s/km. */
export function dayWorkoutText(
  d: DayForWatch | null | undefined,
  easy: number | null
): string | null {
  if (!d || d.rest || d.tag === 'snaga' || d.tag === 'trka') return null;
  if (/TIME TRIAL|TT\b/i.test(d.desc || '')) return null;
  const ses = (d.session as WatchSession | undefined) ?? sessionFromDescription(d.desc, d.tag);
  const easyPace = icuPace(easy, (easy ?? 0) > 0 ? (easy as number) + EASY_RANGE_SEC : 0);
  if (!easyPace) return null;
  const row = (label: string, measure: string | null, pace: string | null): string =>
    `- ${label ? `${label} ` : ''}${measure}${pace ? ` ${pace}` : ''}`;
  const sections: string[] = [];
  if (!ses) {
    if (d.km == null) return null;
    const measure = icuDistance(d.km);
    if (!measure) return null;
    const name = d.mlr ? 'Srednje-dugo' : d.tag === 'lr' ? 'Dugo trčanje' : 'Lagano';
    return `${name}\n${row('', measure, easyPace)}`;
  }
  const pace = icuPace(ses.paceSec, ses.paceSec2);
  if (ses.wuKm > 0) sections.push(`Zagrevanje\n${row('', icuDistance(ses.wuKm), easyPace)}`);
  if (ses.type === 'tempo') {
    const measure = icuDistance(ses.qKm);
    if (!measure) return null;
    sections.push(`${ses.kind || 'Tempo'}\n${row('', measure, pace)}`);
  } else if (ses.type === 'int') {
    sections.push(
      `${ses.kind || 'Radni deo'} ${String(ses.reps)}x\n${row('', icuDistance((ses.repM ?? 0) / 1000), pace)}\n${recovery(ses.kind, ses.restSec ?? 0)}`
    );
  } else if (ses.type === 'pyramid') {
    const reps = ses.reps as number[];
    /* posle POSLEDNJE deonice nema pauze — odmah ide smirivanje */
    sections.push(
      `Piramida\n${reps
        .map(
          (m, i) =>
            row('', icuDistance(m / 1000), pace) +
            (i < reps.length - 1 ? `\n${recovery(ses.kind, ses.restSec ?? 0)}` : '')
        )
        .join('\n')}`
    );
  } else if (ses.type === 'fartlek') {
    /* fartlek pauza je uvek kaskanje — brzo se smenjuje sa naporom */
    sections.push(
      `Fartlek ${String(ses.reps)}x\n${row('', icuDuration(ses.repSec), pace)}\n${recovery(ses.kind, ses.restSec ?? 0, true)}`
    );
  } else if (ses.type === 'prog') {
    const total = ses.qKm ?? 0;
    const easyPart = Math.round(((total * 2) / 3) * 100) / 100;
    const fast = Math.round((total - easyPart) * 100) / 100;
    sections.push(
      `Progresivno\n${row('Lagani deo', icuDistance(easyPart), icuPace(ses.easyPaceSec) || easyPace)}\n${row('Završetak', icuDistance(fast), pace)}`
    );
  } else return null;
  if (ses.cdKm > 0) sections.push(`Hlađenje\n${row('', icuDistance(ses.cdKm), easyPace)}`);
  return sections.join('\n\n');
}

export interface WatchEvent {
  date: string;
  externalId: string;
  name: string;
  description: string;
}

export interface WatchBatch {
  events: WatchEvent[];
  /** Trčeći dani koji su ispali (nema laganog tempa / struktura nije prepoznata) — pregled ih prijavljuje da ispadanje ne prođe tiho. */
  skipped: number;
}

/**
 * Dani plana od danas do `daysAhead` unapred kao događaji za kalendar. LAGAN TEMPO PO NEDELJI čita se iz nekog LAGANOG/dugog dana te nedelje
 * (generator tu uvek upiše „~M:SS/km"); ako plan lagan tempo uopšte ne zapisuje, računa se iz tekuće forme (E zona) — uvek apsolutan broj.
 * `vdot` je tekuća forma (ili polazna).
 */
export function workoutsForWatch(
  plan: Pick<ResolvedPlan, 'weeks'>,
  today: string,
  daysAhead: number,
  vdot: number | null
): WatchBatch {
  const until = addDays(today as never, daysAhead || 14) as string;
  const weekEasy = new Map<number, number>();
  for (const w of plan.weeks)
    for (const d of w.days) {
      if (d.rest || d.tag === 'snaga') continue;
      if (d.tag !== 'lako' && d.tag !== 'lr') continue;
      const m = /~(\d+):(\d\d)\/km/.exec(d.desc || '');
      if (m) {
        weekEasy.set(w.w, +(m[1] as string) * 60 + +(m[2] as string));
        break;
      }
    }
  let fallback: number | null = null;
  try {
    if (vdot) fallback = paceForZone(vdot, 'E');
  } catch {
    fallback = null;
  }
  const events: WatchEvent[] = [];
  let skipped = 0;
  for (const w of plan.weeks)
    for (const d of w.days) {
      if (!d.date || d.date < today || d.date > until) continue;
      if (d.test) continue;
      let easy = weekEasy.get(w.w) || fallback || null;
      if (d.tag === 'lako' || d.tag === 'lr') {
        const m = /~(\d+):(\d\d)\/km/.exec(d.desc || '');
        if (m) easy = +(m[1] as string) * 60 + +(m[2] as string);
      }
      const text = dayWorkoutText(d, easy);
      if (!text) {
        if (
          !d.rest &&
          d.tag !== 'snaga' &&
          d.tag !== 'trka' &&
          !/TIME TRIAL|TT\b/i.test(d.desc || '')
        )
          skipped++;
        continue;
      }
      const source =
        (d.session as WatchSession | undefined) ?? sessionFromDescription(d.desc, d.tag);
      /* Naziv nosi i kilometražu: u Garmin kalendaru i na satu vidi se samo naziv, pa je golo „Lagano" beskorisno kad se bira trening. */
      const base =
        source?.kind || (d.mlr ? 'Srednje-dugo' : d.tag === 'lr' ? 'Dugo trčanje' : 'Lagano');
      events.push({
        date: d.date,
        externalId: `${WORKOUT_ID_PREFIX}${d.id}`,
        name: (d.km ?? 0) > 0 ? `${base} ${Math.round((d.km as number) * 10) / 10} km` : base,
        description: text
      });
    }
  return { events, skipped };
}

/** Prag tempa (T po Danielsu) koji treba uneti u intervals.icu: bez njega izvoz na sat daje „No Target". „M:SS" ili `null`. */
export function thresholdPace(vdot: number | null | undefined): string | null {
  try {
    if (!vdot) return null;
    const s = paceForZone(vdot, 'T');
    if (!(s > 0)) return null;
    return `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
  } catch {
    return null;
  }
}

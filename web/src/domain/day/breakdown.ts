/* STRUKTURA TRENINGA ZA PRIKAZ: redovi „Zagrevanje / Radni deo / Odmor / Hlađenje / Ritam / Napor" i napomena iz opisa.
   Za generisan plan struktura se čita iz `session`; za ručno izmenjen dan (ili plan bez sesije) iz TEKSTA opisa — zato
   regex-i. Ne menja se ništa: samo se čita. */

import { fmtClock, fmtKm } from '../format';
import { rpeTarget } from '../plan/describe';
import type { ResolvedDay } from '../plan/types';
import { runWalkText } from '../training/generator/runWalk';

export type BreakdownRow = readonly [label: string, value: string, highlight?: true];

const text = (x: unknown): string => (typeof x === 'string' ? x : '');
const pace = (sec: number): string => fmtClock(sec);

type Day = Pick<ResolvedDay, 'rest' | 'tag' | 'session' | 'desc' | 'runWalk'>;

export function sessionBreakdown(d: Day | null | undefined): BreakdownRow[] | null {
  if (!d || d.rest) return null;
  const rows: BreakdownRow[] = [];
  const s = d.session;
  if (s) {
    if (s.wuKm) rows.push(['Zagrevanje', `${fmtKm(s.wuKm)} km`]);
    let work: string | null = null;
    if (s.type === 'int' && s.reps && s.repM)
      work = `${s.reps} × ${s.repM} m @ ${pace(s.paceSec)}/km`;
    else if (s.type === 'pyramid' && Array.isArray(s.reps))
      work = `${s.reps.join('-')} m @ ${pace(s.paceSec)}/km`;
    else if (s.type === 'tempo' && s.qKm) work = `${fmtKm(s.qKm)} km @ ${pace(s.paceSec)}/km`;
    else if (s.type === 'fartlek' && s.reps)
      work = `${s.reps} × ${s.repSec} s @ ${pace(s.paceSec)}/km`;
    if (work) rows.push(['Radni deo', work, true]);
    if ('restSec' in s && s.restSec)
      rows.push([
        'Odmor',
        s.restSec >= 60 ? `${Math.round(s.restSec / 60)} min` : `${s.restSec} s`
      ]);
    if (s.cdKm) rows.push(['Hlađenje', `${fmtKm(s.cdKm)} km`]);
    if (d.runWalk) rows.push(['Ritam', runWalkText(d.runWalk), true]);
    const rp = rpeTarget(d);
    if (rp) rows.push(['Napor', `RPE ${rp.min}–${rp.max}`]);
    return rows.length >= 2 ? rows : null;
  }
  const desc = text(d.desc);
  const mWU = /([\d.,]+)\s*km\s*(?:WU|zagrevanje)/i.exec(desc);
  const mCD = /([\d.,]+)\s*km\s*(?:CD|hlađenje|smirivanje)/i.exec(desc);
  const afterWU = desc.split(/km\s*(?:WU|zagrevanje)\s*\+\s*/i)[1];
  let work: string | null = null;
  if (afterWU)
    work = (
      afterWU.split(/\s*\(|\s*\+\s*[\d.,]+\s*km\s*(?:CD|hlađenje|smirivanje)/i)[0] as string
    ).trim();
  const mRest = /\((\s*\d+\s*(?:min|s)\b[^)]*)\)/i.exec(desc);
  if (mWU) rows.push(['Zagrevanje', `${(mWU[1] as string).replace(',', '.')} km`]);
  if (work) rows.push(['Radni deo', work, true]);
  if (mRest) rows.push(['Odmor', (mRest[1] as string).trim()]);
  if (mCD) rows.push(['Hlađenje', `${(mCD[1] as string).replace(',', '.')} km`]);
  if (d.runWalk) rows.push(['Ritam', runWalkText(d.runWalk), true]);
  const rp2 = rpeTarget(d);
  if (rp2) rows.push(['Napor', `RPE ${rp2.min}–${rp2.max}`]);
  /* Prag od 2 reda postoji da se za običan lagan dan ne crta tabela sa jednim poljem. Ali run/walk dan je CELA poenta izmene
     posle povrede — ritam mora da se vidi i kad je jedini red. */
  return rows.length >= 2 || d.runWalk ? rows : null;
}

/**
 * Dodatne napomene iz opisa koje NISU deo strukture (npr. „plafon HR 170"). Gleda se SAMO deo posle crte (opis rada) — inače bi
 * se kvalifikator iz naziva sesije („Tempo (broken, duže reps) — …") lažno pokupio kao napomena.
 */
export function sessionNote(d: Pick<ResolvedDay, 'desc'> | null | undefined): string {
  const desc = text(d?.desc);
  const body = desc.includes('—') ? desc.slice(desc.indexOf('—') + 1) : desc;
  const parts: string[] = [];
  const paren = /\(([^)]+)\)/.exec(body);
  if (paren && !/^\s*\d+(?:[.,]\d+)?\s*(?:min|s)\b/i.test(paren[1] as string))
    parts.push((paren[1] as string).trim());
  const tail = /km\s*(?:CD|hlađenje|smirivanje)\s*[·•]\s*(.+)$/i.exec(body);
  if (tail) parts.push((tail[1] as string).trim());
  return parts.join(' · ');
}

/**
 * Vežbe snage → snimak tehnike (izbor vlasnika plana): (1) zaseban snimak baš te vežbe sa kanala E3 Rehab ili Squat
 * University; (2) inače YouTube Short sa JEDNOM vežbom, pod uslovom da su komentari pozitivni (bar tri pohvale, bez
 * preovlađujućih primedbi na tehniku); (3) gde nijedan kandidat nije prošao 2.: najbolji Short, označen `neprov` i u prikazu
 * „neprovereno". Komentari mere prijem kod gledalaca, ne ispravnost tehnike. Link dobija samo red koji POČINJE poznatim
 * nazivom („• Naziv: …").
 */
export const EXERCISE_VIDEOS: Readonly<
  Record<string, { id: string; author: string; short?: true; unverified?: true }>
> = {
  'Bugarski čučanj': { id: 'hPlKPjohFS0', author: 'Squat University' },
  'Rumunsko mrtvo dizanje na jednoj nozi': { id: 'Zfr6wizR8rs', author: 'Squat University' },
  'Mrtva buba': { id: '0XVbn86Btj0', author: 'Squat University' },
  'Podizanje prstiju uz zid (tibialis)': {
    id: 'pQcvW08rnAk',
    author: 'Physio Room Co',
    short: true
  },
  'Dorsifleksija sa trakom': {
    id: '3yFwR4z0gT0',
    author: 'Feel Good Life with Coach Todd',
    short: true
  },
  'Pallof pritisak': { id: '5aZ0IhJS8O8', author: 'Beyond Measure Fitness Training', short: true },
  'Bočna plank': { id: 'BFOyHDlY2UE', author: 'PS Fit', short: true },
  'Pogo skokovi snožno': { id: 'ztjByc9Afj4', author: 'Health & High Performance', short: true },
  'A-skip': { id: 'NEBEQba4Fb8', author: 'Chari Hawkins', short: true },
  'Skok iz čučnja': { id: 'IfqrxS_-8oU', author: 'Girls Gone Strong', short: true },
  'Goblet čučanj': { id: 'lRYBbchqxtI', author: 'SquatCouple', short: true },
  'Most na jednoj nozi': { id: 'n1IZ168x2Bw', author: 'Rogith23', short: true },
  'Podizanje na prste, jedna noga': {
    id: 'E1mG5L9rpFc',
    author: 'Evolutio Sports Physio',
    short: true
  },
  'Inverzija i everzija sa trakom': {
    id: 'DfSkLqIWykA',
    author: 'University of Texas Athletic Performance',
    short: true,
    unverified: true
  },
  'Podizanje na prste, pravo koleno': {
    id: 'n-5T_oYc1oU',
    author: 'Luke Selway',
    short: true,
    unverified: true
  },
  'Podizanje na prste, savijeno koleno (soleus)': {
    id: 'IdPEqTS6QUc',
    author: 'Westcoast SCI Physiotherapy',
    short: true,
    unverified: true
  },
  'Hod na prstima / na petama': {
    id: 'BI4glY2Alhw',
    author: 'Tension Intervention',
    short: true,
    unverified: true
  },
  'Odvođenje kuka stojeći': {
    id: '7Sph-K6Nmgc',
    author: 'Ty Training',
    short: true,
    unverified: true
  },
  'Bočni skokovi preko linije': {
    id: 'FqbcTmDy6Ps',
    author: 'Tennessee Tech Athletic Performance',
    short: true,
    unverified: true
  },
  'Pogo na jednoj nozi': {
    id: '_pDStuHcvTc',
    author: 'The Exercise Library',
    short: true,
    unverified: true
  }
};

export function exerciseVideo(
  name: string
): { url: string; author: string; unverified: boolean } | null {
  const v = Object.prototype.hasOwnProperty.call(EXERCISE_VIDEOS, name)
    ? EXERCISE_VIDEOS[name]
    : undefined;
  return v
    ? {
        url: `https://www.youtube.com/${v.short ? 'shorts/' : 'watch?v='}${v.id}`,
        author: v.author,
        unverified: !!v.unverified
      }
    : null;
}

export interface DescriptionLine {
  text: string;
  video?: { url: string; author: string; unverified: boolean; exercise: string };
}

/** Opis po redovima; red koji počinje „• Vežba:" dobija link ka snimku. Tekst se renderuje KAO TEKST (nikad kao HTML). */
export function descriptionLines(desc: unknown): DescriptionLine[] {
  return text(desc)
    .split('\n')
    .map((line) => {
      const m = /^• ([^:]+):/.exec(line);
      const v = m ? exerciseVideo(m[1] as string) : null;
      return v && m ? { text: line, video: { ...v, exercise: m[1] as string } } : { text: line };
    });
}

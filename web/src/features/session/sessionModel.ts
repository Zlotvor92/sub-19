/* PRIKAZNI MODEL TRENINGA: sve što ekrani „Danas“ i „Trening“ pokazuju o jednoj sesiji, izvedeno iz POSTOJEĆIH funkcija domena.
   Jedina izvedena veličina koja ne postoji u domenu je PROCENA TRAJANJA: zbir segmenata sesije (kilometri × lagan tempo, ponavljanja × vreme,
   pauze) — računa se ovde, uvek se prikazuje kao procena, i `null` je kad nema osnove (nepoznat lagan tempo).
   Ručno izmenjen dan (`hasAlt`) nosi staru sesiju iz generatora koja za PRIKAZ više ne važi, pa mu se struktura i tempo ne izvode iz nje. */

import {
  descriptionLines,
  sessionBreakdown,
  sessionCore,
  sessionGuide,
  sessionNote
} from '../../domain/day';
import type { BreakdownRow } from '../../domain/day';
import { dayLabel, rpeTarget, sessKind, type ResolvedDay, type RpeTarget } from '../../domain/plan';
import type { AltRecord } from '../../domain/state';

export type SegKind = 'wu' | 'rep' | 'rec' | 'cd' | 'steady';
export interface Segment {
  kind: SegKind;
  sec: number;
  /** Tempo segmenta [s/km] — visina stuba u profilu je brzina. */
  paceSec: number;
}

export interface SessionView {
  title: string;
  core: string;
  paceSec: number | null;
  /** Tempo je korisnikov sopstveni cilj za taj dan (ručna izmena), a ne procena iz forme. */
  paceOwn: boolean;
  km: number | null;
  minutes: number | null;
  rpe: RpeTarget | null;
  segments: Segment[] | null;
  rows: readonly BreakdownRow[] | null;
  guide: string | null;
  note: string;
  hasAlt: boolean;
}

const PACE_IN_DESC = /@\s*~?\s*(\d{1,2}):(\d{2})\s*\/\s*km/i;

/** Tempo napisan u opisu („… @ ~5:09/km"); `null` kad ga nema. */
export function paceFromDesc(desc: string | null | undefined): number | null {
  const m = PACE_IN_DESC.exec(desc ?? '');
  if (!m) return null;
  const sec = Number(m[1]) * 60 + Number(m[2]);
  return sec > 0 ? sec : null;
}

/** Segmenti strukturirane sesije; `null` za lagano/dugo/snagu i za sesiju čiji lagan tempo nije poznat. */
export function sessionSegments(
  day: Pick<ResolvedDay, 'session' | 'km'>,
  easyFallback: number | null
): Segment[] | null {
  const s = day.session;
  if (!s) return null;
  const out: Segment[] = [];
  const reps = (list: readonly number[], paceSec: number, restSec: number, easy: number): void => {
    list.forEach((sec, i) => {
      out.push({ kind: 'rep', sec, paceSec });
      if (i < list.length - 1 && restSec > 0)
        out.push({ kind: 'rec', sec: restSec, paceSec: easy });
    });
  };
  switch (s.type) {
    case 'int': {
      const easy = easyFallback;
      if (easy == null) return null;
      out.push({ kind: 'wu', sec: s.wuKm * easy, paceSec: easy });
      reps(
        Array.from({ length: s.reps }, () => (s.repM / 1000) * s.paceSec),
        s.paceSec,
        s.restSec,
        easy
      );
      out.push({ kind: 'cd', sec: s.cdKm * easy, paceSec: easy });
      return out;
    }
    case 'pyramid': {
      const easy = easyFallback;
      if (easy == null) return null;
      out.push({ kind: 'wu', sec: s.wuKm * easy, paceSec: easy });
      reps(
        s.reps.map((m) => (m / 1000) * s.paceSec),
        s.paceSec,
        s.restSec,
        easy
      );
      out.push({ kind: 'cd', sec: s.cdKm * easy, paceSec: easy });
      return out;
    }
    case 'fartlek': {
      const easy = s.easyPaceSec;
      out.push({ kind: 'wu', sec: s.wuKm * easy, paceSec: easy });
      reps(
        Array.from({ length: s.reps }, () => s.repSec),
        s.paceSec,
        s.restSec,
        easy
      );
      out.push({ kind: 'cd', sec: s.cdKm * easy, paceSec: easy });
      return out;
    }
    case 'tempo': {
      const easy = easyFallback;
      if (easy == null) return null;
      out.push({ kind: 'wu', sec: s.wuKm * easy, paceSec: easy });
      out.push({ kind: 'rep', sec: s.qKm * s.paceSec, paceSec: s.paceSec });
      out.push({ kind: 'cd', sec: s.cdKm * easy, paceSec: easy });
      return out;
    }
    case 'prog': {
      if (day.km == null) return null;
      const easy = s.easyPaceSec;
      out.push({ kind: 'steady', sec: Math.max(0, day.km - s.qKm) * easy, paceSec: easy });
      out.push({ kind: 'rep', sec: s.qKm * s.paceSec, paceSec: s.paceSec });
      return out;
    }
  }
}

/** Procena trajanja u minutama: iz segmenata, a za obično trčanje iz kilometara i tempa u opisu (ili laganog tempa). */
export function estimateMinutes(
  day: Pick<ResolvedDay, 'tag' | 'km' | 'desc' | 'rest' | 'runWalk'>,
  segments: readonly Segment[] | null,
  easyFallback: number | null
): number | null {
  if (day.rest) return null;
  if (segments && segments.length) {
    const total = segments.reduce((s, x) => s + x.sec, 0);
    return total > 0 ? Math.round(total / 60) : null;
  }
  if (day.runWalk || day.km == null || day.km <= 0) return null;
  if (day.tag !== 'lako' && day.tag !== 'lr') return null;
  const pace = paceFromDesc(day.desc) ?? easyFallback;
  return pace == null ? null : Math.round((day.km * pace) / 60);
}

/** Ciljni tempo za naslov dana: iz sesije, iz opisa, ili sopstveni cilj iz ručne izmene. */
export function targetPace(
  day: Pick<ResolvedDay, 'session' | 'desc' | 'tag' | 'rest'>,
  alt: AltRecord | undefined
): { sec: number | null; own: boolean } {
  if (day.rest) return { sec: null, own: false };
  if (alt) {
    const own = alt.pace != null && !alt.paceAuto;
    return { sec: alt.pace ?? paceFromDesc(day.desc), own };
  }
  if (day.session) return { sec: day.session.paceSec, own: false };
  return { sec: paceFromDesc(day.desc), own: false };
}

export function sessionView(
  day: ResolvedDay,
  ctx: { alt: AltRecord | undefined; easyPaceSec: number | null }
): SessionView {
  const hasAlt = !!ctx.alt;
  const segments = hasAlt ? null : sessionSegments(day, ctx.easyPaceSec);
  const pace = targetPace(day, ctx.alt);
  const rows = sessionBreakdown(day);
  return {
    title: dayLabel(day, hasAlt),
    core: sessionCore(day),
    paceSec: pace.sec,
    paceOwn: pace.own,
    km: day.km,
    minutes: estimateMinutes(day, segments, ctx.easyPaceSec),
    rpe: rpeTarget(day),
    segments,
    rows,
    guide: day.rest ? null : sessionGuide(sessKind(day, hasAlt)),
    note: rows ? sessionNote(day) : '',
    hasAlt
  };
}

/** Prva rečenica opisa bez video-oznaka — kratak red za „Struktura" kad nema razlomljene sesije. */
export function firstLine(desc: string | null): string {
  return descriptionLines(desc)[0]?.text ?? '';
}

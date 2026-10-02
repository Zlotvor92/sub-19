/* IZVEDENI PRIKAZ ZA PLAN TAB: kratak opis radnog dela, faze, geometrija prstenova i grafikona nedeljne kilometraže. */

import { fmtClock, fmtKm } from '../format';
import { weekPhase } from '../plan/describe';
import type { ResolvedDay, ResolvedPlan, ResolvedWeek } from '../plan/types';
import type { LogEntry } from '../state/types';
import { weekPlanKm, weekRealKm } from './stats';

type Log = Readonly<Record<string, LogEntry>>;

const text = (x: unknown): string => (typeof x === 'string' ? x : '');

/**
 * Kratak opis SAMOG RADNOG dela (jedan red u listi, bez zagrevanja i hlađenja). Za generisan plan iz `session`, inače iz teksta opisa.
 * „smirivanje" se čita uz „hlađenje": sačuvani planovi (localStorage i server) još nose staru reč.
 */
export function sessionCore(d: Pick<ResolvedDay, 'rest' | 'session' | 'desc'> | null): string {
  if (!d || d.rest) return d?.desc || 'Odmor';
  const s = d.session;
  if (s) {
    if (s.type === 'int' && s.reps && s.repM)
      return `${s.reps}×${s.repM} m @ ${fmtClock(s.paceSec)}/km`;
    if (s.type === 'pyramid' && Array.isArray(s.reps))
      return `${s.reps.join('-')} m @ ${fmtClock(s.paceSec)}/km`;
    if (s.type === 'tempo' && s.qKm) return `${fmtKm(s.qKm)} km @ ${fmtClock(s.paceSec)}/km`;
    if (s.type === 'fartlek' && s.reps)
      return `${s.reps}× ${s.repSec} s @ ${fmtClock(s.paceSec)}/km`;
  }
  const desc = text(d.desc);
  const afterWu = desc.split(/km\s*(?:WU|zagrevanje)\s*\+\s*/i)[1];
  if (afterWu) {
    const core = (
      afterWu.split(/\s*\(|\s*\+\s*[\d.,]+\s*km\s*(?:CD|hlađenje|smirivanje)/i)[0] ?? ''
    ).trim();
    if (core) return core;
  }
  return (
    desc
      .replace(/\s*\([^)]*\)/g, '')
      .replace(/\s+/g, ' ')
      .trim() || desc
  );
}

export interface PhaseGroup {
  name: string;
  weeks: ResolvedWeek[];
}

/** Faze za grupisanje nedelja: rasterećenje ostaje u grupi kojoj pripada po redosledu, a TAPER i TRKA su jedna grupa. */
export function planPhases(plan: Pick<ResolvedPlan, 'weeks'>): PhaseGroup[] {
  const groups: PhaseGroup[] = [];
  let cur: PhaseGroup | null = null;
  for (const w of plan.weeks) {
    let f: string = weekPhase(w, plan.weeks.length);
    if (f === 'DELOAD') f = cur ? cur.name : 'BAZA';
    if (f === 'TAPER' || f === 'TRKA') f = 'TAPER I TRKA';
    if (!cur || cur.name !== f) {
      cur = { name: f, weeks: [] };
      groups.push(cur);
    }
    cur.weeks.push(w);
  }
  return groups;
}

export interface RingView {
  circumference: number;
  offset: number;
  radius: number;
}

/** Prsten: `share` preko 1 se ne seče (prekoračenje plana je informacija — pun krug); ispod 0 je prazan. */
export function ringView(share: number): RingView {
  const radius = 42;
  const c = 2 * Math.PI * radius;
  const p = Math.max(0, Math.min(1, Number.isFinite(share) ? share : 0));
  return { circumference: Number(c.toFixed(1)), offset: Number((c * (1 - p)).toFixed(1)), radius };
}

export type RingTone = 'green' | 'amber' | 'red' | 'cyan' | 'faint';

/** Boja prstena nedelje: tekuća je cijan, bez ijednog kilometra bleda, inače po udelu plana (≥95% zeleno, ≥70% žuto). */
export function weekTone(share: number, realKm: number, current: boolean): RingTone {
  if (current) return 'cyan';
  if (realKm === 0) return 'faint';
  return share >= 0.95 ? 'green' : share >= 0.7 ? 'amber' : 'red';
}

export interface WeekBar {
  w: number;
  planKm: number;
  realKm: number;
}

export interface WeekChart {
  /** Vrh skale: najviša nedelja zaokružena naviše na višekratnik 12 (mreža ostaje na okruglim brojevima). */
  max: number;
  ticks: number[];
  bars: WeekBar[];
}

/** Podaci grafikona „plan vs. realizovano". Skala je DINAMIČKA (plan od 45+ nedelja i 90+ km/ned. ne sme da izađe iz okvira). */
export function weekChart(plan: Pick<ResolvedPlan, 'weeks'>, log: Log): WeekChart {
  const bars = plan.weeks.map((w) => ({
    w: w.w,
    planKm: weekPlanKm(w),
    realKm: weekRealKm(w, log)
  }));
  const peak = Math.max(1, ...bars.map((b) => Math.max(b.planKm, b.realKm)));
  const max = Math.ceil(peak / 12) * 12;
  return {
    max,
    ticks: [0, max * 0.25, max * 0.5, max * 0.75, max].map((v) => Math.round(v)),
    bars
  };
}

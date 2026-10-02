import type { ReactNode } from 'react';
import { PHASE_COLOR, type PhaseKey } from './phase';

/* OZNAKE — jedan sistem (`.badge`). Tri vrste: stanje, poreklo podatka, faza. Boja nikad ne nosi značenje sama: uvek ima reč. */

export type Tone = 'ok' | 'warn' | 'bad' | 'none';
export const TONE_VAR: Readonly<Record<Tone, string>> = {
  ok: 'var(--ok)',
  warn: 'var(--warn)',
  bad: 'var(--bad)',
  none: 'var(--text-3)'
};

/** Stanje: tačka + reč („Predstoji", „Odrađen", „U planu"). */
export function StatusBadge({ tone = 'none', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={`badge ${tone === 'none' ? '' : tone}`.trim()}>
      <i className="led" style={{ ['--c' as string]: TONE_VAR[tone] }} aria-hidden="true" />
      {children}
    </span>
  );
}

export type Provenance = 'measured' | 'estimated' | 'projected';
const PROV: Readonly<Record<Provenance, { cls: string; label: string; hint: string }>> = {
  measured: { cls: 'prov-m', label: 'Izmereno', hint: 'upisano ili izmereno: stvaran rezultat' },
  estimated: { cls: 'prov-e', label: 'Procena', hint: 'izračunato iz merenja (VDOT)' },
  projected: { cls: 'prov-p', label: 'Projekcija', hint: 'pretpostavka o budućnosti' }
};

/** Poreklo podatka: MERENO (puna), PROCENA (plava), PROJEKCIJA (isprekidana). Oblik razlikuje i kad se boja ne vidi. */
export function ProvenanceBadge({ kind }: { kind: Provenance }) {
  const p = PROV[kind];
  return (
    <span className={`badge ${p.cls}`} title={p.hint}>
      {p.label}
    </span>
  );
}

/** Faza ciklusa: boja + naziv. */
export function PhaseBadge({ phase }: { phase: PhaseKey }) {
  return (
    <span className="badge phase-tag" style={{ ['--c' as string]: PHASE_COLOR[phase] }}>
      {phase}
    </span>
  );
}

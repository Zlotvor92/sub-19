/* FAZE CIKLUSA: ključevi, boje (tokens.css) i jedna rečenica svrhe. Boja se prikazuje UVEK uz naziv faze. */

export type PhaseKey = 'BAZA' | 'RAZVOJ' | 'VRHUNAC' | 'TAPER' | 'TRKA';
export const PHASE_ORDER: readonly PhaseKey[] = ['BAZA', 'RAZVOJ', 'VRHUNAC', 'TAPER', 'TRKA'];
/** CSS promenljive boja faze (tokens.css). Boja se prikazuje UVEK uz naziv faze. */
export const PHASE_COLOR: Readonly<Record<PhaseKey, string>> = {
  BAZA: 'var(--ph-base)',
  RAZVOJ: 'var(--ph-build)',
  VRHUNAC: 'var(--ph-peak)',
  TAPER: 'var(--ph-taper)',
  TRKA: 'var(--ph-race)'
};
/** Jedna rečenica o svrsi faze — prikazuje se u „Zašto ovaj trening" i u planu. Opisuje strukturu koju generator zaista pravi. */
export const PHASE_LINE: Readonly<Record<PhaseKey, string>> = {
  BAZA: 'Gradi aerobnu osnovu i toleranciju na obim.',
  RAZVOJ: 'Gradi VO₂max i prag — kvalitetni treninzi postaju teži.',
  VRHUNAC: 'Najveći obim i najspecifičniji treninzi za tempo trke.',
  TAPER: 'Obim pada, oštrina ostaje — sveže noge za trku.',
  TRKA: 'Dan trke.'
};

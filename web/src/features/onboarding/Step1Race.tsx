import type { ReactNode } from 'react';
import type { WizardState } from '../../domain/onboarding';
import { Chips, RACE_DISTS } from './controls';

/* Jedna rečenica za IZABRANU distancu umesto objašnjenja sve četiri odjednom. Isti sadržaj kao ranije (fokus, dugo trčanje, minimum nedelja). */
const DIST_LINE: Readonly<Record<number, string>> = {
  5000: '5K gradi VO2max i brzinu.',
  10000: '10K gradi prag i specifičnu izdržljivost.',
  21097.5:
    'Polumaraton gradi izdržljivost: dva duža trčanja nedeljno, taper od dve nedelje, uvežbavanje unosa goriva.',
  42195:
    'Maraton: dugo trčanje traje najviše 3 sata, opterećenje raste u sopstvenim talasima, a unos goriva se uvežbava.'
};
const DIST_WEEKS: Readonly<Record<number, string>> = {
  5000: '6 nedelja',
  10000: '8 nedelja',
  21097.5: '10 nedelja',
  42195: '12 nedelja'
};

/* KORAK 1: ciljna distanca i datum trke. Poruku pod datumom (koliko nedelja ima plan) daje korak generatora v2 distance (`extra`). */

export function Step1Race({
  w,
  set,
  today,
  err,
  extra
}: {
  w: WizardState;
  set: (p: Partial<WizardState>) => void;
  today: string;
  err: string;
  /** Napomena pod datumom (generator v2 distance: trajanje plana u celim nedeljama). */
  extra?: ReactNode;
}) {
  return (
    <div className="ob-step active">
      <div className="ob-eyebrow">Korak 1 od 4</div>
      <h1 className="ob-h1">Za koju trku se spremaš?</h1>
      <div className="ob-sub">
        Distanca određuje strukturu plana — koliko raste dugo trčanje i koliko nedeljno ima rada u
        tempu.
      </div>
      <div className="ob-card">
        <div className="ob-ct">Ciljna distanca</div>
        <Chips
          items={RACE_DISTS}
          value={w.raceDist}
          label="Ciljna distanca"
          onPick={(v) => set({ raceDist: v })}
        />
        <div className="ob-hint">
          {DIST_LINE[w.raceDist] ?? ''} Preporučena priprema: <b>{DIST_WEEKS[w.raceDist] ?? '—'}</b>
          .
        </div>
      </div>
      <div className="ob-card">
        <div className="ob-ct">Datum trke</div>
        <div className="ob-datewrap">
          <input
            type="date"
            id="in-raceDate"
            aria-label="Datum trke"
            min={today}
            value={w.raceDate}
            onChange={(e) => set({ raceDate: e.target.value })}
          />
        </div>
        {extra}
        <div className="ob-err" id="ob-err-1" role="alert">
          {err}
        </div>
      </div>
    </div>
  );
}

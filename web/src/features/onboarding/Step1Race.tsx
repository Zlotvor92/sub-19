import type { ReactNode } from 'react';
import { brojNedelja } from '../../domain/format';
import type { WizardState, weeksHint } from '../../domain/onboarding';
import { Chips, RACE_DISTS } from './controls';

/* Jedna rečenica za IZABRANU distancu umesto objašnjenja sve četiri odjednom. Isti sadržaj kao ranije (fokus, dugo trčanje, minimum nedelja). */
const DIST_LINE: Readonly<Record<number, string>> = {
  5000: '5K gradi VO2max i brzinu.',
  10000: '10K gradi prag i specifičnu izdržljivost.',
  21097.5:
    'Polumaraton gradi izdržljivost: dva duža trčanja nedeljno, taper od dve nedelje, uvežbavanje unosa goriva.',
  42195:
    'Maraton: dugo trčanje je ograničeno vremenom (do 3 sata), uz sopstveni talas opterećenja i uvežbavanje unosa goriva.'
};
const DIST_WEEKS: Readonly<Record<number, string>> = {
  5000: '6 nedelja',
  10000: '8 nedelja',
  21097.5: '10 nedelja',
  42195: '12 nedelja'
};

/* KORAK 1: ciljna distanca i datum trke. Poruka pod datumom (koliko nedelja ima do trke i da li je dovoljno) stiže gotova iz domena. */

export function Step1Race({
  w,
  set,
  today,
  hint,
  err,
  extra
}: {
  w: WizardState;
  set: (p: Partial<WizardState>) => void;
  today: string;
  hint: ReturnType<typeof weeksHint>;
  err: string;
  /** Dodatna napomena pod datumom (5K v2: trajanje plana u celim nedeljama). */
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
        <div className="ob-hint" id="ob-weeks-hint" aria-live="polite">
          {hint.kind === 'this-week' ? (
            <>
              Trka je <b>ove nedelje</b> — plan možeš da napraviš, ali nema vremena za punu
              pripremu.
            </>
          ) : hint.kind === 'too-short' ? (
            <>
              Do trke: <b>{brojNedelja(hint.weeks)}</b> — za pun ciklus ({hint.name}) preporučuje se
              najmanje <b>{hint.minWeeks}</b>, ali možeš napraviti plan za izabrani datum uz
              napomenu o skraćenoj pripremi.
            </>
          ) : hint.kind === 'enough' ? (
            <>
              Do trke: <b>{brojNedelja(hint.weeks)}</b> — dovoljno za pun ciklus pripreme za{' '}
              {hint.nameInSentence}, sa nedeljom rasterećenja i taperom.
            </>
          ) : null}
        </div>
        {extra}
        <div className="ob-err" id="ob-err-1" role="alert">
          {err}
        </div>
      </div>
    </div>
  );
}

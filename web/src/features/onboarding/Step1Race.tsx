import { brojNedelja } from '../../domain/format';
import type { WizardState, weeksHint } from '../../domain/onboarding';
import { Chips, RACE_DISTS } from './controls';

/* KORAK 1: ciljna distanca i datum trke. Poruka pod datumom (koliko nedelja ima do trke i da li je dovoljno) stiže gotova iz domena. */

export function Step1Race({
  w,
  set,
  today,
  hint,
  err
}: {
  w: WizardState;
  set: (p: Partial<WizardState>) => void;
  today: string;
  hint: ReturnType<typeof weeksHint>;
  err: string;
}) {
  return (
    <div className="ob-step active">
      <div className="ob-eyebrow">Korak 1 od 4</div>
      <h1 className="ob-h1">Za koju trku se spremaš?</h1>
      <div className="ob-sub">
        Distanca određuje strukturu plana — koliko raste dugo trčanje i koliko tempo rada ima u
        nedelji.
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
          Svaka distanca ima <b>svoju</b> logiku — 5K gradi VO2max i brzinu, 10K prag i specifičnu
          izdržljivost, polumaraton akumuliranu izdržljivost (dva duža trčanja nedeljno, taper od
          dve nedelje, uvežbavanje goriva). Ne prave se iz istog kalupa. Maraton ide još dalje: dugo
          trčanje mu je ograničeno <b>vremenom</b> (3 sata), ima sopstveni talas i uvežbavanje
          goriva. Minimum: <b>6 nedelja</b> za 5K, <b>8</b> za 10K, <b>10</b> za polumaraton,{' '}
          <b>12</b> za maraton.
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
              Trka je <b>ove nedelje</b> — previše blizu za plan.
            </>
          ) : hint.kind === 'too-short' ? (
            <>
              Do trke: <b>{brojNedelja(hint.weeks)}</b> — {hint.name} traži najmanje{' '}
              <b>{hint.minWeeks}</b>, pa plan za ovaj datum ne može da se napravi. Pomeri trku ili
              izaberi kraću distancu.
            </>
          ) : hint.kind === 'enough' ? (
            <>
              Do trke: <b>{brojNedelja(hint.weeks)}</b> — dovoljno za pun ciklus pripreme za{' '}
              {hint.nameInSentence}, sa deload nedeljom i taperom.
            </>
          ) : null}
        </div>
        <div className="ob-err" id="ob-err-1" role="alert">
          {err}
        </div>
      </div>
    </div>
  );
}

import { pl3 } from '../../domain/format';
import {
  historyValidationMessage,
  type WizardState,
  type availableDays
} from '../../domain/onboarding';
import { Notice } from '../../components/ui/primitives';
import { Chips, DaysChips } from './controls';

/* KORAK 3: nedeljna kilometraža, redovnost i dani trčanja. Koji su dani dozvoljeni računa `availableDays`. */

export function Step3Volume({
  w,
  set,
  setDays,
  avail
}: {
  w: WizardState;
  set: (p: Partial<WizardState>) => void;
  setDays: (p: Partial<WizardState>) => void;
  avail: ReturnType<typeof availableDays>;
}) {
  return (
    <div className="ob-step active">
      <div className="ob-eyebrow">Korak 3 od 4</div>
      <h1 className="ob-h1">Koliko trčiš nedeljno?</h1>
      <div className="ob-sub">
        Prosek poslednjih 4–6 nedelja, uključujući lakše nedelje i pauze. Plan polazi od stvarnog
        trčanja.
      </div>
      <div className="ob-card">
        <div className="ob-ct">Nedeljna kilometraža</div>
        <input
          type="number"
          id="in-weeklyKm"
          aria-label="Nedeljna kilometraža"
          placeholder="npr. 22"
          min={5}
          max={120}
          inputMode="numeric"
          value={w.weeklyKm}
          onChange={(e) => set({ weeklyKm: e.target.value })}
        />
      </div>
      <div className="ob-card">
        <div className="ob-ct">Da li si trčao redovno poslednjih mesec dana?</div>
        <Chips
          items={[
            ['yes', 'Da, redovno'],
            ['no', 'Ne / tek počinjem']
          ]}
          value={w.trainedRecently ? 'yes' : 'no'}
          label="Redovno trčanje"
          onPick={(v) => set({ trainedRecently: v === 'yes' })}
        />
        <div className="ob-hint">
          Za početnika prvo idu trčanje/hodanje i lagana baza. Ako se vraćaš posle pauze, unesi je
          ispod: povratak dobija kraći lagani uvod.
        </div>
      </div>
      <details className="ob-card">
        <summary className="ob-ct">Tvoja trenutna baza — opciono</summary>
        <div className="ob-hint">
          Ovi podaci odvojeno određuju dužinu dugog trčanja i dozu kvalitetnog rada. Ako ih
          preskočiš, plan koristi oprezne pretpostavke i navodi ih.
        </div>
        <label className="ob-ct" htmlFor="recent-lr">
          Skorašnja ponovljiva dužina (km)
        </label>
        <input
          id="recent-lr"
          type="number"
          inputMode="decimal"
          min={0}
          max={100}
          step={0.1}
          placeholder="npr. 12"
          value={w.recentLongRunKm ?? ''}
          onChange={(e) => set({ recentLongRunKm: e.target.value })}
        />
        <div className="ob-hint">
          Najduže lagano trčanje iz poslednjih nekoliko nedelja koje možeš ponoviti, uz uobičajen
          oporavak.
        </div>
        <label className="ob-ct" htmlFor="consistent-weeks">
          Kontinuitet — koliko nedelja trčiš redovno
        </label>
        <input
          id="consistent-weeks"
          type="number"
          inputMode="numeric"
          min={0}
          max={5200}
          placeholder="npr. 12"
          value={w.consistentWeeks ?? ''}
          onChange={(e) => set({ consistentWeeks: e.target.value })}
        />
        <label className="ob-ct" htmlFor="break-weeks">
          Skorašnja pauza (broj nedelja)
        </label>
        <input
          id="break-weeks"
          type="number"
          inputMode="numeric"
          min={0}
          max={5200}
          placeholder="0 ako nema pauze"
          value={w.breakWeeks ?? ''}
          onChange={(e) => set({ breakWeeks: e.target.value })}
        />
        <div className="ob-hint">
          Pauza pre sadašnjeg perioda redovnog trčanja. Kilometraža iznad treba da bude tvoj
          trenutni prosek.
        </div>
        <label className="ob-ct" htmlFor="quality-experience">
          Iskustvo sa intervalima i tempo treningom
        </label>
        <select
          id="quality-experience"
          value={w.qualityExperience ?? ''}
          onChange={(e) =>
            set({ qualityExperience: e.target.value as WizardState['qualityExperience'] })
          }
        >
          <option value="">Nije navedeno</option>
          <option value="none">Tek uvodim kvalitet</option>
          <option value="some">Povremeno radim kvalitet</option>
          <option value="experienced">Redovno radim strukturirane treninge</option>
        </select>
      </details>
      {historyValidationMessage(w) ? (
        <Notice tone="warn" role="alert" title="Proveri podatke o bazi">
          {historyValidationMessage(w)}
        </Notice>
      ) : null}
      <div className="ob-card">
        <div className="ob-ct">
          Koji dani ti odgovaraju za trčanje? <span className="ob-opt">— opciono</span>
        </div>
        <DaysChips
          selected={w.runDows}
          label="Dani trčanja"
          onToggle={(d) =>
            setDays({
              runDows: w.runDows.includes(d) ? w.runDows.filter((x) => x !== d) : [...w.runDows, d]
            })
          }
        />
        <div className="ob-hint" id="runDowHint">
          {w.runDows.length >= 2 ? (
            <>
              Izabrano <b>{w.runDows.length}</b> {pl3(w.runDows.length, 'dan', 'dana', 'dana')} —
              plan koristi <b>tačno</b> te dane.
            </>
          ) : (
            <>
              Ostavi prazno i plan će sam rasporediti dane. Izaberi konkretne ako imaš fiksne
              obaveze — tada se koriste <b>tačno ti dani</b>.
            </>
          )}
        </div>
      </div>
      {w.runDows.length < 2 ? (
        <div className="ob-card" id="runDaysCard">
          <div className="ob-ct">Dana trčanja nedeljno</div>
          <Chips
            className="d6"
            items={[2, 3, 4, 5, 6, 7].map((n) => [n, String(n)] as const)}
            value={w.runDays}
            label="Dana trčanja nedeljno"
            onPick={(v) => set({ runDays: v })}
          />
        </div>
      ) : null}
      <div className="ob-card">
        <div className="ob-ct">Dan za dugo trčanje</div>
        <DaysChips
          selected={w.lrDow ? [w.lrDow] : []}
          label="Dan za dugo trčanje"
          disabled={(d) => !avail.lr(d)}
          onToggle={(d) =>
            setDays({ lrDow: d, lrDowManual: true, qDays: w.qDays.filter((x) => x !== d) })
          }
        />
      </div>
    </div>
  );
}

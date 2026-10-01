import { pl3 } from '../../domain/format';
import type { WizardState, availableDays } from '../../domain/onboarding';
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
        Prosek poslednjih 2–3 nedelje. Plan raste odavde — ne od nule i ne od željene kilometraže.
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
        <div className="ob-ct">Trčao redovno poslednjih mesec dana?</div>
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
          Ako nisi trčao redovno i obim je nizak, plan počinje sa <b>4 nedelje bazne faze</b> — samo
          lagano trčanje, pa tek onda ubrzanja i intervali.
        </div>
      </div>
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
              Ostavi prazno pa plan sam raspoređuje dane. Izaberi konkretne ako imaš fiksne obaveze
              — tada se koriste <b>tačno ti dani</b>.
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

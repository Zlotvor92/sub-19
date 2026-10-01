import { useEffect, useMemo, useState, type ChangeEvent, type ReactElement } from 'react';
import { confirmAction } from '../../app/confirm';
import { adaptGeneratedPlan, hasGenPlanData } from '../../domain/plan';
import { brojNedelja, distUReceni, fmtClock, fmtNum, pl3 } from '../../domain/format';
import {
  TOTAL_STEPS,
  availableDays,
  clampDigits,
  formPreview,
  goalVerdict,
  initialWizard,
  outlook,
  pbSanityMessage,
  stepValid,
  syncRunDays,
  toGenerationInput,
  trimQualityDays,
  usesHours,
  weeksHint,
  wizardWarnings,
  type WizardState
} from '../../domain/onboarding';
import { generatePlan } from '../../domain/training/generator/generatePlan';
import type { Intensity } from '../../domain/training/types';
import { useTrainingStore } from '../../stores';
import { activateNewPlan } from '../../stores/actions';
import { useUIStore } from '../../stores/uiStore';

/* ČAROBNJAK ZA PLAN: četiri koraka (trka → rezultat → obim → intenzitet). Sva logika je u `domain/onboarding`; ovde se samo
   crta. Dok korisnik nema plan, čarobnjak je jedini ekran i nema „✕"; kad ima, može da se otkaže. */

const STEP_NAMES = ['Trka', 'Rezultat', 'Obim', 'Intenzitet'] as const;
const DOW = ['Pon', 'Uto', 'Sre', 'Čet', 'Pet', 'Sub', 'Ned'] as const;
const RACE_DISTS = [
  [5000, '5K'],
  [10000, '10K'],
  [21097.5, 'Polumaraton'],
  [42195, 'Maraton']
] as const;
const PB_DISTS = [
  [5000, '5 km'],
  [10000, '10 km'],
  [21097.5, 'Polumaraton'],
  [42195, 'Maraton']
] as const;

function Chips<T extends string | number>({
  items,
  value,
  onPick,
  className,
  disabled,
  label
}: {
  items: ReadonlyArray<readonly [T, string]>;
  value: T | null;
  onPick: (v: T) => void;
  className?: string;
  disabled?: (v: T) => boolean;
  label: string;
}) {
  return (
    <div
      className={`ob-chiprow${className ? ` ${className}` : ''}`}
      role="group"
      aria-label={label}
    >
      {items.map(([v, text]) => {
        const off = disabled?.(v) ?? false;
        return (
          <button
            key={String(v)}
            type="button"
            className={`ob-chip${v === value ? ' on' : ''}`}
            aria-pressed={v === value}
            disabled={off}
            style={off ? { opacity: 0.3 } : undefined}
            onClick={() => onPick(v)}
          >
            {text}
          </button>
        );
      })}
    </div>
  );
}

function DaysChips({
  selected,
  onToggle,
  disabled,
  label
}: {
  selected: readonly number[];
  onToggle: (d: number) => void;
  disabled?: (d: number) => boolean;
  label: string;
}) {
  return (
    <div className="ob-chiprow week" role="group" aria-label={label}>
      {DOW.map((n, i) => {
        const d = i + 1;
        const off = disabled?.(d) ?? false;
        const on = selected.includes(d);
        return (
          <button
            key={d}
            type="button"
            className={`ob-chip${on ? ' on' : ''}`}
            aria-pressed={on}
            disabled={off}
            style={off ? { opacity: 0.3 } : undefined}
            onClick={() => onToggle(d)}
          >
            {n}
          </button>
        );
      })}
    </div>
  );
}

function TimeFields({
  prefix,
  hours,
  values,
  onChange
}: {
  prefix: string;
  hours: boolean;
  values: { h: string; min: string; sec: string };
  onChange: (field: 'h' | 'min' | 'sec', v: string) => void;
}) {
  const field = (f: 'h' | 'min' | 'sec', unit: string, max: number): ReactElement => (
    <div>
      <span className="ob-unit">{unit}</span>
      <input
        type="number"
        id={`in-${prefix}${f === 'h' ? 'H' : f === 'min' ? 'Min' : 'Sec'}`}
        aria-label={unit === 'h' ? 'sati' : unit === 'min' ? 'minuti' : 'sekunde'}
        placeholder={unit}
        inputMode="numeric"
        value={values[f]}
        onChange={(e: ChangeEvent<HTMLInputElement>) =>
          onChange(f, clampDigits(e.target.value, max))
        }
      />
    </div>
  );
  return (
    <div className="ob-row3">
      {hours ? (
        <>
          {field('h', 'h', 1)}
          <div className="ob-colon">:</div>
        </>
      ) : null}
      {field('min', 'min', 2)}
      <div className="ob-colon">:</div>
      {field('sec', 'sek', 2)}
    </div>
  );
}

export function Wizard({ today }: { today: string }) {
  const [w, setW] = useState<WizardState>(initialWizard);
  const [step, setStep] = useState(1);
  const [err, setErr] = useState('');
  const hasPlan = useTrainingStore((s) => !!s.genPlan);
  const closeWizard = useUIStore((s) => s.setWizard);
  const set = (patch: Partial<WizardState>): void => setW((cur) => ({ ...cur, ...patch }));
  const setDays = (patch: Partial<WizardState>): void =>
    setW((cur) => syncRunDays({ ...cur, ...patch }));

  /* Upozorenja generatora pravi PUN probni plan (do 6 rekurzivnih generisanja): računanje čeka 250 ms tišine. */
  const [warnings, setWarnings] = useState<string[] | null>(null);
  useEffect(() => {
    const t = setTimeout(() => setWarnings(wizardWarnings(w, today)), 250);
    return () => clearTimeout(t);
  }, [w, today]);

  const hint = useMemo(() => weeksHint(w, today), [w, today]);
  const out = useMemo(() => outlook(w, today), [w, today]);
  const form = useMemo(() => formPreview(w), [w]);
  const pbMsg = pbSanityMessage(w);
  const avail = availableDays(w);
  const valid = stepValid(w, step);
  const verdict = out && !out.short ? goalVerdict(out, w.intensity) : null;

  async function finish(): Promise<void> {
    const input = toGenerationInput(w, today);
    if (!input) return;
    const gen = generatePlan(input);
    if ('error' in gen) {
      setErr(gen.error);
      setStep(1);
      return;
    }
    const adapted = adaptGeneratedPlan(gen);
    if (!adapted) {
      setErr('Neočekivana greška pri generisanju plana.');
      setStep(1);
      return;
    }
    /* ULAZ SE PAMTI: `meta` koju generator vrati NE sadrži `pb`, `weeklyKm` ni `trainedRecently`; bez njih se plan ne može
       ponovo napraviti, pa bi svaka promena cilja usred priprema morala kroz čarobnjak, koji briše ceo dnevnik. */
    adapted.ulaz = JSON.parse(JSON.stringify(input)) as unknown;
    const t = useTrainingStore.getState();
    if (
      hasGenPlanData({
        log: t.log,
        pred: t.pred,
        alts: t.alts,
        moves: t.moves,
        vdotLog: t.vdotLog
      }) &&
      !(await confirmAction(
        'Već postoji generisan plan. Njegovi unosi (treninzi, predikcije, VDOT) biće obrisani.\n\nNastaviti?'
      ))
    )
      return;
    activateNewPlan(adapted);
    closeWizard(false);
  }

  const next = (): void => {
    if (!valid) return;
    if (step < TOTAL_STEPS) setStep(step + 1);
    else void finish();
  };

  return (
    <div id="wizard" role="dialog" aria-modal="true" aria-label="Pravljenje plana">
      <div className="ob-wrap">
        <div className="ob-top">
          <div className="ob-toprow">
            <div className="ob-brand">
              SUB<span>-20</span>
            </div>
            {hasPlan ? (
              <button
                type="button"
                className="ob-x"
                id="obCancel"
                aria-label="Otkaži"
                onClick={() => {
                  void confirmAction('Otkazati generisanje plana?').then((ok) => {
                    if (ok) closeWizard(false);
                  });
                }}
              >
                ✕
              </button>
            ) : null}
          </div>
          <div
            className="ob-progress"
            id="ob-progress"
            aria-label={`Korak ${step} od ${TOTAL_STEPS}`}
          >
            {STEP_NAMES.map((n, i) => (
              <div
                key={n}
                className={`ob-seg${i + 1 < step ? ' done' : i + 1 === step ? ' on' : ''}`}
              >
                <i />
                <b>{n}</b>
              </div>
            ))}
          </div>
        </div>
        <div className="ob-body">
          {step === 1 ? (
            <div className="ob-step active">
              <div className="ob-eyebrow">Korak 1 od 4</div>
              <h1 className="ob-h1">Za koju trku se spremaš?</h1>
              <div className="ob-sub">
                Distanca određuje strukturu plana — koliko raste dugo trčanje i koliko tempo rada
                ima u nedelji.
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
                  Svaka distanca ima <b>svoju</b> logiku — 5K gradi VO2max i brzinu, 10K prag i
                  specifičnu izdržljivost, polumaraton akumuliranu izdržljivost (dva duža trčanja
                  nedeljno, taper od dve nedelje, uvežbavanje goriva). Ne prave se iz istog kalupa.
                  Maraton ide još dalje: dugo trčanje mu je ograničeno <b>vremenom</b> (3 sata), ima
                  sopstveni talas i uvežbavanje goriva. Minimum: <b>6 nedelja</b> za 5K, <b>8</b> za
                  10K, <b>10</b> za polumaraton, <b>12</b> za maraton.
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
                      <b>{hint.minWeeks}</b>, pa plan za ovaj datum ne može da se napravi. Pomeri
                      trku ili izaberi kraću distancu.
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
          ) : null}

          {step === 2 ? (
            <div className="ob-step active">
              <div className="ob-eyebrow">Korak 2 od 4</div>
              <h1 className="ob-h1">Šta si poslednje istrčao?</h1>
              <div className="ob-sub">
                Bilo koja skorija trka na poznatoj distanci. Iz ovog jednog rezultata računa se
                svaki ciljni tempo u planu.
              </div>
              <div className="ob-card">
                <div className="ob-ct">Distanca</div>
                <Chips
                  items={PB_DISTS}
                  value={w.pbDist}
                  label="Distanca rezultata"
                  onPick={(v) => {
                    const long = usesHours(v);
                    /* sa duge na kratku distancu sati se slivaju u minute */
                    if (!long && w.pbH !== '') {
                      const folded = (+w.pbH || 0) * 60 + (+w.pbMin || 0);
                      set({
                        pbDist: v,
                        pbH: '',
                        ...(folded > 0 && folded <= 99 ? { pbMin: String(folded) } : {})
                      });
                    } else set({ pbDist: v });
                  }}
                />
              </div>
              <div className="ob-card">
                <div className="ob-ct">Vreme</div>
                <TimeFields
                  prefix="pb"
                  hours={usesHours(w.pbDist)}
                  values={{ h: w.pbH, min: w.pbMin, sec: w.pbSec }}
                  onChange={(f, v) =>
                    set(f === 'h' ? { pbH: v } : f === 'min' ? { pbMin: v } : { pbSec: v })
                  }
                />
              </div>
              {form ? (
                <div className="ob-card accent ob-vdot show" id="vdotWrap">
                  <div className="ob-ct">Tvoja forma</div>
                  <div className="ob-vrow">
                    <svg className="ob-vring" viewBox="0 0 64 64" aria-hidden="true">
                      <circle className="ob-vtrack" cx="32" cy="32" r="27" />
                      <circle
                        className="ob-vval"
                        cx="32"
                        cy="32"
                        r="27"
                        strokeDasharray="169.6"
                        strokeDashoffset={169.6 * (1 - form.fraction)}
                      />
                    </svg>
                    <div>
                      <div className="ob-vnum">{form.vdot.toFixed(1)}</div>
                      <div className="ob-vlbl">
                        VDOT — jedan broj iz kog se računa <b>svaki</b> tempo u planu.
                      </div>
                    </div>
                  </div>
                  <div className="ob-vpaces">
                    {form.paces.map((p) => (
                      <div className="ob-vp" key={p.label}>
                        <i>{p.label}</i>
                        <b>{fmtClock(p.sec)}</b>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
              {pbMsg ? (
                /* RECI ZAŠTO: „Dalje" je zaključano, a razlog se ranije nigde nije video (mrtvo dugme bez ijedne reči). */
                <div className="kb warn" role="alert">
                  <div>
                    <div>Proveri uneto vreme</div>
                    <small>{pbMsg}</small>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {step === 3 ? (
            <div className="ob-step active">
              <div className="ob-eyebrow">Korak 3 od 4</div>
              <h1 className="ob-h1">Koliko trčiš nedeljno?</h1>
              <div className="ob-sub">
                Prosek poslednjih 2–3 nedelje. Plan raste odavde — ne od nule i ne od željene
                kilometraže.
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
                  Ako nisi trčao redovno i obim je nizak, plan počinje sa{' '}
                  <b>4 nedelje bazne faze</b> — samo lagano trčanje, pa tek onda ubrzanja i
                  intervali.
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
                      runDows: w.runDows.includes(d)
                        ? w.runDows.filter((x) => x !== d)
                        : [...w.runDows, d]
                    })
                  }
                />
                <div className="ob-hint" id="runDowHint">
                  {w.runDows.length >= 2 ? (
                    <>
                      Izabrano <b>{w.runDows.length}</b>{' '}
                      {pl3(w.runDows.length, 'dan', 'dana', 'dana')} — plan koristi <b>tačno</b> te
                      dane.
                    </>
                  ) : (
                    <>
                      Ostavi prazno pa plan sam raspoređuje dane. Izaberi konkretne ako imaš fiksne
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
          ) : null}

          {step === 4 ? (
            <div className="ob-step active">
              <div className="ob-eyebrow">Korak 4 od 4</div>
              <h1 className="ob-h1">Koliko brzo da raste forma?</h1>
              <div className="ob-sub">
                Ovo određuje koliko se tempo pooštrava kroz nedelje — ne koliko ćeš trčati.
              </div>
              <div className="ob-card">
                <div className="ob-ct">Kvalitetnih treninga nedeljno</div>
                <Chips
                  items={[
                    [1, '1'],
                    [2, '2']
                  ]}
                  value={w.quality}
                  label="Kvalitetnih treninga nedeljno"
                  onPick={(v) => set({ quality: v, qDays: trimQualityDays(w.qDays, v) })}
                />
                <div className="ob-hint">
                  Na <b>3 dana trčanja ili manje</b> plan forsira 1 kvalitet — dva bi bila previše
                  na tako mali obim.
                </div>
              </div>
              <div className="ob-card">
                <div className="ob-ct">Tempo napretka</div>
                {(
                  [
                    [
                      'kons',
                      'Konzervativno',
                      'Postepen, oprezan rast forme.',
                      'Danielsova smernica'
                    ],
                    [
                      'std',
                      'Standardno',
                      'Uobičajen tempo napretka za trenirane trkače.',
                      'Danielsova smernica'
                    ],
                    [
                      'agr',
                      'Agresivno',
                      'Brz rast — realno uglavnom uz nizak trenažni staž ili paralelan gubitak telesne mase.',
                      'Kalibrisano na jedan dokumentovan slučaj'
                    ]
                  ] as ReadonlyArray<readonly [Intensity, string, string, string]>
                ).map(([k, title, text, tag]) => (
                  <button
                    key={k}
                    type="button"
                    className={`ob-icard${w.intensity === k ? ' on' : ''}`}
                    aria-pressed={w.intensity === k}
                    onClick={() => set({ intensity: k })}
                  >
                    <div className="ob-ih">
                      <b>{title}</b>
                      <span className="ob-radio" />
                    </div>
                    <p>{text}</p>
                    <span className="ob-tag">{tag}</span>
                  </button>
                ))}
              </div>
              <div className="ob-card">
                <div className="ob-ct">
                  Dani za kvalitet <span className="ob-opt">— prazno = automatski</span>
                </div>
                <DaysChips
                  selected={w.qDays}
                  label="Dani za kvalitet"
                  disabled={(d) => !avail.quality(d)}
                  onToggle={(d) =>
                    setW((cur) => {
                      if (d === cur.lrDow) return cur;
                      const has = cur.qDays.includes(d);
                      return {
                        ...cur,
                        qDays: has
                          ? cur.qDays.filter((x) => x !== d)
                          : trimQualityDays([...cur.qDays, d], cur.quality)
                      };
                    })
                  }
                />
              </div>
              <div className="ob-card accent" id="ob-outlook">
                {!out ? (
                  <>
                    <div className="ob-ct">Predviđanje na dan trke</div>
                    <div className="ob-hint">
                      Unesi skorašnji rezultat i datum trke da bi se predviđanje izračunalo.
                    </div>
                  </>
                ) : out.short ? (
                  <>
                    <div className="ob-ct">Predviđanje na dan trke</div>
                    <div className="ob-hint">
                      {brojNedelja(out.weeks)} {pl3(out.weeks, 'je', 'su', 'je')} manje od minimuma
                      za {distUReceni(out.name)} (<b>{out.minWeeks}</b>) — plan se ne može
                      napraviti, pa ni predvideti.
                    </div>
                  </>
                ) : (
                  <>
                    <div className="ob-ct">
                      Predviđanje na dan trke{' '}
                      <span className="ob-opt">
                        — {brojNedelja(out.weeks)}, {out.name}
                      </span>
                    </div>
                    <div className="ob-preds">
                      {out.rows.map((r) => (
                        <div key={r.k} className={`ob-pred${r.k === w.intensity ? ' on' : ''}`}>
                          <i>{r.label}</i>
                          <b>{fmtClock(r.sec)}</b>
                          <s>
                            {out.goal != null
                              ? r.sec <= out.goal
                                ? 'stiže cilj'
                                : 'ne stiže'
                              : `VDOT ${fmtNum(r.vdot, 1)}`}
                          </s>
                        </div>
                      ))}
                    </div>
                    {verdict ? (
                      <div className={`ob-verdict ${verdict.tone}`}>
                        <b>{verdict.lead}</b>
                        {verdict.rest}
                      </div>
                    ) : (
                      <div className="ob-hint">
                        Upiši ciljno vreme ispod pa ću ti reći koliko je realno.
                      </div>
                    )}
                  </>
                )}
              </div>
              {warnings !== null ? (
                <div className="ob-card" id="ob-warn" aria-live="polite">
                  <div className="gw-h">Na šta da paziš</div>
                  {warnings.length ? (
                    warnings.map((t) => (
                      <div className="gw" key={t}>
                        <p>{t}</p>
                      </div>
                    ))
                  ) : (
                    <div className="gw-ok">
                      Nema zamerki — traženi obim staje u izabrane dane, a raspored poštuje
                      hard/easy princip.
                    </div>
                  )}
                </div>
              ) : null}
              <div className="ob-card">
                <div className="ob-ct">
                  Ciljno vreme <span className="ob-opt">— opciono</span>
                </div>
                <TimeFields
                  prefix="goal"
                  hours={usesHours(w.raceDist)}
                  values={{ h: w.goalH, min: w.goalMin, sec: w.goalSec }}
                  onChange={(f, v) =>
                    set(f === 'h' ? { goalH: v } : f === 'min' ? { goalMin: v } : { goalSec: v })
                  }
                />
                <div className="ob-hint">
                  Ostavi prazno i plan koristi predviđanje iz tvoje forme. Upiši vreme ako imaš
                  konkretan cilj — reći ću koliko je realan.
                </div>
              </div>
            </div>
          ) : null}
        </div>
        <div className="ob-btnrow">
          {step > 1 ? (
            <button
              type="button"
              className="btn ghost"
              id="obBack"
              onClick={() => setStep(step - 1)}
            >
              Nazad
            </button>
          ) : null}
          <button type="button" className="btn" id="obNext" disabled={!valid} onClick={next}>
            {step === TOTAL_STEPS ? 'Napravi plan' : 'Dalje'}
          </button>
        </div>
      </div>
    </div>
  );
}

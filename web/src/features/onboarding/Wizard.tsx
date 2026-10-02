import { useEffect, useMemo, useState } from 'react';
import { confirmAction } from '../../app/confirm';
import { adaptGeneratedPlan, hasGenPlanData } from '../../domain/plan';
import {
  TOTAL_STEPS,
  availableDays,
  formPreview,
  goalVerdict,
  initialWizard,
  outlook,
  pbSanityMessage,
  stepValid,
  syncRunDays,
  toGenerationInput,
  weeksHint,
  wizardWarnings,
  type WizardState
} from '../../domain/onboarding';
import { generatePlan } from '../../domain/training/generator/generatePlan';
import { useActiveGenPlan, useTrainingStore } from '../../stores';
import { activateNewPlan } from '../../stores/actions';
import { useUIStore } from '../../stores/uiStore';
import { Step1Race } from './Step1Race';
import { Step2Result } from './Step2Result';
import { Step3Volume } from './Step3Volume';
import { Step4Intensity } from './Step4Intensity';

/* ČAROBNJAK ZA PLAN: četiri koraka (trka → rezultat → obim → intenzitet). Sva logika je u `domain/onboarding`; ovde se samo
   crta. Dok korisnik nema plan, čarobnjak je jedini ekran i nema „✕"; kad ima, može da se otkaže. */

const STEP_NAMES = ['Trka', 'Rezultat', 'Obim', 'Intenzitet'] as const;

export function Wizard({ today }: { today: string }) {
  const [w, setW] = useState<WizardState>(initialWizard);
  const [step, setStep] = useState(1);
  const [err, setErr] = useState('');
  const hasPlan = !!useActiveGenPlan();
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
          {step === 1 ? <Step1Race w={w} set={set} today={today} hint={hint} err={err} /> : null}

          {step === 2 ? <Step2Result w={w} set={set} form={form} pbMsg={pbMsg} /> : null}

          {step === 3 ? <Step3Volume w={w} set={set} setDays={setDays} avail={avail} /> : null}

          {step === 4 ? (
            <Step4Intensity
              w={w}
              set={set}
              setW={setW}
              avail={avail}
              out={out}
              verdict={verdict}
              warnings={warnings}
            />
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

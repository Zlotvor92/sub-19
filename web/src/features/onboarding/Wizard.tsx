import { useEffect, useMemo, useState } from 'react';
import { confirmAction } from '../../app/confirm';
import { hasGenPlanData } from '../../domain/plan';
import {
  UNSUPPORTED_DISTANCE,
  generateFiveKV2Plan,
  generateHmV2Plan,
  generateTenKV2Plan,
  generatorForDistance
} from '../../domain/generators/select';
import type { GenPlanState } from '../../domain/state';
import type { PlanRejectionReason } from '../../domain/generators/contract';
import {
  initialFiveKV2Wizard,
  toFiveKV2Input,
  v2StepValid,
  type FiveKV2Wizard
} from '../../domain/onboarding/fiveKV2';
import {
  initialTenKV2Wizard,
  tenKV2StepValid,
  toTenKV2Input,
  type TenKV2Wizard
} from '../../domain/onboarding/tenKV2';
import {
  hmV2StepValid,
  initialHmV2Wizard,
  toHmV2Input,
  type HmV2Wizard
} from '../../domain/onboarding/hmV2';
import {
  TOTAL_STEPS,
  availableDays,
  formPreview,
  goalVerdict,
  initialWizard,
  outlook,
  pbSanityMessage,
  resultDateMessage,
  stepValid,
  syncRunDays,
  toGenerationInput,
  weeksHint,
  wizardWarnings,
  type WizardState
} from '../../domain/onboarding';
import { useActiveGenPlan, useTrainingStore } from '../../stores';
import { activateNewPlan } from '../../stores/actions';
import { useGeneratorFlags } from '../../stores/generatorFlags';
import { useUIStore } from '../../stores/uiStore';
import { FiveKV2Days, FiveKV2Experience, FiveKV2RaceHint, FiveKV2Result } from './FiveKV2Steps';
import { TenKV2Days, TenKV2Experience, TenKV2RaceHint, TenKV2Result } from './TenKV2Steps';
import { HmV2Days, HmV2Experience, HmV2RaceHint, HmV2Result } from './HmV2Steps';
import { Step1Race } from './Step1Race';
import { Step2Result } from './Step2Result';
import { Step3Volume } from './Step3Volume';
import { Step4Intensity } from './Step4Intensity';

/* ČAROBNJAK ZA PLAN: četiri koraka (trka → rezultat → obim → intenzitet). Sva logika je u `domain/onboarding`; ovde se samo
   crta. Dok korisnik nema plan, čarobnjak je jedini ekran i nema „✕"; kad ima, može da se otkaže. */

const STEP_NAMES = ['Trka', 'Rezultat', 'Obim', 'Intenzitet'] as const;
/** 5K v2 / 10K v2 / HM v2 (prekidač uključen): isti broj koraka, druga polja (v. `FiveKV2Steps`, `TenKV2Steps`,
 *  `HmV2Steps`). */
const STEP_NAMES_V2 = ['Trka', 'Rezultat', 'Iskustvo', 'Dani'] as const;

export function Wizard({ today }: { today: string }) {
  const [w, setW] = useState<WizardState>(initialWizard);
  const [step, setStep] = useState(1);
  const [err, setErr] = useState('');
  const hasPlan = !!useActiveGenPlan();
  const closeWizard = useUIStore((s) => s.setWizard);
  const set = (patch: Partial<WizardState>): void => setW((cur) => ({ ...cur, ...patch }));
  /* 5K v2: SAMO nov 5K plan uz uključen prekidač; isključen prekidač ili druga distanca → čarobnjak kao do sada. */
  const flags = useGeneratorFlags();
  const isV2 = flags.fiveKV2 && w.raceDist === 5000;
  const [v2w, setV2w] = useState<FiveKV2Wizard>(initialFiveKV2Wizard);
  const [rejection, setRejection] = useState<PlanRejectionReason[] | null>(null);
  const setV2 = (patch: Partial<FiveKV2Wizard>): void => {
    setRejection(null);
    setV2w((cur) => ({ ...cur, ...patch }));
  };
  /* 10K v2 (segment 05): SAMO nov 10K plan uz uključen prekidač 10K v2; inače čarobnjak kao do sada. */
  const isTenKV2 = flags.tenKV2 === true && w.raceDist === 10000;
  const [t2w, setT2w] = useState<TenKV2Wizard>(initialTenKV2Wizard);
  const setT2 = (patch: Partial<TenKV2Wizard>): void => {
    setRejection(null);
    setT2w((cur) => ({ ...cur, ...patch }));
  };
  /* Trčanje/hodanje: odbijanje v2 (D29) doslovno čim se izabere — plan se ne pravi. */
  const runWalkRejection = useMemo(() => {
    if (!isTenKV2 || t2w.canRun30 !== false) return null;
    const input = toTenKV2Input(t2w, w.raceDate, today);
    const r = input ? generateTenKV2Plan(input) : null;
    return r && !r.ok ? r.reasons : null;
  }, [isTenKV2, t2w, w.raceDate, today]);
  /* HM v2 (segment HM-05): SAMO nov plan polumaratona uz uključen prekidač HM v2; inače čarobnjak kao do sada. */
  const isHmV2 = flags.hmV2 === true && w.raceDist === 21097.5;
  const [hmw, setHmw] = useState<HmV2Wizard>(initialHmV2Wizard);
  const setHm = (patch: Partial<HmV2Wizard>): void => {
    setRejection(null);
    setHmw((cur) => ({ ...cur, ...patch }));
  };
  /* Trčanje/hodanje: odbijanje v2 (H17) doslovno čim se izabere — plan se ne pravi. */
  const hmRunWalkRejection = useMemo(() => {
    if (!isHmV2 || hmw.canRun30 !== false) return null;
    const input = toHmV2Input(hmw, w.raceDate, today);
    const r = input ? generateHmV2Plan(input) : null;
    return r && !r.ok ? r.reasons : null;
  }, [isHmV2, hmw, w.raceDate, today]);
  /** Čarobnjak v2 bilo koje distance (isti koraci, druga polja). */
  const anyV2 = isV2 || isTenKV2 || isHmV2;
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
  const pbMsg = pbSanityMessage(w) || resultDateMessage(w, today);
  const avail = availableDays(w);
  const valid = isV2
    ? v2StepValid(v2w, step, w.raceDate, today)
    : isTenKV2
      ? tenKV2StepValid(t2w, step, w.raceDate, today)
      : isHmV2
        ? hmV2StepValid(hmw, step, w.raceDate, today)
        : stepValid(w, step, today);
  const verdict = out && !out.short ? goalVerdict(out, w.intensity) : null;

  /** Upis novog plana (posle potvrde kad postoji stari plan sa unosima). */
  async function activate(plan: GenPlanState): Promise<void> {
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
    activateNewPlan(plan);
    closeWizard(false);
  }

  /** 5K v2: plan iz ulaza v2; odbijanje ostaje na koraku kao poruka sa razlozima v2. */
  async function finishV2(): Promise<void> {
    const input = toFiveKV2Input(v2w, w.raceDate, today);
    if (!input) return;
    const r = generateFiveKV2Plan(input);
    if (!r.ok) {
      setRejection(r.reasons);
      return;
    }
    await activate(r.plan);
  }

  /** 10K v2: plan iz ulaza v2; odbijanje ostaje na koraku kao poruka sa razlozima v2. */
  async function finishTenKV2(): Promise<void> {
    const input = toTenKV2Input(t2w, w.raceDate, today);
    if (!input) return;
    const r = generateTenKV2Plan(input);
    if (!r.ok) {
      setRejection(r.reasons);
      return;
    }
    await activate(r.plan);
  }

  /** HM v2: plan iz ulaza v2; odbijanje ostaje na koraku kao poruka sa razlozima v2. */
  async function finishHmV2(): Promise<void> {
    const input = toHmV2Input(hmw, w.raceDate, today);
    if (!input) return;
    const r = generateHmV2Plan(input);
    if (!r.ok) {
      setRejection(r.reasons);
      return;
    }
    await activate(r.plan);
  }

  async function finish(): Promise<void> {
    if (isV2) return finishV2();
    if (isTenKV2) return finishTenKV2();
    if (isHmV2) return finishHmV2();
    const input = toGenerationInput(w, today);
    if (!input) return;
    const generator = generatorForDistance(input.raceDistM);
    if (!generator) {
      setErr(UNSUPPORTED_DISTANCE);
      setStep(1);
      return;
    }
    const gen = generator.generatePlan(input);
    if ('error' in gen) {
      setErr(gen.error);
      setStep(1);
      return;
    }
    const adapted = generator.adaptGeneratedPlan(gen);
    if (!adapted) {
      setErr('Neočekivana greška pri generisanju plana.');
      setStep(1);
      return;
    }
    /* ULAZ SE PAMTI: `meta` koju generator vrati NE sadrži `pb`, `weeklyKm` ni `trainedRecently`; bez njih se plan ne može
       ponovo napraviti, pa bi svaka promena cilja usred priprema morala kroz čarobnjak, koji briše ceo dnevnik. */
    adapted.ulaz = JSON.parse(JSON.stringify(input)) as unknown;
    await activate(adapted);
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
            <div className="ob-brand">sub20</div>
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
            {(anyV2 ? STEP_NAMES_V2 : STEP_NAMES).map((n, i) => (
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
            <Step1Race
              w={w}
              set={set}
              today={today}
              hint={anyV2 ? { kind: 'none' } : hint}
              err={err}
              extra={
                isV2 ? (
                  <FiveKV2RaceHint raceDate={w.raceDate} today={today} />
                ) : isTenKV2 ? (
                  <TenKV2RaceHint raceDate={w.raceDate} today={today} />
                ) : isHmV2 ? (
                  <HmV2RaceHint raceDate={w.raceDate} today={today} />
                ) : null
              }
            />
          ) : null}

          {isV2 && step === 2 ? (
            <FiveKV2Result v={v2w} set={setV2} raceDate={w.raceDate} today={today} />
          ) : null}
          {isV2 && step === 3 ? <FiveKV2Experience v={v2w} set={setV2} /> : null}
          {isV2 && step === 4 ? <FiveKV2Days v={v2w} set={setV2} rejection={rejection} /> : null}

          {isTenKV2 && step === 2 ? (
            <TenKV2Result v={t2w} set={setT2} raceDate={w.raceDate} today={today} />
          ) : null}
          {isTenKV2 && step === 3 ? (
            <TenKV2Experience v={t2w} set={setT2} runWalkRejection={runWalkRejection} />
          ) : null}
          {isTenKV2 && step === 4 ? <TenKV2Days v={t2w} set={setT2} rejection={rejection} /> : null}

          {isHmV2 && step === 2 ? (
            <HmV2Result v={hmw} set={setHm} raceDate={w.raceDate} today={today} />
          ) : null}
          {isHmV2 && step === 3 ? (
            <HmV2Experience v={hmw} set={setHm} runWalkRejection={hmRunWalkRejection} />
          ) : null}
          {isHmV2 && step === 4 ? <HmV2Days v={hmw} set={setHm} rejection={rejection} /> : null}

          {!anyV2 && step === 2 ? <Step2Result w={w} set={set} form={form} pbMsg={pbMsg} /> : null}

          {!anyV2 && step === 3 ? (
            <Step3Volume w={w} set={set} setDays={setDays} avail={avail} />
          ) : null}

          {!anyV2 && step === 4 ? (
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

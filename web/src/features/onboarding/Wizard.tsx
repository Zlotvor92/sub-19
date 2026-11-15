import { useMemo, useState } from 'react';
import { confirmAction } from '../../app/confirm';
import { hasGenPlanData } from '../../domain/plan';
import {
  UNSUPPORTED_DISTANCE,
  generateFiveKV2Plan,
  generateHmV2Plan,
  generateMarathonV2Plan,
  generateTenKV2Plan,
  generatorIdFor
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
  initialMarathonV2Wizard,
  marathonV2StepValid,
  toMarathonV2Input,
  type MarathonV2Wizard
} from '../../domain/onboarding/marathonV2';
import { TOTAL_STEPS, initialWizard, type WizardState } from '../../domain/onboarding';
import { useActiveGenPlan, useHasPlan, useTrainingStore } from '../../stores';
import { activateNewPlan } from '../../stores/actions';
import { useUIStore } from '../../stores/uiStore';
import { FiveKV2Days, FiveKV2Experience, FiveKV2RaceHint, FiveKV2Result } from './FiveKV2Steps';
import { TenKV2Days, TenKV2Experience, TenKV2RaceHint, TenKV2Result } from './TenKV2Steps';
import { HmV2Days, HmV2Experience, HmV2RaceHint, HmV2Result } from './HmV2Steps';
import {
  MarathonV2Days,
  MarathonV2Experience,
  MarathonV2RaceHint,
  MarathonV2Result
} from './MarathonV2Steps';
import { Step1Race } from './Step1Race';
import { getApp } from '../../app/appContext';
import { Disclosure } from '../../components/ui/Disclosure';
import { DAY_DROPPED, makePlan, warningText, type WizardAnswers } from '../../integrations/v4';
import { useRecoveryStore } from '../../stores/recoveryStore';
import { personalProtected, useV4Store } from '../../stores/v4Store';

/* ČAROBNJAK ZA PLAN: četiri koraka (trka → rezultat → iskustvo → dani). V1b: nov plan pravi SAMO generator v2 ciljne
   distance (5K, 10K, polumaraton, maraton; `FiveKV2Steps`, `TenKV2Steps`, `HmV2Steps`, `MarathonV2Steps`); pravila ulaza
   i odbijanja su v2, ovde se samo crta. Dok korisnik nema plan, čarobnjak je jedini ekran i nema „✕"; kad ima, može da
   se otkaže. */

const STEP_NAMES_V2 = ['Trka', 'Rezultat', 'Iskustvo', 'Dani'] as const;

export function Wizard({ today }: { today: string }) {
  const [w, setW] = useState<WizardState>(initialWizard);
  const [step, setStep] = useState(1);
  const [err, setErr] = useState('');
  const hasPlan = useHasPlan();
  const closeWizard = useUIStore((s) => s.setWizard);
  const set = (patch: Partial<WizardState>): void => setW((cur) => ({ ...cur, ...patch }));
  /* V1b: generator v2 distance iz prvog koraka (jedina putanja). */
  const distance = generatorIdFor(w.raceDist);
  const isV2 = distance === '5k';
  const [v2w, setV2w] = useState<FiveKV2Wizard>(initialFiveKV2Wizard);
  const [rejection, setRejection] = useState<PlanRejectionReason[] | null>(null);
  const setV2 = (patch: Partial<FiveKV2Wizard>): void => {
    setRejection(null);
    setV2w((cur) => ({ ...cur, ...patch }));
  };
  const isTenKV2 = distance === '10k';
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
  const isHmV2 = distance === 'hm';
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
  const isMarathonV2 = distance === 'marathon';
  const [mw, setMw] = useState<MarathonV2Wizard>(initialMarathonV2Wizard);
  const setMar = (patch: Partial<MarathonV2Wizard>): void => {
    setRejection(null);
    setMw((cur) => ({ ...cur, ...patch }));
  };
  /* Trčanje/hodanje: odbijanje v2 (M17) doslovno čim se izabere — plan se ne pravi. */
  const marRunWalkRejection = useMemo(() => {
    if (!isMarathonV2 || mw.canRun30 !== false) return null;
    const input = toMarathonV2Input(mw, w.raceDate, today);
    const r = input ? generateMarathonV2Plan(input) : null;
    return r && !r.ok ? r.reasons : null;
  }, [isMarathonV2, mw, w.raceDate, today]);
  /* F9 korak 7 (A4): pod zastavicom V4 korak 3 traži samo ispravan unos (obim, odgovor na pitanja) — izbor trkača
     (trčanje/hodanje, početnik, mali obim) se ne odbija; plan se pravi uz upozorenje (AGENTS § V4 t. 6). */
  /* A5: dok je lični plan vlasnika zaštićen (do 13. 12. 2026), nov plan ide starim putem — V4 se ne nudi. */
  const activePlan = useActiveGenPlan();
  const v4Today0 = useV4Store((s) => s.today);
  const v4Flag = useV4Store((s) => s.enabled) && !personalProtected(activePlan, v4Today0 ?? today);
  const step3V4 = (v: {
    weeklyKm: string;
    experience: string | null;
    canRun30: boolean | null;
  }): boolean =>
    (!isV2 && v.canRun30 === false) ||
    (v.weeklyKm !== '' &&
      Number.isFinite(+v.weeklyKm) &&
      +v.weeklyKm >= 0 &&
      (isV2
        ? v.experience !== null && (v.experience === 'regular' || v.canRun30 !== null)
        : v.canRun30 === true && v.experience !== null));
  const v4Step3 =
    v4Flag && step === 3
      ? isV2
        ? step3V4(v2w)
        : isTenKV2
          ? step3V4(t2w)
          : isHmV2
            ? step3V4(hmw)
            : isMarathonV2
              ? step3V4(mw)
              : null
      : null;
  const valid =
    v4Step3 !== null
      ? v4Step3
      : isV2
        ? v2StepValid(v2w, step, w.raceDate, today)
        : isTenKV2
          ? tenKV2StepValid(t2w, step, w.raceDate, today)
          : isHmV2
            ? hmV2StepValid(hmw, step, w.raceDate, today)
            : isMarathonV2
              ? marathonV2StepValid(mw, step, w.raceDate, today)
              : false;

  /* F9 korak 7: pod zastavicom V4 plan pravi V4 motor iz istih odgovora (ulaz v2 kao oblik razmene). Sa ugašenom
     zastavicom ništa od ovoga se ne računa ni ne prikazuje. */
  const v4On = v4Flag && distance !== null;
  const v4Today = useV4Store((s) => s.today) ?? today;
  const knee = useRecoveryStore((s) => s.knee);
  /* korak 8: forma iz trčanja (`aktivnost`) ulazi u nov plan */
  const v4Runs = useV4Store((s) => s.runs);
  const [confirmedDays, setConfirmedDays] = useState(false);
  const answersV4 = (): WizardAnswers | null => {
    const a = answersOf();
    /* trčanje/hodanje (v2 ga odbija): V4 pravi plan kao za početnika, uz upozorenje motora */
    return a !== null && 'runWalk' in a && a.runWalk === true
      ? { ...a, experience: 'beginner' }
      : a;
  };
  const answersOf = () =>
    isV2
      ? toFiveKV2Input(v2w, w.raceDate, today)
      : isTenKV2
        ? toTenKV2Input(t2w, w.raceDate, today)
        : isHmV2
          ? toHmV2Input(hmw, w.raceDate, today)
          : isMarathonV2
            ? toMarathonV2Input(mw, w.raceDate, today)
            : null;
  const v4Preview = useMemo(() => {
    if (!v4On || step !== TOTAL_STEPS || !valid || distance === null) return null;
    const answers = answersV4();
    if (answers === null) return null;
    try {
      return makePlan({
        distance,
        answers,
        today: v4Today,
        knee,
        activities: v4Runs,
        confirmedRunDays: confirmedDays
      });
    } catch {
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- odgovori su u v2w/t2w/hmw/mw
  }, [
    v4On,
    step,
    valid,
    distance,
    v2w,
    t2w,
    hmw,
    mw,
    w.raceDate,
    today,
    v4Today,
    knee,
    v4Runs,
    confirmedDays
  ]);
  const runDayCount = v4Preview?.ok ? v4Preview.facts.availability.runDays.length : 0;

  /** V4: upis plana kroz `commitAction`; stari plan (genPlan, prethodni red → `plan_v4_verzija`) ostaje kao arhiva,
   *  a trčanja (`log`) i forma se ne diraju (odluka vlasnika 4). */
  async function finishV4(): Promise<void> {
    const made = v4Preview;
    const v4 = getApp().v4;
    if (made === null || v4 === null) return;
    if (!made.ok) {
      setErr(made.errors.map((e) => e.message).join('\n'));
      setStep(1);
      return;
    }
    if (
      hasPlan &&
      !(await confirmAction(
        'Postojeći plan se arhivira, a trčanja i forma ostaju.\n\nNapraviti nov plan?'
      ))
    )
      return;
    const ok = await v4.commit(() => ({ doc: made.doc, otisak: made.otisak }));
    if (!ok) {
      setErr('Plan nije sačuvan — nema veze sa serverom. Pokušaj ponovo.');
      setStep(1);
      return;
    }
    closeWizard(false);
  }

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

  /** Maraton v2: plan iz ulaza v2; odbijanje ostaje na koraku kao poruka sa razlozima v2. */
  async function finishMarathonV2(): Promise<void> {
    const input = toMarathonV2Input(mw, w.raceDate, today);
    if (!input) return;
    const r = generateMarathonV2Plan(input);
    if (!r.ok) {
      setRejection(r.reasons);
      return;
    }
    await activate(r.plan);
  }

  async function finish(): Promise<void> {
    if (v4On) return finishV4();
    if (isV2) return finishV2();
    if (isTenKV2) return finishTenKV2();
    if (isHmV2) return finishHmV2();
    if (isMarathonV2) return finishMarathonV2();
    setErr(UNSUPPORTED_DISTANCE);
    setStep(1);
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
                  void confirmAction('Otkazati pravljenje plana?').then((ok) => {
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
            {STEP_NAMES_V2.map((n, i) => (
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
              err={err}
              extra={
                isV2 ? (
                  <FiveKV2RaceHint raceDate={w.raceDate} today={today} />
                ) : isTenKV2 ? (
                  <TenKV2RaceHint raceDate={w.raceDate} today={today} />
                ) : isHmV2 ? (
                  <HmV2RaceHint raceDate={w.raceDate} today={today} />
                ) : isMarathonV2 ? (
                  <MarathonV2RaceHint raceDate={w.raceDate} today={today} />
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
            <TenKV2Experience
              v={t2w}
              set={setT2}
              runWalkRejection={v4Flag ? null : runWalkRejection}
            />
          ) : null}
          {isTenKV2 && step === 4 ? <TenKV2Days v={t2w} set={setT2} rejection={rejection} /> : null}

          {isHmV2 && step === 2 ? (
            <HmV2Result v={hmw} set={setHm} raceDate={w.raceDate} today={today} />
          ) : null}
          {isHmV2 && step === 3 ? (
            <HmV2Experience
              v={hmw}
              set={setHm}
              runWalkRejection={v4Flag ? null : hmRunWalkRejection}
            />
          ) : null}
          {isHmV2 && step === 4 ? <HmV2Days v={hmw} set={setHm} rejection={rejection} /> : null}

          {isMarathonV2 && step === 2 ? (
            <MarathonV2Result v={mw} set={setMar} raceDate={w.raceDate} today={today} />
          ) : null}
          {isMarathonV2 && step === 3 ? (
            <MarathonV2Experience
              v={mw}
              set={setMar}
              runWalkRejection={v4Flag ? null : marRunWalkRejection}
            />
          ) : null}
          {isMarathonV2 && step === 4 ? (
            <MarathonV2Days v={mw} set={setMar} rejection={rejection} />
          ) : null}
          {v4Preview?.ok && v4Preview.warnings.length > 0 ? (
            <div className="plan-warn" id="v4-warnings">
              <Disclosure
                title="Na šta da paziš u ovom planu"
                meta={String(v4Preview.warnings.length)}
                open
              >
                {v4Preview.warnings.map((x) => (
                  <p className="note-src" key={x.code + x.problem}>
                    {warningText(x)}
                  </p>
                ))}
                {!confirmedDays && v4Preview.warnings.some((x) => x.code === DAY_DROPPED) ? (
                  <button
                    type="button"
                    className="btn ghost block"
                    onClick={() => setConfirmedDays(true)}
                  >
                    Ipak hoću {runDayCount} dana
                  </button>
                ) : null}
              </Disclosure>
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

import { useState } from 'react';
import {
  parseTimeStr,
  fmtClock,
  fmtNum,
  glagolZaBroj,
  brojNedelja,
  pl3
} from '../../domain/format';
import { parseIsoDate } from '../../domain/date';
import { planWithNewGoal } from '../../domain/plan';
import { raceRefs } from '../../domain/race';
import { confirmAction } from '../../app/confirm';
import { useResolvedPlan, useTrainingStore } from '../../stores';
import { discardPlan } from '../../stores/actions';
import { commitRecalibration, previewRecalibration } from '../../stores/raceActions';
import { useIsOwner } from '../../stores/owner';
import { useUIStore } from '../../stores/uiStore';
import { Help } from './SettingCard';
import { type SectionInfo } from './sectionInfo';

/* ------------------------------------------------------------- Plan */

export function usePlanInfo(): SectionInfo {
  const plan = useResolvedPlan();
  const hasGenPlan = useTrainingStore((s) => !!s.genPlan);
  const owner = useIsOwner();
  const kind = hasGenPlan ? (owner ? 'generisan plan' : 'tvoj plan') : 'tvoj lični plan';
  return {
    visible: !!plan,
    summary: `${kind} · ${brojNedelja(plan?.weeks.length ?? 0)}`,
    dot: true,
    open: false
  };
}

export function PlanBody() {
  const plan = useResolvedPlan();
  const genPlan = useTrainingStore((s) => s.genPlan);
  const setGenPlan = useTrainingStore((s) => s.setGenPlan);
  const today = useUIStore((s) => s.today);
  const setWizard = useUIStore((s) => s.setWizard);
  const closeSheet = useUIStore((s) => s.closeSheet);
  const owner = useIsOwner();
  const [goal, setGoal] = useState('');
  /* Ugrađeni lični plan (nema generisanog): ne menja se cilj, nego se pravi novi plan. */
  if (!genPlan)
    return (
      <>
        <div className="btnrow">
          <button type="button" className="btn ghost" id="pl-gen" onClick={() => setWizard(true)}>
            🧙 Generiši novi plan
          </button>
        </div>
        <Help summary="Za koga je novi plan">
          <p>
            Pravi poseban plan za nekog drugog — tvoj plan ostaje netaknut i uvek mu se vraćaš ovim
            istim dugmetom.
          </p>
        </Help>
      </>
    );
  const refs = raceRefs(genPlan.meta);
  const goalText = fmtClock(refs.goalSec ?? 0);

  const changeGoal = async (): Promise<void> => {
    const sec = parseTimeStr(goal.trim());
    if (!sec || !(sec > 0)) {
      window.alert('Unesi ciljno vreme, npr. 3:25:00 ili 21:09.');
      return;
    }
    const day = parseIsoDate(today);
    if (!day) return;
    const r = planWithNewGoal(genPlan, sec, day);
    if ('error' in r) {
      window.alert(r.error);
      return;
    }
    /* Realnost cilja se proverava istim merilom koje čarobnjak već koristi. */
    const warn =
      r.meta.realno === false
        ? '\n\nUPOZORENJE: ovaj cilj je po proceni aplikacije van dohvata za preostalo vreme. Plan će ga ipak ispoštovati.'
        : '';
    const n = r.goalChange.changedWeeks;
    const ok = await confirmAction(
      `Promeniti ciljno vreme na ${fmtClock(sec)}?\n\n${glagolZaBroj(n, 'Menja se ', 'Menjaju se ')}${brojNedelja(n)} ${pl3(n, 'koja tek dolazi', 'koje tek dolaze', 'koje tek dolaze')} (od N${r.goalChange.week}).\nOdrađeni treninzi, uneti tempi i izmerena forma ostaju netaknuti.${warn}`
    );
    if (!ok) return;
    setGenPlan({ weeks: r.weeks, pred: r.pred, qs: r.qs, meta: r.meta, ulaz: r.ulaz });
    closeSheet();
    window.alert(`Cilj promenjen. Izmenjeno nedelja: ${n}.`);
  };

  const recalibrate = async (): Promise<void> => {
    if (!plan) return;
    const pv = previewRecalibration(plan, today);
    if (!pv.ok) {
      window.alert(pv.reason);
      return;
    }
    const r = pv.result.recalibration;
    const n = r.changedWeeks;
    const delta = pv.form - pv.planVdot;
    const before = r.predictedBefore ? fmtClock(r.predictedBefore) : '—';
    const ok = await confirmAction(
      `Preračunati preostali plan prema izmerenoj formi?\n\nIzmerena forma: VDOT ${fmtNum(pv.form, 1)} · plan je očekivao: VDOT ${fmtNum(pv.planVdot, 1)} (${delta > 0 ? '+' : ''}${fmtNum(delta, 1)}).\nProjektovano vreme na dan trke: ${before} → ${fmtClock(r.predictedAfter)}.\n\n${glagolZaBroj(n, 'Menja se ', 'Menjaju se ')}${brojNedelja(n)} ${pl3(n, 'koja tek dolazi', 'koje tek dolaze', 'koje tek dolaze')} (od N${r.week}): tempi sesija, a kilometraža najviše za nekoliko km. Tempo trke, kalendar i raspored dana ostaju isti.\nOdrađeni treninzi, uneti tempi, ručno zaključana polja i izmerena forma ostaju netaknuti.\n\nNema vraćanja — ako ti treba, prvo izvezi backup.`
    );
    if (!ok) return;
    commitRecalibration(pv.result);
    closeSheet();
    window.alert(`Plan preračunat. Izmenjeno nedelja: ${n}.`);
  };

  return (
    <>
      {genPlan.ulaz ? (
        <>
          <div className="set-st">Ciljno vreme · {goalText}</div>
          <div className="btnrow">
            <input
              id="pl-goal"
              className="wseg-in"
              inputMode="numeric"
              style={{ maxWidth: 140 }}
              placeholder={goalText}
              aria-label="Novo ciljno vreme"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
            />
            <button
              type="button"
              className="btn ghost sm"
              id="pl-goal-ok"
              onClick={() => void changeGoal()}
            >
              Promeni cilj
            </button>
          </div>
          <Help summary="Šta se menja kad promeniš cilj">
            <p>
              Menjaju se samo nedelje koje <b>tek dolaze</b> — i to tempi sesija vezanih za tempo
              trke. Odrađeni treninzi, uneti tempi i izmerena forma ostaju netaknuti; cilj govori o
              budućnosti, pa ne dira prošlost. Ručno zaključani tempi zadržavaju svoju vrednost.
            </p>
          </Help>
          <div className="set-st">Forma i plan</div>
          <div className="btnrow">
            <button
              type="button"
              className="btn ghost sm"
              id="pl-recal"
              onClick={() => void recalibrate()}
            >
              Preračunaj plan prema formi
            </button>
          </div>
          <Help summary="Čime se razlikuje od „Prilagodi tempo“">
            <p>
              „Prilagodi tempo“ (na tabu Trka) menja samo ciljne tempe sesija. Ovo preračunava{' '}
              <b>ceo ostatak plana</b> po putanji koja prolazi kroz tvoju stvarnu formu: tempi,
              projektovano vreme na dan trke i — vrlo malo — kilometraža. Tempo trke i kalendar se
              ne menjaju. Radi tek kad postoji bar 3 merenja i kad se forma i plan razilaze za 1,5
              VDOT ili više.
            </p>
          </Help>
        </>
      ) : null}
      <div className="btnrow">
        {owner ? (
          <button
            type="button"
            className="btn ghost"
            id="pl-revert"
            onClick={() => {
              void confirmAction(
                'Vratiti se na tvoj originalni plan? Generisan plan se TRAJNO briše (napredak/unosi uz njega takođe) — nema arhive.\n\nTvoj plan i njegova istorija se vraćaju netaknuti.'
              ).then((ok) => {
                if (!ok) return;
                discardPlan();
                closeSheet();
              });
            }}
          >
            Vrati na moj plan
          </button>
        ) : (
          <button
            type="button"
            className="btn ghost"
            id="pl-new"
            onClick={() => {
              void confirmAction(
                'Napraviti nov plan?\n\nPostojeći plan i svi unosi uz njega se TRAJNO brišu — nema arhive.\n\nAko ti trebaju, prvo izvezi backup.'
              ).then((ok) => {
                if (!ok) return;
                discardPlan();
                setWizard(true);
                closeSheet();
              });
            }}
          >
            🧙 Napravi novi plan
          </button>
        )}
      </div>
    </>
  );
}

/* ------------------------------------------------------------- Podaci */

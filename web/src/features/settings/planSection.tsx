import { useState } from 'react';
import { parseTimeStr, fmtClock, glagolZaBroj, brojNedelja, pl3 } from '../../domain/format';
import { parseIsoDate } from '../../domain/date';
import { planWithNewGoal } from '../../domain/plan';
import { raceRefs } from '../../domain/race';
import { confirmAction } from '../../app/confirm';
import { useResolvedPlan, useTrainingStore } from '../../stores';
import { discardPlan } from '../../stores/actions';
import { useUIStore } from '../../stores/uiStore';
import { Help } from './SettingCard';
import { type SectionInfo } from './sectionInfo';

/* ------------------------------------------------------------- Plan */

export function usePlanInfo(): SectionInfo {
  const plan = useResolvedPlan();
  return {
    visible: !!plan,
    summary: `tvoj plan · ${brojNedelja(plan?.weeks.length ?? 0)}`,
    dot: true,
    open: false
  };
}

export function PlanBody() {
  const genPlan = useTrainingStore((s) => s.genPlan);
  const setGenPlan = useTrainingStore((s) => s.setGenPlan);
  const today = useUIStore((s) => s.today);
  const setWizard = useUIStore((s) => s.setWizard);
  const closeSheet = useUIStore((s) => s.closeSheet);
  const [goal, setGoal] = useState('');
  if (!genPlan) return null;
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
        </>
      ) : null}
      <div className="btnrow">
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
      </div>
    </>
  );
}

/* ------------------------------------------------------------- Podaci */

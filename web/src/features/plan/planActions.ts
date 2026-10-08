import {
  brojNedelja,
  fmtClock,
  fmtNum,
  glagolZaBroj,
  parseTimeStr,
  pl3
} from '../../domain/format';
import { parseIsoDate } from '../../domain/date';
import { planWithNewGoal, type ResolvedPlan } from '../../domain/plan';
import type { GenPlanState } from '../../domain/state';
import { confirmAction } from '../../app/confirm';
import { useTrainingStore } from '../../stores';
import { discardPlan } from '../../stores/actions';
import { commitRecalibration, previewRecalibration } from '../../stores/raceActions';
import { useUIStore } from '../../stores/uiStore';

/* RADNJE NAD PLANOM (promena cilja, preračunavanje prema formi, novi plan). Isti tokovi, ista pitanja i iste poruke kao ranije u podešavanjima — ovde su samo
   izvučeni iz prikaza, da ih mogu pozvati i Ti → Cilj i Plan → Prilagodi plan. Pitanja idu kroz `confirmAction` (ne `window.confirm`), ishod kroz `alert`. */

/** Promena ciljnog vremena usred pripreme. Vraća `true` kad je plan promenjen. */
export async function changeGoalTime(
  genPlan: GenPlanState,
  raw: string,
  todayStr: string
): Promise<boolean> {
  const sec = parseTimeStr(raw.trim());
  if (!sec || !(sec > 0)) {
    window.alert('Unesi ciljno vreme, npr. 3:25:00 ili 21:09.');
    return false;
  }
  const day = parseIsoDate(todayStr);
  if (!day) return false;
  const r = planWithNewGoal(genPlan, sec, day);
  if ('error' in r) {
    window.alert(r.error);
    return false;
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
  if (!ok) return false;
  useTrainingStore
    .getState()
    .setGenPlan({ weeks: r.weeks, pred: r.pred, qs: r.qs, meta: r.meta, ulaz: r.ulaz });
  window.alert(`Cilj promenjen. Izmenjeno nedelja: ${n}.`);
  return true;
}

/** „Preračunaj plan prema formi“: pregled, pitanje, upis. Vraća `true` kad je plan preračunat. */
export async function recalibratePlan(plan: ResolvedPlan, todayStr: string): Promise<boolean> {
  const pv = previewRecalibration(plan, todayStr);
  if (!pv.ok) {
    window.alert(pv.reason);
    return false;
  }
  const r = pv.result.recalibration;
  const n = r.changedWeeks;
  const delta = pv.form - pv.planVdot;
  const before = r.predictedBefore ? fmtClock(r.predictedBefore) : '—';
  const ok = await confirmAction(
    `Preračunati preostali plan prema izmerenoj formi?\n\nIzmerena forma: VDOT ${fmtNum(pv.form, 1)} · plan je očekivao: VDOT ${fmtNum(pv.planVdot, 1)} (${delta > 0 ? '+' : ''}${fmtNum(delta, 1)}).\nProjektovano vreme na dan trke: ${before} → ${fmtClock(r.predictedAfter)}.\n\n${glagolZaBroj(n, 'Menja se ', 'Menjaju se ')}${brojNedelja(n)} ${pl3(n, 'koja tek dolazi', 'koje tek dolaze', 'koje tek dolaze')} (od N${r.week}): tempi i obim sesija prema izmerenoj formi. Cilj, kalendar i raspored dana ostaju isti. Trkački treninzi ne idu brže nego što trenutna forma podržava.\nOdrađeni treninzi, uneti tempi, ručno zaključana polja i izmerena forma ostaju netaknuti.\n\nNema vraćanja — ako ti treba, prvo izvezi backup.`
  );
  if (!ok) return false;
  commitRecalibration(pv.result);
  window.alert(`Plan preračunat. Izmenjeno nedelja: ${n}.`);
  return true;
}

/** Novi plan umesto postojećeg generisanog: trajno briše postojeći plan i njegove unose, pa otvara čarobnjak. */
export function startNewPlan(): void {
  void confirmAction(
    'Napraviti nov plan?\n\nPostojeći plan i svi unosi uz njega se TRAJNO brišu — nema arhive.\n\nAko ti trebaju, prvo izvezi backup.'
  ).then((ok) => {
    if (!ok) return;
    discardPlan();
    useUIStore.getState().setWizard(true);
  });
}

/** Vlasnik se vraća na svoj ugrađeni plan: generisan plan se trajno briše. */
export function backToOwnPlan(): void {
  void confirmAction(
    'Vratiti se na tvoj originalni plan? Generisan plan se TRAJNO briše (napredak/unosi uz njega takođe) — nema arhive.\n\nTvoj plan i njegova istorija se vraćaju netaknuti.'
  ).then((ok) => {
    if (ok) discardPlan();
  });
}

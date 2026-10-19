import {
  brojNedelja,
  fmtClock,
  fmtNum,
  glagolZaBroj,
  parseTimeStr,
  pl3
} from '../../domain/format';
import { parseIsoDate } from '../../domain/date';
import type { ResolvedPlan } from '../../domain/plan';
import {
  fiveKV2GoalChange,
  generatorForPlan,
  tenKV2GoalChange,
  hmV2GoalChange,
  stampForStorage,
  unsupportedPlanReason
} from '../../domain/generators/select';
import type { GenPlanState } from '../../domain/state';
import { confirmAction } from '../../app/confirm';
import { useTrainingStore } from '../../stores';
import { discardPlan } from '../../stores/actions';
import { commitRecalibration, previewRecalibration } from '../../stores/raceActions';
import { useUIStore } from '../../stores/uiStore';
import {
  alignAutomaticAlts,
  planStateStamp,
  planPreviewChanges,
  replanContext
} from '../../stores/executionActions';
import { recordPlanRevision } from '../../domain/plan/versions';

const describeChanges = (result: GenPlanState, today: string): string =>
  planPreviewChanges(result, today)
    .slice(0, 4)
    .map(
      (week) =>
        `N${week.week}: preostali km ${fmtNum(week.beforeKm, 1)} → ${fmtNum(week.afterKm, 1)}; kvalitet ${fmtNum(week.qualityMinutesBefore ?? 0, 1)} → ${fmtNum(week.qualityMinutesAfter ?? 0, 1)} min; zahtevni treninzi ${week.demandingDaysBefore ?? 0} → ${week.demandingDaysAfter ?? 0}`
    )
    .join('\n');

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
  const stamp = planStateStamp();
  const generator = generatorForPlan(genPlan);
  if (!generator) {
    window.alert(unsupportedPlanReason(genPlan));
    return false;
  }
  const r = generator.planWithNewGoal(genPlan, sec, day, replanContext());
  if ('error' in r) {
    window.alert(r.error);
    return false;
  }
  /* Realnost cilja se proverava istim merilom koje čarobnjak već koristi. */
  const warn =
    r.meta.realno === false
      ? '\n\nUPOZORENJE: cilj traži bržu formu od referentnog rezultata. Ciljno vreme ne ubrzava trening iznad podržane forme.'
      : '';
  const n = r.goalChange.changedWeeks;
  const ok = await confirmAction(
    `Promeniti ciljno vreme na ${fmtClock(sec)}?\n\n${glagolZaBroj(n, 'Menja se ', 'Menjaju se ')}${brojNedelja(n)} ${pl3(n, 'koja tek dolazi', 'koje tek dolaze', 'koje tek dolaze')} (od N${r.goalChange.week}).\nOdrađeni treninzi, uneti tempi i izmerena forma ostaju netaknuti.\n\n${describeChanges(r, todayStr)}${warn}`
  );
  if (!ok) return false;
  if (stamp !== planStateStamp()) {
    window.alert('Plan ili unosi su se promenili. Ponovo pregledaj promenu cilja.');
    return false;
  }
  useTrainingStore.getState().patch({
    genPlan: recordPlanRevision(genPlan, stampForStorage({ ...genPlan, ...r }), {
      reason: 'goal',
      date: day,
      summary: `Cilj ${fmtClock(sec)}`
    }),
    alts: alignAutomaticAlts({ ...genPlan, ...r }, day)
  });
  window.alert(`Cilj promenjen. Izmenjeno nedelja: ${n}.`);
  return true;
}

/** 08b: promena cilja plana 5K v2 — isti treninzi, tempo i obim; menja se samo ocena cilja (v2 je računa iz iste forme).
 *  Pitanje prikazuje ocenu pre i posle; upis je nova revizija. Vraća `true` kad je plan promenjen. */
export async function changeGoalTimeV2(
  genPlan: GenPlanState,
  raw: string,
  todayStr: string
): Promise<boolean> {
  const sec = parseTimeStr(raw.trim());
  if (!sec || !(sec > 0)) {
    window.alert('Unesi ciljno vreme, npr. 21:09.');
    return false;
  }
  const day = parseIsoDate(todayStr);
  if (!day) return false;
  const stamp = planStateStamp();
  const r = fiveKV2GoalChange(genPlan, sec, day);
  if (!r.ok) {
    window.alert(`Cilj nije promenjen:\n${r.reasons.map((x) => x.message).join('\n')}`);
    return false;
  }
  const line = (g: typeof r.before): string => (g ? `${g.label} — ${g.message}` : 'bez ocene');
  const ok = await confirmAction(
    `Promeniti ciljno vreme na ${fmtClock(sec)}?\n\nTreninzi, tempo i obim ostaju isti; menja se samo ocena cilja.\nSada: ${line(r.before)}\nPosle: ${line(r.after)}`
  );
  if (!ok) return false;
  if (stamp !== planStateStamp()) {
    window.alert('Plan ili unosi su se promenili. Ponovo pregledaj promenu cilja.');
    return false;
  }
  useTrainingStore.getState().patch({
    genPlan: recordPlanRevision(genPlan, stampForStorage(r.result), {
      reason: 'goal',
      date: day,
      summary: `Cilj ${fmtClock(sec)}`
    })
  });
  window.alert(`Cilj promenjen. Ocena: ${line(r.after)}`);
  return true;
}

/** Segment 06: promena cilja plana 10K v2 — isti treninzi, tempo i obim; menja se samo ocena cilja (v2 je računa iz iste
 *  forme; plan po osećaju je nema do rezultata). Pitanje prikazuje ocenu pre i posle; upis je nova revizija. Vraća
 *  `true` kad je plan promenjen. */
export async function changeGoalTimeTenKV2(
  genPlan: GenPlanState,
  raw: string,
  todayStr: string
): Promise<boolean> {
  const sec = parseTimeStr(raw.trim());
  if (!sec || !(sec > 0)) {
    window.alert('Unesi ciljno vreme, npr. 44:30.');
    return false;
  }
  const day = parseIsoDate(todayStr);
  if (!day) return false;
  const stamp = planStateStamp();
  const r = tenKV2GoalChange(genPlan, sec, day);
  if (!r.ok) {
    window.alert(`Cilj nije promenjen:\n${r.reasons.map((x) => x.message).join('\n')}`);
    return false;
  }
  const line = (g: typeof r.before): string =>
    g ? `${g.label} — ${g.message}` : 'bez ocene (plan po osećaju: ocena posle rezultata)';
  const ok = await confirmAction(
    `Promeniti ciljno vreme na ${fmtClock(sec)}?\n\nTreninzi, tempo i obim ostaju isti; menja se samo ocena cilja.\nSada: ${line(r.before)}\nPosle: ${line(r.after)}`
  );
  if (!ok) return false;
  if (stamp !== planStateStamp()) {
    window.alert('Plan ili unosi su se promenili. Ponovo pregledaj promenu cilja.');
    return false;
  }
  useTrainingStore.getState().patch({
    genPlan: recordPlanRevision(genPlan, stampForStorage(r.result), {
      reason: 'goal',
      date: day,
      summary: `Cilj ${fmtClock(sec)}`
    })
  });
  window.alert(`Cilj promenjen. Ocena: ${line(r.after)}`);
  return true;
}

/** Segment HM-06: promena cilja plana polumaratona v2 — isti treninzi, tempo i obim; menja se samo ocena cilja (v2 je računa iz iste
 *  forme; plan po osećaju je nema do rezultata). Pitanje prikazuje ocenu pre i posle; upis je nova revizija. Vraća
 *  `true` kad je plan promenjen. */
export async function changeGoalTimeHmV2(
  genPlan: GenPlanState,
  raw: string,
  todayStr: string
): Promise<boolean> {
  const sec = parseTimeStr(raw.trim());
  if (!sec || !(sec > 0)) {
    window.alert('Unesi ciljno vreme, npr. 1:39:30.');
    return false;
  }
  const day = parseIsoDate(todayStr);
  if (!day) return false;
  const stamp = planStateStamp();
  const r = hmV2GoalChange(genPlan, sec, day);
  if (!r.ok) {
    window.alert(`Cilj nije promenjen:\n${r.reasons.map((x) => x.message).join('\n')}`);
    return false;
  }
  const line = (g: typeof r.before): string =>
    g ? `${g.label} — ${g.message}` : 'bez ocene (plan po osećaju: ocena posle rezultata)';
  const ok = await confirmAction(
    `Promeniti ciljno vreme na ${fmtClock(sec)}?\n\nTreninzi, tempo i obim ostaju isti; menja se samo ocena cilja.\nSada: ${line(r.before)}\nPosle: ${line(r.after)}`
  );
  if (!ok) return false;
  if (stamp !== planStateStamp()) {
    window.alert('Plan ili unosi su se promenili. Ponovo pregledaj promenu cilja.');
    return false;
  }
  useTrainingStore.getState().patch({
    genPlan: recordPlanRevision(genPlan, stampForStorage(r.result), {
      reason: 'goal',
      date: day,
      summary: `Cilj ${fmtClock(sec)}`
    })
  });
  window.alert(`Cilj promenjen. Ocena: ${line(r.after)}`);
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
    `Preračunati preostali plan prema izmerenoj formi?\n\nIzmerena forma: VDOT ${fmtNum(pv.form, 1)} · plan je očekivao: VDOT ${fmtNum(pv.planVdot, 1)} (${delta > 0 ? '+' : ''}${fmtNum(delta, 1)}).\nReferentno vreme prema izmerenoj formi: ${before} → ${fmtClock(r.predictedAfter)}.\n\n${glagolZaBroj(n, 'Menja se ', 'Menjaju se ')}${brojNedelja(n)} ${pl3(n, 'koja tek dolazi', 'koje tek dolaze', 'koje tek dolaze')} (od N${r.week}): tempi i obim sesija prema izmerenoj formi. Cilj, kalendar i raspored dana ostaju isti. Trkački treninzi ne idu brže nego što trenutna forma podržava.\nOdrađeni treninzi, uneti tempi, ručno zaključana polja i izmerena forma ostaju netaknuti.\n\n${describeChanges(pv.result, todayStr)}\n${pv.result.meta.dayWarnings.filter((note) => note.startsWith('Nedovoljno potpunih')).join('\n')}\n\nPrethodni plan možeš pregledati i vratiti u istoriji plana.`
  );
  if (!ok) return false;
  if (!commitRecalibration(pv.result)) {
    window.alert('Plan ili unosi su se promenili. Ponovo pregledaj preračunavanje.');
    return false;
  }
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

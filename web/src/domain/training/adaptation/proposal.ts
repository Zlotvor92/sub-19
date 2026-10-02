/* PREDLOG NOVIH TEMPA — forma naspram plana.

   Princip (zahtev §13): VDOT određuje TEMPO, ne koliko se trči. Obim nosi plan opterećenja i menja ga
   povreda, ne forma. Automatika NIKAD ne ubrzava plan sama: predlog se javlja tek posle bar 3 izmerene
   sesije i razlike od bar 1,5 VDOT poena, i primenjuje se samo klikom korisnika. Ne dira se: odrađen dan,
   dan trke/testa, aktivacija pred trku (njen tempo je tempo TRKE), ručno zaključan tempo.

   Primena ide kroz `alts[id].pace` (isti put kao ručni cilj tempa) uz `paceAuto: true`, pa se sme
   poništiti bez diranja ručnih izmena. U generisanom planu se osvežava i `session.paceSec` da opis
   („7×300 m @ 3:47/km") ne protivreči novom cilju. */

import { sessKind } from '../../plan/describe';
import { setAlt } from '../../plan/edit';
import { resolvePlan, weekOf } from '../../plan/resolve';
import type { ResolvedDay, ResolvedPlan } from '../../plan/types';
import type { AltRecord, GenPlanState, LogEntry, StoredWeek, VdotRecord } from '../../state/types';
import {
  VDOT_PROPOSAL_MIN_MEASUREMENTS,
  VDOT_PROPOSAL_MIN_SEC_PER_KM,
  VDOT_PROPOSAL_THRESHOLD
} from '../constants/heuristics';
import { planVdotForWeek } from '../prediction';
import { sessDesc, sessKm } from '../sessions/calc';
import type { PlanMeta, Session, Zone } from '../types';
import { vdotFromRace } from '../vdot/calculateVDOT';
import { paceForZone } from '../vdot/paceForZone';
import { currentVdot } from './chain';
import { dayZone, matchPlanRows, type StoredPredRow } from './matching';

export interface ProposalContext {
  today: string;
  plan: ResolvedPlan;
  pred: readonly StoredPredRow[];
  meta: Pick<PlanMeta, 'vdot0' | 'vdotGoal' | 'weeks'> | null;
  log: Readonly<Record<string, LogEntry>>;
  alts: Readonly<Record<string, AltRecord>>;
  vdotChain: readonly VdotRecord[];
}

/** Plan-forma za tekuću nedelju (poslednja nedelja plana ako je plan završen), na jednu decimalu. */
export function planVdotNow(
  ctx: Pick<ProposalContext, 'today' | 'plan' | 'meta'> & {
    pred?: readonly Pick<StoredPredRow, 'w' | 'p5k'>[];
  }
): number | null {
  const w = weekOf(ctx.plan, ctx.today) ?? ctx.plan.weeks[ctx.plan.weeks.length - 1];
  if (!w) return null;
  const v = planVdotForWeek(ctx.meta, w.w);
  if (v != null && Number.isFinite(v)) return Math.round(v * 10) / 10;
  /* Plan bez rampe forme (ugrađeni lični plan): `p5k` redova te nedelje. Nedelja bez kvalitetnih redova (npr. deload) uzima poslednju raniju koja ih ima —
     referenca ne sme da nestane samo zato što te nedelje nema šta da se meri. */
  const dist = (ctx.meta as { raceDistM?: unknown } | null)?.raceDistM;
  const raceDistM = typeof dist === 'number' && dist > 0 ? dist : 5000;
  for (let nw = w.w; nw >= 1; nw--) {
    const vs = (ctx.pred ?? [])
      .filter((r) => r && r.w === nw && r.p5k > 0)
      .map((r) => vdotFromRace(raceDistM, r.p5k))
      .filter((x) => Number.isFinite(x));
    if (vs.length) return Math.round((vs.reduce((a, b) => a + b, 0) / vs.length) * 10) / 10;
  }
  return null;
}

/** Ciljni tempo dana: ručna izmena ima prednost nad propisom iz PRED reda. */
export function effectivePace(
  alts: Readonly<Record<string, AltRecord>>,
  d: Pick<ResolvedDay, 'id'>,
  rowPace: number | null | undefined
): number | null {
  const a = alts[d.id];
  return a && a.pace != null ? a.pace : (rowPace ?? null);
}

export interface FormVsPlan {
  form: number;
  planVdot: number;
  delta: number;
  measurements: number;
  /** Koliko preostalih dana uopšte nosi ciljni tempo. */
  daysWithPace: number;
}

export function formVsPlan(ctx: ProposalContext): FormVsPlan | null {
  const form = currentVdot(ctx.vdotChain);
  const measurements = ctx.vdotChain.filter((e) => e && e.measured != null).length;
  if (form == null || !Number.isFinite(form)) return null;
  const planVdot = planVdotNow(ctx);
  if (planVdot == null || !Number.isFinite(planVdot)) return null;
  const matched = matchPlanRows(ctx.plan.weeks, ctx.pred);
  let daysWithPace = 0;
  for (const w of ctx.plan.weeks) {
    for (const d of w.days) {
      if (!d.date || d.date < ctx.today || d.rest) continue;
      if (ctx.log[d.id]?.status === 'done') continue;
      const z = dayZone(matched, d);
      if (!z || !((effectivePace(ctx.alts, d, z.row.pt) ?? 0) > 0)) continue;
      daysWithPace++;
    }
  }
  if (!daysWithPace) return null;
  return {
    form,
    planVdot,
    delta: Math.round((form - planVdot) * 10) / 10,
    measurements,
    daysWithPace
  };
}

export interface ProposalChange {
  id: string;
  date: string;
  kind: string;
  zone: Zone;
  oldPace: number;
  newPace: number;
  w: number;
}

export interface VdotProposal extends FormVsPlan {
  changes: ProposalChange[];
  faster: boolean;
  fasterCount: number;
  slowerCount: number;
  title: string;
  message: string;
}

export function vdotProposal(ctx: ProposalContext): VdotProposal | null {
  const f = formVsPlan(ctx);
  if (!f) return null;
  if (f.measurements < VDOT_PROPOSAL_MIN_MEASUREMENTS) return null; // premalo merenja da se veruje
  if (Math.abs(f.delta) < VDOT_PROPOSAL_THRESHOLD) return null; // plan i forma se slažu

  const matched = matchPlanRows(ctx.plan.weeks, ctx.pred);
  const changes: ProposalChange[] = [];
  for (const w of ctx.plan.weeks) {
    for (const d of w.days) {
      if (!d.date || d.date < ctx.today || d.rest) continue;
      if (ctx.log[d.id]?.status === 'done') continue;
      if (d.tag === 'trka' || d.tag === 'test') continue; // dan trke ostaje kakav jeste
      const z = dayZone(matched, d);
      if (!z || !(z.row.pt > 0)) continue;
      /* AKTIVACIJA PRED TRKU SE NE DIRA, ni u jednom smeru: njen tempo je tempo TRKE, ne forme. */
      if (z.row.nemeri) continue;
      /* Ručno zaključan tempo se ne dira — ni u alts, ni u sesiji. */
      const a = ctx.alts[d.id];
      if (a && a.pace != null && !a.paceAuto) continue;
      if (d.session?.overrides['paceSec']) continue;
      const newPace = paceForZone(f.form, z.zone);
      const oldPace = effectivePace(ctx.alts, d, z.row.pt) ?? 0;
      if (!(oldPace > 0)) continue;
      if (!(newPace > 0) || Math.abs(newPace - oldPace) < VDOT_PROPOSAL_MIN_SEC_PER_KM) continue;
      changes.push({
        id: d.id,
        date: d.date,
        kind: sessKind(d, !!ctx.alts[d.id]),
        zone: z.zone,
        oldPace,
        newPace,
        w: w.w
      });
    }
  }
  if (!changes.length) return null;

  const faster = f.delta > 0;
  /* SMER SE BROJI PO IZMENAMA, NE POGAĐA IZ JEDNOG ZNAKA: tempo se računa po zoni svakog dana, pa se smer
     po danima ume razlikovati. Sažetak i spisak moraju govoriti isto. */
  const fasters = changes.filter((c) => c.newPace < c.oldPace);
  const slowers = changes.filter((c) => c.newPace > c.oldPace);
  const avg = (xs: ProposalChange[]): number =>
    Math.round(xs.reduce((s, c) => s + Math.abs(c.newPace - c.oldPace), 0) / xs.length);
  const sec = Math.round(
    changes.reduce((s, c) => s + Math.abs(c.newPace - c.oldPace), 0) / changes.length
  );
  const description =
    fasters.length && slowers.length
      ? `${changes.length} preostalih kvalitetnih treninga menja ciljni tempo: ` +
        `${fasters.length} ${fasters.length === 1 ? 'brži' : 'brže'} za oko ${avg(fasters)} s/km, ` +
        `${slowers.length} ${slowers.length === 1 ? 'sporiji' : 'sporije'} za oko ${avg(slowers)} s/km ` +
        `(tempo se računa po zoni svakog dana, pa se smer po danima ume razlikovati)`
      : `${changes.length} preostalih kvalitetnih treninga dobija ciljni tempo ${fasters.length ? 'brži' : 'sporiji'} za oko ${sec} s/km`;
  return {
    ...f,
    changes,
    faster,
    fasterCount: fasters.length,
    slowerCount: slowers.length,
    title: faster ? 'Forma je ispred plana' : 'Forma je iza plana',
    message:
      `Tvoj VDOT je ${f.form.toFixed(1)}, a plan za ovu nedelju računa tempo po VDOT-u ${f.planVdot.toFixed(1)} — razlika ` +
      `${f.delta > 0 ? '+' : ''}${f.delta.toFixed(1)} poena, iz ${f.measurements} izmerenih sesija. Predlog: ${description}. ` +
      `Obim se NE menja — VDOT određuje tempo, ne koliko se trči. ` +
      (faster
        ? 'Ako ti nov tempo deluje preteško na terenu, vrati ga — jedna dobra sesija ume da preceni formu.'
        : 'Sporiji tempo nije nazadovanje: bolje je pogoditi zonu nego juriti broj koji telo trenutno ne nosi.')
  };
}

/* ---------------------------------------------------------------- primena i poništavanje */

type DayWithId = StoredWeek['days'][number];

/** Kopija plana u kojoj je sesija dana `id` zamenjena rezultatom `fn`; plan se ne mutira. */
function mapSession(
  genPlan: GenPlanState,
  id: string,
  fn: (d: DayWithId & { session: Session }) => DayWithId | null
): { genPlan: GenPlanState; changed: boolean } {
  let changed = false;
  const weeks = genPlan.weeks.map((wk) => ({
    ...wk,
    days: wk.days.map((d) => {
      if (d.id !== id || !d.session) return d;
      const next = fn(d);
      if (!next) return d;
      changed = true;
      return next;
    })
  }));
  return { genPlan: changed ? { ...genPlan, weeks } : genPlan, changed };
}

/**
 * Prepisuje `paceSec` u izvoru istine za generisan plan i preračunava opis/km iz sesije — ISTO što radi
 * ručna izmena, ali BEZ postavljanja `overrides`: ovo je prilagođavanje formi, ne ručno zaključavanje.
 * Izvorni tempo se pamti JEDNOM (`paceSec0`), da poništavanje ima čemu da se vrati.
 */
export function refreshSessionPace(genPlan: GenPlanState, id: string, paceSec: number) {
  return mapSession(genPlan, id, (d) => {
    if (d.session.overrides['paceSec']) return null;
    const session: Session = {
      ...d.session,
      paceSec0: d.session.paceSec0 ?? d.session.paceSec,
      paceSec
    };
    return { ...d, session, km: sessKm(session), desc: sessDesc(session) };
  });
}

/** Vraća sesiju generisanog plana na tempo iz generatora. */
export function restoreSessionPace(genPlan: GenPlanState, id: string) {
  return mapSession(genPlan, id, (d) => {
    if (d.session.paceSec0 == null) return null;
    const { paceSec0, ...rest } = d.session;
    const session = { ...rest, paceSec: paceSec0 } as Session;
    return { ...d, session, km: sessKm(session), desc: sessDesc(session) };
  });
}

export interface ApplyResult {
  applied: number;
  alts: Record<string, AltRecord>;
  genPlan: GenPlanState | null;
}

/**
 * Primena predloga. Zadržava sve što je na danu već izmenjeno (tip, km, opis) — menja SAMO ciljni tempo.
 * `paceAuto` označava da je vrednost automatska, pa se kasnije sme pregaziti i poništiti.
 */
export function applyVdotProposal(
  proposal: Pick<VdotProposal, 'changes'> | null,
  plan: ResolvedPlan,
  log: Readonly<Record<string, LogEntry>>,
  alts: Readonly<Record<string, AltRecord>>,
  genPlan: GenPlanState | null
): ApplyResult {
  let nextAlts: Record<string, AltRecord> = { ...alts };
  let nextPlan = genPlan;
  let applied = 0;
  for (const ch of proposal?.changes ?? []) {
    const d = plan.byId.get(ch.id);
    if (!d) continue;
    const post = nextAlts[ch.id] ?? null;
    const r = setAlt(plan, log, nextAlts, ch.id, {
      tag: post ? post.tag : d.rest ? 'odmor' : (d.tag as string),
      km: post ? post.km : d.km != null ? d.km : null,
      desc: post ? post.desc : d.desc || '',
      rw: post ? post.rw : null,
      pace: ch.newPace,
      paceAuto: true,
      /* snaga uz trčanje je izbor korisnika; stari kod ga je tiho brisao pri svakoj primeni predloga (A2) */
      ...(post?.snaga ? { snaga: true as const } : {})
    });
    if (!r.ok) continue;
    nextAlts = r.alts;
    applied++;
    if (nextPlan) nextPlan = refreshSessionPace(nextPlan, ch.id, ch.newPace).genPlan;
  }
  return { applied, alts: nextAlts, genPlan: nextPlan };
}

/**
 * Poništava SAMO automatska prilagođavanja tempa; ručne izmene ostaju.
 *
 * ISPRAVKA naspram starog koda: „je li tempo bio JEDINA izmena" se poredi sa originalom dana POSLE
 * vraćanja sesije na tempo iz generatora, ne pre. Stari kod je poredio sa opisom koji već sadrži
 * prilagođeni tempo, pa unos nikad nije nestajao i ostajao je prazna izmena (isti tip, km i opis kao
 * plan, bez tempa) koja dan i dalje označava kao ručno menjan (naziv sesije u prikazu, zabrana
 * automatskog prilagođavanja). docs/ENGINE_CHANGES.md, A1.
 */
export function undoVdotAdjustments(
  plan: ResolvedPlan,
  alts: Readonly<Record<string, AltRecord>>,
  genPlan: GenPlanState | null
): ApplyResult {
  const next: Record<string, AltRecord> = { ...alts };
  let nextPlan = genPlan;
  const undone: string[] = [];
  for (const id of Object.keys(next)) {
    const a = next[id];
    if (!a || !a.paceAuto) continue;
    next[id] = { ...a, pace: null, paceAuto: false };
    if (nextPlan) nextPlan = restoreSessionPace(nextPlan, id).genPlan;
    undone.push(id);
  }
  /* Ako je tempo bila JEDINA izmena tog dana, ceo unos nestaje. Original se čita iz plana posle vraćanja. */
  const origins = nextPlan ? resolvePlan(nextPlan.weeks, { alts: {}, moves: {} }) : plan;
  for (const id of undone) {
    const d = origins.byId.get(id);
    const cur = next[id] as AltRecord;
    if (
      d &&
      cur.tag === (d.origin.rest ? 'odmor' : d.origin.tag) &&
      cur.km === (d.origin.km != null ? d.origin.km : null) &&
      cur.desc === (d.origin.desc || (d.origin.rest ? 'Odmor' : '')) &&
      !cur.rw &&
      !cur.snaga
    ) {
      delete next[id];
    }
  }
  return { applied: undone.length, alts: next, genPlan: nextPlan };
}

/* ZAJEDNIČKA TRENERSKA LOGIKA VAN GENERATORA → U SVAKI GENERATOR (posle segmenta 5/5).

   Pre premeštanja, ovo je bila jedna aplikaciona implementacija za sve distance:
   - predlog izmene plana zbog bola i prekida (`domain/recovery/proposal.ts` + pragovi/opterećenje/bol);
   - automatska zamena dana posle uvoza aktivnosti (`domain/activities/realign.ts`);
   - izvoz treninga na sat i prag tempa (`domain/watch/icuWorkouts.ts`);
   - tempo uz vrućinu i ciljni tempo dana (`domain/weather`);
   - ciljni napor po tipu dana (`plan/describe.rpeTarget`);
   - tempo iz forme (`training/vdot/paceForZone`: lak tempo dana, pregled forme u čarobnjaku, vreme, sat).
   Tokovi ispod pokrivaju sve te funkcije nad planovima sve četiri distance i nad ugrađenim ličnim planom. Referenca se
   uzima SAMO iz postojećeg aplikacionog koda pre premeštanja; posle premeštanja svaki generator mora dati isti zapis.
   „Danas" je uvek argument. */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as fiveK from '@/domain/generators/fiveK';
import * as halfMarathon from '@/domain/generators/halfMarathon';
import * as marathon from '@/domain/generators/marathon';
import * as tenK from '@/domain/generators/tenK';
import { personalPlan } from '@/domain/personal';
import { resolvePlan, type ResolvedPlan } from '@/domain/plan';
import type { GenPlanState, LogEntry, PainRecord } from '@/domain/state';
import { attempt, type FlowResult } from '@/test/fiveK/scenarios';

/** Ugovor koji svaka implementacija mora da ispuni (stara aplikaciona i svaka generatorska). */
export interface GuidanceApi {
  injuryProposal: (ctx: never, today: never) => unknown;
  applyInjuryProposal: (proposal: never, plan: never, log: never, alts: never) => unknown;
  runWalkForPain: (pain: number) => unknown;
  realignPlan: (input: never) => unknown;
  workoutsForWatch: (plan: never, today: string, days: number, vdot: number | null) => unknown;
  thresholdPace: (vdot: number | null | undefined) => unknown;
  dayWorkoutText: (d: never, easy: number | null) => unknown;
  sessionFromDescription: (desc: string | null | undefined) => unknown;
  weatherCard: (input: never) => unknown;
  targetPace: (day: never, predPace: number | null, vdot: number | null) => unknown;
  heatFor: (feelsLike: number | null | undefined) => unknown;
  heatAdvice: (band: never) => unknown;
  heatAdjustedPace: (paceSec: number, pct: number) => unknown;
  rpeTarget: (d: never) => unknown;
  paceForZone: (vdot: number, zone: never) => unknown;
}

const DOCS = fileURLToPath(new URL('../../../../docs/qa/', import.meta.url));

function addIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

type Gen = typeof fiveK;
const GENS: [number, Gen][] = [
  [5000, fiveK],
  [10000, tenK as unknown as Gen],
  [21097.5, halfMarathon as unknown as Gen],
  [42195, marathon as unknown as Gen]
];

/** Bazni planovi: prva tri QA ulaza svake distance (generator te distance) + ugrađeni lični plan. */
export function guidancePlans(): { name: string; plan: GenPlanState }[] {
  const rows = JSON.parse(readFileSync(`${DOCS}generator-ab/inputs.json`, 'utf8')) as Array<
    Record<string, unknown>
  >;
  const out: { name: string; plan: GenPlanState }[] = [];
  for (const [dist, gen] of GENS) {
    const inputs = rows
      .map((r) => r['input'] as Record<string, unknown> | undefined)
      .filter((i): i is Record<string, unknown> => !!i && i['raceDistM'] === dist)
      .slice(0, 3);
    inputs.forEach((input, i) => {
      const g = gen.generatePlan(JSON.parse(JSON.stringify(input)) as never);
      if ('error' in g) return;
      const stored = gen.adaptGeneratedPlan(g);
      if (stored) out.push({ name: `${dist} · qa${i}`, plan: stored });
    });
  }
  out.push({ name: 'lični', plan: personalPlan(48) });
  return out;
}

function todaysFor(plan: ResolvedPlan): string[] {
  const first = plan.dated[0]?.date;
  const last = plan.dated.at(-1)?.date;
  if (!first || !last) return [];
  const span = Math.round((Date.parse(last) - Date.parse(first)) / 86400000);
  return [...new Set([addIso(first, 10), addIso(first, Math.round(span * 0.5)), addIso(last, -6)])];
}

function doneLog(plan: ResolvedPlan, today: string, until = today): Record<string, LogEntry> {
  const log: Record<string, LogEntry> = {};
  for (const d of plan.dated)
    if (d.date < until && !d.rest && (d.km ?? 0) > 0 && d.tag !== 'snaga')
      log[d.id] = { status: 'done', km: d.km, runDate: d.date, rpe: 4 };
  return log;
}

function painSets(today: string): Record<string, PainRecord[]> {
  const p = (days: number, pain: number, part?: string): PainRecord => ({
    date: addIso(today, -days),
    pain,
    id: `p${days}-${pain}-${part ?? 'x'}`,
    ...(part ? { part } : {})
  });
  return {
    bez: [],
    blag: [p(1, 3, 'koleno-L')],
    srednji: [p(0, 5, 'koleno-L'), p(2, 4, 'koleno-L')],
    jak: [p(0, 7, 'stopalo-D')],
    neopterecujuci: [p(0, 6, 'rame-L')],
    fizijatar: [p(0, 4, 'potkolenica-L'), p(2, 3, 'potkolenica-L'), p(4, 5, 'potkolenica-L')],
    povratak: [p(30, 8, 'koleno-D'), p(25, 6, 'koleno-D'), p(18, 3, 'koleno-D')],
    opsti: [p(0, 6)]
  };
}

export function guidanceFlows(api: GuidanceApi): FlowResult[] {
  const out: FlowResult[] = [];
  const record = (name: string, args: unknown[], fn: () => unknown): void => {
    const before = JSON.stringify(args);
    const value = attempt(fn);
    out.push({ name, value, pure: JSON.stringify(args) === before });
  };
  for (const { name, plan: stored } of guidancePlans()) {
    const plan = resolvePlan(stored.weeks, { alts: {}, moves: {} });
    out.push({ name: `${name} · plan`, value: plan.dated.length, pure: true });
    for (const today of todaysFor(plan)) {
      const tag = `${name} · ${today}`;
      // Bol i prekid.
      const logs: Record<string, Record<string, LogEntry>> = {
        redovno: doneLog(plan, today),
        pauza: doneLog(plan, today, addIso(today, -14)),
        ništa: {}
      };
      for (const [lname, log] of Object.entries(logs))
        for (const [pname, pain] of Object.entries(painSets(today)))
          for (const outOfPlan of [{}, { [addIso(plan.dated[0]!.date, -3)]: 12 }]) {
            const ctx = { plan, log, outOfPlan, pain };
            const t = `${tag} · bol ${pname} · ${lname} · van ${Object.keys(outOfPlan).length}`;
            const proposal = attempt(() => api.injuryProposal(ctx as never, today as never));
            out.push({ name: `${t} · predlog`, value: proposal, pure: true });
            if (proposal && typeof proposal === 'object' && !('thrown' in proposal))
              record(`${t} · primena`, [proposal, log], () =>
                api.applyInjuryProposal(proposal as never, plan as never, log as never, {} as never)
              );
          }
      // Zamena dana posle uvoza.
      const log = doneLog(plan, today, addIso(today, -6));
      const open = plan.dated.filter(
        (d) => d.date >= addIso(today, -6) && d.date < today && !d.rest && (d.km ?? 0) > 0
      );
      const runSets: Record<string, Record<string, { distance: number }[]>> = {};
      for (const shift of [-3, -2, -1, 1, 2]) {
        runSets[`pomak ${shift}`] = Object.fromEntries(
          open.map((d) => [addIso(d.date, shift), [{ distance: (d.km ?? 0) * 1000 }]])
        );
        runSets[`pomak ${shift} drugi km`] = Object.fromEntries(
          open.map((d) => [addIso(d.date, shift), [{ distance: (d.km ?? 0) * 1000 * 1.5 }]])
        );
      }
      runSets['na dan'] = Object.fromEntries(
        open.map((d) => [d.date, [{ distance: (d.km ?? 0) * 1000 }]])
      );
      for (const [rname, runsByDate] of Object.entries(runSets)) {
        const input = { weeks: stored.weeks, alts: {}, moves: {}, log, runsByDate };
        record(`${tag} · zamena ${rname}`, [input], () => api.realignPlan(input as never));
      }
      // Izvoz na sat.
      for (const vdot of [null, 38, 52])
        for (const days of [14, 28])
          record(`${tag} · sat ${String(vdot)} ${days}`, [plan], () =>
            api.workoutsForWatch(plan as never, today, days, vdot)
          );
    }
    for (const d of plan.dated) {
      for (const easy of [null, 330])
        record(`${name} · ${d.id} · dan za sat ${String(easy)}`, [d], () =>
          api.dayWorkoutText(d as never, easy)
        );
      record(`${name} · ${d.id} · opis`, [d.desc], () => api.sessionFromDescription(d.desc));
      record(`${name} · ${d.id} · rpe`, [d], () => api.rpeTarget(d as never));
      for (const [vdot, pred] of [
        [null, null],
        [45, null],
        [45, 300],
        [90, null]
      ] as const)
        record(`${name} · ${d.id} · ciljni tempo ${String(vdot)} ${String(pred)}`, [d], () =>
          api.targetPace(d as never, pred, vdot)
        );
    }
    // Vreme: kartica za dane plana sa sintetičkom prognozom.
    const first = plan.dated[0]?.date;
    if (first)
      for (const temp of [12, 24, 29, 34]) {
        const sati: Record<string, unknown> = {};
        for (let day = 0; day < 10; day++)
          for (let h = 5; h <= 22; h++)
            sati[`${addIso(first, day)}T${String(h).padStart(2, '0')}`] = {
              temp: temp - Math.abs(h - 15) * 0.6,
              osecaj: temp + 2 - Math.abs(h - 15) * 0.7,
              vlaga: 40 + h,
              vetar: 8,
              kisa: h % 4 === 0 ? 30 : 0
            };
        for (const d of plan.dated.filter((x) => x.date < addIso(first, 10)))
          for (const [nowHour, hour, vdot, pred] of [
            [7, 18, 45, null],
            [16, 7, null, 290],
            [12, 12, 55, null]
          ] as const) {
            const input = {
              day: d,
              today: first,
              nowHour,
              trainingHour: hour,
              cache: { sati },
              hasLocation: true,
              predPace: pred,
              vdot
            };
            record(`${name} · ${d.id} · vreme ${temp} ${nowHour}/${hour}`, [input], () =>
              api.weatherCard(input as never)
            );
          }
      }
  }
  for (let v = -5; v <= 45; v += 1.5) {
    record(`vrućina ${v}`, [], () => api.heatFor(v));
    record(`savet ${v}`, [], () => api.heatAdvice(api.heatFor(v) as never));
  }
  record('vrućina null', [], () => api.heatFor(null));
  for (const pace of [240, 300, 365, 420])
    for (const pct of [0, 2, 5, 8, 12])
      record(`tempo uz vrućinu ${pace} ${pct}`, [], () => api.heatAdjustedPace(pace, pct));
  for (let p = -1; p <= 11; p++) record(`run/walk bol ${p}`, [], () => api.runWalkForPain(p));
  for (const v of [null, undefined, 0, Number.NaN, 25, 30, 41.3, 55, 70, 85, 95])
    record(`prag ${String(v)}`, [], () => api.thresholdPace(v));
  for (let v = 25; v <= 85; v += 2.5)
    for (const z of ['E', 'LR', 'M', 'T', 'I', 'R'])
      record(`zona ${v} ${z}`, [], () => api.paceForZone(v, z as never));
  for (const tag of ['lako', 'rw', 'lr', 'tempo', 'int', 'test', 'trka', 'snaga', 'odmor', '', 'x'])
    for (const rest of [false, true])
      record(`rpe ${tag} ${String(rest)}`, [], () => api.rpeTarget({ tag, rest } as never));
  record('rpe null', [], () => api.rpeTarget(null as never));
  for (const desc of [
    'Tempo 3 km @ 4:30/km',
    'Intervali 5×1000 m @ 4:05/km, odmor 2 min kaskanje',
    'Lako trčanje 8 km · ~5:40/km',
    'Ponavljanja 8×400 m @ 3:50/km (odmor 90 s hod)',
    '',
    null
  ])
    record(`opis ${String(desc)}`, [], () => api.sessionFromDescription(desc));
  return out;
}

/** Pregled forme u čarobnjaku (tempo po zonama iz unetog rezultata) za svaku ciljnu distancu i nepodržanu. */
export function formPreviewFlows(
  formPreview: (w: never) => unknown,
  initial: () => Record<string, unknown>
): FlowResult[] {
  const out: FlowResult[] = [];
  for (const raceDist of [5000, 10000, 21097.5, 42195, 7000])
    for (const [pbDist, h, m, s] of [
      [5000, '', '19', '45'],
      [5000, '', '31', '10'],
      [10000, '', '44', '00'],
      [21097.5, '1', '38', '20'],
      [42195, '3', '29', '00'],
      [5000, '', '', '']
    ] as const) {
      const w = { ...initial(), raceDist, pbDist, pbH: h, pbMin: m, pbSec: s };
      out.push({
        name: `forma ${raceDist} · ${pbDist} ${h}:${m}:${s}`,
        value: attempt(() => formPreview(w as never)),
        pure: true
      });
    }
  return out;
}

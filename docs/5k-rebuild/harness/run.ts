/* 5K DIJAGNOSTIČKI HARNES (segment 1/10) — samo čita produkcioni kod, ništa ne menja.

   Put je isti kao u aplikaciji: stanje čarobnjaka → `toGenerationInput` → `generatorForDistance` → `generatePlan` →
   `adaptGeneratedPlan` (+ `ulaz`) → prikaz (`resolvePlan`, `weekPhase`, `dayLabel`, `preparationSummary`).
   Adaptacija (samo razvojni skup): `executionModel` → `buildExecutionAdjustment` za pet zapisa dnevnika.

   Metrike računa OVAJ fajl (nezavisno od generatora), osim `sessKm`/`sessDesc`/`paceForZone`, koje se namerno pozivaju
   iz 5K generatora da bi se proverila UNUTRAŠNJA doslednost (opis = sesija, tempo = zona iz VDOT-a plana).

   Izlaz: docs/5k-rebuild/reference/** (v. REPRODUCE.md). Datum je argument (TODAY u profiles.ts); nema slučajnosti. */

import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import {
  initialWizard,
  pbSanityMessage,
  resultDateMessage,
  stepValid,
  syncRunDays,
  toGenerationInput,
  trimQualityDays,
  weeksHint,
  type WizardState
} from '../../../web/src/domain/onboarding/index.ts';
import { generatorForDistance } from '../../../web/src/domain/generators/select.ts';
import * as fiveK from '../../../web/src/domain/generators/fiveK/index.ts';
import { dayLabel, resolvePlan, weekPhase } from '../../../web/src/domain/plan/index.ts';
import { preparationSummary } from '../../../web/src/domain/plan/preparation.ts';
import {
  DEV_PROFILES,
  EDGE_PROFILES,
  OTHER_PROFILES,
  TODAY,
  type Profile
} from './profiles.ts';

const OUT = process.argv[2];
if (!OUT) throw new Error('usage: node run.mjs <outDir>');

type Any = Record<string, any>; // harnes čita wire oblik; tipovi aplikacije nisu cilj ove provere
const r1 = (x: number): number => Math.round(x * 10) / 10;
const r2 = (x: number): number => Math.round(x * 100) / 100;
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;
const sha = (x: unknown): string =>
  createHash('sha256').update(JSON.stringify(x)).digest('hex').slice(0, 16);
const addIso = (iso: string, days: number): string => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
const fmt = (sec: number): string =>
  `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}`;

function write(rel: string, data: unknown): void {
  const p = join(OUT, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(data, null, 1) + '\n');
}

/* ---------------------------------------------------------------- čarobnjak */
function wizardFor(p: Profile, today: string): { w: WizardState; rejects: string[] } {
  let w: WizardState = { ...initialWizard(), ...(p.wizard as Partial<WizardState>) };
  if (p.wizard.runDows?.length) w = syncRunDays(w);
  w = { ...w, qDays: trimQualityDays(w.qDays, w.quality) };
  const rejects: string[] = [];
  for (const step of [1, 2, 3, 4])
    if (!stepValid(w, step, today)) rejects.push(`korak ${step} nije validan`);
  const pbMsg = pbSanityMessage(w) || resultDateMessage(w, today);
  if (pbMsg) rejects.push(pbMsg);
  return { w, rejects };
}

/* ---------------------------------------------------------------- rad sesije (nezavisno) */
function workKm(s: Any): number {
  switch (s.type) {
    case 'int':
      return (s.reps * s.repM) / 1000;
    case 'pyramid':
      return s.reps.reduce((a: number, b: number) => a + b, 0) / 1000;
    case 'fartlek':
      return (s.reps * s.repSec) / s.paceSec;
    case 'tempo':
      return s.qKm;
    case 'prog':
      return s.qKm / 3;
    default:
      return NaN;
  }
}
function longestRepSec(s: Any): number | null {
  if (s.type === 'int') return (s.repM / 1000) * s.paceSec;
  if (s.type === 'pyramid') return (Math.max(...s.reps) / 1000) * s.paceSec;
  if (s.type === 'fartlek') return s.repSec;
  if (s.type === 'tempo') return s.qKm * s.paceSec;
  return null;
}
function sessShort(s: Any): string {
  const z = s.zone ?? '?';
  const pace = fmt(s.paceSec);
  if (s.type === 'int') return `${z} ${s.kind} ${s.reps}×${s.repM}m@${pace} r${s.restSec}s`;
  if (s.type === 'pyramid') return `${z} Piramida ${s.reps.join('-')}@${pace}`;
  if (s.type === 'fartlek') return `${z} Fartlek ${s.reps}×${s.repSec}s@${pace}`;
  if (s.type === 'tempo') return `${z} ${s.kind} ${s.qKm}km@${pace}`;
  return `${z} ${s.kind} ${s.qKm}km`;
}

/* NaN/Infinity/undefined u brojevima bilo gde u planu */
function badNumbers(x: unknown, path = '', out: string[] = []): string[] {
  if (typeof x === 'number' && !Number.isFinite(x)) out.push(path);
  else if (Array.isArray(x)) x.forEach((v, i) => badNumbers(v, `${path}[${i}]`, out));
  else if (x && typeof x === 'object')
    for (const [k, v] of Object.entries(x)) badNumbers(v, `${path}.${k}`, out);
  return out;
}

/* ---------------------------------------------------------------- analiza plana */
function analyze(input: Any, gen: Any, stored: Any) {
  const meta = gen.meta;
  const vdot = meta.vdot0;
  const paces = Object.fromEntries(
    (['E', 'LR', 'T', 'I', 'R'] as const).map((z) => [z, fiveK.paceForZone(vdot, z)])
  );
  const totalWeeks = meta.weeks;
  const resolved = resolvePlan(stored.weeks, { alts: {}, moves: {} });
  const dated = resolved.dated;
  const issues: string[] = [];
  const bad = badNumbers(stored);
  if (bad.length) issues.push(`NaN/Infinity: ${bad.slice(0, 5).join(', ')}`);

  const weeks = gen.weeks.map((wk: Any, i: number) => {
    const sw = stored.weeks[i];
    const days: Any[] = wk.days;
    const sum = r1(days.reduce((n, d) => n + (d.km || 0), 0));
    if (Math.abs(sum - wk.vol) > 0.05) issues.push(`N${wk.w}: vol ${wk.vol} ≠ zbir dana ${sum}`);
    const isRace = wk.w === totalWeeks;
    const sessions = days.filter((d) => d.session);
    const quality = sessions.filter(
      (d) => !(isRace && d.session.purpose === 'activation') && d.session.kind !== 'Aktivacija'
    );
    const zoneKm: Record<string, number> = {};
    const zoneMin: Record<string, number> = {};
    for (const d of quality) {
      const s = d.session;
      const z = s.zone ?? '?';
      zoneKm[z] = r2((zoneKm[z] ?? 0) + workKm(s));
      zoneMin[z] = r1((zoneMin[z] ?? 0) + (workKm(s) * s.paceSec) / 60);
      // doslednost opisa i km
      if (Math.abs(fiveK.sessKm(s) - d.km) > 0.05)
        issues.push(`N${wk.w}d${d.dow}: km dana ${d.km} ≠ sessKm ${fiveK.sessKm(s)}`);
      if (d.desc !== fiveK.sessDesc(s)) issues.push(`N${wk.w}d${d.dow}: opis ≠ sessDesc`);
      // tempo prema zoni plana
      if (s.zone && ['T', 'I', 'R'].includes(s.zone)) {
        const diff = s.paceSec - (paces as Any)[s.zone];
        if (Math.abs(diff) > 1)
          issues.push(`N${wk.w}d${d.dow}: ${s.zone} tempo ${fmt(s.paceSec)} ≠ zona ${fmt((paces as Any)[s.zone])}`);
      }
    }
    for (const d of days) {
      if (d.rest || d.session || d.km == null) continue;
      if (!d.desc) issues.push(`N${wk.w}d${d.dow}: prazan opis`);
      const m = /^([\d.]+) km/.exec(d.desc || '');
      if (m && Math.abs(Number(m[1]) - d.km) > 0.05)
        issues.push(`N${wk.w}d${d.dow}: opis ${m[1]} km ≠ km ${d.km}`);
    }
    const lr = days.filter((d) => d.tag === 'lr' || (d.tag === 'rw' && /najduže/.test(d.desc || '')));
    const lrKm = lr.length ? Math.max(...lr.map((d) => d.km)) : 0;
    const easy = days.filter((d) => d.tag === 'lako' || (d.tag === 'rw' && !/najduže/.test(d.desc || '')));
    const maxEasy = easy.length ? Math.max(...easy.map((d) => d.km || 0)) : 0;
    const runs = days.filter((d) => !d.rest && (d.km || 0) > 0);
    const fullWeek = i > 0 || days.length === 7 || (sw && sw.days.length === 7);
    const pct = (z: string) => (sum > 0 ? r1(((zoneKm[z] ?? 0) / sum) * 100) : 0);
    const longestRep = quality.map((d) => ({ z: d.session.zone, sec: longestRepSec(d.session) }));
    return {
      w: wk.w,
      days: days.length,
      fullWeek,
      vol: wk.vol,
      deload: !!wk.deload,
      taper: !!wk.taper,
      race: isRace,
      focus: wk.focus,
      displayPhase: weekPhase(sw, totalWeeks),
      runs: runs.length,
      quality: quality.length,
      sessions: quality.map((d) => `d${d.dow} ${sessShort(d.session)}`),
      zoneKm,
      zoneMin,
      qualityMin: r1(Object.values(zoneMin).reduce((a, b) => a + b, 0)),
      pctI: pct('I'),
      pctT: pct('T'),
      pctR: pct('R'),
      pctRP: pct('RP'),
      maxRepSec: longestRep,
      lrKm,
      lrShare: sum > 0 ? r2(lrKm / sum) : 0,
      lrMin: r1((lrKm * paces.LR) / 60),
      maxEasy,
      easyOverLr: maxEasy > lrKm + 0.05 && lrKm > 0,
      strides: days.filter((d) => d.strides).length,
      runWalk: days.filter((d) => d.tag === 'rw').length,
      labels: (resolved.weeks[i]?.days ?? []).map((d: Any) =>
        d.rest ? '·' : `${dayLabel(d, false)}${d.km != null ? ` ${d.km}` : ''}`
      )
    };
  });

  /* rast obima: radne nedelje prema poslednjoj ne-deload nedelji */
  const growth: Any[] = [];
  for (let i = 1; i < weeks.length; i++) {
    const w = weeks[i];
    if (w.deload || w.taper || w.race) continue;
    let j = i - 1;
    while (j >= 0 && weeks[j].deload) j--;
    if (j < 0) continue;
    const ref = weeks[j];
    growth.push({
      w: w.w,
      from: ref.w,
      refPartial: !ref.fullWeek,
      ratio: ref.vol > 0 ? r2(w.vol / ref.vol) : null,
      deltaKm: r1(w.vol - ref.vol)
    });
  }
  /* deload/taper */
  const deloads = weeks
    .filter((w: Any) => w.deload)
    .map((w: Any) => ({ w: w.w, ratio: r2(w.vol / (weeks[w.w - 2]?.vol || NaN)), quality: w.quality }));
  const working = weeks.filter((w: Any) => !w.taper && !w.race && w.fullWeek);
  const peakVol = working.length ? Math.max(...working.map((w: Any) => w.vol)) : 0;
  const taper = weeks.find((w: Any) => w.taper);
  const raceW = weeks.find((w: Any) => w.race);

  /* susedni zahtevni dani (kvalitet, LR, trka) po kalendaru, preko granice nedelje */
  const demanding = (d: Any): boolean =>
    !d.rest &&
    ((!!d.session && d.session.kind !== 'Aktivacija') || d.tag === 'lr' || d.tag === 'trka');
  const adj: string[] = [];
  for (let i = 1; i < dated.length; i++) {
    const a = dated[i - 1];
    const b = dated[i];
    if (addIso(a.date, 1) === b.date && demanding(a) && demanding(b))
      adj.push(`${a.date} ${dayLabel(a, false)} → ${dayLabel(b, false)}`);
  }
  /* lak dan posle LR-a: km lakog dana neposredno posle dugog */
  const afterLr: Any[] = [];
  for (let i = 1; i < dated.length; i++) {
    const a = dated[i - 1];
    const b = dated[i];
    if (addIso(a.date, 1) === b.date && a.tag === 'lr' && b.tag === 'lako' && a.km > 0)
      afterLr.push({ date: b.date, lr: a.km, easy: b.km, ratio: r2(b.km / a.km) });
  }

  const firstFull = weeks.find((w: Any) => w.fullWeek && !w.deload);
  const lrSeries = weeks.map((w: Any) => w.lrKm);
  const prep = preparationSummary(stored.meta);

  return {
    summary: {
      weeks: totalWeeks,
      baseWeeks: meta.baseWeeks,
      vdot0: meta.vdot0,
      predictedSec: meta.predictedSec,
      predicted: fmt(meta.predictedSec),
      racePace: fmt(meta.racePace),
      goal: meta.goalSec ? fmt(meta.goalSec) : null,
      realno: meta.realno,
      qualityReadiness: meta.athlete?.qualityReadiness,
      speedConfidence: meta.athlete?.speedConfidence,
      formPolicy: meta.formPolicy?.basis ?? null,
      runDays: meta.runDays,
      effQ: meta.quality,
      paces: Object.fromEntries(Object.entries(paces).map(([k, v]) => [k, fmt(v as number)])),
      inputWeeklyKm: input.weeklyKm,
      firstFullWeek: firstFull ? { w: firstFull.w, vol: firstFull.vol } : null,
      peakVol,
      peakOverInput: input.weeklyKm ? r2(peakVol / input.weeklyKm) : null,
      peakLr: Math.max(0, ...lrSeries),
      taper: taper ? { w: taper.w, vol: taper.vol, ofPeak: peakVol > 0 ? r2(taper.vol / peakVol) : null, quality: taper.quality } : null,
      raceWeek: raceW ? { w: raceW.w, vol: raceW.vol, days: raceW.days } : null,
      preparation: prep ? { label: prep.label, peakLongRunKm: prep.peakLongRunKm, peakWeeklyKm: prep.peakWeeklyKm } : null,
      warnings: meta.dayWarnings.length,
      issues: issues.length,
      deloadCount: deloads.length,
      deloadsWithQuality: deloads.filter((d: Any) => d.quality > 0).length,
      rSessions: weeks.reduce((n: number, w: Any) => n + w.sessions.filter((s: string) => / R /.test(` ${s.split(' ')[1]} `)).length, 0),
      maxIWorkKmWeek: Math.max(0, ...weeks.map((w: Any) => w.zoneKm.I ?? 0)),
      maxQualityMinWeek: Math.max(0, ...weeks.map((w: Any) => w.qualityMin)),
      maxLrShareFullWeek: Math.max(0, ...weeks.filter((w: Any) => w.fullWeek && !w.race).map((w: Any) => w.lrShare)),
      maxGrowthFullRef: Math.max(0, ...growth.filter((g: Any) => !g.refPartial).map((g: Any) => g.ratio ?? 0)),
      adjacentHardDays: adj.length
    },
    weeks,
    growth,
    deloads,
    adjacency: adj,
    afterLongRun: afterLr,
    issues,
    warnings: meta.dayWarnings
  };
}

/* ---------------------------------------------------------------- adaptacija (razvojni skup) */
function adaptation(generator: Any, stored: Any, input: Any) {
  const start = stored.meta.start;
  const raceDate = input.raceDate;
  const today = addIso(TODAY, 35);
  if (today >= addIso(raceDate, -7)) return { skipped: 'plan prekratak za probu adaptacije posle 5 nedelja' };
  const view = resolvePlan(stored.weeks, { alts: {}, moves: {} });
  const runs = view.dated.filter((d: Any) => d.date < today && !d.rest && (d.km ?? 0) > 0 && d.tag !== 'snaga');
  const empty = () => ({ log: {} as Any, alts: {}, moves: {}, pred: {}, predLock: {} });
  const done = empty();
  for (const d of runs) done.log[d.id] = { status: 'done', km: d.km, runDate: d.date, rpe: 4 };
  const miss = clone(done);
  const last = runs.at(-1);
  if (last) delete miss.log[last.id];
  const under = empty();
  for (const d of runs)
    under.log[d.id] = {
      status: 'done',
      km: r1((d.km ?? 0) * (d.date >= addIso(today, -16) && d.date <= addIso(today, -3) ? 0.55 : 1)),
      runDate: d.date,
      rpe: 4
    };
  const high = clone(done);
  for (const d of runs.filter((x: Any) => x.tag === 'lako').slice(-2)) high.log[d.id] = { ...high.log[d.id], rpe: 8 };
  const gap = empty();
  for (const d of runs) if (d.date < addIso(today, -11)) gap.log[d.id] = { status: 'done', km: d.km, runDate: d.date, rpe: 4 };
  const futureVols = (plan: Any) =>
    plan.weeks.filter((w: Any) => addIso(w.start, 6) >= today).map((w: Any) => r1(w.days.reduce((n: number, d: Any) => n + (d.km || 0), 0)));
  const futureQuality = (plan: Any) =>
    plan.weeks.filter((w: Any) => addIso(w.start, 6) >= today).map((w: Any) => w.days.filter((d: Any) => d.session && d.session.kind !== 'Aktivacija').length);
  const out: Any = { today, start, before: futureVols(stored), beforeQuality: futureQuality(stored) };
  for (const [name, ctx] of Object.entries({ done, miss, under, high, gap })) {
    try {
      const model = generator.executionModel(view, today, ctx);
      const rec = model.recommendation ?? model.analysis?.recommendation ?? null;
      const row: Any = {
        recommendation: model.recommendation ?? null,
        reasons: model.analysis?.reasons ?? null
      };
      if (model.analysis) {
        const res = generator.buildExecutionAdjustment(stored, today, model.analysis, {}, ctx);
        if ('error' in res) row.reduce = { error: res.error };
        else row.reduce = { summary: res.summary, after: futureVols(res.result), afterQuality: futureQuality(res.result), notes: res.notes.length, hash: sha(res.result) };
      }
      void rec;
      out[name] = row;
    } catch (e) {
      out[name] = { thrown: e instanceof Error ? e.message : String(e) };
    }
  }
  return out;
}

/* ---------------------------------------------------------------- glavni tok */
function runProfile(p: Profile, set: string) {
  const today = p.today ?? TODAY;
  const { w, rejects } = wizardFor(p, today);
  const hint = weeksHint(w, today);
  const input = toGenerationInput(w, today);
  const record: Any = { id: p.id, set, label: p.label, covers: p.covers, today, wizard: p.wizard, wizardRejects: rejects, weeksHint: hint };
  if (!input) {
    record.result = { notCreated: 'toGenerationInput vratio null (čarobnjak ne pravi ulaz)' };
    return record;
  }
  record.input = input;
  const generator = generatorForDistance(input.raceDistM);
  if (!generator) {
    record.result = { notCreated: 'nema generatora' };
    return record;
  }
  record.generatorId = (generator as Any).id;
  const gen = (generator as Any).generatePlan(clone(input));
  if ('error' in gen) {
    record.result = { error: gen.error };
    return record;
  }
  const again = (generator as Any).generatePlan(clone(input));
  record.deterministic = sha(gen) === sha(again);
  const stored = (generator as Any).adaptGeneratedPlan(gen);
  stored.ulaz = clone(input);
  record.hash = { generated: sha(gen), stored: sha(stored) };
  record.analysis = record.generatorId === '5k' ? analyze(input, gen, stored) : null;
  if (record.generatorId !== '5k')
    record.analysis = {
      summary: {
        weeks: gen.meta.weeks,
        vols: gen.weeks.map((x: Any) => x.vol),
        warnings: gen.meta.dayWarnings.length
      }
    };
  if (set === 'dev') record.adaptation = adaptation(generator, stored, input);
  record.plan = { generated: gen, stored };
  return record;
}

/* Originalni 5K QA ulazi (docs/qa/generator-final/inputs.json): već gotovi ulazi generatora, ne stanje čarobnjaka.
   Idu direktno u izabrani generator; čarobnjak se preskače jer ulaz nije zapisan kao stanje forme. */
function runQa(row: Any) {
  const input = row.input;
  const generator = generatorForDistance(input.raceDistM) as Any;
  const gen = generator.generatePlan(clone(input));
  const record: Any = { id: `QA-${row.id}`, set: 'qa', label: row.label, covers: row.historySource, today: input.startDate, input, generatorId: generator.id };
  if ('error' in gen) return { ...record, result: { error: gen.error } };
  const stored = generator.adaptGeneratedPlan(gen);
  stored.ulaz = clone(input);
  record.deterministic = sha(gen) === sha(generator.generatePlan(clone(input)));
  record.hash = { generated: sha(gen), stored: sha(stored) };
  record.analysis = analyze(input, gen, stored);
  record.plan = { generated: gen, stored };
  return record;
}
const QA_INPUTS = join(dirname(OUT), '..', 'qa', 'generator-final', 'inputs.json');

const index: Any[] = [];
const qaRows: Any[] = (() => {
  try {
    return JSON.parse(readFileSync(process.env['QA_INPUTS'] ?? QA_INPUTS, 'utf8')).filter(
      (r: Any) => r.input?.raceDistM === 5000
    );
  } catch {
    return [];
  }
})();
for (const [set, list] of [
  ['dev', DEV_PROFILES],
  ['edge', EDGE_PROFILES],
  ['other', OTHER_PROFILES],
  ['qa', qaRows]
] as const) {
  for (const p of list as Any[]) {
    const rec = set === 'qa' ? runQa(p) : runProfile(p, set);
    if (set === 'qa') p.id = rec.id;
    write(`${set}/${p.id}.json`, rec);
    index.push({
      id: p.id,
      set,
      label: p.label,
      wizardRejects: rec.wizardRejects,
      error: rec.result?.error ?? rec.result?.notCreated ?? null,
      deterministic: rec.deterministic ?? null,
      hash: rec.hash ?? null,
      summary: rec.analysis?.summary ?? null,
      issues: rec.analysis?.issues ?? [],
      adjacency: rec.analysis?.adjacency?.length ?? null,
      maxGrowth: rec.analysis?.growth?.length
        ? Math.max(...rec.analysis.growth.filter((g: Any) => !g.refPartial).map((g: Any) => g.ratio ?? 0))
        : null,
      maxLrShare: rec.analysis?.weeks?.length
        ? Math.max(...rec.analysis.weeks.filter((w: Any) => !w.race && w.fullWeek).map((w: Any) => w.lrShare))
        : null
    });
  }
}
write('index.json', { today: TODAY, tz: process.env['TZ'] ?? null, node: process.version, profiles: index });

/* Pregledna tabela (isti podaci kao index.json). */
const cols: Array<[string, (x: Any) => unknown]> = [
  ['id', (x) => x.id],
  ['ned', (x) => x.summary?.weeks],
  ['baza', (x) => x.summary?.baseWeeks],
  ['dani', (x) => x.summary?.runDays],
  ['kval', (x) => x.summary?.effQ],
  ['ulaz km', (x) => x.summary?.inputWeeklyKm],
  ['1. puna ned', (x) => x.summary?.firstFullWeek?.vol],
  ['vrhunac', (x) => x.summary?.peakVol],
  ['LR max', (x) => x.summary?.peakLr],
  ['LR udeo max', (x) => x.summary?.maxLrShareFullWeek],
  ['rast max', (x) => x.summary?.maxGrowthFullRef],
  ['deload (sa kval.)', (x) => (x.summary ? `${x.summary.deloadCount} (${x.summary.deloadsWithQuality})` : '')],
  ['R sesija', (x) => x.summary?.rSessions],
  ['I km/ned max', (x) => x.summary?.maxIWorkKmWeek],
  ['kval. min/ned max', (x) => x.summary?.maxQualityMinWeek],
  ['susedni teški', (x) => x.summary?.adjacentHardDays],
  ['taper/vrh', (x) => x.summary?.taper?.ofPeak],
  ['upoz.', (x) => x.summary?.warnings],
  ['tehn. greške', (x) => (x.summary ? x.issues.length : '')],
  ['ishod', (x) => x.error ?? (x.summary ? 'plan' : '')]
];
const md = [
  `# Referentne metrike 5K (generisano: harness/run.ts, TODAY=${TODAY}, TZ=${process.env['TZ'] ?? '—'})`,
  '',
  '| ' + cols.map(([h]) => h).join(' | ') + ' |',
  '|' + cols.map(() => '---').join('|') + '|',
  ...index
    .filter((x) => x.set !== 'other')
    .map((x) => '| ' + cols.map(([, f]) => String(f(x) ?? '').replace(/\|/g, '/')).join(' | ') + ' |'),
  '',
  'Druge distance (samo provera izolacije): ' +
    index
      .filter((x) => x.set === 'other')
      .map((x) => `${x.id} ${x.hash?.generated ?? x.error}`)
      .join(', ')
];
writeFileSync(join(OUT, 'metrics.md'), md.join('\n') + '\n');
console.log(`profila: ${index.length}; greške/neoblikovano: ${index.filter((x) => x.error).length}`);

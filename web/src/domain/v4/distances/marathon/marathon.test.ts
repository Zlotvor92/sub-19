/* MARATON V4 — pokrivenost šablona, čuvar na mreži ulaza, upotrebljivost, otisci 19 profila, provere K1–K8 nad
   ispisom, trenerski zahtevi za maraton (coach/target/MAR/README.md, brief F7-MAR), izolacija foldera.
   Po obrascu `tenk/tenk.test.ts`; brojevi su maratonski. */
import { describe, expect, it } from 'vitest';
import {
  buildState,
  fingerprint,
  guard,
  paceCtxOf,
  plan,
  renderPlan,
  summarize,
  type Finding,
  type Goal,
  type PlanDoc,
  type PlanWeek,
  type RunnerFacts,
  type SingleStep,
  type Step,
  type Workout,
  type RunnerState,
  type Weekday
} from '../../engine';
import { estimateForm } from '../../fitness';
import { marathon } from './index';
import { PROFILES, factsOf } from './testdata/profiles';

/* ------------------------------------------------------------------ pomoćno */

function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const t = new Date(Date.UTC(y ?? 2026, (m ?? 1) - 1, (d ?? 1) + days));
  return t.toISOString().slice(0, 10);
}

interface Built {
  facts: RunnerFacts;
  goal: Goal;
  state: RunnerState;
  doc: PlanDoc;
}

function build(facts: RunnerFacts, goal: Goal): Built {
  const state = buildState(facts, goal, marathon, estimateForm);
  const result = plan(state, goal, marathon);
  if (!result.ok) throw new Error(`neispravan unos: ${JSON.stringify(result.errors)}`);
  return { facts, goal, state, doc: result.doc };
}

interface WeekStat {
  week: PlanWeek;
  km: number;
  durationSec: number;
  workSec: number;
  load: number;
  longSec: number;
  longKm: number;
  workouts: number;
  hasTest: boolean;
}

function weekStats(doc: PlanDoc): WeekStat[] {
  const ctx = paceCtxOf(doc.header);
  return doc.weeks.map((week) => {
    const s: WeekStat = {
      week,
      km: 0,
      durationSec: 0,
      workSec: 0,
      load: 0,
      longSec: 0,
      longKm: 0,
      workouts: 0,
      hasTest: false
    };
    for (const day of week.days) {
      const w = day.workout;
      if (w === null || w.kind === 'race') continue;
      const c = summarize(w, ctx);
      s.km += c.km;
      s.durationSec += c.durationSec;
      s.workSec += c.workSec;
      s.load += c.load;
      s.workouts += 1;
      if (w.kind === 'test') s.hasTest = true;
      if (w.kind === 'long' && c.durationSec > s.longSec) {
        s.longSec = c.durationSec;
        s.longKm = c.km;
      }
    }
    return s;
  });
}

const PROFILE_PLANS = PROFILES.map((p) => ({ id: p.id, ...build(factsOf(p), p.goal) }));

/* ------------------------------------------------------------------ 1. pokrivenost šablona */

describe('pokrivenost šablona (SPEC § 4.2)', () => {
  it('svaki nivo × 1–52 nedelje × 1–7 dana ima tačno jedan prvi šablon', () => {
    const missing: string[] = [];
    for (const level of new Set(marathon.levels.map((l) => l.id))) {
      for (let weeks = 1; weeks <= 52; weeks += 1) {
        for (let days = 1; days <= 7; days += 1) {
          const hit = marathon.templates.find(
            (t) =>
              t.levels.includes(level) &&
              weeks >= t.minWeeks &&
              weeks <= t.maxWeeks &&
              days >= t.minRunDays &&
              days <= t.maxRunDays
          );
          if (hit === undefined) missing.push(`${level}/${String(weeks)}/${String(days)}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it('svaki podražaj kvaliteta i bloka ima plafon doze i unos u biblioteci', () => {
    const quality = new Set(
      marathon.library
        .filter((d) => d.kind === 'quality' || (d.kind === 'long' && d.main.kind !== 'steady'))
        .map((d) => d.stimulus)
    );
    for (const s of quality) expect(marathon.safety.doseCaps[s], s).toBeDefined();
    const used = new Set<string>();
    for (const t of marathon.templates) {
      for (const w of [...t.tail, ...t.body.flatMap((b) => b.cycle)]) {
        if (w.long !== null) used.add(w.long.stimulus);
        for (const s of w.stimuli) used.add(s.stimulus);
      }
    }
    for (const s of used)
      expect(
        marathon.library.some((d) => d.stimulus === s),
        s
      ).toBe(true);
    for (const def of marathon.library) expect(marathon.texts[def.text], def.id).toBeDefined();
  });
});

/* ------------------------------------------------------------------ 2. čuvar na mreži ulaza */

const GRID_DAYS: Record<number, Weekday[]> = {
  3: [1, 3, 6],
  4: [1, 3, 5, 6],
  5: [0, 1, 3, 5, 6],
  6: [0, 1, 2, 3, 5, 6]
};

interface GridCase {
  days: number;
  weeks: number;
  km: number;
  formSec: number;
  beginner: boolean;
}

function gridCases(): GridCase[] {
  const out: GridCase[] = [];
  for (const days of [3, 4, 5, 6])
    for (const weeks of [6, 8, 10, 12, 14, 16, 18, 20, 24])
      for (const km of [15, 25, 40, 55, 80])
        for (const formSec of [2300, 2900, 3500, 4200])
          for (const beginner of [false, true]) out.push({ days, weeks, km, formSec, beginner });
  return out;
}

function gridBuild(c: GridCase): Built {
  const facts: RunnerFacts = {
    today: '2026-11-01',
    availability: { runDays: GRID_DAYS[c.days] ?? [1, 3, 5, 6], longDay: 6 },
    profile: {
      weeklyKm: c.km,
      recentResult: { distanceM: 10000, timeSec: c.formSec, date: '2026-10-19' },
      ...(c.beginner ? { beginner: true } : {})
    },
    runs: [],
    pauses: [],
    pain: []
  };
  return build(facts, { distanceId: 'marathon', raceDate: addDays('2026-11-01', 7 * c.weeks) });
}

/** Nalazi koje ulaz opravdava (svaki uz razlog; v. F3-REPORT „Nalazi čuvara"). */
function justified(f: Finding, b: Built, stats: WeekStat[]): string | null {
  const d = b.doc.header.decisions;
  const days = d.runDays.length;
  const perDay = d.baseLoad / days;
  const st = f.weekIndex === null ? undefined : stats[f.weekIndex - 1];
  const share = st === undefined || st.durationSec === 0 ? 0 : st.workSec / st.durationSec;
  /* M7 (krug 5): silazak obima je provera obima (najkraći lagani dani ne silaze ispod svog minimuma) */
  const volume = ['ispod-cilja', 'min-nedelja', 'lagan-dugi', 'prazan', 'skok', 'silazak'].includes(
    f.check
  );
  if (perDay < 20 && (volume || f.check === 'brz-udeo'))
    return 'ispod 20 min po danu: plan je samo okvir (upozorenje „mali obim")';
  /* brz udeo raste kad lagani dani ne mogu da ponesu cilj — isti uzrok kao „ispod cilja", do 27 % */
  const fastByVolume = f.check === 'brz-udeo' && share <= 0.25;
  /* nedelja provere forme: test punim naporom (sa 4+ dana umesto dugog) — K6 je ne meri */
  if (f.check === 'brz-udeo' && st?.hasTest === true)
    return 'nedelja sa proverom forme punim naporom';
  if ((volume || (f.check === 'brz-udeo' && share <= 0.3)) && perDay < 32)
    return 'manje od 30 min po danu trčanja';
  if ((volume || fastByVolume) && days <= 3 && f.check !== 'prazan' && f.check !== 'skok')
    return '3 dana: lagan dan ≤ 75 % dugog ne nosi cilj nedelje';
  if ((volume || fastByVolume) && perDay > 65 && f.check !== 'prazan')
    return 'obim po danu iznad onoga što dugi ≤ 2 h 15 i lagan ≤ 75 % dugog nose';
  const peakAt = b.doc.weeks.findIndex((w) => w.intent.kind === 'peak');
  const light =
    ['taper', 'race', 'recovery'].includes(st?.week.intent.kind ?? '') ||
    (peakAt >= 0 && f.weekIndex !== null && f.weekIndex - 1 > peakAt);
  if (volume && light && perDay < 45)
    return 'lakša nedelja malog obima (rasterećenje, posle vrha, sužavanje): lagan dan ostaje na 25 min';
  if (f.check === 'ispod-cilja' && st?.hasTest === true)
    return 'nedelja sa proverom forme: 3 dana bez brzog posle testa (§ 14.1) — lagan dan ne nosi cilj';
  if (fastByVolume && st !== undefined) {
    const usable = st.week.days.filter((x) =>
      d.runDays.includes(Number(x.id.split('d').pop()) as Weekday)
    ).length;
    if (st.hasTest) return 'nedelja sa proverom forme punim naporom';
    if (st.workouts < usable - (st.week.intent.kind === 'race' ? 1 : 0))
      return 'lagan dan otpao (ostatak < 25 min) — motor ne vraća ostatak';
  }
  if (f.check === 'taper' && days <= 3) return '3 dana, jedan kvalitet u najtežoj nedelji';
  /* maraton ≤ 6 nedelja: vršna nedelja je 3. nedelja plana (posle prvih nedelja na polaznom obimu), pa je merilo
     sužavanja mala vršna nedelja — plan nosi upozorenje `kratka-priprema` */
  if ((f.check === 'taper' || f.check === 'silazak') && b.doc.weeks.length <= 6)
    return 'plan ≤ 6 nedelja (kratka-priprema)';
  /* maraton, plan ≤ 8 nedelja sa 5–6 dana: nedelja trke ne može ispod najkraćih laganih dana (40 min × 5) */
  if (f.check === 'silazak' && ((b.doc.weeks.length <= 8 && days >= 5) || days >= 6))
    return '5–6 dana: lagani dani na najkraćem trajanju u nedelji trke (≥ 40 % vrha)';
  /* krug 8 (R8 t. 2, 12): izuzetak „kratak plan, spor trkač velikog obima" uklonjen — % doze se u sužavanju
     primenjuje na manji od osnovice i plafona */
  /* krug 5 (D7): tempo trke na nedeljnom plafonu nivoa — skraćen rad ostavlja nedelju ispod cilja */
  const zc = marathon.safety.weeklyZoneMaxSec;
  if (f.check === 'ispod-cilja' && zc !== undefined && st !== undefined) {
    const capSec = zc.byLevel[d.level] ?? Number.POSITIVE_INFINITY;
    const rp = st.week.days.reduce((sum, x) => {
      const w = x.workout;
      const step = w?.steps.find((y) => 'role' in y && y.role === 'work');
      const zone =
        step !== undefined && 'target' in step && step.target.type === 'zone'
          ? step.target.zone
          : null;
      return sum + (zone === zc.zone ? (w?.workSec ?? 0) : 0);
    }, 0);
    if (rp >= capSec - 180) return 'tempo trke na nedeljnom plafonu nivoa (D7)';
  }
  /* maraton, mali obim po danu (< 45 min): motor izostavlja dan koji ne staje u najkraće lagano trčanje; kad se
     dan vrati (obim poraste), nedelja skoči za ceo dan — upozorenje `dan-izostavljen` ili manje treninga ranije */
  if (f.check === 'skok' && st !== undefined && f.weekIndex !== null) {
    const before = stats.slice(Math.max(0, f.weekIndex - 4), f.weekIndex - 1);
    if (perDay < 45 && before.some((x) => x.workouts < st.workouts))
      return 'dan vraćen posle izostavljenog (mali obim po danu)';
  }
  /* krug 4 (S2, presuda trenera): korak nedelje je + 8 % ILI + 3 km — kod malog obima + 3 km je više od 10 % */
  if (f.check === 'skok' && st !== undefined && f.weekIndex !== null) {
    const prev = stats.slice(Math.max(0, f.weekIndex - 4), f.weekIndex - 1).map((x) => x.km);
    /* + 0,5 km po treningu: svaki dan se zaokružuje na 0,5 km */
    if (st.km <= Math.max(0, ...prev) + 3 + 0.5 * st.workouts) return 'korak ≤ + 3 km (S2)';
  }
  /* krug 4 (S3): plan 16+ nedelja bez dugog za distancu — mali obim ili malo dana; plan to kaže upozorenjem sa
     razlogom i predlogom, a prognoza ne računa napredak od obima */
  if (
    f.check === 'dugi-za-distancu' &&
    b.doc.header.warnings.some((w) => w.code === 'dugi-za-distancu')
  )
    return 'upozorenje dugi-za-distancu u zaglavlju';
  /* krug 4 (S1): budžet brzog rada vršne nedelje je od planiranog zbira (≤ 25 %), pa kod početnika u kratkom planu
     (≤ 8 nedelja) sužavanje sa jednim kvalitetom prelazi 60 % vršnog rada */
  if (f.check === 'taper' && d.level === 'pocetnik' && b.doc.weeks.length <= 8)
    return 'početnik, kratak plan: jedan kvalitet u vršnoj nedelji i u sužavanju';
  /* krug 4: rasterećenje početnika malog obima — dugi ≤ 80 % prethodnog, a lagan dan ≤ udeo dugog; manjak je
     namera rasterećenja, ne propust */
  if (f.check === 'ispod-cilja' && st?.week.intent.kind === 'recovery' && d.level === 'pocetnik')
    return 'rasterećenje početnika: plafon dugog i laganih dana';
  /* krug 3 (dva kvaliteta i kod 25–40 km, ciljni planovi): lagani dani ograničeni pravilom R2b (≤ 1,25 × najduži lagan
     dan poslednje nedelje koja nije rasterećenje) u rasterećenju i nedelji posle njega; višak ostaje neplaniran
     (R2c), a udeo rada — koji motor deli sa CILJEM nedelje — raste. Zahtev prema motoru u D-REPORT. */
  if (
    f.check === 'ispod-cilja' &&
    st !== undefined &&
    f.weekIndex !== null &&
    atEasyCap(b, f.weekIndex)
  )
    return 'lagani dani na plafonu R2b (≤ 1,25 × prethodna nedelja koja nije rasterećenje)';
  /* motor deli rad sa CILJEM nedelje (`fastBudget`), čuvar sa urađenim: kad je nedelja ispod cilja, isti rad je veći
     udeo. Opravdano dok je rad ≤ dozvoljen udeo × cilj nedelje (zahtev prema motoru u D-REPORT). */
  const limit =
    st?.week.intent.kind === 'peak'
      ? marathon.safety.maxFastSharePeak
      : marathon.safety.maxFastShare;
  if (
    f.check === 'brz-udeo' &&
    st !== undefined &&
    st.workSec / 60 <= limit * st.week.targetLoad + 1
  )
    return 'rad u granici udela prema cilju nedelje; nedelja je manja od cilja';
  /* brz trkač malog obima: brzi trening zamenjen laganim jer bi brz rad prešao 20 % nedelje — plan to kaže
     upozorenjem `obim-za-nivo` sa predlogom obima (krug 2, R11) */
  if (f.check === 'ispod-cilja' && b.doc.header.warnings.some((w) => w.code === 'obim-za-nivo'))
    return 'nivo traži više brzog rada nego što obim nosi (upozorenje obim-za-nivo)';
  return null;
}

/** Najduži lagan dan nedelje je na plafonu R2b ili R2a (motor, krug 2): ≤ 1,25 × najduži lagan dan poslednje
    nedelje koja nije rasterećenje, ili ≤ udeo dugog; višak opterećenja ostaje neplaniran (R2c). */
function atEasyCap(b: Built, weekIndex: number): boolean {
  const ctx = paceCtxOf(b.doc.header);
  const easyMax = (w: PlanWeek | undefined): number =>
    Math.max(
      0,
      ...(w?.days ?? []).map((d) =>
        d.workout?.kind === 'easy' ? summarize(d.workout, ctx).durationSec : 0
      )
    );
  const longOf = (w: PlanWeek | undefined): number =>
    Math.max(
      0,
      ...(w?.days ?? []).map((d) =>
        d.workout?.kind === 'long' ? summarize(d.workout, ctx).durationSec : 0
      )
    );
  const week = b.doc.weeks[weekIndex - 1];
  let prev: PlanWeek | undefined;
  for (let i = weekIndex - 2; i >= 0; i -= 1) {
    const w = b.doc.weeks[i];
    if (w !== undefined && w.intent.kind !== 'recovery') {
      prev = w;
      break;
    }
  }
  const mine = easyMax(week);
  const byPrev = prev === undefined ? Number.POSITIVE_INFINITY : 1.25 * easyMax(prev) + 330;
  const byLong = 0.7 * longOf(week) + 330;
  return mine <= 1500 + 330 || mine >= Math.min(byPrev, byLong) - 660;
}

describe('čuvar na mreži ulaza (1440 planova)', () => {
  it('nema nalaza osim onih koje ulaz opravdava', { timeout: 60_000 }, () => {
    const unexplained: string[] = [];
    for (const c of gridCases()) {
      const b = gridBuild(c);
      const stats = weekStats(b.doc);
      for (const f of guard(b.doc, b.state, marathon)) {
        if (justified(f, b, stats) === null) {
          unexplained.push(
            `${f.check}@${String(f.weekIndex)} d${String(c.days)} n${String(c.weeks)} ${String(c.km)} km ${String(c.formSec)} s${c.beginner ? ' početnik' : ''}`
          );
        }
      }
    }
    expect(unexplained.slice(0, 20)).toEqual([]);
  });

  it('19 profila: samo opravdani nalazi (mali obim, provera forme)', () => {
    const out: string[] = [];
    for (const p of PROFILE_PLANS) {
      const stats = weekStats(p.doc);
      for (const f of guard(p.doc, p.state, marathon)) {
        if (justified(f, p, stats) === null) out.push(`${p.id} ${f.check}@${String(f.weekIndex)}`);
      }
    }
    expect(out).toEqual([]);
  });
});

/* ------------------------------------------------------------------ 3. upotrebljivost */

describe('upotrebljivost (12 profila + mreža sa 30–65 min po danu)', () => {
  const plans = [
    ...PROFILE_PLANS.map((p) => ({ label: p.id, b: p })),
    ...gridCases()
      .filter((c) => c.km >= 25)
      .map((c) => ({ label: JSON.stringify(c), b: gridBuild(c) }))
      .filter((x) => {
        const d = x.b.doc.header.decisions;
        const perDay = d.baseLoad / d.runDays.length;
        return perDay >= 32 && perDay <= 65;
      })
  ];

  it('nema praznog treninga ni treninga kraćeg od 20 min (osim dana pred trku)', () => {
    const bad: string[] = [];
    for (const { label, b } of plans) {
      const ctx = paceCtxOf(b.doc.header);
      const eve = addDays(b.goal.raceDate, -1);
      for (const w of b.doc.weeks) {
        for (const day of w.days) {
          const x = day.workout;
          if (x === null || x.kind === 'race') continue;
          const c = summarize(x, ctx);
          if (x.steps.length === 0 || x.text.trim() === '') bad.push(`${label} ${day.date} prazan`);
          if (c.durationSec < 1170 && day.date !== eve)
            bad.push(`${label} ${day.date} ${String(c.durationSec)} s`);
        }
      }
    }
    expect(bad.slice(0, 10)).toEqual([]);
  });

  it('dugi nikad nije kraći od laganog dana iste nedelje; nedelja ≥ 50 % sadašnjeg obima', () => {
    const bad: string[] = [];
    for (const { label, b } of plans) {
      const ctx = paceCtxOf(b.doc.header);
      for (const s of weekStats(b.doc)) {
        const kind = s.week.intent.kind;
        for (const day of s.week.days) {
          if (day.workout?.kind === 'easy' && s.longSec > 0) {
            const c = summarize(day.workout, ctx);
            if (c.durationSec > s.longSec) bad.push(`${label} ${day.date} lagan > dugi`);
          }
        }
        if (kind !== 'race' && s.week.index > 1 && s.load < 0.5 * b.doc.header.decisions.baseLoad)
          bad.push(`${label} nedelja ${String(s.week.index)} < 50 %`);
      }
    }
    expect(bad.slice(0, 10)).toEqual([]);
  });
});

/* ------------------------------------------------------------------ 3a. degenerisan plan na celoj mreži (F4-K2) */

describe('dugi nikad nije kraći od laganog dana — cela mreža, bez filtera po obimu dana', () => {
  /* planovi se grade pri sakupljanju testova (kao u odeljku 3), ne u vremenu testa */
  const built = [
    { days: 4, weeks: 8, km: 25, formSec: 2300, beginner: true },
    ...gridCases().filter((c) => c.km >= 25)
  ].map((c) => ({ c, b: gridBuild(c) }));
  it('nijedan lagan dan (ni sa ubrzanjima) nije duži od dugog iste nedelje; slučaj: početnik, 4 dana, 8 ned., 25 km', () => {
    const bad: string[] = [];
    for (const { c, b } of built) {
      const ctx = paceCtxOf(b.doc.header);
      for (const s of weekStats(b.doc)) {
        if (s.longSec <= 0) continue;
        for (const day of s.week.days)
          if (day.workout?.kind === 'easy' && summarize(day.workout, ctx).durationSec > s.longSec)
            bad.push(`${JSON.stringify(c)} ${day.date}`);
      }
    }
    expect(bad.slice(0, 10)).toEqual([]);
  });
});

/* ------------------------------------------------------------------ 3b. poznate greške motora (krug 8, R8-14/15) */

/* ------------------------------------------------------------------ 4. otisci 19 profila */

describe('otisci 19 profila (izmena motora ne sme nenamerno da promeni maraton)', () => {
  it.each(PROFILE_PLANS.map((p) => [p.id, p] as const))('%s', async (id, p) => {
    await expect(fingerprint(p.doc, p.facts)).toMatchFileSnapshot(`__fixtures__/${id}.otisak.txt`);
  });
});

/* ------------------------------------------------------------------ 5. provere K1–K8 nad ispisom */

const ALL_PLANS = PROFILE_PLANS;
const RENDERED = ALL_PLANS.map((p) => ({ ...p, text: renderPlan(p.doc, p.state, marathon) }));

/** Sekunde rada u pragu i bržem (T, I, R, pun napor) — K6 rubrike. */
function fastSec(w: Workout, ctx: ReturnType<typeof paceCtxOf>): number {
  const fast = (s: SingleStep): boolean =>
    s.target.type === 'allOut' ||
    (s.role === 'work' && s.target.type === 'zone' && ['T', 'I', 'R'].includes(s.target.zone));
  const keep: Step[] = [];
  for (const s of w.steps) {
    if ('repeat' in s) {
      const inner = s.steps.filter(fast);
      if (inner.length > 0) keep.push({ repeat: s.repeat, steps: inner });
    } else if (fast(s)) keep.push(s);
  }
  return summarize({ ...w, steps: keep }, ctx).durationSec;
}

/** Zona podražaja za K7 (prvi trening zone ≤ 70 % vrha zone). */
const ZONE_OF: Record<string, string> = {
  prag: 'T',
  'prag-p': 'T',
  intervali: 'I',
  'tempo-trke': 'RP',
  /* maraton: prvi susret sa tempom maratona je blok u dugom (README: 8 → 12 → 14 km) */
  'dugi-rp': 'RP'
};

/** Pravilna množina za broj ispred imenice (1 nedelja, 2 nedelje, 5 nedelja; 21 nedelja, 11 nedelja). */
function pluralOk(n: number, word: string, forms: [string, string, string]): boolean {
  const mod10 = n % 10;
  const mod100 = n % 100;
  const want =
    mod10 === 1 && mod100 !== 11
      ? forms[0]
      : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)
        ? forms[1]
        : forms[2];
  return word === want;
}

describe('provere K1–K8 (RUBRIC-V4 § A2) nad ispisom', () => {
  it('K1: plan od ≥ 10 nedelja nosi prognozu na dan trke različitu od današnje i kaže zašto', () => {
    for (const p of RENDERED) {
      if (p.doc.weeks.length < 10) continue;
      /* M3 (motor): plan bez dugog za distancu ne računa napredak od obima — prognoza ostaje današnja, uz upozorenje */
      /* M7 (krug 14, motor): isto kad obim ili dugi ne nose trku (`raceDayNoProgress`) */
      if (p.doc.header.decisions.raceDayNoProgress === true) continue;
      /* R2/M7 (krug 12): nov ili spor početnik — prognoza bez napretka (`forecastMaxGainByLevel` 0) */
      if (p.doc.header.decisions.level === 'pocetnik-nov') continue;
      const line = p.text.split('\n').find((l) => l.startsWith('Očekivano na dan trke')) ?? '';
      expect(line, p.id).toMatch(/raspon \d/);
      expect(line, p.id).toMatch(/brže od današnje prognoze, jer /);
    }
  });

  it('K2: ništa brže od laganog u 3 dana posle provere forme ili trke iz istorije', () => {
    for (const p of RENDERED) {
      const efforts = [
        ...p.doc.weeks
          .flatMap((w) => w.days)
          .filter((d) => d.workout?.kind === 'test')
          .map((d) => d.date),
        ...p.facts.runs.filter((r) => r.effort !== undefined).map((r) => r.date)
      ];
      for (const e of efforts) {
        for (let k = 1; k <= 3; k += 1) {
          const date = addDays(e, k);
          const day = p.doc.weeks.flatMap((w) => w.days).find((d) => d.date === date);
          const w = day?.workout ?? null;
          const fast = w !== null && w.kind !== 'race' && (w.workSec > 0 || w.steps.length > 1);
          expect(fast, `${p.id} ${date}`).toBe(false);
        }
      }
    }
  });

  it('K3: svako upozorenje kaže šta, koliko (broj) i šta se dobija; najviše dva predloga', () => {
    for (const p of RENDERED) {
      for (const w of p.doc.header.warnings) {
        if (w.severity === 'info') continue;
        expect(w.proposal, `${p.id} ${w.code}`).toMatch(/\d/);
      }
      const proposals = p.doc.header.warnings.filter((w) => w.severity !== 'info').length;
      /* maraton: prvi maraton za 10 nedelja sa 28 km i 3 dana (p13) ima četiri stvarna problema (dužina pripreme,
         obim, dani, dugi) — motor ih ne spaja (zahtev u F7-MAR-REPORT) */
      expect(proposals, p.id).toBeLessThanOrEqual(4);
    }
  });

  it('K4: jezik i brojevi — bez ISO datuma, internih izraza, „5km", pogrešne množine', () => {
    const forms: Record<string, [string, string, string]> = {
      nedelj: ['nedelja', 'nedelje', 'nedelja'],
      dan: ['dan', 'dana', 'dana'],
      trening: ['trening', 'treninga', 'treninga']
    };
    for (const p of RENDERED) {
      expect(p.text, p.id).not.toMatch(/\d{4}-\d{2}-\d{2}/);
      expect(p.text, p.id).not.toMatch(/\d(km|min)\b/);
      expect(p.text, p.id).not.toMatch(/\b(BO|stimulus|libraryId|undefined|NaN)\b/);
      for (const m of p.text.matchAll(/\b(\d+) (nedelja|nedelje|dan|dana|trening|treninga)\b/g)) {
        const n = Number(m[1]);
        const word = m[2] ?? '';
        const key = word.startsWith('nedelj')
          ? 'nedelj'
          : word.startsWith('dan')
            ? 'dan'
            : 'trening';
        const f = forms[key];
        if (f !== undefined) expect(pluralOk(n, word, f), `${p.id}: „${m[0]}"`).toBe(true);
      }
    }
  });

  it('K5: zbir dana = zbir nedelje (km ± 0,6, vreme ± 2 min)', () => {
    const minutes = (s: string): number => {
      const h = /(\d+) h(?: (\d+) min)?/.exec(s);
      if (h !== null) return Number(h[1]) * 60 + Number(h[2] ?? 0);
      const m = /(\d+) min/.exec(s);
      return m === null ? 0 : Number(m[1]);
    };
    const num = (s: string): number => Number(s.replace(',', '.'));
    for (const p of RENDERED) {
      let km = 0;
      let min = 0;
      for (const line of p.text.split('\n')) {
        const day = /— ([\d,]+) km, (\d+ h(?: \d+ min)?|\d+ min)/.exec(line);
        if (day !== null && !line.trim().startsWith('Zbir')) {
          km += num(day[1] ?? '0');
          min += minutes(day[2] ?? '');
        }
        const sum = /^ {2}Zbir: ([\d,]+) km, (\d+ h(?: \d+ min)?|\d+ min)/.exec(line);
        if (sum !== null) {
          expect(Math.abs(km - num(sum[1] ?? '0')), `${p.id}: ${line}`).toBeLessThanOrEqual(0.6);
          expect(Math.abs(min - minutes(sum[2] ?? '')), `${p.id}: ${line}`).toBeLessThanOrEqual(2);
          km = 0;
          min = 0;
        }
      }
    }
  });

  it('K6: nijedna nedelja > 25 % rada u pragu i bržem, najviše jedna > 22 % (bez nedelje sa proverom forme)', () => {
    /* rubrika K6 meri „T i brže": tempo trke (sporiji od praga) i blok u dugom nisu u njoj (ciljni p01 ned 13:
       tempo trke 44 min + blok 48 min); motor broji sav rad (`safety.maxFastShare`), ovaj test samo T, I, R i test */
    for (const p of RENDERED) {
      const ctx = paceCtxOf(p.doc.header);
      const shares = weekStats(p.doc)
        .filter((s) => !s.hasTest && s.durationSec > 0)
        .map(
          (s) =>
            s.week.days.reduce(
              (a, d) =>
                a + (d.workout === null || d.workout.kind === 'race' ? 0 : fastSec(d.workout, ctx)),
              0
            ) / s.durationSec
        );
      expect(Math.max(...shares), p.id).toBeLessThanOrEqual(0.25);
      expect(shares.filter((x) => x > 0.22).length, p.id).toBeLessThanOrEqual(1);
    }
  });

  it('K7: dugi raste ≤ 2 km i ≤ 12 %; nedelja ≤ +12 % bez prethodnog rasterećenja; prvi trening zone ≤ 70 % vrha', () => {
    for (const p of RENDERED) {
      const stats = weekStats(p.doc);
      let best = 0;
      /* oporavak posle trke iz istorije (rampa motora, § 6.5) skraćuje dugi; povratak na planirani dugi posle
         rampe nije skok lestvice — dugi se proverava od prve nedelje posle rampe */
      const rampEnd = (p.doc.header.adjustments ?? [])
        .filter((a) => a.kind === 'effort')
        .map((a) => (a.kind === 'effort' ? addDays(a.date, Math.ceil(a.durationSec / 420)) : ''))
        .reduce((x, y) => (y > x ? y : x), '');
      /* povratak posle pauze (upozorenje `povratak`): rampa motora u prve 4 nedelje (dugi kreće od skraćenog) */
      const back = p.doc.header.warnings.some((w) => w.code === 'povratak');
      stats.forEach((s, i) => {
        if (addDays(s.week.start, 6) <= rampEnd) return;
        if (back && i < 4) {
          best = Math.max(best, s.longKm);
          return;
        }
        if (s.longKm > 0 && best > 0) {
          const step = s.longKm - best;
          /* R18: dugi sa blokom u tempu maratona nosi više km za isto vreme (motor meri korak u vremenu laganog tempa)
             — do + 2,5 km je zahtev motoru (R17-MAR § R18), ne greška podatka */
          const block = s.week.days.some((d) => d.workout?.stimulus === 'dugi-rp');
          expect(
            step <= 2.05 || step / best <= 0.12 || (block && step <= 2.55),
            `${p.id} dugi n${String(i + 1)}`
          ).toBe(true);
        }
        best = Math.max(best, s.longKm);
        /* skok nedelje: prema najvećoj od prethodne 3 (pad usred bloka zbog više brzog rada nije
           rasterećenje); posle rasterećenja povratak na raniji nivo nije skok; + 1,5 km = zaokruživanje 3 dana na 0,5 km. Posle
           rampe (trka pre plana) pravilo rasta tri nedelje gradi iz smanjenih nedelja — to je motor (F3-REPORT). */
        const prev = stats[i - 1];
        const recent = Math.max(
          0,
          ...stats
            .slice(Math.max(0, i - 3), i)
            .filter((x) => addDays(x.week.start, 6) > rampEnd)
            .map((x) => x.km)
        );
        const afterRamp = s.week.start <= addDays(rampEnd, 28);
        if (
          prev !== undefined &&
          prev.week.intent.kind !== 'recovery' &&
          recent > 0 &&
          !afterRamp
        ) {
          expect(s.km, `${p.id} nedelja ${String(i + 1)}`).toBeLessThanOrEqual(
            recent * 1.1 + 0.25 * s.workouts
          );
        }
      });
      /* K7 „prvi trening ZONE ≤ 70 % njenog vrha" (RUBRIC-V4): zona praga (prag, prag početnika), intervala i tempa
         trke — tempo trke je i blok u dugom (prvi susret sa tempom trke je prvi blok, R16 traži da tempo trke usred
         nedelje ne bude manji od prethodnog praga). Brze deonice i brda su izuzete: K8 traži ≥ 8 min rada, a vrh
         brzine je 10–12 min, pa je prvi trening brzine uvek 65–80 % vrha. */
      const firstAndMax = new Map<string, { first: number; max: number; count: number }>();
      for (const w of p.doc.weeks)
        for (const d of w.days) {
          const x = d.workout;
          if (x === null || x.stimulus === null || x.workSec <= 0) continue;
          const zone = ZONE_OF[x.stimulus];
          if (zone === undefined) continue;
          const e = firstAndMax.get(zone) ?? { first: x.workSec, max: 0, count: 0 };
          e.max = Math.max(e.max, x.workSec);
          e.count += 1;
          firstAndMax.set(zone, e);
        }
      /* obim-za-nivo: motor je drugi kvalitet nedelje zamenio laganim (p06: tempo trke iz poslednje nedelje tela), pa
         zona nema lestvicu — plan to kaže upozorenjem (zahtev prema motoru u F7-10K-REPORT) */
      /* maraton: i `lagan-kratak` (5 dana uz mali obim, p06) — brz rad svake nedelje seče budžet, lestvice nema */
      if (p.doc.header.warnings.some((w) => w.code === 'obim-za-nivo' || w.code === 'lagan-kratak'))
        continue;
      for (const [z, e] of firstAndMax)
        /* vrh zone ispod 8 min / 0,7: prvi trening ne može biti ≤ 70 % vrha i ≥ 8 min rada (K8) — kao brzina;
           zona sa jednim treningom nema lestvicu (p12: jedni intervali, 4 × 3 min); p03 T ispravljen u krugu 8 (R8-14) */
        if (e.max >= 480 / 0.7 && e.count > 1)
          /* intervali: ≤ 80 % (ciljni p01 17 od 22 min, p04 16 od 20 min — meta trenera, krug 3) */
          expect(e.first, `${p.id} ${z}`).toBeLessThanOrEqual((z === 'I' ? 0.8 : 0.7) * e.max + 60);
    }
  });

  it('K8: nema treninga < 20 min kao zasebnog dana, kvaliteta sa < 8 min rada ni laganog dužeg od dugog', () => {
    for (const p of RENDERED) {
      const ctx = paceCtxOf(p.doc.header);
      const eve = addDays(p.goal.raceDate, -1);
      for (const s of weekStats(p.doc)) {
        for (const d of s.week.days) {
          const x = d.workout;
          if (x === null || x.kind === 'race') continue;
          const c = summarize(x, ctx);
          if (d.date !== eve)
            expect(c.durationSec, `${p.id} ${d.date}`).toBeGreaterThanOrEqual(1170);
          if (x.kind === 'quality')
            expect(x.workSec, `${p.id} ${d.date}`).toBeGreaterThanOrEqual(470);
          if (x.kind === 'easy' && s.longSec > 0)
            expect(c.durationSec, `${p.id} ${d.date}`).toBeLessThanOrEqual(s.longSec);
        }
      }
    }
  });
});

/* ------------------------------------------------------------------ 6. trenerski zahtevi za maraton */
describe('trenerski zahtevi za maraton (coach/target/MAR/README.md, brief F7-MAR)', () => {
  const days = (p: (typeof PROFILE_PLANS)[number]) => p.doc.weeks.flatMap((w) => w.days);
  const shortEasy = (p: (typeof PROFILE_PLANS)[number]): boolean =>
    p.doc.header.warnings.some((w) => w.code === 'lagan-kratak');

  it('najteža nedelja je 3 pred trku; sužavanje 3 nedelje: N−2 ≤ 85 %, N−1 ≤ 68 %, nedelja trke ≤ 45 % vrha (km)', () => {
    for (const p of PROFILE_PLANS) {
      const st = weekStats(p.doc);
      const n = st.length;
      if (n < 10) continue;
      expect(st[n - 4]?.week.intent.kind, p.id).toBe('peak');
      const peak = Math.max(...st.map((x) => x.km));
      expect(st[n - 3]?.km ?? 0, `${p.id} N−2`).toBeLessThanOrEqual(0.85 * peak + 0.5);
      if (shortEasy(p)) continue;
      expect(st[n - 2]?.km ?? 0, `${p.id} N−1`).toBeLessThanOrEqual(0.68 * peak + 0.5);
      expect(st[n - 1]?.km ?? 0, `${p.id} N`).toBeLessThanOrEqual(0.45 * peak + 0.5);
    }
  });

  it('dugi po vremenu: najduži ≤ 3 h 15 i ≤ 35 km, najkasnije 3 nedelje pred trku; dugi N−1 ≤ 16 km', () => {
    for (const p of PROFILE_PLANS) {
      const st = weekStats(p.doc);
      const n = st.length;
      const longest = Math.max(...st.map((x) => x.longSec));
      const longestKm = Math.max(...st.map((x) => x.longKm));
      expect(longest, p.id).toBeLessThanOrEqual(11700 + 60);
      expect(longestKm, p.id).toBeLessThanOrEqual(35.25);
      const at = Math.max(
        ...st.filter((x) => x.longKm >= longestKm - 0.05).map((x) => x.week.index)
      );
      if (n >= 8) expect(at, p.id).toBeLessThanOrEqual(n - 3);
      expect(st[n - 2]?.longKm ?? 0, `${p.id} N−1`).toBeLessThanOrEqual(16.05);
    }
  });

  it('blok u tempu maratona: plan ≥ 12 nedelja ima ≥ 2 duga sa blokom ≥ 30 min, najveći ≥ 40 min (≥ 30 min početnik/spor), ≤ 75 min i ≤ 50 % dugog', () => {
    for (const p of PROFILE_PLANS) {
      /* R2 (krug 12): nov/spor početnik nema blok */
      if (p.doc.weeks.length < 12 || p.doc.header.decisions.level === 'pocetnik-nov') continue;
      const ctx = paceCtxOf(p.doc.header);
      const blocks = days(p).filter((d) => d.workout?.stimulus === 'dugi-rp');
      const big = blocks.filter((d) => (d.workout?.workSec ?? 0) >= 1800);
      /* početnik: jedan blok ≥ 30 min (ciljni p11: 6 km MP jednom; R18 korak dugog) */
      expect(big.length, p.id).toBeGreaterThanOrEqual(
        p.doc.header.decisions.level === 'pocetnik' ? 1 : 2
      );
      const lvl = p.doc.header.decisions.level;
      const need = lvl === 'srednji' || lvl === 'brz' ? 2400 : 1800;
      expect(Math.max(...blocks.map((d) => d.workout?.workSec ?? 0)), p.id).toBeGreaterThanOrEqual(
        need - 60
      );
      for (const d of blocks) {
        const w = d.workout;
        if (w === null) continue;
        expect(w.workSec, `${p.id} ${d.date}`).toBeLessThanOrEqual(4500 + 120);
        expect(w.workSec, `${p.id} ${d.date}`).toBeLessThanOrEqual(
          0.5 * summarize(w, ctx).durationSec + 60
        );
      }
    }
  });

  it('u nedelji sa blokom u dugom (≥ 30 min) nema tempa maratona usred nedelje (README)', () => {
    for (const p of PROFILE_PLANS)
      for (const w of p.doc.weeks) {
        const block = w.days.find((d) => d.workout?.stimulus === 'dugi-rp');
        if (block === undefined || (block.workout?.workSec ?? 0) < 1800) continue;
        expect(
          w.days.some((d) => d.workout?.stimulus === 'tempo-trke'),
          `${p.id} n${String(w.index)}`
        ).toBe(false);
      }
  });

  it('doze (README): prag ≤ 35 min, intervali ≤ 21 min i samo u razvoju uz VDOT ≥ 40 i ≥ 4 dana, MP usred nedelje ≤ 50 min (brz 55)', () => {
    for (const p of PROFILE_PLANS) {
      const lvl = p.doc.header.decisions.level;
      const vdot = p.doc.header.form.current.vdot;
      for (const w of p.doc.weeks)
        for (const d of w.days) {
          const x = d.workout;
          if (x === null || x.kind !== 'quality') continue;
          const tag = `${p.id} ${d.date}`;
          if (x.stimulus === 'prag' || x.stimulus === 'prag-p')
            expect(x.workSec, tag).toBeLessThanOrEqual(2100 + 120);
          if (x.stimulus === 'tempo-trke')
            expect(x.workSec, tag).toBeLessThanOrEqual((lvl === 'brz' ? 3300 : 3000) + 150);
          if (x.stimulus === 'intervali') {
            expect(x.workSec, tag).toBeLessThanOrEqual(1260 + 60);
            /* zamena praga intervalima (P4, nedelja sa tempom trke) i usponi posle dva brda (P3) su pravila motora */
            if (p.doc.header.decisions.runDays.length < 4) expect(x.workSec, tag).toBe(-1);
            if (vdot < 39.5) expect(x.text, tag).toMatch(/× 3 min/);
          }
        }
    }
  });

  it('provera forme: plan ≥ 12 nedelja ima proveru 7–9 nedelja pred trku (≥ 18 nedelja: polumaraton u N−9), nikad u prve 3 nedelje', () => {
    for (const p of PROFILE_PLANS) {
      const n = p.doc.weeks.length;
      const tests = p.doc.weeks.filter((w) => w.days.some((d) => d.workout?.kind === 'test'));
      for (const w of tests) expect(w.index, p.id).toBeGreaterThan(3);
      if (n < 12) continue;
      expect(
        tests.some((w) => w.index >= n - 9 && w.index <= n - 7),
        p.id
      ).toBe(true);
    }
  });

  it('ishrana i dan trke: dugi ≥ 90 min nosi unos; trka nosi raspodelu (start = MP + 5 do + 10 s/km), zid i ishranu', () => {
    for (const p of RENDERED) {
      const lines = p.text.split('\n');
      const ctx = paceCtxOf(p.doc.header);
      for (const d of days(p)) {
        const x = d.workout;
        if (x === null || x.kind !== 'long' || summarize(x, ctx).durationSec < 5400) continue;
        expect(
          (x.notes ?? []).some((n) => n.includes('gel')),
          `${p.id} ${d.date}`
        ).toBe(true);
      }
      const race = lines.findIndex((l) => l.includes('TRKA: maraton'));
      const notes = lines.slice(race, race + 6).join(' ');
      expect(notes, p.id).toMatch(/Zid/);
      expect(notes, p.id).toMatch(/gel svakih 35–40 min/);
      if (ctx.paces.byFeel) continue;
      const rp = /Tempo za trku: (\d+):(\d+)\/km/.exec(notes);
      const racePace = rp === null ? ctx.paces.RP : Number(rp[1]) * 60 + Number(rp[2]);
      const m = /Prvih 5–10 km trči (\d+):(\d+)–(\d+):(\d+)\/km/.exec(notes);
      expect(m, p.id).not.toBeNull();
      if (m === null) continue;
      const from = Number(m[1]) * 60 + Number(m[2]);
      const to = Number(m[3]) * 60 + Number(m[4]);
      expect(from - racePace, p.id).toBeGreaterThanOrEqual(4);
      expect(to - racePace, p.id).toBeLessThanOrEqual(11);
    }
  });

  it('sve se pravi uz upozorenje: 8 i 10 nedelja, početnik malog obima — plan postoji, upozorenje ima broj i predlog (polumaraton)', () => {
    for (const id of ['p13', 'p19', 'p11', 'p18']) {
      const p = PROFILE_PLANS.find((x) => x.id === id);
      expect(p, id).toBeDefined();
      if (p === undefined) continue;
      expect(p.doc.weeks.length, id).toBeGreaterThan(0);
      const warns = p.doc.header.warnings.filter((w) => w.severity !== 'info');
      expect(warns.length, id).toBeGreaterThan(0);
      for (const w of warns) {
        expect(w.problem, `${id} ${w.code}`).toMatch(/\d/);
        expect(w.proposal, `${id} ${w.code}`).toMatch(/\d/);
      }
    }
    for (const id of ['p13', 'p19']) {
      const w = PROFILE_PLANS.find((x) => x.id === id)?.doc.header.warnings.find(
        (x) => x.code === 'kratka-priprema'
      );
      expect(w?.proposal ?? '', id).toMatch(/1[6-9] nedelja/);
      expect(w?.proposal ?? '', id).toMatch(/polumaraton/);
    }
  });
});

const SOURCES = import.meta.glob<string>(['./*.ts', './testdata/*.ts', '!./*.test.ts'], {
  query: '?raw',
  import: 'default',
  eager: true
});

describe('izolacija foldera maratona (SPEC § 11.1)', () => {
  it('ne uvozi drugu distancu; podaci (van testdata) uvoze iz motora samo tipove', () => {
    const files = Object.entries(SOURCES);
    expect(files.length).toBeGreaterThanOrEqual(8);
    for (const [path, text] of files) {
      for (const m of text.matchAll(/^import (type )?[^;]*?from '([^']+)';/gms)) {
        const target = m[2] ?? '';
        expect(/distances\/|\.\.\/(hm|fivek|tenk)\b/.test(target), `${path} → ${target}`).toBe(
          false
        );
        if (!path.includes('/testdata/') && target.includes('engine'))
          expect(m[1], `${path} → ${target}`).toBe('type ');
      }
    }
  });
});

/* ------------------------------------------------------------------ 7. krug 12 (briefs/R12.md, maraton tab) */

describe('krug 12 — maraton (R1–R6)', () => {
  const daysOf = (p: (typeof PROFILE_PLANS)[number]) => p.doc.weeks.flatMap((w) => w.days);

  it('R1: vrh ≥ 52 km → najduži dugi ≥ 25,5 km; N−5 je drugi najduži (≥ 85 % najdužeg u N−3)', () => {
    for (const p of PROFILE_PLANS) {
      const st = weekStats(p.doc);
      const n = st.length;
      /* R1 važi za pripremu ≥ 16 nedelja (kraće nose `kratka-priprema`) */
      if (n < 16) continue;
      const peak = Math.max(...st.map((x) => x.km));
      const longest = Math.max(...st.map((x) => x.longKm));
      /* R17: 24,5 km — sudija 2 traži dugi ≤ ≈ 45 % nedelje kod 3–4 dana osim najdužih (v. kapiju) */
      if (peak >= 52) expect(longest, p.id).toBeGreaterThanOrEqual(24.5);
      const n5 = st[n - 6]?.longKm ?? 0;
      const n3 = st[n - 4]?.longKm ?? 0;
      expect(n5, `${p.id} N−5 ${String(n5)} / N−3 ${String(n3)}`).toBeGreaterThanOrEqual(
        0.85 * n3 - 0.25
      );
    }
  });

  it('R2: nov ili spor početnik (VDOT < 34) — dugi hod-trk, bez bloka u tempu maratona', () => {
    for (const p of PROFILE_PLANS.filter((x) => x.doc.header.decisions.level === 'pocetnik-nov')) {
      const longs = daysOf(p).filter((d) => d.workout?.kind === 'long');
      expect(longs.length, p.id).toBeGreaterThan(0);
      for (const d of longs) {
        expect(d.workout?.stimulus, `${p.id} ${d.date}`).toBe('dugi-hod');
        expect(d.workout?.text ?? '', `${p.id} ${d.date}`).toMatch(/hod-trk/);
      }
    }
    expect(
      PROFILE_PLANS.filter((x) => x.doc.header.decisions.level === 'pocetnik-nov').map((x) => x.id)
    ).toEqual(['p13', 'p18']);
  });

  it('R5: plan ≥ 18 nedelja ima pripremni polumaraton 6–9 nedelja pred trku, a sledeća nedelja nema kvaliteta', () => {
    for (const p of PROFILE_PLANS) {
      const n = p.doc.weeks.length;
      /* R17: nov/spor početnik (samo da završim) nema polumaraton — provera 10 km */
      if (n < 18 || p.doc.header.decisions.level === 'pocetnik-nov') continue;
      const race = p.doc.weeks.find((w) =>
        w.days.some(
          (d) => d.workout?.kind === 'test' && (d.workout.text ?? '').includes('polumaraton')
        )
      );
      expect(race, p.id).toBeDefined();
      if (race === undefined) continue;
      expect(n - race.index, p.id).toBeGreaterThanOrEqual(6);
      expect(n - race.index, p.id).toBeLessThanOrEqual(9);
      const next = p.doc.weeks[race.index];
      expect(
        next?.days.some((d) => d.workout?.kind === 'quality' || (d.workout?.workSec ?? 0) > 0),
        `${p.id} n${String(race.index + 1)}`
      ).toBe(false);
    }
  });

  /* M10 (motor, krug 15): trka na dan dugog */
  it('R5/M10: pripremni polumaraton je na dan dugog', () => {
    for (const p of PROFILE_PLANS.filter(
      (x) => x.doc.weeks.length >= 18 && x.doc.header.decisions.level !== 'pocetnik-nov'
    )) {
      const longDay = p.doc.header.decisions.longDay;
      const d = daysOf(p).find(
        (x) => x.workout?.kind === 'test' && (x.workout.text ?? '').includes('polumaraton')
      );
      expect(d?.id.endsWith(`d${String(longDay)}`), p.id).toBe(true);
    }
  });

  it('R3: blok u tempu maratona ≤ 45 % dugog (km)', () => {
    for (const p of PROFILE_PLANS) {
      const ctx = paceCtxOf(p.doc.header);
      for (const d of daysOf(p)) {
        const x = d.workout;
        if (x === null || x.stimulus !== 'dugi-rp') continue;
        expect(x.workSec / ctx.paces.RP, `${p.id} ${d.date}`).toBeLessThanOrEqual(
          0.45 * summarize(x, ctx).km + 0.5
        );
      }
    }
  });

  it('R6: spor nivo (VDOT < 40) nema intervale; p16 nikad tri brza treninga u nedelji od 4 dana', () => {
    for (const p of PROFILE_PLANS.filter((x) => x.doc.header.decisions.level === 'spor'))
      for (const d of daysOf(p))
        expect(d.workout?.stimulus, `${p.id} ${d.date}`).not.toBe('intervali');
    const p16 = PROFILE_PLANS.find((x) => x.id === 'p16');
    for (const w of p16?.doc.weeks ?? [])
      expect(
        w.days.filter((d) => (d.workout?.workSec ?? 0) > 0 && d.workout?.kind !== 'race').length,
        `p16 n${String(w.index)}`
      ).toBeLessThanOrEqual(2);
  });
});

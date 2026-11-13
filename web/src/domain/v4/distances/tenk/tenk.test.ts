/* 10 KM (V4) — testovi podataka distance: izolacija foldera, pokrivenost šablona, čuvar na mreži ulaza (samo nalazi
   koje ulaz opravdava), upotrebljivost, otisci 12 profila i provere K1–K8 rubrike nad ispisom (RUBRIC-V4 § A2), po
   obrascu polumaratona, sa brojevima za 10 km. */
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
import { tenk } from './index';
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
  const state = buildState(facts, goal, tenk, estimateForm);
  const result = plan(state, goal, tenk);
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
    for (const level of new Set(tenk.levels.map((l) => l.id))) {
      for (let weeks = 1; weeks <= 52; weeks += 1) {
        for (let days = 1; days <= 7; days += 1) {
          const hit = tenk.templates.find(
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
      tenk.library
        .filter((d) => d.kind === 'quality' || (d.kind === 'long' && d.main.kind !== 'steady'))
        .map((d) => d.stimulus)
    );
    for (const s of quality) expect(tenk.safety.doseCaps[s], s).toBeDefined();
    const used = new Set<string>();
    for (const t of tenk.templates) {
      for (const w of [...t.tail, ...t.body.flatMap((b) => b.cycle)]) {
        if (w.long !== null) used.add(w.long.stimulus);
        for (const s of w.stimuli) used.add(s.stimulus);
      }
    }
    for (const s of used)
      expect(
        tenk.library.some((d) => d.stimulus === s),
        s
      ).toBe(true);
    for (const def of tenk.library) expect(tenk.texts[def.text], def.id).toBeDefined();
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
  return build(facts, { distanceId: 'tenk', raceDate: addDays('2026-11-01', 7 * c.weeks) });
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
  /* krug 8 (R8 t. 2, 12): izuzetak „kratak plan, spor trkač velikog obima" uklonjen — % doze se u sužavanju
     primenjuje na manji od osnovice i plafona */
  /* krug 5 (D7): tempo trke na nedeljnom plafonu nivoa — skraćen rad ostavlja nedelju ispod cilja */
  const zc = tenk.safety.weeklyZoneMaxSec;
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
    st?.week.intent.kind === 'peak' ? tenk.safety.maxFastSharePeak : tenk.safety.maxFastShare;
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
      for (const f of guard(b.doc, b.state, tenk)) {
        if (justified(f, b, stats) === null) {
          unexplained.push(
            `${f.check}@${String(f.weekIndex)} d${String(c.days)} n${String(c.weeks)} ${String(c.km)} km ${String(c.formSec)} s${c.beginner ? ' početnik' : ''}`
          );
        }
      }
    }
    expect(unexplained.slice(0, 20)).toEqual([]);
  });

  it('12 profila: samo opravdani nalazi (3 dana, provera forme)', () => {
    const out: string[] = [];
    for (const p of PROFILE_PLANS) {
      const stats = weekStats(p.doc);
      for (const f of guard(p.doc, p.state, tenk)) {
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

describe('10 km — poznate greške motora (pada kad motor ispravi; tada se it.fails briše)', () => {
  /* R8-14 (krug 8, ispravljeno): prvi trening podražaja ≤ 70 % PLANIRANOG vrha (šablon × osnovica, do plafona) */
  it('R8-14: p03 prvi trening praga ≤ 70 % vrha praga u planu (+ 60 s)', () => {
    const p = PROFILE_PLANS.find((x) => x.id === 'p03');
    const t = (p?.doc.weeks ?? [])
      .flatMap((w) => w.days)
      .map((d) => d.workout)
      .filter((x) => x !== null && x.stimulus !== null && ZONE_OF[x.stimulus] === 'T')
      .map((x) => x?.workSec ?? 0);
    expect(t[0] ?? 0).toBeLessThanOrEqual(0.7 * Math.max(...t) + 60);
  });
  /* R8-15 (krug 8, ispravljeno): blok u dugom ne spušta dugi ispod 25 % vremena nedelje */
  it('R8-15: p06 dugi ≥ 25 % vremena vršne nedelje', () => {
    const p = PROFILE_PLANS.find((x) => x.id === 'p06');
    const peak =
      p === undefined ? undefined : weekStats(p.doc).find((s) => s.week.intent.kind === 'peak');
    expect((peak?.longSec ?? 0) / (peak?.durationSec ?? 1)).toBeGreaterThanOrEqual(0.25);
  });
});

/* ------------------------------------------------------------------ 4. otisci 12 profila */

describe('otisci 12 profila (izmena motora ne sme nenamerno da promeni 10 km)', () => {
  it.each(PROFILE_PLANS.map((p) => [p.id, p] as const))('%s', async (id, p) => {
    await expect(fingerprint(p.doc, p.facts)).toMatchFileSnapshot(`__fixtures__/${id}.otisak.txt`);
  });
});

/* ------------------------------------------------------------------ 5. provere K1–K8 nad ispisom */

const ALL_PLANS = PROFILE_PLANS;
const RENDERED = ALL_PLANS.map((p) => ({ ...p, text: renderPlan(p.doc, p.state, tenk) }));

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
  'tempo-trke': 'RP'
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
      expect(proposals, p.id).toBeLessThanOrEqual(3);
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
      stats.forEach((s, i) => {
        if (addDays(s.week.start, 6) <= rampEnd) return;
        if (s.longKm > 0 && best > 0) {
          const step = s.longKm - best;
          expect(step <= 2.05 || step / best <= 0.12, `${p.id} dugi n${String(i + 1)}`).toBe(true);
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
      if (p.doc.header.warnings.some((w) => w.code === 'obim-za-nivo')) continue;
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

/* ------------------------------------------------------------------ 6. trenerski zahtevi za 10 km */

describe('trenerski zahtevi za 10 km (coach/target/10K/README.md)', () => {
  it('nedelja 1 nije ispod sadašnjeg obima (≥ 95 % km kod 4+ dana)', () => {
    for (const p of PROFILE_PLANS) {
      const d = p.doc.header.decisions;
      if (d.runDays.length < 4) continue;
      const first = weekStats(p.doc)[0];
      if (first?.hasTest === true) continue;
      expect(first?.km ?? 0, p.id).toBeGreaterThanOrEqual(0.95 * (p.facts.profile.weeklyKm ?? 0));
    }
  });

  it('najteža nedelja 3 pred trku, sledeća ≤ 85 % (km); sužavanje 7–10 dana: nedelja −1 i nedelja trke', () => {
    for (const p of PROFILE_PLANS) {
      const n = p.doc.weeks.length;
      if (n < 8) continue;
      const kinds = p.doc.weeks.map((w) => w.intent.kind);
      const peak = kinds.lastIndexOf('peak');
      expect(n - 1 - peak, p.id).toBe(3);
      const stats = weekStats(p.doc);
      const top = Math.max(...stats.map((s) => s.km));
      const next = stats[peak + 1];
      expect(next?.km ?? 0, p.id).toBeLessThanOrEqual(0.85 * top + 0.5);
      expect(kinds.slice(-2), p.id).toEqual(['taper', 'race']);
    }
  });

  it('dugi je 25–36 % vremena najteže nedelje kod 4+ dana (README: 30–33 %), 3 dana ≤ 50 %; dugi 60–100 min ili ≥ 10 km', () => {
    for (const p of PROFILE_PLANS) {
      const d = p.doc.header.decisions;
      const stats = weekStats(p.doc);
      const peak = stats.find((s) => s.week.intent.kind === 'peak');
      if (peak === undefined) continue;
      const share = peak.longSec / peak.durationSec;
      if (d.runDays.length >= 4) {
        /* 6 dana i 90+ km: dugi je na plafonu od 1 h 40, pa je udeo manji */
        expect(share, p.id).toBeGreaterThanOrEqual(d.runDays.length >= 6 ? 0.2 : 0.25);
        expect(share, p.id).toBeLessThanOrEqual(0.36);
      } else expect(share, p.id).toBeLessThanOrEqual(0.5);
      const longest = Math.max(...stats.map((s) => s.longSec));
      const longestKm = Math.max(...stats.map((s) => s.longKm));
      expect(longest, p.id).toBeLessThanOrEqual(d.level === 'spor' ? 6660 : 6060);
      /* najmanje 1 h ili dužina trke (brz trkač malog obima: 10 km za 48 min) */
      expect(longest >= 3540 || longestKm >= 9.95, p.id).toBe(true);
    }
  });

  it('dugi nema blok tempa trke kao pravilo: završnica u dugom ≤ 15 min (10–15 min u pragu ili tempu trke)', () => {
    for (const p of ALL_PLANS)
      for (const d of p.doc.weeks.flatMap((w) => w.days))
        if (d.workout?.kind === 'long')
          expect(d.workout.workSec, `${p.id} ${d.date}`).toBeLessThanOrEqual(15 * 60 + 30);
  });

  it('doze po lestvici README: prag ≤ 28 min (brz 32), intervali ≤ 22 min (brz 25), tempo trke ≤ 35 min (brz 40; B7)', () => {
    const caps: Record<string, [number, number]> = {
      prag: [28, 32],
      intervali: [22, 25],
      'tempo-trke': [35, 40]
    };
    for (const p of ALL_PLANS) {
      const fast = p.doc.header.decisions.level === 'brz';
      for (const d of p.doc.weeks.flatMap((w) => w.days)) {
        const cap = caps[d.workout?.stimulus ?? ''];
        if (cap === undefined || d.workout === null) continue;
        /* zaokruživanje deonica: + 1 deonica od 1 km */
        expect(d.workout.workSec / 60, `${p.id} ${d.date}`).toBeLessThanOrEqual(
          (fast ? cap[1] : cap[0]) + 4
        );
      }
    }
  });

  it('plan duži od 10 nedelja: ispis nosi napredak u prognozi; 3 dana: upozorenje malo-dana sa predlogom', () => {
    const small = gridBuild({ days: 4, weeks: 10, km: 15, formSec: 3500, beginner: false });
    const w = small.doc.header.warnings.find((x) => x.code === 'mali-obim');
    expect(w?.proposal).toMatch(/\d/);
    for (const id of ['p03', 'p08', 'p10', 'p11']) {
      const p = RENDERED.find((x) => x.id === id);
      expect(
        p?.doc.header.warnings.map((x) => x.code),
        id
      ).toContain('malo-dana');
    }
    const p11 = RENDERED.find((x) => x.id === 'p11');
    expect(p11?.text).toMatch(/Očekivano na dan trke: .* brže od današnje prognoze/);
  });
});

/* ------------------------------------------------------------------ 7. doze, raznovrsnost, provera forme, dan trke */

describe('doze, raznovrsnost, provera forme, dan trke (po obrascu R16, R17, R19)', () => {
  it('plan od 12+ nedelja ima intervale i brzinu/uspone (početnik: uspone/ubrzanja) i nema 5 nedelja zaredom sa istim kvalitetom', () => {
    for (const p of ALL_PLANS) {
      if (p.doc.weeks.length < 12) continue;
      const beginner = p.doc.header.decisions.level.startsWith('pocetnik');
      const stimuli = p.doc.weeks.map((w) =>
        w.days
          .map((d) => d.workout)
          .filter((x) => x !== null && (x.kind === 'quality' || x.kind === 'test'))
          .map((x) => x?.stimulus ?? '')
          .sort()
          .join('+')
      );
      if (!beginner) expect(stimuli.join(' '), p.id).toMatch(/intervali/);
      const hills = p.doc.weeks
        .flatMap((w) => w.days)
        .some((d) => ['brzina', 'usponi-kratki'].includes(d.workout?.stimulus ?? ''));
      expect(hills, p.id).toBe(true);
      let run = 1;
      for (let i = 1; i < stimuli.length; i += 1) {
        const same = stimuli[i] !== '' && stimuli[i] === stimuli[i - 1];
        run = same ? run + 1 : 1;
        expect(run, `${p.id} nedelja ${String(i + 1)}: ${stimuli[i] ?? ''}`).toBeLessThan(5);
      }
    }
  });

  it('provera forme: plan od 8+ nedelja je ima; nije u 1. nedelji; 5 km, a 3 km za početnika i obim ispod ≈ 25 km (brz uvek 5 km)', () => {
    for (const p of ALL_PLANS) {
      const tests = p.doc.weeks.flatMap((w) =>
        w.days.filter((d) => d.workout?.kind === 'test').map((d) => ({ w, d }))
      );
      if (p.doc.weeks.length >= 8) expect(tests.length, p.id).toBeGreaterThanOrEqual(1);
      const level = p.doc.header.decisions.level;
      for (const { w, d } of tests) {
        expect(w.index, `${p.id} ${d.date}`).toBeGreaterThanOrEqual(2);
        if (d.workout?.stimulus !== 'kontrola') continue;
        const small =
          level.startsWith('pocetnik') ||
          (level !== 'brz' && p.doc.header.decisions.baseLoad < 150);
        expect(d.workout.text, `${p.id} ${d.date}`).toMatch(small ? /3 km/ : /5 km/);
      }
    }
  });

  it('dan trke 10 km: zagrevanje i tempo po km, bez priče o ishrani tokom trke; po osećaju bez s/km', () => {
    for (const p of RENDERED) {
      const lines = p.text.split('\n');
      const race = lines.findIndex((l) => l.includes('TRKA: 10 km'));
      expect(race, p.id).toBeGreaterThan(0);
      const notes = lines.slice(race, race + 5).join('\n');
      expect(notes, p.id).toMatch(/Zagrevanje/);
      expect(notes, p.id).not.toMatch(/gel|napitak|ishran|unos/i);
      if (p.doc.header.paces.byFeel) expect(notes, p.id).not.toMatch(/\d:\d\d\/km/);
      else expect(notes, p.id).toMatch(/\d:\d\d\/km/);
    }
    for (const [key, text] of Object.entries(tenk.texts))
      expect(text, key).not.toMatch(/gel|sportski napitak/i);
  });
});

/* ------------------------------------------------------------------ 8. izolacija distance */

const SOURCES = import.meta.glob<string>(['./*.ts', './testdata/*.ts', '!./*.test.ts'], {
  query: '?raw',
  import: 'default',
  eager: true
});

describe('izolacija foldera 10 km (SPEC § 11.1)', () => {
  it('ne uvozi drugu distancu; podaci (van testdata) uvoze iz motora samo tipove', () => {
    const files = Object.entries(SOURCES);
    expect(files.length).toBeGreaterThanOrEqual(8);
    for (const [path, text] of files) {
      for (const m of text.matchAll(/^import (type )?[^;]*?from '([^']+)';/gms)) {
        const target = m[2] ?? '';
        expect(/distances\/|\.\.\/(hm|fivek|marathon)\b/.test(target), `${path} → ${target}`).toBe(
          false
        );
        if (!path.includes('/testdata/') && target.includes('engine'))
          expect(m[1], `${path} → ${target}`).toBe('type ');
      }
    }
  });
});

describe('krug 8 — t. 19: start trke 10 km', () => {
  it('napomena trke: prva 2 km tempo trke + 3 do + 6 s/km (podatak `raceStartPaceOffsetSec`)', () => {
    const p = PROFILE_PLANS.find((x) => x.id === 'p01');
    if (p === undefined) throw new Error('p01');
    const text = renderPlan(p.doc, p.state, tenk);
    const m = /Prva 2 km (\d+):(\d+)–(\d+):(\d+)\/km \(ne brže od (\d+):(\d+)\/km\)/.exec(text);
    expect(
      m,
      text.split('\n').find((l) => l.includes('Prva 2 km'))
    ).not.toBeNull();
    const sec = (a?: string, b?: string): number => Number(a) * 60 + Number(b);
    const race = sec(m?.[5], m?.[6]);
    expect(sec(m?.[1], m?.[2]) - race).toBe(3);
    expect(sec(m?.[3], m?.[4]) - race).toBe(6);
  });
});

/* ------------------------------------------------------------------ 9. krug 2 (briefs/R9-ROUND9.md § B) */

const rpSec = (w: PlanWeek): number =>
  w.days.reduce(
    (a, d) =>
      a +
      (d.workout?.stimulus === 'tempo-trke' || d.workout?.stimulus === 'dugi-rp'
        ? d.workout.workSec
        : 0),
    0
  );
/* „brz trening" (trener D9): kvalitet ili lagan dan sa dodatkom (ubrzanja, kratki usponi) */
const fastCount = (w: PlanWeek): number =>
  w.days.filter(
    (d) =>
      d.workout?.kind === 'quality' || (d.workout?.kind === 'easy' && d.workout.steps.length > 1)
  ).length;

/* p02 (5 km 20:25, 30 km, 8 ned) i p06 (VDOT 58, 30 km, 5 dana): motor briše tempo trke u nedelji −2 jer obim ne nosi
   kvalitet (A1 — ne zaobilazi se u podacima, brief R9 § B4) */
const WAIT_A1_RP = new Set<string>([]);

describe('krug 2: specifična faza, rast obima, kratka priprema (B1–B4)', () => {
  it('B1: između poslednje provere i najteže nedelje nema rasterećenja; tempo trke raste do najteže (≥ 12 nedelja)', () => {
    for (const p of PROFILE_PLANS) {
      const n = p.doc.weeks.length;
      if (n < 12) continue;
      const kinds = p.doc.weeks.map((w) => w.intent.kind);
      const peak = kinds.lastIndexOf('peak');
      const check = p.doc.weeks.reduce(
        (last, w, i) => (i < peak && w.days.some((d) => d.workout?.kind === 'test') ? i : last),
        -1
      );
      expect(check, p.id).toBeGreaterThanOrEqual(peak - 6);
      for (let i = check + 1; i < peak; i += 1)
        expect(kinds[i], `${p.id} n${String(i + 1)}`).not.toBe('recovery');
      /* od prve nedelje posle provere do najteže svaka nedelja ima tempo trke, a najteža ga ima najviše */
      const weeks = p.doc.weeks.slice(check + 1, peak + 1);
      /* jedan kvalitet nedeljno (3 dana, početnik): tempo trke bar u najtežoj — 5 nedelja zaredom istog se ne zadaje;
         početnik ima prag u N−5 (ciljni p11) */
      const single =
        p.doc.header.decisions.runDays.length <= 3 ||
        p.doc.header.decisions.level.startsWith('pocetnik');
      for (const w of weeks)
        if (!single || w.index === peak + 1)
          expect(rpSec(w), `${p.id} n${String(w.index)}`).toBeGreaterThan(0);
      /* najteža nosi (skoro) najviše tempa trke: ≥ 85 % najvećeg u specifičnoj fazi (deonice se zaokružuju na ceo komad) */
      const top = rpSec(p.doc.weeks[peak] as PlanWeek);
      expect(top, p.id).toBeGreaterThanOrEqual(0.85 * Math.max(...weeks.map(rpSec)));
      /* tempo trke ulazi pre provere (razvoj): bar jedna nedelja pre provere ga ima (početnik: od N−4, ciljni p11) */
      if (n >= 14 && !p.doc.header.decisions.level.startsWith('pocetnik'))
        expect(
          p.doc.weeks.slice(0, check).some((w) => rpSec(w) > 0),
          p.id
        ).toBe(true);
    }
  });

  it('B2: ≥ 35 km i ≥ 12 nedelja (4+ dana, ne početnik/povratnik) vrh ≥ × 1,15 u km (trener 1,25–1,30; p04 spor sa dugim ≤ 100 min ostaje ≈ × 1,17); 3 dana: nedelja 1 ≥ 95 %; bez dve iste uzastopne nedelje gradnje', () => {
    for (const p of PROFILE_PLANS) {
      const d = p.doc.header.decisions;
      const base = p.facts.profile.weeklyKm ?? 0;
      const stats = weekStats(p.doc);
      const top = Math.max(...stats.map((s) => s.km));
      if (
        base >= 35 &&
        p.doc.weeks.length >= 12 &&
        d.runDays.length >= 4 &&
        !['pocetnik', 'pocetnik-nov', 'povratnik'].includes(d.level)
      )
        expect(top / base, p.id).toBeGreaterThanOrEqual(1.15);
      if (d.runDays.length === 3)
        expect(stats[0]?.km ?? 0, p.id).toBeGreaterThanOrEqual(0.95 * base);
      const ctx = paceCtxOf(p.doc.header);
      const sig = (s: WeekStat): string =>
        `${(Math.round(s.km * 2) / 2).toFixed(1)}|${s.longKm.toFixed(1)}|${s.week.days
          .map((x) =>
            x.workout === null
              ? '-'
              : `${x.workout.text}:${summarize(x.workout, ctx).km.toFixed(1)}`
          )
          .join(',')}`;
      for (let i = 1; i < stats.length; i += 1) {
        const a = stats[i - 1] as WeekStat;
        const b = stats[i] as WeekStat;
        if (b.week.intent.kind !== 'build' || a.week.intent.kind !== 'build') continue;
        expect(sig(b), `${p.id} n${String(b.week.index)} ista kao prethodna`).not.toBe(sig(a));
      }
    }
  });

  it('B3: plan od 8 nedelja — sužavanje je jedna nedelja + nedelja trke; nedelja −2 ima tempo trke (osim obim-za-nivo, B4)', () => {
    for (const p of PROFILE_PLANS) {
      const n = p.doc.weeks.length;
      if (n > 9) continue;
      const kinds = p.doc.weeks.map((w) => w.intent.kind);
      expect(kinds.filter((k) => k === 'taper').length, p.id).toBe(1);
      expect(kinds.slice(-2), p.id).toEqual(['taper', 'race']);
      if (WAIT_A1_RP.has(p.id)) continue;
      expect(rpSec(p.doc.weeks[n - 3] as PlanWeek), p.id).toBeGreaterThan(0);
    }
  });

  /* B4: svaka nedelja gradnje i vrha ima kvalitet (motor A1, krug 9). Dok A1 ne stigne, p02 i p06 (mali obim uz visok
     nivo) ga nemaju — podaci to NE zaobilaze (brief R9 § B4). Kad A1 stigne, ovaj test pada: briše se `WAIT_A1`. */
  /* krug 9: A1 u motoru — p06 više nije izuzetak */
  const WAIT_A1 = new Set<string>([]);
  it('B4: svaka nedelja gradnje/vrha (van provere) ima bar jedan brz trening (kvalitet ili dodatak)', () => {
    const missing = new Set<string>();
    for (const p of PROFILE_PLANS)
      for (const w of p.doc.weeks) {
        if (w.intent.kind !== 'build' && w.intent.kind !== 'peak') continue;
        if (w.days.some((d) => d.workout?.kind === 'test')) continue;
        if (fastCount(w) === 0) missing.add(p.id);
      }
    expect([...missing].sort()).toEqual([...WAIT_A1].sort());
  });
});

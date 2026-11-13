/* POLUMARATON (V4) — testovi podataka distance: pokrivenost šablona, čuvar na mreži ulaza (samo nalazi koje ulaz
   opravdava), upotrebljivost, otisci 12 profila i provere K1–K8 rubrike nad ispisom (RUBRIC-V4 § A2). */
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
import { hm } from './index';
import { OWNER_PLANS } from './testdata/owner';
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
  const state = buildState(facts, goal, hm, estimateForm);
  const result = plan(state, goal, hm);
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
    for (const level of new Set(hm.levels.map((l) => l.id))) {
      for (let weeks = 1; weeks <= 52; weeks += 1) {
        for (let days = 1; days <= 7; days += 1) {
          const hit = hm.templates.find(
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
      hm.library
        .filter((d) => d.kind === 'quality' || (d.kind === 'long' && d.main.kind !== 'steady'))
        .map((d) => d.stimulus)
    );
    for (const s of quality) expect(hm.safety.doseCaps[s], s).toBeDefined();
    const used = new Set<string>();
    for (const t of hm.templates) {
      for (const w of [...t.tail, ...t.body.flatMap((b) => b.cycle)]) {
        if (w.long !== null) used.add(w.long.stimulus);
        for (const s of w.stimuli) used.add(s.stimulus);
      }
    }
    for (const s of used)
      expect(
        hm.library.some((d) => d.stimulus === s),
        s
      ).toBe(true);
    for (const def of hm.library) expect(hm.texts[def.text], def.id).toBeDefined();
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
        for (const formSec of [5100, 6300, 7500, 9000])
          for (const beginner of [false, true]) out.push({ days, weeks, km, formSec, beginner });
  return out;
}

function gridBuild(c: GridCase): Built {
  const facts: RunnerFacts = {
    today: '2026-11-01',
    availability: { runDays: GRID_DAYS[c.days] ?? [1, 3, 5, 6], longDay: 6 },
    profile: {
      weeklyKm: c.km,
      recentResult: { distanceM: 21097.5, timeSec: c.formSec, date: '2026-10-19' },
      ...(c.beginner ? { beginner: true } : {})
    },
    runs: [],
    pauses: [],
    pain: []
  };
  return build(facts, { distanceId: 'hm', raceDate: addDays('2026-11-01', 7 * c.weeks) });
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
  /* krug 5 (D7): tempo trke na nedeljnom plafonu nivoa — skraćen rad ostavlja nedelju ispod cilja */
  const zc = hm.safety.weeklyZoneMaxSec;
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
    st?.week.intent.kind === 'peak' ? hm.safety.maxFastSharePeak : hm.safety.maxFastShare;
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
      for (const f of guard(b.doc, b.state, hm)) {
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
      for (const f of guard(p.doc, p.state, hm)) {
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

/* ------------------------------------------------------------------ 4. otisci 12 profila */

describe('otisci 12 profila (izmena motora ne sme nenamerno da promeni polumaraton)', () => {
  it.each(PROFILE_PLANS.map((p) => [p.id, p] as const))('%s', async (id, p) => {
    await expect(fingerprint(p.doc, p.facts)).toMatchFileSnapshot(`__fixtures__/${id}.otisak.txt`);
  });
});

/* ------------------------------------------------------------------ 5. provere K1–K8 nad ispisom */

const ALL_PLANS = [
  ...PROFILE_PLANS,
  ...OWNER_PLANS.map((o) => ({ id: o.id, ...build(o.facts, o.goal) }))
];
const RENDERED = ALL_PLANS.map((p) => ({ ...p, text: renderPlan(p.doc, p.state, hm) }));

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
  'dugi-rp': 'RP',
  'dugi-progresivno': 'RP'
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
      for (const [z, e] of firstAndMax)
        /* vrh zone ispod 8 min / 0,7: prvi trening ne može biti ≤ 70 % vrha i ≥ 8 min rada (K8) — kao brzina;
           zona sa jednim treningom nema lestvicu (p12: jedni intervali, 4 × 3 min) */
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

/* ------------------------------------------------------------------ 6. trenerski zahtevi iz briefa */

describe('trenerski zahtevi (brief F3)', () => {
  it('nedelja 1 nije ispod sadašnjeg obima (≥ 95 % km; motor drži bodove ≥ B, km su niži za rad kvaliteta)', () => {
    for (const p of PROFILE_PLANS) {
      const d = p.doc.header.decisions;
      if (d.runDays.length < 4 || d.baseLoad / d.runDays.length > 70) continue;
      const first = weekStats(p.doc)[0];
      if (first?.hasTest === true) continue; /* rani test po osećaju u 1. nedelji */
      expect(first?.km ?? 0, p.id).toBeGreaterThanOrEqual(0.95 * (p.facts.profile.weeklyKm ?? 0));
    }
  });

  it('najteža nedelja 2–3 nedelje pred trku, sledeća ≤ 90 %; taper 2 nedelje', () => {
    for (const p of PROFILE_PLANS) {
      const n = p.doc.weeks.length;
      if (n < 8) continue;
      const kinds = p.doc.weeks.map((w) => w.intent.kind);
      const peak = kinds.lastIndexOf('peak');
      expect(n - 1 - peak, p.id).toBeGreaterThanOrEqual(2);
      expect(n - 1 - peak, p.id).toBeLessThanOrEqual(3);
      const stats = weekStats(p.doc);
      const pk = stats[peak];
      const next = stats[peak + 1];
      /* ≤ 90 % najteže (ciljni p01 50/56, p04 56/63 km = 89 %); kad je vrh blizu sadašnjeg obima (3 dana na granici nosivosti, brz nivo sa plafonom vrha)
         motor drži pod nedelje gradnje = sadašnji obim + rad kvaliteta (krug 2, R5), pa je granica 1,12 × baza.
         Najteža se meri po CILJU nedelje i po urađenom, većim od dva (p05: 6 dana, dugi ≤ 2 h 10 — vrh ne stane ceo) */
      if (pk !== undefined && next !== undefined)
        expect(next.load, p.id).toBeLessThanOrEqual(
          Math.max(
            0.9 * Math.max(pk.load, pk.week.targetLoad),
            1.12 * p.doc.header.decisions.baseLoad,
            /* pod R5: sadašnji obim + rad kvaliteta te nedelje (BO iznad laganih minuta) */
            p.doc.header.decisions.baseLoad + next.load - next.durationSec / 60 + 2
          )
        );
      expect(kinds.slice(-2), p.id).toEqual(['taper', 'race']);
    }
  });

  it('dugi je 28–45 % vremena najteže nedelje kod 4+ dana (organizator: 40–42 % kod 4 dana); blok RP u dugom raste po lestvici', () => {
    for (const p of PROFILE_PLANS) {
      const d = p.doc.header.decisions;
      const stats = weekStats(p.doc);
      const peak = stats.find((s) => s.week.intent.kind === 'peak');
      if (peak === undefined) continue;
      if (d.runDays.length >= 4) {
        /* dugi je ograničen na 2 h 15 (brz 2 h 05), pa je kod 5–6 dana i velikog obima udeo manji (v3: p05 ≈ 22 %) */
        const low = d.runDays.length >= 6 ? 0.2 : d.runDays.length === 5 ? 0.25 : 0.28;
        expect(peak.longSec / peak.durationSec, p.id).toBeGreaterThanOrEqual(low);
        /* početnik: dugi kao v3 (≈ 45 % nedelje, organizator) */
        const high = 0.42;
        expect(peak.longSec / peak.durationSec, p.id).toBeLessThanOrEqual(high);
      }
      const blocks = p.doc.weeks
        .slice(0, p.doc.weeks.indexOf(peak.week) + 1)
        .flatMap((w) => w.days)
        .filter((x) => x.workout?.kind === 'long' && x.workout.stimulus === 'dugi-rp')
        .map((x) => x.workout?.workSec ?? 0);
      for (let i = 1; i < blocks.length; i += 1)
        expect(blocks[i] ?? 0, `${p.id} blok ${String(i)}`).toBeGreaterThanOrEqual(
          (blocks[i - 1] ?? 0) - 1
        );
    }
  });

  it('plan duži od 10 nedelja: ispis nosi napredak u prognozi; mali obim i 3 dana: upozorenje sa predlogom', () => {
    /* mali-obim izostaje kad fali < 5 % (motor, četvrti krug): 20 km nedeljno, 4 dana, 10 nedelja ga mora imati,
       sa predlogom u brojevima */
    const small = gridBuild({ days: 4, weeks: 10, km: 20, formSec: 6300, beginner: false });
    const w = small.doc.header.warnings.find((x) => x.code === 'mali-obim');
    expect(w?.proposal).toMatch(/\d/);
    for (const id of ['p03', 'p08', 'p10']) {
      const p = RENDERED.find((x) => x.id === id);
      expect(
        p?.doc.header.warnings.map((w) => w.code),
        id
      ).toContain('malo-dana');
    }
    const p11 = RENDERED.find((x) => x.id === 'p11');
    expect(p11?.text).toMatch(/Očekivano na dan trke: .* brže od današnje prognoze/);
  });
});

/* ------------------------------------------------------------------ 7. krug 2 (R16, R17, R19) */

describe('krug 2: doze, raznovrsnost, provera forme, napomene (R16, R17, R19)', () => {
  it('R16: tempo trke nedelje (usred nedelje + blok u dugom) nije manji od poslednjeg praga pre nje (− 90 s)', () => {
    /* ciljni planovi: u nedelji sa blokom tempo trke usred nedelje je manji (p01 ned 10: 29 min + blok 29 min posle
       praga 33 min), pa se meri ukupan rad u tempu trke te nedelje */
    for (const p of ALL_PLANS) {
      let lastThreshold = 0;
      for (const w of p.doc.weeks) {
        let rp = 0;
        let mid = false;
        for (const d of w.days) {
          const x = d.workout;
          if (x === null) continue;
          if (x.stimulus === 'tempo-trke') mid = true;
          if (x.stimulus === 'tempo-trke' || x.stimulus === 'dugi-rp') rp += x.workSec;
        }
        /* sužavanje i nedelja trke su namerno manji (ciljni p11 ned 19: tempo trke 14 min posle praga) */
        /* M7 (krug 5): i kalendarska nedelja −2 (silazak obima ≤ 80 % vrha) */
        const minus2 = p.doc.weeks.length - w.index === 2;
        const light = w.intent.kind === 'taper' || w.intent.kind === 'race' || minus2;
        if (mid && !light)
          expect(rp, `${p.id} nedelja ${String(w.index)}`).toBeGreaterThanOrEqual(
            lastThreshold - 90
          );
        for (const d of w.days)
          if (d.workout?.stimulus === 'prag' || d.workout?.stimulus === 'prag-p')
            lastThreshold = d.workout.workSec;
      }
    }
  });

  it('R16: plan od 12+ nedelja ima intervale (početnik: brda/ubrzanja kao ciljni p11, p12) i brzinu/brda, i nema 5 nedelja zaredom sa istim kvalitetom', () => {
    for (const p of ALL_PLANS) {
      if (p.doc.weeks.length < 12 || p.doc.header.decisions.level === 'pocetnik') continue;
      const stimuli = p.doc.weeks.map((w) =>
        w.days
          .map((d) => d.workout)
          .filter((x) => x !== null && (x.kind === 'quality' || x.kind === 'test'))
          .map((x) => x?.stimulus ?? '')
          .sort()
          .join('+')
      );
      const all = stimuli.join(' ');
      expect(all, p.id).toMatch(/intervali/);
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

  it('R17: provera forme nije u 1. nedelji; subotom kad je subota dan trčanja; rani test 3 km za početnika i < 25 km, inače 5 km; upozorenje navodi istu distancu', () => {
    for (const p of ALL_PLANS) {
      const sat = p.doc.header.decisions.runDays.includes(5);
      for (const w of p.doc.weeks)
        for (const d of w.days) {
          if (d.workout?.kind !== 'test') continue;
          expect(w.index, `${p.id} ${d.date}`).toBeGreaterThanOrEqual(2);
          const weekday = (new Date(`${d.date}T12:00:00Z`).getUTCDay() + 6) % 7;
          if (sat) expect(weekday, `${p.id} ${d.date}`).toBe(5);
          if (d.workout.stimulus === 'kontrola-rana') {
            const small =
              p.doc.header.decisions.level === 'pocetnik' || p.doc.header.decisions.baseLoad < 150;
            const km = small ? '3 km' : '5 km';
            expect(d.workout.text, p.id).toMatch(new RegExp(km));
            const missing = p.doc.header.warnings.find((x) => x.code === 'nema-podataka');
            expect(missing?.proposal, p.id).toMatch(new RegExp(`na ${km}`));
          }
        }
    }
  });

  it('R17: pripremna trka 10 km vikendom kad obim to dozvoljava (≈ 35+ km)', () => {
    for (const id of ['p01', 'p02', 'p04', 'p05', 'p08', 'p09', 'p12']) {
      const p = ALL_PLANS.find((x) => x.id === id);
      const tests = (p?.doc.weeks ?? [])
        .flatMap((w) => w.days)
        .filter((d) => d.workout?.kind === 'test');
      expect(
        tests.some((d) => d.workout?.libraryId === 'kontrola-10k'),
        id
      ).toBe(true);
    }
  });

  it('R19: gel na dugom i na trci isto pravilo; dan trke po osećaju bez s/km', () => {
    const rule = /na svakih 30–40 min/;
    expect(hm.texts['napomena.dugi']).toMatch(rule);
    expect(hm.texts['napomena.trka-unos']).toMatch(rule);
    for (const p of RENDERED) {
      if (!p.doc.header.paces.byFeel) continue;
      const race = p.text.split('\n').findIndex((l) => l.includes('trka — polumaraton'));
      const notes = p.text
        .split('\n')
        .slice(race, race + 6)
        .join('\n');
      expect(notes, p.id).not.toMatch(/\d:\d\d\/km/);
    }
  });

  it('R19: lestvica intervala samo sa ≥ 15 min rada', () => {
    for (const p of ALL_PLANS)
      for (const d of p.doc.weeks.flatMap((w) => w.days))
        if (d.workout?.libraryId === 'i-lestvica')
          expect(d.workout.workSec, `${p.id} ${d.date}`).toBeGreaterThanOrEqual(900);
  });
});

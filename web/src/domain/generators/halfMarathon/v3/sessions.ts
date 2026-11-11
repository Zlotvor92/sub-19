/* Trening iz namere: doza u minutima rada → struktura, minuti i km iz tempa. WU/CD su fiksni po nivou (scale). */
import { fmtDuration, fmtPace, fmtTime, raceTime } from './paces.ts';
import type { Scale } from './scale.ts';
import type { QSpec, Shape } from './templates.ts';
import type { Paces, Segment, Session, Zone } from './types.ts';

export interface Ctx {
  p: Paces;
  s: Scale;
  beginner: boolean;
  /** nedelja posle koje se tempa znaju iz testa / pripremne trke (plan po osećaju) */
  testWeek: number | null;
  checkWeek: number | null;
  testKm: number;
}

const r05 = (x: number): number => Math.max(0.5, Math.round(x * 2) / 2);
const NICE = [200, 300, 400, 500, 600, 800, 1000, 1200, 1500, 1600, 1800, 2000];
/** deonica ispod 2 km: najbliža „trenerska" dužina */
const r100 = (m: number): number =>
  NICE.reduce((a, x) => (Math.abs(x - m) < Math.abs(a - m) ? x : a), NICE[0]!);
const kmTxt = (km: number): string => (Math.round(km * 10) / 10).toString().replace('.', ',');
const mTxt = (m: number): string =>
  m >= 1000 && m % 500 === 0 ? `${kmTxt(m / 1000)} km` : `${m} m`;
const recTxt = (sec: number): string =>
  `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;

export function paceOf(p: Paces, z: Zone): number {
  return { E: p.easy, T: p.T, I: p.I, R: p.R, RP: p.RP, H: p.I, S: p.R, W: p.easy * 1.6 }[z];
}

function seg(p: Paces, zone: Zone, min: number, pace = paceOf(p, zone)): Segment {
  return { zone, min, km: (min * 60) / pace };
}

/** opis tempa zone za nedelju (plan po osećaju: napor dok ne dođe test, pa pravilo iz testa/trke) */
export function paceLabel(c: Ctx, z: 'T' | 'I' | 'R' | 'RP', week: number): string {
  const p = c.p;
  if (!p.estimated) return `${fmtPace(paceOf(p, z))}/km`;
  const effort = {
    T: 'po osećaju: komforno teško, RPE 7',
    I: 'po osećaju: jako, RPE 8–9',
    R: 'brzo i opušteno, RPE 8',
    RP: 'po osećaju: tempo za ≈ 2 h trčanja, RPE 6'
  }[z];
  if (c.checkWeek !== null && week > c.checkWeek) {
    const d = Math.round(paceOf(p, z) - raceTime(p.vdot, 10000) / 10);
    return `tempo pripremne trke 10 km ${d >= 0 ? '+' : '−'} ${Math.abs(d)} s/km`;
  }
  if (c.testWeek !== null && week > c.testWeek) {
    const d = Math.round(paceOf(p, z) - raceTime(p.vdot, c.testKm * 1000) / c.testKm);
    return `tempo testa ${c.testKm} km ${d >= 0 ? '+' : '−'} ${Math.abs(d)} s/km`;
  }
  return effort;
}

function wrap(
  c: Ctx,
  zone: Zone,
  text: string,
  work: Segment[],
  rec: Segment[],
  note?: string
): Session {
  const segments = [seg(c.p, 'E', c.s.wu), ...work, ...rec, seg(c.p, 'E', c.s.cd)];
  const workMin = work.reduce((a, x) => a + x.min, 0);
  return {
    kind: 'quality',
    zone,
    text: `WU ${c.s.wu} min + ${text} + CD ${c.s.cd} min`,
    segments,
    km: segments.reduce((a, x) => a + x.km, 0),
    min: segments.reduce((a, x) => a + x.min, 0),
    workMin,
    ...(note ? { note } : {})
  };
}

function split(
  c: Ctx,
  z: 'T' | 'RP',
  doseMin: number,
  shape: Shape,
  week: number,
  label: string
): Session {
  const p = c.p;
  const pace = paceOf(p, z);
  const k0 = shape === 'komad' ? 1 : Number(shape.slice(1));
  // deonica: trenerska dužina; broj deonica ±1 od oblika kad je tako bliže dozi (doza se ne prekoračuje za > 1,4 min)
  const opts = (k0 === 1 ? [1] : [k0, k0 - 1, k0 + 1].filter((x) => x >= 2)).flatMap((kk) => {
    const repKm = (doseMin * 60) / pace / kk;
    const base = kk === 1 || repKm >= 2 ? r05(repKm) * 1000 : r100(repKm * 1000);
    const down =
      kk === 1 || repKm >= 2
        ? Math.max(500, base - 500)
        : (NICE.filter((x) => x < base).pop() ?? NICE[0]!);
    return [base, down].map((mm) => ({ k: kk, m: mm, work: (kk * mm * pace) / 60000 }));
  });
  const cap = z === 'T' ? c.s.caps.T : c.s.caps.RP;
  const fit = opts.filter((o) => o.work <= Math.min(doseMin + 1.5, cap + 1));
  const best = (fit.length ? fit : opts).reduce((a, o) =>
    Math.abs(o.work - doseMin) < Math.abs(a.work - doseMin) - 0.3 ? o : a
  );
  const { k, m } = best;
  const recSec = k === 1 ? 0 : z === 'RP' && m >= 3000 ? 120 : k >= 4 ? 60 : 90;
  const work = Array.from({ length: k }, () => seg(p, z, ((m / 1000) * pace) / 60));
  const rec = k > 1 ? [seg(p, 'E', ((k - 1) * recSec) / 60, p.easySlow)] : [];
  const pl = paceLabel(c, z, week);
  if (c.beginner && z === 'T') {
    // početnik: T u minutima (deonice od celih minuta)
    const repMin = Math.max(3, Math.round(doseMin / k));
    const w2 = Array.from({ length: k }, () => seg(p, 'T', repMin));
    const t2 =
      k === 1
        ? `T ${repMin} min u komadu (${pl})`
        : `T ${k} × ${repMin} min (${pl}; oporavak ${recTxt(recSec)} džog)`;
    return wrap(c, z, t2, w2, rec);
  }
  const text =
    k === 1
      ? `${label} ${mTxt(m)} u komadu (${pl})`
      : `${label} ${k} × ${mTxt(m)} (${pl}; oporavak ${recTxt(recSec)} džog)`;
  return wrap(c, z, text, work, rec);
}

export function quality(c: Ctx, q: QSpec, week: number): Session | null {
  const p = c.p;
  switch (q.t) {
    case 'easy':
    case 'sharpen':
      return null;
    case 'R': {
      const work = Array.from({ length: q.reps }, () => seg(p, 'R', (q.m / 1000) * (p.R / 60)));
      const rec = [seg(p, 'E', (q.reps * (q.m / 1000) * p.easySlow) / 60, p.easySlow)];
      if (q.hills)
        work.push(seg(p, 'H', (q.hills * 10) / 60), seg(p, 'E', (q.hills * 30) / 60, p.easySlow));
      const hills = q.hills ? ` + usponi ${q.hills} × 10 s` : '';
      return wrap(
        c,
        'R',
        `R ${q.reps} × ${q.m} m (${paceLabel(c, 'R', week)}; oporavak ${q.m} m džog)${hills}`,
        work,
        rec
      );
    }
    case 'H': {
      const work = [seg(p, 'H', (q.reps * q.sec) / 60)];
      const rec = [seg(p, 'E', (q.reps * q.sec * 2) / 60, p.easySlow)];
      return wrap(c, 'H', `usponi ${q.reps} × ${q.sec} s jako uzbrdo (nazad lagano)`, work, rec);
    }
    case 'T':
      return split(c, 'T', Math.round(q.dose * c.s.caps.T), q.shape, week, 'T');
    case 'RP':
      return split(c, 'RP', Math.round(q.dose * c.s.caps.RP), q.shape, week, 'RP');
    case 'I': {
      const dose = Math.round(q.dose * c.s.caps.I);
      const perKm = p.I / 60;
      let reps: number[];
      if (q.shape === 'pyr') {
        reps = [];
        const done = (): number => (reps.reduce((a, x) => a + x, 0) / 1000) * perKm;
        for (const m of [1200, 1000, 800, 600, 400])
          if (done() + (m / 1000) * perKm <= dose + 1.4) reps.push(m);
        if (done() + 1.6 * perKm <= dose + 1.4) reps.unshift(1600);
      } else {
        // najbliže dozi (bar 3 deonice), bez prekoračenja za > 1,5 min; željena dužina deonice ima prednost 1 min
        const want = q.shape === 'k800' ? 800 : 1000;
        const opts = [want, 1200, 1000, 800].flatMap((m) =>
          [Math.floor(dose / ((m / 1000) * perKm)), Math.ceil(dose / ((m / 1000) * perKm))]
            .filter((n) => n >= 3)
            .map((n) => ({ m, n, work: n * (m / 1000) * perKm }))
        );
        const fit = opts.filter((o) => o.work <= Math.min(dose + 1.5, c.s.caps.I + 1));
        const score = (o: { m: number; work: number }): number =>
          Math.abs(o.work - dose) + (o.m === want ? 0 : 1);
        const best = (fit.length ? fit : [{ m: 400, n: 3, work: 1.2 * perKm }]).reduce((a, o) =>
          score(o) < score(a) ? o : a
        );
        reps = Array.from({ length: best.n }, () => best.m);
      }
      const work = reps.map((m) => seg(p, 'I', (m / 1000) * perKm));
      const rec = [seg(p, 'E', ((reps.length - 1) * 150) / 60, p.easySlow)];
      const desc =
        q.shape === 'pyr'
          ? reps.map((m) => `${m}`).join(' + ') + ' m'
          : `${reps.length} × ${reps[0]} m`;
      return wrap(c, 'I', `I ${desc} (${paceLabel(c, 'I', week)}; oporavak 2:30 džog)`, work, rec);
    }
  }
}

export function sharpen(c: Ctx, week: number): Session {
  const p = c.p;
  if (c.beginner) {
    const work = Array.from({ length: 3 }, () => seg(p, 'RP', 2));
    return wrap(c, 'RP', `RP 3 × 2 min (${paceLabel(c, 'RP', week)}; oporavak 2:00 džog)`, work, [
      seg(p, 'E', 4, p.easySlow)
    ]);
  }
  const m = r100((5.5 * 60 * 1000) / p.RP);
  const work = [0, 1].map(() => seg(p, 'RP', ((m / 1000) * p.RP) / 60));
  return wrap(
    c,
    'RP',
    `oštrenje RP 2 × ${mTxt(m)} (${paceLabel(c, 'RP', week)}; oporavak 2:00 džog)`,
    work,
    [seg(p, 'E', 2, p.easySlow)]
  );
}

export interface EasyOpts {
  strides?: number;
  hills?: number;
  tMin?: number;
  recovery?: boolean;
}

/** lagan dan; mali podražaj (usponi ili kratak T) je deo laganog dana, ne poseban trening */
export function easy(c: Ctx, km: number, o: EasyOpts = {}, week = 0): Session {
  const p = c.p;
  const tKm = o.tMin ? (o.tMin * 60) / p.T : 0;
  const segments = [seg(p, 'E', ((km - tKm) * p.easy) / 60)];
  if (o.tMin) segments.push(seg(p, 'T', o.tMin));
  const hillMin = o.hills ? (o.hills * 20) / 60 : 0;
  const extra = o.tMin
    ? `, u sredini T ${o.tMin} min u komadu (${paceLabel(c, 'T', week)})`
    : o.strides
      ? `, na kraju ${o.strides} × 20 s ubrzanja`
      : o.hills
        ? `, usred ${o.hills} × 20 s uspona`
        : '';
  return {
    kind: 'easy',
    zone: o.tMin ? 'T' : o.hills ? 'H' : null,
    text: `Lagano ${kmTxt(km)} km${extra}${o.recovery ? ' (oporavak od trke)' : ''}`,
    segments,
    km,
    min: segments.reduce((a, x) => a + x.min, 0),
    workMin: (o.tMin ?? 0) + hillMin
  };
}

export function shortEasy(c: Ctx, min: number, strides: number): Session {
  const s = easy(c, (min * 60) / c.p.easy, { strides });
  return { ...s, text: `Lagano ${min} min${strides ? ` + ${strides} × 20 s ubrzanja` : ''}` };
}

export interface LongOpts {
  blockKm?: number;
  progressiveKm?: number;
}

export function long(c: Ctx, km: number, o: LongOpts, week: number): Session {
  const p = c.p;
  const block = o.blockKm ?? 0;
  const prog = o.progressiveKm ?? 0;
  const easyKm = km - block;
  const segments = [seg(p, 'E', (easyKm * p.easy) / 60)];
  if (block) segments.push(seg(p, 'RP', (block * p.RP) / 60));
  const min = segments.reduce((a, x) => a + x.min, 0) - (prog * (p.easy - p.RP)) / 2 / 60;
  const slow = p.easy >= 420;
  const head = slow ? `Dugi ${fmtDuration(min)} (≈ ${kmTxt(km)} km)` : `Dugi ${kmTxt(km)} km`;
  let text = `${head} lagano`;
  if (block)
    text = `${head}: ${kmTxt(easyKm)} km lagano + ${kmTxt(block)} km RP (${paceLabel(c, 'RP', week)})`;
  else if (prog) text += `, poslednja ${kmTxt(prog)} km progresivno do RP`;
  const notes: string[] = [];
  if (slow && min >= 90) notes.push('dozvoljen 1 min hoda na 10 min');
  if (min >= 90) notes.push('unos na 35–40 min');
  return {
    kind: 'long',
    zone: block ? 'RP' : null,
    text,
    segments,
    km,
    min,
    workMin: block ? (block * p.RP) / 60 : (prog * p.RP) / 60 / 2,
    ...(notes.length ? { note: notes.join('; ') } : {})
  };
}

export function check(c: Ctx, km: 10 | 5, week: number): Session {
  const p = c.p;
  const t = raceTime(p.vdot, km * 1000);
  const segments = [
    seg(p, 'E', c.s.wu),
    { zone: 'RP' as Zone, min: t / 60, km },
    seg(p, 'E', c.s.cd)
  ];
  return {
    kind: 'check',
    zone: 'RP',
    text: `PRIPREMNA TRKA ${km} km (ili test ${km} km sam): zagrevanje ${c.s.wu} min + 4 × 20 s, trka, ${c.s.cd} min lagano`,
    segments,
    km: segments.reduce((a, x) => a + x.km, 0),
    min: segments.reduce((a, x) => a + x.min, 0),
    workMin: t / 60,
    note: `nedelja ${week}: rezultat određuje tempo trke za specifičnu fazu`
  };
}

export function test(c: Ctx, km: 3 | 2): Session {
  const p = c.p;
  const t = raceTime(p.vdot, km * 1000);
  const segments = [
    seg(p, 'E', c.s.wu),
    { zone: 'T' as Zone, min: t / 60, km },
    seg(p, 'E', c.s.cd)
  ];
  return {
    kind: 'check',
    zone: 'T',
    text: `TEST ${km} km „jako ravnomerno": zagrevanje ${c.s.wu} min + 4 × 20 s, ${km} km, ${c.s.cd} min lagano`,
    segments,
    km: segments.reduce((a, x) => a + x.km, 0),
    min: segments.reduce((a, x) => a + x.min, 0),
    workMin: t / 60
  };
}

export function race(c: Ctx, label: string): Session {
  const min = (c.p.racePace * 21.0975) / 60;
  return {
    kind: 'race',
    zone: 'RP',
    text: `TRKA — polumaraton, ${label} ${c.p.estimated ? '(tempo iz pripremne trke)' : fmtTime(min * 60)}`,
    segments: [{ zone: 'RP', min, km: 21.1 }],
    km: 21.1,
    min,
    workMin: 0
  };
}

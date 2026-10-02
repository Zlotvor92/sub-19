/* Plan: adaptacija izlaza generatora, izmene i pomeranje dana, oznake.

   parity: test/deload-ostrina.test.mjs :: „deload ostaje prepoznatljiv SVUDA gde se čita" i „ručno pisan
   plan i dalje radi"; test/spojevi.test.mjs (run/walk se ne gubi pri ručnoj izmeni kilometraže);
   test/prevlacenje (zamena dana). Oracle test (`plan.oracle.test.ts`) dokazuje da je ponašanje isto kao
   u starom kodu; ovde su pravila izražena sama za sebe. */

import { describe, expect, it } from 'vitest';
import type { AltRecord, GenPlanState } from '../state';
import { generatePlan } from '../training/generator/generatePlan';
import { adaptGeneratedPlan } from './adapt';
import { rpeTarget, safeTag, tagName, weekPhase } from './describe';
import { clearAlt, setAlt, swapDays, undoWeekMoves } from './edit';
import { resolvePlan } from './resolve';

const adapted = (): GenPlanState => {
  const g = generatePlan({
    startDate: '2026-08-17',
    raceDate: '2026-12-06',
    raceDistM: 5000,
    pb: { distM: 5000, sec: 1290 },
    weeklyKm: 45,
    runDays: 5,
    quality: 2,
    intensity: 'std',
    trainedRecently: true
  });
  const a = adaptGeneratedPlan(g);
  if (!a) throw new Error('adaptGeneratedPlan vratio null');
  return a;
};
const plan = adapted();
const resolve = (alts: Record<string, AltRecord> = {}, moves: Record<string, unknown> = {}) =>
  resolvePlan(plan.weeks, { alts, moves });
const day = (id: string) => {
  const d = resolve().byId.get(id);
  if (!d) throw new Error(`nema dana ${id}`);
  return d;
};
/** Prvi dan nedelje N koji nije odmor. */
const firstRunId = (w: number): string => {
  const d = plan.weeks[w - 1]?.days.find((x) => !x.rest);
  if (!d?.id) throw new Error('nema dana');
  return d.id;
};

describe('adaptGeneratedPlan', () => {
  it('daje ID-jeve g{nedelja}d{dan}, dow 0–6 i datum početka nedelje', () => {
    const w1 = plan.weeks[0];
    expect(w1?.start).toBe('2026-08-17');
    expect(plan.weeks[1]?.start).toBe('2026-08-24');
    for (const wk of plan.weeks) {
      for (const d of wk.days) {
        expect(d.id).toBe(`g${wk.w}d${d.dow + 1}`);
        expect(d.dow >= 0 && d.dow <= 6).toBe(true);
      }
    }
  });

  it('perzistirana nedelja NEMA `vol` (data contract)', () => {
    expect('vol' in (plan.weeks[0] ?? {})).toBe(false);
  });

  it('PRED ID-jevi i qs ključevi su u „g" prostoru', () => {
    expect(plan.pred.every((r) => /^g\d+_\d+$/.test(r.id ?? ''))).toBe(true);
    expect(Object.keys(plan.qs ?? {}).every((k) => /^g\d+d\d$/.test(k))).toBe(true);
  });

  it('prenosi zastavicu deload; faza se prepoznaje po zastavici I po prefiksu', () => {
    const deloads = plan.weeks.filter((w) => /^DELOAD/i.test(w.focus));
    expect(deloads.length).toBeGreaterThan(0);
    for (const w of deloads) {
      expect(w.deload, `N${w.w}: zastavica se ne prenosi`).toBe(true);
      expect(weekPhase(w, plan.weeks.length)).toBe('DELOAD');
    }
    /* ručno pisan plan: tekst je drugačiji, zastavica ne postoji */
    expect(weekPhase({ w: 7, focus: 'DELOAD (intenzitetski) — bez kvaliteta' }, 14)).toBe('DELOAD');
    expect(weekPhase({ w: 7, deload: true, focus: '' }, 14)).toBe('DELOAD');
    expect(weekPhase({ w: 7, focus: 'Int + Tempo' }, 14)).not.toBe('DELOAD');
  });

  it('greška generatora → null', () => {
    expect(adaptGeneratedPlan({ error: 'x' })).toBeNull();
  });
});

describe('resolvePlan', () => {
  it('bez izmena: dani su kakvi ih je generator napravio, datum = mesto po planu', () => {
    const r = resolve();
    expect(r.byId.size).toBe(plan.weeks.reduce((n, w) => n + w.days.length, 0));
    for (const d of r.byId.values()) {
      expect(d.date).toBe(d.origDate);
      expect(d.snaga).toBe(false);
    }
    expect(r.dated.map((d) => d.date)).toEqual([...r.dated.map((d) => d.date)].sort());
  });

  it('izmena menja prikaz, ali čuva originalnu sesiju i original', () => {
    const id = firstRunId(2);
    const orig = day(id);
    const alts = {
      [id]: {
        tag: 'odmor',
        km: null,
        desc: 'Odmor',
        pace: null,
        rw: null,
        paceAuto: false
      } as AltRecord
    };
    const d = resolve(alts).byId.get(id);
    expect(d?.rest).toBe(true);
    expect(d?.tag).toBeUndefined();
    expect(d?.km).toBeNull();
    expect(d?.origin).toEqual(orig.origin);
    expect(d?.session).toBe(orig.session);
  });

  it('pomeranje menja datum; nevažeći datum u `moves` se ignoriše', () => {
    const id = firstRunId(2);
    const orig = day(id);
    expect(resolve({}, { [id]: '2026-12-31' }).byId.get(id)?.date).toBe('2026-12-31');
    for (const bad of ['abc', 5, null, '2026-02-31', {}]) {
      expect(resolve({}, { [id]: bad }).byId.get(id)?.date, JSON.stringify(bad)).toBe(
        orig.origDate
      );
    }
  });

  it('dva dana na istom datumu: dan koji se obrađuje kasnije se vraća na svoje mesto po planu', () => {
    const ids = (plan.weeks[1]?.days ?? []).filter((d) => !d.rest).map((d) => d.id as string);
    const earlier = ids[0] as string;
    const later = ids[1] as string;
    const r = resolve({}, { [later]: day(earlier).origDate });
    expect(r.byId.get(earlier)?.date).toBe(day(earlier).origDate);
    expect(r.byId.get(later)?.date).toBe(day(later).origDate);
  });

  it('ne menja ulazni plan', () => {
    const copy = JSON.stringify(plan);
    resolve(
      { [firstRunId(1)]: { tag: 'lako', km: 1, desc: 'x', pace: null, rw: null, paceAuto: false } },
      { [firstRunId(2)]: '2026-12-31' }
    );
    expect(JSON.stringify(plan)).toBe(copy);
  });
});

describe('swapDays / undoWeekMoves', () => {
  const [a, b] = (plan.weeks[2]?.days ?? []).filter((d) => !d.rest).map((d) => d.id as string);
  const base = resolve();

  it('zamena dva dana iste nedelje beleži samo odstupanja od plana', () => {
    const r = swapDays(base, {}, {}, a as string, b as string);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.moves).toEqual({
      [a as string]: day(b as string).origDate,
      [b as string]: day(a as string).origDate
    });
    /* druga zamena istih dana vraća na plan — mapa postaje prazna */
    const after = resolve({}, r.moves);
    const back = swapDays(after, {}, r.moves, a as string, b as string);
    expect(back.ok && back.moves).toEqual({});
  });

  it('odbija: odrađen dan, isti dan, druga nedelja, nepostojeći dan', () => {
    expect(
      swapDays(base, { [a as string]: { status: 'done' } }, {}, a as string, b as string)
    ).toEqual({ ok: false, err: 'odrađen dan se ne pomera' });
    expect(swapDays(base, {}, {}, a as string, a as string)).toEqual({
      ok: false,
      err: 'isti dan'
    });
    expect(swapDays(base, {}, {}, a as string, firstRunId(4))).toEqual({
      ok: false,
      err: 'van iste nedelje'
    });
    expect(swapDays(base, {}, {}, a as string, 'nema')).toEqual({
      ok: false,
      err: 'nepostojeći dan'
    });
  });

  it('ne menja ulazne mape', () => {
    const moves = Object.freeze({});
    expect(() => swapDays(base, Object.freeze({}), moves, a as string, b as string)).not.toThrow();
  });

  it('undoWeekMoves vraća sve dane nedelje', () => {
    const moves = { [a as string]: '2026-12-31', [firstRunId(1)]: '2026-12-30' };
    const wk = resolve({}, moves).weeks[2];
    if (!wk) throw new Error('nedelja');
    const r = undoWeekMoves(wk, moves);
    expect(r.changed).toBe(true);
    expect(Object.keys(r.moves)).toEqual([firstRunId(1)]);
    expect(undoWeekMoves(wk, {}).changed).toBe(false);
  });
});

describe('setAlt / clearAlt', () => {
  const base = resolve();
  const id = firstRunId(3);
  const d = base.byId.get(id);
  if (!d) throw new Error('dan');

  it('izmena identična planu se BRIŠE umesto da se čuva', () => {
    const existing = {
      [id]: { tag: 'lako', km: 1, desc: 'x', pace: null, rw: null, paceAuto: false } as AltRecord
    };
    const r = setAlt(base, {}, existing, id, {
      tag: d.origin.tag as string,
      km: d.origin.km,
      desc: d.origin.desc
    });
    expect(r.ok && id in r.alts).toBe(false);
  });

  it('odbija: odrađen trening, negativna kilometraža, nepoznat tip, nepostojeći dan', () => {
    expect(setAlt(base, { [id]: { status: 'done' } }, {}, id, { tag: 'lako', km: 5 })).toEqual({
      ok: false,
      err: 'odrađen trening se ne menja'
    });
    expect(setAlt(base, {}, {}, id, { tag: 'lako', km: -1 })).toEqual({
      ok: false,
      err: 'kilometraža ne može biti negativna'
    });
    expect(setAlt(base, {}, {}, id, { tag: 'xyz' })).toEqual({
      ok: false,
      err: 'tip nije izabran'
    });
    expect(setAlt(base, {}, {}, id, null)).toEqual({ ok: false, err: 'tip nije izabran' });
    expect(setAlt(base, {}, {}, 'nema', { tag: 'lako' })).toEqual({
      ok: false,
      err: 'nepostojeći dan'
    });
  });

  it('ritam trčanje/hod se NOSI kao podatak: ručna izmena km ga ne briše; odmor ga briše', () => {
    const rw = { runSec: 120, walkSec: 60 };
    const withRw = setAlt(base, {}, {}, id, { tag: 'lako', km: 4, desc: 'Run/walk', rw });
    if (!withRw.ok) throw new Error(withRw.err);
    expect(withRw.alts[id]?.rw).toEqual({
      runSec: 120,
      walkSec: 60,
      label: '2 min trčanje / 1 min hod'
    });
    /* ekran „Zameni" šalje samo tag/km/opis — nenavedeni ritam se ČUVA */
    const kmOnly = setAlt(base, {}, withRw.alts, id, { tag: 'lako', km: 6, desc: 'Run/walk' });
    expect(kmOnly.ok && kmOnly.alts[id]?.rw).toEqual(withRw.alts[id]?.rw);
    /* eksplicitno null ga briše */
    const cleared = setAlt(base, {}, withRw.alts, id, { tag: 'lako', km: 6, desc: 'x', rw: null });
    expect(cleared.ok && cleared.alts[id]?.rw).toBeNull();
    const rest = setAlt(base, {}, withRw.alts, id, { tag: 'odmor', rw });
    expect(rest.ok && rest.alts[id]).toMatchObject({
      tag: 'odmor',
      km: null,
      desc: 'Odmor',
      rw: null
    });
  });

  it('tempo se čuva samo za int/tempo; „+ Snaga" samo uz trkački tip', () => {
    const r1 = setAlt(base, {}, {}, id, {
      tag: 'tempo',
      km: 8,
      desc: 'T',
      pace: '250.4',
      snaga: true,
      paceAuto: true
    });
    expect(r1.ok && r1.alts[id]).toMatchObject({ pace: 250, paceAuto: true, snaga: true });
    const r2 = setAlt(base, {}, {}, id, { tag: 'lako', km: 8, desc: 'L', pace: 250, snaga: true });
    expect(r2.ok && r2.alts[id]?.pace).toBeNull();
    const r3 = setAlt(base, {}, {}, id, { tag: 'trka', km: 10, desc: 'T', snaga: true });
    expect(r3.ok && r3.alts[id]?.snaga).toBeUndefined();
  });

  it('clearAlt', () => {
    const alts = {
      [id]: { tag: 'lako', km: 1, desc: 'x', pace: null, rw: null, paceAuto: false } as AltRecord
    };
    expect(clearAlt(alts, id)).toEqual({ changed: true, alts: {} });
    expect(clearAlt(alts, 'nema').changed).toBe(false);
  });
});

describe('oznake', () => {
  it('tagName / safeTag: nepoznat i nasleđen tip ne prolaze', () => {
    expect(tagName('int')).toBe('Intervali');
    expect(tagName('xyz')).toBe('Trening');
    expect(tagName(undefined)).toBe('Trening');
    expect(tagName('constructor')).toBe('Trening');
    expect(safeTag('lako')).toBe('lako');
    expect(safeTag('toString')).toBe('');
    expect(safeTag('x"><img>')).toBe('');
  });

  it('weekPhase: poslednja nedelja je TRKA, pretposlednja TAPER, ostalo po udelu', () => {
    expect(weekPhase({ w: 20 }, 20)).toBe('TRKA');
    expect(weekPhase({ w: 19 }, 20)).toBe('TAPER');
    expect(weekPhase({ w: 3 }, 20)).toBe('BAZA');
    expect(weekPhase({ w: 10 }, 20)).toBe('RAZVOJ');
    expect(weekPhase({ w: 17 }, 20)).toBe('VRHUNAC');
    expect(weekPhase(null, 20)).toBe('');
  });

  it('rpeTarget: nema za odmor i snagu', () => {
    expect(rpeTarget({ rest: true, tag: undefined })).toBeNull();
    expect(rpeTarget({ rest: false, tag: 'snaga' })).toBeNull();
    expect(rpeTarget({ rest: false, tag: 'int' })).toMatchObject({ min: 8, max: 9 });
    expect(rpeTarget(null)).toBeNull();
  });
});

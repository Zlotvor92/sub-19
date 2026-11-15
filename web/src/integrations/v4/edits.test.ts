import { describe, expect, it } from 'vitest';
import {
  buildState,
  fingerprint,
  replan,
  type PlanDay,
  type PlanDoc,
  type Run
} from '../../domain/v4/engine';
import { estimateForm } from '../../domain/v4/fitness';
import { applyEdit, applyMove, doneFrom, longDayOffer, weekdayOf } from './edits';
import { DISTANCES } from './facts';
import { addDays, clone, deepFreeze, newPlan, TODAY } from './samples.test-data';

const allDays = (doc: PlanDoc): PlanDay[] => doc.weeks.flatMap((w) => w.days);
const byId = (doc: PlanDoc): Map<string, PlanDay> => new Map(allDays(doc).map((d) => [d.id, d]));

/** Prva nedelja posle danas sa težim treningom i slobodnim (odmor) danom: premeštanje teškog na dan odmora. */
function moveCase(doc: PlanDoc, today: string): { day: PlanDay; to: string } | null {
  for (const w of doc.weeks) {
    if (w.start <= today) continue;
    const hard = w.days.find((d) => d.workout?.kind === 'long' || d.workout?.kind === 'quality');
    const rest = w.days.find((d) => d.workout === null && d.date > today);
    if (hard !== undefined && rest !== undefined) return { day: hard, to: rest.date };
  }
  return null;
}

describe.each(Object.keys(DISTANCES))('ručna izmena i premeštanje: %s', (distanceId) => {
  const { doc, facts, goal } = newPlan(distanceId);
  const data = DISTANCES[distanceId];
  if (data === undefined) throw new Error(distanceId);
  const frozen = deepFreeze(clone(doc));
  const ctx = { today: TODAY, done: new Set<string>() };
  const c = moveCase(doc, TODAY);
  if (c === null) throw new Error('nema slučaja premeštanja');

  it('premešten dan: novi datum, `movedFrom`, ručno; dan sa cilja dobija stari datum; ostali isti', () => {
    const r = applyMove(frozen, c.day.id, c.to, ctx);
    if (!r.ok) throw new Error(r.reason);
    const before = byId(doc);
    const after = byId(r.doc);
    const moved = after.get(c.day.id);
    expect(moved?.date).toBe(c.to);
    expect(moved?.movedFrom).toBe(c.day.date);
    expect(moved?.origin).toBe('manual');
    expect(moved?.workout).toEqual(c.day.workout);
    const dates = allDays(r.doc).map((d) => d.date);
    expect(new Set(dates).size).toBe(dates.length);
    for (const [id, d] of before) {
      const a = after.get(id);
      if (id === c.day.id || d.date === c.to) continue;
      expect(a, id).toEqual(d);
    }
    expect(r.event).toEqual({
      id: `manual-edit:${TODAY}:${c.day.id}`,
      date: TODAY,
      kind: 'manual-edit',
      dayId: c.day.id
    });
    expect(JSON.stringify(frozen)).toBe(JSON.stringify(doc));
  });

  it('vraćanje na prvobitni datum briše `movedFrom`', () => {
    const r1 = applyMove(frozen, c.day.id, c.to, ctx);
    if (!r1.ok) throw new Error(r1.reason);
    const r2 = applyMove(r1.doc, c.day.id, c.day.date, ctx);
    if (!r2.ok) throw new Error(r2.reason);
    expect(byId(r2.doc).get(c.day.id)?.movedFrom).toBeUndefined();
    expect(byId(r2.doc).get(c.day.id)?.date).toBe(c.day.date);
  });

  it('odbija: urađen, zaključan, prošao, van nedelje, neispravan datum, nepoznat dan', () => {
    expect(applyMove(frozen, c.day.id, c.to, { today: TODAY, done: new Set([c.day.id]) })).toEqual({
      ok: false,
      reason: 'uradjen'
    });
    const locked: PlanDoc = clone(doc);
    for (const d of allDays(locked)) if (d.id === c.day.id) d.locked = true;
    expect(applyMove(locked, c.day.id, c.to, ctx)).toEqual({ ok: false, reason: 'zakljucan' });
    expect(applyMove(frozen, c.day.id, c.to, { ...ctx, today: addDays(c.day.date, 1) })).toEqual({
      ok: false,
      reason: 'prosao'
    });
    expect(applyMove(frozen, c.day.id, addDays(c.day.date, 7), ctx)).toEqual({
      ok: false,
      reason: 'van-nedelje'
    });
    expect(applyMove(frozen, c.day.id, '2026-02-30', ctx)).toEqual({
      ok: false,
      reason: 'datum-neispravan'
    });
    expect(applyMove(frozen, 'nema', c.to, ctx)).toEqual({ ok: false, reason: 'nema-dana' });
    /* dan na cilju je urađen → zauzet */
    const target = allDays(doc).find((d) => d.date === c.to);
    if (target !== undefined)
      expect(
        applyMove(frozen, c.day.id, c.to, { today: TODAY, done: new Set([target.id]) })
      ).toEqual({
        ok: false,
        reason: 'zauzet'
      });
  });

  it('motor posle premeštanja: premešten dan ostaje, urađeni i zaključani dani se ne menjaju; determinizam; ponovna primena bez efekta', () => {
    const r = applyMove(frozen, c.day.id, c.to, ctx);
    if (!r.ok) throw new Error(r.reason);
    /* zaključaj jedan budući dan iste nedelje i označi jedan prošli dan urađenim (dan pre danas, ako postoji) */
    const locked: PlanDoc = clone(r.doc);
    const week = locked.weeks.find((w) => w.days.some((d) => d.id === c.day.id));
    const lock = week?.days.find((d) => d.id !== c.day.id && d.workout !== null);
    if (lock !== undefined) lock.locked = true;
    const state = buildState(facts, goal, data, estimateForm, locked);
    const once = replan(locked, state, [r.event], data);
    const twice = replan(locked, state, [r.event], data);
    expect(fingerprint(once.doc, facts)).toBe(fingerprint(twice.doc, facts));
    const out = byId(once.doc);
    expect(out.get(c.day.id)?.date).toBe(c.to);
    expect(out.get(c.day.id)?.workout).toEqual(c.day.workout);
    if (lock !== undefined) expect(out.get(lock.id)).toEqual(lock);
    const again = replan(once.doc, state, [r.event], data);
    expect(again.changes).toEqual([]);
    expect(JSON.stringify(again.doc)).toBe(JSON.stringify(once.doc));
  });

  it('ručna izmena: `base` čuva prvi sadržaj i posle druge izmene', () => {
    const r1 = applyEdit(frozen, c.day.id, null, ctx);
    if (!r1.ok) throw new Error(r1.reason);
    const d1 = byId(r1.doc).get(c.day.id);
    expect(d1?.workout).toBeNull();
    expect(d1?.origin).toBe('manual');
    expect(d1?.base).toEqual(c.day.workout);
    const easy = allDays(doc).find((d) => d.workout?.kind === 'easy')?.workout ?? null;
    const r2 = applyEdit(r1.doc, c.day.id, easy, ctx);
    if (!r2.ok) throw new Error(r2.reason);
    expect(byId(r2.doc).get(c.day.id)?.base).toEqual(c.day.workout);
    expect(applyEdit(frozen, c.day.id, null, { today: TODAY, done: new Set([c.day.id]) })).toEqual({
      ok: false,
      reason: 'uradjen'
    });
  });

  it('id događaja: isti dokument → isti id; posle primene sledeća izmena istog dana dobija redni broj', () => {
    const a = applyMove(frozen, c.day.id, c.to, ctx);
    const b = applyMove(frozen, c.day.id, c.to, ctx);
    if (!a.ok || !b.ok) throw new Error('premeštanje');
    expect(a.event.id).toBe(b.event.id);
    /* motor upisuje id u `appliedEvents` kad događaj nešto promeni; ovde se to simulira */
    const applied: PlanDoc = {
      ...a.doc,
      header: { ...a.doc.header, appliedEvents: [...a.doc.header.appliedEvents, a.event.id] }
    };
    const back = applyMove(applied, c.day.id, c.day.date, ctx);
    if (!back.ok) throw new Error(back.reason);
    expect(back.event.id).toBe(`manual-edit:${TODAY}:${c.day.id}:1`);
  });
});

describe('ponuda „Ubuduće dugi …?"', () => {
  const { doc } = newPlan('hm');
  const longs = doc.weeks
    .map((w) => ({ w, long: w.days.find((d) => d.workout?.kind === 'long') }))
    .filter((x) => x.long !== undefined);

  /** Dugi dve uzastopne nedelje premešten na petak (4). */
  function movedTwice(): PlanDoc {
    const out: PlanDoc = clone(doc);
    for (const { w, long } of longs.slice(1, 3)) {
      const week = out.weeks.find((x) => x.index === w.index);
      const day = week?.days.find((d) => d.id === long?.id);
      if (week === undefined || day === undefined) continue;
      const friday = addDays(week.start, 4);
      const occupant = week.days.find((d) => d.date === friday);
      if (occupant !== undefined) occupant.date = day.date;
      day.movedFrom = day.date;
      day.date = friday;
      day.origin = 'manual';
      week.days.sort((a, b) => (a.date < b.date ? -1 : 1));
    }
    return out;
  }

  it('dve nedelje zaredom na isti dan → ponudi taj dan; jednom → ništa', () => {
    const av = { runDays: [1, 3, 4, 5, 6] as (0 | 1 | 2 | 3 | 4 | 5 | 6)[], longDay: 6 as const };
    expect(longDayOffer(movedTwice(), av)).toBe(4);
    expect(longDayOffer(doc, av)).toBeNull();
    expect(longDayOffer(movedTwice(), { ...av, longDay: 4 })).toBeNull();
  });

  it('dan u nedelji: ponedeljak = 0', () => {
    expect(weekdayOf('2026-11-16')).toBe(0);
    expect(weekdayOf('2026-11-22')).toBe(6);
  });
});

describe('urađeno', () => {
  it('trčanje sa danom plana', () => {
    const runs: Run[] = [
      { id: 'a', date: '2026-11-16', distanceM: 1, durationSec: 1, dayId: 'w1d1' },
      { id: 'b', date: '2026-11-17', distanceM: 1, durationSec: 1 }
    ];
    expect([...doneFrom(runs)]).toEqual(['w1d1']);
  });
});

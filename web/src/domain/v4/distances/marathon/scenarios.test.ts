/* 10 KM — opšta svojstva ponovnog planiranja nad 27 scenarija (24 + E7), isti testovi kao kod polumaratona
   (briefs R6, R7): R1 van prozora izmene dugi i nedelja nisu manji; R2 izlazak iz prozora bez skoka; R5 tekst ne
   zastareva; Z2 otpala provera → lagan ≤ 65 % dugog; Z3 prvi rad zone posle bola ≤ 60 %; Z4 prognoza se menja samo
   sa razlogom i u pravom smeru; Z5 po osećaju → tempa iz rezultata; Z6 pouzdanost; Z10 više događaja; Y4 tekst. */
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment,
   @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument */
import { describe, expect, it } from 'vitest';
import { paceCtxOf, renderPlan, summarize, type PlanDoc, type PlanWeek } from '../../engine';
import { addDays } from '../../engine/dates';
import { weekCost } from '../../engine/guard';
import { adjustmentWindow } from '../../engine/readiness';
import { adjustRaceDay } from '../../engine/plan';
import { easyShareOfLong } from '../../engine/decide';
import { marathon } from './index';
import { SCENARIOS } from './testdata/scenarios';
import { keptPeak } from '../../engine/testdata/round12';

/* POZNATE GREŠKE MOTORA na 10 km (13. 11. 2026) — nalaz se ne briše iz provere nego se ovde imenuje, sa uzrokom;
   svaki je zahtev prema motoru u `docs/generators-v4/reports/F7-10K-REPORT.md`. Kad motor bude ispravljen, test
   `poznate greške su još tu` pada i stavka se briše. */
/* R19: 's26 n17 nedelja' (p11 posle bola i trke, izlaz + 24 % u N−7) ispravljen motorom (stavka 2d) */
const KNOWN = new Map<string, string>([]);
const seenKnown = new Set<string>();
const open = (bad: string[]): string[] =>
  bad.filter((b) => {
    const key = [...KNOWN.keys()].find((k) => b === k || b.startsWith(`${k} `));
    if (key === undefined) return true;
    seenKnown.add(key);
    return false;
  });

const RUNS = SCENARIOS.map((s) => ({ s, r: s.run() }));
/* E5 (s17–s20) je nov plan iz novog stanja, ne ponovno planiranje */
const REPLANS = RUNS.filter(({ s }) => !s.title.startsWith('E5'));
const name = (no: number): string => `s${String(no).padStart(2, '0')}`;

function windowEnd(r: any): string | null {
  const ends: string[] = r.changes.map((c: any) => c.until as string);
  return ends.length === 0 ? null : ends.reduce((a, b) => (a > b ? a : b));
}
/* `by`: plan čija tempa važe za merenje (prvobitan plan se meri tempima novog — rezultat menja tempa, ne obim) */
const longSec = (w: PlanWeek, doc: PlanDoc, by: PlanDoc = doc): number => {
  const ctx = paceCtxOf(by.header);
  const day = w.days.find((d) => d.workout?.kind === 'long');
  return day?.workout === undefined || day.workout === null
    ? 0
    : summarize(day.workout, ctx).durationSec;
};
const weekKm = (w: PlanWeek, doc: PlanDoc, by: PlanDoc = doc): number =>
  weekCost(w, doc.header.goal.raceDate, paceCtxOf(by.header)).km;

describe('maraton: ponovno planiranje nad 29 scenarija', () => {
  it('R1: van prozora izmene dugi nije kraći od prvobitnog, nedelja nije manja', () => {
    const bad: string[] = [];
    for (const { s, r } of REPLANS) {
      const end = windowEnd(r);
      if (end === null) continue;
      for (const w of r.after.weeks as PlanWeek[]) {
        if (w.start <= end) continue;
        const old = (r.before.weeks as PlanWeek[]).find((x) => x.start === w.start);
        if (old === undefined) continue;
        const a = longSec(w, r.after);
        const b = longSec(old, r.before, r.after);
        if (b > 0 && a < b - 60)
          bad.push(
            `${name(s.no)} n${String(w.index)} dugi ${String(Math.round(a / 60))} < ${String(Math.round(b / 60))} min`
          );
        const ka = weekKm(w, r.after);
        const kb = weekKm(old, r.before, r.after);
        if (ka < kb - 0.5)
          bad.push(
            `${name(s.no)} n${String(w.index)} nedelja ${ka.toFixed(1)} < ${kb.toFixed(1)} km`
          );
      }
    }
    /* propušten trening (E3): sledeći dugi nikad kraći od prvobitnog; sužavanje (nedelje −2 i −1) se ne dira */
    for (const { s, r } of REPLANS.filter(({ s }) => s.title.startsWith('E3'))) {
      const today: string = r.afterState.today;
      const n = r.after.weeks.length;
      const next = (r.after.weeks as PlanWeek[]).find(
        (w) => w.start >= today && w.days.some((d) => d.date > today && d.workout?.kind === 'long')
      );
      const old = (r.before.weeks as PlanWeek[]).find((w) => w.start === next?.start);
      if (
        next !== undefined &&
        old !== undefined &&
        longSec(next, r.after) < longSec(old, r.before, r.after) - 60
      )
        bad.push(`${name(s.no)} sledeći dugi n${String(next.index)} kraći od prvobitnog`);
      for (const c of r.changes) {
        const w = (r.after.weeks as PlanWeek[]).find((x) => x.days.some((d) => d.id === c.dayId));
        if (w !== undefined && w.index >= n - 2 && w.index < n)
          bad.push(`${name(s.no)} izmena u sužavanju n${String(w.index)} (${String(c.dayId)})`);
      }
    }
    expect(open(bad)).toEqual([]);
  });

  it('R2: izlazak iz prozora bez skoka (dugi ≤ +25 % ili +20 min, nedelja ≤ +20 %)', () => {
    const bad: string[] = [];
    for (const { s, r } of REPLANS) {
      const end = windowEnd(r);
      if (end === null) continue;
      const after = r.after.weeks as PlanWeek[];
      const before = r.before.weeks as PlanWeek[];
      /* od današnje nedelje do dve nedelje posle prozora */
      const today: string = r.afterState.today;
      const firstOut = after.findIndex((w) => w.start > end);
      /* merilo je prva cela nedelja posle događaja; prelazi se mere od kraja rampe zaštite (rast unutar rampe je
         njena kriva) do dve nedelje posle prozora */
      const base = after.findIndex((w) => w.start > today);
      if (base < 0) continue;
      /* Z1 (krug 7): pravilo važi posle prekida (pauza, bol); u prvobitnom planu bez prekida ne važi */
      const rampEnd = ((r.after.header.adjustments ?? []) as any[])
        .filter(
          (a) =>
            a.kind === 'pause' || a.kind === 'pain' || (a.kind === 'effort' && a.planned !== true)
        )
        .map((a) => adjustmentWindow(a)?.rampEnd ?? '')
        .reduce((a: string, b: string) => (a > b ? a : b), '');
      if (rampEnd === '') continue;
      /* R19 (odluka organizatora): R2 je pravilo rasta IZNAD dostignutog — merilo je veće od prethodne nedelje
         (dugog) i referentne nedelje (dugog) pre pauze */
      const ref = ((r.after.header.adjustments ?? []) as any[])
        .filter((a) => a.kind === 'pause' && a.refWeekKm !== undefined)
        .reduce(
          (acc: { km: number; long: number }, a) => ({
            km: Math.max(acc.km, a.refWeekKm as number),
            long: Math.max(acc.long, (a.lastLongSec as number | undefined) ?? 0)
          }),
          { km: 0, long: 0 }
        );
      const from = Math.max(
        base + 1,
        after.findIndex((w) => addDays(w.start, 6) > rampEnd)
      );
      const to = firstOut < 0 ? after.length : Math.min(after.length, firstOut + 2);
      for (let i = from; i < to; i += 1) {
        const w = after[i];
        if (w === undefined || w.intent.kind === 'race') continue;
        /* povratak je gotov kod prve nedelje jednake prvobitnoj — dalje je prvobitan plan (i njegovi prelazi) */
        const ob = before[i];
        const same =
          ob !== undefined &&
          Math.abs(weekKm(ob, r.before, r.after) - weekKm(w, r.after)) <= 0.5 &&
          Math.abs(longSec(ob, r.before, r.after) - longSec(w, r.after)) <= 60;
        if (same && i > from) break;
        /* merilo: najveće od nedelje događaja (ne pre nje) — najviše 3 prethodne */
        /* krug 12 (M2): najteža nedelja pred trku posle prekida se spušta, ne briše — nije skok povratka */
        if (
          keptPeak(
            before.map((x) => weekKm(x, r.before)),
            before.map((x) => x.intent.kind),
            i,
            base,
            weekKm(w, r.after)
          )
        )
          continue;
        const lo = Math.max(base, i - 3);
        /* Z1 (krug 7): dugi od POSLEDNJEG dugog, i preko rasterećenja/provere, bez izuzetka prvobitnog plana */
        const prevLong =
          [...after.slice(lo, i)]
            .reverse()
            .map((x) => longSec(x, r.after))
            .find((x) => x > 0) ?? 0;
        const curLong = longSec(w, r.after);
        const fromLong = Math.max(prevLong, ref.long);
        const allowed = Math.max(fromLong * 1.25, fromLong + 1200);
        if (prevLong > 0 && curLong > allowed + 60)
          bad.push(
            `${name(s.no)} n${String(w.index)} dugi ${String(Math.round(prevLong / 60))} → ${String(Math.round(curLong / 60))} min`
          );
        const prevKm = Math.max(...after.slice(lo, i).map((x) => weekKm(x, r.after)));
        const oldPrevKm = Math.max(...before.slice(lo, i).map((x) => weekKm(x, r.before)));
        const km = weekKm(w, r.after);
        /* Z1 (krug 7): posle prekida bez izuzetka prvobitnog plana */
        const allowedKm = Math.max(prevKm, ref.km) * 1.2;
        void oldPrevKm;
        if (km > allowedKm + 0.5)
          bad.push(
            `${name(s.no)} n${String(w.index)} nedelja ${prevKm.toFixed(1)} → ${km.toFixed(1)} km`
          );
      }
    }
    expect(open(bad)).toEqual([]);
  });

  it('R5: upozorenja ne pominju datum u prošlosti; „oporavak do X" ⇒ prvi brzi posle X', () => {
    const bad: string[] = [];
    const isoOf = (d: string, m: string): string => {
      const month = Number(m);
      return `${month >= 9 ? '2026' : '2027'}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    };
    for (const { s, r } of RUNS) {
      const today: string = r.afterState.today;
      for (const w of r.after.header.warnings) {
        const text = `${w.problem} ${w.meaning} ${w.proposal}`;
        for (const m of text.matchAll(/(\d{1,2})\. (\d{1,2})\./g)) {
          const iso = isoOf(m[1] ?? '', m[2] ?? '');
          if (iso < today) bad.push(`${name(s.no)} ${w.code}: ${m[0]} (danas ${today})`);
        }
      }
      const text = renderPlan(r.after, r.afterState, marathon);
      const days = (r.after.weeks as PlanWeek[]).flatMap((w) => w.days);
      for (const m of text.matchAll(
        /(?:[Oo]porav\w* (?:traje )?do|Do) (\d{1,2})\. (\d{1,2})\.(?: traje oporavak)?/g
      )) {
        if (!m[0].includes('porav')) continue;
        const until = isoOf(m[1] ?? '', m[2] ?? '');
        const early = days.find(
          (d) =>
            d.date > today &&
            d.date <= until &&
            (d.workout?.kind === 'quality' || (d.workout?.kind === 'long' && d.workout.workSec > 0))
        );
        if (early !== undefined)
          bad.push(`${name(s.no)} oporavak do ${until}, a brzi ${early.date}`);
      }
    }
    expect(open(bad)).toEqual([]);
  });

  it('Z4: prognoza se menja samo sa razlogom i u pravom smeru', () => {
    const bad: string[] = [];
    for (const { s, r } of RUNS) {
      if (s.title.startsWith('E5')) continue;
      const was: number = r.before.header.form.raceDay.expectedSec;
      const now = adjustRaceDay(
        r.afterState.form.raceDay,
        r.afterState.form.current.raceTimeSec,
        r.after.header.decisions
      ).expectedSec;
      /* propušten trening nikad ne ubrzava prognozu */
      const asOf0: string = r.before.header.form.current.asOf;
      const result = (r.afterState.form.history as any[]).some(
        (h) => h.date > asOf0 && (h.signal === 'trka' || h.signal === 'test')
      );
      if (s.title.startsWith('E3') && !result && now < was - 1)
        bad.push(`${name(s.no)} propušten trening ubrzao prognozu ${String(was)} → ${String(now)}`);
      /* A4 (krug 9): bolji rezultat od očekivanog ne usporava prognozu — nova ≤ stara (bez tolerancije) */
      /* F4-K2: „brže od očekivanog" = brže od očekivanog po ličnoj krivi plana (isti `effortTimeSec`) */
      if (s.title.startsWith('E1') && s.title.includes('brže od očekivanog') && now > was)
        bad.push(`${name(s.no)} bolji rezultat usporio prognozu ${String(was)} → ${String(now)}`);
      /* ništa se nije desilo (test potvrdio formu): najviše 1 % */
      if (s.title.startsWith('E6') && Math.abs(now - was) > 0.01 * was)
        bad.push(`${name(s.no)} prognoza ${String(was)} → ${String(now)} bez događaja`);
      /* svaka promena ima rečenicu „zašto" (korak sa signalom posle polazne procene) */
      if (Math.abs(now - was) > 20) {
        const asOf: string = r.before.header.form.current.asOf;
        const why = (r.afterState.form.history as any[]).some(
          (h) => h.date > asOf && h.signal !== 'plan'
        );
        if (!why)
          bad.push(`${name(s.no)} prognoza ${String(was)} → ${String(now)} bez rečenice zašto`);
      }
    }
    expect(open(bad)).toEqual([]);
  });

  it('Z10: više događaja zaredom — rep izmena ne duži od 4 nedelje posle poslednjeg događaja', () => {
    const bad: string[] = [];
    for (const { s, r } of RUNS.filter(({ s }) => s.title.startsWith('E7'))) {
      const end = windowEnd(r);
      const limit = addDays(r.afterState.today as string, 28);
      /* krug 10 (stavka 2): posle 28 dana sme da traje samo geometrijski povratak dugog/obima — nedelje posle granice
         su ≤ prvobitnih */
      const onlyLower = (r.after.weeks as PlanWeek[])
        .filter((w) => w.start > limit && w.intent.kind !== 'race')
        .every((w) => {
          const old = (r.before.weeks as PlanWeek[]).find((x) => x.start === w.start);
          return (
            old === undefined ||
            (weekKm(w, r.after) <= weekKm(old, r.before, r.after) + 0.5 &&
              longSec(w, r.after) <= longSec(old, r.before, r.after) + 60)
          );
        });
      if (end !== null && end > limit && !onlyLower) bad.push(`${name(s.no)} rep do ${end}`);
    }
    expect(open(bad)).toEqual([]);
  });

  it('Z2: provera ili kvalitet koji otpadne postaje lagan dan ≤ udeo dugog iz podataka (4 dana 80 %)', () => {
    const bad: string[] = [];
    for (const { s, r } of REPLANS) {
      const ctx = paceCtxOf(r.after.header);
      for (const w of r.after.weeks as PlanWeek[]) {
        const old = (r.before.weeks as PlanWeek[]).find((x) => x.start === w.start);
        const long = longSec(w, r.after);
        if (old === undefined || long <= 0) continue;
        for (const d of w.days) {
          const o = old.days.find((x) => x.id === d.id);
          if (o?.workout == null || d.workout === null || d.date <= r.afterState.today) continue;
          if (
            (o.workout.kind === 'test' || o.workout.kind === 'quality') &&
            d.workout.kind === 'easy'
          ) {
            const sec = summarize(d.workout, ctx).durationSec;
            /* 10 km: lagan dan sme do udela dugog iz podataka (4 dana 80 %), ne 65 % polumaratona */
            if (
              sec >
              easyShareOfLong(marathon.safety, r.after.header.decisions.runDays.length) * long + 300
            )
              bad.push(
                `${name(s.no)} ${d.date} lagano ${String(Math.round(sec / 60))} uz dugi ${String(Math.round(long / 60))} min`
              );
          }
        }
      }
    }
    expect(open(bad)).toEqual([]);
  });

  it('Z3: prvi rad svake zone posle bola (i blok u dugom) ≤ 60 % planirane doze', () => {
    const bad: string[] = [];
    for (const { s, r } of REPLANS.filter(({ s }) => s.title.startsWith('E4'))) {
      const painDate: string = (r.afterState.pain as any[])[0]?.date ?? r.afterState.today;
      const seen = new Set<string>();
      for (const d of (r.after.weeks as PlanWeek[]).flatMap((w) => w.days)) {
        const x = d.workout;
        /* pravilo važi do 6 nedelja posle bola */
        if (x === null || d.date <= painDate || d.date > addDays(painDate, 42) || x.workSec <= 0)
          continue;
        const zone = marathon.library.find((y) => y.id === x.libraryId)?.main;
        const z = zone === undefined || zone.kind === 'all-out' ? null : zone.zone;
        if (z === null || seen.has(z)) continue;
        seen.add(z);
        const old = (r.before.weeks as PlanWeek[])
          .flatMap((w) => w.days)
          .find((y) => y.id === d.id)?.workout;
        if (old != null && old.workSec > 0 && x.workSec > 0.6 * old.workSec + 90)
          bad.push(
            `${name(s.no)} ${d.date} prvi rad zone ${z}: ${String(Math.round(x.workSec / 60))} od ${String(Math.round(old.workSec / 60))} min`
          );
      }
    }
    expect(open(bad)).toEqual([]);
  });

  it('Z5: plan „po osećaju" posle rezultata dobija tempa iz njega i gubi „nemam tvoj rezultat"', () => {
    const bad: string[] = [];
    for (const { s, r } of REPLANS) {
      if (r.before.header.paces.byFeel !== true) continue;
      const asOf: string = r.before.header.form.current.asOf;
      const result = (r.afterState.form.history as any[]).some(
        (h) => h.date > asOf && (h.signal === 'trka' || h.signal === 'test')
      );
      if (!result) continue;
      if (r.after.header.paces.byFeel === true) bad.push(`${name(s.no)} i dalje po osećaju`);
      if ((r.after.header.warnings as any[]).some((w) => w.code === 'nema-podataka'))
        bad.push(`${name(s.no)} „nemam tvoj rezultat"`);
    }
    expect(open(bad)).toEqual([]);
  });

  it('Z6: „visoka" tek posle dva saglasna rezultata; prva trka u životu raspon bar ± 2 %', () => {
    const bad: string[] = [];
    for (const { s, r } of RUNS) {
      const results = (r.afterState.form.history as any[]).filter(
        (h) => h.signal === 'trka' || h.signal === 'test'
      ).length;
      const entered = r.afterState.profile.recentResult !== undefined;
      if (r.afterState.form.current.confidence === 'visoka' && results + (entered ? 1 : 0) < 2)
        bad.push(`${name(s.no)} visoka uz ${String(results)} rezultat`);
      if (s.title.includes('prva trka u životu')) {
        const d = r.after.header.form.raceDay;
        if (d.lowSec > 0.98 * d.expectedSec + 1 || d.highSec < 1.02 * d.expectedSec - 1)
          bad.push(
            `${name(s.no)} prvi rezultat: raspon ${String(d.lowSec)}–${String(d.highSec)} oko ${String(d.expectedSec)}`
          );
      }
    }
    expect(open(bad)).toEqual([]);
  });
});

describe('maraton — Y4: tekst promena', () => {
  const texts = (r: any): string[] =>
    (r.changes as any[]).flatMap((c) => [String(c.reason ?? ''), String(c.after ?? '')]);
  it('nijedna rečenica nema „2.." (datum na kraju nosi svoju tačku), ni ispis plana', () => {
    for (const { s, r } of RUNS) {
      for (const t of texts(r)) expect(t, name(s.no)).not.toMatch(/\d\.\.(\s|$)/);
      expect(renderPlan(r.after, r.afterState, marathon), name(s.no)).not.toMatch(/\d\.\.(\s|$)/m);
    }
  });
  it('s10: nadoknada nije „skraćivanje"; nigde „plan ostaje isti" uz izmenu istog dana', () => {
    for (const { s, r } of RUNS) {
      for (const t of texts(r)) expect(t, name(s.no)).not.toMatch(/nadoknađuje skraćivanjem/);
      const changed = new Set(
        r.changes.flatMap((c) => {
          const d = (r.after.weeks as PlanWeek[])
            .flatMap((w) => w.days)
            .find((x) => x.id === c.dayId);
          return d === undefined ? [] : [d.date];
        })
      );
      for (const t of new Set(texts(r)))
        for (const m of t.matchAll(/\((\d+)\. (\d+)\.\)[^.;]*plan ostaje isti/g)) {
          const hit = [...changed].some(
            (d) => Number(d.slice(8)) === Number(m[1]) && Number(d.slice(5, 7)) === Number(m[2])
          );
          expect(hit, `${name(s.no)}: ${t}`).toBe(false);
        }
    }
  });
  it('s04: odrađena provera iz plana ne menja nedelje van svog prozora (nova tempa sama nisu izmena)', () => {
    for (const { s, r } of REPLANS) {
      const end = windowEnd(r);
      if (end === null) continue;
      for (const c of r.changes)
        if (c.scope === 'nedelja') {
          const w = (r.after.weeks as PlanWeek[]).find((x) => x.index === c.weekIndex);
          expect(
            w !== undefined && w.start > addDays(end, 7 * 4),
            `${name(s.no)} n${String(c.weekIndex)}`
          ).toBe(false);
        }
    }
  });
});

describe('maraton — poznate greške motora', () => {
  it('poznate greške su još tu (kad motor ispravi, stavka se briše iz KNOWN)', () => {
    expect([...KNOWN.keys()].filter((k) => !seenKnown.has(k))).toEqual([]);
  });
});

/* KRUG 17 (nalog R17): podaci maratona za pravila motora iz kruga 15 — `returnKeepLong` (lestvica dugog posle
   prekida) i `afterLongRace` (E5 posle polumaratona). */
describe('maraton — R17: lestvica dugog posle prekida i E5 posle polumaratona', () => {
  const kmOfLongs = (doc: PlanDoc): { index: number; start: string; km: number; sec: number }[] => {
    const ctx = paceCtxOf(doc.header);
    return doc.weeks.map((w) => {
      let km = 0;
      let sec = 0;
      for (const d of w.days)
        if (d.workout?.kind === 'long') {
          const c = summarize(d.workout, ctx);
          km = Math.max(km, c.km);
          sec = Math.max(sec, c.durationSec);
        }
      return { index: w.index, start: w.start, km, sec };
    });
  };

  it('returnKeepLong: posle prekida (E2 bolest, E7 put) sa ≥ 4 nedelje do trke ostaje dugi ≥ 26 km pre sužavanja, a lestvica do njega raste ≤ +20 min nedeljno', () => {
    const keep = marathon.safety.returnKeepLong;
    expect(keep).toEqual({ km: 26, minWeeksToRace: 4 });
    const bad: string[] = [];
    let checked = 0;
    for (const { s, r } of RUNS.filter(({ s }) => s.title.startsWith('E2') || s.no === 27)) {
      const before = kmOfLongs(r.before as PlanDoc);
      const after = kmOfLongs(r.after as PlanDoc);
      const n = after.length;
      const today = r.afterState.today as string;
      const weeksLeft = after.filter((w) => w.start > today).length;
      /* prvobitni najduži dugi pre sužavanja (do N−3) bio je ≥ 26 km; posle prekida mora da ostane bar jedan */
      const hadLong = before.slice(0, n - 2).some((w) => w.km >= (keep?.km ?? 26));
      if (!hadLong || weeksLeft < (keep?.minWeeksToRace ?? 4)) continue;
      checked += 1;
      const future = after.filter((w) => w.start > today && w.index <= n - 3);
      if (!future.some((w) => w.km >= (keep?.km ?? 26) - 0.25))
        bad.push(
          `${name(s.no)} najduži dugi posle prekida ${String(Math.max(0, ...future.map((w) => w.km)))} km`
        );
      /* R19 (odluka organizatora): rast se meri od većeg od prethodnog i referentnog dugog pre pauze (drugi dugi
         povratka = referentni) */
      const refLong = Math.max(
        0,
        ...((r.after.header.adjustments ?? []) as any[])
          .filter((a) => a.kind === 'pause' && a.refWeekKm !== undefined)
          .map((a) => (a.lastLongSec as number | undefined) ?? 0)
      );
      let prev = refLong;
      for (const w of future) {
        if (w.sec <= 0) continue;
        if (prev > 0 && w.sec > prev + 20 * 60 + 60)
          bad.push(
            `${name(s.no)} n${String(w.index)} dugi +${String(Math.round((w.sec - prev) / 60))} min`
          );
        prev = Math.max(prev, w.sec);
      }
    }
    expect(checked).toBeGreaterThan(0);
    expect(bad).toEqual([]);
  });

  it('afterLongRace (E5): posle polumaratona dve nedelje dugi ≤ 60 % planiranog, nedelja ≤ 75 % polaznog obima', () => {
    const rule = marathon.safety.afterLongRace;
    expect(rule).toEqual({ minEffortSec: 4500, weeks: 2, longShare: 0.6, weekShare: 0.75 });
    const bad: string[] = [];
    for (const { s, r } of RUNS.filter(
      ({ s }) => s.title.startsWith('E5') && s.title.includes('polumaraton')
    )) {
      const before = kmOfLongs(r.before as PlanDoc);
      const after = kmOfLongs(r.after as PlanDoc);
      const base = (r.afterState.profile?.weeklyKm as number | undefined) ?? 0;
      const ctx = paceCtxOf((r.after as PlanDoc).header);
      for (let i = 0; i < (rule?.weeks ?? 2); i += 1) {
        const a = after[i];
        const b = before[i];
        if (a === undefined || b === undefined) continue;
        if (b.sec > 0 && a.sec > (rule?.longShare ?? 0.6) * b.sec + 120)
          bad.push(
            `${name(s.no)} n${String(i + 1)} dugi ${String(Math.round(a.sec / 60))} od ${String(Math.round(b.sec / 60))} min`
          );
        const week = (r.after as PlanDoc).weeks[i];
        const km = (week?.days ?? []).reduce(
          (sum, d) =>
            sum +
            (d.workout === null || d.workout.kind === 'race' ? 0 : summarize(d.workout, ctx).km),
          0
        );
        if (base > 0 && km > (rule?.weekShare ?? 0.75) * base + 1)
          bad.push(
            `${name(s.no)} n${String(i + 1)} nedelja ${km.toFixed(1)} od ${String(base)} km`
          );
      }
    }
    expect(bad).toEqual([]);
  });
});

import { describe, expect, it } from 'vitest';
import {
  emptyImportState,
  runIcu,
  runStrava,
  steady,
  type IcuWorld,
  type StravaWorld
} from '@/test/importScenario';
import type { IcuActivity } from '../../../../activities';
import type { IsoDate } from '../../../../date';
import { resolvePlan } from '../../../../plan';
import type { GenPlanState } from '../../../../state';
import type { ImportState } from '../../../../../services/strava/stravaSync';
import { syncSources } from '../../../../../stores/fiveKV2Actions';
import type { StructuredPlanInput } from '../../../contract';
import { fiveKV2AdaptPreview, generateFiveKV2Plan } from '../../../select';
import { v2Of } from './adapt';
import { buildFacts } from './facts';

/* SEGMENT 08c — tačnost činjenica iz uvoza. Rizik 1: trčanje van plana (dan odmora) se uvozi kao zapis van plana i ulazi
   u činjenice (nema lažne pauze ni manjka); ponovljena sinhronizacija ne pravi duplikat. Rizik 2: `fullSync` se pomera
   samo kad je sve preuzeto i obrađeno (icu detalji, Strava tokovi); pokrivenost čita samo njega. */

const INPUT: StructuredPlanInput = {
  startDate: '2026-11-02',
  raceDate: '2027-01-10',
  runDays: ['tue', 'thu', 'sat', 'sun'],
  currentWeeklyKm: 25,
  recentResult: { distanceM: 5000, timeSec: 1500, date: '2026-10-20' },
  goalTimeSec: 1440
};
const TODAY = '2026-11-15'; // nedelja; 2. nedelja plana: 11-09 – 11-15
const NOW = Date.UTC(2026, 10, 15, 9);
const DAY_MS = 864e5;
const REST_RUNS = ['2026-11-09', '2026-11-11', '2026-11-13']; // pon, sre, pet — dani odmora (plan: uto, čet, sub, ned)
const STRAVA_LINK = { access: 'a', refresh: 'r', expiresAt: 99999999999, lastSync: 0 };
const ICU_LINK = { athleteId: 'i77', apiKey: 'k', lastSync: null };

function planOf(): GenPlanState {
  const r = generateFiveKV2Plan(INPUT);
  if (!r.ok) throw new Error(JSON.stringify(r.reasons));
  return r.plan;
}
const view = (p: GenPlanState) => resolvePlan(p.weeks, { alts: {}, moves: {} });
const plannedKm = (p: GenPlanState, from: string, to: string): number =>
  view(p)
    .dated.filter((d) => !d.rest && d.date >= from && d.date <= to)
    .reduce((s, d) => s + (d.km ?? 0), 0);

interface Run {
  id: number;
  date: string;
  km: number;
}
/** Nedelja 1 po planu (dani plana), nedelja 2 samo na dane odmora (isti obim). */
function runs(p: GenPlanState, opts: { week2?: boolean } = {}): Run[] {
  const out: Run[] = [];
  let id = 700;
  for (const d of view(p).dated)
    if (!d.rest && d.date <= '2026-11-08') out.push({ id: id++, date: d.date, km: d.km ?? 5 });
  if (opts.week2 !== false) {
    const each = Math.round((plannedKm(p, '2026-11-09', TODAY) / 3) * 100) / 100;
    for (const date of REST_RUNS) out.push({ id: id++, date, km: each });
  }
  return out;
}
function stravaWorld(list: readonly Run[]): StravaWorld {
  const w: StravaWorld = { acts: [], streams: {}, laps: {}, failing: new Set() };
  for (const r of list) {
    w.acts.push({
      id: r.id,
      name: `Trčanje ${r.id}`,
      type: 'Run',
      sport_type: 'Run',
      start_date_local: `${r.date}T07:00:00Z`,
      distance: Math.round(r.km * 1000),
      moving_time: Math.round(r.km * 360)
    });
    w.streams[String(r.id)] = steady(Math.max(1, Math.round(r.km)), 360);
  }
  return w;
}
function icuWorld(list: readonly Run[]): IcuWorld {
  const w: IcuWorld = { activities: [], details: {}, streams: {} };
  for (const r of list) {
    const id = `i${r.id}`;
    const a: IcuActivity = {
      id,
      datum: r.date,
      sat: 7,
      tip: 'Run',
      km: r.km,
      sec: Math.round(r.km * 360)
    };
    w.activities.push(a);
    w.details[id] = { rounds: [], groups: [] };
    w.streams[id] = steady(Math.max(1, Math.round(r.km)), 360);
  }
  return w;
}

function preview(
  p: GenPlanState,
  st: ImportState,
  sync: ReturnType<typeof syncSources>,
  confirmedDays: number | null = null
) {
  const facts = {
    outOfPlan: st.vanPlana,
    ...(st.vanPlanaV2 ? { offPlanRuns: st.vanPlanaV2 } : {}),
    sync,
    confirmedDays
  };
  const r = fiveKV2AdaptPreview(p, TODAY as IsoDate, { log: st.log, alts: {}, moves: {}, facts });
  if (!r.ok) throw new Error(JSON.stringify(r));
  const built = buildFacts(
    { today: TODAY as IsoDate, plan: p, log: st.log, ...facts, alts: {}, moves: {} },
    v2Of(p)!
  );
  return { ...r, built, conditions: r.reasons.filter((x) => x.applied).map((x) => x.condition) };
}

describe('08c rizik 1: trčanje van plana (dan odmora) iz uvoza → zapis van plana → činjenice', () => {
  it('Strava: tri trčanja na dane odmora → zapisi van plana; nema PAUSE ni UNDER_EXECUTION; km = upareni + van plana', async () => {
    const p = planOf();
    const s = await runStrava(emptyImportState(p), stravaWorld(runs(p)), STRAVA_LINK, {
      now: NOW,
      today: TODAY
    });
    expect(s.result).toMatchObject({ ok: true });
    const off = Object.values(s.state.vanPlanaV2 ?? {}).sort((a, b) =>
      a.date.localeCompare(b.date)
    );
    expect(off.map((r) => r.date)).toEqual(REST_RUNS);
    expect(off[0]?.src).toBe('strava');
    expect(typeof off[0]?.id).toBe('string');
    expect(off.every((r) => r.km > 0 && (r.sec ?? 0) > 0)).toBe(true);
    expect(s.link['fullSync']).toBe(NOW);
    expect(s.link['syncIssues']).toEqual([]);
    const pv = preview(p, s.state, syncSources(s.link, null));
    expect(pv.coverage).toMatchObject({ complete: true, basis: 'sync', source: 'strava' });
    for (const date of REST_RUNS)
      expect(pv.built.facts.workouts).toContainEqual(
        expect.objectContaining({ date, completed: true })
      );
    expect(
      pv.built.facts.workouts.filter((w) => REST_RUNS.includes(w.date)).every((w) => !w.dayId)
    ).toBe(true);
    const week2 = pv.built.facts.workouts
      .filter((w) => w.date >= '2026-11-09' && w.date <= TODAY)
      .reduce((a, w) => a + w.km, 0);
    expect(week2).toBeCloseTo(plannedKm(p, '2026-11-09', TODAY), 1);
    expect(pv.conditions).not.toContain('PAUSE');
    expect(pv.conditions).not.toContain('UNDER_EXECUTION');
  });

  it('intervals.icu: isto — zapisi van plana, nema PAUSE ni UNDER_EXECUTION', async () => {
    const p = planOf();
    const s = await runIcu(emptyImportState(p), icuWorld(runs(p)), ICU_LINK, {
      now: NOW,
      today: TODAY
    });
    expect(s.result).toMatchObject({ ok: true });
    const off = Object.values(s.state.vanPlanaV2 ?? {}).sort((a, b) =>
      a.date.localeCompare(b.date)
    );
    expect(off.map((r) => [r.date, r.src])).toEqual(REST_RUNS.map((d) => [d, 'icu']));
    expect(s.link['fullSync']).toBe(NOW);
    expect(s.link['trSync']).toBe(NOW);
    const pv = preview(p, s.state, syncSources(null, s.link));
    expect(pv.coverage).toMatchObject({ complete: true, basis: 'sync', source: 'icu' });
    expect(pv.conditions).not.toContain('PAUSE');
    expect(pv.conditions).not.toContain('UNDER_EXECUTION');
  });

  it('dupla sinhronizacija → jedan zapis po aktivnosti; dvostruki upload istog trčanja se ne broji', async () => {
    const p = planOf();
    const list = runs(p);
    const w = stravaWorld(list);
    const last = list.at(-1)!;
    w.acts.push({ ...(w.acts.at(-1) as object), id: 999 }); // isti trening drugi put (sat + telefon)
    w.streams['999'] = w.streams[String(last.id)];
    const o = { now: NOW, today: TODAY };
    const a = await runStrava(emptyImportState(p), w, STRAVA_LINK, o);
    const b = await runStrava(a.state, w, a.link, { ...o, now: NOW + 60_000 });
    expect(Object.keys(a.state.vanPlanaV2 ?? {})).toHaveLength(3);
    expect(b.state.vanPlanaV2).toEqual(a.state.vanPlanaV2);
    const icu = icuWorld(list);
    const c = await runIcu(emptyImportState(p), icu, ICU_LINK, o);
    const d = await runIcu(c.state, icu, c.link, o);
    expect(Object.keys(d.state.vanPlanaV2 ?? {})).toHaveLength(3);
    expect(d.state.vanPlanaV2).toEqual(c.state.vanPlanaV2);
    // Isti trkač, posle Strave povučen kroz intervals.icu (ceo spisak): zapisi perioda su iz icu, ne zbir oba izvora.
    const e = await runIcu(b.state, icu, ICU_LINK, o);
    expect(Object.values(e.state.vanPlanaV2 ?? {}).map((r) => r.src)).toEqual([
      'icu',
      'icu',
      'icu'
    ]);
    const pv = preview(p, e.state, syncSources(null, e.link));
    expect(pv.built.facts.workouts.filter((x) => REST_RUNS.includes(x.date))).toHaveLength(3);
  });

  it('zapis se uklanja kad trčanje postane upareno (odmor pretvoren u trening) ili kad ga izvor više nema', async () => {
    const p = planOf();
    const list = runs(p);
    const o = { now: NOW, today: TODAY };
    const a = await runStrava(emptyImportState(p), stravaWorld(list), STRAVA_LINK, o);
    const restDay = view(p).dated.find((d) => d.date === REST_RUNS[0])!;
    const withAlt: ImportState = {
      ...a.state,
      alts: {
        [restDay.id]: { tag: 'lako', km: 5, desc: 'Lako', pace: null, rw: null, paceAuto: false }
      }
    };
    const b = await runStrava(withAlt, stravaWorld(list), a.link, o);
    expect(Object.values(b.state.vanPlanaV2 ?? {}).map((r) => r.date)).toEqual(REST_RUNS.slice(1));
    expect(b.state.log[restDay.id]).toMatchObject({ status: 'done', src: 'strava' });
    const c = await runStrava(a.state, stravaWorld(list.slice(0, -1)), a.link, o); // poslednje obrisano na Stravi
    expect(Object.values(c.state.vanPlanaV2 ?? {}).map((r) => r.date)).toEqual(
      REST_RUNS.slice(0, 2)
    );
  });

  it('aktivnost koja nije obrađena (bez tipa; bez km i trajanja) → dan nepoznat, razlog u napomenama; fullSync stoji', async () => {
    const p = planOf();
    const w = stravaWorld(runs(p));
    w.acts.push(
      {
        id: 801,
        type: null,
        sport_type: null,
        start_date_local: '2026-11-12T18:00:00Z',
        distance: 4000,
        moving_time: 1500
      },
      {
        id: 802,
        type: 'Run',
        sport_type: 'Run',
        start_date_local: '2026-11-10T18:00:00Z',
        distance: 0,
        moving_time: 0
      }
    );
    const s = await runStrava(
      emptyImportState(p),
      w,
      { ...STRAVA_LINK, fullSync: NOW - 2 * DAY_MS },
      {
        now: NOW,
        today: TODAY
      }
    );
    expect(s.link['lastSync']).toBe(NOW);
    expect(s.link['fullSync']).toBe(NOW - 2 * DAY_MS);
    expect(s.link['syncIssues']).toEqual([
      { date: '2026-11-12', id: '801', reason: 'nepoznat tip aktivnosti' },
      { date: '2026-11-10', id: '802', reason: 'trčanje bez km i trajanja' }
    ]);
    // Bez potpune sinhronizacije danas: nepotpuno.
    const none = preview(p, s.state, syncSources(s.link, null));
    expect(none.coverage).toMatchObject({ complete: false, basis: 'none' });
    expect(none.notes.join('\n')).toMatch(
      /aktivnost 801 \(2026-11-12\) nije obrađena — nepoznat tip aktivnosti/
    );
    // Uz potvrdu korisnika: dan neobrađene aktivnosti i raniji nisu poznati.
    const conf = preview(p, s.state, syncSources(s.link, null), 14);
    expect(conf.coverage).toMatchObject({
      complete: true,
      basis: 'confirmed',
      from: '2026-11-13',
      unprocessed: '2026-11-12'
    });
    expect(conf.conditions).not.toContain('PAUSE');
  });
});

describe('08c rizik 2: fullSync samo kad je sve preuzeto i obrađeno; pokrivenost čita samo njega', () => {
  /** Nedelja 1 po planu, nedelja 2 bez ijednog trčanja (prava pauza ako je zapis potpun). */
  const gap = (p: GenPlanState) => runs(p, { week2: false });

  it('icu: spisak uspeo, detalji jedne aktivnosti pali → trSync se pomera, fullSync ne → complete=false → nema PAUSE', async () => {
    const p = planOf();
    const list = gap(p);
    const w = icuWorld(list);
    const quality = view(p).dated.find(
      (d) => (d.tag === 'int' || d.tag === 'tempo') && d.date <= '2026-11-08'
    )!;
    const failed = `i${list.find((r) => r.date === quality.date)!.id}`;
    w.details[failed] = null; // server: `greska` za taj trening
    const before = NOW - DAY_MS;
    const s = await runIcu(
      emptyImportState(p),
      w,
      { ...ICU_LINK, fullSync: before },
      { now: NOW, today: TODAY }
    );
    expect(s.result).toMatchObject({ ok: true });
    expect(s.link['trSync']).toBe(NOW); // isto značenje kao ranije
    expect(s.link['fullSync']).toBe(before); // delimičan uspeh ga ne pomera
    expect(s.link['syncIssues']).toEqual([
      { date: quality.date, id: failed, reason: 'detalji nisu preuzeti (greška izvora)' }
    ]);
    const pv = preview(p, s.state, syncSources(null, s.link));
    expect(pv.coverage.complete).toBe(false);
    expect(pv.conditions).not.toContain('PAUSE');
    expect(pv.notes.join('\n')).toMatch(
      new RegExp(`aktivnost ${failed} \\(${quality.date}\\) nije obrađena`)
    );
    // Sledeća sinhronizacija uspe u celosti → fullSync danas → pauza je poznata.
    const ok = await runIcu(s.state, icuWorld(list), s.link, { now: NOW + 60_000, today: TODAY });
    expect(ok.link['fullSync']).toBe(NOW + 60_000);
    expect(preview(p, ok.state, syncSources(null, ok.link)).conditions).toContain('PAUSE');
  });

  it('icu: zahtev za tokove pao (ručno) → greška, trSync se pomera, fullSync ne', async () => {
    const p = planOf();
    const s = await runIcu(
      emptyImportState(p),
      { ...icuWorld(gap(p)), failStreams: true },
      ICU_LINK,
      { now: NOW, today: TODAY, manual: true }
    );
    expect(s.result).toMatchObject({ ok: false });
    expect(s.link['trSync']).toBe(NOW);
    expect(s.link['fullSync'] ?? null).toBeNull();
    expect(preview(p, s.state, syncSources(null, s.link)).coverage.complete).toBe(false);
  });

  it('Strava: tokovi jedne aktivnosti pali → lastSync se pomera, fullSync ne → complete=false → nema PAUSE', async () => {
    const p = planOf();
    const list = gap(p);
    const w = stravaWorld(list);
    const easy = view(p).dated.find(
      (d) => (d.tag === 'lako' || d.tag === 'lr') && d.date <= '2026-11-08'
    )!;
    const failed = list.find((r) => r.date === easy.date)!.id;
    w.failing.add(`/activities/${failed}/streams`);
    const s = await runStrava(emptyImportState(p), w, STRAVA_LINK, { now: NOW, today: TODAY });
    expect(s.result).toMatchObject({ ok: true });
    expect(s.link['lastSync']).toBe(NOW);
    expect(s.link['fullSync'] ?? null).toBeNull();
    expect(s.link['syncIssues']).toEqual([
      { date: easy.date, id: String(failed), reason: 'tokovi nisu preuzeti (Strava 500)' }
    ]);
    const pv = preview(p, s.state, syncSources(s.link, null));
    expect(pv.coverage.complete).toBe(false);
    expect(pv.conditions).not.toContain('PAUSE');
    const ok = await runStrava(s.state, stravaWorld(list), s.link, {
      now: NOW + 60_000,
      today: TODAY
    });
    expect(ok.link['fullSync']).toBe(NOW + 60_000);
    expect(preview(p, ok.state, syncSources(ok.link, null)).conditions).toContain('PAUSE');
  });

  it('Strava: aktivnost bez tokova (404, ručno uneta) je odgovor, ne neuspeh → fullSync se pomera', async () => {
    const p = planOf();
    const list = gap(p);
    const w = stravaWorld(list);
    const easy = view(p).dated.find(
      (d) => (d.tag === 'lako' || d.tag === 'lr') && d.date <= '2026-11-08'
    )!;
    delete w.streams[String(list.find((r) => r.date === easy.date)!.id)];
    const s = await runStrava(emptyImportState(p), w, STRAVA_LINK, { now: NOW, today: TODAY });
    expect(s.link['syncIssues']).toEqual([]);
    expect(s.link['fullSync']).toBe(NOW);
  });

  it('Strava: spisak duži od 400 (nije preuzet ceo) → fullSync se ne pomera', async () => {
    const p = planOf();
    const w = stravaWorld([]);
    for (let i = 0; i < 400; i++)
      w.acts.push({
        id: 20000 + i,
        type: 'Ride',
        sport_type: 'Ride',
        start_date_local: '2026-10-20T08:00:00Z',
        distance: 1000,
        moving_time: 300
      });
    const s = await runStrava(emptyImportState(p), w, STRAVA_LINK, { now: NOW, today: TODAY });
    expect(s.link['lastSync']).toBe(NOW);
    expect(s.link['fullSync'] ?? null).toBeNull();
    expect(s.link['syncIssues']).toEqual([
      { date: null, id: null, reason: 'spisak aktivnosti nije preuzet ceo (više od 400)' }
    ]);
    expect(preview(p, s.state, syncSources(s.link, null), 7).coverage).toMatchObject({
      complete: false,
      unprocessed: '?'
    });
  });
});

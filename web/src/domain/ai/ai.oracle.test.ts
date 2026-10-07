import { beforeAll, describe, expect, it } from 'vitest';
import { loadLegacyApp, type LegacyApp } from '@/test/legacyOracle';
import { addDays, type IsoDate } from '../date';
import { adaptGeneratedPlan } from '../plan/adapt';
import { resolvePlan } from '../plan/resolve';
import type { AltRecord, GenPlanState, LogEntry, WellnessRecord } from '../state';
import type { StoredPredRow } from '../training/adaptation';
import { generatePlan } from '@/test/legacyGenerator';
import { zoneSource } from '../zones';
import {
  AI_GIVE_UP_MS,
  AI_RETRY_MS,
  aiCardView,
  aiRemaining,
  aiSourceLabel,
  buildAiPayload,
  canAnalyze,
  goalContext,
  lapWord,
  parseAnalysis,
  remainingText
} from './index';

/* parity: aiPreostalo, plKrug, aiIzvor, aiMoze, aiTelo/aiKarta (stanja), mdToHtml, goalCtxText, aiPayload (app.js). `aiPayload` je UGOVOR
   sa api/analyze.js — oblik se poredi dubinski. */

const NOW = '2026-07-14T14:30:00Z';
const NOW_MS = new Date(NOW).getTime();
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const j = <T>(x: unknown): T => JSON.parse(JSON.stringify(x)) as T;
let legacy: LegacyApp;
beforeAll(async () => {
  legacy = await loadLegacyApp(NOW);
});
const ctx = (): Record<string, unknown> =>
  (legacy as unknown as { ctx: Record<string, unknown> }).ctx;
const esc = (s: string): string =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string
  );
const toHtml = (text: string): string =>
  parseAnalysis(text)
    .map(
      (p) =>
        `<p>${p
          .map((line) =>
            line.map((s) => (s.strong ? `<strong>${esc(s.text)}</strong>` : esc(s.text))).join('')
          )
          .join('<br>')}</p>`
    )
    .join('');

describe('AI analiza naspram starog koda', () => {
  it('tekst analize: isti pasusi, prelomi i bold; ništa iz teksta ne postaje oznaka', () => {
    const r = rng(3);
    const pieces = [
      '**bold**',
      'obično',
      '\n',
      '\n\n',
      '<b>x</b>',
      '& < > " \'',
      '**',
      '**a**b**c**',
      '* * *',
      'kraj'
    ];
    for (let i = 0; i < 400; i++) {
      let t = '';
      const n = 1 + Math.floor(r() * 9);
      for (let k = 0; k < n; k++)
        t += pieces[Math.floor(r() * pieces.length)] + (r() < 0.5 ? ' ' : '');
      ctx()['__t'] = t;
      expect(toHtml(t), JSON.stringify(t)).toBe(legacy.evalIn('mdToHtml(__t)'));
    }
    expect(parseAnalysis(null)).toEqual([]);
    expect(parseAnalysis('')).toEqual([]);
  });

  it('krug/kruga/krugova, ostatak analiza, vlasnik bez limita', () => {
    for (let n = 0; n <= 130; n++) {
      ctx()['__n'] = n;
      expect(lapWord(n)).toBe(legacy.evalIn('plKrug(__n)'));
    }
    for (const owner of [false, true])
      for (const count of [undefined, null, 0, 1, 2, 3, 7, '1']) {
        ctx()['__o'] = owner;
        ctx()['__l'] = { aiCount: count };
        legacy.evalIn('jeVlasnik=function(){return __o}; 0');
        const old = legacy.evalIn('aiPreostalo(__l)') as number;
        expect(aiRemaining({ aiCount: count }, owner), `${String(count)} ${owner}`).toBe(old);
      }
    expect(remainingText(1)).toBe('1 preostala');
    expect(remainingText(2)).toBe('2 preostale');
    expect(remainingText(5)).toBe('5 preostalih');
    expect(remainingText(Infinity)).toBe('bez ograničenja');
  });

  it('izvor podataka i uslov za analizu', () => {
    const r = rng(9);
    for (let i = 0; i < 200; i++) {
      const l: Record<string, unknown> = {};
      if (r() < 0.5) l['laps'] = Array.from({ length: Math.floor(r() * 25) }, () => ({}));
      if (r() < 0.5) l['perKm'] = Array.from({ length: Math.floor(r() * 15) }, () => ({}));
      if (r() < 0.4) l['lapsIzvor'] = 'icu';
      if (r() < 0.5) l['km'] = r() < 0.2 ? 0 : 8;
      if (r() < 0.5) l['sec'] = r() < 0.2 ? 0 : 2800;
      ctx()['__l'] = l;
      expect(aiSourceLabel(l)).toBe(legacy.evalIn('aiIzvor(__l)'));
      for (const tag of ['int', 'tempo', 'lako', 'lr', 'snaga', 'odmor', 'trka']) {
        ctx()['__d'] = { tag };
        expect(canAnalyze({ tag } as never, l), `${tag} ${JSON.stringify(l)}`).toBe(
          legacy.evalIn('aiMoze(__d,__l)')
        );
      }
    }
  });

  it('cilj za prompt: ciljno vreme, ambiciozan cilj, procena, samo ime', () => {
    const metas: Array<Record<string, unknown>> = [
      {},
      { raceName: 'Beogradski 10K' },
      { raceName: 'Test', goalSec: 1199 },
      { raceName: 'Test', goalSec: 1199, realno: false, predictedSec: 1262 },
      { raceName: 'Test', goalSec: 1199, realno: true, predictedSec: 1262 },
      { goalSec: 0 },
      { predictedSec: 2600 },
      { raceName: '', predictedSec: 5100, goalSec: null },
      { goalSec: 'x' }
    ];
    for (const m of metas) {
      ctx()['__m'] = m;
      legacy.evalIn('S.genPlan={meta:__m,weeks:[],pred:[]}; 0');
      expect(goalContext(m), JSON.stringify(m)).toBe(legacy.evalIn('goalCtxText()'));
    }
  });

  it('zahtev za model: isti oblik i vrednosti na planovima × nasumičnim zapisima (ugovor sa api/analyze.js)', () => {
    const r = rng(41);
    let payloads = 0;
    let withLaps = 0;
    let withZones = 0;
    let withTemp = 0;
    let withWellness = 0;
    let withWorkPace = 0;
    for (const [dist, sec, weeks, back, runDays] of [
      [10000, 2570, 14, 6, 5],
      [5000, 1237, 12, 5, 6]
    ] as const) {
      const start = addDays('2026-07-13' as IsoDate, -back * 7);
      const gen = adaptGeneratedPlan(
        generatePlan({
          startDate: start,
          raceDate: addDays(start, weeks * 7 + 3),
          raceDistM: dist,
          pb: { distM: dist, sec },
          weeklyKm: 45,
          runDays,
          quality: 2,
          intensity: 'std',
          trainedRecently: true
        })
      );
      if (!gen) throw new Error('adapt');
      for (let variant = 0; variant < 5; variant++) {
        const plan: GenPlanState = {
          ...gen,
          meta: {
            ...(gen.meta as Record<string, unknown>),
            ...(variant === 1 ? { goalSec: 1199 } : {}),
            ...(variant === 2 ? { goalSec: 1199, realno: false, predictedSec: 1262 } : {}),
            ...(variant === 3 ? { raceName: 'Lokalna trka' } : {})
          } as never
        };
        const base = resolvePlan(plan.weeks, { alts: {}, moves: {} });
        const alts: Record<string, AltRecord> = {};
        for (const d of base.dated)
          if (!d.rest && d.km && r() < 0.2)
            alts[d.id] = {
              tag: 'tempo',
              km: d.km,
              desc: 'Tempo 5 km @ 4:10',
              pace: 235,
              rw: null,
              paceAuto: false
            };
        const resolved = resolvePlan(plan.weeks, { alts, moves: {} });
        const predRows = (plan.pred ?? []).filter(
          (x): x is StoredPredRow => typeof x.id === 'string'
        );
        const log: Record<string, LogEntry> = {};
        const pred: Record<string, unknown> = {};
        for (const d of resolved.dated) {
          if (d.rest || d.date >= '2026-07-14') continue;
          const e: LogEntry = {
            status: 'done',
            km: d.km,
            sec: Math.round((d.km ?? 8) * 300),
            ts: d.date
          };
          if (r() < 0.8) e['hr'] = 150;
          if (r() < 0.4) e['rpe'] = 6;
          if (r() < 0.4) e['note'] = 'osećaj dobar';
          if (r() < 0.3) e['runDate'] = addDays(d.date, 1);
          if (r() < 0.3) e['stravaName'] = 'Jutarnje trčanje';
          if (r() < 0.3) e['stravaDesc'] = '4km @5:25 / 4km @5:00';
          if (r() < 0.5) e['maxHr'] = 178;
          if (r() < 0.5) e['temp'] = 27;
          if (r() < 0.4) e['decoupling'] = { n: 4.2 };
          if (r() < 0.5) {
            e['laps'] = Array.from({ length: 5 }, (_, i) => ({
              n: i + 1,
              distM: 1000,
              paceSec: 240 + i,
              avgHr: 160
            }));
            e['lapsIzvor'] = r() < 0.5 ? 'icu' : 'strava';
          }
          if (r() < 0.3) e['icuGrupe'] = [{ reps: 5, tempo: 240 }];
          if (r() < 0.4) e['perKm'] = [{ km: 1, paceSec: 330, v: 3 }];
          if (r() < 0.5)
            e['icu'] = {
              zonePuls: [100 + Math.floor(r() * 400), 900, 700, 300, 50, 0, 0],
              ...(r() < 0.7 ? { zoneGranice: [122, 141, 153, 165, 175, 185, 195] } : {}),
              osecaSe: 28
            };
          log[d.id] = e;
        }
        for (const row of predRows) if (r() < 0.6) pred[row.id] = 232;
        const wellness: Record<string, WellnessRecord> = {};
        for (let o = 1; o <= 60; o++)
          if (r() < 0.8)
            wellness[addDays('2026-07-14' as IsoDate, -o)] = {
              hrv: 50 + Math.floor(r() * 10),
              pulsUMiru: 50,
              sanH: 7
            } as unknown as WellnessRecord;
        const useForecast = r() < 0.6;
        const sati: Record<string, unknown> = {};
        if (useForecast)
          for (let o = -40; o <= 0; o++)
            for (let h = 0; h < 24; h++)
              sati[`${addDays('2026-07-14' as IsoDate, o)}T${String(h).padStart(2, '0')}`] = {
                temp: 21,
                osecaj: 23,
                vlaga: 50,
                vetar: 5,
                kisa: 0
              };
        const icuHr =
          r() < 0.5
            ? [
                { min: 1, max: 122 },
                { min: 123, max: 141 },
                { min: 142, max: 153 },
                { min: 154, max: 165 },
                { min: 166, max: 175 },
                { min: 176, max: 185 },
                { min: 186, max: null }
              ]
            : null;
        const stravaHr =
          r() < 0.5
            ? [
                { min: 0, max: 130 },
                { min: 131, max: 150 },
                { min: 151, max: null }
              ]
            : null;
        ctx()['__p'] = j(plan);
        ctx()['__l'] = j(log);
        ctx()['__pr'] = j(pred);
        ctx()['__a'] = j(alts);
        ctx()['__w'] = j(wellness);
        ctx()['__v'] = useForecast ? { at: 1, lat: 1, lon: 2, sati } : null;
        ctx()['__ic'] = icuHr ? { hrZones: icuHr } : null;
        ctx()['__st'] = stravaHr ? { hrZones: stravaHr } : null;
        legacy.evalIn(
          'S.genPlan=__p; S.alts=__a; S.moves={}; S.log=__l; S.pred=__pr; S.wellness=__w; S.vreme=__v; S.icu=__ic; S.strava=__st; S.ui.satTreninga=18; S.vdotLog=[]; setActivePlan(); rebuildDateIndex(); 0'
        );
        for (const d of resolved.dated) {
          const l = log[d.id];
          if (!l) continue;
          ctx()['__id'] = d.id;
          const old = j<unknown>(
            legacy.evalIn('aiPayload(DATED.find(x=>x.id===__id), S.log[__id])')
          );
          const mine = j<Record<string, unknown>>(
            buildAiPayload({
              day: d,
              log: l,
              plan: resolved,
              predRows,
              pred,
              alts,
              meta: plan.meta,
              currentZones: zoneSource(
                icuHr ? { hrZones: icuHr } : null,
                stravaHr ? { hrZones: stravaHr } : null
              ),
              wellness,
              forecast: useForecast ? { sati: sati as never } : null,
              trainingHour: 18
            })
          );
          expect(mine, `${dist} v${variant} ${d.id}`).toEqual(old);
          payloads++;
          const e = mine['entered'] as Record<string, unknown>;
          if (e['laps']) withLaps++;
          if (e['zoneUdeo']) withZones++;
          if (e['temp']) withTemp++;
          if (e['oporavak']) withWellness++;
          if (e['workPace']) withWorkPace++;
        }
      }
    }
    expect(payloads).toBeGreaterThan(300);
    expect(withLaps).toBeGreaterThan(100);
    expect(withZones).toBeGreaterThan(30);
    expect(withTemp).toBeGreaterThan(100);
    expect(withWellness).toBeGreaterThan(100);
    expect(withWorkPace).toBeGreaterThan(30);
  });

  it('stanje kartice: isto što stari kod bira (ponuda, u toku, zaglavljeno, gotovo, iscrpljeno)', () => {
    const r = rng(52);
    const seen = new Set<string>();
    const kindOf = (html: string): string => {
      if (!html) return 'hidden';
      if (html.includes('Analiza traje duže')) return 'running-stuck';
      if (html.includes('Nova analiza je u toku')) return 'running';
      if (html.includes('ai-row off')) return 'exhausted';
      if (html.includes('Analiziraj trening')) return 'offer';
      return 'done';
    };
    for (let i = 0; i < 400; i++) {
      const l: Record<string, unknown> = {};
      if (r() < 0.8) l['km'] = 8;
      if (r() < 0.8) l['sec'] = 2800;
      const t = r();
      if (t < 0.3) l['aiText'] = 'Dobro trčanje.';
      else if (t < 0.4) l['aiText'] = { nije: 'string' };
      else if (t < 0.45) l['aiText'] = '   ';
      if (r() < 0.2) l['aiGreska'] = 'Nije uspelo.';
      if (r() < 0.5) l['aiCount'] = Math.floor(r() * 4);
      const owner = r() < 0.15;
      const jobKind = r();
      if (jobKind < 0.3) l['aiPosao'] = { id: 'j1', at: NOW_MS - Math.floor(r() * 12 * 60e3) };
      const tag = ['int', 'tempo', 'lako', 'lr', 'snaga'][Math.floor(r() * 5)] as string;
      ctx()['__o'] = owner;
      ctx()['__l'] = j(l);
      ctx()['__d'] = { id: 'x1', tag, week: { w: 1 } };
      legacy.evalIn('jeVlasnik=function(){return __o}; S.log["x1"]=__l; 0');
      const html = legacy.evalIn('aiKarta(__d, S.log["x1"])') as string;
      const mine = aiCardView({ tag } as never, l, { isOwner: owner, now: NOW_MS });
      const expected = kindOf(html);
      const got = mine.kind === 'running' ? (mine.stuck ? 'running-stuck' : 'running') : mine.kind;
      expect(got, JSON.stringify({ l, owner, tag })).toBe(expected);
      seen.add(expected);
      if (mine.kind === 'offer' || mine.kind === 'done')
        expect(html).toContain(mine.remaining ? `${remainingText(mine.remaining)}` : 'ai-out');
    }
    expect([...seen].sort()).toEqual([
      'done',
      'exhausted',
      'hidden',
      'offer',
      'running',
      'running-stuck'
    ]);
    expect(AI_RETRY_MS).toBe(300000);
    expect(AI_GIVE_UP_MS).toBe(1800000);
  });
});

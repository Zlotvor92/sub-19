import { beforeAll, describe, expect, it } from 'vitest';
import { loadLegacyApp, type LegacyApp } from '@/test/legacyOracle';
import { normalize, parseValue, unesc } from '@/test/legacyHtml';
import { addDays, type IsoDate } from '../date';
import { adaptGeneratedPlan } from '../plan/adapt';
import { resolvePlan } from '../plan/resolve';
import type { GenPlanState, LogEntry } from '../state';
import type { StoredPredRow } from '../training/adaptation';
import { generatePlan } from '../training/generator/generatePlan';
import {
  sessionCompareCard,
  sessionSignature,
  type CompareContext,
  type CompareRow
} from './compare';

/* parity: sesijaPotpis, merenjaDana, isteSesije, napomenaTemp, karticaLaganaRanije, karticaIstaSesija (app.js). */

const NOW = '2026-07-14T14:30:00Z';
const TODAY = '2026-07-14';
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

function parseCard(html: string) {
  if (!html) return null;
  const title = unesc(/<span class="card-t">(.*?)<\/span>/.exec(html)?.[1] ?? '');
  const extra = unesc(/<span class="dhead-x">(.*?)<\/span>/.exec(html)?.[1] ?? '');
  const rows = [
    ...html.matchAll(
      /<div class="drow"><span class="l">(.*?)<\/span><span class="v">(.*?)<\/span><\/div>/g
    )
  ].map((m): CompareRow => {
    const l = m[1] as string;
    const sub = /<small>(.*?)<\/small>/.exec(l)?.[1];
    return {
      label: unesc(l.replace(/ ?<small>.*<\/small>/, '')),
      sub: sub ? unesc(sub) : null,
      parts: parseValue(m[2] as string)
    };
  });
  /* Stari kod spaja `nap.join(' ')` i sa praznim članom, pa napomena ume da završi razmakom; u HTML-u se ne vidi. */
  const note = unesc(/<div class="note-src">(.*?)<\/div>/.exec(html)?.[1] ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  return { title, extra, rows, note };
}

describe('„Ista sesija ranije" naspram starog koda', () => {
  it('potpis, merenja, filtriranje, sortiranje, razlike i napomene — na 3 plana × nasumične istorije', () => {
    const r = rng(77);
    let cards = 0;
    let easyCards = 0;
    let qualityCards = 0;
    let withGap = 0;
    let withDrift = 0;
    let withBothSources = 0;
    for (const [dist, sec, weeks, back, runDays] of [
      [10000, 2570, 14, 11, 5],
      [5000, 1237, 12, 10, 6],
      [21097.5, 5700, 18, 14, 5]
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
      const plan: GenPlanState = gen;
      const resolved = resolvePlan(plan.weeks, { alts: {}, moves: {} });
      const predRows = (plan.pred ?? []).filter(
        (x): x is StoredPredRow => typeof x.id === 'string'
      );
      for (let variant = 0; variant < 4; variant++) {
        const log: Record<string, LogEntry> = {};
        const pred: Record<string, unknown> = {};
        for (const d of resolved.dated) {
          if (d.rest || d.date >= TODAY || r() < 0.2) continue;
          const easy = d.tag === 'lako' || d.tag === 'lr';
          const e: LogEntry = { status: r() < 0.9 ? 'done' : 'skip' };
          e['km'] = d.km;
          e['sec'] = Math.round((d.km ?? 8) * (290 + r() * 60));
          if (r() < 0.85) e['hr'] = 140 + Math.floor(r() * 25);
          if (r() < 0.4) e['runDate'] = addDays(d.date, r() < 0.5 ? 0 : 1);
          if (r() < 0.6) e['decoupling'] = { n: -2 + Math.floor(r() * 120) / 10 };
          if (!easy && r() < 0.8) {
            const withGap = r() < 0.6;
            e['laps'] = Array.from({ length: 6 }, (_, i) => ({
              n: i + 1,
              distM: i === 0 || i === 5 ? 1500 : 1000,
              paceSec: i === 0 || i === 5 ? 340 : 232 + Math.floor(r() * 10),
              avgHr: r() < 0.9 ? 150 + Math.floor(r() * 25) : null,
              ...(withGap ? { gapSec: 230 + Math.floor(r() * 10) } : {})
            }));
          }
          if (r() < 0.2) e['temp'] = 20 + Math.floor(r() * 12);
          if (r() < 0.2) e['satTrk'] = 7;
          log[d.id] = e;
        }
        for (const row of predRows) if (r() < 0.6) pred[row.id] = 225 + Math.floor(r() * 25);
        const useForecast = variant % 2 === 1;
        const sati: Record<string, unknown> = {};
        if (useForecast)
          for (let off = -14; off <= 0; off++)
            for (let h = 0; h < 24; h++)
              sati[`${addDays(TODAY as IsoDate, off)}T${String(h).padStart(2, '0')}`] = {
                temp: 22 + (h % 9),
                osecaj: 24 + (h % 9),
                vlaga: 50,
                vetar: 5,
                kisa: 0
              };
        const forecast = useForecast ? { at: 1, lat: 1, lon: 2, sati } : null;
        ctx()['__p'] = j(plan);
        ctx()['__l'] = j(log);
        ctx()['__pr'] = j(pred);
        ctx()['__v'] = forecast;
        legacy.evalIn(
          'S.genPlan=__p; S.alts={}; S.moves={}; S.log=__l; S.pred=__pr; S.vreme=__v; S.ui.satTreninga=18; S.vdotLog=[]; setActivePlan(); rebuildDateIndex(); 0'
        );
        const cctx: CompareContext = {
          dated: resolved.dated,
          weeks: resolved.weeks,
          log,
          pred,
          predRows,
          alts: {},
          qs: plan.qs,
          forecast: forecast ? { sati: sati as never } : null,
          trainingHour: 18
        };
        for (const d of resolved.dated) {
          if (d.rest) continue;
          ctx()['__id'] = d.id;
          expect(sessionSignature(d, cctx), d.id).toBe(
            legacy.evalIn('sesijaPotpis(DATED.find(x=>x.id===__id))')
          );
          const html = legacy.evalIn('karticaIstaSesija(DATED.find(x=>x.id===__id))') as string;
          const old = parseCard(html);
          const mine = sessionCompareCard(d, cctx);
          const norm = mine && {
            ...mine,
            note: mine.note.replace(/\s+/g, ' ').trim(),
            rows: mine.rows.map((x) => ({ ...x, ...normalize([x])[0] }))
          };
          const oldNorm = old && {
            ...old,
            rows: old.rows.map((x) => ({ ...x, ...normalize([x])[0] }))
          };
          expect(norm, `${dist} v${variant} ${d.id}`).toEqual(oldNorm);
          if (mine) {
            cards++;
            if (mine.title === 'Slično lagano ranije') easyCards++;
            else qualityCards++;
            if (mine.rows.some((x) => x.parts.some((p) => p.text.startsWith('GAP')))) withGap++;
            if (mine.rows.some((x) => x.parts.some((p) => p.tag === 'sec'))) withDrift++;
            if (mine.note.includes('ne porede međusobno')) withBothSources++;
          }
        }
      }
    }
    expect(cards).toBeGreaterThan(80);
    expect(easyCards).toBeGreaterThan(30);
    expect(qualityCards).toBeGreaterThan(15);
    expect(withGap).toBeGreaterThan(3);
    expect(withDrift).toBeGreaterThan(10);
    expect(withBothSources).toBeGreaterThan(0);
  });
});

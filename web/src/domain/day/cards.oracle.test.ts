import { beforeAll, describe, expect, it } from 'vitest';
import { loadLegacyApp, type LegacyApp } from '@/test/legacyOracle';
import type { WellnessRecord } from '../state';
import { zoneSource } from '../zones';
import { morningRows, watchRows, zonesCard, type CardRow, type RichPart } from './cards';

/* parity: metrikaSata, oporavakRedovi, karticaZona, zoneRazlog (app.js). Stari kod vraća HTML; poredi se strukturno. */

const NOW = '2026-07-14T14:30:00Z';
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

const unesc = (t: string): string =>
  t
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
const TONES: Record<string, string> = {
  'var(--green)': 'green',
  'var(--amber)': 'amber',
  'var(--red)': 'red',
  'var(--txt2)': 'neutral'
};

/** `<b style="color:var(--red)">x</b> spm <small>y</small>` → delovi; susedni goli tekstovi se spajaju. */
function parseValue(html: string): RichPart[] {
  const out: RichPart[] = [];
  const push = (p: RichPart): void => {
    const last = out[out.length - 1];
    if (p.tag === 'text' && last?.tag === 'text') last.text += p.text;
    else out.push(p);
  };
  let rest = html;
  const re = /^<(b|small)(?: style="color:([^"]+)")?>(.*?)<\/\1>/;
  while (rest) {
    const m = re.exec(rest);
    if (m) {
      const tone = m[2] ? TONES[m[2]] : undefined;
      push({
        tag: m[1] as 'b' | 'small',
        text: unesc(m[3] as string),
        ...(tone ? { tone: tone as never } : {})
      });
      rest = rest.slice(m[0].length);
    } else {
      const next = rest.indexOf('<');
      const chunk = next === -1 ? rest : rest.slice(0, next === 0 ? 1 : next);
      push({ tag: 'text', text: unesc(chunk) });
      rest = rest.slice(chunk.length);
    }
  }
  return out;
}
const normalize = (rows: CardRow[]): CardRow[] =>
  rows.map((r) => ({
    label: r.label,
    parts: r.parts.reduce<RichPart[]>((acc, p) => {
      const last = acc[acc.length - 1];
      if (p.tag === 'text' && last?.tag === 'text') last.text += p.text;
      else acc.push({ ...p });
      return acc;
    }, [])
  }));

describe('„Sa sata" naspram starog koda', () => {
  it('redovi, oznaka zone, temperatura sa izvorom i drift — na nasumičnim zapisima', () => {
    const r = rng(5);
    const zonesPool = [
      null,
      [
        { min: 0, max: 130 },
        { min: 131, max: 150 },
        { min: 151, max: 165 },
        { min: 166, max: 178 },
        { min: 179, max: null }
      ],
      [
        { min: 1, max: 122 },
        { min: 123, max: null }
      ]
    ];
    let withZone = 0;
    let withDrift = 0;
    let withOm = 0;
    let total = 0;
    for (let i = 0; i < 300; i++) {
      const log: Record<string, unknown> = {};
      const pickVal = (): unknown => {
        const x = r();
        return x < 0.15
          ? null
          : x < 0.25
            ? ''
            : x < 0.3
              ? 'x'
              : x < 0.35
                ? true
                : x < 0.45
                  ? String(Math.floor(r() * 100))
                  : r() < 0.2
                    ? 0
                    : -3 + Math.floor(r() * 2000) / 10;
      };
      if (r() < 0.8) log['cadence'] = pickVal();
      if (r() < 0.8) log['maxHr'] = r() < 0.7 ? 120 + Math.floor(r() * 70) : pickVal();
      if (r() < 0.7) log['elevGain'] = pickVal();
      if (r() < 0.5) log['relEffort'] = pickVal();
      if (r() < 0.5) log['temp'] = 18 + Math.floor(r() * 220) / 10;
      if (r() < 0.3) log['icu'] = { osecaSe: 20 + Math.floor(r() * 150) / 10 };
      if (r() < 0.7) log['satTrk'] = Math.floor(r() * 24);
      if (r() < 0.7) log['sec'] = Math.floor(r() * 8000);
      const d = r();
      if (d < 0.4) log['decoupling'] = { n: -4 + Math.floor(r() * 160) / 10 };
      else if (d < 0.55)
        log['decoupling'] = { n: null, razlog: 'Tempo nije bio ravnomeran (±3 %).' };
      else if (d < 0.6) log['decoupling'] = { n: 'x' };
      const zones = zonesPool[Math.floor(r() * zonesPool.length)] as unknown;
      const icuHr = r() < 0.4 ? (zonesPool[1] as unknown) : null;
      const useForecast = r() < 0.6;
      const trainingHr = Math.floor(r() * 24);
      const date = '2026-07-12';
      const sati: Record<string, unknown> = {};
      if (useForecast)
        for (let h = 0; h < 24; h++)
          sati[`${date}T${String(h).padStart(2, '0')}`] = {
            temp: 25 + (h % 7),
            osecaj: 27 + (h % 5),
            vlaga: 40,
            vetar: 5,
            kisa: 0
          };
      ctx()['__l'] = j(log);
      ctx()['__d'] = date;
      ctx()['__z'] = zones;
      ctx()['__iz'] = icuHr;
      ctx()['__v'] = useForecast ? { at: 1, lat: 1, lon: 2, sati } : null;
      ctx()['__s'] = trainingHr;
      legacy.evalIn(
        'S.strava=__z?{hrZones:__z}:null; S.icu=__iz?{hrZones:__iz}:null; S.vreme=__v; S.ui.satTreninga=__s; 0'
      );
      const old = (legacy.evalIn('metrikaSata(__l,__d)') as Array<[string, string]>).map(
        ([label, html]): CardRow => ({ label, parts: parseValue(html) })
      );
      const mine = watchRows(log, date, {
        zones: zoneSource(icuHr ? { hrZones: icuHr } : null, zones ? { hrZones: zones } : null),
        forecast: useForecast ? { sati: sati as never } : null,
        trainingHour: trainingHr
      });
      expect(normalize(mine), JSON.stringify(log)).toEqual(normalize(old));
      total += mine.length;
      if (mine.some((x) => x.parts.some((p) => /^Z\d/.test(p.text)))) withZone++;
      if (mine.some((x) => x.label === 'drift pulsa')) withDrift++;
      if (mine.some((x) => x.parts.some((p) => p.text.startsWith('prognoza u')))) withOm++;
    }
    expect(total).toBeGreaterThan(600);
    expect(withZone).toBeGreaterThan(30);
    expect(withDrift).toBeGreaterThan(80);
    expect(withOm).toBeGreaterThan(20);
    expect(
      watchRows(null, '2026-07-12', {
        zones: { zones: null, source: null },
        forecast: null,
        trainingHour: 18
      })
    ).toEqual([]);
  });
});

describe('„Jutros" naspram starog koda', () => {
  it('HRV/puls/san/svežina sa osnovom iz prethodnih dana', () => {
    const r = rng(8);
    let rowsTotal = 0;
    for (let i = 0; i < 80; i++) {
      const w: Record<string, WellnessRecord> = {};
      for (let d = 1; d <= 14; d++) {
        if (r() < 0.2) continue;
        const rec: Record<string, unknown> = {};
        if (r() < 0.9) rec['hrv'] = 40 + Math.floor(r() * 400) / 10;
        if (r() < 0.9) rec['pulsUMiru'] = 44 + Math.floor(r() * 120) / 10;
        if (r() < 0.8) rec['sanH'] = Math.floor(r() * 100) / 10 + 4;
        if (r() < 0.6) rec['svezina'] = -20 + Math.floor(r() * 400) / 10;
        w[`2026-07-${String(d).padStart(2, '0')}`] = rec as unknown as WellnessRecord;
      }
      ctx()['__w'] = j(w);
      legacy.evalIn('S.wellness=__w; 0');
      for (const date of ['2026-07-05', '2026-07-10', '2026-07-14', '2026-07-20']) {
        ctx()['__d'] = date;
        const old = (legacy.evalIn('oporavakRedovi(__d)') as Array<[string, string]>).map(
          ([label, html]): CardRow => ({ label, parts: parseValue(html) })
        );
        const mine = morningRows(w, date);
        expect(normalize(mine), `${i} ${date}`).toEqual(normalize(old));
        rowsTotal += mine.length;
      }
    }
    expect(rowsTotal).toBeGreaterThan(200);
  });
});

/** HTML kartice „Po zonama" → model. */
function parseZonesCard(html: string) {
  if (!html) return null;
  const extra = unesc(/<span class="dhead-x">(.*?)<\/span>/.exec(html)?.[1] ?? '');
  const rows = [
    ...html.matchAll(
      /<div class="drow"><span class="l"><b>Z(\d+)<\/b>(?: <small>(.*?)<\/small>)?<\/span>.*?<b>(\d+) %<\/b> <small>(\d+) min<\/small><\/span><\/div>/g
    )
  ].map((m) => ({
    n: +(m[1] as string),
    name: m[2] ? unesc(m[2]) : null,
    pct: +(m[3] as string),
    minutes: +(m[4] as string)
  }));
  const reason = /<div class="note-src" style="margin:0">(.*?)<\/div>/.exec(html)?.[1];
  if (reason !== undefined) return { extra, rows: [], reason: unesc(reason), note: '' };
  const note = unesc(/<div class="note-src">(.*?)<\/div>/.exec(html)?.[1] ?? '');
  return { extra, rows, reason: null, note };
}

describe('„Po zonama" naspram starog koda', () => {
  it('raspodela, granice iz aktivnosti ili podešavanja, i razlozi zašto je nema', () => {
    const r = rng(14);
    const seven = [122, 141, 153, 165, 175, 185, 195];
    const five = [130, 150, 165, 178, 190];
    const cfg = (up: number[]) =>
      up.map((x, i) => ({
        min: i === 0 ? 1 : (up[i - 1] as number) + 1,
        max: i === up.length - 1 ? null : x,
        ime: i === 2 ? 'Tempo' : null
      }));
    let shown = 0;
    let reasons = 0;
    let fromSettings = 0;
    let own = 0;
    for (let i = 0; i < 400; i++) {
      const log: Record<string, unknown> = {};
      const n = [5, 7, 7, 6][Math.floor(r() * 4)] as number;
      const icu: Record<string, unknown> = {};
      const x = r();
      if (x < 0.85)
        icu['zonePuls'] = Array.from({ length: n }, () =>
          r() < 0.1 ? null : Math.floor(r() * 1500)
        );
      if (r() < 0.5)
        icu['zoneGranice'] =
          r() < 0.85 ? (n === 5 ? five : n === 7 ? seven : seven.slice(0, 6)) : [10, 5];
      if (Object.keys(icu).length || r() < 0.3) log['icu'] = icu;
      if (r() < 0.12) log['lock'] = true;
      const connected = r() < 0.85;
      const settingsZones = r() < 0.5 ? (r() < 0.5 ? cfg(seven) : cfg(five)) : null;
      const stravaZones = r() < 0.3 ? cfg(five) : null;
      const zoneError = r() < 0.15 ? 'Zone nisu dostupne: 403.' : null;
      ctx()['__l'] = j(log);
      ctx()['__ic'] = connected
        ? { athleteId: 'i1', token: 't', hrZones: settingsZones, zoneGreska: zoneError }
        : settingsZones
          ? { hrZones: settingsZones, zoneGreska: zoneError }
          : null;
      ctx()['__st'] = stravaZones ? { hrZones: stravaZones } : null;
      legacy.evalIn('S.icu=__ic; S.strava=__st; 0');
      const old = parseZonesCard(legacy.evalIn('karticaZona(__l)') as string);
      const icuObj = ctx()['__ic'] as { hrZones?: unknown } | null;
      const mine = zonesCard(log, {
        current: zoneSource(icuObj, stravaZones ? { hrZones: stravaZones } : null),
        icuConnected: connected,
        zoneError: connected ? zoneError : zoneError
      });
      expect(mine, JSON.stringify(log)).toEqual(old);
      if (mine?.reason) reasons++;
      else if (mine) {
        shown++;
        if (mine.note.includes('Podešavanja → Tvoje zone pulsa')) fromSettings++;
        else own++;
      }
    }
    expect(shown).toBeGreaterThan(60);
    expect(reasons).toBeGreaterThan(30);
    expect(fromSettings).toBeGreaterThan(10);
    expect(own).toBeGreaterThan(10);
  });
});

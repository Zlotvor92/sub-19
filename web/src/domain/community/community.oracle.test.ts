import { beforeAll, describe, expect, it } from 'vitest';
import { loadLegacyApp, type LegacyApp } from '@/test/legacyOracle';
import { addDays, type IsoDate } from '../date';
import { effectiveRaceDate } from '../day';
import { fmtDayMonth } from '../format';
import { adaptGeneratedPlan } from '../plan/adapt';
import { resolvePlan } from '../plan/resolve';
import type { GenPlanState, LogEntry, T3kRecord, VdotRecord } from '../state';
import { currentVdot } from '../training/adaptation';
import { generatePlan } from '@/test/legacyGenerator';
import {
  MEASURES,
  avatarColor,
  challengeList,
  cleanProfile,
  communityPayload,
  displayName,
  goalBucket,
  initials,
  profileName,
  profileSubtitle,
  progressOf,
  reasonFromStatus,
  reasonMessage,
  safeImageUrl,
  toNum
} from './index';

/* parity: zajednicaPayload, zajIme, zajCilj, zajDoslednost, zajTrcanja, zajZnacke, uOpsegu, zajCistProfil, zajBr, zajSlikaUrl, zajBoja,
   zajInicijali, ZAJ_MERILA, zajRazlogIz/zajPoruka (app.js). */

const NOW = '2026-07-14T14:30:00Z';
const TODAY = '2026-07-14' as IsoDate;
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

describe('Zajednica naspram starog koda', () => {
  it('javni red (jedina tačka izlaska podataka): ista polja, opsezi, nadimak, slika, cilj, značke i trčanja', () => {
    const r = rng(29);
    let rows = 0;
    let withBadges = 0;
    let withRuns = 0;
    let nulls = 0;
    for (const [dist, sec, weeks, back, runDays] of [
      [10000, 2570, 14, 8, 5],
      [5000, 1237, 12, 6, 6],
      [21097.5, 5700, 18, 12, 5],
      [42195, 13500, 26, 15, 5]
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
      for (let variant = 0; variant < 8; variant++) {
        const log: Record<string, LogEntry> = {};
        const fill = [0, 0.3, 0.7, 1, 1, 0.9, 0.5, 1][variant] as number;
        for (const d of resolved.dated) {
          if (d.rest || d.date > TODAY || r() > fill) continue;
          const e: LogEntry = { status: 'done', ts: d.date };
          if (r() < 0.8) e['km'] = d.km;
          if (r() < 0.8) e['sec'] = Math.round((d.km ?? 8) * 300);
          if (r() < 0.2) e['note'] = 'ne sme izaći';
          if (r() < 0.2) e['hr'] = 155;
          log[d.id] = e;
        }
        const t3k: T3kRecord[] =
          variant % 2
            ? [
                { id: 't3k-1', date: addDays(TODAY, -30), sec: 700 },
                { id: 't3k-2', date: addDays(TODAY, -5), sec: 690 },
                { id: 't3k-3', date: addDays(TODAY, -4), sec: 100 }
              ]
            : [];
        const vdotLog: VdotRecord[] =
          variant % 3 === 0
            ? []
            : ([
                {
                  id: 'g1_0',
                  ts: addDays(TODAY, -40),
                  vdot: 46.04,
                  prev: 46,
                  delta: 0,
                  measured: 46
                },
                {
                  id: 'g1_1',
                  ts: addDays(TODAY, -10),
                  vdot: variant === 5 ? 99 : 47.46,
                  prev: 46,
                  delta: 1,
                  measured: 47
                }
              ] as VdotRecord[]);
        const nick = ['', 'X', 'Ab', 'Abc', '  Ana  ', 'a'.repeat(40), 'Marko', ''][
          variant
        ] as string;
        const gname = [null, 'Petar Petrović', '  ', 'Jelena'][variant % 4] as string | null;
        const picture = [
          'https://lh3.googleusercontent.com/a/ACg8oc=s96-c',
          'http://x.rs/a.png',
          null,
          ''
        ][variant % 4] as string | null;
        ctx()['__p'] = j(plan);
        ctx()['__l'] = j(log);
        ctx()['__t'] = j(t3k);
        ctx()['__v'] = j(vdotLog);
        ctx()['__n'] = nick;
        ctx()['__g'] = gname;
        ctx()['__pic'] = picture;
        legacy.evalIn(
          "S.genPlan=__p; S.alts={}; S.moves={}; S.log=__l; S.t3k=__t; S.vdotLog=__v; S.zajed={vidljiv:true,nadimak:__n}; SB.userId='u-1'; SB.ime=__g; SB.slika=__pic; setActivePlan(); rebuildDateIndex(); 0"
        );
        const old = j<Record<string, unknown>>(legacy.evalIn('zajednicaPayload()'));
        const meta = plan.meta as Record<string, unknown>;
        const mine = j<Record<string, unknown>>(
          communityPayload({
            userId: 'u-1',
            googleName: gname,
            picture,
            nickname: nick,
            plan: resolved,
            log,
            today: TODAY,
            vdotLog,
            t3k,
            currentVdot: currentVdot(vdotLog),
            raceDistM: (meta['raceDistM'] as number) || 5000,
            raceDate: effectiveRaceDate(resolved, meta['raceDate'])
          })
        );
        expect(mine, `${dist} v${variant}`).toEqual(old);
        rows++;
        if ((mine['znacke'] as string[]).length) withBadges++;
        if ((mine['trcanja'] as unknown[]).length) withRuns++;
        if (Object.values(mine).some((v) => v === null)) nulls++;
        expect(Object.keys(mine).sort()).toEqual(Object.keys(old).sort()); // nijedno polje više nego što je stari kod slao
      }
    }
    expect(rows).toBe(32);
    expect(withBadges).toBeGreaterThan(8);
    expect(withRuns).toBeGreaterThan(20);
    expect(nulls).toBeGreaterThan(8);
  });

  it('ime, cilj, slika, boja, inicijali, broj, razlozi', () => {
    for (const nick of ['', ' ', 'Ana', '  Marko  ', 'x'.repeat(40)])
      for (const g of [null, '', 'Petar Petrović', '  Jelena   Nikolić ', 'A'.repeat(40) + ' B']) {
        ctx()['__n'] = nick;
        ctx()['__g'] = g;
        legacy.evalIn('S.zajed={vidljiv:true,nadimak:__n}; SB.ime=__g; 0');
        expect(displayName(nick, g), `${nick}|${String(g)}`).toBe(legacy.evalIn('zajIme()'));
      }
    for (const m of [
      undefined,
      0,
      5000,
      7999,
      8000,
      10000,
      14999,
      15000,
      21097.5,
      29999,
      30000,
      42195
    ]) {
      ctx()['__m'] = m ?? null;
      legacy.evalIn('raceDistActive=function(){return __m}; 0');
      expect(goalBucket(m), String(m)).toBe(legacy.evalIn('zajCilj()'));
    }
    const urls = [
      'https://lh3.googleusercontent.com/a/ACg8ocKx=s96-c',
      'https://x.rs/a.png',
      'https://x.rs/a&#34;b',
      'https://x.rs/a#b',
      'http://x.rs/a.png',
      'https://x.rs',
      'javascript:alert(1)',
      null,
      5,
      'https://evil.com/a;position:fixed',
      'https://a.b/c d'
    ];
    for (const u of urls) {
      ctx()['__u'] = u;
      expect(safeImageUrl(u), String(u)).toBe(legacy.evalIn('zajSlikaUrl(__u)'));
    }
    for (const id of ['u-1', 'abc', '', null, undefined, '0403f8fb-a643-4d4e-843d-f71199a0d6f9']) {
      ctx()['__i'] = id ?? null;
      expect(avatarColor(id)).toBe(legacy.evalIn('zajBoja(__i)'));
    }
    for (const n of ['Marko', 'Ana Marija', ' x ', '', null, undefined, 'šđ čć', 'a b c']) {
      ctx()['__n'] = n ?? null;
      expect(initials(n)).toBe(legacy.evalIn('zajInicijali(__n)'));
    }
    for (const v of [
      null,
      undefined,
      '',
      0,
      5,
      '5',
      '5.5',
      'x',
      true,
      false,
      [],
      [42],
      {},
      NaN,
      Infinity,
      -3
    ]) {
      ctx()['__v'] = v ?? null;
      expect(toNum(v ?? null), JSON.stringify(v)).toBe(legacy.evalIn('zajBr(__v)'));
    }
    for (const s of [200, 400, 401, 403, 404, 429, 500, 503]) {
      ctx()['__s'] = s;
      const reason = legacy.evalIn('zajRazlogIz(__s)') as string;
      expect(reasonFromStatus(s)).toBe(reason);
      ctx()['__r'] = reason;
      expect(reasonMessage(reason)).toBe(legacy.evalIn('zajPoruka(__r)'));
    }
    for (const reason of ['mreza', 'server', 'nepoznato', null]) {
      ctx()['__r'] = reason;
      expect(reasonMessage(reason)).toBe(legacy.evalIn('zajPoruka(__r)'));
    }
  });

  it('čišćenje tuđeg profila i rang-liste (3 merila, izazov) na nasumičnim redovima', () => {
    const r = rng(77);
    const junk: unknown[] = [null, '', 'x', true, [], [42], {}, NaN, 12, '12', 85, -1, 1e9];
    const raw = Array.from({ length: 60 }, (_, i) => {
      const row: Record<string, unknown> = {
        user_id: i % 17 === 0 ? '' : `u${i}`,
        nadimak: r() < 0.8 ? `Trkač ${i}` : null,
        cilj: ['5K', '10K', '21K', '42K', null][i % 5],
        trka_datum: r() < 0.7 ? '2026-12-13' : null,
        znacke: r() < 0.8 ? ['Niz 7 dana'] : 'nije niz',
        trcanja: r() < 0.8 ? [{ d: '2026-07-01', t: 'Lako', o: '8 km', p: '5:30 /km' }] : null
      };
      for (const k of [
        'vdot',
        'vdot_pocetni',
        'test3k_sec',
        'km_nedelja',
        'plan_pct',
        'niz_dana',
        'izazov_od',
        'izazov_ura',
        'nedelja_br',
        'nedelja_od'
      ])
        row[k] =
          r() < 0.2
            ? junk[Math.floor(r() * junk.length)]
            : r() < 0.15
              ? null
              : Math.round(r() * 60 * 10) / 10 + (k === 'test3k_sec' ? 600 : 0);
      if (i === 3) return 'nije objekat';
      return row;
    });
    ctx()['__raw'] = raw;
    const old = j<unknown[]>(legacy.evalIn('zajCistiLjude(__raw)'));
    const mine = raw.map(cleanProfile).filter(Boolean);
    expect(j(mine)).toEqual(old);
    ctx()['__ljudi'] = old;
    legacy.evalIn('ZAJ.ljudi=__ljudi; 0');
    for (const M of MEASURES) {
      const idx = ['t3k', 'nap', 'dosl'].indexOf(M.key);
      for (const filter of ['sve', '5K', '10K', '21K', '42K']) {
        ctx()['__f'] = filter;
        ctx()['__mi'] = idx;
        legacy.evalIn('ZAJ.filter=__f; 0');
        const oldList = j<Array<{ user_id: string }>>(
          legacy.evalIn(
            'zajFiltrirani().slice().sort((a,b)=>ZAJ_MERILA[__mi][3](a)-ZAJ_MERILA[__mi][3](b))'
          )
        );
        const mineList = mine
          .filter((p) => p && (filter === 'sve' || p.cilj === filter))
          .slice()
          .sort((a, b) => M.sort(a as never) - M.sort(b as never));
        expect(
          mineList.map((p) => p?.user_id),
          `${M.key} ${filter}`
        ).toEqual(oldList.map((p) => p.user_id));
        for (const p of mineList) {
          ctx()['__pp'] = j(p);
          expect(M.value(p as never), `${M.key} ${p?.user_id}`).toBe(
            legacy.evalIn('ZAJ_MERILA[__mi][4](__pp)')
          );
        }
      }
    }
    for (const p of mine as NonNullable<ReturnType<typeof cleanProfile>>[]) {
      ctx()['__pp'] = j(p);
      expect(progressOf(p)).toBe(legacy.evalIn('zajNapredak(__pp)'));
      expect(profileName(p)).toBe(legacy.evalIn('zajPrikazIme(__pp)'));
      expect(profileSubtitle(p, fmtDayMonth)).toBe(
        legacy.evalIn(
          "[__pp.cilj||'—',(__pp.nedelja_br&&__pp.nedelja_od)?('nedelja '+__pp.nedelja_br+' / '+__pp.nedelja_od):null,__pp.trka_datum?('trka '+fmtD(__pp.trka_datum)):null].filter(Boolean).join(' · ')"
        )
      );
    }
    const ch = challengeList(mine as never);
    const oldCh = j<{ ids: string[]; gotovih: number }>(
      legacy.evalIn(
        "(function(){ZAJ.filter='sve';var svi=zajFiltrirani();var udeo=function(p){return (p.izazov_od>0?(p.izazov_ura||0)/p.izazov_od:0)};var l=svi.slice().filter(function(p){return p.izazov_od>0}).sort(function(a,b){return udeo(b)-udeo(a)});return {ids:l.map(function(p){return p.user_id}),gotovih:l.filter(function(p){return p.izazov_ura>=p.izazov_od}).length}})()"
      )
    );
    expect(ch.rows.map((p) => p.user_id)).toEqual(oldCh.ids);
    expect(ch.finished).toBe(oldCh.gotovih);
    expect(oldCh.ids.length).toBeGreaterThan(10);
  });
});

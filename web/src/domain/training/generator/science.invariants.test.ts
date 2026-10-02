/* NAUČNE INVARIJANTE GENERATORA — granice koje dolaze iz literature, ne iz kalibracije.

   generator.invariants.test.ts čuva STRUKTURNE invarijante (dugo trčanje je najduže, deload
   spušta, dan trke pada na datum). Ovde se čuva ono što plan mora da poštuje da bi bio trenerski
   ISPRAVAN: Danielsovi budžeti zona, dubina tapera, opterećenje po ACWR-u, definicija M zone.
   Svaka tvrdnja je pucala pre popravke starog generatora.

   Pragovi su namerno sa rezervom iznad izmerenog maksimuma: cilj je da uhvate REGRESIJU, ne da
   pucaju na svaku promenu kalibracije od pola procenta.

   „PODRŽANI OPSEG" = broj dana ≥ preporučenog i obim koji ta distanca traži. Ispod toga generator
   SAM upozorava da plan nije adekvatan, pa se tamo ne mere fiziološke granice.

   parity: test/nauka.test.mjs — svih 13 testova. */

import { describe, expect, it } from 'vitest';
import { addDays, parseIsoDate, type IsoDate } from '../../date';
import { profileFor } from '../distances';
import { sessQKm } from '../sessions/calc';
import type { Day, PlanGenerationInput, TrainingPlan, Week } from '../types';
import { paceForZone } from '../vdot/paceForZone';
import { raceTimeForVdot } from '../vdot/racePrediction';
import { vdotFromPace } from '../vdot/vdotFromPace';
import { generatePlan } from './generatePlan';

/** Ponedeljak — da nijedan dan nedelje 1 ne bude odsečen datumom početka. */
const START = parseIsoDate('2026-01-05') as IsoDate;
const raceIn = (weeks: number, dowOffset = 6): string => addDays(START, weeks * 7 + dowOffset - 6);

/** Čisto T-zona sesije. Rad na TEMPU TRKE se NAMERNO ne broji (sopstveni budžet). */
const STRICT_T = new Set(['Tempo', 'Tempo isprekidan', 'Progresivno']);
const kmOf = (d: Day): number => d.km || 0;
const weekKm = (w: Week): number => w.days.reduce((s, d) => s + kmOf(d), 0);
const lrKm = (w: Week): number =>
  Math.max(...w.days.filter((d) => (d.tag === 'lr' && !d.mlr) || d.tag === 'rw').map(kmOf), 0);

interface Prof {
  ime: string;
  distM: number;
  pb: number;
  minD: number;
  minKm: number;
  taperF: number;
}
const PROFILES: Prof[] = [
  { ime: '5K', distM: 5000, pb: 22 * 60, minD: 4, minKm: 25, taperF: 0.65 },
  { ime: '10K', distM: 10000, pb: 48 * 60, minD: 4, minKm: 30, taperF: 0.72 },
  { ime: 'HM', distM: 21097.5, pb: 100 * 60, minD: 4, minKm: 35, taperF: 0.75 },
  { ime: 'Maraton', distM: 42195, pb: 240 * 60, minD: 5, minKm: 40, taperF: 0.65 }
];

function gen(inp: PlanGenerationInput): TrainingPlan | { error: string } {
  return generatePlan(inp);
}

interface Case {
  p: TrainingPlan;
  opis: string;
}

/** Mreža PODRŽANOG opsega. Početnici su unutra: baš na prelazu iz bazne u kvalitetnu fazu su
 *  živele i greška budžeta praga i skok opterećenja. */
const supportedCache = new Map<string, Case[]>();
function supported(P: Prof): Case[] {
  const hit = supportedCache.get(P.ime);
  if (hit) return hit;
  const out: Case[] = [];
  for (const weeks of [12, 16, 20, 24])
    for (const weeklyKm of [P.minKm, P.minKm + 15, P.minKm + 30])
      for (const runDays of [P.minD, P.minD + 1, P.minD + 2].filter((d) => d <= 7))
        for (const quality of [1, 2])
          for (const intensity of ['kons', 'std', 'agr'] as const)
            for (const trainedRecently of [true, false]) {
              const p = gen({
                startDate: START,
                raceDate: raceIn(weeks),
                raceDistM: P.distM,
                pb: { distM: P.distM, sec: P.pb },
                weeklyKm,
                runDays,
                quality,
                intensity,
                trainedRecently
              });
              if ('error' in p) continue;
              out.push({
                p,
                opis: `${P.ime} ${weeks}ned ${weeklyKm}km ${runDays}d q${quality} ${intensity}${trainedRecently ? '' : ' početnik'}`
              });
            }
  supportedCache.set(P.ime, out);
  return out;
}

/** ŠIROKA mreža — i opseg koji generator sam označava neadekvatnim. Tu se mere GRUBI ispadi:
 *  plan sme da bude neadekvatan, ne sme da bude nakaradan. */
const wideCache = new Map<string, Case[]>();
function wide(P: Prof): Case[] {
  const hit = wideCache.get(P.ime);
  if (hit) return hit;
  const out: Case[] = [];
  for (const weeks of [12, 18, 24])
    for (const weeklyKm of [12, 30, 60])
      for (const runDays of [3, 4, 5, 6])
        for (const quality of [1, 2])
          for (const trainedRecently of [true, false]) {
            const p = gen({
              startDate: START,
              raceDate: addDays(START, weeks * 7),
              raceDistM: P.distM,
              pb: { distM: P.distM, sec: P.pb },
              weeklyKm,
              runDays,
              quality,
              intensity: 'std',
              trainedRecently
            });
            if ('error' in p) continue;
            out.push({
              p,
              opis: `${P.ime} ${weeks}ned ${weeklyKm}km ${runDays}d q${quality}${trainedRecently ? '' : ' početnik'}`
            });
          }
  wideCache.set(P.ime, out);
  return out;
}

function ok(inp: PlanGenerationInput): TrainingPlan {
  const p = generatePlan(inp);
  if ('error' in p) throw new Error(p.error);
  return p;
}

describe('Daniels — fiziološki motor', () => {
  it('predviđanje trke se poklapa sa objavljenom VDOT tabelom (±0,5%)', () => {
    /* Daniels' Running Formula, tabela VDOT→vreme trke. JEDINI test koji poredi sa SPOLJNIM
       izvorom — sve ostalo su interne invarijante. */
    const TABLE: Record<number, Record<number, number>> = {
      30: { 5000: 1840, 10000: 3826, 21097.5: 8464, 42195: 17357 },
      40: { 5000: 1448, 10000: 3003, 21097.5: 6659, 42195: 13785 },
      50: { 5000: 1197, 10000: 2481, 21097.5: 5495, 42195: 11449 },
      60: { 5000: 1023, 10000: 2122, 21097.5: 4689, 42195: 9805 }
    };
    for (const [vdot, row] of Object.entries(TABLE)) {
      for (const [distM, published] of Object.entries(row)) {
        const got = raceTimeForVdot(Number(vdot), Number(distM));
        const err = Math.abs(got - published) / published;
        expect(
          err,
          `VDOT ${vdot} na ${distM} m: tabela ${published} s, motor ${got} s`
        ).toBeLessThan(0.005);
      }
    }
  });

  it('M zona JESTE maratonski tempo trke (Danielsova definicija)', () => {
    /* Z.M=0.80 je M zonu aproksimirao procentom VO2max i grešio 3–6 s/km naniže; kod Danielsa
       je M tempo tempo maratonske trke za taj VDOT. */
    for (let vdot = 30; vdot <= 70; vdot += 2) {
      const zone = paceForZone(vdot, 'M');
      const race = raceTimeForVdot(vdot, 42195) / 42.195;
      expect(
        Math.abs(zone - race),
        `VDOT ${vdot}: M zona ${zone} vs ${race.toFixed(1)} s/km`
      ).toBeLessThanOrEqual(1);
    }
  });

  it('vdotFromPace je tačan inverz paceForZone na svim zonama (uklj. M)', () => {
    for (const zone of ['I', 'T', 'M', 'E', 'R'] as const) {
      for (let vdot = 32; vdot <= 68; vdot += 4) {
        const pace = paceForZone(vdot, zone);
        expect(paceForZone(vdotFromPace(pace, zone), zone), `zona ${zone}, VDOT ${vdot}`).toBe(
          pace
        );
      }
    }
  });
});

describe('Danielsovi budžeti zona', () => {
  it('nedeljni prag ne prelazi 10% + tolerancija diskretnosti', () => {
    for (const P of PROFILES) {
      let over = 0;
      let total = 0;
      for (const { p, opis } of supported(P)) {
        p.weeks.slice(0, -1).forEach((w) => {
          const vol = weekKm(w);
          if (vol < 5) return;
          let T = 0;
          w.days.forEach((d) => {
            if (d.session && STRICT_T.has(d.session.kind)) T += sessQKm(d.session);
          });
          if (T <= 0) return;
          total++;
          if (T / vol > 0.11) over++;
          /* Pojedinačni plafon: hvata ispad na jednoj nedelji. */
          expect(
            T / vol,
            `${opis} N${w.w}: prag ${T.toFixed(1)} od ${vol.toFixed(1)} km`
          ).toBeLessThanOrEqual(0.135);
        });
      }
      /* UDEO je ono što razlikuje ispravan generator od pokvarenog. */
      expect(
        over / total,
        `${P.ime}: ${over}/${total} nedelja preko 11% praga`
      ).toBeLessThanOrEqual(0.05);
    }
  });

  it('dugo trčanje ne pojede nedelju', () => {
    /* JOSPT: preko ~30% nedelje u jednom trčanju raste rizik povrede. Niskoobimni izuzetak do
       40–45% je NAMERNA trenerska odluka, pa prag hvata stvarni ispad. */
    for (const P of PROFILES) {
      for (const { p, opis } of wide(P)) {
        p.weeks.slice(0, -1).forEach((w) => {
          const vol = weekKm(w);
          const lr = lrKm(w);
          if (vol < 5 || lr <= 0) return;
          expect(
            lr / vol,
            `${opis} N${w.w}: LR ${lr} km od ${vol.toFixed(1)} km`
          ).toBeLessThanOrEqual(0.53);
        });
      }
    }
  });
});

describe('Opterećenje i oporavak', () => {
  it('ACWR nikad ne pređe 1,5 (Gabbett)', () => {
    /* Nedelja naspram proseka prethodne četiri. Bolje potkrepljena mera od „pravila 10%". */
    for (const P of PROFILES) {
      for (const { p, opis } of supported(P)) {
        const v = p.weeks.map(weekKm);
        for (let i = 4; i < v.length - 1; i++) {
          const chronic =
            ((v[i - 1] ?? 0) + (v[i - 2] ?? 0) + (v[i - 3] ?? 0) + (v[i - 4] ?? 0)) / 4;
          if (chronic <= 0) continue;
          expect((v[i] ?? 0) / chronic, `${opis} N${i + 1}`).toBeLessThanOrEqual(1.5);
        }
      }
    }
  });

  it('taper se meri ISPORUČENIM vrhuncem, ne ciljanim', () => {
    /* Bosquet (meta-analiza): optimum je 41–60% smanjenja obima. Tolerancija 1,06 pokriva pod od
       ~1,5 km po danu trčanja. */
    for (const P of PROFILES) {
      for (const { p, opis } of supported(P)) {
        const v = p.weeks.map(weekKm);
        const peak = Math.max(...v.slice(0, -1));
        const lastTaper = v[v.length - 2] ?? 0;
        expect(
          lastTaper,
          `${opis}: taper ${lastTaper.toFixed(1)} od vrhunca ${peak.toFixed(1)}`
        ).toBeLessThanOrEqual(peak * P.taperF * 1.06);
      }
    }
  });
});

describe('Protokol pred trku', () => {
  it('tri dana pred trku nema ni dugog trčanja ni kvaliteta — za SVAKI dan u nedelji', () => {
    /* Protokol (−3 shakeout, −2 aktivacija, −1 shakeout) se punio po DANU U NEDELJI, pa je za trku
       koja pada rano u nedelji nestajao. Test ide kroz svih sedam dana jer je greška bila vidljiva
       samo za neke. */
    for (const P of PROFILES) {
      for (let dow = 1; dow <= 7; dow++) {
        const p = ok({
          startDate: START,
          raceDate: raceIn(16, dow),
          raceDistM: P.distM,
          pb: { distM: P.distM, sec: P.pb },
          weeklyKm: P.minKm + 15,
          runDays: P.minD + 1,
          quality: 2,
          intensity: 'std',
          trainedRecently: true
        });
        const byDate = new Map<string, Day>();
        p.weeks.forEach((w) =>
          w.days.forEach((d) => byDate.set(addDays(p.meta.start, (w.w - 1) * 7 + d.dow - 1), d))
        );
        const raceEntry = [...byDate.entries()].find(([, d]) => d.tag === 'trka');
        expect(raceEntry, `${P.ime} dow ${dow}: nema dana trke`).toBeDefined();
        const raceDate = (raceEntry as [string, Day])[0] as IsoDate;
        for (let back = 1; back <= 3; back++) {
          const d = byDate.get(addDays(raceDate, -back));
          if (!d || d.rest) continue;
          expect(
            d.tag !== 'lr' && d.tag !== 'rw',
            `${P.ime}, ${back} dana pred trku: dugo trčanje`
          ).toBe(true);
          /* aktivacija (−2) je jedina sesija koja tu sme — 6×200 m sa punim odmorom */
          if (back !== 2)
            expect(d.session, `${P.ime}, ${back} dana pred trku: „${d.desc}"`).toBeUndefined();
          expect(kmOf(d), `${P.ime}, ${back} dana pred trku`).toBeLessThanOrEqual(5);
        }
      }
    }
  });

  it('PRED redovi i qs ključevi ostaju dosledni i kad protokol pregazi taper nedelju', () => {
    for (const P of PROFILES) {
      for (let dow = 1; dow <= 3; dow++) {
        const p = ok({
          startDate: START,
          raceDate: raceIn(16, dow),
          raceDistM: P.distM,
          pb: { distM: P.distM, sec: P.pb },
          weeklyKm: P.minKm + 15,
          runDays: P.minD + 1,
          quality: 2,
          intensity: 'std',
          trainedRecently: true
        });
        const exists = new Set<string>();
        const names = new Map<number, string[]>();
        p.weeks.forEach((w) =>
          w.days.forEach((d) => {
            exists.add(`n${w.w}d${d.dow}`);
            if (d.session)
              names.set(w.w, [...(names.get(w.w) ?? []), `N${w.w} · ${d.session.kind}`]);
          })
        );
        for (const k of Object.keys(p.qs))
          expect(exists.has(k), `${P.ime} dow ${dow}: qs ${k}`).toBe(true);
        for (const r of p.pred)
          expect(names.get(r.w) ?? [], `${P.ime} dow ${dow}: PRED „${r.l}"`).toContain(r.l);
      }
    }
  });
});

describe('Odluke koje moraju da prate CEO plan, ne polaznu tačku', () => {
  it('drugi kvalitetni trening prati VRHUNAC plana, ne uneti obim', () => {
    for (const P of PROFILES) {
      const start = Math.round(P.minKm * 0.8); // ispod praga za 2 kvaliteta
      const p = ok({
        startDate: START,
        raceDate: raceIn(20),
        raceDistM: P.distM,
        pb: { distM: P.distM, sec: P.pb },
        weeklyKm: start,
        runDays: P.minD + 1,
        quality: 2,
        intensity: 'std',
        trainedRecently: true
      });
      const peak = Math.max(...p.weeks.map(weekKm).slice(0, -3));
      const q2Min = (profileFor(P.distM) as NonNullable<ReturnType<typeof profileFor>>).product
        .qual2MinKm;
      if (peak < q2Min) continue; // plan zaista ostaje mali — 1 kvalitet je tačno
      expect(
        p.meta.quality,
        `${P.ime}: kreće sa ${start}, vrhunac ${peak.toFixed(0)} (prag ${q2Min})`
      ).toBe(2);
    }
  });

  it('mali plan i dalje dobija jedan kvalitet, i kaže zašto', () => {
    const p = ok({
      startDate: START,
      raceDate: raceIn(12),
      raceDistM: 42195,
      pb: { distM: 42195, sec: 300 * 60 },
      weeklyKm: 12,
      runDays: 4,
      quality: 2,
      intensity: 'kons',
      trainedRecently: true
    });
    expect(p.meta.quality).toBe(1);
    expect(p.meta.dayWarnings.some((t) => /JEDAN kvalitetan trening/.test(t))).toBe(true);
  });

  it('„tek počinjem" uz visok obim je protivrečnost i mora da se kaže', () => {
    const base = {
      startDate: START,
      raceDate: raceIn(16),
      raceDistM: 21097.5,
      pb: { distM: 21097.5, sec: 120 * 60 },
      weeklyKm: 50,
      runDays: 5,
      quality: 2,
      intensity: 'std' as const
    };
    expect(
      ok({ ...base, trainedRecently: false }).meta.dayWarnings.some((t) => /TEK POČINJEŠ/.test(t))
    ).toBe(true);
    expect(
      ok({ ...base, trainedRecently: true }).meta.dayWarnings.some((t) => /TEK POČINJEŠ/.test(t))
    ).toBe(false);
  });

  it('ispod preporučenog broja dana plan i dalje upozorava', () => {
    /* Prag se čita IZ PROFILA, ne iz mreže testa: 5K i 10K ga namerno nemaju. */
    const demanding = PROFILES.filter(
      (P) =>
        ((profileFor(P.distM) as NonNullable<ReturnType<typeof profileFor>>).product
          .recommendedMinRunDays ?? 0) > 3
    );
    expect(demanding.length).toBeGreaterThanOrEqual(2);
    for (const P of demanding) {
      const p = ok({
        startDate: START,
        raceDate: raceIn(16),
        raceDistM: P.distM,
        pb: { distM: P.distM, sec: P.pb },
        weeklyKm: P.minKm,
        runDays: 3,
        quality: 2,
        intensity: 'std',
        trainedRecently: true
      });
      expect(
        p.meta.dayWarnings.some((t) => /preporučuje bar/.test(t)),
        `${P.ime} na 3 dana`
      ).toBe(true);
    }
  });
});

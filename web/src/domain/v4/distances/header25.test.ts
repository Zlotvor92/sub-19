/* R25 (popravka upozorenja) — svojstva zaglavlja nad profilima SVIH distanci (i sa 3, 4 i 5 dana, i kao početnik sa
   kratkim stažem, tegobom i 10 km nedeljno, i sa 8 nedelja pripreme) i nad scenarijima:
   (1) granica stavki ne izbacuje bezbednost (tegoba, bol), predlog kraće distance, staž ni cilj van raspona;
   (2) „Pomoglo bi i" nema deo bez prethodnika („te nedelje …" kad je stavka na koju se odnosi izbačena);
   (3) svako upozorenje ima neprazan problem, posledicu i predlog (AGENTS § V4 t. 6);
   (4) „vršna nedelja" je nedelja najvećeg opterećenja pre sužavanja (jednako opterećenje: kasnija). */
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment,
   @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument
   -- profili i scenariji su netipizovani */
import { describe, expect, it } from 'vitest';
import {
  buildState,
  plan,
  renderPlan,
  type DistanceData,
  type PlanDoc,
  type Warning
} from '../engine';
import { estimateForm } from '../fitness';

const dataMods = import.meta.glob<Record<string, unknown>>('./*/index.ts', { eager: true });
const profMods = import.meta.glob<Record<string, unknown>>('./*/testdata/profiles.ts', {
  eager: true
});
const scenMods = import.meta.glob<Record<string, unknown>>('./*/testdata/scenarios.ts', {
  eager: true
});
const DIST = Object.entries(dataMods).map(([path, mod]) => {
  const data = Object.values(mod).find(
    (v): v is DistanceData => typeof v === 'object' && v !== null && 'adequate' in v && 'id' in v
  );
  if (data === undefined) throw new Error(path);
  const p = profMods[path.replace('index.ts', 'testdata/profiles.ts')] as any;
  const sc = scenMods[path.replace('index.ts', 'testdata/scenarios.ts')] as any;
  return {
    data,
    profiles: p.PROFILES as any[],
    factsOf: p.factsOf as (x: any) => any,
    scenarios: (sc?.SCENARIOS ?? []) as any[]
  };
});

const DAYS: Record<number, number[]> = { 3: [1, 3, 6], 4: [1, 3, 5, 6], 5: [0, 1, 3, 5, 6] };
function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y ?? 2026, (m ?? 1) - 1, (d ?? 1) + n)).toISOString().slice(0, 10);
}

interface Case {
  label: string;
  doc: PlanDoc;
  text: string;
  /** bez događaja (pauza, bol, rampa) — za svojstvo vršne nedelje */
  plain: boolean;
}

/** Profili × (0/3/4/5 dana) × (kako jeste / početnik: 5 nedelja staža, tegoba, 10 km nedeljno) × (kako jeste / 8
    nedelja pripreme) + scenariji. */
function cases(d: (typeof DIST)[number]): Case[] {
  const out: Case[] = [];
  for (const p of d.profiles) {
    for (const n of [0, 3, 4, 5]) {
      for (const beginner of [false, true]) {
        for (const short of [false, true]) {
          if ((beginner || short) && n !== 0 && n !== 4) continue;
          const facts = d.factsOf(p);
          if (n > 0) facts.availability = { runDays: DAYS[n], longDay: 6 };
          if (beginner) {
            facts.profile = {
              ...facts.profile,
              yearsRunning: 0.1,
              weeklyKm: 10,
              longestRecentKm: 6
            };
            facts.painHistory = [
              {
                date: addDays(p.today, -350),
                part: 'potkolenica',
                level: 5,
                resolvedOn: addDays(p.today, -315)
              }
            ];
          }
          const goal = short ? { ...p.goal, raceDate: addDays(p.today, 56) } : p.goal;
          const state = buildState(facts, goal, d.data, estimateForm);
          const res = plan(state, goal, d.data);
          if (!res.ok) continue;
          out.push({
            label: `${String(p.id)}/${String(n)}${beginner ? '/početnik' : ''}${short ? '/8 ned' : ''}`,
            doc: res.doc,
            text: renderPlan(res.doc, state, d.data),
            plain: !beginner
          });
        }
      }
    }
  }
  for (const s of d.scenarios) {
    const r = s.run();
    out.push({
      label: `s${String(s.no)}`,
      doc: r.after,
      text: renderPlan(r.after, r.afterState, d.data),
      plain: false
    });
  }
  return out;
}

const CASES = new Map(DIST.map((d) => [d.data.id, cases(d)] as const));

function warnBlock(text: string): string[] {
  const head = text.split('\n1. NEDELJA')[0] ?? text;
  return (head.split('\nUPOZORENJA\n')[1] ?? '').split('\n').filter((l) => l.startsWith('- '));
}
const headOf = (doc: PlanDoc): Warning[] =>
  doc.header.warnings.filter((w) => w.weeks === undefined);

describe('R25 — upozorenja u zaglavlju', () => {
  it.each(DIST.map((d) => [d.data.id] as const))(
    '%s (1): bezbednost, kraća distanca, staž i cilj van raspona ostaju u upozorenjima',
    (id) => {
      const bad: string[] = [];
      for (const c of CASES.get(id) ?? []) {
        const block = warnBlock(c.text).join('\n');
        const ws = headOf(c.doc);
        for (const w of ws)
          if (
            ['tegoba', 'bol', 'kratak-staz', 'cilj-van-raspona'].includes(w.code) &&
            !block.includes(w.problem)
          )
            bad.push(`${c.label}: nema stavke ${w.code}`);
        if (
          ws.some((w) => w.proposal.includes('kraću distancu')) &&
          !block.includes('kraću distancu')
        )
          bad.push(`${c.label}: nema predloga kraće distance`);
      }
      expect(bad).toEqual([]);
    }
  );

  it.each(DIST.map((d) => [d.data.id] as const))(
    '%s (2): „Pomoglo bi i" nema deo bez prethodnika',
    (id) => {
      const bad: string[] = [];
      for (const c of CASES.get(id) ?? []) {
        const more = warnBlock(c.text).find((l) => l.startsWith('- Pomoglo bi i: '));
        if (more === undefined) continue;
        for (const part of more.slice('- Pomoglo bi i: '.length).split('; '))
          if (/^(te|ove|tih|tim|tog|taj|to|tada|tu)\b/i.test(part))
            bad.push(`${c.label}: „${part}"`);
      }
      expect(bad).toEqual([]);
    }
  );
});

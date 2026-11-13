/* Izbor distance za skripte ispisa (render, scenarios, gate, target, pairs): `--dist hm` (podrazumevano) ili
   `--dist tenk`. Svaka distanca daje isti oblik iz svog foldera `web/src/domain/v4/distances/<d>/`: podatke,
   12 profila, scenarije, kapiju; planovi vlasnika postoje samo za polumaraton. */
import { join } from 'node:path';

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface Dist {
  key: string;
  /** Folder ispisa u `docs/generators-v4/plans/`. */
  outDir: string;
  /** Naziv distance u naslovima pregleda. */
  name: string;
  data: any;
  PROFILES: any[];
  factsOf: (p: any) => any;
  OWNER_PLANS: any[];
  gateStats: (doc: any, facts: any) => any;
  folder: string;
}

const DISTS: Record<string, { folder: string; exportName: string; outDir: string; name: string }> = {
  hm: { folder: 'hm', exportName: 'hm', outDir: 'HM', name: 'polumaraton' },
  tenk: { folder: 'tenk', exportName: 'tenk', outDir: '10K', name: '10 km' }
};

export function distKey(argv: string[]): string {
  const i = argv.indexOf('--dist');
  const key = i >= 0 ? (argv[i + 1] ?? 'hm') : 'hm';
  if (DISTS[key] === undefined) throw new Error(`nepoznata distanca: ${key}`);
  return key;
}

export async function loadDist(v4: string, argv: string[]): Promise<Dist> {
  const key = distKey(argv);
  const d = DISTS[key] as (typeof DISTS)[string];
  const base = join(v4, 'distances', d.folder);
  const data = (await import(join(base, 'index.ts')))[d.exportName];
  const { PROFILES, factsOf } = await import(join(base, 'testdata/profiles.ts'));
  let OWNER_PLANS: any[] = [];
  try {
    OWNER_PLANS = (await import(join(base, 'testdata/owner.ts'))).OWNER_PLANS;
  } catch {
    OWNER_PLANS = [];
  }
  const { gateStats } = await import(join(base, 'testdata/gate.ts'));
  return { key, outDir: d.outDir, name: d.name, data, PROFILES, factsOf, OWNER_PLANS, gateStats, folder: base };
}

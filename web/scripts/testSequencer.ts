/* REDOSLED I PODELA TEST FAJLOVA PO TRAJANJU (docs/testing/TEST-SPEED.md § 11).

   Podrazumevani vitest:
   - `--shard=i/n` deli fajlove po BROJU (sortirani po hešu putanje), pa teški delovi punog nivoa (`*.full.node.test.ts`,
     15–30 redova, a 100–340 s) padnu nasumično: na CI-ju su delovi trajali 18–32 min;
   - bez keša trajanja (svež CI) pokreće VEĆE fajlove prvo, pa ti mali a teški fajlovi krenu poslednji i produže rep.

   Ovde: težina fajla = izmereno trajanje iz `test-durations.json` (pun nivo; osvežava `scripts/test-durations.mjs`),
   nepoznat fajl = `UNKNOWN_S`. `shard` raspoređuje pohlepno (najteži prvo, u deo sa najmanjim zbirom) — svaki posao CI-ja
   računa istu podelu jer ima iste fajlove i istu tabelu; unija delova = svi fajlovi, bez preklapanja. `sort` pokreće
   pale prvo, pa najduže prvo (keš poslednjeg lokalnog pokretanja, inače tabela). Skup testova i tvrdnje se ne menjaju. */

import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import { BaseSequencer, type TestSpecification } from 'vitest/node';

/** Težina fajla koji nije u tabeli (nov fajl): većina fajlova traje ispod sekunde. */
const UNKNOWN_S = 1;

const DURATIONS = JSON.parse(
  readFileSync(new URL('./test-durations.json', import.meta.url), 'utf8')
) as Record<string, number>;

export class DurationSequencer extends BaseSequencer {
  private keyOf(spec: TestSpecification): string {
    return relative(this.ctx.config.root, spec.moduleId).split('\\').join('/');
  }

  /** Težina u sekundama iz tabele (pun nivo). */
  private weightOf(spec: TestSpecification): number {
    return DURATIONS[this.keyOf(spec)] ?? UNKNOWN_S;
  }

  override shard(files: TestSpecification[]): Promise<TestSpecification[]> {
    const shard = this.ctx.config.shard;
    if (!shard) return Promise.resolve(files);
    const bins = Array.from({ length: shard.count }, () => ({
      total: 0,
      specs: [] as TestSpecification[]
    }));
    const ordered = files
      .map((spec) => ({ spec, key: this.keyOf(spec), w: this.weightOf(spec) }))
      .sort((a, b) => b.w - a.w || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
    for (const x of ordered) {
      let best = bins[0];
      for (const bin of bins) if (bin.total < best.total) best = bin;
      best.total += x.w;
      best.specs.push(x.spec);
    }
    return Promise.resolve(bins[shard.index - 1].specs);
  }

  override sort(files: TestSpecification[]): Promise<TestSpecification[]> {
    const cache = this.ctx.cache;
    const facts = new Map(
      files.map((spec) => {
        const key = this.keyOf(spec);
        const last = cache.getFileTestResults(`${spec.project.name}:${key}`);
        return [
          spec,
          {
            key,
            failed: last?.failed === true,
            ms: last ? last.duration : this.weightOf(spec) * 1000
          }
        ] as const;
      })
    );
    return Promise.resolve(
      [...files].sort((a, b) => {
        const x = facts.get(a)!;
        const y = facts.get(b)!;
        if (x.failed !== y.failed) return x.failed ? -1 : 1;
        return y.ms - x.ms || (x.key < y.key ? -1 : x.key > y.key ? 1 : 0);
      })
    );
  }
}

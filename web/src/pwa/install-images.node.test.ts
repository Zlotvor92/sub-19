import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/* Isečci koje list „Instaliraj" pokazuje na iPhone-u (`features/install/InstallSheet`) moraju postojati u public/ — inače list nosi prazne okvire. */
const WEB = process.cwd();

describe('slike koraka za iPhone', () => {
  it('svaki src iz lista postoji u public/', () => {
    const src = readFileSync(join(WEB, 'src/features/install/InstallSheet.tsx'), 'utf8');
    const paths = [...src.matchAll(/src="\.\/(instaliraj\/[^"]+)"/g)].map((m) => m[1] as string);
    expect(paths).toHaveLength(4);
    for (const p of paths) expect(existsSync(join(WEB, 'public', p)), p).toBe(true);
  });
});

/* Segment 08g: heševi trajne rane mreže (testInputs.earlyFlows: earlyGridBases × earlyAsOfs × EARLY_SCENARIOS +
   drugi korak lanca + ponovljen umor asOf + 1 … + 7) nad API-jem zadatog korena (polazni SHA f4b257d ili tekuće
   stablo). Enumeracija i činjenice iz TEKUĆEG testInputs.ts, generate/adapt iz <koren>.
   Iz korena repoa: node docs/5k-v2/artifacts/segment-08g/early-hashes-08g.ts <koren> <izlaz.json> */
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import {
  canonResult,
  earlyFlows,
  earlyGridBases
} from '../../../../web/src/domain/generators/fiveK/v2/testInputs.ts';

const [root, outP] = process.argv.slice(2) as [string, string];
const { generateFiveKV2 } = await import(`${root}/web/src/domain/generators/fiveK/v2/generate.ts`);
const { adaptFiveKV2 } = await import(`${root}/web/src/domain/generators/fiveK/v2/adapt.ts`);
const h = (r: unknown): string => createHash('sha256').update(canonResult(r)).digest('hex').slice(0, 16);
const out: Record<string, { h: string; ok: boolean; dl?: number }> = {};
/** Ponovljen umor: broj nedelja koje su rasteretne u rezultatu, a nisu u planu prvog koraka (novo rasterećenje). */
const dl = (r: { ok: boolean; plan?: { weeks: { deload: boolean }[] } }, before: { weeks: { deload: boolean }[] }): number =>
  r.ok ? r.plan!.weeks.filter((w, i) => w.deload && !before.weeks[i]!.deload).length : 0;
for (const b of earlyGridBases())
  for (const f of earlyFlows(b.id, b.input, { generate: generateFiveKV2, adapt: adaptFiveKV2 }))
    out[f.key] = { h: h(f.res), ok: f.res.ok, ...(f.key.includes('/fatigue/+') ? { dl: dl(f.res, f.plan) } : {}) };
writeFileSync(outP, JSON.stringify(out));
console.log(Object.keys(out).length);

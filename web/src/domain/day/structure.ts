/* PRIKAZ STRUKTURISANOG TRENINGA (5k-v2, segment 08a): `structure` dana → kratak opis rada, redovi „Struktura", profil
   i trajanje. Samo čita ono što je generator propisao (km, vreme, tempo ILI napor, osnova zadato/procenjeno); ništa se ne
   preračunava. Dan bez `structure` (svi stariji planovi) ovde ne ulazi. */

import { fmtClock, fmtKm } from '../format';
import type { StructureBlock, StructureStep, WorkoutStructure } from '../training/types';
import type { BreakdownRow } from './breakdown';

const MAIN: ReadonlySet<StructureStep['kind']> = new Set(['work', 'stride', 'race', 'test', 'run']);

/** „45 s", „2 min", „1:30 min". */
export function durationText(sec: number): string {
  if (sec < 60) return `${Math.round(sec)} s`;
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return s ? `${m}:${String(s).padStart(2, '0')} min` : `${m} min`;
}

const distanceText = (km: number): string =>
  km < 1 ? `${Math.round(km * 1000)} m` : `${fmtKm(km)} km`;

/** Propisana veličina dela: vreme kad je zadato vremenom, inače distanca. */
function measureText(s: StructureStep): string {
  if (s.secBasis === 'exact' && s.sec != null) return durationText(s.sec);
  if (s.km != null) return distanceText(s.km);
  return s.sec != null ? durationText(s.sec) : '';
}

/** Cilj dela: tempo (ili opseg), napor po osećaju, ili ništa (hod). 10K v2: tempo koji je generator samo procenio (plan po
 *  osećaju, test) piše se kao „orijentir (procena)", uz napor kad ga deo ima; deo trčanja run/walk ga ne dobija ovde. */
function targetText(s: StructureStep): string {
  if (s.paceRange) return ` @ ${fmtClock(s.paceRange.fast)}–${fmtClock(s.paceRange.slow)}/km`;
  if (s.paceSec != null) return ` @ ${fmtClock(s.paceSec)}/km`;
  const est =
    s.kind !== 'run' && s.estimatePaceSec != null
      ? `orijentir (procena) ${fmtClock(s.estimatePaceSec)}/km`
      : '';
  if (s.effort)
    return ` po osećaju (RPE ${rpeText(s.effort.rpeMin, s.effort.rpeMax)})${est ? `, ${est}` : ''}`;
  return est ? ` — ${est}` : '';
}

const rpeText = (a: number, b: number): string => (a === b ? `${a}` : `${a}–${b}`);

function blockText(b: StructureBlock): string {
  const s = b.step;
  if (s.kind === 'run' && b.recovery)
    return `${b.reps} × (${durationText(s.sec ?? 0)} trčanje / ${durationText(b.recovery.sec ?? 0)} hod)`;
  if (s.kind === 'run') return `${measureText(s)} trčanja bez prekida`;
  const head = b.reps > 1 ? `${b.reps} × ${measureText(s)}` : measureText(s);
  return `${head}${targetText(s)}`;
}

/** Kratak opis SAMOG rada (bez zagrevanja i hlađenja); prazno kad dan nema radni deo (lagano, dugo). */
export function structureCore(s: WorkoutStructure): string {
  const main = s.blocks.filter((b) => MAIN.has(b.step.kind));
  if (main.length === 1 && main[0]!.step.kind === 'race' && s.goal === 'finish')
    return `${distanceText(main[0]!.step.km ?? 0)} — cilj: završiti`;
  return main.map(blockText).join(' + ');
}

const LEAD: Readonly<Partial<Record<StructureStep['kind'], string>>> = {
  warmup: 'Zagrevanje',
  cooldown: 'Hlađenje',
  easy: 'Lagano',
  long: 'Dugo'
};

/** Redovi „Struktura": zagrevanje, rad, oporavak, hlađenje, napor, nivo, cilj — samo ono što struktura nosi. */
export function structureRows(s: WorkoutStructure, runWalkText: string | null): BreakdownRow[] {
  const rows: BreakdownRow[] = [];
  const blocks = s.blocks;
  const walks = blocks.filter((b) => b.reps === 1 && b.step.kind === 'walk');
  const first = blocks[0];
  const last = blocks[blocks.length - 1];
  if (first && first.step.kind === 'walk' && walks.length)
    rows.push(['Zagrevanje', `${durationText(first.step.sec ?? 0)} hod`]);
  for (const b of blocks) {
    const lead = LEAD[b.step.kind];
    if (lead && b.reps === 1)
      rows.push([lead, `${distanceText(b.step.km ?? 0)}${targetText(b.step)}`]);
  }
  const core = structureCore(s);
  if (core) rows.push(['Radni deo', core, true]);
  const rest = blocks.find((b) => MAIN.has(b.step.kind) && b.recovery)?.recovery;
  if (rest)
    rows.push(['Odmor', `${measureText(rest)} ${rest.kind === 'walk' ? 'hod' : 'kaskanje'}`]);
  else {
    // 10K v2 piramida: deonice različite dužine, svaki oporavak je svoj blok (redom).
    const own = blocks.filter((b) => b.reps === 1 && b.step.kind === 'recovery');
    if (own.length)
      rows.push(['Odmor', `${own.map((b) => measureText(b.step)).join(' / ')} kaskanje`]);
  }
  if (last && last !== first && last.step.kind === 'walk')
    rows.push(['Hlađenje', `${durationText(last.step.sec ?? 0)} hod`]);
  // Zagrevanje/hlađenje trčanjem su u redovima iznad; premeštaju se na mesta koja prikaz očekuje (pre/posle rada).
  const order = (r: BreakdownRow): number =>
    r[0] === 'Zagrevanje' ? 0 : r[0] === 'Hlađenje' ? 3 : r[0] === 'Odmor' ? 2 : 1;
  rows.sort((a, b) => order(a) - order(b));
  if (runWalkText) rows.push(['Ritam', runWalkText, true]);
  if (s.level != null) rows.push(['Nivo', `L${s.level}${s.projection ? ' (projekcija)' : ''}`]);
  if (s.rpe) rows.push(['Napor', `RPE ${rpeText(s.rpe.min, s.rpe.max)} — ${s.rpe.txt}`]);
  if (s.goal === 'finish') rows.push(['Cilj', 'završiti']);
  return rows;
}

export type StructureSegKind = 'wu' | 'rep' | 'rec' | 'cd' | 'steady';
const SEG: Readonly<Record<StructureStep['kind'], StructureSegKind>> = {
  warmup: 'wu',
  cooldown: 'cd',
  easy: 'steady',
  long: 'steady',
  work: 'rep',
  stride: 'rep',
  race: 'rep',
  test: 'rep',
  run: 'rep',
  recovery: 'rec',
  walk: 'rec'
};

/** Profil treninga (visina = brzina): `null` kad neki deo nema trajanje ili brzinu (hod, trka bez tempa). */
export function structureSegments(
  s: WorkoutStructure
): Array<{ kind: StructureSegKind; sec: number; paceSec: number }> | null {
  const out: Array<{ kind: StructureSegKind; sec: number; paceSec: number }> = [];
  for (const b of s.blocks)
    for (let i = 0; i < b.reps; i++)
      for (const st of i < b.reps - 1 && b.recovery ? [b.step, b.recovery] : [b.step]) {
        const pace =
          st.paceSec ??
          st.estimatePaceSec ??
          (st.km != null && st.km > 0 && st.sec != null ? st.sec / st.km : null);
        if (st.sec == null || pace == null) return null;
        out.push({ kind: SEG[st.kind], sec: st.sec, paceSec: Math.round(pace) });
      }
  return out.length ? out : null;
}

/** Trajanje u minutama iz strukture; `null` kad ga generator nije procenio. */
export const structureMinutes = (s: WorkoutStructure): number | null =>
  s.sec != null && s.sec > 0 ? Math.round(s.sec / 60) : null;

/** Ciljni tempo dana: tempo glavnog dela, a za lagan/dugi dan tempo laganog dela; `null` za rad po osećaju. */
export function structurePace(s: WorkoutStructure): number | null {
  const main = s.blocks.find((b) => MAIN.has(b.step.kind));
  if (main) return main.step.paceSec;
  return (
    s.blocks.find((b) => b.step.kind === 'easy' || b.step.kind === 'long')?.step.paceSec ?? null
  );
}

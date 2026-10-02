/* MERILO RADNOG DELA — luk sa oznakom plana na vrhu i kuglicom na mestu ostvarenog tempa. Levo je brže od plana, desno sporije.

   GEOMETRIJA IZLAZI IZ JEDNOG IZVORA: središte (52,52) i poluprečnik 40 koriste i putanja luka i položaj kuglice, a krajevi
   luka se RAČUNAJU iz istog ugla (±110°) umesto da budu prepisani brojevi.

   RASPON SE SEČE na ±20 s/km: promašaj od minuta po kilometru (kaskanje između deonica u proseku) ne sme da odnese kuglicu
   daleko van luka. Kuglica na kraju znači „mnogo"; tačan broj stoji ispod merila. */

export const GAUGE_RANGE_SEC = 20;
export const GAUGE_ANGLE_DEG = 110;

const CX = 52;
const CY = 52;
const R = 40;

export type Point = readonly [x: number, y: number];
const onArc = (deg: number): Point => {
  const a = (deg * Math.PI) / 180;
  return [Number((CX + R * Math.sin(a)).toFixed(1)), Number((CY - R * Math.cos(a)).toFixed(1))];
};

export interface GaugeView {
  /** SVG putanja luka. */
  arc: string;
  /** Položaj kuglice; `null` kad nema para brojeva. */
  dot: Point | null;
  /** Odstupanje u sekundama po km (negativno = brže od plana); `null` kad nema para. */
  delta: number | null;
  tone: 'none' | 'faster' | 'slower' | 'same';
}

export function gaugeView(
  planSec: number | null | undefined,
  doneSec: number | null | undefined
): GaugeView {
  const [x0, y0] = onArc(-GAUGE_ANGLE_DEG);
  const [x1, y1] = onArc(GAUGE_ANGLE_DEG);
  const arc = `M ${x0} ${y0} A ${R} ${R} 0 1 1 ${x1} ${y1}`;
  const has = (planSec ?? 0) > 0 && (doneSec ?? 0) > 0;
  if (!has) return { arc, dot: null, delta: null, tone: 'none' };
  const diff = (doneSec as number) - (planSec as number);
  const delta = Math.round(diff);
  const t = Math.max(-1, Math.min(1, diff / GAUGE_RANGE_SEC));
  return {
    arc,
    dot: onArc(t * GAUGE_ANGLE_DEG),
    delta,
    tone: delta < 0 ? 'faster' : delta > 0 ? 'slower' : 'same'
  };
}

export interface VdotDeltaView {
  kind: 'enter' | 'none' | 'value';
  arrow?: '↑' | '↓' | '→';
  tone?: 'up' | 'down' | 'flat';
  vdot?: number | null;
  delta?: number | null;
}

/** Prikaz promene VDOT-a za jedan radni segment (gore/dole u odnosu na prethodni VDOT). */
export function vdotDeltaView(
  paceSec: number | null | undefined,
  entry: { vdot?: number | null; delta?: number | null } | undefined
): VdotDeltaView {
  if (!paceSec) return { kind: 'enter' };
  if (!entry) return { kind: 'none' };
  const d = entry.delta ?? 0;
  return {
    kind: 'value',
    arrow: d > 0.05 ? '↑' : d < -0.05 ? '↓' : '→',
    tone: d > 0.05 ? 'up' : d < -0.05 ? 'down' : 'flat',
    vdot: entry.vdot ?? null,
    delta: entry.delta ?? null
  };
}

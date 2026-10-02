import { memo } from 'react';
import type { Segment } from '../../features/session/sessionModel';

/* PROFIL SESIJE: stubovi po vremenu, visina = brzina (brže je više). Radni deo je u boji težine, lagano je neutralno. Isti raspon tempa na svim
   treninzima, pa se lagan dan i intervali odmah razlikuju. Segment bez vremena se ne crta. */

const W = 320;
const H = 64;
const FAST = 200; // s/km — pun stub
const SLOW = 330; // s/km — najniži stub
const MIN_H = 0.14;

const frac = (pace: number): number => Math.max(MIN_H, Math.min(1, (SLOW - pace) / (SLOW - FAST)));
const KIND_CLASS: Readonly<Record<Segment['kind'], string>> = {
  rep: 'rep',
  wu: 'easy',
  cd: 'easy',
  steady: 'easy',
  rec: 'rec'
};

export const SessionProfile = memo(function SessionProfile({
  segments,
  label,
  height = H
}: {
  segments: readonly Segment[];
  label: string;
  height?: number;
}) {
  const total = segments.reduce((s, x) => s + Math.max(0, x.sec), 0);
  if (total <= 0) return null;
  const gap = 1.2;
  let x = 0;
  return (
    <svg
      className="sprof"
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      height={height}
      preserveAspectRatio="none"
      role="img"
      aria-label={label}
    >
      {segments.map((s, i) => {
        const w = (Math.max(0, s.sec) / total) * W;
        const h = frac(s.paceSec) * H;
        const rect = (
          <rect
            key={i}
            className={`sp-bar ${KIND_CLASS[s.kind]} grow`}
            style={{ ['--i' as string]: i }}
            x={x + gap / 2}
            y={H - h}
            width={Math.max(0.8, w - gap)}
            height={h}
            rx={1.5}
          />
        );
        x += w;
        return rect;
      })}
    </svg>
  );
});

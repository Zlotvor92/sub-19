import { ringView } from '../../domain/day';

/* PRSTEN: udeo preko 1 se ne seče (prekoračenje plana je informacija). `fontSize` je izuzetak od podrazumevanog: „20:41" je pet
   znakova i na 24 izlazi iz unutrašnjeg kruga, dok „93%" staje. */
export function Ring({
  share,
  text,
  size,
  color,
  fontSize
}: {
  share: number;
  text?: string;
  size: number;
  color: string;
  fontSize?: number;
}) {
  const r = ringView(share);
  const fs = fontSize ?? (size > 70 ? 24 : 22);
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true">
      <circle
        cx="50"
        cy="50"
        r={r.radius}
        fill="none"
        stroke="rgba(238,240,255,.14)"
        strokeWidth="8"
      />
      <circle
        className="pr-val"
        cx="50"
        cy="50"
        r={r.radius}
        fill="none"
        stroke={color}
        strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray={r.circumference}
        strokeDashoffset={r.offset}
        transform="rotate(-90 50 50)"
      />
      {text ? (
        <text
          x="50"
          y={size > 70 ? 56 : 55}
          textAnchor="middle"
          fontSize={fs}
          fontWeight="800"
          fill="#EEF0FF"
          fontFamily="-apple-system,sans-serif"
          letterSpacing="-1"
        >
          {text}
        </text>
      ) : null}
    </svg>
  );
}

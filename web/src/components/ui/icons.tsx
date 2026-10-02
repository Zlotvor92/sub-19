/* Ikonice preuzete doslovno iz starog index.html (vizuelna vernost). */

import type { Tab } from '../../stores/uiStore';

export const TAB_LABELS: Record<Tab, string> = {
  danas: 'Danas',
  plan: 'Plan',
  opor: 'Oporavak',
  pred: 'Trka',
  zajed: 'Zajednica'
};

const common = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  'aria-hidden': true
} as const;

export function TabIcon({ tab }: { tab: Tab }) {
  switch (tab) {
    case 'danas':
      return (
        <svg {...common} strokeWidth="1.9">
          <rect x="3.5" y="5" width="17" height="15.5" rx="3" />
          <path d="M3.5 9.5h17M8 3v3.5M16 3v3.5" />
          <circle cx="12" cy="15" r="2.4" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'plan':
      return (
        <svg {...common} strokeWidth="1.9">
          <path d="M8.5 6h11M8.5 12h11M8.5 18h11" />
          <circle cx="4.4" cy="6" r="1.4" fill="currentColor" stroke="none" />
          <circle cx="4.4" cy="12" r="1.4" fill="currentColor" stroke="none" />
          <circle cx="4.4" cy="18" r="1.4" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'opor':
      return (
        <svg {...common} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20.4 7.1a4.55 4.55 0 0 0-6.45 0L12 9.05 10.05 7.1a4.55 4.55 0 1 0-6.45 6.45L12 21.9l8.4-8.35a4.55 4.55 0 0 0 0-6.45Z" />
          <path d="M3.4 13.1h3.9l1.5-2.5 2.2 4.3 1.7-2.9 1.1 1.1h4.8" />
        </svg>
      );
    case 'pred':
      return (
        <svg {...common} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 21V4" />
          <path d="M5 4h13l-2.5 4L18 12H5" />
        </svg>
      );
    case 'zajed':
      return (
        <svg {...common} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="9" cy="8" r="3.3" />
          <path d="M3.2 19.2c.5-3.1 3-5.2 5.8-5.2s5.3 2.1 5.8 5.2" />
          <path d="M16.4 5.2a3.3 3.3 0 0 1 0 6.1M17.6 14.4c2.1.6 3.7 2.4 4.1 4.8" />
        </svg>
      );
  }
}

export function GearIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="3.2" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.03 1.56V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1.11-1.56 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.56-1.03H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.65 8.9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34h.01A1.7 1.7 0 0 0 10.05 3V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1.03 1.56 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87v.01c.26.63.87 1.03 1.56 1.03H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.51.98z" />
    </svg>
  );
}

export function BrandMark({ size = 24, id = 'zagG' }: { size?: number; id?: string }) {
  return (
    <svg className="h-mark" viewBox="0 0 120 120" width={size} height={size} aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#5AFFBE" />
          <stop offset="55%" stopColor="#00BEDC" />
          <stop offset="100%" stopColor="#785AFF" />
        </linearGradient>
      </defs>
      <circle cx="60" cy="60" r="44" fill="none" stroke="rgba(238,240,255,.16)" strokeWidth="13" />
      <circle
        cx="60"
        cy="60"
        r="44"
        fill="none"
        stroke={`url(#${id})`}
        strokeWidth="13"
        strokeLinecap="round"
        strokeDasharray="276.46"
        strokeDashoffset="47.63"
        transform="rotate(-59 60 60)"
      />
    </svg>
  );
}

/* SISTEM IKONICA: jedan skup, isti potez (1.8), isti raster 24 × 24. Nema emodžija ni unicode znakova umesto ikonica.
   `Icon` služi za sve unutar ekrana; `TabIcon` je poseban jer su ikone tabova deo identiteta navigacije. */

import type { ReactNode } from 'react';
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
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true
} as const;

export type IconName =
  | 'check'
  | 'chevron'
  | 'chevron-down'
  | 'arrow'
  | 'flag'
  | 'swap'
  | 'edit'
  | 'skip'
  | 'undo'
  | 'info'
  | 'alert'
  | 'clock'
  | 'sparkle'
  | 'plus'
  | 'close';

const PATHS: Record<IconName, ReactNode> = {
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  chevron: <path d="M9 5l7 7-7 7" />,
  'chevron-down': <path d="M5 9l7 7 7-7" />,
  arrow: <path d="M4 12h15M13 6l6 6-6 6" />,
  flag: (
    <>
      <path d="M5 21V4" />
      <path d="M5 4h13l-2.5 4L18 12H5" />
    </>
  ),
  swap: <path d="M4 8h14M14 4l4 4-4 4M20 16H6M10 12l-4 4 4 4" />,
  edit: <path d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4" />,
  skip: <path d="M5 5l9 7-9 7V5zM18 5v14" />,
  undo: <path d="M9 14L4 9l5-5M4 9h10a6 6 0 010 12h-3" />,
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 7.5v.01" />
    </>
  ),
  alert: (
    <>
      <path d="M12 3.5l9.5 16.5h-19L12 3.5z" />
      <path d="M12 10v4.5M12 17.5v.01" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  sparkle: (
    <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3zM18.5 16v4M16.5 18h4" />
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  close: <path d="M6 6l12 12M18 6L6 18" />
};

export function Icon({
  name,
  size = 20,
  strokeWidth = 2
}: {
  name: IconName;
  size?: number;
  strokeWidth?: number;
}) {
  return (
    <svg {...common} width={size} height={size} strokeWidth={strokeWidth}>
      {PATHS[name]}
    </svg>
  );
}

export function TabIcon({ tab }: { tab: Tab }) {
  switch (tab) {
    /* Danas: štoperica — današnji trening i tempo (isti prsten kao u ikoni aplikacije). */
    case 'danas':
      return (
        <svg {...common} strokeWidth="1.9">
          <circle cx="12" cy="13.5" r="7.5" />
          <path d="M9.5 3h5M12 3v3M12 13.5V9.8" />
          <circle cx="12" cy="13.5" r="1.3" fill="currentColor" stroke="none" />
        </svg>
      );
    /* Plan: stubovi kilometraže, tekuća nedelja puna — isti jezik kao grafikon na ekranu Plan. */
    case 'plan':
      return (
        <svg {...common} strokeWidth="1.9">
          <rect x="2.6" y="12" width="4.4" height="8" rx="1.6" />
          <rect x="9.8" y="5" width="4.4" height="15" rx="1.6" fill="currentColor" />
          <rect x="17" y="9.5" width="4.4" height="10.5" rx="1.6" />
        </svg>
      );
    /* Oporavak: prsten sa pulsom. */
    case 'opor':
      return (
        <svg {...common} strokeWidth="1.9">
          <circle cx="12" cy="12" r="9" />
          <path d="M6.4 12.6h3l1.6-3.6 2.5 6.3 1.7-2.7h2.4" />
        </svg>
      );
    /* Trka (ekran „Napredak"): zastavica cilja, ista kao na kraju trake ciklusa. */
    case 'pred':
      return (
        <svg {...common} strokeWidth="1.9">
          <path d="M6 21V3.5" />
          <path d="M6 4.5h12l-2.7 3.9 2.7 3.9H6" />
        </svg>
      );
    case 'zajed':
      return (
        <svg {...common} strokeWidth="1.8">
          <circle cx="9" cy="8" r="3.3" />
          <path d="M3.2 19.2c.5-3.1 3-5.2 5.8-5.2s5.3 2.1 5.8 5.2" />
          <path d="M16.4 5.2a3.3 3.3 0 0 1 0 6.1M17.6 14.4c2.1.6 3.7 2.4 4.1 4.8" />
        </svg>
      );
  }
}

export function GearIcon() {
  return (
    <svg {...common} viewBox="0 0 24 24" width="22" height="22" strokeWidth="1.8">
      <circle cx="12" cy="12" r="3.2" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.03 1.56V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1.11-1.56 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.56-1.03H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.65 8.9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34h.01A1.7 1.7 0 0 0 10.05 3V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1.03 1.56 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87v.01c.26.63.87 1.03 1.56 1.03H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.51.98z" />
    </svg>
  );
}

/** Znak: prsten štoperice iz ikone aplikacije (ravan početak na 12 časova, praznina pred ciljem); u zaglavlju jednobojan, bez gradijenta. */
export function BrandMark({ size = 26 }: { size?: number }) {
  return (
    <svg className="h-mark" viewBox="0 0 120 120" width={size} height={size} aria-hidden="true">
      <circle cx="60" cy="60" r="40" fill="none" stroke="var(--line-strong)" strokeWidth="24" />
      <path d="M60 20A40 40 0 1 1 22.91 45.02" fill="none" stroke="var(--text)" strokeWidth="24" />
      <circle cx="22.91" cy="45.02" r="12" fill="var(--text)" />
    </svg>
  );
}

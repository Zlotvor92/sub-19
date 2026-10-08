/* SISTEM IKONICA: jedan skup linijskih ikonica, isti potez (1,8), isti raster 24 × 24, okrugli krajevi. Nema emodžija ni unicode znakova umesto ikonica.
   `Icon` služi za sve unutar ekrana; `TabIcon` je poseban jer su ikone tabova deo identiteta navigacije (aktivna je popunjenija). */

import type { ReactNode } from 'react';
import type { Tab } from '../../stores/uiStore';

export const TAB_LABELS: Record<Tab, string> = {
  danas: 'Danas',
  plan: 'Plan',
  napredak: 'Napredak',
  ti: 'Ti'
};

const common = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
  focusable: false
} as const;

export type IconName =
  | 'check'
  | 'chevron'
  | 'chevron-left'
  | 'chevron-down'
  | 'arrow'
  | 'arrow-up-right'
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
  | 'close'
  | 'link'
  | 'bell'
  | 'sun'
  | 'moon'
  | 'shield'
  | 'gauge'
  | 'pulse'
  | 'scale'
  | 'body'
  | 'refresh'
  | 'send'
  | 'watch'
  | 'download'
  | 'upload'
  | 'trash'
  | 'lock'
  | 'target'
  | 'logout'
  | 'user'
  | 'list'
  | 'book'
  | 'wand'
  | 'eye'
  | 'history'
  | 'cloud'
  | 'bug'
  | 'tag'
  | 'wind'
  | 'sliders';

const PATHS: Record<IconName, ReactNode> = {
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  chevron: <path d="M9 5l7 7-7 7" />,
  'chevron-left': <path d="M15 5l-7 7 7 7" />,
  'chevron-down': <path d="M5 9l7 7 7-7" />,
  arrow: <path d="M4 12h15M13 6l6 6-6 6" />,
  'arrow-up-right': <path d="M7 17L17 7M8.5 7H17v8.5" />,
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
  close: <path d="M6 6l12 12M18 6L6 18" />,
  link: (
    <>
      <path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1" />
      <path d="M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1" />
    </>
  ),
  bell: <path d="M6 16.5V11a6 6 0 1112 0v5.5l1.5 2h-15l1.5-2zM10 21h4" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="3.6" />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6L7 7M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4" />
    </>
  ),
  moon: <path d="M20 14.5A8 8 0 119.5 4a6.5 6.5 0 0010.5 10.5z" />,
  shield: <path d="M12 3l7 2.8v5.4c0 4.4-2.9 8-7 9.8-4.1-1.8-7-5.4-7-9.8V5.8L12 3z" />,
  gauge: (
    <>
      <path d="M4.5 17a7.5 7.5 0 1115 0" />
      <path d="M12 17l3.4-5" />
    </>
  ),
  pulse: <path d="M3 12h4l2-5 3 10 2-5h7" />,
  scale: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="4" />
      <path d="M8.5 10a5 5 0 017 0M12 10l1.4 2.2" />
    </>
  ),
  body: (
    <>
      <circle cx="12" cy="4.6" r="1.9" />
      <path d="M12 8.5v5.5M7.5 10.5h9M12 14l-3 6.5M12 14l3 6.5" />
    </>
  ),
  refresh: <path d="M20 11a8 8 0 00-14-4.5L4 9M4 4v5h5M4 13a8 8 0 0014 4.5L20 15M20 20v-5h-5" />,
  send: <path d="M12 16V4M7 9l5-5 5 5M5 20h14" />,
  watch: (
    <>
      <rect x="7" y="7" width="10" height="10" rx="3" />
      <path d="M9 7V3.5h6V7M9 17v3.5h6V17" />
    </>
  ),
  download: <path d="M12 4v12M7 11l5 5 5-5M5 20h14" />,
  upload: <path d="M12 16V4M7 9l5-5 5 5M5 20h14" />,
  trash: <path d="M5 7h14M10 7V4.5h4V7M7 7l.8 12.5h8.4L17 7" />,
  lock: (
    <>
      <rect x="5" y="11" width="14" height="9.5" rx="2.5" />
      <path d="M8 11V8a4 4 0 018 0v3" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.5" />
      <path d="M12 12v.01" />
    </>
  ),
  logout: <path d="M10 4H6a2 2 0 00-2 2v12a2 2 0 002 2h4M15 8l4 4-4 4M19 12H9" />,
  user: (
    <>
      <circle cx="12" cy="8" r="3.4" />
      <path d="M5.2 20c.7-3.7 3.4-5.6 6.8-5.6s6.1 1.9 6.8 5.6" />
    </>
  ),
  list: <path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01" />,
  book: <path d="M5 4.5h10a3 3 0 013 3V20H8a3 3 0 01-3-3V4.5zM5 17a3 3 0 013-3h10" />,
  wand: <path d="M5 19L16 8M14 6l4 4M18 3v3M16.5 4.5h3M6 5v2M5 6h2" />,
  eye: (
    <>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="2.8" />
    </>
  ),
  history: (
    <>
      <path d="M4 12a8 8 0 108-8 8.4 8.4 0 00-6 2.5L4 9" />
      <path d="M4 4v5h5M12 8v4l3 2" />
    </>
  ),
  cloud: <path d="M7 18a4.5 4.5 0 01-.6-8.96A6 6 0 0118 10.5 3.75 3.75 0 0117.25 18H7z" />,
  bug: (
    <>
      <rect x="8" y="8" width="8" height="11" rx="4" />
      <path d="M9.5 8a2.5 2.5 0 015 0M4 12h4M16 12h4M5 18l3-2M19 18l-3-2M5 7l3 2M19 7l-3 2" />
    </>
  ),
  tag: (
    <>
      <path d="M3.5 12.2V4.5a1 1 0 011-1h7.7l8.3 8.3a1 1 0 010 1.4l-7.4 7.4a1 1 0 01-1.4 0L3.5 12.2z" />
      <path d="M8 8v.01" />
    </>
  ),
  wind: <path d="M3 9h10a2.5 2.5 0 10-2.4-3M3 15h14a2.5 2.5 0 11-2.4 3M3 12h7" />,
  sliders: (
    <>
      <path d="M4 8h9M19 8h1M4 16h1M11 16h9" />
      <circle cx="16" cy="8" r="2.4" />
      <circle cx="8" cy="16" r="2.4" />
    </>
  )
};

export function Icon({
  name,
  size = 20,
  strokeWidth = 1.8
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

/** Ikone tabova (24 px). Aktivan tab dobija popunjenije telo, ne drugu boju: razlika se vidi i bez boje. */
export function TabIcon({ tab, active }: { tab: Tab; active?: boolean }) {
  const sw = active ? 2.1 : 1.8;
  switch (tab) {
    /* Danas: trkač. */
    case 'danas':
      return (
        <svg {...common} width="26" height="26" strokeWidth={sw}>
          <circle cx="15.2" cy="4.6" r="1.9" fill={active ? 'currentColor' : 'none'} />
          <path d="M13 8.6l-2.4 4.8" />
          <path d="M13 8.6L9 10.4M13 8.6l3.8 2.6" />
          <path d="M10.6 13.4l3.2 2.5-1.6 4.6" />
          <path d="M10.6 13.4L7.2 15.8 4.6 15.4" />
        </svg>
      );
    /* Plan: kalendar. */
    case 'plan':
      return (
        <svg {...common} width="26" height="26" strokeWidth={sw}>
          <rect x="4" y="5.5" width="16" height="14.5" rx="3" />
          <path d="M8 3.5v4M16 3.5v4M4 10.5h16" />
          <rect
            x="8"
            y="13.4"
            width="3"
            height="3"
            rx="0.8"
            fill={active ? 'currentColor' : 'none'}
          />
        </svg>
      );
    /* Napredak: stubovi. */
    case 'napredak':
      return (
        <svg {...common} width="26" height="26" strokeWidth={active ? 2.7 : 2.2}>
          <path d="M6 20v-6.5M12 20V5M18 20v-10.5" />
        </svg>
      );
    /* Ti: osoba. */
    case 'ti':
      return (
        <svg {...common} width="26" height="26" strokeWidth={sw}>
          <circle cx="12" cy="8" r="3.5" fill={active ? 'currentColor' : 'none'} />
          <path d="M5.2 20c.7-3.7 3.4-5.6 6.8-5.6s6.1 1.9 6.8 5.6" />
        </svg>
      );
  }
}

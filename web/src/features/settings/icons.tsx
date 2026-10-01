/* Ikonice sekcija u Podešavanjima — isti crtački jezik kao ikonice tabova (24×24, `stroke="currentColor"`, zaobljeni krajevi). Emodži se
   ne koriste: na svakom uređaju izgledaju drugačije i ne prate boju teksta. Ključ je NAZIV SEKCIJE. */

import type { ReactNode } from 'react';

export const SECTION_ICONS: Readonly<Record<string, ReactNode>> = {
  Nalog: (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="8.2" r="3.6" />
      <path d="M5.2 20c.6-3.5 3.4-5.8 6.8-5.8s6.2 2.3 6.8 5.8" />
    </svg>
  ),
  Plan: (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
      <path d="M8.5 6h11M8.5 12h11M8.5 18h11" />
      <circle cx="4.4" cy="6" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="4.4" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="4.4" cy="18" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  ),
  Strava: (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3.6v9.2" />
      <path d="M8.4 9.4 12 13l3.6-3.6" />
      <path d="M4.5 15.2v3.1a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-3.1" />
    </svg>
  ),
  'intervals.icu': (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3.2" y="5" width="17.6" height="14" rx="3" />
      <path d="M6.4 12.4h2.4l1.6-3.4 2.2 6.6 1.6-3.2h3.4" />
    </svg>
  ),
  'Slanje na sat': (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="6.4" y="6.4" width="11.2" height="11.2" rx="3.2" />
      <path d="M9.2 6.4 9.6 3h4.8l.4 3.4M9.2 17.6 9.6 21h4.8l.4-3.4" />
      <path d="M12 14.2v-4.4M10.3 11.5 12 9.8l1.7 1.7" />
    </svg>
  ),
  Vreme: (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M7.6 10.2a4 4 0 1 1 7.7-1.6" />
      <path d="M17.4 5.4l.9-.9M20.4 9h1.2M16.2 3.2V2" />
      <path d="M8 19.6h8.6a3.4 3.4 0 0 0 0-6.8 4.4 4.4 0 0 0-8.6 1.2A2.8 2.8 0 0 0 8 19.6Z" />
    </svg>
  ),
  Obaveštenja: (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 9.6a6 6 0 1 0-12 0c0 4.2-1.6 5.6-1.6 5.6h15.2S18 13.8 18 9.6Z" />
      <path d="M13.7 19.2a2 2 0 0 1-3.4 0" />
    </svg>
  ),
  Podaci: (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <ellipse cx="12" cy="6.2" rx="7.2" ry="2.8" />
      <path d="M4.8 6.2v11.6c0 1.55 3.22 2.8 7.2 2.8s7.2-1.25 7.2-2.8V6.2" />
      <path d="M19.2 12c0 1.55-3.22 2.8-7.2 2.8s-7.2-1.25-7.2-2.8" />
    </svg>
  ),
  Zajednica: (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="9" cy="8" r="3.3" />
      <path d="M3.2 19.2c.5-3.1 3-5.2 5.8-5.2s5.3 2.1 5.8 5.2" />
      <path d="M16.4 5.2a3.3 3.3 0 0 1 0 6.1M17.6 14.4c2.1.6 3.7 2.4 4.1 4.8" />
    </svg>
  ),
  'Obaveštenje korisnicima': (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="5.4" width="18" height="13.2" rx="2.6" />
      <path d="m3.8 7 7.1 5.2a2 2 0 0 0 2.2 0L20.2 7" />
    </svg>
  ),
  Korisnici: (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="8" cy="8.4" r="3" />
      <path d="M3 19c.4-2.9 2.5-4.8 5-4.8s4.6 1.9 5 4.8" />
      <path d="M15.2 8h5.6M15.2 12h5.6M15.2 16h5.6" />
    </svg>
  )
};

/* Jedinstvena instanca aplikacije za UI. Postavlja je `main.tsx` (u testovima — test). Komponente ne prave servise. */

import type { App } from './createApp';

let current: App | null = null;

export function setApp(app: App | null): void {
  current = app;
}

export function getApp(): App {
  if (!current) throw new Error('Aplikacija nije pokrenuta (setApp nije pozvan).');
  return current;
}

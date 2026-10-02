import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import type { Tab } from '../stores/uiStore';

/* Ekrani se učitavaju LENJO: Danas je ulaz, ostali se skidaju kad zatrebaju (početni paket ostaje mali). */
export const PAGES: Record<Tab, LazyExoticComponent<ComponentType>> = {
  danas: lazy(() => import('./today')),
  plan: lazy(() => import('./plan')),
  opor: lazy(() => import('./recovery')),
  pred: lazy(() => import('./race')),
  zajed: lazy(() => import('./community'))
};

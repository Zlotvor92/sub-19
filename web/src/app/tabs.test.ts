import { describe, expect, it } from 'vitest';
import { TABS, VISIBLE_TABS } from '../stores/uiStore';
import { dayFromSearch, initialTab } from './tabs';

/* parity: pocetnaStrana, otvoriIzAdrese (app.js). */

describe('ulaz iz adrese', () => {
  it('?dan=<id> prolazi samo ispravnog oblika; podmetnuto se odbija', () => {
    expect(dayFromSearch('?dan=g3d2')).toBe('g3d2');
    expect(dayFromSearch('?dan=n7d3&tab=plan')).toBe('n7d3');
    for (const bad of [
      '',
      '?dan=',
      '?dan=https://tudje.rs',
      '?dan=../../tajna',
      '?dan=a%20b',
      `?dan=${'x'.repeat(65)}`,
      '?nesto=1'
    ])
      expect(dayFromSearch(bad), bad).toBeNull();
  });

  it('?tab= ima prednost nad zapamćenim ekranom; nepoznato pada na Danas', () => {
    const storage = { getItem: () => 'opor' };
    expect(initialTab('?tab=plan', storage)).toBe('plan');
    expect(initialTab('', storage)).toBe('opor');
    expect(initialTab('?tab=nepostojeci', undefined)).toBe('danas');
  });

  it('Zajednica je ugašena: ni adresa ni zapamćen ekran ne mogu da je otvore, a kod i dalje poznaje ekran', () => {
    expect(TABS).toContain('zajed');
    expect(VISIBLE_TABS).not.toContain('zajed');
    expect(VISIBLE_TABS).toEqual(['danas', 'plan', 'opor', 'pred']);
    expect(initialTab('?tab=zajed', undefined)).toBe('danas');
    expect(initialTab('', { getItem: () => 'zajed' })).toBe('danas');
  });
});

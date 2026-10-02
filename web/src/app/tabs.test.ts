import { describe, expect, it } from 'vitest';
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
});

import { describe, expect, it } from 'vitest';
import { TABS } from '../stores/uiStore';
import { dayFromSearch, initialRoute, initialTab } from './tabs';

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
    const storage = { getItem: () => 'napredak' };
    expect(initialTab('?tab=plan', storage)).toBe('plan');
    expect(initialTab('', storage)).toBe('napredak');
    expect(initialTab('?tab=nepostojeci', undefined)).toBe('danas');
  });

  it('četiri taba; Zajednica je ugašena i nema svoj tab: ni adresa ni zapamćen ekran ne mogu da je otvore', () => {
    expect(TABS).toEqual(['danas', 'plan', 'napredak', 'ti']);
    expect(initialTab('?tab=zajed', undefined)).toBe('danas');
    expect(initialTab('', { getItem: () => 'zajed' })).toBe('danas');
  });

  it('stari nazivi tabova (prečice na ikoni, otvorene kartice) vode na Napredak', () => {
    /* `opor` i `pred` su ranije bili tabovi; manifest i zapamćen ekran ih još nose */
    expect(initialRoute('?tab=opor')).toEqual({
      tab: 'napredak',
      screen: { kind: 'oporavak' }
    });
    expect(initialRoute('?tab=pred')).toEqual({ tab: 'napredak', screen: { kind: 'forma' } });
    /* zapamćen stari naziv otvara samo tab; ekran se ne otvara pri svakom osvežavanju */
    expect(initialRoute('', { getItem: () => 'opor' })).toEqual({ tab: 'napredak' });
    expect(initialRoute('', { getItem: () => 'pred' })).toEqual({ tab: 'napredak' });
    expect(initialTab('?tab=opor')).toBe('napredak');
  });
});

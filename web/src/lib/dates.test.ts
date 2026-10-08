import { describe, expect, it } from 'vitest';
import { dayOfMonth, dowInitial, dowLong, dowLongCap } from './dates';

describe('prikaz datuma za ekran', () => {
  it('dan u nedelji se računa iz datuma (14.1.2026 je sreda)', () => {
    expect(dowLong('2026-01-14')).toBe('sreda');
    expect(dowLongCap('2026-01-14')).toBe('Sreda');
    expect(dowInitial('2026-01-14')).toBe('S');
    expect(dowLongCap('2026-01-18')).toBe('Nedelja');
    expect(dowInitial('2026-01-12')).toBe('P');
    expect(dowLong('2026-01-15')).toBe('četvrtak');
  });

  it('dan u mesecu bez vodeće nule', () => {
    expect(dayOfMonth('2026-01-05')).toBe('5');
    expect(dayOfMonth('2026-01-31')).toBe('31');
  });

  it('nevažeći ili prazan datum daje crticu, ne izuzetak ni „undefined“', () => {
    for (const bad of ['', 'ne-datum', '2026-13-40', null, undefined]) {
      expect(dowLong(bad)).toBe('—');
      expect(dowLongCap(bad)).toBe('—');
      expect(dowInitial(bad)).toBe('—');
      expect(dayOfMonth(bad)).toBe('—');
    }
  });
});

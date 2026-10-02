import { describe, expect, it } from 'vitest';
import type { IsoDate } from '../../domain/date';
import type { PainStatus } from '../../domain/recovery';
import type { WellnessRecord } from '../../domain/state';
import { readinessModel, splitAdvice } from './readiness';

const TODAY = '2026-01-14' as IsoDate;
const OK: PainStatus = { cls: 'ok', t: 'Bez povreda', s: '0 = bez bola · 3–5 = pazi' };
const LOAD_OK = { acute: 30, chronic: 28, ratio: 1.07 };
const day = (n: number): string => new Date(Date.UTC(2026, 0, 14 - n)).toISOString().slice(0, 10);

function wellness(
  lastAge: number,
  hrvToday: number,
  hrvBefore = 60
): Record<string, WellnessRecord> {
  const w: Record<string, WellnessRecord> = {};
  for (let i = lastAge + 8; i >= lastAge; i--) {
    const d = day(i);
    w[d] = {
      datum: d,
      hrv: i === lastAge ? hrvToday : hrvBefore,
      pulsUMiru: 46,
      sanH: 7.4
    } as WellnessRecord;
  }
  return w;
}

describe('readinessModel', () => {
  it('sve u granicama: „Bez upozorenja", plan po planu, signali kojih nema su navedeni', () => {
    const r = readinessModel({ status: OK, load: LOAD_OK, wellness: {}, today: TODAY });
    expect(r.tone).toBe('green');
    expect(r.word).toBe('Bez upozorenja');
    expect(r.action).toBe('Radi plan kako piše.');
    expect(r.why).toBe('U granicama: bol i opterećenje.');
    expect(r.missing).toEqual(['HRV', 'puls u miru', 'san']);
  });

  it('bol 6+: odlučuje bol, razlog i savet su razdvojeni, bol je prvi red', () => {
    const status: PainStatus = {
      cls: 'stop',
      t: 'STANI',
      s: 'Bol 6+ u poslednjih 7 dana. Pravilo iz plana: stani.'
    };
    const r = readinessModel({ status, load: LOAD_OK, wellness: {}, today: TODAY });
    expect(r.tone).toBe('red');
    expect(r.word).toBe('Stani');
    expect(r.why).toBe('Bol 6+ u poslednjih 7 dana.');
    expect(r.action).toBe('Pravilo iz plana: stani.');
    expect(r.signals[0]?.key).toBe('bol');
  });

  it('opterećenje preko 1,5: „Skrati"; pojas 1,3–1,5 samo upozorava i ne menja plan', () => {
    const red = readinessModel({
      status: OK,
      load: { acute: 48, chronic: 30, ratio: 1.6 },
      wellness: {},
      today: TODAY
    });
    expect(red.tone).toBe('red');
    expect(red.word).toBe('Skrati');
    expect(red.action).toBe('Skrati sledeću nedelju.');
    const amber = readinessModel({
      status: OK,
      load: { acute: 40, chronic: 29, ratio: 1.38 },
      wellness: {},
      today: TODAY
    });
    expect(amber.tone).toBe('amber');
    expect(amber.word).toBe('Pazi');
    expect(amber.action).toBe('Sledeća nedelja ne sme da bude veća od ove.');
  });

  it('najlošiji signal odlučuje, a ostala upozorenja se navode', () => {
    const status: PainStatus = {
      cls: 'warn',
      t: 'PAZI',
      s: 'Bol 3–5 u poslednjih 7 dana. Prati i smanji ako raste.'
    };
    /* HRV 48 prema osnovi 60 = −20 % → crveno; bol je žut */
    const r = readinessModel({ status, load: LOAD_OK, wellness: wellness(0, 48), today: TODAY });
    expect(r.tone).toBe('red');
    expect(r.word).toBe('Olakšaj');
    expect(r.signals[0]?.key).toBe('hrv');
    expect(r.signals[0]?.note).toBe('−20% od osnove 60');
    expect(r.why).toMatch(/^HRV je ispod tvoje sedmodnevne osnove/);
    expect(r.why).toMatch(/Još upozorenja: bol\.$/);
    expect(r.action).toBe('Oporavak zaostaje: lakši dan.');
  });

  it('jutarnji zapis stariji od jednog dana ne ulazi u ocenu', () => {
    const r = readinessModel({
      status: OK,
      load: LOAD_OK,
      wellness: wellness(5, 40),
      today: TODAY
    });
    expect(r.tone).toBe('green');
    const rec = r.signals.find((s) => s.key === 'zapis');
    expect(rec?.state).toBe('Star zapis');
    expect(r.signals.some((s) => s.key === 'hrv')).toBe(false);
  });

  it('bez ijednog signala sa podatkom: „Nema signala", ne „sve je u redu"', () => {
    const r = readinessModel({
      status: { cls: 'ok', t: 'Bez povreda', s: '' },
      load: { acute: 0, chronic: null, ratio: null },
      wellness: {},
      today: TODAY
    });
    /* bol bez unosa je zeleno, pa je ocena zelena; opterećenje bez osnove je neutralno i ne ulazi u „u granicama" */
    expect(r.tone).toBe('green');
    expect(r.why).toBe('U granicama: bol.');
    expect(r.signals.find((s) => s.key === 'opterecenje')?.state).toBe('Nema podataka');
  });
});

describe('splitAdvice', () => {
  it('deli razlog od saveta po crti ili po rečenici', () => {
    expect(splitAdvice('3+ dana sa bolom ≥3 u poslednjih 7 dana — zakaži pregled.')).toEqual({
      meaning: '3+ dana sa bolom ≥3 u poslednjih 7 dana.',
      action: 'Zakaži pregled.'
    });
    expect(splitAdvice('Bol 3–5 u poslednjih 7 dana. Prati i smanji ako raste.')).toEqual({
      meaning: 'Bol 3–5 u poslednjih 7 dana.',
      action: 'Prati i smanji ako raste.'
    });
    expect(splitAdvice('Samo jedna rečenica')).toEqual({
      meaning: 'Samo jedna rečenica',
      action: null
    });
  });
});

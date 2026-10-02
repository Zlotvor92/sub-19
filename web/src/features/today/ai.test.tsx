import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setApp } from '../../app/appContext';
import type { App } from '../../app/createApp';
import { adaptGeneratedPlan } from '../../domain/plan/adapt';
import { resolvePlan, type ResolvedDay } from '../../domain/plan';
import { seedState, type LogEntry, type PersistedState } from '../../domain/state';
import { generatePlan } from '../../domain/training/generator/generatePlan';
import { ADMIN_UID } from '../../services/config';
import { hydratePersisted, useTrainingStore } from '../../stores';
import { useAuthStore } from '../../stores/authStore';
import { AiCard } from './AiCard';

/* parity: aiKarta / aiTelo / vezAnalize (app.js): stanja kartice, tekst bez HTML-a, pokretanje i ponovni pokušaj. */

function state(log: Record<string, LogEntry>): { st: PersistedState; day: ResolvedDay } {
  const st = JSON.parse(JSON.stringify(seedState())) as PersistedState;
  const gen = adaptGeneratedPlan(
    generatePlan({
      startDate: '2026-01-05',
      raceDate: '2026-04-12',
      raceDistM: 10000,
      pb: { distM: 10000, sec: 2700 },
      weeklyKm: 40,
      runDays: 5,
      quality: 2,
      intensity: 'std',
      trainedRecently: true
    })
  );
  if (!gen) throw new Error('plan');
  st.genPlan = gen;
  const day = resolvePlan(gen.weeks, { alts: {}, moves: {} }).dated.find(
    (d) => d.tag === 'lako' && !!d.date
  ) as ResolvedDay;
  st.log = {
    [day.id]: { status: 'done', km: 8, sec: 2800, hr: 150, ts: day.date, ...log['x'] }
  };
  return { st, day };
}

const run = vi.fn();
const retry = vi.fn();
beforeEach(() => {
  run.mockReset();
  retry.mockReset();
  setApp({ ai: { run, retry } } as unknown as App);
  useAuthStore.setState({ hasSession: true, userId: 'u1' });
});
afterEach(() => setApp(null));

const mount = (extra: LogEntry = {}) => {
  const { st, day } = state({ x: extra });
  hydratePersisted(st);
  return { day, ...render(<AiCard day={day} />) };
};

describe('AI kartica', () => {
  it('nema je dok trening nema km i vreme, i za dane koji nisu trčanje', () => {
    const { st, day } = state({});
    (st.log[day.id] as LogEntry).sec = 0;
    hydratePersisted(st);
    const { container } = render(<AiCard day={day} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('ponuda: jedan red sa izvorom i brojem preostalih; klik šalje zahtev sa podacima koje aplikacija već ima', async () => {
    run.mockResolvedValue({ phase: 'gotovo', error: null });
    const { day } = mount();
    expect(screen.getByText('Analiziraj trening')).toBeInTheDocument();
    expect(screen.getByText('samo prosek cele sesije · 2 preostale')).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button'));
    expect(run).toHaveBeenCalledTimes(1);
    const [dayId, payload] = run.mock.calls[0] as [
      string,
      { session: { tag: string }; entered: { km: number; hr: number } }
    ];
    expect(dayId).toBe(day.id);
    expect(payload.session.tag).toBe('lako');
    expect(payload.entered).toMatchObject({ km: 8, hr: 150, time: '46:40' });
  });

  it('ishod: greška servera se prikazuje u kartici', async () => {
    run.mockResolvedValueOnce({ phase: 'greska', error: 'Dnevni limit — još 2h' });
    mount();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button'));
    expect(await screen.findByText('Dnevni limit — još 2h')).toBeInTheDocument();
  });

  it('gotovo: tekst sa podebljanim i pasusima, bez HTML-a; „ponovo" samo dok ima preostalih', () => {
    mount({
      aiText: '**Dobro** trčanje.\nDrugi red.\n\n<img src=x onerror=alert(1)> kraj',
      aiCount: 1
    });
    expect(screen.getByText('Dobro').tagName).toBe('STRONG');
    expect(document.querySelectorAll('.ai-out p')).toHaveLength(2);
    expect(document.querySelector('.ai-out img')).toBeNull();
    expect(screen.getByText(/<img src=x onerror=alert\(1\)> kraj/)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Analiziraj ponovo · 1 preostala' })
    ).toBeInTheDocument();
  });

  it('obe iskorišćene sa tekstom: nema dugmeta; bez teksta: „iskorišćene obe"', () => {
    const a = mount({ aiText: 'Tekst.', aiCount: 2 });
    expect(screen.queryByRole('button')).toBeNull();
    a.unmount();
    mount({ aiCount: 2 });
    expect(screen.getByText('iskorišćene obe za ovaj trening')).toBeInTheDocument();
  });

  it('vlasnik nema limit', () => {
    useAuthStore.setState({ hasSession: true, userId: ADMIN_UID });
    mount({ aiCount: 5 });
    expect(screen.getByText('samo prosek cele sesije · bez ograničenja')).toBeInTheDocument();
  });

  it('posao koji traje ima prednost nad starim tekstom; zaglavljen posao nudi ponovno slanje koje ne troši analizu', async () => {
    retry.mockResolvedValue({ phase: 'radi', error: null });
    const fresh = mount({
      aiText: 'Stara analiza.',
      aiPosao: { id: 'j1', at: Date.now() }
    });
    expect(screen.getByText(/Nova analiza je u toku/)).toBeInTheDocument();
    expect(screen.getByText('prethodna analiza')).toBeInTheDocument();
    expect(screen.getByText('Stara analiza.')).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
    fresh.unmount();

    mount({ aiPosao: { id: 'j1', at: Date.now() - 6 * 60e3 } });
    expect(screen.getByText(/Analiza traje duže nego što bi trebalo/)).toBeInTheDocument();
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Pokušaj ponovo · ne troši analizu' }));
    await waitFor(() => expect(retry).toHaveBeenCalledTimes(1));
    expect(run).not.toHaveBeenCalled();
    expect(useTrainingStore.getState().log).toBeDefined();
  });
});

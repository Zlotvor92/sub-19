import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { adaptGeneratedPlan } from '../../domain/plan/adapt';
import { resolvePlan, type ResolvedDay, type ResolvedPlan } from '../../domain/plan';
import { seedState, type LogEntry, type PersistedState } from '../../domain/state';
import { generatePlan } from '../../domain/training/generator/generatePlan';
import { hydratePersisted, useTrainingStore } from '../../stores';
import { useUIStore } from '../../stores/uiStore';
import type { CycleModel } from '../cycle/cycle';
import { ActivitiesScreen } from './ActivitiesScreen';
import { activityRows, recentWeeks } from './model';
import ProgressPage from './index';

/* Napredak: da li se rad sabira. Model je čisto čitanje onoga što aplikacija već ima (plan, dnevnik, ciklus) — ovde se drži da ništa ne izmišlja. */

function freshState(): PersistedState {
  const s = JSON.parse(JSON.stringify(seedState())) as PersistedState;
  const a = adaptGeneratedPlan(
    generatePlan({
      startDate: '2026-01-05',
      raceDate: '2026-04-12',
      raceDistM: 10000,
      pb: { distM: 10000, sec: 2700 },
      goalSec: 2520,
      weeklyKm: 40,
      runDays: 5,
      quality: 2,
      intensity: 'std',
      trainedRecently: true
    })
  );
  if (!a) throw new Error('plan');
  s.genPlan = a;
  return s;
}
const planOf = (s: PersistedState): ResolvedPlan => {
  if (!s.genPlan) throw new Error('nema plana');
  return resolvePlan(s.genPlan.weeks, { alts: {}, moves: {} });
};
const runs = (plan: ResolvedPlan): ResolvedDay[] =>
  plan.dated.filter((d) => !d.rest && !d.test && (d.km ?? 0) > 0);

beforeEach(() => {
  hydratePersisted(freshState());
  useUIStore.setState({ today: '2026-01-14', screens: [], sheet: null, confirm: null });
});

describe('recentWeeks', () => {
  const w = (n: number, state: 'done' | 'now' | 'future') => ({
    w: n,
    state,
    realKm: n * 10,
    planKm: n * 12
  });
  const cycle = (weeks: ReturnType<typeof w>[]): CycleModel =>
    ({ weeks, phases: [], current: null, total: weeks.length }) as unknown as CycleModel;

  it('bez ciklusa ili bez nedelja nema ničega', () => {
    expect(recentWeeks(null)).toEqual([]);
    expect(recentWeeks(cycle([]))).toEqual([]);
  });

  it('poslednje četiri započete nedelje; buduće se ne računaju', () => {
    const c = cycle([
      w(1, 'done'),
      w(2, 'done'),
      w(3, 'done'),
      w(4, 'done'),
      w(5, 'now'),
      w(6, 'future')
    ]);
    expect(recentWeeks(c).map((x) => x.w)).toEqual([2, 3, 4, 5]);
    expect(recentWeeks(c, 2).map((x) => x.w)).toEqual([4, 5]);
  });

  it('pre početka plana nema nijedne nedelje', () => {
    expect(recentWeeks(cycle([w(1, 'future'), w(2, 'future')]))).toEqual([]);
  });
});

describe('activityRows', () => {
  it('samo odrađeno ili sa kilometrima i vremenom; najnovije prvo; pravi datum trčanja ima prednost', () => {
    const s = freshState();
    const plan = planOf(s);
    const [a, b, c] = runs(plan) as [ResolvedDay, ResolvedDay, ResolvedDay];
    const log: Record<string, LogEntry> = {
      [a.id]: { status: 'done', km: 8, sec: 2400, ts: a.date },
      [b.id]: { status: 'done', km: 10, sec: 3000, ts: b.date, runDate: '2026-02-01', hr: 150.4 },
      [c.id]: { status: 'pending' }
    };
    const rows = activityRows(plan, log, {});
    expect(rows.map((r) => r.id)).toEqual([b.id, a.id]);
    expect(rows[0]).toMatchObject({
      date: '2026-02-01',
      km: 10,
      sec: 3000,
      paceSec: 300,
      hr: 150.4
    });
    expect(rows[1]?.paceSec).toBe(300);
  });

  it('izvor: Strava, intervals.icu ili ručno; unos van plana nosi naziv sa servisa', () => {
    const plan = planOf(freshState());
    const [a, b, c] = runs(plan) as [ResolvedDay, ResolvedDay, ResolvedDay];
    const log: Record<string, LogEntry> = {
      [a.id]: { status: 'done', src: 'strava' },
      [b.id]: { status: 'done', src: 'icu-wellness' },
      [c.id]: { status: 'done' },
      'trka-1': {
        status: 'done',
        km: 5,
        sec: 1250,
        ts: '2026-01-10',
        stravaName: 'Parkrun'
      }
    };
    const by = Object.fromEntries(activityRows(plan, log, {}).map((r) => [r.id, r]));
    expect(by[a.id]?.source).toBe('strava');
    expect(by[b.id]?.source).toBe('icu');
    expect(by[c.id]?.source).toBe('manual');
    expect(by['trka-1']).toMatchObject({ dayId: null, title: 'Parkrun', source: 'manual' });
  });

  it('neispravni unosi se preskaču, bez izuzetka', () => {
    const plan = planOf(freshState());
    const log = { x: null, y: 5, z: { status: 'done', km: 'mnogo', sec: -1 } } as unknown as Record<
      string,
      LogEntry
    >;
    const rows = activityRows(plan, log, {});
    expect(rows.map((r) => r.id)).toEqual(['z']);
    expect(rows[0]).toMatchObject({ km: null, sec: null, paceSec: null });
  });
});

describe('Napredak (ekran)', () => {
  it('bez plana ne crta ništa', () => {
    hydratePersisted(JSON.parse(JSON.stringify(seedState())) as PersistedState);
    useUIStore.setState({ today: '2026-01-14' });
    const { container } = render(<ProgressPage />);
    expect(container).toBeEmptyDOMElement();
  });

  it('pre početka plana: kaže da nema nedelja, a ulazi u detalje postoje', () => {
    useUIStore.setState({ today: '2025-12-20' });
    render(<ProgressPage />);
    expect(screen.getByText('Još nema nedelja za prikaz')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Još nema odrađenih treninga. Kad završiš prvi ili povežeš Stravu, pojaviće se ovde.'
      )
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Forma i predikcija/ })).toBeInTheDocument();
  });

  it('kilometri po nedeljama se sabiraju, a opis grafikona nosi iste brojeve', () => {
    const plan = planOf(freshState());
    const [a, b] = runs(plan).filter((d) => d.date <= '2026-01-14') as [ResolvedDay, ResolvedDay];
    act(() =>
      useTrainingStore.setState({
        log: {
          [a.id]: { status: 'done', km: 8, sec: 2400, ts: a.date },
          [b.id]: { status: 'done', km: 6.5, sec: 2000, ts: b.date }
        }
      })
    );
    const { container } = render(<ProgressPage />);
    expect(container.querySelector('.prog-km .hero-v')).toHaveTextContent('14,5');
    expect(screen.getByRole('img', { name: /^Kilometri po nedeljama: N1 / })).toBeInTheDocument();
    expect(screen.getByText('Poslednja aktivnost')).toBeInTheDocument();
  });

  it('svaki ulaz u detalje otvara svoj ekran', async () => {
    const user = userEvent.setup();
    render(<ProgressPage />);
    const more = screen
      .getByRole('heading', { name: 'Detaljnije' })
      .closest('section') as HTMLElement;
    const open = async (name: RegExp, kind: string): Promise<void> => {
      await user.click(within(more).getByRole('button', { name }));
      expect(useUIStore.getState().screens.at(-1)?.kind).toBe(kind);
    };
    await open(/^Forma i predikcija/, 'forma');
    await open(/^Oporavak/, 'oporavak');
    await open(/^Bol/, 'bol');
    await open(/^Telesna masa/, 'masa');
    await open(/^Analiza trke/, 'analiza-trke');
  });

  it('poslednja aktivnost otvara Detalje tog dana, a „Sve aktivnosti“ spisak', async () => {
    const user = userEvent.setup();
    const [a] = runs(planOf(freshState())) as [ResolvedDay];
    act(() =>
      useTrainingStore.setState({
        log: { [a.id]: { status: 'done', km: 8, sec: 2400, ts: a.date } }
      })
    );
    render(<ProgressPage />);
    await user.click(screen.getByRole('button', { name: /8 km/ }));
    expect(useUIStore.getState().screens.at(-1)).toMatchObject({
      kind: 'trening',
      props: { id: a.id }
    });
    await user.click(screen.getByRole('button', { name: 'Sve aktivnosti' }));
    expect(useUIStore.getState().screens.at(-1)?.kind).toBe('aktivnosti');
  });
});

describe('Sve aktivnosti', () => {
  it('bez odrađenih treninga: jedna rečenica umesto praznog ekrana', () => {
    render(<ActivitiesScreen />);
    expect(screen.getByText(/Još nema odrađenih treninga/)).toBeInTheDocument();
  });

  it('spisak je najnoviji prvi, sa izvorom; dodir otvara Detalje; starije se dodaju po 30', async () => {
    const user = userEvent.setup();
    const plan = planOf(freshState());
    const all = runs(plan);
    const log: Record<string, LogEntry> = {};
    for (const d of all)
      log[d.id] = { status: 'done', km: d.km ?? 5, sec: 1500, ts: d.date, src: 'strava' };
    act(() => useTrainingStore.setState({ log }));
    render(<ActivitiesScreen />);
    expect(screen.getByRole('heading', { level: 1, name: 'Sve aktivnosti' })).toBeInTheDocument();
    const rows = document.querySelectorAll('.rows > .row');
    expect(rows).toHaveLength(Math.min(30, all.length));
    expect(rows[0]?.textContent).toContain('Strava · sinhronizovano');
    const newest = [...all].sort((x, y) => (x.date < y.date ? 1 : -1))[0] as ResolvedDay;
    await user.click(rows[0] as HTMLElement);
    expect(useUIStore.getState().screens.at(-1)).toMatchObject({
      kind: 'trening',
      props: { id: newest.id }
    });
    if (all.length > 30) {
      await user.click(screen.getByRole('button', { name: 'Prikaži starije' }));
      expect(document.querySelectorAll('.rows > .row').length).toBeGreaterThan(30);
    } else expect(screen.queryByRole('button', { name: 'Prikaži starije' })).toBeNull();
  });
});

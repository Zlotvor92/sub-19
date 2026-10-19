import { useMemo, useState } from 'react';
import { Section } from '../../components/ui/primitives';
import { fmtDayMonth } from '../../domain/format';
import { getPlanRevisions } from '../../domain/plan/versions';
import { useRecoveryStore, useSettingsStore, useTrainingStore } from '../../stores';
import {
  commitPlanChange,
  previewMarathonV2,
  previewRestore,
  type PlanChangePreview
} from '../../stores/executionActions';

type ReadyPreview = Extract<PlanChangePreview, { ok: true }>;
type WeekView = NonNullable<NonNullable<ReadyPreview['marathonV2']>['weeks'][number]['before']>;
const kmText = (km: number | null | undefined): string =>
  km == null ? '—' : km.toFixed(1).replace('.', ',');
const arrow = (a: string, b: string): string => (a === b ? a : `${a} → ${b}`);
const DAYS = ['7', '14', '21', '28'] as const;

/* PRILAGOĐAVANJE PLANA MARATONA v2 (segment MAR-06): isti tok kao HM v2 (06), kopija — pregled
   iz činjenica odmah pri otvaranju (isti pregled vodi i traka „Plan treba prilagoditi"), potvrda korisnika, upis kao nova revizija. Potpunost zapisa se nikad ne
   pretpostavlja: potvrđuje je sinhronizacija (potpuna danas — sve aktivnosti preuzete i obrađene) ili korisnik ovde.
   Pauzu korisnik prijavljuje ovde (nedostatak zapisa je ne potvrđuje). */
export function MarathonV2Adjustment({ today }: { today: string }) {
  const training = useTrainingStore();
  useRecoveryStore((s) => s.knee);
  useRecoveryStore((s) => s.vanPlanaV2);
  useSettingsStore((s) => s.strava);
  useSettingsStore((s) => s.icu);
  const revisions = useMemo(() => getPlanRevisions(training.genPlan), [training.genPlan]);
  const [confirmed, setConfirmed] = useState(false);
  const [days, setDays] = useState<string>('14');
  const [breaks, setBreaks] = useState<Array<{ from: string; to: string }>>([]);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [result, setResult] = useState<PlanChangePreview | null>(() => previewMarathonV2(today));
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const review = (
    opts: { confirmed?: boolean; days?: string; breaks?: typeof breaks } = {}
  ): void => {
    const c = opts.confirmed ?? confirmed;
    const n = Number(opts.days ?? days);
    setMessage('');
    setError('');
    setResult(
      previewMarathonV2(today, { confirmedDays: c ? n : null, breaks: opts.breaks ?? breaks })
    );
  };
  const addBreak = (): void => {
    if (!from || !to || from > to || to > today) {
      setError('Pauza: unesi datume od–do, najkasnije danas, „od" pre „do".');
      return;
    }
    const next = [...breaks, { from, to }];
    setBreaks(next);
    setFrom('');
    setTo('');
    review({ breaks: next });
  };
  const apply = (): void => {
    if (!result?.ok) return;
    const r = commitPlanChange(result);
    setResult(null);
    if (!r.ok) {
      setError(r.reason);
      return;
    }
    setMessage(
      'Plan je prilagođen. Prethodni plan je sačuvan u istoriji (Prethodne verzije plana).'
    );
  };

  const preview = result?.ok ? result : null;
  const v2 = preview?.marathonV2;
  const rejected = result && !result.ok ? result : null;
  const row = (b: WeekView | null, a: WeekView | null, k: 'targetKm' | 'plannedKm'): string =>
    arrow(kmText(b?.[k]), kmText(a?.[k]));

  return (
    <>
      <Section title="Prilagođavanje plana" id="v2-adapt">
        <p className="prop-m">
          Plan se prilagođava iz onoga što je zapisano: treninzi (ručno i sa sata), bol, test 5 km
          (na danu testa), unete trke (5 ili 10 km, polumaraton, maraton) i prijavljene pauze. Ništa
          se ne menja dok ne potvrdiš pregled.
        </p>
        <label className="note-src" htmlFor="v2-complete">
          <input
            id="v2-complete"
            type="checkbox"
            checked={confirmed}
            onChange={(e) => {
              setConfirmed(e.target.checked);
              review({ confirmed: e.target.checked });
            }}
          />{' '}
          Zapis treninga za proteklih{' '}
          <select
            aria-label="Broj dana potpunog zapisa"
            value={days}
            onChange={(e) => {
              setDays(e.target.value);
              if (confirmed) review({ days: e.target.value });
            }}
          >
            {DAYS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>{' '}
          dana je potpun (dan bez zapisa = nisam trčao)
        </label>
        <div className="alt-block">
          <p className="note-src">Pauza (nisam trčao):</p>
          <div className="btnrow start">
            <input
              type="date"
              aria-label="Pauza od"
              value={from}
              max={today}
              onChange={(e) => setFrom(e.target.value)}
            />
            <input
              type="date"
              aria-label="Pauza do"
              value={to}
              max={today}
              onChange={(e) => setTo(e.target.value)}
            />
            <button type="button" className="btn ghost sm" onClick={addBreak}>
              Dodaj pauzu
            </button>
          </div>
          {breaks.map((b) => (
            <p className="note-src" key={`${b.from}-${b.to}`}>
              Pauza {fmtDayMonth(b.from)} – {fmtDayMonth(b.to)}{' '}
              <button
                type="button"
                className="btn ghost sm"
                onClick={() => {
                  const next = breaks.filter((x) => x !== b);
                  setBreaks(next);
                  review({ breaks: next });
                }}
              >
                Ukloni
              </button>
            </p>
          ))}
        </div>
        <div className="btnrow start">
          <button type="button" className="btn ghost" onClick={() => review()}>
            Pregledaj prilagođavanje
          </button>
        </div>
      </Section>

      {rejected ? (
        <Section
          title={rejected.reasons ? 'Plan nije prilagođen' : 'Promena nije moguća'}
          id="v2-adapt-rejected"
        >
          <div role="status">
            <p className="prop-m">{rejected.reason}</p>
            {(rejected.reasons ?? []).map((r) => (
              <p className="note-src" key={r}>
                {r}
              </p>
            ))}
          </div>
        </Section>
      ) : null}

      {preview ? (
        <Section title="Pregled promene" id="plan-change-preview">
          <p className="prop-m">{preview.summary}</p>
          {v2 ? (
            <>
              <ul aria-label="Razlozi prilagođavanja">
                {v2.reasons.map((r) => (
                  <li className="note-src" key={`${r.condition}-${r.message}`}>
                    {r.message}
                    {r.applied ? '' : ' (ne primenjuje se)'}
                  </li>
                ))}
              </ul>
              {v2.weeks.length ? (
                <div className="race-data" style={{ overflowX: 'auto' }}>
                  <table aria-label="Promenjene nedelje">
                    <thead>
                      <tr>
                        <th scope="col">Nedelja</th>
                        <th scope="col">Cilj, km</th>
                        <th scope="col">Plan, km</th>
                        <th scope="col">Kvalitet</th>
                      </tr>
                    </thead>
                    <tbody>
                      {v2.weeks.map((w) => (
                        <tr key={w.week}>
                          <th scope="row">{w.week}</th>
                          <td>{row(w.before, w.after, 'targetKm')}</td>
                          <td>{row(w.before, w.after, 'plannedKm')}</td>
                          <td>{arrow(w.before?.quality ?? '—', w.after?.quality ?? '—')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="note-src">Budući deo plana se ne menja.</p>
              )}
              <p className="note-src">
                Km nedelje su kao u planu v2: trka se ne računa u obim nedelje.
              </p>
            </>
          ) : (
            <div className="race-data" style={{ overflowX: 'auto' }}>
              <table aria-label="Preostali km pre i posle promene">
                <thead>
                  <tr>
                    <th scope="col">Nedelja</th>
                    <th scope="col">Pre, km</th>
                    <th scope="col">Posle, km</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.changes.slice(0, 6).map((c) => (
                    <tr key={c.week}>
                      <th scope="row">{c.week}</th>
                      <td>{kmText(c.beforeKm)}</td>
                      <td>{kmText(c.afterKm)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {preview.notes.map((note) => (
            <p className="note-src" key={note}>
              {note}
            </p>
          ))}
          <div className="btnrow start">
            <button
              type="button"
              className="btn"
              onClick={apply}
              disabled={!!v2 && v2.weeks.length === 0}
            >
              Primeni prikazanu promenu
            </button>
            <button type="button" className="btn ghost" onClick={() => setResult(null)}>
              Odustani
            </button>
          </div>
        </Section>
      ) : null}

      {revisions.length ? (
        <Section title="Prethodne verzije plana" id="plan-revisions">
          <p className="note-src">
            Čuvamo poslednjih pet verzija. Vraćanje menja samo buduće treninge koji nisu odrađeni ni
            ručno izmenjeni; dnevnik ostaje.
          </p>
          {[...revisions].reverse().map((revision) => (
            <div className="alt-block" key={revision.id}>
              <p className="note-src">
                {fmtDayMonth(revision.date)} · {revision.summary}
              </p>
              <button
                type="button"
                className="btn ghost sm"
                onClick={() => {
                  setMessage('');
                  setError('');
                  setResult(previewRestore(revision.id, today));
                }}
                aria-label={`Pregledaj vraćanje: ${revision.summary}`}
              >
                Pregledaj vraćanje
              </button>
            </div>
          ))}
        </Section>
      ) : null}
      {error ? <p role="alert">{error}</p> : null}
      {message ? <p role="status">{message}</p> : null}
    </>
  );
}

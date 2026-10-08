import { useMemo } from 'react';
import { fmtClock, fmtDayMonth, fmtKm, fmtNum } from '../../domain/format';
import { AppBar } from '../../components/ui/Shell';
import { Row, Section } from '../../components/ui/primitives';
import { useResolvedPlan, useTrainingStore } from '../../stores';
import { useUIStore } from '../../stores/uiStore';
import { useCycleModel } from '../cycle/useCycleModel';
import { useRecoveryModel } from '../recovery/useRecoveryModel';
import { useFormModel } from '../race/useFormModel';
import { activityRows, recentWeeks, SOURCE_TEXT } from './model';

/* EKRAN NAPREDAK: da li se rad sabira. Redosled: kilometri poslednjih nedelja, forma i procena za trku, rekordi, poslednja aktivnost — pa ulazi u detalje
   (forma, oporavak, bol, masa, analiza trke). Detaljne metrike su iza jasno označenih redova, ne na ovom ekranu. */
export default function ProgressPage() {
  const plan = useResolvedPlan();
  const log = useTrainingStore((s) => s.log);
  const alts = useTrainingStore((s) => s.alts);
  const openScreen = useUIStore((s) => s.openScreen);
  const cycle = useCycleModel();
  const form = useFormModel();
  const rec = useRecoveryModel();

  const weeks = useMemo(() => recentWeeks(cycle), [cycle]);
  const last = useMemo(
    () => (plan ? activityRows(plan, log, alts)[0] : undefined),
    [plan, log, alts]
  );
  if (!plan) return null;

  const total = weeks.reduce((s, w) => s + w.realKm, 0);
  const peak = Math.max(1, ...weeks.map((w) => w.realKm));
  const m = form;
  const longest = m?.runs.reduce<(typeof m.runs)[number] | null>(
    (a, r) => (!a || r.km > a.km ? r : a),
    null
  );
  const bestTest = m?.tests.reduce<(typeof m.tests)[number] | null>(
    (a, t) => (!a || t.sec < a.sec ? t : a),
    null
  );
  const records: Array<{ label: string; value: string }> = [];
  if (m?.sum.strongest && m.sum.strongestKm > 0)
    records.push({
      label: 'Najjača nedelja',
      value: `N${m.sum.strongest.w} · ${fmtKm(Math.round(m.sum.strongestKm))} km`
    });
  if (longest)
    records.push({
      label: 'Najduže trčanje',
      value: `${fmtKm(Math.round(longest.km * 10) / 10)} km · ${fmtDayMonth(longest.date.slice(0, 10))}`
    });
  if (bestTest)
    records.push({
      label: 'Najbrži test 3 km',
      value: `${fmtClock(bestTest.sec)} · ${fmtDayMonth(bestTest.date)}`
    });
  if (m && m.sum.runsTotal > 0)
    records.push({ label: 'Trčanja po planu', value: `${m.sum.runsDone} od ${m.sum.runsTotal}` });

  const painNow = rec?.active.length ?? 0;
  const rows = (
    <div className="rows">
      <Row
        icon="target"
        title="Forma i predikcija"
        sub="VDOT, procena po distancama, test na 3 km"
        onClick={() => openScreen({ kind: 'forma' })}
      />
      <Row
        icon="pulse"
        title="Oporavak"
        sub={rec ? `${rec.ready.word} · HRV, san, opterećenje` : 'HRV, san, opterećenje'}
        onClick={() => openScreen({ kind: 'oporavak' })}
      />
      <Row
        icon="body"
        title="Bol"
        sub={
          painNow
            ? `${painNow} ${painNow === 1 ? 'deo tela' : 'dela tela'} u poslednjih 14 dana`
            : 'Mapa tela i istorija unosa'
        }
        onClick={() => openScreen({ kind: 'bol' })}
      />
      <Row
        icon="scale"
        title="Telesna masa"
        sub="Merenja i grafikon"
        onClick={() => openScreen({ kind: 'masa' })}
      />
      <Row
        icon="flag"
        title="Analiza trke"
        sub="Rezultat, prolazi po kilometru, AI analiza"
        onClick={() => openScreen({ kind: 'analiza-trke' })}
      />
    </div>
  );

  return (
    <>
      <AppBar
        right={
          weeks.length > 1
            ? `Poslednje ${weeks.length} nedelje`
            : weeks.length
              ? 'Ova nedelja'
              : undefined
        }
        tag
      />
      <header className="screen-head">
        <h1>Napredak</h1>
        {m ? (
          <p>
            {m.refs.raceName} · cilj {m.goalText}
          </p>
        ) : null}
      </header>

      {weeks.length ? (
        <section className="prog-km" aria-labelledby="prog-km-h">
          <h2 id="prog-km-h" className="sr-only">
            Kilometri po nedeljama
          </h2>
          <div className="hero">
            <span className="hero-v num">{fmtKm(Math.round(total * 10) / 10)}</span>
            <span className="hero-u">km</span>
          </div>
          <p className="weekkm-l">ukupno u ovom periodu</p>
          <div
            className="bars"
            role="img"
            aria-label={`Kilometri po nedeljama: ${weeks.map((w) => `N${w.w} ${fmtKm(w.realKm)}`).join(', ')}`}
          >
            {weeks.map((w) => (
              <div key={w.w} className={`bar-col${w.state === 'now' ? ' now' : ''}`}>
                <span className="bar-v num">{fmtKm(Math.round(w.realKm))}</span>
                <span
                  className="bar-b"
                  style={{ height: `${Math.max(4, (w.realKm / peak) * 100)}%` }}
                />
                <span className="bar-l">
                  N{w.w}
                  {w.state === 'now' ? <small>u toku</small> : null}
                </span>
              </div>
            ))}
          </div>
        </section>
      ) : (
        <div className="state">
          <b>Još nema nedelja za prikaz</b>
          <p>Kilometri se pojavljuju kad prođe prvi dan plana.</p>
        </div>
      )}

      {m ? (
        <button type="button" className="duo" onClick={() => openScreen({ kind: 'forma' })}>
          <span className="duo-c">
            <span className="duo-l">{m.cv != null ? 'Potvrđen VDOT' : 'Polazni VDOT'}</span>
            <b className="duo-v num">{fmtNum(m.formVdot, 1)}</b>
          </span>
          <span className="duo-c">
            <span className="duo-l">Procena · {m.refs.raceName}</span>
            <b className="duo-v num">
              {m.estSec != null
                ? fmtClock(m.estSec)
                : m.baseSec != null
                  ? fmtClock(m.baseSec)
                  : '—'}
            </b>
          </span>
        </button>
      ) : null}

      {last ? (
        <Section title="Poslednja aktivnost">
          <button
            type="button"
            className="last-act"
            onClick={() =>
              last.dayId
                ? openScreen({ kind: 'trening', props: { id: last.dayId } })
                : openScreen({ kind: 'analiza-trke', props: { id: last.id } })
            }
          >
            <span className="last-t">{last.title}</span>
            <span className="last-n num">
              {last.km != null ? <span>{fmtKm(last.km)} km</span> : null}
              {last.paceSec != null ? <span>{fmtClock(last.paceSec)} /km</span> : null}
              {last.hr != null ? <span>{Math.round(last.hr)} bpm</span> : null}
            </span>
            <span className="last-s">
              {last.date ? `${fmtDayMonth(last.date.slice(0, 10))} · ` : ''}
              {SOURCE_TEXT[last.source]}
            </span>
          </button>
          <button
            type="button"
            className="btn ghost block"
            onClick={() => openScreen({ kind: 'aktivnosti' })}
          >
            Sve aktivnosti
          </button>
        </Section>
      ) : (
        <Section title="Aktivnosti">
          <p className="empty">
            Još nema odrađenih treninga. Kad završiš prvi ili povežeš Stravu, pojaviće se ovde.
          </p>
        </Section>
      )}

      {records.length ? (
        <Section title="Rekordi">
          <dl className="facts">
            {records.map((r) => (
              <div key={r.label}>
                <dt>{r.label}</dt>
                <dd className="num">{r.value}</dd>
              </div>
            ))}
          </dl>
        </Section>
      ) : null}

      <Section title="Detaljnije">{rows}</Section>
    </>
  );
}

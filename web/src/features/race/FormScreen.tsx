import { useState } from 'react';
import { ProvenanceBadge } from '../../components/ui/Badge';
import { ScreenFrame } from '../../components/ui/Shell';
import { Icon } from '../../components/ui/icons';
import { Section } from '../../components/ui/primitives';
import { fmtClock, fmtDayLong, fmtNum } from '../../domain/format';
import { T3K_DIST_M } from '../../domain/training/constants/product';
import { t3kVdot } from '../../domain/training/test3k';
import { raceTimeForVdot } from '../../domain/training/vdot/racePrediction';
import { useUIStore } from '../../stores/uiStore';
import { Journey } from './Journey';
import { TrendAi } from './TrendAi';
import { PaceChart, PredictionChart, VdotTrendChart } from './charts';
import { useFormModel } from './useFormModel';

const DISTANCES: ReadonlyArray<{ m: number; name: string }> = [
  { m: 5000, name: '5 km' },
  { m: 10000, name: '10 km' },
  { m: 21097.5, name: 'Polumaraton' },
  { m: 42195, name: 'Maraton' }
];

const signed = (x: number): string => `${x > 0 ? '+' : x < 0 ? '−' : '±'}${fmtNum(Math.abs(x), 1)}`;
const secWord = (s: number): string =>
  s < 60 ? `${s} s` : s < 3600 ? `${fmtClock(s)} min` : `${fmtClock(s)} h`;

/* FORMA I PREDIKCIJA: odgovor na „Da li napredujem?“, pa dokazi razdvojeni po poreklu — IZMERENO (test, trčanja), PROCENA (VDOT i vremena izvedena iz njega),
   PROJEKCIJA (šta plan obećava). Ranije je ovo bilo pet kartica sa istim brojem u svakoj; sada je jedan ekran u kome se svaka brojka pojavljuje jednom.
   Čitanje: odgovor → procena po distancama → trend → predikcija kroz plan → test na 3 km. Predlog za prilagođavanje tempa je u Plan → Prilagodi plan. */
export function FormScreen() {
  const m = useFormModel();
  const openSheet = useUIStore((s) => s.openSheet);
  const [sel, setSel] = useState<{ vdot: number | null; pred: number | null; pace: number | null }>(
    {
      vdot: null,
      pred: null,
      pace: null
    }
  );
  if (!m)
    return (
      <ScreenFrame>
        <div className="state">
          <Icon name="info" size={28} />
          <b>Forma se prikazuje kad postoji plan</b>
          <p>Napravi plan u tabu Plan, pa se ovde pojavljuju merenja i procena.</p>
        </div>
      </ScreenFrame>
    );
  const { refs, summary, verdict, delta } = m;
  const lastTest = m.tests[0];
  const describePred = (i: number): string | null => {
    const e = summary.rows[i];
    const r = m.rows[i];
    if (!e || e.pred == null || !r) return null;
    return `${r.l} · predikcija ${fmtClock(e.pred)}${r.p5k != null ? ` · plan ${fmtClock(r.p5k)}` : ''}`;
  };

  return (
    <ScreenFrame>
      <header className="screen-head">
        <h1>Forma i predikcija</h1>
        <p>
          {refs.raceName} · cilj {m.goalText}
        </p>
      </header>

      <section className="verdict" aria-labelledby="vd-h">
        <div className="section-h">
          <h2 id="vd-h">Da li napredujem?</h2>
          <ProvenanceBadge kind="estimated" />
        </div>
        <p className={`vd-a ${verdict.tone}`}>
          {verdict.word}
          {delta != null && m.cv != null ? (
            <span className="vd-d num">
              <span aria-hidden="true">{delta > 0.05 ? '▲' : delta < -0.05 ? '▼' : '●'}</span> VDOT{' '}
              {signed(delta)}
            </span>
          ) : null}
        </p>
        {m.cv != null && m.estSec != null ? (
          <p className="vd-line">
            Procena za {refs.raceName} danas: <b className="num">{fmtClock(m.estSec)}</b>
            {m.gap != null && refs.goalSec != null
              ? m.gap > 0
                ? `. Do cilja ${m.goalText} fali ${secWord(m.gap)}.`
                : `. To je ${secWord(-m.gap)} ispred cilja ${m.goalText}.`
              : '.'}
          </p>
        ) : (
          <p className="vd-line">
            Forma se meri iz testa na 3 km i iz tempa upisanog na kvalitetnim treninzima. Dok toga
            nema, vidiš samo plan.
          </p>
        )}
        <Journey
          start={m.baseSec}
          now={m.estSec}
          goal={refs.goalSec}
          projection={
            m.projectionSec != null && m.projectionSec !== refs.goalSec ? m.projectionSec : null
          }
        />
        <p className="vd-note">
          {m.cv != null
            ? `Merenja u lancu forme: ${m.measurements}. ${
                m.measurements < 3
                  ? 'Malo merenja: jedan loš ili dobar dan može da pomeri procenu. '
                  : ''
              }Procena nije obećanje.`
            : 'Procena će se pojaviti posle prvog merenja.'}
        </p>
      </section>

      <Section title="Procena po distancama" extra={<ProvenanceBadge kind="estimated" />}>
        <div className="vd-now">
          <b className="num">{fmtNum(m.formVdot, 1)}</b>
          <span className="vd-lbl">
            VDOT · {m.cv != null ? 'tvoja forma' : 'polazna forma'}
            {delta != null && delta !== 0 ? ` · ${signed(delta)} od starta` : ''}
          </span>
        </div>
        <ul className="rtimes">
          {DISTANCES.map((d) => {
            const sec = m.formVdot != null ? raceTimeForVdot(m.formVdot, d.m) : null;
            const isRace = Math.abs(d.m - refs.raceDistM) < 50;
            return (
              <li key={d.m} className={isRace ? 'race' : undefined}>
                <span className="rt-n">
                  {d.name}
                  {isRace ? <small>tvoja trka</small> : null}
                </span>
                <b className="rt-t num">{sec != null ? fmtClock(sec) : '—'}</b>
                <span className="rt-p num">
                  {sec != null ? `${fmtClock(sec / (d.m / 1000))}/km` : ''}
                </span>
              </li>
            );
          })}
        </ul>
        <p className="note-src">
          {m.cv != null
            ? `Iz tvoje forme, VDOT ${fmtNum(m.cv, 1)}.`
            : `Iz polazne forme, VDOT ${fmtNum(m.bv, 1)} — nema novih merenja.`}{' '}
          VDOT ekvivalenti za duže distance pretpostavljaju da si trenirao baš za njih. Početni VDOT
          {m.personal
            ? m.starting
              ? ` (Niš polumaraton ${fmtClock(m.starting.sec)})`
              : ' (PB 20:37 na 5K, dok ne upišeš Niš)'
            : ''}
          : {fmtNum(m.bv, 1)} · cilj {m.goalText} ≈ VDOT {fmtNum(refs.goalVdot, 1)}.
        </p>
      </Section>

      <Section title="VDOT kroz vreme" extra={`${fmtNum(m.bv, 1)} → ${fmtNum(refs.goalVdot, 1)}`}>
        <div id="vdottrend">
          {m.trend ? (
            <VdotTrendChart
              model={m.trend}
              goal={refs.goalVdot ?? m.bv ?? 0}
              selected={sel.vdot}
              onSelect={(i) => setSel({ ...sel, vdot: i })}
            />
          ) : (
            <p className="empty">
              Trend se prikazuje kad budu bar 2 zabeležene VDOT vrednosti — skupljaju se kroz
              kvalitetne treninge i testove na 3 km.
            </p>
          )}
        </div>
        <div className="legend">
          <span>
            <i className="lg lg-e" />
            procena forme
          </span>
          <span>
            <i className="lg lg-goal" />
            cilj {fmtNum(refs.goalVdot, 1)}
          </span>
          <span>
            <i className="lg lg-base" />
            polazna forma
          </span>
        </div>
        <p className="note-src">
          Forma se računa iz radnog dela kvalitetnih sesija (unosi se u Detaljima treninga).
        </p>
      </Section>

      <Section title={`Predikcija kroz plan · ${refs.raceName}`} extra={`cilj ${m.goalText}`}>
        <div id="pchart">
          {m.chart ? (
            <PredictionChart
              model={m.chart}
              goalSec={refs.goalSec}
              describe={describePred}
              selected={sel.pred}
              onSelect={(i) => setSel({ ...sel, pred: i })}
            />
          ) : (
            <p className="empty">Nema podataka.</p>
          )}
        </div>
        <div className="legend">
          <span>
            <i className="lg lg-e" />
            procena iz tvog tempa
          </span>
          <span>
            <i className="lg lg-p" />
            projekcija plana
          </span>
          <span>
            <i className="lg lg-goal" />
            cilj
          </span>
          {summary.tests.length ? (
            <span>
              <i className="lg lg-m" />
              test 3 km (izmereno)
            </span>
          ) : null}
        </div>
      </Section>

      <Section title="Tempo svakog trčanja" extra={<ProvenanceBadge kind="measured" />}>
        {m.pace ? (
          <>
            <PaceChart
              model={m.pace}
              selected={sel.pace}
              onSelect={(i) => setSel({ ...sel, pace: i })}
            />
            <p className="note-src">
              Jedna tačka je jedno trčanje. Tempo zavisi od vrste treninga, pa se brza i laka
              trčanja ne porede među sobom.
            </p>
          </>
        ) : (
          <p className="empty">Unesi distancu i vreme na treninzima — trend se crta automatski.</p>
        )}
      </Section>

      <Section title="Test 3 km" extra={<ProvenanceBadge kind="measured" />}>
        {lastTest ? (
          <>
            <button
              type="button"
              className="t3-now"
              onClick={() => openSheet({ kind: 't3k', props: { id: lastTest.id } })}
            >
              <b className="num">{fmtClock(lastTest.sec)}</b>
              <i>{fmtDayLong(lastTest.date)} · izmeni</i>
            </button>
            <dl className="facts">
              <div>
                <dt>tempo</dt>
                <dd className="num">
                  {fmtClock(Math.round(lastTest.sec / (T3K_DIST_M / 1000)))} /km
                </dd>
              </div>
              <div>
                <dt>VDOT iz testa</dt>
                <dd className="num">{fmtNum(t3kVdot(lastTest.sec), 1)}</dd>
              </div>
              <div>
                <dt>
                  predikcija · {refs.raceName} <ProvenanceBadge kind="estimated" />
                </dt>
                <dd className="num">
                  {t3kVdot(lastTest.sec) != null
                    ? fmtClock(
                        Math.round(raceTimeForVdot(t3kVdot(lastTest.sec) as number, refs.raceDistM))
                      )
                    : '—'}
                </dd>
              </div>
            </dl>
            {m.tests.length > 1 ? (
              <>
                <p className="eyebrow sub-h">Raniji testovi</p>
                <div className="rows">
                  {m.tests.slice(1).map((t) => (
                    <button
                      type="button"
                      className="row"
                      key={t.id}
                      onClick={() => openSheet({ kind: 't3k', props: { id: t.id } })}
                    >
                      <span className="row-main">
                        <span className="row-t num">{fmtClock(t.sec)}</span>
                        <span className="row-s">
                          {fmtDayLong(t.date)} · {fmtClock(Math.round(t.sec / (T3K_DIST_M / 1000)))}
                          /km · VDOT {fmtNum(t3kVdot(t.sec), 1)}
                        </span>
                      </span>
                      <span className="row-end">
                        <Icon name="chevron" size={18} />
                      </span>
                    </button>
                  ))}
                </div>
              </>
            ) : null}
            <p className="note-src">
              Najjači pojedinačan pokazatelj forme koji možeš sam da napraviš: napor od 10–30 minuta
              je prozor u kom je VDOT formula i izvedena i najtačnija. Zato test pomera formu znatno
              više nego bilo koji trening.
            </p>
          </>
        ) : (
          <p className="note-src">
            Istrči 3 km kao pravu trku — ravna staza, isti uslovi svaki put. Napor od 10–30 minuta
            je prozor u kom je VDOT formula najtačnija, pa test forme pomera znatno više nego bilo
            koji trening. Iz njega se računaju i forma i predikcija {refs.raceName}.
          </p>
        )}
        <div className="btnrow start">
          <button
            type="button"
            className={`btn${lastTest ? ' ghost' : ''}`}
            onClick={() => openSheet({ kind: 't3k', props: { id: null } })}
          >
            {lastTest ? (
              <>
                <Icon name="plus" size={18} /> Novi test
              </>
            ) : (
              'Unesi test na 3 km'
            )}
          </button>
        </div>
      </Section>

      <Section title="Tumačenje">
        <TrendAi />
      </Section>
    </ScreenFrame>
  );
}

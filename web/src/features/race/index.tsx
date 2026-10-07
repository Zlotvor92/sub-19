import { useMemo, useState } from 'react';
import { Icon } from '../../components/ui/icons';
import { ProvenanceBadge, StatusBadge, type Tone } from '../../components/ui/Badge';
import { addDays, parseIsoDate } from '../../domain/date';
import { planSummary } from '../../domain/day';
import { PERSONAL, isPersonalMeta, startingRace } from '../../domain/personal';
import {
  brojTreninga,
  fmtClock,
  fmtDayLong,
  fmtDayMonth,
  fmtKm,
  fmtNum,
  glagolZaBroj
} from '../../domain/format';
import {
  completedRuns,
  paceChartModel,
  predictionChartModel,
  raceRefs,
  vdotTrendModel
} from '../../domain/race';
import { currentVdot, type StoredPredRow } from '../../domain/training/adaptation';
import { predictionSummary } from '../../domain/training/prediction/summary';
import { t3kRows, t3kSeries, t3kVdot } from '../../domain/training/test3k';
import { T3K_DIST_M } from '../../domain/training/constants/product';
import { raceTimeForVdot } from '../../domain/training/vdot/racePrediction';
import { confirmAction } from '../../app/confirm';
import { useActiveGenPlan, useResolvedPlan, useTrainingStore } from '../../stores';
import { applyProposal, currentVdotProposal, undoAdjustments } from '../../stores/raceActions';
import { useUIStore } from '../../stores/uiStore';
import { Journey } from './Journey';
import { gapToGoal } from './journey';
import { RaceAnalysis } from './RaceAnalysis';
import { TrendAi } from './TrendAi';
import { PaceChart, PredictionChart, VdotTrendChart } from './charts';

const DISTANCES: ReadonlyArray<{ m: number; name: string }> = [
  { m: 5000, name: '5 km' },
  { m: 10000, name: '10 km' },
  { m: 21097.5, name: 'Polumaraton' },
  { m: 42195, name: 'Maraton' }
];

const num = (x: unknown): number | null => (typeof x === 'number' && Number.isFinite(x) ? x : null);
const signed = (x: number): string => `${x > 0 ? '+' : x < 0 ? '−' : '±'}${fmtNum(Math.abs(x), 1)}`;
const secWord = (s: number): string =>
  s < 60 ? `${s} s` : s < 3600 ? `${fmtClock(s)} min` : `${fmtClock(s)} h`;

function Head({
  id,
  title,
  extra,
  prov
}: {
  id: string;
  title: string;
  extra?: string;
  prov?: 'measured' | 'estimated' | 'projected';
}) {
  return (
    <div className="dhead">
      <h3 id={id}>{title}</h3>
      {prov ? (
        <ProvenanceBadge kind={prov} />
      ) : extra ? (
        <span className="dhead-x">{extra}</span>
      ) : null}
    </div>
  );
}

/* EKRAN NAPREDAK (tab „Trka"): odgovor na „Da li napredujem?" pa dokazi, strogo razdvojeni po poreklu — IZMERENO (test, trčanja),
   PROCENA (VDOT i vremena izvedena iz njega), PROJEKCIJA (šta plan obećava). Čitanje: odgovor → trend → procene po distancama → sirova merenja. */
export default function RacePage() {
  const plan = useResolvedPlan();
  const genPlan = useActiveGenPlan();
  const log = useTrainingStore((s) => s.log);
  const pred = useTrainingStore((s) => s.pred);
  const vdotLog = useTrainingStore((s) => s.vdotLog);
  const t3k = useTrainingStore((s) => s.t3k);
  const alts = useTrainingStore((s) => s.alts);
  const todayStr = useUIStore((s) => s.today);
  const openSheet = useUIStore((s) => s.openSheet);
  const setTab = useUIStore((s) => s.setTab);
  const [sel, setSel] = useState<{ vdot: number | null; pred: number | null; pace: number | null }>(
    {
      vdot: null,
      pred: null,
      pace: null
    }
  );
  const today = parseIsoDate(todayStr);

  const m = useMemo(() => {
    if (!plan || !genPlan || !today) return null;
    const refs = raceRefs(genPlan.meta);
    const rows = genPlan.pred.filter((r): r is StoredPredRow => typeof r.id === 'string');
    const paces: Record<string, number | undefined> = {};
    for (const [k, v] of Object.entries(pred)) if (typeof v === 'number') paces[k] = v;
    const start = plan.weeks[0]?.start ?? todayStr;
    const weekNo = (d: string): number | null =>
      plan.weeks.find((w) => d >= w.start && d <= addDays(w.start, 6))?.w ?? null;
    const summary = predictionSummary({
      pred: rows,
      paces,
      chain: vdotLog,
      tests: t3kRows(t3k, weekNo, start, plan.weeks.length),
      raceDistM: refs.raceDistM
    });
    const cv = currentVdot(vdotLog);
    const goal = refs.goalVdot ?? refs.baselineVdot;
    const runs = completedRuns(plan, log, alts);
    return {
      refs,
      rows,
      summary,
      cv,
      measurements: vdotLog.filter((r) => r && num(r.vdot) != null).length,
      trend:
        refs.baselineVdot != null && goal != null
          ? vdotTrendModel(vdotLog, refs.baselineVdot, goal)
          : null,
      chart: predictionChartModel(rows, summary, refs.goalSec),
      runs,
      pace: paceChartModel(runs),
      sum: planSummary(plan, log, today),
      projectionSec: num(genPlan.meta?.['predictedSec']),
      proposal: currentVdotProposal(plan, todayStr),
      tests: t3kSeries(t3k).slice().reverse()
    };
  }, [plan, genPlan, today, pred, vdotLog, t3k, log, alts, todayStr]);
  if (!plan || !m) return <RaceAnalysis />;
  const { refs, summary } = m;
  const bv = refs.baselineVdot;
  const personal = isPersonalMeta(genPlan?.meta);
  const goalText = personal
    ? PERSONAL.goalText
    : refs.goalSec != null
      ? fmtClock(refs.goalSec)
      : '—';
  const starting = personal ? startingRace(log) : null;
  const delta = m.cv != null && bv != null ? Math.round((m.cv - bv) * 10) / 10 : null;
  const lastTest = m.tests[0];
  const hasAdjusted = Object.values(alts).some((a) => a && a.paceAuto);

  /* Procena vremena: iz TRENUTNE forme (VDOT iz lanca merenja); bez merenja iz polazne forme, i tako i piše. */
  const formVdot = m.cv ?? bv;
  const baseSec = bv != null ? raceTimeForVdot(bv, refs.raceDistM) : null;
  const estSec = m.cv != null ? raceTimeForVdot(m.cv, refs.raceDistM) : null;
  const gap = gapToGoal(estSec, refs.goalSec);

  let word: string;
  let tone: Tone = 'none';
  if (m.cv == null) word = 'Još nema merenja';
  else if (delta != null && delta > 0.05) {
    word = 'Da';
    tone = 'ok';
  } else if (delta != null && delta < -0.05) {
    word = 'Ne';
    tone = 'bad';
  } else word = 'Za sada isto';

  const apply = async (): Promise<void> => {
    const pr = m.proposal;
    if (!pr) return;
    const n = pr.changes.length;
    const ok = await confirmAction(
      `Prilagoditi ciljni tempo tvojoj formi? ${glagolZaBroj(n, 'Menja se ', 'Menjaju se ')}${brojTreninga(n)}. Obim ostaje isti, a sve se vraća dugmetom „Vrati planski tempo".`
    );
    if (!ok) return;
    const done = applyProposal(plan, pr);
    window.alert(`${done} ${done === 1 ? 'trening prilagođen' : 'treninga prilagođeno'}.`);
  };

  const describePred = (i: number): string | null => {
    const e = summary.rows[i];
    const r = m.rows[i];
    if (!e || e.pred == null || !r) return null;
    return `${r.l} · predikcija ${fmtClock(e.pred)}${r.p5k != null ? ` · plan ${fmtClock(r.p5k)}` : ''}`;
  };

  const longest = m.runs.reduce<(typeof m.runs)[number] | null>(
    (a, r) => (!a || r.km > a.km ? r : a),
    null
  );
  const bestTest = m.tests.reduce<(typeof m.tests)[number] | null>(
    (a, t) => (!a || t.sec < a.sec ? t : a),
    null
  );
  const recent = m.runs.slice(-4).reverse();
  const sum = m.sum;

  return (
    <>
      <header className="screen-head">
        <h1>Napredak</h1>
        <p>
          {refs.raceName} · cilj {goalText}
        </p>
      </header>
      <RaceAnalysis />
      <div className="cols">
        <div className="col">
          <section
            className="card card--focus verdict"
            style={{ ['--phase' as string]: 'var(--estimated)' }}
            aria-labelledby="vd-h"
          >
            <div className="dhead">
              <h2 id="vd-h" className="vd-q">
                Da li napredujem?
              </h2>
              <ProvenanceBadge kind="estimated" />
            </div>
            <p className={`vd-a ${tone}`}>
              {word}
              {delta != null && m.cv != null ? (
                <span className="vd-d num">
                  <span aria-hidden="true">{delta > 0.05 ? '▲' : delta < -0.05 ? '▼' : '●'}</span>{' '}
                  VDOT {signed(delta)}
                </span>
              ) : null}
            </p>
            {m.cv != null && estSec != null ? (
              <p className="vd-line">
                Procena za {refs.raceName} danas: <b className="num">{fmtClock(estSec)}</b>
                {gap != null && refs.goalSec != null
                  ? gap > 0
                    ? `. Do cilja ${goalText} fali ${secWord(gap)}.`
                    : `. To je ${secWord(-gap)} ispred cilja ${goalText}.`
                  : '.'}
              </p>
            ) : (
              <p className="vd-line">
                Forma se meri iz testa na 3 km i iz tempa upisanog na kvalitetnim treninzima. Dok
                toga nema, vidiš samo plan.
              </p>
            )}
            <Journey
              start={baseSec}
              now={estSec}
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
            {m.cv == null ? (
              <div className="btnrow">
                <button
                  type="button"
                  className="btn"
                  onClick={() => openSheet({ kind: 't3k', props: { id: null } })}
                >
                  Počni testom na 3 km
                </button>
              </div>
            ) : null}
          </section>

          {m.proposal ? (
            <section className="card" aria-labelledby="pr-h">
              <div className="dhead">
                <h3 id="pr-h">{m.proposal.title}</h3>
                <StatusBadge tone={m.proposal.faster ? 'ok' : 'warn'}>
                  {m.proposal.faster ? 'Brže' : 'Sporije'}
                </StatusBadge>
              </div>
              <p className="prop-m">{m.proposal.message}</p>
              <p className="note-src">
                {m.proposal.changes
                  .slice(0, 3)
                  .map(
                    (c) =>
                      `${fmtDayMonth(c.date)} ${c.kind}: ${fmtClock(c.oldPace)}/km → ${fmtClock(c.newPace)}/km`
                  )
                  .join(' · ')}
                {m.proposal.changes.length > 3 ? ' …' : ''}
              </p>
              <div className="btnrow">
                <button type="button" className="btn" onClick={() => void apply()}>
                  Prilagodi tempo
                </button>
              </div>
              <p className="note-src">
                Ručno izmenjeni i odrađeni treninzi se ne diraju. Sve se vraća jednim dugmetom u
                Podešavanjima.
              </p>
            </section>
          ) : hasAdjusted ? (
            <section className="card" aria-labelledby="ad-h">
              <div className="dhead">
                <h3 id="ad-h">Tempi su prilagođeni tvojoj formi</h3>
              </div>
              <p className="prop-m">
                Ciljni tempo preostalih kvalitetnih treninga prati izmereni VDOT, a ne polaznu
                pretpostavku plana.
              </p>
              <div className="btnrow">
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => {
                    const n = undoAdjustments(plan);
                    window.alert(n ? `Vraćeno na planski tempo (${n}).` : 'Nema šta da se vrati.');
                  }}
                >
                  Vrati planski tempo
                </button>
              </div>
            </section>
          ) : null}

          <section className="card chart-card" aria-labelledby="vt-h">
            <Head
              id="vt-h"
              title="VDOT kroz vreme"
              extra={`${fmtNum(bv, 1)} → ${fmtNum(refs.goalVdot, 1)}`}
            />
            <div className="vd-now">
              <b className="num">{fmtNum(formVdot, 1)}</b>
              <span className="vd-lbl">
                {m.cv != null ? 'tvoja forma' : 'polazna forma'}
                {delta != null && delta !== 0 ? ` · ${signed(delta)} od starta` : ''}
              </span>
            </div>
            <div id="vdottrend">
              {m.trend ? (
                <VdotTrendChart
                  model={m.trend}
                  goal={refs.goalVdot ?? bv ?? 0}
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
              Početni VDOT
              {personal
                ? starting
                  ? ` (Niš polumaraton ${fmtClock(starting.sec)})`
                  : ' (PB 20:37 na 5K, dok ne upišeš Niš)'
                : ''}
              : {fmtNum(bv, 1)} · cilj {goalText} ≈ VDOT {fmtNum(refs.goalVdot, 1)}. Forma se računa
              iz radnog dela kvalitetnih sesija (unosi se u Danas → trening).
            </p>
            <TrendAi />
          </section>

          <section className="card chart-card" aria-labelledby="pc-h">
            <Head
              id="pc-h"
              title={`Predikcija kroz plan · ${refs.raceName}`}
              extra={`cilj ${goalText}`}
            />
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
          </section>
        </div>

        <div className="col">
          <section className="card" aria-labelledby="rt-h">
            <Head id="rt-h" title="Procena po distancama" prov="estimated" />
            <ul className="rtimes">
              {DISTANCES.map((d) => {
                const sec = formVdot != null ? raceTimeForVdot(formVdot, d.m) : null;
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
                : `Iz polazne forme, VDOT ${fmtNum(bv, 1)} — nema novih merenja.`}{' '}
              VDOT ekvivalenti za duže distance pretpostavljaju da si trenirao baš za njih.
            </p>
          </section>

          <section className="card" aria-labelledby="t3-h">
            <Head id="t3-h" title="Test 3 km" prov="measured" />
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
                <div className="drows">
                  <div className="drow">
                    <span className="l">tempo</span>
                    <span className="v num">
                      {fmtClock(Math.round(lastTest.sec / (T3K_DIST_M / 1000)))} /km
                    </span>
                  </div>
                  <div className="drow">
                    <span className="l">VDOT iz testa</span>
                    <span className="v num">{fmtNum(t3kVdot(lastTest.sec), 1)}</span>
                  </div>
                  <div className="drow">
                    <span className="l">
                      predikcija · {refs.raceName} <ProvenanceBadge kind="estimated" />
                    </span>
                    <span className="v num">
                      {t3kVdot(lastTest.sec) != null
                        ? fmtClock(
                            Math.round(
                              raceTimeForVdot(t3kVdot(lastTest.sec) as number, refs.raceDistM)
                            )
                          )
                        : '—'}
                    </span>
                  </div>
                </div>
                {m.tests.length > 1 ? (
                  <>
                    <p className="eyebrow sub-h">Raniji testovi</p>
                    {m.tests.slice(1).map((t) => (
                      <button
                        type="button"
                        className="krow"
                        key={t.id}
                        onClick={() => openSheet({ kind: 't3k', props: { id: t.id } })}
                      >
                        <span className="kp num">{fmtNum(t3kVdot(t.sec), 1)}</span>
                        <span className="ki">
                          <b className="num">{fmtClock(t.sec)}</b>
                          <span className="ka">
                            {fmtDayLong(t.date)} ·{' '}
                            {fmtClock(Math.round(t.sec / (T3K_DIST_M / 1000)))}
                            /km
                          </span>
                        </span>
                        <Icon name="chevron" size={16} />
                      </button>
                    ))}
                  </>
                ) : null}
                <p className="note-src">
                  Najjači pojedinačan pokazatelj forme koji možeš sam da napraviš: napor od 10–30
                  minuta je prozor u kom je VDOT formula i izvedena i najtačnija. Zato test pomera
                  formu znatno više nego bilo koji trening.
                </p>
              </>
            ) : (
              <p className="note-src">
                Istrči 3 km kao pravu trku — ravna staza, isti uslovi svaki put. Napor od 10–30
                minuta je prozor u kom je VDOT formula najtačnija, pa test forme pomera znatno više
                nego bilo koji trening. Iz njega se računaju i forma i predikcija {refs.raceName}.
              </p>
            )}
            <div className="btnrow">
              <button
                type="button"
                className={`btn${lastTest ? ' ghost' : ''}`}
                onClick={() => openSheet({ kind: 't3k', props: { id: null } })}
              >
                {lastTest ? (
                  <>
                    <Icon name="plus" size={16} /> Novi test
                  </>
                ) : (
                  'Unesi test na 3 km'
                )}
              </button>
            </div>
          </section>

          <section className="card chart-card" aria-labelledby="pa-h">
            <Head id="pa-h" title="Tempo svakog trčanja" prov="measured" />
            {m.pace ? (
              <PaceChart
                model={m.pace}
                selected={sel.pace}
                onSelect={(i) => setSel({ ...sel, pace: i })}
              />
            ) : (
              <p className="empty">
                Unesi distancu i vreme na treninzima — trend se crta automatski.
              </p>
            )}
            {m.pace ? (
              <p className="note-src">
                Jedna tačka je jedno trčanje. Tempo zavisi od vrste treninga, pa se brza i laka
                trčanja ne porede među sobom.
              </p>
            ) : null}
            {recent.length ? (
              <>
                <p className="eyebrow sub-h">Poslednja trčanja</p>
                <ul className="runs">
                  {recent.map((r, i) => (
                    <li key={`${r.date}-${i}`}>
                      <span className="r-d">{fmtDayMonth(r.date.slice(0, 10))}</span>
                      <span className="r-k">{r.kind || 'Trčanje'}</span>
                      <span className="r-v num">{fmtKm(Math.round(r.km * 10) / 10)} km</span>
                      <b className="r-p num">{fmtClock(r.t)}/km</b>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </section>

          <section className="card" aria-labelledby="dd-h">
            <Head id="dd-h" title="Do sada" prov="measured" />
            <div className="stats">
              <div className="stat">
                <b className="stat-v num">{sum.untilToday > 0 ? `${sum.keepingPlanPct}%` : '—'}</b>
                <span className="stat-l">plana do danas</span>
                <span className="stat-s num">
                  {fmtKm(Math.round(sum.run))} od {fmtKm(Math.round(sum.untilToday))} km
                </span>
              </div>
              <div className="stat">
                <b className="stat-v num">
                  {sum.average != null ? fmtKm(Math.round(sum.average)) : '—'}
                </b>
                <span className="stat-l">km nedeljno</span>
                <span className="stat-s">prosek završenih nedelja</span>
              </div>
            </div>
            <dl className="params">
              <div>
                <dt>Najjača nedelja</dt>
                <dd className="num">
                  {sum.strongest && sum.strongestKm > 0
                    ? `N${sum.strongest.w} · ${fmtKm(Math.round(sum.strongestKm))} km`
                    : '—'}
                </dd>
              </div>
              <div>
                <dt>Najduže trčanje</dt>
                <dd className="num">
                  {longest
                    ? `${fmtKm(Math.round(longest.km * 10) / 10)} km · ${fmtDayMonth(longest.date.slice(0, 10))}`
                    : '—'}
                </dd>
              </div>
              <div>
                <dt>Najbrži test 3 km</dt>
                <dd className="num">
                  {bestTest ? `${fmtClock(bestTest.sec)} · ${fmtDayMonth(bestTest.date)}` : '—'}
                </dd>
              </div>
              <div>
                <dt>Trčanja po planu</dt>
                <dd className="num">
                  {sum.runsTotal > 0 ? `${sum.runsDone} od ${sum.runsTotal}` : '—'}
                </dd>
              </div>
            </dl>
            <button type="button" className="linkrow" onClick={() => setTab('plan')}>
              <span>Cela mapa ciklusa</span>
              <Icon name="chevron" size={16} />
            </button>
          </section>
        </div>
      </div>
    </>
  );
}

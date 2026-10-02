import { useMemo, useState } from 'react';
import { Ring } from '../../components/ui/Ring';
import { addDays, parseIsoDate } from '../../domain/date';
import { PERSONAL, isPersonalMeta, startingRace } from '../../domain/personal';
import {
  brojTreninga,
  fmtClock,
  fmtDayLong,
  fmtDayMonth,
  fmtNum,
  glagolZaBroj
} from '../../domain/format';
import {
  completedRuns,
  heroRing,
  paceChartModel,
  predictionChartModel,
  raceRefs,
  vdotTrendModel,
  type HeroRing
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
import { TrendAi } from './TrendAi';
import { PaceChart, PredictionChart, VdotTrendChart } from './charts';

const Head = ({ title, extra }: { title: string; extra?: string }) => (
  <div className="dhead">
    <span className="card-t">{title}</span>
    {extra ? <span className="dhead-x">{extra}</span> : null}
  </div>
);

const RING_COLOR = {
  none: 'rgba(238,240,255,.22)',
  good: 'var(--green)',
  behind: 'var(--pink)'
} as const;

function HeroRingView({ ring, name }: { ring: HeroRing; name: string }) {
  return (
    <div className="tr-ring">
      <Ring
        share={ring.share}
        text={ring.sec != null ? fmtClock(ring.sec) : '—'}
        size={84}
        color={RING_COLOR[ring.tone]}
        fontSize={19}
      />
      <b>{name}</b>
      <span>{ring.sub}</span>
    </div>
  );
}

/* TAB TRKA: prstenovi (zadnja i najbrža predikcija), test na 3 km, VDOT kroz vreme, prilagođavanje tempa formi, predikcija kroz
   plan i prosečan tempo. Čitanje: sažeto → sirovo (prstenovi → VDOT → predikcija → tempo svakog trčanja). */
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
    return {
      refs,
      rows,
      summary,
      cv,
      trend:
        refs.baselineVdot != null && goal != null
          ? vdotTrendModel(vdotLog, refs.baselineVdot, goal)
          : null,
      chart: predictionChartModel(rows, summary, refs.goalSec),
      pace: paceChartModel(completedRuns(plan, log, alts)),
      proposal: currentVdotProposal(plan, todayStr),
      tests: t3kSeries(t3k).slice().reverse()
    };
  }, [plan, genPlan, today, pred, vdotLog, t3k, log, alts, todayStr]);
  if (!plan || !m) return null;
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
  const arrow = delta == null ? '' : delta > 0.05 ? '↑' : delta < -0.05 ? '↓' : '→';
  const color =
    delta == null
      ? 'var(--txt)'
      : delta > 0.05
        ? 'var(--green)'
        : delta < -0.05
          ? 'var(--pink)'
          : 'var(--txt)';
  const lastTest = m.tests[0];
  const hasAdjusted = Object.values(alts).some((a) => a && a.paceAuto);

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

  return (
    <>
      <div className="card accent tr-hero">
        <div className="tr-rings">
          <HeroRingView ring={heroRing(summary.last?.pred ?? null, refs)} name="zadnja" />
          <HeroRingView ring={heroRing(summary.best?.pred ?? null, refs)} name="najbrža" />
        </div>
        <div className="tr-cilj">
          <span>cilj</span>
          <b>
            {goalText} · VDOT {fmtNum(refs.goalVdot, 1)}
          </b>
        </div>
      </div>

      <div className="card">
        <Head title="Test 3 km" extra="najjači signal forme" />
        {lastTest ? (
          <>
            <button
              type="button"
              className="t3-now"
              onClick={() => openSheet({ kind: 't3k', props: { id: lastTest.id } })}
            >
              <b>{fmtClock(lastTest.sec)}</b>
              <i>{fmtDayLong(lastTest.date)} · izmeni</i>
            </button>
            <div className="drows">
              <div className="drow">
                <span className="l">tempo</span>
                <span className="v">
                  {fmtClock(Math.round(lastTest.sec / (T3K_DIST_M / 1000)))} /km
                </span>
              </div>
              <div className="drow">
                <span className="l">VDOT iz testa</span>
                <span className="v">{fmtNum(t3kVdot(lastTest.sec), 1)}</span>
              </div>
              <div className="drow">
                <span className="l">predikcija · {refs.raceName}</span>
                <span className="v">
                  {t3kVdot(lastTest.sec) != null
                    ? fmtClock(
                        Math.round(raceTimeForVdot(t3kVdot(lastTest.sec) as number, refs.raceDistM))
                      )
                    : '—'}
                </span>
              </div>
            </div>
            {m.tests.length > 1 ? (
              <>
                <div className="op-sub">Raniji testovi</div>
                {m.tests.slice(1).map((t) => (
                  <button
                    type="button"
                    className="krow"
                    key={t.id}
                    onClick={() => openSheet({ kind: 't3k', props: { id: t.id } })}
                  >
                    <div className="kp p0">{fmtNum(t3kVdot(t.sec), 1)}</div>
                    <div className="ki">
                      <div className="kd">
                        {fmtClock(t.sec)}{' '}
                        <span className="ka">
                          · {fmtDayLong(t.date)} ·{' '}
                          {fmtClock(Math.round(t.sec / (T3K_DIST_M / 1000)))}/km
                        </span>
                      </div>
                    </div>
                  </button>
                ))}
              </>
            ) : null}
            <div className="note-src">
              Najjači pojedinačan pokazatelj forme koji možeš sam da napraviš: napor od 10–30 minuta
              je prozor u kom je VDOT formula i izvedena i najtačnija. Zato test pomera formu znatno
              više nego bilo koji trening.
            </div>
          </>
        ) : (
          <div className="note-src" style={{ margin: 0 }}>
            Istrči 3 km kao pravu trku — ravna staza, isti uslovi svaki put. Napor od 10–30 minuta
            je prozor u kom je VDOT formula najtačnija, pa test forme pomera znatno više nego bilo
            koji trening. Iz njega se računaju i forma i predikcija {refs.raceName}.
          </div>
        )}
        <div className="btnrow" style={{ marginTop: 12 }}>
          <button
            type="button"
            className={`btn${lastTest ? ' ghost' : ''}`}
            onClick={() => openSheet({ kind: 't3k', props: { id: null } })}
          >
            {lastTest ? '+ Novi test' : 'Unesi test na 3 km'}
          </button>
        </div>
      </div>

      <div className="card">
        <Head title="VDOT kroz vreme" extra={`${fmtNum(bv, 1)} → ${fmtNum(refs.goalVdot, 1)}`} />
        <div className="vd-now">
          <b>{fmtNum(m.cv ?? bv, 1)}</b>
          <i style={{ color }}>
            {arrow}
            {delta != null ? `${delta > 0 ? ' +' : ' '}${fmtNum(delta, 1)}` : ''}
          </i>
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
            <div style={{ color: 'var(--txt3)', fontSize: '.8rem', padding: '12px 0' }}>
              Trend se prikazuje kad budu bar 2 zabeležene VDOT vrednosti — skupljaju se kroz
              kvalitetne treninge i testove na 3 km.
            </div>
          )}
        </div>
        <div className="legend">
          <span>
            <i style={{ background: 'var(--cyan)' }} />
            cilj {fmtNum(refs.goalVdot, 1)}
          </span>
          <span>
            <i style={{ background: 'var(--pink)' }} />
            tvoja forma
          </span>
        </div>
        <div className="note-src">
          Početni VDOT
          {personal
            ? starting
              ? ` (Niš polumaraton ${fmtClock(starting.sec)})`
              : ' (PB 20:37 na 5K, dok ne upišeš Niš)'
            : ''}
          : {fmtNum(bv, 1)} · cilj {goalText} ≈ VDOT {fmtNum(refs.goalVdot, 1)}. Forma se računa iz
          radnog dela kvalitetnih sesija (unosi se u Danas → trening).
        </div>
        <TrendAi />
      </div>

      {m.proposal ? (
        <div
          className="card"
          style={{ borderColor: m.proposal.faster ? 'rgba(48,209,88,.35)' : 'rgba(255,176,32,.3)' }}
        >
          <div
            className="card-t"
            style={{ color: m.proposal.faster ? 'var(--green)' : 'var(--amber)' }}
          >
            {m.proposal.title}
          </div>
          <div style={{ fontSize: '.85rem', lineHeight: 1.55, color: 'var(--txt2)' }}>
            {m.proposal.message}
          </div>
          <div className="note-src" style={{ marginTop: 10 }}>
            {m.proposal.changes
              .slice(0, 3)
              .map(
                (c) =>
                  `${fmtDayMonth(c.date)} ${c.kind}: ${fmtClock(c.oldPace)}/km → ${fmtClock(c.newPace)}/km`
              )
              .join(' · ')}
            {m.proposal.changes.length > 3 ? ' …' : ''}
          </div>
          <div className="btnrow" style={{ marginTop: 12 }}>
            <button type="button" className="btn" onClick={() => void apply()}>
              Prilagodi tempo
            </button>
          </div>
          <div className="note-src" style={{ marginTop: 8 }}>
            Ručno izmenjeni i odrađeni treninzi se ne diraju. Sve se vraća jednim dugmetom u
            Podešavanjima.
          </div>
        </div>
      ) : hasAdjusted ? (
        <div className="card">
          <div className="card-t">Tempi su prilagođeni tvojoj formi</div>
          <div style={{ fontSize: '.85rem', color: 'var(--txt2)', lineHeight: 1.5 }}>
            Ciljni tempo preostalih kvalitetnih treninga prati izmereni VDOT, a ne polaznu
            pretpostavku plana.
          </div>
          <div className="btnrow" style={{ marginTop: 12 }}>
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
        </div>
      ) : null}

      <div className="card">
        <Head title={`Predikcija kroz plan · ${refs.raceName}`} extra={`cilj ${goalText}`} />
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
            <div className="empty">Nema podataka.</div>
          )}
        </div>
        <div className="legend">
          <span>
            <i style={{ background: 'var(--pink)' }} />
            ostvareno
          </span>
          <span>
            <i style={{ background: 'rgba(255,255,255,.28)' }} />
            plan (referenca)
          </span>
          <span>
            <i style={{ background: 'var(--cyan)' }} />
            cilj
          </span>
          {summary.tests.length ? (
            <span>
              <i className="romb" style={{ background: 'var(--cyan)' }} />
              test 3 km
            </span>
          ) : null}
        </div>
      </div>

      <div className="card">
        <Head title="Prosečan tempo" extra="odrađena trčanja" />
        {m.pace ? (
          <PaceChart
            model={m.pace}
            selected={sel.pace}
            onSelect={(i) => setSel({ ...sel, pace: i })}
          />
        ) : (
          <div className="empty">
            Unesi distancu i vreme na treninzima — trend se crta automatski.
          </div>
        )}
      </div>
    </>
  );
}

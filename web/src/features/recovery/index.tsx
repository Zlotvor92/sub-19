import { useMemo, useState } from 'react';
import { Icon } from '../../components/ui/icons';
import { parseIsoDate, type IsoDate } from '../../domain/date';
import { dowShort, fmtDayMonth, glagolZaBroj, brojTreninga, pl3 } from '../../domain/format';
import {
  BODY_PARTS,
  acwrNow,
  acwrPlan,
  injuryProposal,
  painModel,
  painStatus,
  partLevel,
  partName,
  type LoadContext
} from '../../domain/recovery';
import { confirmAction } from '../../app/confirm';
import { useIcuConnected, useResolvedPlan, useSettingsStore, useTrainingStore } from '../../stores';
import { useRecoveryStore } from '../../stores/recoveryStore';
import {
  addWeightEntry,
  applyProposal,
  removeWeightAt,
  removeWeightsBefore
} from '../../stores/recoveryActions';
import { useUIStore } from '../../stores/uiStore';
import { BodyMap, type BodyView } from './BodyMap';
import { CardHead, LoadCard, ProposalCard, RestingHrCard, WellnessCard } from './cards';
import { ReadinessCard } from './ReadinessCard';
import { readinessModel } from './readiness';
import { PainChart } from './charts';
import { WeightCard } from './WeightCard';

/* TAB OPORAVAK — spojeni Progres i Povrede. Redosled je po hitnosti, ne po temi: stanje danas, pa signal koji upozorava PRE nego
   što nešto zaboli (opterećenje), pa telo, pa istorija. */
export default function RecoveryPage() {
  const plan = useResolvedPlan();
  const log = useTrainingStore((s) => s.log);
  const knee = useRecoveryStore((s) => s.knee);
  const kg = useRecoveryStore((s) => s.kg);
  const wellness = useRecoveryStore((s) => s.wellness);
  const outOfPlan = useRecoveryStore((s) => s.vanPlana);
  const bodyView = useSettingsStore((s) => s.ui['bodyView']);
  const patchUi = useSettingsStore((s) => s.patchUi);
  const icu = useIcuConnected();
  const todayStr = useUIStore((s) => s.today);
  const openSheet = useUIStore((s) => s.openSheet);
  const [painSel, setPainSel] = useState<number | null>(null);
  const today = parseIsoDate(todayStr);
  const view: BodyView = bodyView === 'back' ? 'back' : 'front';

  const m = useMemo(() => {
    if (!plan || !today) return null;
    const ctx: LoadContext & { pain: typeof knee } = { plan, log, outOfPlan, pain: knee };
    return {
      ctx,
      status: painStatus(knee, today),
      proposal: injuryProposal(ctx, today),
      now: acwrNow(ctx, today),
      ahead: acwrPlan(ctx, today),
      active: Object.keys(BODY_PARTS)
        .map((p) => ({ p, lv: partLevel(knee, p, today) }))
        .filter((x): x is { p: string; lv: number } => x.lv != null && x.lv >= 1)
        .sort((a, b) => b.lv - a.lv),
      chart: painModel(knee, today)
    };
  }, [plan, today, log, knee, outOfPlan]);
  if (!plan || !today || !m) return null;

  const history = knee.slice().sort((a, b) => (a.date < b.date ? 1 : -1));
  const planStart = plan.weeks[0]?.start ?? todayStr;

  const apply = async (): Promise<void> => {
    const pr = m.proposal;
    if (!pr) return;
    const n = pr.changes.length;
    const ok = await confirmAction(
      `Prilagoditi plan? ${glagolZaBroj(n, 'Menja se ', 'Menjaju se ')}${brojTreninga(n)}. ${n === 1 ? 'Možeš ga' : 'Možeš ih'} ručno vratiti u tabu Plan.`
    );
    if (!ok) return;
    const done = applyProposal(plan, pr);
    window.alert(`${done} ${done === 1 ? 'trening prilagođen' : 'treninga prilagođeno'}.`);
  };

  const ready = readinessModel({
    status: m.status,
    load: m.now,
    wellness,
    today: todayStr as IsoDate
  });
  const openPart = (part: string | null): void =>
    openSheet({ kind: 'knee', props: { id: null, part } });

  return (
    <>
      <header className="screen-head">
        <h1>Oporavak</h1>
        <p>Da li smem da treniram po planu?</p>
      </header>
      <div className="cols">
        <div className="col">
          <ReadinessCard model={ready} />
          {m.proposal ? <ProposalCard proposal={m.proposal} onApply={() => void apply()} /> : null}
          <LoadCard now={m.now} planned={m.ahead} />

          <section className="card" aria-labelledby="bl-h">
            <CardHead title="Bol" extra="dodirni deo koji te boli" />
            <div className="pain-grid">
              <div className="pain-map">
                <div className="seg" role="group" aria-label="Pogled na telo">
                  {(['front', 'back'] as const).map((v) => (
                    <button
                      type="button"
                      key={v}
                      data-bv={v}
                      className={view === v ? 'on' : ''}
                      aria-pressed={view === v}
                      onClick={() => patchUi({ bodyView: v })}
                    >
                      {v === 'front' ? 'Prednja' : 'Zadnja'}
                    </button>
                  ))}
                </div>
                <div className="bodywrap">
                  <BodyMap view={view} pain={knee} today={today} onPart={(p) => openPart(p)} />
                </div>
              </div>
              <div className="pain-side">
                <h4 className="eyebrow">Poslednjih 14 dana</h4>
                {m.active.length ? (
                  <ul className="pain-active">
                    {m.active.map((x) => (
                      <li key={x.p}>
                        <button type="button" className="krow" onClick={() => openPart(x.p)}>
                          <span className={`kp ${x.lv >= 6 ? 'p2' : 'p1'}`}>{x.lv}</span>
                          <span className="ki">
                            <b>{partName(x.p)}</b>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="note-src">Nijedan deo nije označen kao bolan.</p>
                )}
                <ul className="bodylegend" aria-label="Nivoi bola">
                  <li>
                    <i className="l0" />0
                  </li>
                  <li>
                    <i className="l1" />
                    1–2
                  </li>
                  <li>
                    <i className="l2" />
                    3–5
                  </li>
                  <li>
                    <i className="l3" />
                    6+
                  </li>
                </ul>
              </div>
            </div>
            <p className="eyebrow sub-h">Kroz vreme · 0–10</p>
            {m.chart ? (
              <PainChart model={m.chart} selected={painSel} onSelect={setPainSel} />
            ) : (
              <p className="empty">Nema unosa.</p>
            )}
            <div className="btnrow">
              <button type="button" className="btn ghost" onClick={() => openPart(null)}>
                <Icon name="plus" size={16} /> Dodaj unos bola
              </button>
            </div>
          </section>
        </div>

        <div className="col">
          <WellnessCard wellness={wellness} connected={icu} today={todayStr as IsoDate} />
          <RestingHrCard wellness={wellness} today={todayStr as IsoDate} />
          <WeightCard
            kg={kg}
            today={today}
            planStart={planStart}
            onAdd={(date, input) => addWeightEntry(date, input, todayStr)}
            onDelete={(i) => {
              const x = kg[i];
              if (!x) return;
              void confirmAction(`Obrisati merenje ${x.kg} kg od ${fmtDayMonth(x.date)}?`).then(
                (ok) => {
                  if (ok) removeWeightAt(i);
                }
              );
            }}
            onDeleteBefore={() => {
              const n = kg.filter((x) => x && x.date < planStart).length;
              void confirmAction(
                `Obrisati ${n} ${pl3(n, 'merenje', 'merenja', 'merenja')} mase pre ${fmtDayMonth(planStart)}? Ovo se ne može poništiti.`
              ).then((ok) => {
                if (ok) removeWeightsBefore(planStart);
              });
            }}
          />

          <section className="card" aria-labelledby="ih-h">
            <CardHead
              title="Istorija bola"
              extra={
                history.length
                  ? `${history.length} ${pl3(history.length, 'unos', 'unosa', 'unosa')}`
                  : ''
              }
            />
            {history.length ? (
              history.map((k) => (
                <button
                  type="button"
                  className="krow"
                  key={k.id ?? `${k.date}-${k.pain}`}
                  onClick={() =>
                    k.id && openSheet({ kind: 'knee', props: { id: k.id, part: null } })
                  }
                >
                  <span className={`kp ${k.pain >= 6 ? 'p2' : k.pain >= 1 ? 'p1' : 'p0'}`}>
                    {k.pain}
                  </span>
                  <span className="ki">
                    <b>{partName(k.part)}</b>
                    <span className="ka">
                      {dowShort(k.date)} {fmtDayMonth(k.date)} · {k.act ?? ''}
                      {k.src ? ' · iz treninga' : ''}
                    </span>
                    {k.note ? <span className="kn">{k.note}</span> : null}
                  </span>
                </button>
              ))
            ) : (
              <p className="empty">Nema unosa.</p>
            )}
          </section>
        </div>
      </div>
    </>
  );
}

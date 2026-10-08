import { brojTreninga, fmtClock, fmtDayMonth, glagolZaBroj } from '../../domain/format';
import { tagName } from '../../domain/plan';
import { confirmAction } from '../../app/confirm';
import { ScreenFrame } from '../../components/ui/Shell';
import { Row, Section } from '../../components/ui/primitives';
import { useIcuConnected, useResolvedPlan, useTrainingStore } from '../../stores';
import { useIsOwner } from '../../stores/owner';
import { applyProposal as applyInjury } from '../../stores/recoveryActions';
import { applyProposal as applyPace, undoAdjustments } from '../../stores/raceActions';
import { useUIStore } from '../../stores/uiStore';
import { useRecoveryModel } from '../recovery/useRecoveryModel';
import { backToOwnPlan, recalibratePlan, startNewPlan } from './planActions';
import { useAdjustments } from './useAdjustments';

/* PRILAGODI PLAN: jedino mesto za sve što menja plan kao celinu — predlog zbog bola, predlog tempa prema formi, preračunavanje, novi plan. Predlozi se
   pojavljuju samo kad postoje (Danas tada nosi jedan red koji vodi ovamo). Pomeranje i izmena JEDNOG dana je u Detaljima treninga. */
export function AdjustPlan() {
  const plan = useResolvedPlan();
  const rec = useRecoveryModel();
  const adj = useAdjustments();
  const genPlan = useTrainingStore((s) => s.genPlan);
  const owner = useIsOwner();
  const icuOn = useIcuConnected();
  const todayStr = useUIStore((s) => s.today);
  const openScreen = useUIStore((s) => s.openScreen);
  const setWizard = useUIStore((s) => s.setWizard);
  if (!plan) return null;

  const injury = rec?.proposal ?? null;
  const pace = adj.proposal;

  const applyInjuryProposal = async (): Promise<void> => {
    if (!injury) return;
    const n = injury.changes.length;
    const ok = await confirmAction(
      `Prilagoditi plan? ${glagolZaBroj(n, 'Menja se ', 'Menjaju se ')}${brojTreninga(n)}. ${n === 1 ? 'Možeš ga' : 'Možeš ih'} ručno vratiti u Detaljima treninga.`
    );
    if (!ok) return;
    const done = applyInjury(plan, injury);
    window.alert(`${done} ${done === 1 ? 'trening prilagođen' : 'treninga prilagođeno'}.`);
  };

  const applyPaceProposal = async (): Promise<void> => {
    if (!pace) return;
    const n = pace.changes.length;
    const ok = await confirmAction(
      `Prilagoditi ciljni tempo tvojoj formi? ${glagolZaBroj(n, 'Menja se ', 'Menjaju se ')}${brojTreninga(n)}. Obim ostaje isti, a sve se vraća dugmetom „Vrati planski tempo“.`
    );
    if (!ok) return;
    const done = applyPace(plan, pace);
    window.alert(`${done} ${done === 1 ? 'trening prilagođen' : 'treninga prilagođeno'}.`);
  };

  return (
    <ScreenFrame>
      <header className="screen-head">
        <h1>Prilagodi plan</h1>
        <p>Predlozi i radnje koje menjaju plan kao celinu.</p>
      </header>

      {injury ? (
        <Section title="Zbog bola" extra={injury.urgent ? 'Hitno' : 'Predlog'}>
          <p className="prop-m">{injury.message}</p>
          {injury.changes.length ? (
            <>
              <p className="note-src">
                {glagolZaBroj(injury.changes.length, 'Menja se', 'Menjaju se')}{' '}
                {brojTreninga(injury.changes.length)}:{' '}
                {injury.changes
                  .slice(0, 4)
                  .map((x) => `${fmtDayMonth(x.date)} → ${x.rw ? 'Run/walk' : tagName(x.to)}`)
                  .join(' · ')}
                {injury.changes.length > 4 ? ' …' : ''}
              </p>
              <div className="btnrow start">
                <button type="button" className="btn" onClick={() => void applyInjuryProposal()}>
                  Prilagodi plan
                </button>
              </div>
              <p className="note-src">Svaki dan možeš ručno da vratiš u Detaljima treninga.</p>
            </>
          ) : (
            /* Predlog bez ijedne izmene postoji samo kad je trka u horizontu: trka se ne menja automatski. */
            <p className="note-src">Plan se ovim ne menja — odluku o trci donosiš sam.</p>
          )}
        </Section>
      ) : null}

      {pace ? (
        <Section title={pace.title} extra={pace.faster ? 'Brže' : 'Sporije'}>
          <p className="prop-m">{pace.message}</p>
          <p className="note-src">
            {pace.changes
              .slice(0, 3)
              .map(
                (c) =>
                  `${fmtDayMonth(c.date)} ${c.kind}: ${fmtClock(c.oldPace)}/km → ${fmtClock(c.newPace)}/km`
              )
              .join(' · ')}
            {pace.changes.length > 3 ? ' …' : ''}
          </p>
          <div className="btnrow start">
            <button type="button" className="btn" onClick={() => void applyPaceProposal()}>
              Prilagodi tempo
            </button>
          </div>
          <p className="note-src">
            Ručno izmenjeni i odrađeni treninzi se ne diraju. Sve se vraća ovde, dugmetom „Vrati
            planski tempo“.
          </p>
        </Section>
      ) : adj.adjusted ? (
        <Section title="Tempi su prilagođeni tvojoj formi">
          <p className="prop-m">
            Ciljni tempo preostalih kvalitetnih treninga prati izmereni VDOT, a ne polaznu
            pretpostavku plana.
          </p>
          <div className="btnrow start">
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
        </Section>
      ) : null}

      {!injury && !pace && !adj.adjusted ? (
        <p className="empty">Trenutno nema predloga za prilagođavanje plana.</p>
      ) : null}

      <Section title="Plan">
        <div className="rows">
          {genPlan?.ulaz ? (
            <Row
              icon="refresh"
              title="Preračunaj plan prema formi"
              sub="Tempi i obim preostalih nedelja prema izmerenoj formi"
              onClick={() => void recalibratePlan(plan, todayStr)}
            />
          ) : null}
          {genPlan?.ulaz ? (
            <Row
              icon="target"
              title="Promeni ciljno vreme"
              sub="Menjaju se samo nedelje koje tek dolaze"
              onClick={() => openScreen({ kind: 'cilj' })}
            />
          ) : null}
          {!genPlan ? (
            <Row
              icon="wand"
              title="Generiši novi plan"
              sub="Poseban plan za drugu trku; tvoj plan ostaje netaknut"
              onClick={() => setWizard(true)}
            />
          ) : owner ? (
            <Row
              icon="undo"
              title="Vrati na moj plan"
              sub="Generisan plan se trajno briše"
              onClick={backToOwnPlan}
            />
          ) : (
            <Row
              icon="wand"
              title="Napravi novi plan"
              sub="Postojeći plan i unosi uz njega se trajno brišu"
              onClick={startNewPlan}
            />
          )}
          {icuOn ? (
            <Row
              icon="watch"
              title="Pošalji na sat"
              sub="Treninzi narednih 14 dana"
              onClick={() => openScreen({ kind: 'sat' })}
            />
          ) : null}
        </div>
      </Section>
      <p className="note-src">
        „Prilagodi tempo“ menja samo ciljne tempe sesija. „Preračunaj plan“ menja ceo ostatak plana
        prema formi: tempi, projektovano vreme na dan trke i obim. Radi tek kad postoji bar 3
        merenja i kad se forma i plan razilaze za 1,5 VDOT ili više.
      </p>
    </ScreenFrame>
  );
}

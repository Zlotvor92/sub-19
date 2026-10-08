import { dowShort, fmtDayMonthYear } from '../../domain/format';
import { confirmAction } from '../../app/confirm';
import { ScreenFrame } from '../../components/ui/Shell';
import { Row, Section } from '../../components/ui/primitives';
import { useResolvedPlan, useTrainingStore } from '../../stores';
import { deleteEntry, setStatus } from '../../stores/dayActions';
import { useUIStore } from '../../stores/uiStore';
import { useCycleModel } from '../cycle/useCycleModel';
import { sessionView } from '../session/sessionModel';
import { useEasyPace } from '../session/useEasyPace';
import { WorkoutFacts, WorkoutStructure, WorkoutWhy } from '../session/WorkoutParts';
import { AiCard } from '../today/AiCard';
import { CompareCard, MorningCard, WatchCard, ZonesCard, dataDate } from '../today/Cards';
import { Description } from '../today/DayCard';
import { DayEntry } from '../today/DayEntry';
import { WeatherSection } from '../today/WeatherCard';

type Status = 'pending' | 'done' | 'skip';
const STATUSES: ReadonlyArray<readonly [Status, string]> = [
  ['pending', 'Predstoji'],
  ['done', 'Odrađen'],
  ['skip', 'Preskočen']
];

/* DETALJI TRENINGA: jedan ekran za sve što se o jednom danu zna i može. Redosled prati odluku: šta je i koliko (ciljevi), stanje, PRILAGODI TRENING
   (pomeri, zameni/skrati, vrati) dok trening još predstoji, struktura i „zašto“, unos i analiza posle trčanja. Otvara se sa Danas, iz Plana, iz liste
   aktivnosti i iz obaveštenja (`?dan=`) — uvek ista, jedna verzija. Dan odmora nema unos ni status, samo prilagođavanje. */
export function DayScreen({ id }: { id: string }) {
  const plan = useResolvedPlan();
  const day = plan?.byId.get(id);
  const status = useTrainingStore((s) => (s.log[id]?.status || 'pending') as Status);
  const entry = useTrainingStore((s) => s.log[id]);
  const alt = useTrainingStore((s) => s.alts[id]);
  const clearAlt = useTrainingStore((s) => s.clearAlt);
  const cycle = useCycleModel();
  const easy = useEasyPace();
  const today = useUIStore((s) => s.today);
  const openSheet = useUIStore((s) => s.openSheet);
  const closeScreen = useUIStore((s) => s.closeScreen);

  if (!plan || !day)
    return (
      <ScreenFrame>
        <div className="state">
          <b>Ovaj dan više ne postoji u planu.</b>
          <p>Plan je u međuvremenu promenjen.</p>
        </div>
      </ScreenFrame>
    );

  const rest = day.rest;
  const edited = !!alt;
  const view = sessionView(day, { alt, easyPaceSec: easy });
  const phase = cycle?.weeks.find((w) => w.w === day.w)?.phase ?? null;
  const weekFocus = plan.weeks.find((w) => w.w === day.w)?.focus ?? '';
  const when = day.test ? 'TEST (opciono)' : `${dowShort(day.date)} ${fmtDayMonthYear(day.date)}`;
  const pending = status !== 'done';

  const adjust = !day.test ? (
    <Section title="Prilagodi trening">
      <div className="rows">
        {status !== 'done' ? (
          <Row
            icon="swap"
            title="Pomeri na drugi dan"
            sub="Zamena sa drugim danom iste nedelje"
            onClick={() => openSheet({ kind: 'swap', props: { w: day.w, from: day.id } })}
          />
        ) : null}
        {status !== 'done' ? (
          <Row
            icon="edit"
            title={rest ? 'Dodaj trening' : 'Zameni ili skrati'}
            sub={rest ? 'Pretvori odmor u trening' : 'Vrsta treninga, kilometri, opis i tempo'}
            onClick={() => openSheet({ kind: 'alt', props: { id } })}
          />
        ) : null}
        {edited ? (
          <Row
            icon="undo"
            title="Vrati na plan"
            sub="Poništava izmenu ovog dana"
            onClick={() => {
              void confirmAction('Vratiti ovaj dan na originalni trening iz plana?').then((ok) => {
                if (ok) clearAlt(id);
              });
            }}
          />
        ) : null}
      </div>
    </Section>
  ) : null;

  return (
    <ScreenFrame>
      <header className="screen-head">
        <p className="eyebrow">
          N{day.w} · {when}
          {phase ? ` · ${phase}` : ''}
        </p>
        <h1>
          {rest ? 'Odmor' : view.title}
          {edited ? <small className="edited"> · izmenjen</small> : null}
        </h1>
        {rest ? <Description desc={day.desc || 'Dan odmora po planu.'} /> : null}
        {!rest && view.rows ? <p className="lede">{view.core}</p> : null}
        {!rest && !view.rows ? <Description desc={day.desc} /> : null}
      </header>

      {rest ? null : (
        <>
          <WorkoutFacts view={view} />
          <Section title="Status">
            <div className="seg" role="group" aria-label="Status treninga">
              {STATUSES.map(([s, label]) => (
                <button
                  type="button"
                  key={s}
                  className={status === s ? 'on' : ''}
                  aria-pressed={status === s}
                  onClick={() => {
                    if (s === status) return;
                    setStatus(day, s, today);
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </Section>
        </>
      )}

      {pending ? adjust : null}
      {rest ? null : <WeatherSection day={day} today={today} />}
      {rest ? null : <WorkoutStructure view={view} />}
      {rest ? null : <WorkoutWhy view={view} phase={phase} weekFocus={weekFocus} />}
      {rest ? null : (
        <Section
          title="Unos"
          extra={
            entry?.src === 'strava'
              ? `sa Strave${entry.lock ? ' · ručno korigovano' : ''}`
              : undefined
          }
        >
          <DayEntry day={day} plan={plan} today={today} />
        </Section>
      )}
      {rest || status !== 'done' ? null : (
        <>
          <WatchCard log={entry} date={dataDate(entry, day.date)} />
          <ZonesCard log={entry} />
          <MorningCard date={dataDate(entry, day.date)} />
          <CompareCard day={day} plan={plan} />
          <AiCard day={day} />
        </>
      )}
      {!pending ? adjust : null}
      {day.test ? (
        <Section title="Rezultat testa">
          <div className="rows">
            <Row
              icon="target"
              title="Unesi test na 3 km"
              sub="Test se ne mora istrčati baš na ovaj dan — datum upisuješ uz rezultat."
              onClick={() => openSheet({ kind: 't3k', props: { id: null } })}
            />
          </div>
        </Section>
      ) : null}
      {!rest && entry ? (
        <div className="btnrow start">
          <button
            type="button"
            className="btn danger"
            onClick={() => {
              void confirmAction('Obriši sve unete podatke za ovaj trening?').then((ok) => {
                if (!ok) return;
                deleteEntry(id);
                closeScreen();
              });
            }}
          >
            Obriši unos
          </button>
        </div>
      ) : null}
      <p className="note-src">Sve izmene se čuvaju automatski.</p>
    </ScreenFrame>
  );
}

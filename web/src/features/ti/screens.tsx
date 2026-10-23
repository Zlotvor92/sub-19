import { useState } from 'react';
import { ScreenFrame } from '../../components/ui/Shell';
import { Help } from '../../components/ui/Disclosure';
import { Facts, Row, Section } from '../../components/ui/primitives';
import { dataCounts } from '../../domain/settings';
import { brojTreninga, fmtKm } from '../../domain/format';
import { weekPlanKm } from '../../domain/day';
import { SCHEMA_VERSION } from '../../domain/state';
import { THEME_LABEL, type ThemePref } from '../../lib/theme';
import { useTheme } from '../../lib/useTheme';
import { getApp } from '../../app/appContext';
import { APP_VERSION } from '../../services/config';
import { useResolvedPlan, useTrainingStore } from '../../stores';
import { useAuthStore } from '../../stores/authStore';
import { useIsOwner } from '../../stores/owner';
import { useRecoveryStore } from '../../stores/recoveryStore';
import { useUIStore } from '../../stores/uiStore';
import {
  isFiveKV2Plan,
  isHmV2Plan,
  isMarathonV2Plan,
  isTenKV2Plan
} from '../../domain/generators/select';
import {
  useFiveKV2Setting,
  useFiveKV2ToggleVisible,
  setFiveKV2Setting,
  useTenKV2Setting,
  useTenKV2ToggleVisible,
  useHmV2Setting,
  useHmV2ToggleVisible,
  setHmV2Setting,
  useMarathonV2Setting,
  useMarathonV2ToggleVisible,
  setMarathonV2Setting,
  setTenKV2Setting
} from '../../stores/generatorFlags';
import {
  changeGoalTime,
  changeGoalTimeHmV2,
  changeGoalTimeMarathonV2,
  changeGoalTimeTenKV2,
  changeGoalTimeV2
} from '../plan/planActions';
import { GoalAssessmentLine } from '../plan/GoalAssessment';
import { useFormModel } from '../race/useFormModel';
import { AccountBody, useAccountInfo } from './accountSection';
import { AppRefresh } from './AppRefresh';
import { BroadcastBody, UsersBody } from './adminSections';
import { DataBody } from './dataSection';
import { IcuBody, WatchBody, useIcuInfo, useWatchInfo } from './icuSections';
import { PushBody, usePushStatus } from './pushSection';
import { profileRows } from './profileModel';
import { StravaBody, ZonesList, useStravaInfo } from './stravaSection';
import { WeatherBody } from './weatherSection';

/* EKRANI TABA „TI“. Svaki je jedan red sa početne („Ti“) i drži jednu stvar: profil, cilj, zone i postavke treninga, povezani servisi (Strava, intervals.icu,
   slanje na sat), obaveštenja, izgled, privatnost i podaci, o aplikaciji, vlasnik. Sadržaj sekcija je isti kao u starim Podešavanjima — menja se samo mesto
   i redosled; nijedna radnja nije izbačena. */

function Head({ title, sub }: { title: string; sub?: string }) {
  return (
    <header className="screen-head">
      <h1>{title}</h1>
      {sub ? <p>{sub}</p> : null}
    </header>
  );
}

/* ------------------------------------------------------------- Moj profil */

export function ProfileScreen() {
  const signedIn = useAuthStore((s) => s.hasSession);
  const email = useAuthStore((s) => s.email);
  const genPlan = useTrainingStore((s) => s.genPlan);
  const account = useAccountInfo();
  const rows = profileRows(genPlan?.ulaz);
  return (
    <ScreenFrame>
      <Head title="Moj profil" sub={signedIn ? (email ?? '') : 'Nisi prijavljen'} />
      {account.visible ? (
        <Section title="Nalog" extra={account.summary}>
          <AccountBody />
        </Section>
      ) : null}
      <Section title="Trkačko iskustvo">
        {rows.length ? (
          <>
            <Facts items={rows.map((r) => ({ label: r.label, value: r.value }))} />
            <p className="note-src">
              Ovo je ono što je plan dobio kad je pravljen. Cilj menjaš u Ti → Cilj, a sve ostalo
              novim planom (Plan → Prilagodi plan).
            </p>
          </>
        ) : (
          <p className="empty">
            {genPlan
              ? 'Plan nema zapamćene polazne podatke.'
              : 'Koristiš ugrađeni plan — polazni podaci se unose tek kad praviš novi.'}
          </p>
        )}
      </Section>
    </ScreenFrame>
  );
}

/* ------------------------------------------------------------- Cilj */

export function GoalScreen() {
  const m = useFormModel();
  const genPlan = useTrainingStore((s) => s.genPlan);
  const today = useUIStore((s) => s.today);
  const setWizard = useUIStore((s) => s.setWizard);
  const [goal, setGoal] = useState('');
  const [busy, setBusy] = useState(false);
  if (!m) return null;
  const rows = profileRows(genPlan?.ulaz).filter((r) =>
    ['Trka', 'Datum trke', 'Polazni rezultat'].includes(r.label)
  );
  return (
    <ScreenFrame>
      <Head title="Cilj" sub={m.refs.raceName} />
      <div className="goal-big">
        <span className="eyebrow">Ciljno vreme</span>
        <span className="hero-v goal num">{m.goalText}</span>
      </div>
      {rows.length ? <Facts items={rows.map((r) => ({ label: r.label, value: r.value }))} /> : null}
      <GoalAssessmentLine meta={genPlan?.meta} />
      {genPlan?.ulaz ? (
        <Section title="Promeni ciljno vreme">
          <div className="f-field">
            <label htmlFor="pl-goal">Novo ciljno vreme</label>
            <input
              id="pl-goal"
              inputMode="numeric"
              placeholder={m.goalText}
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
            />
          </div>
          <div className="btnrow start">
            <button
              type="button"
              className="btn"
              id="pl-goal-ok"
              disabled={busy}
              onClick={() => {
                setBusy(true);
                void changeGoalTime(genPlan, goal, today)
                  .then((ok) => {
                    if (ok) setGoal('');
                  })
                  .finally(() => setBusy(false));
              }}
            >
              Promeni cilj
            </button>
          </div>
          <Help summary="Šta se menja kad promeniš cilj">
            <p>
              Menjaju se samo nedelje koje <b>tek dolaze</b> — i to tempi sesija vezanih za tempo
              trke. Odrađeni treninzi, uneti tempi i izmerena forma ostaju netaknuti; cilj govori o
              budućnosti, pa ne dira prošlost. Ručno zaključani tempi zadržavaju svoju vrednost.
            </p>
          </Help>
        </Section>
      ) : genPlan && isFiveKV2Plan(genPlan) ? (
        <Section title="Promeni ciljno vreme">
          <div className="f-field">
            <label htmlFor="pl-goal">Novo ciljno vreme</label>
            <input
              id="pl-goal"
              inputMode="numeric"
              placeholder={m.goalText}
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
            />
          </div>
          <div className="btnrow start">
            <button
              type="button"
              className="btn"
              id="pl-goal-ok"
              disabled={busy}
              onClick={() => {
                setBusy(true);
                void changeGoalTimeV2(genPlan, goal, today)
                  .then((ok) => {
                    if (ok) setGoal('');
                  })
                  .finally(() => setBusy(false));
              }}
            >
              Promeni cilj
            </button>
          </div>
          <Help summary="Šta se menja kad promeniš cilj">
            <p>
              U planu 5K v2 cilj se samo <b>procenjuje</b> (izvodljiv, ambiciozan, nerealan…) iz
              trenutne forme. Treninzi, tempo i obim ostaju isti — tempo menja samo nov rezultat
              (test 3 km ili trka), kroz Plan → Prilagodi plan.
            </p>
          </Help>
        </Section>
      ) : genPlan && isTenKV2Plan(genPlan) ? (
        <Section title="Promeni ciljno vreme">
          <div className="f-field">
            <label htmlFor="pl-goal">Novo ciljno vreme</label>
            <input
              id="pl-goal"
              inputMode="numeric"
              placeholder={m.goalText}
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
            />
          </div>
          <div className="btnrow start">
            <button
              type="button"
              className="btn"
              id="pl-goal-ok"
              disabled={busy}
              onClick={() => {
                setBusy(true);
                void changeGoalTimeTenKV2(genPlan, goal, today)
                  .then((ok) => {
                    if (ok) setGoal('');
                  })
                  .finally(() => setBusy(false));
              }}
            >
              Promeni cilj
            </button>
          </div>
          <Help summary="Šta se menja kad promeniš cilj">
            <p>
              U planu 10K v2 cilj se samo <b>procenjuje</b> (realističan, ambiciozan, nerealan) iz
              trenutne forme; plan po osećaju ocenu dobija posle rezultata. Treninzi, tempo i obim
              ostaju isti — tempo menja samo nov rezultat (test 5 km, test 3 km ili trka), kroz Plan
              → Prilagodi plan.
            </p>
          </Help>
        </Section>
      ) : genPlan && isHmV2Plan(genPlan) ? (
        <Section title="Promeni ciljno vreme">
          <div className="f-field">
            <label htmlFor="pl-goal">Novo ciljno vreme</label>
            <input
              id="pl-goal"
              inputMode="numeric"
              placeholder={m.goalText}
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
            />
          </div>
          <div className="btnrow start">
            <button
              type="button"
              className="btn"
              id="pl-goal-ok"
              disabled={busy}
              onClick={() => {
                setBusy(true);
                void changeGoalTimeHmV2(genPlan, goal, today)
                  .then((ok) => {
                    if (ok) setGoal('');
                  })
                  .finally(() => setBusy(false));
              }}
            >
              Promeni cilj
            </button>
          </div>
          <Help summary="Šta se menja kad promeniš cilj">
            <p>
              U planu polumaratona v2 cilj se samo <b>procenjuje</b> (realističan, ambiciozan,
              nerealan) iz trenutne forme; plan po osećaju ocenu dobija posle rezultata. Treninzi,
              tempo i obim ostaju isti — tempo menja samo nov rezultat (test 5 km plana ili trka),
              kroz Plan → Prilagodi plan.
            </p>
          </Help>
        </Section>
      ) : genPlan && isMarathonV2Plan(genPlan) ? (
        <Section title="Promeni ciljno vreme">
          <div className="f-field">
            <label htmlFor="pl-goal">Novo ciljno vreme</label>
            <input
              id="pl-goal"
              inputMode="numeric"
              placeholder={m.goalText}
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
            />
          </div>
          <div className="btnrow start">
            <button
              type="button"
              className="btn"
              id="pl-goal-ok"
              disabled={busy}
              onClick={() => {
                setBusy(true);
                void changeGoalTimeMarathonV2(genPlan, goal, today)
                  .then((ok) => {
                    if (ok) setGoal('');
                  })
                  .finally(() => setBusy(false));
              }}
            >
              Promeni cilj
            </button>
          </div>
          <Help summary="Šta se menja kad promeniš cilj">
            <p>
              U planu maratona v2 cilj se samo <b>procenjuje</b> (realističan, ambiciozan, nerealan)
              iz trenutne forme; plan po osećaju ocenu dobija posle rezultata. Treninzi, tempo i
              obim ostaju isti — tempo menja samo nov rezultat (test 5 km plana ili trka), kroz Plan
              → Prilagodi plan.
            </p>
          </Help>
        </Section>
      ) : genPlan ? (
        <Section>
          <p className="note-src">
            Ovaj plan nema sačuvane polazne podatke iz čarobnjaka, pa se cilj ne može promeniti
            ovde. Za drugi cilj napravi novi plan (Plan → Prilagodi plan); postojeći plan i unosi uz
            njega se tada trajno brišu, pa prvo izvezi backup.
          </p>
        </Section>
      ) : (
        <Section>
          <p className="note-src">
            Ugrađeni plan ima svoj cilj, koji se ne menja. Za drugu trku ili drugo vreme napravi
            novi plan — tvoj ostaje netaknut.
          </p>
          <div className="btnrow start">
            <button type="button" className="btn ghost" onClick={() => setWizard(true)}>
              Generiši novi plan
            </button>
          </div>
        </Section>
      )}
    </ScreenFrame>
  );
}

/* ------------------------------------------------------------- Zone i postavke treninga */

export function TrainingSettingsScreen() {
  /* 08b: prekidač 5K v2 vidi samo razvoj (VITE_FIVEK_V2) ili administrator; 10K v2 (segment 05) isto (VITE_TENK_V2),
     HM v2 (segment HM-05) isto (VITE_HM_V2), maraton v2 (segment MAR-05) isto (VITE_MARATHON_V2). */
  const toggle = useFiveKV2ToggleVisible();
  const tenK = useTenKV2ToggleVisible();
  const hm = useHmV2ToggleVisible();
  const marathon = useMarathonV2ToggleVisible();
  return (
    <ScreenFrame>
      <Head title="Zone i postavke treninga" />
      <Section title="Zone pulsa">
        <ZonesList />
      </Section>
      {toggle || tenK || hm || marathon ? (
        <Section title="Generator plana">
          {toggle ? <FiveKV2Toggle /> : null}
          {tenK ? <TenKV2Toggle /> : null}
          {hm ? <HmV2Toggle /> : null}
          {marathon ? <MarathonV2Toggle /> : null}
        </Section>
      ) : null}
      <Section title="Vreme i lokacija">
        <WeatherBody />
      </Section>
    </ScreenFrame>
  );
}

/* ------------------------------------------------------------- Povezani servisi */

export function ServicesScreen() {
  const openScreen = useUIStore((s) => s.openScreen);
  const strava = useStravaInfo();
  const icu = useIcuInfo();
  const watch = useWatchInfo();
  return (
    <ScreenFrame>
      <Head title="Povezani servisi" sub="Odavde stižu trčanja i jutarnja merenja" />
      <div className="rows">
        <Row
          icon="link"
          title="Strava"
          sub={strava.summary}
          end={<span className={`dot${strava.dot ? ' on' : ''}`} aria-hidden="true" />}
          onClick={() => openScreen({ kind: 'strava' })}
        />
        <Row
          icon="pulse"
          title="intervals.icu"
          sub={icu.summary}
          end={<span className={`dot${icu.dot ? ' on' : ''}`} aria-hidden="true" />}
          onClick={() => openScreen({ kind: 'icu' })}
        />
        {watch.visible ? (
          <Row
            icon="watch"
            title="Slanje na sat"
            sub={watch.summary}
            end={
              <span
                className={`dot${watch.dot === true ? ' on' : watch.dot === 'warn' ? ' warn' : ''}`}
                aria-hidden="true"
              />
            }
            onClick={() => openScreen({ kind: 'sat' })}
          />
        ) : null}
      </div>
      <p className="note-src">
        Strava i intervals.icu mogu da budu povezani istovremeno; intervals.icu daje tačnije krugove
        intervala, a Strava ostaje kao rezerva.
      </p>
    </ScreenFrame>
  );
}

export function StravaScreen() {
  return (
    <ScreenFrame>
      <Head title="Strava" />
      <StravaBody />
    </ScreenFrame>
  );
}

export function IcuScreen() {
  return (
    <ScreenFrame>
      <Head title="intervals.icu" />
      <IcuBody />
    </ScreenFrame>
  );
}

export function WatchScreen() {
  return (
    <ScreenFrame>
      <Head title="Slanje na sat" sub="Planirani treninzi stižu u intervals.icu kalendar" />
      <WatchBody />
    </ScreenFrame>
  );
}

/* ------------------------------------------------------------- Obaveštenja */

export function NotificationsScreen() {
  const [status, reload] = usePushStatus();
  return (
    <ScreenFrame>
      <Head title="Obaveštenja" sub="Podsetnici za trening" />
      <PushBody status={status} reload={reload} />
    </ScreenFrame>
  );
}

/* ------------------------------------------------------------- Izgled */

const THEME_HINT: Readonly<Record<ThemePref, string>> = {
  auto: 'Prati podešavanje telefona ili računara.',
  light: 'Uvek svetla pozadina.',
  dark: 'Uvek tamna pozadina.'
};

export function AppearanceScreen() {
  const [pref, setPref] = useTheme();
  return (
    <ScreenFrame>
      <Head title="Izgled aplikacije" />
      <div className="seg" role="group" aria-label="Tema">
        {(['auto', 'light', 'dark'] as const).map((k) => (
          <button
            type="button"
            key={k}
            data-theme-pref={k}
            className={pref === k ? 'on' : ''}
            aria-pressed={pref === k}
            onClick={() => setPref(k)}
          >
            {THEME_LABEL[k]}
          </button>
        ))}
      </div>
      <p className="note-src">
        {THEME_HINT[pref]} Izbor važi samo za ovaj uređaj i ne šalje se na server.
      </p>
    </ScreenFrame>
  );
}

/* ------------------------------------------------------------- Privatnost i podaci */

export function PrivacyScreen() {
  const signedIn = useAuthStore((s) => s.hasSession);
  const openSheet = useUIStore((s) => s.openSheet);
  return (
    <ScreenFrame>
      <Head title="Privatnost i podaci" />
      <DataBody />
      <Section title="Politika privatnosti">
        <div className="rows">
          <Row
            icon="shield"
            title="Politika privatnosti"
            sub="Šta se čuva, gde i kome se šalje"
            href="./privacy.html"
          />
        </div>
      </Section>
      {signedIn ? (
        <Section title="Nalog">
          <div className="rows">
            <Row
              icon="trash"
              title="Obriši nalog"
              sub="Briše nalog i sve podatke sa servera. Ne može da se poništi."
              onClick={() => openSheet({ kind: 'delete-account' })}
            />
          </div>
        </Section>
      ) : null}
    </ScreenFrame>
  );
}

/* ------------------------------------------------------------- O aplikaciji */

export function AboutScreen() {
  const plan = useResolvedPlan();
  const log = useTrainingStore((s) => s.log);
  const pred = useTrainingStore((s) => s.pred);
  const pain = useRecoveryStore((s) => s.knee);
  const kg = useRecoveryStore((s) => s.kg);
  const persistent = getApp().kv.persistent;
  const counts = dataCounts({
    workouts: Object.keys(log).length,
    pain: pain.length,
    weight: kg.length,
    paces: Object.keys(pred).length
  });
  const totalKm = plan ? plan.weeks.reduce((s, w) => s + weekPlanKm(w), 0) : 0;
  const trainings = plan?.trainingDays ?? 0;
  return (
    <ScreenFrame>
      <Head title="O aplikaciji" />
      <div className="about-id">
        <img src="./icon-192.png" alt="" width="64" height="64" />
        <div>
          <b>sub20</b>
          <span>
            Verzija {APP_VERSION} · šema v{SCHEMA_VERSION}
          </span>
        </div>
      </div>
      {persistent ? null : (
        <p className="note-src warn">
          Skladište nedostupno: podaci žive samo dok je stranica otvorena. Proveri da pregledač ne
          blokira čuvanje podataka za ovu stranicu.
        </p>
      )}
      <Facts
        items={[
          { label: 'Plan', value: `${brojTreninga(trainings)} · ${fmtKm(totalKm)} km` },
          { label: 'Na uređaju', value: counts }
        ]}
      />
      <Section title="Offline kopija">
        <AppRefresh />
      </Section>
      <Section title="Pomoć">
        <div className="rows">
          <Row icon="book" title="Uputstvo" href="./uputstvo.html" />
          <Row icon="shield" title="Politika privatnosti" href="./privacy.html" />
        </div>
      </Section>
    </ScreenFrame>
  );
}

/* ------------------------------------------------------------- Vlasnik */

export function OwnerScreen() {
  const owner = useIsOwner();
  if (!owner) return null;
  return (
    <ScreenFrame>
      <Head title="Vlasnik" sub="Vidiš samo ti" />
      <Section title="Obaveštenje korisnicima">
        <BroadcastBody />
      </Section>
      <Section title="Korisnici">
        <UsersBody />
      </Section>
    </ScreenFrame>
  );
}

/** Prekidač 5K v2 (podrazumevano isključen): utiče samo na NOV 5K plan; postojeći plan ostaje na svom generatoru. */
function FiveKV2Toggle() {
  const { on, setting, forced } = useFiveKV2Setting();
  return (
    <>
      <label className="note-src" htmlFor="set-fivek-v2">
        <input
          type="checkbox"
          id="set-fivek-v2"
          checked={setting}
          onChange={(e) => setFiveKV2Setting(e.target.checked)}
        />{' '}
        Novi 5K plan pravi generator v2 (probno)
      </label>
      <p className="note-src">
        Važi samo za novi 5K plan iz čarobnjaka. Postojeći plan se ne menja. Plan v2 se prilagođava
        kroz Plan → Prilagodi plan (pregled, pa potvrda).
        {forced ? ` Razvojno podešavanje ga trenutno ${on ? 'uključuje' : 'isključuje'}.` : ''}
      </p>
    </>
  );
}

/** Prekidač 10K v2 (podrazumevano isključen): utiče samo na NOV 10K plan; postojeći plan ostaje na svom generatoru. */
function TenKV2Toggle() {
  const { on, setting, forced } = useTenKV2Setting();
  return (
    <>
      <label className="note-src" htmlFor="set-tenk-v2">
        <input
          type="checkbox"
          id="set-tenk-v2"
          checked={setting}
          onChange={(e) => setTenKV2Setting(e.target.checked)}
        />{' '}
        Novi 10K plan pravi generator v2 (probno)
      </label>
      <p className="note-src">
        Važi samo za novi 10K plan iz čarobnjaka. Postojeći plan se ne menja.
        {forced ? ` Razvojno podešavanje ga trenutno ${on ? 'uključuje' : 'isključuje'}.` : ''}
      </p>
    </>
  );
}

/** Prekidač HM v2 (podrazumevano isključen): utiče samo na NOV plan polumaratona; postojeći plan ostaje na svom
 *  generatoru. */
function HmV2Toggle() {
  const { on, setting, forced } = useHmV2Setting();
  return (
    <>
      <label className="note-src" htmlFor="set-hm-v2">
        <input
          type="checkbox"
          id="set-hm-v2"
          checked={setting}
          onChange={(e) => setHmV2Setting(e.target.checked)}
        />{' '}
        Novi plan polumaratona pravi generator v2 (probno)
      </label>
      <p className="note-src">
        Važi samo za novi plan polumaratona iz čarobnjaka. Postojeći plan se ne menja. Plan
        polumaratona v2 se prilagođava kroz Plan → Prilagodi plan (pregled, pa potvrda).
        {forced ? ` Razvojno podešavanje ga trenutno ${on ? 'uključuje' : 'isključuje'}.` : ''}
      </p>
    </>
  );
}

/** Prekidač maratona v2 (podrazumevano isključen): utiče samo na NOV plan maratona; postojeći plan ostaje na svom
 *  generatoru. */
function MarathonV2Toggle() {
  const { on, setting, forced } = useMarathonV2Setting();
  return (
    <>
      <label className="note-src" htmlFor="set-marathon-v2">
        <input
          type="checkbox"
          id="set-marathon-v2"
          checked={setting}
          onChange={(e) => setMarathonV2Setting(e.target.checked)}
        />{' '}
        Novi plan maratona pravi generator v2 (probno)
      </label>
      <p className="note-src">
        Važi samo za novi plan maratona iz čarobnjaka. Postojeći plan se ne menja. Plan maratona v2
        se prilagođava kroz Plan → Prilagodi plan (pregled, pa potvrda).
        {forced ? ` Razvojno podešavanje ga trenutno ${on ? 'uključuje' : 'isključuje'}.` : ''}
      </p>
    </>
  );
}

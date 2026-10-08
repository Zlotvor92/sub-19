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
import { changeGoalTime } from '../plan/planActions';
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
  return (
    <ScreenFrame>
      <Head title="Zone i postavke treninga" />
      <Section title="Zone pulsa">
        <ZonesList />
      </Section>
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

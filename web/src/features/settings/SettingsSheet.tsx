import { useState } from 'react';
import { brojTreninga, fmtKm } from '../../domain/format';
import { weekPlanKm } from '../../domain/day';
import {
  SETTINGS_GROUPS,
  backupDue,
  dataCounts,
  groupForSection,
  settingsHero,
  waitingText,
  type SettingsGroupId,
  type SettingsItem
} from '../../domain/settings';
import { getApp } from '../../app/appContext';
import { downloadText } from '../../lib/download';
import { SCHEMA_VERSION } from '../../domain/state';
import { APP_VERSION } from '../../services/config';
import { useResolvedPlan, useSettingsStore, useTrainingStore } from '../../stores';
import { useRecoveryStore } from '../../stores/recoveryStore';
import { useAuthStore } from '../../stores/authStore';
import { useUIStore } from '../../stores/uiStore';
import { SettingCard } from './SettingCard';
import {
  BroadcastBody,
  ChallengeEditor,
  UsersBody,
  useBroadcastInfo,
  useUsersInfo
} from './adminSections';
import { AppRefresh } from './AppRefresh';
import { PushBody, usePushInfo, usePushStatus } from './pushSection';
import { CommunityBody, useCommunityInfo } from './communitySection';
import { WeatherBody, useWeatherInfo } from './weatherSection';
import { IcuBody, WatchBody, pushToWatch, useIcuInfo, useWatchInfo } from './icuSections';
import { AccountBody, useAccountInfo } from './accountSection';
import { DataBody, useDataInfo } from './dataSection';
import { PlanBody, usePlanInfo } from './planSection';
import type { SectionInfo } from './sectionInfo';
import { StravaBody, useStravaInfo } from './stravaSection';

/* Stavke vrha ekrana za koje postoji sekcija sa dugmetom koje radnju obavlja (stavka bez sekcije bi imala mrtvo dugme). */
const IMPLEMENTED: ReadonlySet<SettingsItem['key']> = new Set([
  'nalog',
  'strava',
  'icu',
  'sat',
  'backup'
]);

const ITEM_SECTION: Record<SettingsItem['key'], string> = {
  nalog: 'Nalog',
  strava: 'Strava',
  icu: 'intervals.icu',
  sat: 'Slanje na sat',
  backup: 'Podaci'
};

/* PODEŠAVANJA I PODACI. Vrh odgovara na pitanje „je li sve u redu?"; ispod su grupe sa sekcijama (izbor grupe se NE pamti između
   otvaranja — skače se na onu u kojoj nešto čeka, a kad ništa ne čeka, na prvu). */
export function SettingsSheet() {
  const today = useUIStore((s) => s.today);
  const plan = useResolvedPlan();
  const log = useTrainingStore((s) => s.log);
  const pred = useTrainingStore((s) => s.pred);
  const knee = useRecoveryStore((s) => s.knee);
  const kg = useRecoveryStore((s) => s.kg);
  const ui = useSettingsStore((s) => s.ui);
  const strava = useSettingsStore((s) => s.strava);
  const icu = useSettingsStore((s) => s.icu);
  const signedIn = useAuthStore((s) => s.hasSession);
  const configured = useAuthStore((s) => s.configured);

  const [pushStatus, reloadPush] = usePushStatus();
  const infos: Record<string, SectionInfo> = {
    Nalog: useAccountInfo(),
    Plan: usePlanInfo(),
    Strava: useStravaInfo(),
    Vreme: useWeatherInfo(),
    Zajednica: useCommunityInfo(),
    Obaveštenja: usePushInfo(pushStatus),
    'Obaveštenje korisnicima': useBroadcastInfo(),
    Korisnici: useUsersInfo(),
    'intervals.icu': useIcuInfo(),
    'Slanje na sat': useWatchInfo(),
    Podaci: useDataInfo()
  };

  const icuConnected = !!(icu && (icu as { athleteId?: unknown }).athleteId);
  const hero = settingsHero({
    accountConfigured: configured,
    signedIn,
    stravaConnected: !!strava,
    icuConnected,
    watchPushed: !!(icu && (icu as { lastPush?: unknown }).lastPush),
    backupOk: signedIn || (!!ui.lastBackup && !backupDue(today, ui, signedIn)),
    hasBackupDate: !!ui.lastBackup
  });
  const items = hero.items.filter((i) => IMPLEMENTED.has(i.key));
  const waiting = items.filter((i) => !i.ok);
  const first = waiting[0] ?? null;

  const visibleGroups = SETTINGS_GROUPS.filter((g) =>
    g.sections.some((name) => infos[name]?.visible)
  );
  const [group, setGroup] = useState<SettingsGroupId>(() => {
    const target = first ? groupForSection(ITEM_SECTION[first.key]) : null;
    return (
      (target && visibleGroups.some((g) => g.id === target) ? target : visibleGroups[0]?.id) ??
      'nalog'
    );
  });
  const active = visibleGroups.find((g) => g.id === group) ?? visibleGroups[0];

  const heroAction = (key: SettingsItem['key']): void => {
    if (key === 'nalog') getApp().login();
    else if (key === 'strava') getApp().strava.connect();
    else if (key === 'icu')
      void getApp()
        .icu.connect()
        .then((r) => {
          if (!r.ok) window.alert(r.error);
        });
    else if (key === 'sat') void pushToWatch(false);
    else if (key === 'backup') downloadText(`sub19-backup-${today}.json`, getApp().exportBackup());
  };

  const counts = dataCounts({
    workouts: Object.keys(log).length,
    pain: knee.length,
    weight: kg.length,
    paces: Object.keys(pred).length
  });
  const totalKm = plan ? plan.weeks.reduce((s, w) => s + weekPlanKm(w), 0) : 0;
  const trainings = plan?.trainingDays ?? 0;
  const persistent = getApp().kv.persistent;

  const section = (name: string, body: React.ReactNode) => {
    const info = infos[name];
    if (!info?.visible || groupForSection(name) !== active?.id) return null;
    return (
      <SettingCard
        key={name}
        name={name}
        summary={info.summary}
        dot={info.dot}
        defaultOpen={info.open}
      >
        {body}
      </SettingCard>
    );
  };

  return (
    <>
      <div className="sh-t">Podešavanja i podaci</div>
      <div className="sh-s">{counts}</div>
      {persistent ? null : (
        <div className="kb warn">
          <div>
            <div>Skladište nedostupno</div>
            <small>
              Podaci žive samo dok je stranica otvorena. Proveri da pregledač ne blokira čuvanje
              podataka za ovu stranicu.
            </small>
          </div>
        </div>
      )}

      <div className="set-hero">
        {first ? (
          <>
            <div className="set-hs">
              <span className="dot warn" />
              <b>{waitingText(waiting.length)}</b>
            </div>
            <p>{first.text}</p>
          </>
        ) : (
          <>
            <div className="set-hs">
              <span className="dot on" />
              <b>Sve je povezano</b>
            </div>
            <p>{items.map((x) => x.name).join(', ')} — ništa ne čeka.</p>
          </>
        )}
        <div className="set-bars">
          {items.map((x) => (
            <i key={x.key} className={x.ok ? '' : 'a'} />
          ))}
        </div>
        {first ? (
          <div className="btnrow" style={{ marginTop: 13 }}>
            <button
              type="button"
              className="btn"
              id={`hero-${first.key}`}
              onClick={() => heroAction(first.key)}
            >
              {first.action}
            </button>
          </div>
        ) : null}
      </div>

      <div className="zseg set-seg" role="tablist" aria-label="Grupe podešavanja">
        {visibleGroups.map((g) => (
          <button
            type="button"
            role="tab"
            key={g.id}
            aria-selected={active?.id === g.id}
            className={active?.id === g.id ? 'on' : ''}
            data-sg={g.id}
            onClick={() => setGroup(g.id)}
          >
            {g.label}
          </button>
        ))}
      </div>
      <div className="set-sub" id="set-naslov">
        {active?.title}
      </div>

      {section('Nalog', <AccountBody />)}
      {section('Podaci', <DataBody />)}
      {section('Plan', <PlanBody />)}
      {section('Vreme', <WeatherBody />)}
      {section('Obaveštenja', <PushBody status={pushStatus} reload={reloadPush} />)}
      {section(
        'Zajednica',
        <>
          <CommunityBody />
          <ChallengeEditor />
        </>
      )}
      {section('Obaveštenje korisnicima', <BroadcastBody />)}
      {section('Korisnici', <UsersBody />)}
      {section('Strava', <StravaBody />)}
      {section('intervals.icu', <IcuBody />)}
      {section('Slanje na sat', <WatchBody />)}

      <AppRefresh />
      <div className="note-src" style={{ marginTop: 6 }}>
        Verzija {APP_VERSION} · šema v{SCHEMA_VERSION} · {brojTreninga(trainings)} /{' '}
        {fmtKm(totalKm)} km ·{' '}
        <a href="./uputstvo.html" target="_blank" rel="noopener" style={{ color: 'inherit' }}>
          Uputstvo
        </a>{' '}
        ·{' '}
        <a href="./privacy.html" target="_blank" rel="noopener" style={{ color: 'inherit' }}>
          Politika privatnosti
        </a>
      </div>
    </>
  );
}

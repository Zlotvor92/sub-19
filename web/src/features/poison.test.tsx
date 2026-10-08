import { act, cleanup, render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { adaptGeneratedPlan } from '../domain/plan/adapt';
import { migrateState, seedState, type PersistedState } from '../domain/state';
import { generatePlan } from '../domain/training/generator/generatePlan';
import { setApp } from '../app/appContext';
import { createApp } from '../app/createApp';
import { hydratePersisted } from '../stores';
import { createKeyValueStore, type StorageLike } from '../services/storage/kv';
import { useAuthStore } from '../stores/authStore';
import { useUIStore } from '../stores/uiStore';
import { DayScreen } from './day/DayScreen';
import { AdjustPlan } from './plan/AdjustPlan';
import PlanPage from './plan';
import { PlanOverview } from './plan/PlanOverview';
import ProgressPage from './progress';
import { ActivitiesScreen } from './progress/ActivitiesScreen';
import { FormScreen } from './race/FormScreen';
import { RaceAnalysisScreen } from './race/RaceAnalysis';
import { BolScreen } from './recovery/BolScreen';
import { MasaScreen } from './recovery/MasaScreen';
import { OporavakScreen } from './recovery/OporavakScreen';
import { SheetHost } from './sheets';
import TodayPage from './today';
import TiPage from './ti';
import {
  AboutScreen,
  AppearanceScreen,
  GoalScreen,
  IcuScreen,
  NotificationsScreen,
  OwnerScreen,
  PrivacyScreen,
  ProfileScreen,
  ServicesScreen,
  StravaScreen,
  TrainingSettingsScreen,
  WatchScreen
} from './ti/screens';

/* parity: test/bezbednost.test.mjs → „Fuzz — svako polje stanja otrovano, svaki ekran iscrtan" (+ „Drugi sloj — iscrtavanje escapuje i kad validacija otkaže").
   Catch-all: ne cilja poznatu rupu nego traži one koje niko nije nabrojao. Ako neka buduća kartica zaboravi da je tekst iz stanja NEPOVERLjIV (npr. postavi ga
   kao HTML, kao `href` ili kao CSS), ovo pada bez izmene testa. Svaki ekran se iscrtava sa otrovanim poljima, pa se čita REZULTAT (DOM), ne izvor. */

const PAYLOADS = [
  `"><img src=x onerror=alert(1)>`,
  `'><svg/onload=alert(1)>`,
  `"><script>alert(1)</script>`,
  `javascript:alert(1)`,
  `" autofocus onfocus=alert(1) x="`,
  `https://lh3.googleusercontent.com/a&#34;&#41;&#59;position:fixed&#59;inset:0&#59;z-index:99999&#59;background:red&#59;x:url&#40;&#34;`
];

const TODAY = '2026-06-22';
const FORBIDDEN_TAGS = 'script,iframe,object,embed,img,link,meta,style,base,form[action]';
const DANGEROUS_STYLE =
  /position\s*:\s*(fixed|absolute|sticky)|inset\s*:|z-index\s*:\s*\d{3,}|url\(/i;

/** Sve što bi značilo da je tekst iz stanja postao KOD: nedozvoljen element, rukovalac događaja, `javascript:` adresa ili CSS koji aplikacija sama ne emituje. */
function injected(root: ParentNode): string[] {
  const found: string[] = [];
  for (const el of Array.from(root.querySelectorAll(FORBIDDEN_TAGS))) {
    /* Jedina slika koju aplikacija sama iscrtava je njen znak (statična adresa); sve ostalo bi značilo da je adresa došla iz stanja. */
    if (el.tagName === 'IMG' && el.getAttribute('src') === './icon-192.png') continue;
    found.push(`<${el.tagName.toLowerCase()}>`);
  }
  for (const el of Array.from(root.querySelectorAll('*'))) {
    for (const a of Array.from(el.attributes)) {
      if (/^on/i.test(a.name)) found.push(`${el.tagName.toLowerCase()}[${a.name}]`);
      if (
        /^(href|src|action|formaction|xlink:href)$/i.test(a.name) &&
        /^\s*javascript:/i.test(a.value)
      )
        found.push(`${el.tagName.toLowerCase()}[${a.name}=${a.value.slice(0, 20)}]`);
      if (a.name === 'style' && DANGEROUS_STYLE.test(a.value))
        found.push(`${el.tagName.toLowerCase()}[style=${a.value.slice(0, 40)}]`);
    }
  }
  return found;
}

function poisoned(p: string): PersistedState {
  const s = JSON.parse(JSON.stringify(seedState())) as PersistedState;
  const gen = generatePlan({
    startDate: TODAY,
    raceDate: '2026-09-27',
    raceDistM: 10000,
    pb: { distM: 10000, sec: 2700 },
    weeklyKm: 40,
    runDays: 5,
    quality: 2,
    intensity: 'std',
    trainedRecently: true
  });
  const plan = adaptGeneratedPlan(gen);
  if (!plan) throw new Error('plan');
  /* ID-jevi ostaju ispravni (njih brani `migrateState`/uvoz — v. state.test); otrovan je SVAKI tekst koji ekran prikazuje. */
  const meta = plan.meta as Record<string, unknown>;
  meta['raceName'] = p;
  meta['dayWarnings'] = [p];
  for (const w of plan.weeks) {
    (w as unknown as Record<string, unknown>)['focus'] = p;
    for (const d of w.days) {
      const day = d as unknown as Record<string, unknown>;
      day['desc'] = p;
      const session = day['session'] as Record<string, unknown> | undefined;
      if (session) session['kind'] = p;
    }
  }
  for (const row of plan.pred ?? []) (row as unknown as Record<string, unknown>)['l'] = `N1 · ${p}`;
  s.genPlan = plan;
  const first = plan.weeks[0]?.days.find((d) => !(d as { rest?: boolean }).rest);
  const id = first?.id ?? 'g1d1';
  s.log = {
    [id]: {
      status: 'done',
      km: 8,
      sec: 2000,
      note: p,
      src: p,
      stravaName: p,
      stravaDesc: p,
      hr: 150,
      rpe: 6
    }
  };
  s.knee = [
    { id: 'k1', src: id, date: TODAY, act: p, pain: 5, note: p, part: p },
    { id: 'k2', date: TODAY, act: 'Trčanje', pain: 2, note: p }
  ] as PersistedState['knee'];
  s.kg = [{ date: TODAY, kg: 80, src: id }] as PersistedState['kg'];
  s.strava = { athlete: p, lastSync: 1, access: 'a', refresh: 'b', expiresAt: 9e12, scope: p };
  s.icu = { athleteId: p, token: 't', lastSync: 1, lastPush: 1, scope: p };
  const wellness: PersistedState['wellness'] = {};
  for (let i = 1; i <= 8; i++) {
    const d = `2026-06-${String(14 + i).padStart(2, '0')}`;
    wellness[d] = {
      datum: d,
      hrv: 60,
      pulsUMiru: 50,
      sanH: 7,
      sanOcena: 4,
      tezina: null,
      ctl: 40,
      atl: 42,
      svezina: -2
    };
  }
  s.wellness = wellness;
  (s.ui as Record<string, unknown>)['bodyView'] = p;
  s.zajed = { vidljiv: true, nadimak: p };
  return s;
}

class Mem implements StorageLike {
  d = new Map<string, string>();
  getItem(k: string): string | null {
    return this.d.get(k) ?? null;
  }
  setItem(k: string, v: string): void {
    this.d.set(k, v);
  }
  removeItem(k: string): void {
    this.d.delete(k);
  }
}

beforeEach(() => {
  useUIStore.setState({ today: TODAY, sheet: null, confirm: null, wizard: false, screens: [] });
  /* Pravi `App` sa lažnom mrežom (sve 404): neki ekrani zovu servise već pri iscrtavanju (obaveštenja, vreme), a ovde se gleda samo ono što se iscrta. */
  setApp(
    createApp({
      kv: createKeyValueStore(new Mem()),
      fetcher: () => Promise.resolve(new Response('{}', { status: 404 })),
      now: () => Date.UTC(2026, 5, 22, 10, 0, 0),
      today: () => TODAY,
      supabaseUrl: 'https://x.supabase.co',
      anonKey: 'anon',
      appVersion: '283',
      location: { hash: '', search: '', origin: 'https://sub-19.vercel.app', pathname: '/' },
      navigate: () => undefined,
      online: () => true
    })
  );
});
afterEach(() => {
  cleanup();
  setApp(null);
});

describe('nijedan ekran ne pretvara tekst iz stanja u kod', () => {
  for (const p of PAYLOADS)
    it(`otrov: ${JSON.stringify(p).slice(0, 34)}`, () => {
      const marker = p.includes('alert(1)') ? 'alert(1)' : 'googleusercontent';
      const state = poisoned(p);
      /* 1) REALAN PUT: sve što stiže iz skladišta, sa servera ili iz backup-a prolazi kroz `migrateState`. */
      const migrated = migrateState(state);
      expect(migrated).not.toBeNull();
      hydratePersisted(migrated as PersistedState);
      useAuthStore.setState({
        configured: true,
        hasSession: true,
        userId: 'u-ja',
        email: 'ja@primer.rs',
        name: p,
        picture: p
      });

      const plan = (migrated as PersistedState).genPlan;
      const dayId = plan?.weeks[0]?.days.find((d) => !(d as { rest?: boolean }).rest)?.id ?? 'g1d1';
      /* Četiri taba + SVAKI ekran iznad njih (v. `features/screens`) + listovi. Ekrani se uvoze direktno (ne preko lenjog registra) da iscrtavanje bude sinhrono. */
      const screens: Array<[string, () => ReactElement]> = [
        ['Danas', () => <TodayPage />],
        ['Plan', () => <PlanPage />],
        ['Napredak', () => <ProgressPage />],
        ['Ti', () => <TiPage />],
        ['trening', () => <DayScreen id={dayId} />],
        ['plan-pregled', () => <PlanOverview />],
        ['plan-prilagodi', () => <AdjustPlan />],
        ['aktivnosti', () => <ActivitiesScreen />],
        ['forma', () => <FormScreen />],
        ['analiza-trke', () => <RaceAnalysisScreen id={dayId} />],
        ['oporavak', () => <OporavakScreen />],
        ['bol', () => <BolScreen />],
        ['masa', () => <MasaScreen />],
        ['profil', () => <ProfileScreen />],
        ['cilj', () => <GoalScreen />],
        ['postavke-treninga', () => <TrainingSettingsScreen />],
        ['servisi', () => <ServicesScreen />],
        ['strava', () => <StravaScreen />],
        ['icu', () => <IcuScreen />],
        ['sat', () => <WatchScreen />],
        ['obavestenja', () => <NotificationsScreen />],
        ['izgled', () => <AppearanceScreen />],
        ['privatnost', () => <PrivacyScreen />],
        ['o-aplikaciji', () => <AboutScreen />],
        ['vlasnik', () => <OwnerScreen />]
      ];
      const reached: string[] = [];
      for (const [name, make] of screens) {
        const view = render(make());
        expect(injected(view.container), name).toEqual([]);
        expect(view.container.textContent, name).not.toMatch(/\[object Object\]|undefined/);
        if (view.container.innerHTML.includes(marker)) reached.push(name);
        view.unmount();
      }
      /* Otrov je zaista stigao do ekrana (inače zamka ne bi proveravala ništa): bar ovi ekrani prikazuju tekst iz stanja. */
      for (const name of ['Plan', 'trening', 'plan-pregled'])
        expect(reached, `${name}: otrov nije stigao do ekrana`).toContain(name);

      // listovi: izmena, pomeranje, bol (postojeći unos)
      for (const sheet of [
        { kind: 'alt', props: { id: dayId } },
        { kind: 'swap', props: { w: 1 } },
        { kind: 'knee', props: { id: 'k1' } }
      ]) {
        act(() => useUIStore.getState().openSheet(sheet));
        const view = render(<SheetHost />);
        expect(injected(view.container), sheet.kind).toEqual([]);
        expect(view.container.textContent, sheet.kind).not.toMatch(/\[object Object\]/);
        view.unmount();
        act(() => useUIStore.getState().closeSheet());
      }
    });
});

describe('osnova nije prazna (zamka bi inače tiho prolazila)', () => {
  it('ekrani zaista iscrtavaju otrovani tekst — kao TEKST, ne kao kod', () => {
    const p = PAYLOADS[0] as string;
    hydratePersisted(migrateState(poisoned(p)) as PersistedState);
    const view = render(<PlanPage />);
    // tekst iz stanja je na ekranu (escapovan kao tekst) — da ga nema, zamka ne bi proveravala ništa
    expect(view.container.textContent).toContain('onerror=alert(1)');
    expect(injected(view.container)).toEqual([]);
  });

  it('zamka PREPOZNAJE ubačeno: nedozvoljen element, rukovalac, javascript: adresa, CSS', () => {
    const host = document.createElement('div');
    host.innerHTML = `<img src=x onerror=alert(1)><a href="javascript:alert(1)">x</a><div style="position:fixed;inset:0;z-index:99999"></div>`;
    const found = injected(host).join(' ');
    expect(found).toContain('<img>');
    expect(found).toContain('img[onerror]');
    expect(found).toContain('a[href=javascript:alert(1)');
    expect(found).toContain('div[style=position:fixed');
  });
});

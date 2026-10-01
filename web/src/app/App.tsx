import { Suspense, useCallback, useEffect, useState } from 'react';
import { headerSubtitle } from '../domain/plan';
import { PAGES } from '../features/registry';
import { Ambient, AuthGate, Header, Page, Splash, Tabbar } from '../components/ui/Shell';
import { BannerHost } from '../components/ui/BannerHost';
import { ConfirmHost } from '../components/ui/ConfirmHost';
import { Sheet } from '../components/ui/Sheet';
import { downloadText } from '../lib/download';
import { localDate, msUntilMidnight } from '../lib/clock';
import { useResolvedPlan, useTrainingStore } from '../stores';
import { useAuthStore } from '../stores/authStore';
import { useSyncStore } from '../stores/syncStore';
import { useUIStore, type Banner } from '../stores/uiStore';
import { LS_RESCUE_KEY } from '../services/storage/keys';
import { getApp } from './appContext';
import { confirmAction } from './confirm';
import { rememberTab } from './tabs';
import { BANNER, useSystemBanners } from './useSystemBanners';
import { SheetHost } from '../features/sheets';
import { Wizard } from '../features/onboarding';

/* LJUSKA APLIKACIJE: zaglavlje, ekrani po tabovima, traka tabova, list, dijalog potvrde, trake i kapija za prijavu. */

function useToday(): string {
  const today = useUIStore((s) => s.today);
  const setToday = useUIStore((s) => s.setToday);
  useEffect(() => {
    const refresh = (): void => setToday(localDate());
    refresh();
    /* PONOĆ DOK APLIKACIJA STOJI OTVORENA: tajmer cilja prvu sekundu posle ponoći i prezakazuje se sam; povratak u aplikaciju
       (`visibilitychange`) je drugi okidač — tajmer ne preživljava zamrznutu pozadinu, a `visibilitychange` ume. Bez ovoga
       „Završi trening" posle ponoći upiše JUČERAŠNJI datum. */
    let t: ReturnType<typeof setTimeout>;
    const arm = (): void => {
      t = setTimeout(() => {
        refresh();
        arm();
      }, msUntilMidnight());
    };
    arm();
    const onVis = (): void => {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearTimeout(t);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [setToday]);
  return today;
}

export function App() {
  const ready = useAuthStore((s) => s.ready);
  const gate = useAuthStore((s) => s.gate);
  const tab = useUIStore((s) => s.tab);
  const sheet = useUIStore((s) => s.sheet);
  const closeSheet = useUIStore((s) => s.closeSheet);
  const openSheet = useUIStore((s) => s.openSheet);
  const today = useToday();
  const plan = useResolvedPlan();
  const raceDate = useTrainingStore(
    (s) => (s.genPlan?.meta as { raceDate?: string } | undefined)?.raceDate ?? null
  );
  const wizard = useUIStore((s) => s.wizard);
  const hasPlan = useTrainingStore((s) => !!s.genPlan);
  const [splash, setSplash] = useState(true);
  const doneSplash = useCallback(() => setSplash(false), []);
  useSystemBanners();

  useEffect(() => {
    rememberTab(tab, window.sessionStorage);
    window.scrollTo(0, 0);
  }, [tab]);

  /* Odlazak u pozadinu: zakazan upis mora u skladište PRE nego što aplikacija ode (odatle se možda više ne vraća). */
  useEffect(() => {
    const onVis = (): void => {
      const app = getApp();
      if (document.visibilityState === 'hidden') app.onHidden();
      else void app.onVisible();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  const onBannerAction = useCallback(
    (b: Banner, action: string): void => {
      const app = getApp();
      if (b.id === BANNER.conflict) {
        void (async () => {
          if (action === 'pull') {
            const r = await app.sync.resolveConflict('pull');
            if (!r.ok)
              window.alert(
                'Povlačenje sa servera nije uspelo — ništa nije promenjeno.\n\nProveri vezu pa probaj ponovo. Dok ne uspe, izmene sa ovog uređaja se ne šalju, pa se ništa ne može izgubiti.'
              );
            return;
          }
          let r = await app.sync.resolveConflict('push');
          if (!r.ok && r.reason === 'confirm-empty-needed') {
            const ok = await confirmAction(
              'Na ovom uređaju još nema nijednog unosa, a na serveru ih ima.\n\n„Zadrži sa telefona" će OBRISATI sve sa servera — uključujući kilažu i povrede, koje se ne mogu vratiti ni sa Strave ni sa intervals.icu.\n\nSigurno?'
            );
            if (!ok) return;
            r = await app.sync.resolveConflict('push', { confirmedEmpty: true });
          }
        })();
      } else if (b.id === BANNER.loadFailure) {
        if (action === 'download') {
          let raw = '';
          try {
            raw = app.kv.get(LS_RESCUE_KEY) ?? '';
          } catch {
            raw = '';
          }
          downloadText(`sub20-osteceno-${today}.json`, raw);
        } else {
          /* Čovek je svesno izabrao da server pobedi. */
          app.sync.acknowledgeLoadFailure();
          useSyncStore.getState().set({ loadFailure: null });
          void app.sync.pull();
        }
      } else if (b.id === BANNER.writeFailed) {
        useSyncStore.getState().set({ writeFailed: null });
      }
    },
    [today]
  );

  if (!ready) return <Splash onDone={doneSplash} />;

  /* Bez plana čarobnjak je jedini ekran (nema iza čega da se zatvori); sa planom se otvara iz Podešavanja. */
  const showWizard = gate === null && (wizard || !hasPlan);
  const subtitle = headerSubtitle(plan, raceDate, today);
  const settingsOpen = sheet?.kind === 'settings';

  return (
    <>
      {splash ? <Splash onDone={doneSplash} /> : null}
      <Ambient tab={tab} settingsOpen={settingsOpen} />
      {showWizard ? <Wizard today={today} /> : null}
      <div style={showWizard ? { display: 'none' } : undefined}>
        <Header subtitle={subtitle} onSettings={() => openSheet({ kind: 'settings' })} />
        <main>
          {(Object.keys(PAGES) as Array<keyof typeof PAGES>).map((t) => {
            const Screen = PAGES[t];
            return (
              <Page key={t} id={t} active={t === tab}>
                <Suspense fallback={null}>
                  <Screen />
                </Suspense>
              </Page>
            );
          })}
        </main>
        <Tabbar />
        <Sheet open={!!sheet} onClose={closeSheet}>
          <SheetHost />
        </Sheet>
      </div>
      <ConfirmHost />
      <BannerHost onAction={onBannerAction} />
      {gate !== null ? <AuthGate message={gate} onLogin={() => getApp().login()} /> : null}
    </>
  );
}

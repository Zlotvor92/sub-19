import { Suspense, useCallback, useEffect, useRef } from 'react';
import { headerSubtitle } from '../domain/plan';
import { PAGES } from '../features/registry';
import { Ambient, AuthGate, Header, Page, Tabbar } from '../components/ui/Shell';
import { BannerHost } from '../components/ui/BannerHost';
import { ConfirmHost } from '../components/ui/ConfirmHost';
import { Sheet } from '../components/ui/Sheet';
import { downloadText } from '../lib/download';
import { requestPersist, useActiveGenPlan, useResolvedPlan, useTrainingStore } from '../stores';
import { useAuthStore } from '../stores/authStore';
import { useUpdateStore } from '../pwa/updateStore';
import { useSyncStore } from '../stores/syncStore';
import { useUIStore, type Banner } from '../stores/uiStore';
import { LS_RESCUE_KEY } from '../services/storage/keys';
import { getApp } from './appContext';
import { confirmAction } from './confirm';
import { dayFromSearch, rememberTab } from './tabs';
import { useSwipeNav } from './useSwipeNav';
import { useToday } from './useToday';
import { BANNER, useSystemBanners } from './useSystemBanners';
import { SheetHost } from '../features/sheets';
import { Wizard } from '../features/onboarding';

/* LJUSKA APLIKACIJE: zaglavlje, ekrani po tabovima, traka tabova, list, dijalog potvrde, trake i kapija za prijavu. */

export function App() {
  const ready = useAuthStore((s) => s.ready);
  const gate = useAuthStore((s) => s.gate);
  const tab = useUIStore((s) => s.tab);
  const entering = useUIStore((s) => s.entering);
  const peek = useUIStore((s) => s.peek);
  const sheet = useUIStore((s) => s.sheet);
  const closeSheet = useUIStore((s) => s.closeSheet);
  const openSheet = useUIStore((s) => s.openSheet);
  const today = useToday();
  const plan = useResolvedPlan();
  const active = useActiveGenPlan();
  const raceDate = (active?.meta as { raceDate?: string } | undefined)?.raceDate ?? null;
  const wizard = useUIStore((s) => s.wizard);
  const hasPlan = !!active;
  /* List nosi polja u koja se kuca (beleška); zatvaranje ih uklanja pre `blur`-a, pa se zakazan upis završava ovde. */
  const onSheetClose = useCallback(() => {
    requestPersist('now');
    closeSheet();
  }, [closeSheet]);
  useSystemBanners();

  /* ULAZ IZ OBAVEŠTENJA (`./?dan=<id>`): adresa se čisti ODMAH (inače svako osvežavanje ponovo otvara list), plan se pogleda tek kad postoji (dan
     je u međuvremenu mogao nestati — tada se ostaje na početnom ekranu), a rezultat analize se pokupi PRE nego što čovek pročita „u toku". */
  const deepLinkDone = useRef(false);
  useEffect(() => {
    if (!ready || deepLinkDone.current || !plan) return;
    deepLinkDone.current = true;
    const id = dayFromSearch(window.location.search);
    if (!id) return;
    try {
      window.history.replaceState(null, '', window.location.pathname);
    } catch {
      /* privatni režim */
    }
    const day = plan.byId.get(id);
    if (!day) return;
    useUIStore.getState().setTab(day.date === today ? 'danas' : 'plan');
    openSheet({ kind: 'day', props: { id } });
    if (useTrainingStore.getState().log[id]?.['aiPosao']) void getApp().ai.check(id);
  }, [ready, plan, today, openSheet]);

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
      } else if (b.id === BANNER.update) {
        useUpdateStore.getState().apply();
      } else if (b.id === BANNER.writeFailed) {
        useSyncStore.getState().set({ writeFailed: null });
      }
    },
    [today]
  );

  useSwipeNav(ready && gate === null && !wizard && hasPlan && !sheet);

  if (!ready) return null;

  /* Bez plana čarobnjak je jedini ekran (nema iza čega da se zatvori); sa planom se otvara iz Podešavanja. */
  const showWizard = gate === null && (wizard || !hasPlan);
  const subtitle = headerSubtitle(plan, raceDate, today);
  const settingsOpen = sheet?.kind === 'settings';

  return (
    <>
      <Ambient tab={tab} settingsOpen={settingsOpen} />
      {showWizard ? <Wizard today={today} /> : null}
      <div style={showWizard ? { display: 'none' } : undefined}>
        <Header subtitle={subtitle} onSettings={() => openSheet({ kind: 'settings' })} />
        <main>
          {(Object.keys(PAGES) as Array<keyof typeof PAGES>).map((t) => {
            const Screen = PAGES[t];
            return (
              <Page key={t} id={t} active={t === tab} entering={t === entering} peek={t === peek}>
                <Suspense fallback={null}>
                  <Screen />
                </Suspense>
              </Page>
            );
          })}
        </main>
        <Tabbar />
        <Sheet open={!!sheet} onClose={onSheetClose}>
          <SheetHost />
        </Sheet>
      </div>
      <ConfirmHost />
      <BannerHost onAction={onBannerAction} />
      {gate !== null ? <AuthGate message={gate} onLogin={() => getApp().login()} /> : null}
    </>
  );
}

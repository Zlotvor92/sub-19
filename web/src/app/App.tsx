import { Suspense, useCallback, useEffect, useRef } from 'react';
import { PAGES } from '../features/registry';
import { ScreenHost } from '../features/screens';
import { AuthGate, Page, Tabbar } from '../components/ui/Shell';
import { BannerHost } from '../components/ui/BannerHost';
import { ConfirmHost } from '../components/ui/ConfirmHost';
import { Sheet } from '../components/ui/Sheet';
import { downloadText } from '../lib/download';
import { requestPersist, useActiveGenPlan, useResolvedPlan, useTrainingStore } from '../stores';
import { useAuthStore } from '../stores/authStore';
import { useUpdateStore } from '../pwa/updateStore';
import { useSyncStore } from '../stores/syncStore';
import { TABS, useUIStore, type Banner } from '../stores/uiStore';
import { LS_RESCUE_KEY } from '../services/storage/keys';
import { getApp } from './appContext';
import { confirmAction } from './confirm';
import { dayFromSearch, rememberTab } from './tabs';
import { startNavHistory } from './navHistory';
import { useSwipeNav } from './useSwipeNav';
import { useToday } from './useToday';
import { BANNER, useSystemBanners } from './useSystemBanners';
import { SheetHost } from '../features/sheets';
import { Wizard } from '../features/onboarding';

/* LJUSKA APLIKACIJE: ekrani po tabovima (sa ekranima iznad njih), traka tabova, list, dijalog potvrde, trake i kapija za prijavu. Nema trajnog zaglavlja:
   svaki ekran nosi svoj naslov. */

/** Postoji li aktivan plan (generisan ili ugrađeni lični) — bez njega je čarobnjak jedini ekran. */
function useActiveGenPlanPresent(): boolean {
  return !!useActiveGenPlan();
}

export function App() {
  const ready = useAuthStore((s) => s.ready);
  const gate = useAuthStore((s) => s.gate);
  const tab = useUIStore((s) => s.tab);
  const peek = useUIStore((s) => s.peek);
  const sheet = useUIStore((s) => s.sheet);
  const screens = useUIStore((s) => s.screens);
  const closeSheet = useUIStore((s) => s.closeSheet);
  const openScreen = useUIStore((s) => s.openScreen);
  const today = useToday();
  const plan = useResolvedPlan();
  const wizard = useUIStore((s) => s.wizard);
  const hasPlan = useActiveGenPlanPresent();
  /* List nosi polja u koja se kuca (beleška); zatvaranje ih uklanja pre `blur`-a, pa se zakazan upis završava ovde. */
  const onSheetClose = useCallback(() => {
    requestPersist('now');
    closeSheet();
  }, [closeSheet]);
  useSystemBanners();

  /* Odjava ili brisanje naloga: otvoreni ekrani pripadaju prethodnom nalogu, pa se posle ponovne prijave kreće od početnog ekrana. */
  const prevGate = useRef(gate);
  useEffect(() => {
    if (prevGate.current === null && gate !== null) useUIStore.getState().setTab('danas');
    prevGate.current = gate;
  }, [gate]);

  /* Taster „Nazad“ zatvara ekran/list, ne aplikaciju (v. `navHistory`). */
  useEffect(() => {
    const nav = startNavHistory(window);
    return () => nav.stop();
  }, []);

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
    openScreen({ kind: 'trening', props: { id } });
    if (useTrainingStore.getState().log[id]?.['aiPosao']) void getApp().ai.check(id);
  }, [ready, plan, today, openScreen]);

  /* Pozicija skrolovanja: ekran se otvara od vrha, a pri povratku se vraća tamo gde je bio; promena taba uvek počinje od vrha. */
  const scrolls = useRef<number[]>([]);
  const openers = useRef<Array<HTMLElement | null>>([]);
  const layers = useRef(0);
  useEffect(() => {
    const n = screens.length;
    if (n > layers.current) {
      scrolls.current.push(window.scrollY);
      openers.current.push(
        document.activeElement instanceof HTMLElement ? document.activeElement : null
      );
      window.scrollTo(0, 0);
    } else if (n < layers.current) {
      const y = scrolls.current[n] ?? 0;
      scrolls.current.length = n;
      window.scrollTo(0, y);
      /* Fokus se vraća na red koji je ekran otvorio (ako još postoji i vidljiv je); inače ostaje gde jeste. */
      const opener = openers.current[n] ?? null;
      openers.current.length = n;
      if (opener?.isConnected && opener.offsetParent !== null)
        opener.focus({ preventScroll: true });
    }
    layers.current = n;
  }, [screens.length]);
  useEffect(() => {
    rememberTab(tab, window.sessionStorage);
    scrolls.current = [];
    openers.current = [];
    layers.current = 0;
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

  useSwipeNav(ready && gate === null && !wizard && hasPlan && !sheet && screens.length === 0);

  if (!ready) return null;

  /* Bez plana čarobnjak je jedini ekran (nema iza čega da se zatvori); sa planom se otvara iz Podešavanja. */
  const showWizard = gate === null && (wizard || !hasPlan);

  return (
    <>
      {showWizard ? <Wizard today={today} /> : null}
      <div className="app-shell" style={showWizard ? { display: 'none' } : undefined}>
        <main>
          {TABS.map((t) => {
            const Screen = PAGES[t];
            const covered = t === tab && screens.length > 0;
            return (
              <Page key={t} id={t} active={t === tab} peek={t === peek}>
                <div hidden={covered}>
                  <Suspense fallback={null}>
                    <Screen />
                  </Suspense>
                </div>
                {t === tab ? <ScreenHost /> : null}
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

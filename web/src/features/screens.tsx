import { Suspense, lazy, type ReactNode } from 'react';
import { useUIStore } from '../stores/uiStore';

/* REGISTAR EKRANA: `kind` → sadržaj ekrana koji se otvara iznad taba (`openScreen`). Svojstva (`props`) dolaze iz `openScreen` i proveravaju se OVDE, na
   granici — ekran dobija samo ono što je tipizirano. Nepoznat `kind` ne otvara ništa (stari link ne sme da obori aplikaciju). */
const Day = lazy(() => import('./day/DayScreen').then((m) => ({ default: m.DayScreen })));
const PlanOverview = lazy(() =>
  import('./plan/PlanOverview').then((m) => ({ default: m.PlanOverview }))
);
const AdjustPlan = lazy(() => import('./plan/AdjustPlan').then((m) => ({ default: m.AdjustPlan })));
const Activities = lazy(() =>
  import('./progress/ActivitiesScreen').then((m) => ({ default: m.ActivitiesScreen }))
);
const Form = lazy(() => import('./race/FormScreen').then((m) => ({ default: m.FormScreen })));
const RaceAnalysis = lazy(() =>
  import('./race/RaceAnalysis').then((m) => ({ default: m.RaceAnalysisScreen }))
);
const Oporavak = lazy(() =>
  import('./recovery/OporavakScreen').then((m) => ({ default: m.OporavakScreen }))
);
const Bol = lazy(() => import('./recovery/BolScreen').then((m) => ({ default: m.BolScreen })));
const Masa = lazy(() => import('./recovery/MasaScreen').then((m) => ({ default: m.MasaScreen })));
const Profile = lazy(() => import('./ti/screens').then((m) => ({ default: m.ProfileScreen })));
const Goal = lazy(() => import('./ti/screens').then((m) => ({ default: m.GoalScreen })));
const TrainingSettings = lazy(() =>
  import('./ti/screens').then((m) => ({ default: m.TrainingSettingsScreen }))
);
const Services = lazy(() => import('./ti/screens').then((m) => ({ default: m.ServicesScreen })));
const Strava = lazy(() => import('./ti/screens').then((m) => ({ default: m.StravaScreen })));
const Icu = lazy(() => import('./ti/screens').then((m) => ({ default: m.IcuScreen })));
const Watch = lazy(() => import('./ti/screens').then((m) => ({ default: m.WatchScreen })));
const Notifications = lazy(() =>
  import('./ti/screens').then((m) => ({ default: m.NotificationsScreen }))
);
const Appearance = lazy(() =>
  import('./ti/screens').then((m) => ({ default: m.AppearanceScreen }))
);
const Privacy = lazy(() => import('./ti/screens').then((m) => ({ default: m.PrivacyScreen })));
const About = lazy(() => import('./ti/screens').then((m) => ({ default: m.AboutScreen })));
const Owner = lazy(() => import('./ti/screens').then((m) => ({ default: m.OwnerScreen })));

const SCREENS: Record<string, (props: Record<string, unknown>) => ReactNode> = {
  trening: (p) => (typeof p['id'] === 'string' ? <Day id={p['id']} /> : null),
  'plan-pregled': () => <PlanOverview />,
  'plan-prilagodi': () => <AdjustPlan />,
  aktivnosti: () => <Activities />,
  forma: () => <Form />,
  'analiza-trke': (p) => <RaceAnalysis {...(typeof p['id'] === 'string' ? { id: p['id'] } : {})} />,
  oporavak: () => <Oporavak />,
  bol: () => <Bol />,
  masa: () => <Masa />,
  profil: () => <Profile />,
  cilj: () => <Goal />,
  'postavke-treninga': () => <TrainingSettings />,
  servisi: () => <Services />,
  strava: () => <Strava />,
  icu: () => <Icu />,
  sat: () => <Watch />,
  obavestenja: () => <Notifications />,
  izgled: () => <Appearance />,
  privatnost: () => <Privacy />,
  'o-aplikaciji': () => <About />,
  vlasnik: () => <Owner />
};

/** Ekran koji je trenutno na vrhu steka; `null` kad je tab na svom korenu. */
export function ScreenHost() {
  const screens = useUIStore((s) => s.screens);
  const top = screens[screens.length - 1];
  if (!top) return null;
  const render = Object.prototype.hasOwnProperty.call(SCREENS, top.kind)
    ? SCREENS[top.kind]
    : undefined;
  if (!render) return null;
  /* Ključ se menja kad se otvori drugi dan/trka istog tipa ekrana, da stanje starog ne preživi u novom. */
  const id = top.props?.['id'];
  return (
    <Suspense fallback={null}>
      <div key={`${screens.length}-${top.kind}-${typeof id === 'string' ? id : ''}`}>
        {render(top.props ?? {})}
      </div>
    </Suspense>
  );
}

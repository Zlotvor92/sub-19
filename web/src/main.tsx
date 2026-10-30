import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { setApp } from './app/appContext';
import { createApp } from './app/createApp';
import { initialRoute } from './app/tabs';
import { captureConsent } from './app/oauthConsent';
import { localDate } from './lib/clock';
import { applyTheme, readTheme } from './lib/theme';
import { browserGeo } from './lib/geo';
import { browserPwa } from './pwa/browser';
import { startServiceWorker } from './pwa/register';
import { captureInstallPrompt } from './pwa/install';
import { useUIStore } from './stores/uiStore';
import './styles/tokens.css';
import './styles/base.css';
import './styles/ui.css';
import './styles/shell.css';
import './styles/screens.css';
import './styles/charts.css';
import './styles/wizard.css';

/* Pre svega ostalog: `beforeinstallprompt` stiže jednom i ne čeka React. */
captureInstallPrompt(window);

const root = document.getElementById('root');
if (!root) throw new Error('Nedostaje #root u index.html');

/* Dolazak sa Claude konektora (`/?authorization_id=…`): zahtev se pamti za ovu karticu, a upit se briše iz adrese —
   ostatak aplikacije (prijava, tabovi) radi kao i uvek, a ekran odobrenja se otvara iz `App`. */
try {
  if (captureConsent(window.location, window.sessionStorage, Date.now()))
    window.history.replaceState(null, '', '/');
} catch {
  /* privatni režim bez skladišta */
}

const app = createApp({
  today: localDate,
  location: window.location,
  replaceUrl: (path) => window.history.replaceState(null, '', path),
  navigate: (url) => {
    window.location.href = url;
  },
  online: () => navigator.onLine,
  notify: (message) => window.alert(message),
  geo: browserGeo(),
  pwa: browserPwa(),
  platform: () => {
    try {
      if (document.referrer.startsWith('android-app://')) return 'android';
      return window.matchMedia('(display-mode: standalone)').matches ? 'instalirana' : 'pregledac';
    } catch {
      return null;
    }
  }
});
setApp(app);
/* Tema je već postavljena skriptom `tema.js` (pre prvog iscrtavanja); ovde se samo usklađuje boja trake pregledača. */
try {
  applyTheme(readTheme(window.localStorage));
} catch {
  /* privatni režim: ostaje sistemska tema */
}
/* Ulaz sa adrese ili iz zapamćenog ekrana; stari nazivi `opor` i `pred` otvaraju svoj ekran u Napredku. */
const route = initialRoute(window.location.search, window.sessionStorage);
useUIStore.getState().setTab(route.tab, { glided: true });
if (route.screen) useUIStore.getState().openScreen(route.screen);
void app.start();
startServiceWorker({ onAiPush: () => void app.ai.collectAll() });

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>
);

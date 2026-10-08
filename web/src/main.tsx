import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { setApp } from './app/appContext';
import { createApp } from './app/createApp';
import { initialRoute } from './app/tabs';
import { localDate } from './lib/clock';
import { applyTheme, readTheme } from './lib/theme';
import { browserGeo } from './lib/geo';
import { browserPwa } from './pwa/browser';
import { startServiceWorker } from './pwa/register';
import { useUIStore } from './stores/uiStore';
import './styles/tokens.css';
import './styles/base.css';
import './styles/ui.css';
import './styles/shell.css';
import './styles/screens.css';
import './styles/charts.css';
import './styles/wizard.css';

const root = document.getElementById('root');
if (!root) throw new Error('Nedostaje #root u index.html');

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
  pwa: browserPwa()
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

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { setApp } from './app/appContext';
import { createApp } from './app/createApp';
import { initialTab } from './app/tabs';
import { localDate } from './lib/clock';
import { useUIStore } from './stores/uiStore';
import './styles/legacy.css';

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
  notify: (message) => window.alert(message)
});
setApp(app);
useUIStore.getState().setTab(initialTab(window.location.search, window.sessionStorage));
void app.start();

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>
);

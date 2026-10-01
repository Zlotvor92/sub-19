import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/* Produkcijski izlaz mora da prođe CSP iz ../vercel.json: `script-src 'self'`
   (nema inline skripti), `connect-src` samo 'self', *.supabase.co, strava.com,
   open-meteo.com. Zato: ništa se ne umeće inline, i nijedan spoljni izvor se
   ne dodaje bez izmene CSP-a (to je bezbednosna odluka, ne build podešavanje). */
export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  build: {
    target: 'es2022',
    sourcemap: true,
    /* Nema inline-ovanja skripti/modulepreload polyfill-a u HTML: CSP ih ne dozvoljava. */
    modulePreload: { polyfill: false },
    assetsInlineLimit: 0
  },
  server: { port: 5173, strictPort: true }
});

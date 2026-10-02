import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import { renderServiceWorker } from './scripts/sw-build.mjs';

/* Produkcijski izlaz mora da prođe CSP iz ../vercel.json: `script-src 'self'`
   (nema inline skripti), `connect-src` samo 'self', *.supabase.co, strava.com,
   open-meteo.com. Zato: ništa se ne umeće inline, i nijedan spoljni izvor se
   ne dodaje bez izmene CSP-a (to je bezbednosna odluka, ne build podešavanje). */
/* `sw.js` se pravi POSLE izgradnje, iz izvora `sw/sw.js`, sa spiskom stvarno izgrađenih fajlova. */
function serviceWorker(version: string): Plugin {
  let outDir = 'dist';
  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((n) => {
      const p = join(dir, n);
      return statSync(p).isDirectory() ? walk(p) : [p];
    });
  return {
    name: 'sub19-service-worker',
    apply: 'build',
    configResolved(c) {
      outDir = c.build.outDir;
    },
    closeBundle() {
      const files = walk(outDir).map((f) => relative(outDir, f).split('\\').join('/'));
      const source = readFileSync(fileURLToPath(new URL('./sw/sw.js', import.meta.url)), 'utf8');
      writeFileSync(join(outDir, 'sw.js'), renderServiceWorker(source, { version, files }));
    }
  };
}

const APP_VERSION = process.env['VITE_APP_VERSION'] || '283';

export default defineConfig({
  plugins: [react(), serviceWorker(APP_VERSION)],
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

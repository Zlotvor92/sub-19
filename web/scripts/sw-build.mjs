/* IZGRADNJA service workera: izvor (`sw/sw.js`) + tri vrednosti. Čista funkcija, da je test može pozvati bez Vite-a. */
import { createHash } from 'node:crypto';

/** Fajlovi koji se UVEK keširaju (statički, iz `public/`); hešovani fajlovi iz izgradnje se dodaju. */
export const STATIC_ASSETS = [
  './',
  './index.html',
  './sw-reg.js',
  './uvod.js',
  './tema.js',
  './manifest.json',
  './icon-32.png',
  './icon-192.png',
  './icon-512.png',
  './icon-128.png',
  './icon-maskable-512.png',
  './badge-96.png',
  './icon-monochrome-512.png',
  './apple-touch-icon.png',
  './privacy.html',
  './uputstvo.html'
];

/**
 * @param {string} source sadržaj `sw/sw.js`
 * @param {{ version: string, files: string[] }} build `files`: putanje iz izgradnje relativne na koren (`assets/index-AbC.js`)
 */
export function renderServiceWorker(source, build) {
  const hashed = build.files
    .filter((f) => /^assets\//.test(f) && !/\.map$/.test(f))
    .map((f) => `./${f}`)
    .sort();
  const assets = [...STATIC_ASSETS, ...hashed];
  /* Ime keša nosi verziju I heš spiska: promena bilo kog fajla menja ime pa `activate` briše stari keš. */
  const digest = createHash('sha256').update(assets.join('\n')).digest('hex').slice(0, 8);
  const cache = `sub19-cache-v${build.version}-${digest}`;
  return source
    .replace("'__CACHE__'", JSON.stringify(cache).replace(/"/g, "'"))
    .replace("'__APP_VERSION__'", `'${build.version}'`)
    .replace('__ASSETS__', JSON.stringify(assets, null, 1).replace(/"/g, "'"));
}

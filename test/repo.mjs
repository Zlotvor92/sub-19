/* Pomoćnik za testove: koren repozitorijuma i čitanje fajlova iz njega.

   Testovi u ovom folderu proveravaju BACKEND i konfiguraciju repozitorijuma (api/*.js, supabase/*.sql, vercel.json, javna statika). Frontend je u web/ i ima svoje
   testove (web/package.json → `npm test`). Stari frontend (`app.js` i njegov `harness.mjs`) je obrisan u Phase 12; poslednji commit na kome postoji je
   b7afc41 (`git show b7afc41:app.js`).

   NEMA package.json U ROOTU namerno — Vercel bi ga protumačio kao Node projekat. Zato .mjs ekstenzije (uvek ESM) i package.json samo unutar test/. */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const ROOT = join(HERE, '..');

/* Javna statika koja je pre Phase 12 stajala u korenu sada živi u web/public/ (izlaz izgradnje). */
const PREMESTENO =
  /^(manifest\.json|privacy\.html|uputstvo\.html|sub20\.apk|[\w.-]+\.(png|webp)|\.well-known\/.*)$/;

/** Putanja do fajla iz repozitorijuma (premeštena statika se traži u web/public/). */
export function repoPath(name) {
  return join(ROOT, PREMESTENO.test(name) ? 'web/public/' + name : name);
}

export function readRepoFile(name) {
  return readFileSync(repoPath(name), 'utf8');
}

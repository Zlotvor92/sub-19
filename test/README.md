# Testovi backenda i repozitorijuma

```bash
node --test "test/**/*.test.mjs"     # iz korena repozitorijuma
npm test --prefix test               # isto, kraće
```

Traži Node 22. **Nema zavisnosti** — sve je iz standardne biblioteke (`node:test`, `node:assert`).

Ovaj folder proverava **backend i konfiguraciju repozitorijuma**: `api/*.js`, `supabase/*.sql`, `vercel.json`, javnu statiku (`web/public/`) i obećanja iz politike
privatnosti naspram koda. **Frontend ima svoje testove u `web/`** (`cd web && npm run check`).

Stari frontend (`app.js`, `index.html`, `sw.js`, `sw-reg.js`) i testovi koji su ga učitavali (`harness.mjs`, `node:vm`) obrisani su u Phase 12. Poslednji commit na kome
postoje je **`b7afc41`** (`git show b7afc41:app.js`); ponašanje starog klijenta koje je novi morao da zadrži čuvaju zamrznuti snimci u
`web/src/test/legacy-recordings/` (v. `web/src/test/legacyOracle.ts`).

## Zašto nema `package.json` u korenu

Vercel bi ga protumačio kao Node projekat i promenio način izgradnje (build se zadaje u `vercel.json`: `npm ci --prefix web`). Zato su testovi u sopstvenom folderu, sa
`.mjs` ekstenzijama (uvek ESM) i `package.json`-om koji Vercel ne gleda. `repo.mjs` daje `ROOT` i `readRepoFile()` (javna statika se traži u `web/public/`).

## Šta je pokriveno

| Fajl | Šta drži zatvorenim |
|---|---|
| `api.test.mjs` | serverske funkcije sa lažnim `fetch` — batching, paralelizam, paginacija, autorizacija, brisanje naloga, AI posao odvojen od čekanja |
| `requireuser-kopije.test.mjs` | sedam namernih kopija `requireUser` provučeno kroz iste scenarije — duplikat sme da postoji, ali ne sme da se razidje |
| `bezbednost.test.mjs` | SSRF, ubacivanje zaglavlja u mejl, vlasnik po potvrđenoj adresi, limiti pre poziva modela |
| `doslednost.test.mjs` | `vercel.json` (CSP, `maxDuration`), manifest, javne stranice bez inline skripti, uputstvo, Android veza |
| `android-paket.test.mjs` | `sub20.apk` naspram repozitorijuma — adresa, ime, paket, otisci ključa |
| `mreza-rok.test.mjs` | nijedna serverska funkcija ne izlazi ka mreži bez roka |
| `icu-treninzi.test.mjs`, `zone-pulsa.test.mjs`, `temperatura-trcanja.test.mjs` | `api/icu.js`, `api/icu-oauth.js` i `api/analyze.js`: opseg, limiti, oblik odgovora, šta model sme da dobije |
| `istorija.test.mjs`, `zajednica.test.mjs`, `revizija6.test.mjs` | SQL (RLS, okidači, brisanje naloga) i politika privatnosti naspram stvarnog ponašanja |
| `push.test.mjs` | Web Push sa servera: kripto, preplate, najave, kvote |
| `ai-posao-okidaci.test.mjs` | okidači AI posla u bazi |

Generator plana ima golden master u `web/src/test/fixtures/otisak-generatora.json` (2 304 scenarija) — v. `web/src/domain/training/generator/generator.fingerprint.node.test.ts`.

## Načelo za nove testove

Tvrdi **invarijantu**, ne izmerenu vrednost. `assert(deload < prethodna)` preživljava rekalibraciju; `assert(N8 === 21.7)` puca na svaku izmenu i uči čoveka da
briše testove.

Testiraj **ponašanje**, ne oblik izvornog koda. `assert.match(src, /regex/)` prolazi i kad kod izgleda ispravno a radi pogrešno — tako je jedna provera dnevnog limita
mesecima tvrdila da je limit na mestu dok se zaobilazio jednim poljem u JSON-u. Ako zamka ne može da padne, ne čuva ništa: kad je napišeš, pokvari kod namerno i
proveri da zaista pukne.

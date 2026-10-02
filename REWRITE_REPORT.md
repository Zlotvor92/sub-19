# REWRITE REPORT — SUB-20 frontend

**Zaključak:** novi frontend (`web/`) je funkcionalno ekvivalentan starom `app.js` (APP_VERSION 282) u meri u kojoj to može da se dokaže testovima. **Isporučen na produkciju 2026-10-02** (PR #26, `sub-19.vercel.app`); stari frontend **nije** uklonjen (Phase 12 čeka ručnu proveru prijave i servisa na telefonu). Cilj „početni JS < 150 KB gzip" **nije ispunjen** (≈ 216 KB; stari je 327 KB).

Branch: `claude/sub20-frontend-rewrite-q6dlvr`. Detalji po fazama i brojke: `docs/REWRITE_STATUS.md`. Namerne razlike u ponašanju: `docs/ENGINE_CHANGES.md`. Prelaz na produkciju: `docs/CUTOVER.md`.

## 1. Architecture

Slojevi, zavisnost ide samo nadole (lint to sprovodi; `domain/isolation.test.ts` proverava):

```
domain/      čist TypeScript: bez DOM-a, fetch-a, store-a, Date.now()
services/    Result umesto izuzetaka; Zod na svakoj granici (mreža, localStorage, uvoz backupa); rokovi na svakom pozivu
stores/      Zustand; jedan persist po akciji; akcije su jedino mesto gde se menja stanje
app/         koren kompozicije (createApp), integracije, prevlačenje, današnji dan
features/    ekrani (Danas, Plan, Oporavak, Trka, Zajednica, Podešavanja, čarobnjak)
components/  Shell, Sheet, Ring, Confirm/Banner host (koriste postojeći legacy.css)
pwa/         registracija SW-a, ažuriranje, offline, uvodni ekran
```

- Domen: `training/{generator,adaptation,test3k}`, `plan`, `day`, `recovery`, `race`, `activities`, `zones`, `weather`, `ai`, `community`, `push`, `watch`, `icu`, `state`, `sync`, `personal`, `shell`, `onboarding`, `date`, `format`.
- Stanje v11 zadržava srpska imena polja; na server ide samo `toServerPayload()` (bez tokena i koordinata) — jedini put ka serveru.
- **Aktivni plan:** `activeOf(state, isOwner)` vraća pravi `genPlan`, a ako ga nema i sme da se vidi (vlasnik ili nalog sa `n*` unosima) — ugrađeni lični plan. Samo za čitanje; upisi (promena cilja, predlog, novi plan) uvek idu u pravi `genPlan`, koji ostaje `null`, pa oblik stanja na serveru nije promenjen.
- Komponente ne zovu `fetch`; `getApp()` se koristi samo u handlerima i efektima.
- Veličine: najveći fajl `generatePlan.ts` (994 reda, čist domen), `createApp.ts` ≈ 560, komponente < 430.

## 2. Removed

Iz klijenta je uklonjeno (zamenjeno, ne izgubljeno):

- Globalno promenljivo stanje `S` i ručno `innerHTML` iscrtavanje (≈ 16 k redova `app.js`) → store-ovi + React.
- Dve identične `vdotFromRace` definicije i slični tihi „gazeći" duplikati (jedna definicija).
- `recalibratedPlan` je zadržan kao čist domen, ali nema poziva iz UI-ja (kao i u starom kodu); ispravljen A4.
- Ništa funkcionalno **nije** izbačeno. Namerne razlike u ponašanju su navedene u §4 i u `ENGINE_CHANGES.md`.

Nije uklonjeno: `app.js`, `index.html`, `sw.js`, `sw-reg.js`, stari testovi — ostaju do Phase 12 (v. §10).

## 3. Preserved

Bajt-za-bajt ili neizmenjeno (`git diff` naspram osnove menja samo `web/`, `docs/`, `.github/`, `.vercelignore`, `ARCHITECTURE.md`, ovaj fajl; `docs/probes/*` su skripte koje dokazuju stare defekte):

- `api/*.js`, `supabase/`, `vercel.json` (CSP, cron, funkcije), domen, Supabase projekat, Vercel projekat, Strava OAuth, Gemini, Web Push, ugovor baze (`user_state`).
- Service worker: `web/sw/sw.js` je telo starog `sw.js` doslovno; pri izgradnji se ubacuju samo `CACHE`/`APP_VERSION`/`ASSETS` (ime keša `sub19-cache-v283-<8hex>`, stari je `v282`). Test `pwa/sw.oracle.test.ts` poredi sa starim.
- CSS: `legacy.css` se koristi kao jeste — vizuelni izgled nije menjan.
- Obećanja iz `privacy.html`: tokeni i koordinate ne napuštaju uređaj (`domain/sync/payload`, oracle nad 200 stanja).
- Vlasnikov ugrađeni plan (`data/personalPlan.ts`, generisan iz starog `PLAN`/`PRED`/`QS`, duboka jednakost proverena).
- Prelaz sa starog frontenda na novi i povratak, sa istim `localStorage` stanjem (E2E, `e2e/cutover.spec.ts`).

## 4. Training engine

- Generator je portovan u čist TS (`domain/training/generator/*`), sa **golden-master otiskom** starog generatora (2 304 scenarija; isti otisak stari i novi kod) i **diferencijalnim testom** na 1 500 nasumičnih ulaza naspram starog koda u `node:vm`.
- VDOT, zone, Riegel, lanac forme, predlog tempa, primena/poništavanje, zamena treninga, promena cilja, oporavak (bol, opterećenje), test na 3 km — svi poređeni sa starim kodom (`*.oracle.test.ts`).
- AI **nije kalkulator**: sve brojke dolaze iz domena; model dobija zahtev (`aiPayload`) i vraća tekst.

## 5. Generator audit

Pun audit: `docs/TRAINING_ENGINE_AUDIT.md`. Namerne izmene (svaka sa starim ponašanjem, razlogom, novim ponašanjem i testom): `docs/ENGINE_CHANGES.md`.

| ID | Sažetak |
|---|---|
| G1–G8, G10 | Nevažeći ulazi (datum, intenzitet, PB, kilometraža, cilj, tip distance, nebrojčani dani) daju `{ error }` umesto praznog plana / NaN / izuzetka. Otisak se ne pomera. Fuzz: 2 000 pokvarenih ulaza (jednokratno 40 000). |
| A1 | Poništavanje prilagođavanja tempa više ne ostavlja praznu izmenu (10/300 stanja je bilo pogođeno). |
| A2 | Primena predloga tempa više ne briše snagu dodatu uz trčanje. |
| A3 | Posle promene cilja `qs` ključevi su u prostoru ID-ja dana: lap-detekcija sa Strave ne gubi spec (26 od 30 sesija ga je gubilo). |
| A4 | `recalibratedPlan` spaja zaključana polja na pravi dan (dow 1–7). |
| A5 | Neupotrebljiv `expires_in` → 3600 s (ne `NaN`, koji je izazivao osvežavanje tokena pri svakom pozivu). |

**Odluke vlasnika (2026-10-02, `ENGINE_CHANGES` Korak C):** D1 ostaje — spregnutost kilometraže i tempa kroz vremenske plafone je zadržana (efekat ograničen testom); D2 urađeno — rast forme i rast obima su dva odvojena izbora (`volIntensity`, izostavljen = kao pre); D3 ne; D5 urađeno — zastavica `taper` u nedelji (usput ispravljen prikaz faze: prva taper nedelja HM/maratona je bila VRHUNAC); `recalibratedPlan` povezan sa ekranom (Podešavanja → Trening → Plan). Granice tempa 2:20–20:00/km su proizvodna odluka (`constants/product.ts`).

Ostale razlike van generatora: F1–F9 u `ENGINE_CHANGES.md` (tekst „Pravila uvoza", `aiCount` koji nije broj, nastavak slanja po adresi umesto po poziciji, jedan natpis dugmeta „Pošalji na sat", `httpErrorText`, strpljenje 1,5 s pri proveri naloga, itd.).

## 6. Tests

| Šta | Vrednost |
|---|---|
| Vitest | **1 077 testova / 100 fajlova** (domain 383 · oracle 273 · node 72 · ui 349); `npm run check` (tsc, lint, format, testovi, build) zelen |
| Stari testovi (backend + stari frontend) | `node --test` **1 553 / 1 553** zeleno, nepromenjeni |
| `any`, `dangerouslySetInnerHTML`, `fetch` u komponentama | 0 (grep + lint) |
| Mutacione provere | oracle testovi imaju brojače pokrivenosti slučajeva i ciljane slučajeve koji ubijaju preživele mutante |
| Mapiranje starih testova | `docs/REWRITE_STATUS.md` — izvedeno iz naslova i oblasti, **ne** iz poređenja svake tvrdnje |

Oracle pristup: `src/test/legacyOracle.ts` učitava stari `app.js` u `node:vm` i poziva njegove funkcije sa istim ulazima kao novi kod. Poređeni su, između ostalog, `sbDecide` (sve 3 750 kombinacije), `sbPayload` (200 stanja), `http` poruke (54 kombinacije), `uvod.js`, SW (bajt-za-bajt), lični plan (65 testova).

## 7. E2E

35 Playwright tokova (Chromium, profil `Pixel 7`), poslednji pun prolaz zelen, **protiv lažnog backenda** (`e2e/support/backend.ts`): prvi start, prijava (nonce), odjava, čarobnjak, pravljenje plana, završi/preskoči/pomeri/izmeni, oporavak, trka (test 3 km), Strava (OAuth sa proverom `state`), vreme, AI, Zajednica, backup izvoz/uvoz (sa zlonamernim ID-jem), brisanje naloga, offline, ažuriranje SW-a, prelaz v282 → novi → povratak, vlasnikov plan, uvodni ekran.

Nije pokriveno: pravi Supabase/Google prijava, prava Strava/intervals.icu/Gemini/Resend/Web Push, Safari, Firefox, Android (TWA), instalirana PWA.

## 8. Performance

Lokalno, `vite preview`, stoni Chromium, lažni backend — **nije produkcija, nije telefon**.

| Šta | Novo | Staro |
|---|---|---|
| Početni JS (gzip) | ≈ **216 KB** (+ CSS 9,7 KB) | `app.js` 327 KB gzip (914 KB sirov) |
| Reload → „Danas" interaktivan | 0,46 s · 0,8 s (4× CPU) · 1,1 s (6× CPU) | nije mereno |
| Plan tab / otvaranje nedelje | 0,39 s / 0,10 s (1×) · 0,60 s / 0,28 s (4×) | nije mereno |

- Cilj iz plana (< 150 KB) **nije ispunjen**; tvrdi uslov (≤ staro) jeste. Najveći udeo: react-dom (33 %), zod (14 %). Dalje smanjenje: lenjo učitavanje listova (menja ≈ 50 testova) ili `zod/mini` (menja svaku šemu) — nije urađeno.
- Lighthouse nije pokrenut. Realna brzina na telefonu: **nedovoljno dokaza**.

## 9. Security

- CSP iz `vercel.json` je nepromenjen i test (`deploy/cutover.node.test.ts`) dokazuje identičnost; nema inline skripti (`uvod.js` i `sw-reg.js` su spoljni fajlovi).
- Nijedan `dangerouslySetInnerHTML`; AI tekst ide kroz `parseAnalysis` (samo `**bold**` i pasusi, ostalo je tekst); fuzz svih ekrana otrovnim stanjem (`features/poison.test`).
- Uvoz backupa: Zod na granici, zlonamerni ID-jevi odbijeni (unit + E2E).
- Prijava: provera nonce-a (`createApp.test`, `e2e/auth`); Strava OAuth: provera `state` (`oauth.test`, `e2e/strava`).
- Tokeni i koordinate ne idu na server (`toServerPayload`, oracle).
- `npm audit --omit=dev`: 0 ranjivosti.
- Rizici koji ostaju po dizajnu (nepromenjeno): Strava token ide iz pregledača direktno na `strava.com`; Zajednica čita/piše direktno u PostgREST, RLS je jedina zaštita (`ARCHITECTURE.md` R8, R9).
- Nije rađeno: nezavisan bezbednosni pregled, axe/čitač ekrana.

## 10. Known issues

1. Početni JS ≈ 216 KB umesto cilja < 150 KB (v. §8).
2. Nema automatskog a11y testa (samo lint `jsx-a11y` i ručno preneta svojstva).
3. Mapiranje starih testova je po naslovima/oblastima; pre Phase 12 treba proći stare testove jedan po jedan.
4. E2E samo Chromium, samo lažni backend.
5. Odluke o generatoru (D1–D5) su donete; ostaje samo nezavisna provera konstanti koje nisu potvrđene (audit §14: zone E i R, `agr`, taper faktori).
6. Stari klijent u ≈ 1 od 12 pokretanja prikaže traku „sukob" posle prvog upisa (`sbDecide`: `!seenAt` → `'ask'`). Nije preuzeto; novi klijent: 16/16 čistih pokretanja. Stari kod nije menjan.
7. Vlasnikov ugrađeni plan je podatak u paketu (`data/personalPlan.ts`), ne red u bazi — kao i ranije.

## 11. Deployment

**Isporučeno** (PR #26 → `main` → postojeći Vercel projekat `sub-19`, domen `sub-19.vercel.app`; DNS, Supabase, env promenljive nisu menjani).

Proveren javni domen posle deploy-a: `/`, `/sw.js` (keš `sub19-cache-v283-…`), `/uvod.js`, `/manifest.json`, `/.well-known/assetlinks.json`, `/sub20.apk`, `/api/push` odgovaraju; `/app.js`, `/docs/*`, `/web/*` su 404; CSP identičan; SW se aktivira i offline reload radi (Chromium).

Stvarni Vercel build je otkrio defekt koji lokalni testovi nisu: neusidreni obrasci u `.vercelignore` (`test/`, `supabase/`, `scripts/`) važe na svakoj dubini i izbacivali su `web/src/test`, `web/src/services/supabase`, `web/scripts` iz upload-a (build pao). Sada su usidreni (`/test/` …); test `deploy/cutover.node.test.ts` to čuva.

**Nije provereno na produkciji:** prava Google prijava i sinhronizacija, Strava, intervals.icu, Gemini, push, telefon/Android/Safari/Firefox. Rollback: Vercel → Deployments → prethodni produkcioni → Promote.

Phase 12 (brisanje `app.js`, `index.html`, starog `sw.js`, `sw-reg.js`, starih frontend testova) čeka tu ručnu proveru i prolazak starih testova jedan po jedan.

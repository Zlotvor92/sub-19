# REWRITE STATUS

Živi dokument. Plan i kapije: `REWRITE_PLAN.md`. Završni izveštaj: `../REWRITE_REPORT.md`. Prelaz na produkciju: `CUTOVER.md`.

**Stanje (grana `claude/sub20-frontend-rewrite-q6dlvr`):** novi frontend (`web/`) je funkcionalno kompletan prema starom `app.js`, sa dokazom (diferencijalni testovi naspram starog koda, 1 019 vitest testova,
33 Playwright toka). **Nije isporučen na produkciju** (nema Vercel pristupa) i **stari frontend nije uklonjen** (Phase 12 sledi tek posle provere na produkciji).

## Faze

| # | Faza | Stanje | Dokaz |
|---|---|---|---|
| 1 | Audit | **gotovo** | `ARCHITECTURE.md`, `docs/{TRAINING_ENGINE_AUDIT,API_INVENTORY,FEATURE_INVENTORY,REWRITE_PLAN}.md` |
| 2 | Scaffold | **gotovo** | Vite + React 19 + TS strict + ESLint (izolacija domena, a11y) + Prettier + Vitest (4 projekta) + RTL + Playwright; CI posao `web` |
| 3 | Domain | **gotovo** | `src/domain/**` čist TS (lint zabranjuje DOM/fetch/store/`Date.now`); generator, VDOT, adaptacija, oporavak, aktivnosti, zone, vreme, AI, zajednica, push, sat, lični plan |
| 4 | Parity testovi | **gotovo** | golden-master otisak generatora 2 304/2 304, diferencijalni test 1 500 nasumičnih ulaza, 273 oracle testa (poređenje sa starim kodom u `node:vm`), invarijante i naučni testovi |
| 5 | API/Supabase/Auth sloj | **gotovo** | `src/services/**`: `Result` umesto izuzetaka, Zod na granici, rokovi na svakom pozivu; sesija, sinhronizacija, Strava, intervals.icu, AI, Zajednica, push, administracija |
| 6 | Shell | **gotovo** | tabovi, zaglavlje, list (dijalog), potvrda, trake, kapija, prevlačenje između tabova, ambijentalno svetlo, uvodni ekran |
| 7 | Feature-i | **gotovo** | onboarding, Danas, Plan, Oporavak, Trka, Zajednica, Podešavanja (sve sekcije), lični plan vlasnika |
| 8 | Integracije | **gotovo** (prema lažnim servisima) | Strava, intervals.icu (+ slanje na sat), vreme, AI, push — **nijedna nije probana protiv pravog servisa u ovoj sesiji** |
| 9 | PWA/offline | **gotovo** | `sw.js` iz starog koda bajt-za-bajt + injekcija verzije/spiska pri izgradnji; offline i ažuriranje u pregledaču; **v282 → novi frontend** i povratak (E2E) |
| 10 | E2E + perf + sec | **gotovo, sa ograničenjima** | 33 Playwright toka; merenja ispod; bezbednosni pregled ispod. **Nema** automatskog a11y testa (axe), Lighthouse nije pokrenut |
| 11 | Produkcija (postojeći Vercel projekat i domen) | **NIJE urađeno** | zahteva vlasnika; spremno: `web/deploy/vercel.cutover.json` + `docs/CUTOVER.md` + test `deploy/cutover.node.test.ts` |
| 12 | Uklanjanje starog frontenda | **NIJE urađeno** (namerno) | tek posle faze 11; v. „Šta se briše" u `CUTOVER.md` |

## Brojke

| Šta | Vrednost |
|---|---|
| Vitest | **1 019 testova / 96 fajlova** (domain 335 · oracle 273 · node 71 · ui 340), `npm run check` zelen |
| Playwright | **33 toka** (Chromium, `Pixel 7`), 2 uzastopna prolaza zelena |
| Stari testovi (backend + stari frontend) | `node --test` **1 553 / 1 553** zeleno — `api/*`, `supabase/`, `app.js`, `sw.js` NISU menjani (`git diff` naspram osnove: samo `web/`, `docs/`, `.github/`, `.vercelignore`, `ARCHITECTURE.md`) |
| Kod | ~31,6 k redova izvora u `web/src`, ~22,4 k redova testova (uključujući E2E) |
| Najveći fajlovi | `generatePlan.ts` 994 (čist domen, portovan), `createApp.ts` ~560 (koren kompozicije); komponente < 430 redova |
| `any` / `dangerouslySetInnerHTML` / `fetch` u komponentama | **0** (grep + lint) |
| `npm audit --omit=dev` | 0 ranjivosti |

### Merenja (`vite build`, `vite preview`, lokalno — NE produkcija)

| Šta | Novo | Staro |
|---|---|---|
| Početni JS (gzip) | **≈ 216 KB** (index 200 + 2 prednalaganja 16) + CSS 9,7 KB | `app.js` 914 KB / **327 KB** gzip |
| Cilj iz plana (< 150 KB) | **NIJE ispunjen.** react-dom 33 %, zod 14 % paketa. Ispunjen je tvrdi uslov (≤ staro). Dalje smanjenje traži lenjo učitavanje listova (menja ~50 testova) ili `zod/mini` (menja svaku šemu) — nije urađeno | |
| Reload → „Danas" interaktivan (lokalni server, lažni backend) | 0,46 s · 0,8 s pri 4× usporenom CPU · 1,1 s pri 6× | nije mereno |
| Plan tab / otvaranje nedelje (1× / 4× CPU) | 0,39 s / 0,10 s · 0,60 s / 0,28 s | nije mereno |

Mereno na stonom Chromium-u; telefon i prava mreža NISU mereni ("nedovoljno dokaza" za realna vremena na uređaju).

## Šta je dokazano, a šta nije

**Dokazano diferencijalno naspram starog koda** (isti ulazi, isti izlazi, `*.oracle.test.ts`): generator (otisak + 1 500 slučajeva), VDOT/zone/Riegel, lanac forme i predlog tempa, plan (adaptacija, zamena, izmena, promena cilja),
oporavak (bol, opterećenje, predlog), Danas kartice i poređenje sesija, Trka, aktivnosti (spajanje, radni deo, per-km, drift), zone pulsa, AI (zahtev, kartica, trend, tok posla), Zajednica (jedini odlazni skup polja, rang, ekrani),
vreme, slanje na sat, obaveštenja (najave), podešavanja, sinhronizacija (`sbDecide` svih 3 750 kombinacija, `sbPayload`), `uvod.js`, service worker (bajt-za-bajt), konstante prevlačenja, lični plan (podaci, polazna trka, ko ga vidi, tuđi seed), HTTP poruke greške.

**Dokazano E2E u pregledaču (protiv LAŽNOG backenda):** prvi start, prijava (sa proverom nonce-a), odjava, čarobnjak, pravljenje plana, završi/preskoči/pomeri/izmeni trening, oporavak, trka (test na 3 km), Strava (OAuth sa proverom `state`),
vreme, AI, Zajednica, backup izvoz/uvoz (sa zlonamernim ID-jem), brisanje naloga, offline, ažuriranje SW-a, **prelaz sa starog frontenda i povratak**, vlasnikov ugrađeni plan, uvodni ekran.

**NIJE dokazano (nedovoljno dokaza):** rad sa pravim Supabase-om/Google prijavom, pravom Stravom/intervals.icu/Gemini/Resend/Web Push servisom, stvarna dozvola za obaveštenja, instalirana PWA na telefonu, Android (TWA) ponašanje, Vercel izgradnja
(`outputDirectory` uz `api/` funkcije), realna brzina na telefonu, pristupačnost čitačem ekrana (postoji samo lint `jsx-a11y` i ručno prenete provere), Safari/Firefox (E2E je samo Chromium).

## Mapiranje starih testova (`test/*.test.mjs`) na nove

Oznake: **P** = preneto (nov test pokriva isto), **L** = backend/repo fajlovi — ostaje kao staro (ne zavisi od frontenda), **D** = delimično.
Stari frontend testovi se brišu TEK u Phase 12 i samo uz ovu pokrivenost.

| Stari fajl (n) | Novi dokaz | |
|---|---|---|
| ai-posao-okidaci (6), ai-zaglavljen (12) | `domain/ai/*.oracle`, `services/ai/aiJobs.oracle`, `features/today/ai.test`, `e2e/ai` | P |
| android-paket (7) | `deploy/cutover.node` (APK i assetlinks bajt-za-bajt), `pwa/static.node` (oblik otiska); provera sadržaja samog APK-a ostaje | D/L |
| api (173), requireuser-kopije (3) | ostaje — `api/*` nije menjan | L |
| bezbednost (66) | frontend deo: `features/poison.test` (fuzz svih ekrana), `domain/state/*`, `lib/auth.test`, `app/createApp.test` (nonce), `services/oauth.test`, `e2e/{auth,strava,data}`; serverski deo ostaje | P + L |
| danas (8) | `domain/date/*`, `app/useToday.test` | P |
| deload-ostrina (11) | `generator/deload.test` (9) + `domain/plan/plan.test` (2) | P |
| doslednost (49) | `deploy/cutover.node` (CSP, inline skripte, zoom, SW, manifest), `pwa/static.node` (uputstvo↔kod, sidra, labele, privatnost, animacije), `app/tabs.test`; verzije/`api/` fajlovi ostaju | P + L |
| forma-vs-plan (15), vdot-plan (20) | `training/adaptation/*.oracle`, `adaptation.test` | P |
| generator (21), nauka (13), generator-racunica (3), simetrija-distanci (11), generator-otisak (2) | `generator/*` (invarijante, naučni, otisak, diferencijalni) | P |
| grafikoni (7), plan-prstenovi (14), metrike (17), kartoteka (14), masa (11) | `domain/{recovery,race,day}/*.oracle`, `features/*/*.test` | P |
| icu-treninzi (66) | `domain/watch/icuWorkouts.oracle`, `services/icu/*`, `settings.test` (sat) | P |
| ikonica-obavestenja (3) | `pwa/uvod.node.test` (ikonice), SW test | P |
| intervali-radni-deo (27), spojevi (9), zone-pulsa (57) | `domain/activities/*.oracle`, `domain/zones/*.oracle` | P |
| istorija (21), state (71), otpornost (28) | `domain/state/*`, `services/sync/*`, `services/storage/*`, `stores/stores.test`, `createApp.test` | P |
| licni-plan (28), snaga-trka-polazna (10) | `domain/personal/personal.oracle`, `features/personal.test`, `e2e/owner` | P |
| list-dijalog (15), potvrda (11) | `components/ui/ui.test` | P |
| mreza-rok (6) | `services/http*`, `createApp.test` (1,5 s strpljenje) | P |
| oporavak-trka (25), opterecenje-pre-plana (7), povratak-obim (12), povreda (17) | `domain/recovery/*.oracle`, `features/recovery/*.test` | P |
| podesavanja (48), revizija3/5/6 (80) | `domain/settings/*.oracle`, `features/settings/settings.test`, domen testovi po oblastima | P (80 stavki revizija mapirano po oblasti, ne 1:1) |
| prevlacenje (33) | `domain/shell/swipe*`, `app/useSwipeNav.test`, `pwa/static.node` | P |
| pure (19), gramatika (17) | `domain/{date,format}`, `vdot.oracle` | P (`mdToHtml` → `parseAnalysis`, oracle test u `domain/ai/ai.oracle.test.ts`) |
| push (63), sw-azuriranje (24) | `pwa/sw.node`, `pwa/sw.oracle`, `services/push/*`, `domain/push/*`, `pwa/*.test` | P (kripto deo pošiljaoca ostaje `L`) |
| snaga-uz-trcanje (4), snaga-video (3), temperatura-trcanja (25), test-3km (39) | `domain/plan/altEditor.oracle`, `domain/day/*`, `domain/weather/*`, `training/test3k/*` | P |
| uvod (19) | `pwa/uvod.{test,oracle.test,node.test}`, `e2e/smoke` | P |
| zajednica (71) | `domain/community/*.oracle`, `app/community.test`, `features/community/*` | P |

**Ograničenje ovog mapiranja:** tabela je izvedena iz naslova starih testova i oblasti koje nova suita pokriva, ne iz mehaničkog poređenja svake tvrdnje (to nije urađeno). Pre Phase 12 treba proći stare testove po jedan i potvrditi svaki.

## Otvorene odluke

| ID | Pitanje | Stanje |
|---|---|---|
| O1 | Vercel pristup / preview | **vlasnik** |
| O2 | Lični plan vlasnika | **rešeno kao u planu: ostaje kao podatak** (`data/personalPlan.ts`) |
| O3 / D1 | Spregnutost obima i tempa u generatoru | zadržano (a), nepromenjeno; v. `TRAINING_ENGINE_AUDIT` |
| O4 | `intensity` nepoznat → greška | urađeno (G4) |
| O5 | TypeScript/ESLint verzije | TS `~6.0.3`, ESLint 9 (odstupanje obrazloženo u dnevniku ispod) |
| D2–D5 | v. `TRAINING_ENGINE_AUDIT` §12 | nepromenjeno, čeka odluku |

## Odstupanja od plana

| Datum | Odstupanje | Razlog |
|---|---|---|
| 2026-10-01 | TypeScript `~6.0.3`, ESLint `^9.39.5` (plan: TS 7.x / ESLint 10.x) | `typescript-eslint@8.71` traži `typescript <6.1`; `eslint-plugin-jsx-a11y@6.10.2` podržava ESLint do 9 |
| 2026-10-01 | Početni JS ≈ 216 KB gzip umesto cilja < 150 KB | v. merenja; tvrdi uslov (≤ 327 KB) ispunjen |
| 2026-10-02 | Strpljenje od 1,5 s pri proveri naloga (`ENGINE_CHANGES` F6) | mreža koja visi ne sme da drži praznu stranicu 12 s |

## Namerne razlike u ponašanju

`docs/ENGINE_CHANGES.md` (generator: G1–G10, A1–A5; ostalo: F1–F9). Sve ostalo je poređeno sa starim kodom i identično.

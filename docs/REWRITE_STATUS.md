# REWRITE STATUS

Živi dokument. Plan i kapije: `REWRITE_PLAN.md`. Završni izveštaj: `../REWRITE_REPORT.md`. Prelaz na produkciju: `CUTOVER.md`.

**Stanje (grana `claude/sub20-frontend-rewrite-q6dlvr`):** novi frontend (`web/`) je funkcionalno kompletan prema starom `app.js`, sa dokazom (testovi naspram zamrznutih odgovora starog koda, 1 079 vitest testova,
33 Playwright toka, 388 testova backenda). **Isporučen na produkciju 2026-10-02** (PR #26, Vercel projekat `sub-19`, domen `sub-19.vercel.app`; proveren javni domen: sve statike i `/api/push`, CSP, SW aktivan + keš `v283`, offline reload). **Stari frontend je obrisan (Phase 12, 2026-10-02)**; poslednji commit na kome postoji je `b7afc41`.

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
| 10 | E2E + perf + sec | **gotovo, sa ograničenjima** | 35 Playwright tokova; merenja ispod; bezbednosni pregled ispod. **Nema** automatskog a11y testa (axe), Lighthouse nije pokrenut |
| 11 | Produkcija (postojeći Vercel projekat i domen) | **urađeno** (2026-10-02) | stvarni Vercel build (preview + produkcija) uspeo; pronađen i ispravljen defekt: neusidreni obrasci u `.vercelignore` (`test/`, `supabase/`, `scripts/`) izbacivali su `web/src/test`, `web/src/services/supabase`, `web/scripts`; test `deploy/cutover.node.test.ts`. **Nije proveren**: prava prijava/Strava/icu/AI/push na produkciji, telefon |
| 12 | Uklanjanje starog frontenda | **urađeno** (2026-10-02) | obrisano: `app.js`, `index.html`, `sw.js`, `sw-reg.js`, duplikati statike, `test/harness.mjs`, 39 od 53 starih test fajlova (oni koji su učitavali `app.js`); v. „Phase 12" u `CUTOVER.md` i „Šta je obrisano" ispod. Nije rađeno: provera svakog starog testa jedan po jedan (v. ograničenje mapiranja) |

## Brojke

| Šta | Vrednost |
|---|---|
| Vitest | **1 079 testova / 100 fajlova** (domain 383 · oracle (zamrznut) 268 · node 79 · ui 349), `npm run check` zelen |
| Playwright | **33 toka** (Chromium, `Pixel 7`); poslednji pun prolaz zelen. Dva toka prelaza v282 → novi i povratka (`cutover.spec`) obrisana: prelaz je obavljen na produkciji |
| Testovi backenda i repozitorijuma (`test/`) | `node --test` **388 / 388** zeleno (14 fajlova). Pre Phase 12 bilo je 1 553 testova u 53 fajla; 1 165 ih je učitavalo stari frontend i obrisano je. `api/*` i `supabase/` NISU menjani |
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

## Šta je obrisano u Phase 12 i zamrznuti oracle testovi

**Obrisano (1 165 starih testova, 39 fajlova):** svi koji su pokretali `app.js` u `node:vm` (`harness.mjs`). Iz 14 fajlova koji ostaju (backend, SQL, `vercel.json`, javna statika, politika privatnosti naspram koda) sklonjeni su samo testovi koji su čitali `app.js`/`index.html`/`sw.js`; ostali nisu menjani, osim putanja do statike koja je premeštena u `web/public/`.

**Zamrznuti oracle testovi (268):** novi kod se i dalje poredi sa starim, ali sa SNIMLJENIM odgovorima. Svaki poziv starog koda (`call`/`get`/`evalIn`, 4 MB gzip u `web/src/test/legacy-recordings/`) zapisan je sa SHA argumenata; test koji bi poslao drugačiji ulaz pada sa jasnom porukom. Provereno mutacijom: promena `ZONE_FRACTION.T` obara 31 oracle test. Generator ima dva zamrznuta poređenja: golden master (2 304 scenarija) i 1 500 slučajnih ulaza (SHA starog izlaza). Mala tri `*.oracle.test.ts` koja su čitala fajlove starog koda (SW, `sw-reg.js`, `uvod.js`, podaci ličnog plana) zamenjena su SHA-256 izmerenim nad starim fajlovima (`pwa/frozen.node.test.ts`, `personal.oracle.test.ts`).

**Šta se NE može više:** uzeti nov snimak iz ovog repozitorijuma. Novi oracle test = snimak nad commit-om `b7afc41` (`git worktree add ../legacy b7afc41`), pa snimak ovde. Statika i `sub20.apk` su u `web/public/`.

## Mapiranje starih testova (`test/*.test.mjs`) na nove (istorijski zapis)

Oznake: **P** = preneto (nov test pokriva isto), **L** = backend/repo fajlovi — ostaje kao staro (ne zavisi od frontenda), **D** = delimično.
Stari frontend testovi su obrisani u Phase 12 uz ovu pokrivenost.

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

**Ograničenje ovog mapiranja:** tabela je izvedena iz naslova starih testova i oblasti koje nova suita pokriva, ne iz mehaničkog poređenja svake tvrdnje. Provera „svaki stari test jedan po jedan" NIJE urađena pre brisanja (po izričitom nalogu vlasnika); stari testovi su sačuvani u istoriji (`git show b7afc41:test/<fajl>`).

## Otvorene odluke

| ID | Pitanje | Stanje |
|---|---|---|
| O1 | Vercel pristup / preview | **rešeno** (`VERCEL_TOKEN` u okruženju sesije; cutover urađen) |
| O2 | Lični plan vlasnika | **rešeno kao u planu: ostaje kao podatak** (`data/personalPlan.ts`) |
| O3 / D1 | Spregnutost obima i tempa u generatoru | **odluka vlasnika 2026-10-02: ostaje (a)**; efekat ograničen testom |
| O4 | `intensity` nepoznat → greška | urađeno (G4) |
| O5 | TypeScript/ESLint verzije | TS `~6.0.3`, ESLint 9 (odstupanje obrazloženo u dnevniku ispod) |
| D2 | Dva izbora (rast forme / rast obima) | **urađeno** (`volIntensity`), `ENGINE_CHANGES` Korak C |
| D3 | Prikaz pouzdanosti forme | **odluka vlasnika: ne** |
| D4 | Granice tempa u domenu | urađeno ranije (2:20–20:00/km) |
| D5 | Taper kao zastavica | **urađeno** (`Week.taper`), uz ispravku prikaza faze za HM/maraton |
| R1 | `recalibratedPlan` povezan sa ekranom | **urađeno** (Podešavanja → Trening → Plan) |

## Odstupanja od plana

| Datum | Odstupanje | Razlog |
|---|---|---|
| 2026-10-01 | TypeScript `~6.0.3`, ESLint `^9.39.5` (plan: TS 7.x / ESLint 10.x) | `typescript-eslint@8.71` traži `typescript <6.1`; `eslint-plugin-jsx-a11y@6.10.2` podržava ESLint do 9 |
| 2026-10-01 | Početni JS ≈ 216 KB gzip umesto cilja < 150 KB | v. merenja; tvrdi uslov (≤ 327 KB) ispunjen |
| 2026-10-02 | Strpljenje od 1,5 s pri proveri naloga (`ENGINE_CHANGES` F6) | mreža koja visi ne sme da drži praznu stranicu 12 s |

## Namerne razlike u ponašanju

`docs/ENGINE_CHANGES.md` (generator: G1–G10, A1–A5; ostalo: F1–F9). Sve ostalo je poređeno sa starim kodom i identično.

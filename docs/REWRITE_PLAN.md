# REWRITE PLAN — SUB-20 frontend

Prethodni dokumenti: `ARCHITECTURE.md`, `docs/TRAINING_ENGINE_AUDIT.md`, `docs/API_INVENTORY.md`, `docs/FEATURE_INVENTORY.md`.
Ovaj dokument je plan i **ugovor o redosledu**: ništa iz kasnije faze ne počinje dok kapija ranije nije zelena.

## 0. Princip

*Preserve the product. Preserve the data. Preserve the backend. Preserve the proven behavior. Rebuild the frontend and the training engine properly.*

**Ne menja se:** repozitorijum, Vercel projekat, domen i origin (`/`, scope `./`, TWA/`assetlinks.json`), Supabase projekat/šema/RLS/RPC, `api/*.js`, `vercel.json` (do cutover-a), `user_state` oblik (SCHEMA 11), imena `localStorage` ključeva, IDB `sub19/red`, `privacy.html`, `uputstvo.html`, `sub20.apk`.

## 1. Odluke (i zašto odstupaju od doslovnog zadatka tamo gde odstupaju)

| ID | Odluka | Razlog | Odstupanje od zadatka |
|---|---|---|---|
| A | **Generator se portuje pod golden-master otiskom (Korak A), pa se menja (Korak B).** Ne piše se „od nule". | Postoji otisak od 2 304 scenarija (`test/fixtures/otisak-generatora.json`, SHA-256 po scenariju) koji dokazuje identično ponašanje — jače od „funkcionalne ekvivalencije". Reimplementacija bi tu mrežu bacila. Namerne izmene i dalje idu (G1–G9 iz AUDIT §11), svaka dokumentovana. | Zadatak: „nemoj samo prepisati". Ovde se **restrukturira** (profili kao podaci, strategije kao funkcije, 3 fajla konstanti), ali sa dokazom da izlaz nije slučajno promenjen. |
| B | **Tipovi čuvaju wire-oblik** (`tag`, `session.type`, `desc`, `p5k`…). Engleska imena su aliasi tipova, ne ključevi. | Izlaz generatora je perzistirani `S.genPlan`. Adapter bi dodao sloj koji se mora čuvati sinhron sa starim klijentima na drugim uređajima. | Zadatak daje engleska imena tipova — dobijaju ih (`IntervalSession = Session & {type:'int'}`), ali polja ne. |
| C | **Novi frontend u `web/` sa sopstvenim `package.json`.** Root bez `package.json` do cutover-a; `web/` u `.vercelignore` do cutover-a. | R1: root `package.json` menja Vercel build mod i može oboriti `api/*.js` (v. komentari u njima i `test/README.md`). | — |
| D | **Legacy ostaje u repou kao „oracle"** (app.js, index.html, sw.js, test/) do Phase 12. Stari testovi se ne brišu dok nemaju pandan (§6). | Harness je jedini način da se poredi novo sa starim. | Usklađeno sa zadatkom §26. |
| E | **Service worker: zadržava se postojeći kod**, build samo ubacuje spisak precache-a i verziju. **Bez `vite-plugin-pwa`.** | `sw.js` ima push, sync, periodicsync, IDB, network-first trku i 24 testa; `generateSW` bi to prepisao, `injectManifest` bi zadržao ali dodaje zavisnost bez dobiti za ovaj slučaj. Plugin od ~40 linija je dovoljan. | — |
| F | **Bez router biblioteke.** Tab je stanje u `useUIStore`, sinhronizovano sa `?tab=` preko `history.replaceState`; ekrani se `React.lazy`. | 5 tabova + modalni listovi; jedina „ruta" je `?tab=` iz manifest shortcuta i push deep-link. Router bi bio zavisnost bez funkcije. | Zadatak §28 Phase 6 pominje „routing" — pokriveno, bez biblioteke. Preispitati ako se doda više od `?tab=`. |
| G | **Grafikoni ostaju ručni SVG**, kao mali React komponente; bez biblioteke za grafikone. | Postojeći (`chartHrv/Rhr/Weight/Knee/Pred/Tempo/VdotTrend/Weeks`) su SVG sa dodirnim ciljevima; biblioteka bi promenila izgled i dodala težinu. | — |
| H | **Bez biblioteke za datume, bez i18n biblioteke.** `domain/date` (UTC epoch-day) + `lib/plural` (srpski padeži iz `gramatika.test`). | Jedan jezik; matematika datuma je mala i već uzrok tri buga (TZ). | — |
| I | **Stilovi: postojeći CSS se preseljava doslovno** u `web/src/styles/*.css` (globalni tokeni `--bg`, `--glass`…, klase), **CSS Modules samo za nove komponente**. Bez Tailwinda/UI framework-a. | Vizuelna parity (§18 zadatka); ~1 100 linija CSS-a je dizajn sistem. | — |
| J | **Strava ostaje pozivana iz pregledača**; server samo menja kod/refresh. | Promena modela nije tražena; CSP već dozvoljava. | — |
| K | **Jezik:** UI tekst ostaje srpski; identifikatori novog koda su engleski; wire polja zadržavaju stara (srpska) imena. | Data contract. | — |
| L | **`recalibratedPlan`/`reentryPlan` se portuju u domen sa testovima, ne povezuju u UI.** | Mrtvi u produkciji (R7); povezivanje je odluka proizvoda. | — |

## 2. Zavisnosti (svaka sa razlogom; verzije proverene `npm view` 2026-10-01)

| Paket | Verzija | Razlog | Dev? |
|---|---|---|---|
| `react`, `react-dom` | 19.3.0 | UI | ne |
| `zustand` | 5.0.15 | client state (zahtev), bez Provider-a, selektori | ne |
| `zod` | 4.6.5 | granica poverenja (`user_state`, backup, Strava, icu, AI, vreme) — zamenjuje ručne `cist*` | ne |
| `vite`, `@vitejs/plugin-react` | 8.3.1 / 6.1.1 | build/dev | da |
| `typescript` | 7.0.2 → **ako `typescript-eslint` ne podržava, pada na 5.9.x** | strict | da |
| `vitest`, `jsdom` | 5.0.3 / 30.1.1 | unit/domain (node), komponente (jsdom) | da |
| `@testing-library/react`, `/user-event`, `/jest-dom` | 16.3.3 / 14.6.7 / 7.0.1 | RTL | da |
| `@playwright/test` | 1.63.0 | E2E (koristi preinstalirani Chromium: `executablePath: '/opt/pw-browsers/chromium'`, **bez** `playwright install`) | da |
| `eslint`, `typescript-eslint`, `eslint-plugin-react-hooks`, `eslint-plugin-jsx-a11y` | 10.11.0 / 8.71.0 / 7.1.1 / 6.10.2 | lint + a11y + zabrana importa u domenu | da |
| `prettier` | 3.9.9 | format | da |

**Runtime zavisnosti: 4** (`react`, `react-dom`, `zustand`, `zod`). Sve ostalo je dev. Ništa više se ne dodaje bez ovog razloga u PR-u.

## 3. Struktura `web/`

```
web/
  package.json  tsconfig.json  vite.config.ts  vitest.config.ts  playwright.config.ts  eslint.config.js
  index.html                      markup + tokeni; BEZ inline skripti (CSP script-src 'self')
  public/  sw.js  manifest.json  icons…  (kopirano 1:1)
  src/
    main.tsx  App.tsx
    domain/                       ČIST TS (ESLint: bez DOM/window/localStorage/fetch/Date.now/react/zustand)
      date/  training/{vdot,generator,distances,sessions,adaptation,validation,constants}/
      plan/  recovery/  activity/  weather/  state/(schema, migrate)
    services/
      api/{http,authApi,trainingApi?,recoveryApi,stravaApi,weatherApi,aiApi,communityApi,pushApi,accountApi,supportApi,adminApi}.ts
      supabase/  sync/  storage/  strava/  icu/  weather/  push/  pwa/  backup/
    stores/  useAuthStore useAthleteStore useTrainingStore useRecoveryStore useRaceStore useCommunityStore useSettingsStore useUIStore useSyncStore
    features/ today plan recovery race community onboarding settings auth admin shell
    components/ui/ Button Card Modal Sheet Input Select Badge Progress Tabs EmptyState LoadingState ErrorState Banner ConfirmDialog
    lib/  format.ts plural.ts
    styles/
    test/ (setup, fixtures, legacy-oracle.ts)
  e2e/
```
`trainingApi`/`recoveryApi` iz zadatka: **u ovom sistemu nema zasebnih backend endpointa za plan i oporavak** (plan je u `user_state`, oporavak dolazi preko `icuApi`). Zato `trainingApi.getPlan()` iz zadatka se mapira na `stateRepository.loadPlan()` (čita iz `useTrainingStore`, perzistira kroz `services/sync`). Ime se ne forsira.

## 4. Stanje: `S` → Zustand (zahtev §14)

Pravila: **jedan izvor istine po podatku**; server-state (sync meta) odvojen od client-state-a; perzistencija je **jedan** `PersistedState` (SCHEMA 11) sklopljen iz store-ova na `save()` — **ne** više paralelnih perzistencija po store-u.

| Store | Sadrži (polja `S`) | Napomena |
|---|---|---|
| `useAuthStore` | Supabase sesija (`sub19_sb`), `userId`, `jeVlasnik` | nije deo `PersistedState` |
| `useAthleteStore` | `genPlan.ulaz` (profil/ulaz), `ui.firstRun`, `zajed` osnovno, lične postavke | |
| `useTrainingStore` | `genPlan`, `log`, `alts`, `moves`, `pred`, `predLock`, `vdotLog`, `t3k` | selektori izvode `resolvedPlan` (bez mutacije) |
| `useRecoveryStore` | `wellness`, `knee` (→ `PainRecord[]`), `kg`, `vanPlana` | |
| `useRaceStore` | izvedeno: predikcija, forma-vs-plan, predlog; **bez sopstvenih polja** | čisti selektori |
| `useCommunityStore` | `zajed`, spisak profila (server-state, ne perzistira se) | |
| `useSettingsStore` | `ui.*` (backup, snooze, satTreninga), povezanost Strava/icu (status, ne tokeni u UI) | |
| `useUIStore` | tab, otvoren list, dijalozi, banneri (**ne perzistira se**) | |
| `useSyncStore` | `SB_BUSY`, `SB_SUKOB`, `UCITAVANJE_PALO`, `seenAt`, `deviceId` | |
| tokeni | `S.strava`, `S.icu` ostaju u `PersistedState` lokalno, **izostavljaju se u `sbPayload`/backup** | ugovor privatnosti |

## 5. Deploy strategija (rešava R1 i R2)

1. **Do cutover-a:** `vercel.json`, root i `api/` netaknuti. `web/` dodat u `.vercelignore` (da se ne servira kao statika). Produkcija = legacy, bez promene.
2. **Preview provera (pre produkcije):** na zasebnoj grani/Preview deploy-u postaviti u `vercel.json` `buildCommand: "cd web && npm ci && npm run build"` i `outputDirectory: "web/dist"`; potvrditi da svih 9 funkcija i dalje radi (smoke: `/api/push` GET, `/api/icu` 401), da CSP zaglavlja i `.well-known/assetlinks.json` stižu, da `Content-Type` za `sub20.apk` ostaje. Ovo traži **Vercel pristup koji ova sesija nema** — korak je za vlasnika (v. §9).
3. **Statici koji moraju stići iz `web/public`:** `privacy.html`, `uputstvo.html`, ikone, `manifest.json`, `sub20.apk`, `.well-known/assetlinks.json`, `sw.js`. **Test**: lista fajlova u `dist` poređena sa listom korena starog sajta.
4. **Kompatibilnost sa starim SW-om (R2):** novi `sw.js` na istoj adresi; novi bundle pri startu detektuje `registration.waiting` i šalje `SKIP_WAITING` (jednokratno za prelaz); `/app.js` ostaje kao „tombstone" (skripta koja deregistruje stari keš i ne radi ništa drugo) najmanje jedan ciklus izdanja.
5. **Rollback:** `vercel rollback` na prethodni deploy; podaci su nepromenjeni jer je `user_state` oblik identičan (R3), pa rollback ne traži migraciju.

## 6. Mapa testova (nijedan se ne briše bez pandana)

Legend: **D** = domain Vitest (node) · **S** = service Vitest · **C** = RTL komponenta · **E** = Playwright · **L** = ostaje Node test nad `api/*` ili repo fajlovima (backend se ne menja) · **X** = adaptira se.

| Stari test (`test/…`) | Broj | Predmet | Novo |
|---|---:|---|---|
| `generator`, `generator-racunica`, `simetrija-distanci`, `deload-ostrina`, `nauka` (naučne invarijante iz literature), `pure` (VDOT/zone/Riegel) | 21+3+11+11+13+19 | engine | **D** (+ parity otisak) |
| `generator-otisak` | 2 | golden master | **D** — isti fixture, isti SHA |
| `vdot-plan`, `forma-vs-plan`, `revizija3`, `revizija5`, `revizija6` | 20+15+25+21+34 | lanac forme, predlog, QA nalazi | **D** (revizije: svaki nalaz-zamka se prenosi poimence) |
| `povreda`, `povratak-obim`, `opterecenje-pre-plana` | 17+12+7 | recovery domen | **D** |
| `test-3km`, `licni-plan`, `intervali-radni-deo`, `zone-pulsa`, `temperatura-trcanja`, `metrike`, `masa` | 39+28+27+57+25+17+11 | domen + kartice | **D** (+ **C** za kartice) |
| `state`, `otpornost`, `istorija` | 71+28+21 | šema, migracija, backup, oštećen ulaz, verzije | **D/S** (Zod šema; isti slučajevi odbijanja) |
| `danas` | 8 | prelazak preko ponoći | **D** (`domain/date`) + **C** |
| `kartoteka`, `plan-prstenovi`, `grafikoni`, `oporavak-trka`, `podesavanja`, `spojevi`, `uvod`, `gramatika` | 14+14+7+25+48+9+19+17 | UI sadržaj | **C** |
| `prevlacenje`, `list-dijalog`, `potvrda` | 33+15+11 | gest, dijalog, potvrda | **C** + **E** |
| `snaga-trka-polazna`, `snaga-uz-trcanje`, `snaga-video` | 10+4+3 | snaga | **D/C** |
| `ai-zaglavljen`, `ai-posao-okidaci`, `mreza-rok`, `icu-treninzi`, `push`, `zajednica` | 12+6+6+66+63+71 | klijentski servisi (+ serverski delovi) | **S** za klijent; serverski delovi → **L** |
| `bezbednost` | 66 | XSS/CSP/napadi | **podeli:** serverski → **L**; klijentski (validacija ulaza, `esc`) → **D** + **C** (nijedan `dangerouslySetInnerHTML`, ESLint pravilo) |
| `api`, `requireuser-kopije` | 173+3 | serverske funkcije | **L** (ostaju netaknuti — backend se ne menja) |
| `sw-azuriranje`, `ikonica-obavestenja`, `android-paket` | 24+3+7 | SW, ikone, TWA paket | **L/X** (`sw.js` isti; čitanje „iz index.html/app.js" → iz `web/dist`) |
| `doslednost` | 49 | verzije SW↔app, CSP, a11y | **X**: verzija se **ubrizgava u build** iz jednog izvora; testira se `dist` |

Pravilo: svaki novi test navodi u zaglavlju `// parity: test/<stari>.test.mjs :: <ime testa>`; skripta `scripts/check-test-parity` (Phase 4) proverava da svaki stari `test(...)` ima pokazivač ili izričit razlog za izostanak.

## 7. Faze i kapije

Svaka kapija je izvršiva komanda sa zelenim izlazom. „Gate" = uslov za početak sledeće faze.

| # | Faza | Isporuka | **Gate** |
|---|---|---|---|
| 1 | Audit | 5 dokumenata + probe (**ovaj commit**) | pregled vlasnika; odluke D1–D5 (AUDIT §12) i O1–O5 (§9) |
| 2 | Scaffold | `web/`: Vite+React+TS strict, ESLint (domen-izolacija), Prettier, Vitest (node+jsdom), RTL, Playwright config, CI job | `npm run typecheck && lint && test` zeleno u `web/` na praznom projektu; **legacy `node --test` i dalje 1 553/1 553** |
| 3 | Domain | `domain/date`, `vdot/*`, `constants/*`, `sessions/*`, `distances/*`, `generator/*`, `validateInput`, `validatePlan`, `adaptation/*`, `recovery/*` | **Korak A:** otisak 2 304/2 304 identičan; svi ekvivalenti iz AUDIT §9 zeleni |
| 4 | Parity | diferencijalni testovi protiv starog generatora (seeded slučajni ulazi), `check-test-parity` | 0 neobjašnjenih razlika; **tek tada** Korak B (izmene G1–G9, svaka sa commit-om i diff-om otiska) |
| 5 | Data layer | Zod `PersistedStateSchema`, `migrate`, `services/storage`, `services/api/*`, **`services/sync`** | testovi iz `state`, `otpornost`, `istorija`, `mreza-rok` prenešeni; **round-trip**: stanje iz starog harnessa → novi parser → serijalizacija → bajtovski isto (sortirani ključevi); sukob/`UCITAVANJE_PALO` testovi zeleni. **Do ovog gate-a novi kod ne sme da piše u `user_state`** (ni u dev-u protiv produkcionog projekta) |
| 6 | Shell | `App`, `useUIStore`, tab + `?tab=`, `Sheet`, `ConfirmDialog`, `Banner`, tema/CSS, `UpdateBanner` | RTL: dijalog-testovi (`list-dijalog`, `potvrda`); a11y lint čist |
| 7 | Features | redom: onboarding → Today → Plan → Recovery → Race → Settings → Community | po feature-u: RTL zeleno + vizuelna provera (screenshot poređenje sa starim, Playwright) |
| 8 | Integracije | `services/strava`, `icu`, `weather`, `aiApi`, `pushApi` | testovi servisa; Strava/icu tok bar sa lažnim serverom (OAuth round-trip nije izvodljiv u CI-ju — dokumentovano) |
| 9 | PWA/offline | `sw.js` build-injekcija, update tok, tombstone `app.js` | E2E: instaliran v282 → ažuriranje; offline otvaranje; `doslednost` adaptiran |
| 10 | E2E + perf + sec | Playwright (14 tokova iz zadatka §23), bundle merenje, bezbednosni pregled | sve zeleno; **bundle ≤ stari (327 KB gzip)**, ciljano < 150 KB initial JS (mereno, ne obećano) |
| 11 | Deploy | Preview pa produkcija na **postojeći** projekat | ručni smoke (vlasnik): prijava postojećim nalogom, plan se učitava, push, Strava, icu |
| 12 | Uklanjanje legacy-a | brisanje `app.js`, inline-a iz `index.html`, starog harnessa | tek posle: sve gore + 1 puna nedelja produkcije bez regresije |

## 8. Šta ovaj plan namerno NE radi

- Ne dira `supabase/*.sql`, RLS, RPC, `api/*.js`.
- Ne uvodi novi backend, bazu, domen, Next.js, Tailwind, Redux, UI framework.
- Ne prepisuje `sw.js` logiku (samo build-injekcija).
- Ne povezuje `recalibratedPlan`/`reentryPlan` u UI.
- Ne menja UX (osim a11y ispravki koje ne dotiču logiku) pre potvrđene parity.
- Ne koristi AI za proračun (VDOT, taper, datumi, obim); AI ostaje analiza/objašnjenje preko `/api/analyze`.

## 9. Otvorene odluke za vlasnika

| ID | Pitanje | Preporuka |
|---|---|---|
| O1 | **Vercel pristup i preview deploy** za proveru §5 — ova sesija ga nema | vlasnik pušta preview kad Phase 2 bude gotova |
| O2 | Lični plan (F-27): ostaje kao data modul? | da — uklanjanje bi bilo gubitak funkcionalnosti |
| O3 | AUDIT D1 (spregnutost obima i tempa): zadržati (a) ili razdvojiti (b)? | (a) |
| O4 | AUDIT G4: nepoznat `intensity` → greška ili podrazumevano `std`? | greška u domenu; UI već nudi samo 3 vrednosti |
| O5 | TypeScript 7.x ako `typescript-eslint` ne radi → 5.9? | da, uz belešku u commit-u |

## 10. Kako se prati napredak

`docs/REWRITE_STATUS.md` (nastaje u Phase 2): tabela F-ID → stanje (`—`/`port`/`parity`/`done`), tabela stari test → novi test, tabela odluka sa datumom. `REWRITE_REPORT.md` na kraju (zahtev §30).

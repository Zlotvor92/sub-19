# SUB-20 — ARCHITECTURE (stanje pre rewrite-a)

Ovo je audit **postojećeg** sistema. Ciljna arhitektura je u `docs/REWRITE_PLAN.md`. Stanje danas (folderi, tabovi, ekrani, stil): §12.
Datum audita: 2026-10-01. Osnova: grana `claude/sub20-frontend-rewrite-q6dlvr`, APP_VERSION `282`, SCHEMA `11`.

## 0. Šta je ovim auditom pročitano, a šta nije

| Pročitano liniju po liniju | Pregledano samo preko indeksa funkcija / zaglavlja | Nije pročitano |
|---|---|---|
| Ceo generator (`app.js` 5757–9110): profili, `generatePlan`, `buildDaySlots`, `allocEasyLR`, `recalibratedPlan`, `reentryPlan`, `planSaNovimCiljem` | 5K/10K/HM/42K `mk*` i `buildQuality*` funkcije (6317–7630) — pročitane glavne, ne svaka | CSS u `index.html` (1100 linija), SVG silueta tela, animacije prevlačenja (`pv*`) |
| VDOT lanac (2388–2970), stanje i čišćenje ulaza (1077–1250, 419–545) | Zajednica, Podešavanja, Oporavak UI (renderovanje) | `privacy.html`, `uputstvo.html` (osim što su statične) |
| `sw.js` (fetch/install/activate), `sw-reg.js`, `manifest.json`, `vercel.json`, CI | Većina `test/*.test.mjs` (čitani `generator.test.mjs`, README, nazivi i brojevi) | `sub20.apk` (binarni; v. §8) |
| Zaglavlja svih 9 `api/*.js`, `api/analyze.js` handler, `sbPush`/`sbRemoteAt`, ADMIN/vlasnik logika, zaglavlja `supabase/*.sql` | Telo `api/icu.js`, `api/push.js`, `api/broadcast.js`, `api/daily-report.js` | |

Gde tvrdnja ispod nije proverena u kodu, piše **„Nedovoljno dokaza"**. Svaka stavka se mora ponovo čitati u trenutku kad se feature portuje (v. `docs/FEATURE_INVENTORY.md`, kolona *Pre porta pročitati*).

## 1. Brojke

| | |
|---|---|
| `app.js` | 16 019 linija, 914 KB, **327 KB gzip**, jedna klasična (non-module) skripta, 607 top-level funkcija, 173 top-level `const` |
| komentari u `app.js` | ~6 100 linija (38%). **To nije šum**: komentari su istorija ispravljenih grešaka sa izmerenim brojevima (npr. „mereno na 22.080 planova…"). Tretirati kao specifikaciju, v. §9 |
| `index.html` | 1 262 linije; ~1 100 inline CSS, 5 `<section>` stranica, `#sheet` modalni list, `#wizard`, `#tabbar` |
| `api/*.js` | 9 funkcija, 3 733 linije |
| `supabase/*.sql` | 13 fajlova (RLS, RPC, okidači, pogledi), nema migracionog alata — puštaju se ručno u SQL Editoru |
| testovi | 55 fajlova, **1 553 testa, svi prolaze, 48 s** (`node --test "test/**/*.test.mjs"`, Node 22.22). Bez zavisnosti, `node:vm` harness |
| verzija | `APP_VERSION='282'` u `app.js` **i** `sw.js`, nameće `test/sw-azuriranje.test.mjs` |

## 2. Struktura repozitorijuma

```
/                       statički sajt, bez build koraka
├─ index.html           markup + sav CSS (inline, dozvoljeno CSP-om: style-src 'unsafe-inline')
├─ app.js               CEO frontend (generator, VDOT, UI, sync, Strava, icu, push, SW update)
├─ sw.js, sw-reg.js     service worker (cache + push + sync + periodicsync) i njegova registracija
├─ manifest.json        PWA manifest (id "/", scope "./", shortcuts ?tab=plan|opor|pred)
├─ privacy.html, uputstvo.html   statične stranice (privacy#brisanje je javna adresa za Google Play)
├─ sub20.apk            potpisan Android TWA paket, u repou; test/android-paket.test.mjs ga proverava
├─ .well-known/assetlinks.json   Digital Asset Links — BEZ njega TWA gubi pun ekran
├─ api/*.js             9 Vercel serverless funkcija (ESM, bez package.json u rootu)
├─ supabase/*.sql       šema, RLS, RPC — ručno puštanje
├─ scripts/vapid.mjs    jednokratni generator VAPID ključeva
├─ test/                node:test + vm harness (test/package.json je namerno odvojen od roota)
└─ vercel.json, .vercelignore, .github/workflows/test.yml
```

## 3. Frontend (stanje)

**Model izvršavanja.** `app.js` je jedna klasična skripta; sve je globalno. Uvodni ekran (`uvodniEkran`) je IIFE na vrhu. `index.html` ne sadrži nijednu skriptu osim `sw-reg.js` i `app.js` — to je namerno zbog CSP-a (`script-src 'self'`), v. §6.

**Navigacija.** 5 tabova (`data-pg`): `danas`, `plan`, `opor`, `pred` (Trka), `zajed`; Podešavanja su modalni list otvoren zupčanikom (`openSettings`). `setPage()` + prevlačenje između tabova (`pv*`, ~270 linija) + ambijentalno svetlo po tabu. Deep-link `?tab=` iz manifest shortcuts i `otvoriIzAdrese()` (otvara dan iz push obaveštenja).

**Globalno stanje.** Jedan objekat `S` (schema v11). Polja (broj čitanja u `app.js` u zagradi):

| Polje | Sadržaj | Napomena |
|---|---|---|
| `v` | verzija šeme (=11) | `migrate()` odbija novije (`o.v>SCHEMA → null`) |
| `log` (97) | dnevnik treninga po ID-u dana: `status`, `km`, `sec`, `runDate`, `aiAt`, `autoOdbijen`, … | ključevi `n…` (lični plan) i `g…` (generisan) |
| `genPlan` (78) | `{weeks, pred, qs, meta, ulaz}` — generisan plan; `ulaz` = ulaz generatora (potreban za promenu cilja) | `null` → aktivan hardkodovan lični plan |
| `alts` (51) | ručne izmene dana (tip/km/opis/pace/rw/snaga), `paceAuto` razlikuje auto od ručnog | validira `cistAlts` |
| `moves` (28) | zamene dana (swap) | |
| `pred`, `predLock` (32, 12) | uneti tempi po PRED redu, i zaključavanje | |
| `vdotLog` (46) | lanac forme: `{id, ts, measured, prev, vdot, delta, alpha}` | **čista funkcija izmerenih vrednosti** (`preracunajVdotLog`) |
| `t3k` | testovi na 3 km, nezavisni od plana | |
| `knee`, `kg` (27, 28) | zapisi o bolu (mapa tela), telesna masa | polje se zove `knee` iako je opšta mapa tela — **naziv ostaje** (data contract) |
| `wellness` (18) | HRV, puls u miru, san, CTL/ATL iz intervals.icu | validira `cistWellness` |
| `strava`, `icu` (41, 66) | OAuth tokeni | **nikad u backup/export** (`backupPayload`) |
| `vreme` | keš prognoze | |
| `vanPlana` | km pre početka plana (za ACWR) | |
| `zajed` | `{vidljiv, nadimak}` | `vidljiv:false` je jedino ispravno početno stanje |
| `ui` (58) | `firstRun, lastBackup, snooze, seenWeek, geo, satTreninga, novo` | |

**Persistencija.** `localStorage` (provereno u kodu): `sub19-v1` (stanje), `sub19-v1-osteceno` (spasilačka kopija oštećenog stanja), `sub19_sb` (Supabase sesija — namerno odvojena da je uvoz backupa ne pregazi), `sub19_sb_state` (OAuth state/nonce), `sub19_sb_nonce_ok`, `sub19_st_state` (Strava OAuth state), `sub19-icu-state` (icu OAuth state), `sub19-tab` (poslednji tab); `sessionStorage` `sub20-uvod`; IndexedDB baza `sub19`, store `red` (jedini kanal ka service workeru). **Ova imena su deo data contract-a** — novi frontend ih mora koristiti nepromenjena, inače postojeći korisnici ostaju bez sesije i stanja.

**Hardkodovan lični plan.** `PLAN`/`PRED`/`LICNI` (linije 40–418) su vlasnikov polumaraton (Bokeški, 13.12.2026, cilj ispod 1:40). Aktivan je kad `S.genPlan===null`. Vlasnik se prepoznaje po `ADMIN_UID` u kodu (samo za prikaz dugmadi; prava provera je na serveru). Ostalima se plan nameće kroz čarobnjaka (`moraSvojPlan`). **Ovo je funkcionalnost koja se ne sme izgubiti** (v. `docs/FEATURE_INVENTORY.md` F-27).

## 4. Backend

9 Vercel funkcija; Hobby plan dozvoljava **najviše 12** — trinaesta obara ceo deploy (zato su `icu.js`, `auth.js` spajane po `sta`/metodi). Detalji i ugovori: `docs/API_INVENTORY.md`.

Zajedničke osobine: JWT provera ugrađena u svaki fajl (`requireUser`, **namerno kopirana u 7 fajlova** (`analyze, auth, delete-account, icu-oauth, icu, push, report-bug`; `broadcast` i `daily-report` koriste `CRON_SECRET`/vlasničku proveru), `test/requireuser-kopije.test.mjs` drži da se ne razilaze) jer uvoz zajedničkog modula je jednom oborio deploy (nema build koraka); izlazni `fetchRok` sa rokom ispod `maxDuration`; kratkotrajan keš potvrđenih tokena (30 s); dnevni limiti kroz Postgres RPC (`check_and_bump_*`).

Cron (`vercel.json`): `/api/daily-report` 05:00 UTC, `/api/push` 04:00 UTC, oba sa `CRON_SECRET`.

## 5. Supabase

Projekat ostaje isti. Klijent je **anon (publishable) ključ + korisnikov JWT**; service-role se koristi samo u `api/daily-report.js`, `api/delete-account.js`, `api/broadcast.js`, `api/push.js` (v. API_INVENTORY).

| Objekat | Svrha | Pristup sa klijenta |
|---|---|---|
| `user_state` (PK `user_id`, `data jsonb`, `device_id`, `app_version`, `updated_at`, `created_at`) | **CELO stanje korisnika kao jedan JSON blob** | GET `?select=data,updated_at`, POST `Prefer: resolution=merge-duplicates` |
| `user_state_istorija` + okidač `user_state_zapamti` | server-side verzije stanja (vraćanje iz istorije) | GET (RLS select) |
| `zajednica_profil`, `zajednica_izazov` | javni profil/izazovi zajednice | GET/POST/PATCH/DELETE, RLS |
| `ai_posao` + RPC `ai_posao_nov/prelaz/dodirni` | asinhroni AI poslovi (pokreni → radi → pročitaj) | preko `/api/analyze` |
| `push_pretplata` | Web Push uređaji | preko `/api/push` |
| `api_usage`, `bug_report_usage`, `endpoint_usage` + `check_and_bump_*` | brojači/limiti | samo preko RPC-a, nema delete politike |
| `nalog_za_brisanje`, `obrisi_naloge` | odloženo brisanje naloga | admin |
| `app_stats` (pogled) | agregat za dnevni izveštaj | service-role |

Auth: **samo Google OAuth**, JWT važi **900 s** (podešavanje u Supabase kontrolnoj tabli, v. `supabase/podesavanja.md`; `privacy.html` navodi isti broj, test ga drži). Redirect URL mora dozvoliti upit (`?sbn=` nonce).

**Sinhronizacija je last-write-wins sa detekcijom sukoba**, ne merge: pre svakog upisa čita se `updated_at`+`device_id`; ako je tuđ uređaj noviji od `SB.seenAt`, upis se **odbija** i podiže se traka sa izborom (`prikaziSukobSync`). Odloženi upis 4 s posle `save()`; neuspeh 5xx/mreža → Background Sync u SW-u. `UCITAVANJE_PALO` i `SB_SUKOB` blokiraju push. **Ovo je najopasniji deo za rewrite**: greška ovde briše korisniku podatke bez poruke. Zahteva zasebne testove pre ikakvog pisanja u `user_state` iz novog koda (v. REWRITE_PLAN, Phase 5 gate).

## 6. Bezbednosni model (stanje)

- CSP (`vercel.json`): `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://*.googleusercontent.com; connect-src 'self' https://*.supabase.co https://www.strava.com https://api.open-meteo.com; frame-ancestors 'none'; base-uri 'none'; form-action 'self'; object-src 'none'`. Posledica za Vite: **nema inline skripti**, `modulepreload` polyfill i dev-injektovani inline kod ne smeju u produkcijski build; `connect-src` ne dozvoljava ništa novo (npr. Sentry, CDN).
- XSS: ranjivi HTML putevi su `innerHTML` šabloni; odbrana u dva sloja — validacija ulaza (`validanId`, `cistWellness`, `cistVdotLog`, `cistAlts`, `cistDatirane`, `validanGenPlan`, `losIdUStanju`) **i** `esc()` na svakoj interpolaciji. React eliminiše drugi sloj za većinu mesta, ali **prvi sloj (validacija uvoza/sync-a) mora preživeti u Zod šemama**, jer podaci iz `user_state` stižu iz proizvoljnog JSON-a.
- Tokeni (Supabase sesija, Strava, icu) su u `localStorage`; backup ih izostavlja. CSP je jedini sloj protiv krađe — ostaje `script-src 'self'`.
- OAuth `state`/nonce klijentski (`stravaMakeState`, `icuMakeState`, `sbMakeState` + `sbn`).
- Vlasničke putanje (`broadcast`, `push objava`, brisanje/zabrana naloga): `ADMIN_EMAIL` + potvrđena adresa + `ADMIN_2FA`.
- Rate limiti po korisniku u bazi; vlasnik ima podignut (ne ukinut) limit da bi brojač ostao tačan.

## 7. PWA / service worker (stanje)

- `CACHE='sub19-cache-v282'`, `ASSETS` fiksan spisak (`./`, `index.html`, `app.js`, `sw-reg.js`, `manifest.json`, ikone). **Network-first sa trkom 3,5 s** (`MREZA_ROK.ms`): mreža gubi → keš. `/api/*` i `strava.com` nikad iz keša; tuđi domeni se ne presreću (v220).
- Update tok: novi SW **ne** radi `skipWaiting` pri instalaciji; čeka poruku `SKIP_WAITING` (klik „Osveži" na baneru). `VERSION` poruka vraća šta SW *stvarno* nosi (različito od `APP_VERSION` iz `app.js` koji ide network-first).
- Instalacija tolerantna: `Promise.allSettled(ASSETS.map(add))`, ne `addAll`.
- Push (`push`, `notificationclick`, `pushsubscriptionchange`), `sync` (odloženi upis stanja iz IDB), `periodicsync` (dnevna provera). SW čita IDB `sub19/red`.
- `sw-reg.js` je zaseban sićušan fajl da se SW registruje pre nego što se skine 327 KB.
- `manifest.json` `id:"/"`, `scope:"./"`, ikone `any`/`maskable`/`monochrome`, 4 screenshota, 3 shortcuta.

**Posledice za cutover (v. §10, rizik R2).**

## 8. Android (TWA)

`sub20.apk` je u repou i testira ga `android-paket.test.mjs` (adresa, ime, paket, otisci ključa). Sa Digital Asset Links iz `.well-known/assetlinks.json` TWA se oslanja na **isti origin i scope `/`**. Rewrite ne sme menjati origin, `start_url`, `scope`, ni putanju `.well-known`. Sadržaj APK-a nije analiziran u ovom auditu (**nedovoljno dokaza**).

## 9. Testovi kao specifikacija

Harness (`test/harness.mjs`, obrisan u Phase 12 — commit `b7afc41`) učitava `app.js` u `node:vm` sa lažnim DOM-om i izlaže `app.call(fn, …)`, `app.get(const)`, `app.evalIn(expr)`. Testovi su **vezani za imena funkcija i globala iz `app.js`** — kad se `app.js` obriše, ~55 fajlova gubi svoj subjekat. Zato je strategija u REWRITE_PLAN: **legacy harness ostaje u repou kao „oracle"** do kraja parity faze; stari testovi se ne brišu dok svaka njihova invarijanta nema TS pandan (mapa u `docs/TRAINING_ENGINE_AUDIT.md` §9 i `docs/REWRITE_PLAN.md` §6).

Kategorije (broj testova): API/serverski (`api.test` 173, `push` 63, `icu-treninzi` 66), bezbednost (66+), stanje/migracija (71), zajednica (71), zone pulsa (57), generator (21 + otisak 2 + simetrija 11 + deload 11 + račun 3), VDOT/forma (20 + 15 + 19), povreda/opterećenje (17 + 12 + 7), test na 3 km (39), SW (24), dosledenost/CSP/a11y (49), ostalo. Tačna mapa: REWRITE_PLAN §6.

## 10. Nalazi audita (rizici i defekti)

| ID | Nalaz | Ozbiljnost | Šta sa tim |
|---|---|---|---|
| R1 | **Deploy nema build korak i nema `package.json` u rootu** — namerno (dokumentovano u `test/README.md`, `api/*.js`). Vite traži build. Dodavanje root `package.json` menja kako Vercel tretira projekat i **može oboriti `api/*.js`** (ESM `export default` bez `"type"`). | Visoka | Novi frontend ide u `web/` sa sopstvenim `package.json`; root se ne dira do cutover-a; `web/` ide u `.vercelignore` dok se ne prebaci. Cutover = `buildCommand`/`outputDirectory` u `vercel.json` **proveren na Vercel preview deploy-u** pre produkcije. |
| R2 | Stari SW (`sub19-cache-v282`) kontroliše postojeće korisnike. Posle cutover-a `index.html` i `app.js` nestaju/menjaju se; stari SW je network-first za `./`, pa će dobiti novi `index.html`, ali novi SW čeka `SKIP_WAITING`. Rizik: novi bundle pod starim SW-om, ili `app.js` iz keša. | Visoka | Novi `sw.js` na istom URL-u; novi frontend pri startu detektuje `waiting` worker i šalje `SKIP_WAITING` (jednokratno za prelaz); zadržati `/app.js` kao mali „tombstone" koji deregistruje stari kod; E2E test „update sa v282". |
| R3 | **Ceo korisnički state je jedan JSON blob sa last-write-wins.** Novi klijent koji upiše drugačiji oblik, ili stariji klijent koji pročita novi, gubi/kvari podatke. Starija verzija aplikacije ostaje instalirana na drugim uređajima. | Visoka | Rewrite **čita i piše tačno SCHEMA 11** (bez promene oblika, bez novih obaveznih polja). Zod šema se izvodi iz `migrate()` i `cist*`. Novo polje samo uz bump SCHEMA i unazad kompatibilno čitanje. |
| R4 | Sync protokol (sukob, `SB_BUSY/SB_PONOVO`, `UCITAVANJE_PALO`, background sync, IDB red) je izgrađen nizom ispravki grešaka; komentari opisuju gubitak podataka na više mesta. | Visoka | Portovati kao samostalan modul `services/sync` sa testovima iz `state.test.mjs`, `istorija.test.mjs`, `mreza-rok.test.mjs`, `sw-azuriranje.test.mjs` **pre** nego što novi UI sme da piše na server. |
| R5 | `ID_OBLIK`/`r1`/`validanId` „temporal dead zone" — tri puta je aplikacija ostajala prazna jer je `const` korišćen u `migrate()` pre deklaracije. | Srednja | U ES modulima ovo postaje greška pri učitavanju (lakše za uhvatiti); testovi „hladan start sa zapisanim t3k" se prenose. |
| R6 | Dva izvora istine za plan: hardkodovan `PLAN` (ID-jevi `n…`) i generisan (`g…`); `S.log` oba prostora. Sav kod ima `BY_ID`/`CUR_PLAN` dvojnost i mutira `d.date`/`d.week` na klonovima (`rebuildDateIndex`). | Srednja | U novom kodu plan je **nepromenljiv** (immutable) + izvedeni selektori; dan sa efektivnim datumom/izmenama se računa (`resolveDay(plan, overlay)`), ne mutira. |
| R7 | `recalibratedPlan` i `reentryPlan` **nisu pozvani iz UI-ja** (samo iz testova; komentar u kodu: „Funkcija se (još) ne poziva iz UI-ja"). Žive, testirane, ali mrtve u produkciji. | Niska | Portovati u domen (testovi postoje), **ne** povezivati u UI bez odluke vlasnika. Dokumentovano u TRAINING_ENGINE_AUDIT §8. |
| R8 | Strava: **token ide iz pregledača direktno na `strava.com/api/v3`** (CSP `connect-src` to dozvoljava); server samo menja kod/refresh. icu ide preko servera (CORS). | Informativno | Zadržati; izolovati u `services/strava`. Ne premeštati pozive na server (promena modela, nije traženo). |
| R9 | Zajednica čita/piše **direktno u PostgREST** sa klijenta; RLS je jedina zaštita. | Informativno | RLS se ne dira. Svaki novi upit mora biti ekvivalentan postojećim (`zajUcitaj`, `zajUpisi`). |
| R10 | `STRAVA_CLIENT_ID='259960'` i Supabase `sb_publishable_…` ključ su u klijentskom kodu. Oba su javna po dizajnu (publishable/OAuth client id). | Informativno | Premestiti u `import.meta.env` (`VITE_*`) sa istim vrednostima; **ne** menjati. |
| R11 | `README`/komentari tvrde „bez zavisnosti, bez build-a" — to je vrednost projekta koju rewrite svesno menja. Svaka dependency mora imati razlog (REWRITE_PLAN §3). | Informativno | |
| R12 | **Ugovori o privatnosti su u kodu, ne u šemi:** `sbPayload` izostavlja tokene (Strava, icu) i koordinate (`S.ui.geo`, `S.vreme`) iz `user_state.data`; `primiStanjeSaServera` pri povlačenju **zadržava** lokalna polja. `privacy.html` to obećava. Novi klijent koji upiše ceo `PersistedState` na server prekršio bi to bez ijedne greške. | Visoka | `services/sync` ima jedini `toServerPayload()`; test koji proverava da nijedan token/koordinata ne izlazi (preuzeto iz `state.test`/`bezbednost.test`). |

## 11. Ciljna arhitektura (sažetak)

Detalji, redosled i kapije su u `docs/REWRITE_PLAN.md`. Ukratko: `web/` (Vite + React 19 + TypeScript strict), `src/domain/**` čisti TS (bez DOM-a), `src/services/**` (api/supabase/strava/sync/push/sw), `src/stores/**` Zustand, `src/features/**`, `src/components/ui/**`. Backend, Supabase, domen, Vercel projekat: **nepromenjeni**.

## 12. Kako je izgrađeno (as-built, 2026-10-02)

Ovaj odeljak opisuje izgrađeno stanje: slojevi i domen su sa grane `claude/sub20-frontend-rewrite-q6dlvr`, a folderi `features/`, `components/`, `styles/` i opis interfejsa ispod su ažurirani 2026-10-09 prema grani `claude/quiet-athlete`. §1–11 su audit starog stanja. Pun izveštaj: `REWRITE_REPORT.md` (istorijski zapis), faze i brojke: `docs/REWRITE_STATUS.md`.

**Slojevi** (zavisnost samo nadole; ESLint + `domain/isolation.test.ts`): `domain` (čist TS) → `stores` (Zustand, jedan persist po akciji) → `services` (`Result`, Zod na granici) → `app` (koren kompozicije `createApp`) → `features` / `components`.

```
web/src/
  domain/      activities ai community date day format icu lib onboarding personal plan push race recovery
               settings shell state sync training{adaptation,constants,distances,generator,prediction,sessions,test3k,vdot}
               watch weather zones
  services/    ai api community icu push race storage strava supabase sync weather + http oauth streams config
  stores/      training recovery settings sync auth community ui owner + *Actions
  app/         createApp integrations community useSwipeNav useToday tabs navHistory confirm useSystemBanners
  features/    today day session plan progress race recovery ti onboarding cycle + registry screens sheets
  components/ui  Shell Sheet primitives icons Disclosure Badge Num SessionProfile BannerHost ConfirmHost
  lib/         theme useTheme auth clock copy dates download geo
  styles/      tokens base ui shell screens charts wizard (.css) + fonts/ (Figtree, self-hosted)
  pwa/         SW registracija, ažuriranje, offline, uvodni ekran
  data/        personalPlan (generisano iz starog PLAN/PRED/QS)
web/sw/sw.js   telo starog sw.js; verzija i spisak se ubacuju pri izgradnji
```

**Interfejs („Quiet Athlete").**
- Četiri taba: Danas · Plan · Napredak · Ti (`stores/uiStore.ts`, `features/registry.tsx`). Zajednica nema taba ni ekrana (`features/community/` i `features/settings/` ne postoje); modalni list „Podešavanja" pod zupčanikom je zamenjen tabom Ti (`features/ti/`).
- Ekran se otvara iznad taba (`uiStore.screens`, `openScreen`; registar `features/screens.tsx`) sa dugmetom „Nazad"; mala izmena je list odozdo (`features/sheets.tsx`, `components/ui/Sheet.tsx`). Sistemski taster „Nazad" zatvara list pa ekran (`app/navHistory.ts`); aplikacija nema rute, adresa se ne menja.
- Detalji treninga (`features/day/DayScreen.tsx`) su jedino mesto za dan: zamenjuju raniji list dana i kartice na Danas. Plan prikazuje jednu nedelju; ceo plan je ekran „Pregled celog plana", izmene plana su ekran „Prilagodi plan" (`features/plan/`). Forma i predikcija, Oporavak, Bol, Telesna masa i Analiza trke su ekrani iz tab-a Napredak (`features/progress/`, `race/`, `recovery/`).
- Deep link `?tab=`: `opor` → Napredak + Oporavak, `pred` → Napredak + Forma i predikcija, nepoznata vrednost → Danas (`app/tabs.ts`). Obaveštenje `?dan=<id>` otvara Detalje treninga.
- Stil: tokeni (boje, razmak, font Figtree) u `styles/tokens.css`, svetla i tamna tema. Izbor teme (Prati sistem / Svetla / Tamna) je po uređaju u `localStorage` ključu `sub20-tema` (`lib/theme.ts`, `web/public/tema.js`); ne sinhronizuje se i ne menja SCHEMA 11.
- Zajednica: `COMMUNITY_ENABLED = false` (`services/config.ts`); kod iza prekidača ostaje (`domain/community`, `services/community`, `stores/communityStore.ts`, `app/community.ts`), UI ne. Pri pokretanju `withdrawIfDisabled` povlači ranije objavljen red.
- Gde je koja funkcija u UI-ju: `docs/FEATURE_INVENTORY.md`, odeljak H.

**Aktivni plan.** `activeOf(state, isOwner)` = pravi `genPlan`, a ako ga nema i `personalVisible` (vlasnik, ili nalog sa `n*` unosima u statusu done/skip) — ugrađeni lični plan. Samo za čitanje; upisi idu u pravi `genPlan`, koji za lični plan ostaje `null`, pa se oblik stanja v11 i `user_state` na serveru ne menjaju. (Zatvara F-27 iz `FEATURE_INVENTORY`.)

**Strategija testova.** Četiri Vitest projekta (`domain`, `oracle`, `node`, `ui`) + Playwright. *Oracle* testovi (`*.oracle.test.ts`) učitavaju stari `app.js` u `node:vm` (`src/test/legacyOracle.ts`) i porede izlaze za iste ulaze; namerne razlike su jedino u `docs/ENGINE_CHANGES.md`. Stari `test/*.test.mjs` ostaju netaknuti do Phase 12.

**Stanje posle Phase 12 (2026-10-02):** produkcija servira `web/dist`; stari frontend (`app.js`, `index.html`, `sw.js`, `sw-reg.js`) je obrisan — poslednji commit na kome postoji je `b7afc41`. §1–11 iznad opisuju stanje PRE rewrite-a. Statika (`manifest.json`, ikone, `privacy.html`, `uputstvo.html`, `.well-known/assetlinks.json`, `sub20.apk`) živi u `web/public/`. `test/` drži testove backenda i konfiguracije (388); frontend testovi su u `web/`.

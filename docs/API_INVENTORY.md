# API INVENTORY

Sve što novi frontend sme da pozove, i pod kojim uslovima. **Nijedan endpoint, tabela ni politika se ne menja rewrite-om.**
Izvor: `api/*.js`, `supabase/*.sql`, pozivi u `app.js`/`sw.js`. „Nedovoljno dokaza" = telo handlera nije pročitano u ovom auditu; pročitati pre portovanja tog klijenta (kolona *Pročitano*).
Novi frontend poziva ovo isključivo kroz `src/services/api/*` (nikad `fetch` iz komponenti).

## 1. Vercel funkcije (`/api/*`)

Zajedničko: izlazni rok ispod `maxDuration`; JWT (`Authorization: Bearer <supabase access token>`) proverava se kod Supabase-a (`/auth/v1/user`), potvrđeni token se kešira 30 s u instanci; greške su JSON `{error}`. Hobby plan: **max 12 funkcija** (sada 9).

| Endpoint | Metoda / grana | Auth | Telo / upit | Odgovor | Upstream | Limit | Klijent (stari) | Novi modul | Pročitano |
|---|---|---|---|---|---|---|---|---|---|
| `/api/analyze` | POST `{posao:'start'}` | JWT | — | `{posaoId}` | Supabase RPC `ai_posao_nov` | dnevni 30 (`check_and_bump_api_usage`), vlasnik 100000 | `aiPozovi`, `aiProveri` | `aiApi.start` | ✔ handler |
| | POST `{posao:'radi', posaoId, session, entered, goalCtx, hrZones, hrZonesIzvor}` | JWT | `session`, `entered` obavezni | rezultat/`ai_posao` red | Gemini (`GEMINI_API_KEY`) | ne troši brojač (nastavak izbrojanog posla), samo uz ispravan UUID | `aiPozovi` | `aiApi.run` | ✔ delom |
| | POST `{posao:'citaj', posaoId}` | JWT | UUID | red `ai_posao` | Supabase | 1500/dan (`analyze_citaj`) | `aiSacekaj` (anketa 3 s do ~90 s) | `aiApi.poll` | ✔ |
| | POST `{trend:{…}, goalCtx, hrZones}` | JWT | **ne sme** uz `posao` (400) | trend analiza u istom odgovoru | Gemini | 30/dan | `renderPred` trend | `aiApi.trend` | ✔ delom |
| `/api/auth` | GET `?code=` | JWT | Strava `code` (hex) | Strava token odgovor (tačna polja: nedovoljno dokaza, pročitati `api/auth.js` pre porta) | `strava.com/oauth/token` (`STRAVA_CLIENT_SECRET`) | — | `handleOAuthReturn` | `stravaApi.exchange` | ✔ zaglavlje |
| | POST `{refresh_token}` | JWT | | novi tokeni | Strava | — | `ensureToken` | `stravaApi.refresh` | ✔ zaglavlje |
| `/api/icu-oauth` | GET `?akcija=url&state=` | JWT | OAuth `state` | `{url}` | — (gradi URL) | — | `icuConnect` | `icuApi.authUrl` | ✔ |
| | POST `{code}` | JWT | | `{athleteId, token, scope}` | `intervals.icu/api/oauth/token` | — | `icuFinish` | `icuApi.exchange` | ✔ |
| `/api/icu` | POST `{sta:'wellness', athleteId, token\|apiKey, oldest, newest}` | JWT | | HRV, RHR, san, CTL/ATL | intervals.icu | 100/dan | `icuSync` | `icuApi.wellness` | ✔ klijent |
| | POST `{sta:'activities', athleteId, …, oldest, newest \| detalji[ids] \| tokovi[ids]}` | JWT | | aktivnosti, krugovi, tokovi | intervals.icu | 200/dan | `icuSyncTreninzi` | `icuApi.activities` | ✔ klijent |
| | POST `{sta:'workouts', athleteId, …, events[]}` | JWT | | zakazani treninzi na kalendaru | intervals.icu | 40/dan | `icuPosalji` | `icuApi.pushWorkouts` | ✔ klijent |
| | POST `{sta:'zone', athleteId, …}` | JWT | | granice zona pulsa | intervals.icu | 20/dan | `icuZoneSync` | `icuApi.zones` | ✔ klijent |
| `/api/push` | GET (bez zaglavlja) | — | | `{podeseno, kljuc}` (VAPID javni ključ) | — | — | `pushVapid` | `pushApi.vapid` | ✔ zaglavlje |
| | POST `{akcija:'prijava', pretplata, najave}` / `odjava` / `najave` / `proba` | JWT | | `{ok…}` | Supabase `push_pretplata`, push servisi | — | `pushPosalji` | `pushApi.*` | ✔ zaglavlje |
| | POST `{akcija:'posalji', userId,…}` | `CRON_SECRET` | | | | | server-server | — | ✔ |
| | POST `{akcija:'objava', objava, posalji}` | vlasnik JWT | | | | | `openSettings` (admin) | `pushApi.broadcast` | ✔ |
| | GET `Authorization: CRON_SECRET` | Vercel Cron 04:00 UTC | | jutarnji podsetnik | Supabase service-role | — | — | — | ✔ |
| `/api/broadcast` | POST `{admin:true, …}` | **vlasnik** (`ADMIN_EMAIL` + potvrđena adresa), 404 za ostale | admin akcije (spisak korisnika, brisanje/zabrana — traže `ADMIN_2FA`) | | Supabase service-role + Auth admin | brojač razornih radnji po korisniku | `ucitajKorisnike`, `ucitajZakazana`, `openKorisniciSheet` | `adminApi.*` (feature-gated) | ✔ delom; **nedovoljno dokaza** za listu admin akcija |
| | POST `{poruka, posalji, samoNa}` | `CRON_SECRET` ili vlasnik | | mejl svim korisnicima (Resend), svaki posebno | Resend | | `posaljiUputstvo` | `adminApi.broadcast` | ✔ |
| `/api/daily-report` | GET | `CRON_SECRET` (Vercel Cron 05:00 UTC) | | mejl vlasniku | Supabase service-role, Resend | — | — (samo cron) | — | ✔ zaglavlje |
| `/api/delete-account` | POST `{potvrda:'OBRISI'}` (case/dijakritika neosetljivo) | JWT, `Content-Type: application/json` obavezan | | `{ok, obrisano[]}` | Supabase service-role (DELETE redova pa `auth/v1/admin/users/<id>`) | — | `openObrisiNalogSheet` | `accountApi.delete` | ✔ |
| `/api/report-bug` | POST `{description≤3000, context:{version,tab,userAgent}}` | JWT | | `{ok}` | Resend | 10/dan (`bug_report_usage`) | `openBugSheet` | `supportApi.reportBug` | ✔ |

**Brisanje naloga**: redosled je nosiv (prvo podaci, tek pa nalog; ako podaci ne odu, nalog se ne briše). Isti redosled mora ostati u UI-ju (poruke za delimičan ishod). Javna adresa `privacy.html#brisanje` se ne dira.

## 2. Supabase direktno sa klijenta

URL i publishable ključ su u `app.js` (`SB_URL`, `SB_ANON`) → u novom kodu `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` **sa istim vrednostima**. Ključ je javan po dizajnu; **service-role ključ nikad u frontendu.**

| Poziv | Tabela / endpoint | Svrha | Napomena |
|---|---|---|---|
| `GET /auth/v1/authorize?provider=google&redirect_to=…?sbn=<nonce>` | Supabase Auth | prijava | nonce u povratnoj adresi, ne u `state` |
| povratak: `#access_token=…&refresh_token=…` (hash) | | | `sbParseHash`, `sbCheckState`, `sbNonceRadi` |
| `POST /auth/v1/token?grant_type=refresh_token` | Auth | osvežavanje | **jednom** i za konkurentne pozive (rotacija refresh tokena); osvežava se minut pre isteka |
| `GET /auth/v1/user` | Auth | provera sesije | `sbProveriSesiju`; sesiju obara **samo izričito odbijanje** (401/403), ne mrežna greška |
| `GET /rest/v1/user_state?select=updated_at,device_id&user_id=eq.<uid>` | `user_state` | provera sukoba | `undefined` (nema signala) ≠ `null` (nema reda) |
| `GET /rest/v1/user_state?select=data,updated_at…` | `user_state` | povlačenje | `sbPull`, `primiStanjeSaServera` (zadržava lokalna polja: tokeni, geo, vreme) |
| `POST /rest/v1/user_state` `Prefer: resolution=merge-duplicates,return=representation`, telo `{user_id, data, device_id, app_version}` | `user_state` | upis | `sbPayload` izostavlja tokene i koordinate |
| `GET /rest/v1/user_state_istorija?…` | `user_state_istorija` | prikaz/vraćanje ranijih verzija | RLS select |
| `/rest/v1/zajednica_profil` (čitanje, upis, brisanje — tačne metode: pročitati `zajUcitaj/zajUpisi/zajObrisi`) | `zajednica_profil` | javni profil | RLS; `vidljiv:false` podrazumevano |
| `GET /rest/v1/zajednica_izazov` | `zajednica_izazov` | izazovi | RLS select |
| RPC (serverski, ne sa klijenta) | `check_and_bump_*`, `ai_posao_*` | limiti, AI posao | poziva ih `/api/*` sa korisnikovim JWT-om |

**Zajednica je ugašena** (`COMMUNITY_ENABLED = false` u `services/config.ts`; nema taba ni ekrana): klijent ne čita `zajednica_profil` ni `zajednica_izazov` i ne upisuje u `zajednica_profil`. Jedini poziv je DELETE nad `zajednica_profil` za sopstveni `user_id` pri pokretanju (`withdrawIfDisabled` u `app/community.ts`), i to samo ako je nalog ranije bio vidljiv. Dva reda o Zajednici iznad opisuju kod iza prekidača (`services/community/communityApi.ts`).

**Ugovori o privatnosti koji su deo koda i moraju preživeti** (`privacy.html` ih obećava):
1. Tokeni (Strava, intervals.icu) **ne idu** na server niti u backup (`sbPayload`, `backupPayload`).
2. Koordinate (`S.ui.geo`, `S.vreme`) **ne idu** na server; pri povlačenju sa servera lokalna vrednost se **zadržava**.
3. Zajednica: `vidljiv:false` podrazumevano; plan i istorija su lični.
4. `ADMIN_UID` u kodu odlučuje samo o prikazu dugmadi; stvarna provera je serverska.

## 3. Treće strane iz pregledača (CSP `connect-src`)

| Servis | Poziv | Auth | Napomena |
|---|---|---|---|
| Strava `https://www.strava.com/api/v3/…` | `stApi`, `stravaSync` | korisnikov access token iz `S.strava` | **direktno iz pregledača**; refresh preko `/api/auth`; SW ne presreće (`strava.com` → uvek mreža) |
| Open-Meteo `https://api.open-meteo.com/…` | `vremePovuci` | bez ključa | namerno iz pregledača da koordinate ne prolaze kroz server; keš 3 h i po koordinatama (`S.vreme`) |
| Google (slika profila) `*.googleusercontent.com` | `<img>` | — | `img-src` u CSP-u |

Novi izvori (Sentry, fontovi, CDN…) **ne smeju** bez izmene CSP-a (`vercel.json`), a to je bezbednosna odluka, ne tehnička.

## 4. Service worker kanal

IndexedDB `sub19` / store `red`: aplikacija upisuje (nalog, token, neposlato stanje, VAPID), SW čita pri `sync`/`periodicsync`/`push`. Poruke `SKIP_WAITING`, `VERSION` (SW→klijent: `{version, cache}`), `PUSH` (SW→klijent). Background upis stanja (`guraniStanje`) ponavlja istu proveru sukoba kao `sbPush`.

## 5. Vercel okruženje (samo imena; v. `supabase/podesavanja.md`)

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, `ADMIN_EMAIL`/`REPORT_TO`, `ADMIN_2FA`, `RESEND_API_KEY`, `REPORT_FROM`, `GEMINI_API_KEY`, `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET`, `ICU_CLIENT_ID`, `ICU_CLIENT_SECRET`, `ICU_REDIRECT_URI`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `VERCEL_URL`/`VERCEL_PROJECT_PRODUCTION_URL`, `SAMA_ADRESA`, `BROADCAST_*`.
**Frontend build promenljive** (`VITE_*`) su nove i **javne** — smeju sadržati samo ono što je već javno u `app.js` (`STRAVA_CLIENT_ID`, Supabase URL + publishable ključ).

## 6. Tipizacija na granici (Zod)

Svaki odgovor iznad prolazi kroz Zod šemu u `services/api` pre nego što stigne do store-a. Prioritet (rizik × učestalost):
1. `user_state.data` → `PersistedStateSchema` (v11) — **kritično**, izvodi se iz `migrate()`, `cistWellness`, `cistVdotLog`, `cistAlts`, `cistDatirane`, `cistBrojPolje`, `validanGenPlan`, `losIdUStanju` (isti slučajevi odbijanja, isti testovi).
2. uvezeni backup — ista šema + `losIdUStanju` (XSS vektor kroz ID-jeve) + odbijanje `v > SCHEMA`.
3. Strava aktivnosti / krugovi, icu wellness/activities.
4. Open-Meteo `hourly` (`vremeCist`).
5. AI odgovor (`ai_posao` red) — tekst se renderuje kao tekst, **ne** kao HTML (stari kod: `mdToHtml` sa escape-om pre markdown-a; u Reactu se markdown renderuje bez `dangerouslySetInnerHTML`).
6. Zajednica profili (`zajCistProfil`).

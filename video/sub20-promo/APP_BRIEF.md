# APP_BRIEF — Sub-20 (iz koda, ne iz dokumentacije)

Proveravano na `main` @ `05088e0` (2026-10-17/18). Putanje su relativne na koren repoa.

## Šta aplikacija radi (jedna rečenica)

PWA koja iz tvog rezultata (VDOT po Danielsu) pravi plan za 5K/10K/polumaraton/maraton, svaki dan kaže šta i kojim tempom trčiš, uvozi odrađeno sa Strave / intervals.icu i iz HRV-a, sna i opterećenja kaže kad da usporiš.

## Ekrani (stvarno stanje)

Tabovi su **Danas · Plan · Napredak · Ti** (`web/src/stores/uiStore.ts:7`, `web/src/features/registry.tsx`, oznake u `web/src/components/ui/icons.tsx`).
**Tvoja pretpostavka „Danas, Plan, Oporavak, Trka, Zajednica" nije tačna:** Oporavak i Forma (bivša „Trka") su ekrani ispod taba Napredak; stari linkovi `?tab=opor|pred` samo preusmeravaju (`web/src/app/tabs.ts:17-20`). **Zajednica je isključena**: `COMMUNITY_ENABLED = false` (`web/src/services/config.ts:28`), nijedna komponenta je ne crta.

| Ekran | Šta prikazuje (ključni brojevi) | Fajl |
|---|---|---|
| Danas | trening dana: veliki broj km, naziv, „4× 60 s @ 3:55/km", „3:55 /km · oko 32 min", dugmad Detalji / Završi / Preskoči, „Ove nedelje X / Y km", upozorenja (npr. „Oporavak: olakšaj") | `web/src/features/today/index.tsx`, `TodayHero.tsx`, `Advisories.tsx` |
| Detalji treninga | ciljni tempo, distanca, trajanje, napor (RPE), struktura, unos; posle trčanja „Sa sata", „Po zonama", „Jutros" (HRV, puls u miru, san, svežina), „Radni deo — ostvaren tempo" | `web/src/features/day/DayScreen.tsx`, `web/src/features/today/WorkSegment.tsx`, `Cards.tsx` |
| Plan | „Tvoj plan", trka i datum, „Nedelja X od Y", faza, km nedelje, redovi dana sa stanjem; „Pomeri treninge", „Prilagodi plan", „Pošalji na sat" | `web/src/features/plan/index.tsx`, `DayRow.tsx` |
| Plan → Pregled celog plana | km po nedeljama (plan/ostvareno), faze BAZA–RAZVOJ–VRHUNAC–TAPER–TRKA | `web/src/features/plan/PlanOverview.tsx` |
| Napredak | km 4 nedelje, „Polazni/Potvrđen VDOT", „Procena · 5K", poslednja aktivnost, rekordi; redovi Forma i predikcija, Oporavak, Bol, Telesna masa, Analiza trke | `web/src/features/progress/index.tsx` |
| Napredak → Forma i predikcija | „Da li napredujem?", procena po distancama, VDOT kroz vreme, predikcija kroz plan, test 3 km | `web/src/features/race/FormScreen.tsx` |
| Napredak → Oporavak | „Stanje danas": Bez upozorenja / Pazi / Olakšaj / Skrati / Stani / Fizijatar; signali HRV, puls u miru, san, svežina, bol, opterećenje (akutno/hronično); grafikoni HRV i pulsa | `web/src/features/recovery/OporavakScreen.tsx`, `ReadinessCard.tsx` |
| Napredak → Analiza trke | kontekst trke, **„Prolazi po kilometru"** (Km, Tempo/km, Puls, Uspon/pad, Pauza), AI analiza trke | `web/src/features/race/RaceAnalysis.tsx`, `RaceData.tsx` |
| Ti | nalog, cilj, zone, povezani servisi, obaveštenja, izgled, privatnost | `web/src/features/ti/` |

## Funkcije koje su ušle u video (sa putanjama)

| Funkcija | Postoji | Gde |
|---|---|---|
| Plan iz rezultata preko VDOT-a (Daniels); Riegel za preračun tempa kvalitetne sesije u 5K ekvivalent i vremena između distanci | da | `web/src/domain/training/generator/generatePlan.ts`, `web/src/domain/training/vdot/calculateVDOT.ts` (`riegelTo5k`), `racePrediction.ts` (`riegelDist`) |
| Trening dana sa ciljnim tempom | da | `web/src/features/today/TodayHero.tsx` |
| Prolazi po kilometru posle trke (Strava / intervals.icu tokovi) | da | `web/src/features/race/RaceData.tsx`, `web/src/services/race/raceSync.ts` |
| Oporavak: HRV, puls u miru, san, svežina, akutno/hronično opterećenje | da | `web/src/features/recovery/OporavakScreen.tsx`, `web/src/domain/recovery/load.ts` (`acwrNow`), `web/src/domain/recovery/view.ts` (`acwrBand`) |

## Funkcije koje postoje, a nisu u videu

| Funkcija | Gde | Zašto nije |
|---|---|---|
| Strava OAuth + uvoz aktivnosti (pregledač zove Strava API direktno; server samo menja kod/refresh) | `api/auth.js`, `web/src/services/strava/stravaApi.ts`, `stravaSync.ts` | pomenuta samo kao izvor prolaza (napomena u sceni 10) |
| Izdvajanje radnog dela iz Strava tokova (k-means) → „Radni deo — ostvaren tempo" | `web/src/domain/activities/segments.ts` (`detectWorkSegments`), `web/src/features/today/WorkSegment.tsx` | **nema prikaza tempa po krugu**, samo jedan ukupan tempo radnog dela; tvoja scena „Svaki krug, svoj tempo" je zato zamenjena prolazima po kilometru |
| Adaptacija: lanac forme (VDOT), predlog tempa, „Preračunaj plan prema formi", predlog posle bola | `web/src/features/plan/AdjustPlan.tsx`, `useAdjustments.ts` | nema mesta u 50 s |
| intervals.icu (wellness: HRV, san, CTL/ATL; aktivnosti; zone) | `api/icu.js`, `web/src/services/icu/` | pomenut sitnim slovima u sceni 11 kao izvor HRV-a, sna i svežine |
| **„Pošalji na sat"** — planirani treninzi idu u intervals.icu kalendar (14 dana) | `api/icu.js` (`sta:'workouts'`), `web/src/features/ti/icuSections.tsx:306`, `web/src/features/plan/index.tsx:190` | **Ispravka:** tvoja lista „šta NE sme" kaže da push na sat ne postoji — **postoji**, preko intervals.icu. U video nije ušao po tvojoj zabrani |
| Web Push podsetnici, AI analiza treninga i trke, vreme (Open-Meteo), test 3 km, bol, telesna masa | `web/src/features/ti/pushSection.tsx`, `api/analyze.js`, `web/src/features/today/WeatherCard.tsx`, `web/src/features/race/T3kSheet.tsx`, `web/src/features/recovery/` | nema mesta |

## Šta NE postoji (i nije u videu)

- **Audio coaching**: nema `speechSynthesis` ni `new Audio(` u `web/src`.
- **GPS praćenje trčanja**: nema `watchPosition`; `getCurrentPosition` postoji samo za lokaciju prognoze vremena (`web/src/lib/geo.ts:24`).
- **Zajednica**: kod postoji, UI je isključen (v. gore).

## Brend

- Boje: `--accent #335e35`, `--bg #f6f7f5`, `--text #19251e` (`web/src/styles/tokens.css:38-59`); tamna tema `#8cc79a` (`:146`). Manifest: `background_color #335e35`, `theme_color #f6f7f5` (`web/public/manifest.json`).
- Font: **Figtree** (self-hosted, latin + latin-ext, `web/src/styles/fonts/`).
- Logo: `docs/brand/logo-sub20.png` — bela „20" na zelenom; „2" je trkač sa okruglom glavom (centar 52,7 % / 27,9 %, prečnik 10,2 % stranice).
- Ime u UI-ju: „sub20" (wordmark), u manifestu „sub20 · Trkački plan".

## URL produkcije

`https://sub-19.vercel.app` — odgovara 200 (provereno 2026-10-18); navedeno u `web/public/uputstvo.html:66` i u testovima OAuth-a.

## Tvoje vreme na 5 km

**20:25** — Strava best effort „5K" = 1225 s, aktivnost od 24. 9. 2026 (krugovi po km: 4:02 · 4:00 · 4:02 · 4:12 · 4:09). To je najbrži 5K u Strava aktivnostima od 18. 12. 2025; starije aktivnosti nisam proverio. Nije zvanično vreme sa čipa. Aplikacija sama ne čuva tvoj PB van plana: PB se unosi u čarobnjaku i pamti u `genPlan.ulaz.pb`.

## Demo stanje za snimke

`capture/tools/demo-state.mjs` + `capture/tools/gen-plan.mjs`: plan je napravljen **pravim generatorom** iz koda (`generatePlan` + `adaptGeneratedPlan`) za PB 20:25 → cilj 19:59, start 2. 10. 2026, trka 20. 12. 2026. Generator sam upozorava da je 19:59 brže od trenutne forme — aplikacija ne obećava cilj. Danas, Plan i Oporavak su demo vrednosti; prolazi u Analizi trke su tvoji stvarni. Bez tokena, emaila i Strava ID-jeva.

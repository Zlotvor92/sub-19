# Segment 08b — adaptacija 5K v2 u aplikaciji + popravke iz 08a

Grana `claude/generator-isolation-5k-10k-hm-marathon`, polazni `ed5974e`. Pravila v2 (`policy.ts`, konstrukcija, `assess`)
nisu menjana — ovo je povezivanje. Prekidač ostaje podrazumevano isključen.

## A. Činjenice iz aplikacije — `fiveK/v2/app/facts.ts` (jedino mesto prevoda)
| Činjenica | Izvor | Pravilo |
|---|---|---|
| `workouts` | `log[dayId]` (ručno + uvoz Strava/icu, isti unos), `vanPlana` | `done` → završeno, `skip` → propušteno, bez statusa nije činjenica; `date` = `runDate`/`ts`/dan posle pomeranja; `dayId` = datum dana v2 |
| `pain` | `knee` (zapisi bola, i oni iz forme treninga) | najveći bol dana → trening tog dana; bol ≥ 4 (prag iz `policy`) bez treninga → zapis bez trčanja |
| `results` | `t3k` (test), `log[*].raceAi.context` (trka) | samo trka napora „trka" na 3/5/10 km; ostalo u `notes` sa razlogom |
| `coverage` | povezan izvor + dan poslednje USPEŠNE sinhronizacije (`strava.lastSync`, `icu.trSync`) ili potvrda | `complete` samo kad je sinhronizacija ≥ danas (od početka plana) ili korisnik potvrdi N dana (7/14/21/28); inače `false` |
| `breaks` | nova minimalna radnja „Pauza (nisam trčao)" u Prilagodi plan | od–do, odsečeno na danas |
| `lockedDayIds` | `alts`/`moves` različiti od snimka `meta.fiveKV2Edits` (upisuje ga primena) | izmena posle poslednje adaptacije; izmena dana odmora → napomena (nije dan v2) |
Store sloj samo čita stanje: `stores/fiveKV2Actions.ts` (izvori, dan sinhronizacije iz sata, traka).

## B. Tok prilagođavanja (bez tihog upisa)
- Plan → Prilagodi plan (v2): `FiveKV2Adjustment` odmah računa pregled (`adaptFiveKV2(plan, facts, danas)`): razlozi v2
  doslovno (i neprimenjeni), tabela promenjenih nedelja (cilj km, plan km, kvalitet pre → posle), pokrivenost, napomene.
  Potvrda → `commitPlanChange` → nova revizija (`recordPlanRevision`); „Prethodne verzije plana" → vraćanje (pregled pa
  potvrda). Odbijanje v2 → „Plan nije prilagođen. Razlozi:" + razlozi doslovno (role=status), plan netaknut.
- Automatski: traka „Plan treba prilagoditi" (Plan tab i Danas) kad pregled ima primenjeno ograničenje (bol, pauza, umor,
  nov rezultat, manjak/višak izvršenja, prelaz; nivo run/walk samo kad se promenio) KOJE MENJA budući deo plana, nije već
  primenjeno danas, a bol je zapisan posle poslednje adaptacije. Dugme vodi na isti pregled; upisa nema.
- Napredak → Forma (v2): `FormV2` — VDOT samo iz rezultata (čarobnjak, primenjeni, „čeka prilagođavanje", stari), VDOT
  plana u tekućoj nedelji, procena 5K, ocena cilja doslovno; bez lanca forme v1.
- Ti → Cilj (v2): isti ulaz sa novim ciljem, svi budući dani zaključani → treninzi/tempo bajt-isti, menja se ocena cilja;
  potvrda prikazuje ocenu pre/posle, upis = revizija `goal`. Run/walk: odbijanje („završiti").
- Revizije: `versions.PLAN_FIELDS` + `fiveKV2` (bez njega se verzija v2 nije mogla vratiti; planovi bez polja isti).
- Prikaz posle prelaza run/walk → kontinuirani (`plan.ts` je ranije bacao grešku): nedelje se nastavljaju brojem, faza iz v2.

## Ugovor (b) posle 08b (26 članova; nijedan ne poziva v1 — test)
| Član | 08b |
|---|---|
| buildExecutionAdjustment | pregled `adaptFiveKV2` (`breakDays` → prijavljena pauza; km/ned iz čarobnjaka v1 se ne koristi) |
| buildRunWalkAdjustment | isti pregled za run/walk plan; izbor „zadrži/korak nazad/ponovi" se ne koristi (nivo iz zapisa) |
| executionModel | opis izvršenja 28 dana (bez odluke; odluka = `adaptFiveKV2`) |
| assessRunWalkProgress | upućivanje (`unknown`): nivo određuje samo `runWalkAssess` (Uslov 1) |
| graftFuturePlan | `restoreMerge`: budući nezaštićeni dani iz verzije; druga vrsta plana → odbijanje sa razlogom |
| alignAutomaticOverlays | izmene nepromenjene (v2 nema automatskih izmena) |
| injuryProposal / applyInjuryProposal | `null` / 0 — bol ide kroz `facts.pain` u `adaptFiveKV2` (traka + pregled) |
| vdotProposal / applyVdotProposal / undoVdotAdjustments | `null` / 0 / 0 — tempo menja samo rezultat kroz `facts.results` |
| planRecalibrated | odbijanje sa razlogom (rekalibracija iz forme treninga ne postoji; rezultat kroz pregled) |
| classifyMeasurement | `{status: 'not-used', reason: 'plan-uses-results'}` „Ne koristi se u ovom planu…" (nova grana ugovora, nije greška) |
| recomputeVdotChain / sessionClassFor / currentVdot | lanac v1 se ne koristi: kopija / `default` / `null` |
| fitnessEvidence / planVdotNow / hasRecentMeasuredForm | VDOT svežeg testa 3 km / `meta.trainingVdot` / test ≤ 84 dana |
| planWithNewGoal | isti ulaz sa novim ciljem (`goalChange`); u `select.ts` uklopljen u `GoalChangeResult` bez `ulaz` (komentar) |
| qualityEntryGate, matchPlanRows, recalibrationMin/Threshold | nema kapije / prazno / ∞ (v2 nema redove predikcije ni rekalibraciju) |
| **executionBasis** | NEPODRŽANO: odluka o pripremi postoji samo za HM/maraton |
| **realignPlan** | NEPODRŽANO: v2 ne pomera dane prema uvezenim trčanjima (trčanje ulazi sa stvarnim datumom) |

## C. Popravke iz 08a
10. Prekidač: `flags.fiveKV2ToggleVisible` — sekcija „Generator plana" samo kad je `VITE_FIVEK_V2` postavljen (bilo koja
    vrednost) ili je korisnik administrator (postojeći `useIsOwner`, ADMIN_UID). Ponašanje podešavanja nepromenjeno. UI test.
11. `generator-ab-users`: u spec dodat dokaz — `diffPaths(stvarni, zamrznuti)` mora biti podskup {`meta.policyId`,
    `meta.policyVersion`, `weeks.N.phase`}; tek onda očekivanje = `stampPlan` generatora distance(zamrznuti). Rezultat:
    U01 14, U02–U07 18, U08 16, U09–U10 22 putanje, van dozvoljenih 0 → 10/10 prolazi. `pwa.spec`: jednom sa
    `--timeout=120000 --workers=1` → 2/2 (5,0 s i 5,7 s); test nije diran (uzrok u celom paketu: v. E2E).
12. Km: `day/stats.outsideWeekVolume` — dan trke sa strukturom v2 je van `weekPlanKm`/`weekRealKm`; Plan tab dodaje
    „+ trka 5 km (dan trke X km sa zagrevanjem i hlađenjem) — van obima nedelje". Test: km svake nedelje = `plannedKm` v2.
13. Ručna izmena samo tempa: `resolve.withWorkPace` — novi tempo u koracima rada, zadata veličina ostaje, procenjena i
    zbir prate; izmena tipa/km/opisa briše strukturu kao do sada. Test.

## Komande i rezultati (iz `web/`)
- `npx tsc -p tsconfig.domain.json --noEmit` → exit 0. `npx tsc -b --noEmit` → exit 0.
- `npx vitest run --project node src/domain/generators/` → exit 0, 29 fajlova / 739 testova (08a: 28 / 720).
- `npm run check` (typecheck, eslint, prettier, vitest) → exit 0, 191 fajlova / 2380 testova (08a: 189 / 2355).
- Novi testovi: `fiveK/v2/app/adapt.node.test.ts` 19 (tačke 1–5, 6 tok + vraćanje, 6b odbijanje, 7 bol/traka, 7b test 3 km
  po osećaju → tempo, 7c run/walk RPE 5 → L2 i RPE 7 → traka, cilj, prelaz run/walk → kontinuirani, trajnost, 8, 9, 10,
  12, 13); `features/plan/fiveKV2Adapt.test.tsx` 6 (UI: tok sa revizijom i vraćanjem, traka Plan/Danas, odbijanje, Forma,
  km nedelje, prekidač). Izmenjeni testovi 08a (`app.node.test.ts`, `fiveKV2Flow.test.tsx`): „stiže uskoro" → tok v2.
  Reference (equivalence, guidance, personalPlan, oracle, UI tokovi v1) bez izmene i prolaze.
- Neuspesi usput (ispravljeni): `tsc -b` 2 (test 08a uvozio uklonjen `ADAPTATION_UNSUPPORTED`); proširenje unije
  `planWithNewGoal` oborilo tipove ≥ 9 mesta u v1 testovima → vraćeno, kast na granici; uvoz `select.ts` u E2E povukao
  TS2774 iz v1 generatora pod E2E tsconfig-om → `stampPlan` po distanci; novi testovi 2/17 (pogrešna očekivanja: drugi bol
  pada na dan bez kvaliteta; L2 posle 3 sesije = projekcija generatora → plan se ne menja) i UI 1/6 (`screens`);
  eslint 9 (nepotrebni kastovi, `never` u šablonu).

## E2E
- `fivek-v2.spec.ts` 3/3 iz prvog pokušaja: novi tok „propuštena nedelja → pregled (bez potvrde „Budući deo plana se ne
  menja", dugme onemogućeno) → potvrda 14 dana → „Pauza 7 dana…" + tabela → Primeni → server: 1 revizija, `asOf`
  2026-02-01 → Prethodne verzije"; test 1 sada proverava tok v2 umesto „stiže uskoro".
- `generator-ab-users.spec.ts` 10/10 (pre izmene spec-a 10/10 pada — isti padovi kao u izveštaju 08a na 7fa61eb).
- `pwa.spec.ts`: 1× `--timeout=120000 --workers=1` → 2/2 (5,0 s, 5,7 s). Ceo paket (`npx playwright test`): 78/80, padaju
  samo 2 `pwa` (istek 30 s). Dijagnostika (samo `pwa.spec`, podrazumevano: 2 radnika, 30 s) → 2/2 pada. Tačan uzrok:
  dva PWA testa istovremeno (2 radnika) — zastoj u čarobnjaku `createPlan` pre ijedne PWA provere (klik „10 km" stoji na
  „scrolling into view"; „Dalje" odvojen iz DOM-a pa onemogućen); sa 1 radnikom prolaze za ~5 s, pa duže vreme nije
  rešenje. Mehanizam u pregledaču nije utvrđen. Test nije diran; isti padovi su u izveštaju 08a i na 7fa61eb.

## Stalni uslovi (AGENTS.md)
1. Jedan vlasnik: odluke samo `adaptFiveKV2` (assess/runWalkAssess); `facts.ts` prevodi, traka samo filtrira primenjene
   razloge; `executionModel` opisuje. 2. Plafoni nedirnuti. 3. WU/CD nedirnuti; trka van obima nedelje kao u v2.
4. Činjenice ulaze u konstruktor kroz `adaptFiveKV2`; zaštita (urađeno, zaključano, prošlost) u jezgru; vraćanje revizije
   čuva prošlost/urađeno/izmenjeno. 5. Handoff nije diran (HM → 5K ostaje v1). 6. Revizija nosi `5k-v2`/`5k-v2.6.0` i fazu
   iz v2 (i posle prelaza). 7. `app/` izvršno samo iz `fiveK/v2/`, tipovi kroz `exchange.ts`; isolation/architecture/
   contract testovi bez novih izuzetaka. 8. Validator v2 nepromenjen; prilagođen plan prolazi validator (inače odbijanje).

## Šta ostaje pre uključivanja za korisnike
- Uvoz odbacuje trčanja na dan odmora/van plana; uz „potpun" zapis sinhronizacije to je manjak km (moguća lažna pauza).
- `icu.trSync` se pomera i kad detalji/tokovi ne uspeju (lista treninga uspela) — pokrivenost to ne razlikuje.
- Prijavljena pauza živi samo do potvrde (upisuje se u korak adaptacije); `AltRecord` nema vreme → snimak u `meta`.
- `planVdotNow` = poslednji VDOT plana (ne po nedelji); `planWithNewGoal` uklopljen kastom na granici ugovora.
- Pragovi trake (nov bol posle adaptacije, promena nivoa) su heuristika prikaza; pragovi jezgra (07) bez trenerske provere.
- Iz 08a ostaje: sat ne šalje delove po osećaju i run/walk bez tempa.

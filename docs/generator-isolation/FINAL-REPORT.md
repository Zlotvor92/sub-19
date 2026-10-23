# Završni izveštaj — razdvajanje četiri generatora (segment 5/5)

## Zaključak

**Razdvajanje četiri generatora je završeno.** Svaki generator (5K, 10K, polumaraton, maraton) sam generiše i
adaptira plan i sam nosi svu trenersku logiku koju aplikacija koristi; aplikacija ga zove samo preko izbora generatora.
Stari zajednički engine je **obrisan** (48 modula), a testovi koji su ga koristili prevedeni su na generatore.

Tok posle segmenta 5/5 (po instrukcijama korisnika):
1. „Prenosi se u sve generatore": predlog izmene plana zbog bola i prekida, automatska zamena dana, izvoz na sat, tempo uz
   vrućinu, ciljni RPE i tempo po zoni — u svakom generatoru (14 744 toka × 4 kopije = referenca).
2. „Završi i dvojku": prikaz stanja — status bola, ACWR/opterećenje, prekid, spremnost „danas", wellness signali — u
   svakom generatoru (7 380 tokova × 4 kopije = referenca).
3. „Briši engine, prepravi sve potrebne testove": 48 modula obrisano; v. §3.1.

Zajedničko van generatora ostaje samo ono što ne odlučuje o treningu: format razmene i upis (razrešavanje plana, ručne
izmene, revizije), prikaz (oznake, faze), merni sloj (lanac forme, VDOT, test 3 km), čitanje prognoze, zapis trčanja van
plana, grafikoni i AI saveti.

Izmene su commitovane i pushovane na granu `claude/generator-isolation-5k-10k-hm-marathon` (po `AGENTS.md` i
izričitoj instrukciji). PR nije otvoren; nije spojeno u `main`; nije objavljeno.

## 1. Kriterijumi završetka

| # | Kriterijum | Stanje | Dokaz |
|---|---|---|---|
| 1 | Svaki generator samostalno generiše i adaptira | **ispunjeno** | četiri direktorijuma sa sopstvenim kopijama; `architecture.node.test.ts` (izvršno zatvorenje svakog u svom direktorijumu); `runtimeIsolation.node.test.ts` (svež modul jednog generatora = referenca) |
| 2 | Nema međusobnih ni zajedničkih izvršnih trenerskih zavisnosti | **ispunjeno za generatore** | statički (ni tipom, ni re-exportom, ni dinamičkim `import()`); runtime: nijedan zajednički objekat, probna promena politike jednog ne menja ostale; jedini kanal je eksplicitna predaja „kraća distanca" (argument) |
| 3 | Nijedan aplikacioni postprocesor ne menja njihovu trenersku politiku | **ispunjeno (posle prenosa)** | izbor je čist (`select.ts` bez starog koda i bez rezerve); prag rekalibracije, predlog zbog bola/prekida, zamena dana, izvoz na sat, tempo uz vrućinu, RPE i procena stanja (bol, ACWR, spremnost) su u generatoru; `architecture.node.test.ts` proverava da tih 42 imena nema u aplikaciji, a da ih ima svaki generator |
| 4 | Stari zajednički engine nema aktivnu produkcionu ulogu | **ispunjeno — obrisan** | 48 modula obrisano, test obara vraćanje; `main.tsx` (sa lenjim ekranima, analiza po imenu) dostiže tačno 29 fajlova zajedničkog koda (format, prikaz, merenje), nijedan za generisanje/adaptaciju; lični plan preusmeren na HM uz dokaz |
| 5 | Postojeći podaci kompatibilni i zaštićeni | **ispunjeno** | nema migracije ni regeneracije pri učitavanju; reference sa zaštićenim danima identične; tokovi u UI testovima čuvaju istoriju |
| 6 | Bez neobjašnjenih regresija | **ispunjeno** | sve reference (5K, 10K, HM, maraton, polazni `main`, lični plan) identične, nijedno polje isključeno; jedine promene ponašanja su namerne i navedene u §4 |
| 7 | Granice automatski proverljive | **ispunjeno** | §5; svako novo pravilo provereno veštačkim prekršajem |

## 2. Šta je urađeno u segmentu 5 (zadaci 1–6)

### Zadatak 1 — provera zavisnosti

Pronađeno i otklonjeno:

| Nalaz | Gde | Ishod |
|---|---|---|
| stari generator kao rezerva iza izbora | `select.ts` `LEGACY_GENERATOR` (lični plan `null`, nepodržana distanca) i `LEGACY_PREPARATION` (5K/10K) | uklonjeno; `null` + eksplicitna poruka; lični plan → HM (dokazano isto) |
| aplikacija računa trensku odluku | `stores/raceActions.ts` kapija rekalibracije iz starih `VDOT_PROPOSAL_*` | čita se iz izabranog generatora (iste vrednosti) |
| tihi fallback na drugi generator | `domain/onboarding.weeksHint`: `productFor(d) ?? productFor(5000)` | uklonjeno |
| prikaz uvozi staru odluku o pripremi | `ExecutionAdjustment.tsx` `describePoint` | formatiranje u ekranu, ime distance iz generatora |
| re-export koji skriva stare izvršne funkcije | barel `domain/plan/index.ts`, `domain/training/adaptation/index.ts` | uklonjeni izvršni izvozi, ostali tipovi |
| prikazni modul vuče stare trenerske profile | `plan/describe.ts` (mrtva `describePrescription`), `adaptation/proposal.ts` (`effectivePace`) | doslovno premešteno u zasebne module |

Nije nađeno: međusobni uvoz generatora, zajedničko promenljivo stanje između generatora, UI/persistence koji poziva
generatorsku politiku mimo izbora. Nađena zajednička trenerska logika van starog mehanizma — §3.2.

### Zadatak 2 — stari mehanizam

Inventar po modulu: `STATUS.md`, „Inventar starog koda (stanje posle segmenta 5)". Ukratko: 47 izvršnih modula starog
generisanja/adaptacije nema produkcionog potrošača i nije potreban za čitanje sačuvanih podataka; potrošači su samo
testovi. Uklonjeni su produkciono ožičenje i zastareli izvozi; moduli su naknadno obrisani (§3.1). Za stare podatke nije
potreban adapter: učitavanje ne generiše ni ne menja plan.

### Zadatak 3 — aplikacione putanje

Za sve četiri distance, kroz stvarne store-ove/ekrane (`features/onboarding/{fiveK,tenK,halfMarathon,marathon}Flow.test.tsx`,
nepromenjeni delovi iz segmenata 1–4) i E2E: prvo kreiranje kroz čarobnjak, prikaz treninga i nedelje, km, čuvanje i
ponovno učitavanje kroz pravo skladište, povratak posle pauze, vraćanje verzije, promena cilja; HM/maraton i odluka o
pripremi i „kraća distanca". Propušteni/podizvršeni treninzi, umor (RPE 8), pauza, pomereni, ručno izmenjeni i merom
zaključani dani, rekalibracija i predlog tempa — u referentnim tokovima svake distance. Brojač poziva starog mehanizma = 0.

- Birač: samo izbor; nema rezerve; nepodržana distanca → `UNSUPPORTED_DISTANCE` (ekran „Prilagodi plan", prilagođavanje,
  promena cilja, rekalibracija, vraćanje verzije, odluka, čarobnjak) — `features/personalPlanGenerator.test.tsx` i
  kontrolni testovi u `*Flow.test.tsx`.
- Promena distance: (a) „kraća distanca" iz HM/maratonske odluke bira generator nove distance i čuva istoriju (graft;
  dokazano u HM/maraton Flow testovima); (b) novi plan kroz čarobnjak po postojećem dizajnu proizvoda **briše** unose
  starog plana posle potvrde („nema arhive") — to nije menjano.

### Zadatak 4 — očuvanje ponašanja (regresiona matrica)

| Distanca | Generisanja | Adaptacioni tokovi | Odluke | Referenca uzeta na | Rezultat |
|---|---|---|---|---|---|
| 5K | 1 000+ | ~15 000 | — | `05088e0` | identično |
| 10K | 1 100 | 14 267 | (u ostalim distancama) | `f745be0`, cross-check `05088e0` | identično |
| HM | 1 826 | 27 596 | 519 | `90f2d0e`, cross-check `05088e0` | identično |
| maraton | 1 843 | 25 764 | 1 581 | `ad464c0`, cross-check `05088e0` | identično |
| 10K/HM/M polazni `main` | 2 211 | 17 638 | 157 | `05088e0` | identično (kroz aplikacioni izbor) |
| lični plan (novo) | — | 13 782 | — | `348391c`, cross-check `05088e0` (bajt-identično) | identično (HM generator) |

Matrice obuhvataju iskustvo (`none/some/experienced`, početnik, povratak), obim 0–1000 km uz pragove (npr. 30/45 HM,
38/50/55/180 maraton), dane 0–8 i raspored/dan duge, pripreme od 0 dana do 40 nedelja, PB raznih distanci (svež,
zastareo, bez datuma), ciljeve, umor/smanjen obim/povratnu spremnost, granice i neispravne ulaze, nedovoljnu spremnost
(odluka o pripremi). Datum je uvek argument; ponovljeno pod `TZ` Pacific/Kiritimati, America/Los_Angeles, Asia/Kolkata,
UTC, uz `Math.random`/`Date.now`/`new Date()` koji bacaju izuzetak. Poređenje je tačan zapis celog izlaza: **nijedno polje
nije izuzeto**, ništa se ne zaokružuje. Razlike: **nema**.

Ograničenje: očuvanje postojećeg ponašanja **nije dokaz trenerskog kvaliteta** — reference beleže i poznate nedostatke (§6).
Poznata rupa pokrivenosti iz segmenta 3: 5K/10K slučajni ulazi harnesa koriste nevažeću vrednost `qualityExperience:
'regular'`, pa putanju `experienced` za 5K/10K pokrivaju samo QA ulazi.

### Zadatak 5 — izolacija promena

`runtimeIsolation.node.test.ts`: (1) svež modul jednog generatora bez ostalih = referenca; (2) napred, unazad i
isprepletano = isto; (3) ponovljeno = isto; (4) nijedan objekat dostižan iz izvoza jednog generatora nije dostižan iz
drugog; izvršavanje ne menja izvezene konstante; (5) probna promena `deloadFactor` (samo u memoriji testa, vraća se u
`finally`) menja izlaz samo tog generatora. Jedini uočen kanal ka drugom: maratonsko prilagođavanje (`U10 · under ·
execution reduce`) nudi plan polumaratona koji pravi HM generator kroz `handoff.ts` — namerna, eksplicitna predaja;
kada se predaja usmeri na netaknutu instancu HM, maratonski izlaz je ponovo jednak referenci.

**Granica garancije:** dokazana je nezavisnost trenerskih implementacija. Zajednički UI, store-ovi, skladište, JS runtime
(`Intl`, `Date`), zajednički merni sloj (lanac forme, VDOT) i `domain/recovery` mogu imati grešku koja pogađa sve distance.

### Zadatak 6 — podaci i projektne provere

Očuvanje odrađenih treninga, stvarnih merenja, efektivnih datuma pomerenih treninga, ručnih izmena i alternativa,
merom zaključanih budućih redova (`pred`/`predLock`), ID-jeva dana, `log/alts/moves` u celini (beleške su deo zapisa
dnevnika), upozorenja o konfliktu i revizija — `*Flow.test.tsx` (sve četiri distance, iz segmenata 1–4, i dalje zeleni),
referentni „prot" tokovi, E2E `final-preservation.spec.ts`. Zasebna provera beleški kao polja i podataka oporavka
(`vanPlana`) u ovom segmentu nije pisana.

Izvršeno (iz `web/` osim gde piše):

| Komanda | Rezultat |
|---|---|
| `npm run check` (typecheck, lint, prettier, vitest) | zeleno; **170 fajlova / 1 644 testa** (pre segmenta: 166 / 1 629) |
| `npm run build` | uspešno; upozorenje „chunk > 500 kB" postoji i na polaznom `348391c`; glavni JS 1 079,3 → 999,9 kB |
| `node --test "**/*.test.mjs"` (iz `test/`) | 396/396 |
| `npx playwright test` | 77/77, jedan prolaz (PWA testovi `pwa.spec.ts:38/:65` su u segmentu 1 zabeleženi kao nestabilni i na polaznom commitu; ovde prošli) |

Posle prenosa logike u generatore (dopuna): `npm run check` 172 fajla / 1 652 testa; build uspešan; node 396/396;
E2E 76/77 u punom prolazu (pao poznato nestabilni `pwa.spec.ts:38`, ponovljen 4/4 prolazi).

Nije izvršeno: ponavljanje celog E2E više puta; testovi na stvarnom uređaju/produkciji; deploy (zabranjen uputstvom).

## 3. Preostale prepreke (konkretno)

### 3.1 Stari engine — OBRISAN

Obrisano 48 modula u `web/src/domain/training/**` i `web/src/domain/plan/**` (spisak: `STATUS.md`, dopuna 2;
`DELETED_LEGACY_ENGINE` u `architecture.node.test.ts`, koji obara test ako se bilo koji vrati). Urađeno:
(a) ulazni planovi u testovima → `src/test/generators.ts` (generator distance ulaza, isti put kao aplikacija; izlaz
dokazano identičan starom engine-u); (b) istorijski testovi starog koda prevedeni na kopije u generatorima, očekivane
vrednosti nepromenjene; dva koraka koja aplikacija za 5K nikad ne poziva („izbor pripreme" u lancu umora) zamenjena su
proverom da ih 5K nema; (c) brojač poziva starog engine-a u UI tokovima uklonjen (nema šta da broji); (d) tipovi razmene
izvedeni iz ugovora generatora u `select.ts`; (e) harnesi snimanja referenci više ne snimaju — proveravaju referencu i
nose recept za ponovno snimanje iz worktree-a na zabeleženom commitu. Reference (`*.json.gz`) nisu dirane.

### 3.2 Zajednička trenerska logika van generatora — UKLONJENO prenosom u generatore

| Ranije (jedno za sve distance) | Sada |
|---|---|
| `domain/recovery/proposal.ts` (+ pragovi predloga) | `<g>/recovery/*` u svakom generatoru; aplikaciona kopija obrisana |
| `domain/activities/realign.ts` | `<g>/activities/realign.ts`; aplikaciona kopija obrisana |
| `domain/watch/icuWorkouts.ts` | `<g>/watch/icuWorkouts.ts`; aplikacioni modul obrisan |
| vrućina, tempo uz vrućinu, najhladniji sat, kartica u `domain/weather` | `<g>/weather/index.ts`; uklonjeno iz aplikacije |
| `plan/describe.rpeTarget` | `<g>/plan/describe.ts`; uklonjeno iz aplikacije |
| `paceForZone` u lakom tempu, čarobnjaku, vremenu, satu | `<g>/training/vdot/paceForZone.ts` preko generatora |

Dokaz: `domain/generators/guidance.node.test.ts` — referenca snimljena iz aplikacionog koda pre prenosa (`ae6b43a`):
14 744 toka (predlog zbog bola 1 584 i primena 1 264, zamena dana 363, izvoz na sat 198 + 2 428 dana, opisi 1 219,
RPE 1 237, ciljni tempo 4 856, kartica vremena 1 320, vrućina/run-walk/prag/zone) nad planovima sve četiri distance i
ličnim planom; **svaka od četiri kopije daje tačno isti zapis**, nijedno polje izuzeto.

Prikaz stanja (status bola, ACWR, prekid, spremnost, wellness signali) je naknadno takođe prenet u svaki generator
(`<g>/recovery/{pain,load,constants,view,readiness}.ts`; dokaz 7 380 tokova × 4 kopije, referenca `5f56a52`).
Zajedničko ostaje: čitanje prognoze, zapis trčanja van plana, merni sloj (lanac forme), grafikoni i AI saveti.

## 4. Namerne promene ponašanja (sve u aplikacionom sloju, nijedna trenerska)

1. Plan bez podržane distance (samo ručno uvezen/oštećen): ranije stari mehanizam, sada eksplicitno odbijanje sa porukom.
2. Ugrađeni lični plan: generator HM umesto starog mehanizma — izlaz identičan (13 782 toka).
3. 5K/10K plan: odluka o pripremi se više ne poziva (ranije stari `isLimitedLongPreparation` → uvek `false`); isti rezultat
   osim za ručno sastavljen 5K/10K plan sa `cycleDecision.kind === 'base'`, koji aplikacija ne pravi.
4. Ugovor `PlanGenerator` sadrži `recalibrationMinMeasurements`/`recalibrationThreshold` (iste vrednosti 3 i 1,5).
5. Prenos (dopuna): za plan bez podržane distance nema predloga zbog bola, automatske zamene dana, slanja na sat
   (eksplicitna poruka), kartice vremena, RPE ni lakog tempa; u čarobnjaku nepodržana ciljna distanca nema pregled tempa
   (čarobnjak je ne nudi). Za sve četiri podržane distance i lični plan ponašanje je identično referenci.

## 5. Automatske provere i komande

V. `ARCHITECTURE.md` §6 i §9. Glavne: `npx vitest run --project node generators/` i `npm run check`.

## 6. Poznati nedostaci po distanci (čekaju trensko usavršavanje; nisu menjani)

**5K** — nema sistematske nove liste (segment 1: „nedovoljno dokaza"); zabeležene činjenice: zahtev pune pripreme za
najdužu dužinu je sama distanca (5 km); `recalibratedPlan`/`reentryPlan` nemaju ekran; putanja `experienced` slabo
pokrivena referentnim ulazima. Izvori nalaza: `docs/GENERATOR_10_USERS_4_COACHES_REPORT.md`, `docs/qa/generator-final/REPORT.md`,
`docs/ENGINE_CHANGES.md` (nisu ponovo provereni ovde).

**10K** — nema sistematske nove liste; ista ograda i isti izvori; 10K čita HM/maratonske oznake samo na zaštićenim prošlim
danima (plan nastao predajom).

**Polumaraton** (STATUS, segment 3): drugi kvalitet se vraća u prelaznoj taper nedelji (465/1 811 planova); nema ulaza
za iskustvo na distanci; uvodni fartlek u prelaznoj taper nedelji kratkih planova; kontrolna trka izuzeta iz doze i
omotača; traženi drugi kvalitet nikad isporučen u 647 planova.

**Maraton** (STATUS, segment 4): M rad skraćen opštim vremenskim limitima (10–22 min); 1 534/1 821 planova `limited`;
„ciklus dugog trčanja" ne menja dužinu; konsolidacija (svaka 3. ned.) i deload (svaka 4.) neusklađeni; drugi kvalitet
neisporučen u 183/892; prva taper nedelja može imati više kvaliteta od poslednje radne (25); nema pravila „lak dan posle
duge"; „Aktivacija" 6 × 200 m približno M ritam; nema ulaza za iskustvo na distanci.

**Zajedničko (van generatora)** — §3.2.

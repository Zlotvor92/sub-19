# Generator: ponovna izgradnja po fazama — kontekst za sledeću sesiju

Ažurirano: 2026-10-12. Zamenjuje prvu verziju ovog fajla. Grana: `claude/generator-rebuild-context`.
Oznake: **[F]** činjenica viđena u kodu ili izlazu · **[S]** iz javnog izvora (sekundarni, nije proveravano u knjizi) · **[O]** odluka ove sesije (trenerska heuristika, ne dokaz) · **[?]** nije poznato.

## 0. Pravila rada za sledeću sesiju (naredio korisnik)

- Korisnik nije izvor brojeva. **Odluke donosi Claude**, obrazlaže ih i zapisuje (odeljak 3). Korisnika se pita samo za nepovratne radnje (merge, deploy, brisanje) ili kad je odluka proizvodna, a ne trenerska.
- Radi se **po distanci**: prvo 5 km dok ne prođe svih kriterijuma iz odeljka 6, tek onda 10 km, pa HM, pa maraton. Ne počinjati sledeću distancu dok prethodna nije zatvorena.
- Gleda se **više trkača**, ne samo korisnika (sub-20 5 km, PB 20:25, HM 1:41:16, 30 km/ned, 4 dana, 2 kvaliteta). Korisnik je jedan profil iz matrice.
- Cilj: uzeti dobro iz **novog** (PR #32–#35) i **starog** (`main` `aea8dc6`), pa to proveriti nad matricom profila.
- Odgovori korisniku: kratko, direktno, bez filera, činjenice odvojene od mišljenja, „Ne znam” kad nema dokaza. Ne pominjati koleno.
- Commit/push samo na izričit zahtev (hook traži da fajlovi ne ostanu untracked; pushovati na granu, nikad na `main`).

## 1. Šta je u repou

- `main` = `aea8dc6` = **stari** generator. `web/src/domain/training/`: `generator/generatePlan.ts` (1095 linija), `distances/profile{5k,10k,21k,42k}.ts`, `sessions/{intervals,tempo,cruise,repetitions,longRun,progression,constraints,build,calc}.ts`, `constants/{heuristics,distances,evidence,product}.ts`, `vdot/{calculateVDOT,paceForZone,physiology,racePrediction,…}.ts`.
- Novi = grana `origin/fix/generator-phase3` (`f7bcbe9`), lanac draft PR-ova #32 → #33 → #34, QA u #35. **[F]** Domen `web/src/domain/training` je između lokalnog `main` (`d40c2b6`) i `origin/main` (`aea8dc6`) identičan, pa je poređenje važeće. **[F]** Tekst PR-ova #32–#35 ne kaže koji ih je alat pisao; „ChatGPT” je korisnikova tvrdnja.
- Novo u fazi 3 **[F]**: `distances/qualityDose.ts`, `generator/longRunProgression.ts`, `generator/athleteAssessment.ts`, `training/execution.ts` (preračun po izvedenim treninzima), `adaptation/proposal.ts`, `sessions/deload.ts`, izmene `sessions/constraints.ts`. Dokumenti: `docs/GENERATOR_PHASE{1,2,3}_*.md`, `docs/qa/generator-ab/` (10 profila, `raw/` ima oba plana).
- **Ključno [F]:** postojeći `HEURISTIC_5K` već sadrži Danielsove budžete: `intervalBudget {pct 0.08, maxKm 8}`, `tempoBudget {pct 0.10}`, `repetitionBudget {pct 0.05, maxKm 5}`, `tempoMaxSec 20*60`, `longRun share 0.27 (nizak obim 0.40, cap 8 km, 90 min, 20 km)`, `longRunMaxShare 0.40`, `deloadFactor 0.73`, `taperFactor 0.65`, `raceWeekFactor 0.30`, `rampStep` kons/std/agr = 4/5,5/7% sa podom i plafonom. `PRODUCT_5K`: `minWeeks 6`, `qual2MinKm 18`, `minPeakKm 30`. Stari plan U03 (50 km/ned) je T rad držao blizu tog budžeta (4,8 km od ~5 km). Novi ga spušta na ~3,2 km. Uzrok je u `qualityDose.ts` — **[?] taj fajl nije pročitan**; prvi korak u 5K fazi je da se pročita.
- VDOT **[F]**: `ZONE_FRACTION = {I:1.0, T:0.88, M:0.8 (ne koristi se), E:0.70, LR:0.68, R:1.05}`; M zona se računa kao maratonska trka za dati VDOT (`paceForZone.ts`). Adaptacija forme: `VDOT_ALPHA = {test 0.6, tempo 0.28, int 0.12, rep 0.04}`, `VDOT_RAMP_PER_WEEK = {kons .15, std .25, agr .43}` (komentar u kodu priznaje da je `agr` kalibrisan na putanju jednog autora plana).

## 2. Šta je istraženo (javni izvori, pouzdanost ograničena)

Pretraga je dala uglavnom sekundarne izvore. Knjige (Daniels' Running Formula, Pfitzinger) nisu pročitane. **Svaki broj sa [S] mora se proveriti pre nego što postane test.**

- VDOT jednačine **[S]** (kalkulator koji implementira Daniels–Gilbert): `VO2 = −4,60 + 0,182258·v + 0,000104·v²` (v u m/min); `%VO2max = 0,8 + 0,1894393·e^(−0,012778·t) + 0,2989558·e^(−0,1932605·t)` (t u minutima); `VDOT = VO2 / %VO2max`. Zone **[S]**: E 59–74%, M 75–84%, T 83–88%, I 95–100%, R 105–110% (stranica nije jasna da li je to VDOT ili VO2max). Repo već implementira ovo (`physiology.ts`, `calculateVDOT.ts`); uporediti brojeve sa oracle testom, ne menjati bez razloga.
- Danielsova ograničenja doze **[S, jedan prikaz knjige + forumi]**: T ≤ 10% nedeljnog obima; I ≤ 8%, rep ≤ 5 min; R ≤ 5%, rep ≤ 2 min; E ≥ ~80% obima; dugi trk ≤ manje od 25% nedelje i 150 min (30% ako < 40 milja = ~64 km). **Nejasno [?]:** da li su procenti **po sesiji** ili **po nedelji** (izvori kažu i jedno i drugo; repo ih primenjuje po nedelji). Proveriti pre testova. Prikaz knjige navodi i apsolutne plafone I/R koje izvori ne potvrđuju (repo: 8 km / 5 km).
- Danielsov 5K–10K plan **[S]**: 4 faze po ~6 nedelja. I: baza (bez propisanih treninga). II: R rad („10×400 m sa 400 m trotom”) kao glavni + T cruise kao sporedni. III: I rad 1000/1200 m na tempu 5K ili brže kao glavni + T cruise. IV: takmičenje, lagana sredina nedelje + trka ili drugi vikend rad; primer 3×1 milja T sa 2 min pauze. Obim je „fleksibilan” i pretpostavlja visok obim (60–70 milja kod bloger-a).
- Fiziologija 5 km **[S]**: aerobni udeo >95% (Heck 1985, iz sekundarnog izvora); VO2 na MAS je ~96% VO2max; MAS korelira sa 5K brzinom (R² 0,90). Zaključak: za 5 km je VO2max rad (I) srce, T potpora, R ekonomija; dugi trk je aerobna potpora.
- Trkački početnici **[S]**: Relph et al. 2023 (IJERPH, 110 trkača na modifikovanom 9-nedeljnom Couch to 5K): samo 27,3% završilo, 19% povreda, prethodna povreda OR 7,56 za novu povredu. Buist et al. (GRONORUN, AJSM 2008, RCT n=532): „grading” po pravilu 10% **nije** smanjio povrede (20,8% prema 20,3%). **Nema dokaza** da run/walk smanjuje povrede ili povećava završetak u odnosu na kontinuirano trčanje. Komercijalne tvrdnje (npr. 66% manje povreda uz snagu) nisu proverene.
- Pfitzinger 5K/Hansons: pretraga nije dala 5K strukturu (samo maratonske planove). **[?]** Isto: Higdon/Hal 5K, Couch to 5K nedelja po nedelja nije dobijen sa izvora (plan iza paywall-a). Sledeća sesija može probati NHS Couch to 5K, Higdon Novice 5K, Daniels 5K tabele direktno.

## 3. Odluke ove sesije **[O]** (zamenjuju staru listu otvorenih odluka)

1. **VDOT iz poslednjeg PR-a.** Svi tempa (E, T, I, R, RP) izvode se iz VDOT-a najskorijeg valjanog rezultata (≤ 8 nedelja star; stariji se diskontuje; ako je rezultat sa druge distance, koristi se jednačina za tu distancu). Cilj ne menja tempo treninga — tempo je uvek vezan za potvrđenu formu, cilj se samo prikazuje. Napredak forme se uvodi samo preko izvršenih merenja (`VDOT_ALPHA`), ne unapred.
2. **Ulaz: lista rezultata** `{distM, sec, date}[]`, ne jedan PB. Za 5 km primarno se koristi 5K/3K/10K, sa najskorijim. Razlika VDOT-a sa druge distance > 3 poena beleži se kao signal izdržljivosti (važno u HM/maraton fazi, ne menja 5K plan).
3. **Profili treninga (nov koncept):** profil bira tabele doze, ne jedna kontinuirana formula.
   - **P0 Run/walk početnik:** nema PR-a, ili ne može 20 min kontinuirano, ili < 8 km/ned bez iskustva. 3 dana, **bez kvaliteta**, progresija po izvršenim sesijama (ne po kalendaru): 1/1 → … → 20–30 min kontinuirano. Bez zadatih tempa osim „razgovorno”. Evidencija za run/walk je slaba (odeljak 2), pa je to praktičan izbor, ne dokazana prednost.
   - **P1 Početnik kontinuirano:** može 30 min, < 15 km/ned. 3 dana, 1 kvalitet od ~4. nedelje (strides, kratak fartlek, T cruise), I tek u fazi III.
   - **P2 Rekreativac:** 15–35 km/ned, 4 dana, 2 kvaliteta (R/I i T), lagan dugi trk.
   - **P3 Ambiciozan:** 35–55 km/ned, 5 dana, 2 kvaliteta + strides, po potrebi srednje-dugi trk.
   - **P4 Napredni:** > 55 km/ned, 6 dana, 2–3 kvaliteta.
   - Modifikatori: povratnik posle pauze (sporiji ulaz, kvalitet kasnije), kratak ciklus (< 10 nedelja).
4. **Faze 5K (prate Danielsa):** baza/ekonomija (R, strides, kratak T cruise) → vrhunac (I 800–1200 m kao glavni, T cruise kao potpora) → oštrenje (RP/I kraće i brže). Repo već ima `economy/peak/sharpening` u `profile5k.ts`; zadržati.
5. **Doza kvaliteta:** Danielsovi budžeti ostaju gornja granica. Dodati **donji prag**: u nedeljama izgradnje (ne rasterećenje, ne taper) svaka kvalitetna sesija mora dostići ≥ 70% budžeta svoje zone za P2–P4 (60% za P1) u nedeljama vrhunca. Vrednost 70% je moja početna procena, bez dokaza; menja se samo ako trenerski pregled pokaže bolju. Cilj je da se ne ponovi stanje novog generatora (T 58% budžeta).
6. **Rasterećenje:** svake 3–4. nedelje u ciklusima ≥ 12 nedelja; u ciklusima < 10 nedelja **bez** rasterećenja osim za P0/P1/povratnike. Rasterećenje obim spušta na ~73–80% prethodne nedelje, ali **zadržava jednu skraćenu kvalitetnu sesiju** (R ili I u maloj dozi) i strides. Ne spuštati ispod 80% korisnikove baze ako je ciklus kratak.
7. **Rast obima:** najviše +10% između nedelja izgradnje (čuva se `rampStep` sa podom/plafonom); podizanje preko +10% mora imati izričit uslov. Napomena: RCT (GRONORUN) nije našao efekat 10% pravila na povrede, pa je to proizvodna heuristika za predvidljivost, ne obećanje.
8. **Dugi trk za 5 km:** ≤ 30% nedelje; ≤ 35% samo za 3 dana trčanja; uvek ≤ 90–120 min i ≤ 20 km. `longRunMaxShare 0.40` je previsok za 5 km. Dugi trk ostaje lagan (bez brzog završetka u 5K fazi).
9. **Prognoza:** uvek prikazati broj kad postoji valjan PR (opseg preko `kons`–`std`, **nikad `agr`**) plus oznaku pouzdanosti i poruku „cilj izvodljiv / nerealan u datom roku”. Ne prikazivati samo PR kao prognozu (nov generator) ni jednu tačku bez opsega (stari). Brzina napretka VDOT-a po nedelji **nije validirana** — [?] nedovoljno dokaza; prikazati kao procenu.
10. **Min nedelja:** 5K = 6 (postojeće); 10K = 8; HM/maraton se odlučuje u njihovim fazama (korisnikov HM cilj ima 9 nedelja, a oba generatora traže ≥ 10).
11. **Rasporedi:** zahtevni dani nisu susedni; za 4 dana: 2 kvaliteta + lagan dugi trk (3 od 4 dana zahtevna je gornja granica). Kad `quality = 2` a dana ≤ 3, jedan kvalitet se spaja sa dugim trkom samo u kasnoj fazi.
12. **PR #32–#35:** ostaju referenca, ne spajaju se. Nova grana od `main`. Ideje se prenose pojedinačno (odeljak 4).
13. **Testovi:** golden master (2304 scenarija) i nasleđeni oracle testovi smeju se zameniti, **ali tek kad kriterijumi iz odeljka 6 prođu**; do tada se čuvaju kao referenca (uz `generator.differential` ne lomiti bez zapisa u `docs/ENGINE_CHANGES.md`).

## 4. Šta se preuzima

| Iz novog (`fix/generator-phase3`) | Iz starog (`main`) |
|---|---|
| Početni dugi trk prati skorašnje trčanje (`recentLongRunKm`) | Danielsovi budžeti T/I/R i punu dozu |
| Fartlek u T zoni kao uvod u kvalitet | Rasterećenje sa kratkim R/I dodirom |
| Tempo vezan za potvrđenu formu | Numerička prognoza (uz opseg i poruku izvodljivosti) |
| Kočnice: bol, ponovljen težak lagani trk, neodrađene nedelje | Jednostavnost: kvalitet ne zavisi od složene „doze” |
| Preračun po izvršenju (`execution.ts`) uz zaštitu prošlih dana | Dugi trk ≤ 29% nedelje |
| Umereniji rast obima | |
| Upozorenje da je obim ispod baze za cilj | |

Za svaki preuzet deo: pročitati kod, pa ga prepisati ili prilagoditi; ne kopirati celu fazu 3.

## 5. Matrica profila za 5 km (za test)

Minimum 12, svi sa istim izlazom (plan + događaji propuštena nedelja / povratak / bol):

| ID | Profil | km/ned | Dani | Kvalitet | Ciklus |
|---|---|---|---|---|---|
| A1 | P0 run/walk, bez PR-a | 0–5 | 3 | 0 | 8–12 ned |
| A2 | P0 run/walk, 30 min hoda dnevno | 5 | 3 | 0 | 6 ned |
| B1 | P1 početnik, PB 33:00 | 12 | 3 | 1 | 12 ned |
| B2 | P1 povratnik posle 8 ned pauze | 10 | 3 | 1 | 10 ned |
| C1 | P2 rekreativac PB 25:00 | 25 | 4 | 2 | 12 ned |
| C2 | P2 PB 23:45, cilj sub-20 | 30 | 4 | 2 | 16 ned |
| C3 | P2 PB 22:00 | 35 | 4 | 1 | 10 ned |
| D1 | P3 PB 20:35 | 50 | 5 | 2 | 16 ned |
| D2 | P3 PB 20:25 (korisnik) | 30 | 4 | 2 | 9 ned |
| E1 | P4 PB 17:30 | 70 | 6 | 2 | 12 ned |
| E2 | P4 PB 17:30 | 70 | 6 | 3 | 8 ned |
| F1 | Kratak ciklus P2 | 25 | 4 | 2 | 6 ned |

(Raspodela je predlog; popuniti tačne PB i ulaze i zaključati u `inputs.json`.)

## 6. Kriterijumi zatvaranja 5 km faze

**Tvrdi (programski, svi profili):**
- Zbir dana = nedeljni obim; `sessKm` jednak km u danu; nema NaN/praznog opisa.
- Tempa T/I/R/E odgovaraju `paceForZone(VDOT, zona)` iz najskorijeg rezultata; promena PR-a menja sva tempa konzistentno.
- Dnevni i nedeljni budžeti: I ≤ 8%, R ≤ 5% (po sesiji i po nedelji kako se potvrdi), T ≤ 10%, kontinuirani T ≤ 20 min, rep I ≤ 5 min, rep R ≤ 2 min.
- Dugi trk ≤ 30% (35% za 3 dana) i ≤ 120 min i ≤ 20 km.
- Skok obima među nedeljama izgradnje ≤ +10%.
- Zahtevni dani nisu susedni; rasterećenje nije ispod 80% baze u kratkim ciklusima.
- Donji prag doze: svaki kvalitet u vrhuncu ≥ 70% budžeta zone (P2–P4).
- P0 plan nema kvalitet; napredak je po izvršenim sesijama.
- Deterministički (isti ulaz → isti hash).

**Ocena trenera (ručna, sa obrazloženjem, označena kao procena):**
- Faza ekonomija → I vrhunac → oštrenje je prepoznatljiva u svakom profilu.
- Doza kvaliteta po profilu je smislena (I/T/R minuti, ne samo kilometri).
- Rasterećenje i taper zadržavaju oštrinu.
- Poruka o izvodljivosti cilja je tačna i bez izmišljenih brojeva.

Pravilo nalaza: profil, nedelja/dan, očekivano i dobijeno, ponovljiv ulaz, zašto je bitno. Hipoteza bez dokaza ostaje hipoteza.

## 7. Redosled rada u 5K fazi

1. Pročitati `qualityDose.ts`, `generatePlan.ts`, `profile5k.ts`, `constraints.ts`, `deload.ts`, `longRunProgression.ts`; zapisati šta svaki radi.
2. Potvrditi **po sesiji ili po nedelji** za Danielsove procente (izvor: knjiga ili više javnih izvora); zabeležiti rezultat u ovaj fajl.
3. Zaključati matricu iz odeljka 5 (`inputs.json`), napisati skriptu koja generiše staro/novo/gradi i izračunava metrike iz odeljka 6.
4. Napraviti grananje od `main`, implementirati profile i dozu iz odeljka 3; prvo P2/P3 (najveći broj korisnika), pa P0/P1, pa P4.
5. Petlja: generiši → metrike → pregled po profilu → popravi, dok svi kriterijumi ne prođu. Bez dodatnog pitanja korisniku.
6. Tek posle: osvežiti golden master, `npm run check`, E2E, i tek na zahtev PR.

## 8. Šta nije urađeno / nije poznato

- **[?]** `qualityDose.ts` i fazu 3 generatora nisam čitao; zaključci o dozi su iz izlaza.
- **[?]** Danielsovi procenti: po sesiji ili po nedelji; apsolutni plafoni I (10 km?) i R (8 km?) nisu potvrđeni.
- **[?]** Primarni izvori (Daniels, Pfitzinger, Hansons) nisu čitani; plan Couch to 5K i Higdon 5K nedelja po nedelja nije dobijen.
- **[?]** Ocene četiri AI trenera u #35 nisu završene; nezavisne validacije nema.
- **[?]** Brzina napretka VDOT-a po nedelji (0,15 / 0,25 / 0,43) nije validirana.
- **[?]** Lični Excel plan korisnika (PR #31, nedelje 4–12, 16 tempo dana @ 4:30) nije poređen.
- Nijedna promena koda generatora nije napravljena; ništa nije deployovano.

## 9. Izvori korišćeni u ovoj sesiji

- VDOT jednačine i zone: https://rundida.com/tools/vdot-calculator/
- Danielsov 5K–10K plan (fazama): https://runningwithrock.com/my-experience-with-phase-iv-of-jack-daniels-5k-10k-plan/
- Procenti doze i dugi trk (prikaz knjige, nije primarni): https://www.teesche.com/bookshelf/jack_daniels_daniels_running_formula, https://www.coachray.nz/2023/05/03/jack-daniels-running-intensity/
- Couch to 5K, injuries/completion (Relph 2023): https://pmc.ncbi.nlm.nih.gov/articles/PMC10487403/
- GRONORUN, RCT 10% pravila: https://www.ncbi.nlm.nih.gov/pmc/articles/PMC1821023/ (dizajn); rezultat: https://research.rug.nl/en/publications/no-effect-of-a-graded-training-program-on-the-number-of-running-r/
- 5K energetika: https://pubmed.ncbi.nlm.nih.gov/37198204/ (MAS), https://researchportal.plymouth.ac.uk/en/publications/validity-of-treadmill-derived-critical-speed-on-predicting-5000-m/

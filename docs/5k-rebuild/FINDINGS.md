# 5K — nalazi (segment 1/10)

Polazno stanje: grana `claude/generator-isolation-5k-10k-hm-marathon`, commit `148c1c1`. Dokazi su u `reference/` (fajl po
profilu; `metrics.md` je pregled). Putanje koda relativne prema `web/src/domain/generators/fiveK/` osim gde piše drugačije.

**Statusi**
- **potvrđena greška** — izlaz protivreči sopstvenom pravilu/nameri koda ili je tehnički neispravan; uzrok pokazan u kodu.
- **trenerska odluka za raspravu** — izlaz je dosledan kodu, ali je pravilo izbor bez dokaza u repozitorijumu; menja se tek uz
  odluku i obrazloženje.
- **subjektivna ocena** — moje zapažanje; bez merila ne opravdava izmenu.
- **kandidat** — mehanizam viđen u kodu, posledica nije zasebno izvršena.

**Izvori koji NISU pregledani:** `SUB19_IZVESTAJ_40_PLANOVA(1).txt` i `SUB19_DETALJAN_PREGLED_SVIH_TRENINGA(1).txt` ne postoje ni u
radnom stablu ni u jednoj grani (`git ls-tree` svih referenci). Šta tvrde — **ne znam**. Pregledani su originalni QA ulazi
`docs/qa/generator-final/inputs.json` (U01–U03, set `qa/`) i raniji izveštaji (`docs/qa/generator-final/REPORT.md`,
`docs/qa/generator-final/coaches/5k-review.md`). Ocene AI trenera iz tih izveštaja navodim samo kao trag, ne kao dokaz.

---

## A. Izolacija

### F13 — Prikazani tempo i prijem merenja forme su zajednički, ne 5K — **potvrđena zajednička zavisnost**
- Dokaz u kodu: `web/src/features/session/useEasyPace.ts:15–17` laki tempo = `currentVdot(vdotLog)` (zajednički) →
  `generator.paceForZone`; isto `features/today/WeatherCard.tsx:42`; lanac se preračunava u `stores/actions.ts:30–33`,
  `stores/dayActions.ts:52` zajedničkim `recomputeVdotChain` sa zajedničkim `VDOT_ALPHA` (`domain/training/constants/heuristics.ts:50`).
  Koje merenje uopšte ulazi odlučuje zajednički `classifyMeasurement` (`domain/training/adaptation/measure.ts:39`: R se ne meri,
  automatski unos koji odstupa > 4 VDOT se odbacuje). 5K za predlog tempa koristi sopstveni lanac (`training/adaptation/evidence.ts:122`).
  `features/today/EntryForm.tsx:7` koristi zajednički `effectivePace`.
- Posledica: promena 5K politike tempa/forme ne menja tempo koji korisnik vidi na ekranu dana i u kartici vremena; dve „forme" mogu
  da se raziđu (prikazana iz zajedničkog lanca, korišćena za predlog iz 5K lanca).
- Segment: **2** (preduslov za svaku izmenu tempa).

### F12 — Faza nedelje u prikazu nije faza 5K plana — **potvrđena greška (prikaz)**
- Dokaz: D03 N2–N3 prikaz „BAZA", a nedelje imaju Fartlek i Tempo isprekidan (`baseWeeks: 0`); D04 N2 „BAZA" uz Fartlek.
  `reference/dev/D03.json` → `analysis.weeks[].displayPhase` prema `sessions`.
- Uzrok: `web/src/domain/plan/describe.ts:60–77` računa fazu po udelu plana (BAZA ≤ 30 %, RAZVOJ ≤ 65 %), nezavisno od `baseWeeks`
  i od `phase5K` (`training/distances/profile5k.ts:48`, granice 25 %/75 %).
- Posledica: korisnik vidi periodizaciju koju generator ne primenjuje. Segment: **2** (izvor faze mora doći iz generatora) / **10** (prikaz).

## B. Tehnička ispravnost

### F01 — Plan sa 2 dana bez kvaliteta kolabira na 0,1 km — **potvrđena greška**
- Dokaz: E28 (početnik, 2 dana, 4 km/ned): nedelje 1–6 po 0,1–0,2 km („Trčanje/hod 0.1"), taper 5,7 km, trka 5 km; upozorenja
  „plan prve nedelje daje oko 0 km", „Isporučeni vrhunac 0.2 km/ned". `reference/edge/E28.json`.
- Uzrok: `training/generator/generatePlan.ts:394–424` `finalizeWeek`: plafon LR = `rest·0,4/0,6`, zatim svaki lak dan ≤ LR. Sa
  jednim lakim danom i bez sesije (`maxQ = 0`) svaki prolaz množi oba dana sa ≈ 0,667; 30 prolaza → tačka `r1(0,1·0,667) = 0,1`.
- Posledica: neupotrebljiv plan za izbor koji čarobnjak nudi (2 dana). Segment: **4**.

### F02 — Za 2 dana pravila „LR ≤ 40 % nedelje" i „LR je najduže trčanje" se isključuju — **potvrđena greška (logička)**
- Dokaz: D16 (15 km/ned) vrhunac 10,7 km, LR udeo 0,51 svake nedelje; E21 (25 km/ned) vrhunac 11,7 km. Sa dva trčanja LR ≥ drugo
  trčanje ⇒ udeo ≥ 0,5 > 0,4; obim se drži samo podom `maxQ·1,05` (`generatePlan.ts:406–412`).
- Dodatno: isti plafon ima dve vrednosti — `allocation.ts:46` `capShare` 0,68 za 2 dana, ali `targetLR.maxShare` (= `longRunMaxShare`
  0,4) ga uvek zamenjuje; `finalizeWeek` koristi 0,4.
- Posledica: obim 2-dnevnog plana zavisi od veličine kvalitetnog dana, ne od unete baze. Segment: **4** (+ **6**).

### F03 — Podrazumevani raspored za 2 dana stavlja kvalitet odmah posle dugog — **potvrđena greška**
- Dokaz: D16: 8 puta „Dugo (LR) Ned → kvalitet Pon"; E21 isto. Plan sam izdaje upozorenje „Teški dani zaredom: Ned → Pon",
  iako korisnik nije birao dane.
- Uzrok: `training/generator/daySlots.ts:20` `EASY_DAY_ORDER` počinje ponedeljkom; za 1 preostali dan `idx(1,2) = 0` → q1 = Pon
  (`:96–103`). Upozorenje `:118` je pisano za korisnički izbor.
- Posledica: izbegljivo uzastopno opterećenje uz 5 slobodnih dana. Segment: **4**.

### F04 — Upozorenja navode brojeve plana koji korisnik ne dobija — **potvrđena greška**
- Dokaz: D07 u istoj listi: „plan prve nedelje daje oko 32 km", „plan realno dostiže oko 32 km/ned", a zatim „Isporučeni vrhunac
  28.5 km/ned"; isporučena prva puna nedelja 27,7. E28: „oko 0 km".
- Uzrok: provera prve nedelje i strukturnog plafona (`generatePlan.ts:1086–1160`) računa se pre završnog `finalizeWeek`/
  `constrainWeek` (`:1164–1208`) i pre odsecanja dana pre početka (`:1171`); prva nedelja u proveri je puna, a isporučena je delimična.
- Posledica: netačna informacija pri izboru broja dana/obima. Segment: **5**.

### F05 — Rezultat sporiji od ~42:30 daje VDOT ispod tablice, a plan se ipak pravi — **potvrđena greška (ulaz)**
- Dokaz: E29 (5K 45:00) VDOT 18,7; E10 (99:59) VDOT 5,6, laki tempo 21:57/km, „Trkački ritam 3×100 m @ 20:00/km".
  Granica tablice proizvoda je 20–85 (`training/constants/product.ts:9–10`, `vdotPossible`). Čarobnjak prima 5K do 99:59
  (`web/src/domain/onboarding/index.ts:14–19`); `validateInput.ts` proverava samo tempo 2:20–20:00/km.
- Kandidat (nije izvršeno): merenja sa takvih treninga bi zajednički `classifyMeasurement` odbio kao `impossible`, pa forma ne bi
  mogla da se ažurira.
- Posledica: tempa iz ekstrapolacije van modela; realna populacija (spori početnici/hodači). Segment: **3**.

### F21 — Unutrašnja doslednost plana — **prolazi (osnovna linija)**
- 49 generisanih 5K planova: 0 razlika `vol` = zbir dana, `km` = `sessKm`, opis = `sessDesc`, tempo T/I/R = zona iz `vdot0`,
  nema NaN/praznih opisa (`analysis.issues` prazno). Deterministički (dva poziva isti hash) i isti hash pod `TZ=UTC` i
  `TZ=Pacific/Kiritimati`. Gornje granice: najviše I 8 %, T 10 %, R 4,9 % nedelje; nijedna I deonica > 5 min, R > 2 min, T > 20 min.
- Ovo **ne** potvrđuje trenerski smisao. Segment: čuva se kao regresija u svakom segmentu.

### F14 — Ista granica zapisana dvaput, različito; mrtvi parametri — **potvrđena neusklađenost (nizak uticaj)**
- `training/constants/distances.ts:115–117` I `maxKm 8`, R `maxKm 5` naspram `training/sessions/constraints.ts:15–29` I 10 km,
  R 8 km. Razlika deluje tek iznad ~100 km/ned (E09: I 7,2 km). `introShare` (`distances.ts:119`) se nigde ne čita;
  `intervalPaceForWeek` je identitet, a komentar (`profile5k.ts:185–186`) tvrdi vezivanje za tempo trke.
- Segment: **7**.

## C. Struktura, progresija i doza

### F06 — Deload skoro nikad ne zadržava skraćen kvalitet — **potvrđena neusklađenost namere; sama politika je trenerska odluka**
- Dokaz: razvojni skup 3/30 deload nedelja ima kvalitet; svi skupovi 12/84. Fokus nedelje i dalje kaže „DELOAD — obim dole,
  ostaje kratka oštrina" (ostaju samo ubrzanja 4×15 s).
- Uzrok: namera `generatePlan.ts:876` („jedna kratka oštrina umesto potpunog brisanja"); `training/sessions/deload.ts`
  `floor(reps·0,6) < 2 → null` (`:11–12`). Poslednja sesija pre deload-a je po rotaciji uvek „Tempo isprekidan" sa 2–3 deonice
  (`profile5k.ts:171–173`, deload na `w % 4 = 0` → prethodna nedelja ima neparan `qualW`).
- Segment: **8**.

### F07 — Repeticije (R) praktično ne postoje — **potvrđena neusklađenost sa opisom profila; da li R treba — trenerska odluka**
- Dokaz: 14/17 razvojnih profila ima 0 R sesija (D05, D10, D17 po 1). Opis `profile5k.ts:1–5` kaže da R gradi ekonomiju „rano i
  ponovo pred trku".
- Uzrok: ekonomija = prvih 25 % kvalitetnih nedelja (`profile5k.ts:48–53`); za `developing`/`beginner`/`returning` te nedelje
  pokriva `introductoryQuality` (`qualityDose.ts:25,56–58`); za `experienced` R samo kad `qualW % 3 = 0` (`profile5k.ts:155–156`);
  oštrenje bira RP ili I.
- Segment: **7**.

### F08 — Mala doza I rada i dominantno zagrevanje/hlađenje kod `developing` — **trenerska odluka za raspravu**
- Dokaz: I rad nedeljno najviše 1,8 (D03), 2,0 (D04), 2,4 km (D11, D12, D15) uz vrhunac 38–45 km (≈ 5–6 % prema plafonu 8 %);
  ponavljani formati sa 2 deonice (D03 N5/N7 2×800 m, D04 N5 2×1000 m); D03 N5 sesija 6,4 km = 2,5 km zagrevanja + 1,6 km rada
  + 2,1 km hlađenja. Raniji AI pregled U02 beleži isto (trag, ne dokaz).
- Uzrok: `qualityDose.ts:29–53` (`INITIAL_DOSE`, `FAST_WORK_SECONDS`) + dopuna zagrevanja/hlađenja `generatePlan.ts:963–999`.
- Segment: **7**.

### F09 — Rast obima > 10 % pri malom obimu — **trenerska odluka za raspravu**
- Dokaz: najveći rast prema poslednjoj punoj ne-deload nedelji: D13 1,16, E10 1,18, QA-U01 1,15, D01 1,13.
- Uzrok: apsolutni minimalni korak (`distances.ts:106–110`, kons 1,2 km) i tolerancija isporuke `DELIVERED_GROWTH_FACTOR 1,6`
  (`training/constants/heuristics.ts:35`, `generatePlan.ts:563–564`). Pravilo 10 % nije dokazano (`GENERATOR_REBUILD_CONTEXT.md` §2
  navodi GRONORUN bez efekta — sekundarni zapis, nisam proverio original).
- Segment: **5**.

### F10 — Obim stagnira na 55 km odredištu — **trenerska odluka za raspravu**
- Dokaz: D05 (50 km): nedelje 5–14 između 51,7 i 56,7 km; D17 (60 km) najviše 68.
- Uzrok: `targetVolumeKm 55` (`distances.ts:111`) + undulacija (`distances.ts:95`, `generatePlan.ts:321–325`).
- Segment: **5**.

### F11 — Udeo dugog trčanja do 40 % (51 % za 2 dana) — **trenerska odluka za raspravu**
- Dokaz: LR udeo 0,40 u D01, D02, D07, D10; 0,51 u D16/E21 (v. F02).
- Uzrok: `longRunMaxShare 0.4` (`distances.ts:120`). Predlog ≤ 30–35 % u `GENERATOR_REBUILD_CONTEXT.md` je označen kao odluka bez
  dokaza.
- Segment: **6**.

### F15 — Tempo trke = sporiji od cilja i trenutne forme — **trenerska odluka za raspravu**
- Dokaz: D04 cilj 19:59 (4:00/km), RP sesije i trka 4:05/km; E12 (cilj sporiji od PB-a) RP i trka po sporijem cilju.
- Uzrok: `generatePlan.ts:328–330`. Segment: **7** (RP sesije) / **8** (dan trke).

### F16 — Delimična prva nedelja zadržava kvalitet i dugo, a laki dani otpadaju — **subjektivna ocena**
- Dokaz (start u četvrtak): D05 N1 = Tempo isprekidan 2×1100 m (Pet) + LR 14 km (Ned); D06 N1 = T + LR 18 km + lako; E22 (start u
  nedelju) prvi dan je LR 8 km.
- Uzrok: nedelja se gradi cela, pa se odsecaju dani pre početka (`generatePlan.ts:1171–1183`). Segment: **5**.

### F17 — Lak dan posle deload LR-a duži od tog LR-a — **subjektivna ocena**
- Dokaz: D07 Pon 10,2 km posle LR 7,5 km; D03 7,6 posle 6,3; D04 10 posle 8,5 (`analysis.afterLongRun`).
- Uzrok: `capAfterLongRun` preskače kad je prethodna nedelja deload (`generatePlan.ts:784–795`). Segment: **5/6**.

### F23 — Isporučiv obim zavisi od tempa preko vremenskih plafona — **trenerska odluka / granični slučaj**
- Dokaz: E08 (uneto 200 → interno 120) isporučuje 68–71 km na 7 dana; E09 (PB 12:00, 100 km) isporučuje 94.
- Uzrok: LR ≤ 90 min (`distances.ts:113`), lak dan ≤ 14 km (`allocation.ts:59–60`), `MAX_INPUT_WEEKLY_KM 120`. Segment: **5/6**.

### F24/F25 — Deload u run/walk bazi; taper sa dva kvaliteta — **subjektivna ocena**
- D01 N4 je deload usred run/walk lestvice; taper je 0,54–0,66 vrhunca i u 4+ dnevnim planovima nosi 2 kvaliteta; aktivacija je
  dan −2. Bez merila ne tražim izmenu. Segment: **8**.

## D. Adaptacija (proba: danas = start + 5 nedelja, pet zapisa dnevnika, `reference/dev/*.json` → `adaptation`)

### F18 — Signal umora čita samo lake dane — **kandidat**
- Dokaz: D16 (2 dana, nema lakih dana) — dva treninga sa RPE 8 ne daju preporuku (`high → kind null`); ostali profili daju `reduce`.
- Uzrok (kandidat): `training/execution.ts` `easyHighRpeCount`, prag `highEasyRpe 7`. Segment: **9**.

### F19 — Nema prilagođavanja kad je do trke < 4 nedelje — **trenerska/proizvodna odluka**
- Dokaz: D04 (9 nedelja) u 6. nedelji sva tri razloga daju „Do trke je manje od četiri nedelje…". Segment: **9**.

### F20 — Smanjenje posle podizvršenja briše kvalitet nedeljama — **kandidat (uzrok nije razdvojen)**
- Dokaz: D01 `under`/`high`: kvalitet 0 u svim preostalim nedeljama (pre: 4 nedelje sa kvalitetom); D13 `under`: 1 od 7;
  D10 `high`: nedelje 2–5 bez kvaliteta.
- Kandidati: `plan/returnGrowth.ts:14–24` (cela sesija → lako kad nedelja pređe 1,08× baze), ponovno generisanje sa manjim obimom
  (`plan/regenerate.ts:73`), `easyReturnWeeks`. Nije izolovano koji deluje. Segment: **9**.

## E. Ograničenja ulaza (nisu greške generatora)

- **F22** — Profil bez rezultata nije podržan: čarobnjak ne prolazi korak 2 bez vremena (E26). Nije zamenjeno izmišljenim PB-om.
  Apsolutni početnik bez merenja se ne može predstaviti. Segment: **3** (proizvodna odluka).
- Rezultat iz budućnosti odbija i čarobnjak i generator (E25). Trka > 104 nedelje: greška (E06).
- 3 km test nije ponuđen kao rezultat u čarobnjaku (`PB_SANITY` ima samo 5K/10K/HM/M).

## F. Raniji nalazi — stanje

| Izvor | Nalaz | Sada |
|---|---|---|
| FINAL-REPORT §6 | 5K „pun pristup" traži LR ≥ 5 km | i dalje (`athleteAssessment.ts` `requiredLR = 5`); D03/D04 „Dužinska priprema ima osnovu u podacima" — trenerska odluka, segment 10 |
| FINAL-REPORT §6 | `recalibratedPlan`/`reentryPlan` bez ekrana | nije ponovo provereno |
| FINAL-REPORT §2 | `experienced` slabo pokriven referencom (nevažeće `'regular'`) | ovde pokriven: D05, D06, D14, D17, E09, E17 |
| REPORT R05 | aktivacija u ponovo sastavljenom planu gubi `nemeri` | nije ponovo provereno |
| REPORT R07 | ponavljanje run/walk koraka počinje u ostatku nedelje | nije ponovo provereno |
| 5k-review (AI) | kratki fartleci, 2 deonice, dug padding (U02) | reprodukovano kao F08 |

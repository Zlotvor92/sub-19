# QA1 — nezavisna recenzija motora V4 (`engine/` + `fitness/`), 12. 11. 2026

Stanje koda: `claude/v4` @ `6846fd8`. Pročitan ceo `engine/` i `fitness/` (bez `distances/hm/` — služio je samo kao
ulaz). Ništa u kodu nije menjano. Svaki nalaz osim onih označenih „sumnja" potvrđen je pokretanjem javnog izvoza
(`npx vite-node`, skripte van repozitorijuma); „dobijeno" su brojevi iz tih pokretanja. Ulaz „osnovni" znači:
`today 2026-11-15`, dani uto/čet/sub/ned, dugi nedelja, 30–40 km nedeljno, rezultat 10 km 46:00 ili HM 1:41:00.

Zbir: **kritično 1 · ozbiljno 6 · sitno 13 · sumnja 3.** Nije nađeno: nedeterminizam istog ulaza (6 468 planova, dva
puta svaki, bajt-isti), pad ili `NaN`/ISO datum u ispisu plana, rupa u datumima (prestupna 2028, prelaz godine,
1–60 nedelja, 1–7 dana, VDOT 22–75, 5–150 km), nestabilnost (`replan([])` uvek isti objekat; 111 dana po planu bez
lažnih promena), ime distance ili uvoz van `v4/` u motoru, `Date` sa lokalnom zonom, petlja „skrati pa dopuni".

## 1. Nalazi

### Kritično

| # | pravilo | gde | najmanji ulaz | dobijeno → očekivano | ispravka |
|---|---|---|---|---|---|
| K1 | § 7.2 (test = VDOT rezultata), § 4.3 (test ima zagrevanje i hlađenje) | `fitness/estimate.ts:87`, `engine/select.ts:541` | HM plan, osnovni ulaz; planirana provera forme 17. 11. odrađena kako piše i upisana kao JEDNA aktivnost vezana za dan (`effort: 'test'`, 9,2 km za 47:11 = zagrevanje + 3 km + hlađenje) | forma 1:41:59 → **1:54:07**, sva tempa sporija 32 s/km; drugi test 5. 1. još −14 s/km → VDOT treba da se računa samo iz deonice punog napora | U ugovor `Run` upisati šta nosi trčanje testa (samo deonica, ili krugovi `work`), a `resultEvidence` neka koristi krugove rada / `planned` dužinu kad trčanje nosi `dayId` dana testa. |

Napomena uz K1: ništa u ugovoru danas ne sprečava da aplikacija pošalje celu aktivnost (Strava daje jednu); testovi
motora to ne vide jer `runsAsPlanned` nikad ne postavlja `effort`. Ako F9 garantuje isečenu deonicu, nalaz pada na
„ozbiljno (nedokumentovan ugovor)".

### Ozbiljno

| # | pravilo | gde | najmanji ulaz | dobijeno → očekivano | ispravka |
|---|---|---|---|---|---|
| O1 | R12, kapija kruga 2 („ništa" → prognoza se ne pogoršava) | `engine/state.ts:151–172`, `engine/types.ts:764` | HM, 16 ned, 4 dana, `estimateForm`; svaki trening odrađen tačno po planu, dan za danom | očekivano na dan trke 1:39:02 → **1:40:10 (+68 s)**, klizi oko 5 s nedeljno bez ijedne rečenice (svaki korak < 20 s) → stabilno | Motor da preda `planned.weeks` (ciljevi nedelja) i `baseLoad`/`peakLoad` iz `doc.header.decisions`, kako F4-REPORT traži; test „po planu" sa pravim `estimateForm`. |
| O2 | § 5.3, § 2.4 (nov korisnik dobija smislen plan) | `engine/state.ts:73–93` | osnovni + `weeklyKm: 40` + JEDNO trčanje staro 200 dana | baza 1,9 BO; 1. nedelja = „dugi 0,5 km, 3 min"; sa trčanjem starim 50 dana baza 71 umesto 235 → izjava važi kad istorija ne pokriva poslednjih 42 dana | Seme iz izjave primeniti na deo prozora od 42 dana koji istorija ne pokriva (ili: retka istorija → izjava + upozorenje), ne vrteti nule od prvog trčanja. |
| O3 | § 6.2 k. 10 (dan pre trke: odmor ili ≤ 20 min) | `engine/build.ts:247` | osnovni, trka u PONEDELJAK 25. 1. 2027. | nedelja 24. 1. (dan pre trke): **dugi 10 km / 59 min**, subota lagano; čuvar ćuti → odmor ili ≤ 20 min | `eve` računati za nedelju koja sadrži dan pre trke, ne samo za nedelju trke; čuvaru dodati proveru dana pred trku. |
| O4 | § 7.6 (`byFeel: false` kad stigne prvi rezultat), R10 (tekst = plan) | `engine/replan.ts:102–135` | plan po osećaju (samo lagani tempo 6:12); test 5 km 21:00 | tempa prelaze na brojeve, ali upozorenje `nema-podataka` ostaje: „Brzi treninzi su zadati po osećaju… istrči test od 3 km"; a kad je \|Δ\| < 0,3 VDOT (test 23:12) i `byFeel` ostaje `true` (sa `declaredForm` trajno) | U `onResult`: `byFeel = false` uvek kad rezultat postoji i `refreshWarnings` kao kod ostalih događaja. |
| O5 | § 8.1 (neispravan unos se odbija, ne ruši) | `engine/state.ts:275`, `engine/dates.ts:15`, `engine/plan.ts:59`, `engine/guard.ts:55–124` | `buildState({ today: 'abc' })`; ili `pain: [{ date: 'x', level: NaN }]` | `RangeError: Invalid time value` (izuzetak) → `InputError datum-neispravan`; `validate` ne gleda `pauses`/`pain` | `buildState` da ne računa nad neispravnim `today`; `validate` da proveri datume i nivoe pauza i bola. |
| O6 | § 3 (`result` izveden iz `Run.effort`), § 6.5 | `engine/events.ts:55` | plan napravljen 15. 11; trka 10 km 43:00 istog dana, upisana posle | `deriveEvents` → `[]` zauvek (uslov `run.date > eventsFrom`); nema rampe, plan trči po VDOT 44,1 dok stanje kaže 47,7 → događaj `result` | Rezultat pratiti po `id` u `appliedEvents` (ili `>=`), ne po datumu strogo posle `eventsFrom`. |

### Sitno

| # | pravilo | gde | ulaz | dobijeno → očekivano | ispravka |
|---|---|---|---|---|---|
| S1 | § 6.1 bajt-isti izlaz | `engine/plan.ts:49–68`, `state.ts:211–216` | iste dve pauze i dva bola u obrnutom redosledu u `facts` | dani isti, `header.adjustments` drugim redom → drugi bajtovi | Sortirati pauze i bol u `buildState` (datum, pa nivo). |
| S2 | R10, § 10 | `engine/replan.ts:646–669` | pauza 1–10. 3. (buduća) preko dana trke 7. 3. | „Pauza… trajala je 10 dana… do 20. 3. su treninzi kraći… od 21. 3. plan se nastavlja" — prošlo vreme za buduću pauzu, datumi posle trke, nijedna reč da pauza pokriva trku | Buduća pauza: „traje od–do"; kraj teksta ograničiti na dan trke; upozorenje kad pauza pokriva dan trke. |
| S3 | § 10 | `engine/replan.ts:726–738` | `goal-change` koji menja samo `raceName` | „Ciljno vreme je promenjeno na 1:40:00" (vreme nije menjano) | Rečenicu birati po polju koje se stvarno razlikuje. |
| S4 | § 6.4 (trka je poslednji trening), § 1.2 | `engine/replan.ts:521–531` | cilj pomeren na sutra (čet), a subota iste nedelje je urađena unapred / zaključana | zaštićen dan ostaje POSLE trke (čuvar: `trka`); trka pomerena na zaključan dan ga tiho prepiše | Zaštićene dane posle nove trke izostaviti uz `Change`; prepisan zaključan dan navesti u promenama. |
| S5 | § 6.4, `teski-uzastopno` | `engine/build.ts:781–812` | `availability-change` na 7 dana, a čet 14. 1. zaključan kvalitet | novi raspored stavlja kvalitet u sredu pored zaključanog četvrtka; nedelja = pun raspored + zaštićen dan | Pri rasporedu nedelje zaštićene dane uzeti kao zauzeta mesta i oduzeti im opterećenje. |
| S6 | § 8.1 opseg | `engine/replan.ts:395`, `:445` | `pain level 11`; `form-update vdot 300` | „jak bol (nivo 11)"; „1:41:58 → 29:18, tempa ubrzana za oko 219 s po kilometru" | Nivo 1–10; VDOT u razumnom opsegu (npr. 20–90), inače događaj se ne primenjuje. |
| S7 | § 10 (brojevi iz stanja) | `engine/replan.ts:312` | propušten dugi 18 km; sledeći dugi je rasterećenje 12,5 km | „sledeći isti trening (13. 12.) ostaje na toj dužini umesto da raste", a plan se ne menja i dugi je 12,5 km | Kad je sledeći dugi već kraći, reći „sledeći dugi je ionako kraći; plan ostaje isti". |
| S8 | § 10 | `engine/replan.ts:700–709` | bol nivo 5 prijavljen sa datumom od pre 20 dana | tekst nalaže odmor i lagano za dane koji su prošli („do 29. 11."), menja se 1 budući dan | Za prošle prozore opisati samo ono što još važi od danas. |
| S9 | § 14.2 padeži | `engine/guard.ts:418` | 2–4 nedelje do trke | „Do trke je 2 nedelje" → „Do trke su 2 nedelje" (je samo uz 1 i 5+) | Glagol kroz istu funkciju množine. |
| S10 | § 14.2 padeži | `engine/guard.ts:641` | 3 ili 4 tražena dana, `dan-izostavljen` | „izlaziš svih 3 dana" → „sva 3 dana" (svih tek od 5) | Zamenica kroz `pluralForm`. |
| S11 | § 14.2 (bez ISO datuma) | `engine/guard.ts:265, 275, 281, 298` | bilo koji nalaz po danu (ide trkaču kao `rucno`, § 9.4) | „…plafona podražaja (2026-11-19)." | `fmtDate` u porukama nalaza. |
| S12 | R10 („Polazim od tvojih ≈ X km") | `engine/render.ts:220–226` | baza iz stvarnih trčanja sa kvalitetom | `baseLoad` (BO) se ispisuje kao minuti i km; tačno samo kad je baza iz izjave | Ispisati minute iz `state.weeks` ili BO ÷ prosečna težina. |
| S13 | AGENTS t. 8 (upotrebljivost) | `engine/build.ts:518–522`, `:562` | HM, 5 km nedeljno, 3 dana | provera forme 7,5 km / 51 min u nedelji čija je baza 40 min (116 BO uz cilj 89); „dugi 10 min" uz lagan dan od 20–25 min | Test skalirati ili pomeriti kad sam prelazi cilj nedelje; dugi ne ispod `minEasySec`. |

### Sumnja (nije dokazano pokretanjem ili je stvar odluke)

- **U1.** `fitness/estimate.ts:538–596`: pad baze, trend pulsa i nedeljna rečenica se primenjuju „nedeljom ILI danas".
  Zapis sa današnjim datumom sutra nestaje i može da se pojavi pod drugim datumom — istorija „zašto" nije stabilna iz
  dana u dan. Nisam uspeo da proizvedem skok > 20 s bez objašnjenja (0 u 111 dana), pa ostaje sumnja.
- **U2.** Trkač sa 10 km nedeljno koji traži 4 dana dobija 2 treninga nedeljno u 21 od 22 nedelje (R3 vrh ≤ 1,40 × baza
  + najkraće trčanje 25 min). Pravila su poštovana i upozorenje postoji; pitanje je trenerska odluka, ne greška koda.
- **U3.** Izvedena pauza koja traje daje nov događaj svaki dan (`pause:od:do` sa novim `do`): 6 primenjenih događaja i
  6 poruka za jednu pauzu od 9 dana. Stabilno i determinističko, ali trkač čita istu vest šest puta.

## 2. Testovi

**Šta je jako.** 462 testa zelena (18 fajlova, ≈ 6 s). Probna sabotaža u scratch kopiji (jedna izmena, pa
`vitest run engine fitness`): **36 od 42 izmene obara bar jedan test.** Uhvaćeno, između ostalog: zaštita
(zaključan / ručni / urađen dan, dan trke, zaštićeni dani pri promeni cilja), stabilnost (`replan` vraća kopiju →
10 testova), R1, R2a, R3 (rast i vrh), R4 (dan ne otpada; dugi ≤ udeo), R5, R6, R7, R8b/c, R9 (povratak i pomeren
test), R11, § 14.1, § 14.6 (blok i 75 %), izveden umor, `validate`, ISO datum u ispisu, kanonski zapis, R12, R13, R14,
pad forme u pauzi.

**Šta nijedan test ne hvata (sabotaža prošla zeleno):**

| pravilo | sabotaža | posledica |
|---|---|---|
| R2b: lagan dan ≤ 1,25 × prethodna nedelja | uklonjen plafon (`build.ts:555`) | pravilo može da nestane neprimećeno |
| § 6.2 k. 10: dan pred trku ≤ 20 min | `RACE_EVE_MAX_SEC` 1200 → 6000 | isto; zato ni O3 nije uhvaćen |
| R8a: rečenica i kad se plan ne menja | isključeno `obavestenje` (`replan.ts:895`) | propušten ključni trening bez ijedne reči |
| § 7.6: histereza tempa 14 dana | `PACE_UPDATE_DAYS` 14 → 0 | tempa mogu da „šetaju" svaki dan |
| § 6.2 (nepotpuna nedelja) | `weekFraction` uvek 1 | prva nedelja sa 1–2 dana dobija pun cilj |
| AGENTS 9a: puls se ne koristi na intervalima | uklonjena provera krugova rada (`estimate.ts:161`) | jedino pravilo vlasnika o pulsu bez testa |

**Slabe tačke skupa (bez sabotaže):**
- Mreža ulaza ima jedan `today` (nedelja 15. 11. 2026) → plan uvek počinje ponedeljkom, trka je uvek subota ili
  nedelja, dugi uvek nedeljom. Nema starta usred nedelje, trke pon–pet, ni dugog van nedelje.
- Motor se testira samo sa `declaredForm` i samo na sintetičkoj distanci; ne postoji test motor + `estimateForm` dan
  za danom (tako O1 i K1 prolaze). Stabilnost „po planu" pokriva 45 dana jednog slučaja i nikad ne odradi dan testa
  kao test.
- Determinizam poredi dva poziva sa istim redosledom ulaza — ne vidi zavisnost od redosleda nizova (S1).
- `guard.test.ts`: čuvar „bez nalaza" traži samo `clean > 80` od ≈ 224 slučaja, a spisak dozvoljenih nalaza pokriva
  sve sa ≤ 2 dana i ceo raspon obima < 25 ili > 70 BO po danu — test dopušta nalaze u većini mreže.
- `adapters/adopt.test.ts` uvozi `../../plan/resolve` (van `v4/`); dozvoljeno samo kao test preuzimanja, ali pravilo
  izolacije to ne proverava posebno.

## 3. Šta je dobro i ne treba dirati

- **Jedan prolaz (`runPass`) za `plan` i `replan`**, dan uvek iz namere + `decisions` + `adjustments`: ponovljen poziv
  sa istim događajima nikad nije dao drugu promenu (19 scenarija), a `replan([])` vraća isti objekat.
- **`isMutable` kao jedina provera zaštite**: u 19 scenarija događaja nijedan prošli, urađen, ručni ni zaključan dan
  nije promenjen (izuzeci su S4, gde korisnik sam pomera trku).
- **Datumi preko rednog broja dana u UTC** (`dates.ts`): bez vremenske zone i letnjeg računanja; prestupna godina i
  prelaz godine prolaze bez greške.
- **Odbijanje i tolerancija događaja**: neispravni događaji (pauza sa obrnutim datumima, `NaN`, nepostojeće trčanje
  ili dan, trka u prošlosti) se tiho ne primenjuju i ne kvare dokument.
- **Tekst iz plana, ne iz pravila** („prvi brzi trening je 26. 11." čita se iz izgrađenog plana) — tačan u svim
  proverenim slučajevima osim S2 i S7.
- **Izolacija**: nema imena distance, poređenja `distanceM`, sata ni nasumičnosti; `fitness/` uvozi samo tipove,
  `vdot.ts` i `constants.ts`.

## 4. Predlog redosleda ispravki

1. K1 i O1 zajedno (ugovor motor ↔ forma: šta je „rezultat testa" i šta je „planirano") + test motor + `estimateForm`
   dan za danom sa odrađenim testom.
2. O2, O3, O6 (pogrešan plan za moguć ulaz), pa O4 i O5.
3. Šest pravila bez testa iz § 2, mreža sa startom usred nedelje i trkom radnim danom.
4. Tekstovi S2, S3, S7–S11.

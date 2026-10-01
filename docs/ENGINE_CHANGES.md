# ENGINE CHANGES — namerne izmene ponašanja generatora

Svaka izmena u odnosu na stari `generatePlan` (APP_VERSION 282) ima četiri dela: **staro ponašanje**,
**zašto je problem**, **novo ponašanje**, **test koji potvrđuje**. Izmene koje ne menjaju ponašanje
(restrukturiranje) nisu ovde — njih drži golden-master otisak.

Otisak (`test/fixtures/otisak-generatora.json`, 2 304 scenarija) pokriva samo važeće ulaze. Zato nijedna
izmena ispod ne pomera otisak: ako ga pomeri, to je novi unos u ovaj dokument i ponovno uzimanje otiska
**u istom commit-u**, sa diff-om u review-u.

## Korak B.1 — validacija ulaza (2026-10-01)

Reproduktivni dokaz starog ponašanja: `docs/probes/legacy-degenerate-input.mjs`, `legacy-nan-leak.mjs`.
Kod: `domain/training/generator/validateInput.ts`, `generatePlan.ts`, `daySlots.ts`.
Testovi: `generator.input.test.ts` (28 testova + fuzz nad 2 000 pokvarenih ulaza; jednokratno provereno i nad 40 000 sa drugim semenom).

| ID | Staro ponašanje | Zašto je problem | Novo ponašanje |
|---|---|---|---|
| G1 | `raceDate` nevažeći ili izostavljen → plan sa `weeks: []`, `meta.weeks = NaN`, **bez `error`** | prazan plan se tretira kao uspeh; `adaptGeneratedPlan` ga prihvata | `{ error }` |
| G2 | `raceDate: '2026-02-31'` → tiho se prelije u 03.03. | nemoguć datum prihvaćen kao drugi datum | `{ error }` (strogi kalendarski parser, `domain/date`) |
| G3 | `startDate` nevažeći → izuzetak `RangeError: Invalid time value` | rušenje; `planSaNovimCiljem`/`recalibratedPlan` nemaju `try` | `{ error }` |
| G4 | `intensity` izostavljen/nepoznat → `NaN` u `vdotGoal`, `racePace`, km, opisima | NaN u perzistiranom planu; u UI „NaN km" | `{ error }` (odluka O4: greška, ne podrazumevano `std`) |
| G5 | `pb.sec = Infinity` → VDOT −5,7; `sec = 1` → VDOT 7,3·10⁶ | `PB_SANITY` je samo u čarobnjaku, a `S.genPlan.ulaz` ulazi nevalidiran | `{ error }` ako PB nije konačan ili je tempo van 2:20–20:00/km |
| G6 | `weeklyKm = Infinity` → NaN u planu | | `{ error }`; konačne vrednosti > 120 se i dalje tiho svode na 120 (proizvodna odluka, AUDIT D4) |
| G7 | `goalSec = 1` → `racePace = 0` | deljenje/nula tempo u sesijama | `{ error }` ako je zadat a van 2:20–20:00/km; `0`/`NaN`/`null` i dalje znači „nema cilja" |
| G8 | `raceDistM: '5000'` (string) prolazi preko koercije ključa objekta | tip curi u `meta.raceDistM` | `{ error }` |
| G10 | `runDays`/`quality`/`lrDow`/`qDows`/`runDows` koji nisu brojevi (`[NaN]`, `'abc'`, `true`) → `NaN` u `meta.runDays` i rasporedu | nađeno fuzzom; isti izvor kao G4 | ono što nije konačan broj postaje podrazumevana vrednost / odbacuje se; nikad NaN |

Granice tempa (2:20–20:00 po km) su **proizvodna odluka** (`constants/product.ts`): šire su od svega što čarobnjak
dozvoljava (5K 12:00–99:59 je 2:24–20:00/km) i uže od svega besmislenog. Vlasnik ih može promeniti (AUDIT D4).

**Nije menjano (G9 / AUDIT D1):** spregnutost kilometraže sa tempom kroz vremenske plafone ostaje do odluke vlasnika.


---

## Korak B.2 — prilagođavanje tempa formi (`domain/training/adaptation`)

Ovo nije generator, ali je isti ugovor: svaka namerna razlika naspram starog koda je ovde, sa testom.
Ostalo je bit-za-bit isto — `adaptation.oracle.test.ts` poredi lanac forme (500 stanja), prijem merenja
(800), predlog (400) i primenu/poništavanje (300) sa starim `preracunajVdotLog`, `recordVdot`,
`formaVsPlan`, `vdotPredlog`, `primeniVdotPredlog`, `ponistiVdotPrilagodjavanje`.

| # | Staro ponašanje | Zašto je problem | Novo ponašanje | Test |
|---|---|---|---|---|
| A1 | `ponistiVdotPrilagodjavanje` poredi izmenu dana sa opisom koji još nosi PRILAGOĐENI tempo („… @ 3:51/km"), a sesija se vraća tek posle. Unos se zato nikad ne briše, iako je tempo bio jedina izmena. | Ostaje prazna izmena (isti tip/km/opis, bez tempa). Dan se i dalje vodi kao ručno menjan: prikaz uzima naziv iz oznake umesto iz sesije („Piramida" → „Intervali"), a sledeći predlog tretira dan kao izmenjen. Izmereno: 10 od 300 nasumičnih stanja u oracle testu. | Poredi se sa originalom dana POSLE vraćanja sesije na tempo iz generatora; prazna izmena nestaje. | `adaptation.test.ts` A1; `adaptation.oracle.test.ts` (razlika se broji i proverava da je upravo prazna izmena) |
| A2 | `primeniVdotPredlog` poziva `setAlt` bez polja `snaga`, pa se snaga koju je korisnik dodao uz trčanje tiho briše pri svakoj primeni predloga. | Korisnik izgubi dodatu snagu bez ikakve poruke; predlog tempa nema nikakve veze sa snagom. | `snaga` se prenosi iz postojeće izmene; poništavanje ne briše izmenu koja nosi snagu. | `adaptation.test.ts` A2 |
| A3 | `planSaNovimCiljem` gradi `qs` pozivom `deriveQS` nad perzistiranim nedeljama (dow 0–6, bez prefiksa „g"). Ključevi ispadnu `n5d3` umesto `g5d4`. | `qsFor(dayId)` traži ključ po ID-ju dana, pa posle promene cilja za sve nove nedelje nema spec-a radnih deonica: lap-detekcija sa Strave tiho prestaje da radi. Izmereno (probe `docs/probes/legacy-goal-change-qs.mjs`): 4 od 30 sesija imaju spec, 26 gube. | `deriveQSById` — ključ je `id` dana (`g5d4`), isti prostor kao `adaptGeneratedPlan`. | `replan.oracle.test.ts` A3 |
| A4 | `recalibratedPlan` (nije povezana sa UI-jem) spaja zaključana polja ključem `nedelja-dow`, ali dobija perzistirane nedelje (dow 0–6) a sveže iz generatora imaju dow 1–7 — zaključano polje završi na sesiji PRETHODNOG dana (ili uopšte ne stigne, kad tip ne odgovara). | Ručna izmena tempa/ponavljanja bi nestala ili završila na pogrešnom treningu. Ne vidi se jer funkcija nikad nije pozvana. | Perzistirane nedelje se pomeraju na 1–7 pre spajanja. | `replan.oracle.test.ts` A4 |

Nepromenjeno namerno (potvrđeno oracle testom): minimum merenja 3, prag 1,5 VDOT, 3 s/km, α po tipu
sesije, odbijanje automatskog merenja udaljenog > 4 VDOT, `nemeri` sesije van lanca, zaštita odrađenih /
trke / testa / ručno zaključanih dana.

Poznato ograničenje (nije ispravljeno): stari `planVdotSada` za tvrdo kodovan LIČNI plan čita `p5k`
redove; `planVdotNow` pokriva samo generisan plan (`meta`), jer lični plan nije u novom frontendu
(FEATURE_INVENTORY F-27, odluka vlasnika O2).

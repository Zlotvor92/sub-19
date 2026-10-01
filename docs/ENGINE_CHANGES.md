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

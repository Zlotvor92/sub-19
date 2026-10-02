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

`planVdotNow` pokriva i ugrađeni lični plan (`p5k` redovi), kao stari `planVdotSada` (F-27).

---

## Korak B.3 — sinhronizacija i sesija (`domain/sync`, `lib/auth`)

| # | Staro ponašanje | Zašto je problem | Novo ponašanje | Test |
|---|---|---|---|---|
| A5 | `sbParseHash` računa rok tokena kao `Date.now() + parseInt(expires_in) * 1000`. Neupotrebljiv `expires_in` (npr. `abc`) daje `NaN`. | `now < NaN` je uvek netačno, pa se token osvežava pri SVAKOM pozivu (nepotreban promet i rizik rotacije refresh tokena). | Neupotrebljiv ili nepozitivan rok pada na podrazumevanih 3600 s. | `sync.oracle.test.ts` (parseAuthHash) |

Ostalo je bit-za-bit isto (oracle): `sbPayload` (200 stanja; nijedan token ni koordinata ne prelazi granicu),
`sbDecide` (sve 3 750 kombinacija), `sbClaims`, `sbParseHash`, `sbIzKorisnika`.

---

## Korak B.4 — namerne razlike u ponašanju van generatora (frontend, servisi)

Ovo nije generator, ali je isti ugovor: **svaka** razlika naspram starog `app.js` (APP_VERSION 282) koju sam svesno uveo stoji ovde, sa razlogom i testom. Sve ostalo iz
bloka „Šta je dokazano" (v. `REWRITE_STATUS.md`) je poređeno sa starim kodom diferencijalnim testovima (`*.oracle.test.ts`) i identično je.

| # | Staro ponašanje | Zašto je problem | Novo ponašanje | Test |
|---|---|---|---|---|
| F1 | Tekst „Pravila uvoza" (Strava): „Ako su dva trčanja istog dana, uzima se ono bliže planiranoj kilometraži." | Tekst NE opisuje kod: kod ih **sabira** (kilometraža i vreme su zbir; duplikat se ne sabira). Test `revizija3` („kilometraža i vreme su ZBIR, ne izbor") drži kod, tekst je zastareo. | Tekst kaže ono što kod radi. | `settings.test.tsx` („Pravila uvoza"), `activities.test.ts`, `activities.oracle.test.ts` |
| F2 | `aiCount` koji nije broj (iz ručno izmenjenog backupa) → `NaN` → dugme „Analiziraj" nestaje bez objašnjenja | Pokvaren zapis tiho gasi funkciju | Ne-broj se računa kao 0 (dnevni limit se računa od nule) | `ai.oracle.test.ts` (brojač pokrivenosti slučajeva), `ai.test.tsx` |
| F3 | Slanje obaveštenja svima (vlasnik) nastavlja po **poziciji** u listi (`sledeciOd`) | Lista se između krugova čita iznova; novi nalog koji pada ispred tekućeg mesta pomera sve indekse i **jedna osoba biva tiho preskočena** (server to sam opisuje u `api/broadcast.js`, v. „NASTAVAK IDE PO ADRESI") | Nastavak po **adresi** (`sledeciPosle`); pozicija ostaje samo kao rezerva ako server ne vrati adresu. Krug koji ne obradi nijednu adresu a traži isti nastavak je greška, ne 60 praznih krugova. | `adminApi.test.ts`, `settings.test.tsx` (Admin) |
| F4 | Dugme „Pošalji na sat" posle neuspeha se vraća na natpis „📤 Pošalji **treninge** na sat (14 dana)", a pri otvaranju piše „📤 Pošalji na sat (14 dana)" | Dva različita natpisa za isto dugme | Uvek isti natpis (onaj iz prvog prikaza) | `settings.test.tsx` (sat) |
| F5 | Odgovor greške čije telo nije JSON (stranica posrednika) → poruka zavisi od mesta poziva | Nekonzistentne poruke | Jedna funkcija `httpErrorText` (isti tekstovi kao `apiJson`: 401 / 404 / „Server je vratio grešku (N): …") | `http.oracle.test.ts` (54 kombinacije status × telo, poređeno sa starim `apiJson`) |
| F6 | Pri pokretanju se prvo čeka provera naloga (`/auth/v1/user`, rok 12 s), a ekran se prikazuje tek posle | Mreža koja „visi" drži praznu stranicu do 12 s; aplikacija je „offline-first" | Ekran se prikazuje iz lokalnih podataka posle **1,5 s** ako provera još traje; ako je nalog mrtav, kapija stiže kad provera završi. Brza provera (uobičajen slučaj) i dalje ne „bljesne" ekran pre odluke. | `createApp.test.ts` (dva testa, lažni sat) |
| F7 | `domain/weather` (privremeni modul sa engleskim ključevima `feel/humidity`) | Ključevi se ne poklapaju sa ugovorom stanja v11 (`osecaj`, `vlaga`…) | Modul prepisan na srpske ključeve iz ugovora; stari testovi preneti | `weather.oracle.test.ts`, `weather.test.ts` |
| F8 | Kartica „ista sesija": `nap.join(' ')` ostavlja zalutale razmake u tekstu | Nevidljivo (HTML skuplja razmake) | Razmaci se normalizuju; poredi se tekst bez razlike u razmacima | `compare.oracle.test.ts` |
| F9 | Uvodni ekran: odluka u `app.js` pri učitavanju | — | Ista odluka (`sessionStorage` + isključeno kretanje), ali se donosi jednom u `main.tsx` pre iscrtavanja (StrictMode bi je dvaput pozvao) | `splash.test.ts`, `ui.test.tsx` |

**Lični plan vlasnika (O2) JE preneto** — kao podatak (`web/src/data/personalPlan.ts`, generisan iz starog `PLAN`/`PRED`/`QS`, duboka jednakost proverena oracle testom) i pravila (`domain/personal`:
ko ga vidi, polazna trka, uklanjanje tuđeg seeda). Ugrađeni plan se u aplikaciji tretira kao generisan (aktivni plan = pravi `genPlan`, a kad njega nema i sme da se vidi — ugrađeni); perzistirano
`genPlan` ostaje `null`, pa oblik stanja na serveru nije promenjen. Namerna razlika: planska forma („planVdotNow") sada ume i `p5k` redove (stari `planVdotSada`) — bez toga ugrađeni plan nema referencu.

### Poznati nedostatak STAROG klijenta (nije preuzet)

Stari klijent u ~1 od 12 pokretanja prikaže traku „sukob" odmah posle prvog upisa: druga provera vidi red koji je upravo upisao, a `seenAt` još nije zabeležen
(`sbDecide`: `!seenAt` → `'ask'`). Dokaz: `e2e/cutover.spec.ts` (stari frontend, 12 uzastopnih pokretanja). Novi klijent: 16/16 čistih pokretanja. Stari kod nije menjan.

# HM specifičnost i progresija kvaliteta

Baza: `fix/quality-dose` na `548d1b1` (faze 1–3, finalizacija isporučenog plana, svrha pre doze, doza po iskustvu). Zaključan QA: `f8cb2081ed4ba223fe7efe14a621144beb9bce0d`. Originalni generator-ab ulazi, raw/blind planovi, trenerske ocene, događaji i izveštaji nisu menjani; ni izlazi prethodnih segmenata (`docs/qa/quality-dose/`, `session-purpose/`, `plan-finalization/`). Novi izlazi su samo u ovom direktorijumu.

## Zaključak

Polumaraton više ne gradi kvalitet iz udela nedelje koji se deli 60/40 i zatim seče. Svaka HM sesija praga i HM ritma gradi se iz **ciljnih minuta rada, dužine bloka i oporavka** koji rastu kroz ciklus, po dve odvojene staze: **prvi HM** (beginner/returning/developing) i **iskusan HM na rezultat** (experienced). Brz završetak duge se računa kao HM dan i menja izbor ostalih dana; prvi HM na četiri dana uz dugu ≥ 90 min dobija jedan kvalitet; lak dan posle zahtevne duge je ograničen. 5K, 10K i maraton su bajt-identični prethodnom segmentu.

## Uzroci (pre)

| QA nalaz | Mesto | Uzrok |
|---|---|---|
| U08 W1: dva T treninga 3,4 km / ~15 min (posle prethodnog segmenta 5,2 km / 22,8 min) | `profile21k.ts` `thresholdShare21K` + `cruiseIntervals` | Jedan nedeljni T budžet (10 %) deljen 60/40 na dva dana; drugi dan 2×1000 / 2,1 km. |
| U07 W10–11: 2×1700 m (posle prethodnog segmenta 2×1300 m) sa 5:26 oporavka | `mkRaceRhythm` | Oporavak = `pE × 0,9` sekundi (326 s) — vreme jednog lakog kilometra kao pauza između HM blokova; doza zatim smanjuje broj ponavljanja. |
| U08 W9/W11: RP 2×1900–2200 m + LR sa 5,5 km na RP iste nedelje; W10 10 km kontrolne trke posle najdužeg RP bloka od 2,2 km | `chooseQuality21K` (`q1Family` 'blocks' → RP) | Izbor q1 nije znao za brz završetak; HM ritam se pojavljivao tek u specifičnoj fazi. |
| U07 LR 19,5 km pa sutradan 11,5 km lako | `allocEasyLongRun` / `capAfterLongRun` | Plafon dana posle duge 0,8 × LR, do 14 km; na 4 dana jedini lak dan nosi ostatak nedelje. |

## Promena ponašanja

1. **Nov modul `distances/hmProgression.ts`.** Staza `first` / `performance` (`hmTrack`). Za svaku stazu: ciljne T minute, ciljne HM minute, dužina bloka (početak → kraj) i oporavak po dužini bloka.

   | | Prvi HM | Iskusan HM |
   |---|---|---|
   | T rad po glavnoj sesiji | 12 → 22 min | 18 → 30 min |
   | T blok | 4 → 10 min | 7 → 15 min |
   | T oporavak (lagano trčanje) | 75 s (≤ 6 min blok), 90 s | 60 s (≤ 8 min), 75 s (≤ 12 min), 90 s |
   | HM rad po sesiji | 10 → 26 min | 16 → 34 min |
   | HM blok | 6 → 14 min | 9 → 20 min |
   | HM oporavak | 90 s | 60 s (≤ 12 min blok), 75 s |
   | Drugi T dan (održavanje) | 70 % T cilja, kontinuirano | 75 % T cilja, kontinuirano |
   | Nedeljni omotač brzog rada | 12 % vremena trčanja | 14 % (ranije 13 % zajednički) |

   T napredak teče od prve kvalitetne do poslednje radne nedelje; HM napredak od prve nedelje faze vrhunca. Blok nikad nije duži od pola cilja (≥ 2 bloka), zaokruživanje ne skraćuje blok (sme do +25 %), a kraći je samo kad dva planirana bloka ne staju u granicu. Granice ostaju postojeće: T ≤ 10 % nedelje po treningu, RP ≤ 20 % i ≤ 12 km, kontinuirani prag ≤ `tempoMaxSec` (30 min), nedeljni omotač. `kons` = 85 % cilja; `agr` ne povećava cilj. Tempo se nikad ne menja.
2. **Nedeljni meni po fazi** (`profile21k.ts`):
   - prag: q1 pragovski blokovi; q2 naizmenično kontinuirani prag i VO2 podrška (fartlek/intervali);
   - vrhunac: q1 prag (svake treće nedelje intervali), q2 HM ritam u blokovima — HM ritam počinje pre specifične faze;
   - specifično: q1 HM blokovi, q2 kontinuirani prag; **ako duga ima brz završetak na HM ritmu, ona je HM dan, a jedini drugi kvalitet je prag** (i kad je to jedini kvalitet nedelje);
   - jedan kvalitet nedeljno: HM ritam i prag naizmenično;
   - kontrolna trka nepromenjena (datirani događaj) i ostaje jedini kvalitet te nedelje, bez brzog završetka.
3. **Broj kvalitetnih dana po profilu i fazi** (`singleQualityWeek`): prvi HM sa ≤ 4 dana trčanja u nedelji sa dugom ≥ 90 min dobija jedan kvalitet uz dugu (umesto tri zahtevna dana od četiri). Iskusni: brz završetak zamenjuje q2 (postojeće) i sada menja i porodicu q1.
4. **Redosled sečenja omotača** (`trimPriority`): podrška (I) → prag → HM ritam. Ranije je opšti rad (uključujući glavni prag) sečen pre specifičnog bez razlike.
5. **Taper** (obe taper nedelje, ranije zaključane na staru dozu): isti formati, udeo krajnjeg cilja — prva taper nedelja HM 60 % / T 45 %, poslednja HM 40 % / T 25 % (kontinuirano, najmanje 1,5 km). Tempo ostaje. Trkačka nedelja nepromenjena.
6. **Koncentracija obima** (`easyAfterLongRun`, samo HM): lak dan posle duge ≥ 90 min (iste ili prethodne nedelje) ≤ 60 % duge i ≤ 60 min; višak ide na lake dane koji nisu uz dugu, do plafona lakog dana; u taperu se ne vraća.
7. Uklonjeni HM graditelji koji se više ne koriste: `mkRaceRhythm` (pauza 0,9 × pE), deljeni `mkCruise`/`mkTempo`, progresivno trčanje na tempu trke za strategiju „dugo" i R repeticije u HM meniju.

## Pre / posle — U07 i U08 po nedeljama

Minuti = vreme rada na T / HM ritmu (RP, uključuje kontrolnu trku i brz završetak duge) / I. „Pre" = `docs/qa/quality-dose/` (548d1b1). „Zahtevni dani" = kvalitet, brz završetak i duga ≥ 90 min. Kompletni podaci: `weeks.json`.

### U07 — prvi HM, 30 km baza, 4 dana

| N | km | Pre T / HM / I | Posle T / HM / I | Posle: sesije (oporavak) | LR km (min) | Pon. posle LR | Zahtevni dani |
|---|---:|---|---|---|---|---:|---|
| W1 | 32,2 | 2,5 / 0 / 0 | **2,5 / 0 / 0** | Sre T 5×30 s / 90 s (uvod) | 10 (62) | 8 | Sre |
| W2 | 33,8 | 2 / 0 / 0 | **2 / 0 / 0** | Sre T 3×45 s / 90 s (uvod) | 10,8 (67) | 8 | Sre |
| W3 | 36 | 10 / 0 / 7,3 | **15,1 / 0 / 7,3** | Sre T 3×1000 m / 75 s; Pet I 2×800 m | 11,6 (72) | 8,6 | Sre, Pet |
| W4 deload | 27,2 | 0 / 0 / 0 | **0 / 0 / 0** | — | 8,7 (54) | 7 | — |
| W5 | 38,7 | 10 / 0 / 7,3 | **14 / 10,4 / 0** | Sre T 2×1400 m / 90 s; Pet HM 2×1000 m / 90 s | 12,5 (77) | 10 | Sre, Pet |
| W6 | 40,3 | 15,1 / 0 / 8,2 | **0 / 12,4 / 7,3** | Sre I 2×800 m; Pet HM 2×1200 m / 90 s | 13,5 (83) | 10 | Sre, Pet |
| W7 | 42,5 | 14 / 0 / 7,3 | **13 / 14,5 / 0** | Sre T 2×1300 m / 90 s; Pet HM 2×1400 m / 90 s | 14,5 (89) | 10,8 | Sre, Pet |
| W8 deload | 32,3 | 0 / 0 / 0 | **0 / 0 / 0** | — | 10,6 (65) | 8,2 | — |
| W9 | 45,7 | 14 / 0 / 7,3 | **0 / 17,6 / 0** | Sre HM 2×1700 m / 90 s | 15,6 (96) | 12,3 | Sre, Ned |
| W10 | 47 | 14 / 13,5 / 0 | **19,1 / 0 / 0** | Sre T 2×1900 m / 90 s | 16,8 (104) | 9,3 | Sre, Ned |
| W11 | 49,9 | 17,6 / 13,5 / 0 | **0 / 21,8 / 0** | Sre HM 2×2100 m / 90 s | 18,1 (112) | 9,9 | Sre, Ned |
| W12 deload | 37,9 | 10,5 / 0 / 0 | **0 / 0 / 0** | — | 13,2 (81) | 9,3 | — |
| W13 | 49,3 | 0 / 36,3 / 0 | **0 / 36,3 / 0** | Sre kontrolna trka 7 km | 19,5 (120) | 10,3 | Sre, Ned |
| W14 taper | 40 | 14 / 13,5 / 0 | **10 / 15,6 / 0** | Sre HM 2×1500 m / 90 s; Pet T 2×1000 m / 75 s | 16,5 (102) | 9,9 | Sre, Pet, Ned |
| W15 taper | 33,2 | 12,5 / 14 / 0 | **7,5 / 10,4 / 0** | Sre HM 2×1000 m / 90 s; Pet T 1,5 km | 12,6 (78) | 9,9 | Sre, Pet |
| W16 | 31,6 | — | — | Pet aktivacija 6×200 m; Ned trka | — | 3 | Pet |

Brz završetak duge: nijedna nedelja (prvi HM; postojeće pravilo — samo iskusni). Pre: HM blokovi tek W10 (2×1300 m sa 326 s pauze), pa 7 km kontrolne trke. Posle: HM od W5, 2×1000 → 2×2100 m, oporavak 90 s; W9–W11 jedan kvalitet uz dugu 96–112 min (ranije tri zahtevna dana od četiri). Ponedeljak posle duge od 96/104/120 min (W9/W10/W13): 12,5 → 9,3; 13,4 → 9,9; 12,2 → 9,9 km.

### U08 — iskusan HM na rezultat, 55 km baza, 5 dana (MLR sreda)

| N | km | Pre T / HM / I | Posle T / HM / I | Posle: sesije (oporavak) | Brz završetak | LR km (min) | Zahtevni dani |
|---|---:|---|---|---|---|---|---|
| W1 | 56,2 | 22,8 / 0 / 0 | **30,7 / 0 / 0** | Uto T 2×2000 m / 75 s; Pet T 3 km | — | 16 (86) | Uto, Pet |
| W2 | 59,2 | 23,2 / 0 / 0 | **19,3 / 0 / 9,5** | Uto T 2×2200 m / 75 s; Pet I 2×1200 m | — | 17,2 (93) | Uto, Pet, Ned |
| W3 | 61,5 | 21 / 0 / 9,5 | **35,1 / 0 / 0** | Uto T 2×2300 m / 75 s; Pet T 3,4 km | — | 18,5 (100) | Uto, Pet, Ned |
| W4 deload | 46,8 | 0 / 0 / 0 | **8,8 / 0 / 0** | Uto T 2 km (60 % poslednjeg) | — | 13,4 (72) | Uto |
| W5 | 66,5 | 21 / 0 / 9,5 | **22,8 / 16,2 / 0** | Uto T 2×2600 m / 75 s; Pet HM 2×1800 m / 60 s | — | 19,9 (107) | Uto, Pet, Ned |
| W6 | 67,3 | 25,9 / 0 / 11,9 | **0 / 18,9 / 14,2** | Uto I 3×1200 m; Pet HM 2×2100 m / 60 s | — | 21,4 (116) | Uto, Pet, Ned |
| W7 | 69,9 | 21,9 / 0 / 14,2 | **21 / 21,6 / 0** | Uto T 2×2400 m / 75 s; Pet HM 2×2400 m / 60 s | — | 22 (119) | Uto, Pet, Ned |
| W8 deload | 53,1 | 0 / 0 / 0 | **0 / 0 / 0** | — | — | 15,7 (85) | — |
| W9 | 70,3 | 0 / 41,9 / 0 | **21 / 24,8 / 0** | Uto T 2×2400 m / 75 s | 5,5 km @ HM | 22 (119) | Uto, Ned |
| W10 | 75,3 | 0 / 45 / 0 | **0 / 45 / 0** | Uto kontrolna trka 10 km | — | 22 (119) | Uto, Ned |
| W11 | 70,6 | 0 / 44,6 / 0 | **22,8 / 24,8 / 0** | Uto T 2×2600 m / 75 s | 5,5 km @ HM | 22 (119) | Uto, Ned |
| W12 taper | 61,3 | 19,3 / 18 / 0 | **13,2 / 20,7 / 0** | Uto HM 2×2300 m / 60 s; Pet T 2×1500 m / 60 s | — | 18,7 (101) | Uto, Pet, Ned |
| W13 taper | 44 | 14,5 / 18 / 0 | **7,5 / 13,5 / 0** | Uto HM 2×1500 m / 60 s; Pet T 1,7 km | — | 14,3 (77) | Uto, Pet |
| W14 | 31,6 | — | — | Pet aktivacija 6×200 m; Ned trka | — | — | Pet |

Pre: W9/W11 dva HM stimulusa iste nedelje (RP 2×1900/2200 m + 5,5 km na kraju duge), bez praga od W8 do tapera; HM ritam tek od W9. Posle: HM ritam od W5 (2×1800 → 2×2400 m, 60 s), pa brz završetak 5,5 km i kontrolna trka 10 km; u nedeljama sa završetkom drugi dan je prag. Prag ostaje prisutan kroz celu pripremu (W1–W11).

## Obrazloženje progresije i tapera

- **Prag (T)** je glavni motor HM-a (komentar profila; B.A.A. Half Level 2–3 imaju zasebne pragovske/tempo dane). Napredak ide kroz **dužinu bloka** pre broja ponavljanja: iskusni 2000 → 2600 m sa 60–75 s laganog trčanja, prvi HM 1000 → 1900 m sa 75–90 s. Drugi T dan je kontinuiran (održavanje).
- **HM ritam** počinje u fazi vrhunca kratkim blokovima (prvi HM ~5 min, iskusni ~8 min) i raste ka 2×2100 m (prvi) / 2×2400 m + 5,5 km završetka + 10 km kontrolisano (iskusni). Kratak oporavak u laganom trčanju drži neprekidan ritam; pauza od 5:26 to nije radila.
- **Zahtevni dani** se broje zajedno: brz završetak duge je HM dan (q1 postaje prag), kontrolna trka je jedini kvalitet svoje nedelje, prvi HM uz dugu ≥ 90 min na 4 dana ima jedan kvalitet. Nedeljni omotač sad postoji i za prvi HM (12 %) i seče redom I → T → HM.
- **Taper**: rad pada iz dva koraka uz isti tempo (Bosquet i sar. 2007, meta-analiza tapera: smanjenje obima uz održan intenzitet). U08 brzi rad: poslednja radna nedelja 47,6 min → 33,9 (71 %) → 21,0 (44 %) → aktivacija. U07: 21,8 min (W11; W13 kontrolna trka 36,3) → 25,6 → 17,9 → aktivacija. Obim i duga u taperu nepromenjeni (postojeća pravila).

## Izvori i interne heuristike

- B.A.A. Half Marathon Training (Level 1–3): https://www.baa.org/races/boston-half/info-for-athletes/boston-half-training/ — struktura (odvojeni pragovski/intervalni dani, simulacije tempa trke); sajt ne daje formule doze.
- Bosquet L. i sar., *Effects of tapering on performance: a meta-analysis*, Med Sci Sports Exerc 2007 — smanjenje obima uz održan intenzitet.
- Daniels' T ograničenje od ~10 % nedeljnog obima: sekundarni izvori se ne slažu da li važi po treningu ili nedeljno (proveren pretraživanjem, primarni tekst knjige nije dostupan). Kod zadržava postojeće ograničenje po treningu i dodaje nedeljni omotač; ne tvrdi se da je to Danielsovo pravilo.
- **Interne heuristike (nema objavljenog praga):** sve ciljne minute, dužine blokova i oporavci u tabeli gore; udeli tapera 60/45 i 40/25 %; omotač 12 %/14 %; pravilo jednog kvaliteta za prvi HM na ≤ 4 dana uz dugu ≥ 90 min; lak dan posle duge ≤ 60 % / ≤ 60 min. Treba ih potvrditi sa ljudskim trenerom na primerima.

## Očuvanje

- U01–U06, U09, U10: SHA-256 celog plana jednak prethodnom segmentu (proba to proverava). Otisak generatora: menja se 512/576 HM scenarija, 0 od 1.728 ne-HM. Seeded differential: 370/1.500 promena, sve HM; broj grešaka nepromenjen (14). D6 replan: 28 ključeva, svi HM. D6 upozorenja: 5/60 iteracija, sve HM ulazi.
- Završeni treninzi, stvarni km/min, efektivni datumi, ručne izmene i merom zaključani budući treninzi: postojeći replan/finalize tok nije menjan; `finalize.node.test.ts` (iskusan HM ulaz) prolazi sa novim planom. Browser tok za svih deset profila (čarobnjak → poređenje sa `docs/qa/hm-progression/UXX.json` → apply → reload → unos stvarnih km/min → restore → reload; U08 očekivano odbijanje) prolazi lokalno 10/10.

## Provere

- `node docs/probes/hm-progression.mjs`: deset QA ulaza (8 bajt-identičnih) + HM mreža 240 scenarija (prvi/iskusan × 20–80 km × 3–6 dana × 8/24 nedelje × kons/std/agr), 4.080 nedelja, 4.842 sesije, 0 prekršaja: T ≤ 10 %, HM ≤ 20 % i ≤ 12 km na isporučenoj nedelji, blokovi ≥ 1 km, nema HM sesije uz brz završetak; najveći oporavak T/HM 90 s; najveći odnos opterećenja i omotača na isporučenoj nedelji 1,046 (doziranje koristi raspodeljenu nedelju).
- Lokalno: strict TypeScript, lint, format (`npm run check`), build; 1.459 frontend/domain/oracle/node testova u 137 datoteka; 396 backend testova. Browser: ceo E2E 73/76 u prvom prolazu — U07/U08 generator-ab pali su jer je preview server izgrađen pre poslednje izmene q2 u fazi praga, a fixture posle; `pwa.spec.ts` (ažuriranje service worker-a) je pao jednom, kao što je zabeleženo i u prethodnom segmentu. Ponovljeno nad konačnim kodom: generator-ab 10/10 + `pwa.spec.ts` 2/2. `supabase/tests` nije pokrenut lokalno.
- Novi regresioni testovi `distances/hmProgression.test.ts` (14): staze, `fitBlocks`, U08 W1 doza praga, rast T blokova, HM ritam pre specifične faze, završetak duge → prag, kontrolna trka kao jedini kvalitet, taper, U07 oporavak HM blokova, jedan kvalitet uz zahtevnu dugu, lak dan posle duge, granice po treningu. Šest ponašajnih testova pada na `548d1b1` (provereno u odvojenom worktree-u).

## Promene očekivanja postojećih testova

| Test | Promena | Uzrok u ponašanju |
|---|---|---|
| `prescription.test.ts` HM race progression | `type: 'prog'` → `'int'`, `kind: 'Tempo trke'`, oporavak ≤ 90 s | HM specifični rad su blokovi na HM ritmu, ne progresivno trčanje; RP svrha od konstrukcije ostaje. |
| `longRunProgression.test.ts` HM q1 | dva testa zamenjena: završetak duge → q1 prag; jedan kvalitet → HM/prag naizmenično | Nema više deljenog T budžeta 60/40 koji se „vraća" q1; završetak duge menja porodicu q1. |
| `qualityDose.experienced.test.ts` omotač | HM koristi `HM_WEEKLY_FAST_SHARE.performance` (14 %) | HM ima sopstveni omotač (dva radna sistema). |
| `qualityDose.protection.node.test.ts` | U08 uklonjen iz hash-zaključavanja tapera | HM taper je namerno izveden iz HM ciljeva; oblik tapera zaključava `hmProgression.test.ts`. U03/U05/U10 ostaju zaključani. |
| `profiles.invariants.test.ts` | HM polja (`easyAfterLongRun`, 3 nove strategije); tempoMaxSec za HM proveren kroz HM graditelj; WU/CD invarijanta dozvoljava neograničen CD za deljeni I graditelj | HM kontinuirani prag je ciljan minutima (≤ 30 min plafon i dalje važi); q2 u fazi praga može biti I podrška. |
| Otisak (2.304), differential (1.500), D6 replan/upozorenja | osveženo `UPDATE_FINGERPRINT=1` | Samo HM izlazi (gore). |
| `generator-ab-users.spec.ts` | očekivani plan čita `docs/qa/hm-progression/UXX.json` | Novi izlazi odvojeno; ulazi čarobnjaka i provere očuvanja isti. |
| `cutover.node.test.ts` | izuzetak automatskog deploy-a za `fix/hm-quality-progression` | Draft tok bez deploy-a. |

## Ograničenja

- Nema novih slepih trenerskih ocena; ovo je tehnička before/after provera.
- Omotač je i dalje vezujući kod U08: pragovski blokovi ostaju 2 ponavljanja (2000 → 2600 m) i glavna T sesija ~20–23 min posle W3. Veći T rad traži odluku o omotaču, ne zaobilaženje.
- U07: višak sa ponedeljka ide na petak (13,4–14 km, dva dana pred dugu, ne uz nju). U specifičnoj fazi T i HM se smenjuju nedeljno, pa prag ima pauzu od dve nedelje (W9/W11).
- Kontrolna trka (7 km prvi HM / 10 km iskusni) nije menjana; kod U07 je i dalje skok sa 2×2,1 km na 7 km kontrolisanog HM ritma.
- Strategija tempa (`paceStrategy21K`: prag/blokovi/dugo) više ne menja meni; ostaje samo za učestalost brzog završetka. Za HM > 110 min (strategija „dugo") nema posebnog oblika.
- Beginner i returning HM planovi takođe prelaze na stazu „prvi HM" (uvodne nedelje i bazna faza nepromenjene).
- MLR odmah posle kvalitetnog dana (U08 Uto/Sre) i obim nedelje kontrolne trke (U08 W10 75,3 km) nisu menjani.
- Pravilo dana posle duge postoji samo za HM; isti obrazac kod 10K (U04 15,3 + 12,2 km) nije diran.
- Konačne minute, oporavke i omotače treba potvrditi sa ljudskim trenerom.

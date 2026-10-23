# HM v2 — STATUS

Novi generator polumaratona (policyId `hm-v2`) sa jednim vlasnikom svake odluke (H1–H15 iz
`docs/generators-v2/MASTER-HM-MARATHON.md` § 4), izolovan u `web/src/domain/generators/halfMarathon/v2/`. HM v1 je
nepromenjen i podrazumevan; od segmenta HM-05 v2 je u aplikaciji iza prekidača (`ui.generatorV2HalfMarathon` /
`VITE_HM_V2`), samo kroz adapter `v2/app/` (`halfMarathon/index.ts` izvozi `hmV2`, bira `select.ts` po `hm-v2`); od HM-06 i prilagođavanje (pregled → potvrda).

## Kako se koristi

```ts
import { adaptHmV2, generateHmV2 } from "./halfMarathon/v2/index.ts";
const r = generateHmV2({
  startDate: "2026-11-02", // prvi dan nedelje 1
  raceDate: "2027-01-24", // poslednji dan poslednje nedelje (10–20 celih nedelja)
  runDays: ["tue", "thu", "sat", "sun"], // 3–6 dana (H15); početnik 4–5 (H17)
  currentWeeklyKm: 40, // po redu H15 (4 dana 30–60 km); početnik 4 d 20–40, 5 d 25–45
  recentLongRunKm: 14, // opciono, 5–42 km (pouka 28)
  recentResult: { distanceM: 10000, timeSec: 2700, date: "2026-10-19" }, // 5/10 km, HM, maraton ≤ 84 dana
  // bez pouzdanog rezultata: easyPaceSecPerKm: 360 (270–510, plan po osećaju H16, test 5 km)
  // experience: "beginner" (H17: uvod 2 ned, jedan kvalitet, bez testa); runWalk: true → odbijanje
  goalTimeSec: 6000, // opciono (ocena H3; po osećaju posle testa)
});
// r.ok → r.plan (policyId 'hm-v2', policyVersion 'hm-v2.4.1', faza nedelje, paceBasis 'feel' po osećaju,
// upozorenja); !r.ok → r.reasons
const a = adaptHmV2(
  plan,
  { workouts, breaks, results, coverage, lockedDayIds },
  "2026-12-09",
); // H18
// a.ok → a.plan (adaptation.steps, mixedWeeks), a.reasons, a.changes, a.newLimits (pouka 20)
```

- Testovi: iz `web/` `npx vitest run --project node src/domain/generators/halfMarathon/v2` (brz, 21 fajl, ≈ 46 s);
  `TEST_FULL=1 …` (pun, ≈ 8,5 min: mreže 02/gusta/03 u delovima, mreža 04 u 2, rana adaptacija u 4 dela).
- Bazne linije generatora: `segment01/02/03-*.json`; od hm-v2.2.1 menjaju se samo planovi iz
  `segment03b.over-long-5e09a02.json` i (hm-v2.4.0) `segment07.changed-f4b257d.json` (klasa a/b/d); osvežavanje `TEST_FULL=1 HM_V2_WRITE_BASELINE=1 … <grid | feelGrid |
beginnerGrid>.node.test.ts`, pa prettier. hm-v2.3.0 ne menja nijedan plan generatora.
- Primeri, K1–K6, merenja, široka pretraga i sabotaže: `docs/hm-v2/artifacts/segment-0N/`.

## Segmenti 01–03 (hm-v2.0.0 … hm-v2.2.0)

- 01: jezgro 4 dana sa rezultatom (stop `faf8807`, udeo 4 dana 0,40). 02: 3/5/6 dana, dugi ≤ 24 km, pouka 28
  kotrljajuće (stop `01dd4a1`, P1 RECENT_LONG_TOO_SHORT). 03: po osećaju + test 5 km, početnik, odbijanje trčanja/hodanja
  (stop `4fc8a3c`, HI14 / pouka 33). Izveštaji `reports/SEGMENT-0N-*.md`; mreže 01/02/03 K1 0, invarijante 0.

## Segment 03b (hm-v2.2.1): pouka 32 za sve zone (HM-04 korak A)

- Plafon zone = H11 udeo i trajanje dana ≤ dugi; iznad najnižeg nivoa dan duži od dugog 0 na svim mrežama; menjaju se
  samo takvi planovi, 0 novih odbijanja. Izveštaj `reports/SEGMENT-03b-IMPLEMENTATION.md`, `artifacts/segment-03b/`.

## Segment 04 (hm-v2.3.0): adaptacija (HM-04 korak B)

- `adaptHmV2(plan, činjenice, asOf)`: assess → isti konstruktor (koraci, upisani dani) → spajanje → validate; kopija
  10K v2 A1–A17 sa brojevima H18 (lagan bola ≥ 4 km, taper 0,7, orijentir < 10 ned, rezultati 5/10 km, HM, maraton),
  A18 (pouke 20, 28, 30–33 u adaptiranom planu; dugi rasterećenja posle smanjenja ≥ 4 km). Izveštaj
  `reports/SEGMENT-04-IMPLEMENTATION.md`, artefakti `artifacts/segment-04/` (grid04, k04, wide04, sabotage).
- Mreža 04 5154 toka, rana adaptacija 27 062 (i asOf pre starta), široka pretraga 204 519 (401 plan): 0 odbijanja, 0
  prekršaja invarijanti; umor pre starta po pouci 34; generator bez koraka bajt-isti; sabotaže 16/16.
- Otvoreno: trkačka nedelja samo sa trkom posle dana odmora A4 (potvrda). K4 mreže r iz koraka A: prihvaćeno.

## Segmenti HM-05 i HM-06 (faza 2): HM v2 u aplikaciji iza prekidača, adaptacija u aplikaciji

- Prekidač `generatorV2HalfMarathon` (podrazumevano isključen); adapter `v2/app/` (plan, struktura, čarobnjak, sat,
  činjenice `facts.ts` → `adaptHmV2` → pregled → potvrda → revizija, vraćanje, promena cilja, Forma, test 5 km).
- Izveštaji `reports/SEGMENT-05-IMPLEMENTATION.md`, `reports/SEGMENT-06-IMPLEMENTATION.md`; otvoreno: test 3 km nije
  rezultat (A1). Traka od HM-07 u domenu (`adaptBanner`).

## Segment HM-07 (hm-v2.4.0): Faza 4a — pouke 35, 36, pod RP, dopuna pouke 34, jedna definicija, upozorenja, traka

- Pouka 35: nedelja izgradnje sa dva kvaliteta i danom dužim od dugog → drugi dan lagan (`week.secondQualityEasy`,
  validator SECOND_QUALITY); taper/trkačka izuzeti; neizvodljiva sa jednim kvalitetom (dugi na granici pouke 28) →
  dva kvaliteta + LONG_SHORTER_THAN_QUALITY. N6: RP ≥ 2 × 2000 m (`quality.floorM`, RP_FLOOR). Pouka 34: doza ned 2 =
  planirana ned 1, dugi reference u L. N9: jedna funkcija po veličini; LONG_RUN_SHORT preko svih nedelja. N10.1:
  IDENTICAL_WEEKS upozorenje. N11: WEEK_FITTED / CAPACITY_LIMITED / DELOAD_LONG_SHORTENED jednom po planu, tehnička
  napomena van korisničkih (`volume.userWeekNotes`). Traka: `adaptBanner` u domenu. Pouka 36: umor vezan za zapise.
- Nove trajne mreže: `preStartGrid` (17 scenarija pre starta), `fatigueRepeat` (isti umor + 1 … + 7). Izveštaj
  `reports/SEGMENT-07-IMPLEMENTATION.md`, artefakti `artifacts/segment-07/` (regress.ts, compare.ts, sabotaže).

## Segment HM-07b (hm-v2.4.1): pouka 36 precizno, zaštićeni dani u validatoru

- Pouka 36: prinudno rasterećenje = prva nedelja koja počinje posle poslednjeg zapisa umora (`assess.fatigueWeek`);
  asOf u njoj → njen ostatak; korak `deloadWeek`, čitanje `steps.deloadWeekOf`. Validator: provere po danu (H10/H14,
  ZONE_CAP) preskaču zaštićene dane (`validate.guarded`: zaključan ili upisan). `KNOWN_VERSIONS` ∪ hm-v2.4.0.
- Trajna mreža `segment07b` (umor u nedelji k − 1 × asOf do kraja k; rezultat + zaključani Q1/Q2 + urađen Q1).
  Izveštaj `reports/SEGMENT-07b-IMPLEMENTATION.md`, artefakti `artifacts/segment-07b/`.

## Faza 3, segment 3c (hm-v2.4.1, bez promene verzije): HM v2 kao izvor predaje „kraća distanca"

- Okidač u domenu: `shorter.ts` `shorterOffer` (O1) — `lengths.longRunShort` čitaju i validator (LONG_RUN_SHORT) i
  okidač; osnova = plan generatora za isti ulaz. Odluka o pripremi u adapteru: `app/preparation.ts` (10K, pa 5K;
  „zadrži plan v2"; činjenice bez politike izvora; `HM_V2_SOURCE_FORMAT`). `executionBasis` postaje član 'v2'.
  Pregled adaptacije: `shorterOffer: true` samo kad ponuda postoji. Izveštaj
  `docs/generators-v2/handoff/SEGMENT-3c-IMPLEMENTATION.md`.

## Faza 3, segment 3f (hm-v2.5.0): HM v2 kao cilj predaje „kraća distanca"

- `app/handoffTarget.ts` `handoffFuture`: generate iz činjenica ulaza izvora (obim čarobnjaka, trka istog datuma,
  start = granica nedelje posle potvrde) + `adaptHmV2` sa sirovim činjenicama izvora (bez `dayId`); potvrđena pauza →
  činjenica pauze (`facts.ts` `confirmedBreakFact`). O6(b): nedelje izvora pre starta ostaju kao prefiks plana
  (`plan.ts` `PREFIX_KEY`), nedelje v2 imaju broj `offset + index` i id kao nedelja izvora istog datuma; adaptacija,
  vraćanje verzije i promena cilja nose prefiks. Format plana se menja (prefiks) → hm-v2.5.0, `KNOWN_VERSIONS` ∪
  hm-v2.4.1. Izveštaj `docs/generators-v2/handoff/SEGMENT-3f-IMPLEMENTATION.md`.

## Faza 3, 3d-dopuna: HM v2 izvor šalje lak tempo čarobnjaka

- `app/preparation.ts` `contractInput` nosi `easyPaceSecPerKm` kad ga ulaz ima (činjenica korisnika, DESIGN § 8); v1
  cilj ga ne dobija (lepak `handoff.ts`), pa je v1 plan bajt-isti. Verzija HM nepromenjena. Izveštaj
  `docs/generators-v2/handoff/SEGMENT-3d-IMPLEMENTATION.md` § 8.

## Segment HM-08 (hm-v2.6.0): pouka 37 — mešovita nedelja, ostatak do cilja (samo naniže)

- `week.remainderWeek` (jedino mesto): preostali dani na ostatak = cilj − zaštićeni (po činjenicama, `keptSum100`);
  lagani do 4 km, pa kvalitet otpada samo kad time staje; dugi i test ostaju (opcija A, STOP `reports/SEGMENT-08-STOP.md`);
  ne staje → MIXED_WEEK_OVER. Validator iste funkcije (`mixedMin100`), `adaptation.doneDayIds`/`factKm`.
- mixed-deload HM 291/449 → 19 (sva sa upozorenjem); generator bajt-isti; 0 odbijanja. Trajna mreža `segment08`.
  Izveštaj `reports/SEGMENT-08-IMPLEMENTATION.md`, artefakti `artifacts/segment-08/`.

## Faza 3, 3c-dopuna 2: format izmena i poslednji rezultat (obrazac 3e)

- `app/preparation.ts`: `HM_V2_SOURCE_FORMAT` ∪ `hmV2Edits` (snimak izmena ne prelazi u v1 cilj); `lastResult` — `pb` =
  poslednji rezultat (ulaz ili korak adaptacije) koji nije posle starta ulaza ugovora. `handoff.ts` tekst O5. Verzija
  HM nepromenjena. Izveštaj `docs/generators-v2/handoff/SEGMENT-3d-IMPLEMENTATION.md` § 9.

## Segment HM-08b (hm-v2.6.1): K1, K2, K3 (i MAR → HM), pokrivenost u pouci 37

- K1: zaštićen test (≤ asOf, zaključan, urađen) se ne premešta (`steps.protectedTestDate`); validator ne sudi mesto
  zaštićenog testa. K2: invarijanta trkačke nedelje sa danima odmora. K3: WEEK_ALL_REST; referenca rasterećenja bez
  upisanog dugog (`deloadRefLongKm`). Pouka 37: dan iz potpune pokrivenosti bez zapisa = 0.
- locked-test 3193 → 0, locked-pause 258 → 0, last-weeks inv 6 → 0, prestart-chain 177 → 0, MAR→HM 136 → 0.
  Izveštaj `reports/SEGMENT-08b-IMPLEMENTATION.md`, artefakti `artifacts/segment-08b/`, mreža `segment08b`.


## Segment HM-09 (hm-v2.7.0): ispravke posle dubinske provere (audit/fixes/HM.md)

- B1/B2 `steps.longRef10` (jedna referenca dugog rasterećenja po nedelji); B3 dugi tapera ≥ 4 km (`TAPER_LONG_MIN`);
  L skoka iz trčanog (`step.ranLongKm`/`ranPart`, `rollingCapRan10`); pouka 35 u taperu (`taperSecondEasy`);
  napomena tapera; uvod početnika; Z1 `mixedQualityStays`; Z2 `userText`; Z3 `resultUse`; Z4 vraćanje samo bez
  prilagođavanja posle verzije; Z5b početnik iznad opsega → bez oznake; K1/F6 invarijante.
- B2 19 490 → 0, B1 3 758 → 0, B3 8 → 0, skok 1 060 → 0, Z4 1 565 → 0, Z3 495 → 0, Z1 1 321 → 0, taper dva dana
  552/636 → 0, napomena 909/546 → 0, Z2 oznake 16 511 → 0. Izveštaj `reports/SEGMENT-09-IMPLEMENTATION.md`.

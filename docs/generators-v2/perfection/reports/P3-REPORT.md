# P3 — 10K: plafon i lestvica RP, održavanje I u specifičnoj fazi (10k-v2.11.0)

9.–10. 11. 2026 (Europe/Belgrade). Polazno `38fd091` (10k-v2.10.0); STOP `9c0fa49` (`reports/P3-STOP.md`). Izmene samo u
`web/src/domain/generators/tenK/v2/**` i dokumentaciji, uz dva izuzetka zbog oznake verzije i snimka 10K v2 (v. „Van
foldera"). Ćelija: medijana [min–max].

## Odluke organizatora posle STOP 9c0fa49

1. Nedelja B koja ne staje: **P-b** — niži izvodljiv cilj postojećom pretragom (samo naniže, napomena + WEEK_FITTED),
   najviše **3,0 km** ispod cilja po pravilu; ni tada → nedelja A uz napomenu (P-a). Sledeći rast od dobijenog cilja.
2. Lestvica RP: dodaju se 4 × 1600 i 5 × 1600 m; 4 × 2000 m ostaje druga struktura doze 8 km.
3. I održavanja = **najveća** I doza razvoja, ograničena plafonom I cilja nedelje (inače najviši nivo koji staje).
4. D30 (RP 2 × 3200 / 2 × 4000 m kao druga struktura) bez izmene. 5. Orijentir ukupnog RP 22 km nije prag.

## Šta je ugrađeno (policy.ts: D11 dopuna, D33, D34, A25; `policyVersion` 10k-v2.11.0)

- **D33 (S1)**: `caps.RP` tabela po cilju nedelje (< 40 km 10 %, ≥ 40 km 15 %), jedini pristup `capShare`/`capPct`;
  lestvica RP … 3 × 2000 · 4 × 1600 · 5 × 1600 m. Heuristika.
- **D34 (S2)**: `specific.ts` (jedno mesto odluke tipa: `specificTypeNext`, `typeOfWeek`); redovan plan 4–6 dana,
  ne-rasteretna specifična nedelja bez ograničenja kvaliteta: prva A, pa naizmenično. B: Q1 RP po progresiji, Q2 I
  održavanja (`quality.maintainIDoseM`/`pickMaintainI`, korak `maintain`; pri istoj dozi naizmenična struktura); stanje
  T slota se u B ne menja (`advance`), novo stanje `i` = najveća I doza. Pretraga cilja (`generate.construct`): prolaz
  „samo B" (naniže, samo po pravilu, sa T1), pa „B ili A"; donju granicu cilja nedelje B drži samo `buildWeek`
  (`ctx.specBMin10` = cilj po pravilu − `specific.bMaxDropKm` 3,0 km). Heuristika.
- **A25 (S3)**: tip nedelje iz nedelja kakve se upisuju (konstruktor: `out` + `written`; validator: plan) — ista funkcija.
- **Validator** (samo prijavljuje): `SPECIFIC_TYPE`, `B_WEEK_NOT_FIT` (upozorenje), `B_WEEK_DROP` (cilj B > 3,0 km
  ispod), `I_MAINTAIN` (najveća I doza iz upisanih nedelja od poslednjeg novog starta, u plafonu I), PHASE_QUALITY
  (I na Q2 nedelje B), lanac T slota/D16/stanje za rasterećenje i taper bez Q2 nedelje B, `MAIN_DOSE_DECREASE` unutar
  tipa (A sa poslednjom A ili nedeljom pre specifične faze, B sa poslednjom B).
- Stalni uslovi: 1 (jedan vlasnik: tip — `specific.ts`; doza I — `quality.maintainIDoseM`; granica 3,0 km — `buildWeek`;
  validator samo prijavljuje), 2 (jedan plafon RP), 3 (WU/CD netaknut), 4 (S3 u konstruktoru), 6 (verzija i faza), 7
  (`isolation.node.test.ts` zelen; `specific.ts` uvozi samo iz foldera), 8 (`gridInvariants`: SPEC_AB, I_MAINTAIN).

## Komande merenja (iz `web/`, svaka ≈ 1 s; nisu testovi)

- **K1** na `38fd091`: `node ../docs/generators-v2/perfection/P3/measure.ts pre`; **K2** na kraju: `… measure.ts posle`;
  `node ../docs/generators-v2/perfection/P3/compare.ts pre posle` → `P3/compare-pre-posle.txt`.
- **K3** `node ../docs/generators-v2/perfection/P3/profile.ts pre|posle` → `P3/profile-a-10K-{pre,posle}.txt`.
- **K4** `node ../docs/generators-v2/perfection/P3/peak.cjs` — vrh plana posle prema pre i prema P-a (`raw-10K-s123.json`: K2 STOP-a nad `s123-wip.patch`).
- Fajlovi `raw-10K-*.json` (≈ 10 MB) nisu u repou (`P3/.gitignore`), ponavljaju se K1/K2.

## Izmereno pre / posle (mreža P0, 192 ulaza; R = sa rezultatom n 144)

| metrika (R) | 10k-v2.10.0 | 10k-v2.11.0 |
|---|---|---|
| najveći RP trening [km] | 4 [2,4–6] | 5 [2,4–8] |
| isto, % trke | 40 [24–60] | 50 [24–80] |
| ukupno RP u planu [km] | 15,4 [4,4–24] | 18,4 [4,4–31,5] |
| I minuti u specifičnoj fazi | 0 [0–0] | 10,4 [0–25] |
| % km bržih od E: baza / razvoj | 8,7 / 10,4 | 8,7 / 10,4 |
| % km bržih od E: specifična / taper | 14,7 / 11,6 | 15,4 / 13,8 |
| uzrok vrha RP: plafon / ≤ 1 nivo + kraj faze / kraj lestvice | 79 / 43 / 22 | 39 / 78 / 27 |
| R ≥ 40 km/ned sa najvećim RP ≥ 6 km | 22/84 | 62/84 |
| nedelja > 25 % km bržih od E (192 plana) | 5 | 5 (iste) |
| nova odbijanja | — | 0 |

F (n 32): RP najveći 3,5 → 4,3 km, ukupno 11,9 → 14,5 km, I u specifičnoj 0 → 11,6 min. B (n 16): menja se 1 plan
(4 d, cilj ≥ 40 km). Nedelje > 25 %: istih 5 (F 3–4 d, 20–25 km, nedelja baze 2 i 6) — uzrok nije P3, nisu ispravljane.
Uzrok vrha RP posle: „≤ 1 nivo nedeljno + kraj faze" 78/144 (specifična faza 3–4 ne-rasteretne nedelje; 8–9 ned: 2).

Tip specifičnih ne-rasteretnih nedelja (R + F 4–6 d): ABA 84, AB 41, AA 7. Nedelja B koja ne staje ni 3,0 km ispod
cilja (→ A): 7 planova, svi 8 nedelja (2 specifične nedelje), druga nedelja: R 4 d 2/36, R 5 d 2/36, R 6 d 1/36,
F 5 d 1/8, F 6 d 1/8 (1 plan od 8 = 13 %; prijavljeno, ne stoj — odluka 1), F 4 d 0/8. Uzrok svih 7: dužine dugog i
laganih pri cilju (napomena „Nedelja B ne staje: … ni 3,0 km ispod redovnog cilja").

Vrh plana (odluka 1, K4): prema P-a (patch STOP-a: B ne spušta cilj, I održavanja = poslednja I) niži u **11/192 (6 %)** planova, pad medijana 1,3 km
(najviše 2,1), viši u 6; prema 10k-v2.10.0 niži u 5/192 (3 %), pad do 1,3 km, viši u 42. Ispod > 5 % prema P-a — prijava.

Pouka 35 (drugi dan kvaliteta lagan, „dan kvaliteta ≤ dugi"): na celim mrežama generatora 414 → 462 nedelje (veći RP
dan); 0 nedelja izgradnje sa dva kvaliteta dužim od dugog bez napomene (p35 testovi, pun nivo).

Profil (a) (10 km 46:00, 40 km, 4 d, 16 ned; `P3/profile-a-10K-{pre,posle}.txt`): specifična faza pre — ned 11 RP 4 ×
1000 + T 2 × 2500 · ned 13 RP 3 × 1500 + T 5,0 km · ned 14 RP 5 × 1000 + T 2 × 2500; posle — ned 11 (A) RP 3 × 1500 +
T 2 × 2500 · rasterećenje · ned 13 (B) RP 5 × 1000 + I 4 × 900 m održavanja (3,6 km = najveća I razvoja 3 × 1200) ·
ned 14 (A) RP 3 × 2000 + T 5,0 km. Najveći RP 5 → 6 km (50 → 60 % trke), ukupno RP 19,5 → 21,5 km, ciljevi specifičnih
nedelja 51,7 / 52,0 / 52,8 → 52,1 / 53,1 / 53,5 km; taper isti.

## Promenjeni planovi (fixture `tenK/v2/segmentP3.changed-38fd091.json`, prema 38fd091)

Mreža P0 (K2): 147/192 — R 3 d 12/36, R 4–6 d 36/36, F 3 d 2/8, F 4–6 d 8/8, B 4 d 1/8, B 3 d 0/8. Mreže testova
generatora (01, 02 R, F, B): **27 312 / 34 146** planova (0 odbijanja). Tokovi trajnih mreža adaptacije (pun nivo):
early 64 615 / 102 707, grid04 1224 / 2040, pain 168 / 336, relief 16 806 / 18 193, start0 7056 / 12 336; 0 tokova
izgubljeno, 0 tokova sa dva heša.
Mehanizam regresija: plan/tok koji 10K-08 nije menjao ima na 38fd091 stanje b9c4728, pa se fixture P3 spaja u
`CHANGED_08` (`level.harness`); starije regresije porede stanje b9c4728, `p08Errors` proverava da se promenjeni
razlikuju. Mreža 02 (razvrstavanje 21c03f1): `segmentP3.grid02-38fd091.json` nosi `planHashes21` i „RP < 1000 m"
stanja 38fd091 za 6948 planova koje menja samo P3. Snimci: `docs/10k-v2/artifacts/segment-08/gen-dump.ts` (oba
stabla), privremena kuka u `level.harness` (pun nivo mreža adaptacije, oba stabla; uklonjena), `P3/mkfxP3.py`,
`P3/grid02-dump.ts`.

Izveštajne brojke testova menjane uz komentar P3: CAPACITY_LIMITED, taper samo RP, DOSE_DROPPED, lagan trkačke u km
(grid02, feelGrid), pouka 35 po delovima [100, 100, 107, 107] → [108, 108, 123, 123], I3 bola (izuzeci trkačke nedelje
i zaokruženja 20 → 12), primer relief (ned 7 cilj 30,0 → 27,9 — nedelja B). Nezavisni proročki testovi dopunjeni
(`quality`, `week`, `periodize`, `volume` replay, `gridInvariants`): plafon RP po cilju, lestvica do 8 km, T bez
nedelje B, poređenje unutar tipa, test D34 (smena A/B, I održavanja, cilj B ≥ cilj − 3,0 km).

## Sabotaže (`node scripts/sabotage.mjs ../docs/generators-v2/perfection/P3/sabotage-P3.json`, brz nivo, `--bail=1`)

8/8 palo, 70,7 s, stanje `src` vraćeno (`P3/sabotage-P3.result.json`): S1a plafon RP bez tabele, S1b bez nivoa
5 × 1600, S2a nema B, S2b I bez plafona i naizmenične strukture, S2c B menja T slot, S2d glavna doza bez poređenja po
tipu, S2e bez granice 3,0 km, S3 tip iz sastavljenih dana. Prvi prolaz: S2e NIJE pao → dodato pravilo `B_WEEK_DROP` i
provera u testu D34; drugi: opet nije pao jer je granica bila na dva mesta (generate + buildWeek) → ostavljeno jedno
mesto (stalni uslov 1); treći: 8/8.

## Testovi (komanda — trajanje — ishod)

- U toku: `npx vitest run --project node src/domain/generators/tenK/v2` (brz) — 77,5 / 74,2 / 77,7 s — 52 → 46 → 6 →
  0 padova (verzija, proročki testovi, fixture). Namenski pojedinačni fajlovi 1–80 s.
- `TEST_FULL=1 npx vitest run --project node src/domain/generators/tenK/v2` (pun, 1.) — 18 min 20 s — 16 padova
  (izveštajne brojke, pouka 35 po delovima) → popravljeni, ponovljeni samo ti fajlovi — 2 min 42 s — 12/12.
- Snimak fixture-a: pun nivo mreža adaptacije u stablu 38fd091 — 12 min 22 s (37/37 zeleno) i u novom stablu —
  12 min 37 s; `gen-dump.ts` 3 min 31 s × 2; `grid02-dump.ts` 1 min 2 s.
- `npm run check` — 5 min 28 s — 2 pada (`marathon/v2/app/byteSame` snima i 10K v2) → snimak obnovljen (samo 13
  ključeva „10K v2"; `BYTE_SAME_RECORD=1`).
- `npx vitest run --changed 38fd091` — 2 min 43 s — 157 fajlova, 1587 testova, 0 padova.
- Posle poslednje izmene koda (granica 3,0 km na jednom mestu, `B_WEEK_DROP`):
  `TEST_FULL=1 npx vitest run --project node src/domain/generators/tenK/v2` — 18 min 19 s — 95/95 fajlova, 736 testova;
  `npm run check` — 4 min 51 s — 341 fajl, 3845 testova, 0 padova (posle `git pull --rebase`: 7 min 25 s, 343 / 3867, 0); `npx playwright test e2e/tenk-v2.spec.ts --trace off`
  — 33 s — 3/3 (posle izmene oznake verzije u specifikaciji); `npm run build` — 20 s — uspešno.

## Van foldera `tenK/v2` (odstupanje od zadatka)

- `web/src/features/onboarding/tenKV2Flow.test.tsx` i `web/e2e/tenk-v2.spec.ts`: oznaka verzije 10k-v2.10.0 →
  10k-v2.11.0 (testovi padaju inače).
- `web/src/domain/generators/marathon/v2/app/byteSame.9443676.json`: 13 heševa tokova „10K v2" (snimak toka 10K v2
  kroz aplikaciju); ostali ključevi bajt-isti.

## Mišljenje (odvojeno od merenja)

1. S1 nosi dobitak RP; S2 dodaje ≈ 10 min I u poslednjim nedeljama bez novog rasta, uz blago manji % brzih km u
   specifičnoj fazi (I održavanja < T doza).
2. P-b je skoro svuda dovoljan; ostalih 7 planova su 8 nedelja sa dugim na 105 min — tu B ne staje ni uz 3 km.
3. Ukupni RP je i dalje ograničen dužinom specifične faze i „≤ 1 nivo nedeljno", ne plafonom.

## Otvorena pitanja

1. Vrh plana niži u 11/192 (6 %) prema P-a (do 2,1 km) — prihvatljivo?
2. F 5 d i F 6 d: po 1/8 planova (8 ned) bez nedelje B — prihvatljivo kao P-a?
3. Tri fajla van foldera (oznaka verzije u dva testa, snimak 10K v2 u maratonskom testu) — potvrda.

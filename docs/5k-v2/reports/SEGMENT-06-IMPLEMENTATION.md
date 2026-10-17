# Segment 06 — adaptacija 5K v2 (5k-v2.5.0)

Polazni commit: e008c03. Kod samo u `web/src/domain/generators/fiveK/v2/`; nije povezano sa select.ts/store/UI.

## Arhitektura (Uslov 4)
`adaptFiveKV2(plan, facts, asOf)` → `{ plan, changes, reasons }` | odbijanje (`adapt.ts`):
1. `assess.ts` — činjenice → OGRANIČENJA (`AdaptStep`): VDOT/rezultat, `startKm` sledeće nedelje, opsezi
   bez kvaliteta / 1 kvalitet / odmor / bol, prisilno rasterećenje, nov start, „orijentir". Jedino mesto odluka 1–7.
2. `generate.construct(input, steps)` — ISTI konstruktor kao `generateFiveKV2` (= `construct(input, [])`, izlaz
   bajt-isti kao na e008c03 za 282 plana): `steps.framesFor` (faze, `rePeriodize`, rasterećenje, test, ograničenja
   nedelje), `volume.adaptVolume` (obim, isti rekurent kao `planVolume`), `steps.pacesAt` (tempo nedelje),
   `quality.weekQuality` / `week.ts` (ograničenja ulaze pre izbora). Koraci se čuvaju u `plan.adaptation.steps`
   i ponavljaju (lančana adaptacija).
3. Spajanje: dani ≤ asOf, urađeni i `lockedDayIds` (dayId = datum dana) iz prethodnog plana; zaštita samo
   proverava bajt-jednakost (`ADAPT_PROTECTION`). Nedelje sa danima koji se razlikuju od konstrukcije →
   `mixedWeeks` (validator na njima proverava samo dane).
4. `validatePlan` — adaptiran režim: tempo/trkač po nedelji, rast od cilja koraka, vrh od (novog) starta,
   taper od vrha koraka, `LIMITS` po datumima. Nema koraka koji posle konstrukcije menja kvalitet.
Datum trke, taper i trkačka nedelja se ne pomeraju (`rePeriodize` menja samo preostalu izgradnju).

## Odluke (DECISIONS 5k-v2.5.0, heuristike) i odstupanja
| # | Pravilo | Mesto |
|---|---|---|
| 1 | Rezultat ≤ 84 dana, noviji od postojećeg: VDOT od prve pune nedelje posle asOf; po osećaju → tempo; prognoza/cilj iz novog VDOT-a; obim ne raste zbog tempa (samo kapacitet novog tempa) | assess (rezultat), steps.pacesAt |
| 2 | 7 dana < 60%: cilj = min(prethodni cilj izgradnje, max(izvršeno, 80% planiranog)), rast dalje po pravilima | assess → startKm |
| 3 | Pauza 7–13: 80% (7 dana pre pauze), 1 kvalitet; 14–27: 70%, bez kvaliteta pa 1; ≥ 28: min(14 dana / 2, 50%), `rePeriodize`, < 6 ned → „orijentir" | assess; periodize.rePeriodize |
| 4 | Bol ≥ 4 (3 dana): 7 dana bez kvaliteta i ubrzanja, dugi ≤ 60 min, lagani × 0,7; ≥ 7: 3 dana odmora pa isto; poruka o pregledu | assess (opsezi); lengths.painLongKm/limitedEasyKm |
| 5 | 2+ lagana (lagan/dugi; van plana = lagan) RPE ≥ 7 u 7 dana: sledeća nedelja rasterećenje (ne taper/trka) | assess; steps.framesFor |
| 6 | > 115% dva uzastopna 7-dnevna prozora: sledeća nedelja bez rasta | assess → startKm |
| 7 | Bol uvek (po datumima, najstroži); za obim samo najviše od pauza > umor > izvršenje; tempo uvek; svi aktivni u `reasons` (`applied`) | assess |

Odstupanja / dopune (posle mreže): (a) „sledeća nedelja" = prva puna nedelja posle asOf; ostatak tekuće
nedelje dobija ograničenja pauze/bola. (b) Donja granica cilja `volume.adaptFloorKm` = min(cilj u planu
generatora, 12/15/25 km): bez nje taper/rasterećenje posle smanjenja nije primalo kvalitet ni lagan ≥ 3 km.
(c) Prisilno rasterećenje odmah posle redovnog = 0,8 × poslednja ne-rasteretna (ne 0,8 × 0,8). (d) Cilj koraka
je osnov rasta i kad je ta nedelja rasteretna (greška nađena u primeru: nedelja 9 se vraćala na 45,5 km).
(e) Korak sa novim ciljem obima i prelaz po osećaju → VDOT počinju novu progresiju doze (doza sme da padne).
(f) Kvalitet koji u adaptiranoj nedelji ne staje u obim → 1 kvalitet doze rasterećenja → bez kvaliteta
(odluka konstruktora; u mreži 0, u široj proveri 14 od 3150). (g) `rePeriodize`: rasterećenje se ne
pomera na početak faze od 1 nedelje. (h) „Više od plana" se ne primenjuje kad je sledeća nedelja rasteretna.
(i) Lista scenarija mreže iz zadatka ima 7 stavki — urađeno 7.

## Fajlovi
Novi: `adapt.ts`, `assess.ts`, `steps.ts`, `segment06.node.test.ts`. Izmenjeni: `types.ts`, `policy.ts`
(5k-v2.5.0, `adapt`, DECISIONS), `generate.ts` (`construct`), `periodize.ts`, `volume.ts`, `quality.ts`,
`lengths.ts`, `week.ts`, `validate.ts`, `index.ts`, `testInputs.ts` (mreža), `segment02.node.test.ts`
(verzija). Primeri: `docs/5k-v2/artifacts/segment-06/` (`run.ts`, `inputs.json`, 14 × `<plan>-<scenario>.json`,
`examples.md`).

## Komande i rezultati (iz web/)
- `npm ci` (node_modules nije postojao; prvi `npx vitest` je povukao spoljni vitest 5.0.5 i pao na configu).
- `npx tsc -p tsconfig.domain.json --noEmit` → exit 0.
- `npx eslint src/domain/generators/fiveK/v2/` → prvi put 8 grešaka (6 nepotrebnih assertion-a, 1 neiskorišćena
  promenljiva u testu, 1 no-base-to-string) → ispravljeno → exit 0.
- `npx prettier --check src/domain/generators/fiveK/v2/` → prvi put 12 fajlova → `--write` → exit 0.
- `npx vitest run --project node src/domain/generators/fiveK/v2/` → 10 fajlova / 444 testa prolazi (88 novih).
- Novi testovi na e008c03: `segment06.node.test.ts` pada ceo (`Cannot find module './adapt.ts'`, 0 izvršenih
  testova) — „pada pre izmene" važi na nivou fajla, ne pojedinačno po odluci.
- Regresija generatora: 282 plana (3/4/5 dana × obim × 6–16 ned × VDOT/po osećaju/početnik) bajt-isti kao na
  e008c03 (osim `policyVersion`).
- `npx vitest run --project node src/domain/generators/` → 26 fajlova / 587 testova prolazi (810 s; pokrenuto pre
  uklanjanja jedne nekorišćene grane upozorenja u validate.ts — finalni kod pokriva `npm run check`)
- `npm run check` → exit 0 (typecheck, lint, format, 186 fajlova / 2216 testova, 17,5 min)

## Mreža scenarija
`testInputs.adaptNetwork()`: 60 planova (VDOT ~45/~38 × 3/4/5 dana × 2 obima × 7/10/14 ned; po osećaju E 6:00
3/4/5 dana × 8/12 ned; početnik 3/4 dana po osećaju i sa rezultatom; kratka 6 ned; 5 dana 60 km 16 ned;
dev-04; 15 km/8 ned) × 7 scenarija (bez promena, propuštena nedelja, pauza 10/20/35, bol 5, test 3 km), asOf =
kraj nedelje ⌊N/2⌋ → 420/420 plan, 0 grešaka validatora; „bez promena" = nedelje bajt-iste; pauza 35 →
„orijentir" u 16 planova (< 6 ned). Šira provera van repoa (scratch): asOf kraj i usred nedelje × 4 nedelje ×
7 scenarija (zaključani dani, bol 8 + pauza, umor, izvršenje 40%/120%, test) + lanac sledeće nedelje →
6300/6300, determinizam i prošlost bajt-isti.

## Stalni uslovi 1–8 (adaptirani planovi)
1. Jedan vlasnik: ograničenja samo `assess.ts`; obim `adaptVolume`; doza `weekQuality`; dužine `lengths.ts`;
   validator samo prijavljuje. Bez petlji skraćivanja (jedini lanac: f) u konstruktoru).
2. Plafoni zona nepromenjeni. Dugi na danu bola: min(plafon pravila, 60 min) u jednom mestu (`painLongKm`) —
   ograničenje koraka, ne drugi plafon pravila (otvoreno tumačenje).
3. WU/CD po pojasu cilja nedelje (validator WARMUP/COOLDOWN na adaptiranim nedeljama).
4. Zaštita: prošlost, urađeno, zaključano bajt-isto (test + provera u `adapt.ts`).
5. Handoff: nije deo segmenta.
6. `policyId`/`policyVersion` (5k-v2.5.0) i faza svake nedelje iz konstruktora; koraci u `plan.adaptation`.
7. Izolacija: novi fajlovi uvoze samo v2 (`isolation.node.test.ts` prolazi).
8. Mreža: 0 grešaka WEEK_MIN_VOLUME / EMPTY_WORKOUT / EASY_LONGER_THAN_LONG; izuzetak: nedelja sa danima
   odmora (bol ≥ 7) sme ispod minimuma nedelje.

## Primer 1 — dev-04, pauza 20 dana (asOf 2026-12-20, kraj ned 7)
| Ned | Pre | Posle (cilj / plan., kvalitet) |
|---|---|---|
| 7 | peak 45,5 I + T | isto (prošlost) |
| 8 | peak (r) 36,4 I | peak (r) 23,7 / 23,7, bez kvaliteta |
| 9 | peak 45,5 I + T | peak 25,5, 1 kvalitet (I) |
| 10–11 | sharpen 45,5 RP + R | sharpen 25,5 RP + R |
| 12–13 | taper 38,7 / 31,9 | taper 21,7 / 17,8 |
| 14 | race 19,49 | race 12,73 |
Reasons: PAUSE (20 dana, 7 dana pre pauze 33,9 km → 23,7 km); UNDER_EXECUTION nije primenjeno (nadjačano).

## Primer 2 — po osećaju 4 d / 25 km / E 6:00, test 3 km 13:30 (asOf 2026-11-22, kraj ned 3)
| Ned | Pre | Posle |
|---|---|---|
| 1–3 | HILLS + TEMPO_FEEL; ned 3 TEST_3K | isto (prošlost) |
| 4 | base (r) 23,3 HILLS | base (r) 23,3 R (VDOT tempo) |
| 5–6 | peak FARTLEK + TEMPO_FEEL | peak I + T_cruise |
| 8–9 | sharpen FARTLEK_RP + HILLS | sharpen RP + R_sharpen |
| 12 | race 11,29 FARTLEK_RP | race 11,8 RP_sharpener |
paceMode feel → vdot, VDOT 41,8, prognoza — → 23:13, cilj insufficient_data → feasible; obim isti.

## Preostali problemi
1. Činjenice se smatraju potpunim od prvog zapisa do asOf; nepotpun unos izgleda kao pauza/manjak.
2. dayId = datum (plan nema id dana); premešten trening se vezuje za datum izvršenja ako nema dayId.
3. Mešovite nedelje (asOf usred nedelje, zaključani dani) — nedeljna pravila se na njima ne proveravaju.
4. Donja granica 12/15/25 km: 5 dana posle pauze ≥ 28 ne ide ispod 25 km (npr. 30 km → 25 = 83%, ne 50%);
   taper malog plana posle smanjenja je skoro ravan (4 d: 15 / 15 km).
5. Lagani −30% ne ispod 3 km (taper 2 km) — stvarno smanjenje može biti < 30%.
6. Rezultat u trkačkoj nedelji se ne primenjuje (nema sledeće nedelje); prognoza ostaje stara.
7. Plan starije verzije: nedelje se ponovo grade tekućim pravilima; razlike u prošlosti postaju mešovite.
8. Pragovi 1–7 i dopune a–h su heuristike bez trenerske provere.

# 5K v2 — Segment 08h (5k-v2.8.1): pouka 35, trajne mreže pouke 36 i zaštićenog dana

Polazni SHA `e41defc` (posle 08g; `23b1b88` = prvi push 08g). Grana `claude/generator-isolation-5k-10k-hm-marathon`.
Menjano `fiveK/v2/**`, `docs/5k-v2/**`; izuzeci kao 08g: redovi „5K v2" u byteSame (10K 19, HM 13, maraton 13; samo
oznaka) i oznaka verzije u `features/onboarding/fiveKV2Flow.test.tsx`. Bez PR-a, mergea i deploya.

## 1. Tačke organizatora

| tačka | stanje pre (merenje) | ispravka | test |
|---|---|---|---|
| 1 pouka 36 precizno (zapisi pet/ned k − 1, asOf pon k) | f4b257d: „tekuća+1" 20/35; već ispravljeno u 08g dopuni (`4c3dcd9`): `fatigue-monday.ts` 5K 35 = tekuća+0 22, bez novog 13 | — (korak `deloadWeek`, 08g) | trajna mreža: zapisi pet/ned k − 1, asOf ned k − 1 … čet k → isto rasterećenje i ciljevi (`segment08h.harness`) |
| 2 zaštićen dan posle novog rezultata | `locked-result.ts 5K`: 0/108 (08g dopuna; f4b257d 20/108, 08g 47/5184 → 0) | — | trajna mreža: faster/slower/test5k kraj ned k + zaključan Q1 ned k + 1 → 0 odbijanja, dan bajt-isti |
| 2 urađen Q1 posle asOf | u 5K nije činjenica: `checkFacts` odbija zapis posle asOf (ADAPT_FACT_AFTER_AS_OF, 5184/5184) — ugovor domena, bez izmene | — | — |
| 3 pouka 35 | generator e41defc **88 / 3816** planova sa nedeljom izgradnje (2 kvaliteta) i danom kvaliteta dužim od dugog (npr. `f-d4-6w-15km-e300-0` ned 1: usponi 20 min > dugi 18 min; testovi 3 km 44 > 41 min); adaptacija 1217 / 104 800 tokova | `week.secondQualityEasy` (jedino mesto): drugi dan kvaliteta lagan (napomena „… (pouka 35)"), prvi ostaje, obim ide u dugi/lagane (`weekLengths`), doza drugog se ne beleži; nedelja sa jednim neizvodljiva → dva ostaju + upozorenje LONG_NOT_LONGEST; validator: SECOND_QUALITY (ista funkcija), oznaka → ROLES očekuje 1 | `segment08h.node.test.ts` (primer, mreža generatora, 2 provere validatora) |

Pouka 35 važi u izgradnji (baza, vrhunac, oštrenje), i u nedelji sa danima bola (dugi poređen bez ograničenja bola),
ne u nedelji sa danima odmora; taper i trkačka izuzeti. Posle: generator 0 / 3786, adaptacija 0 / 104 800,
LONG_NOT_LONGEST 0 (nedelja sa jednim kvalitetom izvodljiva u svim slučajevima mreže).

## 2. Regresija

- Generator (3816 ulaza) prema e41defc: promenjeno tačno 88 — svi sa napomenom pouke 35; 0 novih odbijanja.
- Trajna rana mreža (104 800 tokova) prema e41defc: promenjeno 2632 — 2555 P (rezultat ili prethodni plan sa pomenom pouke 35), 77 tokova planova
  generatora iz spiska 88 (prethodni plan je drugačiji); **bez razloga 0**, odbijeno 0.
- Fixture 08g (prema f4b257d) ponovo snimljen sa klasom P (`testInputs.family08g`, `hasSecondEasy` rezultata ili
  prethodnog plana): promenjeno 6834 / 104 800 — F 3272, P 2534, N4 593, R 399, N3 34, C 2; **bez razloga 0**.
- Starije regresije (izuzetak P35, nezavisno: `hasSecondEasy`): segment07 generisanje 14 / 640 planova; 08d postojeće mreže 1;
  08e uska 8, šira 33 (TOTALS: uska 1102 / 83, šira 1317 / 310).

## 3. Sabotaže (`node scripts/sabotage.mjs ../docs/5k-v2/artifacts/segment-08h/sabotage-08h.json`)

| # | sabotaža | ishod | prvi pali test | trajanje |
|---|---|---|---|---|
| 1 | 08h-1 konstruktor bez pouke 35 (drugi kvalitet ostaje) | PAO | `segment08h.node.test.ts` — (fajl pao van pojedinačnog testa — uvoz ili hook) | 11.5 s |
| 2 | 08h-2 validator ne čita secondQualityEasy | PAO | `segment08h.node.test.ts` — validator: dva dana kvaliteta kad bi dugi bio kraći → S | 12 s |
| 3 | 08h-3 validator ne čita oznaku pouke 35 (broj kvaliteta) | PAO | `segment08h.node.test.ts` — (fajl pao van pojedinačnog testa — uvoz ili hook) | 11.6 s |
| 4 | 08h-4 umor: rasterećenje uvek sledeće nedelje (pouka 36, po danima) | PAO | `segment08h.grid.node.test.ts` — 5 planova: zapisi umora pet/ned nedelje k − 1, asOf ned | 12.1 s |
| 5 | 08h-5 zaključan budući dan ulazi u lanac doze | PAO | `segment08h.grid.node.test.ts` — 5 planova: nov rezultat + zaključan Q1 sledeće nedelje  | 11.5 s |

Ukupno 5/5 PALO, 59.2 s (redom, brz nivo, `--bail=1`); stanje `src` isto pre i posle. Kod #1 i #3 fajl pada već pri sakupljanju: generator odbija plan primera (SECOND_QUALITY, odnosno ROLES), pa `planOf` baca grešku.

## 4. Komande (iz `web/`)

| komanda | rezultat |
|---|---|
| `npx tsc -b --noEmit`, `npx eslint .`, `npx prettier --check .` | exit 0 |
| `npm run check` | exit 0 — 289 fajlova, 3444 testa, 392 s |
| `TEST_FULL=1 npx vitest run --changed 23b1b88` | exit 0 — 266 fajlova, 2533 testa, 2482 s (uključuje HM/maraton sa grane) |
| `TEST_FULL=1 npx vitest run --project node src/domain/generators/fiveK/v2` | 25 fajlova, 686 / 686, 256 s |
| `npx playwright test e2e/fivek-v2.spec.ts` | 3 / 3, 37 s |
| `node ../docs/generators-v2/final-check/locked-result.ts 5K` / `fatigue-monday.ts` | 0 / 108; 5K tekuća+0 22, bez novog 13 |
| `BYTE_SAME_RECORD=1 … byteSame.node.test.ts` (10K, HM, maraton) | samo redovi „5K v2" |

## 5. Stalni uslovi (AGENTS.md 1–8)

1. Jedan vlasnik: broj dana kvaliteta — `week.secondQualityEasy` (konstruktor, validator); dužine — `weekLengths`.
2. Plafoni nedirnuti. 3. WU/CD nedirnuti; oslobođen obim ide u dugi i lagane, ne u WU/CD.
4. Bez izmene adaptacije osim istog pravila u konstrukciji. 5. Handoff: bez izmene.
6. `5k-v2.8.1`; KNOWN_VERSIONS = 2.6.0, 2.6.1, 2.7.0, 2.8.0, 2.8.1. 7. Izolacija prolazi.
8. Trajne mreže 08g/08h: 0 odbijanja, Uslov 8 bez prekršaja.

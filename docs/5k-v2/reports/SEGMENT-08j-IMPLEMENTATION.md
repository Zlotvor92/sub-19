# 5K v2 — Segment 08j (5k-v2.10.2): K9 — drugi korak adaptacije posle smanjenja

Polazni SHA `9676d1e` (posle 08i-b). Grana `claude/generator-isolation-5k-10k-hm-marathon`. Menjano `fiveK/v2/**`,
`docs/5k-v2/**`; izuzeci kao 08i (redovi „5K v2" u byteSame, oznaka u `fiveKV2Flow.test.tsx`). Bez PR-a, mergea, deploya.

## 1. Uzrok korak po korak (pouka 23)

| korak | strana | ispravka | test |
|---|---|---|---|
| Korak 1 (pauza/manjak) daje cilj koraka `startKm` nedelji `fromWeek` (npr. 14,8 umesto 18,5). Korak 2 (bilo koje činjenice, i iste) ima isti `fromWeek`, bez cilja: `volume.adaptVolume` je u petlji koraka 2 nedelju gradio od `lastBuild` → cilj generatora 18,5 | konstruktor | nedelja sa ciljem RANIJEG koraka (`resets`) zadržava cilj i ostaje osnov rasta (i kad je rasteretna) | `segment08j.node.test.ts` (2 primera) |
| Validator (`resetKm`) drži cilj koraka 1 → VOLUME_RESET 18,5 > 14,8, VOLUME_GROWTH 13,8 → 18,5, VOLUME_PEAK (nov start) | — | bez izmene (sudi tačno) | — |
| Idempotentnost: korak 1 u nedelji testa (po osećaju) gde test ne staje → odmah „jedan kvalitet doze rasterećenja"; korak 2 (prethodni plan bez testa) gradi nedelju normalno → druga doza → drugi dani posle asOf | konstruktor | test koji ne staje otpada PRVO sam (ista ograničenja, napomena), tek onda manje kvaliteta (pouka 13) | idempotentnost f-d3-16w-12km-e420-0 |

HM/10K/MAR (uzor): cilj koraka drže kroz sve kasnije korake; 5K sada isto.

## 2. Merenje (iz `web/`; izlazi `artifacts/segment-08j/`)

| skripta | 9676d1e (08i-b) | 08j |
|---|---|---|
| `two-step.ts 5K 30 30 20` new (75 072) | 3 624 odbijeno (RESET 3 025, GROWTH 717, PEAK 58) | **0** |
| ↳ cum (75 072) | 3 696 (RESET 3 097, GROWTH 717, PEAK 58) | **0** |
| ↳ commonChecks DUGI<LAGAN (K5) | new 6, cum 159 | new 0, cum 153 — svih 153 nedelja: lagan duži od dugog je ZAKLJUČAN dan (`k5-protected-easy.txt`), po pouci 37 (zaštićeni su činjenice; plan > cilj nosi upozorenje) |
| idempotentnost (`idempotence.ts`, 49 planova × 7 smanjenja × +3/+7) | — | 686 tokova: 0 odbijanja, ciljevi i dani posle asOf isti (razlika samo napomena „test otpada") |
| `early.ts 5K 193 97 29` | 18 252, 0 odbijanja | isto |
| `locked-result.ts 5K` | 0 / 108 | 0 / 108 |
| `start-day.ts 5K 25` | 5 134, 0 odbijanja, inv 0 | isto |

## 3. Regresija

- Generator bajt-isti. Heš 99 069 tokova (`regress-08j-vs-08i-b.txt`) prema 08i-b: ciljevi 0, km naviše 0; promenjeno
  305 — 237 jednokoračnih + 62 drugih koraka sa napomenom „test ne staje … otpada" (klasa K: test otpada sam umesto
  „jedan kvalitet"), 6 drugih koraka lanca posle promenjenog prvog. Ispravka K9 sama ne menja nijedan jednokoračni tok.
- Trajna rana mreža 08g (104 800) prema 08i-b: promenjeno 791 — test otpada sam 783, drugi korak posle koraka sa
  ciljem 8 (svi klasa K, `testInputs.hasTestDroppedAlone` / korak sa `startKm`); 0 odbijanja. Fixture 08g ponovo
  snimljen (K 789), bez razloga 0. 08e TOTALS: uska + 10, šira + 21 (porodica).
- Odstupanje od očekivanja organizatora („menjaju se samo tokovi sa 2+ koraka"): jednokoračni tokovi sa testom koji
  ne staje — potrebni za uslov idempotentnosti (bez toga isti činjenice daju drugu dozu u ponovljenoj adaptaciji).

## 4. Trajna mreža `segment08j.*` (pun: svaki 4. plan uzorka, 4 dela po ~30 s)

Smanjenje (manjak, više od plana, pauza 10/20/35, lanac, bol + pauza) → 17 scenarija × +3/+7 × new/cum: 0 odbijanja;
iste činjenice ponovo → isti ciljevi, rasterećenja, test i dani posle asOf. Brz nivo: 2 plana.

## 5. Sabotaže (`node scripts/sabotage.mjs ../docs/5k-v2/artifacts/segment-08j/sabotage-08j.json`)

| # | sabotaža | ishod | prvi pali test |
|---|---|---|---|
| 1 | kasniji korak gradi nedelju cilja ranijeg koraka od generatora | PAO | trajna mreža 08j |
| 2 | test koji ne staje ne otpada sam | PAO | 08j idempotentnost |
| 3 | trajna mreža bez smanjenja u prvom koraku | PAO | trajna mreža 08j (smanjenje 0) |

3/3 PALO, 10,6 s; stanje `src` isto.

## 6. Komande (iz `web/`)

| komanda | rezultat |
|---|---|
| `npx tsc -b --noEmit`, `npx eslint .`, `npx prettier --check .` | exit 0 |
| `npm run check` | exit 0 — 308 / 3589, 504 s |
| `TEST_FULL=1 npx vitest run --changed 9676d1e` | exit 0 — 196 / 1931, 970 s |
| `TEST_FULL=1 npx vitest run --project node src/domain/generators/fiveK/v2` | 36 / 717 (08e TOTALS ažuriran → 27 / 27) |
| `npx playwright test e2e/fivek-v2.spec.ts` | 3 / 3 |
| byteSame 10K/HM/maraton | samo redovi „5K v2" (oznaka; sa 5k-v2.10.1 prolaze bez snimanja) |

## 7. Stalni uslovi (AGENTS.md 1–8)

1. Jedan vlasnik cilja nedelje — `volume.adaptVolume` (cilj koraka drži i kasniji korak); validator čita isti podatak
   (`resetKm`). 2–3. Plafoni i WU/CD nedirnuti. 4. Koraci u planu ponavljaju se redom. 5. Handoff bez izmene.
6. `5k-v2.10.2`; KNOWN_VERSIONS ∪ 5k-v2.10.1. 7. Izolacija prolazi. 8. Trajne mreže 08g/08i/08j: 0 odbijanja.

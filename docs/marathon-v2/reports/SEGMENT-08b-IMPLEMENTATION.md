# Maraton v2 — Segment MAR-08b (marathon-v2.5.1): K1 zaključan test, K3 lanac pre starta, K4 minimum, K5, pokrivenost

Polazni SHA `d73b83a` (MAR-08 + grana). Menjano samo `web/src/domain/generators/marathon/v2/**` i `docs/marathon-v2/**`.
Bez STANI. DECISIONS: A13c (pouka 38), K3, K4; A11c dopunjen (dan poznat iz pokrivenosti bez zapisa = 0).

## Uzrok | strana | ispravka | test

| nalaz | uzrok (korak po korak) | strana | ispravka | test |
| --- | --- | --- | --- | --- |
| K1 zaključan test + pauza/umor/bol → TEST „najviše jedan test" | (1) pauza: okvir testa je blokiran → test premešten u sledeću nedelju; (2) spajanje (A11) zadržava zaključan test → dva testa. Umor: rasterećenje na nedelji testa prebacuje dan testa okvira na T slot → drugi test na drugom datumu | konstruktor (A13b je štitio samo test ≤ asOf) | `steps.framesFor(…, kept)`: test čiji je dan iz plana pre koraka ≤ asOf, zaključan ili urađen je zaštićen — bez premeštanja; okvir koji i dalje nosi test na tom danu ostaje isti, inače nijedan okvir nema test (zaključan dan ga nosi). Isti `kept` iz konstruktora, `adapt.ts` i validatora | segment08b K1 (4), protectGrid |
| K3a bol 8 (start − 1) → bol 8 u ned 1 → EMPTY_WEEK | svi dani trčanja ned 1 su dani odmora bola (A4) | validator | `week.allRestWeek` → upozorenje WEEK_ALL_REST (kao N1), ne EMPTY_WEEK | segment08b K3 |
| K3b bol 8 → umor u ned 1 → WEEK_INFEASIBLE ned 2 | rasterećenje ned 2 (pouka 36) nema prethodnu nedelju sa dugim (ned 1 cela odmor) → `lastLong10` null → `buildWeek` null za svaki cilj | konstruktor | `assess`: umor u nedelji f > 1 bez ranijeg dugog → `step.deloadRef` = nedelja 1 generatora (pouka 34); `steps.stateRefOf` — početno stanje dugog i T za konstruktor i validator | segment08b K3 |
| K4 WEEK_MIN_VOLUME 19,98 < 20 | cilj tačno na minimumu; lagani `Math.round` uz dan kvaliteta u 0,01 km → zbir ispod minimuma | konstruktor (dužine) | `lengths.easyTotal10`: na minimumu nedelje naviše (jedino zaokruživanje laganih; `weekMin10` premešten u lengths.ts, volume.ts ga izvozi) | segment08b K4 |
| Pokrivenost | dan poznat iz potpune pokrivenosti bez zapisa je u zbiru zaštićenih ulazio po planu | `mixed.factKmOf` | = 0 (pouka 37, isto pravilo kao 5K-08i-b); nezavisna kopija u adaptInvariants | segment08b, regresija |
| K5 zaključan lagan + manjak/pauza → dugi < zaključan lagan, plan > cilj bez upozorenja | korak 1 zaključava 3 buduća dana (lagan); korak 2 pauza/manjak smanji nedelju; novi dugi < zaključan lagan iz starog plana. Planirano > cilj bez upozorenja je rešio MAR-08 (pouka 37: MIXED_WEEK_OVER, zbir po činjenicama) | — (validator i invarijanta već čitaju istu funkciju) | bez nove izmene; pouka 37: dugi ≥ lagan samo među preostalim danima, dugi se ne seče | two-step: DUGI<LAGAN 157 — svih 157 sa zaključanim laganim, među preostalim 0; plan > cilj bez upozorenja (po činjenicama) 0 |

Testovi `segment08b.node` (8): na d73b83a pada 6 (K1 ×2, K3 ×2, K4, factKmOf), kontrole prolaze i pre.

## Merenje (iz `web/`, d73b83a → MAR-08b)

| skripta | pre | posle |
| --- | --- | --- |
| `final-check/locked-test.ts MAR 97` | 4200/5880 TEST | **0**, dva testa 0, inv 0 |
| `locked-pause.ts MAR 193 97 29` | 400/54 848 TEST | **0** |
| `prestart-chain.ts` (MAR) | 276/44 880: bol→bol EMPTY_WEEK 118, bol→umor WEEK_INFEASIBLE 152, →faster WEEK_MIN 6 | **0** |
| `result-pain.ts MAR 193 97 29` | 56/73 188 (WEEK_MIN 60) | **0**, inv 0 |
| `two-step.ts MAR 193 97 29` | new 86, cum 90 (WEEK_MIN 116, TEST 4); cum DUGI<LAGAN 157; inv 1 | **0 / 0**; cum DUGI<LAGAN 157 (svi sa zaključanim laganim, K5); inv 1 („doza raste“, isti tok pre i posle — otvoreno) |
| `mixed-deload.ts` MAR | 78/613 (svi MIXED_WEEK_OVER) | isto |

## Regresija (`segment-08/measure.ts` + `compare-08b.ts`, heš bez oznake verzije)

| porodica | tokova | odbijeno pre/posle | promenjeno | (a) ranije odbijen | (b) factKm (pokrivenost) | cilj | neobjašnjeno |
| --- | --- | --- | --- | --- | --- | --- | --- |
| grid / feel / beg (generator) | 21 840 / 8190 / 1890 | 0 / 0 | 0 | 0 | 0 | 0 | 0 |
| recent / dense (generator) | 35 910 / 156 954 | 930 (isto) / 0 | 0 | 0 | 0 | 0 | 0 |
| a04 (mreža 04) | 6236 | 0 / 0 | 0 | 0 | 0 | 0 | 0 |
| pre (pre starta) | 4050 | 0 / 0 | 0 | 0 | 0 | 0 | 0 |
| early (rana) | 45 101 | 0 / 0 | 4322 | 0 | **4322** (svi scenario `under`) | 0 | 0 |
| wide (široka) | 267 927 | 0 / 0 | 0 | 0 | 0 | 0 | 0 |

Pokrivenost: menjaju se samo tokovi manjka izvršenja (`under`, potpuna pokrivenost, dani bez zapisa = 0 → ostatak
nije stisnut); pauza 10 i lanac bez promene (dani pauze su u nedelji ostatka pauze — vlasnik pauze). K1/K3/K4 tokovi
nisu u ovim mrežama (merenja iznad). Prva verzija K1 (svi okviri bez testa) je menjala 11 tokova `locked` mreže 04 bez
premeštanja — ispravljeno (okvir koji i dalje nosi test na zaključanom danu ostaje isti), posle 0.

## Sabotaže (`web/scripts/sabotage.mjs`, brz nivo, `--bail=1`) — **6/6 palo**, 56,2 s, `src` vraćen

`artifacts/segment-08b/sabotage-08b.json`: (a) zaključan test se ne štiti (`kept` ignorisan); (b) WEEK_ALL_REST vraćen na
EMPTY_WEEK; (c) bez `deloadRef`; (d) lagani na minimumu `Math.round`; (e) pokrivenost bez zapisa = plan; (f) = (a) samo
nad `protectGrid.node`.

## Komande (iz `web/`)

- `npx tsc -b --noEmit` 0; `eslint src/domain/generators/marathon/v2/` 0; `prettier --check` 0.
- `npm run check`: exit 0 — 310 fajlova / 3604 testa (585 s).
- `TEST_FULL=1 npx vitest run --changed d73b83a`: 215/218 fajlova; 3 pala van maratona pod opterećenjem
  (`training/generator` audit, generator.input, science.invariants — timeout 5 s, uporedo sa regresijom) — pojedinačno
  3/3 fajla, 48/48 prolaze (2223 s).
- Pun nivo `TEST_FULL=1 npx vitest run --project node src/domain/generators/marathon/v2`: 478/478 (2534 s, uporedo sa
  regresijom).
- Brz nivo foldera: 33/376 prolaze (147 s pod opterećenjem; protectGrid uzorak ~13 s).
- E2E `npx playwright test e2e/marathon-v2.spec.ts`: 3/3.
- Merenje: final-check skripte iz tabele na d73b83a (worktree) i MAR-08b; `segment-08/measure.ts` (+ `fkh`, `tests`) i
  `segment-08b/compare-08b.ts`.

## Stalni uslovi (AGENTS.md)

1. Jedno mesto po odluci: `framesFor` (zaštićen test), `stateRefOf` (referenca), `easyTotal10`/`weekMin10`, `factKmOf`.
2. Bez novog plafona. 3. WU/CD netaknuti. 4. Zaštićeni dani bajt-isti; činjenice unapred (kept, factKm, deloadRef).
5. Predaja nepromenjena. 6. marathon-v2.5.1; KNOWN_VERSIONS ∪ 2.5.0. 7. Uvozi samo iz `marathon/v2`. 8. Trajna mreža
`protectGrid` (8 delova): zaključan dan testa × 6 scenarija, lanac pre starta × 17 → 0 odbijanja, adaptInvariants prazno.

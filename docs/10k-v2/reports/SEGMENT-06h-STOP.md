# 10K v2 — Segment 06h: STANI (umor pre starta sa asOf = prvi dan plana)

Polazni SHA `b8fcf22` (10k-v2.6.1). Ispravka uzroka je spremna (`artifacts/segment-06h/fix-preStart-key.patch`,
lokalno, nije commitovana). Staje se pre tačke 1 (ostatak nedelje „do cilja minus upisani dan") — sudar sa važećim
pravilom mešovite nedelje (06f), opcije ispod.

## Uzrok korak po korak (pouka 23)
Primer `d3-8w-20km-v30-A-sat` (start ned 2026-11-01, dan 1 = dugi 9 km), asOf 2026-11-01, zapisi umora 10-31 i 10-29.
1. `assess`: next = 11-02 → r = 1, n = fromWeek = **2**. Sidro umora = 10-31 + 1 = 11-01 → f = 1 → `deloadWeek` =
   **1** (pouka 36, ostatak tekuće nedelje) i `preStart` (f = 1) — oba u istom koraku.
2. `steps.framesFor`: rasterećenje na `deloadWeekOf(s)` = 1 (ispravno).
3. Konstruktor čita referencu po **fromWeek**, ne po nedelji rasterećenja: `volume.adaptVolume` (`preStart.set(s.fromWeek…)`)
   i `generate.ctxAt` (`s.fromWeek === w`) → nedelja 1 rasterećenja bez reference (lastBuild null, lastLong null) →
   `week.buildWeek` vraća null za svaki cilj → **WEEK_INFEASIBLE** u construct (validator nije ni dosegnut).
4. Validator (`validate.ts` 1038) isto po fromWeek — ista greška na obe strane.

**Strana koja odstupa:** ključ reference `preStart` (06e, pisan kad je nedelja rasterećenja uvek bila fromWeek); 06f je
nedelju premestio u `deloadWeek` (`steps.deloadWeekOf` — jedina definicija), a `preStart` nije pratio. Sa asOf = start − 1
deloadWeek ne postoji (f = n = 1) → isto. Ispravka: sva tri čitanja po `deloadWeekOf(s)` (konstruktor 2, validator 1).

## Merenje (iz `web/`, ispravka primenjena lokalno)
| | b8fcf22 | ispravka |
|---|---|---|
| `fatigue-startday.ts 10K 25` | 1245/1245 odbijeno (start + 0) | **0** |
| `fatigue-testweek.ts 10K 25` | 86/6650 | **0** |
| `start-day.ts 10K 25` (17 scenarija, start + 0/+ 1, lanac) | 623 (umor + 0) | **0 odbijanja, adaptInvariants 0** (42 330 tokova) |
| regresija `artifacts/segment-06h/hash.ts` (svaki 40. plan R/F/B, asOf start − 6, − 3, − 1, + 0, + 1, + 2, + 3, + 6, + 7, + 9, + 14 × 17 scenarija; heš bez oznake verzije) | 145 673 toka | promenjeno **779 = svi start + 0 umor, svi ranije odbijeni**; drugih 0 |
| start + 0 prema start − 1 (`cmp.ts`, 1245 planova) | — | ned 2…N bajt-iste, ned 1 cilj isti, svi dani osim dana 1 isti: **1245/1245** |

Posle ispravke start + 0 = start − 1 (pouka 34 i 36: ista nedelja rasterećenja, referenca nedelja 1 generatora, doza
ned 2 = planirana ned 1), osim dana 1 koji ostaje upisan kakav jeste. Primer: ned 1 cilj 16,0 km; start − 1: dugi 7,2 +
4,4 + 4,4 = 16,0; start + 0: **dugi 9,0 (upisan)** + 4,4 + 4,4 = **17,8 km planirano**.

## Sudar (tačka 1: „ostatak nedelje do cilja rasterećenja minus upisani dan")
Važeće pravilo svih mešovitih nedelja (A11, `written.ts`, 06d/06f): konstruktor sastavlja celu nedelju na cilj, upisani
(zaštićeni) dani zamenjuju sastavljene → planirano = cilj + (upisano − sastavljeno). Mehanizam „ostatak do cilja minus
upisani dani" ne postoji nigde u 10K v2. Merenje (`mixed.ts`, svaki 25. plan, umor sa asOf = prvi dan nedelje k):
- k = 1 (ovaj slučaj, posle ispravke) 805, k = 2 816, k = 3 815 tokova sa planirano > cilj (dan 1 je dan trčanja);
  start + 0: prosečno + 2,46 km, najviše + 6,73 km.
- Izvodljivost ostatka = cilj − upisani dan (`rem.ts`, 1245 start + 0): dan 1 nije trčanje 395 (već = cilj); ostatak
  ≥ 3 km po danu: dugi 364, lagan 426, q1 49; **ostatak < 3 km/dan 11** (npr. `d5-13w-30km-v70-B-sat` cilj 19,9, dan 1
  dugi 9, 4 dana; `b-d3-10w-15km-v35-A-sat` cilj 12, dan 1 dugi 6,7, 2 dana) → tačka 2 (pouka 33/30). Grubo: provera
  samo minimuma laganog, ne dugi ≥ lagan / kvalitet.

## Opcije
- **A — samo ispravka ključa (merenje gore).** start + 0 sledi isto pravilo mešovite nedelje kao tekuća nedelja
  rasterećenja k ≥ 2 (06f). 0 odbijanja, regresija čista, nijedan novi mehanizam. Mana: ned 1 planirano > cilj
  (805/1245, + 2,46 km prosečno) — nije „do cilja minus upisani dan".
- **B — A + ostatak = cilj − upisani dani samo za nedelju sa `preStart`.** Ispunjava tačku 1 doslovno, menja samo start + 0.
  Mana: dva pravila za istu situaciju (tekuća nedelja prinudnog rasterećenja: k = 1 do cilja, k ≥ 2 iznad cilja) —
  protiv uslova 1 i pouke 24; nov mehanizam u `week.buildWeek` (fiksni dani) + validator; 11 tokova pod tačkom 2.
- **C — A + ostatak = cilj − upisani dani za svaku mešovitu nedelju (vlasnik obima zna upisane dane, uslov 4).**
  Jedno pravilo. Mana: menja hiljade ranije prihvaćenih tokova (k ≥ 2 sam ≈ 1600 na svakom 25. planu; i ostali
  scenariji sa asOf usred nedelje) → regresija van start + 0 (zabranjeno ovim zadatkom), zaseban segment sa merenjem;
  ista odluka važi za 5K/HM/maraton (pouka 29).

**Preporuka: A sada (10k-v2.6.2, trajna mreža start + 0, testovi, sabotaže po zadatku), C kao zaseban segment ako
organizator želi „ostatak do cilja" kao pravilo mešovite nedelje** (sve 4 distance). B ne preporučujem (dva pravila).

## Šta čeka odluku
Kod (ispravka ključa) nije commitovan; trajna mreža, testovi, verzija 10k-v2.6.2, DECISIONS, sabotaže i izveštaj
IMPLEMENTATION posle odgovora. 3d (tenK/v2) i dalje čeka push ovog segmenta.

Komande (iz `web/`): `node ../docs/generators-v2/final-check/{fatigue-startday,fatigue-testweek}.ts 10K 25`,
`start-day.ts 10K 25`; `node ../docs/10k-v2/artifacts/segment-06h/hash.ts <root> <deo> 2 40` (b8fcf22 u worktree-u vs
ispravka), `cmp.ts`, `rem.ts`, `mixed.ts 25`.

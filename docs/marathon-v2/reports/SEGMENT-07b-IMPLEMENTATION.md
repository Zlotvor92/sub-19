# Maraton v2 — Segment MAR-07b (marathon-v2.4.1): validator ne sudi zaštićenim danima

Polazni SHA `46a3e22` (MAR-07). Odluka organizatora (otvoreno pitanje 1 iz MAR-07): provere koje sude jednom danu po
tempu ili strukturi preskaču zaštićene dane — urađene, zaključane (ručne izmene) i ≤ asOf — kao LIMITS. Pouka 4 i
stalni uslov 4: završna zaštita samo štiti. Bez STANI.

## Izmena | mesto | test

| izmena                                                                                                                                                                                                                                              | mesto                                       | test                               |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- | ---------------------------------- |
| `protectedDay(d)` = ≤ asOf adaptacije ∪ zaključan ∪ urađen; preskače: M10/M14 petlju (doza, RPE, WU/CD, oporavci, strukture, faza), lagan ≥ 5 km, pouka 32 dan ≤ dugi, detalj testa M16; LIMITS i LONG_JUMP već preskaču zaključane, sada i urađene | validate.ts                                 | segment07 MAR-07b (3)              |
| Urađen dan posle asOf (dayId činjenice, npr. odrađen dan ranije) → `plan.adaptation.doneDayIds` (polje samo kad nije prazno) — validator inače ne zna da je dan zaštićen                                                                            | adapt.ts, generate.ts, written.ts, types.ts | segment07 „urađen Q2"              |
| Trajna rana mreža: rezultat (brži, sporiji, test 5 km) × zaključan / urađen Q1 i Q2 sledeće nedelje, asOf kraj nedelja iz earlyAsOfs                                                                                                                | earlyGrid.harness                           | earlyGrid (brz uzorak, pun 4 dela) |
| marathon-v2.4.1 (plan sa urađenim danom posle asOf nosi novo polje); KNOWN_VERSIONS = 2.3.1, 2.4.0, 2.4.1; DECISIONS A11b                                                                                                                           | policy.ts, app/plan.ts                      | policy.node, app                   |

Svi 3 nova testa u `segment07.node` padaju na 46a3e22 (proveren worktree), kao i nova vrsta tokova trajne mreže.

## Merenje

- Trajna rana mreža, novi tokovi (12 432): na 46a3e22 **12 196 odbijeno** (WARMUP/COOLDOWN i dr. na zaštićenom danu
  posle novog tempa) → **0**, adaptInvariants prazno (zaštićen dan bajt-isti).
- Regresija (`segment-07/measure.ts` + `compare.ts`, „post" MAR-07 → posle 07b; menjati se smeju samo ranije odbijeni):

  02 21 840, M13a 35 910 (930 → 930 RECENT_LONG_TOO_SHORT), po osećaju 8190, početnik 1890, 04 6236, trajna rana
  45 101, rana pre starta 4050, široka 267 927 — **0 promenjenih tokova/planova**, 0 odbijanja više ili manje
  (`artifacts/segment-07/compare-07b-result.json`). Mreže nemaju rezultat uz zaštićen budući dan, pa ranije odbijenih
  tokova u njima nema; oni su u novoj vrsti trajne mreže (gore). Gusta mreža (samo generator) nije ponovo merena:
  izmena deluje samo na plan sa `adaptation`.

## Sabotaže (`web/scripts/sabotage.mjs`, brz nivo, `--bail=1`) — 2/2 palo, 18,2 s, `src` vraćen

`artifacts/segment-07/sabotage-07b.json`: (a) provera po danu bez preskakanja zaštićenih; (b) urađen dan posle asOf
nije zaštićen (doneDayIds se ne čita).

## Komande (iz `web/`)

- `npx tsc -b --noEmit` 0; `eslint src/domain/generators/marathon/v2/` 0; `prettier --check` 0.
- `npm run check`: exit 0 — 286 fajlova / 3432 testa (229 s).
- Pun nivo `TEST_FULL=1 npx vitest run --project node src/domain/generators/marathon/v2`: 47 / 404, prošlo (735 s).
- Brz nivo maratona v2: 334 testa, 51,2 s zid (sam; nova vrsta tokova u uzorku); E2E `e2e/marathon-v2.spec.ts` 3/3.

## Stalni uslovi

Uslov 1: jedno mesto (protectedDay). Uslov 4: završna zaštita samo štiti — validator ne sudi zaštićenim danima. Uslov
6: `marathon-v2.4.1`. Uslov 7: uvozi samo iz `marathon/v2`. Uslov 8: nedeljna pravila i invarijante važe za konstrukciju.

# HM v2 — Segment HM-09 (hm-v2.7.0): ispravke posle dubinske provere

Zadatak: `docs/generators-v2/audit/fixes/00-common.md` + `fixes/HM.md` (zaključan spisak). Polazni SHA `c13c258`
(merenja „pre" u worktree-u na tom SHA). Menjano: `halfMarathon/v2/**`, `web/e2e/hm-v2.spec.ts`, `docs/hm-v2/**`.
DECISIONS `HM-09` (policy.ts). Artefakti: `docs/hm-v2/artifacts/segment-09/` (skripte, `measure/pre|post`, sabotaže).

## Stavka → ispravka → broj pre → posle

| # | stavka | ispravka (jedan vlasnik) | merenje | pre → posle |
| --- | --- | --- | --- | --- |
| 1 | B2: bol 8 + umor u istom koraku → WEEK_INFEASIBLE ned 2 | `assess` daje `deloadRefLongKm` uz svaki umor od ned 2; da li upisani plan ima dugi odlučuje samo `steps.longRef10` (konstruktor i validator, upisani dani NOVOG plana) | `owner/hm-deloadref1.ts 1` | 19 490 / 19 490 → **0** |
| 2 | B1: referenca dugog rasterećenja ned 3 (validator pamtio referencu ned 2) | `steps.longRef10(lastLong10, steps, w)` po nedelji, ne pamti se (generate + validate) | `owner/hm-deloadref.ts 4 10,12,14,16` | 3 758 DELOAD_LONG / 13 860 → **0** (13 860 ok) |
| 3 | B3: početnik u 3 koraka → WEEK_INFEASIBLE ned 11 | uzrok potvrđen: najduži dugi pre tapera 6,6 km → 0,6 × = 3,9 km < 4 km (`withEasy`); `lengths.taperLongCap10` ≥ 4 km (kao A18 rasterećenja) + upozorenje `TAPER_LONG_MIN` | `hm-deloadref.ts 4 …` (WEEK_INFEASIBLE), `segment-09/b3-flow.ts` | 8 → **0**; tok `b-d5-12w-25km-e390-A` prihvaćen, taper dugi 4 km |
| 4 | 1b #5: L skoka dugog iz neistrčanih planiranih dugih | `assess.ranLongOf`: najduži trčan prošlih nedelja cele poznate (pokrivenost/pauza; nedelja delom u dva koraka — `step.ranPart`) → `step.ranLongKm`; `steps.ranLongFor` (važi od fromWeek koraka — samo cele buduće nedelje; tekuća i prošle se rekonstruišu isto); `lengths.rollingCapRan10` (od ned 5; L = 0 → kao pre; ne ispod najmanjeg dugog nedelje minimuma `ranCapFloor10` = max(4 km, minimum/dani); nikad labavije) | `coach-hm-mar/measure-jump.ts HM 400 200 100`, `jump-example.ts` | 1 060 / 9 058 (0 odbijanja) → **0** (0 odbijanja); primer ned 12 dugi 21,4 → 9,5 km (L 8,5) |
| 5 | Z5b: MAR v2 početnik 45 km → HM cilj WEEKLY_KM_TOO_HIGH | `app/handoffTarget.handoffFuture`: odbijanje generatora cilja WEEKLY_KM_TOO_HIGH za početnika → isti ulaz bez oznake početnika (odluka generatora cilja) | test `handoffTarget` Z5b | ponuda nije postojala → postoji |
| 6 | Z4: vraćanje revizije | po pojašnjenju organizatora: `restoreMerge` spaja (cela prošla nedelja iz trenutnog plana; kad se razlikuje od verzije — mešovita, kao jezgro `writtenWeeks`), pa `validatePlan` (jezgro) i sledeće prilagođavanje bez činjenica (`adaptHmV2`); prolazi → vraća se, ne prolazi → odbijanje sa razlogom | `segment-09/hm-restore.ts` (k = 0, 1, 4, 8 dana) | vraćeno i krši validator 1 565 / 3 168 → **0** / 4 224; sledeća adaptacija odbijena 236 → **0**; neposredno poništavanje (k = 0) **1 056 / 1 056** vraćeno; odbijeno 1 476 sa razlogom (`measure/post/restore.txt`) |
| 7 | 1b #1: pouka 35 u taperu | `week.taperSecondEasy` (konstruktor i validator): dva dana kvaliteta, neki duži od dugog → drugi lagan, nedelja kao „samo RP" | `coach-hm-mar/measure.ts HM 400 200 100` | gen dva dana 552 → **0** (t1 1 446 → 744 = jedan dan na najnižoj dozi); adapt dva dana 636 → **0**, bez upozorenja 997 → 286 |
| 8 | 1b #2: napomena „ne sme biti duži" kad jeste | napomena tapera: „najmanja doza; dan kvaliteta je i dalje duži od dugog tapera" | `measure.ts` contra | gen 909 → **0**; adapt 546 → **0** |
| 9 | app A2 + C10 | uvod: „Uvod: prva od 2 uvodne nedelje, bez kvaliteta …"; `assess` „već rasterećenje" → `wl(f)` | test beginner | — |
| 10 | Z1 | `week.mixedQualityStays` (remainderWeek + validator): upisani višak jedini uzrok i planirano ≤ 1,10 × cilj → kvalitet ostaje, lagani 4 km, MIXED_WEEK_OVER | `consistency/mixed-drop.ts HM 97` | otpao u over120 sa viškom ≤ 10 %: 1 321 → **0** (> 10 %: 217 → 167); 0 odbijanja |
| 10 | Z2 | `userText.ts` (jedno mesto): app prikazuje napomene, upozorenja, razloge i odbijanja bez internih oznaka, decimalni zarez, km ≤ 1 decimala, bez „.."; plan i validator i dalje nose oznake (markeri) | `segment-09/hm-usertext.ts 40` | 31 501 tekst: oznaka 16 511 → **0**, tačka 474 → **0**, km sa 2 decimale 43 → **0**, „.." 0 → 0 |
| 10 | Z3 | `assess.resultUse` (jedna odluka A1) čitaju assess i Forma | `owner/hm-form-result.ts` | 495 / 528 → **0** |
| 11 | owner K1, fuzz F6 | `adaptInvariants` početnik rast ≤ 2,0 km; `gridInvariants` DELOAD_LONG izuzetak „podignut" uz test (pouka 32) | test F6 (#8208) | F6 ulaz: DELOAD_LONG → 0 |

„..": u jezgru HM ih nema (0 / 31 501); dupla tačka na ekranu dana dolazi iz `features/session/WorkoutParts.tsx:134`
(zajednički UI — nije dirano, javljeno).

## Promene generatora (otisak; `segment-09/changed09.ts`, `segment09.changed-c13c258.json`)

Mreže 02, 03 (po osećaju, početnik) i pouke 28 (`r-`): **a** 2 541 planova — samo taper i trkačka nedelja (pouka 35
u taperu; trkačka čita taper); **d** 23 790 — samo tekst (uvod početnika, napomena tapera, dopuna T: „skorašnje
najduže trčanje", „tempo treninga i dalje zavisi od rezultata", razlog RECENT_LONG_TOO_SHORT); drugo 0.

Dopuna T (`fixes/02-text-addendum.md`): validate „Nedelja nema dugo trčanje.", „Dugo trčanje je samo lagano.";
generate/input „Skorašnje najduže trčanje … prekratko / mora biti između"; paces „tempo treninga i dalje zavisi od
rezultata". Bazne linije
segmenata 02/03 ostaju; `mayChange` prima i CHANGED_09 (konvencija HM-07). Adaptacija: korak nosi
`ranLongKm`/`ranPart` kad ih ima; taper/mešovite nedelje po stavkama 3, 4, 7, 10.

## Sabotaže (`scripts/sabotage.mjs`, brz nivo, `--bail=1`) — 12/12 palo

`segment-09/sabotage-09.json` (rezultat `sabotage-09.result.json`; #2 posle zamene ponovo, palo): B2 referenca samo
bez dugog · B1 validator pamti referencu · B3 bez poda · L skoka iz planiranog · pouka 35 taper · napomena „ne sme" ·
Z1 · Z2 · Z3 · Z4 · Z5b · F6.

## Testovi (iz `web/`)

Novi: `segment09.node.test.ts` (9; 7 padaju na c13c258, 2 za Z4), `userText.node.test.ts` (2), Z3 u `app/form.node.test.ts`,
Z5b u `app/handoffTarget.node.test.ts`, Z4 u `app/adaptFlow.node.test.ts`; E2E `hm-v2.spec.ts` nepromenjen (neposredno poništavanje prolazi).

- `tsc -b` 0 · `eslint` 0 · `prettier` 0
- brz nivo `halfMarathon`: 40 / 344, exit 0
- pun nivo `TEST_FULL=1 … halfMarathon`: 83 / 447, exit 0
- `npx vitest run --changed 670700e`: 333 / 333 fajlova, 3 731 / 3 731 testova, exit 0 (posle izmena van foldera);
  3 v1 testa `training/generator` koja su pala pod opterećenjem merenja prolaze sami (48/48)
- E2E `npx playwright test e2e/hm-v2.spec.ts`: 3/3
- run-all `'.*-HM|handoff-adapt-.*HM.*'` (18 poslova, na 71af52a; posle toga samo tekst, app vraćanje i testovi): 1 nečist = edges-HM inv 26 (poznato, FINAL-2026-10-23);
  two-step-HM 0/115 328 (new i cum), MAR→HM 0/47 736 (više tokova: Z5b početnik sada ima ponudu), early 0/114 012
  (`artifacts/segment-09/run-all-summary.txt`)

Izmene VAN foldera (odobrenje organizatora): `marathon/v2/app/byteSame.9443676.json` — samo 13 redova „HM v2"
(BYTE_SAME_RECORD=1, ostali redovi zadržani; snimak ne menja nijedan drugi red); `features/onboarding/hmV2Flow.test.tsx`
— napomene kao doslovan korisnički tekst (bez uvoza iz unutrašnjosti v2). `features/plan/hmV2Adapt.test.tsx` prolazi
bez izmene (neposredno poništavanje). „.." je ispravio organizator (`WorkoutParts.tsx`, d2f812a).

## Stalni uslovi

1. Jedan vlasnik: `longRef10`, `ranLongFor`/`rollingCapRan10`, `taperLongCap10`, `taperSecondEasy`,
   `mixedQualityStays`, `resultUse`, `userText` — konstruktor i validator/app zovu istu funkciju. 2–3. Plafoni i
   WU/CD nedirnuti. 4. Činjenice ulaze kroz korak (assess). 5. Z5b: cilj sam određuje politiku. 6. `hm-v2.7.0`
   (`KNOWN_VERSIONS` ∪ `hm-v2.6.2`). 7. Bez uvoza van foldera (`userText.ts` bez uvoza). 8. 0 odbijanja na merenjima.

## Primećeno, nije rađeno

- Napomena rasterećenja „ne sme biti duži od dugog rasterećenja" (`week.ts` deload) ima isti obrazac kao 1b #2 —
  nije na spisku.
- Formule u tekstu za korisnika („max(1,1 × najduži, najduži + 1 km)") ostaju (Z2 traži samo oznake).
- Validator i dalje računa sam trajanje dugog, km WU/CD, lagan trkačke (owner, algebarski isto) — nije na spisku.

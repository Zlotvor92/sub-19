# Segment 3f — HM v2 kao CILJ predaje „kraća distanca" (izvor: maraton v2)

Grana `claude/generator-isolation-5k-10k-hm-marathon`, polazni SHA `a6185aa`. Bez PR-a, mergea i deploya. Odluke:
DESIGN.md § 3 P3/P5, § 8 (O3a, O4a, O6b). `tenK/v2` i `fiveK/v2` nisu dirani; u `marathon/v2` je dirano samo 13 redova
snimka (v. § 4). Izvor maratona v2 dolazi u 3e, pa je izvor u testovima sintetički: plan iz generatora maratona v2 +
činjenice 4a.

## 1. Izmene

| Fajl | Izmena |
|---|---|
| `halfMarathon/v2/app/handoffTarget.ts` (nov) | `handoffFuture(current, input, today, _, facts)`: (1) start = `alignedStart(trka, asOf + 1)` — granica nedelje (oba plana v2 se završavaju danom trke, pa su granice iste; kad je trka u nedelju, granica je ponedeljak; pregrupisanje iz 3b nije potrebno); nedelja izvora bez iste granice → odbijanje sa razlogom; (2) `generateHmV2` iz činjenica ulaza (`targetInput`: dani, dan dugog, obim čarobnjaka (O3a), rezultat, lak tempo, skorašnji najduži, početnik; cilj `null`); (3) `adaptHmV2(plan, targetFacts(facts), asOf)` — `raw` bez `dayId` i zaključanih dana izvora, potvrđena pauza → činjenica pauze; povratnu politiku određuje adaptacija cilja; (4) plan za upis sa prefiksom izvora; (5) pokrivenost: `longRunShort` → 'insufficient', inače 'full'. Odbijanje generatora/adaptacije → `{ error }` sa porukom v2 doslovno (O4a). |
| `halfMarathon/v2/app/plan.ts` | `PREFIX_KEY` (`hmV2Prefix`), `Prefix`, `prefixOf`; `storedPlan(gen, prefix)`: nedelje izvora ispred, nedelje v2 broj `offset + index`, id `g{offset+index}d{dow}` (= id izvora istog datuma); `meta.start`/`weeks` od prvog dana prefiksa; `stampPlan` faza za nedelje v2 po `w − offset`, nedelje izvora zadržavaju svoju. Bez prefiksa: bajt-isto. `KNOWN_VERSIONS` ∪ hm-v2.4.1. |
| `halfMarathon/v2/app/adapt.ts` | Pregled adaptacije, vraćanje verzije i promena cilja nose prefiks (`prefixOf`); brojevi nedelja u pregledu `offset + index`. |
| `halfMarathon/v2/app/facts.ts` | `confirmedBreakFact` — prevod potvrđene pauze u činjenicu ostaje na jednom mestu (pouke 16–20, test `adaptFlow`). |
| `halfMarathon/v2/app/index.ts`, `select.ts` | `hmV2.handoffFuture`; `shorterHandoffForV2Source`: ciljna distanca HM + uključen prekidač HM v2 → HM v2 cilj; 10K/5K v2 i dalje `V2_TARGET_NOT_READY` (3d). |
| `halfMarathon/v2/policy.ts` | `version: 'hm-v2.5.0'` (format plana: prefiks). Pravila nepromenjena. |

## 2. Testovi (`halfMarathon/v2/app/handoffTarget.node.test.ts`, 8)

- **Tok** (grid maratona v2, asOf ⌊N/2⌋ i N − 11, 5 scenarija): plan HM v2; nema duplog datuma ni id-a; id svakog dana
  = id izvora istog datuma (dnevnik ostaje na svojim danima); prefiks = nedelje izvora pre starta doslovno (tekuća
  uključena); start > asOf; uslov 8 / zajedničke provere 4a na delu v2 (budući dani nisu prazni, lagan ≤ dugi).
- **M3 kroz pravi kod:** odbijanje adaptacije = 0 (generator cilja prihvata ulaz, a predaja ne uspe); kasna predaja →
  PLAN_TOO_SHORT doslovno.
- **Po osećaju:** bez laganog tempa u ulazu → EASY_PACE_REQUIRED doslovno; sa njim plan postoji.
- **T1:** politika izvora (maraton v2 `volume.growth`, `peakAddKm`) menja izvor (kontrola), deo cilja bajt-isti;
  `startingKm` izvršenja (odluka izvora) ne menja cilj, potvrđena pauza (činjenica) ga menja. **T2:** politika cilja
  (HM v2 `adapt.pause.midShare/shortShare`) menja cilj.
- **Izbor/format:** prekidač HM v2 isključen → v1 cilj, uključen → HM v2; 10K v2 → NOT_READY; plan bez predaje nema
  prefiks; verzija hm-v2.5.0; hm-v2.4.1 je „current".
- `handoffV2Source` (3b): HM v2 cilj više nije NOT_READY (slučaj uklonjen). `policy`, `adaptFlow`, `app`: verzija i
  `KNOWN_VERSIONS`.

**Sabotaže** (`sabotage-3f.json`, brz nivo, `--bail=1`): **3/3 palo** — 3f-a cilj čita `startingKm` izvršenja kao
obim (T1 startingKm); 3f-b start = dan posle potvrde umesto granice nedelje (tok); 3f-c `dayId` izvora prelazi u
činjenice cilja (M3: adaptacija odbija). Stanje `src` posle vraćanja isto.

## 3. Merenje M3 kroz pravi kod (`v2targetReal.measure.ts` → `v2targetReal.json`)

Uzorak kao 3a M3 (253 izvora maratona v2, 5 060 predaja): uspeh **1 745**; odbijanje adaptacije **0**; dupli datum 0,
dupli id 0, id ≠ id izvora 0; zajedničke provere 4a **0**. Po preostalim nedeljama: < 8 0/1480, 8–9 0/390, 10–11
310/580, ≥ 12 1435/2610. Odbijanja generatora (doslovno): PLAN_TOO_SHORT 1 870, **PLAN_TOO_LONG 660**, opseg
obima/dana 725, EASY_PACE_REQUIRED 130, BEGINNER_SHORT 130.

Razlika prema 3a M3 (2 265 uspeha): 3a je ograničavao broj nedelja na najviše 20 (kasniji start); sa O6(b) start je
prva granica posle potvrde, pa rana predaja (> 20 nedelja do trke) daje PLAN_TOO_LONG — opcija nedostupna sa razlogom
(O4a). Otvoreno pitanje O8 (§ 6).

## 4. Provere (iz `web/`)

| Komanda | Rezultat |
|---|---|
| `npx tsc -b --noEmit`; eslint/prettier menjanih fajlova | exit 0 |
| `TEST_FULL=1 npx vitest run --project node src/domain/generators/halfMarathon/v2` | **53 fajla, 371/371**, 569 s |
| `TEST_FULL=1 npx vitest run --changed a6185aa` | **203 fajla, 1581/1581**, 845 s |
| `npm run check` | **EXIT 0; 292 fajla, 3491/3491** |
| `npx playwright test e2e/hm-v2.spec.ts e2e/marathon-v2.spec.ts` | **6/6** (47 s) |

**Snimak maratona** (`marathon/v2/app/byteSame.9443676.json`, obrazac 07b): promenjeno tačno 13 redova „HM v2 #0/#1 ·
{adaptacija, cilj, generator, generisanje, plan, policy, prilagođavanje}" — oznaka verzije hm-v2.5.0 u planu; ostali
ključevi bajt-isti. HM v2 plan bez predaje nema `hmV2Prefix` i ima iste nedelje/dane kao pre (menja se samo
`policyVersion`).

## 5. Uslovi AGENTS.md

1 jedan vlasnik: povratnu politiku određuje samo adaptacija cilja; prevod pauze u činjenicu samo `facts.ts`. 3 WU/CD
nepromenjeni. 5 cilj prima samo činjenice (T1, 3f-a). 6 plan nosi hm-v2.5.0 i fazu iz odluke v2 (prefiks: faze
izvora). 7 HM v2 ne uvozi ništa van foldera (`isolation`); izvor/cilj se spajaju u `select.ts`. 8 uslov 8 na delu cilja,
zajedničke provere 0.

## 6. Otvoreno

- **O8 (za organizatora):** predaja > 20 nedelja pre trke → PLAN_TOO_LONG (660/5 060 u M3). (a) ostaje odbijanje sa
  razlogom **[preporuka: bez nove odluke]**; (b) start cilja = max(granica posle potvrde, trka − 20 ned.), a nedelje
  izvora do tada ostaju (budući dani izvora u prefiksu — nova odluka).
- Za 3e: plan cilja HM v2 nema `meta.preparation` (vrh dugog/obima opcije čita izvor iz `hmV2` ako treba).
- Za 3g: prikaz nedelja prefiksa (faze izvora) i broj nedelje u pregledu (`offset + index`).

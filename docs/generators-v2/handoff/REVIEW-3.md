# Faza 3 — pregled koda predaje „kraća distanca" (REVIEW-3)

Grana `claude/generator-isolation-5k-10k-hm-marathon`. Pregledano na `46e72eb`, posle `pull` i 3d-10K na `0fa8be7`
(`a0f99f0`). Samo čitanje + ciljani eksperimenti; `web/**` nije menjan. Skripte: `review3{a,b,c,d,e}.measure.ts` u ovom
folderu (iz `web/`: `npx vitest run --config ../docs/generators-v2/handoff/vitest.measure.config.mjs review3X`; B prima
`RACE_SHIFT`, `R/F/B`; E prima `DIST=HM|MAR`). GREŠKA = potvrđena eksperimentom; SUMNJA = nije potvrđena.

## 0. Zaključak

2 GREŠKE (1 niska, 1 srednja, prikaz), 3 SUMNJE. Kritičnih nalaza u predaji nema: dupli datum/id, dnevnik na pogrešnom
danu, rupa nedelja, O6b dani, granice nedelje (trka čet/sub/ned), vraćanje preko distance i 3d-10K su čisti (§ 2).

## 1. Nalazi

| # | Nalaz | Fajl:linija | Scenario | Dokaz | Ozbiljnost |
|---|---|---|---|---|---|
| G1 | **GREŠKA** — `hmV2Prefix` (ključ najvišeg nivoa plana HM v2 cilja) curi u v1 cilj; krši invarijantu 3b „format v2 u planu cilja = 0" | `handoff.ts:77-85` (`sourceViewForV1` skida samo `planKey` + `metaKeys`); `halfMarathon/v2/app/preparation.ts:31-34` (`HM_V2_SOURCE_FORMAT` bez ključa prefiksa; ključ: `plan.ts:221, 256`) | maraton v2 + pauza → HM v2 (prekidač) = plan T sa prefiksom; T kao izvor → `v1TargetForV2Source(10000, HM_V2_SOURCE_FORMAT)` (isti lepak koji koristi `preparationForPlan(T)`) | A: 117 planova T, 10K v1 uspeh 72 → `hmV2Prefix` u planu 10K v1 (`10k-v1`) **72/72**, primer 9 nedelja maratona. Dostupnost: druga adaptacija T (pauza 7–42 d) dala je ponudu 1/585, a ta je bez rezultata (v1 nedostupan) — pun put kroz UI nije reprodukovan | niska (mrtav podatak u planu v1; lanac redak) |
| G2 | **GREŠKA** — na planu cilja sa prefiksom izvora tekstovi sa brojem nedelje nose v2 indeks, a kalendar i lista nedelja pregleda `offset + index` | `tenK/v2/app/form.ts:75` (label „tempo od nedelje ${fromWeek}"), `:116` (`next.week`, prikaz `features/race/FormTenKV2.tsx:51`); poruke jezgra prenete doslovno u `reasons`/`needed` pregleda: `tenK/v2/assess.ts:315` („od nedelje ${n}"), isti oblik `:51, :53, :442, :469, :484`. Isti kod (bez eksperimenta): `halfMarathon/v2/app/form.ts:76, :115` (+ `FormHmV2.tsx:49`), `fiveK/v2/app/form.ts:69` | HM v2 + pauza 35 d (asOf kraj ned. 3) → 10K v2 (3d-10K), offset 3 → test 5 km na danu testa → prilagođavanje → primena | D: 94 cilja 10K v2 sa prefiksom, 30 sa testom: **30/30** neslaganje. Primer: pregled nedelje [6…12], kalendar nedelja posle testa 6, a Forma „Test 5K 23:00 — tempo od nedelje 3", `next.week` 3; razlog u istom pregledu „VDOT 42,3 od nedelje 3" | srednja (korisnik dobija pogrešnu nedelju u tekstu; plan je ispravan) |
| S1 | SUMNJA (namera?) — UI nikad ne ide kroz `executionBasis`; put „rezultat koraka adaptacije → v1 cilj" (3e § 7.5) nije dostupan iz aplikacije | `stores/executionActions.ts:383` (`basisFromPlan`), `features/plan/ShorterDistanceDecision.tsx:122` (`previewPreparationChoice(null, today, null, …)` → `:418-421` grana `basisFromPlan`) | plan po osećaju sa testom posle starta | čitanje koda; ponašanje kroz `basisFromPlan` je ono što 3e meri (V1_TARGET_NEEDS_RESULT 31/170) | odluka organizatora |
| S2 | SUMNJA — odluka u UI se ne preračunava kad se promeni dnevnik/izmene: `useMemo` zavisi samo od `genPlan`, dana i prekidača, a opcije grade cilj iz `rawFacts` (dnevnik) | `features/plan/ShorterDistanceDecision.tsx:51-58` | odluka prikazana → upis treninga → prikazani vrh opcije zastareo; „Pregledaj opciju" računa svež plan (upis štiti `planStateStamp`) | nije mereno | niska |
| S3 | SUMNJA — `mondayWeeks` daje vodećoj delimičnoj nedelji broj `prva − 1` (0) kad plan izvora počinje u nedelju (trka u subotu) | `handoff.ts:63-71` | HM v2 sa trkom u subotu → 10K/5K v1 | B: `w` uzastopan 0 prekršaja (0→1 je uzastopan); prikaz „Nedelja 0" nije proveren | niska |

## 2. Provereno bez nalaza (eksperimentom)

| Šta | Skripta | Uzorak | Rezultat |
|---|---|---|---|
| HM v2 → 5K v2 / 10K v1 / 5K v1 kroz `preparationForPlan`: dupli datum/id, rupa nedelja, `w` niz, prošli dani = izvor (id + sadržaj), id izvora na drugom datumu (dnevnik), dani asOf+1…start−1 = izvor (O6b), trka u poslednjoj nedelji | B | HM mreža 60/30/10, asOf svaki dan ned. 3 i ⌊N/2⌋ + 1–13 d pre trke; 1 163 ponude (trka sub 343 / ned 820), 1 653 uspešna izbora | **0** u svim merama |
| isto, trka u četvrtak (`RACE_SHIFT=-3`) i subotu (`-1`) | B | 30/15/5 × 2; 2 334 i 2 142 ponude; 3 518 i 3 248 uspešnih izbora | **0** |
| 3d-10K: HM v2 → 10K v2 i maraton v2 → 10K v2 (iste mere + vrh opcije + vraćanje) | E | HM: 1 163 ponude, 736 uspešnih izbora; MAR: 1 000 ponuda, 556 uspešnih | **0**; vrh > 0 736/736 i 61/61; vraćanje izvora → RESTORE_OTHER_DISTANCE 736/736 i 556/556 |
| Vraćanje revizije HM v2 preko 10K v1 / 5K v1 / 5K v2 (isti poziv kao `previewRestore`: generator po snimku) | C | 17 izbora | odbijeno 17/17; `raceDistM` cilja uvek postoji |
| O5a/O4a/O8a razlozi doslovno | B, E | — | `V1_TARGET_NEEDS_RESULT`, „Plan mora trajati 6–16 nedelja; sada N.", „Plan od N nedelja je prekratak/predug …", VDOT van opsega 5K v2 — tekst cilja bez parafraze |
| Postojeći testovi predaje (brz nivo) | — | 6 fajlova (`handoffV2Source`, HM/MAR `handoffSource`, HM/5K `handoffTarget`, `handoffV2.test.tsx`) | 70/70 |

Pregledano čitanjem bez nalaza: uslov 5 (izvori šalju `policy: null`, bez `startKm/levelKm/returnFrom`; ciljevi
grade ulaz iz činjenica, pauza samo kroz `confirmedBreakFact`); uslov 7 (nijedan uvoz `../../../` iz v2 foldera;
5K/10K/HM cilj dolazi kao argument iz `select.ts`); O7a (`HALF_MARATHON_PREPARATION`/`MARATHON_PREPARATION` i
`regeneratorForDistance` nepromenjeni, v1 `isLimitedLongPreparation` ignoriše drugi argument); O1 (ponuda samo uz
adaptaciju, ispod praga, plan generatora nije, trka > danas — isto u pregledu i u `storedPreparationDecision`; 5K/10K
cilj nema odluku); „Zatvori" ne menja store (samo lokalno stanje komponente, po verziji plana); odbijen pregled opcije
ne menja plan; prekidači u odluci i u pregledu opcije iz istog izvora (`generatorFlags`).

## 3. Šta treba (predlog, odluka organizatora)

- G1: ključ prefiksa u formatu izvora HM v2 (npr. `SourceFormat.planKeys` ili `PREFIX_KEY` u spisku adaptera) + test
  lanca maraton v2 → HM v2 → v1.
- G2: prikazni broj = `offset + fromWeek` u `form.ts` (10K/5K/HM v2); za poruke jezgra: offset prikaza kao poznat
  uslov konstruktora, ili poruka bez broja nedelje (datum). Test „plan sa prefiksom" za Formu i razloge pregleda.
- S1: potvrditi da je `basisFromPlan` jedini put u UI namerno (onda ažurirati 3e § 7.5), ili uvesti potvrđeno
  izvršenje u odluku.

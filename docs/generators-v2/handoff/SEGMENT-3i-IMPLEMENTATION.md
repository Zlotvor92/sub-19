# Segment 3i — broj nedelje u porukama jezgra na planu cilja predaje (`weekOffset`), 10K v2 i HM v2

Grana `claude/generator-isolation-5k-10k-hm-marathon`, polazni SHA `ce62b01`. Verzije: **10k-v2.8.1** (A22), **hm-v2.6.2**
(`3i-WEEK-LABEL`); prethodne (10k-v2.8.0, hm-v2.6.1) u KNOWN_VERSIONS. fiveK/v2 nije diran.

## 1. Izmena (po distanci, sopstvena kopija — uslov 7)
- Ulaz jezgra `weekOffset?` (ceo broj ≥ 0; drugo → INPUT_SHAPE). Normalizovan ulaz ga nosi samo kad je > 0 → bez
  offseta isti `plan.input` i isti plan. Adaptacija ga čita iz `plan.input` (konstruktor iz ulaza plana, uslov 4).
- JEDNA funkcija `weekLabel(input, n) = weekOffset + n` (`tenK/v2/weekLabel.ts`, `halfMarathon/v2/weekLabel.ts`); sve
  poruke sa brojem nedelje kalendara idu kroz nju. Indeksi, polja `week`, koraci i poređenja ostaju v2.
- `app/handoffTarget.ts`: `targetInput(..., prefix.offset)` — offset prefiksa = `input.weekOffset` (jedan broj, jedno
  mesto). `app/form.ts` (Forma, 3h) čita ISTI offset (`weekLabel(v2.input, fromWeek)`), više ne `prefixOf` — bez duplog
  sabiranja. Prikazni brojevi pregleda/kalendara (`changedWeeks`, `storedPlan`) ostaju na `prefix.offset` (3d/3g).

| Distanca | Mesta poruka (fajl: šta) |
|---|---|
| 10K | assess: painReturnNote (×2), NEW_RESULT „od nedelje n", FATIGUE (f, „planirana nedelja 1", „nedelja 2"), UNDER, OVER; adapt: A17 (×2), TEST_MOVED (tb, ta); generate: WEEK_INFEASIBLE, napomena testa; week: umor pre starta „nedelja 1"; validate: D25 „ned", IDENTICAL_WEEKS, TEST (tw, spisak) |
| HM | assess: isto kao 10K; adapt: A17, TEST_MOVED; generate: „Dugi nedelje 1" (×2), RECENT_LONG_TOO_SHORT, WEEK_INFEASIBLE, napomena testa, uvod početnika „nedelje 1–N"; validate: INTRO (×2), TEST, pouka 28 „ned 1–4", D25, IDENTICAL_WEEKS (×2), HI14 „ned", WEEK_FITTED, HI8 „Nedelja 1" |

Svesno NE kroz funkciju (nisu broj nedelje kalendara; zapisano u odluci): redni broj uvoda „nedelja k od N" (D28/H17),
„u nedeljama 1–2" (položaj u segmentu, D5/H5), STRUCTURE „Redni broj nedelje i ≠ j", `throw` greške programa.

## 2. Dokazi
- **Bez offseta bajt-isto**: heš (sha256, `policyVersion` izuzet) generatora + adaptacije (3 asOf × 17 scenarija)
  na mreži lib `final-check` (svaki 13. R, 7. F, 5. B): 10K 3597 generisanja + 183 447 adaptacija, HM 2583 + 131 733 — heš **isti** na ce62b01 i posle (10K `c3860c85…`, HM `50f7014e…`).
- **byteSame**: tenK/HM `byteSame` bez promene (normalizuju verziju). `marathon/v2/app/byteSame.9443676.json`: ponovo
  upisano 13 + 13 redova „10K v2"/„HM v2" (heš sadrži oznaku verzije); sa vraćenim 10k-v2.8.0/hm-v2.6.1 isti kod daje
  stari snimak (6/6) → promena je samo oznaka.
- **review3d.measure.ts** (privremena kopija, + brojanje „od nedelje N" u razlozima i traci prema kalendaru, obrisana):
  94 cilja, 30 sa testom, 30 prilagođeno — poruke **60/60 neslaganja → 0**, Forma `labelMismatch` 0 → 0.
- **Testovi (padaju na ce62b01: 8/8)**: `weekLabel.node.test.ts` u `tenK/v2` i `halfMarathon/v2` — isti ulaz i činjenice
  sa `weekOffset` 100 i bez njega: svaki string rezultata (napomene, upozorenja, razlozi, traka, odbijanja) posle n − 100
  jednak planu bez offseta, svaki broj nedelje u tekstu ≥ 101, ostalo identično (indeksi v2); ulaz 0/neispravan.
  `app/weekLabel.node.test.ts` (pravi tok HM → 10K i MAR → HM, trka u 2. nedelji v2): razlog i traka „od nedelje 9"
  = kalendar (pre: 3), pregled > offset, sve poruke sa brojem nedelje > offset, Forma isti broj, `weekOffset = offset`.
  3h test „bez prefiksa" sada skida i `weekOffset` (plan bez predaje).
- **Sabotaže** (`sabotage.mjs`, brz nivo, `--bail=1`, ulaz van repoa): 10K i HM — razlog NEW_RESULT mimo funkcije, FATIGUE
  (10K) / „Dugi nedelje 1" (HM) mimo funkcije, cilj predaje bez `weekOffset`, Forma mimo funkcije: **8/8 palo**, 37 s;
  stanje `src` isto.

## 3. Provere (iz `web/`)
| Komanda | Rezultat |
|---|---|
| `tsc -b --noEmit`, eslint, prettier (menjani fajlovi) | exit 0 |
| `npm run check` | 3633/3637; 4 pala (HM KNOWN_VERSIONS ×2, byteSame maratona ×2) ispravljena, ta 3 fajla 46/46 |
| `TEST_FULL=1 npx vitest run --changed ce62b01` | **311/311 fajlova, 2310/2310** (50 min) |
| pun nivo foldera tenK/v2, halfMarathon/v2 (159 fajlova) | 157 u `--changed` (zeleno) + `isolation` ×2: 8/8 |
| `npx playwright test` handoff-v2, tenk-v2, hm-v2 | 11/11, 1,3 min |

Van foldera distance (posledica obavezne nove verzije, po 1 red): `e2e/tenk-v2.spec.ts`,
`features/onboarding/tenKV2Flow.test.tsx` (oznaka 10k-v2.8.1), `marathon/v2/app/byteSame.9443676.json` (redovi 10K/HM v2).

## 4. 5K v2 (za 5K tab, isti obrazac; ništa nije menjano)
Poruke sa brojem nedelje kalendara u `fiveK/v2`: `adapt.ts:160` (A17 ×2); `assess.ts:50–51` (povratak posle bola,
`rf.week` ×2), `:320` (NEW_RESULT „od nedelje n"), `:430` (umor `dw` ×2), `:459` (manjak `n`), `:474` (višak `n`);
`generate.ts:380` (početnik „od nedelje introWeeks + 1"); `feel.ts:351` („Početnik: nedelja f.index"); `week.ts:75`,
`:109`, `:441` („Nedelja f.index: …"); `validate.ts:903` (QUALITY_REPEAT `a.index`); `runWalkAssess.ts:186` (`n`);
`runWalkValidate.ts:87`, `:102`, `:150` (`w.index`). Kandidati za izuzetak: `validate.ts:183`, `runWalkValidate.ts:84`
(STRUCTURE), `validate.ts:307` („Nedelje 1–2 početnika" — opis pravila, u 10K/HM bi išlo kroz funkciju). Forma 5K:
`fiveK/v2/app/form.ts` sada čita `prefixOf`; isto prebaciti na `weekLabel(v2.input, …)`.

## 5. Otvoreno
- `Reason.week` / `Violation.week` (polja) ostaju v2 indeks; u `features/` nisam našao prikaz ovih polja za v2 (grep), ali nije dokazano testom.
- Maraton v2 nije cilj predaje „kraća distanca" (nema prefiks) — van opsega.

# Segment 02 — trenerske ispravke 4-dnevnog jezgra (5k-v2.1.0)

Grana `claude/generator-isolation-5k-10k-hm-marathon`, polazni commit `e2e9f9f`. Opseg ulaza nepromenjen
(4 dana, 15–45 km, VDOT 30–60, 8–16 ned). Nije aktivirano (select.ts/UI/store ne uvoze v2).

## Odluke (`policy.ts` → `DECISIONS`, `5k-v2.1.0`)

Zadate: (1) dugi ≥ svaki lagan trk = greška; dugi ≤ 35% cilja i ≤ 90 min; ako je ostatak po laganom danu
> dugi → lagan = dugi, plannedKm = kvalitet + (1 + n) × dugi < targetKm, napomena + upozorenje
`PLANNED_BELOW_TARGET`; vrh se ne podiže; odluka samo u `generate.ts`, jedan prolaz. (2) Strogi rast glavnog
I (vrhunac) i RP (oštrenje) po ne-rasteretnim nedeljama, u [70%, 100%] budžeta; dve uzastopne ne-rasteretne
nedelje izgradnje bez istog para (`QUALITY_REPEAT`). (3) Dan pred trku lagan ≤ 4 km ukupno + 4 × 20 s;
oštrenje ≥ 3 dana pre trke. (4) Oporavak zadat vremenom zaokružen na 15 s (naslov = segment).

Moje, posle pregleda primera i mreže 240 ulaza (sve zapisane u DECISIONS, tačke 7–12):
- dugi = min(35%, 90 min, cilj − kvalitet − n × min. lagan) — inače 15 km/8 ned nema 3 km za lagan;
- udeli I/T/R mere se od **ciljnog** km (osnov budžeta), ne od planiranog — inače „lagan = dugi" lažno probija udeo;
- ponuda I + 700/400 m (I ≥ 2 min), RP + 500 m — inače ravan budžet nema nivoa za strogi rast;
- vrhunac ≤ 4 nedelje, višak u bazu — sa 5 nedelja vrhunca 15 km/16 ned je odbijan za svaki VDOT;
- baza R: nova struktura, doza ne pada, prednost dužem ponavljanju (strogi rast je davao 9 × 150 m);
- trkačka nedelja: ostatak jednako, dan pred trku ≤ 4 km, bez odbacivanja ostalih dana zbog toga.

## Fajlovi

- `web/src/domain/generators/fiveK/v2/`: `policy.ts` (id, 2.1.0, pragovi, DECISIONS), `types.ts` (`policyId`,
  `easyCappedAtLong`), `periodize.ts` (vrhunac ≤ 4), `workouts.ts` (`chooseProgressiveReps`,
  `roundRecoverySec`), `generate.ts` (dugi/lagan, progresija, trkačka nedelja), `validate.ts` (nova pravila:
  `EASY_LONGER_THAN_LONG` greška, `EASY_CAP`, `PLANNED_BELOW_TARGET`, `DOSE_PROGRESSION`, `SHARPEN_MAIN_FLOOR`,
  `QUALITY_REPEAT`, `RACE_EVE`, `RECOVERY_ROUNDING`, `WEEK_MIN_VOLUME`, `EMPTY_WORKOUT`).
- Testovi: novi `segment02.node.test.ts` (73 testa: odluke 1–4, Uslov 6, Uslov 8). Izmenjen jedan postojeći:
  `validate.node.test.ts` „lagan trk duži od dugog je upozorenje" → sada očekuje **grešku** (odluka 1).
- `docs/5k-v2/artifacts/segment-02/` (run.ts kopiran + kolona „lagan max" i ukupno km; isti inputs.json),
  ovaj izveštaj, `docs/5k-v2/STATUS.md`, `AGENTS.md` (samo nova sekcija na kraju). `segment-01/` netaknut.

## Komande i rezultati (iz `web/`)

| komanda | rezultat |
|---|---|
| `npx tsc -p tsconfig.domain.json --noEmit` | exit 0 |
| `npx eslint src/domain/generators/fiveK/v2/` | exit 0 |
| `npx prettier --check` (v2) | 1. put 4 fajla neformatirana → `prettier --write`, zatim čisto |
| `npx vitest run --project node src/domain/generators/fiveK/v2/` | 5 fajlova, 190/190 |
| `npx vitest run --project node src/domain/generators/` | 18 fajlova, 298/298 (583 s) |
| `npm run check` | exit 0 (178 fajlova / 1927 testova) |
| `node docs/5k-v2/artifacts/segment-02/run.ts` (iz korena) | 10/10 podržanih → plan, 3/3 odbijena |

Mreža iz testa (5 obima × 4 trajanja × 4 rezultata × 3 rasporeda = 240): Segment 01 234 plana, sada 228.
Odbijeno 12, sve `QUALITY_INFEASIBLE`, sve 15 km + 5K 18:20 (VDOT ~53): 6 kao i ranije (I u rasteretnoj
nedelji), 6 novih (13/16 ned: budžet 1,56 km ima samo 2 nivoa I, a trebaju 3).

## Stalni uslovi izolacije

| uslov | stanje | dokaz |
|---|---|---|
| 1 jedan vlasnik odluke | ispunjeno | obim: `volume.ts`; dugi/lagan: `buildTrainingWeek` (jedna formula); doza: `chooseReps`/`chooseProgressiveReps` (nabrajanje fiksne ponude, bez petlje); WU/CD: `warmupBand`; validator ne menja plan (test „validacija ne menja plan") |
| 2 jedan plafon po zoni | **nije potpuno** | udeli I(+RP)/T/R po jedan, od cilja. Dvostruko ostaje: vrh obima = min(1,3 × start, 50 km); T blok: `shortTMaxSec` 900 s (izbor) i `tContinuousMaxSec` 1200 s (plafon). Nisu menjani u ovom segmentu |
| 3 WU/CD nisu pufer | ispunjeno | WU/CD zavisi samo od pojasa cilja; manjak ide u lagane dane ili `easyCappedAtLong` + `PLANNED_BELOW_TARGET` |
| 4 adaptacija | van opsega | — |
| 5 handoff | van opsega | — |
| 6 policyId/version, faza | ispunjeno | `plan.policyId`, `plan.policyVersion`, `week.phase` iz `periodize`; testovi u `segment02` i `generate` |
| 7 nula uvoza van foldera | ispunjeno | `isolation.node.test.ts` nepromenjen, prolazi; nema novih izuzetaka |
| 8 upotrebljivost | ispunjeno | `WEEK_MIN_VOLUME` (10 km / trkačka 4 km), `EMPTY_WORKOUT`, `EASY_LONGER_THAN_LONG` kao greške; testovi obaraju sva tri |

## dev-04 (VDOT 50, 35 km, 14 ned) — pre (2.0.1) / posle (2.1.0)

| ned | km cilj/plan | kvalitet (q1; q2) pre → posle | dugi | lagan max |
|---|---|---|---|---|
| 1 | 35/35 | R 4×400; T 2 → isto | 10,5 → 12 | 11,7 → 10,2 |
| 3 | 40,8/40,8 | R 5×400; T 2,5 → isto | 12 → 14 | 14,7 → 12,7 |
| 5 | 44/44 | R 5×400 → 7×300; T 3 | 13 → 15 | 16,4 → 14,1 |
| 6 | 45,5/45,5 | I 3×1200 → 4×700; T 2×2000 | 13,5 → 15,5 | 12,56 → 11,55 |
| 7 | 45,5/45,5 | I 3×1200 → 3×1000 | 13,5 → 15,5 | 12,56 → 11,4 |
| 9 | 45,5/45,5 | I 3×1200 → 4×800 | 13,5 → 15,5 | 12,56 → 10,88 |
| 10–11 | 45,5/45,5 | RP 3×1000, 3×1000 → 3×1000, 4×800 | 13,5 → 15,5 | 14,38 → 12,38 |
| 14 | 22,8/22,8 | oštrenje 4×400 RP (sre) | — | 6,28 (sub, dan pred trku) → 7,21; sub = 4 km + ubrzanja |

Pre: lagan > dugi u 7/13 nedelja, isti I tri nedelje. Posle: lagan ≤ dugi svuda, I 2,8 → 3,0 → 3,2 km.

## Preostali problemi

1. „Lagan = dugi" kod sporih i velikog obima: u mreži 93/228 planova ima bar jednu takvu nedelju; manjak do
   26% cilja (45 km, VDOT ~30), a I tada iznosi do 9,1% **planiranog** km (≤ 8% ciljnog). Posledica odluke 1
   (90 min + 4 dana). Treba trenerska odluka: niži cilj za spore ili dozvoljen duži dugi.
2. 15 km + VDOT ~53 odbijen za 8–16 ned (12 ulaza mreže).
3. 16 ned: baza 7 nedelja, posle 3. nedelje obim na vrhu i R se smenjuje (6×400 / 8×300) bez rasta; vrhunac
   počinje rasteretnom nedeljom (8), čiji je I (2×1200) duži po ponavljanju od prve ne-rasteretne (4×700).
4. Trkačka nedelja: kod q1 uto/q2 čet jedan lagan dan nosi većinu ostatka (dev-03: 10,8 km u utorak).
5. Uslov 2 nije potpuno ispunjen (gore). Ništa nije provereno na stvarnim korisnicima.

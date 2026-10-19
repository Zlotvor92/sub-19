# HM v2 — Segment 02: 3/5/6 dana, dugi ≤ 24 km, pouka 28 kotrljajuće (hm-v2.1.0)

Grana `claude/generator-isolation-5k-10k-hm-marathon`; polazni SHA `30fcb4b`, zaustavljanje `01dd4a1`
(`SEGMENT-02-STOP.md`, istorija), odluke organizatora: P1 (`RECENT_LONG_TOO_SHORT`) i pouka 28 kao kotrljajuće pravilo
(MASTER `0614e57`, posle MAR-02). Menjano samo `halfMarathon/v2/**` i `docs/hm-v2/**`; HM v1, `halfMarathon/index.ts`,
lični plan, aplikacija i druge distance netaknuti.

## Odluke | mesto | test (`policy.ts` DECISIONS; brojevi zakucani u `policy.node`)

| odluka                                                                                                                     | mesto                                  | test                                     |
| -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- | ---------------------------------------- |
| H1/H15 redovi 3/5/6 dana (obim, max, udeo 45/32/30 %, min 12/20/24); odbijanje obima sa brojem dana koji ga podržava       | policy.ts `days`, input.ts             | policy.node, input.node, mreža 02        |
| H9/H10 3 dana: jedan kvalitet T kont. → T cruise → RP, bez I/R; 5/6 dana lagani jednaki                                    | schedule.ts, quality.ts, lengths.ts    | schedule.node, quality.node, week.node   |
| HI6 3 dana: rasterećenje T ≈ 60 % jedinog slota (Q1), taper samo RP, RP ≥ poslednje T, prelaz bez iste strukture (10K D18) | quality.ts, week.ts, validate.ts       | quality.node, validate.node, invarijante |
| H13 dugi ≤ 24 km (LONG_KM) — nalaz merenja u DECISIONS                                                                     | lengths.ts `longKmCap10`               | week.node, validate.node, invarijante    |
| HI7 pouka 28: dugi svake nedelje ≤ max(1,1·L, L + 1), L = najduži prethodne 4 ned (ned 1–4 i r); LONG_ROLLING              | lengths.ts `rollingLongCap10`          | week.node, validate.node, recent.node    |
| HI7 P1: neizvodljiva nedelja uz dati r → RECENT_LONG_TOO_SHORT (prag korak 0,5 km, preporuka); napomena ned 1 bez ulaza    | generate.ts `recentTooShort`           | week.node, recent.node                   |
| HI8 izuzetak pouke 9: ned 1 < obim samo uz dugi na min(150 min, 24 km, granica r); CAPACITY_LIMITED imenuje ograničenje    | lengths.ts `week1LongCap10`, volume.ts | validate.node, volume.node, K2           |
| HI9 a–d (odluke posle HM-01): preporuka 5–6 dana; R 16 × 200; RP brži od T pri VDOT 80; brz 30 km                          | volume.ts, paces.node                  | volume.node, paces.node                  |

Citat HI7 proveren pretragom (sažeci, ne ceo rad): Frandsen i sar., Br J Sports Med 2025;59:1203–1210, posmatračka
kohorta 5205 trkača; asocijacija rizika sa trkom > 10 % najdužeg u 30 dana.

## Odstupanja i nalazi (svako sa ulazom)

- Očekivanje „bez recentLongRunKm bajt-isto osim teksta" NIJE potvrđeno (`measure-rolling.ts` A, pravilo isključeno vs
  uključeno, mreža 02): promenjeno 0 / 198 / 66 / 330 planova (3/4/5/6 d), vrh niži 0, najveći pomak dugog 1,3 / 1,2 /
  4,0 km. Uzrok: brz trkač malog obima — lagan na minimumu 4 km, rast obima ide sav u dugi (> 10 %/ned). Npr.
  `d4-10w-30km-v60-A-sun` ned 2 dugi 12,4 → 12,1 (11,0 × 1,1), 0,3 km u lagan. To je pravilo kako je zadato („SVAKE
  nedelje"); regresija 4 dana ga prihvata kao drugi uzrok samo uz nezavisnu proveru da pravilo zaista seče dugi.
- Granica 24 km (`measure-24.ts`): dugi > 24 km 660 / 1320 / 1320 / 1980 → 0; vrh niži 0; K2 i CAPACITY_LIMITED po
  obimu nepromenjeni (4 d 774 → 774). „Kapacitet pada" se ne potvrđuje; višak ide u lagane dane (u DECISIONS H13).
- 3 dana (HI6): prelaz T kont. → T cruise bi ponovio istu strukturu (`d3-20w-35km-v30-A-sun` ned 7–8, 4 × 1000 m) →
  IDENTICAL_WEEKS; rešeno pravilom iste lestvice samo za jedan slot (4–6 dana bez promene).
- LONG_RUN_SHORT kod 6 dana raste uz kotrljajuće pravilo: mreža 6 → 60 planova, gusto 300 → 1091 (spori rast dugog).

## Sabotaže (`node scripts/sabotage.mjs ../docs/hm-v2/artifacts/segment-02/sabotage.json --parallel 2`): 12/12 PAO

S1–S3 udeo 3/5/6 d (gusta mreža, 18–21 s); S4 3 d razvoj I (week.node, 17 s); S5 24 → 26 km (week.node, 17 s); S6
L + 2 km (week.node, 6,5 s); S7 lagani nejednaki (week.node, 12 s); S8 3 d taper sa T (quality.node, 1,3 s); S9 prelaz
ponavlja strukturu (quality.node, 1,3 s); S10 granica samo ned 1 (week.node, 7 s); S11 r samo u ned 1 (prvo NIJE PAO →
dodat test „u nedeljama 2–4 r ulazi u L" → PAO, 5,6 s); S12 bez P1 (week.node, 6 s). Ukupno 72,8 s; stanje vraćeno.

## Komande i rezultati (iz `web/`)

- `npx tsc -p tsconfig.domain.json --noEmit`, `npx tsc -p tsconfig.oracle.json --noEmit`, `npx eslint
src/domain/generators/halfMarathon/v2`, `npx prettier --check src/domain/generators/halfMarathon/v2 ../docs/hm-v2` → 0.
- Brz nivo v2: 13 fajlova, 107 testova, ≈ 16 s zida. Pun (`TEST_FULL=1`): 23 fajla, 132 testa, 125 s (mreža 02 u 4
  dela, gusta u 8).
- `npm run check` → exit 0 (246 fajlova, 2992 testa).
- `node docs/hm-v2/artifacts/segment-02/run.ts` dva puta → md5 isti; `k-metrics.ts` 170 s; `measure-rolling.ts` ≈ 4 min.
- Fixture `segment01.norm-hashes-3979237.json` napravljen nad kodom 3979237 pre izmena (`norm-hashes-3979237.ts`).

## K1–K6 (`k-metrics.ts`; bez recentLongRunKm)

| mreža 02 (16 896)                                            | 3 d (2640)        | 4 d (3696)  | 5 d (4752)  | 6 d (5808)     |
| ------------------------------------------------------------ | ----------------- | ----------- | ----------- | -------------- |
| K1 odbijanja / greške validatora                             | 0 / 0             | 0 / 0       | 0 / 0       | 0 / 0          |
| K2 ned 1 < obim: ukupno / bez dugog na plafonu               | 66 / 0            | 264 / 0     | 66 / 0      | 0 / 0          |
| K3 izgradnja bez kvaliteta reda                              | 0                 | 0           | 0           | 0              |
| K4 vrh niži od HM-01                                         | —                 | 0           | —           | —              |
| K5 trkačka > taper / pad doze / susedni / dugi<lagan         | 0/0/0/0           | 0/0/0/0     | 0/0/0/0     | 0/0/0/0        |
| K6 ponavljanja / kvalitet > dugi / CAPACITY_LIMITED          | 0 / 0 / 492       | 0 / 0 / 774 | 0 / 0 / 420 | 0 / 132 / 204  |
| K6 vrh/start                                                 | 1,341             | 1,329       | 1,326       | 1,300          |
| ostalo: DOSE_DROPPED / taper ili rast. bez kval. / dugi < 16 | 0 / 528+432 / 528 | 102 / 0 / 6 | 0 / 0 / 528 | 0 / 66 RP / 60 |

Gusta ned 1 (20 301 / 30 401 / 40 501 / 50 601): K1 0, K2 bez plafona 0, K3 0, K5 0, invarijante 0;
CAPACITY_LIMITED 1951 / 3301 / 1228 / 275. Nezavisne invarijante (`gridInvariants.ts`, po danima): 0 prekršaja.

Mreža r (`recent.node`, `measure-rolling.ts` B: r 5–42 × dani × obim × VDOT {30,45,70} × ned {10,14,20} = 10 944):
odbijanja samo RECENT_LONG_TOO_SHORT — 3 d 33 (r 5: 24, r 6: 9; 11 po broju nedelja 10/14/20), 4 d 6 (r 5), 5/6 d 0;
sva u nedelji 1; drugih odbijanja 0. Skok dugog ned 1 → 2 najviše × 1,167 (6 → 7 km, pravilo „+1 km"); bez pravila
(mreža 02) × 1,164 kod 6 d.

## Regresija prema HM-01 (3979237, 4 dana)

2376 − 198 = 2178 planova isti (normalizovan heš: bez teksta poruka), 1320 = dugi > 24 km u HM-01 (sada 24), 198 =
pouka 28 seče dugi (nezavisna provera `rollingBinds`); drugih promena 0; vrh niži 0. Tekst: CAPACITY_LIMITED
„preporuka 5–6 dana", LONG_SHORTER_THAN_QUALITY preporuka manje dana, napomena ned 1 sa pragom.

## Stalni uslovi (AGENTS.md)

| #    | uslov                  | stanje                                                                                                                                                                                                        |
| ---- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | jedan vlasnik          | dužine `lengths.ts` (24 km, kotrljajuće), doza `quality.ts`, obim `volume.ts`, odbijanje `generate.ts`; validator samo prijavljuje; prag P1 je samo za poruku (nova generisanja sa većim r, plan se ne menja) |
| 2    | jedan plafon po zoni   | H11 nepromenjen; dugi: jedan `longCap10` (udeo, 150 min, 24 km, kotrljajuće)                                                                                                                                  |
| 3    | WU/CD nisu pufer       | isti pojasevi za sve dane; višak/manjak ide u lagane ili izvodljiv cilj                                                                                                                                       |
| 4, 5 | adaptacija, predaja    | nisu u segmentu; `rollingLongCap10` uzima istoriju dugih (pripremljeno za upisane dane, pouka 29)                                                                                                             |
| 6    | policyId/Version, faza | `hm-v2` / `hm-v2.1.0`; faze iz `periodize`                                                                                                                                                                    |
| 7    | izolacija              | `isolation.node` zelen, bez novih izuzetaka                                                                                                                                                                   |
| 8    | upotrebljivost         | min nedelje po danima, lagan ≥ 4 km, dugi ≥ lagan, 3 d bez I/R, lagani jednaki — greške i invarijante                                                                                                         |

## Primeri (`artifacts/segment-02/plans.md`)

`d6-18w-90km-v60-B-sun`: vrh 100 km od ned 5; dugi 24,0 (bilo bi 30), lagani 3 × 13–15 km. `d3-16w-45km-v30-C-sun`
(spor): dugi = lagan 17,8 km (150 min), vrh 46,1 / 55. `r-d4-12w-40km-v45-r10`:

| ned       | cilj                | Q1 / Q2                  | dugi               | lagan     |
| --------- | ------------------- | ------------------------ | ------------------ | --------- |
| 1         | 38,2 (pravilo 40,0) | R 6 × 200 / T 2,0 kont.  | 11,0 (= 1,1 × 10)  | 11,0      |
| 2–4       | 40,5 / 42,9 / 45,5  | R → I / T 2,5 → 3 × 1000 | 12,1 / 13,3 / 14,6 | 10,9–12,9 |
| 5 (rast.) | 36,4                | — / T 2 × 1000           | 11,6               | 8,4 + 8,3 |
| 10 (vrh)  | 56,0                | RP 2 × 3000 / T 2 × 2400 | 21,2               | 11,5      |

## Preostali problemi

- 3 d spor trkač 35–45 km: dugi = lagan na 150 min, CAPACITY_LIMITED (preporuka 4–6 dana); 3 d 25 km: taper bez
  kvaliteta (528) i rasterećenje bez kvaliteta (432) — RP 4,0 / T 2,0 km ne staju u plafon (HI2 odstupanje).
- 6 d mali obim + brz trkač: kvalitetni dan duži od dugog (132; gusto 1771), dugi < 16 km 60 planova.
- Pouka 28 bez ulaza menja 594 plana (gore) — trenerska potvrda da je to željeno.
- Udeli, 60 % plafona, 150 min, 24 km i 10 % su heuristike; 10 % ima samo posmatračku podlogu.

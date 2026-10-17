# 10K v2 — Segment 01: jezgro 4 dana sa rezultatom (10k-v2.0.0)

Grana `claude/generator-isolation-5k-10k-hm-marathon`, polazni SHA `b3e4d75`. Izmene samo u
`web/src/domain/generators/tenK/v2/**` i `docs/10k-v2/**`; 10K v1 i ostali generatori nepromenjeni.

## Arhitektura (fajl → odgovornost)

| fajl                                | odgovornost                                                                                                 |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| policy.ts                           | `TEN_K_V2_POLICY` (`10k-v2`, `10k-v2.0.0`): svi brojevi D1–D15 + `DECISIONS` (pravilo, mesto, obrazloženje) |
| types.ts / dates.ts / testInputs.ts | tipovi (oblik kao 5K v2, sopstvena kopija) / ISO kalendar bez `Date` / mreža i profili testova              |
| input.ts / paces.ts                 | D1 opseg i strukturisano odbijanje / D2 VDOT, zone, RP (Daniels–Gilbert), D3 ocena cilja                    |
| periodize.ts / schedule.ts          | D4 faze, D5 GDE su rasterećenja (najmanje rasterećenja, izgradnja što ranije) / D9 šablon dana              |
| volume.ts / lengths.ts              | D6 jedini vlasnik cilja (najbliži izvodljiv cilj preko STVARNE konstrukcije) / D13 jedini vlasnik dužina    |
| workouts.ts / quality.ts            | D10 lestvice i strukture, D14 WU/CD i oporavci / D12 izbor doze (D11 plafon), doze D5 i D7                  |
| week.ts / validate.ts               | sastav nedelje (izgradnja, D5, D7, D8) / samo prijavljuje (greške → `PLAN_VIOLATES_POLICY`)                 |
| generate.ts / index.ts              | `generateTenKV2(input) = construct(input, [])` / javni API (ne izvozi se iz tenK/index.ts)                  |

## D1–D15 (svi brojevi zakucani u `policy.node.test.ts`)

| D   | pravilo (sažeto)                                                  | mesto                               | test                                      |
| --- | ----------------------------------------------------------------- | ----------------------------------- | ----------------------------------------- |
| D1  | 4 dana, 10–18 ned, 25–55 km, rezultat ≤ 84 d, VDOT 30–80          | input.ts                            | input.node                                |
| D2  | VDOT, zone kao udeo VDOT-a, RP iz trenutnog VDOT-a, fiksno        | paces.ts                            | paces.node (D2)                           |
| D3  | Δ ≤ 0,1·N / ≤ 0,2·N / nerealan = upozorenje                       | paces.ts                            | paces.node (D3), validate GOAL            |
| D4  | trka, taper, spec 3/4, baza ceil, razvoj ostatak                  | periodize.ts                        | periodize.node (D4)                       |
| D5  | ≤ 3 (izuzetno 4) izgradnje; zabrane; 0,8 ×; 1 T ≈ 60 %            | periodize.ts + week/quality/lengths | periodize.node (D5), validate             |
| D6  | start, +6 % (1–3 km), vrh, kapacitet iz konstrukcije              | volume.ts                           | volume.node                               |
| D7  | 0,75 × vrh; RP i T ≈ 60 %; dugi ≤ 0,75 × najduži; 4 dana          | week/quality/lengths                | week.node (D7), validate TAPER_*          |
| D8  | ≤ 4 dana, oštrenje ≥ 3 d, dan pred trku, 35 min E, trka van obima | week.ts + workouts.ts               | week.node (D8), validate RACE_*           |
| D9  | Q1, Q2, dugi nesusedni (ciklično); dan dugog; predlog             | schedule.ts                         | schedule.node                             |
| D10 | lestvice po fazi; ista doza druge strukture pravilom              | workouts.ts + quality.ts            | quality.node (D10)                        |
| D11 | R 5 %, I 8 %, T 10 %, RP 10 % po treningu                         | policy.ts caps                      | quality.node (D11), validate ZONE_CAP     |
| D12 | sledeći nivo / druga struktura; prelazi ≥; glavna doza ne opada   | quality.ts                          | quality.node (D12), validate DOSE_*       |
| D13 | dugi ≤ 33 % i ≤ 105 min; dugi ≥ lagan; lagan ≥ 3 km               | lengths.ts                          | week.node (D13), validate LONG_*          |
| D14 | WU 15 / CD 10 min E; oporavci R/I/T/RP                            | workouts.ts                         | week.node (D14), validate WARMUP/RECOVERY |
| D15 | ≥ 12 km, bez praznih treninga, dugi ≥ lagan                       | policy + validate.ts                | week.node (D15), validate EMPTY/WEEK_MIN  |

## Sabotaže (privremeno pokvareno → testovi pali → vraćeno)

| D   | sabotaža                                                                                    | palo (od 89) | ključni pali testovi                                                                      |
| --- | ------------------------------------------------------------------------------------------- | ------------ | ----------------------------------------------------------------------------------------- |
| D5  | `deloadAllowed` bez zabrane prve nedelje faze (prvi pokušaj: 0 palih → dodat direktan test) | 2            | periodize.node „nikad: prva nedelja faze…", validate DELOAD_PLACEMENT                     |
| D6  | rast 8 % umesto 6 % (volume.ts)                                                             | 5            | volume.node pravilo i kapacitet, quality.node D12 ×2, grid bazna linija                   |
| D8  | oštrenje ≥ 2 dana pre trke (week.ts)                                                        | 8            | grid 0 odbijanja i bazna linija, uzorci week/quality, volume.node ×2, schedule, periodize |
| D12 | bez druge strukture (quality.ts)                                                            | 42           | quality.node D12, grid ×3 (i van mreže), validate (plan odbijen)                          |
| D13 | lagan sme biti duži od dugog (lengths.ts)                                                   | 43           | grid ×3, uzorci, paces/periodize/volume, validate (plan odbijen)                          |
| D14 | I oporavak bez granice 4 min (workouts.ts)                                                  | 6            | week.node D14, volume.node ×2, quality.node ×2, grid bazna linija                         |

## Komande i rezultati (iz web/)

- `npx tsc -p tsconfig.domain.json --noEmit`, `npx tsc -p tsconfig.oracle.json --noEmit`, `npx eslint src/domain/generators/tenK/v2`, `npx prettier --check src/domain/generators/tenK/v2 ../docs/10k-v2` → exit 0, bez nalaza
- `npx vitest run --project node src/domain/generators/tenK/v2` → 11 fajlova, 89 testova, svi prošli
- `npx vitest run --project node src/domain/generators/` → 41 fajl, 838 testova, svi prošli (30 postojećih fajlova / 749 testova bez izmene + 11 / 89 novih)
- `npm run check` → exit 0 (typecheck, lint, format:check, test: 206 fajlova, 2485 testova)
- `node docs/10k-v2/artifacts/segment-01/run.ts` dva puta → bajt-isti izlaz (md5 svih fajlova isti)

## Mreža

3024 plana (9 × 7 × 8 × 3 × 2): 0 odbijanja, 0 grešaka validatora, determinizam (FNV-1a nad JSON-om,
dva generisanja), = bazna linija `segment01.baseline.json`. Upozorenja: 1914 planova ima nedelju na
izvodljivom cilju (8496/42 336 nedelja; 18 naviše), 1620 kreće ispod trenutnog obima (najviše −24,6 km),
954 nedelje ponavljaju slot. Van mreže (VDOT 30–80 × 25–55 km korak 1, sve dužine): 42 687 ulaza →
0 odbijanja, 867 planova sa odstupanjem „spuštanje doze" (u mreži 0).

## Stalni uslovi (AGENTS.md)

| #    | ispunjeno | kako                                                                                                                                                                | dokaz                                             |
| ---- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| 1    | da        | obim volume.ts, doza quality.ts, dužine lengths.ts, WU/CD workouts.ts; validator ne menja plan; nema petlji skraćivanja (pretraga cilja bira cilj, ne seče trening) | validate.node „plan se ne menja", sabotaže        |
| 2    | da        | `caps` je jedini limit zona (nema limita trajanja deonica)                                                                                                          | policy.node D11, quality.node D11                 |
| 3    | da        | WU/CD fiksni; ostatak ide u lagan; neizvodljivo → izvodljiv cilj (D6)                                                                                               | week.node D14, volume.node planirano = cilj       |
| 4, 5 | n/p       | adaptacija (04) / handoff (05); `construct(input, steps)` spreman, sada `[]`                                                                                        | generate.ts (`ADAPT_NOT_SUPPORTED`)               |
| 6    | da        | policyId/policyVersion i faza svake nedelje iz periodize                                                                                                            | periodize.node D4, validate NO_PHASE/POLICY_STAMP |
| 7    | da        | nula uvoza van tenK/v2 (ni type-only); niko ne uvozi tenK/v2; bez novih izuzetaka                                                                                   | isolation.node, postojeći testovi izolacije       |
| 8    | da        | nedelja ≥ 12 km, lagan ≥ 3 km, bez praznih, dugi ≥ lagan → greška                                                                                                   | week.node D15, validate mutacije                  |

## dev-03 (10 km 45:00 → VDOT 45,3; 40 km; 14 ned; uto/čet/sub/ned; cilj 43:30 ambiciozan)

| ned | faza   | cilj/plan | kvalitet                 | dugi | lagan max | napomena                 |
| --- | ------ | --------- | ------------------------ | ---- | --------- | ------------------------ |
| 1   | baza   | 37,6/37,6 | R 6×200; T 2,0 kont.     | 12,4 | 12,4      | izvodljiv (pravilo 40,0) |
| 2   | baza   | 39,9/39,9 | R 8×200; T 2,5 kont.     | 13,1 | 12,7      | —                        |
| 3   | baza   | 42,3/42,3 | R 6×300; T 3,0 kont.     | 13,9 | 13,5      | —                        |
| 4   | baza   | 33,8/33,8 | T 2,0 kont.              | 11,1 | 8,2       | rasterećenje             |
| 5   | razvoj | 42,8/42,8 | I 2×1000; T 3×1000       | 14,1 | 14,1      | izvodljiv (pravilo 44,8) |
| 6   | razvoj | 45,4/45,4 | I 3×800; T 3×1200        | 14,9 | 14,4      | —                        |
| 7   | razvoj | 48,1/48,1 | I 3×1000; T 4×1000       | 15,8 | 14,8      | —                        |
| 8   | razvoj | 38,5/38,5 | T 2×1200                 | 12,6 | 9,5       | rasterećenje             |
| 9   | spec.  | 50,1/50,1 | RP 3×1000; T 3×1600      | 16,5 | 16,5      | izvodljiv (pravilo 51,0) |
| 10  | spec.  | 53,1/53,1 | RP 4×1000; T 5×1000      | 17,2 | 17,1      | —                        |
| 11  | spec.  | 42,5/42,5 | T 3×1000                 | 13,7 | 10,6      | rasterećenje             |
| 12  | spec.  | 53,2/53,2 | RP 3×1500; T 2×2500      | 17,2 | 17,2      | izvodljiv (pravilo 55,0) |
| 13  | taper  | 39,9/39,9 | RP 2×1200; T 3×1000      | 12,9 | 12,5      | —                        |
| 14  | trka   | 17,8/17,8 | oštrenje RP 3×1000 (čet) | —    | 6,0       | trka ned, van obima      |

## Odluke

- Sve u `DECISIONS` (policy.ts). Tumačenja bez novog trenerskog broja: kapacitet = izvodljivost stvarne
  konstrukcije po nedelji; rast od cilja koji je nedelja stvarno dobila; jednaka udaljenost → niži cilj;
  rasterećenje i taper se ne podižu; start = prvi nivo lestvice (oprezno); sledeći nivo = najmanji veći.
- Druga struktura: samo tačne podele, najbliža prethodnoj po km rada + oporavka, pa manje deonica; R 200 ↔
  300 m; nema je → slot ponavlja (napomena; I 2,0/3,0/4,8/5,0/6,0, R 1,6/2,0).
- D8: kad bi bilo 5 dana, otpada dan dugog, inače dan dugog = 35 min E; plafon D11 ne važi u trkačkoj
  nedelji; ubrzanja R tempom, oporavak isti metraž; dan pred trku zadat vremenom, nije „lagan ≥ 3 km" (VDOT 30: 2,91 km).
- D14: RP 1300–1400 m → 90 s, 2100–2900 m → 120 s (opreznije). D9: više rešenja → najveći razmak dugi → Q1.
- Odstupanje (opreznije, van mreže): kad nijedan cilj nije izvodljiv uz „doza ne pada", doza van plafona
  ide na najviši nivo u plafonu (D11 ispred D12) + napomena + `DOSE_DROPPED`. Primer: 14 ned, 30 km, VDOT 31,
  uto/čet/sub/ned (T 4,0 km traži ≥ 40 km, kapacitet specifične nedelje < 40 km).
- Odbijanja van D1 teksta: > 55 km `WEEKLY_KM_TOO_HIGH`, 1/2/7 dana `RUN_DAYS_COUNT`, VDOT > 80 `VDOT_TOO_HIGH`.

## Preostali problemi

- D9 + D13 + D14 ograničavaju nedelju na ≈ (Q1 + Q2)/0,34 km (ili Q + 2 × dugi od 105 min): uz prvi nivo
  lestvica nedelja 1 nosi ≈ 30 km (VDOT 30) do ≈ 50 km (VDOT 75). 1620/3024 planova kreće ispod
  trenutnog obima (35 km: VDOT 30–35; 45 km: svi osim VDOT 70; 50–55 km: svi). Potrebna trenerska odluka.
- 20 % nedelja mreže je na izvodljivom cilju (napomena), uglavnom bazne nedelje visokog obima.
- Odstupanje D11 > D12 (867/42 687 van mreže) treba potvrditi ili zameniti pravilom.
- Udeli zona (D2) su sekundarni izvor, bez merenja; prognoza i E pri VDOT 30 nisu proverene na podacima.
- Segmenti: 02 (3/5/6 dana, 8–9 ned), 03 (po osećaju), 04 (adaptacija), 05 (izvoz iz tenK/index.ts, adapter).

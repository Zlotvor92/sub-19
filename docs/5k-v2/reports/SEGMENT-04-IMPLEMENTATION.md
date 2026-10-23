# 5K v2 — Segment 04: 3 i 5 dana, kratka priprema (5k-v2.3.0)

Grana `claude/generator-isolation-5k-10k-hm-marathon`, polazni 3daeb32. Bez PR-a, mergea, deploya, aktivacije.

## Odluke (DECISIONS 5k-v2.3.0) i odstupanja
1. Šablon iz jedne tabele `FIVE_K_V2_POLICY.days` (3/4/5): broj kvaliteta i laganih, udeo dugog (40/35/30%), apsolutni vrh (40/50/65), opseg obima (10–35/15–45/25–65), minimum nedelje. 3 d: kvalitet + dugi + lagan sa ubrzanjima; baza R/T naizmenično, vrhunac I, oštrenje i taper RP. 5 d: 2 kvaliteta + dugi + 2 lagana. Zahtevni dani ciklično nesusedni (`schedule.ts`, kombinacije dana).
2. `capacityKm(p, n)`: ista nejednačina kao 4 d, parametrizovana tabelom; `peakKm(start, kapacitet, n)` = min(1,3 × start, kapacitet, 40/50/65) — jedina funkcija vrha.
3. 6 ned = baza 2, vrhunac 2, taper 1, trka 1; 7 ned + oštrenje 1; bez rasterećenja; `plan.notes` = napomena kratke pripreme. Jedna nedelja tapera = taper 1 (0,85 vrha).
4. Trkačka nedelja: `targetKm = plannedKm`; 50% vrha je gornja granica i osnov budžeta/zagrevanja. PLANNED_VS_TARGET u trkačkoj nedelji je sad greška (nikad se ne javlja).
5. Rasterećenje: zamena R samo ako je rad ≥ 1,2 km; inače `stridesOnly` (lagan + 6 × 20 s, napomena), ne R 4 × 150 m.
6. Baza: R km ne pada; bez R iste ili veće doze druge strukture R se drži, a T menja strukturu (`tOther`).

Odstupanja (moje odluke posle mreže, u DECISIONS):
- Dugi za 3 d na 0,1 km (`longStepKm`; 4/5 d ostaje 0,5): jedini kvalitet je ~20% nedelje, pa 0,5 km gura lagan preko dugog.
- 3 d, baza: prvi T = 1 km kad 70% T budžeta ne prima minimum, a ceo budžet prima; ponavljanje istog treninga → generator odbija (QUALITY_INFEASIBLE), ne validator.
- RP u oštrenju neopadajući: bez višeg nivoa ista doza druge strukture (kao I u vrhuncu 2.2.0). Bez toga je 15 km / 10 ned odbijan za svaki VDOT (i 4 d na 3daeb32) — uključujući traženi primer 3 d / 15 km / 10 ned.
- Uslov 8 minimum nedelje po broju dana: 7,5 / 10 / 12,5 km. `Pattern.easy` je niz, `q2` može biti null; `PlanWeek.stridesOnly`, `FiveKV2Plan.notes` novi.
- Napomena START_ABOVE_CAPACITY: „5 dana će biti podržano kasnije" → „Za veći obim izaberi više dana trčanja" (3–4 d).

## Fajlovi
`web/src/domain/generators/fiveK/v2/`: policy, input, schedule, periodize, volume, workouts, generate, validate, types; testovi generate/segment02/segment03/workouts (prilagođen API, „3/5 dana → odbijanje" zamenjeno sa 2/6 dana, 7 → 5 nedelja); novi `segment04.node.test.ts`. `docs/5k-v2/`: `artifacts/segment-04/*` (22 primera), ovaj izveštaj, `STATUS.md`.

## Komande i rezultati (iz `web/`)
- `npx tsc -p tsconfig.domain.json --noEmit` → exit 0
- `npx eslint src/domain/generators/fiveK/v2/` → exit 0 (prvi prolaz: 1 greška no-unnecessary-type-assertion u novom testu, ispravljeno)
- `npx prettier --check src/domain/generators/fiveK/v2/` → exit 0
- `npx vitest run --project node src/domain/generators/fiveK/v2` → 7 fajlova / 307 testova prolazi
- novi `segment04.node.test.ts` na 3daeb32 → 57/67 pada (svaka odluka 1–6, mreža, RP dopuna)
- `npx vitest run --project node src/domain/generators/` → 23 fajla / 450 testova prolazi (690 s)
- `npm run check` → exit 0 (typecheck, lint, format, 183 fajla / 2079 testova)

## Mreža (3/4/5 d × 5 obima × {6, 7, 10, 16} × 4 rezultata × 2 rasporeda = 480)
| dana | obimi | planova | odbijenih | greške validatora | razlozi odbijanja |
|---|---|---|---|---|---|
| 3 | 10, 15, 22, 28, 35 | 126 | 34 | 0 | 10 km: 32 (QUALITY/WEEK_INFEASIBLE); 15 km/16 ned/VDOT ~53: 2 (I bez višeg nivoa) |
| 4 | 15, 22, 30, 38, 45 | 160 | 0 | 0 | — (na 3daeb32: 15 km/10 ned 8 odbijanja) |
| 5 | 25, 35, 45, 55, 65 | 160 | 0 | 0 | — |

Šira provera (obim korak 1 km, 6–16 ned, 5 rezultata): 3 d 1230/200, 4 d 1705/0, 5 d 2255/0 plan/odbijeno; 0 PLAN_VIOLATES_POLICY.
4-dnevni, 3200 ulaza 8–16 ned (staro vs novo): 0 regresija, 40 ranije odbijenih sad daje plan; promene samo: trkačka nedelja 3120 (Odluka 4), rasterećenje samo ubrzanja 15 (Odluka 5), baza 200 (Odluka 6).
dev-04: promenjena samo nedelja 14 (trka): cilj 22,8 → 19,49 = planirano (Odluka 4); nestalo upozorenje PLANNED_VS_TARGET. Ostali segment-03 primeri: samo trkačka nedelja, plus edge-fast-15km-13w ned 3 (Odluka 6: R 5 × 150 → 4 × 200 m, T 1,5 → 1 km) i edge-slow-45km ned 1 (tekst napomene).

## Stalni uslovi 1–8 (3, 4 i 5 dana)
| # | uslov | stanje |
|---|---|---|
| 1 | jedan vlasnik | obim: volume.ts (trka: zbir dana u generate.ts); doza: weekQuality; dugi/lagan: buildTrainingWeek; WU/CD: warmupBand. Bez petlji; validator samo prijavljuje |
| 2 | jedan plafon po zoni | budžeti I/T/R, `tContinuousMaxSec`; udeo dugog i vrh obima samo u tabeli `days` |
| 3 | WU/CD nisu pufer | manjak ide u lagan ili PLANNED_BELOW_TARGET (3 d, v. problemi) |
| 4 | adaptacija | nije u opsegu |
| 5 | handoff | nije u opsegu |
| 6 | policyId/verzija/faza | `5k-v2` / `5k-v2.3.0`, faza iz periodize.ts; test u mreži |
| 7 | izolacija | `isolation.node.test.ts` prolazi; novi uvozi samo unutar `fiveK/v2/` |
| 8 | upotrebljivost | minimum nedelje po broju dana, prazan trening, lagan ≤ dugi — test za svaki plan mreže |

## Primeri (tabele: `artifacts/segment-04/plans.md`)
`d3-15km-v38-10w` (VDOT 38.3, tue/thu/sun; R = rasterećenje)
| ned | faza | km cilj/plan | kvalitet | dugi | lagan max |
|---|---|---|---|---|---|
| 1 | baza | 15/15 | R: 4 × 150 m | 6 | 5.45 |
| 2 | baza | 16.2/16.2 | T: 1 km kont. | 6.4 | 6.3 |
| 3 | baza R | 13/13 | R: 4 × 150 m | 5.2 | 4.25 |
| 4 | vrhunac | 17.4/17.4 | I: 2 × 500 m | 6.9 | 6.64 |
| 5 | vrhunac | 18.7/18.7 | I: 2 × 600 m | 7.4 | 7.17 |
| 6 | oštrenje | 18.7/18.7 | RP: 2 × 600 m | 7.4 | 7.38 |
| 7 | oštrenje | 18.7/18.7 | RP: 3 × 400 m | 7.4 | 7.32 |
| 8 | taper | 15.9/15.9 | RP: 2 × 600 m | 6.3 | 5.68 |
| 9 | taper | 13.1/13.1 | RP: 2 × 500 m | 5.2 | 4.22 |
| 10 | trka | 5.81/5.81 | oštr. 2 × 300 m | — | 2.6 |
`d5-40km-v50-14w` (VDOT 50, mon/tue/thu/sat/sun; R = rasterećenje)
| ned | faza | km cilj/plan | kvalitet | dugi | lagan max |
|---|---|---|---|---|---|
| 1 | baza | 40/40 | R: 4 × 400 m + T: 2.5 km kont. | 12 | 7.4 |
| 2 | baza | 43.2/43.2 | R: 5 × 400 m + T: 3 km kont. | 12.5 | 8.1 |
| 3 | baza | 46.6/46.6 | R: 5 × 400 m + T: 3.5 km kont. | 13.5 | 8 |
| 4 | baza R | 37.3/37.3 | R: 4 × 400 m | 11 | 6.5 |
| 5 | baza | 50.3/50.3 | R: 6 × 400 m + T cruise: 2 × 2000 m | 15 | 8.42 |
| 6 | vrhunac | 52/52 | I: 3 × 1000 m + T cruise: 2 × 2000 m | 15.5 | 9 |
| 7 | vrhunac | 52/52 | I: 4 × 800 m + T cruise: 2 × 2000 m | 15.5 | 8.78 |
| 8 | vrhunac R | 41.6/41.6 | I: 2 × 1200 m | 12 | 7.56 |
| 9 | vrhunac | 52/52 | I: 5 × 700 m + T cruise: 2 × 2000 m | 15.5 | 8.46 |
| 10 | oštrenje | 52/52 | RP: 3 × 1000 m + R: 8 × 300 m | 15.5 | 9.18 |
| 11 | oštrenje | 52/52 | RP: 4 × 800 m + R: 8 × 300 m | 15.5 | 9.09 |
| 12 | taper | 44.2/44.2 | RP: 3 × 1000 m + T: 2 km kont. | 13 | 8.78 |
| 13 | taper | 36.4/36.4 | RP: 3 × 800 m | 10.5 | 6.36 |
| 14 | trka | 19.89/19.89 | oštr. 4 × 400 m | — | 5.2 |
`short-6w-d4-30km-v49` (VDOT 49.1, tue/thu/sat/sun; R = rasterećenje)
| ned | faza | km cilj/plan | kvalitet | dugi | lagan max |
|---|---|---|---|---|---|
| 1 | baza | 30/30 | R: 4 × 300 m + T: 2 km kont. | 10.5 | 8.4 |
| 2 | baza | 32.4/32.4 | R: 4 × 400 m + T: 2.5 km kont. | 11 | 9.1 |
| 3 | vrhunac | 34.9/34.9 | I: 2 × 1000 m + T cruise: 2 × 1600 m | 12 | 9.83 |
| 4 | vrhunac | 37.6/37.6 | I: 3 × 700 m + T cruise: 2 × 1600 m | 13 | 10.17 |
| 5 | taper | 32/32 | RP: 2 × 1000 m + T: 2 km kont. | 11 | 9.65 |
| 6 | trka | 13.46/13.46 | oštr. 3 × 400 m | — | 5.5 |

Kontinuitet pregledan za svih 18 planova: faze redom, rast ≤ 8%, I/RP neopadajući, R baze ne pada, trkačka nedelja cilj = planirano. Uočeno i ispravljeno: „Taper 1/2" u kratkoj pripremi → „Taper 1/1"; 3 d vrhunac bez ubrzanja na laganom → dodata.

## Preostali problemi
1. 3 dana, 22–35 km: „lagan = dugi" u 608 od 1216 nedelja mreže (manjak ≤ 4,4%, < 1 km; PLANNED_BELOW_TARGET). Uzrok: dugi ≤ 40% i lagan ≤ dugi traže kvalitet ≥ 20% nedelje; kontinuirani T daje ~17–20%. Kapacitet to ne hvata (nejednačina nije monotona zbog zaokruživanja). Trenerska odluka: lagan ≤ 1,1 × dugi za 3 d, dugi 45%, ili prihvatiti manjak.
2. 3 dana, 10–11 km: uvek odbijeno (R 4 × 150 m traži ≥ 12 km, T ≥ 1 km bez ponavljanja nema dva nivoa, rasterećenje 8 km ne prima kvalitet + dugi ≥ lagan ≥ 3 km). Realni minimum ~12–16 km; suziti opseg ili dozvoliti kraći lagan.
3. 15 km, 16 ned, VDOT ~53, 3 d: I bez višeg nivoa (2 × 700 m, budžet 1,56 km) — ponuda I.
4. Kratka priprema: taper 1 = 0,85 vrha pa trka; nije provereno na korisnicima. Svi pragovi ostaju heuristike.

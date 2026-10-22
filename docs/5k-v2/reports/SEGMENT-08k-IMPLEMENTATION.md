# 5K v2 — Segment 08k (5k-v2.10.3): plafon ponavljanja na novom tempu; rezultat van opsega VDOT

Polazni SHA `3949a61` (posle 08j). Grana `claude/generator-isolation-5k-10k-hm-marathon`. Menjano `fiveK/v2/**`,
`docs/5k-v2/**`; izuzeci kao 08i (redovi „5K v2" u byteSame, oznaka u `fiveKV2Flow.test.tsx`) i `features/plan/fiveKV2Adapt.test.tsx`
(test „odbijanje v2 → poruka" je kao odbijanje koristio VDOT van opsega; sada asOf = dan trke). Bez PR-a, mergea, deploya.
Obim po odluci organizatora (08k smanjen): QUALITY_INFEASIBLE (3 d / 12 km / VDOT 60) i ivice VDOT 60 / lak 270 za
početnika otpadaju.

## 1. Uzrok korak po korak (pouka 23)

| korak | strana | ispravka | test |
|---|---|---|---|
| Organizatorov primer (65 km / 5 d, VDOT 35, trka 5 km 1 700 s na dan starta): nov VDOT 33, R tempo 308 s/km. `workouts.baseWeek` nedelje 2: rast (`chooseProgressiveReps 'grow'`, poštuje plafon) nema rešenja → **zadržana prethodna doza `pm`** (5 × 400 m sa starog tempa), `fits` proverava samo rad → 0,4 km × 308 = 123 s | konstruktor | zadržana doza mora stati u plafon trajanja na tekućem tempu (`workouts.repFits`), inače sledeći izbor (`'base'`, poštuje plafon) | `segment08k.node.test.ts` (1 700/1 720/1 750/1 800 s) |
| Validator R_REP „123 s > 120 s" | — | bez izmene (sudi tačno) | — |
| `assess`: rezultat sa VDOT van 30–60 → odbijanje cele adaptacije (VDOT_OUT_OF_RANGE) | assess | kao 10K A1: RESULT_IGNORED „… VDOT 28 van 30–60 — rezultat se ne primenjuje.", adaptacija se nastavlja (najnoviji rezultat u opsegu, ako ga ima); generator (`input.ts`) i dalje odbija ulaz | 08k (2), `segment06` i app 6b ažurirani na novo ponašanje |

I_REP i T_CONTINUOUS na istom obrascu: zadržane doze I (vrhunac, gušći oporavak) i T cruise, i R u bazi sa 3 dana, nisu
dosegle plafon ni u jednom toku (edges 15 800; pretraga sporijih rezultata VDOT − 3 … − 12 u svakoj nedelji, 11 988 tokova,
`slower-probe.txt`) — uz pojedinačno isključenu proveru 0 razlika, pa ispravka NIJE dodata tamo (nema slučaja za test;
predlog: ista `repFits` provera ako se tok nađe). Ostale putanje biraju ponavljanje na tekućem tempu.

## 2. Merenje (iz `web/`; izlazi `artifacts/segment-08k/`)

| skripta | 3949a61 (08j) | 08k |
|---|---|---|
| `edges.ts 5K` (158 planova, 15 800 tokova) | 428 odbijenih tokova (razlozi: VDOT_OUT_OF_RANGE 420, R_REP 20) | **0** |
| ↳ generator | QUALITY_INFEASIBLE 2 (3 d / 12 km / VDOT 60 — otpada po odluci) | isto |
| pretraga sporijih rezultata (11 988) | R_REP 220, QUALITY_REPEAT 1 | R_REP 0, QUALITY_REPEAT 1 (staro, r-d3-13w-12km-v58-0 VDOT 58 → 46; isto na 3949a61) |
| `early.ts 5K 193 97 29`, `locked-result.ts 5K`, `start-day.ts 5K 25` | 0 odbijanja | isto (izlaz identičan) |

## 3. Regresija

Generator bajt-isti (3 816). Heš 99 069 tokova prema 08j: 0 promena. Trajna rana mreža 08g (104 800): 0 promena (fixture
nedirnut). 08e šira: + 104 toka ranije odbijena VDOT_OUT_OF_RANGE (TOTALS formerlyRejected 29 → 133, changed + 104).

## 4. Trajna mreža (u `segment08k.node.test.ts`; pun ~12 s)

Ivice: km max po broju dana 35 / 45 / 65 × VDOT 30, 60 i lak 330, 510 s/km × 6 i 16 nedelja × trka subota i nedelja
(48 planova) × sporiji, brži, test, umor i rezultat tačno na ivici i van nje (VDOT 29, 30, 60, 61) × asOf start − 1, start,
sreda ned 1, kraj ned 2, kraj ⌊N/2⌋ → 0 odbijanja. Brz nivo: svaki 6. plan. Na 3949a61 pada (svi 6 testova).

## 5. Sabotaže (`sabotage-08k.json`)

| # | sabotaža | ishod | prvi pali test |
|---|---|---|---|
| 1 | baza: zadržana R doza bez plafona trajanja (stara strana) | PAO | 08k (1) primer 1 700 s |
| 2 | rezultat van opsega VDOT se primenjuje | PAO | 08k (2) |

2/2 PALO; stanje `src` isto.

## 6. Komande (iz `web/`)

| komanda | rezultat |
|---|---|
| `npx tsc -b --noEmit`, `npx eslint .`, `npx prettier --check .` | exit 0 |
| `npm run check` | exit 0 — 314 / 3629, 518 s (prvi put pao UI test odbijanja — v. uvod; ispravljen) |
| `TEST_FULL=1 npx vitest run --changed 3949a61` | 196 / 1937 + isti UI test (pre ispravke); posle ispravke taj fajl 6 / 6 |
| `TEST_FULL=1 npx vitest run --project node src/domain/generators/fiveK/v2` | 37 / 723 (08e TOTALS ažuriran → 6 / 6) |
| `npx playwright test e2e/fivek-v2.spec.ts` | 3 / 3 |
| byteSame 10K/HM/maraton | samo redovi „5K v2" (oznaka; sa 5k-v2.10.2 prolaze bez snimanja) |

## 7. Stalni uslovi (AGENTS.md 1–8)

1. Jedan vlasnik izbora ponavljanja — konstruktor (`workouts`), validator ista pravila (R_REP). 2–3. Plafoni i WU/CD
nedirnuti. 4. Činjenice ulaze u assess; rezultat van opsega se ne primenjuje (razlog). 5. Handoff bez izmene.
6. `5k-v2.10.3`; KNOWN_VERSIONS ∪ 5k-v2.10.2. 7. Izolacija prolazi. 8. Trajne mreže 08g–08k: 0 odbijanja.

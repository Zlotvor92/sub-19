# K3 — 5K (5k-v2.15.3 → 5k-v2.16.0)

Brief: `briefs/K3-krug-3.md` (5K), izvor `coach/ROUND-02.md` § 3–5. Polazni SHA `237f5d9`. Merenje (iz `web/`):
`node ../docs/generators-v2/perfection/K3-5K/measure.ts <oznaka>` (mreža 5K = P0 + final-check `all()`, 3 964 plana),
`… measure.ts cmp pre0 K3`, `… measure.ts prof <oznaka>` (12 profila P9), `python3 …/K3-5K/sum.py <oznaka> [vdot]`.
Snimci: `K3-5K/r-pre0.json` (237f5d9), `r-K3.json` (kraj); profili `r-prof-pre0.json` / `r-prof-K3.json`.
Mreža posle svakog pravila: **0 odbijanja**, vrh cilja nigde ne pada > 10 %; planirani vrh pada > 10 % u 5 planova (3 dana).

| pravilo             | ugrađeno                                | mesto odluke (validator čita isto)                                                                                      | commit    |
| ------------------- | --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | --------- |
| K3-A doza I         | da (doza); I blok ≥ 3 ned NE            | `workouts.iDoseRange` → `minuteCapKm`, `iPeakBudget`, `firstIPeakBudget`, `iStepUp`; validator I_SHARE, PEAK_MAIN_FLOOR | `7ce6056` |
| K3-B 4 dana         | da                                      | `lengths.easyShareOf` (0,75; nedelja 1 0,80) → `easyCapKm`, `weekLengths`; validator EASY_VS_LONG, EASY_CAP             | `d58b80b` |
| K3-C 3 dana         | da                                      | `lengths.easyShareOf` (0,70); `workouts.longStridesOf` (validator LONG_NOT_EASY); `workouts.baseWeekOne` (rUses/tUses)  | `35caecc` |
| K3-D vrh pre tapera | NE (sudar)                              | —                                                                                                                       | —         |
| K3-E test           | NE (sudar van foldera)                  | —                                                                                                                       | —         |
| K3-F dan manje      | NE (samo mereno, kako brief dozvoljava) | —                                                                                                                       | —         |

## K3-A — rad jednog I treninga po cilju nedelje

VDOT ≥ 40: 30–45 km 12–16 min, 45–65 km 16–20, ≥ 65 km 18–24; VDOT < 40 od 30 km ≤ 18; ispod 30 km kao pre (G4 20/24).
Gornja granica = plafon minuta I i budžet I vrhunca; prvi I lanca ≥ donja granica (budžet lo / 0,8); korak lestvice sme
do najmanjeg nivoa ≥ donja granica. Opseg je po cilju NEDELJE (I je u vrhuncu), ne po vrhu plana — v. Otvoreno 1.
Sa rezultatom, medijana vrha I (min) po vrhu obima plana, pre → posle: 30–45 km 8,7 → **14,6** (ispod 12: 452 → 3 od
491); 45–65 km 13,3 → **17,9** (ispod 16: 177 → 12 od 216); ≥ 65 km 14,6 → **19,0** (ispod 18: 80 → 28 od 82); VDOT < 40
10,2 → 10,2 (iznad 18: 38 → 0); < 30 km bez promene. Svi planovi (i po osećaju) 10,2 → 12,0. Promenjeno 825 planova (svi R).
Profili: p01 13,0 → 15,2 (cilj 16); p02 10,0 → 14,4 (13–14); p05 13,5 → 20,3 (20); p07 15,4 → 17,9 (18); p04 (VDOT 35)
18,2 → 16,7; p06 7,3 → 12,2; p08 10,7 → 15,4. Testovi: `k3.node.test.ts` K3-A (nezavisni opseg u `testInputs.k3ILoMin/
k3IHiMin`); usklađeni p4 S1, p8 (c) i korak I, segment02 Odluka 2, segment10 T4, segment08d A/C/D/E (planirano = cilj),
segment08i k4. Sabotaža „bez opsega" pala.

## K3-B — redovan plan sa tačno 4 dana

Lagan ≤ 0,75 × dugi (5+ dana 0,70, početnik 0,80), nedelja 1 ≤ 0,80; cilj se ne spušta. Promenjeno 1 260 planova (R 4 d
665, F 4 d 519, B 4 d 76). Nedelja 1 < 95 % trenutnog obima: 377 → 261 (ostatak: 132 plana 15 km, lagan dan ne staje ni
uz 0,80; 110 planova sa ciljem nedelje 1 već < 95 % obima — van pravila laganog). Planova sa „planirano < cilj" 1 237 →
1 050. Profil p01 nedelja 1 0,93 → 0,96 × obim. Testovi: K3-B u `k3`; p8 G6, segment10 T1, segment02, segment06 (24,3),
segment08d A/E, segment08i, app (7,7 km). Sabotaže „0,70" i „bez nedelje 1" pale.

## K3-C — redovan plan sa 3 dana

(a) lagan ≤ 0,70 × dugi (bilo 0,80), višak planirano < cilj; napomena granice jednom po planu (već postojeće
`generate.push`), upozorenje zbirno. (b) Ne-rasteretna nedelja oštrenja: dugi + 6 × 20 s ubrzanja (1 130 planova). (c)
Baza (R/T naizmenično): ista R / T doza najviše 2 nedelje te vrste zaredom, pa druga struktura iste ili veće doze; nema je
→ ista doza. Ista doza > 2 puta: 129 → 34 plana (svi 12 km: jedina R opcija 4 × 150 m). Promenjeno 1 226 planova.
Profil p08: lagan 0,80 → 0,70 × dugi, dugi ned 13–14 „14,5 km + 6 × 20 s ubrzanja". Testovi: tri invarijante K3-C u `k3`;
segment05, segment08g N4 (I 3 × 500 m), segment08i (nov primer `r-d3-6w-16km-v32-1` za MIXED_OVER_TARGET / MIXED_REMAINDER —
stari primer sa 0,70 više nema tu pojavu), segment09 M2 (filter napomene granice laganog). Tri sabotaže pale.

## Testovi (10. 11. 2026)

Brz nivo 5K posle svakog pravila zelen (801 → 803 → 804 → 807). Kraj:

| komanda (iz `web/`)                                                                 | rezultat                                                 |
| ----------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `npx vitest run --project node src/domain/generators/fiveK/v2`                      | 807/807                                                  |
| `TEST_FULL=1 … fiveK/v2`                                                            | 817/817 (5 min 43 s)                                     |
| `npx vitest run --changed 237f5d9`                                                  | 133 fajla, 1 771/1 771 (2 min 39 s)                      |
| `npx playwright test e2e/fivek-v2.spec.ts --trace off`                              | 3/3 (23 s)                                               |
| `npm run check`                                                                     | prolazi (typecheck, lint, format, test:fast 3 386/3 386) |
| `node scripts/sabotage.mjs ../docs/generators-v2/perfection/K3-5K/sabotage.json -q` | 6/6 palo, `src` bajt-isti                                |

## Otvoreno

1. **K3-A I blok ≥ 3 ne-rasteretne nedelje (plan ≥ 10 ned): nije ugrađeno — sudar.** Vrhunac ima ≤ 4 nedelje, u njoj su
   rasterećenje (svaka 4.) i kontrolni test (poslednja ne-rasteretna, G7), pa ostaju 1–2 I nedelje; plan ≥ 10 ned sa < 3 I
   nedelje: sa rezultatom 306 + 138 + 60 (30–45 / 45–65 / ≥ 65 km). Opcije: (a) test u rasteretnu nedelju vrhunca (sudar
   sa adaptacijom: test u rasterećenju otpada; G7); (b) vrhunac 5–6 nedelja na račun baze (R faza 1–2 nedelje);
   (c) I i u prvoj nedelji oštrenja (manje RP). Treba odluka. Opseg je po cilju nedelje: 43 plana sa vrhom ≥ 30 km imaju
   I nedelje ispod 30 km / nižeg pojasa (ostatak „ispod" gore). Plan po osećaju (fartlek) nije diran.
2. **K3-D: nije ugrađeno — sudar.** Najteža nedelja (minuti rada, bez trke) 3 nedelje od kraja (= 2 pune nedelje pred
   trkačkom): 585 → 604 od 3 964; poslednja ne-rasteretna pred taper > 0,85 × najteže: 1 476 → 1 204. Da bi najteža bila
   tu, oštrenje (RP + R) mora nadmašiti vrhunac (I + T, I upravo podignut u K3-A), a RP u minutima je plafon „ne dirati"
   (§ 5); sa 2 nedelje oštrenja „≤ 85 %" se sudara sa strogim rastom RP (SHARPEN progresija). Opcije: obrnuta progresija
   RP u oštrenju (velika → 85 %), ili samo granica 85 % za klasu sa 1 nedeljom oštrenja (qcap kao taper).
3. **K3-E: nije ugrađeno — sudar van foldera.** Test „2 km jako ravnomerno" traži da aplikacija beleži test od 2 km:
   `app/facts.ts` upisuje rezultat testa kao 3 000 m, `app/members.ts` VDOT iz 3 000 m, `ResultDistanceM` 3/5/10 km,
   ekrani `features/day`, `features/race` („Unesi test na 3 km"). Planova sa testom > 2 × najveća doza: 443 → 431 od 2 868
   (3 d R 262, 3 d F 100, 4 d R 64, 4 d F 5); medijana odnosa 2,5.
4. **K3-F: samo mereno.** Planova sa laganim < 30 min u > 2 ne-rasteretne nedelje izgradnje: 967 → 983 (3 d 329 — dan
   manje nemoguć, minimum 3; 4 d 375; 5 d 279); po startu obima 10–15 km 594, 20–25 km 297, 30 km 92. Zahvat menja broj
   dana plana i šablon (input.runDays, pattern, prikaz dana) — više od jednog mesta odluke.

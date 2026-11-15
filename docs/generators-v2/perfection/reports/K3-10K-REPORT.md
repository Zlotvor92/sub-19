# K3 — 10K (10k-v2.14.0 → 10k-v2.15.0)

Brief: `briefs/K3-krug-3.md` (10K, 5K), izvor `coach/ROUND-02.md` § 3–5. Polazni SHA `9114711`. Merenje (iz `web/`):
`node ../docs/generators-v2/perfection/K3-10K/measure.ts <oznaka>` (mreža 10K = P0 + final-check `all()`, 31 314 planova;
snimci mreže `r-*.json` su 13 MB — nisu u gitu, ponovo se prave iz SHA), `… measure.ts cmp A B`, `… measure.ts prof
<oznaka>` (12 profila P9; `r-prof-pre0.json` / `r-prof-K3.json` u gitu), `python3 …/K3-10K/sum.py <oznaka>`.
Posle svakog pravila: **0 odbijanja**, vrh cilja i planirani vrh nigde ne padaju > 10 %.

| pravilo                  | ugrađeno                                                 | mesto odluke (validator čita isto)                                                                | commit    |
| ------------------------ | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | --------- |
| K3-A doza I i RP         | da (uz tri uska vraćanja); I blok ≥ 3 ned NE             | `quality.doseRangeSec` → `capM`, `startLevel`, `stepLevel`, `pickBuild`; START_LEVEL, DOSE_JUMP/… | `2aad2b3` |
| K3-B 4 dana              | 0,75 da; izuzetak nedelje 1 (0,80) NE (sudar)            | `policy.days[4].easyMaxLongShare` (lengths, EASY_VS_LONG, kapacitet)                              | `6fc906d` |
| K3-C 3 dana              | dugi + T da; lagan 0,70 NE (sudar); ista doza bez izmene | `quality.longTMinOf` / `longTKmOf` → `ctx.longTMin`, `workouts.longWorkout`; LONG_T               | `0f6e83c` |
| K3-D, K3-E, K3-F         | NE (samo mereno, po nalogu)                              | —                                                                                                 | —         |
| napomena 8 ned bez testa | da: nov plan bez „posle prilagođavanja"                  | `generate.ts` (napomena plana)                                                                    | `4a81971` |

## K3-A — rad jednog I i RP treninga po cilju nedelje

I (redovan, od 30 km): VDOT ≥ 40 30–45 km 12–16 min, 45–65 km 16–20, ≥ 65 km 18–24; VDOT < 40 ≤ 18 min. RP pri cilju ≥ 50 km
i VDOT ≥ 40: 22–30 min. Gornja granica = plafon I (umesto udela 8 %); donja podiže početni nivo i korak lestvice. Sudari,
vraćeno usko: (1) plafon I ≤ plafon RP iste nedelje (inače prelaz I → RP spušta dozu, DOSE_DROPPED); (2) RP zadržava udeo
D33 + G4 30 min (samo minuti: 211 tapera bez kvaliteta, G2); (3) nedelja u kojoj bi izbor sa opsegom stvorio nedelju pouke
35 bira kao pre K3-A (`keepsTwo`, kao D37; pouka 35: bez vraćanja 2 810 nedelja / 1 018 planova, sa vraćanjem 905 / 405, pre
635 / 219). Medijana vrha I pre → posle: 30–45 km 9,4 → **12,8** (ispod 12: 2 010 → 782 od ~2 300; plafon RP 10 % ispod 40
km); 45–65 km 14,1 → **17,2** (ispod 16: 4 536 → 1 209); ≥ 65 km 18,4 → **20,3** (ispod 18: 2 626 → 1 094); VDOT < 40 iznad
18 min 2 529 → 0. RP pri ≥ 50 km: medijana 22,6 → **27,2** min, ispod 22: 4 679 → 253. DOSE_DROPPED 1 087 → 978 planova.
Promenjeno 16 492 plana (4–6 dana). Profili: p02 I 8,0 → 12,0; p07 I 12,8 → 17,1, RP 18,1 → 27,1; p05 RP 22,6 → 28,2; p01
RP 23,0 → 29,5; p09 I 16,6 → 18,4, RP 22,1 → 24,5; p04 (VDOT 35) I 18,8 → 15,7, RP 28,0 → 25,2. Testovi: `k3.node.test.ts`
K3-A (nezavisni opseg `testInputs.k3RangeSec/k3CapM/k3LoM`); usklađeni quality (D11/D12/D16/D34), gridInvariants, p5 F4,
grid02/feelGrid/p35 brojke, painGrid primeri; verzija u app/e2e/onboarding. Sabotaža „bez donje granice" pala.

## K3-B — redovan plan sa tačno 4 dana

Lagan ≤ 0,75 × dugi (5+ dana 0,70, početnik 0,80); cilj se ne spušta. Promenjeno 4 231 plan (R 4 d 2 209, F 4 d 2 022);
nedelja 1 < 95 % obima 3 717 → 3 252; DOSE_DROPPED 978 → 711. Profili: p01 nedelja 1 0,96 → **1,00** × obim, vrh 51,6 → 53,9;
p09 0,96 → 1,00; p02 vrh 34,4 → 37,8. Testovi: K3-B u `k3`; p8 G6, policy, volume, validate (poruka 75 %), earlyGrid,
reliefGrid, painGrid (primeri A–E opet tačno brojke iz naziva), adaptFlow, grid02/feelGrid. Sabotaža „0,70" pala.

## K3-C — redovan plan sa 3 dana

Dugi u ne-rasteretnoj nedelji specifične faze bez ograničenja: lagan deo + završnih 10 min (prva) / 15 min (ostale) T, u
plafonu T (D11), dan iste dužine (svih 4 664 redovnih planova sa 3 dana; p08 „17,1 km: 13,9 km lagano + završnih 3,2 km T").
Testovi: K3-C u `k3` (nezavisno: 10/15 min, ≤ 10 % cilja, T samo na kraju); validator LONG_T, LONG_NOT_EASY dopušta završni T.
Dve sabotaže pale.

## Testovi (10.–11. 11. 2026; brz nivo posle svakog pravila zelen: 439 → 440 → 441)

| komanda (iz `web/`)                                                                        | rezultat                                                                           |
| ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| `npx vitest run --project node src/domain/generators/tenK/v2`                              | 441/441                                                                            |
| `TEST_FULL=1 … tenK/v2`                                                                    | 768/769 (28 min); pao adapt mreža (same 21 → 23, mixed 57 → 58), usklađeno → 37/37 |
| `npx vitest related --run <29 fajlova od 9114711>` (`--changed` vidi samo neiskommitovano) | 103 fajla, 1 018/1 018 (3 min)                                                     |
| `npx playwright test e2e/tenk-v2.spec.ts --trace off`                                      | 3/3                                                                                |
| `npm run check`                                                                            | prolazi (typecheck, lint, format, test:fast 3 396/3 396)                           |
| `node scripts/sabotage.mjs ../docs/generators-v2/perfection/K3-10K/sabotage.json -q`       | 4/4 palo                                                                           |

## Otvoreno

1. **K3-A I blok ≥ 3 ne-rasteretne nedelje (plan ≥ 10 ned): nije ugrađeno — sudar sa periodizacijom (D4/D21).** I je samo
   u razvoju (+ I održavanja nedelje B); planova ≥ 10 ned sa < 3 I nedelje 2 124 → 2 136 od 18 084 (10 ned 1 200, 11 ned 912,
   12–14 ned 24). Opcije: razvoj 3 ne-rasteretne nedelje u planu od 10–11 ned (na račun baze), ili I održavanja i u nedelji
   A specifične faze. **Ostatak pouke 35:** +270 nedelja (905 vs 635) i posle vraćanja — doza iz ranijih nedelja K3-A ne
   pada (D12). **I ispod donje granice:** 30–45 km 782 plana (plafon RP 10 % ispod 40 km < 12 min I).
2. **K3-B izuzetak nedelje 1 (do 0,80): vraćen — sudar.** Nedelja 2 (0,75) ne nosi cilj nedelje 1: nedelja 2 < nedelja 1 u
   198 / 3 696 planova mreže 02 sa 4 dana (pre 0), DOSE_DROPPED 711 → 807 planova; dobit: nedelja 1 < 95 % 3 252 → 2 592.
   Opcija: 0,80 i u nedelji 2 kad nosi cilj nedelje 1 (ili nedelja 1 = min(obim, izvodljivo sa 0,75)).
3. **K3-C lagan ≤ 0,70 × dugi: nije ugrađeno — sudar.** U 3 dana dugi je na plafonu, pa 0,70 spušta izvodljiv cilj (fit10):
   vrh cilja > 10 % niži u 474 / 2 676 (R) i 534 / 1 988 (F) planova sa 3 dana; vraćanje „0,80 kad 0,70 ne staje" ne menja
   nijednu nedelju. Opcija: kao 5K — višak cilja „planirano < cilj" (izmena `lengths.buildLengths`, poruka jednom). **Ista
   doza > 2 nedelje:** D12 već bira sledeći nivo pa drugu strukturu; 288 planova (RP 2 500 / 3 500 m prenet iz T, jedina
   struktura, sledeći nivo iznad plafona) — nema druge strukture.
4. **K3-D (samo mereno).** Najteža nedelja (minuti rada, bez trke) nije 2 nedelje pred trku: 14 820 → 12 849 od 31 314;
   poslednja ne-rasteretna pred taper > 0,85 × najteže: 25 182 → 28 267 (najčešće je ona sama najteža). Isti sudar kao 5K:
   RP strogo raste u specifičnoj fazi (D12), „≤ 85 %" traži pad doze pred taper.
5. **K3-E (samo mereno).** Test 5 km > 2 × najveća dotadašnja doza: 494 od 20 992 planova sa testom (3 d 362, 4 d 120, 6 d
   12). Test „2 km" traži 2 km u aplikaciji (`input.resultDistancesM` 3/5/10/21,1 km, ekrani unosa testa) — van foldera.
6. **K3-F (samo mereno).** Lagan < 30 min u > 2 ne-rasteretne nedelje izgradnje: 6 554 → 7 078 (3 d 731 — dan manje
   nemoguć; 4 d 1 436; 5 d 2 159; 6 d 2 752; start ≥ 30 km 5 639). Dan manje menja broj dana i šablon (input, pattern,
   prikaz) — više od jednog mesta odluke.

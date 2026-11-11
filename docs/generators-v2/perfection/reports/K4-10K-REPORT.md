# K4 — 10K: stavka B glavnog trenera (krug 3) — izveštaj

11. 11. 2026 (Europe/Belgrade). Polazni SHA `caf7098` (10k-v2.15.0) → **10k-v2.16.0** (`KNOWN_VERSIONS` ∪ v2.15.0).
Brief `briefs/K4-krug-4.md` (K4-B), način rada `briefs/K3-krug-3.md`. Merenje `K4-10K/measure.ts` (K3-10K + optW/manjak)
nad P0 + final-check = 31 314 planova (R/F/B × 3–6 dana), „pre" iz worktree-a `caf7098`; 12 profila P9 (`r-prof-*.json`).

## K4-B kratak lagan dan — ugrađeno (`336e717`)

Mesto: `lengths.optEasy` (jedino mesto odluke), `shortEasyPlan`, `OPT_NOTE`; `policy.lengths.optWeeks` (30 min = postojeći
`shortEasyWarnSec`, bez drugog limita); `week.buildWeekOf` (assemble, `BuiltWeek.opt100`); `generate.construct` (uslov iz
plana bez pravila, drugi sastav; adaptacija: napomena prethodnog plana je činjenica), `OPT_PLAN_NOTE`; pretraga cilja računa
km dana „po želji" (bez toga se cilj spuštao); validator ROLES (T1 + jedan dan; dan „po želji" samo na danu uloge lagan),
OPT_EASY, PLANNED_VS_TARGET (planirano ≤ cilj, bez upozorenja po nedelji). Oblik = parnjak HM/MAR: T1 „lagan dan odmor"
(dan šablona bez treninga) + napomena nedelje „Kratak lagan dan (dan): odmor ili 20 min lagano po želji …"; km u ostale
lagane do granice T1 (≤ udeo × dugi), ostatak planirano < cilj; nedelja ne ispod minimuma D17. Ekrani i broj dana isti;
van foldera samo verzija u `tenKV2Flow.test.tsx`.

Mreža: planova sa lagan < 30 min u > 2 ne-rasteretne nedelje izgradnje (K3-F) **7078 → 2607**; pogođeno 5163 plana /
28 570 nedelja; odbijanja 0 → 0; vrh cilja i planirani vrh < −10 %: 0 u svim grupama. Manjak (zbir izgradnje po planu,
medijana / max km): R-d5 1,7 / 15,9; R-d6 1,8 / 15,6; F-d5 2,1 / 14,3; F-d6 3,2 / 14,4; R-d4 3,9 (32 plana); F-d4 2,9 (79);
B-d4 7,8 / 24,4 (358). 12 profila: p06 ned 5–6 (subota „po želji"), −1,5 / −1,6 km, lagan 7,4–7,9 km (34–37 min),
kratkih nedelja 5 → 3; ostali isti (p11 11 kratkih — Otvoreno 1).

Tumačenja izvođača: (T1) jedini lagan dan ostaje (oblik MAR T4): 10K 3 i 4 dana imaju 1 lagan — bez njega 2 trčanja ili
Q + Q + dugi (prvi pokušaj kao HM: d3-18w-20km ned 1 20 → 15,65 km, −22 %). (T2) Van uvoda početnika i nedelja sa
ograničenjem koraka. (T3) Rečenica plana = HM tekst.

Testovi: nov `k4.node.test.ts` (p06; uzorak mreže 02: samo izgradnja, ≥ 1 preostali lagan, 3 dana nikad, manjak ≤ 30 min,
nedelja ≥ minimum, rečenica plana ⇔ dan); invarijante `gridInvariants.ts` (OPT_EASY), `adaptInvariants.ts` (planirano ≤
cilj). Usklađeno samo ono što pravilo menja: schedule, volume, week, p8 (broj dana / planirano = cilj uz dan „po želji"),
policy (verzija, DECISIONS K4-B, lengths), app/adaptFlow/handoff, periodize, painGrid (verzija). Sabotaže 2/2 palo.

## Otvoreno

1. **2607 planova i dalje sa laganim < 30 min u > 2 nedelje**: 3 dana 731 (R 300, F 175, B 256), 4 dana redovno 1058
   (R 715, F 343) — jedini lagan dan; B-d4 119 i 5–6 dana 699 (lagan i posle prenosa < 30 min, ili jedan lagan posle T1).
   Opcija: manje dana (generator + ekran) — van jednog mesta odluke.
2. Granica „ne ispod minimuma" u mreži ne veže (dan samo uz ≥ 2 lagana) — sabotaža te grane ne pada; ostaje kao zaštita.

## Testovi na kraju (iz `web/`, 11. 11. 2026, Europe/Belgrade)

Brz nivo `tenK/v2` posle pravila zelen (42 fajla / 443 testa).

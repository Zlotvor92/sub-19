# K3 — polumaraton: izmene po glavnom treneru (krug 2) — izveštaj

10. 11. 2026 (Europe/Belgrade). Polazni SHA `2f109ed` (hm-v2.12.0) → **hm-v2.13.0** (`KNOWN_VERSIONS` ∪ hm-v2.12.0).
Brief `briefs/K3-krug-3.md` (HM), `coach/ROUND-02.md` § 3–5. Merenje: `K3-HM/` (snap.ts + diff.ts + sum.ts nad mrežama
R = mreža 02, F = po osećaju, B = početnik: 25 122 plana; prof.ts nad 12 profila P9 → `prof-base/A/B/E.txt`; open.ts za
K3-D/F/G). „vrh < −10 %" = planovi grupe (porodica × dani) čiji je vrh obima niži > 10 %. Pre → posle ukupno: promenjeno
13 683 / 25 122, **0 odbijanja pre i posle**, vrh < −10 %: 0 u svim grupama.

## Po pravilu

| pravilo | stanje | mesto u kodu | mreža (pre → posle) | 12 profila |
|---|---|---|---|---|
| K3-A dugi početnika | ugrađeno (`c42ae16`) | `volume.specHold10/holdCap10`, `generate.construct` (pretraga cilja sa pragom dugog), `validate` VOLUME_PEAK | B: pad dugog u specifičnoj 312 → 0; najduži van poslednje 3 ne-rasteretne 258 → 0; prom 396; vrh promenjenih 27,2 → 28,4 (B-d4), 35 → 35,6 (B-d5) | p11 13,2 → 11,4 više nema: specifična ≥ 13,2, najduži 13,6; vrh 27,2 → 29,2; taper sada nosi RP (bilo T 1,5 km) |
| K3-B taper ≤ 60 % | ugrađeno (`262fc8c`) | `quality.taperRpFloor` (jedno mesto) → `taperDoses`; `week` taper (kraća struktura strogo), `sharpenerAllowed`; `validate` TAPER_QUALITY, REP_MIN, RP_FLOOR, RACE_SHARPENER | taper > 60 % poslednje RP doze 10 617 → 0; prom 10 719; RP tapera medijana 23,5 → 21,2 min (R-d4…6), 21 → 17,1 (R-d3) | p03 24,7 → 18,6 min, p10 26,2 → 19,7, p11 → 14,1 (2 × 1200), p12 24,3 → 21,9 |
| K3-C 3 dana (lagan 0,70) | vraćeno (vrh < −10 %) | — | v. Otvoreno 1 | p08 bez promene |
| K3-C ista doza ≤ 2 ned | nije potrebno | — | ista doza > 2 ne-rasteretne nedelje u 15 051 planu, ali ISTA doza i struktura > 2: 0 — struktura se menja svake nedelje (druga grana pravila) | — |
| K3-E brzi | ugrađeno (`aba6854`) | `specific.fastBlock`, `wantBlockKm` (2 nivoa po nedelji B), `chooseBlockKm`; `validate` LONG_BLOCK | brzih (VDOT ≥ 50, cilj ≥ 80 km) 2943: blok medijana 6 → 8 km (4/6 → 6/8), prom 2943 | p05 4/6 → 6/8 km; p01/p02 (< 80 km) 4/4 bez promene |
| K3-D, K3-F, K3-G, blok 3 dana | samo izmereno | — | v. Otvoreno 2–5 | — |

Testovi po pravilu: nov `k3.node.test.ts` (K3-A p11 + uzorak početnika; K3-B uzorak 3 mreže + p11; K3-E mreža 02 5–6 dana),
nezavisne invarijante u `gridInvariants.ts` (PEAK_CAP do ⌊1,1 × granica⌋ i K3A_SPEC_DROP; TAPER_RP sa kraćom strukturom;
SHARPENER uz taper < 4000 m). Usklađena očekivanja (samo ono što pravilo menja): beginner (tabela, HI10 taper 22,6 km /
2 × 1200 m), adapt (pouka 30: drugi početnički plan; skraćenje uklanja oštrenje), policy (verzija, taper.rpShort, DECISIONS),
quality (2 × 1500), segment07 (pod RP van tapera), segment10 (3000 m), segmentP8 (nema više „najmanja doza > 60 %"),
app (verzije). Sabotaže `K3-HM/sabotage.json` 3/3 palo (`--bail=1`).

Tumačenja izvođača: (T1) K3-A važi za ne-rasteretne specifične nedelje početnika; prag = najduži dugi izgradnje do te
nedelje; cilj sme naviše do 10 % iznad granice izgradnje (`beginner.specHoldOverPeak`), inače nedelja kao pre. (T2) K3-B:
kraća struktura = 2 × ⌊60 % / 2⌋ (korak 100 m, ≥ 1000 m), npr. 2 × 1500 posle 5 km; oštrenje trkačke nedelje ostaje kao uz
najniži nivo (trkačka nedelja „ne dirati", § 5) — za brze može biti nešto duže od RP tapera u metrima. Cilj „≤ 18 min" za
p03/p10 je u minutima 18,6 / 19,7 jer je 60 % od 5 km sporim RP tempom ≈ 19–20 min. (T3) K3-E: brz = VDOT tempa nedelje
≥ 50 i cilj te nedelje ≥ 80 km; sa 2 nedelje B niz je 6 → 8 (ne 4 → 6 → 8).

## Otvoreno

1. **K3-C lagan ≤ 0,70 × dugi za 3 dana — vraćeno.** Merenje sa 0,70: R-d3 prom 2268, vrh < −10 % **774/2640**; F-d3 prom 888,
   **429/990**; najduži dugi medijana 20 → 18,2 km; 0 novih odbijanja. Po VDOT-u (R-d3) vrh < −10 %: 30 → 234/330, 35 → 210,
   40 → 186, 45 → 72, 50 → 60, 55 → 12, ≥ 60 → 0 — nema uske klase. Uzrok: 3 dana = Q + 1 lagan + dugi; dugi veže 150 min /
   24 km / 45 %, pa lagan 0,70 × dugi ne nosi obim. Opcije: O1 ostaviti 0,80; O2 0,70 uz udeo dugog 50 % za 3 dana (kao MAR
   K3-A); O3 0,70 samo kad dugi nije na plafonu trajanja/km.
2. **K3-D vrh pre tapera — nije ugrađeno (isti sudar kao MAR).** Najteža nedelja (minuti rada) 3 nedelje pred trku: 3003 →
   1755 / 25 122 (medijana: 2 nedelje pred trku, B 3–4); poslednja ne-rasteretna pred taper ≤ 85 % najteže: 264 → 105.
   Poslednja nedelja pred taper je po rasporedu A/B nedelja B (najveći blok), a stroga progresija doze (DOSE_DECREASE /
   MAIN_DOSE) zabranjuje pad; ≤ 85 % traži spuštanje bez razloga iz plafona. Opcije kao MAR: pomeriti poslednju B na N−4
   ili korak „oštrenje pred taper" kao izuzetak progresije.
3. **K3-F talas dugog — samo mereno.** Dugi na plafonu (najdužem) > 3 ne-rasteretne nedelje zaredom: 20 184 / 25 122 (R
   13 542, F 5283, B 1359); > 4 puta u planu 16 125; niz medijana 4–7 (p05 24 km × 11). Odluka o trošenju plafona (koje
   nedelje dobijaju plafon, a koje 0,85 ×) traži raspored od kraja plana — v. MAR Otvoreno 6.
4. **K3-G dan manje / test — samo mereno.** Lagan < 30 min u > 2 nedelje izgradnje: 4297 planova (R 3057, F 728, B 512);
   dan manje menja broj dana i šablon (`schedule`, H9/H15) — nije mali zahvat. Test 5 km > 2 × najveća dotadašnja doza:
   762 / 20 160 planova sa testom (R-d4 162, F-d4 330, F-d5 156, R-d5 78); test 3 km/2 km traži izmenu van foldera
   (unos rezultata), kao 5K Otvoreno 3.
5. **Blok u dugom za 3 dana (K3-C drugi deo) — nije ugrađeno.** 3 dana nemaju nedelju B (jedan slot, `bAllowed`); RP usred
   nedelje u specifičnoj: medijana 26,8 min (R-d3) / 30,3 (F-d3), dugi 19,1 / 18,9 km (12 210 nedelja). Traži nov tip
   slota (T usred nedelje uz blok RP u dugom) i lanac doza u validatoru — zaseban segment, kao MAR Otvoreno 2.
6. K3-A podiže vrh početnika do 10 % iznad granice izgradnje (H17 1,4 ×) u specifičnoj fazi; „dugi > 45 % nedelje najviše
   u 3 nedelje" nije ugrađeno (udeo po nedelji, P8 STOP S2): planova sa > 3 takve nedelje B-d4 408 → 462, B-d5 156 → 156.

## Testovi na kraju (iz `web/`, 10. 11. 2026, Europe/Belgrade)

Brz nivo `halfMarathon/v2` posle svakog pravila zelen (363 → 365 → 367 → 368 testova).
`TEST_FULL=1 npx vitest run --project node src/domain/generators/halfMarathon/v2` 76 fajlova / 460 testova zeleno (10 min 24 s);
`npx vitest run --changed 2f109ed` 105 / 1019 zeleno (1 min 43 s); `npx playwright test e2e/hm-v2.spec.ts
e2e/handoff-v2.spec.ts --trace off` 5/5 (65 s); `npm run check` 302 / 3392 zeleno (6 min 14 s); sabotaže 3/3. Ispis
`P9/plans/HM/` (12) ponovo napravljen (hm-v2.13.0).

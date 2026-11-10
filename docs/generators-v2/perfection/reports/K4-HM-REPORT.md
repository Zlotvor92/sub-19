# K4 — polumaraton: stavke A i B glavnog trenera (krug 3) — izveštaj

10. 11. 2026 (Europe/Belgrade). Polazni SHA `ea1fa5f` (hm-v2.13.0) → **hm-v2.14.0** (`KNOWN_VERSIONS` ∪ hm-v2.13.0).
Brief `briefs/K4-krug-4.md`, `coach/ROUND-03.md` § 3. Merenje: `K4-HM/` (snap.ts + diff.ts nad mrežama R = 02, F = po
osećaju, B = početnik: 25 122 plana; prof.ts nad 12 profila P9 → `prof-*.txt`; `diff-*.txt`). „vrh < −10 %" = planovi
grupe (porodica × dani) čiji je vrh obima niži > 10 %. Ukupno: **0 novih odbijanja**, vrh < −10 %: 0 u svim grupama.

## Po pravilu

| pravilo | stanje | mesto u kodu | mreža (pre → posle) | 12 profila |
|---|---|---|---|---|
| K4-A1 blok u dugom, 3 dana | ugrađeno (`04faa4c`) | `specific.bAllowed` (3 dana otvoreno), `week.buildWeekIn` (bEasyQ1: Q1 lagan, stanje Q1 ostaje), `validate` ROLES/LONG_BLOCK/B_WEEK_MISSING | R-d3 prom 2640/2640, F-d3 990/990; nedelja sa blokom 0 → 1–2 po planu, zbir bloka medijana 10 km (4–10); 4–6 dana i početnik bez promene | p03/p10 blok 4/4 km, p08 4/6 km; kvalitet usred nedelje B lagan |
| K4-A2 talas dugog | ugrađeno (`5c73c5a`, oblik `3903f0c`) | `lengths.longWave` (jedno mesto), `waveCap10`, `waveLengths`; `generate.construct` (dva prolaza), granica dugog kao pouka 28; `validate` rollAt, LONG_WAVE, PLANNED_VS_TARGET | plafon > 3 zaredom 2535 → 273 (bez talasa, v. Otvoreno 2); talas u 2262: na plafonu 5 → 3 puta, niz 5 → 1; cilj obima i vrh bez promene, planirano izgradnje medijana −1,7 % (p10 −3,7 %, min −10,2 %) | p08 24 km u ned 12/15/18 (bilo 12, 14–16, 18), ned 14/16 20,4 km; p03/p10 15,7 km 3 puta (bilo 5) |
| K4-A3 lagan ≤ 0,70 (3 dana) | vraćeno (vrh < −10 %) | — | v. Otvoreno 1 | — |
| K4-B kratak lagan dan | ugrađeno (`41e0dfa`) | `lengths.optEasy` (jedno mesto), `shortEasyPlan`; `week.buildWeekIn`; `generate` OPT_PLAN_NOTE; `validate` ROLES (optRest), OPT_EASY, PLANNED_VS_TARGET | lagan < 30 min u > 2 nedelje izgradnje 4297 → 389; pogođeno 4240 planova / 28 500 nedelja; manjak (planirano < cilj) medijana po planu R-d4 30,9 km, F-d4 27,5, R-d5 3,0, R-d6 ≈ 0, B ≈ 0; lagani zbir R-d4 83 → 50,9 km | p06: 6 nedelja, −4,1 km ukupno, najkraći lagan 19 → 30 min; p11: 14 nedelja, −2,0 km, 28,5 → 42,8 min |

Testovi po pravilu: nov `k4.node.test.ts` (A1 p08 + uzorak 3 dana R/F; A2 p08 i uzorak sa talasom; B p06 i uzorak R/F/B),
nezavisne invarijante u `gridInvariants.ts` (POUKA35/DOSE_DECREASE 3 dana — Q1 lagan uz blok; WAVE; GROWTH bez talasa;
OPT_EASY, DAYS_COUNT, PLANNED_EQ_TARGET uz dan „po želji") i `adaptInvariants.ts` (planirano ≤ cilj uz dan „po želji").
Adaptacija (3 dana): tip A/B nedelje koja je cela prošla je činjenica upisanog plana (`generate` pastType), zaštićen dugi
sa blokom se ne sudi po novom rasporedu (B_WEEK_ORDER); započete nedelje talasa su činjenica, budućnost bez talasa (ako
validator ne prihvati — i bez upisanog). Bez toga pun nivo: 10 padova (rana adaptacija, ponovljen umor, HM-08; VOLUME_RULE/
VOLUME_PEAK posle umora/pauze, 3 dana) → 0 (5253 tokova 3 dana + 510 tokova umora: 0).
Usklađena očekivanja: segmentP1 (blok i za 3 dana), segment10 (RP u ned 7 — ned 6 je B), week (planirano ≤ cilj), policy
(verzija, lengths, DECISIONS K4-A1/A2/B), app (verzije). Sabotaže `K4-HM/sabotage.json` 3/3 palo (`--bail=1`).

Tumačenja izvođača: (T1) A1 samo specifična faza (raspored A/B je samo specifičan; „kasni razvoj ako staje" nije
uveden). (T2) A2: plafon = najduži dugi plana bez talasa; od kraja unazad nedelja B uvek ostaje na plafonu, ostale se
smenjuju; sve ostale nedelje plafona (i u bazi/razvoju) ≤ ⌊0,85 × plafon⌋. Nedelja talasa zadržava cilj po pravilu, a
ostatak koji lagani (≤ 0,8 × kraći dugi) ne nose je planirano < cilj (uslov 3) — prvi oblik (niži izvodljiv cilj) je
spuštao rast obima (p08 nedelje sa blokom 22,8/23,3 km umesto 24) i sudarao se sa adaptacijom. (T3) B: postojeći oblik = dan šablona bez treninga (T1 / odmor); tekst „odmor ili 20 min
lagano po želji" je u napomeni nedelje sa imenom dana (ekran prikazuje dan kao odmor). Nedelja ne pada ispod minimuma
(H15) — tada dan ostaje.

## Otvoreno

1. **K4-A3 lagan ≤ 0,70 × dugi za 3 dana — vraćeno (ostaje 0,80), i uz A1 + A2.** R-d3 prom 2532, vrh < −10 %
   **870/2640**; F-d3 prom 951, **447/990**; najduži dugi medijana 19,8 → 18 km; obim izgradnje 408 → 358 km (R-d3);
   0 novih odbijanja. p03/p10 vrh 34,9 → 30,2 km, najduži 15,7 → 13,5; p08 vrh isti, obim 691 → 628 km
   (`prof-A3-070.txt`). Uzrok isti kao K3: 3 dana = Q + 1 lagan + dugi, lagan 0,70 × dugi ne nosi obim.
2. **K4-A2 bez talasa u 273 / 2535 planova.** Plan sa talasom se odbacuje kad (a) spušta dozu kvaliteta (korak „drop" kog
   plan bez talasa nema — kraći dugi, pa dan kvaliteta ne sme biti duži, pouka 32) ili (b) menja plafon dugog; tada plan
   kao pre (dugi na plafonu > 3 nedelje). Adaptacija ne pravi nov talas (budućnost bez talasa).
3. **K4-B: 389 planova i dalje sa laganim < 30 min u > 2 nedelje** (R-d5 66, R-d6 229, F-d6 35, B 50): nedelja bi pala
   ispod minimuma H15, ili i posle prenosa lagan ostaje < 30 min (granica ≤ udeo × dugi). Manjak obima je veliki na 4
   dana malog obima (R-d4 medijana −30,9 km po planu, ≈ −8 %): drugi lagani ne mogu da prime km (≤ 0,70 × dugi).

## Testovi na kraju (iz `web/`, 10. 11. 2026, Europe/Belgrade)

Brz nivo `halfMarathon/v2` posle svakog pravila zelen (368 → 370 → 372 → 374 testova).

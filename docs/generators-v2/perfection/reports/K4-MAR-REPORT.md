# K4 — maraton: krug 4 (stavke A i B glavnog trenera, krug 3) — izveštaj

10.–11. 11. 2026 (Europe/Belgrade). Polazni SHA `ea1fa5f` (marathon-v2.13.0) → **marathon-v2.14.0** (`KNOWN_VERSIONS` ∪
v2.13.0). Brief `briefs/K4-krug-4.md`, način rada `briefs/K3-krug-3.md`, `coach/ROUND-03.md` § 3–4. Merenje: `K4-MAR/`
(snap.ts + diff.ts nad mrežama 02 / 03 po osećaju / 03 početnika = 31 920 planova; count.ts, kb.ts; prof.ts nad 12
profila P9). „vrh < −10 %" = broj planova grupe (porodica × dani) čiji je vrh obima niži > 10 %. Nova odbijanja: 0.

## Po pravilu

| pravilo | stanje | mesto u kodu | mreža (pre → posle) | 12 profila |
|---|---|---|---|---|
| K4-A (1) blok MP u dugom, 3 dana | ugrađeno (`2f39d1d`) | `specific.abPlan`, `week.buildWeekIn` (B bez Q2 za 3 dana); validator: nedelja B u lancu doze tipa B i u IDENTICAL_WEEKS, BUILD_NO_QUALITY | planova 3 dana sa blokom R 0 → 3072/3120, F 0 → 1152/1170 (2 bloka: R 2334, 3: 714); MP u dugom medijana 18 km (F 16); prvi pokušaj: 159 novih IDENTICAL_WEEKS (A nedelja posle B = ista MP doza kao A pre B) → validator poredi sa nedeljom B → 0 | p03/p10 21+8 i 20,7+8; p08 28,9+8 i 29,3+10; MP usred nedelje B = lagan dan |
| K4-A (2) talas dugog | ugrađeno (`2f39d1d`) | `lengths.longWave10` (jedino mesto), `longCap10` (`DayRule.longWave10`), `volume.nominalPeak10`; validator LONG_WAVE | niz > 3 nedelje na najdužem R 2796 → 0, F 1026 → 9; dugi na najdužem (medijana menjanih) 5 → 2; vrh < −10 %: R-d3 24/3120, F-d3 0/1170; vrh medijana menjanih R 52,6 → 49,3, F 49 → 48,9 | p08 dugi 29,3 × 5 → 29,3 / 24,9 / 28,9+8 / 24,9 / 29,3+10; p03 21 × 5 → 21 / 17,8 / 21+8 / 17,8 / 20,7+8; p10 isto; vrh 42 / 60 / 42 bez promene |
| K4-A (3) lagan ≤ 0,70 | već od K3-C | `lengths.easyLongShareOf` | vrh < −10 % < 10 % planova → ostaje 0,70 | lag/dugi 0,70 |
| K4-B kratak lagan dan | ugrađeno (`3a547e7`) | `week.shortEasyWeeks` (jedino mesto), `shortRestNote`, `SHORT_REST_PLAN_NOTE`; `generate.construct` (drugi sastav, `DayRule.longKeep10`); validator: grana K4-B u PLANNED_VS_TARGET / WEEK_MIN, SHORT_REST | planovi sa > 2 nedelje lagan < 30 min: R 1840 → 402, F 362 → 39, B 77 → 0; pravilo u R 1468 (d5 620 / 4300 ned., d6 848 / 5914), F 323 (926 / 1089), B 77 (167 / 225); lagan u tim nedeljama medijana 8–11 km; planirano < cilj bez upozorenja R 1090, F 298, B 80 nedelja; vrh < −10 %: 0; vraćeno (drugi sastav pada) R-d6 6 | p06 ned 1–3, 7: 2 × 5 km → 1 × 9,8–10,9 km + dan „odmor ili 20 min lagano po želji"; obim i dugi isti |

Testovi po pravilu: nov `k4.node.test.ts` (K4-A p03/p08/p10; K4-B p06, p01) + nezavisne invarijante mreže u
`grid.harness.node.test.ts` (blok u nedelji B i za 3 dana; 3 dana: dugi na najdužem ≤ 3 ne-rasteretne nedelje zaredom;
K4-B nedelja: planirano ≤ cilj, dan manje od šablona, rečenica plana) i `adaptInvariants.ts` (K4-B = nedelja sa
planirano ≤ cilj). Usklađena očekivanja (samo ono što pravilo menja): p2, validate, policy, segment08 (drugi primer iste
klase), segment08c, segment07 (drugi primer iste mreže), app/app + app/adaptFlow (verzija), adapt (verzija). Sabotaže
`K4-MAR/sabotage.json` 3/3 palo (`--bail=1`). Bazne linije `segment03{,-feel,-beginner}.p8.baseline.json` upisane posle
svakog pravila koje ih menja.

Tumačenja izvođača: (T1) treća nedelja na plafonu (pozicija 4 od kraja) je u razvoju kad specifična faza ima samo 3
ne-rasteretne nedelje — tada bez bloka; „kasni razvoj ako staje" nije otvoren (blok samo u specifičnoj fazi). (T2)
plafon plana za plato = plafon dugog pri nominalnom vrhu polaznog rasporeda (`nominalPeak10`), „stoji" = plafon nedelje
pri nominalnom cilju ≥ plafon plana − 0,1 km (međuplato ravne baze nije talas). (T3) K4-B: postojeći oblik MAR-11 (dan
odmora, napomena nedelje sa oznakom), dan nestaje iz plana — ekran ga prikazuje kao odmor; dugi te nedelje ostaje
kakav je bio, km idu samo u lagane dane. (T4) K4-B ne važi za nedelju bez dana kvaliteta/testa (uvod početnika: dan Q1
je lagan — 18 B-d4 planova bi palo na ROLES).

## Otvoreno

1. **K4-A — 9 planova po osećaju sa nizom > 3** (feel-d3-16…18w-35km-e405): nominalni vrh polaznog rasporeda (plafon
   plana) je viši od dostignutog cilja, pa plato na 24 km nije prepoznat. Opcija: plafon plana iz dostignutih ciljeva
   (traži odluku iz budućih nedelja — dvoprolazna odluka).
2. **K4-A — 4. nedelja na najdužem** (dugi na najdužem 4 puta: 276 planova 3 dana R+F, 5–6 puta: 9): plato počinje na neparnoj poziciji ≥ 3
   (prvi dolazak na plafon); „najviše 3 puta" bi tražilo da se rast dugog zaustavi pre platoa. Opcija: ostaviti.
3. **K4-A — spori trkač na plafonu trajanja** (npr. d3-15w-45km-v30-C: dugi 21,4 = 180 min od ned 2): nedelje na
   0,85 × dugi imaju obim −16 % (lagan ≤ 0,70 × dugi), vrh 47,6 → 42,4 (−11 %); u grupi 24/3120 — ispod praga.
   Opcija: za plafon trajanja lagan 0,80 u nedeljama na 0,85.
4. **K4-B — nepokriveno:** 4 dana redovno (jedan lagan dan: R 318, F 39) i 3 dana (R 48) — dan manje bi bio jedini
   lagan dan; 6 dana R 36 planova i dalje ima > 2 nedelje sa laganim < 30 min (posle odmora jednog od tri dana).
   Opcija: pun zahvat (generator bira manje dana + ekran) — trener ga ne preporučuje (§ 3).
5. **K4-B — drugi sastav:** odluka se čita iz plana sastavljenog bez pravila (konstruktor dva puta za ~6 % planova);
   R-d6 6 planova: drugi sastav pada na validatoru → plan bez pravila.

## Testovi na kraju (iz `web/`, 11. 11. 2026, Europe/Belgrade)

Brz nivo `marathon/v2` posle svakog pravila zelen (na kraju 42 fajla / 468 testova, ≈ 45 s).
`TEST_FULL=1 npx vitest run --project node src/domain/generators/marathon/v2` 80 fajlova / 570 testova: prvi prolaz
20 fajlova crveno (12 min 40 s) — (a) nova odbijanja IDENTICAL_WEEKS u adaptiranim planovima sa 3 dana (earlyGrid 4, 5,
7; mixedGrid 6–8): dve nedelje B samo sa blokom imale su isti ključ, a blok se ponavlja po pravilu (LONG_BLOCK) →
nedelja samo sa blokom van tog poređenja (`ff72ecf`); (b) invarijanta „niz ≤ 3" van mreže 02 (dense, recent, po
osećaju; Otvoreno 1) → samo mreža 02. Posle ispravke 20 palih fajlova pun nivo 20 / 49 zeleno (6 min 20 s).
`npx vitest run --changed ea1fa5f` 106 / 1049 zeleno (1 min 34 s); `npx playwright test e2e/marathon-v2.spec.ts
--trace off` 3/3 (54 s); `npm run check` 304 / 3411 zeleno (5 min 44 s); sabotaže 3/3. Ispis `P9/plans/MAR/` (12).

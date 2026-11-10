# K3 — maraton: izmene po glavnom treneru (krug 2) — izveštaj

10. 11. 2026 (Europe/Belgrade). Polazni SHA `237f5d9` (marathon-v2.12.0) → **marathon-v2.13.0** (`KNOWN_VERSIONS` ∪
v2.12.0). Brief `briefs/K3-krug-3.md` (MAR), `coach/ROUND-02.md` § 3–5. Merenje: `K3-MAR/` (snap.ts + diff.ts nad mrežama
02 / 03 po osećaju / 03 početnika = 31 920 planova; prof.ts nad 12 profila P9; fg.ts, runs.ts). „vrh < −10 %" = broj
planova grupe (porodica × dani) čiji je vrh obima niži > 10 %. Odbijanja posle svakog pravila: 0 novih.

## Po pravilu

| pravilo | stanje | mesto u kodu | mreža (pre → posle) | 12 profila |
|---|---|---|---|---|
| K3-A najduži dugi | ugrađeno (`253b7d0`) | `lengths.longRuleOf/longShareCap10/peakShareOf/longShortOf`, `specific.blockFits` (plafon MP), `validate` LONG_SHARE/LONG_BLOCK/MARATHON_LONG_SHORT | medijana najdužeg R-d4 21,4 → 24, R-d5 22 → 24,1, R-d6 22,4 → 24,1, F-d4 22 → 23,2; MARATHON_LONG_SHORT R 6126 → 3648, F 2562 → 1170; vrh bez pada | p01 22,4 → 25,2; p02 22,4 → 25,2; p06 17,6 → 20,3; p03/p10 21 (3 dana već 50 %; obim) i p11 17,9 bez promene, uz rečenicu „Za maraton treba oko X km nedeljno …" |
| K3-B vrh početnika | ugrađeno, usko (`7f01c65`) | `volume.peakCap10/hoursCap10/beginnerKeepsPeak` | B-d4 vrh 52,5 → 45,5, B-d5 60 → 52 (traženi efekat; vrh < −10 % 1464/1890); najduži 23,2 → 21,4; redovni 0 promena | p12 75 → 64,2 km (8,7 → 7,4 h); p11 (dno tabele) 37,5 ostaje |
| K3-C 3 dana | delimično (`d723a83`) | `lengths.easyLongShareOf` | R-d3 prom 864, F-d3 534; lagan/dugi 0,80 → 0,70; vrh medijana menjanih 55 → 52,6 (vrh < −10 %: 0); CAPACITY_LIMITED R +186, F +156 | p03/p08/p10 bez promene (već ≤ 0,69) |
| K3-D vrh pre tapera | vraćeno (sudar) | — | izmereno: najteža nedelja = poslednja pred taper u 31 920/31 920 (≤ 85 %: 0) | — |
| K3-E brzi + dan pred dugi | (a) ugrađeno (`2a750d7`), (b) vraćeno, (c) nije | `specific.fastBlock/chooseBlockKm` | (a) blok medijana 14 → 16 km (R-d4, F-d4…6), MP trening A nedelje 46 → 54 min; prom 6525; DOSE_DROPPED R 1578 → 2388, F 1587 → 1710 | p05 blok 14 → 16 km (50 % dugog 32 km = gornja granica), MP usred 46 → 54 min |
| K3-F talas dugog | nije ugrađeno | — | dugi na najdužem > 4 puta: R 14 772/21 840, F 5544/8190; niz > 3: R 16 224, F 6120 | p05 32 km × 12, p08 29,3 × 5 bez promene |
| K3-G dan manje / test | nije potrebno / nije ugrađeno | — | test > 2 × najveća ranija doza: 0 (R, F); lagan < 30 min u > 2 nedelje: R 1870, F 362, B 77 | — |

Testovi po pravilu: nov `k3.node.test.ts` (K3-A, B, C, E) + nezavisne invarijante mreže u `grid.harness.node.test.ts`
(udeo vrha 45/50 % do min(26 km; 165 min); vrh početnika ≤ max(start; min(1,3 × start; 7,5 h)); lagan ≤ 0,70 × dugi
3–6 dana uz pod 5 km/20 min; blok ≤ 16 km, brzi ≤ 18 km i ≤ 75 min). Usklađena očekivanja (samo ono što pravilo menja):
beginner, p2, p8, policy, segment07, segmentFinal, validate, week, dayCap, app/handoffSource, adapt/app/adaptFlow (verzija).
Sabotaže `K3-MAR/sabotage.json` 4/4 palo (`--bail=1`). Bazne linije `segment03{,-feel,-beginner}.p8.baseline.json` upisane
posle svakog pravila koje ih menja.

Tumačenja izvođača: (T1) K3-A 45 % važi za 4+ dana (5–6 dana inače 35/32 %); (T2) cilj „ili 2 h 45 / 3 h 00" meri se
sporim E kao plafon trajanja — redovan dugi na 180 min dostiže cilj, pa rečenica „ograničava ga trajanje" i upozorenje
otpadaju; ponuda kraće distance (`shorter.ts`) i dalje čita prag u km; (T3) početnik zadržava F2 (50 % / 180 min), prag
26 → 24 km; (T4) u K3-B klasa „dno tabele" = start < kmMin reda + 5 km.

## Otvoreno

1. **K3-B — 1,30 × za dno tabele početnika.** Sa 1,30 × za sve: 159/1890 novih odbijanja, sve na dnu tabele
   (d4 25 km, d5 30 km; WEEK_MIN_VOLUME 102, WEEK_INFEASIBLE 57). Opcija iz briefa „taper N−1 naviše do izvodljivog"
   ugrađena i proverena: ostaje WEEK_MIN_VOLUME (nedelja < 20 km). Ugrađeno: 1,5 × samo za start < kmMin + 5. Opcije:
   O1 ostaviti; O2 dno tabele odbiti sa preporukom (polumaraton / više obima); O3 minimum nedelje tapera početnika niži.
   Posledica K3-B: K3-A cilj 24 km početnik dostiže ređe (MARATHON_LONG_SHORT B 669 → 1020).
2. **K3-C — blok MP najnižeg nivoa u dugom za 3 dana (T umesto MP usred nedelje).** Nije ugrađeno: smena A/B (M19)
   postoji samo za 2 kvaliteta; 3 dana traže nov tip slota (T na jedinom danu u nedelji B uz očuvano MP stanje) i
   izmenu lanca doza u validatoru (DOSE_DECREASE, MAIN_DOSE_DECREASE, B_WEEK_MP, LONG_BLOCK). Opcija: zaseban segment.
   „Ista doza ≤ 2 nedelje": niz iste doze u 3 dana do 11 nedelja, ali struktura se menja svake nedelje (4290/4290) i
   korak gore se uzima čim staje — pravilo je već ispunjeno svojom drugom granom.
3. **K3-D — sudar sa M12/M19.** Nedelja pred taperom je po M19 nedelja B (najveći blok), a M12 zabranjuje pad glavne
   doze; ≤ 85 % traži spuštanje doze bez razloga iz plafona (greške DOSE_DECREASE/MAIN_DOSE_DECREASE). Opcije: O1
   raspored A/B pomeriti da poslednja B bude N−4, a N−3 nedelja A bez rasta doze; O2 nov korak „oštrenje pred taper"
   (izuzetak M12 kao `drop`) sa izborom najveće kombinacije ≤ 85 %; O3 ostaviti.
4. **K3-E(b) — dan pred dugi ≤ 50 %.** Ugrađeno usko (jedini lagan dan pred dugim) i izmereno: 67 novih odbijanja
   (F-d3 40, F-d4 27), vrh < −10 %: R-d3 722/3120, R-d4 604/4368, F-d3 266, F-d4 318; najduži dugi R-d3 24,5 → 20,4,
   p01 25,2 → 22 (poništava K3-A). Vraćeno celo. 5–6 dana: sudar sa M13 „lagani jednaki" (EASY_UNEQUAL). Opcije:
   O1 dan pred dugi kraći uz dopuštenu nejednakost laganih (5–6 dana); O2 za 3–4 dana zameniti redosled dana (kvalitet
   pred dugi nije dozvoljen — M9), O3 ostaviti.
5. **K3-E(c) — početnik: jedan MP trening u dugi (20–30 min).** Nije ugrađeno: početnik nema nedelju B (M19 `abPlan`);
   isti zahvat kao tačka 2.
6. **K3-F — talas dugog.** Nije ugrađeno: pogađa 2/3 planova; „najviše 4 puta" u konstruktoru koji ide unapred troši
   plafon rano (p05 32 km od nedelje 1 → vrh bi bio 0,85 × plafona), a raspored od kraja traži dvoprolaznu odluku ili
   stanje koje validator ponavlja (LONG_JUMP, dugi = najveća dozvoljena dužina). Opcije: O1 rezervisati plafon za
   poslednje ne-rasteretne nedelje (pozicije 0, 2, 4, 6 od tapera), ranije ≤ 0,85 × plafon samo u planu čiji je dugi
   na plafonu > 3 nedelje (jedna funkcija nad okvirima + polaznim plafonom); O2 zaseban segment.
7. **K3-G — dan manje.** Lagan < 30 min u > 2 nedelje izgradnje: R 1870, F 362, B 77 planova; izmena broja dana menja
   raspored (`schedule.patternOf`, M9/M15) — nije mali zahvat. Test: 0 prekršaja, nema izmene.
8. DOSE_DROPPED (S2) raste sa K3-E(a) (+810 R, +123 F): veći blok podiže „poslednju MP dozu", trening A nedelje ostaje
   u 60 min.

## Testovi na kraju (iz `web/`, 10. 11. 2026, Europe/Belgrade)

Brz nivo `marathon/v2` posle svakog pravila zelen (na kraju 41 fajl / 453 testa, ≈ 40 s);
`TEST_FULL=1 npx vitest run --project node src/domain/generators/marathon/v2` 79 fajlova / 555 testova zeleno (11 min 8 s);
`npx vitest run --changed 237f5d9` 133 / 1772 zeleno (2 min 21 s); `npx playwright test e2e/marathon-v2.spec.ts --trace off`
3/3 (55 s); `npm run check` 301 / 3387 zeleno (7 min 8 s); sabotaže 4/4. Ispis `P9/plans/MAR/` (12) ponovo napravljen.

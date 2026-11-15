# R24-MOTOR — izveštaj (Opus 5.5, 14. 11. 2026, do 23:55 po Beogradu)

Grana `claude/v4`, polazno `40911f88`. Svaka stavka svoj commit, push posle svake (rebase pre push-a). Urađeno: 0, 1,
2 (suženo), 3, 4 (suženo), 6, 7. **Neurađeno: M5.** Ništa u `main`, bez PR-a, deploya i baze.

| # | Stavka | SHA | Stanje |
|---|---|---|---|
| 0 | Higijena | `ae2722f7` | urađeno |
| 1 | M6 + P1 | `d9fb50d7` | urađeno, P1 suženo |
| 2 | M4 | `0158533c` | delimično (a suženo, c, d; b i „juče" deo nisu) |
| 3 | M1 | `09f4c711` | urađeno |
| 4 | M2 | `5665ac2f` | urađeno, suženo |
| 5 | M5 | — | **neurađeno** |
| 6 | M3 | `4b6f817f` | urađeno |
| 7 | Nalazi sloja aplikacije | `feb218a0` | urađeno |

**0.** lint `plan.ts:608`, prettier nad `domain/v4/**` (14 fajlova), zaostali ispisi R22 (5K/HM parovi p1a/p2a/p2b,
HM target-compare). Otisci i ispisi p*/s* isti. `npm run check` čist posle commita.

**1. M6 + P1.** `easyFill` (build.ts): 1) nedelja do +5 % iznad cilja; 2) kraći dugi do max(1,3 × najkraći, 85 % dugog,
najduži brzi + 5 min); 3) jedan lagan dan manje (nikad < 3), samo kad ostali preuzmu ≥ 95 % njegovih minuta. Važi u
gradnji i rasterećenju — ne u vrhu, nedelji pred vrhom (merilo vrha), sužavanju, trci, proveri ni prozoru povratka;
lanac rasta čita nedelju bez dopune M6 (inače +5 % se ulančava). Ulaz `availability.confirmedRunDays` (SPEC § 2.1a,
`decisions.confirmedRunDays`): sa potvrdom svi dani ostaju, upozorenje `lagan-kratak` ostaje. Zaglavlje:
„Tražio si N dana trčanja nedeljno; u nedeljama a–b plan ima N − 1, da nijedno trčanje ne bude kraće od M min — taj
dan može biti šetnja." **P1 suženo:** prag od 4 dana samo za 5 km i 10 km (`minEasyBuildFromRunDays: 4`), HM i maraton 5
— sa 4 bi se menjali HM p01, p02 i planovi vlasnika (4 dana, bajt-isti). `pocetnik: 25` je u `minEasyBuildMin` (samo
M6) — u `minEasyMin` bi menjao 10K početnike 5–6 dana (trening od 15 min). Svojstvo `m6EasyDay.test.ts` (profili × 4/5/6
dana, sve distance): dana ≥ max(3, traženo − 1); manje kratkih laganih dana nego bez M6; dopuna ≤ cilj + 5 %; dan manje ne
gubi > 15 % obima; sa potvrdom broj dana == traženi. Trenerovo „svaki lagan dan ≥ najkraći" nije ostvarivo uz ≤ cilj
+ 5 % i ≥ traženo − 1 (mali obim, mnogo dana) — svojstvo je poređenje sa i bez M6. **Ispis:** 5K p02, p15; 10K p02; HM
p06; MAR p06 (u § (c)). 5K p06, p03, 10K p06, p03, HM p04, p12 ostaju isti (dan manje ne bi preuzeo obim). 5K p02:
2. nedelja je sad za 0,2 km najveća → oznaka „vršna" prelazi sa 5. na 2. nedelju.

**2. M4 (suženo).** (a) dugi 6–8. dana posle pripremne trke ne raste preko poslednjeg dugog pre nje (osim kad je taj u
prozoru događaja + 14 dana). Trenerov prag 75 % nije uzet: MAR s26 tada dobija nalaz „ispod cilja" jer R22 (A4) drži
dugi povratka ≤ plana pre događaja. „Juče trka" deo (≤ trajanje trke, ≤ 60 % dugog) i (b) prvi trk ≤ 40 min nisu urađeni
— menjaju nenavedene (10K s17–s20, 5K s17, HM s17, MAR s17–s19), a (b) ne menja 5K s20. (c) početnik, nedelja 2 ≤ 75 %
— broj samo u HM `safety.ts` (u 10K bi menjao s19). (d) bez `obim-za-nivo` u planu od dana posle trke (prognoza ga i
dalje računa). Svojstvo `postRace.test.ts` (R24 M4) + tvrdnje p11, s18, s19. **Ispis:** MAR p02, p11, p15 i scenariji
p11 (s03, s07, s11, s15, s19, s23, s26); HM s18 (tekst), s19 (nedelja 2 = 15 km). Dugi: p11 2 h 25 → 2 h 20 (trener: 1 h 45).

**3. M1.** `missedFromDone` (replan.ts): budući dugi ≤ najduži odrađeni (5 nedelja pre nedelje poslednjeg propuštenog) +
20 min, blok ≤ 1,5 × odrađeni iste vrste (bez odrađenog: prvi propušteni), lanac; rečenica „…: toliko nosi ono što je
odrađeno". Svojstvo `missedDone.test.ts` (E3/E7 svih distanci) + tvrdnje. **Ispis:** MAR s11 (3 h 3 → 2 h 57 / 27 min),
s12 (3 h 6 → 2 h 52 / 27), s25 (ned 7 24 km / 5,5 km, ned 9 8 km). Usklađena R22 (A2) tvrdnja `missedOne.test.ts` (M1
namerno menja „jedan propušten ne menja sledeći"; nije među proverama iz uvoda).

**4. M2 (suženo).** `painFirstFast`: bol 4–6 posle dugog, bez brzog do 7 dana posle zaštite → prag u komadu prvog termina
od 11. dana (ne ispod 12 min, R22 A3 — trener traži 10), sledeće nedelje najmanji tempo trke; ne pretvara proveru forme
(Z3), ne pravi nov skok nedelje > 20 % (R2 — zato u 10K s15 otpada tempo 2. 2.). Suženo na „posle dugog": inače se menjaju
5K s14, s16 („ne sme"), s26. Svojstvo `painFirstFast.test.ts` (E4). **Ispis:** 10K s15, 5K s15, MAR s15.

**5. M5 — neurađeno.** Skraćenje nedelje posle prekida (≤ +25 %) prepisuje kasniji prolaz u `replan` (HM s16 ostaje 41,3 →
60,8), a isto pravilo menja 15+ nenavedenih scenarija (među njima „ne sme": 10K/5K/MAR s27, HM s05). Bez rizika ne ide u
ovom krugu; vraćeno.

**6. M3.** render.ts: (a) savet sporiji od tempa očekivanog vremena → „…(S/km) — sporiji od današnje forme (F/km),
v. upozorenja.", bez „Očekivano vreme … traži"; raspon se širi do savetovanog vremena (samo tada); (b) „ne na napredak"
samo kad je očekivano == forma; (c) > 3 stavke: 3 po prvenstvu, višak u jednu „Pomoglo bi i"; (d) „poslednji kilometar".
Svojstvo `header24.test.ts`. Usklađene stare tvrdnje: `render.test.ts` K3, `round5.test.ts` R6. **Ispis:** MAR p01, p03,
p06, p07, p10, p11, p13, p19 + scenariji p07/p11; parovi P2 B (5K, 10K, HM, MAR); **van § (c): MAR P1 A, P1 B, P2 A**
(isti red zaglavlja / > 3 stavke).

**7.** (a) odrađen dan bez mere: planirana dužina i trajanje (`procena`), dan bez trčanja 0 m / 60 s; `vanPlanaV2` bez mere
nije `Run` — `buildState` bez `inputErrors`; (b) `lock` ≠ `locked`, `fingerprintLegacy` usklađen (otisak pre = posle na
svim uzorcima); (c) izvoz `painOf`, `addDays` i ostali pomoćnici datuma. Ispis plana isti. Usklađena samo tvrdnja
`integrations/v4/facts.test.ts` koja je dozvoljavala 0 m / 0 s.

**Završno.** `npx vitest run src/domain/v4 src/integrations/v4`: 85 fajlova, 1352 prolazi + 12 očekivano pada (bilo 78 /
1250 + 12). Kapije: HM 14/14, 10 km 12/12, 5 km 16/16, maraton 19/19 (0 prekršaja). `npm run check`: čist — 398 fajlova,
4828 prolazi + 12 očekivano pada; za to je formatiran `.vitest/json/output.json` (izveštaj vitesta iz commita R22, bez
keša nije prolazio prettier; u stavci 0 je bio slučajno sklonjen pre provere). Napomena: `tenk/r9b.test.ts` je jednom
pao na isteku 5 s pod punim opterećenjem (sam prolazi).

# Faza 4a — odluke organizatora (19. 10.)

Izvor: `FINAL-CHECK-HM-MAR.md` (a07490f/12b74ca). Organizator je nezavisno ponovio N1 (maraton 3 d, bol 7/8 poslednji
dan ned N − 1 → EMPTY_WEEK: 148/892 toka na svakom 7. planu `gridInputs`), N2b (`r-d5-14w-60km-v32-1`, sporiji
rezultat sreda ned 3 → plan se ne vraća) i N3 (`r-d3-9w-20km-v45-1`, bol 8 kraj ned 7: taper 7,9 km, trkačka 9,3 km).
Svaka ispravka: merenje pre/posle (pouka 15), test koji pada pre izmene, sabotaža alatom, regresija = menjaju se samo
tokovi/planovi pogođeni nalazom.

| N | odluka | segment |
|---|---|---|
| N1 | Maraton preuzima HM izuzetak `raceOnly` (trkačka nedelja samo sa trkom = upozorenje RACE_WEEK_SHORT, ne EMPTY_WEEK). HM-04 tačka 4 time je potvrđena za obe distance. Trajna mreža rane adaptacije dobija bol 7/8 na poslednji dan ned N − 1 (3–4 d). | MAR-07 |
| N2 | 5K: nađi stranu koja odstupa (pouka 23) za TEST_WEEK (lanac pauza 10 → manjak) i BASE_R_DECREASE (sporiji rezultat u bazi) i ispravi nju; trenerska dilema → STANI. Trajna mreža rane adaptacije kao HM `earlyAsOfs` (start − 6/− 3/− 1, sreda i kraj svake nedelje 1…N − 2, svih 17 scenarija + lanac). | 5K-08g |
| N3 | Pouka 30 važi i za 5K (trkačka ≤ planirano tapera, višak laganih → odmor, RACE_WEEK_SHORT). | 5K-08g |
| N4 | Pouka 29 važi i za 5K: stanje zavisno od prošlosti iz upisanih dana (`written.ts` po obrascu 10K), validator vidi isti upisani plan i u mešovitoj nedelji. | 5K-08g |
| N5 | Nova pouka 35 (MASTER): dva dana kvaliteta samo kad dugi ostaje najduži; inače drugi dan kvaliteta postaje lagan. HM i maraton (10K/5K: izmeri da li se javlja, u svom segmentu). | HM-07, MAR-07 |
| N6 | HM RP dobija pod najnižeg nivoa kao maraton MP (`marathon/v2/quality.ts` pod) — ispod najnižeg nivoa → A9 (jedan kvalitet / bez). | HM-07 |
| N7 | Pouka 34 dopunjena: doza nedelje 2 = doza planirane nedelje 1 (ponavljanje, bez rasta — maraton). HM se usklađuje. | HM-07 |
| N8 | Maraton validator čita stanje upisane mešovite nedelje kao HM (pouka 29), bez `'unknown'`. | MAR-07 |
| N9 | Jedna definicija po veličini (pouka 24) u HM i maratonu — refaktor bajt-isti, osim HM LONG_RUN_SHORT (najduži preko SVIH upisanih nedelja; 5/2928 lažnih upozorenja nestaje). | HM-07, MAR-07 |
| N10.1 | Ponavljanje doze: obe distance kao MASTER pouka 32 (upozorenje kad ni druga struktura ni sledeći nivo ne staju) — HM dodaje upozorenje. | HM-07 |
| N10.2 | RECENT_LONG_TOO_SHORT: pravilo maratona (samo kad je uzrok zaista ulaz). HM ga u adaptaciji ne daje — zapisati u DECISIONS, bez izmene ako merenje potvrdi. | HM-07 |
| N10.3 | Dugi reference (pouka 34) ulazi u L pouke 28 kao nedelja 0 (maraton). HM se usklađuje. | HM-07 |
| N10.4 | Pouka 33 je funkcija izvodljivosti, ne opseg: primenjuje se svuda gde je rasterećenje neizvodljivo. Maraton: izmeri da li postoji neizvodljivo rasterećenje van test/početnik/adaptacija; ako ne — zapisati, bez izmene. | MAR-07 |
| N10.5 | Pouka 14 (preporuka manje dana) i u maratonu. | MAR-07 |
| N10.6 | Piramida: razlika HM/maraton je svesna (maraton I 2000 m nema piramidu ≥ 3 deonice) — zapisati u DECISIONS obe distance. | HM-07, MAR-07 |
| N10.7 | Trajna rana mreža pre starta: obe distance sa istim skupom scenarija (svi primenljivi od 17). | HM-07, MAR-07 |
| N11 | MARATHON_LONG_SHORT samo kad dugi NIJE ograničen sa 150 min (inače jedna rečenica u opisu plana). HM WEEK_FITTED prikaz jednom (zbir). Napomena „Cilj po pravilu … nije izvodljiv" ne ide korisniku (ostaje tehnička). CAPACITY_LIMITED i DELOAD_LONG_SHORTENED jednom po planu. | HM-07, MAR-07 |
| N12 | Poznato/svesno (dugi ≤ 150 min, platoi, lagan = dugi u taperu, HM 3 d 25 km bez RP na kraju, 10K pouka 25 tekst) — bez izmene; 10K tekst uz sledeću 10K izmenu. | — |
| traka | Pravilo trake (pouka 20) u domenu svake distance (maraton urađen u MAR-06); HM `adaptBanner` iz `app/adapt.ts` u domen. 10K: sledeća 10K izmena. | HM-07 |
| testovi | Brz nivo maratona ≤ 60 s; CI pun nivo: deljenje (shard) — odluka posle segmenata. | MAR-07, organizator |
| umor (MAR-06 p. 2) | Nova pouka 36: umor vezan za zapise (sidro = nedelja posle poslednjeg RPE zapisa umora), isti zapisi = isti plan; skripta `fatigue-repeat.ts` (asOf kraj nedelje → sledeći dan): 5K 58/117, 10K 903/963, HM 708/777, maraton 943/990 drugo rasterećenje → cilj 0. | 5K-08g, 10K-06f, HM-07, MAR-07 |
| MAR-06 p. 1, 3 | Test 3 km samo napomena (kao HM-06) — prihvaćeno. 10K tekst prekidača „stiže uskoro" — 10K-06f. | — / 10K-06f |
| zaštićeni dani (MAR-07 p. 1) | Provere po danu preskaču zaštićene dane (≤ asOf, zaključani, urađeni) — validator ne sudi činjenicama. Organizator (`locked-result.ts`, nov rezultat + zaključan Q1 sledeće nedelje): 10K 1645/1960, HM 1677/1916, 5K 20/108 odbijeno; maraton posle MAR-07b 0/3078. | MAR-07b ✓, HM-07b, 10K-06f, 5K-08h |
| pouka 36 ponedeljak | Rasterećenje = nedelja posle nedelje zapisa (`fatigue-monday.ts`: maraton tekuća, HM/10K/5K sledeća → uskladiti). | HM-07b, 10K-06f, 5K-08h |

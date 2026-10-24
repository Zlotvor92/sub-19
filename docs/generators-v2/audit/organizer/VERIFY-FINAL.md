# Nezavisna provera posle ispravki (organizator, 23. 10. 2026)

Kod: vrh grane posle 5K-09 (5k-v2.11.1), 10K-07 (10k-v2.9.0), HM-09 (hm-v2.7.1), MAR-09 (marathon-v2.6.0) + tekst MAR
(9a2c619). Organizator je sam ponovo pokrenuo merne skripte uglova provere (izlazi u scratchpad sesije); run-all je
pokrenula svaka sesija za svoju distancu na svom konačnom kodu (5K 0, 10K 0, HM 1 poznat — edges-HM, MAR 0 nečistih).

| nalaz (AUDIT-REPORT) | skripta | pre | posle |
|---|---|---|---|
| B10 5K 3 dana oštrenje | fuzz/sharpen5k | 12/245 | 0/245 |
| B11 5K 3 d / 12 km | fuzz/qinf5k | 273/1023 | 0 |
| 5K početnik rasterećenje ned 2 | organizer/verify-c1-c7 | 72/648 | 0/648 |
| 5K napomene M2/M3 | coach-5k-10k/measure 5K | 1114 / 2221 | 0 / 0 |
| B1/B2 5K lanci | chains 5K 2000 | odbijeno 131 | 1 |
| B1 5K ponovna adaptacija | chains IDEMP | 327 | 40 |
| B9 10K vraćanje | owner/tenK-restore | nevalidno 1207, sledeće odbijeno 172 | 0, 0 (172 vraćanja odbijena porukom) |
| B1/B2 10K lanci | chains 10K 2000 | odbijeno 91 | 0; IDEMP 3 (pauza) |
| B5 HM bol + umor | owner/hm-deloadref1 1 | 19 490/19 490 | 0 |
| B6 HM rasterećenje dugog | owner/hm-deloadref 4 | 3 758 | 0 |
| B4 HM skok dugog | coach-hm-mar/measure-jump HM | 1 060 | 0 |
| B1/B2 HM lanci | chains HM 2000 | odbijeno 95 | 0; IDEMP 24 |
| HM pouka 37 dopuna | consistency/mixed-drop HM | 1 321 (≤ 10 %) | 0 |
| B7 MAR prazna trkačka | owner/mar-emptyweek-search | 224/10 976 | 0/21 952 |
| B4 MAR skok dugog | measure-jump MAR | 3 584 | 0 |
| B1/B2 MAR lanci | chains MAR 2000 | ~118 | **121 — nije urađeno (dopuna lanaca)** |
| B1 MAR ponovna adaptacija (manjak) | idemp MAR | — | **393/408 menja plan — nije urađeno** |
| MAR pouka 37 dopuna | mixed-drop MAR | 1 588 | 0 |
| B13/B14 predaja | handoffTarget testovi 5K/10K/HM | — | 35/35 |

Nije urađeno / ostaje: MAR dopuna lanaca (Z6–Z8, C3, C8) i MAR vraćanje (samo bez prilagođavanja posle verzije);
v1 tekst („u poslednje 42 dana", „hard/easy princip") — ostaje zbog testova ekvivalencije sa starim generatorom.

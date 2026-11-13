# Krug 6 V4 HM — izveštaj (ponovno planiranje R1–R6, istinitost T1–T7), 13. 11. 2026

Grana `claude/v4`. Testovi V4 + izolacija: **605 prolaze, 8 očekivano pada (`it.fails`, FORM_DRIFT), 0 pada**;
typecheck i lint čisti. Kapija: **0 prekršaja, 14/14**. `target-compare` 27 od 72 (krug 5: 27). Nalazi čuvara na 14
planova: 5 (krug 5: 6; p08@17 nestao). Novi opšti testovi `distances/hm/scenarios.test.ts` nad 24 scenarija (R1, R2,
R5) — napisani prvo i pali su (s05, s06, s07, s09, s10, s12, s14–s16, „28. 11." u s08/s12/s16/s24), pa popravljeno.
Scenariji su sada u `web/.../hm/testdata/scenarios.ts` (dele ih testovi i ispis u `docs/`).

## Motor — ponovno planiranje
| # | stanje | šta |
|---|---|---|
| R1 | urađeno | `guardMissed`: posle propuštenog treninga izmene samo u naredne 2 nedelje, nikad u poslednje 2 nedelje pred trku, ne na laganim danima; sledeći dugi zadržava prvobitnu dužinu (sadržaj izmene ostaje: bez bloka ili blok na prethodnom koraku). s09: dugi 7. 2. ostaje (bio 15 → 6 km), s10: 17. 1. ostaje, s12: 0 izmena u n14–n15 (10 → 2 izmene). Rečenica trkaču prati ishod („ostaje kako je planiran — …") |
| R2 | urađeno | `smoothExit` (pauza, bol): od kraja rampe nedelja po nedelja dugi ≤ +25 % ili +20 min, nedelja ≤ +20 % prema najvećem od nedelje događaja — ili koliko prvobitan plan ima na tom mestu; nedelja koja traži više se skraćuje (dugi do granice uz zadržan blok, lagani srazmerno, cilj nedelje prati) i prozor se produžava. Prvi dugi posle prekida ≥ 62 % poslednjeg pre njega (s05 8,5 → 11 km) |
| R3 | urađeno | kapija bloka posle prekida briše blok samo u rampi; posle rampe blok kreće od najmanjeg koraka (s06 28. 2.: 16 min u tempu trke, ne lagano) |
| R4 | urađeno | trčanje vezano za dan provere iz plana je rezultat (test); „prvi rezultat koji imam" samo kad je stvarno prvi (ostaje s04 test 28. 11.); današnji odrađen dan je „urađeno", trka na dan drugog treninga piše „trka umesto …" (s02, s03) |
| R5 | urađeno | predlog provere bira samo proveru posle danas; upozorenje sa prošlim datumom se računa iznova na kraju svakog ponovnog planiranja i bez izmena (s08, s12, s16, s24); „oporavak do X" je dan pred prvi brzi trening kad on dolazi pre kraja rampe (s17, s18, s20) |
| R6 | urađeno | deo `guardMissed`: lagani dani se ne menjaju, dugi u sužavanju ne raste (s12) |

## Istinitost
| # | stanje | šta |
|---|---|---|
| T1 | urađeno | „prognoza bolja/slabija" poredi obe strane po istim pravilima (`adjustRaceDay`); P2 B više nema lažnog pomeranja |
| T2 | urađeno | jedan broj nedelja pripreme u svim upozorenjima, najveći predlog i nikad ≤ stvarne pripreme (P2 B: 26 svuda) |
| T3 | urađeno | „ni trčanja sa sata" samo bez trčanja; inače „forma je procenjena iz N trčanja sa sata" |
| T4 | urađeno | p06: predlog obima „za sledeću pripremu" (60 km nije dostižno za 10 nedelja), bez „dodaj dan"; `dan-izostavljen` kaže „plan nedeljno ima 4", „ovaj plan ostaje na 4 dana", dodatni dan 30 min; predlog dana ≥ 30 min |
| T5 | urađeno | `napor.RP` = šablon `{duration}` iz očekivanog vremena („oko 2 h 10 min" p10, „oko 2 h" p12) |
| T6 | urađeno | `safety.peakNotBelowBase`: p08 vrh 44,3 → 45,0 km; zamenski prag menja oblik po mestu u šablonu (p04 N15 2 × 18 ≠ N17 3 × 12; p07); nedelja −2 sa jednim kvalitetom zadržava tempo trke (p05 N14) |
| T7 | delimično | P3 B: polazni dugi iz trčanja bez poda od 85 % (15,5 → 18,3 km). **Otvoreno:** p06 n1–n2 jedan kvalitet pune doze — lagani dani su na najmanjih 35 min (M5), a nedelja 1 mora biti 95–105 % sadašnjeg obima; veća doza diže obim (109 %) i kvari v1 (37,2 → 36,8 km) — vraćeno |

## Scenariji (broj izmena krug 5 → 6; najveći skok dugog / nedelje od kraja rampe do 2 nedelje posle prozora, %)
s01 1→1 · 5/4; s02 1→1 · 0/1; s03 1→1 · 5/3; s04 3→3 · 8/5; **s05 14→17 · 25/21**; **s06 11→15 · 22/17**;
**s07 11→17 · 29/22**; s08 10→10 · 0/0; **s09 2→1 · 0/0**; s10 1→1 · 37/39*; s11 2→2 · 0/0; **s12 10→2 · 41/25***;
s13 7→7 · 14/15; **s14 11→14 · 86/49***; **s15 7→9 · 27/15**; **s16 9→13 · 27/15**; s17–s24 0→0.
\* skok koji ima i prvobitan plan na istom mestu (rasterećenje → gradnja, npr. p04 dugi 70 → 131 min) — R2 ga ne
dira; svi ostali su ≤ +25 %/+20 min i ≤ +20 % prema prvobitnom odnosu (test R2). Više izmena u s05–s07, s14–s16 =
nedelje skraćene na izlasku (R2), umesto skoka.

## Otisci novih planova (p01–p12)
Promenjeni: p01, p02, p03, p04, p05, p07, p08, p09, p10 — svi zbog T6 (zamenski prag menja oblik: npr. 3 × 8 → 2 × 12,
isti rad ±1 min); p05 i N14 (tempo trke umesto intervala), p08 i vršna nedelja (44,3 → 45,0 km). Nepromenjeni: p06,
p11, p12, v1, v2. Tabela po profilu prema krugu 5: vrh, najduži dugi i % brzog rada isti (p02 najveći brz rad 25 → 24 %,
p05 18 → 19 %, zaokruživanje).

## Opšta pravila motora (za druge distance)
1. Propušten trening: nadoknada ≤ 2 nedelje, nikad u sužavanju ni na laganim danima, sledeći dugi ne kraći. 2. Izlazak
iz prozora bez skoka (+25 %/+20 min dugi, +20 % nedelja), prozor se produžava. 3. Prvi dugi posle prekida ≥ 62 %
poslednjeg. 4. Blok u ključnom dugom posle rampe se smanjuje, ne briše. 5. Odrađena provera = rezultat. 6. Tekst sa
datumom se obnavlja; „oporavak do X" ⇒ brzi posle X. 7. Jedan broj pripreme; predlog dana ≥ 30 min. 8. Vrh ≥ polazni
(podatak). 9. Zamena menja oblik po mestu u šablonu; nedelja −2 čuva tempo trke.
Novi podaci distance: `safety.peakNotBelowBase`, tekst `napor.RP` sa `{duration}`; konstante `RETURN_*`.

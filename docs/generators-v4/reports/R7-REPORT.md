# Krug 7 V4 HM — izveštaj (završni krug polumaratona), 13. 11. 2026

Grana `claude/v4`. Testovi V4 + izolacija: **614 prolaze, 12 očekivano pada (`it.fails`, FORM_DRIFT), 0 pada** (ceo `npm run check`: 4050 + 12); typecheck i lint čisti; `npm run check` zelen. Kapija:
**0 prekršaja, 14/14**. Nalazi čuvara u 27 scenarija: 1 (s05 `brz-udeo@11`; pre kruga: 13, svi `ispod-cilja` p04).
`target-compare` 24 od 72 (krug 6: 27) — pad je od Y1/Y2 (druga provera, rasterećenje 75 %), kojih ciljni planovi
nemaju; svaka stavka ima test. Z4 i Z10: testovi napisani prvo i pali su (s25–s27, smer prognoze), pa popravljeno.

## Motor (Z) — stanje i test
| # | stanje | test (`distances/hm/…`) |
|---|---|---|
| Z1 | urađeno: povratak dugog +25 %/+20 min od poslednjeg STVARNO istrčanog, i preko rasterećenja/provere | `scenarios.test` R2 |
| Z2 | urađeno: otpala provera/kvalitet → lagan ≤ 65 % dugog | `scenarios.test` Z2 |
| Z3 | urađeno: prvi rad svake zone posle bola ≤ 60 % (42 dana) | `scenarios.test` Z3 |
| Z4 | urađeno: prognoza se menja samo sa razlogom i u pravom smeru | `scenarios.test` Z4 |
| Z5 | urađeno: plan po osećaju dobija tempa iz odrađene provere, „nemam rezultat" nestaje | `scenarios.test` Z5 |
| Z6 | urađeno: „visoka" tek posle dva saglasna rezultata; prva trka u životu raspon ≥ ±2 % | `scenarios.test` Z6, `round2` R14 |
| Z7 | urađeno: „planiraj N" samo kad je N > plana i probni plan od N nedelja nema nalaz; brojevi iz probe; inače uzrok (broj dana / sadašnji obim); tolerancija 5 % za sve pragove (P2 B 14,8/15 ne okida); dodatni dan = trajanje iz probe, ≥ 30 min; predlog dana se ne ponavlja (p10) | `r7.test` Z7 (5 testova), `round4` B |
| Z8 | urađeno: traženih 5 dana (p06), lagan do 30 min uz `lagan-kratak` | `r5.test` Z8 |
| Z9 | urađeno: „vršna nedelja" = nedelja najvećeg obima | `r5.test` Z9 |
| Z10 | urađeno: s25–s27; R1/R2/R5/Z4 prolaze; rep ≤ 4 nedelje | `scenarios.test` Z10 |

## Podaci polumaratona (Y)
| # | stanje | test |
|---|---|---|
| Y1 | urađeno: ≥ 16 nedelja (redovan) provere u N−8 i N−16 (p04, p08, p10: 4 i 12); poslednja ≤ 8 nedelja i ≥ 3 nedelje pred trku. Provera u N−4 probana i odbačena: posle trke vršna nedelja gubi tempo trke (kapija: brz rad 8 %) | `r7.test` Y1 |
| Y2 | urađeno: `recovery.longFactor` 0,75, `loadFactor` 0,76, dužina rasterećenja iz faktora (dugi 70–75 % prethodnog, nedelja ≤ 85 %); talas 0,85 u N−6/N−7 i na plafonu (p04 ned 14: 1 h 50 umesto 2 h 10) | `r7.test` Y2 (2) |
| Y3 | delimično: P3 A dugi raste od 3. nedelje (105 → 108 → 115 → 121 → 125 min; `longGrowPastStart` + `povratnik`, pod raste pola koraka i kad polazni nije na plafonu). **Otvoreno:** P2 B ned 1 → 2 (35 → 65 min: ned 1 je rampa posle testa, ned 2 se vraća na istoriju 10 km — treba pravilo izlaska iz početne rampe, kao R2); P1 A lagani ≥ 7 km (dva kvaliteta + dugi 16,5 km pojedu 41,5 km; treba pod laganog dana iz istorije); p06 dva kvaliteta od ned 3 (5 dana × ≥ 30 min ne ostavlja obim; pokušaj u krugu 7 kvario n3/n7 i vrh) | `r7.test` Y3 P3 A |
| Y4 | urađeno: „2.." (datum nosi svoju tačku), „ne nadoknađuje se produžavanjem", bez „plan ostaje isti" (s11, s12), nedelja se poredi istim tempima (s04 bez izmene 14. nedelje) | `scenarios.test` Y4 (3) |

p06 je vraćen u `FORM_DRIFT` (1 s sporije posle „ništa se nije desilo"; uzrok model forme R12, posle Y2).

## (a) Opšta pravila motora (konačan spisak, ulaz za 10K)
1. Plan je čista funkcija stanja; isto stanje → isti plan; bez događaja plan se ne menja.
2. Nedelja: cilj iz šablona (% vrha), obim iz minuta, km se izvode; lagani dani pune razliku, dugi ≤ udeo nedelje.
3. Dugi: od polaznog (iz trčanja) ili poda; raste ≤ korak/ned; talas na plafonu; rasterećenje = faktor × prethodni.
4. Kvalitet: doza = % plafona zone, budžet brzog rada po nedelji, prvi rad zone ≤ prag ulaza; silazak u sužavanju.
5. Traženi dani se poštuju; kad obim ne nosi najmanji lagan dan → do `minEasyFallbackMin` uz upozorenje.
6. Propušten trening: nadoknada ≤ 2 nedelje, nikad u sužavanju ni na laganim danima, sledeći dugi ne kraći.
7. Prekid (pauza, bol, bolest): rampa, pa izlazak +25 %/+20 min dugi i +20 % nedelja od poslednjeg STVARNOG; prozor
   se produžava, rep ≤ 4 nedelje; prvi dugi ≥ 62 % poslednjeg; posle bola prvi rad zone ≤ 60 %.
8. Otpala provera/kvalitet → lagan ≤ 65 % dugog. Odrađena provera = rezultat; plan po osećaju dobija tempa.
9. Prognoza: menja se samo uz razlog i u pravom smeru; „visoka" tek uz dva saglasna rezultata; prva trka ≥ ±2 %.
10. Upozorenja: problem → značenje → predlog sa brojem iz plana ili probnog plana (+1 dan, +N nedelja); tolerancija
    5 %; „planiraj N" samo kad proba menja nalaz, inače uzrok; jedan broj pripreme; ništa se ne odbija.
11. Tekst: datumi u budućnosti se obnavljaju; „vršna" = najveći obim; promene se porede istim tempima.

## (b) Polja koja folder distance mora da da
- `distanceM`, `templates` (nedelje kao namera: faza, vrsta, % vrha, `long.lenPct/stimulus/dose/wave`, podražaji
  sa `dosePct`, `recovery.{loadFactor,longFactor,doseFactor}`, `min/maxWeeks`, `min/maxRunDays`, `levels`) — sa
  pravilima položaja: provere (N−8, N−16 za ≥ 16 ned), rasterećenja, rep.
- `library` (unosi po oznakama: vrsta, zona, oblik, `test` sa `all-out` distancom, tekst sa `{pace}`/`{duration}`).
- `levels` (izbor nivoa: staž, pauza, VDOT, obim) i `safety`: rampe, plafoni zona, `minEasy*`, `minEasyFallbackMin`,
  udeo dugog, korak dugog, `longStart*`, `longGrowPastStart`, `peakNotBelowBase`, taper (`weekMinus2MaxOfPeak`,
  `raceWeekMaxOfPeak`), brz rad (`maxFastSharePeak`), bol/povratak, `intervalPaceFloor`.
- `adequate`: `minWeeks`, `minPeakWeeklyKm(+ByLevel)`, `minRunDays`, `minLongKm`, `longCheckKm/minLongSec/
  longCheckMinWeeks`, `minTenureWeeks`, `shorter` (kraća distanca za predlog).
- tekstovi distance (`napor.*`, nazivi faza), profili (`testdata/profiles.ts`, 12 + vlasnik), scenariji
  (`testdata/scenarios.ts`, E1–E7 nad 4 profila), kapija (`testdata/gate.ts`, provere 1–14 sa brojevima distance),
  otisci (`__fixtures__/*.otisak.txt`), ciljni planovi trenera za `target-compare`.

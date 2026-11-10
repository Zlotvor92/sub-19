# P8-10K — STOP (odluke organizatora), 10. 11. 2026 (dopuna posle `briefs/P8-dopuna-po-glavnom-treneru.md`)

Rad nije stao: ugrađen je doslovan G1/G2/G3 (10k-v2.13.0); ovde su tačke koje traže odluku. Brojevi: mreža početnika B
(3402 plana, `beginnerGridInputs`), komande u `P8-10K/` (iz `web/`). Izveštaj: `P8-10K-REPORT.md`.

## S1 — G2 × „dugi rasterećenja ≥ 4 km" (početnik, mali obim)

Sa G2 rasterećenje početnika od ≈ 13 km (3 dana / 15 km; 4 dana / 18 km) dobija T 1,5 km (ranije bez kvaliteta jer
1,5 km > 10 % cilja). Dan kvaliteta (WU 15 + T 1,5 + CD 10 min ≈ 6,0 km) i lagani ≥ 3 km ostavljaju dugi 3,9 km.
Regresioni test 81bd351 („dugi rasterećenja < 4 km" 0 / 0) pada: **6 / 14 planova (3 / 4 dana), 60 nedelja**
(`beginnerGrid.node.test.ts`, stat `deloadLongBelow4`). Odbijanja 0; validator bez greške (T1_DELOAD — dugi skraćen da
lagani ostanu ≥ 3 km). Dan kvaliteta (6,0 km) je duži od dugog (3,9 km) u tim nedeljama (pouka 35 važi samo za izgradnju).

| opcija | šta | posledica |
|---|---|---|
| O1 (ugrađeno, privremeno) | G2 doslovno i u rasterećenju | 20 planova / 60 nedelja: dugi 3,9 km < dan kvaliteta 6,0 km |
| O2 | rasterećenje početnika bez kvaliteta kad bi sa kvalitetom dugi pao ispod 4 km (stanje pre P8 za te nedelje) | 0 takvih nedelja; tih 60 rasterećenja ostaje bez kvaliteta (zamerka 4 ostaje za njih) |
| O3 | rasterećenje sa kvalitetom, dugi ≥ 4 km, jedan lagan dan odmor (planirano < cilj) | nov izuzetak D5; treba merenje |

Preporuka (mišljenje): O2 — rasterećenje je jedina nedelja gde je kvalitet opcion, a dugi 3,9 km je degenerisan.

## S2 — dugi početnika (10K b): najduži 8,7 km pred trku od 10 km

Izmereno (`P8-10K/beginnerLong.ts`): 1134 / 3402 plana početnika imaju najduži dugi < 10 km; u svih 1134 granica je
**udeo dugog D17** (3 dana 45 %, 4 dana 33 %) na vrhu obima 1,3 × start (D28): 3 d / 15 km → vrh 19,5 km → 8,7 km;
4 d / 18 km → 23,4 → 7,7 km; 4 d / 22 km → 28,6 → 9,4 km. Vremenska granica (90 min sporim E) u svih 1134 dopušta ≥ 10 km.

Najmanja izmena (nije ugrađena — sudar): udeo dugog početnika 3 d 0,45 → 0,52, 4 d 0,33 → 0,43 (privremeni zahvat
`BEG_SHARE`, vraćen). Rezultat: dugi < 10 km 1134 → 0, odbijanja 0, ali nedelje sa laganim danom kao odmor **150 →
1530** (lagani ne staju posle dužeg dugog), najveći udeo dugog u planiranom 0,56 → 0,63, WEEK_FITTED 9126 → 9438.

| opcija | šta |
|---|---|
| B0 (stanje) | bez izmene; zamerka ostaje, upozorenje nema |
| B1 | udeo dugog početnika kao gore — sudar sa laganim danima (10 × više nedelja sa odmorom umesto laganog) |
| B2 | izuzetak samo za najduži dugi specifične faze: dugi ≥ min(10 km, 90 min) kad lagani ostaju ≥ 3 km; inače napomena — nov mehanizam, treba merenje |

## S3 — T početnika 1,5 km kroz bazu i razvoj (zamerka 4, p11)

G2 ne menja dozu iznad prvog nivoa: kod 15–19,5 km 10 % nedelje = 1,5–1,95 km, pa sledeći nivo (2,0 km) ne staje
9 nedelja (p11: T 1,5 km u ned 3–11, uz napomenu „kao prošli put"). Rešenje bi bila veća udeona granica T za mali obim
ili minimum doze po nivou (preporuka ocene: T 2 × 8–10 min) — to je nova trenerska odluka, nije G2.

## S4 — pouka 35 i % brzih km (prijava, nije sudar)

Pouka 35 (drugi dan kvaliteta lagan da ne bude duži od dugog) brz uzorak 474 → 546 nedelja (G1 sporiji rast dugog);
postojeće tumačenje rešava. Nedelje > 30 % brzih km: v. izveštaj (prag STOP-a 5 % planova grupe nije pređen).

## S5 — G5 taper „≤ 60 % najvećeg rada zone" × G2 „najniži nivo staje" (dopuna)

Taper već bira ≈ 60 % POSLEDNJE doze (≤ 60 % najveće); prelazi 60 % najvećeg samo kad je najniži nivo (RP 2 × 1000 m,
T 2,0 km; početnik T 1,5 km) veći od 60 % najvećeg. P0 + P7 (`P8-10K/minutes.ts`): **81 / 204 tapera** iznad 60 %
najvećeg rada zone. Opcije: T1 (stanje) G2 ispred G5 u taperu; T2 G5 ispred G2 — taper bez te zone kad ni najmanji
nivo nije ≤ 60 % (vraća „taper bez trkačkog tempa" kod malog obima, protiv G2); T3 manji najniži nivo tapera (npr. RP
2 × 600 m) — nova lestvica. Nije menjano.

## S6 — G5 rasterećenje „≤ 60 % poslednje doze, bez izuzetka" × D5 „najmanje 2,0 km" (dopuna)

Rasterećenje danas: T ≈ 60 % poslednje T doze, najmanje 2,0 km (početnik 1,5 km). Iznad 60 % poslednje doze iste
zone: **183 / 486 rasterećenja** (P0 + P7). Strogo G5 = ta rasterećenja bez kvaliteta (zamerka ocene 4: „rasterećenja
bez kvaliteta"), ali rešava S1 (dugi 3,9 km). Opcije: R1 (stanje) min 2,0 / 1,5 km ostaje; R2 strogo G5 (bez
kvaliteta kad nijedan nivo nije ≤ 60 %); R3 R2 samo za početnika (rešava S1, ostali kao danas). Nije menjano.

## S7 — G1a satni plafon: plan bez rasta (dopuna, prijava)

Kad je start ≥ satni plafon, vrh = start (doslovno po dopuni): P7 p04 (VDOT 35, 50 km, 5 dana, 18 ned) — 6 h ×
3600 / srednji lagan tempo ≈ 50 km → 15 nedelja izgradnje na 50,0 km, dugi 14,0 km svih 12 nedelja (plato koji je
ocena već zamerila). P0: niži vrh u 82 / 192 planova, > 10 % niži u 10. Pitanje: da li je ravan plan od 18 nedelja
prihvatljiv ili satni plafon tada skraćuje pripremu / smanjuje broj dana — odluka trenera.

## S8 — jedno novo odbijanje u adaptaciji (otvoreno)

`f1Text.node.test.ts` (adaptacija baznih planova × scenariji): tok `d5-r-14w/w6wed/over120` odbijen — `DELOAD_CONTENT:
Rasterećenje: 1 kvalitet T 2400 m (≈ 60 % od 4800 m) (D5)` (validator i konstruktor se ne slažu o T dozi
rasterećenja posle A6 viška; verovatno G4 minuti menjaju poslednju T dozu različito u prošlosti i budućnosti). Generator
bez odbijanja na 34 350 planova (01/02/F/B/P0/P7). Nije rešeno u ovom segmentu.

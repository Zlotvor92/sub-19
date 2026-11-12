# D — podaci polumaratona, krug 2 (R15–R20) i krug 3 (ciljni planovi trenera): izveštaj (12. 11. 2026)

Kod: `web/src/domain/v4/distances/hm/` (motor, forma, adapteri nedirnuti). Kapija: `gate.test.ts` + `testdata/gate.ts`
(iste mere: `node docs/generators-v4/plans/gate.ts`). Ispisi `plans/HM/`: p01–p12, vlasnik-v1/v2, `scenarios/` (PRE pa
POSLE, na vrhu STANJE i DOGAĐAJ), NOVO `pairs/p1a–p3b` (`pairs.ts`). V4 + izolacija: 545 + 5 „čeka formu", zeleno.

## Šta je promenjeno u podacima
- **Brojevi (R15):** `maxPeakOverBase` 1,5 (BO; u km 1,16–1,35 ×, nijedan > 1,40); startPct ≤ 1/1,5 (prve nedelje ne
  padaju ispod sadašnjeg obima); `easyMaxShareOfLong` 4+ dana 0,63, 1–3 dana 0,68; `longShareByRunDays` 3/4/5/6 dana
  0,48/0,38/0,34/0,31 (i početnik); `longStartShare` 3 → 0,46, 4 → 0,33, 5 → 0,32; brz `peakLoadCap` 520 → 560.
- **Šabloni po TAČNOM broju dana (1–7)** — da provera forme padne subotom (motor ređa dane po razmaku od dugog).
  Nivo `mali` samo ispod VDOT 52 (p06 je sada `brz` sa 2 kvaliteta i dobija `obim-za-nivo`, `minPeakWeeklyKmByLevel.brz` 60).
- **Doze (R16):** prag do 30 min / 10 % vrha, tempo trke usred nedelje 13,5 % vrha (do 55 min), intervali do 25 min
  (i-1000 do 7, i-800 do 8 komada); rep: N−7 prag 0,75 + blok, N−6 tempo trke 0,6 (≥ prag), N−5 tempo trke 0,6 + blok,
  N−3 tempo trke 0,45 (jedan kvalitet: prag 0,6), N−2 0,77 vrha bez praga; brz nivo × 1,12 tempa trke.
  Raznovrsnost: jedan kvalitet nedeljno (1–3 dana, mali obim) smenjuje prag ↔ brda/brzina (osnova) i intervali ↔ prag (razvoj).
- **Provera forme (R17):** N−8 rasterećenje, test SUBOTOM umesto dugog (4+ dana; 3 dana četvrtak, dugi ostaje);
  pripremna trka 10 km od ≈ 35 km nedeljno (`minBaseLoad` 200), 5 km od 25 km, ispod toga 3 km; rani test po osećaju
  3 km (ista distanca kao upozorenje motora `nema-podataka`), 2. nedelja subotom (4. kad je rasterećenje u 3.).
- **Tekstovi (R19, R6):** gel na dugom i na trci „od 40. min na svakih 30–40 min"; taktika trke `{paceFrom}–{paceTo}`/
  `{pace}` + `byFeelText` bez s/km; napor bez zagrade u zagradi; lestvica intervala tek od 15 min rada.

## Kapija po profilu (km; `docs/generators-v4/plans/gate.ts`)
| profil | polazno | vrh (×) | najveći skok | lagan/dugi | dugi/ned. | treninga (dana) | najduži dugi | ned. trke lagan | ned. 1 | kapija |
|---|---|---|---|---|---|---|---|---|---|---|
| p01 | 40 | 50,2 (1,26) | 6 % | 63 % | 39 % | 4–4 (4) | 19,0 | 44 min | 99 % | prolazi |
| p02 | 40 | 50,4 (1,26) | 6 % | 63 % | 38 % | 4–4 (4) | 19,0 | 41 min | 102 % | prolazi |
| p03 | 25 | 33,7 (1,35) | 8 % | 68 % | 50 % | 3–3 (3) | 16,3 | 35 min | 98 % | prolazi |
| p04 | 55 | 65,0 (1,18) | 6 % | 62 % | 32 % | 5–5 (5) | 20,2 | 50 min | 99 % | prolazi |
| p05 | 90 | 104,1 (1,16) | 6 % | 63 % | 27 % | 6–6 (6) | 26,5 | 49 min | 102 % | prolazi |
| p06 | 35 | 42,8 (1,22) | 3 % | 60 % | 33 % | 5–5 (5) | 14,0 | 27 min | 113 % | prolazi |
| p07 | 55 | 71,3 (1,30) | 8 % | 57 % | 33 % | 5–5 (5) | 23,0 | 43 min | 103 % | prolazi |
| p08 | 45 | 49,0 (1,09) | 6 % | 68 % | 48 % | 3–3 (3) | 22,5 | 37 min | 97 % | prolazi |
| p09 | 45 | 58,3 (1,30) | 6 % | 63 % | 39 % | 4–4 (4) | 22,0 | 44 min | 98 % | prolazi |
| p10 | 25 | 33,4 (1,34) | 7 % | 68 % | 49 % | 3–3 (3) | 16,2 | 35 min | 103 % | prolazi |
| p11 | 20 | 27,0 (1,35) | 8 % | 68 %* | 39 % | 4–4 (4) | 10,1 | 25 min | 101 % | prolazi |
| p12 | 45 | 58,5 (1,30) | 8 % | 60 % | 35 % | 5–5 (5) | 19,8 | 45 min | 100 % | prolazi |
| vlasnik-v1 | 30 | 36,0 (1,20) | 8 % | 64 % | 38 % | 4–4 (4) | 13,5 | 32 min | 103 % | prolazi |
| vlasnik-v2 | 30 | 38,8 (1,29) | 8 %** | 64 % | 38 % | 4–4 (4) | 14,0 | 32 min | 80 %** | prolazi |

\* lagan dan na podu 25 min + ubrzanja (4,3 km) uz dugi 6,3 km u rasterećenju — u granici samo uz dozvolu
zaokruživanja 0,25 km; \*\* nedelje 1–3 seku rampu posle trke 13. 12. (izuzete samo iz broja treninga i udela dugog;
skok posle rampe meren prema obimu pre trke, R9). Scenario „ništa" do kraja 6. nedelje: zaglavlje posle ponovnog
planiranja isto u 14/14; živa procena (`state.form`) je 1–2 s sporija kod p01, p02, p03, p09, vlasnik-v1 → ti slučajevi
su `it.fails` („ČEKA FORMU"), granica nije labavljena.
## Zamerke sudija → stanje (✔ rešeno, ◐ delimično, ✘ nije; vlasnik)
| zamerka (izvor) | stanje | gde / zašto |
|---|---|---|
| T1 lagani 14–17 km, skok 14–20 %, vrh × 1,5 (p01, p09, p03, p04) | ✔ | gate: lagan ≤ 63 % (3 dana 68 %), skok ≤ 8 %, vrh ≤ 1,35; p01 n9 40,7 km, lagani ≤ 10,5 km |
| T2 nedelja trke 90 min utorkom (p03, p10, p08, p09, p01) | ✔ | gate: najduži lagan dan 25–50 min, ≤ isti dan nedelju ranije (motor R1 + podaci) |
| T3 osnova ispod sadašnjeg obima, lagani 35 min (p05, p04, p12, p02) | ✔ | ned 1 97–113 %; p05 lagani 10–16 km (bez 7,5 ↔ 15); p04 n2–3 ≥ 52 km |
| T4 / J § 5.5 prognoza pada bez događaja | ◐ forma | zaglavlje isto; živa procena 1–2 s (gate.test „ČEKA FORMU") |
| T5 propušten ključni trening bez reči (s09, s11, s12) | ✔ motor | s09/s12 PROMENE: rečenica + blok na prethodnom koraku / dugi od odrađenog |
| T6 bol 4–6 (s13–s16) | ✔ motor | s13: 2 dana odmora, uslov, lekar, dugi ≤ 75 % |
| T7 bolest: test se briše, tekst ≠ plan (s05, s07, s08) | ◐ motor | s07 test ostaje (23. 1.); s05 test 26. 12. ostaje u nedelji koju tekst zove „do 27. 12. lagano" |
| T8 test po osećaju 1. utorka, 5 km (p09, p10, p12) | ✔ | p09/p12 2. nedelja subota, 3 km; p10 (3 dana) četvrtak 2. nedelje |
| T8 provera „trka ili test" utorkom; pripremna trka 10 km vikendom | ✔ | N−8 subota (p01 26. 12. „pripremna trka ili test na 10 km"); 3 dana četvrtak ◐ |
| T8 p11 rasterećenje sa dužim dugim | ✔ | p11 n4 dugi 6,3 < n3 8,5 km |
| T8 3 dana: blok do 7,5 km; srednji dan 77–81 % | ✔ | p08 blok 2 → 7,5 km; srednji dan ≤ 68 % |
| T8 tempo uz uspone; dvostruko „nedelja trke" | ✔ motor | R10 |
| T „izgubljeno prema v3": plafon laganog i vrha, kratka nedelja trke, ned 1 ≥ 95 % | ✔ | kapija |
| T pripremna trka 10 km vikendom | ✔ | p01, p02, p04, p05, p08, p09, p12 (test R17) |
| T zaglavlje p06/p07 (upozorenja) | ◐ | p06 `obim-za-nivo` + `kratak-dugi`; p07 bez upozorenja (10 ned. = `minWeeks`) |
| T vlasnik-v1: prag 25–28 min, RP 2 × 3 km, blok 4 → 6 km | ◐ | prag do 18 min (3 × 6), RP do 4 km, blok 2,5 → 5,5 km — 10 nedelja i mali obim ne stignu lestvicom |
| T/J vlasnik-v2: 3 trčanja, dugi 50–56 %, samo prag, mali blok | ◐ | 4 treninga u svim nedeljama gradnje, dugi ≤ 38 %, intervali n7–9 i brzina n3; blok do 5,5 km; vrh 38,8 km (plafon 1,40) |
| J P01 cilj 4:44 ≠ tempo 4:50; taktika | ✔ motor+tekst | zaglavlje R6; dan trke „4:49–4:54/km, … 4:44/km" |
| J P01 9/11/13. ned nestaje utorak, sub 12,5 km pred dugi | ✔ | p01: 4 treninga svake nedelje gradnje, lagan ≤ 10,5 km |
| J P02 dugi 23–24,5 km (45 %); sub 4,5 + ned 20,5 | ✔ | najduži 19 km, dugi ≤ 38 %, lagani ≥ 7,5 km |
| J P02/P09 „koliki obim plan pretpostavlja" | ✔ motor | „Polazim od tvojih ≈ 40 km" |
| J P03/P10 95 min dva puta nedeljno; gel na 75. min | ✔ | utorak ≤ 68 % dugog; gel „na svakih 30–40 min" |
| J P03/P08/P10 upozorenje „uz 4 dana dugi do X" < plana | ✔ motor | p08 „dugi ostaje 22,5 km", p03 „vrh 34,4 km" (> 33,7) |
| J P04 ned–pon–uto 100+ min zaredom; 1. ned najveća | ◐ | pon/uto 75 min posle dugog 2 h 05 (dani bira trkač); ned 1–3 ≈ 52–55 km |
| J P05 RP sredinom nedelje 12–15 km, intervali 5 × 1 km | ◐ | RP do 2 × 5 km / 3 × 3,5 km (10–10,5 km), intervali 6 × 1 km, 8 × 800 m; 12+ km prelazi 20 % brzog |
| J P05 prag ≈ tempo trke bez objašnjenja | ✘ ispis | 3:40 vs 3:42 — rečenica bi bila tekst zaglavlja motora |
| J P06 lagano 5 km, 4 od 5 dana, bez intervala i upozorenja | ◐ | 5 dana svuda, intervali, `obim-za-nivo` sa predlogom 60 km; lagani i dalje 5,5–6 km (35 km/5 dana) |
| J P07 skok 60 → 67,5; tempo = forma | ✔ | skok ≤ 8 % |
| J P08 11 istih nedelja praga; RP < prag; uto 16,5 + dugi | ✔ | prag ↔ brzina ↔ intervali; test R16 (RP ≥ prethodni prag); srednji dan ≤ 68 % |
| J P09 +70 % obima, test 3 vs 5 km, zagrada u zagradi | ✔ | vrh 1,30; test 3 km = upozorenje; napor bez zagrada |
| J P09/P12 taktika trke u s/km po osećaju | ✔ | `byFeelText` (test R19) |
| J P11 lagani 30 min dok dugi raste do 52 % | ✔ | dugi ≤ 39 %; ◐ cena: najduži dugi 10,1 km (upozorenje `kratak-dugi`) |
| J P12 test 2. dana, 38,6 → 58,6 km | ✔ | test 2. nedelja subota 3 km; vrh 1,30 × |
| J S01 prošle nedelje prepisane novim tempom; „test 5 km" posle 10 km | ✔ motor | R10 „urađeno …" |
| J S05/S07/S17/S19 (rampa, povratak, 3 trčanja, „visoka" pouzdanost) | ◐ motor/forma | s19 sada 4 treninga nedeljno; pouzdanost/korekcija R14 nisam proveravao red po red |
| J S21 prognoza pada | ◐ forma | v. T4 |
| J § 6 „intervali lestvica 2,4 km" | ✔ | lestvica tek od 15 min rada |
| J § 6 dan posle trke | ✔ motor | „Posle trke: 15 dana bez brzih …" |
| Parovi P1–P3 (deo C) | ◐ motor | P1 B: ned 1 34,5 km, vrh 44,4 (A 55,4), dugi od 13 km, širi raspon ✔; P1 B kvalitet od 1. nedelje ✘; P2 B niži (vrh 23,4 vs 27,0) ✔, 2:1 i hod-trk ✘; P3 A = B osim prognoze ✘ — podaci ne vide istoriju |

Ukupno 39 stavki: ✔ 27, ◐ 11, ✘ 1. Delimično i nerešeno je pretežno van podataka (motor, forma, ispis).

## Pomerene granice testova (šta, sa → na, zašto)
1. `hm.test` K7 „prvi trening ≤ 70 % vrha": po STIMULUSU → po ZONI (rubrika kaže „zona"; tempo trke = i blok u dugom
   i progresivni dugi); izuzetak i za zonu sa jednim treningom (p12: jedni intervali). Razlog: R16 traži da tempo trke
   usred nedelje bude ≥ prethodnog praga, pa ne može biti ≤ 70 % svog vrha ako se meri sam.
2. K7 skok nedelje: × 1,12 + 1,5 km → × 1,10 + 0,25 km po treningu (POOŠTRENO, kao kapija).
3. Udeo dugog u najtežoj nedelji: gornja 45 % / početnik 52 % → 42 % za sve (POOŠTRENO; minute, kapija meri km ≤ 40 %).
4. Mreža, brz udeo zbog obima: do 27 % / 35 % → 25 % / 30 % (POOŠTRENO); nedelja sa proverom forme je opravdana bez
   obzira na udeo (sa 4+ dana test zamenjuje dugi; K6 test je ionako ne meri).
5. Mreža: „ispod cilja" opravdano kad plan nosi `obim-za-nivo` (brz trkač malog obima: brzi trening zamenjen laganim).
6. (K7 + 60 s ostaje; + 30 s obara p02/p03 zbog celih minuta 3 × 3 min.) Najteža → sledeća nedelja: ≤ 86 % → ≤ max(86 % najteže, 1,12 × baza) — R5 (pod nedelje gradnje = sadašnji obim +
   kvalitet) kod p05 i p08 (vrh blizu sadašnjeg obima).
Novo: `gate.test.ts` (kapija, 28 slučajeva), R16 (RP ≥ prethodni prag − 90 s; intervali i brda u 12+ ned; < 5 istih
nedelja zaredom), R17 (test ≥ 2. nedelja, subotom kad je subota dan trčanja, rani test 3 km = upozorenje; 10 km kod
7 profila), R19 (gel isto, trka po osećaju bez s/km, lestvica ≥ 15 min).

## Zahtevi prema motoru i formi
1. **Forma (R12):** živa procena posle 6 nedelja po planu 1–2 s sporija (p01, p02, p03, p09, vlasnik-v1); zaglavlje
   posle `replan` je isto. Test: `gate.test.ts` → `FORM_DRIFT`. Posle 0a270c1 sveži plan u zaglavlju piše „Nedelja
   1. 11. – 1. 11. odrađena je oko 0 % planiranog opterećenja … 1 sekundu sporije" (dan pre početka plana se broji).
2. **Motor, upozorenje `nema-podataka`:** distanca testa je zakucana („test od 3 km") — neka je čita iz podataka
   (R17 traži 5 km za ≥ 25 km nedeljno); zato je rani test sada 3 km za sve.
3. **Motor, rasterećenje = kopija prethodne nedelje** (`toRecovery`): kopira i rani test po osećaju; podaci to sada
   zaobilaze izborom nedelje testa. Predlog: rasterećenje ne kopira mesta `onlyByFeel` i `kind: 'test'`.
4. **Motor, R9 (s05):** provera 26. 12. ostaje, a tekst kaže „do 27. 12. treninzi kraći i lagani".
5. **Motor, istorija → doze (parovi P1 B, P3 A/B):** povratnik i trkač bez kvaliteta dobijaju T od 1. nedelje; doze i
   dan prvog praga ne zavise od istorije. Podaci to ne mogu (šablon ne vidi istoriju).
6. **Motor, R5 i sužavanje:** pod `B + dodatno` drži nedelju dve pred trku na ≈ 88–94 % najteže kad je vrh ≤ 1,25 B
   (p05, p08); podaci su skinuli blok/prag u N−2 da bi stalo.
7. Forma: test sa dana plana zabeležen kao jedno trčanje SA zagrevanjem čita se kao trka na celu dužinu (moja skripta
   scenarija: s09 ubrzanje 1:51; ispravljeno u skripti). Predlog: za `effort` sa dana plana uzimati deo rada/`laps`.

---
## Krug 3 (ciljni planovi trenera su META; poruka organizatora 12. 11.)
Šabloni su sada CEO niz nedelja (rep dužine N, bez tela) po ciljnim planovima `docs/generators-v2/perfection/target/HM/`:
redovan = p01/p04 (utorak R/brda → I → tempo trke, četvrtak prag; nedelja sa blokom: četvrtak lagan; pripremna trka
subotom u rasterećenju najbližem 8. nedelji, najkasnije N−8; rep N−7…N kao p01 ili p04), početnik = p11/p12 (jedan
kvalitet u četvrtak, uvod bez praga, pripremna trka N−8, tempo trke i blok 3 → 5 km). Dva kvaliteta od 4 dana na gore i
kod 25–40 km (povučena odluka „jedan kvalitet + ubrzanja"); vrh u km × 1,35 kod 14+ nedelja (kraće srazmerno), nijedan
> 1,40. Novo: nivo `povratnik` (`maxWeeksSincePause: 8`), rani test 5 km (3 km za početnika i < 25 km — motor čita
distancu iz plana). Brojevi: dugi 4 dana 0,385 minuta nedelje (mali obim 0,37), spor dugi do 2 h 30, brz 2 h 10;
prag 10 % vrha do 35 min, intervali 7 % do 22 min, tempo trke 13,5 % do 44 min, blok 12 % do 48 min; rad (motor broji
i tempo trke) ≤ 24 %, najteža 30 %. Kapija ista — prolazi 12/12 + v1 + v2 (`plans/gate.ts`).

**Poređenje sa ciljem po nedelji: `docs/generators-v4/plans/HM/target-compare.md`** (`node docs/generators-v4/plans/target.ts
--md`; km ± 8 %, dugi ± 1,5 km, blok ± 1,5 km, ista vrsta kvaliteta, doza ± 20 %). U svim tolerancijama: **p01 10/16,
p12 12/16, p04 8/20, p11 3/20** (ukupno 33/72). Najteža nedelja i sužavanje su na istom mestu kod sva 4; pripremna
trka na istom mestu kod p01, p04, p11, p12; rani test p12 u 4. nedelji kao u cilju.

**Šta ne može podatkom (tačno šta fali):**
1. **p11 cilj traži × 2,0 (20 → 40 km) i dugi 17,5 km = 44 % nedelje** — kapija dozvoljava × 1,40 i ≤ 40 %; V4 vrh 26,9 km,
   dugi 9,9 km. Sva odstupanja p11 (17 nedelja) su odatle. Odluka je organizatorova (kapija ili cilj).
2. **Plafon doze ograničava OSNOVICU lestvice, ne dozu** (`cap = min(maxWorkSec, udeo × vrh)`): p04 (vrh 540 BO) i p01
   (≈ 380 BO) dobijaju isti plafon praga 35 min, pa p04 prag kreće sa 16 umesto 23 min (ned 1–7 „doza T"). Treba
   `doza = min(maxWorkSec, pct × udeo × vrh)` ili plafon po nivou.
3. **Utorak posle subotnje pripremne trke je 3. dan** (§ 14.1): cilj p04 ned 9 ima I 3 × 1000 m — motor ga s pravom daje
   lagano; cilj krši K2 (vrsta „I" u ned 9).
4. **Nedelja posle provere i posle rasterećenja ne stiže cilj**: lagani dani su na plafonu R2b (≤ 1,25 × najduži lagan
   dan poslednje nedelje koja nije rasterećenje), pa p01 ned 8–9 ima 35/48 km umesto 42/55. Isti uzrok: udeo rada i
   udeo dugog motor računa prema CILJU nedelje, a čuvar prema urađenom (vlasnik-v2 ned 11: dugi 41 % → zato mali obim
   0,37). Predlog: plafon R2b meriti od nedelje pre rasterećenja; budžet rada i dugi od planiranog, ne od cilja.
5. **Motor broji tempo trke i blok kao brz rad**; rubrika K6 meri samo T i brže. Cilj p01 ned 13 (tempo trke 44 min +
   blok 48 min ≈ 29 %) zato traži `maxFastSharePeak` 0,30 — predlog: brojati samo T, I, R (onda 0,22 ostaje).
6. **Dva kvaliteta + lagan dan kod 4 dana, kvalitet utorkom posle dugog u nedelju i blok 10 km su izrazivi** — nije
   bilo potrebe za motorom (redosled podražaja [čet, uto]).
7. **Personalizacija:** `weeksSincePause` radi (P1 B: ned 1 35 km, vrh 45,5 km prema A 57,2 km, dugi od 13,5 km, prvi
   kvalitet u 3. nedelji, provera u 4.). **`recentQualityWeeks` ne razlikuje P3 A i B**: A trči sve 6:15–6:25 (brže od
   lagane zone) pa je „brže od laganog" 8 od 8 nedelja, kao B sa pragom. Treba uslov iz krugova/varijacije tempa
   (deonice), ne iz prosečnog tempa. P2 A/B se razlikuju samo obimom (B vrh 22,9 vs 26,9 km); 2:1 i hod-trk ne postoje.
8. Vlasnik-v1: prag do 21 min (cilj 25–28; plafon 10 % vrha = 24 min), tempo trke 2 × 2,5 / 6 km, blok 3 → 4,5 → 6 km,
   dugi 38 %; nedelja trke bez oštrenja (doza oštrenja 12 min ne stane u budžet nedelje trke od 78 BO — proveriti motor).

**Pomerene granice testova u krugu 3** (sve zbog cilja kao mete): K6 meri samo T, I, R i test (rubrika); K7 intervali
≤ 80 % vrha (cilj p01 17/22, p04 16/20); najteža → sledeća ≤ 90 % (cilj 89 %) ili pod R5 te nedelje; R16 meri tempo
trke nedelje zajedno sa blokom (cilj p01 ned 10: 29 + 29 min posle praga 33) i ne meri sužavanje; raznovrsnost (intervali)
ne važi za početnika (cilj p11/p12 nema intervale); mreža: „ispod cilja" opravdan kad su lagani dani na plafonu R2a/R2b,
„brz udeo" kad je rad ≤ dozvoljeno × CILJ nedelje (tačke 4–5). Kapija nije dirana. „Ništa" čeka formu: 6 planova (1–2 s).

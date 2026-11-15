# F4-K — kalibracija procene forme na istoriji vlasnika (13. 11. 2026)

Podaci: `fitness/fixtures/owner-strava-2026*.json`, 103 trčanja (1. 4. – 6. 11.), puls na 21. Test:
`fitness/ownerHistory.test.ts` (8 prolazi + 4 `it.fails` = nalazi, < 1 s). Model NIJE menjan (`estimate.ts`,
`constants.ts`, `engine/` netaknuti); predlozi su tabela na kraju, za posle kruga 7.
Kako je pušteno: `estimateForm(facts na dan pre rezultata, trčanja pre tog dana, cilj = dužina i datum te trke, planned = null)`,
profil prazan (staž „nepoznato"), temperatura iz Strave (extra), krugovi sa sata kao `laps` (rad = krug brži od 0,92 ×
proseka). Test 9. 8. = 3 uzastopna km 233 + 232 + 231 s → `effort: 'test'`, 3000 m, 11:36. HM = 21 097,5 m, ostale trke `km`.

## 1. Trke: stvarno / procena sa dana pre (isto sa pulsom i bez)
| datum | rezultat | stvarno | procena | greška | u rasponu | pouzdanost | VDOT procena → stvarno |
|---|---|---|---|---|---|---|---|
| 17. 5. | trka 14,14 km | 1:08:37 | 1:05:08 | −209 s (−5,1 %) | NE | niska | 45,18 → 42,53 |
| 23. 5. | trka 5,04 km | 20:47 | 22:56 | +129 s (+10,3 %) | NE | srednja | 42,85 → 48,09 |
| 9. 8. | test 3 km | 11:36 | 12:20 | +44 s (+6,3 %) | NE | srednja | 46,35 → 49,73 |
| 10. 9. | trka 4,84 km, 32,8 °C | 21:06 | 19:56 | −70 s (−5,5 %) | NE | visoka | 48,04 → 44,94 |
| 24. 9. | trka 5,12 km | 20:53 | 21:09 | +16 s (+1,3 %) | NE | visoka | 48,04 → 48,76 |
| 3. 10. | polumaraton, 22,2 °C | 1:42:09 | 1:33:53 | −496 s (−8,1 %) | NE | visoka | 48,54 → 44,02 |
Srednja apsolutna greška 6,1 %; **0 od 6 u rasponu**. Jedina dobra procena (24. 9., 1,3 %) je ista dužina kao prethodni
dokaz. Puls ne menja ništa ni na jednom datumu: nijednom nema 4 nedelje sa ≥ 2 ravnomerna lagana trčanja ≥ 25 min sa pulsom.

## 2. Nalazi
1. **Polumaraton 3. 10. se tiho odbacuje** [visoka — pročitano iz istorije]. 22,2 °C ≥ prag toplote 20 °C, pouzdanost
   visoka → rezultat „ne sme da spusti procenu", a procena 48,54 (iz 5 km) je brža → ništa se ne menja i NEMA rečenice
   (krši „svaka korekcija ima rečenicu"). Posledica: model danas misli da je vlasnik polumaratonac za 1:35, što nikad
   nije istrčao. (Ranija fikstura iz aplikacije je imala 26 °C; Strava kaže 22,2.)
2. **Prenos sa jedne dužine na drugu je glavni izvor greške** [visoka za ovog trkača, niska za uopštavanje]. VDOT iz 5 km
   (48,76) i iz polumaratona 9 dana kasnije (44,02) razlikuju se za 4,7 VDOT: ovaj trkač na ~30 km nedeljno ima
   izdržljivost slabiju od one koju Daniels–Gilbert pretpostavlja (lični Riegel eksponent 1,12 umesto ~1,06–1,07).
   Model sve dužine meša u jedan broj, pa 5 km vuče prognozu polumaratona na 1:33:53.
3. **Raspon je preuzak** [visoka]: σ = 0,5 VDOT pri visokoj pouzdanosti je ±6 s na 5 km i ±25 s na polumaratonu, a
   greške su 0,7–5,2 VDOT. Pouzdanost „visoka" posle trke druge dužine nije opravdana.
4. **Polazna procena iz laganih trčanja (70 %)** je za ovog trkača bila 45,18 naspram stvarnih 42,53 (14 km) — u istom
   smeru kao nalaz 2 (laka trčanja ~5:20/km, a trke dugih dužina slabije).
5. **Toplota je stvarna** [srednja]: 10. 9. na 32,8 °C je 3,1 VDOT (~6 %) ispod 5 km dve nedelje kasnije na 19 °C. Pravilo
   „vruće ne spušta" je ovde ispravno; pogrešan je prag (22 °C nije vrućina za polumaraton u 16:30, vlažnost 28 %).
6. **Skokovi** samo na trkama/testu (17. 5. −2,33; 23. 5. +3,50; 9. 8. +1,69; 24. 9. +0,50); između njih nijedna nedelja
   ne pomera procenu > 0,3 (proverava test). Jedan trening ne pomera ništa — ali zato što bez plana nema signala kvaliteta.
7. **Pad obima u oktobru** (5 trčanja, 40 km posle polumaratona; nedelje 0–14 km): R13 spušta postepeno −0,62, −0,09,
   −0,08, −0,05, −0,04 (ukupno −1,8 %), svaki korak sa razumljivom rečenicom („oko 64 % ranijeg obima"). Smisleno.
8. **Rečenice „planiranog opterećenja" bez plana** (`planned = null`): nedeljno „odrađena je oko 0 % planiranog
   opterećenja" — vlasnik nije imao plan u toj aplikaciji; tekst je zbunjujući (nalaz 3 u testu).
9. Nema signala kvaliteta iz Strave: intervali imaju krugove, ali bez `planned` (nema dana plana) § 7.3 nema ulaz.

## 3. Plafon napretka (§ 14.6)
Ista dužina: 5 km 23. 5. 48,09 → 24. 9. 48,76 = **+0,67 VDOT za 18 nedelja**; test 3 km 9. 8. 49,73 (kraće, viši). Obim po
mesecima: april 139 km, maj 103, jun 101, jul 165, avgust 134, septembar 130 (≈ 23–38 km nedeljno, bez trajnog rasta);
oktobar 40, novembar 14. Model („nepoznato", r 0,10, G_max 2,0, bez rasta obima f_v 0,8): G = 0,10 × 0,8 × 17 = 1,36 →
očekivano 0,65 × 1,36 = **0,88 VDOT**; sa f_v 1 (bez plana) 1,1. Stvarno 0,67 → **plafon je za ovog trkača otprilike pravi
(blago previsok bez rasta obima)**. Nije prenizak: vlasnik nije napredovao više od modela; 14,14 → 21,1 km (+1,5 VDOT) je
mešanje dužina, ne napredak. [srednja — jedan trkač, dva rezultata iste dužine]

## 4. Danas (13. 11.) i trke
| | model sada | predlog (nalazi 1–3) | ranije, iz 8 trčanja |
|---|---|---|---|
| procena danas (HM) | 47,66 → 1:35:24, visoka | 43,22 → **1:43:46**, srednja | 44,34 → 1:41:31 |
| Bokeški 13. 12. | 1:34:36 – 1:35:08 – 1:35:50 | **1:42:05 – 1:43:20 – 1:44:49** | 1:39:53 – 1:41:05 – 1:42:31 |
| Beogradski 17. 4. 2027 | 1:33:37 – 1:34:30 – 1:35:50 | **1:39:37 – 1:41:40 – 1:44:49** (uz plan i obim nazad) | — |
Predlog = polumaraton 3. 10. (44,02) × isti pad baze koji model računa (−1,8 %), σ srednja 1,0, G iz modela (0,33 / 1,6).
Obrazloženje: jedini rezultat na ciljnoj dužini je 1:42:09 pre 6 nedelja; od tada 54 % ranijeg obima. Za Bokeški je realno
oko 1:43, uz vraćen obim i dugi do 18–20 km bliže 1:42. [niska–srednja] Model sada (1:35) je pogrešan zbog nalaza 1 i 2.

## 5. Predložene izmene (posle kruga 7)
| izmena | sada | predlog | efekat na istoriji vlasnika |
|---|---|---|---|
| prenos rezultata na dužinu cilja | jedan VDOT za sve dužine | VDOT_cilj = VDOT_d − β · ln(D_cilj / d); β = 3,5 (25–40 km/ned.) ili lični β iz ≥ 2 rezultata različitih dužina u 120 dana | srednja apsolutna greška 6,1 % → **2,4 %** (5 rezultata; 3 km −0,3 %, HM +0,4 %); bez 10. 9. (32,8 °C) 1,5 % |
| prag toplote | 20 °C | 25 °C (osećaj/WBGT kad postoji) | HM 3. 10. ulazi kao dokaz |
| toplota bez rečenice | rezultat se tiho odbacuje | uvek zapis u istoriji („rezultat je verovatno slabiji od forme zbog toplote") | rečenica 3. 10. i 10. 9. |
| σ po pouzdanosti | 0,5 / 1,0 / 2,0 | 1,0 / 1,5 / 2,5 + 1,0 kad je dokaz druge dužine (\|ln(D/d)\| > 0,7) | raspon obuhvata 5 od 6 rezultata (svi osim 10. 9. vrućina) [procena, nije pušteno kroz model] |
| „visoka" pouzdanost | trka/test bilo koje dužine u 42 dana | samo dokaz dužine 0,5–2 × cilja; inače najviše srednja | HM posle 5 km: srednja |
| polazna tačka iz laganih trčanja | lagano = 70 % VO2max | 72 % | 45,18 → ~43,9 pred 17. 5. (stvarno 42,5 na 14 km) [niska] |
| R12 bez plana | nedeljne rečenice o „planiranom" | bez plana nema pripisivanja ni rečenica | nestaju nedeljne rečenice „0 % planiranog" |
β = 3,5 je dobijen na podacima istog trkača (HM posle 5 km daje 3,35, 5 km posle 14 km 5,4) — u testu je prikazan kao
uporedni prediktor, nije potvrđen van uzorka. Lični β je bolji od stalnog čim postoje 2 dužine.

## 6. Šta podaci ne mogu da kažu
- Puls: 21 trčanje, raštrkano → trend pulsa nijednom nije izračunat; tvrdnja „radi i bez pulsa" je ovde trivijalno tačna.
- Samo 1 polumaraton i 1 trka ~14 km; sve ostalo ≤ 5 km → prenos na HM se ne može potvrditi van uzorka.
- Teren i vetar trka nepoznati. Sombor 17. 5. je potvrđeno trka na 14 km (vlasnik, 13. 11.) i u tabeli je punovažan rezultat na 14,14 km.
- Nema dana plana → signal kvaliteta (§ 7.3) i R12 se ne mogu proveriti na stvarnim podacima.
- Interval 9. 8. je u podacima „3×1 km punim naporom" — uzet kao uzastopan test (krugovi nemaju pauzu); ako je bilo
  stajanja, 3 km je precenjen za ~1 VDOT.

## Posle ispravke (F4-K2, 13. 11. 2026) — `cfba8b7`
Jedna lična kriva forme po dužini, ista za procenu, plan i simulacije (`engine/vdot.ts`: `vdotAt`, `zoneVdot`,
`effortTimeSec`). VDOT_d = VDOT_cilj + β·ln(D/d), prelom na dužini poslednjeg rezultata: ka kraćem pola β (bez ličnog β),
ka dužem pun β; dužine ograničene na trke od 4 min do 5 h. β po obimu 8 nedelja (≥ 70 km 0,5; 50–70 1,5; 30–50 2,5;
< 30 3,5) ili 50/50 sa ličnim (2 dužine, odnos ≥ 2×, 12 ned., 0–5). Sidra zona po TRAJANJU napora (motor ne zna
dužine trka): R/I 20 min, T 45 min, E max(cilj, trka od 75 min); M i tempo trke = cilj. Granice: naviše ≤ ≈ 6 s/km
(I), naniže ≤ ≈ 8 s/km tempa trke samo kad je prelom na unetom rezultatu bez istorije (`capDown`). Toplota od 25 °C
(dužina 0,5–2× cilja: upola, inače donja granica; uvek rečenica); σ 1,0 / 1,5 / 2,5 (+ 1,0 kad je dokaz druge
dužine); „visoka" samo za dokaz 0,5–2× cilja i dva saglasna rezultata; lagano iz trčanja 72 %; bez plana nema R12.

| datum | rezultat | stvarno | pre (F4-K) | posle | u rasponu |
|---|---|---|---|---|---|
| 17. 5. | 14,14 km | 1:08:37 | −5,1 % | −2,7 % | ne |
| 23. 5. | 5,04 km | 20:47 | +10,3 % | +3,7 % | ne |
| 9. 8. | test 3 km | 11:36 | +6,3 % | +4,3 % | ne |
| 10. 9. | 4,84 km, 32,8 °C | 21:06 | −5,5 % | −6,0 % | ne |
| 24. 9. | 5,12 km | 20:53 | +1,3 % | +3,1 % | ne |
| 3. 10. | polumaraton | 1:42:09 | −8,1 % | **−2,2 %** | **da** |
Srednja aps. greška 6,1 % → **3,7 %**; u rasponu 1/6 (cilj ≤ 3 % i ≥ 4/6 nije dostignut — ostaje `it.fails` sa
brojevima). Greške u VDOT: 1,2 / 1,4 / 1,7 / 2,0 / 2,3 / 3,4 → da bi 4/6 upalo u raspon (± σ/2), σ bi pri srednjoj
pouzdanosti morao biti ≈ 4 VDOT (sada 1,5; ranije u poruci rečeno ≈ 3 — ispravka). Nije primenjeno.

**Vlasnik danas:** 44,02 (1:42:09), srednja. **Bokeški 13. 12.: 1:40:22 – 1:41:56 – 1:43:40.** **Beogradski
17. 4. 2027: 1:39:09 – 1:41:07 – 1:43:40.** (Iz 8 trčanja bilo 1:39:53 – 1:41:05 – 1:42:31.)

**Promene tempa u planovima (s/km, + = sporije) i očekivanog vremena:** HM p01 E +7, I/R −4, RP +6, očekivano +131 s;
p02 E +7, T +6, RP +6, +133 s; p03–p12 T 0…−6, I/R −1…−6, E i RP 0 (p06 E +2); vlasnik-v1 T/I/R −5; vlasnik-v2
−1…−2. 10 km: E +1…+8 svi, I/R −1…−6, RP 0 (p02 +6, +60 s). Granice (I/R ≤ 6 brže, RP ≤ 8 sporije) svuda važe.

**Motor (obe distance):** (1) `easyFill`: dodatak (ubrzanja) ide preko najkraćeg laganog samo kad ceo dan staje pod
plafon dana; (2) korekcija silaska obima (M7) ne spušta dugi ispod najkraćeg laganog nivoa. „Dugi < lagan" je
postojao i pre (početnik, 4 dana, 8 ned., 25 km; filter testa ≥ 32 BO/dan ga je preskakao) — nov test u
`tenk.test.ts` proverava celu mrežu bez filtera. **HM:** otisci osveženi; E1 scenariji = udeo očekivanog po krivi
(0,971 / 0,97 / 0,967); p06 skinut sa FORM_DRIFT; r7 dobio vlasnik-v1 sa 8 nedelja (predlog „planiraj N" se i dalje
proverava). **10 km:** otisci osveženi; E1 kao HM (0,97 / 0,969 / 0,966); kao `it.fails` (krug 8 motora): R8-13 rast
u km (gate p01 n13, p08 n15), R8-14 prvi trening zone prema 70 % plafona umesto planiranog vrha (p03 prag 840 > 816),
R8-15 dugi vršne nedelje (p06 23,9 % < 25 %). Ispisi u `docs/generators-v4/plans/` nisu osveženi u ovom koraku.

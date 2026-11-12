# Krug 3 — ispravke posle druge ocene HM V4 (12. 11. 2026, uveče)

Ocena kruga 2: trener Plan 74,3 (krug 1: 68,4; v3: 77,6), Prilagođavanje 79,2, Personalizacija 59,3; na ≥ 80 su 3
od 12. Drugi sudija: 71,2 (krug 1: 60,9), scenariji 78,7, parovi 4,8/10; planovi vlasnika 58,5 i 57. Izvori (čitaj
cele): `docs/generators-v4/coach/ROUND-V4-HM-02.md`, `docs/generators-v4/judge2/ROUND-V4-HM-02.md`. Presude trenera o
spornim pravilima su u njegovom fajlu („Presuda D-REPORT") i ovde su preuzete kao odluke organizatora.

## Motor (`engine/`, sme i `fitness/`) — tab M

- S1. BRZ RAD: u „brz rad" ulaze prag, intervali, brze deonice, TEMPO TRKE i BLOK u dugom (minuti); trka/test se ne
  računa. Nedelja ≤ 22 % vremena trčanja, najteža ≤ 25 % (podrazumevano; podatak može samo strože). Budžet brzog rada
  i čuvar računaju isto, od PLANIRANOG zbira nedelje. Čuvar mora da prijavi svaku nedelju preko (sada ne prijavljuje
  p08/p09). Oštrenje u nedelji trke (6–12 min rada) je izuzeto iz budžeta i uvek postoji kad šablon ima oštrenje.
- S2. LESTVICA VRHA po polaznom obimu i dužini pripreme (podatak `safety.maxPeakOverBase` postaje tabela; motor samo
  čita): polazno ≤ 25 km: × 2,0 za ≥ 18 ned, × 1,6 za 12–17, × 1,4 kraće; 25–35 km: × 1,6; ≥ 35 km: × 1,4; staž
  < 8 nedelja ili tegoba u istoriji: najviše × 1,5. Ograničenje je KORAK: nedelja ≤ + 8 % ili + 3 km (veće od ta
  dva, u minutima), dugi ≤ + 1,5 km ili + 10 min, rasterećenje svake 4. nedelje.
- S3. UDEO DUGOG: ≤ 40 % nedelje tek od 45 km nedeljno; ispod toga dugi ≤ 2 h 15 i ≤ 42 % nedelje, a ≤ 45 % u
  najviše 3 nedelje plana (`longShareByRunDays` dobija oblik po obimu ili motor prima `longSharePeakWeeks`). 3 dana
  kao do sada (≤ 50 %). Novi nalaz čuvara i upozorenje `dugi-za-distancu`: plan ≥ 16 nedelja koji ne stiže do
  dugog ≥ `adequate.minLongKm` ili `adequate.minLongSec` — i tada prognoza NE računa napredak od obima (forma: `f_v`
  = 1) i upozorenje ne sme da predstavi kratak dugi kao nužnost ako lestvica S2 dozvoljava više.
- S4. DOZA: doza mesta = min(`maxWorkSec` po nivou, `dosePct` × `shareOfPeakLoad` × vrh) — plafon ograničava dozu, ne
  osnovicu lestvice (p04: prag 22–24 min umesto 16).
- S5. LAGANI DANI: plafon R2b se meri prema poslednjoj nedelji GRADNJE (ne prema rasterećenju/nedelji provere);
  budžet rada i udeo dugog računaju se od planiranog (isto što meri čuvar).
- S6. TEMPA SE MENJAJU SAMO NA REZULTAT (trka/test) — kako zaglavlje i obećava. „Pripisani napredak" (R12) menja
  samo očekivano vreme na dan trke, nikad `paceVdot`. `form-update` iz kvaliteta ostaje (dokaz sa treninga), ali
  NE u prozoru bolesti/bola/pauze i ne u istom `replan`-u sa tim događajem.
- S7. TAKTIKA DANA TRKE: tempo iz DANAŠNJE (potvrđene) forme; druga rečenica: „Ako [provera forme / pripremna trka
  D] potvrdi očekivani napredak, ciljaj X/km." Za trkača po osećaju i za upozorenje „počni sporije" bez s/km koji
  protivreče upozorenju. Posle trke uz hodanje / prvog rezultata — bez brže taktike od rezultata.
- S8. ISTORIJA → POLAZNO: (a) „Polazim od ≈ N km" = stvarni prosek km poslednjih 4–6 nedelja kad je istorija
  merodavna (ne preračun iz bodova: P3A 55 km → pisalo 66); (b) polazni dugi ≤ najduže stvarno trčanje u 28 dana
  + korak (P3A: 14–15 km → dobio 21,1 km u 1. nedelji); (c) `recentQualityWeeks` broji samo nedelje sa krugovima
  rada, zadatim kvalitetom ili punim naporom — ne prosečan tempo; (d) trkač čiji je prosečan lagani tempo brži od
  brže granice laganog dobija upozorenje `lagano-prebrzo` (podatak za personalizaciju), ne veći plan; (e) tegoba u
  `painHistory` (12 meseci) isključuje unose `impact: 'visok'` prve 4 nedelje i daje rečenicu; staž < 8 nedelja
  (`profile.yearsRunning` / istorija) širi raspon prognoze i spušta pouzdanost.
- S9. BOLEST/PAUZA: poslednji dan pauze se ne vodi kao urađen trening; povratak: nedelje posle rampe ≤ poslednja
  puna nedelja pre pauze × 1,10 pa pravilo rasta — bez nedelja VEĆIH nego pre bolesti (s05: 23 → 32 → 50 km);
  pomerena provera forme ide najranije 10 dana posle kraja rampe i nikad kao trka 10 km punim naporom odmah posle
  rampe (ako nema mesta do sužavanja — otpada uz rečenicu); tekst „lakši nego što su bili" samo ako jeste; rep
  sitnih izmena (± 0,5 km nedeljama posle) se ne ispisuje i ne pravi — dan se menja samo ako je razlika ≥ 1 km ili
  ≥ 10 % ili se menja vrsta.
- S10. REZULTAT NA DAN TESTA: trčanje sa `effort: 'race'` uvek se usvaja celo (trka 5 km na dan planiranog testa
  3 km — s03); pravilo deonice važi samo za `test`. Tekst „plan: 1 u zaglavlju → 0 u zaglavlju" (s04) ne sme da
  izađe — svaka stavka promene je rečenica.
- S11. ISPIS: „NALAZI ČUVARA" se NE štampa u planu koji vidi trkač (ide u poseban izveštaj/zastavicu `showGuard`);
  upozorenje „4 dana, a 3 treninga" mora da navede pravi razlog; platoi: kad dugi stoji na plafonu ≥ 4 nedelje,
  zaglavlje ili napomena kaže zašto (vreme ≤ 2 h 15) — sadržaj varira podatkom.
- S12. Svako pravilo sa testom; mreža i integracioni test ostaju zeleni; `F2-REPORT` § „Krug 4 (S1–S12)" sa
  spiskom šta tab podataka mora da podesi.

## Podaci polumaratona (`distances/hm/`) — tab D (posle taba M)

- T1. Lestvica početnika i mali obim (S2, S3): p11 (20 km, 20 ned) ide ka ≈ 40 km i dugom ≥ 15 km / 1 h 50; lagani
  dani rastu zajedno sa dugim; hod-trk dugi i ritam 2:1 u biblioteci za početnika sa stažom < 8 nedelja (par P2).
- T2. Brz rad po S1: doze tako da nedelja ≤ 22 %, najteža ≤ 25 % (trenerova ispravka svog cilja p01 ned 13: tempo
  trke 26–30 min + blok 7,5–8 km).
- T3. Platoi dugog: dugi koji je na plafonu ne stoji isti 7–18 nedelja — talas (npr. 100 / 85 / 100 / 90 %) i
  smena sadržaja (lagan, progresivan, sa blokom); p04, p05, p08, P3A.
- T4. Taper i oštrenje: p06 ned 9 ima brz podražaj, ned 10 oštrenje; p11, vlasnik-v1, vlasnik-v2 imaju oštrenje u
  nedelji trke.
- T5. p06 (VDOT 58, 35 km, 5 dana, 10 ned): upozorenje `obim-za-nivo` sa predlogom, kvalitet po nivou.
- T6. Planovi vlasnika (drugi sudija: 58,5 i 57, „ne bih dao bez izmene dugog i obima"): v1 dugi do ≈ 16 km
  (42–45 % u vrhu), v2 (18 ned) dugi ≥ 18 km i vrh po lestvici (30 km → × 1,6 = 48 km); istina o tome šta se sa
  30 km može.
- T7. Kapija se MENJA po presudi trenera (ovo je odluka, ne labavljenje): vrh po tabeli S2; dugi po S3; brz rad po
  S1; plus nova provera: HM plan ≥ 16 nedelja ima dugi ≥ 15 km ili 1 h 50; ostalo isto.
- T8. Osveži otiske, 12 + 2 ispisa, 24 scenarija, parove, `target-compare`; izveštaj sa tabelom zamerki obe ocene
  kruga 2 (rešeno / delimično / nije, gde se vidi).

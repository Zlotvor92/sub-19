# R15 — krug 15 (motor), 13. 11. 2026 — stavke 2 (ostatak) do 6; stavka 7 nije

Stanje `854cc56` i ovaj izveštaj. Kapije HM, 10K, 5K i MAR su na 0. V4: 60 fajlova, 1001 test prolazi, a 23 očekivano
padaju. Lint i typecheck su čisti, a ispisi sve četiri distance odgovaraju kodu.

## Urađeno (push posle svake stavke)
- 2a `1121bb5` — lagan dan ≥ 30/45 min uz dugi ≥ 90 min, u svakoj nedelji. Pravilo ima jednog vlasnika
  (`longEasyFloor`). Kvalitet prvo dobija najkraće zagrevanje iste doze; ne skraćuje se i ne izbacuje zbog poda.
  U rampi, bolu i prozoru izmene minuti se premeštaju sa dužih laganih dana, bez promene obima.
  Rešeno: HM p01 n3/n5, s05 n12, s08, s14; MAR p06, s05, s13, s16. Ostaje HM s18 n6–n9 (35–40 min): tu kvalitet
  ima prednost, a obim ne nosi 45 min.
- 2b `5cecb92` — `returnKeepLong`: maraton posle prekida (≥ 4 ned do trke) zadržava dugi ≥ 26 km, lestvica unazad
  −20 min/ned. MAR s05/s06/s27 N−3: 25,5/22,5/22,5 → 26 km. „Poslednji pravi dugi posle puta": delimično (s27).
- 3 `04e1786` — M20/M12: drugi kvalitet dobija mesto izostavljanjem laganog dana na podu, osim kad bi nedelja pala
  ispod prethodne. Kad donji udeo dugog izbacuje kvalitet, otpada blok u dugom. Bodovi ne idu u dugi.
  5K p06 ned 1; 10K p06 ned 1–2 i 5, vrh je sada N−3 (37,6 km); MAR p06 ned 1–2. Tekstovi `dan-izostavljen` i
  `lagan-kratak` su bez protivrečnosti.
- 4 `6b7cdec` — M6/M24: u celom planu je jedan broj nedelja pripreme (MAR p06 16/18 → 18; p19 16/14 → 16).
  Dugi u `kratka-priprema` je iz probnog plana (5K p14: 5 → 12,1 km). Dodatni dan se nudi samo uz vrh +5 %, uz
  „i dalje ispod praga". `obim-za-nivo` se ne izdaje uz tegobu (MAR p16), a uz pravilo godina daje savet po
  godinama (5K p16).
- 5 `90b4a71` — M10: trka ili provera na dan dugog (`LongSlot.race`). Pripremni polumaraton MAR je na dan dugog;
  it.fails je skinut, a MAR s26 A11 sada prolazi.
- 6 `35af75c`, `854cc56`:
  - MAR E5 (`afterLongRace`): s17 ned 2 dugi 2 h 5 → 74 min, nedelja 58,8 → 43,3 km.
  - M4 kao podatak `maxConsecutiveWithHard` ({3, nivoi spor/početnik/povratnik/mali}, HM i MAR). Uz rečenicu
    `raspored-dana` sa predlogom dana; srednji/brz zadržavaju oba kvaliteta (kapija traži 2).
  - M26: lagan dan nikad duži od dugog. Mreža 4 × 800 planova: 300 → 0 nedelja.
- `tenk/`/`marathon/`: samo traženi redovi podatka, pomenuti it.fails i snimci otisaka. Namerno promenjeni otisci:
  HM p01, p04; 5K p06; 10K p06; MAR p02–p06, p08–p12, p15–p18.
## Nije urađeno
- 7 (podatak HM) — probano pa vraćeno.
  - −1 ≤ 70 % i nedelja trke ≤ 45 % (`weekMinus1MaxOfPeak`, `raceWeekMaxOfPeak` 0,45), uz M22 („vršna" = najveća
    nedelja gradnje), i za ovaj pokušaj odmor prvog laganog dana nedelje trke. Ishod: 27 testova pada; čuvar
    nalazi silazak u scenarijima HM/10K/MAR (r9); nedelja −1 HM p06 „lagan > 0,65 dugog". Uzrok je to što silazak
    ne sme da izostavi dan (A10a), a lagani dani p06 su na podu.
  - p08 ned 1 = 45 km je u sukobu sa R15 (lagan ≤ 70 % dugog uz 3 dana).
  - p08/p10 ned 15 +15 %: granica cilja prema prethodnoj nedelji ne veže ostvareni km (kvalitet i dugi).
  - p12: najveća doza tempa trke u N−2 (2 × 21 min) traži pravilo doze po nedelji −2. HM p06 „ned 6" nije dirano.
- 8 (M5, M8, M11, M13, M15, M16, M19, M25, M27) i M23 nisu započeti. Test lestvice i E5 je posao taba maratona.

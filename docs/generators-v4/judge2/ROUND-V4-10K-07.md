# Drugi sudija — 10K, runda 07

Stanje `b8ad0bb6`, ocenjeno 14. 11. 2026. Čitano: `JUDGE2-BRIEF.md` i planovi profila `plans/10K/` p02, p03, p06, p08,
p09, p10, p11, p12 (oni koji se razlikuju od `21d4b070`), svaki ceo, nedelju po nedelju. Ništa zabranjeno nije otvoreno
(ni ciljni planovi, ni ROUND/reports/LOG/briefs, ni raniji judge2, ni kod, ni parovi/scenariji/pregledi).
Izbrojano skriptom: zbir km/min po danima = „Zbir" u svih 110 nedelja; skokovi obima, udeo dugog. Ostalo je sud.

| Plan | Ulaz dozvoljava dobar plan? | q1 | q2 | q3 | q4 | q5 | q6 | q7 | Ukupno | Dod. | Dao bih? |
|---|---|---|---|---|---|---|---|---|---|---|---|
| p02 | da (20:25 na 5 km, 4 dana, 30 km, 8 ned.) | 7 | 8 | 7 | 7 | 8 | 8 | 8 | **75** | — | da |
| p03 | da, skromno (3 dana, 20 km, 12 ned.) | 7 | 8 | 6 | 7 | 8 | 8 | 8 | **73** | — | da uz izmenu |
| p06 | ne (VDOT 58 na 31 km, 8 ned.) | 6 | 8 | 5 | 6 | 8 | 7 | 6 | **65** | 6 | da uz izmenu |
| p08 | da (3 dana, ali 41 km i 18 ned.) | 7 | 8 | 8 | 6 | 8 | 5 | 8 | **73** | — | da uz izmenu |
| p09 | da (4 dana, 41 km, 12 ned., bez rezultata) | 7 | 7 | 8 | 8 | 7 | 8 | 8 | **75** | — | da |
| p10 | da, skromno (3 dana, 20 km, 18 ned., bez rezultata) | 7 | 7 | 6 | 6 | 7 | 8 | 8 | **69** | — | da uz izmenu |
| p11 | da (početnik, 15 km, 18 ned.) | 8 | 8 | 7 | 7 | 8 | 8 | 8 | **77** | — | da |
| p12 | da (početnik po osećaju, 36 km, 12 ned.) | 8 | 8 | 7 | 7 | 7 | 8 | 8 | **76** | — | da |

Najniža: p06 = 65. **Planovi < 65: nema** (p06 je tačno na 65). Ispod 75: p03, p06, p08, p10.

## Tri najveće zamerke (planovi ispod 75)

**p06 (65)**
1. Ned. 1–3: tražio 5 dana, dobio 4 — lagan dan izbačen zbog drugog brzog treninga, a plan sam kaže da fali obima.
2. Rad u tempu trke je mršav za 36:24: najviše 4 × 1 km (ned. 3 i 5), zatim 3 × 1,2 i 2 × 1,2 km; nijedna deonica
   duža od 1,2 km, intervali najviše 4 × 1 km. Dugi 9–11 km (ned. 5 samo 9 km, 44 min).
3. „Vršna" je ned. 4 — provera forme, 10 % brzog rada; od ned. 6 sužavanje (3 od 8). U tekstu 30 km, u zaglavlju 31.

**p10 (69)**
1. Ned. 10, čet: intervali 7 × 3 min posle 4 × 3 min u ned. 8 (skok 12 → 21 min teškog rada) kod sporog trkača bez
   rezultata; u ned. 14 opet 6 × 3. Doza skače i pada bez razloga.
2. Ned. 2, čet: usponi 11 × 45 s „snažno" u drugoj nedelji, i provera na 5 km punim naporom već u ned. 4 na 20 km
   nedeljno — rano i grubo za ovaj profil.
3. 18 nedelja, a obim samo 20 → 29 km, tempo trke najviše 4,8 km; „vršna" ned. 14 ima 8 % brzog rada.

**p03 (73)**
1. Tempo trke: prvi put tek ned. 7 (3 × 1 km), najviše 4 × 1 km + 11 min na kraju dugog (ned. 9). Za 59 min trke
   trkač nikad ne oseti više od 6–7 min u komadu u tempu trke.
2. Intervali 3 × 3 i 4 × 3 min (ned. 5–6) su simbolični — 9–12 min rada uz 40 min treninga; ili prava doza ili prag.
3. Dugi nosi 41–43 % svake nedelje (do 86 min), a utorak 60–65 min; četvrtak (jedini kvalitet) je najkraći trening.

**p08 (73)**
1. Prognoza i tekst: „sa 3 dana računaj na današnju formu, ne na napredak" za 18 nedelja uz 41–48 km, prag do 28 min
   i 4 × 2 km u tempu trke — po meni netačno i demotivišuće; ovaj rad nosi napredak.
2. Predlog „dodaj 4. dan od oko 70 min — nedelja stiže do 57,2 km" je +12 km odjednom; trebalo je reći da se obim
   preraspodeli (kraći utorak i dugi), ne da se doda.
3. 18 nedelja skoro iste nedelje: obim 41 → 48 km, utorak 83–86 min + četvrtak + dugi 17,5–18,7 km. Nema razvoja
   osim sadržaja četvrtka; bar 4–5 nedelja popunjava kalendar.

## Šta bih prvo promenio u generatoru
1. Doza u tempu trke za 10 km: do vrha bar 6–8 km ukupno i deonice 1,6–2 km (p08 to ima; p03, p06, p10, p11 nemaju).
2. Ne izbacivati traženi dan da bi stao drugi brzi trening (p06); kod malog obima prvo dodati lagane minute.
3. Oznaka „vršna nedelja" ne sme pasti na nedelju provere forme niti na nedelju sa 8–10 % brzog rada (p06, p10).
4. Glatka progresija intervala (bez 4 → 7 × 3 min); bez skoka kao fartlek 54 min u p11 ned. 5 (nedelja +34 %).
5. „Bez napretka" samo zbog 3 dana (p08): vezati za obim i dozu, ne za broj dana; 4. dan bez skoka obima.

## Šta mi je kao trkaču bilo nejasno
- p09/p10/p12: posle provere forme plan obećava tempa, ali ispis ostaje „po osećaju" do trke.
- „Provera forme … — 8,3 km, 53 min": ne piše koliko je zagrevanje, a koliko test; za uspone nema zamene bez brda.
- Nisam siguran da li je 11 × 200 m + prag u 1. nedelji (p02, p06) ono što trkač već radi; profil to ne kaže.

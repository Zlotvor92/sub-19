# Glavni trener — v3 polumaraton, krug 3 (završna ocena) + pitanje „90+" (11. 11. 2026)

## DEO 1 — ocena

12 planova sa grane `claude/v3-hm` posle 8 tačaka iz ROUND-V3-HM-02. Ista rubrika. Svaki plan upoređen nedelju po
nedelju sa krugom 2; zbir km po danima = „planirano" svuda; udeo rada čitan iz zaglavlja nedelja. Kod nije čitan.
Po planu: `ROUND-V3-HM-03.json`.

| profil | stari | v3 k1 | v3 k2 | **v3 k3** | ciljni | najteža nedelja: rad / udeo |
|---|---|---|---|---|---|---|
| p01 | 72,0 | 79,5 | 81,0 | **81,0** | 84 | 62 min / 19 % |
| p02 | 71,0 | 78,0 | 81,0 | **81,0** | — | 58 min / 20 % |
| p03 | 60,5 | 73,0 | 74,5 | **74,5** | — | 53 min / 23 % |
| p04 | 60,5 | 78,0 | 79,0 | **80,0** | 80 | 82 min / 19 % |
| p05 | 67,5 | 79,5 | 80,0 | **81,0** | — | 89 min / 20 % |
| p06 | 58,0 | 63,5 | 71,0 | **71,0** | — | 38 min / 19 % |
| p07 | 64,5 | 71,5 | 75,0 | **75,0** | — | 73 min / 19 % |
| p08 | 58,0 | 69,5 | 72,5 | **74,5** | — | 61 min / 23 % |
| p09 | 61,5 | 76,5 | 80,0 | **80,0** | — | 66 min / 19 % |
| p10 | 58,5 | 68,0 | 73,5 | **73,5** | — | 51 min / 22 % |
| p11 | 53,0 | 78,0 | 79,0 | **80,0** | 80 | 47 min / 17 % |
| p12 | 67,0 | 78,0 | 75,5 | **80,0** | 82 | 70 min / 18 % |
| **prosek** | **62,7** | **74,4** | **76,8** | **77,6** | | |

Na ≥ 80: **7 od 12** (p01, p02, p04, p05, p09, p11, p12). Ostalih 5 (p03, p06, p07, p08, p10) su 71–75, uz plafon
72–78 koji sam naveo u krugu 2 — to su profili kojima ulazi ne daju više.

**Provereno u ispisu:** p04 RP usred nedelje 21 → 35 min, p05 26 → 44, p11 15 → 24, p12 20 → 35 uz najtežu nedelju
17–20 %; p12 vrh 55 km bez pada u ned 3, T do 28 min; p09 I 4 × 1000 m u ned 6–7; „usponi 6 × 20 s" su sada u laganom
danu pune dužine (p11 ned 3, 4, 16; p12 ned 3, 12); p08 srednji dan 13,3–14,7 km uz dugi 19–21 km (≤ 70 %);
zaglavlja za p06 i p08 nose rečenice iz § e i razdvajaju „najveći obim" od „najtežih treninga".

**Pogoršanja u odnosu na krug 2:** nema. p01 blok u najtežoj nedelji 8 → 7,5 km i p08 nedelja 1 na 93 % su
zanemarljivi i ne menjaju nijedan kriterijum.

**Preostale sitnice (nijedna ne traži krug):**
- p03, p08 ned 13/17; p10 ned 17: najteža nedelja 22–23 % brzog na 3 dana — na granici, ne dizati.
- p07: 54 → 67 km za 7 nedelja; zaglavlje to sada kaže, plan ne može bolje za 10 nedelja.
- p01 ned 13: RP usred nedelje 26 min uz blok 7,5 km — moglo bi 30 min (nedelja bi bila 20–21 %); kozmetika.

**Da li je generisanje za polumaraton ZAVRŠENO: DA.** Prosek 77,6 (stari 62,7), sedam profila na ≥ 80, nijedan plan
sa opterećenjem koje bih zvao opasnim, a preostalih pet su ograničeni ulazima i plan im to kaže. Dalji krugovi nad
samim planom daju manje od pola poena. Sledeći rad nije u generisanju nego u onome iz Dela 2.

## DEO 2 — „Može li generator da pravi planove 90+?"

**Kratko: ne kao plan napravljen jednom iz šest podataka; da kao plan koji zna trkača i menja se sa njim.**

**a) Da li je 90 dostižno na mojoj skali.** Moji ručni ciljni planovi dobili su 80–84 i to je blizu plafona za plan
pisan „na slepo". Ocena 9–10 po kriterijumu znači nešto što statičan plan ne može da zna:
- *uklapanje 9–10*: plan polazi od onoga što je trkač stvarno radio, ne od jednog broja „km nedeljno";
- *oporavak 9–10*: plan reaguje na stvarni umor, ne na pretpostavljeni;
- *progresija 9–10*: korak se potvrđuje posle svake faze, ne zadaje unapred za 16 nedelja.
Primer **p01** (46:00, 40 km, 4 dana): za 90–95 plan bi morao da zna da je njegov najduži trk u poslednja 3 meseca
bio 14 km i koliko puta; da su mu „lagani" dani zapravo na 5:20 (prebrzo) pa da ih uspori; da posle pripremne trke u
ned 8 stvarno promeni tempa i, ako je 10 km bio 47:10, spusti cilj sa 1:39:56 i kaže to; da utorkom ima 50 minuta, a
ne 80; da je trka brdovita. Primer **p11** (početnik, 20 km): rast obima × 2 za 20 nedelja je bezbedan samo ako neko
gleda — plan od 90 ima pravilo posle svakog dugog („ako je 12 km bilo teže od 7/10, ponovi nedelju"), zna da je pre
godinu dana imao bol u potkolenici pa drži dva lagana dana razmaknuta, i skraćuje lestvicu čim propusti nedelju.

**b) Odakle dolaze poeni od ~80 do ~92** (procena, za profil kome ulazi dozvoljavaju 80):

| izvor | poeni | napomena |
|---|---|---|
| (1) sam generator | +2–3 | do 82–84; to je plafon ručnog plana |
| (2) podaci o trkaču koje sada ne dobija | +4–5 | najveći pojedinačni izvor za uklapanje i polaznu tačku |
| (3) reakcija kroz vreme (adaptacija) | +4–5 | oporavak, progresija, tačnost tempa i cilja |
| (4) sadržaj oko trčanja (snaga, mobilnost, ishrana, strategija) | +1–2 | deo je već u v3 (ishrana, plan trke) |
| (5) usmeravanje unosa | 0 | ali +5–10 za pet profila koji sada ne mogu do 80 |

**c) Koje podatke bih tražio, po vrednosti:**
1. **Poslednjih 8–12 nedelja stvarnog treninga (Strava):** obim i vreme po nedelji, broj dana, najduži trk, praznine →
   prava polazna tačka, dozvoljena brzina rasta, početni dugi; otkriva kad je „40 km nedeljno" zapravo 28.
2. **Stvarni tempo i puls laganih i brzih trčanja, sve trke u poslednjih 6 meseci** → zone bez nagađanja, plan „po
   osećaju" nestaje, lagani dani se usporavaju ako su prebrzi.
3. **Povrede i trenutne tegobe (šta, kada, koliko je trajalo)** → sporija lestvica, ritam 2:1, brda umesto brzih
   repeticija, razmak teških dana, mekša podloga.
4. **Raspoloživo vreme po danu i godine** → gde ide dugi i teški dan, plafon trajanja treninga, više oporavka za 50+.
5. **Odgovor tokom plana: napor po treningu (1–10), propušteno, san/puls u miru/HRV (konektor već postoji)** → jedini
   ulaz za adaptaciju; bez njega (3) ne postoji.
6. **Staza i uslovi trke, teren za trening** (visinska razlika, očekivana temperatura, ima li staze ili brda) →
   brdski sadržaj, korekcija ciljnog tempa i plana trke.

**d) Da li rubrika treba da se promeni: da.** Sadašnja meri plan kao dokument i tu je 80–84 plafon. Predlog — tri
ocene, svaka 0–100, i zbirna:
- **Plan (50 %)** — sadašnja rubrika, bez izmene, da krugovi ostanu uporedivi.
- **Prilagođavanje (30 %)** — plan POSLE događaja (bolest 7 dana, propušten ključni dugi, provera ± 3 %, dve nedelje
  na 60 %, bol 10 dana, i „ništa se nije desilo"): bezbedan povratak, čuvanje ključnih treninga, korekcija tempa i
  cilja, stabilnost (bez razloga se ništa ne menja), jasnoća poruke.
- **Personalizacija (20 %)** — dva trkača sa istih šest ulaza a različitom istorijom (jedan stabilan godinu dana,
  drugi se vratio pre mesec dana) moraju dobiti različite planove, i razlika mora biti u pravom smeru.
90+ ima smisla tražiti samo na zbirnoj oceni; na oceni „Plan" pošten cilj ostaje 80–84.

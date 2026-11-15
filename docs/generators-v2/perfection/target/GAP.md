# Cilj 80 — razlika između ciljnih i sadašnjih planova (11. 11. 2026)

Osnova: 16 ciljnih planova u `target/<D>/pNN-target.md` (po distanci: najslabiji, srednji, najbolji, početnik), pisani za
ISTE ulaze kao u `P9/plans/`, ocenjeni istom rubrikom kao ROUND-01…04. Sadašnje ocene su iz ROUND-04 (verzije
5k-v2.17.0, 10k-v2.16.0, hm-v2.14.0, marathon-v2.14.0). Kod nije čitan.
Ograničenja: ocenjivač je AI model; ciljne planove nije proverio generator (obim po danima je trenerska procena, ne
izračunat zbir); poeni po stavkama su procene i delimično se preklapaju — čitati ih kao redosled veličine.

## 1. Ciljni planovi: sada → cilj

| distanca | najslabiji | srednji | najbolji | početnik |
|---|---|---|---|---|
| 5K | p08 49,5 → **78** (80 ne može) | p04 60,5 → **80** | p01 71,0 → **83** | p11 52,0 → **80** |
| 10K | p06 50,5 → **70** (80 ne može) | p03 60,5 → **78** (80 ne može) | p01 70,5 → **83** | p11 58,5 → **80** |
| HM | p11 53,0 → **80** (ujedno početnik) | p04 60,5 → **80** | p01 72,0 → **84** | p12 67,0 → **82** |
| maraton | p11 50,0 → **76** (80 ne može) | p08 54,0 → **74** (80 ne može) | p07 66,5 → **81** | p12 61,0 → **80** |

Prosek ovih 16: sada 59,8 → cilj 79,3 (+19,5). Od 16, **11 može na ≥ 80 sa istim ulazima, 5 ne može**.

## 2. Stavke razlike (12)

Vrsta: [P] pravilo · [S] promena osnove · [N] nov sadržaj · [E] ekran/usmeravanje unosa · [A] adaptacija.
„Po planu" = poeni na planu koji stavka pogađa; „na prosek" = procena za svih 48 planova (sada 60,6).

| # | vrsta | šta tačno (pravilo sa brojevima) | gde | po planu | na prosek |
|---|---|---|---|---|---|
| 1 | [S] | **Dugi kao lestvica sa sadržajem.** Kreće od 0,80–0,85 × plafona i raste +0,5–1 km (HM/MAR +1–2 km) do kraja razvoja; HM/MAR talas od početka (vrh / −15–20 % / vrh). Sadržaj: 5K/10K u vrhu završnih 10–15 min u T ili poslednja 3 km progresivno; HM blok RP 4 → 6 → 8–10 km pa 4 km u nedelji posle vrha; MAR blok MP 8 → 12 → 14 km, poslednji 3 nedelje pred trku. | sve distance, svi profili; najviše p04, p08, p05 | +3–5 | **+3,0** |
| 2 | [S] | **Specifična faza sa vrhom pa spuštanjem.** Najteža nedelja (po minutima rada) 3 nedelje pred trku (plan ≤ 8 nedelja: 2); sledeća ≤ 85 %, taper ≤ 60 %, trkačka 6–12 min. Zahteva da doza SME da pada posle vrha (sada „doza ne opada"). | sve distance | +2–3 | **+2,0** |
| 3 | [S] | **Početnik: lestvica obima i dugog do distance.** Vrh = start × 1,6 (5K, 16 ned) / 1,8 (10K, 18 ned) / 2,0 (HM, 20 ned) / 2,1 (MAR, 24 ned), korak +0,5–1,5 km nedeljno, svaka 4. nedelja 75–80 %; satni plafon ostaje. Dugi vođen vremenom: 5K 60 min, 10K 85 min, HM 2 h 05, MAR 3 h 20 uz hod. Sada × 1,2–1,5 i dugi 6,4 / 9,7 / 13,6 / 17,9 km. | p11 sve distance; 5K p12 | +15–27 | **+2,0** |
| 4 | [N]+[S] | **Provera forme kao događaj, ne zamena treninga.** Subota rasteretne nedelje: 5K → parkrun/test 3 km; 10K → trka 5 km; HM → trka 10 km; MAR → 10 km (≈ ned 4–8) i polumaraton 6–9 nedelja pred trku, zatim nedelja oporavka. Uz svaku: pravilo šta rezultat znači („10 km ≤ 45:30 potvrđuje cilj 1:39:56"). Plan po osećaju i početnik bez rezultata: test 3 km u ned 4, posle njega brojčana tempa. Test ≤ 2 × najveća dotadašnja doza (inače 2 km). | svi planovi ≥ 8 nedelja | +2–4 | **+2,0** |
| 5 | [S] | **Bez iste nedelje dvaput: dve osnove i lestvica T.** Duga priprema (≥ 16 ned) ima osnovu 1 i osnovu 2 sa različitim sadržajem; ista doza iste zone najviše 2 ne-rasteretne nedelje; T raste do plafona pa menja oblik (deonice → u komadu 5–7 km); I blok ≥ 3 nedelje (65 % → 80 % → 100 %). | p04, p08, p10, p11 sve distance; p05 | +2–4 | **+1,5** |
| 6 | [P] | **Tri dana: raspodela tri podražaja.** Uto glavni kvalitet; čet lagan dan sa malim podražajem (brda 6–8 × 20–45 s ili T 12–15 min) naizmenično; dugi sa završnicom u nedeljama kad je čet čisto lagan. MAR 3 dana: uto srednje-dugi 15–17 km, čet kvalitet, talas dugog od ned 1, u nedelji MP bloka čet bez kvaliteta. | p08 sve distance; p03, p10 | +5–8 | **+1,2** |
| 7 | [N] | **Trka i ishrana u planu.** Trkačka nedelja: tempo po delovima („prvih 5 km 4:48, km 6–16 4:44, zatim po osećaju"), zagrevanje po nivou (početnik 8–10 min). HM/MAR: unos na 35–40 min u svakom dugom ≥ 90 min, proba doručka/opreme/gelova u najtežoj nedelji, unos na trci po minutima. | sve; najviše HM/MAR | +1–2 | **+1,0** |
| 8 | [N] | **Brda i progresivni dugi kao sadržaj.** Osnova: usponi 4–6 × 10 s na laganom danu; u 2 nedelje osnove usponi 8–10 × 45 s umesto R; fartlek kod početnika; progresivna poslednja 3 km dugog. | sve | +1 | **+0,8** |
| 9 | [N] | **Hod-trk i dugi u minutama za spore** (lagan tempo ≥ 7:00/km): dugi zadat vremenom, 1 min hoda na 9–15 min; maraton hod-trk i na trci. | HM/MAR p03, p10, p11; MAR p12 | +3–5 | **+0,6** |
| 10 | [P] | **Preostale sitnice.** Pravilo „mali obim" i u rasterećenju/taperu i sa jednim laganim danom; dan pred dugi ≤ 50 % dugog; rasterećenje ne u ned 4 plana od 8 nedelja (spojiti sa proverom u ned 5); trkački dan bez „8,5 km"; poruka o malom obimu u jednom obliku. | ~15 planova | +1–3 | **+0,5** |
| 11 | [E] | **Usmeravanje unosa pre generisanja** (ne diže ocenu za iste ulaze; pretvara „ne može" u „može"): (a) maraton ili HM sa 3 dana → „sa 4. danom od 40 min plan je znatno bolji"; (b) početnik maraton ispod ~35 km/ned ili ispod 24 nedelje → polumaraton ili duža priprema; (c) brz rezultat uz mali obim (VDOT ≥ 50 i < 40 km/ned) → pitanje „povratak posle pauze?" i predlog obima/dužine; (d) 5 dana pri < 30 km/ned → 4 dana; (e) priprema kraća od 10 nedelja za HM/MAR → upozorenje. | p06 sve; p08 HM/MAR; p03/p10 MAR; MAR p11 | +6–10 ako korisnik prihvati | (+1,5–2,5, uslovno) |
| 12 | [A] | **Adaptacija — rubrika je ne meri.** Predlog merenja u § 4. | sve | — | van proseka |

Zbir stavki 1–10 ≈ +14,6 → procena proseka **≈ 75** za iste ulaze (raspon 74–77 zbog preklapanja).

## 3. Šta ciljni planovi imaju, a sadašnji nemaju (isto na svih 16)

1. Svaka nedelja se razlikuje od prethodne po nečemu što trkač vidi (dugi, doza ili sadržaj).
2. Plan ima vrh i silazak: najteža nedelja → 85 % → taper → trka.
3. Dugi ima ulogu u specifičnosti (završnica, progresija, blok), ne samo dužinu.
4. Postoji bar jedan trenutak istine pre trke (trka ili test) sa uputstvom šta rezultat znači.
5. Trkački dan je plan trke (tempo, zagrevanje, unos), ne red u tabeli.

## 4. Kako meriti adaptaciju [A]

Za 4 profila po distanci (isti kao ovde) × 6 događaja = 96 slučajeva; ocenjuje se plan POSLE događaja:

| događaj | šta dobar plan uradi |
|---|---|
| bolest: 7 dana bez treninga u razvoju | nedelja povratka 60–70 % bez kvaliteta, pa nastavak sa doze od pre 2 nedelje; trka ostaje |
| propušten ključni dugi (najduži ili sa blokom) | pomera ga za nedelju ako je ≥ 3 nedelje do trke; inače ga ne nadoknađuje |
| provera 3 % bolja od prognoze | tempa se ubrzavaju od sledeće nedelje, obim se ne menja |
| provera 3 % lošija | tempa se usporavaju, cilj se ponovo ocenjuje i to se kaže |
| dve nedelje na 60 % obima (posao, put) | vrh se spušta (ne juri se stari), dugi se vraća postepeno |
| bol: 10 dana bez kvaliteta | samo lagano, kvalitet se vraća sa 60 % doze |

Kriterijumi 0–10: bezbedan povratak (30 %), čuvanje ključnih treninga (25 %), ispravna korekcija tempa/cilja (25 %),
jasnoća poruke korisniku (20 %). Daje zasebnu „ocenu adaptacije" 0–100; cilj takođe 80. Ne mešati sa ocenom plana.

## 5. Redosled rada ka 80 (procena proseka svih 48 posle koraka)

| korak | stavke | zašto tim redom | prosek posle |
|---|---|---|---|
| 0 | sada | | 60,6 |
| 1 | 1 + 2 [S] | ista promena osnove (dugi i doza kao lestvice sa vrhom i silaskom); pogađa svih 48 | ≈ 65,5 |
| 2 | 3 [S] + 6 [P] | diže dno: početnici i 3 dana su 12 od 14 najslabijih planova | ≈ 68,5 |
| 3 | 4 [N+S] + 5 [S] | provera forme i neponavljanje — traže nov tip treninga (trka) i novu podelu faza | ≈ 72 |
| 4 | 7 + 8 + 9 [N] | sadržaj koji se dodaje bez promene kostura | ≈ 74,5 |
| 5 | 10 [P] | sitnice | ≈ 75 |
| 6 | 11 [E] | menja ulaze, ne plan; računa se samo za korisnike koji prihvate predlog | ≈ 78–79 (uslovno) |
| — | 12 [A] | zasebna ocena, zaseban cilj | — |

Korak 1 je najveći pojedinačni dobitak i preduslov za 4 i 5 (blok u dugom i pripremna trka traže da doza sme da pada).

## 6. Iskreno: ko ne može do 80 ni sa svim stavkama

**Sa istim ulazima prosek svih 48 staje na oko 75–77; „svi planovi ≥ 80" nije dostižno.** Razlog nije generator
nego ulazi: neki zahtevi nemaju dobar plan.

| profili | plafon | zašto | koji ulaz menja ishod |
|---|---|---|---|
| **p06 × 4** (VDOT 58, 25–40 km, 5 dana, 6–12 ned) | 5K ≈ 72, 10K 70 (napisan), HM ≈ 72, MAR ≈ 65 | obim ne nosi dozu koja tom trkaču treba; priprema prekratka da obim poraste | obim ≥ 45 km (maraton ≥ 60) ili 12+ nedelja; maraton za 12 nedelja sa 40 km: ne |
| **p08 × 4** (3 dana, vrh obima) | 5K 78 (napisan), 10K ≈ 78, HM ≈ 77, MAR 74 (napisan) | sva tri dana nose opterećenje; na HM/MAR dugi je 45–50 % nedelje | 4. dan od 30–50 min → 80–82 |
| **p03, p10 na HM i maratonu** (spori, 3 dana, 25–30 km) | HM ≈ 76–77, MAR ≈ 70–72 | dugi 2 h–3 h na 3 dana i 35–45 km; maraton od ~5 h sa 45 km/ned | 4 dana; za maraton i obim ≥ 40 km ili prvo polumaraton |
| **p03, p10 na 5K i 10K** | 10K 78 (p03 napisan), 5K ≈ 78 | granično: jedan kvalitet nedeljno, mala doza | 4 dana ili 4 nedelje više → 80 |
| **MAR p11** (početnik, 25 km, 24 ned) | 76 (napisan) | obim mora × 2,1 bez rezerve za propuštenu nedelju | start ≥ 35 km, ili 30+ nedelja, ili prvo polumaraton |

Ukupno: **17 od 48 profila ne može na 80 sa istim ulazima** (6 od njih je na 78, tj. na pragu); 31 može. Ocene uz
„≈" su procene za profile kojima nisam pisao ciljni plan; pouzdanost srednja.
Zato je [E] jedini put da ti korisnici dobiju plan od 80: ne lepši plan za loš ulaz, nego bolji ulaz.

Što se tiče cilja vlasnika: „svi planovi na 80" treba čitati kao **„svaki korisnik može da dobije plan od 80"** —
31 profil direktno, ostalih 17 kroz predlog izmene unosa. Kao broj za praćenje predlažem dva: prosek planova za iste
ulaze (cilj ≈ 75) i udeo planova ≥ 80 posle prihvaćenog predloga (cilj ≥ 90 %).

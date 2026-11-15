# P8 — dopuna po izveštaju glavnog trenera (krug 1, `coach/ROUND-01.md`)

Važi za sve P8 tabove, uz `P8-ispravke-po-slepoj-oceni.md`. Gde se dva dokumenta razlikuju, važi ovaj. Pročitaj
`coach/ROUND-01.md` (§ trenerski standard za svoju distancu i § 10 izmena) — to je merilo sledećeg kruga.

Glavni nalaz trenera: generator meri opterećenje u km i udelima, a trkač ga plaća u minutima. Spori trkači zato dobijaju
treninge i nedelje koje traju mnogo duže nego isti plan brzog trkača (HM RP 3 × 5000 m = 88 min kod sporog, 56 min kod
brzog; maraton 95 km ≈ 11 h nedeljno).

## Izmene zajedničkih pravila

**G1 (izmena).** (a) Vrh obima = min(postojeće pravilo vrha; start × faktor; satni plafon), faktor po dužini pripreme:
≤ 12 ned 1,30; 13–15 ned 1,35; ≥ 16 ned 1,40. Satni plafon nedelje (cilj km × srednji lagan tempo), po VDOT-u plana
(po osećaju: procena VDOT-a) i distanci 5K / 10K / HM / MAR: VDOT < 40: 6 / 6 / 7,5 / 9 h; 40–49,9: 7 / 7 / 8,5 / 10 h;
≥ 50: 8 / 8 / 9,5 / 11 h. Kad je start već iznad plafona, vrh = start (bez rasta, bez spuštanja ispod trenutnog obima).
(b) Korak rasta manji od 3 % tekućeg cilja se ne primenjuje: nedelja zadržava cilj, a rast se prenosi na sledeću
ne-rasteretnu nedelju (nema „rasta" od 0,1 km). Ostalo iz G1 ostaje.

**G2 (izmena).** U izgradnji i taperu kao što je zadato. U TRKAČKOJ nedelji ne važi „prvi nivo lestvice" nego G5.

**G4 — plafon jednog treninga u minutima rada** (novi član iste funkcije plafona zone; i dalje jedna funkcija, jedan
vlasnik): T ≤ 30 min (cilj nedelje ≥ 80 km: 40 min); I ≤ 20 min za VDOT < 40, inače 24 min; RP 5K ≤ 20 min; RP 10K ≤ 30
min; RP polumaratona u treningu usred nedelje ≤ 45 min; MP u treningu usred nedelje ≤ 60 min, početnik ≤ 45 min. Blok u
dugom nije „trening usred nedelje" (njega drže granice bloka i dugog). Trajanje po tempu zone te nedelje. Kad nivo
lestvice prelazi minute — najviši nivo koji staje (isti mehanizam kao udeo).

**G5 — taper, trkačka nedelja i rasterećenje u minutima.** Rad kvaliteta u taperu ≤ 60 % najvećeg rada iste zone u
izgradnji (maraton, druga nedelja tapera: ≤ 40 %); oštrenje trkačke nedelje: ukupno ≤ 12 min rada (maraton ≤ 10 min),
dve jednake deonice u trkačkom tempu, dužina deljiva sa 100 m (najmanje 2 × 400 m; ako ni to ne staje u minute, ubrzanja
umesto oštrenja); rasterećenje: jedan kvalitet ≤ 60 % poslednje ne-rasteretne doze te zone i dugi 0,8 × poslednji — na
svim distancama, bez izuzetka „najveća doza u rasterećenju".

**G6 — lagan dan prema dugom.** Lagan ≤ 0,70 × dugi iste nedelje za plan sa 4 i više dana (3 dana ostaje 0,80). Višak
cilja koji zato ne staje spušta se u konstruktoru postojećim mehanizmom izvodljivog cilja i saopštava JEDNOM po planu
(G3). Izmeri koliko planova gubi vrh obima i za koliko; ako vrh padne za > 10 % u > 10 % planova neke grupe — STOP sa
brojevima (opcija: 0,75).

**G7 — nedelja testa.** U nedelji kontrolnog testa (plan sa rezultatom i plan po osećaju) test je jedini kvalitet:
drugi dan kvaliteta te nedelje je lagan (stanje slota se ne menja). Test ne ide pre nedelje 4 (ako bi pao ranije — prva
ne-rasteretna nedelja ≥ 4 iste faze, inače bez testa).

**G8 — dugi početnika do distance.** Početnik: u najviše 3 ne-rasteretne nedelje vrha dugi sme do 50 % cilja nedelje
da bi dostigao 10K: 10 km; HM: 16 km; maraton: 28 km — uz vremensku granicu dugog (maraton početnik: 150 → 180 min) i
pravilo skoka dugog. Ako ni tada ne dostiže — jedna jasna rečenica u planu (šta fali: obim ili dani) umesto platoa bez
objašnjenja.

**G3 (dopuna teksta).** Trkački dan se ispisuje kao trka (distanca i prognozirano/ciljno vreme), ne kao zbir km sa
zagrevanjem; nazivi faza na srpskom svuda gde ih korisnik vidi; 5K trkački napor = RPE 9; najviše jedno zbirno
upozorenje po vrsti.

## Po distanci (izmene prema prvom zadatku)

- **5K (a):** uz 10 % važi i G4 (I ≤ 20 / 24 min, RP ≤ 20 min).
- **HM (b):** umesto „RP trening + blok ≤ 25 % km": rad u trkačkom tempu te nedelje (trening + blok) ≤ 22 % VREMENA
  nedelje, uz G4 (RP usred nedelje ≤ 45 min).
- **Maraton (b):** G4 (svi ≤ 60 min usred nedelje, početnik ≤ 45 min); (a) ispraviti logiku, ne samo tekst.
- **10K (c):** ostaje upozorenje sa preporukom manje dana (smanjenje broja dana je odluka korisnika, ne generatora);
  upozorenje mora da bude prvo u planu i da kaže koliko dana preporučuje.

## Šta se NE radi u P8 (ostaje za krug 2, posle ocene trenera)

Talas dugog na plafonu (−20 % između), blok u dugom za 3 dana i početnika, donji prag doze pri ≥ 30 km, vrh specifične
doze 3 nedelje pred trku, srednje-dugi pri ≥ 70 km, automatsko smanjenje broja dana, gorivo i tempo trke, snaga.

## Napomena izvođaču

Ovo je veliki skup; redosled ugradnje: G4 → G5 → G1 → G2 → G7 → G6 → G8 → G3 → po distanci. Posle svake izmene mreža P0 i
12 profila P7; sudar → STOP sa brojevima i nastavi sa sledećom izmenom. Ako vreme ne dozvoljava sve, isporuči ugrađeno
i u izveštaju navedi šta je ostalo — ne odlaži push zbog poslednje stavke.

## Izmena G6 (10. 11. 2026, 14:35 — nalaz P8-10K, mreža početnika)

G6 „lagan ≤ 0,70 × dugi" važi SAMO za redovan plan sa 4 i više dana. Početnik (jedan kvalitet nedeljno) ostaje na
0,80, kao plan sa 3 dana: sa 0,70 obim početnika sa 4 dana pada čim uđe prvi kvalitet (10K mreža B: pad ≥ 10 % u
48,6 % planova, sa 0,80 u 2,9 % — isto kao pre P8). Važi za sve četiri distance.

# P8 — maraton: sudari pravila (STOP beleške, rad je nastavljen)

10. 11. 2026 (Europe/Belgrade). Polazni SHA `0181e25`. Po nalogu („sudar → STOP sa opcijama i brojevima, pa nastavi") rad
nije zaustavljen: za svaki sudar je privremeno uzeta opcija koja NE uvodi novo trenersko pravilo (zadržava postojeće
ponašanje za spornu klasu ili koristi postojeći mehanizam). Organizator bira; izmena svake opcije je mala (navedeno).

Komande: `node --max-old-space-size=6144 docs/generators-v2/perfection/P8-MAR/classify.ts <worktree 0181e25> 0181e25`
(K-cls; 31 920 planova, 308 s; izlaz `P8-MAR/classify-0181e25.json`), iz `web/`:
`node ../docs/generators-v2/perfection/P8-MAR/measure.ts <oznaka> --plans` (K-mer; 12 profila P7 + 192 mreže P0, 1,2 s).

## S1 — G1a (faktor 1,40) × početnik na dnu tabele: 42 odbijanja u uzorku mreže početnika

Izmereno (brz nivo `beginnerGrid.node.test.ts`, pre privremene opcije): `beg-d4-{16–24}w-25km-e330-A` i slični —
„Nedelja N−1: nijedan cilj od 20 km naviše ne može da se sastavi" (42 ulaza u uzorku od 1890/18). Uzrok: vrh 25 × 1,40 =
35 km (pre 37,5), taper N−1 0,6 × vrh = 21 km: dan T (WU/CD 25 min) + 2 lagana ≥ 5 km + dugi ne staju, a taper ide samo
naniže do minimuma nedelje 20 km.

- **O1 (privremeno ugrađeno):** početnik zadržava svoj faktor vrha (M17: 1,5 × / +25 km); satni plafon G1a važi i za
  njega. Posledica: 0 odbijanja (1890/1890); p11 (25 km) vrh 37,5 km, p12 (50 km) vrh 75 km = 8,7 h (plafon 9 h).
  Mesto: `volume.peakCap10` (jedan red).
- O2: faktor važi i za početnika, klasa se odbija sa preporukom (više obima ili redovan plan).
- O3: faktor važi, a početnik u N−1 sme ispod 0,6 × vrh do izvodljivog cilja naviše (novo pravilo tapera).
- Napomena uz O1: trener je tražio da početnik NE raste +50 % (p12: 50 → 75 km). O1 to ne popravlja; satni plafon za
  VDOT < 40 (9 h) veže tek od ≈ 76 km pri laganom tempu 7:00/km.

## S2 — G4 (MP ≤ 60 min usred nedelje) × M19 O3 (MP trening nastavlja od max(trening, blok))

Blok u dugom nije „trening usred nedelje" (dopuna), pa blok 12–16 km (do ≈ 90 min) postaje „poslednja MP doza" slota, a
sledeći MP trening nedelje A ne sme preko 60 min → doza treninga je niža od bloka. Isto za T pri cilju koji prelazi i
vraća se ispod 80 km (40 → 30 min).

- **Privremeno:** trening uzima najviši nivo lestvice koji staje u minute, korak se beleži kao „spušten" sa tačnom
  napomenom („trening usred nedelje ostaje u granici minuta rada za ovu zonu") i upozorenjem `DOSE_DROPPED` (postojeći
  mehanizam validatora, bez pretrage cilja). Izmereno (K-cls): `DOSE_DROPPED` R 570 → 1548, F 168 → 1632, B 0 → 0.
- O2: stanje slota posle bloka = min(blok; najviši nivo koji staje u minute) — bez upozorenja; traži izmenu lanca doze u
  validatoru (DOSE_DECREASE, MAIN_DOSE) — veći zahvat.
- O3: blok u dugom ≤ 60 min (tada nema razlike) — smanjuje najjači maratonski trening (blok sada do 62–69 min u mreži P0).

## S3 — ukupan MP rad pada više od praga P2 (≤ 5 % po grupi, „inače samo prijaviti")

K-cls, medijana ukupnog MP [km] po planu: R 54 → 44 (−18,5 %), F 54 → 42 (−22 %), B 42 → 27,5 (−35 %). Uzroci po redu:
G5 (taper 60/40 %, oštrenje ≤ 10 min: −6 do −9 km po planu), G4 (trening ≤ 60/45 min), G1a (manji vrh → kraći dugi →
manji blok, npr. p01: blok 12 → 10 km), početni nivo MP = 60 % plafona koji je sada u minutima (p07: prvi MP 2 × 5000 →
2 × 3000 m). Prijavljeno, nije menjano.

## S4 — G7 × plan po osećaju od 12–13 nedelja: jedini test nestaje

Test plana po osećaju je u poslednjoj nedelji baze; za 12 i 13 nedelja to je nedelja 3, a baza nema nedelju ≥ 4 → po
pravilu „inače bez testa". K-cls: planova sa testom F 8190 → 6930 (1260 bez testa), R 21 840 → 21 840 (plan sa rezultatom
od 12 nedelja ima test u nedelji 4). Plan dobija rečenicu „Plan nema kontrolni test 5 km: u ovako kratkoj pripremi pao
bi pre četvrte nedelje…".

- O1 (ugrađeno, po slovu pravila): bez testa.
- O2: test u prvoj ne-rasteretnoj nedelji ≥ 4 SLEDEĆE faze (razvoj) — plan po osećaju od 12 nedelja ostaje sa testom.

## S5 — G1 (sporiji rast) × rasterećenje blizu polaznog obima (6 dana, 50 km)

Jedno novo odbijanje u mreži P0 pre ispravke (`F-d6-50km-24w-e330`, nedelja 4): rasterećenje 0,8 × ≈ 41 km ne nosi 4
lagana ≥ 5 km + T + dugi 0,8 ×. Rešeno POSTOJEĆIM mehanizmom (do sada samo nedelja testa, početnik i adaptacija): dugi
rasterećenja se skraćuje dok lagani ne ostanu ≥ 5 km, uz napomenu i upozorenje `DELOAD_LONG_SHORTENED`. Posle: 0 odbijanja
(204/204 i 31 920/31 920); od 204 plana menja se samo taj. Tražim potvrdu tumačenja.

## S6 — vrh obima pada > 10 % (posledica G1a, ne G6)

G6 sam (merenje posle G1, pre i posle G6, K-mer): vrh pada u 9/144 (R), 6/32 (F), 2/16 (B), najviše 8,4 % — ispod praga
STOP (> 10 % u > 10 % planova). Ukupno P8 prema polaznom (K-cls): vrh niži za > 10 % u R 6720/21 840 (31 %), F 3624/8190
(44 %), B 63/1890 — to je traženi efekat G1a (faktor 1,30–1,40 umesto 1,5 i satni plafon). Posledica za dugi: medijana
najdužeg dugog R 26,7 → 26,7 km, F 25,7 → 24,6 km, najkraći najduži 19,8 → 17,6 km (brz trkač, 40 km, 12 nedelja).

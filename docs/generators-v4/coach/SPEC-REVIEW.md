# Trenerska presuda o SPEC-u jezgra V4 (12. 11. 2026)

Pročitani § 2, 5, 6.5, 7.5, 14 iz `docs/generators-v4/SPEC.md` (grana `claude/v4`). Brojevi su trenerska praksa i
moj sud; nisu provereni pretragom literature u ovoj sesiji. Pouzdanost je označena uz svaki.

## 1. Oblik istorije
Parovi P1–P3 su zadati u obliku § 2 u `SCENARIOS-V4.md` § 4. Tri stvari oblik ne može da prenese: godine, stariju
tegobu (briše se posle 14 dana) i starost rezultata — predlozi su tamo.

## 2a. Rampa povratka (§ 6.5) — potvrđujem, sa dve ispravke

| pravilo | sud | broj |
|---|---|---|
| posle napora `R = ceil(D / 7)` dana | **potvrđujem** [srednja] | 5 km 4 dana, 10 km 7, polumaraton 15, maraton 33 — blizu starog pravila „dan po milji trke" (3 / 6 / 13 / 26), malo opreznije; dobro je što sporiji trkač dobija duži oporavak |
| faktor 0,4 → 1, odmor ispod 0,5 | **potvrđujem** | polumaraton: 2 dana odmora, maraton 5 |
| kvalitet tek od 0,8 i najranije 4. dana | **potvrđujem** | daje: 5 km 4. dan, 10 km 5., polumaraton 10., maraton 22. |
| posle pauze `R = ceil(1,5 × dani)` | **ispravljam po razlogu** [srednja] | bolest (temperatura) ili povreda: **2,0 × dani** (7 dana bolesti → 14 dana rampe, kvalitet 10. dana); put, posao, odmor: **1,0 × dani**; nepoznat razlog: 1,5; plafon 28 dana |
| prvi kvalitet posle rampe × 0,8 | **potvrđujem** | — |
| dodatak | **tražim** | dok rampa traje, dugi ≤ 75 % poslednjeg odrađenog dugog, i kad je faktor već iznad 0,75 |

## 2b. Blok RP u dugom posle 7 dana bolesti — strože
× 0,8 nije dovoljno [srednja]. Pravilo: posle pauze od ≥ 7 dana **nema bloka dok nije odrađen jedan dugi bez bloka
od bar 90 % dužine poslednjeg dugog pre pauze**; prvi blok posle toga je **najniži nivo lestvice** (ne 80 % mesta na
kome je plan stao), zatim lestvica redom. Za pauzu od 3–6 dana ostaje × 0,8. Posledica u primeru (b): u nedelji 7
dugi je lagan, blok se vraća u nedelji 8 na prvom nivou.

## 2c. Plafon napretka do trke (§ 7.5) — podigao bih ga, umereno

Slažem se sa vlasnikom da je polazna vrednost preniska, ali ne mnogo: 1 VDOT je oko 2 % vremena trke.

| staž strukturisanog treninga | sada `r` / najviše | **moj broj `r` / najviše** | u vremenu za 16–18 nedelja |
|---|---|---|---|
| < 1 god. ili početnik | 0,15 / 3,0 | **0,20 / 4,0** | 5–8 % |
| 1–3 god. | 0,10 / 2,0 | **0,13 / 2,5** | 3–5 % |
| > 3 god. | 0,06 / 1,2 | **0,07 / 1,5** | 1,5–3 % |
| nepoznato | 0,08 / 1,6 | **0,10 / 2,0** | — |

- **Staž treba da znači godine STRUKTURISANOG treninga, ne godine trčanja.** Ko trči pet godina, a nikad nije radio
  kvalitet (u istoriji nema nijednog bržeg treninga), napreduje kao prva ili druga grupa. Predlog: ako u 12 nedelja
  istorije nema dokaza kvaliteta, `r` × 1,25 (unutar istog plafona grupe + 0,5).
- Očekivano = 0,6 × plafon: **ostaje** (0,6–0,65). Faktor obima 0,8–1,2: ostaje.
- Primer iz poruke (1:41:00, 30 → 37 km, 10 nedelja, grupa 1–3 god.): plafon 0,13 × 1,1 × 9 ≈ 1,3 VDOT →
  očekivano oko **1:39:30**, raspon oko **1:37:50–1:41:50** (umesto 1:40:00 i 1:38:25–1:41:59).
- 18 nedelja, ista grupa, obim +30 %: plafon 2,5 → očekivano 1,5 VDOT (≈ 3 %, 1:41:00 → oko 1:38:00), najbolje oko
  1:36:10. Više od toga plan ne treba da obećava unapred; ako trke pokažu više, procena to sama preuzme.
- **Pouzdanost: niska do srednja.** Pojedinačne razlike su veće od razlika među grupama; ovo su polazne vrednosti
  dok F4 ne kalibriše na stvarnim istorijama. Važnije od broja je da se raspon ispisuje i da se pomera posle svake
  provere.

## 3. Težine opterećenja (E 1,0 / M 1,5 / T 2,0 / I, R 3,0; džog 1,0; hod 0,5) — bez prigovora na odnose

Jedan prigovor i dve napomene [srednja]:
1. **Trajanje dugog nije linearno.** Tri sata laganog nisu tri puta po sat. Predlog: u jednom neprekidnom trčanju
   minuti posle 90. × 1,25, posle 150. × 1,5. Bez toga model potcenjuje maratonske duge i trku; poseban plafon
   dugog (§ 6.2) štiti dužinu, ali ne i zbir nedelje.
2. Udeo brzog rada (provera K6 rubrike) računati u **minutima**, ne u BO — inače R i I teže tri puta.
3. Signal umora `acute / chronic ≥ 1,5` je bučan kod 3 dana i malog obima (jedan dugi pomera odnos); dodati uslov
   da je i apsolutno nedeljno opterećenje iznad baze za ≥ 20 %.

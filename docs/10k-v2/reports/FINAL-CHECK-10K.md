# 10K v2 — kompletna provera (organizator)

Stanje: grana `claude/generator-isolation-5k-10k-hm-marathon`, vrh `105470f` (10K v2 `10k-v2.4.1`; uključuje Predaju-1 i
5K 08d). `npm run check` na tom stanju: exit 0 — 220 fajlova, 2710 testova. Prekidač 10K v2 ostaje podrazumevano
isključen.

**Zaključak:** 10K v2 je ispravan i upotrebljiv u svim proverenim tokovima. Jedna trenerska greška u adaptaciji ide na
ispravku (N1, segment 06c), uz jednu ispravku teksta (N2). Ostalo su svesne odluke ili poznata ograničenja (N3–N6).

## 1. Šta je provereno

| Provera | Kako | Rezultat |
|---|---|---|
| Planovi za 9 reprezentativnih ulaza | tabele po nedelji (faza, cilj, planirano, dugi, lagani, kvalitet, test, trka) | 8 planova, 0 grešaka validatora; F5 (pon/sre/čet/sub/ned) odbijen sa predlogom rasporeda (ispravno) |
| Mreža generatora | R3–R6, F3–F6, B3–B4: 30 480 planova | 0 odbijanja; lagan vs dugi i monotonija izmereni (N3, N4) |
| Sezona kroz aplikacioni tok | 16 nedelja, nedeljni pregled → primena → revizija; A: manjak, bol 5, trka 5 km, pauza 8 dana; B: po osećaju, test 5 km, umor | 0 odbijanja, 0 grešaka validatora, prošli dani bajt-isti posle svake primene, nijedan prazan trening, nijedan lagan > dugi |
| Vraćanje verzije | najstarija revizija sezone A | 23 buduća dana vraćena, 0 konflikata |
| Promena cilja | 42:00 u sezoni A | treninzi bajt-isti, menja se samo ocena |
| Sat (14 dana) | plan sa rezultatom / po osećaju | 8 / 4 treninga; po osećaju 2 dana kvaliteta preskočena sa razlogom (N6) |
| Rasterećenje posle smanjenja | 252 plana (R4, svaki 12.) × asOf ned 2…N−4 × {pauza 10 d, bol 5, manjak} = 6804 toka | **28 %** tokova: smanjena nedelja, pa odmah redovno rasterećenje (N1) |

Reprezentativni ulazi: R4-40-13 (10K 45:00), R6-55-16 (5K 20:00), R3-25-10 (10K 55:00), R5-45-8 (HM 1:40), F3-25-12
(lagan 6:30), F5-40-14 (lagan 5:45), B3-15-12 (početnik, lagan 7:30), B4-25-10 (početnik, 5K 27:00), R4-35-18 (10K 50:00).

## 2. Nalazi

### N1 — ISPRAVKA (06c): redovno rasterećenje odmah posle smanjenja

Posle pauze, manjka izvršenja ili bola sledeća nedelja je smanjena, a redovno rasterećenje (D5) ostaje u kalendaru, pa
slede dve lake nedelje zaredom. Mereno na 252 plana mreže R4 (svaki 12.; ranije pogrešno navedeno 189), asOf kraj ned 2…N−4: pauza 10 dana 644/2268,
bol 5 644/2268, manjak 644/2268. Primer `10w-25km-v30-A-sat`, asOf kraj ned 3:

| Scenario | ned 4 (cilj/planirano; original 29,8) | ned 5 |
|---|---|---|
| pauza 10 d | 21,2 / 21,2 | rasterećenje 17,0 |
| bol 5 | 29,8 / 20,9 (dani bola) | rasterećenje 14,9 |
| manjak | 23,8 / 23,8 | rasterećenje 19,0 |

Trenerski: smanjena nedelja je već oporavak; drugo rasterećenje gubi nedelju povratka. A5 za umor već ima pravilo
„redovno rasterećenje odmah posle prinudnog se ukida"; isto nedostaje za pauzu, manjak i bol. Isti obrazac ima 5K v2
(16/84 toka u probi) — poseban segment za 5K.

### N2 — ISPRAVKA (06c): poruka PAIN kad deluje min sa ciljem nedelje sidra

Uz pauzu u istom koraku poruka kaže „70 % nivoa pre bola (15,5 km)", a broj je cilj pauze. 5K 08d već ima tačan tekst
(„… rast kreće od X km (cilj nedelje r; 70 % nivoa pre bola bilo bi Y km)").

### N3 — SVESNA ODLUKA (ostaje): lagan dan blizu dugog u planovima sa 3–4 dana pri vrhu

D13/D17: dugi uzima najveću dozvoljenu dužinu (udeo dana ili 105 min), lagani ostatak; „lagan ≤ dugi" je tvrdo pravilo.
Pri velikom obimu na malo dana lagan dostiže dugi: R4-40-13 ned 9 lagan 17,2 = dugi 17,2; mreža: lagan > 0,9 × dugi u
bar jednoj nedelji kod 46 % planova R4, 36 % R3, 24–25 % R5/R6, 46–61 % F4/F3, 53 % B3. Granica lagan ≤ 0,8 × dugi bi
smanjila kapacitet i najveći prihvatljiv obim ulaza (4 dana 55 km ne bi mogao da počne od svog obima). Mišljenje: nije
greška nego posledica obima na malo dana; prati se u korisničkim povratnim informacijama.

### N4 — POZNATO OGRANIČENJE (ostaje): početnik 3 dana, isti T 1,5 km više nedelja

B3: 372/1512 planova imaju isti kvalitet ≥ 3 nedelje zaredom, najviše 12 (T 1,5 km kontinuirano; ostale grupe ≤ 2).
Najmanja doza lestvice pri malom obimu; drugi oblik iste doze (isprekidano) ne staje u kapacitet. Za početnika pri
15–20 km nedeljno ponavljanje male doze nije rizik.

### N5 — PRIHVAĆENO: planovi prilagođeni u 10k-v2.4.0 zadržavaju staro sidro bola

Koraci se ponavljaju kako su sačuvani (A14). 10K v2 je iza razvojnog prekidača — nema korisnika sa takvim planovima.

### N6 — PO DIZAJNU: sat ne dobija kvalitet plana po osećaju

Deo po RPE nema propisan tempo, pa se ne šalje (razlog u `skippedReasons`); lagani i dugi idu sa E opsegom.

### N7 — ISPRAVKA (06d), dopuna posle 06c: odbijene adaptacije rano u planu po osećaju

Ova provera ga nije uhvatila: nijedna mreža (04, P, R, sezona) nema asOf u nedelji 1 ni sredinom nedelje pre nedelje
testa. Pretraga posle 06c: planovi po osećaju (svaki 7. iz F3–F6), asOf = kraj nedelje i kraj − 3 dana za svaku nedelju
pre nedelje testa, {pauza 10, pauza 20, bol 5, bol 8, pauza 10 + bol 5, manjak} = 61 104 toka. Odbijeno: 10k-v2.4.0
397, 10k-v2.4.1 274, 10k-v2.5.0 152 (06c smanjuje, ne uvodi). Dve klase, obe „konstruktor sastavi, validator odbije":

- 142 × `VOLUME_RULE` u rasterećenju sa testom: pretraga cilja dozvoljava rast naviše (odstupanje D27) jer okvir ima
  test, a sastavljena nedelja test izgubi (A9) — rasterećenje bez testa podignuto naviše. Npr. `f-d4-12w-25km-e270-A-sun`,
  bol 5 u četvrtak ned 1: ned 4 cilj 20 km, pravilo 17 km, test zamenjen kvalitetom.
- 10 × drugo pravilo, bar jedan `TAPER_LONG`: `f-d5-8w-35km-e270-A-sat`, bol 5 u sredu ned 1: dugi tapera 7,3 km >
  0,75 × najduži 9,2 km — konstruktor i validator ne računaju isti „najduži dugi".

Posledica za korisnika: „plan nije moguće prilagoditi" posle bola ili pauze na početku plana.

## 3. Sledeće

1. Segment 06c (10k-v2.5.0): N1 + N2 — urađeno (`b70931f`).
2. Segment 06d (10k-v2.5.1): N7 + trajna mreža rane i srednje adaptacije.
3. Posle 06d: 10K v2 spreman (prekidač i dalje isključen do odluke vlasnika).
4. 5K: isto pravilo kao N1 i ista pretraga kao N7 (poseban segment).

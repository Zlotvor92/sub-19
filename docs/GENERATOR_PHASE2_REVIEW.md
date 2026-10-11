# SUB-20 — nezavisni pregled faze 2

Datum: 11.10.2026. Pregledani su kompletni `docs/qa/generator-phase2/after.json` i `before.json`, ne samo njihovi sažeci. Kriterijumi i primarni izvori: [GENERATOR_PHASE2_CRITERIA.md](GENERATOR_PHASE2_CRITERIA.md).

Ovo je analiza planova prema javnim trenerskim programima i računici opterećenja, a ne profesionalno odobrenje niti procena individualnog rizika.

## Poreklo podataka i metod

Dodatna istorija u osam ulaza je **sintetička QA pretpostavka**: datum PB-a, ponovljiva dužina, kontinuitet, pauza i iskustvo nisu podaci originalnih korisnika. Before predstavlja generator faze 1, koji ovu novu istoriju nije koristio; after pokazuje uticaj novih pravila nad istim QA scenarijima. Ova promena ne dokazuje šta je najbolji plan za stvarnu osobu sa nepoznatom istorijom.

U tabelama su minute stvarnog radnog dela: intervali = broj × dužina × tempo; fartlek = broj × radne sekunde; tempo = radni km × tempo; progresija = poslednja trećina × tempo; piramida = zbir deonica × tempo. WU/CD, lagani delovi progresije i pauze nisu računati kao kvalitet. Brzi završetak LR je uključen u RP/M zbir. S prikazuje ukupne minute strides odvojeno. Zbir kilometara u tabeli je prikazani nedeljni obim; trka se izdvaja pri oceni taper-a. Razmaci su kalendarski dani, ne stvarni sati izvođenja, koje ulazi nemaju.

## Ocene i poređenje

Ocena „zadovoljava” znači da finalna struktura odgovara proveravanim kriterijumima za ovaj sintetički profil; ne znači da će cilj biti ostvaren. „Ograničeno” znači da plan iskreno zadržava važnu prepreku/neizvesnost. „Neprihvatljivo” označava konkretnu kontradikciju koja mora da se popravi pre zatvaranja faze, ne tvrdnju da je svaka sesija opasna.

| Profil | Vrh km: pre → posle | LR vrh km: pre → posle | Ocena konačnog izlaza | Razlog |
| --- | --- | --- | --- | --- |
| `01_base` | 14 → 12.4 | 5.6 → 4.6 | Ograničeno | Početnički RW i mali, kasnije uveden kvalitet imaju smisla. LR 4,6 km i nepotvrđen kontinuitet nisu dokaz cilja 30:00; ograničenje je vidljivo i na danu trke. |
| `02_base` | 19 → 18.2 | 8.2 → 6.7 | Ograničeno | Povratak posle pauze ima tri lagane uvodne nedelje i stvarne deload-e. Stari PB i LR 6,7 km ograničavaju procenu 10K cilja; vidljiv status traži proveru forme. |
| `04_base` | 41.2 → 43.3 | 14 → 14.5 | Zadovoljava | Kontrolisano uvođenje, potom T i 5K/I stimulans, dve zahtevne sesije i stvarno rasterećenje; nema obećanja sub-20. |
| `05_base` | 55.2 → 56.5 | 15.3 → 16.6 | Zadovoljava | Iskustvo omogućava I/T već u W1; obavezni početni blok R300 je uklonjen. Dužina i doza imaju plafon i lakše nedelje. |
| `07_base` | 46.2 → 50.2 | 15.3 → 19.5 | Zadovoljava uz nepoznato iskustvo HM | LR raste prema 19,5 km sa lakšim nedeljama; T i RP služe HM pripremi. Uloga prvog HM nije dokazano iskustvo iz ulaza. |
| `08_highvol` | 71.9 → 75.3 | 22 → 22 | Zadovoljava | Strukturisani LR zamenjuje q2; završni rad ulazi u ukupnu dozu i ostaju najviše dva zahtevna dana. |
| `09_30km` | 43.1 → 49.1 | 16 → 17.7 | Ograničeno | LR 17,7 km i vrh 49,1 km ne rešavaju punu maratonsku pripremu; preparation i kartica trke to jasno označavaju, bez nasilnog povećanja. |
| `09_base` | 76.8 → 77.3 | 26 → 28 | Zadovoljava uz praćenje visokog opterećenja | Ponovljene dužine 24–28 km, M rad, lakše nedelje i taper čine smisleniji maratonski blok. Najzahtevnija W15 traži praćenje reakcije. |

## Nalazi otklonjeni tokom nezavisnog pregleda

1. Početnički W8 više ne povećava T rad tokom deload-a: nema kvalitetne sesije i obim je 11→8 km.
2. Povratnički W4 više ne uvodi prvi stimulans tokom deload-a: nema kvaliteta i obim je 10,8→8,1 km. W8 takođe ne uvodi novu R sesiju; W12 zadržava prethodni fartlek i smanjuje rad I sa 6 na 3 min bez ubrzavanja.
3. Povratničko upozorenje sada navodi stvarnih 0 kvalitetnih treninga prve nedelje i ograničenje početne dužine/raspodele. Više ne objašnjava deficit nepostojećim kvalitetnim danom.
4. Kartica trke za ograničene profile sada eksplicitno navodi da spremnost nije potvrđena i da je ritam referenca unetog rezultata. Maratonska poruka ne proglašava četiri dana univerzalno nedovoljnim niti kaže da LR mora biti polovina nedelje.

Konačna provera svih osam planova nije našla preostali blokator prethodno definisanih kriterijuma. Svaka označena deload nedelja ima manji ukupni obim; zbir radnih minuta session-a je najviše 60% prethodne nedelje. Nema hard LR u deload nedeljama. Smanjenje broja kvalitetnih sesija u after zbiru stoga uključuje namerno uklonjene stimuluse u rasterećenju i ne označava tihi gubitak kvaliteta.

## Provera svrhe i rasporeda

Za 04/05 glavni blok kombinuje prag i I/5K rad. Višeminutni rad kod iskusnog profila postoji od početka, što je u skladu sa mogućim strukturama BAA 5K; ne mora da kopira isti kalendar ili njihove dodatne moderate dane. 300 m ili piramida nisu samostalni kriterijumi kvaliteta.

Za 07 dužina više ne ostaje na starom plafonu: 10→19,5 km, uz deload-e. Za 08 dve nedelje sa hard LR imaju 5,5 km na 4:30/km (oko 24,8 min) plus oko 22,5 min RP u q1: zbir 47,2 min u dva zahtevna dana. Nema skrivenog trećeg q2. W10 ima 45 min kontrolne sesije i lak LR; ovo je kvalitetna simulacija, ne odvojena prava trka punom snagom.

Manji maraton ostaje ograničen. Viši LR 17,7 km umesto 16 km jeste promena, ali nije dokaz spremnosti. Higdon/BAA nude znatno duža izlaganja u svojim maratonskim strukturama; njihov maksimum nije univerzalni minimum. Veća baza daje ponovljene LR 24/25,5/27/28 km. W15 sadrži I 9,6 min i M završetak 8,5 km (48,3 min): oko 57,9 min ukupnog bržeg rada. Naredna nedelja spušta kvalitet na 0 min i obim 71,1→55,5 km. Veliko opterećenje je vidljivo i periodizovano, ali zahteva povratnu informaciju stvarnog trkača u fazi 3.

Najkraći kalendarski razmak između zahtevnih sesija je dva dana; obično je tri dana. Nedelja sa nedeljnim hard LR i sledećim utorkom daje dva dana, ne automatski puna 48 h. Runna/Higdon/BAA ne opravdavaju univerzalno pravilo da se svaka pojedinačna sesija mora preslikati; ovde je važno da nema skrivenog dodatnog tvrdog dana.

Proporcionalna redukcija obima čuva raspodelu lakih dana i LR, bez povratne spirale koja bi spuštala obim zato što je prethodno uklonjen njegov laki deo. Novi Monday maksimum ne znači da se uvek trči 80% LR. Za ove profile ostaje razuman: npr. iskusni HM nakon hard LR od 22 km dobija ponedeljak 12,2 km lako (oko 64 min), pa utorak kvalitet. Taj dan je ozbiljno lako trčanje, ne kratki oporavak; pratiti zamor i prilagoditi u fazi 3. Nakon kratkog deload LR, ponedeljak može biti duži od te prethodne dužine, jer je reč o vraćanju na običnu nedelju. Nije dodatni kvalitetni dan. Za veći maraton većina Monday sesija je oko 10–12 km posle prethodnog LR 18–28 km; nema univerzalne tvrdnje da je ovaj raspored prikladan za svakog trkača.

Race week za 5K ima lagane shakeout-e i mali R stimulus; za HM/maraton ukupno 10,5 km treninga plus trka. Zato veća ukupna kilometraža poslednje nedelje kod maratona nije neuspeh taper-a. Rad petkom je 6×200 m blizu referentnog trkačkog ritma, sa dugim oporavkom, ne sprint; njegova oznaka R sama ne govori da je tempo brzinski maksimum.

## Šta ostaje nedovršeno

Prognoza brzinskog napretka nije implementirana: `assessmentBasis=current-fitness` i `predictedSec` ostaju referenca rezultata; `preparation` ocenjuje isporučenu izdržljivost, zahtevne dane i ograničenja. Za sub-20/sub-19 status pravilno traži poboljšanje brzine. Za HM 1:35 i veći maraton `reference-only` ne obećava rezultat. `supported` mora biti razumljiv kao heuristički podržana struktura, ne klinička/profesionalna potvrda.

Pauza i datum starog rezultata sada utiču na profil povratnika, ali paces su i dalje približna referenca starog rezultata sa upozorenjem. Bez stvarne kontrolne sesije nema dokaza nove forme. Povratnik ima LR maksimum 6,7 km za 10K: konzervativno i jasno ograničeno, ne kompletna potvrda sposobnosti da istrči 10K za 60 min. Početnik ima LR 4,6 km i race 5 km; dovoljan razlog za nastavak po naporu/hodanju, ne za prognozu 30 min. Automatika ne treba da pretvara broj planiranih nedelja u potvrđen odrađen kontinuitet.

## Nedeljni pregled svih planova

D = deload; Taper = završno smanjenje; Race = trkačka nedelja. RP se prikazuje po oznaci u objektu; kod maratona to je maratonski rad. I/R/T/RP/M su minute rada, S je ukupno strides vreme. LR hard oznaka pokazuje dužinu brzog završetka unutar LR. Pauze su sekunde između deonica, kako ih sesija propisuje.

### `01_base`

Sintetička istorija: LR 3 km; kontinuitet 0 nedelja; pauza 0 nedelja; iskustvo `none`; PB datum 2026-09-13.

| W | Km | LR km | I | R | T | RP | M | S | Režim | Pauze / hard dani |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 7.3 | 2.9 | — | — | — | — | — | 0.0 | Rad | — |
| 2 | 7.7 | 3 | — | — | — | — | — | 0.0 | Rad | — |
| 3 | 8.3 | 3.1 | — | — | — | — | — | 0.0 | Rad | — |
| 4 | 6.1 | 2.3 | — | — | — | — | — | 0.0 | D | — |
| 5 | 9.3 | 3.5 | — | — | — | — | — | 2.0 | Rad | — |
| 6 | 9.6 | 3.8 | — | — | — | — | — | 2.0 | Rad | — |
| 7 | 11 | 4.1 | — | — | 3.0 | — | — | 2.0 | Rad | 90 s; d3 |
| 8 | 8 | 3 | — | — | — | — | — | 1.0 | D | — |
| 9 | 11.7 | 4.3 | 3.0 | — | — | — | — | 2.0 | Rad | 60 s; d3 |
| 10 | 12.4 | 4.6 | 5.3 | — | — | — | — | 2.0 | Rad | 118 s; d3 |
| 11 | 8 | 2.9 | — | — | — | 5.6 | — | 0.0 | Taper | 126 s; d3 |
| 12 | 8 | — | — | — | — | — | — | 0.0 | Race | — |

### `02_base`

Sintetička istorija: LR 4 km; kontinuitet 1 nedelja; pauza 8 nedelja; iskustvo `some`; PB datum 2025-10-12.

| W | Km | LR km | I | R | T | RP | M | S | Režim | Pauze / hard dani |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 10.2 | 4 | — | — | — | — | — | 2.0 | Rad | — |
| 2 | 10.4 | 4.2 | — | — | — | — | — | 2.0 | Rad | — |
| 3 | 10.8 | 4.4 | — | — | — | — | — | 2.0 | Rad | — |
| 4 | 8.1 | 3.2 | — | — | — | — | — | 1.0 | D | — |
| 5 | 12.7 | 4.6 | — | — | 3.0 | — | — | 2.0 | Rad | 90 s; d3 |
| 6 | 13.1 | 4.8 | — | — | 3.0 | — | — | 2.0 | Rad | 90 s; d3 |
| 7 | 13.5 | 5 | 4.5 | — | — | — | — | 2.0 | Rad | 90 s; d3 |
| 8 | 10.2 | 4 | — | — | — | — | — | 1.0 | D | — |
| 9 | 14.5 | 5.3 | 5.1 | — | — | — | — | 2.0 | Rad | 115 s; d3 |
| 10 | 15.3 | 5.7 | — | — | 6.8 | — | — | 2.0 | Rad | 0 s; d3 |
| 11 | 16.5 | 6.1 | 6.0 | — | — | — | — | 2.0 | Rad | 90 s; d3 |
| 12 | 12.3 | 4.5 | 3.0 | — | — | — | — | 1.0 | D | 90 s; d3 |
| 13 | 16 | 6.4 | — | — | 8.5 | — | — | 2.0 | Rad | 0 s; d3 |
| 14 | 18.2 | 6.7 | — | — | — | 12.0 | — | 2.0 | Rad | 240 s; d3 |
| 15 | 10.9 | 4.3 | — | — | — | 7.2 | — | 0.0 | Taper | 162 s; d3 |
| 16 | 14.4 | — | — | — | — | — | — | 0.0 | Race | — |

### `04_base`

Sintetička istorija: LR 10 km; kontinuitet 12 nedelja; pauza 0 nedelja; iskustvo `some`; PB datum 2026-09-20.

| W | Km | LR km | I | R | T | RP | M | S | Režim | Pauze / hard dani |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 31.6 | 10 | — | — | 2.5 | — | — | 2.0 | Rad | 90 s; d3 |
| 2 | 32.7 | 10.8 | — | — | 2.2 | — | — | 2.0 | Rad | 90 s; d3 |
| 3 | 34 | 11.6 | — | 3.9 | 11.0 | — | — | 2.0 | Rad | 196/90 s; d3,5 |
| 4 | 24.8 | 8.4 | — | — | — | — | — | 1.0 | D | — |
| 5 | 37 | 12.5 | 9.1 | — | 12.0 | — | — | 2.0 | Rad | 204/90 s; d3,5 |
| 6 | 38.5 | 13.5 | 5.0 | — | 14.5 | — | — | 2.0 | Rad | 60/0 s; d3,5 |
| 7 | 40.9 | 14.5 | 9.1 | — | 14.0 | — | — | 2.0 | Rad | 204/90 s; d3,5 |
| 8 | 29.9 | 10.6 | — | — | — | — | — | 1.0 | D | — |
| 9 | 43 | 14.5 | 10.4 | — | 14.0 | — | — | 2.0 | Rad | 143/90 s; d3,5 |
| 10 | 43.3 | 14.5 | 7.0 | — | 17.6 | — | — | 2.0 | Rad | 60/0 s; d3,5 |
| 11 | 42.7 | 14.5 | 10.0 | — | 14.0 | — | — | 2.0 | Rad | 224/90 s; d3,5 |
| 12 | 31.1 | 10 | — | — | — | — | — | 1.0 | D | — |
| 13 | 42 | 14.5 | — | — | 13.5 | 9.5 | — | 2.0 | Rad | 214/0 s; d3,5 |
| 14 | 42.7 | 14.5 | 10.9 | — | 13.5 | — | — | 2.0 | Rad | 122/0 s; d3,5 |
| 15 | 23.9 | 8.7 | — | — | 10.0 | 5.7 | — | 0.0 | Taper | 86/0 s; d3,5 |
| 16 | 15.5 | — | — | 2.8 | — | — | — | 0.0 | Race | 141 s; d5 |

### `05_base`

Sintetička istorija: LR 14 km; kontinuitet 24 nedelja; pauza 0 nedelja; iskustvo `experienced`; PB datum 2026-09-20.

| W | Km | LR km | I | R | T | RP | M | S | Režim | Pauze / hard dani |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 51.5 | 14 | 7.9 | — | 13.2 | — | — | 2.0 | Rad | 178/90 s; d2,5 |
| 2 | 53.6 | 15.1 | 9.5 | — | 14.0 | — | — | 2.0 | Rad | 142/90 s; d2,5 |
| 3 | 55.9 | 16.3 | — | 8.0 | 14.0 | — | — | 2.0 | Rad | 171/90 s; d2,5 |
| 4 | 40.3 | 12.2 | — | — | — | — | — | 1.0 | D | — |
| 5 | 51.7 | 16.6 | 9.5 | — | 14.0 | — | — | 2.0 | Rad | 213/90 s; d2,5 |
| 6 | 54.5 | 16.6 | 9.0 | — | 17.5 | — | — | 2.0 | Rad | 60/0 s; d2,5 |
| 7 | 56.5 | 16.6 | 9.5 | — | 14.0 | — | — | 2.0 | Rad | 213/90 s; d2,5 |
| 8 | 40.2 | 12.4 | — | — | — | — | — | 1.0 | D | — |
| 9 | 51.7 | 16.6 | 11.8 | — | 14.0 | — | — | 2.0 | Rad | 178/90 s; d2,5 |
| 10 | 54.5 | 16.6 | 9.0 | — | 18.0 | — | — | 2.0 | Rad | 60/0 s; d2,5 |
| 11 | 56.5 | 16.6 | 9.5 | — | 14.0 | — | — | 2.0 | Rad | 213/90 s; d2,5 |
| 12 | 40.2 | 12.4 | — | — | — | — | — | 1.0 | D | — |
| 13 | 51.7 | 16.6 | — | — | 11.8 | 12.3 | — | 2.0 | Rad | 185/0 s; d2,5 |
| 14 | 54.5 | 16.6 | 14.2 | — | 11.8 | — | — | 2.0 | Rad | 107/0 s; d2,5 |
| 15 | 34.7 | 9.9 | — | — | 11.4 | 4.9 | — | 0.0 | Taper | 74/0 s; d2,5 |
| 16 | 15.5 | — | — | 2.4 | — | — | — | 0.0 | Race | 122 s; d5 |

### `07_base`

Sintetička istorija: LR 10 km; kontinuitet 12 nedelja; pauza 0 nedelja; iskustvo `some`; PB datum 2026-09-20.

| W | Km | LR km | I | R | T | RP | M | S | Režim | Pauze / hard dani |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 32.2 | 10 | — | — | 2.5 | — | — | 2.0 | Rad | 90 s; d3 |
| 2 | 33.8 | 10.8 | — | — | 2.2 | — | — | 2.0 | Rad | 90 s; d3 |
| 3 | 35.9 | 11.6 | 7.3 | — | 10.0 | — | — | 2.0 | Rad | 163/60 s; d3,5 |
| 4 | 27.2 | 8.7 | — | — | — | — | — | 1.0 | D | — |
| 5 | 38.6 | 12.5 | 7.3 | — | 10.0 | — | — | 2.0 | Rad | 163/60 s; d3,5 |
| 6 | 40.1 | 13.5 | 8.0 | — | 15.1 | — | — | 2.0 | Rad | 90/0 s; d3,5 |
| 7 | 42.6 | 14.5 | 7.3 | — | 14.0 | — | — | 2.0 | Rad | 163/60 s; d3,5 |
| 8 | 32.4 | 10.7 | — | — | — | — | — | 1.0 | D | — |
| 9 | 45.7 | 15.6 | 7.3 | — | 14.0 | — | — | 2.0 | Rad | 163/60 s; d3,5 |
| 10 | 47.4 | 16.8 | — | — | 14.0 | 17.6 | — | 2.0 | Rad | 326/60 s; d3,5 |
| 11 | 50.2 | 18.1 | — | — | 17.6 | 17.6 | — | 2.0 | Rad | 326/0 s; d3,5 |
| 12 | 38.3 | 13.3 | — | — | 10.5 | — | — | 1.0 | D | 0 s; d3 |
| 13 | 49.3 | 19.5 | — | — | — | 36.3 | — | 2.0 | Rad | 0 s; d3 |
| 14 | 41.2 | 15.6 | — | — | 14.0 | 17.6 | — | 2.0 | Taper | 326/60 s; d3,5 |
| 15 | 34.6 | 12.6 | — | — | 12.5 | 16.1 | — | 0.0 | Taper | 0/0 s; d3,5 |
| 16 | 31.6 | — | — | 6.1 | — | — | — | 0.0 | Race | 154 s; d5 |

### `08_highvol`

Sintetička istorija: LR 16 km; kontinuitet 24 nedelja; pauza 0 nedelja; iskustvo `experienced`; PB datum 2026-09-20.

| W | Km | LR km | I | R | T | RP | M | S | Režim | Pauze / hard dani |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 53.8 | 16 | — | — | 14.9 | — | — | 2.0 | Rad | 60/60 s; d2,5 |
| 2 | 56.8 | 17.2 | — | — | 16.2 | — | — | 2.0 | Rad | 60/0 s; d2,5 |
| 3 | 61.2 | 18.5 | 9.5 | — | 14.0 | — | — | 2.0 | Rad | 213/60 s; d2,5 |
| 4 | 46.6 | 13.6 | — | — | — | — | — | 1.0 | D | — |
| 5 | 63.3 | 19.9 | 9.5 | — | 14.0 | — | — | 2.0 | Rad | 213/60 s; d2,5 |
| 6 | 68.9 | 21.3 | 12.0 | — | 20.6 | — | — | 2.0 | Rad | 90/0 s; d2,5 |
| 7 | 67.9 | 22 | 9.5 | — | 19.3 | — | — | 2.0 | Rad | 213/75 s; d2,5 |
| 8 | 51.6 | 15.3 | — | — | — | — | — | 1.0 | D | — |
| 9 | 71.1 | 22 (+5.5 hard) | — | — | — | 47.2 | — | 2.0 | Rad | 284 s; d2,7 |
| 10 | 75.3 | 22 | — | — | — | 45.0 | — | 2.0 | Rad | 0 s; d2 |
| 11 | 71.1 | 22 (+5.5 hard) | — | — | — | 47.2 | — | 2.0 | Rad | 284 s; d2,7 |
| 12 | 61.7 | 18.3 | — | — | 19.3 | 22.5 | — | 2.0 | Taper | 284/75 s; d2,5 |
| 13 | 46.1 | 14.3 | — | — | 14.5 | 19.4 | — | 0.0 | Taper | 0/0 s; d2,5 |
| 14 | 31.6 | — | — | 5.3 | — | — | — | 0.0 | Race | 133 s; d5 |

### `09_30km`

Sintetička istorija: LR 10 km; kontinuitet 12 nedelja; pauza 0 nedelja; iskustvo `some`; PB datum 2026-09-20.

| W | Km | LR km | I | R | T | RP | M | S | Režim | Pauze / hard dani |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 32.4 | 10 | — | — | 2.0 | — | — | 2.0 | Rad | 90 s; d3 |
| 2 | 33.9 | 10.8 | — | — | 2.2 | — | — | 2.0 | Rad | 90 s; d3 |
| 3 | 32.5 | 9.7 | — | — | 9.7 | — | — | 2.0 | Rad | 60 s; d3 |
| 4 | 25.4 | 8.1 | — | — | — | — | — | 1.0 | D | — |
| 5 | 36.3 | 11.4 | — | — | 9.7 | — | — | 2.0 | Rad | 60 s; d3 |
| 6 | 34 | 10.2 | — | — | — | 12.5 | — | 2.0 | Rad | 90 s; d3 |
| 7 | 37.6 | 12.3 | — | — | 9.7 | — | — | 2.0 | Rad | 60 s; d3 |
| 8 | 28.8 | 9.2 | — | — | — | — | — | 1.0 | D | — |
| 9 | 36.9 | 11 | — | — | 13.5 | — | — | 2.0 | Rad | 60 s; d3 |
| 10 | 40.7 | 13.2 | — | — | 13.5 | — | — | 2.0 | Rad | 60 s; d3 |
| 11 | 44.2 | 14.2 | — | — | 13.5 | — | — | 2.0 | Rad | 60 s; d3 |
| 12 | 33.2 | 10.6 | — | — | — | — | — | 1.0 | D | — |
| 13 | 47.7 | 15.3 | — | — | 13.5 | — | — | 2.0 | Rad | 60 s; d3 |
| 14 | 47.3 | 16.5 | — | — | 13.5 | 13.6 | — | 2.0 | Rad | 90/60 s; d3,5 |
| 15 | 45.1 | 14.8 | 7.0 | — | 17.9 | — | — | 2.0 | Rad | 157/0 s; d3,5 |
| 16 | 35.5 | 10.7 | — | — | 10.6 | — | — | 1.0 | D | 0 s; d3 |
| 17 | 49.1 | 17.7 | — | — | 17.9 | 14.2 | — | 2.0 | Rad | 0/0 s; d3,5 |
| 18 | 39.3 | 13.8 | — | — | 13.5 | 13.6 | — | 2.0 | Taper | 90/60 s; d3,5 |
| 19 | 31.9 | 11.4 | — | — | — | 14.2 | — | 0.0 | Taper | 0 s; d3 |
| 20 | 52.7 | — | — | 6.7 | — | — | — | 0.0 | Race | 169 s; d5 |

### `09_base`

Sintetička istorija: LR 18 km; kontinuitet 24 nedelja; pauza 0 nedelja; iskustvo `experienced`; PB datum 2026-09-20.

| W | Km | LR km | I | R | T | RP | M | S | Režim | Pauze / hard dani |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 52.2 | 18 | — | — | 12.6 | 10.8 | — | 2.0 | Rad | 0/60 s; d2,5 |
| 2 | 54.8 | 19.4 | — | — | 14.5 | 11.9 | — | 2.0 | Rad | 0/60 s; d2,5 |
| 3 | 56 | 17.4 | — | — | 15.5 | 13.1 | — | 2.0 | Rad | 0/60 s; d2,5 |
| 4 | 43.7 | 14 | — | — | — | — | — | 1.0 | D | — |
| 5 | 60.9 | 20.7 | — | — | 15.5 | 15.5 | — | 2.0 | Rad | 0/60 s; d2,5 |
| 6 | 60.7 | 18.6 | — | — | 15.5 | 16.7 | — | 2.0 | Rad | 0/60 s; d2,5 |
| 7 | 66 | 21.4 | — | — | 22.2 | 17.6 | — | 2.0 | Rad | 0/0 s; d2,5 |
| 8 | 51.5 | 15.5 | — | — | 13.1 | — | — | 1.0 | D | 0 s; d2 |
| 9 | 63 | 19.2 | 9.6 | — | 22.2 | — | — | 2.0 | Rad | 216/0 s; d2,5 |
| 10 | 68.5 | 22.5 | — | — | 21.3 | 17.1 | — | 2.0 | Rad | 90/75 s; d2,5 |
| 11 | 71.3 | 24 | — | — | 22.2 | 17.6 | — | 2.0 | Rad | 0/0 s; d2,5 |
| 12 | 55.9 | 16.5 | — | — | 13.1 | — | — | 1.0 | D | 0 s; d2 |
| 13 | 73.7 | 25.5 | — | — | 22.2 | 17.6 | — | 2.0 | Rad | 0/0 s; d2,5 |
| 14 | 76.1 | 27 | — | — | 21.3 | 17.1 | — | 2.0 | Rad | 90/75 s; d2,5 |
| 15 | 71.1 | 24.3 (+8.5 hard) | 9.6 | — | — | — | 48.3 | 2.0 | Rad | 216 s; d2,7 |
| 16 | 55.5 | 17.1 | — | — | — | — | — | 1.0 | D | — |
| 17 | 77.3 | 28 | — | — | 22.2 | 17.6 | — | 2.0 | Rad | 0/0 s; d2,5 |
| 18 | 61.8 | 21.1 | — | — | 21.3 | 17.1 | — | 2.0 | Taper | 90/75 s; d2,5 |
| 19 | 50.2 | 17.7 | — | — | 17.4 | 17.6 | — | 0.0 | Taper | 0/0 s; d2,5 |
| 20 | 52.7 | — | — | 6.7 | — | — | — | 0.0 | Race | 169 s; d5 |

## Identitet pregledanog izlaza

- `inputs.json` SHA256: `76d3e3d64c9650a0ef1f67169b7b6fb37a961467fe8ecaef4259dd3e79b9e3a7`
- `before.json` SHA256: `a72b54dc1a60cbe3452862409c48bae87d46ac7e23e0444484243a85b9dd222d`
- `after.json` SHA256: `fe03e8815d83359b249e9fffb0a6f901b0092a637884c5f6cbcb1d6c065f1f13`

Promena ovih ulaza ili izlaza zahteva ponovno računanje doza i ocena; ovu verziju ne predstavljati kao pregled naknadno izmenjenog plana.

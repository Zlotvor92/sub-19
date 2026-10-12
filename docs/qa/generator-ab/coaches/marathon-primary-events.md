# Nezavisan primarni pregled deset događaja — maratonski specijalista

Datum: 2026-10-12. Početnih 20 ocena je nepromenjeno; SHA-256: `cb6e47a6f87396ffe7bbd4eb13570829457652aa5f6a9dc9c521d2d365c9868e`. Nema novih početnih ocena. Pregledani su samo dozvoljeni događajni payload-i, sopstveni prethodni rad i već provereni primarni javni izvori. Ovo je sintetička AI/domain procena, bez stvarnog sportiste, browser dokaza ili kliničke validacije.

Klasifikacija: **potvrđena greška** je proverljiva neusaglašenost stvarnog teksta i structured output-a, ili drugih polja istog payload-a; **trenerska zabrinutost** je procena doze, oporavka ili pripreme, bez tvrdnje da je prekršen programski ugovor. Očuvanje deload oznaka nije ovde proglašeno obećanom invarijantom. Procenat povratne baze je aplikaciona postavka i ne tretira se kao validiran medicinski prag.

Poređenja dana koriste identitete, stvarne day objekte i kalendar. DOW u event planovima je 0–6, pa je datum iz start nedelje +DOW. Poređeni su svi dani do i uključujući cutoff. U generisanim primary planovima njih 45 ostaje nepromenjeno; ukupni zbir delimične nedelje uključuje sačuvane, nekada preskočene, stare termine i nije stvarni odrađeni obim. Zato audit daje i future-only kilometre. Mereni/ručni/već završeni budući termini su zasebni protection scenariji, ne događaji stvarne primarne istorije.

## Pokrivenost i ishodi

|ID|Događaj|Stvarni primarni ishod|Presuda|
|---|---|---|---|
|U01|single-miss|Obe verzije i oskudna kontrola daju single-miss, bez regeneracije; nastavak rasporeda bez nadoknade kilometara.|PROLAZ: događaj obrađen proporcionalno i bez nadoknade.|
|U02|underexecution|Reduce uz potvrdu; actual recentWeeklyKm 23 i LR10.8; novi nominalni početak 23 km. Pauza nije zaključena iz skraćenih treninga.|USLOVNI PROLAZ: redukcija i očuvanje su dobri; tekst rasporeda treba popraviti.|
|U03|high-rpe|Reduce uz potvrdu; reported 53.1→starting 45.1 km i LR16.6→14.1. Primary nema merenih novih dokaza forme. U odvojenoj pozitivnoj kontrolnoj evidenciji brži predlog je blokiran.|USLOVNI PROLAZ: blokada ubrzanja radi; fazu oporavka posle visoke RPE treba preispitati.|
|U04|return|Return zahteva potvrdu; 85% eksplicitne 30-kmbaze=25.5 km, LR9.2×.85=7.8; dva početna kalendarska povratna perioda bez strukturisanog kvaliteta.|USLOVNI PROLAZ: povratak smislen; potvrđene greške teksta odstupaju od pravila povratka.|
|U05|goal-change|Obe verzije menjaju cilj 42:00→40:00. Nezavisni diff primary u obe verzije nalazi samo jedan promenjeni dan: tekst trke 31. januara; kilometri i session tempa ostaju isti.|PROLAZ NEW: želja ne proizvodi novu formu; OLD poruka ostaje nejasna.|
|U06|return|Return zahteva potvrdu;15 km×55%=8.3 nominalne baze, četiri početna kalendarska perioda bez structured kvaliteta; budući vrh 10.1 km, LR4 km.|USLOVNI PROLAZ ZA POVRATAK; NEPODRŽANA PUNA10K PRIPREMA. Popraviti tekstualne greške.|
|U07|underexecution|Reduce uz potvrdu; recent 25.7 km i LR8.7. Svi termini su upisani i završeni, nema pauze, preskakanja ili izmišljenog nultog obima.|USLOVNI PROLAZ ZA REDUKCIJU; HM SPREMNOST OSTAJE OGRANIČENA.|
|U08|return|PRIMARY JE ODBIJEN: error navodi manje od 10 nedelja do HM; nema result, nema pomeranja trke 17. januara. SUPPLEMENTAL28. oktobra je odvojeno dopušten i nije zamena za primary.|PRIMARY GATE PROLAZI; PRAKTIČAN POVRATNI FALLBACK NIJE ISPORUČEN. SUPPLEMENTAL ima tekstualne greške.|
|U09|return|Return uz potvrdu;30-km i 10-km LR izričito prijavljene baze skalarno daju 21 km/7 km; tri početna kalendarska perioda bez structured kvaliteta. Trka 28. februara ostaje.|DOBAR OPREZAN POVRATAK U STRUKTURI; NIJE PUNA MARATONSKA PRIPREMA. Tekst sadrži potvrđene nedoslednosti.|
|U10|return|Return uz potvrdu; eksplicitna 60-km/24-km baza postaje 33 km/13.2 km, četiri laka početna kalendarska perioda; originalni cilj 3:30 i datum 28. februara ostaju.|USLOVNI PROLAZ ZA POVRATAK; NEMA DOVOLJNO PONOVLJENE MARATONSKE IZDRŽLJIVOSTI DO OSTAVLJENE TRKE.|

## Najvažniji nalazi

Očuvanje prošlih i zaštićenih stavki prolazi u neposrednim poređenjima input/result: nijedan od 45 primary day objekata pre ili na cutoff-u nije promenjen. U02/U04/U05/U07/U09/U10 dodatne protection kontrole čuvaju completed, manual, alternatives, pomerene datume i locked prediction redove. To dokazuje očuvanje dostavljenih artefakata; ne tvrdi se da sam ponovo izvršio aplikaciju, backend, browser ili integraciju sata.

Potvrđene tekstualne slabosti ponavljaju se: U02/U07 opisuju pauzu koja nije bila događaj; naslovi kvaliteta ostaju kada su session stavke uklonjene; U04/U06/U09/U10 i odvojeni raniji U08 zadržavaju ubrzanja u opisu posle uklanjanja structured strides. Povratni broj lakih nedelja je protivrečan između dayWarnings i adjustment.notes: U04 1/2, U06 2/4, U09 1/3, U10 2/4 i supplemental U08 1/3.

U03 dobro uklanja neposredni petkovni kvalitet i ne ubrzava tempo posle dva laka treninga RPE8. Trenerska zabrinutost je reset faza: prethodni deload 40.2 km počinje 30. novembra, ali novi plan ima 48.8 km i kratak fartlek; novi deload tek 14. decembra. To je zabrinutost za oporavak, ne dokaz kršenja invarijante očuvanja.

U08 primary 25. novembra ostaje odbijen: 53 dana do HM, osam kalendarskih nedelja, nema result. Raniji dopušten datum 28. oktobra služi samo odvojenoj kontroli. Odbijanje punog ciklusa ne potvrđuje da je stari plan sa T4.4 km 27. novembra i LR22 km 29. novembra prikladan posle potvrđene pauze. Potreba za kratkim pregledanim povratnim fallback-om je trenersko/proizvodno pitanje, ne gate bug.

Maratonski povratak kod U09/U10 je oprezan, sa poštenim limited upozorenjima. Ipak U09 ima budući LR najviše 8.8 km, oko 52 min, a U10 17.3 km, oko 106 min; nijedan nema buduću dužinu ≥20 km. To je razvoj povratne baze, ne puna priprema za zadržanu trku 42.195 km 28. februara. Niti je 20 km univerzalna granica, niti koristim zahtev od 32 km: razlog zabrinutosti je celokupan veoma skroman ponovljeni duži rad, mala M doza i vreme na nogama. Izvori S1–S4 podržavaju procenu tih dimenzija, bez individualnog praga završetka.

## U01 — PROLAZ: događaj obrađen proporcionalno i bez nadoknade.

**Događaj i ishod:** Obe verzije i oskudna kontrola daju single-miss, bez regeneracije; nastavak rasporeda bez nadoknade kilometara.

**Struktura:** Početni raspored ostaje. Jedan propušten kvalitet ne pomera nedelje, dužinu ili trku.

**Doza:** Propušteno old 3.5 km T ili new 3.9 km fartlek; nema kompenzacionog dodavanja.

**Oporavak:** Razumna reakcija na jedan propust i nedavno završeno trčanje 23. novembra.

**Koherentnost:** Neupisani treninzi u sparse kontroli ostaju unknown; ne izvodi se pauza ili nulti stvarni obim.

|Datum|Očekivano|Isporučeno|Klasifikacija|
|---|---|---|---|
|2026-11-25|Jedan preskok ne zahteva novi plan.|g 7 d 3 preskočen; adjustment.error ponavlja preporuku da se nastavi bez nadoknade.|confirmed-behavior|

**Potvrđene greške:** Nema potvrđenog defekta u datom primarnom ishodu.

**Trenerske zabrinutosti:** Nema dodatne događajne zabrinutosti.

## U02 — USLOVNI PROLAZ: redukcija i očuvanje su dobri; tekst rasporeda treba popraviti.

**Događaj i ishod:** Reduce uz potvrdu; actual recentWeeklyKm 23 i LR10.8; novi nominalni početak 23 km. Pauza nije zaključena iz skraćenih treninga.

**Struktura:** Prvo se uklanja petkovni kvalitet; prva puna nova nedelja 24.6 km i bez session kvaliteta, zatim mali I/T rad. Budući deload se reindeksira na N10.

**Doza:** Vrhunac 30.5 km, LR12 km; kasni I2×800 m i T2×700 m, umesto ranijeg većeg obima. To je ponovni razvoj baze, ne nadoknada.

**Oporavak:** N8 više nije označen deload, ali stvarni 24.6 km je manje od pređašnjih 29.9 i znatno manje od početnog 40.9. Oporavak je praktično očuvan iako se oznaka pomera.

**Koherentnost:** Tekst lažno kaže posle pauze, a N8 naslov Fartlek nema session. To su potvrđene tekstualne neusaglašenosti.

|Datum|Očekivano|Isporučeno|Klasifikacija|
|---|---|---|---|
|2026-11-30|Bez tvrdnje o pauzi kod dokazanog underexecution-a.|g 8 d 1:6.3 km lako · Postepen povratak posle pauze.|confirmed-defect|
|2026-11-30/2026-12-06|Naslov nedelje treba da opisuje isporučen sadržaj.|N8 focus=Fartlek; sve četiri trkačke sesije su lake/LR bez session.|confirmed-defect|
|2027-01-06|Mali I rad vezati za stvarno podnošljivu bazu.|2×800 m @4:32/km, odmor 2:43; nedelja 30.5 km.|confirmed-behavior|

**Potvrđene greške:** U02-N8: lažna tvrdnja o pauzi i zastareo kvalitetni naslov.

**Trenerske zabrinutosti:** Deload faza je resetovana; nije dokazan ugovor da se prvobitne oznake moraju sačuvati.

### Primary — pregled svih budućih kalendarskih nedelja

|N / početak|Pre km|Posle km|Samo buduće km|LR budući km|Deload pre→posle|Taper|Stvarni budući kvalitet|
|---|---:|---:|---:|---:|---|---|---|
|N7 / 2026-11-23|40.9|32.5|14.3|9.2|False→False|False|Nema session kvaliteta|
|N8 / 2026-11-30|29.9|24.6|24.6|9.4|True→False|False|Nema session kvaliteta|
|N9 / 2026-12-07|43.0|25.5|25.5|10.2|False→False|False|2026-12-09 Piramida/I 0.9 km @272s/km, odmor61s; 2026-12-11 Tempo isprekidan/T 1.0 km @301s/km, odmor90s|
|N10 / 2026-12-14|43.3|18.6|18.6|7.3|False→True|False|Nema session kvaliteta|
|N11 / 2026-12-21|42.7|26.7|26.7|10.7|False→False|False|2026-12-23 Intervali/I 1.0 km @272s/km, odmor102s; 2026-12-25 Tempo isprekidan/T 1.2 km @301s/km, odmor90s|
|N12 / 2026-12-28|31.1|28.6|28.6|11.3|True→False|False|2026-12-30 Fartlek/I 0.882 km @272s/km, odmor60s; 2027-01-01 Tempo/T 2.1 km @301s/km, odmor0s|
|N13 / 2027-01-04|42.0|30.5|30.5|11.8|False→False|False|2027-01-06 Intervali/I 1.6 km @272s/km, odmor163s; 2027-01-08 Tempo isprekidan/T 1.4 km @301s/km, odmor90s|
|N14 / 2027-01-11|42.7|30.2|30.2|12|False→False|False|2027-01-13 Intervali/I 1.2 km @272s/km, odmor122s; 2027-01-15 Tempo/T 2.2 km @301s/km, odmor0s|
|N15 / 2027-01-18|23.9|19.6|19.6|7.2|False→False|True|2027-01-20 Trkački ritam/RP 1.2 km @285s/km, odmor86s; 2027-01-22 Tempo/T 1.2 km @301s/km, odmor0s|
|N16 / 2027-01-25|15.5|12.8|12.8|0|False→False|False|2027-01-29 Repeticije/R 0.6 km @281s/km, odmor141s; trka je izdvojena iz trenažnog vrha|

Puni budući periodi sa zastarelim kvalitetnim naslovom: N8 / 2026-11-30 / Fartlek.

## U03 — USLOVNI PROLAZ: blokada ubrzanja radi; fazu oporavka posle visoke RPE treba preispitati.

**Događaj i ishod:** Reduce uz potvrdu; reported 53.1→starting 45.1 km i LR16.6→14.1. Primary nema merenih novih dokaza forme. U odvojenoj pozitivnoj kontrolnoj evidenciji brži predlog je blokiran.

**Struktura:** Prvi budući kvalitet 27. novembra postaje lako trčanje. Ipak predviđeni deload N8(40.2 km) postaje 48.8 km sa kratkim fartlekom; deload dolazi tek N10.

**Doza:** N8 T3×45 s; N9 I1.8 km/T2.2 km. Kasnije se vraća 56.5 km maksimum. Početna redukcija kvaliteta je smislenija od samog broja kilometara.

**Oporavak:** Posle dva laka treninga RPE8 uklanjanje najbližeg kvaliteta je dobro. Gubitak ranije predviđenog deload-a nedelju posle događaja traži trenersku proveru, iako 48.8 ostaje ispod recent 53.1.

**Koherentnost:** Nema izmišljenog bržeg tempa ili lažne pauze. ResetconsistentWeeks na 0 je konzervativan, ali gubi prethodno prijavljen kontinuitet; budući RPE odziv je nepoznat.

|Datum|Očekivano|Isporučeno|Klasifikacija|
|---|---|---|---|
|2026-11-27|Posle ponovljenog visokog RPE na lakom trčanju smanjiti najbliži kvalitet.|T sesija postaje 8.2 km lako.|confirmed-behavior|
|2026-11-30/2026-12-06|Sačuvati svrhu skoro predviđenog oporavka ili obrazložiti pomeranje.|N8: deload 40.2→48.8 km bez deload oznake; fartlek 2.25 min rada 1. decembra.|coaching-concern|
|2026-12-28/2027-01-03|Proveriti da problem RPE nije i dalje prisutan.|Prethodni deload N12=40.2 km sada 54.3 km sa I/T; sledeći vrh 56.5 km.|coaching-concern|

**Potvrđene greške:** Nema potvrđenog defekta u datom primarnom ishodu.

**Trenerske zabrinutosti:** Reset deload faze posle prijavljenog visokog RPE. Nije potvrđeno kršenje preservation ugovora; trenerska zabrinutost je oporavak.

### Primary — pregled svih budućih kalendarskih nedelja

|N / početak|Pre km|Posle km|Samo buduće km|LR budući km|Deload pre→posle|Taper|Stvarni budući kvalitet|
|---|---:|---:|---:|---:|---|---|---|
|N7 / 2026-11-23|56.5|54.2|22.3|14.1|False→False|False|Nema session kvaliteta|
|N8 / 2026-11-30|40.2|48.8|48.8|14.9|True→False|False|2026-12-01 Fartlek/T 0.513 km @263s/km, odmor90s|
|N9 / 2026-12-07|51.7|50.3|50.3|15.7|False→False|False|2026-12-08 Piramida/I 1.8 km @237s/km, odmor107s; 2026-12-11 Tempo isprekidan/T 2.2 km @263s/km, odmor90s|
|N10 / 2026-12-14|54.5|36.6|36.6|11.6|False→True|False|Nema session kvaliteta|
|N11 / 2026-12-21|56.5|52.8|52.8|16.6|False→False|False|2026-12-22 Intervali/I 2.2 km @237s/km, odmor196s; 2026-12-25 Tempo isprekidan/T 2.8 km @263s/km, odmor90s|
|N12 / 2026-12-28|40.2|54.3|54.3|16.6|True→False|False|2026-12-29 Fartlek/I 1.519 km @237s/km, odmor60s; 2027-01-01 Tempo/T 3.1 km @263s/km, odmor0s|
|N13 / 2027-01-04|51.7|56.5|56.5|16.6|False→False|False|2027-01-05 Intervali/I 2.4 km @237s/km, odmor213s; 2027-01-08 Tempo isprekidan/T 3.2 km @263s/km, odmor90s|
|N14 / 2027-01-11|54.5|54.2|54.2|16.6|False→False|False|2027-01-12 Intervali/I 3.0 km @237s/km, odmor107s; 2027-01-15 Tempo/T 2.2 km @263s/km, odmor0s|
|N15 / 2027-01-18|34.7|34.1|34.1|9.9|False→False|True|2027-01-19 Trkački ritam/RP 1.2 km @247s/km, odmor74s; 2027-01-22 Tempo/T 2.1 km @263s/km, odmor0s|
|N16 / 2027-01-25|15.5|15.5|15.5|0|False→False|False|2027-01-29 Repeticije/R 0.6 km @243s/km, odmor122s; trka je izdvojena iz trenažnog vrha|

## U04 — USLOVNI PROLAZ: povratak smislen; potvrđene greške teksta odstupaju od pravila povratka.

**Događaj i ishod:** Return zahteva potvrdu; 85% eksplicitne 30-kmbaze=25.5 km, LR9.2×.85=7.8; dva početna kalendarska povratna perioda bez strukturisanog kvaliteta.

**Struktura:** Prva buduća trčanja 27/29. novembra su 4.8/7.8 km. Prva puna nedelja 26.4 km. N9 kratki fartlek, zatim progresivno mali I/T rad i 10K taper.

**Doza:** Vrh 32.2 km/LR10.7 km; odgovara povratku i ostavlja ograničenu brzinsku pripremu.

**Oporavak:** Postupnost je dobra. Strukturisani strides jesu uklonjeni, ali opis nalaže ubrzanja baš u početnim lakim nedeljama.

**Koherentnost:** DayWarnings kaže jednu laganu povratnu nedelju, notes dve. N8 naslovFartlek je prazan.

|Datum|Očekivano|Isporučeno|Klasifikacija|
|---|---|---|---|
|2026-11-27|Ako je kvalitet/ubrzanje uklonjeno, opis ne treba da ga nalaže.|4.8 km lako sa tekstom 6×20 s ubrzanja; nema strides/session.|confirmed-defect|
|2026-11-30|Opisi i naslov treba da budu laki.|g 8 d 1 tekst 6×20 s; N8 focus Fartlek bez kvaliteta.|confirmed-defect|
|2026-11-25|Jedan broj početnih lakih nedelja u svim porukama.|Meta dayWarnings:1; adjustment.notes:2.|confirmed-defect|

**Potvrđene greške:** Dve početne buduće stride instrukcije preživele su uklanjanje structured strides. Zastareo naslovFartlek i protivrečno 1/2 trajanje lakog povratka.

**Trenerske zabrinutosti:** 85% je aplikaciona postavka, ne individualno medicinski potvrđen prag.

### Primary — pregled svih budućih kalendarskih nedelja

|N / početak|Pre km|Posle km|Samo buduće km|LR budući km|Deload pre→posle|Taper|Stvarni budući kvalitet|
|---|---:|---:|---:|---:|---|---|---|
|N7 / 2026-11-23|35.9|28.9|12.6|7.8|False→False|False|Nema session kvaliteta|
|N8 / 2026-11-30|26.5|26.4|26.4|8.2|True→False|False|Nema session kvaliteta|
|N9 / 2026-12-07|39.0|27.6|27.6|8.6|False→False|False|2026-12-09 Fartlek/T 0.427 km @316s/km, odmor90s|
|N10 / 2026-12-14|40.3|20.0|20.0|6.4|False→True|False|Nema session kvaliteta|
|N11 / 2026-12-21|42.6|29.7|29.7|9.1|False→False|False|2026-12-23 Intervali/I 1.0 km @285s/km, odmor107s; 2026-12-25 Tempo/T 1.7 km @316s/km, odmor0s|
|N12 / 2026-12-28|32.0|30.7|30.7|9.6|True→False|False|2026-12-30 Intervali/I 1.4 km @285s/km, odmor150s; 2027-01-01 Tempo isprekidan/T 1.2 km @316s/km, odmor90s|
|N13 / 2027-01-04|42.2|32.2|32.2|10.1|False→False|False|2027-01-06 Fartlek/I 1.263 km @285s/km, odmor90s; 2027-01-08 Tempo/T 2.2 km @316s/km, odmor0s|
|N14 / 2027-01-11|43.8|31.6|31.6|10.7|False→False|False|2027-01-13 Trkački ritam/RP 2.0 km @311s/km, odmor233s; 2027-01-15 Progresivno/T 1.567 km @316s/km, odmor0s|
|N15 / 2027-01-18|28.0|20.5|20.5|6.9|False→False|True|2027-01-20 Trkački ritam/RP 1.2 km @311s/km, odmor140s|
|N16 / 2027-01-25|20.5|17.5|17.5|0|False→False|False|Nema session kvaliteta; trka je izdvojena iz trenažnog vrha|

Dokaz zadržanog stride teksta bez polja:
- 2026-11-27 g7d5: 4.8 km lako (Z2) @ ~6:20/km + 6×20 s ubrzanja (lagani ubrzani koraci, pun oporavak)
- 2026-11-30 g8d1: 6.2 km lako (Z2) @ ~6:20/km + 6×20 s ubrzanja (lagani ubrzani koraci, pun oporavak)

Puni budući periodi sa zastarelim kvalitetnim naslovom: N8 / 2026-11-30 / Fartlek.

## U05 — PROLAZ NEW: želja ne proizvodi novu formu; OLD poruka ostaje nejasna.

**Događaj i ishod:** Obe verzije menjaju cilj 42:00→40:00. Nezavisni diff primary u obe verzije nalazi samo jedan promenjeni dan: tekst trke 31. januara; kilometri i session tempa ostaju isti.

**Struktura:** Deload i kvalitetni raspored se ne pogoršavaju zbog agresivnije želje. NewchangedWeeks=1 odgovara stvarnom danu; oldchangedWeeks=10 je šira metrika rekonstruisanih nedelja, ne deset promenjenih treninga.

**Doza:** I/T/RP rad ne postaje brži. NewtrainingVdot 45.3 i reference 2700 s ostaju, iako je cilj 40 min.

**Oporavak:** Nema povećanja stresa samo zbog novog cilja. Zaštićene ručne/mere/future-done/moved stavke ostaju.

**Koherentnost:** New jasno piše željeni 40:00 i referentni ritam 4:30(~45 min). Old piše cilj 40:00/ritam 4:30 bez jasnog objašnjenja, i dalje sa modeliranim napretkomvdot 48.8.

|Datum|Očekivano|Isporučeno|Klasifikacija|
|---|---|---|---|
|2027-01-31|Željeni cilj razlikovati od potvrđene forme.|NEW: željeni 40:00 · preporučeni 4:30/km oko 45:00; OLD: cilj 40:00/ritam 4:30.|confirmed-behavior|
|2026-12-08|Ručnu korekciju sačuvati pri promeni cilja.|Zaštićeni g 9 d 2 ostaje 5×200 mR sa explicit overrides.|confirmed-behavior|

**Potvrđene greške:** OLD ima potvrđenu dvosmislenu poruku:40 min cilj i 45 min ritam; to je tekstualna slabost, ne povećanje doze.

**Trenerske zabrinutosti:** Početne zamerke na ukupni trening ostaju iz zamrznutog pregleda; ne ocenjujem ih ponovo numerički.

### OLD primary — pregled svih budućih kalendarskih nedelja

|N / početak|Pre km|Posle km|Samo buduće km|LR budući km|Deload pre→posle|Taper|Stvarni budući kvalitet|
|---|---:|---:|---:|---:|---|---|---|
|N7 / 2026-11-23|60.9|60.9|29.6|18.4|False→False|False|2026-11-27 Tempo isprekidan/T 6.0 km @276s/km, odmor90s|
|N8 / 2026-11-30|45.7|45.7|45.7|13.7|True→True|False|2026-12-01 Oštrina/R 1.2 km @240s/km, odmor120s|
|N9 / 2026-12-07|62.3|62.3|62.3|18.5|False→False|False|2026-12-08 Piramida/I 3.6 km @249s/km, odmor224s; 2026-12-11 Tempo isprekidan/T 6.0 km @276s/km, odmor90s|
|N10 / 2026-12-14|66.3|66.3|66.3|18.5|False→False|False|2026-12-15 Fartlek/I 3.976 km @249s/km, odmor90s; 2026-12-18 Tempo/T 5.4 km @276s/km, odmor0s|
|N11 / 2026-12-21|65.6|65.6|65.6|18.5|False→False|False|2026-12-22 Intervali/I 3.6 km @249s/km, odmor224s; 2026-12-25 Tempo isprekidan/T 6.0 km @276s/km, odmor90s|
|N12 / 2026-12-28|49.3|49.3|49.3|14.9|True→True|False|2026-12-29 Oštrina/R 1.2 km @240s/km, odmor120s|
|N13 / 2027-01-04|64.0|64.0|64.0|18.5|False→False|False|2027-01-05 Trkački ritam/RP 6.0 km @270s/km, odmor60s; 2027-01-08 Progresivno/T 4.133 km @276s/km, odmor0s|
|N14 / 2027-01-11|64.4|64.4|64.4|18.5|False→False|False|2027-01-12 Trkački ritam/RP 4.8 km @270s/km, odmor75s; 2027-01-15 Tempo/T 5.4 km @276s/km, odmor0s|
|N15 / 2027-01-18|43.2|43.2|43.2|12|False→False|True|2027-01-19 Trkački ritam/RP 1.8 km @270s/km, odmor75s; 2027-01-22 Tempo/T 4 km @276s/km, odmor0s|
|N16 / 2027-01-25|20.5|20.5|20.5|0|False→False|False|2027-01-29 Repeticije/R 1.0 km @266s/km, odmor133s; trka je izdvojena iz trenažnog vrha|

### NEW primary — pregled svih budućih kalendarskih nedelja

|N / početak|Pre km|Posle km|Samo buduće km|LR budući km|Deload pre→posle|Taper|Stvarni budući kvalitet|
|---|---:|---:|---:|---:|---|---|---|
|N7 / 2026-11-23|62.1|62.1|27.8|18.5|False→False|False|2026-11-27 Tempo isprekidan/T 3.6 km @276s/km, odmor90s|
|N8 / 2026-11-30|46.6|46.6|46.6|13.8|True→True|False|Nema session kvaliteta|
|N9 / 2026-12-07|65.1|65.1|65.1|18.5|False→False|False|2026-12-08 Piramida/I 3.0 km @249s/km, odmor187s; 2026-12-11 Tempo isprekidan/T 3.6 km @276s/km, odmor90s|
|N10 / 2026-12-14|68.2|68.2|68.2|18.5|False→False|False|2026-12-15 Fartlek/I 3.253 km @249s/km, odmor90s; 2026-12-18 Tempo/T 4.8 km @276s/km, odmor0s|
|N11 / 2026-12-21|65.2|65.2|65.2|18.5|False→False|False|2026-12-22 Intervali/I 2.4 km @249s/km, odmor224s; 2026-12-25 Tempo isprekidan/T 4.0 km @276s/km, odmor90s|
|N12 / 2026-12-28|48.9|48.9|48.9|13.2|True→True|False|Nema session kvaliteta|
|N13 / 2027-01-04|65.6|65.6|65.6|18.5|False→False|False|2027-01-05 Trkački ritam/RP 3.6 km @270s/km, odmor240s; 2027-01-08 Progresivno/T 3.933 km @276s/km, odmor0s|
|N14 / 2027-01-11|65.9|65.9|65.9|18.5|False→False|False|2027-01-12 Trkački ritam/RP 3.2 km @270s/km, odmor240s; 2027-01-15 Tempo/T 4.8 km @276s/km, odmor0s|
|N15 / 2027-01-18|40.9|40.9|40.9|12|False→False|True|2027-01-19 Trkački ritam/RP 1.2 km @270s/km, odmor122s; 2027-01-22 Tempo/T 3.3 km @276s/km, odmor0s|
|N16 / 2027-01-25|20.5|20.5|20.5|0|False→False|False|2027-01-29 Repeticije/R 1.0 km @266s/km, odmor133s; trka je izdvojena iz trenažnog vrha|

## U06 — USLOVNI PROLAZ ZA POVRATAK; NEPODRŽANA PUNA10K PRIPREMA. Popraviti tekstualne greške.

**Događaj i ishod:** Return zahteva potvrdu;15 km×55%=8.3 nominalne baze, četiri početna kalendarska perioda bez structured kvaliteta; budući vrh 10.1 km, LR4 km.

**Struktura:** Vrlo mali povratni obim i postepene dužine. Većina planiranih session kvaliteta se uklanja zbog budžeta; prvi preostali RP dolazi 20. januara.

**Doza:** Najduža 4 km, zatim 10 km trka 31. januara; to je povratak navici, veoma ograničena 10K priprema.

**Oporavak:** Strukturisani lak početak je razuman posle duge pauze. Dve stride instrukcije ipak ostaju u tekstu; star PB nije aktuelna potvrda forme.

**Koherentnost:** Broj lakih nedelja 2 u dayWarnings naspram 4 u notes; pet punih nedelja saFartlek/Tempo/Progresivno naslovima nema session kvalitet.

|Datum|Očekivano|Isporučeno|Klasifikacija|
|---|---|---|---|
|2026-11-30|Lak povratak ne treba da nalaže uklonjena ubrzanja.|2.2 km lako sa tekstom 6×20 s ubrzanja; strides i session odsutni.|confirmed-defect|
|2026-12-14|Strides opis treba ukloniti zajedno sa poljem.|2.1 km sa 4×15 s u opisu, bez strides.|confirmed-defect|
|2027-01-17/2027-01-31|Proceniti razliku između povratnog kapaciteta i trke.|Najveći LR4 km 17. januara;31. januara trka 10 km.|coaching-concern|
|2026-11-25|Dosledan broj lakih povratnih nedelja.|Warnings 2, notes 4; buduće strukture bez session kroz 20. decembar.|confirmed-defect|

**Potvrđene greške:** Dve zastarele stride instrukcije. Pet zastarelih kvalitetnih naslova nakon uklanjanja session rada. Protivrečno 2/4 trajanje lakog povratka; dayWarningsvrh 11.6 km naspram finalpreparation 10.1 km.

**Trenerske zabrinutosti:** Trka ostaje 2.5× najveća buduća dužina; limited poruka to priznaje, ali ne obezbeđuje završetak.

### Primary — pregled svih budućih kalendarskih nedelja

|N / početak|Pre km|Posle km|Samo buduće km|LR budući km|Deload pre→posle|Taper|Stvarni budući kvalitet|
|---|---:|---:|---:|---:|---|---|---|
|N7 / 2026-11-23|13.5|11.0|2.5|2.5|False→False|False|Nema session kvaliteta|
|N8 / 2026-11-30|10.2|7.5|7.5|2.9|True→False|False|Nema session kvaliteta|
|N9 / 2026-12-07|14.5|8.0|8.0|3|False→False|False|Nema session kvaliteta|
|N10 / 2026-12-14|15.3|6.8|6.8|2.6|False→True|False|Nema session kvaliteta|
|N11 / 2026-12-21|16.5|8.4|8.4|3.1|False→False|False|Nema session kvaliteta|
|N12 / 2026-12-28|12.3|8.9|8.9|3.3|True→False|False|Nema session kvaliteta|
|N13 / 2027-01-04|16.0|9.5|9.5|3.5|False→False|False|Nema session kvaliteta|
|N14 / 2027-01-11|18.2|10.1|10.1|4|False→False|False|Nema session kvaliteta|
|N15 / 2027-01-18|10.9|9.3|9.3|3.4|False→False|True|2027-01-20 Trkački ritam/RP 1.2 km @360s/km, odmor162s|
|N16 / 2027-01-25|14.4|12.4|12.4|0|False→False|False|Nema session kvaliteta; trka je izdvojena iz trenažnog vrha|

Dokaz zadržanog stride teksta bez polja:
- 2026-11-30 g8d1: 2.2 km lako (Z2) @ ~6:47/km + 6×20 s ubrzanja (lagani ubrzani koraci, pun oporavak)
- 2026-12-14 g10d1: 2.1 km lako (Z2) @ ~6:47/km + 4×15 s ubrzanja (lagani ubrzani koraci)

Puni budući periodi sa zastarelim kvalitetnim naslovom: N9 / 2026-12-07 / Fartlek; N11 / 2026-12-21 / Fartlek; N12 / 2026-12-28 / Fartlek; N13 / 2027-01-04 / Tempo; N14 / 2027-01-11 / Progresivno.

## U07 — USLOVNI PROLAZ ZA REDUKCIJU; HM SPREMNOST OSTAJE OGRANIČENA.

**Događaj i ishod:** Reduce uz potvrdu; recent 25.7 km i LR8.7. Svi termini su upisani i završeni, nema pauze, preskakanja ili izmišljenog nultog obima.

**Struktura:** Do 20. decembra praktično lako trčanje/LR; jedan mali T21–27. decembra, zatim kontrolisani 5-km HM-rad 30. decembra i mali RP/T.

**Doza:** Budući vrh 36 km, LR11.4 km(~70 min). Izdržljivost za HM105+ min je ograničena; poštena limited poruka je važna.

**Oporavak:** Oprezan pad kvaliteta i obima odgovara stvarnim manjim kilometrima; fazni reset ukida prvobitni N8 deload oznaku, ali 27.6 km je niže od 32.4 km.

**Koherentnost:** Tekst lažno kaže povratak posle pauze; N8Fartlek i N9 Tempo isprekidan su zastareli naslovi bez session rada.

|Datum|Očekivano|Isporučeno|Klasifikacija|
|---|---|---|---|
|2026-11-30|Ne tvrditi pauzu kada je svaki trening odrađen sa manjom kilometražom.|6.8 km lako · Postepen povratak posle pauze.|confirmed-defect|
|2026-12-07/2026-12-13|Naslov mora odgovarati radu.|N9 Tempo isprekidan, ali sva 4 trkačka dana su lako/LR bez session.|confirmed-defect|
|2027-01-10/2027-01-31|Ponovljiv HM kapacitet proceniti odvojeno od PB-a.|LR11.4 km i potom 21.0975 km trka; biggest LR~70 min.|coaching-concern|

**Potvrđene greške:** Lažna pauza uopisima i dva zastarela kvalitetna naslova.

**Trenerske zabrinutosti:** Nedovoljno dužeg vremena na nogama za puni HM pokušaj; ne predviđa se individualna verovatnoća završetka.

### Primary — pregled svih budućih kalendarskih nedelja

|N / početak|Pre km|Posle km|Samo buduće km|LR budući km|Deload pre→posle|Taper|Stvarni budući kvalitet|
|---|---:|---:|---:|---:|---|---|---|
|N7 / 2026-11-23|42.6|33.7|14.8|8.7|False→False|False|Nema session kvaliteta|
|N8 / 2026-11-30|32.4|27.6|27.6|8.9|True→False|False|Nema session kvaliteta|
|N9 / 2026-12-07|45.7|29.7|29.7|9.6|False→False|False|Nema session kvaliteta|
|N10 / 2026-12-14|47.4|22.5|22.5|7.2|False→True|False|Nema session kvaliteta|
|N11 / 2026-12-21|50.2|32.1|32.1|10.2|False→False|False|2026-12-23 Tempo isprekidan/T 1.2 km @301s/km, odmor60s|
|N12 / 2026-12-28|38.3|33.7|33.7|10.8|True→False|False|2026-12-30 Kontrolna trka/RP 5 km @311s/km, odmor0s|
|N13 / 2027-01-04|49.3|36.0|36.0|11.4|False→False|False|2027-01-06 Tempo trke/RP 2.8 km @311s/km, odmor326s; 2027-01-08 Tempo/T 2.4 km @301s/km, odmor0s|
|N14 / 2027-01-11|41.2|28.9|28.9|9.6|False→False|True|2027-01-13 Tempo/T 2.1 km @301s/km, odmor0s|
|N15 / 2027-01-18|34.6|21.8|21.8|7.4|False→False|True|2027-01-20 Tempo trke/RP 1.6 km @311s/km, odmor0s|
|N16 / 2027-01-25|31.5975|31.0975|31.0975|0|False→False|False|2027-01-29 Repeticije/R 1.2 km @307s/km, odmor154s; trka je izdvojena iz trenažnog vrha|

Puni budući periodi sa zastarelim kvalitetnim naslovom: N8 / 2026-11-30 / Fartlek; N9 / 2026-12-07 / Tempo isprekidan.

## U08 — PRIMARY GATE PROLAZI; PRAKTIČAN POVRATNI FALLBACK NIJE ISPORUČEN. SUPPLEMENTAL ima tekstualne greške.

**Događaj i ishod:** PRIMARY JE ODBIJEN: error navodi manje od 10 nedelja do HM; nema result, nema pomeranja trke 17. januara. SUPPLEMENTAL28. oktobra je odvojeno dopušten i nije zamena za primary.

**Struktura:** Primarno nema novog povratnog rasporeda. Raniji kontrolni scenario ima 38.5 nominalnu bazu, tri laka kalendarska povratna perioda i budući vrh 49 km/LR15.3 km.

**Doza:** Primary doza nije generisana; ne pripisujem joj ranije dozvoljeni raspored. U ranijem kontrolnom scenariju kvalitet ostaje skroman.

**Oporavak:** Za odbijeni datum važan je bezbedan pregled postojećeg budućeg rasporeda: stari 27. novembar T4.4 km i 29. novembar LR22 km ne postaju povratno primereni samo zato što je novi ciklus odbijen.

**Koherentnost:** Primary poruka i nema rezultata su dosledni. Raniji control ima tri zastarele stride instrukcije, dva praznaFartlek naslova i warning 1/notes 3.

|Datum|Očekivano|Isporučeno|Klasifikacija|
|---|---|---|---|
|2026-11-25|Jasno odbiti puni ciklus ako primenjeni minimum nije dostignut i ne pomeriti trku.|53 dana,8 kalendarskih nedelja; adjustment samoerror, datum 17. januara isti.|confirmed-behavior|
|2026-11-27/2026-11-29|Odbijanje regeneracije ne treba tumačiti kao odobrenje nastavka starih opterećenja.|Postojeći plan ostaje sa T4.4 km i LR22 km posle 14-dnevne pauze.|coaching-concern|
|2026-10-30|SUPPLEMENTAL: ukloniti tekst ubrzanja u lakom povratku.|5.9 km lako sa 6×20 s u tekstu, bez strides/session.|confirmed-defect|

**Potvrđene greške:** PRIMARY: nema potvrđenog defekta gate-a ili očuvanja. SUPPLEMENTAL ONLY: stride tekst i kvalitetni naslovi nisu ažurirani;1/3 broj nedelja nije dosledan.

**Trenerske zabrinutosti:** Neisporučen kratki povratni fallback na stvarnom datumu događaja; to je coaching/product concern, ne dokaz da guard ne radi.

### SUPPLEMENTAL ONLY, cutoff2026-10-28 — pregled svih budućih kalendarskih nedelja

|N / početak|Pre km|Posle km|Samo buduće km|LR budući km|Deload pre→posle|Taper|Stvarni budući kvalitet|
|---|---:|---:|---:|---:|---|---|---|
|N3 / 2026-10-26|61.2|49.9|17.1|11.2|False→False|False|Nema session kvaliteta|
|N4 / 2026-11-02|46.6|39.3|39.3|11.8|True→False|False|Nema session kvaliteta|
|N5 / 2026-11-09|63.3|40.9|40.9|12.5|False→False|False|Nema session kvaliteta|
|N6 / 2026-11-16|68.9|30.9|30.9|9.3|False→True|False|Nema session kvaliteta|
|N7 / 2026-11-23|67.9|43.0|43.0|13.2|False→False|False|2026-11-24 Intervali/I 1.2 km @237s/km, odmor107s; 2026-11-27 Tempo/T 2.1 km @263s/km, odmor0s|
|N8 / 2026-11-30|51.6|44.1|44.1|13.9|True→False|False|2026-12-01 Intervali/I 1.4 km @237s/km, odmor124s; 2026-12-04 Tempo isprekidan/T 2.0 km @263s/km, odmor60s|
|N9 / 2026-12-07|71.1|46.1|46.1|14.7|False→False|False|2026-12-08 Fartlek/I 1.519 km @237s/km, odmor90s; 2026-12-11 Tempo/T 2.7 km @263s/km, odmor0s|
|N10 / 2026-12-14|75.3|34.9|34.9|11|False→True|False|2026-12-15 Tempo/T 1.6 km @263s/km, odmor0s|
|N11 / 2026-12-21|71.1|49.0|49.0|15.3|False→False|False|2026-12-22 Kontrolna trka/RP 7 km @270s/km, odmor0s|
|N12 / 2026-12-28|61.7|40.0|40.0|13|False→False|True|2026-12-29 Tempo trke/RP 2.8 km @270s/km, odmor284s; 2027-01-01 Tempo/T 2.9 km @263s/km, odmor0s|
|N13 / 2027-01-04|46.1|32.8|32.8|9.9|False→False|True|2027-01-05 Tempo trke/RP 2.4 km @270s/km, odmor0s; 2027-01-08 Tempo/T 1.9 km @263s/km, odmor0s|
|N14 / 2027-01-11|31.5975|30.0975|30.0975|0|False→False|False|Nema session kvaliteta; trka je izdvojena iz trenažnog vrha|

Dokaz zadržanog stride teksta bez polja:
- 2026-10-30 g3d5: 5.9 km lako (Z2) @ ~5:16/km + 6×20 s ubrzanja (lagani ubrzani koraci, pun oporavak)
- 2026-11-02 g4d1: 7.1 km lako (Z2) @ ~5:16/km + 6×20 s ubrzanja (lagani ubrzani koraci, pun oporavak)
- 2026-11-09 g5d1: 7.5 km lako (Z2) @ ~5:16/km + 6×20 s ubrzanja (lagani ubrzani koraci, pun oporavak)

Puni budući periodi sa zastarelim kvalitetnim naslovom: N4 / 2026-11-02 / Fartlek; N5 / 2026-11-09 / Fartlek.

## U09 — DOBAR OPREZAN POVRATAK U STRUKTURI; NIJE PUNA MARATONSKA PRIPREMA. Tekst sadrži potvrđene nedoslednosti.

**Događaj i ishod:** Return uz potvrdu;30-km i 10-km LR izričito prijavljene baze skalarno daju 21 km/7 km; tri početna kalendarska perioda bez structured kvaliteta. Trka 28. februara ostaje.

**Struktura:** Prvo laka baza; naknadno mnogi kvaliteti uklonjeni zbog budžeta. Deloadi su N10/N14, dva taper perioda i raceweek. Nema ponovljenih dugih maratonskih izlaganja iliMLR.

**Doza:** Budući vrh 29 km, LR8.8 km(~52 min), nijedna buduća dužina≥20 km; samo 1.8 km M u dve taper nedelje.

**Oporavak:** Povratni rast je mali i ne nadoknađuje propuste. Ali vrlo skromna dužina do trke ne rešava maratonsku izdržljivost. Sačuvani ručni kvalitet 9. decembra ucontrol-u je izuzetak očuvanja uz warning, ne kvar primary policy.

**Koherentnost:** Limited se jasno priznaje. Ipak postoje stride instrukcije u tri početna povratna dana, pet zastarelih kvalitetnih naslova i warning 1/notes 3.

|Datum|Očekivano|Isporučeno|Klasifikacija|
|---|---|---|---|
|2026-11-27|Bez kvaliteta treba da znači i odsustvo ubrzanja u tekstu.|4.1 km lako+6×20 s u opisu; strides/session nema.|confirmed-defect|
|2027-02-07/2027-02-28|Razlikovati povratak trčanju od maratonske izdržljivosti.|Najveći budući LR8.8 km 7. februara;28. februara trka 42.195 km.|coaching-concern|
|2027-02-12/2027-02-19|M rad proceniti kao smislen mali stimulus, ne dokaz 4 h izdržljivosti.|Po 1.8 km @5:41/km (~10 min) u taperu.|coaching-concern|
|2026-12-09|Zaštićenu ručnu sesiju sačuvati i učiniti konflikt vidljivim.|SUPPLEMENTAL preservation: g 9 d 3 T2×1400 m ostaje, uz warning datiran 9. decembrom.|confirmed-behavior|

**Potvrđene greške:** Tri početne zastarele stride instrukcije. Pet naslova kvaliteta bez odgovarajućeg rada; warning 1/notes 3 i vrh LR9.1 vs final 8.8 su neusklađeni.

**Trenerske zabrinutosti:** Sa LR8.8 km i 29 km nedeljno plan ne podržava pun maratonski pokušaj; limited upozorenje nije zamena za pripremu.

### Primary — pregled svih budućih kalendarskih nedelja

|N / početak|Pre km|Posle km|Samo buduće km|LR budući km|Deload pre→posle|Taper|Stvarni budući kvalitet|
|---|---:|---:|---:|---:|---|---|---|
|N7 / 2026-11-23|37.6|27.8|11.1|7|False→False|False|Nema session kvaliteta|
|N8 / 2026-11-30|28.8|21.8|21.8|7.4|True→False|False|Nema session kvaliteta|
|N9 / 2026-12-07|36.9|22.7|22.7|6.6|False→False|False|Nema session kvaliteta|
|N10 / 2026-12-14|40.7|17.1|17.1|5.5|False→True|False|Nema session kvaliteta|
|N11 / 2026-12-21|44.2|24.3|24.3|7.4|False→False|False|Nema session kvaliteta|
|N12 / 2026-12-28|33.2|24.2|24.2|7|True→False|False|2027-01-01 Tempo isprekidan/T 1.2 km @290s/km, odmor60s|
|N13 / 2027-01-04|47.7|26.2|26.2|8.2|False→False|False|2027-01-08 Tempo isprekidan/T 1.2 km @290s/km, odmor60s|
|N14 / 2027-01-11|47.3|19.1|19.1|6.1|False→True|False|Nema session kvaliteta|
|N15 / 2027-01-18|45.1|25.1|25.1|7.3|False→False|False|2027-01-22 Intervali/I 1.6 km @262s/km, odmor157s|
|N16 / 2027-01-25|35.5|27.0|27.0|8.5|True→False|False|Nema session kvaliteta|
|N17 / 2027-02-01|49.1|29.0|29.0|8.8|False→False|False|Nema session kvaliteta|
|N18 / 2027-02-08|39.3|23.9|23.9|7.7|False→False|True|2027-02-12 Maratonski tempo/RP 1.8 km @341s/km, odmor0s|
|N19 / 2027-02-15|31.9|19.3|19.3|6.3|False→False|True|2027-02-19 Maratonski tempo/RP 1.8 km @341s/km, odmor0s|
|N20 / 2027-02-22|52.695|47.595|47.595|0|False→False|False|Nema session kvaliteta; trka je izdvojena iz trenažnog vrha|

Dokaz zadržanog stride teksta bez polja:
- 2026-11-27 g7d5: 4.1 km lako (Z2) @ ~5:49/km + 6×20 s ubrzanja (lagani ubrzani koraci, pun oporavak)
- 2026-11-30 g8d1: 5.6 km lako (Z2) @ ~5:49/km + 6×20 s ubrzanja (lagani ubrzani koraci, pun oporavak)
- 2026-12-07 g9d1: 5.3 km lako (Z2) @ ~5:49/km + 6×20 s ubrzanja (lagani ubrzani koraci, pun oporavak)

Puni budući periodi sa zastarelim kvalitetnim naslovom: N8 / 2026-11-30 / Fartlek; N9 / 2026-12-07 / Fartlek; N11 / 2026-12-21 / Tempo isprekidan; N16 / 2027-01-25 / Tempo isprekidan; N17 / 2027-02-01 / Tempo.

## U10 — USLOVNI PROLAZ ZA POVRATAK; NEMA DOVOLJNO PONOVLJENE MARATONSKE IZDRŽLJIVOSTI DO OSTAVLJENE TRKE.

**Događaj i ishod:** Return uz potvrdu; eksplicitna 60-km/24-km baza postaje 33 km/13.2 km, četiri laka početna kalendarska perioda; originalni cilj 3:30 i datum 28. februara ostaju.

**Struktura:** Laki početak bez structured kvaliteta; zatim kratak fartlek,I,T i tek kasno mali M. PrethodniMLR obrazac se gubi u budućem baznom rasporedu.

**Doza:** Budući vrh 47.4 km i LR17.3 km(~106 min), nijedna buduća≥20 km; M1.8–1.9 km u specifičnim kasnim nedeljama. Velika redukcija je razumna za povratak, ali maratonska specifičnost ostaje slaba.

**Oporavak:** Rast obima je postupniji od vraćanja na 80 km. Zadržane measured/manualquality stavke ucontrol-u mogu se sukobiti sa lakim početkom i traže ručni pregled.

**Koherentnost:** DayWarnings 2 naspramnotes 4; četiri stride instrukcije ostaju iako polja nisu prisutna, N9Fartlek je prazan. Limited poruka je poštena.

|Datum|Očekivano|Isporučeno|Klasifikacija|
|---|---|---|---|
|2026-11-30/2026-12-02|Lak prozor bez structured strides ne treba da ima tekst ubrzanja.|g 8 d 1 ig 8 d 3 sa 6×20 s u tekstu, bez strides/session.|confirmed-defect|
|2026-12-01|Očuvati merenu buduću stavku, ali ne pretpostaviti da je laka.|SUPPLEMENTAL: measuredg 8 d 2 T2.7 km @5:00/km ostaje; structured primary tog dana je lako.|confirmed-behavior|
|2027-02-07/2027-02-28|Za M proceniti ponovljene dužine i ne naslanjati se na raniji PB.|Najveći budući LR17.3 km, zatim 42.195 km trka;M1.9 km (~10 min).|coaching-concern|

**Potvrđene greške:** Četiri zastarele stride instrukcije kroz 20. decembar. Prazan N9Fartlek naslov; protivrečne 2/4 povratne nedelje.

**Trenerske zabrinutosti:** M spremnost posle pauze nije potvrđena ovim skromnim dugim izlaganjima. Sačuvani manual T4.5 km 11. decembra i measured T2.7 km 1. decembra su očekivani protection izuzeci sa upozorenjem, ne automatski odobren trening.

### Primary — pregled svih budućih kalendarskih nedelja

|N / početak|Pre km|Posle km|Samo buduće km|LR budući km|Deload pre→posle|Taper|Stvarni budući kvalitet|
|---|---:|---:|---:|---:|---|---|---|
|N7 / 2026-11-23|76.0|55.4|17.5|13.2|False→False|False|Nema session kvaliteta|
|N8 / 2026-11-30|59.4|34.9|34.9|13.9|True→False|False|Nema session kvaliteta|
|N9 / 2026-12-07|71.2|36.6|36.6|12.5|False→False|False|Nema session kvaliteta|
|N10 / 2026-12-14|77.5|28.4|28.4|10.4|False→True|False|Nema session kvaliteta|
|N11 / 2026-12-21|79.8|38.4|38.4|14.7|False→False|False|2026-12-22 Fartlek/T 0.6 km @300s/km, odmor90s|
|N12 / 2026-12-28|62.4|40.1|40.1|13.2|True→False|False|2026-12-29 Intervali/I 1.2 km @270s/km, odmor122s|
|N13 / 2027-01-04|79.8|42.1|42.1|15.5|False→False|False|2027-01-05 Tempo isprekidan/T 2.0 km @300s/km, odmor60s|
|N14 / 2027-01-11|80.1|32.8|32.8|11.6|False→True|False|Nema session kvaliteta|
|N15 / 2027-01-18|74.3|43.8|43.8|13.9|False→False|False|2027-01-19 Maratonski tempo/RP 1.9 km @320s/km, odmor0s; 2027-01-22 Tempo/T 2.6 km @300s/km, odmor0s|
|N16 / 2027-01-25|57.9|45.6|45.6|16.4|True→False|False|2027-01-26 Maratonski tempo/RP 1.8 km @320s/km, odmor90s; 2027-01-29 Tempo isprekidan/T 2.4 km @300s/km, odmor60s|
|N17 / 2027-02-01|79.8|47.4|47.4|17.3|False→False|False|2027-02-02 Maratonski tempo/RP 1.9 km @320s/km, odmor0s; 2027-02-05 Tempo/T 2.6 km @300s/km, odmor0s|
|N18 / 2027-02-08|64.1|37.8|37.8|14.7|False→False|True|2027-02-09 Tempo/T 2.6 km @300s/km, odmor0s|
|N19 / 2027-02-15|52.0|30.7|30.7|12.1|False→False|True|2027-02-16 Maratonski tempo/RP 1.9 km @320s/km, odmor0s|
|N20 / 2027-02-22|52.695|51.195|51.195|0|False→False|False|Nema session kvaliteta; trka je izdvojena iz trenažnog vrha|

Dokaz zadržanog stride teksta bez polja:
- 2026-11-30 g8d1: 6.2 km lako (Z2) @ ~6:00/km + 6×20 s ubrzanja (lagani ubrzani koraci, pun oporavak)
- 2026-12-02 g8d3: 4.8 km lako (Z2) @ ~6:00/km + 6×20 s ubrzanja (lagani ubrzani koraci, pun oporavak)
- 2026-12-07 g9d1: 7.3 km lako (Z2) @ ~6:00/km + 6×20 s ubrzanja (lagani ubrzani koraci, pun oporavak)
- 2026-12-14 g10d1: 5.3 km lako (Z2) @ ~6:00/km + 4×15 s ubrzanja (lagani ubrzani koraci)

Puni budući periodi sa zastarelim kvalitetnim naslovom: N9 / 2026-12-07 / Fartlek.

## Primarni izvori i granice procene

- S1: [B.A.A. Boston Marathon Training, Level One](https://www.baa.org/races/boston-marathon/info-for-athletes/boston-marathon-training/), provereni pristup 2026-10-11. Zvanični originalni trenerski plan.
- S2: [Hal Higdon, Novice 1 Marathon](https://www.halhigdon.com/training-programs/marathon-training/novice-1-marathon/), provereni pristup 2026-10-11. Zvanični originalni trenerski plan.
- S3: [Runna, Understanding the Long Runs in Your Runna Plan](https://support.runna.com/en/articles/9357249-understanding-the-long-runs-in-your-runna-plan), provereni pristup 2026-10-11. Zvanični originalni tekst Runna, prikazan datum 2026-08-31.
- S4: [Fokkema i sar. (2020), Training for a (half-)marathon: Training volume and longest endurance run related to performance and running injuries](https://onlinelibrary.wiley.com/doi/10.1111/sms.13725), provereni pristup 2026-10-11. Originalna opservaciona studija, 556 HM i 441 M učesnika.
- S5: [Smyth i Lawlor (2021), Longer Disciplined Tapers Improve Marathon Performance for Recreational Runners](https://www.frontiersin.org/journals/sports-and-active-living/articles/10.3389/fspor.2021.735220/full), provereni pristup 2026-10-11. Originalna opservaciona analiza aktivnosti >158.000 rekreativnih maratonaca.

S1/S2/S3 su originalne trenerske strukture koje daju kontekst za ponavljanje baze, dužine, oporavak i taper; ne predstavljaju jedini dozvoljeni plan. S4 i S5 su originalne opservacione studije, ne individualne garancije. Tvrdnje o konkretnim povratnim nedeljama i dozama su moje inferencije iz event input/result podataka. Nisam uzimao embedded user coaching zaključke ili postojeće audit presude kao sopstveni autoritet; direktno sam poređivao datirane dane, session, tekst i zaštitu.

Numeričke početne ocene i primarni početni izveštaj ostaju neizmenjeni. Deset primarnih događaja je pokriveno; U08 ranija dozvoljena kontrola je jasno izdvojena, a preservation kontrole ne predstavljaju stvarnu primarnu istoriju. Nema functional promena.

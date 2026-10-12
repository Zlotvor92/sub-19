# Nezavisna slepa stručna procena — polumaraton

Datum pregleda i pristupa izvorima: **2026-10-11**. Glavna stručna perspektiva: polumaraton, uz kontrolu 5K, 10K i maratona. Ovo je procena sintetičkih QA profila, ne individualno medicinsko savetovanje.

Pročitano je svih deset dozvoljenih `blind/U01.json`–`blind/U10.json`, obe strane i svaka nedelja: **20 planova, 324 plan-nedelje, 2.268 dnevnih zapisa**. Uključeni su profil, stvarni dani/sesije, prezentacija upozorenja i kontrola zbirnih podataka. Nisu otvarani raw, manifest, generator, probe, korisnički podaci, ranije faze niti tuđi trenerski izveštaji/statusi. Nije bilo slučajnog izlaganja tuđim nalazima. Identitet A/B nije otkriven; struktura i način upozoravanja ipak daju moguće tragove, pa ovo nije tvrdnja o savršenom zaslepljivanju. Ocene su samostalne i zamrznute pre budućih event artefakata i otkrivanja identiteta. Event reakcije nisu deo ove faze.

## Način procene

Svaki kriterijum je ocenjen 0–10. Ukupno = `fit×2 + quality×2 + progression×1.5 + recovery×1.5 + specificity + deloadTaper + coherence`, maksimalno 100. Težine su redom 20/20/15/15/10/10/10. Decimalne razlike nisu empirijski precizno merenje; služe transparentnom ponderisanju iste rubrike.

| Kriterijum | Šta je provereno |
|---|---|
| fit | Prijavljena baza, nedavna ponovljiva dužina, kontinuitet/pauza, iskustvo, cilj i raspoloživi dani |
| quality | Doza stvarnog brzog rada, tempo i oporavak; svrha sesije, bez obavezne liste porodica treninga |
| progression | Putanja ukupnog rada i pojedinačnih sesija, kontinuitet, ponovljena izlaganja i povratak posle pauze |
| recovery | Razmak kvaliteta, teška dužina, laki dani po trajanju, nedelja→ponedeljak→utorak, opciona snaga |
| specificity | Izdržljivost i ritam relevantni baš za ciljnu distancu; proba opreme/goriva i vreme na nogama |
| deloadTaper | Stvarno smanjenje opterećenja, ne samo etiketa; trka se isključuje iz pretrkačkog obima |
| coherence | Podudarnost dana, doza, upozorenja, reference, cilja, prognoze i aritmetike ritma |

T = prag, I = intervalni intenzitet, R = kratke repeticije, RP = ritam ciljane distance, M = maratonski završetak, LR = dugo trčanje, MLR = srednje-dugo trčanje. Strides sa punim oporavkom nisu automatski dodatni puni kvalitetni dan. LR sa brzim završetkom jeste kvalitetni dan. Duga laka sesija nosi veliko mehaničko opterećenje i kada nije brz trening; zato dva kvalitetna dana nisu isto što i samo dva zahtevna izlaganja.

Nema univerzalne zabrane uzastopnih dana, pravila da svaki HM mora doseći 20 km, obaveznog T/RP treninga svake nedelje, univerzalnog minimuma 30/40/55 km ili univerzalne granice od 120/180 minuta. Skok posle deload-a poređen je sa skorom prethodnom najdužom sesijom, ne samo sa kraćom deload nedeljom. Procenti su opis konteksta, ne determinističko predviđanje povrede. Isto tako, veći obim ili više brzog rada nisu automatski bolji.

Trajanje lake dužine računato je kao km × tempo; kod brzog završetka kao laka i brza komponenta zasebno. Run/walk nema zadat tempo hoda i trčanja, pa tačno vreme na nogama nije moguće izračunati. Progresivna sesija ima brzi rad samo u poslednjoj trećini, iako `qKm` u tom formatu označava ukupnu sesiju. Oporavci se procenjuju po načinu (hod/jog), dužini i odnosu sa radnom deonicom. Nije pretpostavljeno da 4 minuta hoda i 4 minuta laganog trčanja imaju istu funkciju.

## Originalni izvori i granice primene

Sve veze pristupljene/pretražene 2026-10-11. Korišćene su zvanične stranice autora programa i originalni radovi. BAA/Higdon/Runna pokazuju legitimne različite škole pripreme, a ne obavezne standarde za svaki profil. Preporuke za konkretne planove u nastavku su moj stručni zaključak iz profila, prikazane pripreme i tih izvora.

| ID | Originalni izvor | Relevantan nalaz i primena |
|---|---|---|
| S1 | [BAA — Boston Half Training, Levels One–Three](https://www.baa.org/races/boston-half/info-for-athletes/boston-half-training/) | Nivoi zavise od iskustva i cilja. Novice pristup ima dužine oko 9–10 milja i simulacije; napredniji pristup dužine 13–14 milja i duže specifične blokove. To je dokaz raznovrsnih legitimnih HM dizajna, ne minimalnih zahteva. |
| S2 | [Hal Higdon — Half Marathon Novice 1](https://www.halhigdon.com/training-programs/half-marathon-training/novice-1-half-marathon/) i [zvanična tabela](https://www.halhigdon.com/wp-content/uploads/2025/04/Hal-Printable-Tables-Half-Marathon.xlsx-Half-Marathon-Novice-1.pdf) | Postepen novice plan doseže 16.1 km i dopušta hod; završetak HM ne zahteva obavezno prethodnu punu distancu. Taj profil nije automatski dokaz vremenskog cilja. |
| S3 | [Runna — Understanding the Long Runs](https://support.runna.com/en/articles/9357249-understanding-the-long-runs-in-your-runna-plan) | Dužina zavisi od sposobnosti, trajanja pripreme i distance; razlikuju se laki i strukturirani LR, uz postepen rast i deload. Brzi LR troši kvalitetni budžet i oporavak. |
| S4 | [Runna — How Does Runna Build Recovery](https://support.runna.com/en/articles/15272605-how-does-runna-build-recovery-into-your-training-plan) | Zvanično objašnjenje iz 2026. ima redovna rasterećenja, smanjenje kvalitetnog i dugog rada, postepen povratak i taper prilagođen planu. To ne nameće Runna algoritam drugim planovima. |
| S5 | [Hal Higdon — Marathon Novice 1](https://www.halhigdon.com/training-programs/marathon-training/novice-1-marathon/) | Legitiman maratonski primer sa četiri trčanja nedeljno, dugim blokom do oko 32 km i tri završne nedelje rasterećenja. Četiri dana sama po sebi nisu kritična greška U09. |
| S6 | [Bosquet et al., 2007, originalna meta-analiza taper-a](https://pubmed.ncbi.nlm.nih.gov/17762369/) — DOI 10.1249/mss.0b013e31806010e0 | U takmičarskim uzorcima podržava smanjenje volumena uz zadržavanje intenziteta/frekvencije; ne znači da svaki rekreativac mora imati identičnih 14 dana. Dostupan pretraženi abstrakt; direktno otvaranje vratilo samo HHS stranicu. |
| S7 | [Frandsen et al., originalna kohorta 5.205 trkača, BJSM 2025](https://bjsm.bmj.com/content/59/17/1203) — DOI 10.1136/bjsports-2024-109380 | Rast pojedinačne sesije u odnosu na prethodni 30-dnevni maksimum bio je povezan sa povredama; običan nedeljni odnos nije pokazao isto. Asocijacija nije univerzalna kauzalna granica. Pretraženi originalni abstrakt dostupan, direktno otvaranje 403. |
| S8 | [Buist et al., 2008, originalni randomizovani ogled](https://pubmed.ncbi.nlm.nih.gov/17940147/) — DOI 10.1177/0363546507307505 | Program zasnovan na 10% pravilu nije smanjio povrede u odnosu na standardni novice program. Zato se ne presuđuje jednostavnom 10% nedeljnom formulom. |
| S9 | [Fokkema et al., 2020, originalna studija HM/maratona](https://pubmed.ncbi.nlm.nih.gov/32421886/) i [autorski rad](https://pmc.ncbi.nlm.nih.gov/articles/PMC7496388/) — DOI 10.1111/sms.13725 | Veći obim i duže izlaganje povezani su sa boljim rezultatom; to su kategorije opservacione studije, ne dokaz individualnog minimuma ili garancije. Pretražen originalni rad; direktno otvaranje PMC imalo recaptcha. |

## Glavni polumaratonski nalazi

**U07 A ima snažniju dužinsku putanju za prvi HM na rezultat.** Nedavna baza 10 km održana je u N1; putanja glavnih dužina 10/10.8/11.6/8.7/12.5/13.5/14.5/10.7/15.6/16.8/18.1/13.3/19.5/15.6/12.6 km donosi ponovljena izlaganja od približno 96–120 minuta. N13 D3 ima 7 km kontrolisano na 5:11/km, petak ostaje lak i nedeljna dužina je laka: kvalitet i proba nisu pretvoreni u tri brza treninga. Upozorenje odvaja želju 1:45 od aktuelne ekvivalencije 1:49. Nedovoljno efikasna RP pauza i veliki laki ponedeljak ostaju konkretne slabosti.

**U07 B nije automatski nevažeći jer vrh iznosi 15.3 km.** Novice HM može imati sličan maksimum [S1, S2]. Ipak, ovde N5–9 ponavljaju 14 km, najveća stvarna dužina traje oko 91 minut, a cilj je prvi HM 1:45 iz baze 30 km/ned. N11 D7 sa završetkom 3.8 km RP ispravno zamenjuje kvalitet u petak. N13 proba daje 7 km RP, ali ukupno 13.5 km sa zagrevanjem/hlađenjem, pa je takođe izlaganje koje treba uračunati. Problem je slabija dugotrajna priprema za vremenski cilj uz odsustvo upozorenja i automatsku prognozu 1:41:47, ne nedostatak neke obavezne sesije. Potrebna je transparentna uslovna procena, dodatna ponovljiva izdržljivost gde tolerancija dopušta ili prilagođen nastup.

**U08 obe strane imaju relevantan iskusan HM sadržaj.** Ulazna baza 55 km/ned, 16 km LR i 24 nedelje kontinuiteta opravdavaju višestruke 22 km dužine, oko 119 minuta lake sesije, 10 km kontrolisane probe i specifične završetke. U N9 i N11 na obe strane brzi LR od 5.5 km RP zamenjuje petkov kvalitet: nije treći brzi dan. Stvarno trajanje te dužine je približno 114, a ne tekstualnih 119 minuta. To je manja greška vremena na nogama. Veći problem je N10 D3: 13.6 km/73 minuta samo dan posle probe od 10 km RP (45 minuta brzog dela), bez mogućnosti skraćenja. Lak intenzitet ispunjava instrukciju „naredna 2–3 dana lagano“, ali dužina tog lakog dana ipak nije oporavljajuća za svakoga.

U08 A ima snažniju ranu kvalitetnu dozu i nešto manji kasni laki volumen; U08 B početnu T dozu drži vrlo konzervativnom, ali bolje odvaja trenutnu referencu i cilj i ima korisniji deload bez obavezne dodatne oštrine. Obe su prihvatljive uz kontrolu oporavka. N12–13 taper kod obe stvarno smanjuje obim i rad, iako dve kvalitetne sesije i LR od 14.3 km sedam dana pre trke ostaju zavisne od tolerancije. Razlika ukupnih HM ocena nije dokaz univerzalne nadmoći jedne škole.

## Kontrola svih ostalih distanci

5K/10K planovi generalno imaju dovoljno jasnog razmaka punih kvaliteta, a zagrevanje/hlađenje uglavnom postoje. U01 A i U06 B bolje priznaju ograničen kontinuitet i formu. Run/walk strategija u U01 je legitimna. Kod U06 A problem nije samo stari PB niti sam hod, već velika prva dužina u kilometrima posle osmonedeljne pauze bez vremena na nogama i upozorenja o aktuelnoj formi. Kod iskusnih U03/U05 veći kvalitet druge strane može biti smislen; male T mikrodoze prve strane ne znače automatski grešku, ali treba da imaju razlog i jasnu svrhu.

**U09 je glavni kritični slučaj za obe strane.** Maksimumi 17.7 km/105 minuta i 16 km/95 minuta nisu priprema koja pouzdano podržava prvi maraton od oko četiri sata uz polaznih 30 km/ned. To nije zahtev da svi moraju dostići 32 km, ni zabrana četiri dana: presuda proizlazi iz celog dugog bloka, njegove male ponovljene izloženosti, cilja i novice statusa. A pošteno upozorava na ograničenje i predlaže promenu dana/baze/datuma, zbog čega ima znatno bolju koherentnost. B kaže da je ovo plan za završetak i automatski predviđa 3:20:21, što je neprimereno. Ograničen plan sa upozorenjem može služiti kao nastavak baze; ne treba ga proglasiti potvrđenom pripremom za 42 km.

**U10 B bolje koristi već potvrđenu dužinu 24 km.** Više ponovljenih 29.3 km/180 minuta nisu automatski predugi treninzi za ovog iskusnog trkača sa 32 nedelje kontinuiteta. Već postojeća baza i oporavak odlučuju. Dugi laki MLR od 17.6 km/108 minuta i veliki ponedeljak ipak stvaraju gust raspored. U10 A prvo snažno obara LR, a zatim u N14 skače na 28.2 km iz skorog maksimuma 23.5 km, u nedelji sa 8 km M i 7.5 km T. U obe strane taper postoji; kritika N19 je da mnogo dugog rada ostaje sedam dana pre trke, a ne da trkački km čine taper neuspešnim.

Kod više planova tekst trke spaja željeni brži cilj sa sporijim preporučenim ritmom (npr. 3:30 uz 5:20/km = oko 3:45). Ritam je često pravilno usidren u aktuelnom PB-u, što je dobro; preporuka samo mora jasno odvojiti želju, referencu i uslovni scenario. Predviđeni napredak bez novog rezultata može biti ilustrativni scenario, ali ne tvrdnja šta plan realno donosi, šta dostiže agresivan režim niti garancija završetka.

## Ocene i konkretni nalazi po planu

Sledi tabela svih ocena i za svaki plan tačan referentni N/D, očekivano ponašanje, stvarni sadržaj i posledica. `criticalIssues` u JSON-u znači da glavna ciljna priprema nije podržana, a ne da je statistički dokazana povreda. U09 A i B imaju po jedan takav nalaz; ostali imaju glavne zabrinutosti različite ozbiljnosti. Kvalitetni dani u dodatku predstavljaju sesije/finish, ne celokupno mehaničko opterećenje dugih lakih trčanja.

| Profil | Strana | Fit | Kvalitet | Rast | Oporavak | Specifičnost | Deload/taper | Koherentnost | Ukupno | Nedelje |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| U01 | A | 8.5 | 8 | 8.5 | 8.5 | 8 | 9 | 9 | 84.5 | 12 |
| U01 | B | 7.5 | 7.5 | 7 | 8 | 8 | 8.5 | 5 | 74.0 | 12 |
| U02 | A | 8 | 8 | 8 | 8.5 | 8.5 | 9 | 5.5 | 79.75 | 16 |
| U02 | B | 8.5 | 8 | 8 | 7.5 | 8 | 9 | 9 | 82.25 | 16 |
| U03 | A | 8.5 | 7.5 | 8 | 8 | 8 | 9 | 9 | 82.0 | 16 |
| U03 | B | 8.5 | 8.5 | 7.5 | 8 | 8.5 | 8.5 | 5.5 | 79.75 | 16 |
| U04 | A | 6.5 | 6.5 | 6.5 | 8 | 8 | 8.5 | 5 | 69.25 | 16 |
| U04 | B | 8.5 | 7.5 | 8.5 | 8 | 7.5 | 9 | 9 | 82.25 | 16 |
| U05 | A | 8 | 7.5 | 8 | 7.5 | 7.5 | 9 | 9 | 79.75 | 16 |
| U05 | B | 8.5 | 8.5 | 8 | 8 | 8.5 | 8.5 | 5.5 | 80.5 | 16 |
| U06 | A | 5.5 | 6.5 | 5 | 7.5 | 7.5 | 8.5 | 4.5 | 63.25 | 16 |
| U06 | B | 8 | 7.5 | 8.5 | 8.5 | 6.5 | 9 | 8.5 | 80.5 | 16 |
| U07 | A | 8.5 | 7.5 | 9 | 7.5 | 8.5 | 8.5 | 9 | 82.75 | 16 |
| U07 | B | 7.5 | 8 | 7 | 8 | 7.5 | 8.5 | 4.5 | 74.0 | 16 |
| U08 | A | 8.5 | 8.5 | 8.5 | 7 | 9 | 8.5 | 7 | 81.75 | 14 |
| U08 | B | 8.5 | 7.5 | 8.5 | 6.5 | 8.5 | 9 | 9 | 81.0 | 14 |
| U09 | A | 5.5 | 6.5 | 6.5 | 7 | 3.5 | 8.5 | 8 | 64.25 | 20 |
| U09 | B | 4.5 | 6 | 5.5 | 7.5 | 3 | 8 | 3 | 54.5 | 20 |
| U10 | A | 7 | 8 | 5.5 | 6.5 | 7.5 | 7.5 | 4.5 | 67.5 | 20 |
| U10 | B | 8.5 | 7.5 | 8.5 | 6.5 | 8 | 8.5 | 9 | 80.0 | 20 |

Srednja ocena A: **75.475/100**, B: **76.875/100**. Strana se menja po profilu; ovaj agregat nije identitet generatora, niti dokaz statističke značajnosti. HM parovi: U07 A82.75/B74.00; U08 A81.75/B81.00.


### U01 A — 84.5/100

Presuda: prihvatljiv uz proveru forme. Pouzdanost procene 0.86; pregledano svih 12 nedelja.

1. **N5 D1** (minor). Očekivano: Prelaz sa run/walk na kontinuirano trčanje usloviti tolerancijom, a ubrzanja uvoditi postepeno. Stvarno: Posle N4 odnosa 5:1, N5 ima 2.9 km kontinuirano + 6×20 s ubrzanja. Procena: Razumna baza, ali potpuno automatski prelaz bez opisa prilagođavanja je mala slabost.

2. **N10 D7** (minor). Očekivano: Procena završetka 5 km treba da ostane uslovna kod nultog početnog kontinuiteta. Stvarno: Vrhunac LR 4.6 km (~40.6 min) i 12.4 km/ned; upozorenje i opis trke jasno kažu da spremnost nije potvrđena. Procena: Upozorenje je primereno; 4.6 km samo po sebi nije dokaz nemogućnosti završetka, niti je 30 km/ned univerzalni minimum.


### U01 B — 74.0/100

Presuda: potrebna dorada upozorenja i napredovanja. Pouzdanost procene 0.89; pregledano svih 12 nedelja.

1. **N9 D7** (moderate). Očekivano: Vraćanje posle deload-a proveriti prema prethodnim najdužim izlaganjima i sposobnosti početnika. Stvarno: LR raste sa prethodnog maksimuma 4.9 km (N7) na 6.1 km (+24.5%), a N10 na 6.5; N9 uvodi i 6×60 s brzo. Procena: Istovremen rast dužine i brze doze traži bolje obrazloženje/toleranciju; nije automatski zaključak da će doći do povrede.

2. **N12 D7** (high). Očekivano: Odvojiti želju 30:00, trenutnu referencu 35:00 i uslovnu procenu napretka. Stvarno: Opis trke: cilj 30:00 / ritam 7:00/km (=35:00); prezentacija prognozira 33:24 i kaže da je ovo plan da distancu ISTRČIŠ. Procena: Matematički nesklad i garancija završetka nisu opravdani prikazanim kontinuitetom.


### U02 A — 79.75/100

Presuda: trenažno prihvatljiv; doraditi prognozu. Pouzdanost procene 0.86; pregledano svih 16 nedelja.

1. **N13 D3** (high). Očekivano: Povezati specifični rad sa potvrđenim aktuelnim 5K ritmom, a cilj 19:59 prikazati odvojeno. Stvarno: 3×1000 m @4:45/km, 90 s hoda; cilj trke 19:59 / ritam 4:45/km (=23:45). Procena: Doza je smislena za PB23:45, ali opis trke zbunjuje želju i preporuku.

2. **N16 D7** (moderate). Očekivano: Napredak procenjivati nakon novog testa, ne predstaviti automatsku VDOT putanju kao ishod plana. Stvarno: Prezentacija predviđa 22:09 sa rastom VDOT40.7→44.2, bez novog rezultata u dostavljenom profilu. Procena: Nema potvrde za određeno poboljšanje; trening ne ubrzava prema toj prognozi, što ublažava rizik.


### U02 B — 82.25/100

Presuda: prihvatljiv uz raspodelu oporavka. Pouzdanost procene 0.86; pregledano svih 16 nedelja.

1. **N9 D1, takođe N10,11,13,14** (moderate). Očekivano: Dan posle nedeljne dužine treba da bude dovoljno lak i po trajanju za četvorodnevni raspored. Stvarno: N8 D7 10.6 km; N9 D1 11.6 km (~70 min) +6×20 s, a N9 D7 14.5 km (~89 min); 11.6 km ponavlja se N10–11 i 13–14. Procena: Trkač ima 12 nedelja kontinuiteta, pa ovo nije zabranjeno, ali veliki laki ponedeljak smanjuje prostor za oporavak.

2. **N13 D3** (minor). Očekivano: Za progresivnu 5K specifičnost razmotriti oporavak usklađen sa ciljem treninga. Stvarno: 2×1000 m @4:45/km sa 3:34 hoda (oko 75% trajanja deonice). Procena: Legitiman kontrolisan trening, ali duga pauza i samo 2 km RP daju skromniju kontinuiranu specifičnost; nije zahtev za obaveznu porodicu treninga.


### U03 A — 82.0/100

Presuda: prihvatljiv, konzervativna doza za napredak. Pouzdanost procene 0.86; pregledano svih 16 nedelja.

1. **N7 D2, takođe N5,6,9,10,11** (minor). Očekivano: Dozu prilagoditi iskusnom trkaču sa 50 km/ned, uz praćenje tolerancije. Stvarno: 2×1200 m @3:57/km (~9.5 min I), 3:33 hoda; D5 2×1600 m T (~14 min); sličan blok N5–11. Procena: Razumna bezbedna opcija, ali mali I obim i ponavljanje doze ograničavaju izazov za cilj 18:59.

2. **N11 D1** (moderate). Očekivano: Laki dan između nedeljne dužine i utorka zadržati oporavljajućim. Stvarno: N10 D7 16.6 km; N11 D1 13.3 km (~70 min) +strides; N11 D2 intervali. Procena: Tri vezana dana nisu sama po sebi greška; ukupno trajanje traži mogućnost skraćenja po umoru.


### U03 B — 79.75/100

Presuda: trenažno prihvatljiv; prognoza nije potvrđena. Pouzdanost procene 0.86; pregledano svih 16 nedelja.

1. **N1 D2, takođe N2,3** (minor). Očekivano: Ranu brzinu vezati za iskustvo i oporavak, ne samo porodični šablon. Stvarno: N1–2 po 8×300 m R @3:48/km (2:51 hoda) uz petkom 3×1600 m T (~21 min); N3 devet 300m. Procena: Za 24 nedelje kontinuiteta i 50 km/ned to je prihvatljivo, ali rani blok je repetitivan; nema kritičnog predoziranja.

2. **N16 D7** (high). Očekivano: Aktuelnu referencu 20:35 odvojiti od želje 18:59 i nepotvrđene prognoze. Stvarno: Opis cilj 18:59 / ritam 4:07/km (=20:35); prezentacija kaže 19:23 i da bi agresivan napredak dostigao cilj. Procena: Neosnovana preciznost prognoze i matematički neusklađen opis.


### U04 A — 69.25/100

Presuda: doraditi ulazak u kvalitet i prognozu. Pouzdanost procene 0.86; pregledano svih 16 nedelja.

1. **N1 D3, takođe N2** (high). Očekivano: Bez iskustva kvaliteta početi kontrolisanim uvodom i potvrditi prvu dužinu iz 8 km baze. Stvarno: N1 D3 4×300m @4:34/km sa 3:26 hoda, D7 9.7 km (+21.25% iz 8 km); N2 dodaje 2.8 km T @5:16. Procena: Kombinacija prvog brzog rada i povećanja najduže sesije je agresivnija od potrebne; to nije univerzalna zabrana kratkih repeticija.

2. **N16 D7** (high). Očekivano: Zadržati referencu 51:53 i odvojiti cilj 50:00 dok nema novog testa. Stvarno: Bez upozorenja; prezentacija predviđa 48:10; opis cilj 50:00 / ritam 5:11/km (=51:50). Procena: Isporuka prećutkuje neizvesnost forme uprkos početničkom kvalitetu.


### U04 B — 82.25/100

Presuda: prihvatljiv uz pojednostavljenje mikrodoza. Pouzdanost procene 0.86; pregledano svih 16 nedelja.

1. **N3 D3** (minor). Očekivano: Uvod kvaliteta treba da ima jasnu svrhu; nije nužno da se dve mikrodoze zovu dva puna treninga praga. Stvarno: D3 1.1 km T (~5.8 min), D5 0.7 km T (~3.7 min); oba sa 3.1 km zagrevanja i 2.7 km hlađenja. Procena: Kontrolisana doza je opravdana bez iskustva; jednostavnije je jedan kratak kvalitet i drugi lak dan.

2. **N14 D3, takođe N13** (minor). Očekivano: RP oporavak treba objasniti kao kontrolisan uvod ili napredovati ka više vremena u ritmu. Stvarno: 2×1200m @5:11/km sa 4 min hoda; N13 2×1000m sa 3:53. Procena: Duga pauza slabi povezanost sa kontinuiranom 10K trkom, iako trening nije nevažeći.


### U05 A — 79.75/100

Presuda: prihvatljiv uz balans obima i kvaliteta. Pouzdanost procene 0.86; pregledano svih 16 nedelja.

1. **N1 D2** (minor). Očekivano: Za iskusnog trkača navesti zašto je početni kvalitet toliko mali. Stvarno: D2 2×700m T (~6.4 min); D5 1.2 km T (~5.5 min), naspram 45 km/ned ulazne baze. Procena: Može biti namerna uvodna nedelja, ali ne postoji vidljiv razlog za dva mikrotreninga.

2. **N10 D1** (moderate). Očekivano: Rast 45→68.2 km/ned i laki dan posle dužine pratiti kao ukupno opterećenje. Stvarno: N9 D7 18.5 km (~105 min), N10 D1 14 km (~77 min) +strides; utorak 12.2 km fartlek. Procena: Laki dan je veliki deo rada neposredno posle dužine; korisna je mogućnost skraćenja bez gubitka glavnog treninga.

3. **N14 D2** (minor). Očekivano: Za ciljanu 10K izdržljivost obrazložiti dugi hod između kratkog RP rada. Stvarno: 2×1600m @4:30/km sa 4 min hoda. Procena: Specifična doza je konzervativna uz veliki aerobni obim; ne obara plan sama po sebi.


### U05 B — 80.5/100

Presuda: trenažno prihvatljiv; doraditi prezentaciju. Pouzdanost procene 0.86; pregledano svih 16 nedelja.

1. **N10 D2** (minor). Očekivano: Ne nazivati svaki laki/dugi dodatak oporavkom bez razmatranja trajanja. Stvarno: N10 utorak 13.5 km fartlek (~16.5 min brzo) i petak 5.4 km T (~24.8 min); nedelja 18.5 km. Procena: Za iskusnog trkača ovo je legitiman težak blok; mora ostati zavisan od tolerancije, posebno posle 45→66.3 km rasta.

2. **N16 D7** (high). Očekivano: Potvrđeni 45:00 i želju 42:00 prikazati odvojeno. Stvarno: Prezentacija 42:13 bez novog testa; opis trke cilj 42:00 / ritam 4:30/km (=45:00). Procena: Tačnost ritma je bolja od agresivnog ubrzavanja, ali tvrdnja o prognozi i opis nisu usklađeni.


### U06 A — 63.25/100

Presuda: potrebna bitna dorada povratka. Pouzdanost procene 0.90; pregledano svih 16 nedelja.

1. **N1 D7, takođe N2,3,5** (high). Očekivano: Posle 8 ned pauze i 1 ned kontinuiteta početak zasnovati na ponovljivoj 4 km dužini i trenutnom naporu. Stvarno: Prva run/walk dužina 5.9 km (+47.5% u odnosu na prijavljenih 4 km), N3 7.1 km; zatim N5 7.6 km kontinuirano. Procena: Hod ublažava intenzitet, ali bez očekivanog trajanja i provere tolerancije ne rešava vreme na nogama posle pauze.

2. **N9 D3** (high). Očekivano: Stari PB iz 2025-10-12 ne označiti kao potvrđenu sadašnju formu; tražiti novi kontrolisani rezultat/napor. Stvarno: N9 tempo 1.9 km @5:40/km, N10 R @4:55/km; prezentacija prognozira 51:43 i ne upozorava posebno na star PB/pauzu. Procena: Brzina i prognoza ne mogu biti pouzdano kalibrisane iz godinu starog rezultata posle pauze.

3. **N16 D7** (high). Očekivano: Završetak i cilj ostaviti uslovnim posle pauze. Stvarno: Upozorenje kaže da je ovo plan da distancu ISTRČIŠ, a opis trke cilj 1:00 / ritam 6:00. Procena: Iako LR11 km podržava vežbanje distance, to nije garancija završetka niti procena potvrđene forme.


### U06 B — 80.5/100

Presuda: prihvatljiv povratni plan uz ograničen 10K cilj. Pouzdanost procene 0.86; pregledano svih 16 nedelja.

1. **N1 D1** (minor). Očekivano: Povratak posle pauze držati laganim po subjektivnom naporu; ubrzanja su opciona tek uz toleranciju. Stvarno: Već D1 3.2 km +6×20 s strides, iako prve 3 ned zovu povratne lagane; ima upozorenje za stari PB. Procena: Strides nisu puna kvalitetna sesija, ali zahtevaju kontrolu i mogućnost izostavljanja.

2. **N14 D7** (moderate). Očekivano: Ne predstavljati završetak 10K kao potvrđen pri maloj isporučenoj izdržljivosti. Stvarno: Vrhunac 6.7 km (~46.6 min) i 18.2 km/ned; trka ostaje 10 km/60 min uz eksplicitno ograničenje spremnosti. Procena: Dužina nije univerzalni minimum; ovo je konzervativan povratak sa skromnom pripremom za 60 min trku, a upozorenje to uglavnom dobro prenosi.


### U07 A — 82.75/100

Presuda: prihvatljivHM, bolja dužinska priprema. Pouzdanost procene 0.92; pregledano svih 16 nedelja.

1. **N10 D3, takođe N11,14** (minor). Očekivano: HM ritam koristiti sa smislom za kontinuitet napora, ne samo nazivom treninga. Stvarno: N10–11 i 14 2×1700m @5:11/km sa 5:26 laganog oporavka (~62% trajanja deonice); N13 kontrolisanih 7 km u ritmu. Procena: Duge pauze čine standardne RP sesije manje specifičnim; kontinuirana proba 7 km to delimično nadoknađuje.

2. **N11 D1** (moderate). Očekivano: Posle nedeljne dužine laki dan može biti kraći ako je umor visok. Stvarno: N10 D7 16.8 km/~104 min; N11 D1 13.4 km/~81 min +6×20 s; N11 D7 18.1 km/~112 min. Procena: Za prviHM i 30 km ulazne baze oporavak je ograničen ponedeljkom sa velikim volumenom.

3. **N15 D7** (minor). Očekivano: Taper tumačiti kroz trenažni obim bez trke i očekivani umor. Stvarno: N13 LR19.5 km/~120 min; N14 15.6 km; N15 12.6 km/~78 min sedam dana pre trke; nedeljni obim 49.3→41.2→34.6, pre trke 10.5. Procena: Postoji realan taper; malo sporije rasterećenje i dva kvaliteta uN15 mogu biti previše kod umornog prvogHM.


### U07 B — 74.0/100

Presuda: uslovno prihvatljiv noviceHM; doraditi očekivanja. Pouzdanost procene 0.92; pregledano svih 16 nedelja.

1. **N11 D7, takođe N5,6,7,9,13** (moderate). Očekivano: ProcenuHM pripreme zasnovati na ukupnoj dužinskoj putanji, trajanju i cilju, a ne na 5K PB/prognozi. Stvarno: N5–9 plateau 14 km (~86 min); maksimumN11 15.3 km sa 3.8 kmRP (~90.6 min realno), N13 14.8 km/~91 min; bez upozorenja o cilju ili pripremi. Procena: ~15–16 km maksimum može biti valjan noviceHM; ovde je skromniji za vremenski cilj i nema transparentnog ograničenja.

2. **N11 D7** (minor). Očekivano: LR saRP završetkom računati kao zahtevan kvalitetni dan i dati tačno trajanje. Stvarno: D3 2×2000mRP, D5 lak, D7 završetak 3.8 kmRP; ispravno dva kvalitetna dana, ali opis 94 min računa sve po 6:10 umesto približno 90.6 min. Procena: Raspored kvalitetnih dana je dobar; procena goriva/vremena je manja koherentnost, ne dokaz trećeg teškog dana.

3. **N16 D7** (high). Očekivano: Odvojiti želju 1:45, trenutnu referencu 1:49:15 i nepoznat napredak. Stvarno: Nema upozorenja; prezentacija automatski prognozira 1:41:47, a trka kaže cilj 1:45 / ritam 5:11 (=1:49:21). Procena: Preterana sigurnost uz slabiju dužinsku pripremu i matematički nesklad.


### U08 A — 81.75/100

Presuda: prihvatljiv iskusanHM uz oporavak posle probe. Pouzdanost procene 0.92; pregledano svih 14 nedelja.

1. **N10 D3** (moderate). Očekivano: Posle kontrolisane 45 minHM deonice naredni dan zaista prilagoditi oporavku. Stvarno: N10 D2 ukupno 16.5 km sa 10 km @4:30; D3 13.6 km/~73 min srednje-dugo; nedelja 22 km/~119 min. Procena: Trkač ima 55 km bazu i 24 ned kontinuiteta: nije automatski nebezbedno, ali stalna 73 min sesija nema opciju skraćenja; izraz bez umora dugog trčanja je prejak.

2. **N9 D7, takođe N11** (minor). Očekivano: T/RP završetakLR računati kao kvalitet i pravilno računati vreme na nogama. Stvarno: N9 i 11 D2 6 kmRP / ~27 min, D5 lak, D7 5.5 kmRP / ~24.8 min unutar 22 km; opis 119 min umesto realnih 113.9 min. Procena: Pravilno zamenjen petak: dva kvalitetna dana. Razlika trajanja je manja; teška dužina ipak zahteva oporavak u sledećem ponedeljku.

3. **N14 D7** (moderate). Očekivano: Ne izvoditi garantovano poboljšanje iz trajanja plana. Stvarno: Prezentacija VDOT48.2→51.2 i 1:29:43, bez novog testa; ritam trke 4:30/km za 1:35 je interno približno tačan. Procena: Za razliku od nekih drugih profila ovde ciljni ritam odgovara želji, ali prognoza ostaje nepotvrđena.


### U08 B — 81.0/100

Presuda: prihvatljiv iskusanHM uz raspodelu lakih dana. Pouzdanost procene 0.93; pregledano svih 14 nedelja.

1. **N1 D2, takođe N2** (minor). Očekivano: Objasniti konzervativnu početnu kvalitetnu dozu kod iskusnog 55 km trkača. Stvarno: N1 D2 2×1000mT (~8.8 min), D5 2×700mT (~6.1 min); N2 D5 1.7 kmT (~7.5 min). Procena: Nije obavezan duži prag, ali dve male sesije uz dug WU/CD nisu naročito efikasna početna specifičnost.

2. **N10 D3** (moderate). Očekivano: Posle kontrolisanih 10 kmHM pratiti i trajanje lakog dana, posebno u vršnoj nedelji. Stvarno: D2 16.5 km/10 kmRP; D3 13.6 km/~73 min; D5 11 km/~58 min; D7 22 km/~119 min; nedelja 75.3 km. Procena: Napori su odvojeni, ali veliki laki volumen i ponedeljak 12.2 km posle brze dužine povećavaju kumulativni umor.

3. **N9 D7, takođe N11** (minor). Očekivano: TrajanjeLR sa završetkom računati po dva ritma. Stvarno: 22 km sa 5.5 km @4:30: opis 119 min, proračun 113.9 min; petak je lak, dakle dva kvalitetna dana. Procena: Nema prebrojavanja teških dana; mala greška u vremenu na nogama.


### U09 A — 64.25/100

Presuda: ograničena priprema; maratonski cilj nije podržan. Pouzdanost procene 0.94; pregledano svih 20 nedelja.

1. **N17 D7** (high). Očekivano: Za prvi maraton cilj pripreme mora uključiti više ponovljenih dugih izlaganja, ili eksplicitno promeniti distancu/datum/strategiju. Stvarno: Maksimum 17.7 km/~105 min; raniji vrhovi 14.2,15.3,16.5 km; trka 42.195 km/~4 h. Upozorenje eksplicitno kaže ograničenu dužinsku pripremu. Procena: Ogroman jaz između isporučene tolerancije i trke ostaje; upozorenje je dobro ali ne dodaje izdržljivost. Ne tražim univerzalnih 32 km niti pet dana.

2. **N14 D3** (moderate). Očekivano: Uz malu maratonsku bazu prioritet je dužinska/aerobna ponovljivost i gorivo, ne dva kvaliteta čim se budžet otvori. Stvarno: D3 2×1200mM (~13.6 min), D5 2×1400mT (~13.5 min), D7 16.5 km. Procena: Doza nije prevelika, ali specifični zadatak 240 min ostaje neobrađen; T mikrodoza nije zamena za dugi rad.

3. **N20 D7** (minor). Očekivano: U ograničenoj pripremi ritam 4 h predstaviti kao uslovan i dati odluku o promeni nastupa. Stvarno: Opis željeni 4 h/preporučeni 5:41 uz izričito spremnost nije potvrđena; upozorenje predlaže promenu baze/dana/datuma. Procena: Koherentnost je znatno bolja od garancije završetka, ali pozitivan naziv preporučeni ritam može ostati prejak kod nepodržane izdržljivosti.


### U09 B — 54.5/100

Presuda: neprihvatljivo kao pouzdana priprema za prvi maraton. Pouzdanost procene 0.95; pregledano svih 20 nedelja.

1. **N17 D7, takođe N5,6,7,9,10,11,14** (high). Očekivano: Upozoriti na ograničenu stvarnu dužinsku pripremu i izmeniti cilj/nastup pre 4 h trke. Stvarno: DužineN5–11 samo 12.8 km; maksimum 16 km uN14 i 17 (~95 min), naspram 42.195 km/~4 h; upozorenje kaže da je ovo plan da distancu ISTRČIŠ. Procena: Nema osnove za tvrdnju da je završetak podržan; ovo je dominantnoHM trajanje pripreme za maraton.

2. **N14 D7** (moderate). Očekivano: Naglo otvaranje dve kvalitetne sesije i nove dužine ne sme da zameni postepen dugi blok. Stvarno: N13 najduže 13.6 km; N14 16 km (+17.6%) uz 6 kmM D3 i 3.2 kmT D5; ponedeljak pada na 3 km. Procena: Obim se raspoređuje šablonom, ali izdržljivost za maraton ostaje nepripremljena; nije sama 10% granica razlog presude.

3. **N20 D7** (high). Očekivano: Odvojiti stari referentni maratonski preračun, želju i nepoznat napredak. Stvarno: Prezentacija predviđa 3:20:21 iz HM PB i automatskog napretka; trka cilj 4 h/ritam 5:41; tvrdi završetak uprkos kratkim dužinama. Procena: Netačna sigurnost preporuke; posebno važno kod prve 42 km distance.


### U10 A — 67.5/100

Presuda: potrebna dorada dužinske putanje, taper-a i prognoze. Pouzdanost procene 0.91; pregledano svih 20 nedelja.

1. **N14 D7** (high). Očekivano: Vršnu dužinu graditi prema nedavno ponovljenoj najdužoj sesiji, ne samo ukupnom km budžetu. Stvarno: UlaznaLR24 km se smanjuje na 15.2 km N1; do N13 najduže 23.5 km; N14 odjednom 28.2 km (~173 min), +20% prema skorom maksimumu. D2 8 kmM, D5 7.5 kmT. Procena: Već postojeća 24 km baza opravdava održavanje, ali rani veliki reset i potom skok usred najtežeg kvalitetnog bloka nisu dobro objašnjeni.

2. **N19 D7** (moderate). Očekivano: Poslednju pretrkačku nedelju proceniti prema trenažnom obimu i umoru, uz manje ukupne kvalitetne doze. Stvarno: N19 52.1 km (~65% maksimuma), D2 6 kmM/32 min, D5 4.3 kmT/21.5 min, D7 17.1 km/~105 min sedam dana pre maratona. Procena: Taper postoji (80.2→64.2→52.1→10.5 bez trke), ali mnogo dugog i kvalitetnog rada ostaje za završnu pretrkačku nedelju.

3. **N20 D7** (high). Očekivano: Cilj 3:30 i trenutni 3:45 odvojiti bez tvrdnje da će automatski VDOT napredak to ostvariti. Stvarno: Bez upozorenja; prezentacija predviđa 3:26:21; opis cilj 3:30 / ritam 5:20/km (=3:45:02). Procena: Prognoza neopravdano precizna; matematički nesklad u preporuci.


### U10 B — 80.0/100

Presuda: prihvatljiv iskusan maraton uz oporavak. Pouzdanost procene 0.91; pregledano svih 20 nedelja.

1. **N11 D3, takođe N13,14,17** (moderate). Očekivano: Ponovljene 3 h dužine rasporediti tako da laki dani zaista omoguće oporavak. Stvarno: N11 D3 17.6 km/~108 min, D7 29.3 km/~180 min; N12 D1 11 km/~66 min +strides; dužina 29.3 ponavlja N13–14 i 17. Procena: Za 32 ned kontinuiteta i 24 km ulaznuLR to može biti legitimno; nema univerzalnog 180 min maksimuma, ali raspodela je zahtevna.

2. **N14 D2** (minor). Očekivano: Obrazložiti mali samostalniM stimulus uz visok ukupan obim. Stvarno: 2×1600mM @5:20/km (~17.1 min) i D5 4.4 kmT/~22 min; N15 LR sa 9.2 kmM. Procena: SamostalniM rad je konzervativan, dok završetakLR daje relevantnu specifičnost; ne zahtevam obaveznih 16 kmM.

3. **N19 D7** (moderate). Očekivano: Završnu pretrkačku sedmicu prilagoditi umoru posle više 3hdužina. Stvarno: N19 52 km, D2 3.3 kmM/~17.6 min, D5 3.8 kmT/19 min, D7 18.2 km/~112 min, sedam dana pre trke. Procena: Taper je stvaran i kvalitet opada, ali poslednjaLR i laki obim mogu biti veliki za umornog rekreativca.


## Dodatak: svaki dan i nedelja svih 20 planova

Proračun je iz stvarnih dnevnih objekata, bez čitanja izvornog generatora. Minuti brzog rada ne uključuju WU/CD ni oporavak. `n/p` = nije moguće pouzdano izračunati iz dostavljenih ritmova (run/walk ili mešana sesija sa hodom). Kolona najduže sesije može biti kvalitetni trening ako je duži od LR te nedelje. Trka je iz te kolone i iz trenažnih kvaliteta isključena. Ukupni km u koloni ostaju isporučeni zbir dana, pa nedelja trke uključuje trku; taper se ocenjuje iz teksta iznad i pretrkačkih dana. Opcionu snagu ne pretpostavljam kao težak trening, jer nema zadate doze; ona zahteva prilagođavanje umoru.

### U01 A — dnevna i nedeljna provera

| N | km | D1–D7: tip/km | Najduža sesija pre trke: km/min | Kvalitet: zona, rad, oporavak | Dani kvaliteta sa LR završetkom | Rasterećenje |
|---:|---:|---|---|---|---|---|
| 1 | 7.3 | 1:rw/2.4; 2:snaga; 3:rw/2; 4:odmor; 5:odmor; 6:odmor; 7:rw/2.9 | 2.9/n/p | bez kvaliteta | — | — |
| 2 | 7.7 | 1:rw/2.4; 2:snaga; 3:rw/2.3; 4:odmor; 5:odmor; 6:odmor; 7:rw/3 | 3/n/p | bez kvaliteta | — | — |
| 3 | 8.3 | 1:rw/2.6; 2:snaga; 3:rw/2.6; 4:odmor; 5:odmor; 6:odmor; 7:rw/3.1 | 3.1/n/p | bez kvaliteta | — | — |
| 4 | 6.1 | 1:rw/1.9; 2:snaga; 3:rw/1.9; 4:odmor; 5:odmor; 6:odmor; 7:rw/2.3 | 2.3/n/p | bez kvaliteta | — | deload |
| 5 | 9.3 | 1:lako/2.9+ubrz; 2:snaga; 3:lako/2.9; 4:odmor; 5:odmor; 6:odmor; 7:lr/3.5 | 3.5/30.9 | bez kvaliteta | — | — |
| 6 | 9.6 | 1:lako/2.8+ubrz; 2:snaga; 3:lako/3; 4:odmor; 5:odmor; 6:odmor; 7:lr/3.8 | 3.8/33.5 | bez kvaliteta | — | — |
| 7 | 11 | 1:lako/3+ubrz; 2:snaga; 3:int/3.9; 4:odmor; 5:odmor; 6:odmor; 7:lr/4.1 | 4.1/36.1 | D3 T: 0.4 km/3 min; pauza 90s | 3 | — |
| 8 | 8 | 1:lako/2.5+ubrz; 2:snaga; 3:lako/2.5; 4:odmor; 5:odmor; 6:odmor; 7:lr/3 | 3/26.5 | bez kvaliteta | — | deload |
| 9 | 11.7 | 1:lako/3.4+ubrz; 2:snaga; 3:int/4; 4:odmor; 5:odmor; 6:odmor; 7:lr/4.3 | 4.3/37.9 | D3 I: 0.5 km/3 min; pauza 60s | 3 | — |
| 10 | 12.4 | 1:lako/3.4+ubrz; 2:snaga; 3:int/4.4; 4:odmor; 5:odmor; 6:odmor; 7:lr/4.6 | 4.6/40.6 | D3 I: 0.8 km/5.3 min; pauza 118s | 3 | — |
| 11 | 8 | 1:lako/2.3; 2:snaga; 3:int/2.8; 4:odmor; 5:odmor; 6:odmor; 7:lr/2.9 | 2.9/25.6 | D3 RP: 0.8 km/5.6 min; pauza 126s | 3 | taper |
| 12 | 8 | 1:lako/1.5; 2:odmor; 3:lako/1.5; 4:odmor; 5:odmor; 6:odmor; 7:trka/5 | 1.5/13 | bez kvaliteta | — | trka |

### U01 B — dnevna i nedeljna provera

| N | km | D1–D7: tip/km | Najduža sesija pre trke: km/min | Kvalitet: zona, rad, oporavak | Dani kvaliteta sa LR završetkom | Rasterećenje |
|---:|---:|---|---|---|---|---|
| 1 | 7 | 1:rw/2.2; 2:snaga; 3:rw/2; 4:odmor; 5:odmor; 6:odmor; 7:rw/2.8 | 2.8/n/p | bez kvaliteta | — | — |
| 2 | 8.2 | 1:rw/2.6; 2:snaga; 3:rw/2.3; 4:odmor; 5:odmor; 6:odmor; 7:rw/3.3 | 3.3/n/p | bez kvaliteta | — | — |
| 3 | 9.2 | 1:rw/2.9; 2:snaga; 3:rw/2.6; 4:odmor; 5:odmor; 6:odmor; 7:rw/3.7 | 3.7/n/p | bez kvaliteta | — | — |
| 4 | 6.7 | 1:rw/2.1; 2:snaga; 3:rw/1.9; 4:odmor; 5:odmor; 6:odmor; 7:rw/2.7 | 2.7/n/p | bez kvaliteta | — | deload |
| 5 | 10.2 | 1:lako/3.2+ubrz; 2:snaga; 3:lako/2.9; 4:odmor; 5:odmor; 6:odmor; 7:lr/4.1 | 4.1/36.1 | bez kvaliteta | — | — |
| 6 | 10.5 | 1:lako/2.9+ubrz; 2:snaga; 3:lako/3.1; 4:odmor; 5:odmor; 6:odmor; 7:lr/4.5 | 4.5/39.7 | bez kvaliteta | — | — |
| 7 | 11.6 | 1:lako/3.2+ubrz; 2:snaga; 3:tempo/3.5; 4:odmor; 5:odmor; 6:odmor; 7:lr/4.9 | 4.9/43.2 | D3 T: 1.1 km/8 min; kontinuirano | 3 | — |
| 8 | 9.1 | 1:lako/2.6+ubrz; 2:snaga; 3:int/3.1; 4:odmor; 5:odmor; 6:odmor; 7:lr/3.4 | 3.4/30 | D3 R: 0.4 km/2.5 min; pauza 190s | 3 | deload |
| 9 | 13.3 | 1:lako/2.4+ubrz; 2:snaga; 3:int/4.8; 4:odmor; 5:odmor; 6:odmor; 7:lr/6.1 | 6.1/53.8 | D3 I: 0.9 km/6 min; pauza 60s | 3 | — |
| 10 | 15.2 | 1:lako/3.6+ubrz; 2:snaga; 3:int/5.1; 4:odmor; 5:odmor; 6:odmor; 7:lr/6.5 | 6.5/57.3 | D3 I: 1.2 km/7.9 min; pauza 177s | 3 | — |
| 11 | 10.7 | 1:lako/2.7; 2:snaga; 3:int/3.9; 4:odmor; 5:odmor; 6:odmor; 7:lr/4.1 | 4.1/36.1 | D3 RP: 1.6 km/11.2 min; pauza 90s | 3 | taper |
| 12 | 8 | 1:lako/1.5; 2:odmor; 3:lako/1.5; 4:odmor; 5:odmor; 6:odmor; 7:trka/5 | 1.5/13 | bez kvaliteta | — | trka |

### U02 A — dnevna i nedeljna provera

| N | km | D1–D7: tip/km | Najduža sesija pre trke: km/min | Kvalitet: zona, rad, oporavak | Dani kvaliteta sa LR završetkom | Rasterećenje |
|---:|---:|---|---|---|---|---|
| 1 | 28.5 | 1:lako/6+ubrz; 2:snaga; 3:int/6.1; 4:odmor; 5:lako/7.8; 6:odmor; 7:lr/8.6 | 8.6/53 | D3 R: 1.2 km/5.2 min; pauza 196s | 3 | — |
| 2 | 29.4 | 1:lako/6+ubrz; 2:snaga; 3:int/6.3; 4:odmor; 5:lako/8; 6:odmor; 7:lr/9.1 | 9.1/56.1 | D3 R: 1.2 km/5.2 min; pauza 196s | 3 | — |
| 3 | 30.7 | 1:lako/6.4+ubrz; 2:snaga; 3:int/6.5; 4:odmor; 5:lako/8.2; 6:odmor; 7:lr/9.6 | 9.6/59.2 | D3 R: 1.2 km/5.2 min; pauza 196s | 3 | — |
| 4 | 22.5 | 1:lako/5.3+ubrz; 2:snaga; 3:int/4.9; 4:odmor; 5:lako/4.7; 6:odmor; 7:lr/7.6 | 7.6/46.9 | D3 R: 0.8 km/3.5 min; pauza 131s | 3 | deload |
| 5 | 31.3 | 1:lako/5.3+ubrz; 2:snaga; 3:int/7.6; 4:odmor; 5:lako/8.3; 6:odmor; 7:lr/10.1 | 10.1/62.3 | D3 I: 2.4 km/10.9 min; pauza 163s | 3 | — |
| 6 | 33.4 | 1:lako/7.1+ubrz; 2:snaga; 3:int/7.4; 4:odmor; 5:tempo/8.3; 6:odmor; 7:lr/10.6 | 10.6/65.4 | D3 I: 1.3 km/6 min; pauza 60s · D5 T: 3.2 km/16.1 min; kontinuirano | 3,5 | — |
| 7 | 35.7 | 1:lako/7.4+ubrz; 2:snaga; 3:int/8.5; 4:odmor; 5:tempo/8.6; 6:odmor; 7:lr/11.2 | 11.2/69.1 | D3 I: 2 km/9.1 min; pauza 204s · D5 T: 3.2 km/16.1 min; pauza 90s | 3,5 | — |
| 8 | 24 | 1:lako/5.7+ubrz; 2:snaga; 3:int/5.1; 4:odmor; 5:lako/5; 6:odmor; 7:lr/8.2 | 8.2/50.6 | D3 R: 0.8 km/3.5 min; pauza 131s | 3 | deload |
| 9 | 35.2 | 1:lako/5.7+ubrz; 2:snaga; 3:int/8.8; 4:odmor; 5:tempo/8.8; 6:odmor; 7:lr/11.9 | 11.9/73.4 | D3 I: 2.8 km/12.7 min; pauza 163s · D5 T: 3.2 km/16.1 min; pauza 90s | 3,5 | — |
| 10 | 38.3 | 1:lako/7.9+ubrz; 2:snaga; 3:int/8.6; 4:odmor; 5:tempo/9.3; 6:odmor; 7:lr/12.5 | 12.5/77.1 | D3 I: 1.8 km/8 min; pauza 60s · D5 T: 3.8 km/19.1 min; kontinuirano | 3,5 | — |
| 11 | 40.3 | 1:lako/8.8+ubrz; 2:snaga; 3:int/9.4; 4:odmor; 5:tempo/8.9; 6:odmor; 7:lr/13.2 | 13.2/81.4 | D3 I: 2.2 km/10 min; pauza 224s · D5 T: 3.2 km/16.1 min; pauza 90s | 3,5 | — |
| 12 | 27.4 | 1:lako/6.7+ubrz; 2:snaga; 3:int/5.2; 4:odmor; 5:lako/5.9; 6:odmor; 7:lr/9.6 | 9.6/59.2 | D3 R: 0.8 km/3.5 min; pauza 131s | 3 | deload |
| 13 | 37.9 | 1:lako/6.7+ubrz; 2:snaga; 3:int/8.8; 4:odmor; 5:tempo/8.5; 6:odmor; 7:lr/13.9 | 13.9/85.7 | D3 RP: 3 km/14.3 min; pauza 90s · D5 T: 3 km/15.1 min; kontinuirano | 3,5 | — |
| 14 | 41.2 | 1:lako/9.6+ubrz; 2:snaga; 3:int/9.1; 4:odmor; 5:tempo/8.5; 6:odmor; 7:lr/14 | 14/86.3 | D3 I: 3 km/13.6 min; pauza 122s · D5 T: 3 km/15.1 min; kontinuirano | 3,5 | — |
| 15 | 23.6 | 1:lako/6.4; 2:snaga; 3:int/4; 4:odmor; 5:tempo/4.8; 6:odmor; 7:lr/8.4 | 8.4/51.8 | D3 RP: 1.6 km/7.6 min; pauza 90s · D5 T: 2.2 km/11 min; kontinuirano | 3,5 | taper |
| 16 | 15.5 | 1:lako/3; 2:odmor; 3:lako/3; 4:odmor; 5:int/4.5; 6:odmor; 7:trka/5 | 4.5/n/p | D5 R: 0.6 km/2.8 min; pauza 141s | 5 | trka |

### U02 B — dnevna i nedeljna provera

| N | km | D1–D7: tip/km | Najduža sesija pre trke: km/min | Kvalitet: zona, rad, oporavak | Dani kvaliteta sa LR završetkom | Rasterećenje |
|---:|---:|---|---|---|---|---|
| 1 | 31.6 | 1:lako/8+ubrz; 2:snaga; 3:int/6.7; 4:odmor; 5:lako/6.9; 6:odmor; 7:lr/10 | 10/61.7 | D3 T: 0.5 km/2.5 min; pauza 90s | 3 | — |
| 2 | 32.7 | 1:lako/8+ubrz; 2:snaga; 3:int/6.3; 4:odmor; 5:lako/7.6; 6:odmor; 7:lr/10.8 | 10.8/66.6 | D3 T: 0.4 km/2.3 min; pauza 90s | 3 | — |
| 3 | 34 | 1:lako/8.6+ubrz; 2:snaga; 3:int/6.3; 4:odmor; 5:tempo/7.5; 6:odmor; 7:lr/11.6 | 11.6/71.5 | D3 R: 0.9 km/3.9 min; pauza 196s · D5 T: 2.2 km/11 min; pauza 90s | 3,5 | — |
| 4 | 24.8 | 1:lako/6.2+ubrz; 2:snaga; 3:lako/5.4; 4:odmor; 5:lako/4.8; 6:odmor; 7:lr/8.4 | 8.4/51.8 | bez kvaliteta | — | deload |
| 5 | 37 | 1:lako/9.9+ubrz; 2:snaga; 3:int/7.1; 4:odmor; 5:tempo/7.5; 6:odmor; 7:lr/12.5 | 12.5/77.1 | D3 I: 2 km/9.1 min; pauza 204s · D5 T: 2.4 km/12 min; pauza 90s | 3,5 | — |
| 6 | 38.5 | 1:lako/10+ubrz; 2:snaga; 3:int/7; 4:odmor; 5:tempo/8; 6:odmor; 7:lr/13.5 | 13.5/83.3 | D3 I: 1.1 km/5 min; pauza 60s · D5 T: 2.9 km/14.5 min; kontinuirano | 3,5 | — |
| 7 | 40.9 | 1:lako/10.8+ubrz; 2:snaga; 3:int/7.4; 4:odmor; 5:tempo/8.2; 6:odmor; 7:lr/14.5 | 14.5/89.4 | D3 I: 2 km/9.1 min; pauza 204s · D5 T: 2.8 km/14 min; pauza 90s | 3,5 | — |
| 8 | 29.9 | 1:lako/7.3+ubrz; 2:snaga; 3:lako/6.3; 4:odmor; 5:lako/5.7; 6:odmor; 7:lr/10.6 | 10.6/65.4 | bez kvaliteta | — | deload |
| 9 | 43 | 1:lako/11.6+ubrz; 2:snaga; 3:int/8.4; 4:odmor; 5:tempo/8.5; 6:odmor; 7:lr/14.5 | 14.5/89.4 | D3 I: 2.3 km/10.4 min; pauza 143s · D5 T: 2.8 km/14 min; pauza 90s | 3,5 | — |
| 10 | 43.3 | 1:lako/11.6+ubrz; 2:snaga; 3:int/8.2; 4:odmor; 5:tempo/9; 6:odmor; 7:lr/14.5 | 14.5/89.4 | D3 I: 1.5 km/7 min; pauza 60s · D5 T: 3.5 km/17.6 min; kontinuirano | 3,5 | — |
| 11 | 42.7 | 1:lako/11.6+ubrz; 2:snaga; 3:int/8.1; 4:odmor; 5:tempo/8.5; 6:odmor; 7:lr/14.5 | 14.5/89.4 | D3 I: 2.2 km/10 min; pauza 224s · D5 T: 2.8 km/14 min; pauza 90s | 3,5 | — |
| 12 | 31.1 | 1:lako/8+ubrz; 2:snaga; 3:lako/6.9; 4:odmor; 5:lako/6.2; 6:odmor; 7:lr/10 | 10/61.7 | bez kvaliteta | — | deload |
| 13 | 42 | 1:lako/11.6+ubrz; 2:snaga; 3:int/7.7; 4:odmor; 5:tempo/8.2; 6:odmor; 7:lr/14.5 | 14.5/89.4 | D3 RP: 2 km/9.5 min; pauza 214s · D5 T: 2.7 km/13.5 min; kontinuirano | 3,5 | — |
| 14 | 42.7 | 1:lako/11.6+ubrz; 2:snaga; 3:int/8.4; 4:odmor; 5:tempo/8.2; 6:odmor; 7:lr/14.5 | 14.5/89.4 | D3 I: 2.4 km/10.9 min; pauza 122s · D5 T: 2.7 km/13.5 min; kontinuirano | 3,5 | — |
| 15 | 23.9 | 1:lako/7; 2:snaga; 3:int/3.5; 4:odmor; 5:tempo/4.7; 6:odmor; 7:lr/8.7 | 8.7/53.6 | D3 RP: 1.2 km/5.7 min; pauza 86s · D5 T: 2 km/10 min; kontinuirano | 3,5 | taper |
| 16 | 15.5 | 1:lako/3; 2:odmor; 3:lako/3; 4:odmor; 5:int/4.5; 6:odmor; 7:trka/5 | 4.5/n/p | D5 R: 0.6 km/2.8 min; pauza 141s | 5 | trka |

### U03 A — dnevna i nedeljna provera

| N | km | D1–D7: tip/km | Najduža sesija pre trke: km/min | Kvalitet: zona, rad, oporavak | Dani kvaliteta sa LR završetkom | Rasterećenje |
|---:|---:|---|---|---|---|---|
| 1 | 51.5 | 1:lako/11.2+ubrz; 2:int/7.7; 3:lako/9.8; 4:snaga; 5:tempo/8.8; 6:odmor; 7:lr/14 | 14/75.6 | D2 I: 2 km/7.9 min; pauza 178s · D5 T: 3 km/13.2 min; pauza 90s | 2,5 | — |
| 2 | 53.6 | 1:lako/11.2+ubrz; 2:int/8; 3:lako/10.5; 4:snaga; 5:tempo/8.8; 6:odmor; 7:lr/15.1 | 15.1/81.5 | D2 I: 2.4 km/9.5 min; pauza 142s · D5 T: 3.2 km/14 min; pauza 90s | 2,5 | — |
| 3 | 55.9 | 1:lako/12.1+ubrz; 2:int/7.9; 3:lako/11.2; 4:snaga; 5:tempo/8.4; 6:odmor; 7:lr/16.3 | 16.3/88 | D2 R: 2.1 km/8 min; pauza 171s · D5 T: 3.2 km/14 min; pauza 90s | 2,5 | — |
| 4 | 40.3 | 1:lako/8.3+ubrz; 2:lako/7.2; 3:lako/6.5; 4:snaga; 5:lako/6.1; 6:odmor; 7:lr/12.2 | 12.2/65.9 | bez kvaliteta | — | deload |
| 5 | 51.7 | 1:lako/11.8+ubrz; 2:int/6.1; 3:lako/10.2; 4:snaga; 5:tempo/7; 6:odmor; 7:lr/16.6 | 16.6/89.6 | D2 I: 2.4 km/9.5 min; pauza 213s · D5 T: 3.2 km/14 min; pauza 90s | 2,5 | — |
| 6 | 54.5 | 1:lako/12.2+ubrz; 2:int/7.5; 3:lako/10.7; 4:snaga; 5:tempo/7.5; 6:odmor; 7:lr/16.6 | 16.6/89.6 | D2 I: 2.3 km/9 min; pauza 60s · D5 T: 4 km/17.5 min; kontinuirano | 2,5 | — |
| 7 | 56.5 | 1:lako/13.3+ubrz; 2:int/7.1; 3:lako/11.5; 4:snaga; 5:tempo/8; 6:odmor; 7:lr/16.6 | 16.6/89.6 | D2 I: 2.4 km/9.5 min; pauza 213s · D5 T: 3.2 km/14 min; pauza 90s | 2,5 | — |
| 8 | 40.2 | 1:lako/8.2+ubrz; 2:lako/7.1; 3:lako/6.4; 4:snaga; 5:lako/6.1; 6:odmor; 7:lr/12.4 | 12.4/67 | bez kvaliteta | — | deload |
| 9 | 51.7 | 1:lako/11.2+ubrz; 2:int/7.1; 3:lako/9.8; 4:snaga; 5:tempo/7; 6:odmor; 7:lr/16.6 | 16.6/89.6 | D2 I: 3 km/11.9 min; pauza 178s · D5 T: 3.2 km/14 min; pauza 90s | 2,5 | — |
| 10 | 54.5 | 1:lako/12.2+ubrz; 2:int/7.5; 3:lako/10.6; 4:snaga; 5:tempo/7.6; 6:odmor; 7:lr/16.6 | 16.6/89.6 | D2 I: 2.3 km/9 min; pauza 60s · D5 T: 4.1 km/18 min; kontinuirano | 2,5 | — |
| 11 | 56.5 | 1:lako/13.3+ubrz; 2:int/7.1; 3:lako/11.5; 4:snaga; 5:tempo/8; 6:odmor; 7:lr/16.6 | 16.6/89.6 | D2 I: 2.4 km/9.5 min; pauza 213s · D5 T: 3.2 km/14 min; pauza 90s | 2,5 | — |
| 12 | 40.2 | 1:lako/8.2+ubrz; 2:lako/7.1; 3:lako/6.4; 4:snaga; 5:lako/6.1; 6:odmor; 7:lr/12.4 | 12.4/67 | bez kvaliteta | — | deload |
| 13 | 51.7 | 1:lako/11.8+ubrz; 2:int/6.8; 3:lako/10.3; 4:snaga; 5:tempo/6.2; 6:odmor; 7:lr/16.6 | 16.6/89.6 | D2 RP: 3 km/12.4 min; pauza 185s · D5 T: 2.7 km/11.8 min; kontinuirano | 2,5 | — |
| 14 | 54.5 | 1:lako/12.7+ubrz; 2:int/7.9; 3:lako/11.1; 4:snaga; 5:tempo/6.2; 6:odmor; 7:lr/16.6 | 16.6/89.6 | D2 I: 3.6 km/14.2 min; pauza 107s · D5 T: 2.7 km/11.8 min; kontinuirano | 2,5 | — |
| 15 | 34.7 | 1:lako/7.9; 2:int/4; 3:lako/6.9; 4:snaga; 5:tempo/6; 6:odmor; 7:lr/9.9 | 9.9/53.5 | D2 RP: 1.2 km/4.9 min; pauza 74s · D5 T: 2.6 km/11.4 min; kontinuirano | 2,5 | taper |
| 16 | 15.5 | 1:odmor; 2:lako/3; 3:lako/3; 4:odmor; 5:int/4.5; 6:odmor; 7:trka/5 | 4.5/n/p | D5 R: 0.6 km/2.4 min; pauza 122s | 5 | trka |

### U03 B — dnevna i nedeljna provera

| N | km | D1–D7: tip/km | Najduža sesija pre trke: km/min | Kvalitet: zona, rad, oporavak | Dani kvaliteta sa LR završetkom | Rasterećenje |
|---:|---:|---|---|---|---|---|
| 1 | 52.8 | 1:lako/10+ubrz; 2:int/9; 3:lako/8.7; 4:snaga; 5:tempo/10.8; 6:odmor; 7:lr/14.3 | 14.3/77.2 | D2 R: 2.4 km/9.1 min; pauza 171s · D5 T: 4.8 km/21 min; pauza 90s | 2,5 | — |
| 2 | 53.5 | 1:lako/10+ubrz; 2:int/9; 3:lako/9; 4:snaga; 5:tempo/10.8; 6:odmor; 7:lr/14.7 | 14.7/79.4 | D2 R: 2.4 km/9.1 min; pauza 171s · D5 T: 4.8 km/21 min; pauza 90s | 2,5 | — |
| 3 | 55.2 | 1:lako/10.3+ubrz; 2:int/9.4; 3:lako/9.4; 4:snaga; 5:tempo/10.8; 6:odmor; 7:lr/15.3 | 15.3/82.6 | D2 R: 2.7 km/10.3 min; pauza 171s · D5 T: 4.8 km/21 min; pauza 90s | 2,5 | — |
| 4 | 37.1 | 1:lako/7.6+ubrz; 2:int/6; 3:lako/6.6; 4:snaga; 5:lako/6; 6:odmor; 7:lr/10.9 | 10.9/58.9 | D2 R: 1 km/3.8 min; pauza 114s | 2 | deload |
| 5 | 49.5 | 1:lako/7.6+ubrz; 2:int/9; 3:lako/8.5; 4:snaga; 5:tempo/10.4; 6:odmor; 7:lr/14 | 14/75.6 | D2 I: 3.6 km/14.2 min; pauza 213s · D5 T: 4.8 km/21 min; pauza 90s | 2,5 | — |
| 6 | 53.4 | 1:lako/9.8+ubrz; 2:int/9.9; 3:lako/8.9; 4:snaga; 5:tempo/10.1; 6:odmor; 7:lr/14.7 | 14.7/79.4 | D2 I: 2.5 km/10 min; pauza 60s · D5 T: 4.5 km/19.7 min; kontinuirano | 2,5 | — |
| 7 | 55.2 | 1:lako/10.3+ubrz; 2:int/9.4; 3:lako/9.4; 4:snaga; 5:tempo/10.8; 6:odmor; 7:lr/15.3 | 15.3/82.6 | D2 I: 3.6 km/14.2 min; pauza 213s · D5 T: 4.8 km/21 min; pauza 90s | 2,5 | — |
| 8 | 37.1 | 1:lako/7.6+ubrz; 2:int/6; 3:lako/6.6; 4:snaga; 5:lako/6; 6:odmor; 7:lr/10.9 | 10.9/58.9 | D2 R: 1 km/3.8 min; pauza 114s | 2 | deload |
| 9 | 49.4 | 1:lako/7.6+ubrz; 2:int/9.1; 3:lako/8.5; 4:snaga; 5:tempo/10.2; 6:odmor; 7:lr/14 | 14/75.6 | D2 I: 3.6 km/14.2 min; pauza 213s · D5 T: 4.8 km/21 min; pauza 90s | 2,5 | — |
| 10 | 53.4 | 1:lako/9.8+ubrz; 2:int/9.9; 3:lako/8.9; 4:snaga; 5:tempo/10.1; 6:odmor; 7:lr/14.7 | 14.7/79.4 | D2 I: 2.5 km/10 min; pauza 60s · D5 T: 4.5 km/19.7 min; kontinuirano | 2,5 | — |
| 11 | 55.2 | 1:lako/10.3+ubrz; 2:int/9.4; 3:lako/9.4; 4:snaga; 5:tempo/10.8; 6:odmor; 7:lr/15.3 | 15.3/82.6 | D2 I: 3.6 km/14.2 min; pauza 213s · D5 T: 4.8 km/21 min; pauza 90s | 2,5 | — |
| 12 | 37.1 | 1:lako/7.6+ubrz; 2:int/6; 3:lako/6.6; 4:snaga; 5:lako/6; 6:odmor; 7:lr/10.9 | 10.9/58.9 | D2 R: 1 km/3.8 min; pauza 114s | 2 | deload |
| 13 | 48.5 | 1:lako/7.6+ubrz; 2:int/10; 3:lako/8.4; 4:snaga; 5:tempo/8.5; 6:odmor; 7:lr/14 | 14/75.6 | D2 RP: 4 km/16.5 min; pauza 90s · D5 T: 3 km/13.2 min; kontinuirano | 2,5 | — |
| 14 | 52.5 | 1:lako/9.8+ubrz; 2:int/10.6; 3:lako/8.9; 4:snaga; 5:tempo/8.5; 6:odmor; 7:lr/14.7 | 14.7/79.4 | D2 I: 4.2 km/16.6 min; pauza 107s · D5 T: 3 km/13.2 min; kontinuirano | 2,5 | — |
| 15 | 32.4 | 1:lako/6.8; 2:int/4.5; 3:lako/5.9; 4:snaga; 5:tempo/6; 6:odmor; 7:lr/9.2 | 9.2/49.7 | D2 RP: 1.6 km/6.6 min; pauza 90s · D5 T: 2.7 km/11.8 min; kontinuirano | 2,5 | taper |
| 16 | 15.5 | 1:odmor; 2:lako/3; 3:lako/3; 4:odmor; 5:int/4.5; 6:odmor; 7:trka/5 | 4.5/n/p | D5 R: 0.6 km/2.4 min; pauza 122s | 5 | trka |

### U04 A — dnevna i nedeljna provera

| N | km | D1–D7: tip/km | Najduža sesija pre trke: km/min | Kvalitet: zona, rad, oporavak | Dani kvaliteta sa LR završetkom | Rasterećenje |
|---:|---:|---|---|---|---|---|
| 1 | 26.8 | 1:lako/6.8+ubrz; 2:snaga; 3:int/4.3; 4:odmor; 5:lako/6; 6:odmor; 7:lr/9.7 | 9.7/62.7 | D3 R: 1.2 km/5.5 min; pauza 206s | 3 | — |
| 2 | 28 | 1:lako/6.8+ubrz; 2:snaga; 3:int/4.5; 4:odmor; 5:tempo/6.3; 6:odmor; 7:lr/10.4 | 10.4/67.3 | D3 R: 1.2 km/5.5 min; pauza 206s · D5 T: 2.8 km/14.7 min; kontinuirano | 3,5 | — |
| 3 | 30.8 | 1:lako/7.3+ubrz; 2:snaga; 3:int/5.4; 4:odmor; 5:lako/7.1; 6:odmor; 7:lr/11 | 11/71.1 | D3 R: 1.2 km/5.5 min; pauza 206s | 3 | — |
| 4 | 22.5 | 1:lako/5.9+ubrz; 2:snaga; 3:int/3.1; 4:odmor; 5:lako/5.1; 6:odmor; 7:lr/8.4 | 8.4/54.3 | D3 R: 0.8 km/3.7 min; pauza 137s | 3 | deload |
| 5 | 31.4 | 1:lako/5.9+ubrz; 2:snaga; 3:int/7.2; 4:odmor; 5:lako/7.3; 6:odmor; 7:lr/11 | 11/71.1 | D3 I: 2 km/9.5 min; pauza 214s | 3 | — |
| 6 | 34.6 | 1:lako/7.3+ubrz; 2:snaga; 3:int/7.8; 4:odmor; 5:tempo/8.5; 6:odmor; 7:lr/11 | 11/71.1 | D3 I: 1.9 km/9 min; pauza 90s · D5 T: 3.4 km/17.9 min; kontinuirano | 3,5 | — |
| 7 | 36.9 | 1:lako/7.7+ubrz; 2:snaga; 3:int/9; 4:odmor; 5:tempo/9.1; 6:odmor; 7:lr/11.1 | 11.1/71.8 | D3 I: 2 km/9.5 min; pauza 214s · D5 T: 3.2 km/16.9 min; pauza 90s | 3,5 | — |
| 8 | 27.8 | 1:lako/7+ubrz; 2:snaga; 3:int/4.7; 4:odmor; 5:lako/6.1; 6:odmor; 7:lr/10 | 10/64.7 | D3 R: 0.8 km/3.7 min; pauza 137s | 3 | deload |
| 9 | 37.7 | 1:lako/7+ubrz; 2:snaga; 3:int/9.5; 4:odmor; 5:tempo/9.5; 6:odmor; 7:lr/11.7 | 11.7/75.7 | D3 I: 2.8 km/13.3 min; pauza 171s · D5 T: 3.2 km/16.9 min; pauza 90s | 3,5 | — |
| 10 | 40.6 | 1:lako/8.2+ubrz; 2:snaga; 3:int/10; 4:odmor; 5:tempo/10.1; 6:odmor; 7:lr/12.3 | 12.3/79.5 | D3 I: 2.2 km/10.5 min; pauza 90s · D5 T: 4 km/21.1 min; kontinuirano | 3,5 | — |
| 11 | 41.3 | 1:lako/8.6+ubrz; 2:snaga; 3:int/9.8; 4:odmor; 5:tempo/9.9; 6:odmor; 7:lr/13 | 13/84.1 | D3 I: 3 km/14.3 min; pauza 214s · D5 T: 3.2 km/16.9 min; pauza 90s | 3,5 | — |
| 12 | 31 | 1:lako/7.5+ubrz; 2:snaga; 3:int/6.3; 4:odmor; 5:lako/6.5; 6:odmor; 7:lr/10.7 | 10.7/69.2 | D3 R: 0.8 km/3.7 min; pauza 137s | 3 | deload |
| 13 | 37.6 | 1:lako/7.5+ubrz; 2:snaga; 3:int/9.8; 4:odmor; 5:tempo/7.6; 6:odmor; 7:lr/12.7 | 12.7/82.1 | D3 RP: 3 km/15.6 min; pauza 60s · D5 T: 2.5 km/13.3 min; kontinuirano | 3,5 | — |
| 14 | 40.9 | 1:lako/6.6+ubrz; 2:snaga; 3:int/10.4; 4:odmor; 5:tempo/10.5; 6:odmor; 7:lr/13.4 | 13.4/86.7 | D3 RP: 3.6 km/18.7 min; pauza 60s · D5 T: 4 km/21.1 min; kontinuirano | 3,5 | — |
| 15 | 25.9 | 1:lako/7; 2:snaga; 3:int/4.5; 4:odmor; 5:tempo/5.7; 6:odmor; 7:lr/8.7 | 8.7/56.3 | D3 RP: 1.8 km/9.3 min; pauza 75s · D5 T: 2.5 km/13.2 min; kontinuirano | 3,5 | taper |
| 16 | 20.5 | 1:lako/3; 2:odmor; 3:lako/3; 4:odmor; 5:int/4.5; 6:odmor; 7:trka/10 | 4.5/n/p | D5 R: 1 km/5.1 min; pauza 154s | 5 | trka |

### U04 B — dnevna i nedeljna provera

| N | km | D1–D7: tip/km | Najduža sesija pre trke: km/min | Kvalitet: zona, rad, oporavak | Dani kvaliteta sa LR završetkom | Rasterećenje |
|---:|---:|---|---|---|---|---|
| 1 | 27 | 1:lako/6.4+ubrz; 2:snaga; 3:int/7.1; 4:odmor; 5:lako/5.5; 6:odmor; 7:lr/8 | 8/51.7 | D3 T: 0.5 km/2.5 min; pauza 90s | 3 | — |
| 2 | 28.1 | 1:lako/6.4+ubrz; 2:snaga; 3:int/7.2; 4:odmor; 5:lako/5.9; 6:odmor; 7:lr/8.6 | 8.6/55.6 | D3 T: 0.6 km/3 min; pauza 90s | 3 | — |
| 3 | 29.5 | 1:lako/6.9+ubrz; 2:snaga; 3:tempo/6.9; 4:odmor; 5:tempo/6.5; 6:odmor; 7:lr/9.2 | 9.2/59.5 | D3 T: 1.1 km/5.8 min; kontinuirano · D5 T: 0.7 km/3.7 min; kontinuirano | 3,5 | — |
| 4 | 22.2 | 1:lako/5.2+ubrz; 2:snaga; 3:tempo/5.9; 4:odmor; 5:lako/4.5; 6:odmor; 7:lr/6.6 | 6.6/42.7 | D3 T: 0.4 km/2.1 min; kontinuirano | 3 | deload |
| 5 | 32.7 | 1:lako/7.8+ubrz; 2:snaga; 3:int/7.6; 4:odmor; 5:tempo/7.4; 6:odmor; 7:lr/9.9 | 9.9/64 | D3 I: 1.6 km/7.6 min; pauza 171s · D5 T: 1.4 km/7.4 min; pauza 90s | 3,5 | — |
| 6 | 34.5 | 1:lako/7.9+ubrz; 2:snaga; 3:int/7.9; 4:odmor; 5:tempo/8.1; 6:odmor; 7:lr/10.6 | 10.6/68.5 | D3 I: 1.6 km/7.5 min; pauza 90s · D5 T: 3 km/15.8 min; kontinuirano | 3,5 | — |
| 7 | 35.9 | 1:lako/8.5+ubrz; 2:snaga; 3:int/7.8; 4:odmor; 5:tempo/8.2; 6:odmor; 7:lr/11.4 | 11.4/73.7 | D3 I: 1.6 km/7.6 min; pauza 171s · D5 T: 2 km/10.5 min; pauza 90s | 3,5 | — |
| 8 | 26.5 | 1:lako/6.8+ubrz; 2:snaga; 3:lako/5.9; 4:odmor; 5:lako/5.3; 6:odmor; 7:lr/8.5 | 8.5/55 | bez kvaliteta | — | deload |
| 9 | 39 | 1:lako/9.8+ubrz; 2:snaga; 3:int/8.4; 4:odmor; 5:tempo/8.5; 6:odmor; 7:lr/12.3 | 12.3/79.5 | D3 I: 2.3 km/10.9 min; pauza 150s · D5 T: 2.8 km/14.7 min; pauza 90s | 3,5 | — |
| 10 | 40.3 | 1:lako/9.8+ubrz; 2:snaga; 3:int/8.6; 4:odmor; 5:tempo/8.7; 6:odmor; 7:lr/13.2 | 13.2/85.4 | D3 I: 1.9 km/9 min; pauza 90s · D5 T: 3.4 km/17.9 min; kontinuirano | 3,5 | — |
| 11 | 42.6 | 1:lako/10.6+ubrz; 2:snaga; 3:int/8.5; 4:odmor; 5:tempo/9.3; 6:odmor; 7:lr/14.2 | 14.2/91.8 | D3 I: 2 km/9.5 min; pauza 214s · D5 T: 2.8 km/14.7 min; pauza 90s | 3,5 | — |
| 12 | 32 | 1:lako/8.1+ubrz; 2:snaga; 3:lako/7.1; 4:odmor; 5:lako/6.4; 6:odmor; 7:lr/10.4 | 10.4/67.3 | bez kvaliteta | — | deload |
| 13 | 42.2 | 1:lako/12.2+ubrz; 2:snaga; 3:int/7.5; 4:odmor; 5:tempo/7.2; 6:odmor; 7:lr/15.3 | 15.3/98.9 | D3 RP: 2 km/10.4 min; pauza 233s · D5 T: 2.4 km/12.6 min; kontinuirano | 3,5 | — |
| 14 | 43.8 | 1:lako/12.2+ubrz; 2:snaga; 3:int/7.3; 4:odmor; 5:tempo/8.1; 6:odmor; 7:lr/16.2 | 16.2/104.8 | D3 RP: 2.4 km/12.4 min; pauza 240s · D5 T: 3.4 km/17.9 min; kontinuirano | 3,5 | — |
| 15 | 28 | 1:lako/8.4; 2:snaga; 3:int/3.7; 4:odmor; 5:tempo/5.4; 6:odmor; 7:lr/10.5 | 10.5/67.9 | D3 RP: 1.2 km/6.2 min; pauza 140s · D5 T: 2.3 km/12.1 min; kontinuirano | 3,5 | taper |
| 16 | 20.5 | 1:lako/3; 2:odmor; 3:lako/3; 4:odmor; 5:int/4.5; 6:odmor; 7:trka/10 | 4.5/n/p | D5 R: 1 km/5.1 min; pauza 154s | 5 | trka |

### U05 A — dnevna i nedeljna provera

| N | km | D1–D7: tip/km | Najduža sesija pre trke: km/min | Kvalitet: zona, rad, oporavak | Dani kvaliteta sa LR završetkom | Rasterećenje |
|---:|---:|---|---|---|---|---|
| 1 | 47.5 | 1:lako/11.2+ubrz; 2:tempo/6.5; 3:lako/9.7; 4:snaga; 5:tempo/6.1; 6:odmor; 7:lr/14 | 14/79.3 | D2 T: 1.4 km/6.4 min; pauza 90s · D5 T: 1.2 km/5.5 min; kontinuirano | 2,5 | — |
| 2 | 49.2 | 1:lako/11.2+ubrz; 2:int/5.7; 3:lako/10.5; 4:snaga; 5:tempo/6.7; 6:odmor; 7:lr/15.1 | 15.1/85.6 | D2 I: 2 km/8.3 min; pauza 187s · D5 T: 3.2 km/14.7 min; kontinuirano | 2,5 | — |
| 3 | 52.1 | 1:lako/12.1+ubrz; 2:tempo/6.5; 3:lako/11.3; 4:snaga; 5:tempo/5.9; 6:odmor; 7:lr/16.3 | 16.3/92.4 | D2 T: 2 km/9.2 min; pauza 90s · D5 T: 1.4 km/6.4 min; pauza 90s | 2,5 | — |
| 4 | 39.1 | 1:lako/8+ubrz; 2:lako/7; 3:lako/6.2; 4:snaga; 5:lako/5.9; 6:odmor; 7:lr/12 | 12/68 | bez kvaliteta | — | deload |
| 5 | 55.8 | 1:lako/13.5+ubrz; 2:int/6.1; 3:lako/11.7; 4:snaga; 5:tempo/6.9; 6:odmor; 7:lr/17.6 | 17.6/99.7 | D2 I: 2.4 km/10 min; pauza 224s · D5 T: 3.2 km/14.7 min; pauza 90s | 2,5 | — |
| 6 | 58.9 | 1:lako/13.1+ubrz; 2:int/7.9; 3:lako/11.4; 4:snaga; 5:tempo/8; 6:odmor; 7:lr/18.5 | 18.5/104.8 | D2 I: 2.5 km/10.5 min; pauza 90s · D5 T: 4.5 km/20.7 min; kontinuirano | 2,5 | — |
| 7 | 62.1 | 1:lako/14+ubrz; 2:int/8.1; 3:lako/12.2; 4:snaga; 5:tempo/9.3; 6:odmor; 7:lr/18.5 | 18.5/104.8 | D2 I: 2.4 km/10 min; pauza 224s · D5 T: 3.6 km/16.6 min; pauza 90s | 2,5 | — |
| 8 | 46.6 | 1:lako/9.7+ubrz; 2:lako/8.4; 3:lako/7.6; 4:snaga; 5:lako/7.1; 6:odmor; 7:lr/13.8 | 13.8/78.2 | bez kvaliteta | — | deload |
| 9 | 65.1 | 1:lako/14+ubrz; 2:int/10.1; 3:lako/12.2; 4:snaga; 5:tempo/10.3; 6:odmor; 7:lr/18.5 | 18.5/104.8 | D2 I: 3 km/12.5 min; pauza 187s · D5 T: 3.6 km/16.6 min; pauza 90s | 2,5 | — |
| 10 | 68.2 | 1:lako/14+ubrz; 2:int/12.2; 3:lako/12.2; 4:snaga; 5:tempo/11.3; 6:odmor; 7:lr/18.5 | 18.5/104.8 | D2 I: 3.3 km/13.5 min; pauza 90s · D5 T: 4.8 km/22.1 min; kontinuirano | 2,5 | — |
| 11 | 65.2 | 1:lako/14+ubrz; 2:int/9.9; 3:lako/12.1; 4:snaga; 5:tempo/10.7; 6:odmor; 7:lr/18.5 | 18.5/104.8 | D2 I: 2.4 km/10 min; pauza 224s · D5 T: 4 km/18.4 min; pauza 90s | 2,5 | — |
| 12 | 48.9 | 1:lako/10.5+ubrz; 2:lako/9.2; 3:lako/8.2; 4:snaga; 5:lako/7.8; 6:odmor; 7:lr/13.2 | 13.2/74.8 | bez kvaliteta | — | deload |
| 13 | 65.6 | 1:lako/14+ubrz; 2:int/9.2; 3:lako/12.1; 4:snaga; 5:tempo/11.8; 6:odmor; 7:lr/18.5 | 18.5/104.8 | D2 RP: 3.6 km/16.2 min; pauza 240s · D5 T: 3.9 km/18.1 min; kontinuirano | 2,5 | — |
| 14 | 65.9 | 1:lako/14+ubrz; 2:int/9.9; 3:lako/12.2; 4:snaga; 5:tempo/11.3; 6:odmor; 7:lr/18.5 | 18.5/104.8 | D2 RP: 3.2 km/14.4 min; pauza 240s · D5 T: 4.8 km/22.1 min; kontinuirano | 2,5 | — |
| 15 | 40.9 | 1:lako/9.6; 2:int/4.2; 3:lako/8.3; 4:snaga; 5:tempo/6.8; 6:odmor; 7:lr/12 | 12/68 | D2 RP: 1.2 km/5.4 min; pauza 122s · D5 T: 3.3 km/15.2 min; kontinuirano | 2,5 | taper |
| 16 | 20.5 | 1:odmor; 2:lako/3; 3:lako/3; 4:odmor; 5:int/4.5; 6:odmor; 7:trka/10 | 4.5/n/p | D5 R: 1 km/4.4 min; pauza 133s | 5 | trka |

### U05 B — dnevna i nedeljna provera

| N | km | D1–D7: tip/km | Najduža sesija pre trke: km/min | Kvalitet: zona, rad, oporavak | Dani kvaliteta sa LR završetkom | Rasterećenje |
|---:|---:|---|---|---|---|---|
| 1 | 47.5 | 1:lako/9.8+ubrz; 2:int/6.1; 3:lako/8.5; 4:snaga; 5:tempo/8.8; 6:odmor; 7:lr/14.3 | 14.3/81 | D2 R: 1.8 km/7.2 min; pauza 180s · D5 T: 3.2 km/14.7 min; pauza 90s | 2,5 | — |
| 2 | 48.8 | 1:lako/10+ubrz; 2:int/6.1; 3:lako/9.2; 4:snaga; 5:tempo/8.5; 6:odmor; 7:lr/15 | 15/85 | D2 R: 1.8 km/7.2 min; pauza 180s · D5 T: 4.8 km/22.1 min; kontinuirano | 2,5 | — |
| 3 | 52.3 | 1:lako/10.5+ubrz; 2:int/7.5; 3:lako/9.7; 4:snaga; 5:tempo/8.7; 6:odmor; 7:lr/15.9 | 15.9/90.1 | D2 R: 2.1 km/8.4 min; pauza 180s · D5 T: 4 km/18.4 min; pauza 90s | 2,5 | — |
| 4 | 39.3 | 1:lako/8.2+ubrz; 2:int/5.8; 3:lako/7.1; 4:snaga; 5:lako/6.4; 6:odmor; 7:lr/11.8 | 11.8/66.9 | D2 R: 1 km/4 min; pauza 120s | 2 | deload |
| 5 | 51.5 | 1:lako/8.3+ubrz; 2:int/8.6; 3:lako/10.2; 4:snaga; 5:tempo/7.7; 6:odmor; 7:lr/16.7 | 16.7/94.6 | D2 I: 3.6 km/14.9 min; pauza 224s · D5 T: 4 km/18.4 min; pauza 90s | 2,5 | — |
| 6 | 56 | 1:lako/8.7+ubrz; 2:int/10.5; 3:lako/10.2; 4:snaga; 5:tempo/8.9; 6:odmor; 7:lr/17.7 | 17.7/100.3 | D2 I: 4 km/16.5 min; pauza 90s · D5 T: 5.4 km/24.8 min; kontinuirano | 2,5 | — |
| 7 | 60.9 | 1:lako/10.8+ubrz; 2:int/10; 3:lako/10.5; 4:snaga; 5:tempo/11.2; 6:odmor; 7:lr/18.4 | 18.4/104.3 | D2 I: 4.8 km/19.9 min; pauza 224s · D5 T: 6 km/27.6 min; pauza 90s | 2,5 | — |
| 8 | 45.7 | 1:lako/9.6+ubrz; 2:int/6.6; 3:lako/8.3; 4:snaga; 5:lako/7.5; 6:odmor; 7:lr/13.7 | 13.7/77.6 | D2 R: 1.2 km/4.8 min; pauza 120s | 2 | deload |
| 9 | 62.3 | 1:lako/9.6+ubrz; 2:int/10.7; 3:lako/10.5; 4:snaga; 5:tempo/13; 6:odmor; 7:lr/18.5 | 18.5/104.8 | D2 I: 3.6 km/14.9 min; pauza 224s · D5 T: 6 km/27.6 min; pauza 90s | 2,5 | — |
| 10 | 66.3 | 1:lako/12+ubrz; 2:int/13.5; 3:lako/10.4; 4:snaga; 5:tempo/11.9; 6:odmor; 7:lr/18.5 | 18.5/104.8 | D2 I: 4 km/16.5 min; pauza 90s · D5 T: 5.4 km/24.8 min; kontinuirano | 2,5 | — |
| 11 | 65.6 | 1:lako/12+ubrz; 2:int/11.6; 3:lako/10.5; 4:snaga; 5:tempo/13; 6:odmor; 7:lr/18.5 | 18.5/104.8 | D2 I: 3.6 km/14.9 min; pauza 224s · D5 T: 6 km/27.6 min; pauza 90s | 2,5 | — |
| 12 | 49.3 | 1:lako/10.3+ubrz; 2:int/7.1; 3:lako/8.9; 4:snaga; 5:lako/8.1; 6:odmor; 7:lr/14.9 | 14.9/84.4 | D2 R: 1.2 km/4.8 min; pauza 120s | 2 | deload |
| 13 | 64 | 1:lako/10.4+ubrz; 2:int/12.3; 3:lako/10.4; 4:snaga; 5:tempo/12.4; 6:odmor; 7:lr/18.5 | 18.5/104.8 | D2 RP: 6 km/27 min; pauza 60s · D5 T: 4.1 km/19 min; kontinuirano | 2,5 | — |
| 14 | 64.4 | 1:lako/12+ubrz; 2:int/11.6; 3:lako/10.4; 4:snaga; 5:tempo/11.9; 6:odmor; 7:lr/18.5 | 18.5/104.8 | D2 RP: 4.8 km/21.6 min; pauza 75s · D5 T: 5.4 km/24.8 min; kontinuirano | 2,5 | — |
| 15 | 43.2 | 1:lako/9.6; 2:int/4.9; 3:lako/9.2; 4:snaga; 5:tempo/7.5; 6:odmor; 7:lr/12 | 12/68 | D2 RP: 1.8 km/8.1 min; pauza 75s · D5 T: 4 km/18.4 min; kontinuirano | 2,5 | taper |
| 16 | 20.5 | 1:odmor; 2:lako/3; 3:lako/3; 4:odmor; 5:int/4.5; 6:odmor; 7:trka/10 | 4.5/n/p | D5 R: 1 km/4.4 min; pauza 133s | 5 | trka |

### U06 A — dnevna i nedeljna provera

| N | km | D1–D7: tip/km | Najduža sesija pre trke: km/min | Kvalitet: zona, rad, oporavak | Dani kvaliteta sa LR završetkom | Rasterećenje |
|---:|---:|---|---|---|---|---|
| 1 | 14.1 | 1:rw/4.4; 2:snaga; 3:rw/3.8; 4:odmor; 5:odmor; 6:odmor; 7:rw/5.9 | 5.9/n/p | bez kvaliteta | — | — |
| 2 | 15.5 | 1:rw/4.8; 2:snaga; 3:rw/4.2; 4:odmor; 5:odmor; 6:odmor; 7:rw/6.5 | 6.5/n/p | bez kvaliteta | — | — |
| 3 | 16.9 | 1:rw/5.2; 2:snaga; 3:rw/4.6; 4:odmor; 5:odmor; 6:odmor; 7:rw/7.1 | 7.1/n/p | bez kvaliteta | — | — |
| 4 | 12.6 | 1:rw/3.9; 2:snaga; 3:rw/3.4; 4:odmor; 5:odmor; 6:odmor; 7:rw/5.3 | 5.3/n/p | bez kvaliteta | — | deload |
| 5 | 18.1 | 1:lako/5.6+ubrz; 2:snaga; 3:lako/4.9; 4:odmor; 5:odmor; 6:odmor; 7:lr/7.6 | 7.6/52.8 | bez kvaliteta | — | — |
| 6 | 18.9 | 1:lako/5.3+ubrz; 2:snaga; 3:lako/5.3; 4:odmor; 5:odmor; 6:odmor; 7:lr/8.3 | 8.3/57.7 | bez kvaliteta | — | — |
| 7 | 20.2 | 1:lako/5.8+ubrz; 2:snaga; 3:lako/5.6; 4:odmor; 5:odmor; 6:odmor; 7:lr/8.8 | 8.8/61.2 | bez kvaliteta | — | — |
| 8 | 15.2 | 1:lako/4.7+ubrz; 2:snaga; 3:lako/4.1; 4:odmor; 5:odmor; 6:odmor; 7:lr/6.4 | 6.4/44.5 | bez kvaliteta | — | deload |
| 9 | 21.1 | 1:lako/4.5+ubrz; 2:snaga; 3:tempo/6.8; 4:odmor; 5:odmor; 6:odmor; 7:lr/9.8 | 9.8/68.1 | D3 T: 1.9 km/10.8 min; kontinuirano | 3 | — |
| 10 | 23.3 | 1:lako/5.8+ubrz; 2:snaga; 3:int/7.1; 4:odmor; 5:odmor; 6:odmor; 7:lr/10.4 | 10.4/72.3 | D3 R: 0.9 km/4.4 min; pauza 221s | 3 | — |
| 11 | 25.5 | 1:lako/7.2+ubrz; 2:snaga; 3:lako/7.4; 4:odmor; 5:odmor; 6:odmor; 7:lr/10.9 | 10.9/75.8 | bez kvaliteta | — | — |
| 12 | 19.2 | 1:lako/5.6+ubrz; 2:snaga; 3:int/5.5; 4:odmor; 5:odmor; 6:odmor; 7:lr/8.1 | 8.1/56.3 | D3 R: 0.8 km/3.9 min; pauza 148s | 3 | deload |
| 13 | 25.7 | 1:lako/5.7+ubrz; 2:snaga; 3:lako/9; 4:odmor; 5:odmor; 6:odmor; 7:lr/11 | 11/76.5 | bez kvaliteta | — | — |
| 14 | 22.4 | 1:lako/7.7+ubrz; 2:snaga; 3:tempo/5.3; 4:odmor; 5:odmor; 6:odmor; 7:lr/9.4 | 9.4/65.3 | D3 T: 1.8 km/10 min; kontinuirano | 3 | — |
| 15 | 16.7 | 1:lako/5.8; 2:snaga; 3:int/3.9; 4:odmor; 5:odmor; 6:odmor; 7:lr/7 | 7/48.7 | D3 RP: 1.8 km/10.8 min; pauza 75s | 3 | taper |
| 16 | 14.4 | 1:lako/2.2; 2:odmor; 3:lako/2.2; 4:odmor; 5:odmor; 6:odmor; 7:trka/10 | 2.2/14.9 | bez kvaliteta | — | trka |

### U06 B — dnevna i nedeljna provera

| N | km | D1–D7: tip/km | Najduža sesija pre trke: km/min | Kvalitet: zona, rad, oporavak | Dani kvaliteta sa LR završetkom | Rasterećenje |
|---:|---:|---|---|---|---|---|
| 1 | 10.2 | 1:lako/3.2+ubrz; 2:snaga; 3:lako/3; 4:odmor; 5:odmor; 6:odmor; 7:lr/4 | 4/27.8 | bez kvaliteta | — | — |
| 2 | 10.4 | 1:lako/3.2+ubrz; 2:snaga; 3:lako/3; 4:odmor; 5:odmor; 6:odmor; 7:lr/4.2 | 4.2/29.2 | bez kvaliteta | — | — |
| 3 | 10.8 | 1:lako/3.4+ubrz; 2:snaga; 3:lako/3; 4:odmor; 5:odmor; 6:odmor; 7:lr/4.4 | 4.4/30.6 | bez kvaliteta | — | — |
| 4 | 8.1 | 1:lako/2.5+ubrz; 2:snaga; 3:lako/2.4; 4:odmor; 5:odmor; 6:odmor; 7:lr/3.2 | 3.2/22.2 | bez kvaliteta | — | deload |
| 5 | 12.7 | 1:lako/3.7+ubrz; 2:snaga; 3:int/4.4; 4:odmor; 5:odmor; 6:odmor; 7:lr/4.6 | 4.6/32 | D3 T: 0.5 km/3 min; pauza 90s | 3 | — |
| 6 | 13.1 | 1:lako/3.7+ubrz; 2:snaga; 3:int/4.6; 4:odmor; 5:odmor; 6:odmor; 7:lr/4.8 | 4.8/33.4 | D3 T: 0.5 km/3 min; pauza 90s | 3 | — |
| 7 | 13.5 | 1:lako/3.8+ubrz; 2:snaga; 3:int/4.7; 4:odmor; 5:odmor; 6:odmor; 7:lr/5 | 5/34.8 | D3 I: 0.9 km/4.5 min; pauza 90s | 3 | — |
| 8 | 10.2 | 1:lako/3.2+ubrz; 2:snaga; 3:lako/3; 4:odmor; 5:odmor; 6:odmor; 7:lr/4 | 4/27.8 | bez kvaliteta | — | deload |
| 9 | 14.5 | 1:lako/4.2+ubrz; 2:snaga; 3:int/5; 4:odmor; 5:odmor; 6:odmor; 7:lr/5.3 | 5.3/36.8 | D3 I: 1 km/5.1 min; pauza 115s | 3 | — |
| 10 | 15.3 | 1:lako/4.2+ubrz; 2:snaga; 3:tempo/5.4; 4:odmor; 5:odmor; 6:odmor; 7:lr/5.7 | 5.7/39.6 | D3 T: 1.2 km/6.8 min; kontinuirano | 3 | — |
| 11 | 16.5 | 1:lako/4.6+ubrz; 2:snaga; 3:int/5.8; 4:odmor; 5:odmor; 6:odmor; 7:lr/6.1 | 6.1/42.4 | D3 I: 1.2 km/6 min; pauza 90s | 3 | — |
| 12 | 12.3 | 1:lako/3.6+ubrz; 2:snaga; 3:int/4.2; 4:odmor; 5:odmor; 6:odmor; 7:lr/4.5 | 4.5/31.3 | D3 I: 0.6 km/3 min; pauza 90s | 3 | deload |
| 13 | 16 | 1:lako/5.1+ubrz; 2:snaga; 3:tempo/4.5; 4:odmor; 5:odmor; 6:odmor; 7:lr/6.4 | 6.4/44.5 | D3 T: 1.5 km/8.5 min; kontinuirano | 3 | — |
| 14 | 18.2 | 1:lako/5.1+ubrz; 2:snaga; 3:int/6.4; 4:odmor; 5:odmor; 6:odmor; 7:lr/6.7 | 6.7/46.6 | D3 RP: 2 km/12 min; pauza 240s | 3 | — |
| 15 | 10.9 | 1:lako/3.4; 2:snaga; 3:int/3.2; 4:odmor; 5:odmor; 6:odmor; 7:lr/4.3 | 4.3/29.9 | D3 RP: 1.2 km/7.2 min; pauza 162s | 3 | taper |
| 16 | 14.4 | 1:lako/2.2; 2:odmor; 3:lako/2.2; 4:odmor; 5:odmor; 6:odmor; 7:trka/10 | 2.2/14.9 | bez kvaliteta | — | trka |

### U07 A — dnevna i nedeljna provera

| N | km | D1–D7: tip/km | Najduža sesija pre trke: km/min | Kvalitet: zona, rad, oporavak | Dani kvaliteta sa LR završetkom | Rasterećenje |
|---:|---:|---|---|---|---|---|
| 1 | 32.2 | 1:lako/8+ubrz; 2:snaga; 3:int/7.2; 4:odmor; 5:lako/7; 6:odmor; 7:lr/10 | 10/61.7 | D3 T: 0.5 km/2.5 min; pauza 90s | 3 | — |
| 2 | 33.8 | 1:lako/8+ubrz; 2:snaga; 3:int/7.5; 4:odmor; 5:lako/7.5; 6:odmor; 7:lr/10.8 | 10.8/66.6 | D3 T: 0.4 km/2.3 min; pauza 90s | 3 | — |
| 3 | 35.9 | 1:lako/8.6+ubrz; 2:snaga; 3:int/7.7; 4:odmor; 5:tempo/8; 6:odmor; 7:lr/11.6 | 11.6/71.5 | D3 I: 1.6 km/7.3 min; pauza 163s · D5 T: 2 km/10 min; pauza 60s | 3,5 | — |
| 4 | 27.2 | 1:lako/7+ubrz; 2:snaga; 3:lako/6.1; 4:odmor; 5:lako/5.4; 6:odmor; 7:lr/8.7 | 8.7/53.6 | bez kvaliteta | — | deload |
| 5 | 38.6 | 1:lako/10+ubrz; 2:snaga; 3:int/7.9; 4:odmor; 5:tempo/8.2; 6:odmor; 7:lr/12.5 | 12.5/77.1 | D3 I: 1.6 km/7.3 min; pauza 163s · D5 T: 2 km/10 min; pauza 60s | 3,5 | — |
| 6 | 40.1 | 1:lako/10+ubrz; 2:snaga; 3:int/8.2; 4:odmor; 5:tempo/8.4; 6:odmor; 7:lr/13.5 | 13.5/83.3 | D3 I: 1.8 km/8 min; pauza 90s · D5 T: 3 km/15.1 min; kontinuirano | 3,5 | — |
| 7 | 42.6 | 1:lako/10.8+ubrz; 2:snaga; 3:int/8.1; 4:odmor; 5:tempo/9.2; 6:odmor; 7:lr/14.5 | 14.5/89.4 | D3 I: 1.6 km/7.3 min; pauza 163s · D5 T: 2.8 km/14 min; pauza 60s | 3,5 | — |
| 8 | 32.4 | 1:lako/8.2+ubrz; 2:snaga; 3:lako/7.1; 4:odmor; 5:lako/6.4; 6:odmor; 7:lr/10.7 | 10.7/66 | bez kvaliteta | — | deload |
| 9 | 45.7 | 1:lako/12.4+ubrz; 2:snaga; 3:int/8.3; 4:odmor; 5:tempo/9.4; 6:odmor; 7:lr/15.6 | 15.6/96.2 | D3 I: 1.6 km/7.3 min; pauza 163s · D5 T: 2.8 km/14 min; pauza 60s | 3,5 | — |
| 10 | 47.4 | 1:lako/12.5+ubrz; 2:snaga; 3:int/9.7; 4:odmor; 5:tempo/8.4; 6:odmor; 7:lr/16.8 | 16.8/103.6 | D3 RP: 3.4 km/17.6 min; pauza 326s · D5 T: 2.8 km/14 min; pauza 60s | 3,5 | — |
| 11 | 50.2 | 1:lako/13.4+ubrz; 2:snaga; 3:int/9.7; 4:odmor; 5:tempo/9; 6:odmor; 7:lr/18.1 | 18.1/111.6 | D3 RP: 3.4 km/17.6 min; pauza 326s · D5 T: 3.5 km/17.6 min; kontinuirano | 3,5 | — |
| 12 | 38.3 | 1:lako/10.2+ubrz; 2:snaga; 3:tempo/6; 4:odmor; 5:lako/8.8; 6:odmor; 7:lr/13.3 | 13.3/82 | D3 T: 2.1 km/10.5 min; kontinuirano | 3 | deload |
| 13 | 49.3 | 1:lako/10.3+ubrz; 2:snaga; 3:tempo/10.5; 4:odmor; 5:lako/9; 6:odmor; 7:lr/19.5 | 19.5/120.3 | D3 RP: 7 km/36.3 min; kontinuirano | 3 | — |
| 14 | 41.2 | 1:lako/11.5+ubrz; 2:snaga; 3:int/7.7; 4:odmor; 5:tempo/6.4; 6:odmor; 7:lr/15.6 | 15.6/96.2 | D3 RP: 3.4 km/17.6 min; pauza 326s · D5 T: 2.8 km/14 min; pauza 60s | 3,5 | taper |
| 15 | 34.6 | 1:lako/10.1; 2:snaga; 3:tempo/5.9; 4:odmor; 5:tempo/6; 6:odmor; 7:lr/12.6 | 12.6/77.7 | D3 RP: 3.1 km/16.1 min; kontinuirano · D5 T: 2.5 km/12.5 min; kontinuirano | 3,5 | taper |
| 16 | 31.6 | 1:lako/3; 2:odmor; 3:lako/3; 4:odmor; 5:int/4.5; 6:odmor; 7:trka/21.0975 | 4.5/n/p | D5 R: 1.2 km/6.1 min; pauza 154s | 5 | trka |

### U07 B — dnevna i nedeljna provera

| N | km | D1–D7: tip/km | Najduža sesija pre trke: km/min | Kvalitet: zona, rad, oporavak | Dani kvaliteta sa LR završetkom | Rasterećenje |
|---:|---:|---|---|---|---|---|
| 1 | 32.1 | 1:lako/8.1+ubrz; 2:snaga; 3:int/5.4; 4:odmor; 5:tempo/7; 6:odmor; 7:lr/11.6 | 11.6/71.5 | D3 R: 1.2 km/5.2 min; pauza 196s · D5 T: 3 km/15.1 min; pauza 60s | 3,5 | — |
| 2 | 33.8 | 1:lako/8.1+ubrz; 2:snaga; 3:int/5.8; 4:odmor; 5:tempo/7.5; 6:odmor; 7:lr/12.4 | 12.4/76.5 | D3 R: 1.2 km/5.2 min; pauza 196s · D5 T: 3.3 km/16.6 min; kontinuirano | 3,5 | — |
| 3 | 36.1 | 1:lako/8.7+ubrz; 2:snaga; 3:int/6.8; 4:odmor; 5:tempo/7.4; 6:odmor; 7:lr/13.2 | 13.2/81.4 | D3 I: 2.4 km/10.9 min; pauza 163s · D5 T: 3.2 km/16.1 min; pauza 60s | 3,5 | — |
| 4 | 27.5 | 1:lako/6.9+ubrz; 2:snaga; 3:int/4.7; 4:odmor; 5:lako/6; 6:odmor; 7:lr/9.9 | 9.9/61.1 | D3 R: 0.8 km/3.5 min; pauza 131s | 3 | deload |
| 5 | 35.9 | 1:lako/6.9+ubrz; 2:snaga; 3:int/7.2; 4:odmor; 5:tempo/7.8; 6:odmor; 7:lr/14 | 14/86.3 | D3 I: 2.4 km/10.9 min; pauza 163s · D5 T: 3.2 km/16.1 min; pauza 60s | 3,5 | — |
| 6 | 39.4 | 1:lako/8.1+ubrz; 2:snaga; 3:int/8.3; 4:odmor; 5:tempo/9; 6:odmor; 7:lr/14 | 14/86.3 | D3 I: 2.2 km/10 min; pauza 90s · D5 T: 3.9 km/19.6 min; kontinuirano | 3,5 | — |
| 7 | 42.8 | 1:lako/9.8+ubrz; 2:snaga; 3:int/9.2; 4:odmor; 5:tempo/9.8; 6:odmor; 7:lr/14 | 14/86.3 | D3 I: 2.4 km/10.9 min; pauza 163s · D5 T: 3.2 km/16.1 min; pauza 60s | 3,5 | — |
| 8 | 32.5 | 1:lako/8.2+ubrz; 2:snaga; 3:int/5.5; 4:odmor; 5:lako/7.1; 6:odmor; 7:lr/11.7 | 11.7/72.2 | D3 R: 0.8 km/3.5 min; pauza 131s | 3 | deload |
| 9 | 41.2 | 1:lako/8.2+ubrz; 2:snaga; 3:int/9.2; 4:odmor; 5:tempo/9.8; 6:odmor; 7:lr/14 | 14/86.3 | D3 I: 2.4 km/10.9 min; pauza 163s · D5 T: 3.2 km/16.1 min; pauza 60s | 3,5 | — |
| 10 | 44.8 | 1:lako/9.2+ubrz; 2:snaga; 3:int/11.3; 4:odmor; 5:tempo/9.8; 6:odmor; 7:lr/14.5 | 14.5/89.4 | D3 RP: 4 km/20.7 min; pauza 326s · D5 T: 3.2 km/16.1 min; pauza 60s | 3,5 | — |
| 11 | 46 | 1:lako/10.1+ubrz; 2:snaga; 3:int/11.3; 4:odmor; 5:lako/9.3; 6:odmor; 7:lr/15.3 | 15.3/90.6 | D3 RP: 4 km/20.7 min; pauza 326s · D7 LR-RP: 3.8 km/19.7 min | 3,7 | — |
| 12 | 35.2 | 1:lako/8.8+ubrz; 2:snaga; 3:int/6.1; 4:odmor; 5:lako/7.7; 6:odmor; 7:lr/12.6 | 12.6/77.7 | D3 R: 1 km/4.4 min; pauza 131s | 3 | deload |
| 13 | 46.2 | 1:lako/8.8+ubrz; 2:snaga; 3:tempo/13.5; 4:odmor; 5:lako/9.1; 6:odmor; 7:lr/14.8 | 14.8/91.3 | D3 RP: 7 km/36.3 min; kontinuirano | 3 | — |
| 14 | 37.9 | 1:lako/6.8+ubrz; 2:snaga; 3:int/10.3; 4:odmor; 5:tempo/8.8; 6:odmor; 7:lr/12 | 12/74 | D3 RP: 4 km/20.7 min; pauza 326s · D5 T: 3.2 km/16.1 min; pauza 60s | 3,5 | taper |
| 15 | 30.4 | 1:lako/7.9; 2:snaga; 3:tempo/6.3; 4:odmor; 5:tempo/6.3; 6:odmor; 7:lr/9.9 | 9.9/61.1 | D3 RP: 3.5 km/18.1 min; kontinuirano · D5 T: 2.8 km/14 min; kontinuirano | 3,5 | taper |
| 16 | 31.6 | 1:lako/3; 2:odmor; 3:lako/3; 4:odmor; 5:int/4.5; 6:odmor; 7:trka/21.0975 | 4.5/n/p | D5 R: 1.2 km/6.1 min; pauza 154s | 5 | trka |

### U08 A — dnevna i nedeljna provera

| N | km | D1–D7: tip/km | Najduža sesija pre trke: km/min | Kvalitet: zona, rad, oporavak | Dani kvaliteta sa LR završetkom | Rasterećenje |
|---:|---:|---|---|---|---|---|
| 1 | 57.4 | 1:lako/9.7+ubrz; 2:int/8.6; 3:lr/10.5(MLR); 4:snaga; 5:tempo/11.6; 6:odmor; 7:lr/17 | 17/91.8 | D2 R: 1.5 km/5.7 min; pauza 171s · D5 T: 4.8 km/21 min; pauza 60s | 2,5 | — |
| 2 | 60.6 | 1:lako/10.1+ubrz; 2:int/9.1; 3:lr/11(MLR); 4:snaga; 5:tempo/12.6; 6:odmor; 7:lr/17.8 | 17.8/96.1 | D2 R: 1.8 km/6.8 min; pauza 171s · D5 T: 6 km/26.3 min; kontinuirano | 2,5 | — |
| 3 | 63.5 | 1:lako/10.5+ubrz; 2:int/10.4; 3:lr/11.8(MLR); 4:snaga; 5:tempo/11.7; 6:odmor; 7:lr/19.1 | 19.1/103.1 | D2 I: 3.6 km/14.2 min; pauza 213s · D5 T: 5 km/21.9 min; pauza 75s | 2,5 | — |
| 4 | 48 | 1:lako/8.8+ubrz; 2:int/7.4; 3:lr/9.1(MLR); 4:snaga; 5:lako/8; 6:odmor; 7:lr/14.7 | 14.7/79.4 | D2 R: 1.2 km/4.6 min; pauza 114s | 2 | deload |
| 5 | 65.6 | 1:lako/10.3+ubrz; 2:int/10.4; 3:lr/12.7(MLR); 4:snaga; 5:tempo/11.7; 6:odmor; 7:lr/20.5 | 20.5/110.7 | D2 I: 3.6 km/14.2 min; pauza 213s · D5 T: 5 km/21.9 min; pauza 75s | 2,5 | — |
| 6 | 70 | 1:lako/10.5+ubrz; 2:int/12.8; 3:lr/12.8(MLR); 4:snaga; 5:tempo/13.2; 6:odmor; 7:lr/20.7 | 20.7/111.8 | D2 I: 4.1 km/16 min; pauza 90s · D5 T: 6.7 km/29.4 min; kontinuirano | 2,5 | — |
| 7 | 68.1 | 1:lako/10.4+ubrz; 2:int/10.4; 3:lr/13.6(MLR); 4:snaga; 5:tempo/11.7; 6:odmor; 7:lr/22 | 22/118.8 | D2 I: 3.6 km/14.2 min; pauza 213s · D5 T: 5 km/21.9 min; pauza 75s | 2,5 | — |
| 8 | 51.9 | 1:lako/9.7+ubrz; 2:int/7.3; 3:lr/10(MLR); 4:snaga; 5:lako/8.8; 6:odmor; 7:lr/16.1 | 16.1/86.9 | D2 R: 1.4 km/5.3 min; pauza 114s | 2 | deload |
| 9 | 68.8 | 1:lako/10.5+ubrz; 2:int/13.3; 3:lr/13.6(MLR); 4:snaga; 5:lako/9.4; 6:odmor; 7:lr/22 | 22/113.9 | D2 RP: 6 km/27 min; pauza 284s · D7 LR-RP: 5.5 km/24.8 min | 2,7 | — |
| 10 | 71.9 | 1:lako/10.4+ubrz; 2:tempo/16.5; 3:lr/13.6(MLR); 4:snaga; 5:lako/9.4; 6:odmor; 7:lr/22 | 22/118.8 | D2 RP: 10 km/45 min; kontinuirano | 2 | — |
| 11 | 68.7 | 1:lako/10.4+ubrz; 2:int/13.3; 3:lr/13.6(MLR); 4:snaga; 5:lako/9.4; 6:odmor; 7:lr/22 | 22/113.9 | D2 RP: 6 km/27 min; pauza 284s · D7 LR-RP: 5.5 km/24.8 min | 2,7 | — |
| 12 | 59 | 1:lako/8.5+ubrz; 2:int/13.3; 3:lr/8.3(MLR); 4:snaga; 5:tempo/11.7; 6:odmor; 7:lr/17.2 | 17.2/92.9 | D2 RP: 6 km/27 min; pauza 284s · D5 T: 5 km/21.9 min; pauza 75s | 2,5 | taper |
| 13 | 47.9 | 1:lako/10.4; 2:tempo/7.8; 3:lr/7.9(MLR); 4:snaga; 5:tempo/7.5; 6:odmor; 7:lr/14.3 | 14.3/77.2 | D2 RP: 5 km/22.5 min; kontinuirano · D5 T: 4 km/17.5 min; kontinuirano | 2,5 | taper |
| 14 | 31.6 | 1:odmor; 2:lako/3; 3:lako/3; 4:odmor; 5:int/4.5; 6:odmor; 7:trka/21.0975 | 4.5/n/p | D5 R: 1.2 km/5.3 min; pauza 133s | 5 | trka |

### U08 B — dnevna i nedeljna provera

| N | km | D1–D7: tip/km | Najduža sesija pre trke: km/min | Kvalitet: zona, rad, oporavak | Dani kvaliteta sa LR završetkom | Rasterećenje |
|---:|---:|---|---|---|---|---|
| 1 | 53.8 | 1:lako/11.1+ubrz; 2:tempo/8.7; 3:lr/9.9(MLR); 4:snaga; 5:tempo/8.1; 6:odmor; 7:lr/16 | 16/86.4 | D2 T: 2 km/8.8 min; pauza 60s · D5 T: 1.4 km/6.1 min; pauza 60s | 2,5 | — |
| 2 | 56.8 | 1:lako/12+ubrz; 2:tempo/8.7; 3:lr/10.7(MLR); 4:snaga; 5:tempo/8.2; 6:odmor; 7:lr/17.2 | 17.2/92.9 | D2 T: 2 km/8.8 min; pauza 60s · D5 T: 1.7 km/7.5 min; kontinuirano | 2,5 | — |
| 3 | 61.2 | 1:lako/12.2+ubrz; 2:int/9.1; 3:lr/11.5(MLR); 4:snaga; 5:tempo/9.9; 6:odmor; 7:lr/18.5 | 18.5/99.9 | D2 I: 2.4 km/9.5 min; pauza 213s · D5 T: 3.2 km/14 min; pauza 60s | 2,5 | — |
| 4 | 46.6 | 1:lako/8.9+ubrz; 2:lako/8; 3:lr/8.5(MLR); 4:snaga; 5:lako/7.6; 6:odmor; 7:lr/13.6 | 13.6/73.4 | bez kvaliteta | — | deload |
| 5 | 63.3 | 1:lako/12.1+ubrz; 2:int/9.1; 3:lr/12.3(MLR); 4:snaga; 5:tempo/9.9; 6:odmor; 7:lr/19.9 | 19.9/107.5 | D2 I: 2.4 km/9.5 min; pauza 213s · D5 T: 3.2 km/14 min; pauza 60s | 2,5 | — |
| 6 | 68.9 | 1:lako/12+ubrz; 2:int/11.2; 3:lr/13.2(MLR); 4:snaga; 5:tempo/11.2; 6:odmor; 7:lr/21.3 | 21.3/115 | D2 I: 3 km/12 min; pauza 90s · D5 T: 4.7 km/20.6 min; kontinuirano | 2,5 | — |
| 7 | 67.9 | 1:lako/12.1+ubrz; 2:int/9.1; 3:lr/13.6(MLR); 4:snaga; 5:tempo/11.1; 6:odmor; 7:lr/22 | 22/118.8 | D2 I: 2.4 km/9.5 min; pauza 213s · D5 T: 4.4 km/19.3 min; pauza 75s | 2,5 | — |
| 8 | 51.6 | 1:lako/9.8+ubrz; 2:lako/8.8; 3:lr/9.4(MLR); 4:snaga; 5:lako/8.3; 6:odmor; 7:lr/15.3 | 15.3/82.6 | bez kvaliteta | — | deload |
| 9 | 71.1 | 1:lako/12.2+ubrz; 2:int/12.3; 3:lr/13.6(MLR); 4:snaga; 5:lako/11; 6:odmor; 7:lr/22 | 22/113.9 | D2 RP: 5 km/22.5 min; pauza 284s · D7 LR-RP: 5.5 km/24.8 min | 2,7 | — |
| 10 | 75.3 | 1:lako/12.2+ubrz; 2:tempo/16.5; 3:lr/13.6(MLR); 4:snaga; 5:lako/11; 6:odmor; 7:lr/22 | 22/118.8 | D2 RP: 10 km/45 min; kontinuirano | 2 | — |
| 11 | 71.1 | 1:lako/12.2+ubrz; 2:int/12.3; 3:lr/13.6(MLR); 4:snaga; 5:lako/11; 6:odmor; 7:lr/22 | 22/113.9 | D2 RP: 5 km/22.5 min; pauza 284s · D7 LR-RP: 5.5 km/24.8 min | 2,7 | — |
| 12 | 61.7 | 1:lako/10.3+ubrz; 2:int/12.2; 3:lr/9.8(MLR); 4:snaga; 5:tempo/11.1; 6:odmor; 7:lr/18.3 | 18.3/98.8 | D2 RP: 5 km/22.5 min; pauza 284s · D5 T: 4.4 km/19.3 min; pauza 75s | 2,5 | taper |
| 13 | 46.1 | 1:lako/10; 2:tempo/7.1; 3:lr/7.9(MLR); 4:snaga; 5:tempo/6.8; 6:odmor; 7:lr/14.3 | 14.3/77.2 | D2 RP: 4.3 km/19.4 min; kontinuirano · D5 T: 3.3 km/14.5 min; kontinuirano | 2,5 | taper |
| 14 | 31.6 | 1:odmor; 2:lako/3; 3:lako/3; 4:odmor; 5:int/4.5; 6:odmor; 7:trka/21.0975 | 4.5/n/p | D5 R: 1.2 km/5.3 min; pauza 133s | 5 | trka |

### U09 A — dnevna i nedeljna provera

| N | km | D1–D7: tip/km | Najduža sesija pre trke: km/min | Kvalitet: zona, rad, oporavak | Dani kvaliteta sa LR završetkom | Rasterećenje |
|---:|---:|---|---|---|---|---|
| 1 | 32.4 | 1:lako/8+ubrz; 2:snaga; 3:int/7.5; 4:odmor; 5:lako/6.9; 6:odmor; 7:lr/10 | 10/59.5 | D3 T: 0.4 km/2 min; pauza 90s | 3 | — |
| 2 | 33.9 | 1:lako/8+ubrz; 2:snaga; 3:int/7.5; 4:odmor; 5:lako/7.6; 6:odmor; 7:lr/10.8 | 10.8/64.3 | D3 T: 0.5 km/2.3 min; pauza 90s | 3 | — |
| 3 | 32.5 | 1:lako/7.8+ubrz; 2:snaga; 3:tempo/8.2; 4:odmor; 5:lako/6.8; 6:odmor; 7:lr/9.7 | 9.7/57.7 | D3 T: 2 km/9.7 min; pauza 60s | 3 | — |
| 4 | 25.4 | 1:lako/6.5+ubrz; 2:snaga; 3:lako/5.7; 4:odmor; 5:lako/5.1; 6:odmor; 7:lr/8.1 | 8.1/48.2 | bez kvaliteta | — | deload |
| 5 | 36.3 | 1:lako/8.8+ubrz; 2:snaga; 3:tempo/8.4; 4:odmor; 5:lako/7.7; 6:odmor; 7:lr/11.4 | 11.4/67.8 | D3 T: 2 km/9.7 min; pauza 60s | 3 | — |
| 6 | 34 | 1:lako/8.2+ubrz; 2:snaga; 3:int/8.5; 4:odmor; 5:lako/7.1; 6:odmor; 7:lr/10.2 | 10.2/60.7 | D3 RP: 2.2 km/12.5 min; pauza 90s | 3 | — |
| 7 | 37.6 | 1:lako/8.2+ubrz; 2:snaga; 3:tempo/8.5; 4:odmor; 5:lako/8.6; 6:odmor; 7:lr/12.3 | 12.3/73.2 | D3 T: 2 km/9.7 min; pauza 60s | 3 | — |
| 8 | 28.8 | 1:lako/7.4+ubrz; 2:snaga; 3:lako/6.4; 4:odmor; 5:lako/5.8; 6:odmor; 7:lr/9.2 | 9.2/54.7 | bez kvaliteta | — | deload |
| 9 | 36.9 | 1:lako/8.8+ubrz; 2:snaga; 3:tempo/9.4; 4:odmor; 5:lako/7.7; 6:odmor; 7:lr/11 | 11/65.5 | D3 T: 2.8 km/13.5 min; pauza 60s | 3 | — |
| 10 | 40.7 | 1:lako/8.8+ubrz; 2:snaga; 3:tempo/9.5; 4:odmor; 5:lako/9.2; 6:odmor; 7:lr/13.2 | 13.2/78.5 | D3 T: 2.8 km/13.5 min; pauza 60s | 3 | — |
| 11 | 44.2 | 1:lako/10.6+ubrz; 2:snaga; 3:tempo/9.5; 4:odmor; 5:lako/9.9; 6:odmor; 7:lr/14.2 | 14.2/84.5 | D3 T: 2.8 km/13.5 min; pauza 60s | 3 | — |
| 12 | 33.2 | 1:lako/8.5+ubrz; 2:snaga; 3:lako/7.4; 4:odmor; 5:lako/6.7; 6:odmor; 7:lr/10.6 | 10.6/63.1 | bez kvaliteta | — | deload |
| 13 | 47.7 | 1:lako/12.2+ubrz; 2:snaga; 3:tempo/9.5; 4:odmor; 5:lako/10.7; 6:odmor; 7:lr/15.3 | 15.3/91 | D3 T: 2.8 km/13.5 min; pauza 60s | 3 | — |
| 14 | 47.3 | 1:lako/12.2+ubrz; 2:snaga; 3:int/9.1; 4:odmor; 5:tempo/9.5; 6:odmor; 7:lr/16.5 | 16.5/98.2 | D3 RP: 2.4 km/13.6 min; pauza 90s · D5 T: 2.8 km/13.5 min; pauza 60s | 3,5 | — |
| 15 | 45.1 | 1:lako/11.8+ubrz; 2:snaga; 3:int/8.3; 4:odmor; 5:tempo/10.2; 6:odmor; 7:lr/14.8 | 14.8/88.1 | D3 I: 1.6 km/7 min; pauza 157s · D5 T: 3.7 km/17.9 min; kontinuirano | 3,5 | — |
| 16 | 35.5 | 1:lako/8.5+ubrz; 2:snaga; 3:tempo/8.8; 4:odmor; 5:lako/7.5; 6:odmor; 7:lr/10.7 | 10.7/63.7 | D3 T: 2.2 km/10.6 min; kontinuirano | 3 | deload |
| 17 | 49.1 | 1:lako/13.8+ubrz; 2:snaga; 3:tempo/8.2; 4:odmor; 5:tempo/9.4; 6:odmor; 7:lr/17.7 | 17.7/105.3 | D3 RP: 2.5 km/14.2 min; kontinuirano · D5 T: 3.7 km/17.9 min; kontinuirano | 3,5 | — |
| 18 | 39.3 | 1:lako/10.5+ubrz; 2:snaga; 3:int/7.3; 4:odmor; 5:tempo/7.7; 6:odmor; 7:lr/13.8 | 13.8/82.1 | D3 RP: 2.4 km/13.6 min; pauza 90s · D5 T: 2.8 km/13.5 min; pauza 60s | 3,5 | taper |
| 19 | 31.9 | 1:lako/8.2; 2:snaga; 3:tempo/5.1; 4:odmor; 5:lako/7.2; 6:odmor; 7:lr/11.4 | 11.4/67.8 | D3 RP: 2.5 km/14.2 min; kontinuirano | 3 | taper |
| 20 | 52.7 | 1:lako/3; 2:odmor; 3:lako/3; 4:odmor; 5:int/4.5; 6:odmor; 7:trka/42.195 | 4.5/n/p | D5 R: 1.2 km/6.7 min; pauza 169s | 5 | trka |

### U09 B — dnevna i nedeljna provera

| N | km | D1–D7: tip/km | Najduža sesija pre trke: km/min | Kvalitet: zona, rad, oporavak | Dani kvaliteta sa LR završetkom | Rasterećenje |
|---:|---:|---|---|---|---|---|
| 1 | 31.5 | 1:lako/7.6+ubrz; 2:snaga; 3:tempo/6.4; 4:odmor; 5:lako/6.6; 6:odmor; 7:lr/10.9 | 10.9/64.9 | D3 T: 3 km/14.5 min; pauza 60s | 3 | — |
| 2 | 34.2 | 1:lako/7.6+ubrz; 2:snaga; 3:int/7.7; 4:odmor; 5:lako/7.2; 6:odmor; 7:lr/11.7 | 11.7/69.6 | D3 R: 1 km/4.2 min; pauza 126s | 3 | — |
| 3 | 36.7 | 1:lako/8.2+ubrz; 2:snaga; 3:tempo/8.5; 4:odmor; 5:lako/7.5; 6:odmor; 7:lr/12.5 | 12.5/74.4 | D3 T: 3.2 km/15.5 min; pauza 60s | 3 | — |
| 4 | 25.8 | 1:lako/6+ubrz; 2:snaga; 3:int/6.1; 4:odmor; 5:lako/5.2; 6:odmor; 7:lr/8.5 | 8.5/50.6 | D3 R: 0.8 km/3.4 min; pauza 126s | 3 | deload |
| 5 | 34.6 | 1:lako/5.9+ubrz; 2:snaga; 3:int/8.1; 4:odmor; 5:lako/7.8; 6:odmor; 7:lr/12.8 | 12.8/76.2 | D3 R: 1 km/4.2 min; pauza 126s | 3 | — |
| 6 | 38.4 | 1:lako/7.9+ubrz; 2:snaga; 3:tempo/9.9; 4:odmor; 5:lako/7.8; 6:odmor; 7:lr/12.8 | 12.8/76.2 | D3 T: 3.2 km/15.5 min; pauza 60s | 3 | — |
| 7 | 39.5 | 1:lako/9+ubrz; 2:snaga; 3:tempo/9.9; 4:odmor; 5:lako/7.8; 6:odmor; 7:lr/12.8 | 12.8/76.2 | D3 T: 3.2 km/15.5 min; pauza 60s | 3 | — |
| 8 | 29.8 | 1:lako/7.1+ubrz; 2:snaga; 3:int/6.3; 4:odmor; 5:lako/6.2; 6:odmor; 7:lr/10.2 | 10.2/60.7 | D3 R: 0.8 km/3.4 min; pauza 126s | 3 | deload |
| 9 | 37.6 | 1:lako/7.1+ubrz; 2:snaga; 3:tempo/9.9; 4:odmor; 5:lako/7.8; 6:odmor; 7:lr/12.8 | 12.8/76.2 | D3 T: 3.2 km/15.5 min; pauza 60s | 3 | — |
| 10 | 39.5 | 1:lako/9+ubrz; 2:snaga; 3:tempo/9.9; 4:odmor; 5:lako/7.8; 6:odmor; 7:lr/12.8 | 12.8/76.2 | D3 T: 3.2 km/15.5 min; pauza 60s | 3 | — |
| 11 | 39.5 | 1:lako/9+ubrz; 2:snaga; 3:tempo/9.9; 4:odmor; 5:lako/7.8; 6:odmor; 7:lr/12.8 | 12.8/76.2 | D3 T: 3.2 km/15.5 min; pauza 60s | 3 | — |
| 12 | 31 | 1:lako/7.4+ubrz; 2:snaga; 3:int/6.3; 4:odmor; 5:lako/6.6; 6:odmor; 7:lr/10.7 | 10.7/63.7 | D3 R: 0.8 km/3.4 min; pauza 126s | 3 | deload |
| 13 | 39.3 | 1:lako/7.5+ubrz; 2:snaga; 3:tempo/9.9; 4:odmor; 5:lako/8.3; 6:odmor; 7:lr/13.6 | 13.6/80.9 | D3 T: 3.2 km/15.5 min; pauza 60s | 3 | — |
| 14 | 43.3 | 1:lako/3+ubrz; 2:snaga; 3:int/12.7; 4:odmor; 5:tempo/11.6; 6:odmor; 7:lr/16 | 16/95.2 | D3 RP: 6 km/34.1 min; pauza 90s · D5 T: 3.2 km/15.5 min; pauza 60s | 3,5 | — |
| 15 | 38.3 | 1:lako/8.5+ubrz; 2:snaga; 3:tempo/10.2; 4:odmor; 5:lako/7.4; 6:odmor; 7:lr/12.2 | 12.2/72.6 | D3 RP: 3.7 km/21 min; kontinuirano | 3 | — |
| 16 | 30 | 1:lako/7.2+ubrz; 2:snaga; 3:int/6.1; 4:odmor; 5:lako/6.3; 6:odmor; 7:lr/10.4 | 10.4/61.9 | D3 R: 0.8 km/3.4 min; pauza 126s | 3 | deload |
| 17 | 42.1 | 1:lako/3.9+ubrz; 2:snaga; 3:tempo/11.1; 4:odmor; 5:tempo/11.1; 6:odmor; 7:lr/16 | 16/95.2 | D3 RP: 4.8 km/27.3 min; kontinuirano · D5 T: 4.2 km/20.3 min; kontinuirano | 3,5 | — |
| 18 | 34.6 | 1:lako/6.3+ubrz; 2:snaga; 3:int/9.7; 4:odmor; 5:tempo/6.9; 6:odmor; 7:lr/11.7 | 11.7/69.6 | D3 RP: 6 km/34.1 min; pauza 90s · D5 T: 3.2 km/15.5 min; pauza 60s | 3,5 | taper |
| 19 | 28.1 | 1:lako/6.5; 2:snaga; 3:tempo/6; 4:odmor; 5:lako/6; 6:odmor; 7:lr/9.6 | 9.6/57.1 | D3 RP: 3.4 km/19.3 min; kontinuirano | 3 | taper |
| 20 | 52.7 | 1:lako/3; 2:odmor; 3:lako/3; 4:odmor; 5:int/4.5; 6:odmor; 7:trka/42.195 | 4.5/n/p | D5 R: 1.2 km/6.7 min; pauza 169s | 5 | trka |

### U10 A — dnevna i nedeljna provera

| N | km | D1–D7: tip/km | Najduža sesija pre trke: km/min | Kvalitet: zona, rad, oporavak | Dani kvaliteta sa LR završetkom | Rasterećenje |
|---:|---:|---|---|---|---|---|
| 1 | 53.2 | 1:lako/9.2+ubrz; 2:int/8.1; 3:lr/9.1(MLR); 4:snaga; 5:tempo/11.6; 6:odmor; 7:lr/15.2 | 15.2/93.2 | D2 R: 1 km/4.3 min; pauza 130s · D5 T: 4.8 km/24 min; pauza 60s | 2,5 | — |
| 2 | 57.9 | 1:lako/9.7+ubrz; 2:tempo/11; 3:lr/9.6(MLR); 4:snaga; 5:tempo/11.6; 6:odmor; 7:lr/16 | 16/98.1 | D2 RP: 3.7 km/19.6 min; kontinuirano · D5 T: 4.8 km/24 min; pauza 60s | 2,5 | — |
| 3 | 57 | 1:lako/10.3+ubrz; 2:int/8.1; 3:lr/10.1(MLR); 4:snaga; 5:tempo/11.6; 6:odmor; 7:lr/16.9 | 16.9/103.7 | D2 R: 1 km/4.3 min; pauza 130s · D5 T: 4.8 km/24 min; pauza 60s | 2,5 | — |
| 4 | 38.9 | 1:lako/7.1+ubrz; 2:int/7; 3:lr/6.9(MLR); 4:snaga; 5:lako/6.4; 6:odmor; 7:lr/11.5 | 11.5/70.5 | D2 R: 1 km/4.3 min; pauza 130s | 2 | deload |
| 5 | 56.8 | 1:lako/8+ubrz; 2:int/8.5; 3:lr/10.7(MLR); 4:snaga; 5:tempo/11.7; 6:odmor; 7:lr/17.9 | 17.9/109.8 | D2 R: 1.2 km/5.2 min; pauza 130s · D5 T: 5 km/25 min; pauza 75s | 2,5 | — |
| 6 | 61.8 | 1:lako/10.4+ubrz; 2:tempo/12.3; 3:lr/8.6(MLR); 4:snaga; 5:tempo/11.7; 6:odmor; 7:lr/18.8 | 18.8/115.3 | D2 RP: 4.1 km/21.9 min; kontinuirano · D5 T: 5 km/25 min; pauza 75s | 2,5 | — |
| 7 | 67.2 | 1:lako/10.4+ubrz; 2:tempo/12.8; 3:lr/11.3(MLR); 4:snaga; 5:tempo/12.8; 6:odmor; 7:lr/19.9 | 19.9/122.1 | D2 RP: 6.3 km/33.6 min; kontinuirano · D5 T: 6.3 km/31.5 min; kontinuirano | 2,5 | — |
| 8 | 44.8 | 1:lako/8.2+ubrz; 2:int/7.4; 3:lr/8.2(MLR); 4:snaga; 5:lako/7.4; 6:odmor; 7:lr/13.6 | 13.6/83.4 | D2 R: 1.2 km/5.2 min; pauza 130s | 2 | deload |
| 9 | 66.5 | 1:lako/9.5+ubrz; 2:int/10.4; 3:lr/12.6(MLR); 4:snaga; 5:tempo/13; 6:odmor; 7:lr/21 | 21/128.8 | D2 I: 3.3 km/14.9 min; pauza 223s · D5 T: 6.5 km/32.5 min; kontinuirano | 2,5 | — |
| 10 | 70.2 | 1:lako/10.4+ubrz; 2:int/12.7; 3:lr/13.3(MLR); 4:snaga; 5:tempo/11.7; 6:odmor; 7:lr/22.1 | 22.1/135.5 | D2 RP: 6 km/32 min; pauza 90s · D5 T: 5 km/25 min; pauza 75s | 2,5 | — |
| 11 | 75 | 1:lako/10.4+ubrz; 2:tempo/13.5; 3:lr/14.1(MLR); 4:snaga; 5:tempo/13.5; 6:odmor; 7:lr/23.5 | 23.5/144.1 | D2 RP: 7 km/37.3 min; kontinuirano · D5 T: 7 km/35 min; kontinuirano | 2,5 | — |
| 12 | 50.4 | 1:lako/9.5+ubrz; 2:int/7.4; 3:lr/9.4(MLR); 4:snaga; 5:lako/8.5; 6:odmor; 7:lr/15.6 | 15.6/95.7 | D2 R: 1.2 km/5.2 min; pauza 130s | 2 | deload |
| 13 | 73.7 | 1:lako/10.4+ubrz; 2:tempo/13.4; 3:lr/13.7(MLR); 4:snaga; 5:tempo/13.4; 6:odmor; 7:lr/22.8 | 22.8/139.8 | D2 RP: 6.9 km/36.8 min; kontinuirano · D5 T: 6.9 km/34.5 min; kontinuirano | 2,5 | — |
| 14 | 80.2 | 1:lako/11.1+ubrz; 2:int/14.7; 3:lr/11.8(MLR); 4:snaga; 5:tempo/14.4; 6:odmor; 7:lr/28.2 | 28.2/173 | D2 RP: 8 km/42.7 min; pauza 90s · D5 T: 7.5 km/37.5 min; pauza 75s | 2,5 | — |
| 15 | 65.4 | 1:lako/10.4+ubrz; 2:int/10.4; 3:lr/13.2(MLR); 4:snaga; 5:lako/9.4; 6:odmor; 7:lr/22 | 22/128.8 | D2 I: 3.3 km/14.9 min; pauza 223s · D7 LR-M: 7.7 km/41.1 min | 2,7 | — |
| 16 | 50.4 | 1:lako/9.5+ubrz; 2:int/7.4; 3:lr/9.4(MLR); 4:snaga; 5:lako/8.5; 6:odmor; 7:lr/15.6 | 15.6/95.7 | D2 R: 1.2 km/5.2 min; pauza 130s | 2 | deload |
| 17 | 71.2 | 1:lako/7.6+ubrz; 2:tempo/14.4; 3:lr/8.9(MLR); 4:snaga; 5:tempo/13.5; 6:odmor; 7:lr/26.8 | 26.8/164.4 | D2 RP: 7.9 km/42.1 min; kontinuirano · D5 T: 7 km/35 min; kontinuirano | 2,5 | — |
| 18 | 64.2 | 1:lako/8.7+ubrz; 2:int/12.7; 3:lr/10.4(MLR); 4:snaga; 5:tempo/11.7; 6:odmor; 7:lr/20.7 | 20.7/127 | D2 RP: 6 km/32 min; pauza 90s · D5 T: 5 km/25 min; pauza 75s | 2,5 | taper |
| 19 | 52.1 | 1:lako/9.3; 2:tempo/8.8; 3:lr/9.1(MLR); 4:snaga; 5:tempo/7.8; 6:odmor; 7:lr/17.1 | 17.1/104.9 | D2 RP: 6 km/32 min; kontinuirano · D5 T: 4.3 km/21.5 min; kontinuirano | 2,5 | taper |
| 20 | 52.7 | 1:odmor; 2:lako/3; 3:lako/3; 4:odmor; 5:int/4.5; 6:odmor; 7:trka/42.195 | 4.5/n/p | D5 R: 1.2 km/6.3 min; pauza 158s | 5 | trka |

### U10 B — dnevna i nedeljna provera

| N | km | D1–D7: tip/km | Najduža sesija pre trke: km/min | Kvalitet: zona, rad, oporavak | Dani kvaliteta sa LR završetkom | Rasterećenje |
|---:|---:|---|---|---|---|---|
| 1 | 63 | 1:lako/12.3+ubrz; 2:tempo/6; 3:lr/14.4(MLR); 4:snaga; 5:tempo/6.3; 6:odmor; 7:lr/24 | 24/147.2 | D2 RP: 2 km/10.7 min; kontinuirano · D5 T: 2.6 km/13 min; pauza 75s | 2,5 | — |
| 2 | 66.4 | 1:lako/12.2+ubrz; 2:tempo/6.7; 3:lr/15.3(MLR); 4:snaga; 5:tempo/6.7; 6:odmor; 7:lr/25.5 | 25.5/156.4 | D2 RP: 2.2 km/11.9 min; kontinuirano · D5 T: 3 km/15 min; pauza 75s | 2,5 | — |
| 3 | 66.1 | 1:lako/12.2+ubrz; 2:tempo/7.4; 3:lr/13.7(MLR); 4:snaga; 5:tempo/9.9; 6:odmor; 7:lr/22.9 | 22.9/140.5 | D2 RP: 2.5 km/13.2 min; kontinuirano · D5 T: 3.2 km/16 min; pauza 75s | 2,5 | — |
| 4 | 51.6 | 1:lako/8.5+ubrz; 2:lako/7.7; 3:lr/10.6(MLR); 4:snaga; 5:lako/7.2; 6:odmor; 7:lr/17.6 | 17.6/107.9 | bez kvaliteta | — | deload |
| 5 | 71.9 | 1:lako/11.6+ubrz; 2:tempo/8.7; 3:lr/15.4(MLR); 4:snaga; 5:tempo/10.2; 6:odmor; 7:lr/26 | 26/159.5 | D2 RP: 2.9 km/15.5 min; kontinuirano · D5 T: 3.8 km/19 min; pauza 75s | 2,5 | — |
| 6 | 69.9 | 1:lako/12.2+ubrz; 2:tempo/9.4; 3:lr/14(MLR); 4:snaga; 5:tempo/10.9; 6:odmor; 7:lr/23.4 | 23.4/143.5 | D2 RP: 3.1 km/16.7 min; kontinuirano · D5 T: 4.2 km/21 min; pauza 75s | 2,5 | — |
| 7 | 76 | 1:lako/11.9+ubrz; 2:tempo/9.8; 3:lr/16.2(MLR); 4:snaga; 5:tempo/11; 6:odmor; 7:lr/27.1 | 27.1/166.2 | D2 RP: 3.3 km/17.6 min; kontinuirano · D5 T: 4.5 km/22.5 min; kontinuirano | 2,5 | — |
| 8 | 59.4 | 1:lako/10.3+ubrz; 2:tempo/9.7; 3:lr/11.3(MLR); 4:snaga; 5:lako/9.3; 6:odmor; 7:lr/18.8 | 18.8/115.3 | D2 T: 2.7 km/13.5 min; kontinuirano | 2 | deload |
| 9 | 71.2 | 1:lako/12.2+ubrz; 2:int/9.1; 3:lr/14.6(MLR); 4:snaga; 5:tempo/11; 6:odmor; 7:lr/24.3 | 24.3/149 | D2 I: 2.2 km/9.9 min; pauza 223s · D5 T: 4.5 km/22.5 min; kontinuirano | 2,5 | — |
| 10 | 77.5 | 1:lako/11.8+ubrz; 2:int/9.9; 3:lr/16.7(MLR); 4:snaga; 5:tempo/11.1; 6:odmor; 7:lr/28 | 28/171.7 | D2 RP: 3.2 km/17.1 min; pauza 90s · D5 T: 4.4 km/22 min; pauza 75s | 2,5 | — |
| 11 | 79.8 | 1:lako/12.1+ubrz; 2:tempo/9.8; 3:lr/17.6(MLR); 4:snaga; 5:tempo/11; 6:odmor; 7:lr/29.3 | 29.3/179.7 | D2 RP: 3.3 km/17.6 min; kontinuirano · D5 T: 4.5 km/22.5 min; kontinuirano | 2,5 | — |
| 12 | 62.4 | 1:lako/11+ubrz; 2:tempo/9.6; 3:lr/11.9(MLR); 4:snaga; 5:lako/10; 6:odmor; 7:lr/19.9 | 19.9/122.1 | D2 T: 2.7 km/13.5 min; kontinuirano | 2 | deload |
| 13 | 79.8 | 1:lako/12.1+ubrz; 2:tempo/9.8; 3:lr/17.6(MLR); 4:snaga; 5:tempo/11; 6:odmor; 7:lr/29.3 | 29.3/179.7 | D2 RP: 3.3 km/17.6 min; kontinuirano · D5 T: 4.5 km/22.5 min; kontinuirano | 2,5 | — |
| 14 | 80.1 | 1:lako/12.2+ubrz; 2:int/9.9; 3:lr/17.6(MLR); 4:snaga; 5:tempo/11.1; 6:odmor; 7:lr/29.3 | 29.3/179.7 | D2 RP: 3.2 km/17.1 min; pauza 90s · D5 T: 4.4 km/22 min; pauza 75s | 2,5 | — |
| 15 | 74.3 | 1:lako/12.2+ubrz; 2:int/9.1; 3:lr/15.8(MLR); 4:snaga; 5:lako/10.9; 6:odmor; 7:lr/26.3 | 26.3/153.9 | D2 I: 2.2 km/9.9 min; pauza 223s · D7 LR-M: 9.2 km/49.1 min | 2,7 | — |
| 16 | 57.9 | 1:lako/10.3+ubrz; 2:lako/9.2; 3:lr/11.1(MLR); 4:snaga; 5:lako/8.8; 6:odmor; 7:lr/18.5 | 18.5/113.5 | bez kvaliteta | — | deload |
| 17 | 79.8 | 1:lako/12.1+ubrz; 2:tempo/9.8; 3:lr/17.6(MLR); 4:snaga; 5:tempo/11; 6:odmor; 7:lr/29.3 | 29.3/179.7 | D2 RP: 3.3 km/17.6 min; kontinuirano · D5 T: 4.5 km/22.5 min; kontinuirano | 2,5 | — |
| 18 | 64.1 | 1:lako/10.1+ubrz; 2:int/9.9; 3:lr/11.2(MLR); 4:snaga; 5:tempo/11.1; 6:odmor; 7:lr/21.8 | 21.8/133.7 | D2 RP: 3.2 km/17.1 min; pauza 90s · D5 T: 4.4 km/22 min; pauza 75s | 2,5 | taper |
| 19 | 52 | 1:lako/10.6; 2:tempo/6.1; 3:lr/9.8(MLR); 4:snaga; 5:tempo/7.3; 6:odmor; 7:lr/18.2 | 18.2/111.6 | D2 RP: 3.3 km/17.6 min; kontinuirano · D5 T: 3.8 km/19 min; kontinuirano | 2,5 | taper |
| 20 | 52.7 | 1:odmor; 2:lako/3; 3:lako/3; 4:odmor; 5:int/4.5; 6:odmor; 7:trka/42.195 | 4.5/n/p | D5 R: 1.2 km/6.3 min; pauza 158s | 5 | trka |

Provereno 324 nedelja i 2268 dnevnih zapisa. Svi zbirni km odgovaraju zbiru prikazanih dana (tolerancija 0.15 km za zaokruživanje).

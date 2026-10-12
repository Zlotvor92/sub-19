# Nezavisna AI trenerska procena — maraton

Datum pristupa izvorima i pregleda: 2026-10-11. Autor je AI recenzent sa dodeljenom maratonskom perspektivom; ovo nije potpis stvarnog trenera niti procena stvarnih sportista. Svi profili su sintetički QA scenariji.

## Opseg i slepo ocenjivanje

Pročitano je samo deset dozvoljenih blind/U01–U10.json ulaza i javni primarni izvori. Pregledano je svih 20 planova i svih 324 nedelje, uključujući raspored dana, opis dužine, kvalitet, pauze, zagrevanje/hlađenje, rasterećenje, taper i prikaz trke. Nije čitan kod generatora, manifest, raw podaci, source/probe datoteke, prethodne faze ili fajlovi drugih recenzenata. Identitet A/B nije dostavljen. Razlike u obliku prezentacije mogu nagovestiti implementaciju; zato ovo nije tvrdnja o savršenoj slepoći.

Operativna transparentnost: svih 20 ocena izračunato je i upisano u marathon-scores.json u 2026-10-11 20:23:11.230607295 UTC. Sledeći poziv alata bio je list_agents, posle završenog računanja i upisa; nenamerno je prikazao kratke završne sažetke drugih agenata. Nijedan kriterijum ili ukupna ocena nije promenjen posle tog poziva. Njihovi fajlovi nisu otvarani, identitet A/B nije izveden iz tih sažetaka, a ocene nisu menjane zbog njih. Ovaj zapis prethodi zasebnom pregledu događaja i otkrivanju identiteta.

## Kako se čita ocena

Svaki kriterijum je 0–10. Ukupno = fit×2 + quality×2 + progression×1.5 + recovery×1.5 + specificity + deloadTaper + coherence. Težine su redom 20/20/15/15/10/10/10, ukupno 100. Fit uključuje adekvatnost za distancu i realnu ulaznu bazu. Recovery ocenjuje raspodelu i verovatnu ponovljivost opterećenja. Coherence uključuje čitljivost i poštenje o granicama procene. Broj 55 km/ned ili 32 km LR nije univerzalna granica spremnosti, a mali ili veći procentualni skok sam po sebi nije dokaz povrede.

Bezbednost, adekvatnost i iskrenost su odvojene dimenzije: ograničen plan može biti oprezan i iskreno označen, a da ipak ne predstavlja punu maratonsku pripremu. Dobar PB na kraćoj distanci ne potvrđuje dugotrajnu izdržljivost. Izračunati rast forme bez novog rezultata nije potvrđena forma. Confidence izražava pouzdanost zaključka iz ovih statičnih planova, ne verovatnoću završetka trke.

## Svih 20 ocena

| ID | Strana | Distanca | Fit | Kvalitet | Progresija | Oporavak | Specifičnost | Deload/taper | Koherentnost | Ukupno | Nedelje |
|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| U01 | A | 5K | 8 | 8 | 8.5 | 9 | 6.5 | 8.5 | 9 | 82.25 | 12 |
| U01 | B | 5K | 7 | 7 | 6 | 8 | 7 | 7.5 | 5 | 68.5 | 12 |
| U02 | A | 5K | 7.5 | 7.5 | 7.5 | 8 | 7.5 | 8 | 5 | 73.75 | 16 |
| U02 | B | 5K | 8 | 8 | 8 | 8.5 | 7 | 8.5 | 9 | 81.25 | 16 |
| U03 | A | 5K | 8.5 | 7.5 | 7 | 8.5 | 6.5 | 8.5 | 9 | 79.25 | 16 |
| U03 | B | 5K | 8 | 8.5 | 6.5 | 8 | 8 | 8.5 | 5.5 | 76.75 | 16 |
| U04 | A | 10K | 6.5 | 6 | 7 | 7.5 | 7.5 | 8 | 5 | 67.25 | 16 |
| U04 | B | 10K | 8 | 7.5 | 8 | 8.5 | 6.5 | 8.5 | 9 | 79.75 | 16 |
| U05 | A | 10K | 8 | 7 | 7.5 | 8.5 | 6.5 | 8.5 | 9 | 78.0 | 16 |
| U05 | B | 10K | 8 | 8 | 7.5 | 8 | 8 | 8.5 | 5.5 | 77.25 | 16 |
| U06 | A | 10K | 5 | 5.5 | 5.5 | 7.5 | 6 | 8 | 4 | 58.5 | 16 |
| U06 | B | 10K | 7 | 7 | 7.5 | 8.5 | 4.5 | 8 | 8.5 | 73.0 | 16 |
| U07 | A | HM | 8 | 7 | 8 | 8 | 7 | 7.5 | 9 | 77.5 | 16 |
| U07 | B | HM | 6 | 6.5 | 6.5 | 7.5 | 5.5 | 7 | 5 | 63.5 | 16 |
| U08 | A | HM | 8 | 7.5 | 7.5 | 8 | 8 | 7 | 5.5 | 74.75 | 14 |
| U08 | B | HM | 8 | 8 | 8 | 8.5 | 8 | 7.5 | 9 | 81.25 | 14 |
| U09 | A | M | 4 | 6.5 | 5 | 8 | 2 | 7 | 8.5 | 58.0 | 20 |
| U09 | B | M | 3 | 4.5 | 3.5 | 7 | 2 | 6 | 3 | 41.75 | 20 |
| U10 | A | M | 7 | 7 | 6 | 7.5 | 7 | 6.5 | 5 | 66.75 | 20 |
| U10 | B | M | 8.5 | 7.5 | 8.5 | 8.5 | 7 | 7 | 9 | 80.5 | 20 |

Proseci: A 71.6; B 72.35. U09: A 58.0, B 41.75. U10: A 66.75, B 80.5. Pobednik zavisi od konkretnog profila; ne postoji jedna preferirana oznaka kroz svih deset parova.

## Detaljna maratonska procena

### U09 — prvi maraton, 30 km/ned, ponovljiva dužina 10 km, četiri dana

A poboljšava oprez i iskrenost: kvalitet prvo uvodi kroz 2–2.25 minuta kontrolisanih deonica, ima lake rasteretne nedelje i jasno kaže da spremnost nije potvrđena. Međutim, 20 nedelja završava sa 17.7 km i oko 105 minuta najduže sesije. Nijedna dužina ne doseže 20 km. Punim nedeljama N3/N6/N9 LR opada u odnosu na prethodni puni korak. Dužina dobija skroman razvoj uprkos rastu ukupnog obima do 49.1 km. Maratonski rad je veoma kratak: N6 2×1100 m, N14/N18 2×1200 m, N17/N19 2.5 km, sve na 5:41/km. To je ograničen bazni ciklus sa nekoliko elemenata maratonskog ritma, ne puna priprema za 42.195 km. Kritičan nedostatak adekvatnosti ostaje čak i kada je upozorenje ispravno.

B ima dužinski plato 12.8 km u N5/N6/N7/N9/N10/N11, zatim samo dve sesije 16 km. Najveće vreme na nogama je oko 95 minuta. U N14 kvalitet skače sa 15.47 na 49.57 minuta, istovremeno LR sa 13.6 na 16 km. U N18 taper zadržava 49.57 minuta rada, više od N17. Četiri dana nisu sama po sebi nelegitimna: postoje zvanični četvorodnevni maratonski programi. Problem je isporučena baza, kratak LR i nedostatak ponovljenog dugog trajanja. Izjava da je ovo plan za istrčavanje distance je zato jača od dokaza. I ritam 5:41/km je samo rezultat/želja, ne provera završetka maratona.

Obe strane imaju 30–60 g/h napomene za veće dužine i prostor za odmor između sreda/petak/nedelja. Pozitivno gorivo i korektan raspored ne mogu zameniti nedostajuću dugotrajnu izloženost. Ne zahtevam svima 32 km, ali 95–105 minuta maksimuma ovde je premalo da se statični 20-nedeljni program proglasi punom maratonskom pripremom. Razumna odluka je nastaviti bazu/proveriti ponovljivu dužinu i tek onda menjati cilj ili datum, umesto forsirati jednu veliku sesiju.

### U10 — iskusan maratonac, 60 km/ned, LR24 km, pet dana

B bolje čuva stvarnu polaznu bazu: N1 LR24 km i 63 km/ned; N2 LR25.5 km. U planu ima devet dugih sesija ≥25 km, uključujući pet ponavljanja od29.3 km. Na prikazanom laganom ritmu 6:08/km maksimum je oko180 minuta. To daje mnogo bolji ponovljeni stimulus od jedne najveće dužine. Nije potrebno dodatno nametati32 km kada je trajanje već oko tri sata; odluka o granici treba da zavisi od iskustva, oporavka i narednih treninga. Srednje-duge sesije od14–17.6 km učvršćuju aerobni obim.

B kvalitet je kontrolisan: u običnim punim nedeljama oko24–40 radnih minuta, a u N15 intervalna sesija uz LR završnicu daje ukupno58.97 minuta. Petak N15 postaje lak, pa LR sa poslednjih9.2 km na5:20/km ostaje drugi kvalitetni dan. Rasterećenje N4/N16 uklanja kvalitet; N8/N12 zadržava samo13.5 min praga. Maratonski ritam u običnim sesijama je kratak, oko3.2–3.3 km, ali postoji duža specifična završnica. To je solidno za trenutnu3:45 referencu, a3:30 nije dokazan. Završni taper 64.1→52→10.5 predtrkačkih km ima smislen pad, uz napomenu da N19 LR18.2 km i36.6 min kvaliteta nekima još mogu biti mnogo.

A započinje sa LR15.2 km i53.2 km/ned, iako profil ima ponovljiv LR24 km i32 nedelje kontinuiteta. Tokom prvih13 nedelja nijedan LR nije≥24 km. Konačno postoje samo dva LR≥25 km:28.2 u N14 i26.8 u N17. U N14 dužina raste22.8→28.2 km (+23.7%) uz8 km MP i7.5 km T, ukupno80.17 radnih minuta. Za iskusnog trkača to nije automatski nedozvoljena nedelja, ali je slabije raspoređivanje stimulusa: izgubljena rana dužinska baza i koncentrisan kasni skok. N17 takođe spaja7.9 km MP,7 km T i26.8 km LR. N15 LR završnica je prepoznata kao kvalitet i petak je lak, što je dobro.

A deload značajno spušta obim i zadržava samo kratku oštrinu, ali taper rad57→53.5 minuta N18→N19 jedva pada. Prezentacija nema upozorenje i automatski daje referencu oko3:26, iako nema novog rezultata; trka prikazuje cilj3:30 uz5:20/km, koji aritmetički daje oko3:45. To umanjuje koherentnost i poštenje. Veći MP obim sam po sebi nije razlog da A bude bolji: maratonska specifičnost obuhvata i ponovljene duge sesije, ukupnu bazu i oporavak.

## Sažetak i tačna mesta za svaku od20 varijanti

### U01 A — 82.25/100

Razuman uvodni ciklus, uz ograničen obim; cilj 30:00 nije potvrđen. Vrhunac: 12.4 km/ned, LR 4.6 km. Pregled: 12 nedelja. Pouzdanost: 0.83.

- N5, dan 1. Očekivano: Nakon hod/trčanje faze potvrditi toleranciju kontinuiranog trčanja i ubrzanja. Stvarno: Sa 5:1 u N4 prelazi na 2.9 km kontinuirano i 6×20 s u N5. Procena: Prelaz zavisi od reakcije početnika; potreban uslov za ponavljanje prethodne faze.
- N10, dan 7. Očekivano: Dovoljna baza za vremenski cilj, bez nametanja univerzalnog kilometarskog minimuma. Stvarno: LR 4.6 km, vrhunac 12.4 km/ned; upozorenje limited. Procena: Prikladnije za izgradnju navike nego za obećanje 30-minutnog 5K.

### U01 B — 68.5/100

Upotrebljiv početni raspored uz korekciju prognoze i progresije. Vrhunac: 15.2 km/ned, LR 6.5 km. Pregled: 12 nedelja. Pouzdanost: 0.83.

- N9, dan 7. Očekivano: Posle rasterećenja uporediti sa prethodnom punom nedeljom i postepeno povećati dužinu. Stvarno: LR 4.9 u N7 → 3.4 u N8 → 6.1 u N9; 24.5% iznad N7. Procena: Veći skok pojedinačne dužine za početnika, iako apsolutni obim ostaje mali.
- N11, dan 3. Očekivano: Taper smanjuje ukupno opterećenje, uz kratko održavanje ritma. Stvarno: 4×400 m = 1.6 km RP; više radnih minuta nego prethodne dve pune kvalitetne nedelje. Procena: Novi vrhunac specifičnog rada tokom tapera nije neophodan.
- N12, dan 7. Očekivano: Jasno razdvojiti željeni cilj i referentni ritam. Stvarno: Cilj 30:00 / ritam 7:00/km; upozorenje predviđa 33:24 bez novog testa. Procena: Pace daje 35:00, a automatska prognoza nije potvrđena forma.

### U02 A — 73.75/100

Pristojan rekreativni 5K ciklus, ali prikaz cilja i prognoze traži korekciju. Vrhunac: 41.2 km/ned, LR 14 km. Pregled: 16 nedelja. Pouzdanost: 0.83.

- N1, dan 3. Očekivano: Kod some iskustva progresivno uvesti brzi rad. Stvarno: N1–N3 isti 4×300 m @4:21/km, duge hodačke pauze. Procena: Prihvatljiva mala doza, ali slabija uvodna gradacija i dosta šablonskog ponavljanja.
- N16, dan 7. Očekivano: Referencu prikazati odvojeno od sub-20 želje. Stvarno: Cilj 19:59 / ritam 4:45/km; presentation predviđa 22:09. Procena: Ritam odgovara 23:45; model rasta nije dokaz ostvarenog napretka.

### U02 B — 81.25/100

Dobar održiv ciklus prema trenutnoj formi; sub-20 ostaje neproveren. Vrhunac: 43.3 km/ned, LR 14.5 km. Pregled: 16 nedelja. Pouzdanost: 0.83.

- N13, dan 3. Očekivano: Specifičnost povećavati i preko trajanja ponavljanja/oporavka kada forma dozvoli. Stvarno: 2×1000 m @4:45/km sa 3:34 hoda. Procena: Vrlo puna pauza čini rad manje kontinuiranim; nije priprema za 4:00/km bez novog testa.
- N7, dan 7. Očekivano: Dužinu vagati prema ukupnom zamoru i cilju 5K. Stvarno: 14.5 km (~89 min), zatim plato do N14. Procena: Veliki deo četiri-dnevne nedelje; prihvatljivo aerobno, ali ne univerzalni uslov za 5K.

### U03 A — 79.25/100

Bezbedan iskusan 5K ciklus; specifični razvoj je skroman. Vrhunac: 56.5 km/ned, LR 16.6 km. Pregled: 16 nedelja. Pouzdanost: 0.83.

- N5, dan 2. Očekivano: Iskusan trkač može imati raznovrsniju gradaciju kvaliteta uz isti kontrolisani budžet. Stvarno: 2×1200 m se ponavlja u N5/N7/N11; 2×1600 m T u većini blokova. Procena: Progresija rada i specifičnosti pretežno stagnira.
- N13, dan 2. Očekivano: Sadržaj trkačkog ritma pratiti trenutnim testom i odgovarajućim odmorom. Stvarno: 3×1000 m @4:07/km, pauza 3:05 hoda. Procena: Puna pauza smanjuje kontinuitet 5K stimulusa; želja 18:59 zahteva novi dokaz forme.

### U03 B — 76.75/100

Dobro dozirani treninzi za iskustvo, ali šablon i prikaz napretka ograničavaju ocenu. Vrhunac: 55.2 km/ned, LR 15.3 km. Pregled: 16 nedelja. Pouzdanost: 0.83.

- N5, dan 2. Očekivano: Napredak graditi kroz dosledan razvoj bloka. Stvarno: LR 15.3 u N3, 14 u N5/N9/N13; isti kvalitet u N5/N7/N11. Procena: Oscilacije i ponavljanje bez jasnog ukupnog razvoja, mada 5K ne traži veliku LR ekspanziju.
- N16, dan 7. Očekivano: Razdvojiti rezultat, želju i neizvesnu prognozu. Stvarno: Cilj 18:59 / ritam 4:07/km; automatski referenceTimeSec 1163. Procena: Ritam daje 20:35; 19:23 projekcija nije potvrđena testom.

### U04 A — 67.25/100

Potrebna mirnija kvalitetna inicijacija za prvi specifičan ciklus. Vrhunac: 41.3 km/ned, LR 13.4 km. Pregled: 16 nedelja. Pouzdanost: 0.83.

- N1, dan 3. Očekivano: Za qualityExperience none prvo kontrolisana mala doza i gradacija. Stvarno: 4×300 m @4:34/km od N1; N2 još 2.8 km @5:16/km. Procena: Brzi R rad plus prag u drugoj nedelji je nepotrebno ubrzan uvod.
- N14, dan 3. Očekivano: Specifični rad primeren iskustvu i potvrđenoj formi. Stvarno: 3×1200 m RP i 4 km T =39.73 radnih min u nedelji. Procena: Kasni vrhunac kvaliteta u četvorodnevnom rasporedu pre prvog ciklusa zahteva toleranciju.
- N16, dan 7. Očekivano: Navesti 50:00 kao želju, a trenutnu referencu posebno. Stvarno: Cilj 50:00 / ritam 5:11/km, bez warnings; referentna prognoza 48:10. Procena: Ritam daje 51:50; prognoza ne potiče iz novog testa.

### U04 B — 79.75/100

Dobro uveden prvi 10K ciklus uz nekoliko previše malih pragovskih doza. Vrhunac: 43.8 km/ned, LR 16.2 km. Pregled: 16 nedelja. Pouzdanost: 0.83.

- N3, dan 5. Očekivano: Jedan jasan mali pragovski stimulus često je jednostavniji od dve vrlo kratke doze. Stvarno: N3 1.1 km T u sredu i 0.7 km T u petak; N4 0.4 km T. Procena: Budžet je kontrolisan, ali dva označena kvalitetna dana ne znače dve pune kvalitetne sesije.
- N13, dan 3. Očekivano: Kasni RP povezati većim kontinuitetom kad tolerancija dozvoli. Stvarno: 2×1000 m @5:11/km sa 3:53 hoda; N14 2×1200 m, 4 min hoda. Procena: Veoma duge pauze umanjuju 10K specifičnost.

### U05 A — 78.0/100

Održiva aerobna priprema za 10K; kvalitet je ponekad previše usitnjen. Vrhunac: 68.2 km/ned, LR 18.5 km. Pregled: 16 nedelja. Pouzdanost: 0.83.

- N1, dan 5. Očekivano: Iskusnom trkaču raspodeliti smislen pragovski rad. Stvarno: 1.2 km T u N1; 2×700 m T u N3 petak. Procena: Doze su vrlo male u odnosu na iskustvo i 45 km početne baze; oporavak dobar, razvoj skromniji.
- N14, dan 2. Očekivano: Specifični RP uz kraći relativni odmor kada doza i forma dozvole. Stvarno: 2×1600 m @4:30/km, 4 min hoda. Procena: Duga pauza i mali ukupni rad ograničavaju trkačku izdržljivost za 10K.

### U05 B — 77.25/100

Uverljiviji 10K specifični rad, ali nepouzdano obećanje napretka. Vrhunac: 66.3 km/ned, LR 18.5 km. Pregled: 16 nedelja. Pouzdanost: 0.83.

- N7, dan 2. Očekivano: Dva kvalitetna dana sagledati uz dugu trku, san i oporavak. Stvarno: 4×1200 m I, 3×2000 m T i LR18.4 km u 60.9 km. Procena: Sadržaj odgovara iskustvu, ali predstavlja punu zahtevnu nedelju i traži povratnu informaciju.
- N16, dan 7. Očekivano: Konzistentna poruka o želji 42:00 i potvrđenoj formi. Stvarno: Cilj 42:00 / ritam4:30/km; predviđanje42:13 i tvrdnja da agresivni napredak doseže cilj. Procena: Ritam daje45:00; automatsko uvećanje forme nije novo merenje.

### U06 A — 58.5/100

Povratni plan traži korekciju početne dužine i oslonca na stari PB. Vrhunac: 25.7 km/ned, LR 11 km. Pregled: 16 nedelja. Pouzdanost: 0.9.

- N1, dan 7. Očekivano: Posle 8 nedelja pauze početi ponovljivom prijavljenom dužinom ili objasniti procenu. Stvarno: Prijavljeno4 km; N1 5.9 km run/walk, N3 7.1 km. Procena: Hod smanjuje intenzitet, ali 47.5% duža prva sesija nije potvrđena novom bazom.
- N9, dan 3. Očekivano: Potvrditi sadašnju formu pre brzih tempa zasnovanih na starom PB. Stvarno: 1.9 km @5:40/km iz PB-a starog godinu dana; bez return upozorenja. Procena: Star rezultat posle pauze nije dokazana trenutna forma.
- N16, dan 7. Očekivano: Finish cilj prikazati uz granice procene. Stvarno: Vrhunac25.7 km/ned, LR11; warning kaže plan za ISTRČATI, projected reference3103 s. Procena: Završetak i projekcija nisu potvrđeni samim obimom niti starim rezultatom.

### U06 B — 73.0/100

Dobar povratak u kontinuitet; ograničena 10K priprema ostaje stvarno ograničena. Vrhunac: 18.2 km/ned, LR 6.7 km. Pregled: 16 nedelja. Pouzdanost: 0.9.

- N14, dan 7. Očekivano: Posle povratne faze dugoročnu dužinu razvijati prema toleranciji i cilju. Stvarno: LR vrhunac6.7 km, 18.2 km/ned u 16-nedeljnom ciklusu. Procena: Odgovorno upozorenje limited ne zamenjuje nedostajuću izdržljivost za pun 10K cilj.
- N7, dan 3. Očekivano: Pre bržeg rada potvrditi da stari PB opisuje trenutnu formu. Stvarno: 3×90 s @5:07/km na old PB; tekst traži proveru, raspored ipak ima numerički tempo. Procena: Potrebna kontrola napora; upozorenje je dobar deo plana, ali individualna verifikacija ostaje otvorena.

### U07 A — 77.5/100

Dobra baza za prvi HM, uz konzervativan specifični rad. Vrhunac: 50.2 km/ned, LR 19.5 km. Pregled: 16 nedelja. Pouzdanost: 0.9.

- N10, dan 3. Očekivano: HM ritam postepeno učiniti kontinualnijim kada trkač to podnosi. Stvarno: 2×1700 m @5:11/km sa5:26 hoda. Procena: Potpun odmor ograničava trajanje kontinuiranog HM stimulusa.
- N14, dan 3. Očekivano: Taper održava intenzitet uz manju dozu. Stvarno: 31.67 min kvaliteta u N14 naspram35.18 u N11; dva kvalitetna dana. Procena: Prvo smanjenje kvaliteta je skromno; LR i obim se ipak smanjuju.

### U07 B — 63.5/100

HM plan sa slabijom dužinskom bazom i prejakom prognozom. Vrhunac: 46.2 km/ned, LR 15.3 km. Pregled: 16 nedelja. Pouzdanost: 0.9.

- N1, dan 7. Očekivano: Sa početnim LR10 km postepeno razvijati uz prioritet baze. Stvarno: N1 LR11.6 km, R i T u istoj nedelji; LR14 km u N5–N9. Procena: Dva kvaliteta od starta i dug plato čine prioritet izdržljivosti slabijim.
- N13, dan 7. Očekivano: Ponavljana dužinska izlaganja primerena prvom HM. Stvarno: Vrhunac15.3 u N11; N13 LR14.8 km. Procena: Nije nužan LR21.1 km, ali niz kratkih dužina i mala ponovljena izloženost ograničavaju vremenski cilj.
- N16, dan 7. Očekivano: Rezultat 5K ne potvrđuje HM izdržljivost ili napredak. Stvarno: Bez warnings, predicted reference1:41:47, cilj1:45/ritam5:11. Procena: Automatska prognoza uz ograničenu dužinsku pripremu je previše sigurna.

### U08 A — 74.75/100

Dobar HM sadržaj za iskustvo; taper i projekcija traže oprez. Vrhunac: 71.9 km/ned, LR 22 km. Pregled: 14 nedelja. Pouzdanost: 0.9.

- N12, dan 2. Očekivano: Taper zadržava brzinu uz stvarno smanjen radni obim. Stvarno: 6 km HM RP +5 km T =48.92 min u N12; N11 ukupno51.75 min sa LR završnicom. Procena: Tek oko5.5% manji kvalitet na početku tapera, iako se nedeljni km smanjuju.
- N14, dan 7. Očekivano: Prikazati referentno ekvivalentno vreme bez simuliranog potvrđenog napretka. Stvarno: referenceTime5383 s, initialVdot48.2→last51.2; nema warnings. Procena: Projekcija1:29:43 nije potvrđeno izmerena forma niti potvrda HM izdržljivosti.

### U08 B — 81.25/100

Dobro balansiran iskusan HM ciklus uz nešto duži i sporiji taper. Vrhunac: 75.3 km/ned, LR 22 km. Pregled: 14 nedelja. Pouzdanost: 0.9.

- N12, dan 7. Očekivano: Prethodnu visoku specifičnu izloženost rasteretiti dovoljno rano. Stvarno: N12 LR18.3 km, 61.7 km/ned i41.79 min kvaliteta; trka N14. Procena: Prvi taper korak je umeren, ali naredni pad na46.1 pa10.5 predtrkačkih km daje rasterećenje.
- N10, dan 2. Očekivano: Kontrolna trka uključuje planiran oporavak narednog dana. Stvarno: 10 km HM ritam u treningu16.5 km; N10 sreda13.6 km. Procena: Ako se kontrola trči maksimalno umesto propisanog ritma, sledeća srednje-duga sesija može biti previše; eksplicitan uslov bi pomogao.

### U09 A — 58.0/100

Oprezan ograničen ciklus, ali nije puna priprema za maraton. Vrhunac: 49.1 km/ned, LR 17.7 km. Pregled: 20 nedelja. Pouzdanost: 0.95.

- **Kritično za adekvatnost:** N17, dan 7. Očekivano: Maratonski ciklus treba ponovljena dovoljno duga izlaganja i vreme na nogama, ili jasno ograničen drugi cilj. Stvarno: Najveći LR17.7 km (~105 min); nijedan LR>=20 km u20 nedelja; trka42.195 km uN20. Procena: Nedovoljna maratonska dužinska priprema, nezavisno od dobrog upozorenja.
- N3, dan 7. Očekivano: Razvoj dužine ne bi trebalo više puta potiskivati kvalitetom. Stvarno: LR10.8→9.7 km N2→N3;11.4→10.2 N5→N6;12.3→11 N7→N9 preko deload-a. Procena: Dužina nazaduje u nekoliko punih nedelja; maratonski prioritet slabi.
- N17, dan 3. Očekivano: Za maraton prioritet je aerobna dužina i kasnije smislen RP. Stvarno: Samo2.5 km MP uN17, uz3.7 km T u petak i17.7 km LR. Procena: Kratak MP i rast praga ne nadoknađuju nedostajuće dugo trajanje.

### U09 B — 41.75/100

Nije prihvatljiva puna priprema za maraton; prikaz završetka je previše siguran. Vrhunac: 43.3 km/ned, LR 16 km. Pregled: 20 nedelja. Pouzdanost: 0.95.

- **Kritično za adekvatnost:** N17, dan 7. Očekivano: Maratonska završna preporuka mora priznati nedovoljnu dužinsku pripremu. Stvarno: LR plafon16 km (~95 min), samoN14 iN17; warning kaže plan da distancu ISTRČIŠ. Procena: Završetak maratona nije podržan isporučenim ponovljenim dugim sesijama.
- N14, dan 3. Očekivano: Gradacija kvaliteta i dužine treba da bude u skladu sa bazom. Stvarno: 15.47 min kvaliteta N13→49.57 N14; LR13.6→16 km; ponedeljak3 km. Procena: Istovremeni skok rada i LR, pri čemu kvalitet zauzima veliki deo četvorodnevne nedelje.
- N18, dan 3. Očekivano: Taper zadržava intenzitet uz smanjenu dozu. Stvarno: 49.57 min kvaliteta N18, više od47.58 u poslednjoj punoj N17. Procena: Nema smanjenja doze glavnog rada pri početku tapera.
- N20, dan 7. Očekivano: Četiri dana mogu biti legitiman maratonski raspored; problem treba vezati za isporučenu bazu. Stvarno: Warning preporučuje bar5 dana i tvrdi LR postaje polovina nedelje; stvarni peak LR16/43.3=37%. Procena: Generalizacija o danima i finish obećanje ne opisuju stvarni problem.

### U10 A — 66.75/100

Delimično uverljiv iskusan maratonski ciklus; ponovljena dužina i kvalitet zahtevaju reviziju. Vrhunac: 80.2 km/ned, LR 28.2 km. Pregled: 20 nedelja. Pouzdanost: 0.95.

- N1, dan 7. Očekivano: Prijavljen LR24 km i32 nedelje kontinuiteta treba smisleno održati ili objasniti početno rasterećenje. Stvarno: N1 LR15.2 km i53.2 km/ned naspram24 km i60 km ulaza. Procena: Početna dugotrajna izloženost nepotrebno se izgubi; prvih13 nedelja bez LR>=24 km.
- N14, dan 7. Očekivano: Postepeno približavanje većoj dužini uz kontrolu ostalog rada. Stvarno: N13 LR22.8→N14 28.2 km (+23.7%); iste nedelje8 km MP i7.5 km T (80.17 min). Procena: Koncentrisan skok dužine i kvaliteta; nije automatski povreda, ali slab izbor opterećenja.
- N17, dan 7. Očekivano: Za ambiciozan maraton više ponovljenih dugih izlaganja i dobra raspodela. Stvarno: SamoN14 28.2 iN17 26.8 km >=25; N17 i7.9 km MP+7 km T. Procena: Nedovoljan kontinuitet dugog trajanja u odnosu na ulaznu bazu; ne postoji univerzalna32-km obaveza.
- N19, dan 2. Očekivano: Završni taper smanjuje kvalitetni volumen uz zadržavanje intenziteta. Stvarno: N19 6 km MP +4.3 km T =53.5 min; N18 57 min. Procena: Radni volumen se smanjuje tek6% između taperskih nedelja.
- N20, dan 7. Očekivano: Predviđanje iz20-nedeljnog modela ne predstavljati kao potvrđenu formu. Stvarno: reference12381 s (~3:26:21), warnings[]; trka cilj3:30/ritam5:20. Procena: Reference i cilj izgledaju dostignuto bez novog rezultata; ritam5:20 daje3:45:02.

### U10 B — 80.5/100

Najbolja maratonska struktura u paru: održana baza, ponovljene dužine i kontrolisan kvalitet. Vrhunac: 80.1 km/ned, LR 29.3 km. Pregled: 20 nedelja. Pouzdanost: 0.95.

- N11, dan 7. Očekivano: Vreme na nogama treba ograničiti i individualno pratiti zamor. Stvarno: 29.3 km @6:08/km ≈180 min, ponovljenoN11/N13/N14/N17; ukupno9 LR>=25 km. Procena: Dobar kontinuitet izdržljivosti;3h više puta nije automatski bezbedno ili optimalno za svakoga.
- N14, dan 2. Očekivano: Specifičnost prema3:30 cilju razvijati tek kada potvrđena forma podržava brži ritam. Stvarno: MP3.2–3.3 km @5:20/km; duža završnica9.2 km uN15. Procena: Razuman sadržaj za3:45 referencu, ali ne dokaz3:30; kratke redovne MP doze ograničavaju specifičnost.
- N19, dan 7. Očekivano: Taper treba dovoljno smanjiti i dugu sesiju i glavni rad. Stvarno: N19 LR18.2 km (~112 min),52 km/ned i36.6 min kvaliteta; N18 39.07 min. Procena: Drugi korak kvaliteta je skroman; race-week10.5 km ipak znatno rasterećuje.

## Trag pregleda svih nedelja

Sledeći redovi su sažeti kontrolni trag iz dozvoljenih blind podataka: nedeljni km, najduža sesija (uključuje run/walk), kvalitetni rad u minutima, zahtevni dani, rasterećenje/taper. Svi opisi treninga i dani pregledani su pre ocenjivanja; ovo nije automatizovana zamena za trenerski sud. Računska provera zbira dnevnih km i navedenog nedeljnog obima nije našla neslaganje >0.11 km. Nema numeričkih failures u dostavljenim summary poljima; to ne znači da nema trenerskih problema. Trkačka nedelja se pri proceni tapera poredi bez same trke.

### U01 A

| N | km | Najduža trening sesija km | Kvalitet min | Zahtevni dani | Deload | Taper |
|---:|---:|---:|---:|---|---|---|
| 1 | 7.3 | 2.9 | 0 | — | ne | ne |
| 2 | 7.7 | 3 | 0 | — | ne | ne |
| 3 | 8.3 | 3.1 | 0 | — | ne | ne |
| 4 | 6.1 | 2.3 | 0 | — | da | ne |
| 5 | 9.3 | 3.5 | 0 | — | ne | ne |
| 6 | 9.6 | 3.8 | 0 | — | ne | ne |
| 7 | 11 | 4.1 | 3 | 3 | ne | ne |
| 8 | 8 | 3 | 0 | — | da | ne |
| 9 | 11.7 | 4.3 | 3 | 3 | ne | ne |
| 10 | 12.4 | 4.6 | 5.25 | 3 | ne | ne |
| 11 | 8 | 2.9 | 5.6 | 3 | ne | da |
| 12 | 8 | 1.5 | 0 | — | ne | ne |

### U01 B

| N | km | Najduža trening sesija km | Kvalitet min | Zahtevni dani | Deload | Taper |
|---:|---:|---:|---:|---|---|---|
| 1 | 7 | 2.8 | 0 | — | ne | ne |
| 2 | 8.2 | 3.3 | 0 | — | ne | ne |
| 3 | 9.2 | 3.7 | 0 | — | ne | ne |
| 4 | 6.7 | 2.7 | 0 | — | da | ne |
| 5 | 10.2 | 4.1 | 0 | — | ne | ne |
| 6 | 10.5 | 4.5 | 0 | — | ne | ne |
| 7 | 11.6 | 4.9 | 7.98 | 3 | ne | ne |
| 8 | 9.1 | 3.4 | 2.53 | 3 | da | ne |
| 9 | 13.3 | 6.1 | 6 | 3 | ne | ne |
| 10 | 15.2 | 6.5 | 7.88 | 3 | ne | ne |
| 11 | 10.7 | 4.1 | 11.2 | 3 | ne | da |
| 12 | 8 | 1.5 | 0 | — | ne | ne |

### U02 A

| N | km | Najduža trening sesija km | Kvalitet min | Zahtevni dani | Deload | Taper |
|---:|---:|---:|---:|---|---|---|
| 1 | 28.5 | 8.6 | 5.22 | 3 | ne | ne |
| 2 | 29.4 | 9.1 | 5.22 | 3 | ne | ne |
| 3 | 30.7 | 9.6 | 5.22 | 3 | ne | ne |
| 4 | 22.5 | 7.6 | 3.48 | 3 | da | ne |
| 5 | 31.3 | 10.1 | 10.88 | 3 | ne | ne |
| 6 | 33.4 | 10.6 | 22.05 | 3,5 | ne | ne |
| 7 | 35.7 | 11.2 | 25.12 | 3,5 | ne | ne |
| 8 | 24 | 8.2 | 3.48 | 3 | da | ne |
| 9 | 35.2 | 11.9 | 28.75 | 3,5 | ne | ne |
| 10 | 38.3 | 12.5 | 27.06 | 3,5 | ne | ne |
| 11 | 40.3 | 13.2 | 26.03 | 3,5 | ne | ne |
| 12 | 27.4 | 9.6 | 3.48 | 3 | da | ne |
| 13 | 37.9 | 13.9 | 29.3 | 3,5 | ne | ne |
| 14 | 41.2 | 14 | 28.65 | 3,5 | ne | ne |
| 15 | 23.6 | 8.4 | 18.64 | 3,5 | ne | da |
| 16 | 15.5 | 4.5 | 2.81 | 5 | ne | ne |

### U02 B

| N | km | Najduža trening sesija km | Kvalitet min | Zahtevni dani | Deload | Taper |
|---:|---:|---:|---:|---|---|---|
| 1 | 31.6 | 10 | 2.5 | 3 | ne | ne |
| 2 | 32.7 | 10.8 | 2.25 | 3 | ne | ne |
| 3 | 34 | 11.6 | 14.95 | 3,5 | ne | ne |
| 4 | 24.8 | 8.4 | 0 | — | da | ne |
| 5 | 37 | 12.5 | 21.11 | 3,5 | ne | ne |
| 6 | 38.5 | 13.5 | 19.55 | 3,5 | ne | ne |
| 7 | 40.9 | 14.5 | 23.11 | 3,5 | ne | ne |
| 8 | 29.9 | 10.6 | 0 | — | da | ne |
| 9 | 43 | 14.5 | 24.47 | 3,5 | ne | ne |
| 10 | 43.3 | 14.5 | 24.56 | 3,5 | ne | ne |
| 11 | 42.7 | 14.5 | 24.02 | 3,5 | ne | ne |
| 12 | 31.1 | 10 | 0 | — | da | ne |
| 13 | 42 | 14.5 | 23.05 | 3,5 | ne | ne |
| 14 | 42.7 | 14.5 | 24.42 | 3,5 | ne | ne |
| 15 | 23.9 | 8.7 | 15.73 | 3,5 | ne | da |
| 16 | 15.5 | 4.5 | 2.81 | 5 | ne | ne |

### U03 A

| N | km | Najduža trening sesija km | Kvalitet min | Zahtevni dani | Deload | Taper |
|---:|---:|---:|---:|---|---|---|
| 1 | 51.5 | 14 | 21.05 | 2,5 | ne | ne |
| 2 | 53.6 | 15.1 | 23.51 | 2,5 | ne | ne |
| 3 | 55.9 | 16.3 | 22.01 | 2,5 | ne | ne |
| 4 | 40.3 | 12.2 | 0 | — | da | ne |
| 5 | 51.7 | 16.6 | 23.51 | 2,5 | ne | ne |
| 6 | 54.5 | 16.6 | 26.53 | 2,5 | ne | ne |
| 7 | 56.5 | 16.6 | 23.51 | 2,5 | ne | ne |
| 8 | 40.2 | 12.4 | 0 | — | da | ne |
| 9 | 51.7 | 16.6 | 25.88 | 2,5 | ne | ne |
| 10 | 54.5 | 16.6 | 26.97 | 2,5 | ne | ne |
| 11 | 56.5 | 16.6 | 23.51 | 2,5 | ne | ne |
| 12 | 40.2 | 12.4 | 0 | — | da | ne |
| 13 | 51.7 | 16.6 | 24.19 | 2,5 | ne | ne |
| 14 | 54.5 | 16.6 | 26.05 | 2,5 | ne | ne |
| 15 | 34.7 | 9.9 | 16.34 | 2,5 | ne | da |
| 16 | 15.5 | 4.5 | 2.43 | 5 | ne | ne |

### U03 B

| N | km | Najduža trening sesija km | Kvalitet min | Zahtevni dani | Deload | Taper |
|---:|---:|---:|---:|---|---|---|
| 1 | 52.8 | 14.3 | 30.16 | 2,5 | ne | ne |
| 2 | 53.5 | 14.7 | 30.16 | 2,5 | ne | ne |
| 3 | 55.2 | 15.3 | 31.3 | 2,5 | ne | ne |
| 4 | 37.1 | 10.9 | 3.8 | 2 | da | ne |
| 5 | 49.5 | 14 | 35.26 | 2,5 | ne | ne |
| 6 | 53.4 | 14.7 | 29.73 | 2,5 | ne | ne |
| 7 | 55.2 | 15.3 | 35.26 | 2,5 | ne | ne |
| 8 | 37.1 | 10.9 | 3.8 | 2 | da | ne |
| 9 | 49.4 | 14 | 35.26 | 2,5 | ne | ne |
| 10 | 53.4 | 14.7 | 29.73 | 2,5 | ne | ne |
| 11 | 55.2 | 15.3 | 35.26 | 2,5 | ne | ne |
| 12 | 37.1 | 10.9 | 3.8 | 2 | da | ne |
| 13 | 48.5 | 14 | 29.62 | 2,5 | ne | ne |
| 14 | 52.5 | 14.7 | 29.74 | 2,5 | ne | ne |
| 15 | 32.4 | 9.2 | 18.42 | 2,5 | ne | da |
| 16 | 15.5 | 4.5 | 2.43 | 5 | ne | ne |

### U04 A

| N | km | Najduža trening sesija km | Kvalitet min | Zahtevni dani | Deload | Taper |
|---:|---:|---:|---:|---|---|---|
| 1 | 26.8 | 9.7 | 5.48 | 3 | ne | ne |
| 2 | 28 | 10.4 | 20.23 | 3,5 | ne | ne |
| 3 | 30.8 | 11 | 5.48 | 3 | ne | ne |
| 4 | 22.5 | 8.4 | 3.65 | 3 | da | ne |
| 5 | 31.4 | 11 | 9.5 | 3 | ne | ne |
| 6 | 34.6 | 11 | 26.91 | 3,5 | ne | ne |
| 7 | 36.9 | 11.1 | 26.35 | 3,5 | ne | ne |
| 8 | 27.8 | 10 | 3.65 | 3 | da | ne |
| 9 | 37.7 | 11.7 | 30.15 | 3,5 | ne | ne |
| 10 | 40.6 | 12.3 | 31.57 | 3,5 | ne | ne |
| 11 | 41.3 | 13 | 31.1 | 3,5 | ne | ne |
| 12 | 31 | 10.7 | 3.65 | 3 | da | ne |
| 13 | 37.6 | 12.7 | 28.72 | 3,5 | ne | ne |
| 14 | 40.9 | 13.4 | 39.73 | 3,5 | ne | ne |
| 15 | 25.9 | 8.7 | 22.5 | 3,5 | ne | da |
| 16 | 20.5 | 4.5 | 5.12 | 5 | ne | ne |

### U04 B

| N | km | Najduža trening sesija km | Kvalitet min | Zahtevni dani | Deload | Taper |
|---:|---:|---:|---:|---|---|---|
| 1 | 27 | 8 | 2.5 | 3 | ne | ne |
| 2 | 28.1 | 8.6 | 3 | 3 | ne | ne |
| 3 | 29.5 | 9.2 | 9.48 | 3,5 | ne | ne |
| 4 | 22.2 | 6.6 | 2.11 | 3 | da | ne |
| 5 | 32.7 | 9.9 | 14.97 | 3,5 | ne | ne |
| 6 | 34.5 | 10.6 | 23.3 | 3,5 | ne | ne |
| 7 | 35.9 | 11.4 | 18.13 | 3,5 | ne | ne |
| 8 | 26.5 | 8.5 | 0 | — | da | ne |
| 9 | 39 | 12.3 | 25.67 | 3,5 | ne | ne |
| 10 | 40.3 | 13.2 | 26.91 | 3,5 | ne | ne |
| 11 | 42.6 | 14.2 | 24.25 | 3,5 | ne | ne |
| 12 | 32 | 10.4 | 0 | — | da | ne |
| 13 | 42.2 | 15.3 | 23.01 | 3,5 | ne | ne |
| 14 | 43.8 | 16.2 | 30.35 | 3,5 | ne | ne |
| 15 | 28 | 10.5 | 18.33 | 3,5 | ne | da |
| 16 | 20.5 | 4.5 | 5.12 | 5 | ne | ne |

### U05 A

| N | km | Najduža trening sesija km | Kvalitet min | Zahtevni dani | Deload | Taper |
|---:|---:|---:|---:|---|---|---|
| 1 | 47.5 | 14 | 11.96 | 2,5 | ne | ne |
| 2 | 49.2 | 15.1 | 23.02 | 2,5 | ne | ne |
| 3 | 52.1 | 16.3 | 15.64 | 2,5 | ne | ne |
| 4 | 39.1 | 12 | 0 | — | da | ne |
| 5 | 55.8 | 17.6 | 24.68 | 2,5 | ne | ne |
| 6 | 58.9 | 18.5 | 31.2 | 2,5 | ne | ne |
| 7 | 62.1 | 18.5 | 26.52 | 2,5 | ne | ne |
| 8 | 46.6 | 13.8 | 0 | — | da | ne |
| 9 | 65.1 | 18.5 | 29.01 | 2,5 | ne | ne |
| 10 | 68.2 | 18.5 | 35.58 | 2,5 | ne | ne |
| 11 | 65.2 | 18.5 | 28.36 | 2,5 | ne | ne |
| 12 | 48.9 | 13.2 | 0 | — | da | ne |
| 13 | 65.6 | 18.5 | 34.14 | 2,5 | ne | ne |
| 14 | 65.9 | 18.5 | 36.48 | 2,5 | ne | ne |
| 15 | 40.9 | 12 | 20.58 | 2,5 | ne | da |
| 16 | 20.5 | 4.5 | 4.43 | 5 | ne | ne |

### U05 B

| N | km | Najduža trening sesija km | Kvalitet min | Zahtevni dani | Deload | Taper |
|---:|---:|---:|---:|---|---|---|
| 1 | 47.5 | 14.3 | 21.92 | 2,5 | ne | ne |
| 2 | 48.8 | 15 | 29.28 | 2,5 | ne | ne |
| 3 | 52.3 | 15.9 | 26.8 | 2,5 | ne | ne |
| 4 | 39.3 | 11.8 | 4 | 2 | da | ne |
| 5 | 51.5 | 16.7 | 33.34 | 2,5 | ne | ne |
| 6 | 56 | 17.7 | 41.34 | 2,5 | ne | ne |
| 7 | 60.9 | 18.4 | 47.52 | 2,5 | ne | ne |
| 8 | 45.7 | 13.7 | 4.8 | 2 | da | ne |
| 9 | 62.3 | 18.5 | 42.54 | 2,5 | ne | ne |
| 10 | 66.3 | 18.5 | 41.34 | 2,5 | ne | ne |
| 11 | 65.6 | 18.5 | 42.54 | 2,5 | ne | ne |
| 12 | 49.3 | 14.9 | 4.8 | 2 | da | ne |
| 13 | 64 | 18.5 | 45.86 | 2,5 | ne | ne |
| 14 | 64.4 | 18.5 | 46.44 | 2,5 | ne | ne |
| 15 | 43.2 | 12 | 26.5 | 2,5 | ne | da |
| 16 | 20.5 | 4.5 | 4.43 | 5 | ne | ne |

### U06 A

| N | km | Najduža trening sesija km | Kvalitet min | Zahtevni dani | Deload | Taper |
|---:|---:|---:|---:|---|---|---|
| 1 | 14.1 | 5.9 | 0 | — | ne | ne |
| 2 | 15.5 | 6.5 | 0 | — | ne | ne |
| 3 | 16.9 | 7.1 | 0 | — | ne | ne |
| 4 | 12.6 | 5.3 | 0 | — | da | ne |
| 5 | 18.1 | 7.6 | 0 | — | ne | ne |
| 6 | 18.9 | 8.3 | 0 | — | ne | ne |
| 7 | 20.2 | 8.8 | 0 | — | ne | ne |
| 8 | 15.2 | 6.4 | 0 | — | da | ne |
| 9 | 21.1 | 9.8 | 10.77 | 3 | ne | ne |
| 10 | 23.3 | 10.4 | 4.42 | 3 | ne | ne |
| 11 | 25.5 | 10.9 | 0 | — | ne | ne |
| 12 | 19.2 | 8.1 | 3.93 | 3 | da | ne |
| 13 | 25.7 | 11 | 0 | — | ne | ne |
| 14 | 22.4 | 9.4 | 10.2 | 3 | ne | ne |
| 15 | 16.7 | 7 | 10.8 | 3 | ne | da |
| 16 | 14.4 | 2.2 | 0 | — | ne | ne |

### U06 B

| N | km | Najduža trening sesija km | Kvalitet min | Zahtevni dani | Deload | Taper |
|---:|---:|---:|---:|---|---|---|
| 1 | 10.2 | 4 | 0 | — | ne | ne |
| 2 | 10.4 | 4.2 | 0 | — | ne | ne |
| 3 | 10.8 | 4.4 | 0 | — | ne | ne |
| 4 | 8.1 | 3.2 | 0 | — | da | ne |
| 5 | 12.7 | 4.6 | 3 | 3 | ne | ne |
| 6 | 13.1 | 4.8 | 3 | 3 | ne | ne |
| 7 | 13.5 | 5 | 4.5 | 3 | ne | ne |
| 8 | 10.2 | 4 | 0 | — | da | ne |
| 9 | 14.5 | 5.3 | 5.12 | 3 | ne | ne |
| 10 | 15.3 | 5.7 | 6.8 | 3 | ne | ne |
| 11 | 16.5 | 6.1 | 6 | 3 | ne | ne |
| 12 | 12.3 | 4.5 | 3 | 3 | da | ne |
| 13 | 16 | 6.4 | 8.5 | 3 | ne | ne |
| 14 | 18.2 | 6.7 | 12 | 3 | ne | ne |
| 15 | 10.9 | 4.3 | 7.2 | 3 | ne | da |
| 16 | 14.4 | 2.2 | 0 | — | ne | ne |

### U07 A

| N | km | Najduža trening sesija km | Kvalitet min | Zahtevni dani | Deload | Taper |
|---:|---:|---:|---:|---|---|---|
| 1 | 32.2 | 10 | 2.5 | 3 | ne | ne |
| 2 | 33.8 | 10.8 | 2.25 | 3 | ne | ne |
| 3 | 35.9 | 11.6 | 17.29 | 3,5 | ne | ne |
| 4 | 27.2 | 8.7 | 0 | — | da | ne |
| 5 | 38.6 | 12.5 | 17.29 | 3,5 | ne | ne |
| 6 | 40.1 | 13.5 | 23.05 | 3,5 | ne | ne |
| 7 | 42.6 | 14.5 | 21.3 | 3,5 | ne | ne |
| 8 | 32.4 | 10.7 | 0 | — | da | ne |
| 9 | 45.7 | 15.6 | 21.3 | 3,5 | ne | ne |
| 10 | 47.4 | 16.8 | 31.67 | 3,5 | ne | ne |
| 11 | 50.2 | 18.1 | 35.18 | 3,5 | ne | ne |
| 12 | 38.3 | 13.3 | 10.54 | 3 | da | ne |
| 13 | 49.3 | 19.5 | 36.28 | 3 | ne | ne |
| 14 | 41.2 | 15.6 | 31.67 | 3,5 | ne | da |
| 15 | 34.6 | 12.6 | 28.61 | 3,5 | ne | da |
| 16 | 31.6 | 4.5 | 6.14 | 5 | ne | ne |

### U07 B

| N | km | Najduža trening sesija km | Kvalitet min | Zahtevni dani | Deload | Taper |
|---:|---:|---:|---:|---|---|---|
| 1 | 32.1 | 11.6 | 20.27 | 3,5 | ne | ne |
| 2 | 33.8 | 12.4 | 21.77 | 3,5 | ne | ne |
| 3 | 36.1 | 13.2 | 26.93 | 3,5 | ne | ne |
| 4 | 27.5 | 9.9 | 3.48 | 3 | da | ne |
| 5 | 35.9 | 14 | 26.93 | 3,5 | ne | ne |
| 6 | 39.4 | 14 | 29.56 | 3,5 | ne | ne |
| 7 | 42.8 | 14 | 26.93 | 3,5 | ne | ne |
| 8 | 32.5 | 11.7 | 3.48 | 3 | da | ne |
| 9 | 41.2 | 14 | 26.93 | 3,5 | ne | ne |
| 10 | 44.8 | 14.5 | 36.79 | 3,5 | ne | ne |
| 11 | 46 | 15.3 | 40.43 | 3,7 | ne | ne |
| 12 | 35.2 | 12.6 | 4.35 | 3 | da | ne |
| 13 | 46.2 | 14.8 | 36.28 | 3 | ne | ne |
| 14 | 37.9 | 12 | 36.79 | 3,5 | ne | da |
| 15 | 30.4 | 9.9 | 32.19 | 3,5 | ne | da |
| 16 | 31.6 | 4.5 | 6.14 | 5 | ne | ne |

### U08 A

| N | km | Najduža trening sesija km | Kvalitet min | Zahtevni dani | Deload | Taper |
|---:|---:|---:|---:|---|---|---|
| 1 | 57.4 | 17 | 26.74 | 2,5 | ne | ne |
| 2 | 60.6 | 17.8 | 33.14 | 2,5 | ne | ne |
| 3 | 63.5 | 19.1 | 36.14 | 2,5 | ne | ne |
| 4 | 48 | 14.7 | 4.56 | 2 | da | ne |
| 5 | 65.6 | 20.5 | 36.14 | 2,5 | ne | ne |
| 6 | 70 | 20.7 | 45.37 | 2,5 | ne | ne |
| 7 | 68.1 | 22 | 36.14 | 2,5 | ne | ne |
| 8 | 51.9 | 16.1 | 5.32 | 2 | da | ne |
| 9 | 68.8 | 22 | 51.75 | 2,7 | ne | ne |
| 10 | 71.9 | 22 | 45 | 2 | ne | ne |
| 11 | 68.7 | 22 | 51.75 | 2,7 | ne | ne |
| 12 | 59 | 17.2 | 48.92 | 2,5 | ne | da |
| 13 | 47.9 | 14.3 | 40.03 | 2,5 | ne | da |
| 14 | 31.6 | 4.5 | 5.32 | 5 | ne | ne |

### U08 B

| N | km | Najduža trening sesija km | Kvalitet min | Zahtevni dani | Deload | Taper |
|---:|---:|---:|---:|---|---|---|
| 1 | 53.8 | 16 | 14.9 | 2,5 | ne | ne |
| 2 | 56.8 | 17.2 | 16.22 | 2,5 | ne | ne |
| 3 | 61.2 | 18.5 | 23.51 | 2,5 | ne | ne |
| 4 | 46.6 | 13.6 | 0 | — | da | ne |
| 5 | 63.3 | 19.9 | 23.51 | 2,5 | ne | ne |
| 6 | 68.9 | 21.3 | 32.6 | 2,5 | ne | ne |
| 7 | 67.9 | 22 | 28.77 | 2,5 | ne | ne |
| 8 | 51.6 | 15.3 | 0 | — | da | ne |
| 9 | 71.1 | 22 | 47.25 | 2,7 | ne | ne |
| 10 | 75.3 | 22 | 45 | 2 | ne | ne |
| 11 | 71.1 | 22 | 47.25 | 2,7 | ne | ne |
| 12 | 61.7 | 18.3 | 41.79 | 2,5 | ne | da |
| 13 | 46.1 | 14.3 | 33.81 | 2,5 | ne | da |
| 14 | 31.6 | 4.5 | 5.32 | 5 | ne | ne |

### U09 A

| N | km | Najduža trening sesija km | Kvalitet min | Zahtevni dani | Deload | Taper |
|---:|---:|---:|---:|---|---|---|
| 1 | 32.4 | 10 | 2 | 3 | ne | ne |
| 2 | 33.9 | 10.8 | 2.25 | 3 | ne | ne |
| 3 | 32.5 | 9.7 | 9.67 | 3 | ne | ne |
| 4 | 25.4 | 8.1 | 0 | — | da | ne |
| 5 | 36.3 | 11.4 | 9.67 | 3 | ne | ne |
| 6 | 34 | 10.2 | 12.5 | 3 | ne | ne |
| 7 | 37.6 | 12.3 | 9.67 | 3 | ne | ne |
| 8 | 28.8 | 9.2 | 0 | — | da | ne |
| 9 | 36.9 | 11 | 13.53 | 3 | ne | ne |
| 10 | 40.7 | 13.2 | 13.53 | 3 | ne | ne |
| 11 | 44.2 | 14.2 | 13.53 | 3 | ne | ne |
| 12 | 33.2 | 10.6 | 0 | — | da | ne |
| 13 | 47.7 | 15.3 | 13.53 | 3 | ne | ne |
| 14 | 47.3 | 16.5 | 27.17 | 3,5 | ne | ne |
| 15 | 45.1 | 14.8 | 24.87 | 3,5 | ne | ne |
| 16 | 35.5 | 10.7 | 10.63 | 3 | da | ne |
| 17 | 49.1 | 17.7 | 32.09 | 3,5 | ne | ne |
| 18 | 39.3 | 13.8 | 27.17 | 3,5 | ne | da |
| 19 | 31.9 | 11.4 | 14.21 | 3 | ne | da |
| 20 | 52.7 | 4.5 | 6.74 | 5 | ne | ne |

### U09 B

| N | km | Najduža trening sesija km | Kvalitet min | Zahtevni dani | Deload | Taper |
|---:|---:|---:|---:|---|---|---|
| 1 | 31.5 | 10.9 | 14.5 | 3 | ne | ne |
| 2 | 34.2 | 11.7 | 4.2 | 3 | ne | ne |
| 3 | 36.7 | 12.5 | 15.47 | 3 | ne | ne |
| 4 | 25.8 | 8.5 | 3.36 | 3 | da | ne |
| 5 | 34.6 | 12.8 | 4.2 | 3 | ne | ne |
| 6 | 38.4 | 12.8 | 15.47 | 3 | ne | ne |
| 7 | 39.5 | 12.8 | 15.47 | 3 | ne | ne |
| 8 | 29.8 | 10.2 | 3.36 | 3 | da | ne |
| 9 | 37.6 | 12.8 | 15.47 | 3 | ne | ne |
| 10 | 39.5 | 12.8 | 15.47 | 3 | ne | ne |
| 11 | 39.5 | 12.8 | 15.47 | 3 | ne | ne |
| 12 | 31 | 10.7 | 3.36 | 3 | da | ne |
| 13 | 39.3 | 13.6 | 15.47 | 3 | ne | ne |
| 14 | 43.3 | 16 | 49.57 | 3,5 | ne | ne |
| 15 | 38.3 | 12.2 | 21.03 | 3 | ne | ne |
| 16 | 30 | 10.4 | 3.36 | 3 | da | ne |
| 17 | 42.1 | 16 | 47.58 | 3,5 | ne | ne |
| 18 | 34.6 | 11.7 | 49.57 | 3,5 | ne | da |
| 19 | 28.1 | 9.6 | 19.32 | 3 | ne | da |
| 20 | 52.7 | 4.5 | 6.74 | 5 | ne | ne |

### U10 A

| N | km | Najduža trening sesija km | Kvalitet min | Zahtevni dani | Deload | Taper |
|---:|---:|---:|---:|---|---|---|
| 1 | 53.2 | 15.2 | 28.33 | 2,5 | ne | ne |
| 2 | 57.9 | 16 | 43.73 | 2,5 | ne | ne |
| 3 | 57 | 16.9 | 28.33 | 2,5 | ne | ne |
| 4 | 38.9 | 11.5 | 4.33 | 2 | da | ne |
| 5 | 56.8 | 17.9 | 30.2 | 2,5 | ne | ne |
| 6 | 61.8 | 18.8 | 46.87 | 2,5 | ne | ne |
| 7 | 67.2 | 19.9 | 65.1 | 2,5 | ne | ne |
| 8 | 44.8 | 13.6 | 5.2 | 2 | da | ne |
| 9 | 66.5 | 21 | 47.35 | 2,5 | ne | ne |
| 10 | 70.2 | 22.1 | 57 | 2,5 | ne | ne |
| 11 | 75 | 23.5 | 72.33 | 2,5 | ne | ne |
| 12 | 50.4 | 15.6 | 5.2 | 2 | da | ne |
| 13 | 73.7 | 22.8 | 71.3 | 2,5 | ne | ne |
| 14 | 80.2 | 28.2 | 80.17 | 2,5 | ne | ne |
| 15 | 65.4 | 22 | 55.92 | 2,7 | ne | ne |
| 16 | 50.4 | 15.6 | 5.2 | 2 | da | ne |
| 17 | 71.2 | 26.8 | 77.13 | 2,5 | ne | ne |
| 18 | 64.2 | 20.7 | 57 | 2,5 | ne | da |
| 19 | 52.1 | 17.1 | 53.5 | 2,5 | ne | da |
| 20 | 52.7 | 4.5 | 6.32 | 5 | ne | ne |

### U10 B

| N | km | Najduža trening sesija km | Kvalitet min | Zahtevni dani | Deload | Taper |
|---:|---:|---:|---:|---|---|---|
| 1 | 63 | 24 | 23.67 | 2,5 | ne | ne |
| 2 | 66.4 | 25.5 | 26.73 | 2,5 | ne | ne |
| 3 | 66.1 | 22.9 | 29.33 | 2,5 | ne | ne |
| 4 | 51.6 | 17.6 | 0 | — | da | ne |
| 5 | 71.9 | 26 | 34.47 | 2,5 | ne | ne |
| 6 | 69.9 | 23.4 | 37.53 | 2,5 | ne | ne |
| 7 | 76 | 27.1 | 40.1 | 2,5 | ne | ne |
| 8 | 59.4 | 18.8 | 13.5 | 2 | da | ne |
| 9 | 71.2 | 24.3 | 32.4 | 2,5 | ne | ne |
| 10 | 77.5 | 28 | 39.07 | 2,5 | ne | ne |
| 11 | 79.8 | 29.3 | 40.1 | 2,5 | ne | ne |
| 12 | 62.4 | 19.9 | 13.5 | 2 | da | ne |
| 13 | 79.8 | 29.3 | 40.1 | 2,5 | ne | ne |
| 14 | 80.1 | 29.3 | 39.07 | 2,5 | ne | ne |
| 15 | 74.3 | 26.3 | 58.97 | 2,7 | ne | ne |
| 16 | 57.9 | 18.5 | 0 | — | da | ne |
| 17 | 79.8 | 29.3 | 40.1 | 2,5 | ne | ne |
| 18 | 64.1 | 21.8 | 39.07 | 2,5 | ne | da |
| 19 | 52 | 18.2 | 36.6 | 2,5 | ne | da |
| 20 | 52.7 | 4.5 | 6.32 | 5 | ne | ne |

## Primarni izvori i njihova ograničenja

Pristup svim izvorima: 2026-10-11. Konsultovani su originalni planovi i originalni radovi/sažeci, bez blogovskih prepričavanja. BAA, Higdon i Runna su trenerski modeli za poređenje, a ne dokaz da svi sportisti moraju pratiti njihove brojke.

1. **B.A.A., Boston Marathon Training.** https://www.baa.org/races/boston-marathon/info-for-athletes/boston-marathon-training/ — Level One je prosečno četiri dana, početni i vršni obim oko40/64 km, LR oko26–29 km; Level Two prosečno pet dana i LR oko29–32 km. Postoje odvojene faze baze, specifičnosti i dvonedeljnog tapera. Ovo direktno osporava univerzalnu tvrdnju da su za maraton neophodna najmanje pet dana ili najmanje32 km. Podržava poređenje U09 sa ozbiljnijim ponovljenim dugim stimulusom. Ne propisujem njegovu napredniju kvalitetnu strukturu svakom početniku.

2. **Hal Higdon, Novice1 Marathon.** https://www.halhigdon.com/training-programs/marathon-training/novice-1-marathon/ —18 nedelja, četiri dana trčanja, postepene dužine i korak unazad svake treće nedelje, vršna dužina20 milja i tri nedelje tapera. U sredini nedelje postoji duža laka sesija; prva maratonska priprema nije obavezno puna intervala. Model pokazuje da četiri dana mogu biti legitimna i da je dužina centralna. Njegovih32.2 km nije univerzalni minimum niti dozvola da trkač male baze skoči naglo na tu dužinu.

3. **Runna, Understanding the Long Runs in Your Runna Plan.** https://support.runna.com/en/articles/9357249-understanding-the-long-runs-in-your-runna-plan —Dužina zavisi od iskustva, broja dana, ciljne distance i trajanja ciklusa; više vremena može omogućiti ponovljena duža izlaganja. Podržava ocenjivanje ponavljanja, postepenog razvoja i rasterećenja. Runna navodi maratonske sesije preko32 km kao svoj tipični model; ne pretvaram to u obaveznu granicu za sve.

4. **Fokkema et al. (2020), Training for a (half-)marathon: Training volume and longest endurance run related to performance and running injuries.** DOI10.1111/sms.13725. https://pubmed.ncbi.nlm.nih.gov/32421886/ ; originalni otvoreni rad https://pmc.ncbi.nlm.nih.gov/articles/PMC7496388/ —Upitnici556 HM i441 maratonskih trkača: manji maratonski obim (<40 km/ned) i najduži LR<25 km bili su povezani sa sporijim finišem, veći obim (>65 km/ned) sa bržim. Opservaciono istraživanje ne dokazuje univerzalni prag, uzročnost ili individualnu spremnost; nije pronađena veza tih mera sa povredama. U09 i razliku ponovljenog trajanja U10 tumačim kao trenersku procenu, a ne direktno dokazanu kauzalnu prognozu. Direktni open PMC dao je proveru pregledača; rezultat originalnog rada i PubMed primarni sažetak bili su dostupni pretragom.

5. **Bosquet et al. (2007), Effects of tapering on performance: a meta-analysis.** DOI10.1249/mss.0b013e31806010e0. https://pubmed.ncbi.nlm.nih.gov/17762369/ —Analiza27 studija na takmičarima podržava približno dvonedeljni taper, redukciju volumena uz održan intenzitet i uglavnom frekvenciju; najveći grupni efekat bio je sa41–60% smanjenja. Intenzitet i količina brzog rada nisu ista stvar. Ne zahtevam da svaka taper nedelja ili svaki rekreativac tačno zadovolji taj procenat; pregledam ukupni pad, LR, dozu i uklonjen zamor. Ovo nije studija koja propisuje deload svake četvrte nedelje. Direktni open PubMed dao je prazan prikaz; originalni sažetak je dostupan kroz primarnu pretragu.

## Status zamrzavanja

Posle prijave operativnog izlaganja, roditeljski agent je odlučio da pribavi čist zamenski maratonski pregled. Ova dva fajla zadržavaju se kao dopunski pregled i ne ulaze među četiri primarna nezavisna recenzenta. Ocene ostaju nepromenjene od prvog upisa u 20:23:11 UTC.

Ovo su inicijalne nezavisne ocene pre otkrivanja A/B identiteta i pre pregleda događaja. JSON sadrži tačno20 zapisa i324 pregledane nedelje. Kritične stavke su U09 A iU09 B: nedovoljna maratonska priprema; kod B dodatno pogrešno snažna finish poruka. Budući događaji mogu dobiti zasebne nalaze, ali ne menjaju ove zamrznute početne ocene.

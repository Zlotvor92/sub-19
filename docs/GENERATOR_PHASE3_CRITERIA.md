# SUB-20 — nezavisni kriterijumi faze 3

Definisano 11.10.2026, pre pregleda novih izlaza. Predmet: stvarno izvršenje, predlozi prilagođavanja i verzije plana. Ovo je agentski inženjerski/trenerski pregled prema javnim izvornim smernicama; nije odobrenje ljudskog trenera, dijagnoza ili potvrda bezbednog povratka posle povrede.

## Principi iz izvora i granice proizvoda

Runna razlikuje odluku da se trening preskoči od premeštanja treninga koji se još namerava odraditi [S1]. Jedan izostanak ne zahteva automatsku promenu svih narednih treninga. Njihov Plan Realignment nudi izbor nastavka, obnove unutar istog krajnjeg datuma ili produženja kada datum nije fiksan [S2]. Posle duže pauze upozorava da je kalendar napredovao dok stvarna priprema nije. SUB-20 zato treba da pokaže razliku između planiranog i odrađenog rada, bez samostalnog upisa promene.

Runna za smanjenje treninga nudi različite nivoe lakšeg rada i odvojenu brzinu povratka [S3]. To podržava odvajanje obima, kvaliteta i forme. Njihove granice trajanja pojedinih funkcija nisu univerzalni pragovi fiziološkog oporavka i ne kopiraju se kao takvi.

Hal Higdon u sopstvenom odgovoru na propuštenu nedelju odbacuje naknadno sabijanje kilometara [S4]. U odgovoru o bolesti pred taper izričito ne premešta propušteni rad u taper [S5]. Njegov pojedinačni primer zamene maratonskih dužina manjim koracima [S6] pokazuje prilagođavanje trenutnoj osnovi; konkretne milje tog primera nisu recept za sve korisnike.

Naša dodatna pravila očuvanja podataka, verzionisanja, svežine merenja i razlikovanja nepoznatih unosa jesu kriterijumi proizvoda. Izvori ne objavljuju validiran model SUB-20 rizika ili prognoze rezultata. Svaki izabrani broj za prozor podataka, minimalan broj pouzdanih nedelja, smanjenje posle pauze ili granicu RPE mora imati vidljivo objašnjenje heuristike i test, bez predstavljanja kao medicinska činjenica.

## Ugovor podataka

- Prošli trening bez statusa je **nepoznat**, a ne nula odrađenih km i nije potvrđeno propušten. Budući trening bez statusa nije izostanak.
- `done` bez stvarnih km potvrđuje status, ali ne daje dokaz planirane kilometraže. Ostvareni km se ne popunjavaju vrednošću iz plana. Neispravan broj ne ulazi u osnovu.
- Potvrđeno preskočen trening ima nula ostvarenog rada. Nepoznata nedelja ostaje nepotpuna, čak i ako postoje dva dobro evidentirana treninga. Prikaz mora odvojiti pokrivenost podataka od izvršenja.
- Datum stvarnog trčanja i efektivni datum posle premeštanja imaju prednost nad originalnim slotom. Jedan ID treninga se broji jednom. Budući ili neispravni datumi ne dokazuju sadašnju formu/osnovu.
- Skoriji obim i ponovljiva dužina dolaze iz stvarnih, vremenski usklađenih km. Jedan ekstremni LR ili zbir delimične nedelje ne postaju automatski ponovljiva osnova.
- Merenja tempa treninga nisu po definiciji trkački rezultat. Kratki R rad sa punim odmorom ima ograničen dokazni značaj. Brži cilj, jedan brz trening ili vrlo stari lanac nisu dovoljan razlog ubrzanja.
- Bol, visok napor i nedavna pauza mogu ograničiti pozitivan predlog; odsustvo unosa bola nije potvrda odsustva bola. Aplikacija ne dijagnostikuje niti daje odobrenje za povratak.

## Dvanaest nezavisnih simulacionih profila

Polazni sintetički plan je 5K/HM/maraton od 16–20 nedelja, 4–5 dana trčanja i dovoljno preostalog vremena, osim navedenog izuzetka. `today` je fiksan datum. Konkretnu implementacionu reprezentaciju unosa odrediti u probe fajlu; očekivanja u tabeli ne smeju se naknadno izvesti iz samog izlaza.

| ID                              | Sintetički događaji                                                                                                         | Očekivan ishod pre implementacije                                                                                                                                                                                                                                                         |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P01 — uredno izvršenje          | Četiri kompletno evidentirane skorije nedelje, stvarni km blizu plana, bez pauze, napor kontrolisan                         | Dokazna osnova je dovoljna; nema predloga promene samo zato što su podaci prisutni. Preview ne menja stanje.                                                                                                                                                                              |
| P02 — jedan izostanak           | Jedan potvrđeno preskočen laki trening, ostali odrađeni                                                                     | Prikazuje izostanak; nema dodavanja tih km LR-u ili narednoj nedelji i nema automatske kazne u tempu.                                                                                                                                                                                     |
| P03 — prazna istorija           | Prošli dani bez statusa, uključujući dve potpuno prazne nedelje                                                             | Ishod nedovoljni/nepoznati podaci. Ne proglašavati dvonedeljnu pauzu i ne računati planirane km kao odrađene.                                                                                                                                                                             |
| P04 — slabije izvršenje         | Dve kompletne nedelje sa stvarnim km značajno manjim od plana, statusi jasni                                                | Predlog smanjenja je moguć; osnova koristi evidentiran obim/dužinu. Planirani vrh ne opravdava trenutnu bazu.                                                                                                                                                                             |
| P05 — pauza 7 dana              | Potvrđena pauza, pre nje nekoliko pouzdanih nedelja; nema prijavljenog bola                                                 | Obrazložen, blag ili konzervativan povratak prema dokazima; nema nadoknađivanja. Nijedan dan nije sam promenjen.                                                                                                                                                                          |
| P06 — pauza 14 dana             | Potvrđena dvonedeljna pauza, pouzdan pređašnji obim/LR                                                                      | Konzervativniji početak nego isti profil P05; više uzastopnih budućih nedelja prati novu osnovu, a ne samo prva. Nema skoka na staru krivu druge nedelje.                                                                                                                                 |
| P07 — pauza 28 dana             | Potvrđena četvoronedeljna pauza i stari PB                                                                                  | Jasno ograničenje pouzdanosti forme/pripreme. Novi unos baze ili nova priprema mogu biti potrebni; ne vraćati korisnika direktno na sadašnju kalendarsku nedelju.                                                                                                                         |
| P08 — nedovoljno vremena        | Kao P06, ali do trke manje od četiri nedelje/taper                                                                          | Pun povratnički rebuild se odbija ili ograničava uz razlog. Nema sabijanja propuštenog rada niti kraćeg tapera da bi dostigao stari cilj.                                                                                                                                                 |
| P09 — nepouzdana forma          | Više vrlo starih merenja, datum u budućnosti, sam `done` bez km, jedan izolovan brzi trening                                | Svaki slab dokaz dobija razlog isključenja/ograničenja. Ne predlagati ubrzanje iz broja svih zapisa u životnom lancu.                                                                                                                                                                     |
| P10 — napor/bol                 | Najmanje tri sveža brža merenja, ali ponavljan visok RPE ili skorašnji zapis bola                                           | Pozitivan predlog tempa/obima je zaustavljen ili jasno ograničen. Nema automatskog nastavka/bržeg treninga kao odobrenja povratka.                                                                                                                                                        |
| P11 — istorija i ručne promene  | Rebuild sredom; ponedeljak odrađen, utorak prošao, petak već `done`, budući trening pomeren, ručni pace/km/session override | Prošli i već odrađeni dani, ID-jevi, njihove sesije, predikcioni redovi i QS ostaju. Efektivni pomereni datum se poštuje. Ručne izmene se ne prepisuju tiho. Plan i stanje ulaza nisu mutirani.                                                                                           |
| P12 — primena, replay, povratak | Preview → apply → persist/reload → restore; zatim novi log posle apply ili promena stanja pre apply                         | Preview je čist; jedan apply daje jednu verziju; ponovljen/stari preview ne primenjuje se ponovo. Restore radi samo kada neće obrisati kasniju istoriju. Dnevnik/VDOT/bol/ručne izmene se ne vraćaju na zastarelo stanje. Broj sačuvanih verzija je ograničen i stare strukture čitljive. |

## Obavezne provere konačnog predloga

1. Za svaki profil zabeležiti pokrivenost, ostvaren obim, ponovljivu dužinu, pauzu, prihvaćene/isključene dokaze i razlog odluke. Sačuvati identične ulaze i izlaze i SHA256 digest pregledanih izlaza/koda.
2. Pregledati sve buduće nedelje povratka: ukupne km, najduži LR, stvarne radne minute i zahtevne dane, deload/taper i granice rasta. Urađen LR sa brzim završetkom broji se u zahtevno opterećenje. Preview mora pokazati stvarnu pre/posle dozu, ne samo naslov promene.
3. Konačna `day.km`, `sessKm(session)`, opis, tempo i radne deonice ne protivreče jedni drugima. Predikcioni/QS redovi moraju odgovarati konačnim sesijama. Skala samo na spoljašnjim km, bez promene sesije, ne prolazi.
4. Nijedna promena ne dodaje propušteni trening na zauzet dan, ne povećava broj dostupnih dana ili premešta ciljnu trku bez korisnikovog izbora. Nije dozvoljeno vraćanje proizvoljnog automatskog napretka VDOT-a.
5. Svaka javna radnja promene cilja, rekalibracije ili povratka proverava isto očuvanje istorije. Tvrdnja UI-ja „odrađeno ostaje netaknuto” mora biti pokrivena testom tekuće nedelje i budućeg dana označenog kao odrađenog.
6. Primena proverava da izvorno stanje i relevantna istorija nisu promenjeni od preview-a. Verzija je kompletna dovoljna osnova za proverljiv povratak plana; nije restore cele aplikacije koji prepisuje nov dnevnik.

## Početni rizici zatečenog koda faze 2

Ovo su nalazi pre novih izmena; završni status se vodi zasebno u pregledu.

- `reentryPlan` smanjuje `day.km`, a ostavlja session/desc/pred, i menjanje obima važi samo za prvu nedelju. Sledeća može skočiti na originalnu krivu.
- `planWithNewGoal` i `planRecalibrated` čuvaju samo nedelje pre tekuće, pa mogu regenerisati odrađen/prošli dan tekuće nedelje ili budući `done` dan. Potpisi ne dobijaju dnevnik ni pomerene datume.
- Predlog i preview rekalibracije gledaju ceo lanac merenja bez jasne svežine, budućih datuma i stvarnog izvršenja. Broj zapisa nije dokaz kvaliteta dokaza.
- Tekst rekalibracije navodi da nema vraćanja. Potrebna je proverljiva ograničena verzija, sa zaštitom novih zapisa.

## Primarni izvori

Pregledani 11.10.2026. Higdon tekstovi su njegovi originalni odgovori, objavljeni na platformi njegovog partnera TrainingPeaks. Koriste se za principe odlučivanja, ne za prepisivanje pojedinačnog saveta ili medicinsku preporuku.

- S1: [Runna — How and When to Skip a Run](https://support.runna.com/en/articles/15012850-how-and-when-to-skip-a-run-managing-missed-sessions-in-your-training-plan)
- S2: [Runna — Plan Realignment](https://support.runna.com/en/articles/10026375-how-to-use-the-plan-realignment-feature)
- S3: [Runna — Not Feeling 100%](https://support.runna.com/en/articles/13531498-how-to-use-not-feeling-100)
- S4: [Hal Higdon — Adjusting a Training Schedule Due to Injury](https://www.trainingpeaks.com/blog/adjusting-a-training-schedule-due-to-injury/)
- S5: [Hal Higdon — Sickness and Lost Workouts](https://www.trainingpeaks.com/blog/sickness-and-lost-workouts/)
- S6: [Hal Higdon — Adjusting Your Marathon Training Due to Injury](https://www.trainingpeaks.com/blog/adjusting-your-marathon-training-due-to-injury/)

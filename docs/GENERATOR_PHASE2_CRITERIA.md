# SUB-20: kriterijumi za fazu 2

Datum provere izvora: 11.10.2026. Predmet: struktura planova i podaci koji je opravdavaju. Ovo je inženjerska analiza javnih trenerskih programa, a ne profesionalno odobrenje planova niti obećanje rezultata.

## Kako koristiti kriterijume

Ulazi u tabeli su osam postojećih scenarija iz `docs/qa/generator-phase1/inputs.json`. Datumi počinju 12.10.2026; priprema traje 12, 16, 14 ili 20 kalendarskih nedelja, uključujući trkačku nedelju. „Prvi HM” i „iskusan” su ovde QA uloge, ne činjenice koje se mogu zaključiti iz sadašnjih ulaza. Generator mora pitati za iskustvo, kontinuitet i ponovljivu dužinu ili izričito zadržati tu neizvesnost.

Javni planovi služe za poređenje svrhe i rasporeda rada. Ne kopiramo njihove kalendare i ne pretvaramo tuđe nedeljne kilometraže u univerzalne medicinske granice. Provere u nastavku su naš predlog kriterijuma proizvoda, izveden iz poređenja. Broj ispod ne sme biti ostvarivan prekoračenjem korisnikove baze, dostupnosti, limita trajanja ili oporavka.

## Osam reprezentativnih profila

| Profil i originalni scenario | Ulaz | Očekivana struktura | Jasna provera pre prihvatanja |
| --- | --- | --- | --- |
| Početnik 5K — `01_base` | 8 km, 3 dana, PB 35:00, cilj 30:00, bez nedavnog treninga; 12 nedelja | Najpre kontinuitet i lako trčanje/hodanje po naporu. Kvalitet je dozvoljeni maksimum, ne obavezna doza od prve nedelje. | Početna ukupna kilometraža prati prijavljenu bazu; nema obaveznog brzog R/I rada čim se unese PB. Ako nedostaje iskustvo, status to kaže. Trkačka nedelja je smanjena. [S1, S2] |
| Povratnik 10K — `02_base` | 15 km, 3 dana, PB 5K 27:00, cilj 60:00, bez nedavnog treninga; 16 nedelja | Postepena obnova baze i dužine; po potrebi run/walk. Jedan kontrolisan stimulans tek kada istorija i budžet to opravdavaju. | Datum starog PB i pauza ne smeju biti ignorisani. `trainedRecently=false` menja početno opterećenje ili daje jasno ograničenje procene. Nema dva tvrda dana zato što duži plan „ima mesta”. [S1, S3] |
| 5K sub-20 — `04_base` | 30 km, 4 dana, PB 23:45, cilj 19:59, 2 kvaliteta, nedavno trenira; 16 nedelja | Aerobni rad, prag/kontrolisani tempo i 5K-specifičan stimulans; dužina ostaje laka osim obrazloženih izuzetaka. | U glavnom bloku postoji smislen T i I/5K rad ili razlog njihovog ograničenja. `goalSec=1199` samo po sebi ne ubrzava rad na ritam željenog rezultata. Duži plan nije automatska prognoza sub-20. [S4, S5] |
| 5K sub-19 — `05_base` | 50 km, 5 dana, PB 20:35, cilj 18:59, 2 kvaliteta, nedavno trenira; 16 nedelja | Za potvrđeno iskustvo sa kvalitetom, kratko uvođenje pa razvoj praga i 5K rada; kratke deonice održavaju ekonomiju, ne blokiraju sve ostalo. | Upariti isti ulaz sa različitim iskustvom i ponovljivom dužinom. Iskusan profil ne sme dobiti isti obavezni dug blok isključivo 300 m kao početnik. Promena iskustva utiče na izbor/dozu, ne izmišlja brži PB. [S4, S6] |
| Prvi HM — `07_base` | 30 km, 4 dana, PB 5K 23:45, cilj 1:45, 2 kvaliteta; 16 nedelja | Prioritet je progresija podnošljive dužine; broj tvrdih dana može biti manji od traženog. Završetak HM i vreme 1:45 su odvojena pitanja. | Dugotrajni plato LR oko 14 km mora imati razlog ili status ograničenja pripreme; bez tih podataka nema potvrde spremnosti. Povećanje LR nije uslov koji nadjačava stvarnu bazu. [S7, S8] |
| Brži HM — `08_highvol` | 55 km, 5 dana, PB 5K 20:35, cilj 1:35, 2 kvaliteta; 14 nedelja | Prag/HM stimulans, dovoljno lakih km i dužina prilagođena kontinuitetu. Strukturisana dužina računa se u zahtevno opterećenje. | Kada brzi LR zameni q2, q1 se ponovo računa iz preostalog budžeta; ne ostaje slučajno stara frakcija niti dobija ceo budžet uz dodatni LR rad. Konačni T+HM/MP zbir je izričit i proverljiv. [S8, S5] |
| Maraton, manja baza — `09_30km` | 30 km, 4 dana, PB HM 1:45, cilj 4:00, 2 kvaliteta; 20 nedelja | Izdržljivost i postepeno podnošljiv LR imaju prednost nad brzim radom. Ako raspoloživ obim ograniči pripremu, to je vidljiv ishod. | Plan čiji je najduži LR 16 km ne označiti kao dokaz maratonske spremnosti. Prijaviti konačno dostignutu dužinu/trajanje, razlog ograničenja i izbor lakšeg cilja/duže pripreme, bez automatskog nametanja viših km. [S9, S10] |
| Maraton, veća baza — `09_base` | 50 km, 5 dana, PB HM 1:45, cilj 4:00, 2 kvaliteta; 20 nedelja | LR progresija sa lakšim nedeljama, srednje dugo lako trčanje i opravdan M/HM rad. Veća brzinska sposobnost ne zamenjuje izdržljivost. | Više baze/potvrđene dužine daje smislen drugačiji LR razvoj od `09_30km`, u granicama trajanja. MLR ulazi u zbir, taper obim pada, a dužina/tempo/gorivo odgovaraju stvarno isporučenoj sesiji. [S10, S11] |

## Šta primarni izvori konkretno pokazuju

- **S1 — Runna izbor planova:** razlikuje nove/povratničke planove od trkačkih; novi i povratnički koriste napor bez ciljanih tempa. Navodi preporučene minimalne dužine pripreme, među njima 8 nedelja za početak, 6 za povratak i 16 za standardni maraton. To nije dokaz da je bilo koja osoba spremna posle tog broja nedelja.
- **S2 — Higdon Novice 5K:** osam nedelja, tri trčanja, lagan razgovorni napor i mogućnost hodanja. Ne zahteva tempo ili intervale da bi početni plan bio „potpun”.
- **S3 — Higdon Novice 10K:** osam nedelja, tri trčanja i dodatni cross-training. Najduže trčanje raste do 5,5 milja (oko 8,9 km); lagan napor i pauze hodanjem su dopušteni.
- **S4 — BAA 5K:** Level Two počinje jednominutnim 5K i trominutnim 10K deonicama, dok Level Three već u prvoj nedelji koristi trominutni 5K i četvorominutni 10K rad. Oba imaju pripremnu, glavnu i taper fazu. Ovo je kontraprimer obaveznoj istoj kratkoj ekonomija-fazi za svakoga, ne zahtev da SUB-20 kopira broj njihovih kvalitetnih dana.
- **S5 — Runna odvojene preference:** obim i težina se menjaju nezavisno. Težina može menjati broj/strukturu zahtevnih sesija i rad u dužinama; te preference ne menjaju ciljane tempe zasnovane na proceni rezultata.
- **S6 — Runna sposobnost:** iskustvo i podnošljiva dužina pojedinačnog trčanja utiču na obim i dužinu treninga. „Advanced” podrazumeva i strukturisani trening; nedeljna kilometraža sama nije zamena za taj podatak.
- **S7 — Higdon Novice 1 HM:** 12 nedelja, do četiri trčanja, lako trčanje sa razvojem dužine do oko 16,1 km. Polazna sposobnost je redovno trčanje oko 4,8 km tri do četiri puta nedeljno.
- **S8 — BAA HM:** Level One cilja prvi HM; Level Two prethodne učesnike koji žele brže. Drugi koristi duže HM-tempo intervale i trkačke simulacije. Prvi takođe ima kratka ubrzanja; „početnik” ne znači da se svako kratko ubrzanje zabranjuje. Razlikuju se baza, doza i kontekst.
- **S9 — Higdon Novice 1 maraton:** 18 nedelja, četiri dana trčanja, LR od oko 9,7 do 32,2 km i rasterećenje svake treće nedelje. Najduži LR nije univerzalni uslov za svaku metodologiju; pokazuje koliko je 16 km udaljeno od ovog završnog plana.
- **S10 — BAA maraton:** Level One prosečno četiri dana, oko 40→64 km/nedelji, LR oko 26–29 km; Level Two pet dana, oko 48→72 km, LR oko 29–32 km. Program ima pripremu, izgradnju, specifičnu pripremu i taper. To su njihove ciljne strukture, ne preporuka da korisnik sa 30 km odmah pređe na 40 km.
- **S11 — Higdon Intermediate 1 maraton:** pet dana trčanja, LR od oko 12,9 do 32,2 km, dva najduža treninga i srednje dužine. Program koristi M tempo bez obaveznog brzinskog rada; brži završeci su rezervisani za iskusnije i nisu svake nedelje. Dva kvalitetna dana nisu univerzalni zahtev maratonskog plana.

## Deonice: odluka po svrsi, ne dekorativna raznovrsnost

**300 m nisu sami po sebi greška.** Runna dokumentacija čak koristi 300 m u primeru seta [S12]. Dužina bez tempa, trajanja rada, oporavka, ukupne doze, iskustva i faze ne govori da li je trening dobar. Na istih 300 m mogu se ciljati različiti stimulansi. Kraći rad takođe ima smisla u taperu.

**Piramida nije obavezni novi tip koji mora postojati u svakom planu.** Različite deonice imaju smisla ako ponavljaju jasan stimulans i staju u isti budžet. U ovoj proveri tražimo: naziv svrhe, stvarno vreme rada, oporavak, zbir i napredovanje kroz blok. Dodavanje „200–400–600–400–200” samo radi raznovrsnosti ne rešava pogrešnu dozu niti pogrešan izbor tempa. Runna razdvaja interval kao strukturu od praga kao intenziteta/svrhe [S13].

Test za problem korisnika: izdvojiti sve prve kvalitetne sesije osam profila; zatim uporediti potvrđeno iskusnog i povratničkog 5K trkača sa istim trenutnim PB. Ako sve počinje istim višenedeljnim blokom R300, bez obrazloženja i nezavisno od kontinuiteta/iskustva, pravilo je kruto. Ako se kratke deonice smenjuju sa pragom i kasnijim specifičnim radom u razumnim dozama, samo prisustvo 300 m nije nalaz greške.

## Podaci i regresione provere

Predloženi podaci: datum rezultata, skoriji tipični obim, kontinuitet/pauza, iskustvo sa kvalitetom i ponovljiva najduža lagana sesija. Opciono trajanje/dužina plafona. Nedostatak podatka mora imati konzervativan fallback i vidljiv status; ne zaključujemo iskustvo samo iz brzine.

Regresije treba da porede konačne planove: tačnu kilometražu, radne minute po intenzitetu, broj tvrdih dana uključujući strukturisani LR, oporavak, LR razvoj po opterećenim i lakšim nedeljama, taper i objašnjenje ograničenja. Proveriti da veće iskustvo menja strukturu, da niža baza ne daje isti maratonski zaključak, i da proizvoljan željeni rezultat ne menja paces iz trenutne forme. Preko delimične prve/trkačke nedelje ne računati prividan zastoj ili skok.

Runna rasterećuje rad zahtevnih treninga više od lakih; dužinu rasterećuje prema njenoj veličini i sposobnosti [S14]. Naš test zato proverava stvarno smanjenje doze, a ne samo oznaku „deload”. Svaki numerički prag koji SUB-20 uvede u readiness status mora biti označen kao transparentna heuristika proizvoda. Ovi izvori ne daju validiran prediktor rezultata ili rizika za naš generator.

## Izvori

Svi izvori pregledani 11.10.2026. Samo originalni autori/zvanični izdavači; nijedan kompletan raspored nije prepisan.

1. S1: [Runna — How to Create a Training Plan](https://support.runna.com/en/articles/15443877-how-to-create-a-training-plan-in-runna)
2. S2: [Hal Higdon — Novice 5K](https://www.halhigdon.com/training-programs/5k-training/novice-5k/)
3. S3: [Hal Higdon — Novice 10K](https://www.halhigdon.com/training-programs/10k-training/novice-10k/)
4. S4: [BAA — Boston 5K Training](https://www.baa.org/races/boston-5k/info-for-athletes/boston-5k-training/)
5. S5: [Runna — Training Preferences](https://support.runna.com/en/articles/10393191-how-to-use-training-preferences)
6. S6: [Runna — Adjusting Running Ability](https://support.runna.com/en/articles/6205993-adjusting-your-running-ability)
7. S7: [Hal Higdon — Novice 1 HM](https://www.halhigdon.com/training-programs/half-marathon-training/novice-1-half-marathon/)
8. S8: [BAA — Boston Half Training](https://www.baa.org/races/boston-half/info-for-athletes/boston-half-training/)
9. S9: [Hal Higdon — Novice 1 Marathon](https://www.halhigdon.com/training-programs/marathon-training/novice-1-marathon/)
10. S10: [BAA — Boston Marathon Training](https://www.baa.org/races/boston-marathon/info-for-athletes/boston-marathon-training/)
11. S11: [Hal Higdon — Intermediate 1 Marathon](https://www.halhigdon.com/training-programs/marathon-training/intermediate-1-marathon/)
12. S12: [Runna — Understand Your Workouts](https://support.runna.com/en/articles/15690947-understand-your-runna-workouts)
13. S13: [Runna — Threshold, Intervals and Tempo](https://support.runna.com/en/articles/8608203-is-my-workout-a-threshold-interval-session-or-tempo-run)
14. S14: [Runna — Recovery in Your Plan](https://support.runna.com/en/articles/15272605-how-does-runna-build-recovery-into-your-training-plan)

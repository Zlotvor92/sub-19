# Nezavisna 5K trenerska revizija — zamrznute A/B ocene

Datum pregleda i pristupa izvorima: **2026-10-11**. Predmet: 10 sintetičkih profila, 20 početnih planova; primarna stručna perspektiva 5 km, uz proveru 10 km, polumaratona i maratona.

Pročitani su isključivo `blind/U01.json` do `blind/U10.json` i javni primarni izvori. Pregled obuhvata sve 324 nedelje, svih sedam dana svake nedelje, opise i strukturirane sesije, zagrevanje/hlađenje, rad/pauze, ubrzanja, run/walk, dužine, rasterećenje, taper, trku i presentation upozorenja. Zbirovi planiranih dnevnih kilometara slažu se sa nedeljnim obimom unutar 0.1 km. Nisu čitani sirovi planovi, manifest, generator, probe, korisničke datoteke, druge trenerske ocene ni ranije faze. Nisu pregledane naknadne promene nakon događaja. Identitet A/B nije otkriven. Stil i struktura dopuštaju nagađanje, pa ovo ne predstavlja dokaz savršene slepoće; identitet nije korišćen u ocenjivanju.

`5k-scores.json` sadrži 20 zamrznutih ocena. `5k-audit.mjs` reprodukuje čitanje svih dana iz dozvoljenih datoteka: `node docs/qa/generator-ab/coaches/5k-audit.mjs` ili uz ID-eve kao argumente. Kod progresivnog treninga brzi deo je poslednja trećina, a ne cela vrednost session.qKm. Brzi završeci LR računaju se kao kvalitet iako nemaju zaseban session objekat. Broj treninga i prolazak automatskih provera nisu dokaz odgovarajućeg treninga.

## Metod i granice ocena

Svaki kriterijum je 0–10; ukupno je zbir kriterijuma pomnoženih težinama i sa 10. Težine: prilagođenost profilu 20%, kvalitet 20%, progresija 15%, oporavak 15%, specifičnost distance 10%, rasterećenje/taper 10%, koherentnost 10%. Koherentnost uključuje pošteno tumačenje rezultata i usklađenost tekstualnog cilja sa ritmom. Oporavak obuhvata raspored, pauze i ukupnu izloženost; mnogo odmora samo po sebi ne znači dobro razvijenu pripremu.

Ocene su trenerski sud o isporučenom planu, ne izračunata verovatnoća ostvarenja cilja ili povrede. Razlike ispod približno 3 poena slabo razlikuju strane. Confidence je subjektivna sigurnost pregleda dokumenta, ne statistički interval. Nedostaju stvarni dnevnik, tolerancija napora, zdravlje, teren, godine, raspoloživost vremena i reakcija na prethodne kvalitetne sesije. Upozorenje o ograničenju poboljšava koherentnost, ali ne zamenjuje pripremu. Kritična primedba je rezervisana za ozbiljan raskorak zadatka i isporučene distance; manje doze kvaliteta nisu proglašene opasnim ili beskorisnim.

## Sažetak svih 20 planova

| Profil | A /100 | Sud A | B /100 | Sud B |
|---|---:|---|---:|---|
| U01 početnik 5K | 77.25 | Oprezan povratak, jasan limit; slaba potvrda distance | 70.50 | Bolja dužina, veći rast i neosnovana prognoza |
| U02 5K sub-20 | 74.00 | Razuman opšti ciklus, neujednačen rad i loš prikaz cilja | 74.75 | Bolji uvod/iskrenost; skromna kasna specifična doza |
| U03 iskusan 5K | 74.50 | Dobar oporavak; previše skroman kvalitet za profil | 76.25 | Jači smislen kvalitet; neutemeljena precizna prognoza |
| U04 prvi 10K ciklus | 71.50 | Brz uvod u kvalitet, korisniji kasni RP | 76.25 | Postupniji uvod; dve male T sesije i duge RP pauze |
| U05 iskusan 10K | 76.50 | Jak aerobni obim, manja doza i slabija gustina RP | 78.50 | Dobro razvijen kvalitet; prognoza i prikaz cilja problematični |
| U06 povratnik 10K | 60.50 | Pauza nije dovoljno uvažena; veći početni LR | 77.00 | Dobar povratak i upozorenja; samo 6.7 km najvećeg LR |
| U07 prvi HM | 79.75 | Bolja progresija dužine, iskren tempo; mali RP blokovi | 72.50 | Koristan kvalitet, slabija dužinska progresija i prognoza |
| U08 iskusan HM | 76.75 | Dobar ciklus; zamor posle simulacije i taper | 80.50 | Dobar obim i pošten prikaz; slabi rani T blokovi |
| U09 prvi maraton | 62.50 | Odbaciti kao punu pripremu; priznaje ozbiljno ograničenje | 52.00 | Odbaciti; izrazito kratke dužine i tvrdnja o istrčavanju |
| U10 iskusan maraton | 68.25 | Gubi bazu dužine i kasno je naglo vraća | 78.50 | Bolje čuva bazu; skroman RP rad i duga poslednja dužina |

A nije automatski bolji ni B lošiji: B daje jači i često prikladan kvalitet kod iskusnih U03/U05, dok A ima prednost u početničkom U01 i prvom HM U07. U02 je praktično izjednačen: bolja transparentnost i uvod na B strani nasuprot nešto većoj kasnoj dozi na A. Ukupni prosek nije dovoljan da se preskoči ozbiljan problem prvog maratona na obe strane.

## Detaljni 5K slučajevi

### U01 — 8 km/ned, 3 km dužina, bez kontinuiteta i iskustva kvaliteta

Obe strane smisleno biraju tri run/walk dana u W1–W4, lake nedelje W5–W6 i tek zatim kvalitet. Ovo je prikladnije osnovi od direktnog planiranja ciljnog 6:00/km. Run/walk je legitimna metodologija početničke pripreme [S3, S8]; ne treba ga kažnjavati zbog hodanja. Međutim, prelaz sa 5:1 u W4 na kontinuirane treninge i 6×20 s u W5 nije uslovljen tolerancijom. Poželjna je instrukcija da se faza ponovi ako kontinuirano trčanje nije lako podnošljivo.

A W7 D3 ima 6×30 s na 7:15/km uz 90 s lagano: tri minuta kontrolisanog uvoda, ne pun razvoj praga. W9 D3 3×60 s na 6:34, pa W10 D3 2×400 na istom tempu uz 118 s hoda, čine razumno malu dozu. W8 skida kvalitet, zadržava kratka ubrzanja i smanjuje obim. Prednost je izričit uslovni status trke. Najveći LR4.6 km W10 ne dokazuje toleranciju 5 km u trci, ali ne znači da je završetak nemoguć; i 4.6 km lako može trajati duže od referentne trke. Glavni nedostatak je nedovoljno konkretna run/walk opcija za dan trke i put do željenih30 min.

B W7 D3 uvodi 1.1 km kontinuiranog T rada (~8 min), W8 D3 2×200 uz 190 s hoda služe ekonomiji/oštrini, a ne velikom aerobnom opterećenju. To nije automatski previše. Problem je kombinacija W9 fartleka6×60 s, LR6.1 km prema4.9 km u prethodnoj punoj W7 i W10 obima15.2 km prema11.6 W7. Ne primenjujem tvrdo pravilo10%: ocenjujem istovremene nove zahteve i odsustvo uslova tolerancije. LR6.5 km W10 pruža bolju izloženost distanci nego A. Ipak, tvrdnja da plan realno donosi33:24 i da je ovo plan da se distanca istrči nema potvrdu stvarnim testom. W12 cilj30:00/ritam7:00 su različiti ishodi; cilj i referenca moraju biti odvojeni.

### U02 — 23:45 na 5K, 30 km/ned, četiri dana, cilj19:59

Promena cilja zahteva oko15.9% kraće vreme (ili oko18.8% veću brzinu), značajan pomak; ni trener ni generator ga ne mogu garantovati. Trening na sadašnjoj formi je razuman i ne treba zahtevati automatsko trčanje ciljnim4:00/km. Međutim, buduća provera napretka mora biti stvarni uslov za korekciju ritma, ne samo neodređena preporuka.

A W1–W3 D3 4×300 m na4:21 uz196 s hoda: približno5.2 min rada, veoma pun odmor. Svrha može biti ekonomija, tehnika i sigurni brzi koraci; 300 m nije zabranjeno, ali tri gotovo identične nedelje malo razvijaju aerobni kvalitet. W5 3×800 na4:32 daje10.9 min rada. W7 2×1000 daje9.1 min, W9 piramida2.8 km12.7 min, W10 fartlek8 min, W11 2×1100 približno10 min. Doza ima varijacije, ali progresija nije snažna. W6–W11 T rad3.2–3.8 km (oko16–19 min) dodaje smislen prag i W13 3×1000 na trenutnom5K ritmu uz90 s hoda više razvija specifičan kontinuitet nego B. W14 5×600 I daje13.6 min rada. Oporavak je prikladno raspoređen D3/D5/LR D7, uz rasterećenja i taper. Nedostatak su prognoza22:09 iz automatskog VDOT44.2 i trka sa ciljem19:59 uz4:45/km.

B W1–W2 uvodi samo2.5 odnosno2.25 min kontrolisanog T fartleka i W3 tek dodaje drugi kvalitet. To je dobar uvod za delimično iskustvo, mada veoma blag. W5/W7 2×1000 I, W9 piramida2.3 km i W11 2×1100 ograničavaju rad na oko9–10.5 min. W13 2×1000 na4:45 sa214 s hoda slabo vežba održavanje5K ritma; W14 4×600 I samo10.9 min. LR14.5 km (~89 min) od W7 nadalje i laka trčanja11.6 km uz kvalitet čine plan snažno aerobnim, što je vredno [S1,S2,S9]. Nije dokaz da je dužina previsoka, niti postoji zabrana14.5 km za5K. Pitanje je da li raspodela najbolje služi ovom cilju i da li je trening iskoristio dovoljno specifične doze. Presentation pošteno zadržava referencu23:45 i traži novi rezultat. Zbog tih različitih prednosti ocene su bliske.

### U03 — 20:35 na 5K, 50 km/ned, 24 dosledne nedelje, cilj18:59

A odmah daje dva kvaliteta, ali W1 D2 2×1000 I@3:57, W2 3×800, W5/W7/W11 2×1200 sa213 s hoda daju7.9–9.5 min I rada. W6/W10 po9 min fartleka i T3.2–4.1 km daju korektan ali skroman stimulans uz obim51.5–56.5 km. Za iskustvo i zahtev cilja očekivao bih jasniju progresiju zbirnog rada ili gustine; to je trenerski sud, ne univerzalno pravilo minimalnih minuta. W13 3×1000@4:07 sa185 s hoda je slabija specifična gustina. Duga16.6 km je oko90 min i može dobro služiti5K aerobnoj bazi [S2]. Rasterećenja bez zasebnog kvaliteta uz kratka ubrzanja su legitimna; ne tražim obavezno200 m svake četvrte nedelje.

B W1/W2 8×300@3:48 sa171 s hoda i W3 9×300 su legitimni brzinski/ekonomijski treninzi, zatim W5/W7/W11 3×1200@3:57 daju14.2 min I rada. T3×1600@4:23 daje21 min, W6/W10 kontinuiranih4.5 km19.7 min, W9 piramida3.6 km14.2 min i W14 7×60016.6 min. To je za ovaj profil smisleniji kvalitet bez očigledno lošeg rasporeda. W13 4×1000@4:07 sa90 s odmora ima jasniju svrhu održavanja trkačkog ritma. Taper W15 smanjuje obim na32.4 km, W16 samo10.5 km treninga pre5K. Slabost je tvrdnja o očekivanih19:23 i mogućem agresivnom napretku bez merenja, plus neusklađeni cilj18:59/ritam4:07. S1/S2 pokazuju da postoji više validnih oblika intervalnog rada; B dobija prednost zbog dose i svrhe za ovaj profil, ne zbog obavezne piramide ili prisustva300 m.

## Provera ostalih distanci

U04 A naglo dodaje drugu sesiju T2.8 km u W2 i već u W1 LR9.7 prema prijavljenih8 km. Nije automatski nebezbedno:25 km/ned i8 nedelja kontinuiteta postoje, ali uvod bez iskustva kvaliteta je slabije objašnjen. B je oprezniji, ali W3 D5 svega0.7 km T uz5.8 km zagrevanja/hlađenja i W4 D3 0.4 km T uz5.5 km lako nisu najbolje iskorišćen kvalitet. B kasni W13/W14 RP2–2.4 km sa skoro4 min hoda slabo razvija10K kontinuitet. A ima bolje kasne3×1000/3×1200 sa60 s odmora. B ipak bolje odgovara početnoj dužini i opisuje referencu, bez izmišljene prognoze.

U05 B koristi odgovarajuće jači T/I rad za iskusnog trkača: W7 4×1200 I i3×2000 T; W13 5×1200 RP uz60 s odmora. Zahtevno je, ali iskustvo24 nedelje i raspored D2/D5 ga čine odbranjivim. A povećava pretežno lak obim, W1 dva mala T rada, pa kasni RP3×1200 sa240 s hoda. To može služiti povratku, ali nema prijavljene pauze koja bi opravdala tako mali stimulus. Ne postoji dokaz da je obim68.2 sam po sebi problem ili da B mora biti bolji zbog više kilometara brzog rada.

U06 A posle osam nedelja pauze kreće RW LR5.9 prema4 km, W3 već7.1, W5 kontinuirano7.6; hod olakšava, ali ostaje velika pojedinačna izloženost. B kreće4 km i tri lake povratne nedelje, pa mali fartlek u W5–W6. To je bolje podudaranje sa istorijom. B najveći LR6.7 ne daje punu10K pripremu, a trka je ipak upisana; upozorenje je pošteno, ali nedostaje konkretan uslovni plan završetka. Precizni ritmovi zasnovani na starom PB ostaju pod znakom pitanja na obe strane; B to bar kaže. A upozorenje o niskom obimu ne opravdava tvrdnju da će distanca biti istrčana.

U07 A gradi LR10→10.8→11.6, potom12.5→13.5→14.5 i na kraju19.5 W13. B već W1 daje11.6, zatim rano stagnira na14 km i najviše15.3. Za prvi HM to je slabija dužinska progresija, ali ne znači da je završetak21.1 nemoguć. A kasni2×1700 RP sa326 s pauze je mala, retka specifična izloženost; W13 kontinuirano7 km RP je bolji stimulus. B W11 završni3.8 km RP uz uklanjanje petkovog kvaliteta smisleno računa dužinu kao težak dan. Obe strane štite oporavak nakon W13 kontrolisanog rada sa lakim petkom. B prognoza1:41:47 bez upozorenja ne sledi iz izmerenog5K; A pošteno navodi referencu.

U08 ima bazu za ozbiljniji HM: obe strane grade22 km LR i srednje-duga trčanja. A daje jači rani T rad, B blaži uvod i veći aerobni obim. W10 D2 kontrolisanih10 km RP plus3.5/3 km zagrevanja/hlađenja, pa D3 13.6 km Z2, zahtevaju praćenje zamora. D3 je zaista lako i ne krši doslovno napomenu o laganim danima, ali značajno trajanje slabi oporavak. W12 taper ponovo daje dve kvalitetne sesije, a W13 LR14.3 km sedam dana pre trke; ovo može raditi za iskusnog trkača, ali iziskuje individualno prilagođavanje. A nepodržan automatski VDOT napredak snižava koherentnost; B je u prikazu bolje kalibrisan.

U09 je jedini profil sa kritičnom primedbom na obe strane. A LR17.7 km (~105 min), B16 km (~95 min), uz višenedeljne dužine tek8–14 km, daju veliku rupu do prvog maratona. Za poređenje, originalni četvorodnevni Higdon Novice1 i BAA Level1 razvijaju znatno duže ponovljene treninge [S6,S7]. Ne namećem32 km kao univerzalni minimum, niti zahtev da se42 km trči na treningu. Problem je ukupna neizgrađena specifična izdržljivost. A pošteno priznaje limit i zato je koherentniji, ali upozorenje nije zamena za konkretnu promenu distance/datuma. B tvrdnja da je ovo plan za istrčavanje i da četiri dana praktično nameću LR pola nedelje nisu podržane ni sopstvenim planom ni postojanjem originalnih četvorodnevnih programa.

U10 B bolje čuva prijavljenu dužinu24 km i gradi više29.3 km/180 min izlaganja. A vraća početnika sličan LR15.2 i tek kasno W14 skače22.8→28.2 km, uz dva ozbiljna kvaliteta; nema objašnjenja za toliko izgubljene postojeće baze. A ima jači RP rad, B mnoge kasne sesije ograničava na3.2–3.3 km RP. B brzi završetak9.2 km W15 i ponovljene dužine delimično nadoknađuju taj manjak. Oba tapera W19 imaju LR17.1/18.2 sedam dana pred maraton uz dva kvaliteta; obim opada, ali može ostati previše zamora za neke trkače. Nije primenjena univerzalna zabrana tih dužina. A pojedini opisi minuta ne slažu se sa km i navedenim ritmom, naročito W18/W19; B je koherentniji. Referentno5:20/km odgovara3:45, ne3:30.

## Šta podržavaju izvori, a šta je heuristika

| Princip | Potpora i granica | Primena u pregledu |
|---|---|---|
| Većina treninga lako, uz smislen kvalitet | Mali originalni RCT kod subelitnih trkača podržava veći udeo lakog rada [S9]; ne dokazuje fiksni80/20 za svaki profil | Nisu kažnjeni aerobni obim i dužine; kvalitet je ocenjen kroz svrhu i dozu |
| I, T, ubrzanja i duga trčanja imaju različite svrhe | Originalni BAA/Higdon/Runna programi koriste različite kombinacije [S1,S2,S11] | 300 m i piramida su opcije; ni prisustvo ni odsustvo nisu samostalni kvalitet |
| Aerobni intervali mogu razvijati VO2max | Originalni RCT40 muškaraca,8 nedelja, podržava intervale uz aktivan oporavak [S10]; ne određuje optimalan broj ponavljanja za svakog korisnika | Male I doze i vrlo dug hod su sumnja u ostvarenje svrhe, ne naučno dokazano beskorisni |
| Run/walk i postepen uvod | Originalni početnički programi [S3,S8] | Prikladni U01 i potencijalno U06; prilagođavanje reakciji je bolje od kalendarskog prelaza |
| Taper smanjuje obim, zadržava deo intenziteta | Meta-analiza daje okvir oko41–60% smanjenja i često2 nedelje [S4]; različite distance/iskustvo traže prilagođavanje | Rasterećenja bez intervala i različito trajanje tapera nisu automatski greške; trka se isključuje iz poređenja trening-obima |
| Postupnost nije garancija bez povreda | Originalni RCT532 početnika nije dokazao zaštitu pravila10% [S5] | Bez tvrde zabrane rasta iznad10% i bez tvrdnje da je nagli rast najčešći uzrok povrede |
| Maraton zahteva razvijenu dugotrajnu izloženost | Originalni BAA/Higdon programi nude konkretne uspešno korišćene strukture [S6,S7], ali nisu kontrolisani dokaz univerzalnog minimuma | U09 odbijen zbog velikog ukupnog raskoraka, ne zbog jednog izostalog32 km treninga |
| Gorivo zavisi od trajanja i tolerancije | Originalni stručni pregled autora iz AIS [S12] podržava različite unose po trajanju; nije originalni klinički eksperiment | Saveti30–60/60–90 g/h nisu glavni problem plana; prvi unos baš40. min i granica120 min su praktične heuristike, ne zakoni |

Heuristike ovog trenera: korisnost većeg zbirnog I/RP rada za iskusnog5K trkača, kraća poslednja dužina za umorne trkače, smislenija raspodela dva veoma mala T treninga, tolerancija kao uslov prelaza faze. Nisu empirijski ustanovljeni univerzalni minimalni minuti kvaliteta, obavezne piramide, zabrana300 m, obaveznih pet dana maratona, pravilo dužine≤30% nedelje ili obavezna30/40/55 km baza. Izvori nisu korišćeni za te tvrdnje. Njihove konkretne strukture služe poređenju svrhe i prilagođenosti, ne kopiranju rasporeda.

## Nepodržane ili nedovoljno kalibrisane tvrdnje u planovima

1. Presentation automatski povećava lastVdot i daje preciznu buduću referencu na U01B,U02A,U03B,U04A,U05B,U06A,U07B,U08A,U09B,U10A. Nijedan dostavljeni profil nema novo merenje u toku plana. Ne može se zaključiti da baš ovaj ciklus donosi dato vreme, niti da drugi tempo napretka sigurno dostiže cilj. Može postojati model prognoze, ali njegova validacija nije data i nije pregledana.
2. Tvrdnja da je ograničen plan namenjen da se distanca istrči, umesto na vreme, ne dokazuje završetak: posebno U09B, ali i U01B/U06A. Priprema i referentna brzina su odvojene stvari.
3. Tvrdnja da je nagli skok obima najčešći uzrok povrede nema dati dokaz. Pregled ne pretvara razuman oprez u uzročni zaključak; S5 pokazuje granicu popularne jednostavne formule.
4. Broj5 dana, kontinuitet8 nedelja i baze30/40/55 km mogu biti korisne interne heuristike, ali nisu univerzalno potvrđeni kriterijumi spremnosti. Higdon/BAA imaju legitimne četvorodnevne maratonske programe. Upozorenja koja ih nazivaju okvirnim su bolje kalibrisana, ali broj nije potvrda pojedinačne spremnosti.
5. Izračunavanje referentnih dužih distanci iz kraćeg PB ne potvrđuje dužinsku izdržljivost. Konzervativne strane to jasnije kažu, ali status supported ne treba čitati kao kliničku ili rezultatnu garanciju.
6. Prividno precizni Z2 ritmovi nisu individualno izmerene fiziološke zone; naročito kod starog PB u U06. Potrebne su instrukcije za prilagođavanje naporu/toleranciji. Velika razlika sadašnje forme i želje ne opravdava forsiranje ciljnog ritma.

## Javni primarni izvori

Pristup svim izvorima: **2026-10-11**. Originalni programi su praktični trenerski izvori; RCT studije imaju užu populaciju i ishode. Meta-analiza/stručni pregled su označeni kao takvi, ne predstavljeni kao originalni eksperiment. Citirani sadržaj je sa stranica autora/organizatora ili originalnog rada indeksiranog u PubMed-u. Nijedan blog agregator nije korišćen kao autoritet.

- **S1 BAA, Boston5K Training** — originalni nivoi, različito vreme rada/pauza, dug trening i taper: https://www.baa.org/races/boston-5k/info-for-athletes/boston-5k-training/
- **S2 Hal Higdon, Advanced5K** — namenjen iskusnim trkačima; ekonomija/brzina, prag, laka dužina i rasterećenje pre trke: https://www.halhigdon.com/training-programs/5k-training/advanced-5k/
- **S3 Mayo Clinic,7-week beginner5K schedule** — originalni run/walk raspored sa progresijom i odmorom: https://www.mayoclinic.org/healthy-lifestyle/fitness/in-depth/5k-run/art-20050962
- **S4 Bosquet et al.2007, Effects of tapering on performance**, meta-analiza27 studija: https://pubmed.ncbi.nlm.nih.gov/17762369/ ; DOI10.1249/mss.0b013e31806010e0
- **S5 Buist et al.2008, No effect of a graded training program…**, originalni RCT: https://pubmed.ncbi.nlm.nih.gov/17940147/
- **S6 BAA, Boston Marathon Training** — Level1 četiri dana, različiti nivoi i dugotrajna priprema: https://www.baa.org/races/boston-marathon/info-for-athletes/boston-marathon-training/
- **S7 Hal Higdon, Novice1 Marathon** — originalni18-nedeljni, četvorodnevni program sa dužinama i stepback nedeljama: https://www.halhigdon.com/training-programs/marathon-training/novice-1-marathon/
- **S8 Runna, The Ultimate5K Training Guide**, originalno objašnjenje run/walk, intervala, tempa i lakih dužina: https://support.runna.com/en/articles/6636429-the-ultimate-5k-training-guide
- **S9 Esteve-Lanao et al.2007, Impact of training intensity distribution…**, originalni mali RCT: https://pubmed.ncbi.nlm.nih.gov/17685689/ ; DOI10.1519/R-19725.1
- **S10 Helgerud et al.2007, Aerobic high-intensity intervals improve VO2max…**, originalni RCT: https://pubmed.ncbi.nlm.nih.gov/17414804/ ; DOI10.1249/mss.0b013e3180304570
- **S11 Runna,5K Improvement Plan**, originalna objašnjenja svrhe treninga i provere forme: https://www.runna.com/training/5k-improvement-plan
- **S12 Burke et al.2011, Carbohydrates for training and competition**, izvorni autorski stručni pregled: https://pubmed.ncbi.nlm.nih.gov/21660838/ ; DOI10.1080/02640414.2011.585473
- **S13 BAA,10K Training**, originalni rasporedi po iskustvu: https://www.baa.org/races/boston-10k/info-for-athletes/b-a-a-10k-training/
- **S14 BAA, Boston Half Training**, originalni nivoi i simulacije: https://www.baa.org/races/boston-half/info-for-athletes/boston-half-training/

Ocene su zamrznute pre otkrivanja identiteta A/B i pre pregleda naknadnih događaja. Kasnija revizija prilagođavanja predstavlja odvojen nalaz; ove ocene se ne prepravljaju na osnovu tog saznanja.

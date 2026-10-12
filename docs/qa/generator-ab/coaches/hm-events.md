# Nezavisna HM stručna procena event reakcija

Datum nezavisnog pregleda: **2026-10-12**. Pregledani su isključivo svih deset dozvoljenih `users/U01-event.json`–`U10-event.json`, moj ranije zamrznut rad i originalni javni izvori. Nisu čitani user findings, drugi coach reports ili agent statusi. Event datumi su datumi sintetičkih scenarija, uglavnom **2026-11-25**, ne datum današnjeg izvršavanja. Old/new oznake su sada vidljive u dozvoljenim payload-ima; prvobitno slepo ocenjivanje ostaje neizmenjeno.

**Početne ocene i izveštaj su nepromenjeni.** SHA256 `hm-scores.json`: `5287d5103edb38b8f0c22ce11a4a5c7640545f9f3647b9283c70f6cebf267be0`. SHA256 `hm-review.md`: `e810ed45c0491bba3dda8e9e7a821054a56d9c1e0e90e2ac9ab74bf466027770`. Nema funkcionalnih izmena, pokretanja generatora, source/probe čitanja niti nove browser verifikacije. JSON i ovaj dokument sadrže deset event zapisa, uz jasno zasebne dopunske grane.

## Obuhvat i kriterijumi

Provereni su okidač/istorija, stvarni recommendation/adjustment/error payload, očuvanje prošlih/odrađenih/pomerenih dana, merenja i ručnih izmena, zatim svaki budući nedeljni raspored primarnih prihvaćenih planova i relevantne dopunske grane. Za primarne generated reduce/return planove nezavisno sam uporedio svih **45 dnevnih objekata do uključivog 2026-11-25** sa ulazom: U02/U03/U04/U06/U07/U09/U10 bez promena. U05 primarni day diff u obe varijante pokazuje samo izmenjen opis trke g16d7. Zaštitni seed nije stvarna istorija: očuvanje konfliktnog kvaliteta je ispravan preservation zahtev, ali može zahtevati ručni trenerski pregled.

Potvrđena greška znači direktno vidljiv nesklad/before-after promena u payload-u. Trenerska zabrinutost znači da program ili izbor opterećenja zaslužuje drugačiju odluku; to nije dokaz programskog kvara, povrede ili nemogućnosti završetka. Zato postoji razlika između uspešnog konzervativnog povratka, slabe pripreme za željenu trku i korupcije istorije.

Kilometraža i upisani statusi u scenarijima su izričite sintetičke opservacije. Propisani trening nije sam po sebi izvršenje. Ukupna stvarno upisana distance ne potvrđuje da je ceo brzi deo izveden na zadatom tempu. Sparse dnevnici ne pretvaraju nepoznate dane u preskočene. Calendar return nedelje uključuju delimičnu prvu nedelju; dve/tri/četiri takve nedelje nisu nužno 14/21/28 punih dana.

## Zaključci koji najviše utiču na HM procenu

**U07:** smanjenje sa stvarno odrađenih 60% km opravdava lakši plan i izričito upozorenje. Međutim, buduća LR dostiže samo 11.4 km/oko70 minuta, uz cilj 105-minutnog HM. To je značajno slabija dužinska priprema od prvobitnog plana i ostaje uslovan nastup. Problem nije odsustvo obaveznih 20 km niti manjak svake moguće porodice sesije. Kontrolisana RP proba 5 km/oko26 min dana12-30 dolazi nedelju nakon samo6 min T rada; treba proveriti toleranciju. Reset kontinuiteta na0 uprkos odrađenim danima bez pauze traži objašnjenje, ali konzervativnu odluku ne proglašavam automatski kvarom.

**U08 PRIMARY:** događaj11-25 sa14-dnevnom pauzom **odbija** novi puni ciklus:53 dana,8 kalendarskih nedelja do01-17; result ne postoji, input hash i datum trke se čuvaju. To je stvarni primarni ishod. Aplikacioni minimum10 nedelja je proizvodna granica punog ciklusa, ne univerzalni fiziološki minimum HM. **EARLIER** simulacija10-28 ima81 dan/12 kalendarskih nedelja i prihvaćen povratak38.5 km, LR11.2, tri lake početne nedelje; nije zamena za primarni neuspeo zahtev. U dopunskoj grani postoje tekstualne greške i oporavak posle7 km RP probe12-22 treba prilagoditi trkaču. Sporiji race-activation pace266 s označen kaoR/current-fitness nije dokaz prebrzogR treninga; semantiku treba jasno objasniti u odnosu na current-fitnessR228 s.

**U09/U10:** povratna struktura opada razumno i upozorava na ograničenje, ali LR8.8 km/52 min odnosno17.3 km/106 min ne podržavaju pouzdano želje4 h/3:30 maratona. Četiri ili pet dana sami po sebi ne odlučuju o validnosti. Sačuvani cilj nije potvrda spremnosti. Očuvanje datuma trke je korektna funkcija; odluka o odlaganju ili drugačijem nastupu ostaje potrebna trenerska procena.

## Potvrđene greške naspram zabrinutosti

Najvažniji potvrđen preservation kvar nalazi se u **OLD U05 protection**, ne u novoj primarnoj reakciji. Moved-past LR11-24 g7d7 menja se18.8→18.4 km, completed dani g7d2/g7d5 i measured row menjaju tempo. Manual buduća sesija12-08 od5×200mR/1 km/~4 min prepisuje se u3.6 kmI/~14.9 min piramidu; locked pace12-15 se takođe menja bez upozorenja. NEW čuva sve te podatke i daje datirana manual warnings. Stvarni execution log nije prikazan kao obrisan: kvar je u zaštićenom prikazu/merenju/programu.

Ponavljajući potvrđeni kvar u prihvaćenim povratnim planovima **U04/U06/U09/U10 i U08 EARLIER**: `strides` objekat je uklonjen, ali `desc` i dalje propisuje6×20 s ili4×15 s ubrzanja. „Nema quality object-a“ stoga nije isto što i „korisnik nema instrukciju brzog rada“. Ponavljaju se i naslovi Fartlek/Tempo kada nema sesije, te generic warning od1/2 početne nedelje naspram konkretnog adjustment-a2/3/4. Takvi tekstualni kvarovi su stvarni, iako ne dokazuju povredu niti poništavaju dobro očuvanje istorije.

U03 prihvata umor kao razlog redukcije i blokira ubrzanje čak u pozitivnoj zasebnoj kontroli sa tri evidence dana. U01 jedan propušten trening ne regeneriše plan i ne nadoknađuje kilometre. U02/U07 kontinuitet ostaje predmet trenerske zabrinutosti; nije automatski potvrđen bug samo zato što je nova doza vrlo oprezna. `allChecksPass`/lokalni growth ceilings nisu sveobuhvatna trenerska potvrda.

## Originalni izvori

Ponovo provereno2026-10-12: [Runna — recovery/return](https://support.runna.com/en/articles/15272605-how-does-runna-build-recovery-into-your-training-plan) opisuje postepen povratak nakon prekida, lakši obim i rasterećenja; [Hal Higdon — HM Novice1](https://www.halhigdon.com/training-programs/half-marathon-training/novice-1-half-marathon/) pokazuje legitiman noviceHM sa maksimumom10 milja. To su autorski primeri, ne univerzalna pravila za sve profile.

Ranije originalno provereno2026-10-11: [BAA HM nivoi](https://www.baa.org/races/boston-half/info-for-athletes/boston-half-training/), [Runna long runs](https://support.runna.com/en/articles/9357249-understanding-the-long-runs-in-your-runna-plan), [Higdon novice maraton](https://www.halhigdon.com/training-programs/marathon-training/novice-1-marathon/), [Bosquet taper meta-analysis](https://pubmed.ncbi.nlm.nih.gov/17762369/), [Frandsen original cohort](https://bjsm.bmj.com/content/59/17/1203), [Buist randomized trial](https://pubmed.ncbi.nlm.nih.gov/17940147/), [Fokkema HM/marathon study](https://pubmed.ncbi.nlm.nih.gov/32421886/). Nisam prenosio njihove kategorije u individualne mandatory minimums, niti weekly10% prag tumačio kao univerzalan zakon.

## Deset event presuda


| ID | Događaj | Stvarni ishod | Presuda |
|---|---|---|---|
| U01 | single-miss | Old i new: single-miss; nema novog plana. Error je očekivano odbijanje regeneracije, ne greška rada. | prihvatljivo |
| U02 | underexecution | Prepoznate dve pune nedelje na 55% distance; reduce sa potvrdom, baza 23 km/ned i LR 10.8; novi budući sadržaj počinje 2026-11-26. Ne izmišlja se pauza. | prihvatljiv princip redukcije; doraditi koherentnost |
| U03 | high-rpe | Dva laka RPE8 dana pokreću reduce sa potvrdom: polazna baza53.1→45.1 km i LR 16.6→14.1. Primarno nema pace evidence; pozitivna dopunska kontrola VDOT51.2/tri dana bi predložila ubrzanje, ali recovery gate vraća null. | prihvatljiva reakcija uz uslovnu proveru umora |
| U04 | return | Return zahteva potvrdu; potvrđena prijavljena baza30 km daje85%=25.5 km i LR 9.2→7.8; dve početne kalendarske povratne nedelje strukturalno bez kvaliteta. | razumna struktura povratka; potvrđene tekstualne greške |
| U05 | goal-change | Obe varijante čuvaju datum2027-01-31 i menjaju želju42→40 min. Nezavisni day diff: u obe primarne varijante menja se samo g16d7 opis trke; fizički trening/pace ostaje isti. New eksplicitno čuva referencu45 min, old automatski projicira42:13. | new reakcija prihvatljiva; old zaštitna varijanta ima potvrđen kvar |
| U06 | return | Return sa potvrdom posle 28d; prijavljenih15 km→55%=8.3 km; LR 4→2.2. Četiri početne kalendarske nedelje bez session/finish/strides objekata; stari PB posebno ograničen. | oprezan povratak; tekst doraditi i nastup10K preispitati |
| U07 | underexecution | Dve pune nedelje60% km bez pauze/RPE problema: reduce sa potvrdom i odrađena baza25.7 km/LR 8.7. Cilj1:45 ostaje želja; priprema izričito ograničena. | redukcija opravdana;HM vremenski cilj ograničen, metadata doraditi |
| U08 | return | PRIMARY return preporuka zahteva potvrdu, ali adjustment odbija novi pun ciklus:53 dana/8kalendarske nedelje do01-17; nema result-a i datum nije pomeren. | PRIMARY očekivano odbijanje;EARLIER zasebna prihvatljiva struktura uz tekstualne greške |
| U09 | return | Return sa potvrdom;30 km→70%=21 km iLR 10→7. Tri početne kalendarske nedelje bez novog kvaliteta; datum02-28 i želja4 h sačuvani; jasna ograničena maratonska priprema. | povratna struktura razumna;nastupmaratona nepodržan,tekst doraditi |
| U10 | return | Return sa potvrdom posle 28d;60 km→55%=33 km iLR 24→13.2; četiri početnekalendarske nedelje bez session/finish/strides. Iskustvo ostaje, trenutna forma nije pretpostavljena. | oprezan povratak sa tekstualnim greškama;maratonska spremnost ograničena |

## U01 — prihvatljivo

Događaj: `{"kind": "single-miss", "date": "2026-11-25"}`.

Stvarni ishod: Old i new: single-miss; nema novog plana. Error je očekivano odbijanje regeneracije, ne greška rada.

Očuvanje: Payload potvrđuje da plan i dnevnici ostaju identični; sparse varijanta sa 11 nepoznatih zapisa ne izmišlja kilometražu niti pauzu.

Struktura: Nastaviti postojeći kalendar bez prenosa propuštenog kvaliteta ili dodatnih km.

Doza: Propušteno 3.5 km tempo u old, 3.9 km uvodni fartlek u new; ne nadoknađuje se.

Oporavak: Poslednji odrađen trening 2026-11-23 sprečava pogrešan povratak posle pauze.

Koherentnost: Objašnjenje odgovara non-actionable rezultatu i ne zahteva potvrdu.

Nema potvrđenog kvara u ovoj primarnoj grani.

- **Datiran primer, 2026-11-25 (primary)**. Očekivano: Jedan propust bez kompenzacije. Stvarno: Old g7d3 tempo preskočen; new g7d3 fartlek preskočen; oba bez result plana. Značenje: Smanjen rizik da se propušteni kvalitet stavi uz sledeću dužinu.


## U02 — prihvatljiv princip redukcije; doraditi koherentnost

Događaj: `{"kind": "underexecution", "date": "2026-11-25", "fraction": 0.55, "period": ["2026-11-09", "2026-11-22"]}`.

Stvarni ishod: Prepoznate dve pune nedelje na 55% distance; reduce sa potvrdom, baza 23 km/ned i LR 10.8; novi budući sadržaj počinje 2026-11-26. Ne izmišlja se pauza.

Očuvanje: Nezavisno poređenje svih 45 primarnih dana do uključivog cutoff-a: nijedna promena. Zaštitni payload čuva completed/moved-past, manual alt, session override, measured row i predLock uz upozorenje.

Struktura: Budući 2026-11-27 lak/2026-11-29 LR 9.2; prve pune nedelje 24.6,25.5,18.6(deload); kasnije ponovo dva razmaknuta mala kvaliteta. Zadržan datum5K 2027-01-31.

Doza: 2026-12-09 piramida100/200/300/200/100m (~4.1 min I); 12-11 2×500mT (~5 min),90 s jog. LR dostiže12 km/~74 min.

Oporavak: Uglavnom odgovarajući razmak; ponedeljak2027-01-11 9.4 km posleLR 11.8 može biti dug lak dan za smanjenu bazu.

Koherentnost: Potvrđen zastareo focus. Kontinuitet ulaza postaje0 iako postoje eksplicitno odrađeni dani bez pauze; razlog takvog konzervativnog reset-a nije objašnjen.

- **Potvrđena greška, 2026-11-30 (primary)**. Očekivano: Naslov nedelje odgovara stvarnim sesijama. Stvarno: N8 focus Fartlek, ali svi dani su laki/LR bez session/finish. Značenje: Potvrđen nesklad naslova i stvarnog programa.

- **Trenerska zabrinutost, 2026-12-02 (primary)**. Očekivano: Smanjenje obima treba da zadrži dokaz kontinuiteta ili objasni reset. Stvarno: ulaz.consistentWeeks=0; log nema propusta/pauze, raniji profil12 nedelja kontinuiteta. Značenje: To može neopravdano preklasifikovati readiness; ne tvrdim da je reset nužno greška ili da kvalitet mora biti veći.

- **Datiran primer, 2026-11-29 (primary)**. Očekivano: LR prilagoditi odrađenoj bazi bez nadoknade. Stvarno: 9.2 km umesto prethodnih14.5 km. Značenje: Razumno neposredno rasterećenje.

- **Datiran primer, 2026-12-09 (protection)**. Očekivano: Zaštićeni ručni sadržaj ostaje, uz upozorenje o novoj bazi. Stvarno: Zaštitna varijanta čuva session/measurement i datirano upozorenje. Značenje: Preservation uspeva; sačuvan trening zahteva zasebnu trenersku procenu.


## U03 — prihvatljiva reakcija uz uslovnu proveru umora

Događaj: `{"kind": "high-rpe", "date": "2026-11-25", "easyDates": ["2026-11-23", "2026-11-25"], "rpe": 8}`.

Stvarni ishod: Dva laka RPE8 dana pokreću reduce sa potvrdom: polazna baza53.1→45.1 km i LR 16.6→14.1. Primarno nema pace evidence; pozitivna dopunska kontrola VDOT51.2/tri dana bi predložila ubrzanje, ali recovery gate vraća null.

Očuvanje: 45 dana do cutoff-a identično; datum2027-01-31, cilj18:59 i kalendarski IDs sačuvani. Dokaz proizvodnog gate testa ostaje u payload-u; nisam ponovo izvršavao test/kod.

Struktura: 2026-11-27 kvalitet postaje8.2 km lako; 11-29 LR 14.1; 12-01 samo3×45sT; potom postepeni mali I/T i kasniji deload.

Doza: 12-01 2.25 minT,90 s lagano; 12-08 1.8 kmI/~7.1 min i 12-11 2.2 kmT/~9.6 min. Reference paces237/263 s ostaju umesto ubrzanja226/250 s.

Oporavak: Reakcija je smerom ka oporavku; fiksni povratak kvaliteta posle nekoliko dana traži proveru da li RPE8 i dalje postoji.

Koherentnost: Nema potvrđenog primarnog kvara iz payload-a. Regeneracija resetuje kontinuitet i fazu; to je trenerska/proizvodna odluka, ne dokaz povrede ili korupcije istorije.

Nema potvrđenog kvara u ovoj primarnoj grani.

- **Trenerska zabrinutost, 2026-12-01 (primary)**. Očekivano: Vraćanje brzog rada zavisi od normalizacije lakog napora. Stvarno: Nakon visokogRPE 11-23/25 već12-01 mali fartlek, zatim12-08 I. Značenje: Razumna mala doza, ali sam datum nije dokaz oporavka.

- **Datiran primer, 2026-11-27 (positive-evidence-control)**. Očekivano: Ne ubrzavati zbog pozitivnih merenja dok je oporavak problem. Stvarno: PredlogT263→250 s/km u dopunskoj kontroli postoji bez gate-a; blockedProposal=null sa gate-om. Značenje: Dopunska kontrola podržava zaštitni princip; nije nova potvrđena forma trkača.


## U04 — razumna struktura povratka; potvrđene tekstualne greške

Događaj: `{"kind": "return", "date": "2026-11-25", "breakDays": 7, "breakPeriod": ["2026-11-19", "2026-11-25"]}`.

Stvarni ishod: Return zahteva potvrdu; potvrđena prijavljena baza30 km daje85%=25.5 km i LR 9.2→7.8; dve početne kalendarske povratne nedelje strukturalno bez kvaliteta.

Očuvanje: 45 primarnih dana identično; log/measurements/cutoff/race2027-01-31 sačuvani. Seed sa pomerenom dužinom u prošlost i manual future kvalitetom takođe sačuvan uz upozorenje12-09.

Struktura: Kalendar se nastavlja:11-27 lako4.8;11-29 LR 7.8;12-06 LR 8.2; kvalitettek 12-09. Dva početna kalendarske nedelje obuhvataju delimičnu i punu nedelju, ne14 punih dana.

Doza: Prvi kvalitet3×45sT (~2.25 min),90 s jog; kasnije max LR 10.7/~69 min.

Oporavak: Početna redukcija razumna posle 7d; ne tvrdim da85% ili2 nedelje predstavljaju medicinski standard.

Koherentnost: Strides strukture uklonjene, instrukcije ostale; focus i opšti warning ne slažu se sa konkretnim povratnim rasporedom.

- **Potvrđena greška, 2026-11-27 (primary)**. Očekivano: Tekst lakog povratka prati uklanjanje strides objekta. Stvarno: desc propisuje6×20 s ubrzanja, a strides=null/odsutan; isto11-30. Značenje: Korisnik dobija dodatni brzi rad uprkos uklanjanju strukture.

- **Potvrđena greška, 2026-11-30 (primary)**. Očekivano: Focus i broj početnih lakih nedelja su jedinstveni. Stvarno: N8 Fartlek bez kvalitetne sesije; opšti warning kaže1 povratna nedelja, adjustment note2. Značenje: Potvrđena koherentnost metadata/teksta, ne greška kalendarskog očuvanja.

- **Datiran primer, 2026-12-09 (primary)**. Očekivano: Kratak kontrolisan uvod posle lakog povratka. Stvarno: 3×45 s @5:16/km,90 s jog. Značenje: Primer skromne razumne doze.


## U05 — new reakcija prihvatljiva; old zaštitna varijanta ima potvrđen kvar

Događaj: `{"kind": "goal-change", "date": "2026-11-25", "fromSec": 2520, "toSec": 2400}`.

Stvarni ishod: Obe varijante čuvaju datum2027-01-31 i menjaju želju42→40 min. Nezavisni day diff: u obe primarne varijante menja se samo g16d7 opis trke; fizički trening/pace ostaje isti. New eksplicitno čuva referencu45 min, old automatski projicira42:13.

Očuvanje: Primarni past/completed/pred rows stabilni u obe. Zaštitni seed: OLD menja već odrađene/pomerene dane i measured row; NEW čuva sve seeded day payloads osim dozvoljenog race opisa, daje manual warnings.

Struktura: Cilj40 min ne pretvara4:30/km u4:00/km; to je primeren wishlist cilj uz potrebu novog rezultata. Zatečeni trening ne postaje automatski dovoljan za cilj.

Doza: Primarne doze ostaju iste; cilj nije dokaz nove forme.

Oporavak: U seedu postoje moved/completed konflikti: čuvanje completed zapisa nije savet da se kvalitet ponovi na moved budućem datumu.

Koherentnost: Potvrđena stara preservation greška i minor old changedWeeks10 naspram stvarno jednog izmenjenog week payload-a. New cilj/ritam su odvojeni.

- **Potvrđena greška, 2026-11-24 (old-protection)**. Očekivano: Već odrađeni i efektivno prošli treningi/merenja su nepromenljivi. Stvarno: OLD protection: g7d7 pomeren11-24 menja18.8→18.4 km; completed g7d2/g7d5 menjaju pace; measured row pt251→249. NEW svi ostaju isti. Značenje: Potvrđena korupcija protected plan/measurement prikaza u old varijanti. Izvršni log je sačuvan; ne tvrdim da se istorijski stvarno odrađena kilometraža promenila.

- **Potvrđena greška, 2027-01-31 (old-primary)**. Očekivano: Broj stvarno izmenjenih nedelja jasno se označava. Stvarno: OLD goalChange.changedWeeks10, ali day diff samo race g16d7 u N16; NEW1. Značenje: Potvrđena neusklađena metrika prema dnevnim payload-ima, minor.

- **Potvrđena greška, 2026-12-08 (old-protection)**. Očekivano: Ručno zadata buduća sesija i measured pace ostaju bez prepisivanja pri promeni željenog cilja. Stvarno: OLD protection g9d2: 5×200m R @4:00 sa120s hoda prepisano u piramidu400/800/1200/800/400m I @4:09; g10d2 locked253s postaje249s. NEW oba čuva. Značenje: Potvrđen gubitak override-a: 1km R/~4min postaje3.6km I/~14.9min; bez manual warning-a. To je stvarna promena strukture i doze, ne samo formatiranje.

- **Datiran primer, 2027-01-31 (primary)**. Očekivano: Cilj40:00 odvojiti od preporučenog referentnog ritma45:00. Stvarno: NEW opis željeni40:00/preporučeni4:30/km (~45:00). Značenje: Koherentna preporuka iz starog rezultata; nema obećanja poboljšanja.


## U06 — oprezan povratak; tekst doraditi i nastup10K preispitati

Događaj: `{"kind": "return", "date": "2026-11-25", "breakDays": 28, "breakPeriod": ["2026-10-29", "2026-11-25"]}`.

Stvarni ishod: Return sa potvrdom posle 28d; prijavljenih15 km→55%=8.3 km; LR 4→2.2. Četiri početne kalendarske nedelje bez session/finish/strides objekata; stari PB posebno ograničen.

Očuvanje: 45 plan-day objekata do cutoff-a identično, uključujući skipped dane; historical snapshot i log/pred payload-i sačuvani. Domain revision/restore roundtrip dokazi postoje u event-u; browser nisam dodatno pregledao.

Struktura: 11-29 LR2.5;12-06 2.9;12-13 3;12-20 2.6; kasnije mali volumen bez kvaliteta sve do01-20 RP.

Doza: Vrhunac budućeLR 4 km/~28 min;01-20 2×600mRP @6:00,2:42 hoda;10K trka ostaje60 min.

Oporavak: Bez nadoknade kilometara; oprezan povratak opravdan. Spremnost za10K ostaje ograničena, nezavisno od povratnog safety plana.

Koherentnost: Potvrđena desc/strides i focus/warning kontradikcija.

- **Potvrđena greška, 2026-11-30 (primary)**. Očekivano: Laki povratni tekst bez uklonjenih ubrzanja. Stvarno: desc2.2 km +6×20 s, strides objekat odsutan;12-14 +4×15 s takođe. Značenje: Neusklađene instrukcije povratnog prozora.

- **Potvrđena greška, 2026-12-07 (primary)**. Očekivano: Focus prati kvalitet i broj lakih nedelja. Stvarno: N9 Fartlek bez session; generic warning2 početne nedelje, adjustment note4. Značenje: Potvrđen nesklad; isto kasniji naslovi Tempo/Progresivno bez sesija.

- **Trenerska zabrinutost, 2027-01-31 (primary)**. Očekivano: Nastup10K odlučiti prema vraćenoj toleranciji, ne samo starom PB-u. Stvarno: Najduža budućaLR 4 km, trka10 km; upozorenje ograničenja postoji. Značenje: Povratak je bezbednosno konzervativan, ali priprema za60 min trku je slaba; nije univerzalni LR minimum.

- **Datiran primer, 2026-11-29 (primary)**. Očekivano: PrvuLR vezati za redukovanu bazu. Stvarno: 2.5 km/~17 min. Značenje: Primer opreznog povratka.


## U07 — redukcija opravdana;HM vremenski cilj ograničen, metadata doraditi

Događaj: `{"kind": "underexecution", "date": "2026-11-25", "fraction": 0.6, "period": ["2026-11-09", "2026-11-22"]}`.

Stvarni ishod: Dve pune nedelje60% km bez pauze/RPE problema: reduce sa potvrdom i odrađena baza25.7 km/LR 8.7. Cilj1:45 ostaje želja; priprema izričito ograničena.

Očuvanje: 45 primarnih cutoff dana identično; zasebni seed čuva manual6 km alt12-07, measured day/row, overrideWU iqs; upozorenja12-07/09.

Struktura: N8/9 sve lako, N10deload; prvi novi T tek 12-23; kontrolisanaRP proba12-30; kasnijeN13 dva kvaliteta; taper pre 01-31.

Doza: 12-23 2×600mT (~6 min),60 s jog;12-30 5 kmRP/~25.9 min kontinuirano; max LR 11.4/~70.3 min01-10.

Oporavak: Dani kvaliteta nisu susedni; posle12-30 probe slede01-01lako i 01-03LR 10.8. Doza probe je mnogo veća od prveT mikrodoze i traži procenu tolerancije.

Koherentnost: Potvrđeni naslovi kvaliteta u nedeljama bez kvaliteta. Reset consistentWeeks0 uprkos potvrđenom kontinuitetu je razlog za objašnjenje; upozorenje ograničeneHM pripreme je pošteno.

- **Potvrđena greška, 2026-11-30 (primary)**. Očekivano: Naslov predstavlja stvarnu nedelju. Stvarno: N8 Fartlek bez kvalitetnih sesija;N9 od12-07 Tempo isprekidan takođe bez sesija. Značenje: Potvrđen fokus/payload nesklad.

- **Trenerska zabrinutost, 2026-12-30 (primary)**. Očekivano: ProbniRP rad držati proporcionalnim potvrđenoj toleranciji nakon smanjenja. Stvarno: 5 km/~25.9 minRP samo nedelju posle6 minT;LR kasnijemax11.4 km (~70 min) za105 minHM želju. Značenje: Manje pripreme za vremenski cilj; dodatno upozorenje postoji. Ne tražim da svakiHM ima20 kmLR.

- **Trenerska zabrinutost, 2026-12-07 (primary)**. Očekivano: Preklasifikaciju kontinuiteta obrazložiti. Stvarno: ulaz.consistentWeeks0 i developing uz log bez propuštanja/pauze. Značenje: Poddoziranje u kilometrima nije automatski gubitak kontinuiteta, mada oprezna doza može biti legitimna.

- **Datiran primer, 2027-01-10 (primary)**. Očekivano: Transparentno prikazati isporučenu izdržljivost. Stvarno: LR 11.4 km i warning ograničena dužinska priprema. Značenje: Ispravno upozorenje; ne potvrđuje1:45.


## U08 — PRIMARY očekivano odbijanje;EARLIER zasebna prihvatljiva struktura uz tekstualne greške

Događaj: `{"kind": "return", "date": "2026-11-25", "breakDays": 14, "breakPeriod": ["2026-11-12", "2026-11-25"]}`.

Stvarni ishod: PRIMARY return preporuka zahteva potvrdu, ali adjustment odbija novi pun ciklus:53 dana/8kalendarske nedelje do01-17; nema result-a i datum nije pomeren.

Očuvanje: PRIMARY inputHashBefore=inputHashAfter; izostanak result-a sprečava bilo kakvo zamensko spajanje istorije. Dopunski earlierControlled poseduje sopstveni cutoff10-28 i svoju istoriju; ne zamenjuje primarni ishod.

Struktura: Nema novog PRIMARY plana za trenersku ocenu. Gate od10 ned je lokalna produktna granica punog ciklusa, ne univerzalni fiziološki minimumHM.

Doza: PRIMARY nema novih doza. EARLIER:38.5 km(70%55) iLR 11.2(70%16),tri lake kalendarske nedelje, kasnije maliI/T i7 kmRPproba.

Oporavak: EARLIER postupno vraća kvalitet; proba7 km12-22 pratiMLR 9.3 km/~50 min12-23; po potrebi skratiti.

Koherentnost: PRIMARY odbijanje koherentno. EARLIER ima potvrđen stale stride/focus/warning nesklad; raceActivation reference R=current-fitness228 s ali actual266 s je sporiji RP activation, ne potvrđen prebrzR rad.

- **Potvrđena greška, 2026-10-30 (earlierControlled)**. Očekivano: EARLIER easy-return opis prati uklanjanje strides. Stvarno: desc6×20 s, strides odsutan;11-02 i 11-09isto. Značenje: Potvrđena greška u dopunskoj prihvaćenoj simulaciji, ne u odbijenom PRIMARY.

- **Potvrđena greška, 2026-11-02 (earlierControlled)**. Očekivano: EARLIER focus/warning prate stvarni povratak. Stvarno: N4/N5 Fartlek bez kvaliteta; generic warning1 povratna nedelja, adjustment3. Značenje: Potvrđen nesklad opisa.

- **Trenerska zabrinutost, 2026-12-23 (earlierControlled)**. Očekivano: Dopunski dan posle 7 kmRP/~31.5 min ostaviti prilagodljivim. Stvarno: MLR 9.3 km/~50 min. Značenje: Lak intenzitet je dozvoljen, ali trajanje može zahtevati redukciju po umoru.

- **Datiran primer, 2026-11-25 (primary)**. Očekivano: Ne proizvoditi novi puni ciklus ako production gate odbije. Stvarno: error, result odsutan,53 dana/8 ned. Značenje: Validno očuvanje primarnog ishoda; nije dokaz da trkač ne sme fiziološki trenirati8 ned.

Zasebna dopunska grana: `{"today": "2026-10-28", "confirmedBreakDays": 14, "remainingDays": 81, "newCycleCalendarWeeks": 12, "accepted": true, "startingKm": 38.5, "startingLrKm": 11.2, "raceDate": "2027-01-17"}`.


## U09 — povratna struktura razumna;nastupmaratona nepodržan,tekst doraditi

Događaj: `{"kind": "return", "date": "2026-11-25", "breakDays": 14, "breakPeriod": ["2026-11-12", "2026-11-25"]}`.

Stvarni ishod: Return sa potvrdom;30 km→70%=21 km iLR 10→7. Tri početne kalendarske nedelje bez novog kvaliteta; datum02-28 i želja4 h sačuvani; jasna ograničena maratonska priprema.

Očuvanje: 45 primarnih cutoff dana identično. Seed čuva46past/completed, manualalt12-04, manualWU/measured locked12-09 i movedpastLR; upozorenja postoje. False firstThreeFreshWeeksEasy u seedu nastaje sačuvanim manual/measured kvalitetom; nije tiho gubljenje zaštite.

Struktura: 11-29LR 7;12-06 7.4;12-13 6.6; prviT tek 01-01; budući vrhLR 8.8/~52 min i 29 km/ned; jedna ili manjequality sesija u većini nedelja.

Doza: 01-01 2×600mT @4:50/~5.8 min; M tek02-12/19 1.8 km/~10.2 min; trka42.195 km/~4 h.

Oporavak: Povratno mehaničko opterećenje skromno; njegov oprez ne rešava jaz do240 min maratona. Seed kvalitet12-09/~13.5 minT u lakom prozoru zahteva ručnu odluku.

Koherentnost: Potvrđena stride/focus/warning kontradikcija. Upozorenje ograničene pripreme je dobro i nema automatskog napretka.

- **Potvrđena greška, 2026-11-27 (primary)**. Očekivano: Povratni opis bez uklonjenih ubrzanja. Stvarno: desc6×20 s bez strides objekta;11-30 i 12-07 ponavlja. Značenje: Potvrđen tekstualni dodatni brzi rad.

- **Potvrđena greška, 2026-11-30 (primary)**. Očekivano: Focus i broj povratnih nedelja prati program. Stvarno: N8/N9 Fartlek bez session;generic warning1 povratna nedelja, adjustment3. Značenje: Potvrđen metadata nesklad.

- **Trenerska zabrinutost, 2027-02-07 (primary)**. Očekivano: Pred4hmaraton mora postojati relevantna ponovljiva izdržljivost ili prilagođen nastup. Stvarno: Maksimalna budućaLR 8.8 km/~52.4 min;42.195 kmtrka02-28. Značenje: Potvrđen sadržaj, trenerska zabrinutost o spremnosti; ne prognoziram povredu,ne zahtevam univerzalnih32 km.

- **Trenerska zabrinutost, 2026-12-09 (protection)**. Očekivano: Sačuvani manual/measured kvalitet iz povratnog prozora posebno pregledati. Stvarno: Seed2×1400mT saoverrideWU ostaje uprkos početnim lakim nedeljama, warning postoji. Značenje: Očuvanje korisničkih izmena je ispravno; konflikt ostaje zadatak ručnog pregleda.

- **Datiran primer, 2027-02-28 (primary)**. Očekivano: Ritam izPB nije potvrda maratonske završivosti. Stvarno: Želja4 h uz upozorenje spremnost nije potvrđena. Značenje: Bolja komunikacija od garancije,ali plan ostaje ograničen.


## U10 — oprezan povratak sa tekstualnim greškama;maratonska spremnost ograničena

Događaj: `{"kind": "return", "date": "2026-11-25", "breakDays": 28, "breakPeriod": ["2026-10-29", "2026-11-25"]}`.

Stvarni ishod: Return sa potvrdom posle 28d;60 km→55%=33 km iLR 24→13.2; četiri početnekalendarske nedelje bez session/finish/strides. Iskustvo ostaje, trenutna forma nije pretpostavljena.

Očuvanje: 45 cutoff dan objekata identično; primarni log/rows/calendar/race/cilj očuvani. Seedmanual12-11 i measuredlock12-02 čuvaju se sa upozorenjem konflikta; inputi nisu mutirani.

Struktura: 11-29 LR 13.2/~81 min;12-06 13.9/~85 min;12-13 12.5;12-20deload10.4; kvalitet12-22;max LR 17.3/~106 min02-07 i 47.4 km/ned.

Doza: 12-22 3×60sT,90sjog;12-29 2×600mI/~5.4 min; kasnije M~10 min iT~13 min. Nema automatskog ubrzanja forme.

Oporavak: Razumno smanjenje nakon pauze; opet veliki jaz između~106 minLR i želje210 min maratona. PoslednjaLR12.1 km/~74 min02-21 sedam dana pre trke je konzervativnija od prvog plana.

Koherentnost: Potvrđen stale stride/focus/warning nesklad. Futuregrowthguard nije dokaz fiziološke bezbednosti, već provera lokalne isporuke.

- **Potvrđena greška, 2026-11-30 (primary)**. Očekivano: Opis potpuno prati uklonjeni strides objekat. Stvarno: 6×20 s u desc bez strides;12-02 i 12-07isto;12-14 4×15 s. Značenje: Korisnikdobija brzi dodatak uprkosstrukturnom easy return.

- **Potvrđena greška, 2026-12-07 (primary)**. Očekivano: Focus/najavljenepovratnenedelje odgovaraju programu. Stvarno: N9 Fartlek bez kvaliteta;generic warning2 nedelje, adjustment4. Značenje: Potvrđenkoherentnosni kvar.

- **Trenerska zabrinutost, 2027-02-07 (primary)**. Očekivano: Maratonskispremnost preispitati posle pauze. Stvarno: LR 17.3 km/~106 min,preparationlimited;cilj3:30 ostaje želja bez potvrde. Značenje: Ograničenje je dobro priznato; fiziološku odluku ne rešava55% polazni obim.

- **Datiran primer, 2026-12-22 (primary)**. Očekivano: Prvi kvalitet posle lakog bloka držati malim. Stvarno: 3×60 s @5:00/km sa90 s lagano. Značenje: Primer razumne kontrolisane doze.


## Dodatak: pregled svake buduće nedelje prihvaćenih event planova

Svi podaci u tabelama predstavljaju budući propis, ne izvršeno trčanje. Partial future km isključuje dane do cutoff-a; total km obuhvata istorijske sačuvane dane te nedelje. RP/T/I/R minuti su samo brzi rad, ne WU/CD/oporavak. Brza poslednja trećina progresivnog treninga računa se odvojeno. Dani sa LR finish-om računali bi se kao kvalitet. U ovim primarnim replanovima takav finish nije dodat kao skriveni treći kvalitet. Trka je iz kvaliteta i future peak-a isključena. Kratka ubrzanja u tekstu posebno su označena kada se struktura ne slaže.



### U02 PRIMARY

| N / početak | Total / future km | Budući dani i distance | Kvalitet: datum, zona, rad, pauza | LR: datum, km, približni min | Focus / deload |
|---|---:|---|---|---|---|
| N7 / 2026-11-23 | 32.5 / 14.3 | 2026-11-26:odmor/0; 2026-11-27:lako/5.1; 2026-11-28:odmor/0; 2026-11-29:lr/9.2 | bez session/finish kvaliteta | 2026-11-29 9.2km/56.7min |  / False |
| N8 / 2026-11-30 | 24.6 / 24.6 | 2026-11-30:lako/6.3; 2026-12-01:snaga/0; 2026-12-02:lako/3.5; 2026-12-03:odmor/0; 2026-12-04:lako/5.4; 2026-12-05:odmor/0; 2026-12-06:lr/9.4 | bez session/finish kvaliteta | 2026-12-06 9.4km/n/p | Fartlek / False |
| N9 / 2026-12-07 | 25.5 / 25.5 | 2026-12-07:lako/7.8; 2026-12-08:snaga/0; 2026-12-09:int/3.9; 2026-12-10:odmor/0; 2026-12-11:tempo/3.6; 2026-12-12:odmor/0; 2026-12-13:lr/10.2 | 2026-12-09 I 4.1min; pauza61s; 2026-12-11 T 5.0min; pauza90s | 2026-12-13 10.2km/62.9min | Piramida + Tempo isprekidan / False |
| N10 / 2026-12-14 | 18.6 / 18.6 | 2026-12-14:lako/4.2; 2026-12-15:snaga/0; 2026-12-16:lako/3.7; 2026-12-17:odmor/0; 2026-12-18:lako/3.4; 2026-12-19:odmor/0; 2026-12-20:lr/7.3 | bez session/finish kvaliteta | 2026-12-20 7.3km/45.0min | DELOAD — obim dole, ostaje kratka oštrina / True |
| N11 / 2026-12-21 | 26.7 / 26.7 | 2026-12-21:lako/8.6; 2026-12-22:snaga/0; 2026-12-23:int/3.6; 2026-12-24:odmor/0; 2026-12-25:tempo/3.8; 2026-12-26:odmor/0; 2026-12-27:lr/10.7 | 2026-12-23 I 4.5min; pauza102s; 2026-12-25 T 6.0min; pauza90s | 2026-12-27 10.7km/66.0min | Intervali + Tempo isprekidan / False |
| N12 / 2026-12-28 | 28.6 / 28.6 | 2026-12-28:lako/8.6; 2026-12-29:snaga/0; 2026-12-30:int/4; 2026-12-31:odmor/0; 2027-01-01:tempo/4.7; 2027-01-02:odmor/0; 2027-01-03:lr/11.3 | 2026-12-30 I 4.0min; pauza60s; 2027-01-01 T 10.5min; kontinuirano | 2027-01-03 11.3km/69.7min | Fartlek + Tempo / False |
| N13 / 2027-01-04 | 30.5 / 30.5 | 2027-01-04:lako/8.9; 2027-01-05:snaga/0; 2027-01-06:int/5; 2027-01-07:odmor/0; 2027-01-08:tempo/4.8; 2027-01-09:odmor/0; 2027-01-10:lr/11.8 | 2027-01-06 I 7.3min; pauza163s; 2027-01-08 T 7.0min; pauza90s | 2027-01-10 11.8km/72.8min | Intervali + Tempo isprekidan / False |
| N14 / 2027-01-11 | 30.2 / 30.2 | 2027-01-11:lako/9.4; 2027-01-12:snaga/0; 2027-01-13:int/4; 2027-01-14:odmor/0; 2027-01-15:tempo/4.8; 2027-01-16:odmor/0; 2027-01-17:lr/12 | 2027-01-13 I 5.4min; pauza122s; 2027-01-15 T 11.0min; kontinuirano | 2027-01-17 12km/74.0min | Intervali + Tempo / False |
| N15 / 2027-01-18 | 19.6 / 19.6 | 2027-01-18:lako/5.8; 2027-01-19:snaga/0; 2027-01-20:int/3.3; 2027-01-21:odmor/0; 2027-01-22:tempo/3.3; 2027-01-23:odmor/0; 2027-01-24:lr/7.2 | 2027-01-20 RP 5.7min; pauza86s; 2027-01-22 T 6.0min; kontinuirano | 2027-01-24 7.2km/44.4min | Taper · Trkački ritam + Tempo / False |
| N16 / 2027-01-25 | 12.8 / 12.8 | 2027-01-25:lako/2; 2027-01-26:odmor/0; 2027-01-27:lako/2; 2027-01-28:odmor/0; 2027-01-29:int/3.8; 2027-01-30:odmor/0; 2027-01-31:trka/5 | 2027-01-29 R 2.8min; pauza141s | — | TRKA / False |

### U03 PRIMARY

| N / početak | Total / future km | Budući dani i distance | Kvalitet: datum, zona, rad, pauza | LR: datum, km, približni min | Focus / deload |
|---|---:|---|---|---|---|
| N7 / 2026-11-23 | 54.2 / 22.3 | 2026-11-26:snaga/0; 2026-11-27:lako/8.2; 2026-11-28:odmor/0; 2026-11-29:lr/14.1 | bez session/finish kvaliteta | 2026-11-29 14.1km/76.1min |  / False |
| N8 / 2026-11-30 | 48.8 / 48.8 | 2026-11-30:lako/10.9; 2026-12-01:int/4.9; 2026-12-02:lako/9.5; 2026-12-03:snaga/0; 2026-12-04:lako/8.6; 2026-12-05:odmor/0; 2026-12-06:lr/14.9 | 2026-12-01 T 2.2min; pauza90s | 2026-12-06 14.9km/80.5min | Fartlek / False |
| N9 / 2026-12-07 | 50.3 / 50.3 | 2026-12-07:lako/11.9; 2026-12-08:int/5.9; 2026-12-09:lako/10.8; 2026-12-10:snaga/0; 2026-12-11:tempo/6; 2026-12-12:odmor/0; 2026-12-13:lr/15.7 | 2026-12-08 I 7.1min; pauza107s; 2026-12-11 T 9.6min; pauza90s | 2026-12-13 15.7km/84.8min | Piramida + Tempo isprekidan / False |
| N10 / 2026-12-14 | 36.6 / 36.6 | 2026-12-14:lako/7.4; 2026-12-15:lako/6.4; 2026-12-16:lako/5.8; 2026-12-17:snaga/0; 2026-12-18:lako/5.4; 2026-12-19:odmor/0; 2026-12-20:lr/11.6 | bez session/finish kvaliteta | 2026-12-20 11.6km/62.6min | DELOAD — obim dole, ostaje kratka oštrina / True |
| N11 / 2026-12-21 | 52.8 / 52.8 | 2026-12-21:lako/12.7; 2026-12-22:int/5.9; 2026-12-23:lako/11; 2026-12-24:snaga/0; 2026-12-25:tempo/6.6; 2026-12-26:odmor/0; 2026-12-27:lr/16.6 | 2026-12-22 I 8.7min; pauza196s; 2026-12-25 T 12.3min; pauza90s | 2026-12-27 16.6km/89.6min | Intervali + Tempo isprekidan / False |
| N12 / 2026-12-28 | 54.3 / 54.3 | 2026-12-28:lako/13.3; 2026-12-29:int/6.2; 2026-12-30:lako/11.6; 2026-12-31:snaga/0; 2027-01-01:tempo/6.6; 2027-01-02:odmor/0; 2027-01-03:lr/16.6 | 2026-12-29 I 6.0min; pauza60s; 2027-01-01 T 13.6min; kontinuirano | 2027-01-03 16.6km/89.6min | Fartlek + Tempo / False |
| N13 / 2027-01-04 | 56.5 / 56.5 | 2027-01-04:lako/13.3; 2027-01-05:int/7.1; 2027-01-06:lako/11.5; 2027-01-07:snaga/0; 2027-01-08:tempo/8; 2027-01-09:odmor/0; 2027-01-10:lr/16.6 | 2027-01-05 I 9.5min; pauza213s; 2027-01-08 T 14.0min; pauza90s | 2027-01-10 16.6km/89.6min | Intervali + Tempo isprekidan / False |
| N14 / 2027-01-11 | 54.2 / 54.2 | 2027-01-11:lako/13.3; 2027-01-12:int/7.1; 2027-01-13:lako/11.5; 2027-01-14:snaga/0; 2027-01-15:tempo/5.7; 2027-01-16:odmor/0; 2027-01-17:lr/16.6 | 2027-01-12 I 11.8min; pauza107s; 2027-01-15 T 9.6min; kontinuirano | 2027-01-17 16.6km/89.6min | Intervali + Tempo / False |
| N15 / 2027-01-18 | 34.1 / 34.1 | 2027-01-18:lako/7.9; 2027-01-19:int/4; 2027-01-20:lako/6.8; 2027-01-21:snaga/0; 2027-01-22:tempo/5.5; 2027-01-23:odmor/0; 2027-01-24:lr/9.9 | 2027-01-19 RP 4.9min; pauza74s; 2027-01-22 T 9.2min; kontinuirano | 2027-01-24 9.9km/53.5min | Taper · Trkački ritam + Tempo / False |
| N16 / 2027-01-25 | 15.5 / 15.5 | 2027-01-25:odmor/0; 2027-01-26:lako/3; 2027-01-27:lako/3; 2027-01-28:odmor/0; 2027-01-29:int/4.5; 2027-01-30:odmor/0; 2027-01-31:trka/5 | 2027-01-29 R 2.4min; pauza122s | — | TRKA / False |

### U04 PRIMARY

| N / početak | Total / future km | Budući dani i distance | Kvalitet: datum, zona, rad, pauza | LR: datum, km, približni min | Focus / deload |
|---|---:|---|---|---|---|
| N7 / 2026-11-23 | 28.9 / 12.6 | 2026-11-26:odmor/0; 2026-11-27:lako/4.8(+tekst ubrz, bez objekta); 2026-11-28:odmor/0; 2026-11-29:lr/7.8 | bez session/finish kvaliteta | 2026-11-29 7.8km/50.4min | Baza — aerobni obim, bez kvaliteta / False |
| N8 / 2026-11-30 | 26.4 / 26.4 | 2026-11-30:lako/6.2(+tekst ubrz, bez objekta); 2026-12-01:snaga/0; 2026-12-02:lako/6.2; 2026-12-03:odmor/0; 2026-12-04:lako/5.8; 2026-12-05:odmor/0; 2026-12-06:lr/8.2 | bez session/finish kvaliteta | 2026-12-06 8.2km/53.0min | Fartlek / False |
| N9 / 2026-12-07 | 27.6 / 27.6 | 2026-12-07:lako/6.6; 2026-12-08:snaga/0; 2026-12-09:int/6.5; 2026-12-10:odmor/0; 2026-12-11:lako/5.9; 2026-12-12:odmor/0; 2026-12-13:lr/8.6 | 2026-12-09 T 2.2min; pauza90s | 2026-12-13 8.6km/55.6min | Fartlek / False |
| N10 / 2026-12-14 | 20.0 / 20.0 | 2026-12-14:lako/5.1; 2026-12-15:snaga/0; 2026-12-16:lako/4.5; 2026-12-17:odmor/0; 2026-12-18:lako/4; 2026-12-19:odmor/0; 2026-12-20:lr/6.4 | bez session/finish kvaliteta | 2026-12-20 6.4km/41.4min | DELOAD — obim dole, ostaje kratka oštrina / True |
| N11 / 2026-12-21 | 29.7 / 29.7 | 2026-12-21:lako/7.3; 2026-12-22:snaga/0; 2026-12-23:int/6.4; 2026-12-24:odmor/0; 2026-12-25:tempo/6.9; 2026-12-26:odmor/0; 2026-12-27:lr/9.1 | 2026-12-23 I 4.8min; pauza107s; 2026-12-25 T 9.0min; kontinuirano | 2026-12-27 9.1km/58.8min | Intervali + Tempo / False |
| N12 / 2026-12-28 | 30.7 / 30.7 | 2026-12-28:lako/7.3; 2026-12-29:snaga/0; 2026-12-30:int/7; 2026-12-31:odmor/0; 2027-01-01:tempo/6.8; 2027-01-02:odmor/0; 2027-01-03:lr/9.6 | 2026-12-30 I 6.7min; pauza150s; 2027-01-01 T 6.3min; pauza90s | 2027-01-03 9.6km/62.1min | Intervali + Tempo isprekidan / False |
| N13 / 2027-01-04 | 32.2 / 32.2 | 2027-01-04:lako/7.7; 2027-01-05:snaga/0; 2027-01-06:int/7.2; 2027-01-07:odmor/0; 2027-01-08:tempo/7.2; 2027-01-09:odmor/0; 2027-01-10:lr/10.1 | 2027-01-06 I 6.0min; pauza90s; 2027-01-08 T 11.6min; kontinuirano | 2027-01-10 10.1km/65.3min | Fartlek + Tempo / False |
| N14 / 2027-01-11 | 31.6 / 31.6 | 2027-01-11:lako/8.1; 2027-01-12:snaga/0; 2027-01-13:int/8.1; 2027-01-14:odmor/0; 2027-01-15:tempo/4.7; 2027-01-16:odmor/0; 2027-01-17:lr/10.7 | 2027-01-13 RP 10.4min; pauza233s; 2027-01-15 T 8.3min; kontinuirano | 2027-01-17 10.7km/69.2min | Trkački ritam + Progresivno / False |
| N15 / 2027-01-18 | 20.5 / 20.5 | 2027-01-18:lako/5.5; 2027-01-19:snaga/0; 2027-01-20:int/3.2; 2027-01-21:odmor/0; 2027-01-22:lako/4.9; 2027-01-23:odmor/0; 2027-01-24:lr/6.9 | 2027-01-20 RP 6.2min; pauza140s | 2027-01-24 6.9km/44.6min | Taper · Trkački ritam / False |
| N16 / 2027-01-25 | 17.5 / 17.5 | 2027-01-25:lako/2.5; 2027-01-26:odmor/0; 2027-01-27:lako/2.5; 2027-01-28:odmor/0; 2027-01-29:lako/2.5; 2027-01-30:odmor/0; 2027-01-31:trka/10 | bez session/finish kvaliteta | — | TRKA / False |

### U05 old PRIMARY

| N / početak | Total / future km | Budući dani i distance | Kvalitet: datum, zona, rad, pauza | LR: datum, km, približni min | Focus / deload |
|---|---:|---|---|---|---|
| N7 / 2026-11-23 | 60.9 / 29.6 | 2026-11-26:snaga/0; 2026-11-27:tempo/11.2; 2026-11-28:odmor/0; 2026-11-29:lr/18.4 | 2026-11-27 T 27.6min; pauza90s | 2026-11-29 18.4km/104.3min | Intervali + Tempo isprekidan / False |
| N8 / 2026-11-30 | 45.7 / 45.7 | 2026-11-30:lako/9.6; 2026-12-01:int/6.6; 2026-12-02:lako/8.3; 2026-12-03:snaga/0; 2026-12-04:lako/7.5; 2026-12-05:odmor/0; 2026-12-06:lr/13.7 | 2026-12-01 R 4.8min; pauza120s | 2026-12-06 13.7km/77.6min | DELOAD — obim dole, ostaje kratka oštrina / True |
| N9 / 2026-12-07 | 62.3 / 62.3 | 2026-12-07:lako/9.6; 2026-12-08:int/10.7; 2026-12-09:lako/10.5; 2026-12-10:snaga/0; 2026-12-11:tempo/13; 2026-12-12:odmor/0; 2026-12-13:lr/18.5 | 2026-12-08 I 14.9min; pauza224s; 2026-12-11 T 27.6min; pauza90s | 2026-12-13 18.5km/104.8min | Piramida + Tempo isprekidan / False |
| N10 / 2026-12-14 | 66.3 / 66.3 | 2026-12-14:lako/12; 2026-12-15:int/13.5; 2026-12-16:lako/10.4; 2026-12-17:snaga/0; 2026-12-18:tempo/11.9; 2026-12-19:odmor/0; 2026-12-20:lr/18.5 | 2026-12-15 I 16.5min; pauza90s; 2026-12-18 T 24.8min; kontinuirano | 2026-12-20 18.5km/104.8min | Fartlek + Tempo / False |
| N11 / 2026-12-21 | 65.6 / 65.6 | 2026-12-21:lako/12; 2026-12-22:int/11.6; 2026-12-23:lako/10.5; 2026-12-24:snaga/0; 2026-12-25:tempo/13; 2026-12-26:odmor/0; 2026-12-27:lr/18.5 | 2026-12-22 I 14.9min; pauza224s; 2026-12-25 T 27.6min; pauza90s | 2026-12-27 18.5km/104.8min | Intervali + Tempo isprekidan / False |
| N12 / 2026-12-28 | 49.3 / 49.3 | 2026-12-28:lako/10.3; 2026-12-29:int/7.1; 2026-12-30:lako/8.9; 2026-12-31:snaga/0; 2027-01-01:lako/8.1; 2027-01-02:odmor/0; 2027-01-03:lr/14.9 | 2026-12-29 R 4.8min; pauza120s | 2027-01-03 14.9km/84.4min | DELOAD — obim dole, ostaje kratka oštrina / True |
| N13 / 2027-01-04 | 64.0 / 64.0 | 2027-01-04:lako/10.4; 2027-01-05:int/12.3; 2027-01-06:lako/10.4; 2027-01-07:snaga/0; 2027-01-08:tempo/12.4; 2027-01-09:odmor/0; 2027-01-10:lr/18.5 | 2027-01-05 RP 27.0min; pauza60s; 2027-01-08 T 19.0min; kontinuirano | 2027-01-10 18.5km/104.8min | Trkački ritam + Progresivno / False |
| N14 / 2027-01-11 | 64.4 / 64.4 | 2027-01-11:lako/12; 2027-01-12:int/11.6; 2027-01-13:lako/10.4; 2027-01-14:snaga/0; 2027-01-15:tempo/11.9; 2027-01-16:odmor/0; 2027-01-17:lr/18.5 | 2027-01-12 RP 21.6min; pauza75s; 2027-01-15 T 24.8min; kontinuirano | 2027-01-17 18.5km/104.8min | Trkački ritam + Tempo / False |
| N15 / 2027-01-18 | 43.2 / 43.2 | 2027-01-18:lako/9.6; 2027-01-19:int/4.9; 2027-01-20:lako/9.2; 2027-01-21:snaga/0; 2027-01-22:tempo/7.5; 2027-01-23:odmor/0; 2027-01-24:lr/12 | 2027-01-19 RP 8.1min; pauza75s; 2027-01-22 T 18.4min; kontinuirano | 2027-01-24 12km/68.0min | Taper · Trkački ritam + Tempo / False |
| N16 / 2027-01-25 | 20.5 / 20.5 | 2027-01-25:odmor/0; 2027-01-26:lako/3; 2027-01-27:lako/3; 2027-01-28:odmor/0; 2027-01-29:int/4.5; 2027-01-30:odmor/0; 2027-01-31:trka/10 | 2027-01-29 R 4.4min; pauza133s | — | TRKA / False |

### U05 new PRIMARY

| N / početak | Total / future km | Budući dani i distance | Kvalitet: datum, zona, rad, pauza | LR: datum, km, približni min | Focus / deload |
|---|---:|---|---|---|---|
| N7 / 2026-11-23 | 62.1 / 27.8 | 2026-11-26:snaga/0; 2026-11-27:tempo/9.3; 2026-11-28:odmor/0; 2026-11-29:lr/18.5 | 2026-11-27 T 16.6min; pauza90s | 2026-11-29 18.5km/104.8min | Intervali + Tempo isprekidan / False |
| N8 / 2026-11-30 | 46.6 / 46.6 | 2026-11-30:lako/9.7; 2026-12-01:lako/8.4; 2026-12-02:lako/7.6; 2026-12-03:snaga/0; 2026-12-04:lako/7.1; 2026-12-05:odmor/0; 2026-12-06:lr/13.8 | bez session/finish kvaliteta | 2026-12-06 13.8km/78.2min | DELOAD — obim dole, ostaje kratka oštrina / True |
| N9 / 2026-12-07 | 65.1 / 65.1 | 2026-12-07:lako/14; 2026-12-08:int/10.1; 2026-12-09:lako/12.2; 2026-12-10:snaga/0; 2026-12-11:tempo/10.3; 2026-12-12:odmor/0; 2026-12-13:lr/18.5 | 2026-12-08 I 12.4min; pauza187s; 2026-12-11 T 16.6min; pauza90s | 2026-12-13 18.5km/104.8min | Piramida + Tempo isprekidan / False |
| N10 / 2026-12-14 | 68.2 / 68.2 | 2026-12-14:lako/14; 2026-12-15:int/12.2; 2026-12-16:lako/12.2; 2026-12-17:snaga/0; 2026-12-18:tempo/11.3; 2026-12-19:odmor/0; 2026-12-20:lr/18.5 | 2026-12-15 I 13.5min; pauza90s; 2026-12-18 T 22.1min; kontinuirano | 2026-12-20 18.5km/104.8min | Fartlek + Tempo / False |
| N11 / 2026-12-21 | 65.2 / 65.2 | 2026-12-21:lako/14; 2026-12-22:int/9.9; 2026-12-23:lako/12.1; 2026-12-24:snaga/0; 2026-12-25:tempo/10.7; 2026-12-26:odmor/0; 2026-12-27:lr/18.5 | 2026-12-22 I 10.0min; pauza224s; 2026-12-25 T 18.4min; pauza90s | 2026-12-27 18.5km/104.8min | Intervali + Tempo isprekidan / False |
| N12 / 2026-12-28 | 48.9 / 48.9 | 2026-12-28:lako/10.5; 2026-12-29:lako/9.2; 2026-12-30:lako/8.2; 2026-12-31:snaga/0; 2027-01-01:lako/7.8; 2027-01-02:odmor/0; 2027-01-03:lr/13.2 | bez session/finish kvaliteta | 2027-01-03 13.2km/74.8min | DELOAD — obim dole, ostaje kratka oštrina / True |
| N13 / 2027-01-04 | 65.6 / 65.6 | 2027-01-04:lako/14; 2027-01-05:int/9.2; 2027-01-06:lako/12.1; 2027-01-07:snaga/0; 2027-01-08:tempo/11.8; 2027-01-09:odmor/0; 2027-01-10:lr/18.5 | 2027-01-05 RP 16.2min; pauza240s; 2027-01-08 T 18.1min; kontinuirano | 2027-01-10 18.5km/104.8min | Trkački ritam + Progresivno / False |
| N14 / 2027-01-11 | 65.9 / 65.9 | 2027-01-11:lako/14; 2027-01-12:int/9.9; 2027-01-13:lako/12.2; 2027-01-14:snaga/0; 2027-01-15:tempo/11.3; 2027-01-16:odmor/0; 2027-01-17:lr/18.5 | 2027-01-12 RP 14.4min; pauza240s; 2027-01-15 T 22.1min; kontinuirano | 2027-01-17 18.5km/104.8min | Trkački ritam + Tempo / False |
| N15 / 2027-01-18 | 40.9 / 40.9 | 2027-01-18:lako/9.6; 2027-01-19:int/4.2; 2027-01-20:lako/8.3; 2027-01-21:snaga/0; 2027-01-22:tempo/6.8; 2027-01-23:odmor/0; 2027-01-24:lr/12 | 2027-01-19 RP 5.4min; pauza122s; 2027-01-22 T 15.2min; kontinuirano | 2027-01-24 12km/68.0min | Taper · Trkački ritam + Tempo / False |
| N16 / 2027-01-25 | 20.5 / 20.5 | 2027-01-25:odmor/0; 2027-01-26:lako/3; 2027-01-27:lako/3; 2027-01-28:odmor/0; 2027-01-29:int/4.5; 2027-01-30:odmor/0; 2027-01-31:trka/10 | 2027-01-29 R 4.4min; pauza133s | — | TRKA / False |

### U06 PRIMARY

| N / početak | Total / future km | Budući dani i distance | Kvalitet: datum, zona, rad, pauza | LR: datum, km, približni min | Focus / deload |
|---|---:|---|---|---|---|
| N7 / 2026-11-23 | 11.0 / 2.5 | 2026-11-26:odmor/0; 2026-11-27:odmor/0; 2026-11-28:odmor/0; 2026-11-29:lr/2.5 | bez session/finish kvaliteta | 2026-11-29 2.5km/17.4min | Baza — aerobni obim, bez kvaliteta / False |
| N8 / 2026-11-30 | 7.5 / 7.5 | 2026-11-30:lako/2.2(+tekst ubrz, bez objekta); 2026-12-01:snaga/0; 2026-12-02:lako/2.4; 2026-12-03:odmor/0; 2026-12-04:odmor/0; 2026-12-05:odmor/0; 2026-12-06:lr/2.9 | bez session/finish kvaliteta | 2026-12-06 2.9km/20.2min | Baza — aerobni obim, bez kvaliteta / False |
| N9 / 2026-12-07 | 8.0 / 8.0 | 2026-12-07:lako/2.1; 2026-12-08:snaga/0; 2026-12-09:lako/2.9; 2026-12-10:odmor/0; 2026-12-11:odmor/0; 2026-12-12:odmor/0; 2026-12-13:lr/3 | bez session/finish kvaliteta | 2026-12-13 3km/n/p | Fartlek / False |
| N10 / 2026-12-14 | 6.8 / 6.8 | 2026-12-14:lako/2.1(+tekst ubrz, bez objekta); 2026-12-15:snaga/0; 2026-12-16:lako/2.1; 2026-12-17:odmor/0; 2026-12-18:odmor/0; 2026-12-19:odmor/0; 2026-12-20:lr/2.6 | bez session/finish kvaliteta | 2026-12-20 2.6km/18.1min | DELOAD — obim dole, ostaje kratka oštrina / True |
| N11 / 2026-12-21 | 8.4 / 8.4 | 2026-12-21:lako/2.4; 2026-12-22:snaga/0; 2026-12-23:lako/2.9; 2026-12-24:odmor/0; 2026-12-25:odmor/0; 2026-12-26:odmor/0; 2026-12-27:lr/3.1 | bez session/finish kvaliteta | 2026-12-27 3.1km/n/p | Fartlek / False |
| N12 / 2026-12-28 | 8.9 / 8.9 | 2026-12-28:lako/2.4; 2026-12-29:snaga/0; 2026-12-30:lako/3.2; 2026-12-31:odmor/0; 2027-01-01:odmor/0; 2027-01-02:odmor/0; 2027-01-03:lr/3.3 | bez session/finish kvaliteta | 2027-01-03 3.3km/n/p | Fartlek / False |
| N13 / 2027-01-04 | 9.5 / 9.5 | 2027-01-04:lako/2.7; 2027-01-05:snaga/0; 2027-01-06:lako/3.3; 2027-01-07:odmor/0; 2027-01-08:odmor/0; 2027-01-09:odmor/0; 2027-01-10:lr/3.5 | bez session/finish kvaliteta | 2027-01-10 3.5km/n/p | Tempo / False |
| N14 / 2027-01-11 | 10.1 / 10.1 | 2027-01-11:lako/3; 2027-01-12:snaga/0; 2027-01-13:lako/3.1; 2027-01-14:odmor/0; 2027-01-15:odmor/0; 2027-01-16:odmor/0; 2027-01-17:lr/4 | bez session/finish kvaliteta | 2027-01-17 4km/n/p | Progresivno / False |
| N15 / 2027-01-18 | 9.3 / 9.3 | 2027-01-18:lako/2.7; 2027-01-19:snaga/0; 2027-01-20:int/3.2; 2027-01-21:odmor/0; 2027-01-22:odmor/0; 2027-01-23:odmor/0; 2027-01-24:lr/3.4 | 2027-01-20 RP 7.2min; pauza162s | 2027-01-24 3.4km/23.6min | Taper · Trkački ritam / False |
| N16 / 2027-01-25 | 12.4 / 12.4 | 2027-01-25:lako/1.2; 2027-01-26:odmor/0; 2027-01-27:lako/1.2; 2027-01-28:odmor/0; 2027-01-29:odmor/0; 2027-01-30:odmor/0; 2027-01-31:trka/10 | bez session/finish kvaliteta | — | TRKA / False |

### U07 PRIMARY

| N / početak | Total / future km | Budući dani i distance | Kvalitet: datum, zona, rad, pauza | LR: datum, km, približni min | Focus / deload |
|---|---:|---|---|---|---|
| N7 / 2026-11-23 | 33.7 / 14.8 | 2026-11-26:odmor/0; 2026-11-27:lako/6.1; 2026-11-28:odmor/0; 2026-11-29:lr/8.7 | bez session/finish kvaliteta | 2026-11-29 8.7km/53.6min |  / False |
| N8 / 2026-11-30 | 27.6 / 27.6 | 2026-11-30:lako/6.8; 2026-12-01:snaga/0; 2026-12-02:lako/5.6; 2026-12-03:odmor/0; 2026-12-04:lako/6.3; 2026-12-05:odmor/0; 2026-12-06:lr/8.9 | bez session/finish kvaliteta | 2026-12-06 8.9km/n/p | Fartlek / False |
| N9 / 2026-12-07 | 29.7 / 29.7 | 2026-12-07:lako/7.3; 2026-12-08:snaga/0; 2026-12-09:lako/6.2; 2026-12-10:odmor/0; 2026-12-11:lako/6.6; 2026-12-12:odmor/0; 2026-12-13:lr/9.6 | bez session/finish kvaliteta | 2026-12-13 9.6km/n/p | Tempo isprekidan / False |
| N10 / 2026-12-14 | 22.5 / 22.5 | 2026-12-14:lako/5.8; 2026-12-15:snaga/0; 2026-12-16:lako/5; 2026-12-17:odmor/0; 2026-12-18:lako/4.5; 2026-12-19:odmor/0; 2026-12-20:lr/7.2 | bez session/finish kvaliteta | 2026-12-20 7.2km/44.4min | DELOAD — obim dole, ostaje kratka oštrina / True |
| N11 / 2026-12-21 | 32.1 / 32.1 | 2026-12-21:lako/8.1; 2026-12-22:snaga/0; 2026-12-23:tempo/6.7; 2026-12-24:odmor/0; 2026-12-25:lako/7.1; 2026-12-26:odmor/0; 2026-12-27:lr/10.2 | 2026-12-23 T 6.0min; pauza60s | 2026-12-27 10.2km/62.9min | Tempo isprekidan / False |
| N12 / 2026-12-28 | 33.7 / 33.7 | 2026-12-28:lako/8; 2026-12-29:snaga/0; 2026-12-30:tempo/7.9; 2026-12-31:odmor/0; 2027-01-01:lako/7; 2027-01-02:odmor/0; 2027-01-03:lr/10.8 | 2026-12-30 RP 25.9min; kontinuirano | 2027-01-03 10.8km/66.6min | Kontrolna trka / False |
| N13 / 2027-01-04 | 36.0 / 36.0 | 2027-01-04:lako/8.6; 2027-01-05:snaga/0; 2027-01-06:int/8.6; 2027-01-07:odmor/0; 2027-01-08:tempo/7.4; 2027-01-09:odmor/0; 2027-01-10:lr/11.4 | 2027-01-06 RP 14.5min; pauza326s; 2027-01-08 T 12.0min; kontinuirano | 2027-01-10 11.4km/70.3min | Tempo trke + Tempo / False |
| N14 / 2027-01-11 | 28.9 / 28.9 | 2027-01-11:lako/7.7; 2027-01-12:snaga/0; 2027-01-13:tempo/4.9; 2027-01-14:odmor/0; 2027-01-15:lako/6.7; 2027-01-16:odmor/0; 2027-01-17:lr/9.6 | 2027-01-13 T 10.5min; kontinuirano | 2027-01-17 9.6km/59.2min | Taper · Tempo / False |
| N15 / 2027-01-18 | 21.8 / 21.8 | 2027-01-18:lako/5.9; 2027-01-19:snaga/0; 2027-01-20:tempo/3.4; 2027-01-21:odmor/0; 2027-01-22:lako/5.1; 2027-01-23:odmor/0; 2027-01-24:lr/7.4 | 2027-01-20 RP 8.3min; kontinuirano | 2027-01-24 7.4km/45.6min | Taper · Tempo trke / False |
| N16 / 2027-01-25 | 31.1 / 31.1 | 2027-01-25:lako/2.8; 2027-01-26:odmor/0; 2027-01-27:lako/2.8; 2027-01-28:odmor/0; 2027-01-29:int/4.4; 2027-01-30:odmor/0; 2027-01-31:trka/21.0975 | 2027-01-29 R 6.1min; pauza154s | — | TRKA / False |

### U08 EARLIER — zasebna simulacija

| N / početak | Total / future km | Budući dani i distance | Kvalitet: datum, zona, rad, pauza | LR: datum, km, približni min | Focus / deload |
|---|---:|---|---|---|---|
| N3 / 2026-10-26 | 49.9 / 17.1 | 2026-10-29:snaga/0; 2026-10-30:lako/5.9(+tekst ubrz, bez objekta); 2026-10-31:odmor/0; 2026-11-01:lr/11.2 | bez session/finish kvaliteta | 2026-11-01 11.2km/60.5min | Baza — aerobni obim, bez kvaliteta / False |
| N4 / 2026-11-02 | 39.3 / 39.3 | 2026-11-02:lako/7.1(+tekst ubrz, bez objekta); 2026-11-03:lako/6.7; 2026-11-04:lr/7.3; 2026-11-05:snaga/0; 2026-11-06:lako/6.4; 2026-11-07:odmor/0; 2026-11-08:lr/11.8 | bez session/finish kvaliteta | 2026-11-04 7.3km/39.4min; 2026-11-08 11.8km/63.7min | Fartlek / False |
| N5 / 2026-11-09 | 40.9 / 40.9 | 2026-11-09:lako/7.5(+tekst ubrz, bez objekta); 2026-11-10:lako/6.3; 2026-11-11:lr/7.8; 2026-11-12:snaga/0; 2026-11-13:lako/6.8; 2026-11-14:odmor/0; 2026-11-15:lr/12.5 | bez session/finish kvaliteta | 2026-11-11 7.8km/42.1min; 2026-11-15 12.5km/67.5min | Fartlek / False |
| N6 / 2026-11-16 | 30.9 / 30.9 | 2026-11-16:lako/5.7; 2026-11-17:lako/5.2; 2026-11-18:lr/5.8; 2026-11-19:snaga/0; 2026-11-20:lako/4.9; 2026-11-21:odmor/0; 2026-11-22:lr/9.3 | bez session/finish kvaliteta | 2026-11-18 5.8km/31.3min; 2026-11-22 9.3km/50.2min | DELOAD — obim dole, ostaje kratka oštrina / True |
| N7 / 2026-11-23 | 43.0 / 43.0 | 2026-11-23:lako/7.5; 2026-11-24:int/6.7; 2026-11-25:lr/8.2; 2026-11-26:snaga/0; 2026-11-27:tempo/7.4; 2026-11-28:odmor/0; 2026-11-29:lr/13.2 | 2026-11-24 I 4.7min; pauza107s; 2026-11-27 T 9.2min; kontinuirano | 2026-11-25 8.2km/44.3min; 2026-11-29 13.2km/71.3min | Intervali + Tempo / False |
| N8 / 2026-11-30 | 44.1 / 44.1 | 2026-11-30:lako/8.4; 2026-12-01:int/6.3; 2026-12-02:lr/8.6; 2026-12-03:snaga/0; 2026-12-04:tempo/6.9; 2026-12-05:odmor/0; 2026-12-06:lr/13.9 | 2026-12-01 I 5.5min; pauza124s; 2026-12-04 T 8.8min; pauza60s | 2026-12-02 8.6km/46.4min; 2026-12-06 13.9km/75.1min | Intervali + Tempo isprekidan / False |
| N9 / 2026-12-07 | 46.1 / 46.1 | 2026-12-07:lako/8.6; 2026-12-08:int/6.7; 2026-12-09:lr/9.1; 2026-12-10:snaga/0; 2026-12-11:tempo/7; 2026-12-12:odmor/0; 2026-12-13:lr/14.7 | 2026-12-08 I 6.0min; pauza90s; 2026-12-11 T 11.8min; kontinuirano | 2026-12-09 9.1km/49.1min; 2026-12-13 14.7km/79.4min | Fartlek + Tempo / False |
| N10 / 2026-12-14 | 34.9 / 34.9 | 2026-12-14:lako/6.6; 2026-12-15:tempo/4.6; 2026-12-16:lr/6.8; 2026-12-17:snaga/0; 2026-12-18:lako/5.9; 2026-12-19:odmor/0; 2026-12-20:lr/11 | 2026-12-15 T 7.0min; kontinuirano | 2026-12-16 6.8km/36.7min; 2026-12-20 11km/59.4min | DELOAD — obim dole, ostaje kratka oštrina / True |
| N11 / 2026-12-21 | 49.0 / 49.0 | 2026-12-21:lako/7.3; 2026-12-22:tempo/10.5; 2026-12-23:lr/9.3; 2026-12-24:snaga/0; 2026-12-25:lako/6.6; 2026-12-26:odmor/0; 2026-12-27:lr/15.3 | 2026-12-22 RP 31.5min; kontinuirano | 2026-12-23 9.3km/50.2min; 2026-12-27 15.3km/82.6min | Kontrolna trka / False |
| N12 / 2026-12-28 | 40.0 / 40.0 | 2026-12-28:lako/6.3; 2026-12-29:int/7.1; 2026-12-30:lr/7.2; 2026-12-31:snaga/0; 2027-01-01:tempo/6.4; 2027-01-02:odmor/0; 2027-01-03:lr/13 | 2026-12-29 RP 12.6min; pauza284s; 2027-01-01 T 12.7min; kontinuirano | 2026-12-30 7.2km/38.9min; 2027-01-03 13km/70.2min | Taper · Tempo trke + Tempo / False |
| N13 / 2027-01-04 | 32.8 / 32.8 | 2027-01-04:lako/6.9; 2027-01-05:tempo/5.2; 2027-01-06:lr/5.4; 2027-01-07:snaga/0; 2027-01-08:tempo/5.4; 2027-01-09:odmor/0; 2027-01-10:lr/9.9 | 2027-01-05 RP 10.8min; kontinuirano; 2027-01-08 T 8.3min; kontinuirano | 2027-01-06 5.4km/29.2min; 2027-01-10 9.9km/53.5min | Taper · Tempo trke + Tempo / False |
| N14 / 2027-01-11 | 30.1 / 30.1 | 2027-01-11:odmor/0; 2027-01-12:lako/3; 2027-01-13:lako/3; 2027-01-14:odmor/0; 2027-01-15:lako/3; 2027-01-16:odmor/0; 2027-01-17:trka/21.0975 | bez session/finish kvaliteta | — | TRKA / False |

### U09 PRIMARY

| N / početak | Total / future km | Budući dani i distance | Kvalitet: datum, zona, rad, pauza | LR: datum, km, približni min | Focus / deload |
|---|---:|---|---|---|---|
| N7 / 2026-11-23 | 27.8 / 11.1 | 2026-11-26:odmor/0; 2026-11-27:lako/4.1(+tekst ubrz, bez objekta); 2026-11-28:odmor/0; 2026-11-29:lr/7 | bez session/finish kvaliteta | 2026-11-29 7km/41.6min | Baza — aerobni obim, bez kvaliteta / False |
| N8 / 2026-11-30 | 21.8 / 21.8 | 2026-11-30:lako/5.6(+tekst ubrz, bez objekta); 2026-12-01:snaga/0; 2026-12-02:lako/5.2; 2026-12-03:odmor/0; 2026-12-04:lako/3.6; 2026-12-05:odmor/0; 2026-12-06:lr/7.4 | bez session/finish kvaliteta | 2026-12-06 7.4km/44.0min | Fartlek / False |
| N9 / 2026-12-07 | 22.7 / 22.7 | 2026-12-07:lako/5.3(+tekst ubrz, bez objekta); 2026-12-08:snaga/0; 2026-12-09:lako/4.5; 2026-12-10:odmor/0; 2026-12-11:lako/6.3; 2026-12-12:odmor/0; 2026-12-13:lr/6.6 | bez session/finish kvaliteta | 2026-12-13 6.6km/39.3min | Fartlek / False |
| N10 / 2026-12-14 | 17.1 / 17.1 | 2026-12-14:lako/4.4; 2026-12-15:snaga/0; 2026-12-16:lako/3.8; 2026-12-17:odmor/0; 2026-12-18:lako/3.4; 2026-12-19:odmor/0; 2026-12-20:lr/5.5 | bez session/finish kvaliteta | 2026-12-20 5.5km/32.7min | DELOAD — obim dole, ostaje kratka oštrina / True |
| N11 / 2026-12-21 | 24.3 / 24.3 | 2026-12-21:lako/5.7; 2026-12-22:snaga/0; 2026-12-23:lako/5; 2026-12-24:odmor/0; 2026-12-25:lako/6.2; 2026-12-26:odmor/0; 2026-12-27:lr/7.4 | bez session/finish kvaliteta | 2026-12-27 7.4km/n/p | Tempo isprekidan / False |
| N12 / 2026-12-28 | 24.2 / 24.2 | 2026-12-28:lako/5.6; 2026-12-29:snaga/0; 2026-12-30:lako/4.9; 2026-12-31:odmor/0; 2027-01-01:tempo/6.7; 2027-01-02:odmor/0; 2027-01-03:lr/7 | 2027-01-01 T 5.8min; pauza60s | 2027-01-03 7km/41.6min | Tempo isprekidan / False |
| N13 / 2027-01-04 | 26.2 / 26.2 | 2027-01-04:lako/5.6; 2027-01-05:snaga/0; 2027-01-06:lako/5.7; 2027-01-07:odmor/0; 2027-01-08:tempo/6.7; 2027-01-09:odmor/0; 2027-01-10:lr/8.2 | 2027-01-08 T 5.8min; pauza60s | 2027-01-10 8.2km/48.8min | Tempo isprekidan / False |
| N14 / 2027-01-11 | 19.1 / 19.1 | 2027-01-11:lako/4.9; 2027-01-12:snaga/0; 2027-01-13:lako/4.3; 2027-01-14:odmor/0; 2027-01-15:lako/3.8; 2027-01-16:odmor/0; 2027-01-17:lr/6.1 | bez session/finish kvaliteta | 2027-01-17 6.1km/36.3min | DELOAD — obim dole, ostaje kratka oštrina / True |
| N15 / 2027-01-18 | 25.1 / 25.1 | 2027-01-18:lako/5.8; 2027-01-19:snaga/0; 2027-01-20:lako/5.1; 2027-01-21:odmor/0; 2027-01-22:int/6.9; 2027-01-23:odmor/0; 2027-01-24:lr/7.3 | 2027-01-22 I 7.0min; pauza157s | 2027-01-24 7.3km/43.4min | Intervali / False |
| N16 / 2027-01-25 | 27.0 / 27.0 | 2027-01-25:lako/5.7; 2027-01-26:snaga/0; 2027-01-27:lako/5.9; 2027-01-28:odmor/0; 2027-01-29:lako/6.9; 2027-01-30:odmor/0; 2027-01-31:lr/8.5 | bez session/finish kvaliteta | 2027-01-31 8.5km/n/p | Tempo isprekidan / False |
| N17 / 2027-02-01 | 29.0 / 29.0 | 2027-02-01:lako/6.7; 2027-02-02:snaga/0; 2027-02-03:lako/6.1; 2027-02-04:odmor/0; 2027-02-05:lako/7.4; 2027-02-06:odmor/0; 2027-02-07:lr/8.8 | bez session/finish kvaliteta | 2027-02-07 8.8km/n/p | Tempo / False |
| N18 / 2027-02-08 | 23.9 / 23.9 | 2027-02-08:lako/4.8; 2027-02-09:snaga/0; 2027-02-10:lako/4.3; 2027-02-11:odmor/0; 2027-02-12:tempo/7.1; 2027-02-13:odmor/0; 2027-02-14:lr/7.7 | 2027-02-12 RP 10.2min; kontinuirano | 2027-02-14 7.7km/45.8min | Taper · Maratonski tempo / False |
| N19 / 2027-02-15 | 19.3 / 19.3 | 2027-02-15:lako/5; 2027-02-16:snaga/0; 2027-02-17:lako/4.4; 2027-02-18:odmor/0; 2027-02-19:tempo/3.6; 2027-02-20:odmor/0; 2027-02-21:lr/6.3 | 2027-02-19 RP 10.2min; kontinuirano | 2027-02-21 6.3km/37.5min | Taper · Maratonski tempo / False |
| N20 / 2027-02-22 | 47.6 / 47.6 | 2027-02-22:lako/1.8; 2027-02-23:odmor/0; 2027-02-24:lako/1.8; 2027-02-25:odmor/0; 2027-02-26:lako/1.8; 2027-02-27:odmor/0; 2027-02-28:trka/42.195 | bez session/finish kvaliteta | — | TRKA / False |

### U10 PRIMARY

| N / početak | Total / future km | Budući dani i distance | Kvalitet: datum, zona, rad, pauza | LR: datum, km, približni min | Focus / deload |
|---|---:|---|---|---|---|
| N7 / 2026-11-23 | 55.4 / 17.5 | 2026-11-26:snaga/0; 2026-11-27:lako/4.3; 2026-11-28:odmor/0; 2026-11-29:lr/13.2 | bez session/finish kvaliteta | 2026-11-29 13.2km/81.0min | Baza — aerobni obim, bez kvaliteta / False |
| N8 / 2026-11-30 | 34.9 / 34.9 | 2026-11-30:lako/6.2(+tekst ubrz, bez objekta); 2026-12-01:lako/5.4; 2026-12-02:lako/4.8(+tekst ubrz, bez objekta); 2026-12-03:snaga/0; 2026-12-04:lako/4.6; 2026-12-05:odmor/0; 2026-12-06:lr/13.9 | bez session/finish kvaliteta | 2026-12-06 13.9km/85.3min | Baza — aerobni obim, bez kvaliteta / False |
| N9 / 2026-12-07 | 36.6 / 36.6 | 2026-12-07:lako/7.3(+tekst ubrz, bez objekta); 2026-12-08:lako/4.7; 2026-12-09:lako/6.4; 2026-12-10:snaga/0; 2026-12-11:lako/5.7; 2026-12-12:odmor/0; 2026-12-13:lr/12.5 | bez session/finish kvaliteta | 2026-12-13 12.5km/76.7min | Fartlek / False |
| N10 / 2026-12-14 | 28.4 / 28.4 | 2026-12-14:lako/5.3(+tekst ubrz, bez objekta); 2026-12-15:lako/4.6; 2026-12-16:lako/4.2; 2026-12-17:snaga/0; 2026-12-18:lako/3.9; 2026-12-19:odmor/0; 2026-12-20:lr/10.4 | bez session/finish kvaliteta | 2026-12-20 10.4km/63.8min | DELOAD — obim dole, ostaje kratka oštrina / True |
| N11 / 2026-12-21 | 38.4 / 38.4 | 2026-12-21:lako/7.2; 2026-12-22:int/4.7; 2026-12-23:lako/6.2; 2026-12-24:snaga/0; 2026-12-25:lako/5.6; 2026-12-26:odmor/0; 2026-12-27:lr/14.7 | 2026-12-22 T 3.0min; pauza90s | 2026-12-27 14.7km/90.2min | Fartlek / False |
| N12 / 2026-12-28 | 40.1 / 40.1 | 2026-12-28:lako/8.3; 2026-12-29:int/4.9; 2026-12-30:lako/7.2; 2026-12-31:snaga/0; 2027-01-01:lako/6.5; 2027-01-02:odmor/0; 2027-01-03:lr/13.2 | 2026-12-29 I 5.4min; pauza122s | 2027-01-03 13.2km/81.0min | Intervali / False |
| N13 / 2027-01-04 | 42.1 / 42.1 | 2027-01-04:lako/7.9; 2027-01-05:tempo/5.6; 2027-01-06:lako/6.9; 2027-01-07:snaga/0; 2027-01-08:lako/6.2; 2027-01-09:odmor/0; 2027-01-10:lr/15.5 | 2027-01-05 T 10.0min; pauza60s | 2027-01-10 15.5km/95.1min | Tempo isprekidan / False |
| N14 / 2027-01-11 | 32.8 / 32.8 | 2027-01-11:lako/6.3; 2027-01-12:lako/5.4; 2027-01-13:lako/4.9; 2027-01-14:snaga/0; 2027-01-15:lako/4.6; 2027-01-16:odmor/0; 2027-01-17:lr/11.6 | bez session/finish kvaliteta | 2027-01-17 11.6km/71.1min | DELOAD — obim dole, ostaje kratka oštrina / True |
| N15 / 2027-01-18 | 43.8 / 43.8 | 2027-01-18:lako/9.8; 2027-01-19:tempo/5.4; 2027-01-20:lako/8.6; 2027-01-21:snaga/0; 2027-01-22:tempo/6.1; 2027-01-23:odmor/0; 2027-01-24:lr/13.9 | 2027-01-19 RP 10.1min; kontinuirano; 2027-01-22 T 13.0min; kontinuirano | 2027-01-24 13.9km/85.3min | Maratonski tempo + Tempo / False |
| N16 / 2027-01-25 | 45.6 / 45.6 | 2027-01-25:lako/9.5; 2027-01-26:int/5.5; 2027-01-27:lako/8.2; 2027-01-28:snaga/0; 2027-01-29:tempo/6; 2027-01-30:odmor/0; 2027-01-31:lr/16.4 | 2027-01-26 RP 9.6min; pauza90s; 2027-01-29 T 12.0min; pauza60s | 2027-01-31 16.4km/100.6min | Maratonski tempo + Tempo isprekidan / False |
| N17 / 2027-02-01 | 47.4 / 47.4 | 2027-02-01:lako/9.9; 2027-02-02:tempo/5.4; 2027-02-03:lako/8.7; 2027-02-04:snaga/0; 2027-02-05:tempo/6.1; 2027-02-06:odmor/0; 2027-02-07:lr/17.3 | 2027-02-02 RP 10.1min; kontinuirano; 2027-02-05 T 13.0min; kontinuirano | 2027-02-07 17.3km/106.1min | Maratonski tempo + Tempo / False |
| N18 / 2027-02-08 | 37.8 / 37.8 | 2027-02-08:lako/6.4; 2027-02-09:tempo/6.1; 2027-02-10:lako/5.6; 2027-02-11:snaga/0; 2027-02-12:lako/5; 2027-02-13:odmor/0; 2027-02-14:lr/14.7 | 2027-02-09 T 13.0min; kontinuirano | 2027-02-14 14.7km/90.2min | Taper · Tempo / False |
| N19 / 2027-02-15 | 30.7 / 30.7 | 2027-02-15:lako/5.4; 2027-02-16:tempo/4.3; 2027-02-17:lako/4.7; 2027-02-18:snaga/0; 2027-02-19:lako/4.2; 2027-02-20:odmor/0; 2027-02-21:lr/12.1 | 2027-02-16 RP 10.1min; kontinuirano | 2027-02-21 12.1km/74.2min | Taper · Maratonski tempo / False |
| N20 / 2027-02-22 | 51.2 / 51.2 | 2027-02-22:odmor/0; 2027-02-23:lako/3; 2027-02-24:lako/3; 2027-02-25:odmor/0; 2027-02-26:lako/3; 2027-02-27:odmor/0; 2027-02-28:trka/42.195 | bez session/finish kvaliteta | — | TRKA / False |

Ukupno pregledano i tabelirano **110 budućih nedeljnih redova** prihvaćenih primarnih planova, obe U05 varijante i zasebnog U08 EARLIER. U01 i U08 PRIMARY nemaju generisan novi plan. Zaštitni seedovi su pregledani zasebno i navedeni u deset presuda; nisu uključeni kao druga stvarna istorija.


## Nezavisna završna preservation kontrola

Dodatno sam direktno uporedio ulazne i izlazne objekte poID, sa pravilima: efektivni datum do cutoff-a, done status, manual alt ili aktivan session override; locked prediction redovi poređeni zasebno. Ovo nije ponovljeno izvršavanje izvornog sistema.

| Grana | Zaštićeni day IDs prema toj direktnoj kontroli | Izmenjeni day IDs | Izmenjeni locked redovi |
|---|---:|---|---|
| U02 protection |48|nema|nema|
| U04 protection |48|nema|nema|
| U07 protection |48|nema|nema|
| U09 protection |48|nema|nema|
| U10 protection |46|nema|nema|
| U05 OLD protection |50|g7d2,g7d5,g7d7,g9d2|g10_16|
| U05 NEW protection |50|nema|nema|
| U08 EARLIER |17|nema|nema|

Brojevi ne moraju biti isti kao `futureChanges.preservedDays`: ovde je objašnjen nezavisni skup pravila, dok sistemska metrika uključuje i druge mehanizme zaštite. U05 OLD narušavanje postoji u stvarnim pre/post objektima, ne samo u neuspešnom boolean check-u.

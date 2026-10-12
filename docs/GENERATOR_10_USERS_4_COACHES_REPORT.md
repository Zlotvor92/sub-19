# SUB-20: dubinski QA generatora — 10 korisničkih agenata i 4 trenerska agenta

Pregled počet 11.10.2026, nastavljen 12.10.2026. Svi profili su sintetički. Trenerski pregledi predstavljaju nezavisne AI procene, ne sertifikaciju ljudskih trenera ili dokaz rezultata na sportistima.

## Zaključak

**Novi generator je bolji ukupno, ali nije završen: stari 6,97/10, novi 7,65/10.** To je jednak prosek deset ocena eksperta odgovarajuće distance, prema unapred zaključanim kriterijumima. Prethodnih približnih 5/10 i 8/10 bile su preliminarne procene; ovaj ponovljiv pregled ih zamenjuje. Razlika je +6,83 poena na skali 0–100, ne procenat poboljšanja sportske efikasnosti.

Najveći napredak je u poštenom prikazu cilja, uvažavanju početne dužine i pauze, ponovljenim maratonskim dužinama kod iskusnog trkača i očuvanju sačuvanih izmena. Najveći preostali problemi su smisao/doza specifičnog rada, neslaganje teksta i strukture posle regeneracije, raspored oporavka nakon umora i izbor odgovarajućeg proizvoda za nedovoljnu maratonsku bazu.

**Ne preporučujem da ovu verziju proglasimo potpuno trenerski validiranom.** U09, prvi maraton sa malom bazom, sva četiri glavna trenerska agenta smatraju nedovoljnom punom maratonskom pripremom u obe verzije. Novi generator to iskrenije priznaje, ali upozorenje ne stvara potrebnu izdržljivost. Kod iskusnog 5K profila U03 nova glavna ocena je nešto niža; razlika je mala i nije statistički dokaz lošijeg ishoda, ali jasno pokazuje da napredak nije univerzalan.

## Šta je stvarno urađeno

- Deset zasebnih korisničkih agenata: svaki je pregledao sve nedelje svog starog i novog plana, sačuvao nalaze i izvršio ponovljivu domensku simulaciju svog događaja. Glavni agent nezavisno je ponovio svih deset proba; sve su završile uspešno.
- Četiri glavna trenerska agenta — 5K, 10K, HM i maraton — svaki je pre otkrivanja A/B identiteta zasebno pregledao svih 20 početnih planova. Ukupno 80 ocena i 1.296 pregleda plan-nedelja (324 nedelje po treneru). Pregled obuhvata sve dane, strukturu sesija, pauze, tekst, dužine, rasterećenje i taper.
- Naknadni trenerski pregledi događaja imaju odvojene datoteke; početne ocene se ne menjaju nakon uvida u događaje. Konačna evidencija pokrivenosti je u `qa/generator-ab/event-review-summary.json`.
- Deset pravih browser tokova kroz čarobnjak nove aplikacije, u izolovanim kontekstima: poređenje generisanog plana sa zaključanim ulazom, navigacija, reload, potvrda pauze, preview i promena. Devet profila proverava apply → reload → unos stvarno otrčanih km/min kroz UI → restore → reload. U08 proverava očekivano odbijanje prekratkog preostalog ciklusa bez promene plana i istorije.
- Izolovan je konkretan produkcioni uzrok promene pauze RP sesije sa 60 na 240 sekundi. Kontrolni ulaz razlikuje se samo po eksplicitnoj početnoj RP zoni; nema zamene generatora pojednostavljenom imitacijom.
- Funkcionalni kod `web/src` tokom ovog QA nije promenjen. QA dodaje probe, browser test i dokaze; ne popravlja generator i ne objavljuje produkciju.

Browser deo koristi testnu autentifikaciju i lažan backend. Plan i dnevnik se ne ubacuju direktno. Korisnički agenti rade domenske probe; nisu deset ljudi koji su mesecima trenirali. Stari browser interfejs nije predmet UI poređenja. Kod profila čiji glavni događaj nije pauza, browser povratak je zaseban kontrolisan persistence scenario, dok je njihov originalni događaj u domenskoj probi.

## Metodologija i integritet

Staro je commit `aea8dc66e5e6a9940ce48d63a94daace76be1297`, neposredno pre faze 1; novo je `f7bcbe99d135cd4c1e7b837d0369e8066c1b3baa`, završena faza 3. Isti deset profila i datumi koriste se u oba checkout-a. Ovo nije poređenje sa svim istorijskim verzijama. Ulazi i kompletni izlazi čuvaju se u [inputs.json](qa/generator-ab/inputs.json), [manifest.json](qa/generator-ab/manifest.json) i `raw/`; neutralne kopije su u `blind/`.

Rubrika: uklapanje profilu 20%, smisao/doza kvaliteta 20%, progresija 15%, oporavak 15%, specifičnost 10%, rasterećenje/taper 10%, usklađenost brojeva i poruka 10%. Svaki kriterijum je 0–10; zbir je 0–100. Glavnu ocenu daje ekspert distance; ostale tri ocene se prikazuju da se vidi neslaganje. Glavni zbir je prosek deset profila, pa distance sa tri profila imaju veću težinu od distanci sa dva.

Prva maratonska revizija sačuvala je ocene, a zatim pri proveri statusa agenata videla kratke sažetke drugih nalaza. Zadržana je kao **dopunska** (`marathon-scores.json`), ali isključena iz glavnog zbira. Novi maratonski agent bez tih sažetaka uradio je primarni nezavisni pregled (`marathon-primary-scores.json`). Sva četiri glavna pregleda zaključana su pre otkrivanja identiteta. Razlike u obliku plana mogu ipak omogućiti nagađanje; savršeno slepilo se ne tvrdi. Prekinuti nezavršeni agenti iz prethodnog pokušaja nisu ubrojani u deset završenih korisnika.

Programski provereni ponderi, jedinstvenost svih A/B ocena i broj nedelja su u [summary.json](qa/generator-ab/summary.json). SHA256 četiri originalna score dokumenta služi proveri da naknadni događaji nisu promenili početne ocene. Razlike reda 1–3 poena treba tumačiti kao bliske ocene, bez lažne preciznosti ili intervala pouzdanosti.

## Ocene po distanci i profilu

| Distanca | Profili | Staro /10 | Novo /10 |
|---|---:|---:|---:|
| 5 km | 3 | 7.36 | 7.55 |
| 10 km | 3 | 6.83 | 7.82 |
| Polumaraton | 2 | 7.79 | 8.19 |
| Maraton | 2 | 5.78 | 7.03 |

| Profil | Glavni ekspert | Staro /100 | Novo /100 | Razlika |
|---|---|---:|---:|---:|
| U01 — 5K početnik | 5 km | 70.50 | 77.25 | +6.75 |
| U02 — 5K rekreativac sub-20 | 5 km | 74.00 | 74.75 | +0.75 |
| U03 — 5K iskusan ambiciozan | 5 km | 76.25 | 74.50 | -1.75 |
| U04 — 10K prvi specifičan ciklus | 10 km | 67.00 | 81.50 | +14.50 |
| U05 — 10K iskusan | 10 km | 78.00 | 79.50 | +1.50 |
| U06 — 10K povratnik sa starim PB | 10 km | 60.00 | 73.50 | +13.50 |
| U07 — HM prvi, ograničena baza | Polumaraton | 74.00 | 82.75 | +8.75 |
| U08 — HM iskusan na rezultat | Polumaraton | 81.75 | 81.00 | -0.75 |
| U09 — Maraton prvi, mala baza | Maraton | 50.50 | 63.25 | +12.75 |
| U10 — Maraton iskusan | Maraton | 65.00 | 77.25 | +12.25 |

Novi glavni zbir raste u osam profila, a blago pada u U03 i U08. Prosek svih četiri trenera nad svih deset profila je 69,63 → 76,89/100; to je dopunska perspektiva, ne zamena glavnom zbiru.

### Svih 80 ocena i raspon neslaganja

| Profil/verzija | 5K ekspert | 10K ekspert | HM ekspert | M ekspert | Raspon |
|---|---:|---:|---:|---:|---|
| U01 / staro | 70.50 | 69.50 | 74.00 | 67.50 | 67.50–74.00 |
| U01 / novo | 77.25 | 77.50 | 84.50 | 77.50 | 77.25–84.50 |
| U02 / staro | 74.00 | 72.00 | 79.75 | 74.75 | 72.00–79.75 |
| U02 / novo | 74.75 | 78.50 | 82.25 | 78.25 | 74.75–82.25 |
| U03 / staro | 76.25 | 75.50 | 79.75 | 77.75 | 75.50–79.75 |
| U03 / novo | 74.50 | 77.00 | 82.00 | 75.75 | 74.50–82.00 |
| U04 / staro | 71.50 | 67.00 | 69.25 | 66.75 | 66.75–71.50 |
| U04 / novo | 76.25 | 81.50 | 82.25 | 76.50 | 76.25–82.25 |
| U05 / staro | 78.50 | 78.00 | 80.50 | 75.50 | 75.50–80.50 |
| U05 / novo | 76.50 | 79.50 | 79.75 | 75.50 | 75.50–79.75 |
| U06 / staro | 60.50 | 60.00 | 63.25 | 61.50 | 60.00–63.25 |
| U06 / novo | 77.00 | 73.50 | 80.50 | 71.00 | 71.00–80.50 |
| U07 / staro | 72.50 | 67.50 | 74.00 | 67.50 | 67.50–74.00 |
| U07 / novo | 79.75 | 79.00 | 82.75 | 76.50 | 76.50–82.75 |
| U08 / staro | 76.75 | 76.00 | 81.75 | 75.50 | 75.50–81.75 |
| U08 / novo | 80.50 | 80.50 | 81.00 | 78.00 | 78.00–81.00 |
| U09 / staro | 52.00 | 43.50 | 54.50 | 50.50 | 43.50–54.50 |
| U09 / novo | 62.50 | 62.00 | 64.25 | 63.25 | 62.00–64.25 |
| U10 / staro | 68.25 | 69.00 | 67.50 | 65.00 | 65.00–69.00 |
| U10 / novo | 78.50 | 80.50 | 80.00 | 77.25 | 77.25–80.50 |

Raspon otkriva razlike trenerskog suda. Primer U03 novo: 5K ekspert 74,50, HM ekspert 82,00; veća aerobna konzervativnost može izgledati dobro opštem pregledu, dok ekspert ciljnih 5 km više kažnjava slabu specifičnu dozu. To nije dokaz da jedan agent zna ishod bolje, već razlog da odluku kalibrišemo sa stvarnim trenerom.

### Zaključani dokumenti ocena

| Glavni pregled | SHA256 |
|---|---|
| [5k-scores.json](qa/generator-ab/coaches/5k-scores.json) | `b26d0aeec0b2939e8061ce28db0ff5b1568bbc13cd9c4e51b4e8cc327e7ffaf5` |
| [10k-scores.json](qa/generator-ab/coaches/10k-scores.json) | `d46269f19ce89d61265d2a3f229cc45edd29e8b6d626933863f69a7c20c9fcfe` |
| [hm-scores.json](qa/generator-ab/coaches/hm-scores.json) | `5287d5103edb38b8f0c22ce11a4a5c7640545f9f3647b9283c70f6cebf267be0` |
| [marathon-primary-scores.json](qa/generator-ab/coaches/marathon-primary-scores.json) | `cb6e47a6f87396ffe7bbd4eb13570829457652aa5f6a9dc9c521d2d365c9868e` |

## Deset korisničkih događaja

| Profil | Događaj | Potvrđen rezultat i ograničenje |
|---|---|---|
| U01 | Jedan potvrđen propušten trening | Savet bez nepotrebne regeneracije; nepotpun dnevnik nije tretiran kao dokaz neizvršavanja. Za oba početna plana koristi se novi consumer, jer stari nema novi executionAdjustment API. |
| U02 | Dve pune nedelje na 55% planiranih km | Nudi smanjenje, početna baza 23 km; očuvani zaštićeni podaci. Pauza nije prijavljena, ali opisi koriste izraz povratak posle pauze. |
| U03 | Poslednja dva laka treninga RPE 8 | Nudi ublažavanje; dodatna pozitivna merena evidencija ipak ne propušta brže ritmove kroz recovery gate. Regeneracija pomera neposredni deload: W8 40,2 km/bez kvaliteta postaje 48,8 km/2,25 min T, deload tek W10. |
| U04 | Potvrđena pauza 7 dana | Početni obim 25,5 km od prijavljene povratne baze 30 km; prva puna nedelja 26,4. Očuvani prošli i merom zaštićeni budući treninzi. Nedeljni focus ostaje star. |
| U05 | Cilj 10K 42 → 40 min | Glavni događaj nad netaknutim planom čuva prošlost u obe verzije. Odvojeni stres-test legitimnih sačuvanih izmena pokazuje da novi čuva svih sedam zaštićenih slučajeva; stari gubi neke završene, ručne i merene izmene. Ne mešati ta dva rezultata. |
| U06 | Potvrđena pauza 28 dana | Struktura daje četiri lake kalendarske nedelje; tekst nekih dana i dalje traži 6×20 s / 4×15 s ubrzanja. Upozorenje navodi vrh 11,6 km, finalna priprema 10,1 km. |
| U07 | Dve pune nedelje na 60% obima | Nova početna baza 25,7 km, budući vrh 36 km, LR 11,4 km; ograničenje pripreme je eksplicitno. Podaci očuvani; focus pojedinih nedelja navodi treninge koji više ne postoje. |
| U08 | Potvrđena pauza 14 dana, 25.11. | Glavni pokušaj pravilno odbijen: preostaje 8 kalendarskih nedelja, HM pravilo traži najmanje 10. Plan i istorija ne menjaju se. Zaseban raniji pokušaj 28.10. može da se regeneriše i otkriva zastarela ubrzanja/poruke; nije zamena glavnog ulaza. |
| U09 | Prvi maraton, potvrđena pauza 14 dana | Povratna baza 21 km; budući vrh 29 km i LR 8,8 km/~52 min. Rast i očuvanje podataka prolaze. Ostaju datum maratona i cilj, uz limited upozorenje: tehnički validan povratak nije puna priprema za 42,2 km. |
| U10 | Iskusan maraton, pauza 28 dana | Početna baza 33 km (55% prijavljenih 60), prva puna nedelja 34,9; budući vrh 47,4, LR 17,3. Rast/podaci prolaze. Opisi zadržavaju ubrzanja, a upozorenja se razilaze između dve i četiri lake nedelje. |

Kompletni ulazi, dnevnik, izlazi i granice svake provere: `qa/generator-ab/users/U01-event.json`–`U10-event.json`; obrazloženja i nalazi u odgovarajućim `UXX.md`/`UXX-findings.json`. [Sirov registar](qa/generator-ab/user-observation-register.json) ima 57 zapisa, uključujući duplikate, već rešene stare probleme i trenerske hipoteze. To **nije 57 jedinstvenih otvorenih grešaka**.

## Potvrđene preostale greške i precizna mesta za popravku

### 1. Tekst povratka ne odgovara finalnoj strukturi

U06, U10 i dozvoljeni raniji U08: guard uklanja `strides`/brze završetke, ali već sastavljen `desc` zadržava nalog za ubrzanja. Primer U10: 30.11, 2.12, 7.12. i 14.12; trening je strukturno lak, opis traži ubrzanja. Ovo je potvrđena kontradikcija za korisnika. Nije dokaz da su ubrzanja stvarno izvedena ili izazvala povredu.

Isti tip problema pogađa `week.focus`, broj početnih lakih nedelja i upozorenja o isporučenom maksimumu. U06 11,6 naspram finalnih 10,1 km; U10 dve naspram četiri nedelje. Nije dovoljna izmena jedne rečenice: tekst treba izvesti **iz finalnog plana**, nakon guard-a, očuvanja sačuvanih dana i ponovnog obračuna.

### 2. RP svrha određuje se posle doziranja

[Ponovljiva proba](probes/generator-ab-purpose-probe.mjs) i [potpuni rezultat](qa/generator-ab/purpose-reproduction.json): produkcioni 10K builder polazi od 6×1200 m sa 60 s odmora. `applyQualityDose` kroz legacy `ZONE_FOR_KIND['Trkački ritam']` prvo tretira sesiju kao I, smanjuje je na 3×1200 i menja odmor na 240 s. Tek kasniji `constrainSession` dodeljuje RP zonu. Isti ulaz sa eksplicitnom RP zonom zadržava 60 s.

Relevantna mesta: `web/src/domain/training/distances/qualityDose.ts`, `web/src/domain/training/distances/profile10k.ts`, `web/src/domain/training/sessions/constraints.ts` i `web/src/domain/training/vdot/zoneForKind.ts`. Potvrđeno je prepisivanje odmora na osnovu pogrešne međufaze svrhe; **nije dokazano da je 60 s univerzalno pravi odmor**. Trenerski nalazi zasebno potvrđuju da kasne male RP doze sa oko četiri minuta hoda slabo vežbaju održavanje 5K/10K ritma.

### 3. I piramida izbegava isti uslov trajanja kao obični I intervali

U02 W4 ima I piramidu 100–200–300–200–100 m: 27,2/54,4/81,6/54,4/27,2 s rada. Četiri deonice su ispod 60 s, dok grana običnih I intervala pri skraćivanju deonice štiti minimum 60 s. To je potvrđena razlika politike dve grane. Trenerski problem je naziv/svrha, ne sama upotreba kratkih deonica: mogu biti razumna aktivacija ili ekonomija, ali ne treba da automatski naslede tvrdnju o istom I stimulusu.

### 4. Smanjenje zbog umora gubi kontekst kontinuiteta

U03 nema pauzu, ima potvrđen dnevnik i 24 nedelje kontinuiteta, ali regenerated input vraća kontinuitet na nulu i poruka kaže da nema potvrđenog kontinuiteta. U02 takođe dobija tekst povratka posle pauze uz `breakDays=0`. Promena readiness zbog visokog napora može biti opravdana; tvrđenje da istorija ne postoji nije dobro objašnjenje. Treba razlikovati **pauzu**, **umor**, **smanjeno izvršenje** i **promenu cilja**.

Pomeranje deload-a U03 je reprodukovano ponašanje sa jasnim trenerskim prigovorom, ali proizvod ne obećava invariant da deload datum nikad ne sme da se pomeri. Zato ga ne predstavljamo kao kršenje postojećeg ugovora; potrebno je eksplicitno pravilo oporavka za fatigue replanning.

## Trenerski problemi koji traže kalibraciju, a ne slepo dodavanje treninga

- **Premala doza za iskusne profile.** U03 ponavlja oko 8–10 min I rada; U05 u W1 dobija dva T treninga od 6,44 i 5,52 min. Početnički uvod je koristan, ali isti niz konzervativnih množioca, deljenja nedeljnog budžeta i zaokruživanja ostavlja iskusnima vrlo male blokove. Veći lak obim ne rešava uvek nedostatak specifičnosti.
- **Koncentracija lakog obima oko dužine.** U07 19,5 km u nedelju +11,5 km u ponedeljak; U04 15,3 +12,2 km. Dan može biti lak po tempu, a značajan po trajanju. Ovo je razlog za proveru rasporeda i korisnikove tolerancije, ne univerzalna zabrana uzastopnih dana.
- **Maratonska spremnost ostaje zasebna od referentne brzine.** U09 osnovni novi maksimum 17,7 km, a nakon pauze budući 8,8 km. Sva četiri glavna pregleda smatraju to nedovoljnom punom pripremom. Ne rešavati uklanjanjem limitera i naglim skokom na 30 km; ponuditi duži ciklus, kraću distancu ili jasno bazni/povratni režim sa uslovima nastavka.
- **Odbijanje punog ciklusa ne daje plan povratka.** U08 pravilno odbija novi HM ciklus od osam nedelja, ali prethodni budući plan ostaje sa 4,4 km T rada 27.11. i LR 22 km 29.11, odmah posle potvrđene pauze. Očuvanje bez mutacije je tehnički ispravno; korisniku je potreban izričit nastavak odluke — kraći bazni/povratni režim ili pomeranje cilja — da stari raspored ne protumači kao preporuku za povratak. Ovo je trenerski/product gap, ne tvrdnja da je odbijanje greška API-ja.
- **Kalendarski run/walk izlaz.** U01 automatski izlazi iz hodanja u W5 bez reakcije korisnika. Potrebna je opcija ponavljanja faze prema izvršenju i toleranciji, sa jasnim opisom.
- **Stari PB i precizni ritmovi.** U06 novi pošteno priznaje neizvesnost, ali ipak isporučuje precizne ritmove iz godinu starog PB. Lak rad treba imati jasnu kontrolu naporom; zahtev za novim dokazom forme mora biti deo odluke o kvalitetu, ne samo fusnota.
- **Aktivacija u trkačkoj nedelji ima R etiketu, ali približno RP tempo.** U05/U08/U09. Može biti namerno lagana aktivacija; promeniti smisao/naziv i objašnjenje, ne automatski ubrzati na puni R tempo pred trku.
- **Taper i M rad nisu jedno univerzalno pravilo.** U10 nova ponovljena dužina ima jasnu prednost, ali mnogi M blokovi ostaju oko 3,3 km, a duga sedam dana pred trku može biti previše za neke trkače. Treba smislena individualna raspodela doze uz ostatak obima.

## Šta je novi generator već popravio

U svim deset početnih novih planova referenca se više ne predstavlja kao automatski dokaz budućeg napretka. Cilj i sadašnja referenca jasnije su odvojeni. Povratnik U06 počinje blizu prijavljene dužine; U04 početna dužina je 8 km umesto 9,7. U10 čuva postojeću 24-kmdužinu i daje više ponovljenih dugih izlaganja, umesto početnog pada na 15,2 km i kasnog skoka 22,8→28,2. U05 zaseban test sačuvanih promena pokazuje očuvanje završenih, ručnih i merom zaključanih treninga. Novi recovery gate ne propušta brže ritmove kada postoje visoki napor/bol/loš razmak. U08 pravilno blokira prekratak HM ciklus bez upisa promene.

Ovo su stvarni dobici. Ne poništavaju preostale probleme, a stroža zaštita ne opravdava automatski slabiju dozu za zdravog iskusnog trkača.

## Poređenje sa originalnim trenerskim programima i Runnom

Svaki trener pregledao je javne primarne izvore: originalne B.A.A. i Hal Higdon programe relevantnih distanci, zvanične Runna vodiče i relevantna originalna istraživanja. Izvori, datum pristupa i ograničenje svake tvrdnje navedeni su u [5K](qa/generator-ab/coaches/5k-review.md), [10K](qa/generator-ab/coaches/10k-review.md), [HM](qa/generator-ab/coaches/hm-review.md) i [maratonskom](qa/generator-ab/coaches/marathon-primary-review.md) pregledu. Programi služe poređenju svrhe, progresije, oporavka i ponovljenih izlaganja, ne kopiranju identičnih treninga.

Ovde **nema dokaza o internom Runna algoritmu**, njegovim privatnim budžetima ili individualnim izlazima svih deset profila. Javno objavljen princip nije isto što i direktan A/B test sa Runnom. Za taj dodatni benchmark bili bi potrebni konkretni Runna izlazi sa istim ulazima. Glavni rezultat ovog QA je staro/novo SUB-20 poređenje i stručna procena prema javnim trenerskim strukturama.

Odgovor na početnu sumnju o 300 m: problem nije što postoje 300-metarske repeticije. One mogu imati smisao. Problem je kada fiksna porodica i kasniji limiteri odlučuju nezavisno od profila, svrhe i faze, pa kasni specifični trening ostane premali ili sa neodgovarajućim oporavkom. Isto važi za piramide: dodavanje novih oblika samo po sebi ne popravlja dozu, svrhu i raspored.

## Predlog popravke u tri konkretne faze

| Faza | Promena | Kriterijum završetka |
|---|---|---|
| 1 — usklađenost i oporavak | Jedna finalizacija strukture i svih izvedenih opisa/focus/upozorenja; razdvojeni razlozi replanning-a; fatigue pravilo štiti neposredni oporavak | Nema tekstualnih ubrzanja u uklonjenoj strukturi; broj lakih nedelja i dostavljeni maksimum identični svim porukama; umor bez pauze ne briše potvrđenu istoriju; U03 neposredni oporavak jasno obrazložen |
| 2 — svrha i doza | Eksplicitna purpose/zone pre bilo kog doziranja; odvojena politika oporavka i rada za T/I/R/RP/M/aktivaciju; kalibracija celog nedeljnog budžeta prema istoriji i fazi | RP kontrolna proba nema legacy I prepisivanje; U03/U05 dobijaju odbranjivu progresiju ili konkretan razlog konzervativnosti; kratka piramida nosi odgovarajuću svrhu; zahtevni dani računaju i LR/finish |
| 3 — izbor ciklusa i ponovni QA | Jasna odluka za limited pripremu, posebno prvi maraton; uslovni run/walk napredak; merena kontrola forme; ponoviti iste zaključane profile + rubne ulaze | U09 dobija preglednu odluku o dužem ciklusu/kraćoj distanci/baznom režimu, bez forsiranja dužine; povratak nema stare instrukcije; četiri trenerska agenta ponovo zasebno ocenjuju planove i događaje |

Faza 2 ne treba da ukloni sve limitere. Potrebno je ukloniti pogrešno preklapanje i omogućiti opravdanu dozu prema profilu. Tačne minimalne/maksimalne minute, odmore i progresiju treba dogovoriti sa ljudskim trenerom na primerima; ovaj QA ne pretvara agentsko mišljenje u univerzalni fiziološki zakon.

Predloženi tok generatora: profil i potvrđena istorija → odluka o vrsti ciklusa → faza i svrha sesije → doza/pauza prema toj svrsi → raspodela nedeljnog opterećenja i oporavka → guard-i → očuvanje zaštićenih sačuvanih dana → finalni obračun i opis → provera koherentnosti. `ZONE_FOR_KIND`, koji služi i obradi ostvarene forme, ne treba da bude prećutna zamena za eksplicitnu svrhu propisanog treninga.

Finalizacija mora očuvati završene, ručne i merom zaključane zapise u celini. Nove opise generisati iz finalne strukture budućih nezaštićenih dana; agregate i upozorenja računati preko stvarno isporučenog plana. Ako sačuvani ručni budući trening protivreči povratnoj politici, prikazati konflikt i odluku za korisnika umesto tihog prepisivanja zaključanog treninga. Time popravka koherentnosti ne vraća stare greške očuvanja podataka.

## Tehnička validacija, dokazi i ograničenja

Prvi CI [38171685665](https://github.com/Zlotvor92/sub-19/actions/runs/38171685665): sve tri grupe poslova uspešne; strict TypeScript, lint, format, 1.404 frontend/domain testa, build i 76 E2E testova (uključujući svih deset novih profila) prolaze. To potvrđuje izvršavanje i proverene invariante, ne kvalitet trenerskog recepta.

Prvi upload nije sačuvao screenshot attachment-e jer je tražio samo `test-results`, dok ih successful HTML reporter čuva u `playwright-report`. To je greška čuvanja QA dokaza, ne pad browser testova. Workflow je korigovan i ponovljen na commitu `2dfc2eba0ca8e82352c4c20ba6bfd4741f26b5c7`; završni rezultat i domet vizuelnog pregleda beleže [browser-ci.json](qa/generator-ab/browser-ci.json) i dodatak ovog izveštaja.

Draft [PR #35](https://github.com/Zlotvor92/sub-19/pull/35) sadrži QA dokaze i testove, sa bazom `fix/generator-phase3`. Nije mergeovan niti deployovan. Reprodukcija i precizna ograničenja: [REPRODUCE.md](qa/generator-ab/REPRODUCE.md), [PROTOCOL.md](qa/generator-ab/PROTOCOL.md), [summary.json](qa/generator-ab/summary.json), deset kompletnih raw/event zapisa i četiri glavna trenerska pregleda.

## Završna evidencija

Sva četiri trenerska agenta zasebno su završila svih deset događaja: **40 pregleda**, uz nepromenjene SHA256 početnih ocena. Proveren je identitet svih deset zapisa po treneru i postojanje svih 40 korisničkih datoteka.

| Ekspert | Pregled promena | Broj događaja |
|---|---|---:|
| 5K | [5k-events.md](qa/generator-ab/coaches/5k-events.md) | 10 |
| 10K | [10k-events.md](qa/generator-ab/coaches/10k-events.md) | 10 |
| HM | [hm-events.md](qa/generator-ab/coaches/hm-events.md) | 10 |
| Maraton | [marathon-primary-events.md](qa/generator-ab/coaches/marathon-primary-events.md) | 10 |

Zajednički nalaz je da trenutni payload-i čuvaju zaštićene podatke, dok tekst povratka često ne prati finalnu strukturu. U01 nema regenerisani plan; U08 primarno odbijanje nema result — zato odsustvo mutacije ne predstavljamo kao pregled novog rasporeda. Trenerske sumnje u dozu i maratonsku/HM spremnost ostaju odvojene od potvrđenih tehničkih kontradikcija. Granice dokaza svakog agenta nalaze se u njegovom izveštaju.

Završni browser CI [38206972002](https://github.com/Zlotvor92/sub-19/actions/runs/38206972002) završio je uspešno u sve tri grupe poslova: **1.404 testa + 76 E2E**, uključujući deset zaključanih profila bez retry-ja. Artifact **11727084564** je preuzet i njegov SHA256 je nezavisno proveren: `1b8b1c4e4c6685d1190f2142ccf18e305ca2c89f8205f811e97bbaa00f1f0ea2`. Čuva 38 screenshot referenci za deset profila u 34 jedinstvene PNG datoteke, plus HTML metapodatke i JSON attachment-e. GitHub retention ističe 10.01.2027; postupak je ponovljiv, a trajni indeks dokaza je u [browser-evidence-index.json](qa/generator-ab/browser-evidence-index.json).

Vizuelno je pregledano šest reprezentativnih snimaka: U01/U05/U09 početni plan, U06 preview povratka, U08 očekivano odbijanje i U10 vraćena istorija/dnevnik. Potvrđen je odgovarajući vidljivi sadržaj ovih stanja. Ne tvrdi se potpuna vizuelna revizija svih nedelja ili svih uređaja. Fiksna donja navigacija vidi se unutar full-page snimka na granici viewport-a; sam taj artefakt ne dokazuje da sadržaj nije dostupan skrolovanjem.

Dokazi su dopuna prolaznim tehničkim proverama, a ne zamena stručnom sudu. Završni QA commit dodaje dokumente/probe; funkcionalni kod generatora ostaje identičan zaključanoj novoj verziji.

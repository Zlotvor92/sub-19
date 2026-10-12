# Završni QA sedam segmenata — zaključana metodologija

## Verzije i integracija

A: funkcionalni generator `f7bcbe99d135cd4c1e7b837d0369e8066c1b3baa`. B: svi završeni segmenti u `1a7571e98de4793688a037d5a62f912cae18adf2`, sa oba roditelja integracije `33b732c`. QA ne menja produkcione funkcije. Manifest čuva sedam commitova/PR-ova i SHA256 309 produkcionih fajlova.

Originalni QA iz `f8cb2081ed4ba223fe7efe14a621144beb9bce0d` ostaje netaknut. Originalni QA je poredio druge verzije; njegov stari „new” generator identičan je ovde verziji A. Svih deset A planova mora reprodukovati originalni „new” plan hash. Nove dokaze upisivati samo u `docs/qa/generator-final/` i nove probe/testove.

## Profili, slepilo i ocene

Deset identičnih zaključanih profila; `inputs.json` je byte-identična kopija. Dvadeset celih početnih planova i sve nedelje/dani čuvaju se u `raw/`, neutralne kopije u `blind/`. Za svaki profil je nezavisno nasumično određena oznaka X/Y; mapa je u manifestu i nije data trenerima tokom prvog pregleda.

Četiri zasebna AI agenta sa čistim početnim kontekstom: 5K, 10K, HM, maraton. Svaki pregleda svih 20 planova i 324 nedelje, ne čita repozitorijum, raw/manifest, prethodni QA, korisničke izveštaje, tuđe ocene ni listu agenata. Ocene i izveštaji predati su zasebno; sva četiri hash-a zaključana su u `score-lock.json` pre otkrivanja verzija i pregleda rezultata događaja. Izvorni profil sadrži oznaku vrste/datuma sintetičkog događaja, ali događaji/rezultati nisu bili dostupni u početnom paketu. Razlike u instrukcijama i metadata mogu omogućiti nagađanje identiteta; savršeno slepilo se ne tvrdi.

Rubrika ostaje originalna: prilagođenost 20, smisao/doza kvaliteta 20, progresija 15, oporavak 15, specifičnost 10, rasterećenje/taper 10, usklađenost 10. Svaki kriterijum 0–10; zbir 0–100. Glavna ocena je ocena stručnjaka distance, zbir jednak prosek deset glavnih ocena. Ostale tri ocene i raspon su obavezni. Kritični nalazi ostaju zasebni. Izvori su javni primarni trenerski programi/istraživanja, ne privatni Runna algoritam. AI procena nije ljudska sertifikacija ni procenat uspešnih sportista.

## Događaji i deset korisničkih agenata

Svaki korisnički agent pregledao je svoj kompletan A/B plan i ponovio stvarne domenske API-je. Agentima su dozvoljene njihove datoteke; nisu čitali trenerske ni druge korisničke izveštaje. Rad u talasima zbog sedam istovremenih slotova i nastavak posle limita. Nezavršeni pokušaj ne računa se kao završeni pregled; svih deset završnih izveštaja mora postojati.

Glavni event replay koristi DOSLOVNE istorijske ulaze/current plan/dnevnik/opcije/analizu preko A i B API-ja. Ne menjaju se ostvareni km, trajanja, datumi ni analiza da bi novi generator izgledao bolje. Za U05 koristi se originalni zaključani „new” događaj, koji odgovara ovde A. U01 ima savet bez regeneracije i dodatnu kontrolu obe istorijske verzije dnevnika. U08 ostaje primarno odbijanje 25.11; raniji 28.10 i ponuđene nove opcije su suplementi.

Posebno seedovani protection scenariji, pozitivni dokaz forme, run/walk kontrole i novo-B-plan kontrole nisu primarni događaj. Neki stari protection scenariji imaju namerno zamrznutu analizu koja ne odgovara naknadno dodatom logu; neke tražene moves kolidiraju i ne postaju efektivni. Ova ograničenja ne pretvaraju se u dokaz stvarnog povratka. Nedostajuće sec/merenja ostaju nedostajuće; kategorija koja nema nijedan zapis nije potvrđena samo zato što je prazna ostala prazna.

Četiri ista trenerska agenta, tek posle zaključavanja početnih ocena, zasebno pregledaju svih deset primarnih događaja i jasno označene suplemente. Ukupno 40 pregleda. Ne prepisuju početne ocene. Čitaju mašinske event payload-e, ne korisničke narative ili tuđe zaključke.

## Tehnički i browser QA

Stvarne wizard/apply/reload/log/restore kontrole sa sintetičkom autentifikacijom i mock backendom. Deset profila ima zasebne browser kontekste. Poseban novi tok radi ručni future alt, efektivno pomeranje, zaključan ostvareni tempo i actual km/sec pre i posle primene, pa restore/reload; nema direktnog ubacivanja plana/dnevnika/izmena u state. Nije produkcioni backend/sat/iOS test.

Dve nove domenske regresije proveravaju ceo niz umor → cilj → rekalibracija → bazni režim → JSON revizija → restore, sa i bez zaštićenih konflikata. Nema izmene ranijih očekivanih generator snapshot-a. Očekivanje Vercel konfiguracije menja se samo zbog zabrane automatskog deploy-a nove QA grane. Browser očekivanja prelaze na zasebne finalne raw rezultate, bez slabijih provera.

Prolaz typecheck/lint/format/test/build/E2E prikazuje se odvojeno od trenerske procene i od naknadnih audit zapažanja. Poznato kršenje/primedba ne nestaje zato što su unit testovi zeleni. Izveštaj mora navesti sve neuspele pokušaje i stvarni domet ponovljene provere. Bez merge-a/deploy-a.

# SUB-20 — checkpoint faze 3 (11.10.2026)

Faza 3 dopunjuje generator pouzdanim podacima o izvršenju, bezbednom promenom budućih treninga i istorijom plana. Grana `fix/generator-phase3` nadovezuje se na `fix/generator-phase2` (`fb6f65a49e18b0fe4e88ab3eb785720571cf24ce`). Prethodne faze su draft PR #32 i #33; poslednji CI faze 2, run 38130736633, prošao je sva tri posla i 65 browser testova. Nijedna od ovih faza nije mergeovana niti objavljena u produkciju.

## Rezultat implementacije

- Prazan dnevnik je nepoznato izvršenje. `done` bez km ne pretvara planiranu distancu u ostvarenu. Analiza koristi datume stvarnog trčanja, pune kalendarske nedelje, pokrivenost podataka i stvarnu ponovljivu dužinu. Jedan izostanak ne pravi nadoknadu; najmanje dve dobro pokrivene slabije nedelje mogu predložiti novu osnovu.
- Povratak traži potvrđenu pauzu i ponovljivu bazu. Pauze 7/14/28 dana imaju transparentne početne postavke 85/70/55% i 2/3/4 početne kalendarske nedelje bez novog kvalitetnog rada. Ceo ostatak plana se regeneriše. Rast se proverava prema uspostavljenoj punoj osnovi (8% + tolerancija zaokruživanja), bez prepisivanja sesije samo manjim brojem km. To su pravila proizvoda, ne medicinski protokol.
- Forma za predlog koristi nedavne, stvarno prijavljene T/I treninge dovoljno dugog rada ili postojeće potvrđene 3K rezultate, tokom najmanje tri različita dana. Stari, budući, izolovani, nepotpuni i R/RP zapisi ne potvrđuju novu aerobnu formu. Eksplicitna T zona fartleka sada prolazi kroz PRED, merenje i prikaz. Dobra sesija nije potvrđen rezultat trke.
- Bol, više preteških lakih treninga i nepotvrđen razmak u dnevniku blokiraju predlog bržeg rada. Celovita rekalibracija nakon razmaka traži potvrdu baze/povratka. Kada postoje dve dovoljno pokrivene pune nedelje, rekalibracija koristi njihov stvarni obim; bez toga jasno prikazuje oslanjanje na ranije prijavljenu bazu.
- Promena cilja, forme i povratak štite današnji dan, prošle efektivne datume, buduće `done`, ručne/hibridne izmene i već postojeća merenja. Zaštićeni PRED ID-jevi i QS deonice ostaju. Nova buduća sesija ne dobija identitet koji bi starom unosu promenio značenje. Ručno sačuvan budući težak trening dobija napomenu za posebnu proveru.
- Pregled pre primene prikazuje preostale km, kvalitetne minute i broj zahtevnih dana. Ako se plan, dnevnik, merenje, datum ili oporavak promene nakon pregleda, primena se odbija. Predlog se ne može ponovo primeniti niti izmenjenom kopijom podmetnuti drugi plan.
- Poslednjih pet plan-only verzija može se pregledati i vratiti za budućnost. Dnevnik, actual pace, VDOT/test rezultati, ručne izmene i pomeranja ne dolaze iz snapshot-a. Vraćanje i poništavanje automatskog tempa štite novije odrađene/izmerene dane.
- Schema 12 dodaje opcionu eksplicitnu PRED zonu i ograničene verzije. Migracija čita v11 bez prepisivanja starih planova; njihov opis sesije ostaje fallback za zonu. Export/import, storage i payload provere prate novu verziju.

## Nezavisna provera

Kriterijumi: `GENERATOR_PHASE3_CRITERIA.md`. Pregled: `GENERATOR_PHASE3_REVIEW.md`. Reprodukcija: `node docs/probes/generator-phase3.mjs` (Node 24). Tačni ulazi, kompletni planovi i pregledi svih nedelja su u `docs/qa/generator-phase3/profiles.json`; digest vezuje izlaz za proverene izvore. Provereno je 12 glavnih profila plus 48 potpunih dodatnih rasporeda / 960 kalendarskih nedelja. Tri nezavisno otkrivena prekoračenja povratničkog rasta su popravljena i matrica je ponovljena.

Golden izlazi su osveženi tek nakon kriterijumskih/regresionih provera. Legacy recordings ostaju netaknuti. Poznate promene stare semantike (R kao dokaz forme, nepouzdani dnevnik, kompatibilnost zona i verzija šeme) imaju eksplicitna očekivanja, dok ostala import/payload/migration poređenja ostaju. Ponovljeni generator od 2304 profila menja samo potrebne PRED zapise zona; zasebni replan golden prati novu zaštitu i povratak.

Konačni `npm run check` je prošao: strict typecheck, lint, format i **1404 testa u 132 fajla**. `npm run build` prolazi. Generator golden matrica od 2304 profila ima 1920 promenjenih hash-eva zbog novih PRED zona; broj nedelja, kilometraža, broj kvalitetnih treninga i oba VDOT sažetka ostaju identični fazi 2. Random golden menja 1467/1500 hash-eva, replan 124/124. Konačni izlaz nezavisne probe je SHA256 `1b5d44924cb06d4934b75e210fda5b4993ba7793d7335c2877c6889310580e92`. GitHub CI i browser rezultat navode se u draft PR-u faze 3. Browser tok `web/e2e/phase3-execution.spec.ts` radi kroz stvarni wizard i UI: preview → apply → reload → novi trening → restore → reload, uz proveru očuvanog dnevnika. Lokalno je proverena njegova TypeScript sintaksa/discovery; izvršavanje Chromium testa proverava CI.

## Granice

Ovo je agentska analiza prema javnim trenerskim principima i izvršivi QA; nije potvrda ljudskog trenera. Nijedan test ne dokazuje individualni napredak ni zdravstvenu spremnost. Predlog povratka ne pretvara stari PB u dokazanu novu formu. Generator neće sabiti ciklus ispod minimuma distance niti automatski promeniti datum trke; za takav slučaj korisnik dobija objašnjenje. Pragovi pokrivenosti, vremena rada, svežine i povratničkog opterećenja ostaju dokumentovane konzervativne postavke koje se mogu kasnije kalibrisati iz kvalitetnih stvarnih podataka.

## Nastavak

Pregledati i prihvatiti PR-ove redom #32 → #33 → faza 3. Produkciju ne menjati pre tog pregleda. Posle prihvatanja napraviti stvarne planove u test nalogu i sa trenerom oceniti kvalitetnu dozu, dugoročni rast i smer prilagođavanja; menjati pravila na osnovu tih nalaza, ne uvoditi obavezan šablon iste sesije za svaki profil.

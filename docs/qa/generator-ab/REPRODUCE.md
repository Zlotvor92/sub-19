# Reprodukcija QA

Potreban je Node 24 za sinhrone TypeScript import hooks u probama. Browser testovi rade i u Node 22 CI okruženju kroz Playwright.

## Dve verzije i isti ulazi

Pripremiti odvojeni checkout starog commita `aea8dc66e5e6a9940ce48d63a94daace76be1297` i novog `f7bcbe99d135cd4c1e7b837d0369e8066c1b3baa`. QA skripte/dokumenti nisu deo starog generatora. `manifest.json` beleži originalne lokalne putanje; na drugom računaru postaviti `SUB20_QA_OLD_ROOT` i `SUB20_QA_NEW_ROOT` na te checkout-e:

```bash
SUB20_QA_OLD_ROOT=/path/to/old SUB20_QA_NEW_ROOT=/path/to/new node docs/probes/generator-ab-qa.mjs
```

Skripta generiše `raw/U01.json`–`raw/U10.json` i neutralno označene kopije u `blind/`. SHA256 unutar raw zapisa odnosi se na JSON sadržaj plana, ne na formatiranje cele datoteke. Sve ulaze čuva `inputs.json`. Ne menjati ulaze da bi se popravila ocena.

## Događaji korisnika

Pokrenuti `node docs/qa/generator-ab/users/U01-probe.mjs`, pa analogno U02–U10. Svaka proba čuva kompletne domenske ulaze, sintetički dnevnik, analizu, rezultat/odbijanje, provere i njihov domet. U03 dodatno pokreće postojeći store test za blokadu bržeg rada uz visok napor/bol/razmak; potrebne su zavisnosti u `web/node_modules`. Probe u ovoj radnoj kopiji koriste postojeće zaključane lokalne putanje i proveravaju SHA256 početnih planova. Na drugom računaru pregledati njihove putanje pre pokretanja; ne predstavljati ih kao potpuno nezavisan paket bez checkout-a.

U01 koristi **novi consumer izvršenja** nad oba zamrznuta osnovna plana, pošto stara verzija nema novu executionAdjustment funkciju. To nije test stare UI automatike. U05 zasebno poziva stare i nove javne goal-change funkcije. U08 glavni događaj ostaje odbijen; uspešna ranija simulacija je označena kao dodatna, a ne zamena prvobitnog ulaza.

## Trenerske ocene

`node docs/probes/generator-ab-summary.mjs` proverava svih 80 ocena, pondere, jedinstvenost profila/A/B strane i broj pregledanih nedelja. Tek po čitanju četiri zaključana glavna pregleda pravi `summary.json` sa otkrivenim identitetima, glavnom ocenom eksperta distance, drugim ocenama i rasponom. Dopunski `marathon-scores.json` nije u glavnom zbiru; koristi se `marathon-primary-scores.json`.

`node docs/probes/generator-ab-evidence-check.mjs` proverava svih 40 korisničkih datoteka, deset event zapisa svakog od četiri glavna trenera i nepromenjene SHA256 početnih ocena, pa pravi `event-review-summary.json`. Ne ponavlja API niti tvrdi da validira fiziološki efekat.

Otkriveni A/B identitet čuva se u `summary.json`. Ne koristiti već otkrivene identitete za tvrdnju da je naknadni reviewer radio slepo.

Izolovani tehnički uzrok RP pauza: `node docs/probes/generator-ab-purpose-probe.mjs`. Isti produkcioni builder kreće sa 60 s oporavka; legacy fallback u dozirajućoj funkciji menja ga na 240 s pre nego što konačna funkcija dodeli RP. Eksplicitna RP zona u kontrolnom ulazu čuva 60 s. Ovo ne proglašava 60 s univerzalno optimalnim oporavkom; dokazuje promenu svrhe tokom pipeline-a.

## Browser

```bash
cd web
npx playwright install --with-deps chromium
npx playwright test e2e/generator-ab-users.spec.ts --workers=2
```

Deset izolovanih profila prolazi pravi čarobnjak i poređenje sa zaključanim novim planom. Devet ima preview → apply → reload → unos trčanja → restore → reload, dok U08 potvrđuje očekivano odbijanje prekratkog preostalog HM ciklusa bez upisa verzije. Za profile čiji glavni događaj nije pauza, browser povratak je dodatni kontrolisani persistence događaj, jasno označen u attachment-u; specifični događaj je u njihovoj domenskoj probi.

Samo autentifikacija je seedovana. Dnevnik/plan nisu direktno ubacivani. Backend je lažan i izolovan. Potvrđeni rezultat ovog testa ne dokazuje produkcioni server, stvarne satove ili učinak na ljudima.

Prvi CI sa 76 uspešnih browser testova nije sačuvao HTML attachment-e zbog pogrešne upload putanje. Završni workflow čuva `web/playwright-report/` i, kada postoje, `web/test-results/` u `generator-ab-browser-evidence`. Konačni CI identitet i domet vizuelnog pregleda nalaze se u glavnom izveštaju/PR opisu.

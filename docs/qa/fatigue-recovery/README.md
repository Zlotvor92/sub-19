# Razdvajanje umora, pauze, izvršenog obima i promene cilja

Baza implementacije: završeni koraci 4–7, PR #38 (`548d1b1`), #39 (`c2d1589`), #40 (`c1276d2`) i zasebni #41 (`8d8004a`), lokalno integrisani u `33b732ca84aaad8db085159c7254bb23b809cf7f`. Uključene su i prethodna finalizacija `56269a6` i svrha sesija `38ecc08`. Zaključani QA dokazi: `f8cb2081ed4ba223fe7efe14a621144beb9bce0d`. Originalni `generator-ab/` ulazi, raw/blind planovi, događaji i trenerske ocene nisu menjani. Ovaj direktorijum sadrži zasebne nove izlaze.

## Pravila

- Potvrđena pauza: čuva istorijski kontinuitet, ali eksplicitno bira trenutnu spremnost `returning`, smanjenje baze i postojeći povratni period.
- Visok napor: dva ili više lakih treninga sa RPE 7–10 biraju `fatigued`, bez izmišljanja pauze. Ostatak tekuće i sledeća puna kalendarska nedelja ostaju rasterećenje bez kvaliteta/ubrzanja/brzog završetka (najmanje sedam dana). Nedeljni obim ne prelazi prethodni budući raspored ni 85% baze, srazmerno preostalim danima delimične nedelje. Pojedinačni datumi ne prelaze prethodnu dozu. Granice se zaokružuju naniže na 0,1 km.
- Manji izvršeni obim/propušteni treninzi: `reduced-volume`; baza prati izvršenje/prijavljeni obim, istorija ostaje. Ne tvrdi se da je bilo pauze. Nedovoljni podaci ostaju nepoznati.
- Promena cilja: menja ciljno vreme zasebnim putem; ne služi kao razlog za brisanje istorije niti za zaobilaženje aktivnog kalendarskog oporavka. Rekalibracija takođe zadržava već potvrđeni kontinuitet.

Trenutna spremnost je vremenski označena odvojeno od `consistentWeeks`. Stara pauza nakon koje već postoji potvrđen kontinuitet ne proglašava se novom pauzom. Recovery gate i dalje blokira brže predloge zbog bola, visokog RPE i nepotvrđenog razmaka; aktivni period oporavka dodatno blokira ubrzanje čak i ako RPE zapis izađe iz vremenskog prozora.

Zaštićeni dani, merenja/PRED/QS, stvarni km/sec i efektivni datumi ostaju. Zaštićen kvalitet ili obim koji protivreči oporavku ostaje sa datumom i eksplicitnim konfliktom; aplikacija ga ne prepisuje. Agregati, fokus i opisi računaju se posle zaštite/oporavka.

## Pre/posle na istim zaključanim ulazima

| Primer | Pre (najnovije prethodne popravke) | Posle |
| --- | --- | --- |
| U03 istorija | 24 nedelje postaju 0 | Ostaje 24; trenutna spremnost `fatigued` |
| U03 W8, 30.11–6.12 | 48,8 km; 2,19 min kvaliteta; bez deload oznake | 38,0 km; 0 min kvaliteta; deload |
| U03 originalni QA plan W8 | 40,2 km, bez kvaliteta | Novi izlaz ne povećava neposredni obim; manji pojedinačni propisi ostaju manji |
| U02/U07 kontinuitet | 12 nedelja postaje 0; tekst sadrži pauzu | Ostaje 12; tekst navodi manji izvršeni obim |

Originalni QA navodi 2,25 min rada u U03 W8. Najnovija baza posle popravke svrhe sesija daje 2,19 min; zato `before.json` reprodukuje najnoviji prethodni kod, a istorijski nalaz ostaje nepromenjen.

## Reprodukcija

Node 24, instalirane `web/` zavisnosti. Probe samo čita originalne QA ulaze i piše `before.json`/`after.json` u ovaj direktorijum:

```bash
# Checkout integrisane prethodne verzije 33b732ca84aaad8db085159c7254bb23b809cf7f u zasebnu putanju.
SUB20_RECOVERY_CODE_ROOT=/path/to/previous SUB20_RECOVERY_LABEL=before node docs/qa/fatigue-recovery/probe.mjs
SUB20_RECOVERY_PREVIOUS_ROOT=/path/to/previous node docs/qa/fatigue-recovery/probe.mjs
cd web
npm test -- src/domain/plan/fatigueRecovery.node.test.ts src/domain/plan/finalize.node.test.ts src/stores/executionActions.test.ts
npm run check
npm run build
```

`before.json` i `after.json` čuvaju kompletne nove rezultate i hash istorijskih događaja. `reentry-parity.json` proverava osam promenjenih re-entry očekivanja: isti dani i predikcije; samo kontinuitet 0→null, eksplicitna trenutna povratna spremnost i dodatna poruka o nepoznatom kontinuitetu. Razlozi za promenu očekivanja su navedeni u `docs/ENGINE_CHANGES.md`. Opšti generator fingerprint i differential očekivanja nisu osvežavana.

## Ograničenja

Pravilo oporavka je konzervativna politika aplikacije; ne određuje fiziološki oporavak konkretnog trkača. Izlazak iz kalendarskog prozora nije dokaz oporavka: recovery gate i dalje proverava noviji napor, bol i dnevnik. Zaštićeni konflikti zahtevaju korisničku odluku. Završene popravke doze, HM progresije, izbora ograničenog ciklusa i uslovnog run/walk-a su uključene. U ovom segmentu nisu menjane njihove doze, pragovi i politike. Nove trenerske ocene i validacija na sportistima nisu rađene.

## Uključeni završeni koraci 4–7

PR #41 je počeo na staroj QA bazi; ovde je integrisan sa lancem #38–#40. Konflikti su rešeni zadržavanjem HM raspodele i omotača za referentne ritmove, obe grupe UI opcija (odluka o ciklusu + run/walk), obe grupe UI testova i svih novih domenskih testova. Finalizacija čuva effort-first instrukcije i datum probnog prelaza na neprekidno trčanje; hold/step-back ne briše istorijski kontinuitet. Opcije iz koraka 6 (produženje, kraća distanca, bazni režim) ne zaobilaze novi oporavak.

Snapshot promene integracije: postojeći otisci HM i run/walk grana morali su da budu spojeni jer su polazili sa različitih baza. Osvežen je kombinovani baseline za run/walk/form opise i HM progresiju; nakon toga ovaj segment menja samo osam re-entry hash-eva. U01/U06 očekivanja u quality-dose protection testu sada uključuju završeni korak 7 (probni prelaz, uklonjena rana ubrzanja, effort-first tekst i oznaka trenutne povratne spremnosti); U04 i svi taper zaštitni hash-evi ostaju. `current-summary.json` potvrđuje da svih deset početnih planova zadržava identične nedelje i predikcije u odnosu na integrisanu bazu, a browser test koristi odvojene `current/UXX.json` izlaze. Originalni dokazi i svi prethodni segmentni izlazi su netaknuti.

# Generator: run/walk prelaz i nepouzdana forma

Baza: `f8cb2081ed4ba223fe7efe14a621144beb9bce0d`. Originalni QA ulazi, `raw/`, `blind/` i trenerske ocene u `docs/qa/generator-ab/` nisu menjani. Novi izlazi: `docs/qa/generator-runwalk-form/` (`before-probes.json` = generator na zaključanom commitu, `after-probes.json` = posle ove izmene; ulazi U01/U06 iz `generator-ab/inputs.json`).

## Šta je popravljeno

**U01 (početnik, run/walk).** Lestvica 1→4 ostaje, ali W5 više nije automatski izlaz. Prva neprekidna nedelja je probna: nema ubrzanja, svaki dan nosi uslov (poslednja run/walk trčanja razgovorna, napor do 5/10, bez bola) i rezervu („ponovi korak 5:1 i prilagodi plan"). `meta.runWalk` nosi lestvicu i uslove.
Prilagođavanje: `runWalkLadder` ulaz generatora (1–8 koraka 1–4), `assessRunWalkProgress` (tolerancija iz upisanog `rpe`, `knee`, preskočenih, oporavka), `buildRunWalkAdjustment` (zadrži korak, vrati jedan korak, ponovi fazu) i opcija „Ponovi ili zadrži trčanje/hod" u kartici „Prema odrađenim treninzima" sa pregledom pre primene.
Nepopunjen dnevnik = `unknown`: ne potvrđuje napredak i ne računa se kao neuspeh. Završeno bez napora = `unreported`, ne dokaz tolerancije.

**U06 (povratnik, star PB).** `formPolicyFor`: `returning` i `stale-result` → `effort-first`. Laki/dugi dani: napor 3–4/10, ritam je gornja granica iz starog rezultata. Kvalitet: `paceBasis: 'reference'`, napor po zoni, ritam označen kao referenca, uslovi uz prvi kvalitetan trening plana. Bez ubrzanja u baznim nedeljama. `qualityEntryGate` (obim ≥75% u dve pune nedelje, bez bola 4+, najviše jedan lak sa naporom 7+, forma potvrđena merenjem ≤90 dana) prikazuje se u kartici. Prihvaćeno merenje (`refreshSessionPace`) uklanja tvrdnju „referenca"; poništavanje je vraća. Nedatiran rezultat ostaje nepoznat i ne aktivira politiku. Cilj (`goalSec`) je neizmenjen i izričito odvojen od forme.

Sačuvano bez izmene: `positiveAdjustmentBlock` (recovery gate), `vdotProposal` pragovi/prihvatanje, `graftFuturePlan` zaštita završenih, merenih, ručnih i prošlih dana.

## Pre / posle

U01 W5 ponedeljak. Pre: `2.9 km lako (Z2) @ ~8:38/km + 6×20 s ubrzanja (lagani ubrzani koraci, pun oporavak)`. Posle: `2.9 km lako (Z2) @ ~8:38/km · Prelaz na neprekidno trčanje je probni: radi ga samo ako su poslednja run/walk trčanja bila razgovorna (napor do 5/10) i bez bola. Ako nisu, ponovi korak „5 min trčanja / 1 min hoda" i prilagodi plan …`
U06 W5 fartlek. Pre: `… 4×45 s brzo @ ~5:40/km …`. Posle: isti ritam plus `Forma nije potvrđena: vodi se naporom 7/10 … Ritam ~5:40/km je referenca iz starog rezultata, ne zahtev · Uvodi se tek kad: 1) … 2) … 3) …`.
U01 hold (sreda W4, korak 5:1): W5 postaje 5:1 run/walk, W6 probni prelaz; W1–W4 i dani sa upisom ostaju (`runWalkAdjustment.test.ts`).

## Ograničenja

- Uslovi za zahtevniji rad su tekst i savet (kartica), ne tvrda blokada u statičnom planu; ritmovi U06 kvaliteta i dalje su numerički u `session.paceSec` (satovi/predikcije ih koriste).
- Pragovi (RPE 5/7, bol 3/4, 3 trčanja, 75%, 90 dana) su proizvodne postavke bez validacije na ljudima.
- `knee` polje dnevnika nosi bol bilo kog dela tela uz taj trening; tolerancija zavisi od toga da korisnik upiše napor.
- Lestvica traži restart generatora od sutrašnjeg dana: obim se vraća na dnevnikom potvrđenu bazu (ili prijavljenu početnu), uz zaštitu već upisanog.
- `undated-result` nije tretiran kao star; samo datum >90 dana ili pauza aktiviraju politiku.
- Nije pokrenut Playwright e2e (nema pregledača u ovom prozoru); UI je pokriven komponentnim testom.

## Provere

`npm run typecheck`, `lint`, `format:check` čisti; `vitest run`: 137 fajlova, 1.433 testa prolazi (baza: 132 / 1.404). Novi testovi: `runWalkAndForm.regression` (10), `runWalkProgress` (7), `runWalkAdjustment` (4), `qualityGate` (5), `referenceNote` (1), 2 UI.
Izmenjeni očekivani rezultati: fingerprint/differential/D6 baseline-i, samo za početničke scenarije (1.152 od 2.304 hash-eva, km i broj kvaliteta nepromenjeni); razlog: nova meta (`runWalk`), upozorenje i opis probne nedelje.

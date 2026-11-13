# Brief R8 — zahtevi 10K za motor + ostatak HM, 13. 11. 2026

Polazište `claude/v4` @ `aca41b0`. Druga distanca (10K, `reports/F7-10K-REPORT.md` § zahtevi za motor) pokazala
je gde motor nije opšti. Pročitaj taj izveštaj i `tenk/scenarios.test.ts` (`KNOWN`). Sve je pravilo motora; brojevi
su podatak distance. UPOREDO radi tab forme na `engine/vdot.ts`, `engine/types.ts` (polja `transferBeta`,
`betaPersonal`) i računanju tempa (lična kriva forme po dužini, LOG 07:32) — te delove NE diraj; stavka 6 (forma,
„ništa" sporije 1–30 s, s03) je njegova. `git pull --rebase` pre svakog push-a, ceo V4 skup posle rebase-a.

1. Čuvar `taper` čita `safety.taper.weekBeforeMaxOfPeak` (ne konstantu 60 %).
2. Doza = min(plafon nivoa, dosePct × osnovica): kod velikog obima mali % ne sme dati skoro pun plafon (p05 N−2) —
   dosePct se primenjuje i na plafon u nedeljama sužavanja/rasterećenja.
3. `zoneGapReplacement` (zamenski podražaj) nosi `dosePct` originala.
4. Skraćenje doze ispod `minReps` unosa: bira se manji unos istog podražaja ili se smanjuje trajanje ponavljanja;
   Z3 (≤ 60 % posle bola) i sužavanje moraju moći ispod minReps (10K s13/s15/s16; HM isto pravilo).
5. `deriveEvents`: razmak bez trčanja je pauza samo ako je duži od najvećeg razmaka u rasporedu trkača + 2 dana
   (3 dana nedeljno: 5 dana bez trčanja nije pauza — 10K s11).
6. (forma — ne ti.)
7. `obim-za-nivo` / Z8: kvalitet se SKRAĆUJE do najmanje smislene doze, briše se tek ako ni ona ne staje
   (10K p02, p06; HM p06 dva kvaliteta od ned 3).
8. Raspon tempa na dan trke (`paceFrom/paceTo`, sada + 5 / + 10 s/km u motoru) postaje podatak distance.
9. `adequate.shorter.distanceId` koristi id foldera distance (`tenk`), ne '10k'; test da svaki takav id postoji.
10. Z10: rep posle više događaja ≤ 4 nedelje ukupno (10K s26: 4 ned + 6 dana).
11. HM ostatak (Y3): izlazak iz POČETNE rampe (plan počinje dan posle testa/trke) po pravilu R2 — dugi ≤ + 25 % /
    + 20 min nedelju za nedeljom (P2 B 35 → 65 min); pod laganog dana iz istorije kad istorija to nosi (P1 A ≥ 7 km).
12. Kapije obe distance bez izuzetaka koji su uvedeni zbog 1–7 (10K: „lagan na najkraćem trajanju", „lagan-kratak
    bez donje granice") — ukloni izuzetak kad pravilo radi; `KNOWN` u `tenk/scenarios.test.ts` skrati.

Isporuka: test po stavci, obe kapije 0 prekršaja, otisci i ispisi obe distance osveženi (navedi koji su se
promenili i zašto), `docs/generators-v4/reports/R8-REPORT.md` (≤ 60 redova), poruka organizatoru. U `tenk/` smeš da
menjaš samo testove/otiske/izuzetke kapije, ne šablone i biblioteku.

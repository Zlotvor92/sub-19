# Poslednje ispravke (odluka korisnika 24. 10. 2026) — posle ovoga kraj

Izvor: trenerska ocena početnog plana `audit/coach-final/{5K,10K,HM,MAR}.md`. Korisnik je izabrao tačno 3 stavke.
Ništa preko ovog spiska.

## F1 — poruke korisniku bez tehničkih oznaka (sve 4 distance)

Važi za sav tekst koji korisnik vidi: napomene nedelje i dana, upozorenja, ocenu cilja, razloge odbijanja i preporuke.

1. **Bez internih oznaka.** U tekstu korisnika ne sme biti oznaka pravila i internih imena: D5, D11, M6, M13a, M7a,
   L11, A24, „pouka N", „segment N", „T_cruise", „plafon zone", „ne-rasteretni", „cilj po pravilu", formula
   „max(1,1 × …)", kodovi tipa `EASY_BUILD`. Umesto oznake piše se šta to znači za trkača. Primeri:
   - „najviše 10 % nedelje u tempu" umesto „plafon T 10 %";
   - „dugi trk raste najviše 10 % ili 1 km nedeljno" umesto formule.
2. **Brojevi u tekstu** idu sa decimalnim zarezom. To važi i za ocenu cilja.
3. **Bez besmislenih rečenica.**
   - Upozorenje se ne prikazuje kada su obe vrednosti posle zaokruživanja iste. Primer: „Vrh 75,0 km umesto do
     75,0 km", „Planirano 32,4 < cilj 32,4".
   - „Planirano < cilj" se prikazuje samo kad je razlika bar 1 km ili bar 3 % cilja.
4. **Razlog u upozorenju je stvarni razlog.** Primer iz MAR: kad obim seče plafon skoka dugog, poruka ne sme da kaže
   „udeo dugog".
5. **5K trčanje/hodanje:** poruka trkačke nedelje kaže jasno da li se u trci hoda i po kojoj šemi, bez „L11".
6. **Kodovi upozorenja i odbijanja (`code`) ostaju isti.** Menja se samo tekst (`message`, `userText`, napomene).

## F2 — maraton, početnik: duže najduže dugo trčanje (samo MAR)

Stanje: `pocetnik-4d-30km-20w` ima vrh 45 km i najduži dugi 18,0 km, jer udeo dugog trka ograničava na 40/35 %
nedelje. Orijentir za početnika je 26–32 km (Hansons oko 26 km, Higdon Novice oko 32 km).

1. Samo za `experience: beginner` u MAR, i samo u poslednje 3 nedelje izgradnje pred taperom:
   - dugi sme do **50 % nedelje**;
   - trajanje dugog najviše **180 min**, umesto 150 min.
2. Pravilo skoka dugog (pouka 28) i T1 ostaju.
3. Rast nedeljnog obima ostaje po postojećem pravilu.
4. Ciljni vrh dugog za početnika: **≥ 26 km**, kad priprema i obim to dozvoljavaju.
5. Kad ni tada ne staje (kratka priprema, mali obim), korisnik dobija jasno upozorenje običnim rečima. Primer:
   „Najduže dugo trčanje u planu je X km; za maraton se preporučuje bar 26 km — duža priprema ili veći nedeljni obim
   bi pomogli."
6. Ostali profili (ne početnik) se ne menjaju. To proverava otisak: van početnika promena 0.

## F3 — odbijanje nemogućeg unosa za skorašnje najduže trčanje (HM i MAR, gde postoji taj unos)

1. Ako je skorašnje najduže trčanje **kraće od nedeljnog obima / 7**, unos je nemoguć: ni sa 7 dana trčanja nedelja
   ne može biti tolika. Primer: 65 km nedeljno uz najduže 8 km.
2. Takav unos se odbija porukom iste vrste kao T7 („… — proveri unos"), sa oba broja.
3. Granica je 7 dana, ne broj dana plana, jer trenutno trčanje može biti raspoređeno na više dana nego plan.
4. Ostali unosi se ne menjaju.

## Testovi (AGENTS.md)

1. `npm run check`.
2. `npx vitest run --changed 886b6c4`.
3. Pun nivo foldera svoje distance:
   - `TEST_FULL=1 npx vitest run --project node <folder>`;
   - zatim E2E svoje distance.
4. Bez `run-all`, bez merenja lanaca, bez `check:full`.
5. Otisci (byteSame) drugih distanci: samo redovi svoje distance, uz odobrenje organizatora. Pre push-a `git pull
   --rebase`. CI posle push-a mora biti zelen.

## Izveštaj organizatoru

Za svaku stavku: urađeno ili ne, i jedan primer pre → posle (tekst poruke ili km). Navesti SHA i CI.

# Dubinska provera generatora v2 (5K, 10K, HM, maraton) — plan

Pokreće organizator posle nedeljnog reseta (četvrtak 22. 10. 2026, 08:00 UTC), kad su domenski segmenti svih distanci
završeni i provereni. Cilj: naći ono što dosadašnje mreže i pretrage nisu pokrile, pre faze 2 (aplikacija za HM i
maraton) i pre mergea u main. Svaki nalaz = broj, ulaz koji ga reprodukuje, uzrok; ispravke tek posle odluke
organizatora, u jednoj sesiji po distanci (5K/10K su zamrznuti — otvaraju se samo za stvarno odbijanje ili neispravan
plan).

## Uglovi (svaki = jedna radna sesija ili agent, samo čitanje + merne skripte, bez izmene jezgra)

1. **Trenersko čitanje** — po distanci 12 planova (mali/veliki obim, spor/brz, 3–6 dana, po osećaju, početnik) i 6
   adaptiranih (bol, pauza, umor pre starta, rezultat, lanac): da li bi trener potpisao plan; šta je čudno (nagli skok,
   monotonija, besmislen trening, tekst napomene).
2. **Nasumični ulazi (fuzz)** — slučajni ali dozvoljeni ulazi van mreža (datumi, dani u nedelji, obim na granicama,
   rezultat star 0/84 dana, VDOT na granicama, raspored dugog), 100 000+ po distanci: odbijanje koje nije dokumentovano,
   izuzetak (throw), plan koji krši invarijante.
3. **Nasumični nizovi činjenica** — lanci od 2–6 adaptacija sa slučajnim činjenicama (bol, pauza, umor, manjak, višak,
   rezultat, zaključani dani), asOf bilo koji dan od start − 7 do trke: 0 odbijanja, prošlost bajt-ista, idempotentnost
   (ista adaptacija dvaput = isti plan).
4. **Jedan vlasnik (čitanje koda)** — za svaku veličinu koju koriste konstruktor i validator (najduži dugi, poslednja
   izgradnja, minimum nedelje, plafon zone, osnova povratka, okviri nedelja): da li postoji JEDNA funkcija; dve
   definicije iste stvari = nalaz (pouka 24).
5. **Doslednost distanci** — ista pouka iz MASTER (1–34) i isto pravilo 10K/5K: da li je primenjena u svim distancama
   isto (npr. pouka 32, 33, 34, 30); razlike bez obrazloženja = nalaz.
6. **Aplikacija 5K/10K (iza prekidača)** — E2E tokovi: kreiranje plana, uvoz, prilagođavanje (pregled → potvrda →
   revizija), vraćanje verzije, promena cilja; v1 i lični plan bajt-isti.

## Izlaz

`docs/generators-v2/AUDIT-REPORT.md`: tabela nalaza (ugao, distanca, broj, ulaz, uzrok, predlog), odluke organizatora,
plan ispravki po distanci. Posle ispravki: faza 2 (HM-05 → HM-06 → MAR-05 → MAR-06), faza 3 (predaja), faza 4
(kompletna provera + `npm run check:full` + ceo E2E). Merge u main i uključivanje za korisnike — samo na izričitu odluku
korisnika.

# Trenerska ocena početnog plana v2 — zadatak za 4 sesije (5K, 10K, HM, MAR)

Nalog korisnika (24. 10. 2026): svaka sesija pregleda **isključivo generator svoje distance** — početni plan koji
nastaje iz profila. Plan se ocenjuje kao što bi ga ocenio iskusan trkački trener.

## Zabranjeno

- **Nikakvi testovi**: ni `vitest`, ni `npm run check`, ni `run-all`, ni E2E, ni sabotaže.
- Adaptacije, izmene plana, predaja (handoff), vraćanje revizije, prekidači — ništa od toga se ne gleda.
- Izmene koda aplikacije (`web/src/**`). Commit je dozvoljen samo za izveštaj i skriptu u ovom folderu.

## Kako se generišu planovi

- Kod: vrh grane `claude/generator-isolation-5k-10k-hm-marathon`.
- Ulaz u generator: `docs/generators-v2/final-check/lib.ts` → `distOf("<5K|10K|HM|MAR>").generate(input)`.
- Gotovi profili, uzmi samo deo „generator", ne adaptacije i ne predaju:
  - 5K i 10K: `docs/generators-v2/audit/coach-5k-10k/coach.ts`, niz `PROFILES` i funkcija `inp`;
  - HM i MAR: `docs/generators-v2/audit/coach-hm-mar/coach2.ts`, niz `PROFILES` i funkcija `inp`.
- Svoju skriptu stavi u `docs/generators-v2/audit/coach-final/<D>-gen.ts`. Pokreće se iz `web/`:
  `node ../docs/generators-v2/audit/coach-final/<D>-gen.ts`.
  - Ispis po nedelji: faza, cilj/planirano km, dugi, lagani, kvalitet (doza, WU/CD, tempo), napomene, upozorenja.
- Najmanje 15 profila, pokrivaju:
  - dane 3/4/5/6, koliko distanca podržava;
  - mali i veliki obim;
  - spor i brz trkač, VDOT oko 33–65;
  - „po osećaju" (bez rezultata);
  - početnika;
  - najkraću i najdužu pripremu.
- Dodatno po distanci:
  - 5K: trčanje/hodanje i profil korisnika (5K 20:25, cilj < 20:00, 30 km nedeljno, 4 dana, trka 13. 12. 2026,
    start 19. 10. 2026);
  - HM/MAR: različit skorašnji najduži trk.

## Lista provere (trenersko čitanje)

1. **Obim**
   - Polazak u odnosu na trenutni obim.
   - Nedeljni rast: orijentir je ≤ ~10 %, to je mišljenje, ne pravilo.
   - Rasterećenja: koliko često i koliko pada obim.
   - Da li je vrh realan za nivo trkača.
2. **Dugi trk**
   - Udeo u nedelji i progresija.
   - Najduži dugi u odnosu na distancu. Za MAR orijentir je oko 30–35 km i oko 3 h.
   - Dugi je duži od svakog laganog.
3. **Raspodela intenziteta**
   - Lagano je većina, orijentir ~75–80 %.
   - Broj dana kvaliteta u odnosu na broj dana i nivo trkača.
4. **Kvalitet**
   - Vrste treninga po fazi.
   - Doze u granicama. Daniels: I ≤ 8 % nedelje (najviše 10 km), T ≤ 10 %, R ≤ 5 %.
   - Progresija doze.
   - Razumni WU/CD.
5. **Tempo**: lagan, T, I, R i MP u skladu sa VDOT (Daniels tablice), i ciljni tempo trke.
6. **Taper i trkačka nedelja**
   - Trajanje, pad obima i da li ostaje intenzitet.
   - Dan pred trku.
7. **Raspored dana**
   - Težak dan pa lagan.
   - Dugi i kvalitet nisu uzastopni, osim kad je neizbežno.
   - Odmor.
8. **Početnik i trčanje/hodanje**: bezbedno i postepeno.
9. **Poruke korisniku** (napomene, upozorenja, ocena cilja): tačne, razumljive, bez internih oznaka.

## Izveštaj

Napiši `docs/generators-v2/audit/coach-final/<D>.md`, kratko:

1. Ocena plana 1–10 i jedna rečenica.
2. Tabela problema sa kolonama:
   - problem;
   - primer (profil, nedelja, brojevi);
   - koliko profila ga ima;
   - bitnost: **blokira** / **bitno** / **sitno**;
   - činjenica ili mišljenje.
3. Šta je dobro, kratko.
4. Šta bi trener promenio, opisno, bez koda.

Izvor navedi samo kad si siguran (Daniels, Pfitzinger, Hansons). Inače napiši „mišljenje".

Na kraju:

1. `git pull --rebase`, commit samo `<D>.md` i `<D>-gen.ts`, push. Docs ne pokreće CI.
2. Pošalji organizatoru `send_message` na `session_01CtvbsCTQ3RmMWYYTgGt6Wm`: ocena, najviše 5 glavnih problema sa
   bitnošću i SHA.

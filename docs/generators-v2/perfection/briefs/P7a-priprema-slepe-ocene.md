# P7a — priprema slepe trenerske ocene (ispisi planova pre/posle, anonimno)

Mehanički zadatak. Ne menjaš `web/src/**`, ne pokrećeš testove. Menjaš samo `docs/generators-v2/perfection/P7/**`.

## Šta praviš

Za svaku distancu (5K, 10K, HM, MAR) 12 profila × 2 verzije generatora:
- verzija „pre" = commit `6bbeabd` (stanje pre programa); verzija „posle" = vrh radne grane u trenutku rada (zapiši SHA).
- „pre" generiši iz `git worktree add <privremeni folder van repoa> 6bbeabd` (isti ulaz, ista skripta); worktree na kraju
  ukloni. U worktree-u treba `npm ci` u `web/` ili simbolička veza na `web/node_modules` vrha (isti `package-lock.json`
  — proveri `git diff 6bbeabd HEAD -- web/package-lock.json`; ako se razlikuje, `npm ci`).
- Ulaz u generator: `docs/generators-v2/final-check/lib.ts` → `distOf("<D>").generate(input)` (isto na oba commita).

## Profili (isti za obe verzije; po distanci prilagodi obim redu tabele dana te distance)

1. (a) 10 km 46:00, 40 km/ned, 4 dana uto/čet/sub/ned, 16 ned (5K: 12 ned), skorašnji najduži 14 km, cilj = prognoza −2 %.
2. 5K 20:25, 30 km, 4 dana, 8 ned (samo 5K i 10K; HM/MAR: isti trkač, 14 / 18 ned, 40 km).
3. Spor: VDOT 33 (10 km ≈ 60:00), dno obima, 3 dana, srednja priprema.
4. Spor, 5 dana, sredina obima, najduža priprema.
5. Brz: VDOT 60, vrh obima, 6 dana (5K: 5), srednja priprema.
6. Brz, mali obim: VDOT 58, dno obima za 5 dana, najkraća priprema.
7. Srednji: VDOT 45, 5 dana, sredina obima, najkraća priprema.
8. Srednji, 3 dana, vrh obima reda 3 dana, najduža priprema.
9. Po osećaju: lagan tempo 6:00/km, 4 dana, sredina obima, srednja priprema.
10. Po osećaju, spor: lagan 7:30/km, 3 dana, dno obima, najduža priprema.
11. Početnik sa rezultatom (VDOT 35), dno tabele početnika, najduža priprema.
12. Početnik po osećaju (lagan 7:00/km), vrh tabele početnika, srednja priprema.
Ako verzija „pre" odbije ulaz koji „posle" prima (ili obrnuto), zadrži profil i upiši odbijanje kao ishod te verzije.

## Ispis (ono što trener čita)

Po planu jedan tekstualni fajl: zaglavlje profila (ulaz rečima), tempo zone, ocena cilja, pa po nedelji: redni broj, faza,
da li je rasterećenje, cilj/planirano km, svaki dan (dan u nedelji, naslov treninga kako ga vidi korisnik, km, trajanje,
radni minuti), napomene nedelje i upozorenja plana. BEZ `policyId`, `policyVersion`, internih oznaka pravila (H11, M19,
D33, P1-S1, „pouka N"…) — zameni ih sa „[pravilo]"; bez imena fajlova i SHA.

## Anonimizacija

- Za svaki par (distanca, profil) nasumično (ali ponovljivo, seme upiši u ključ) dodeli oznake A i B verzijama.
- Fajlovi: `docs/generators-v2/perfection/P7/plans/<D>/p<NN>-A.txt` i `-B.txt`.
- Ključ (koja oznaka je koja verzija, po paru) NE ide u repo dok ocene ne budu gotove: pošalji ga organizatoru u poruci
  (`send_message`) i sačuvaj van repoa. U repou ne sme da ostane ništa iz čega se verzija vidi (ni skripta sa semenom:
  skriptu commit-uj bez semena, seme u poruci).
- Provera: `grep -rE "v2\.[0-9]+\.[0-9]+|policy|6bbeabd" docs/generators-v2/perfection/P7/plans` → 0 pogodaka.

## Kraj

Commit samo `docs/generators-v2/perfection/P7/**` + push, pa `send_message` organizatoru (`session_01GnHHiXE3NeQzLDcD3vaM5E`):
SHA, broj fajlova po distanci, odbijanja po verziji (bez otkrivanja oznaka u repou), ključ i seme. Ako alat traži
dozvolu koju niko ne može da da: upiši ključ u `/tmp/p7-key.json` u svom kontejneru i u poslednjoj poruci sesije ga
ispiši — organizator čita tvoju sesiju.

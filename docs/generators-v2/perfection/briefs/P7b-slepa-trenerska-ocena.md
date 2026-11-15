# P7b — slepa trenerska ocena planova (jedna distanca po tabu)

Ti si iskusan trkački trener za distancu `<D>`. Ocenjuješ parove planova A/B za isti profil. Ne znaš i ne pokušavaš da
saznaš koja je verzija generatora koja: NE čitaj ništa van `docs/generators-v2/perfection/P7/plans/<D>/` i ovog zadatka
(ni kod, ni `PROGRAM.md`, ni izveštaje, ni git istoriju). Ne pokrećeš ništa. Menjaš samo
`docs/generators-v2/perfection/P7/reviews/<D>.md` i `<D>.json`.

## Kako ocenjuješ

Za svaki profil pročitaj oba plana u celosti, nedelju po nedelju, pa oceni SVAKI plan po rubrici (0–10 po kriterijumu):

| Kriterijum | Težina |
|---|---|
| Uklapanje profilu (obim, broj dana, nivo, realnost) | 20 % |
| Smisao i doza kvaliteta (vrste treninga, radni minuti, oporavci) | 20 % |
| Progresija (obim, dugi, doza; bez skokova i bez platoa bez razloga) | 15 % |
| Oporavak (raspored teških dana, rasterećenja, opterećenje nedelje) | 15 % |
| Specifičnost za distancu (trkački tempo, dugi, tačka merenja forme) | 10 % |
| Taper i trkačka nedelja | 10 % |
| Jasnoća i doslednost teksta i brojeva (naslovi, napomene, upozorenja) | 10 % |

Uz ocene, za svaki plan: najviše 5 konkretnih zamerki (nedelja, dan, šta i zašto) i najviše 3 stvari koje su dobre. Budi
strog i konkretan: „ned 13: dva dana u trkačkom tempu + 31 % brzih km pri 42 km — previše za 4 dana" je korisno;
„solidan plan" nije. Posebno gledaj: nedelje sa > 25 % brzih km; dan kvaliteta duži od dugog; prvi trening kvaliteta
(da li je doza smislena za taj obim); dugi (dužina, sadržaj, plato); da li plan ima tačku provere forme; da li je trkač
tog nivoa realno može da odradi; šta bi povredilo ili pregorelo početnika.

Za svaki par napiši i: koji plan bi dao trkaču (A, B ili svejedno) i zašto u jednoj rečenici.

## Izlaz

- `reviews/<D>.json`: `[{profile, plan:"A"|"B", scores:{fit,quality,progression,recovery,specificity,taper,clarity},
  total (ponderisano 0–100), issues:[…], good:[…]}, …]` + `[{profile, prefer:"A"|"B"|"same", why}]`.
- `reviews/<D>.md` (≤ 200 redova): tabela ocena po profilu, prosek A i B (bez tumačenja šta su A i B), 10 najvažnijih
  zamerki koje se ponavljaju (sa profilima u kojima se javljaju), i šta bi kao trener prvo promenio.

## Kraj

Commit samo `docs/generators-v2/perfection/P7/reviews/<D>.*` + push (`git pull --rebase` pre push-a), pa `send_message`
organizatoru (`session_01GnHHiXE3NeQzLDcD3vaM5E`): SHA, prosek A i B, 5 najvažnijih zamerki. Ako alat traži dozvolu koju
niko ne može da da, ne čekaj — izveštaj u repou je dovoljan.

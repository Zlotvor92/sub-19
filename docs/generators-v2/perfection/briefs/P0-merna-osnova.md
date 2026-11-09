# P0 — merna osnova trenerskih metrika (sve 4 distance)

Pročitaj prvo: `AGENTS.md`, `docs/generators-v2/perfection/PROGRAM.md`, `docs/generators-v2/audit/coach-final/BRIEF.md`
(kako se generišu planovi: `docs/generators-v2/final-check/lib.ts`, profili u `audit/coach-5k-10k/coach.ts` i
`audit/coach-hm-mar/coach2.ts`), i `v2/policy.ts` svake distance.

## Zadatak

Izmeri kako v2 generatori SADA stoje po trenerskim metrikama. Ništa u `web/src/**` se ne menja. Testovi se ne pokreću
(nema izmene koda). Skripte idu u `docs/generators-v2/perfection/P0/`, pokreću se iz `web/`.

## Ulazi

Po distanci mreža: svi podržani brojevi dana × 3 obima (dno, sredina, vrh reda tabele dana) × VDOT 35/45/55/65 × najkraća,
srednja i najduža priprema; uz to po osećaju i početnik (gde postoje) na užem skupu. Plus dva imenovana profila:
(a) 10 km 46:00, 40 km, 4 dana (uto/čet/sub/ned), 16 nedelja, skorašnji najduži 14 km, cilj HM 1:40 (ista forma za
5K/10K/maraton sa ciljem iz prognoze −2 %); (b) profil korisnika iz BRIEF.md (5K 20:25, 30 km, 4 dana).

## Metrike (po planu; izveštaj: medijana, min, max po distanci × dani × pojas obima; imenovani profili pojedinačno)

- M1 Radni minuti kvalitetnog treninga po zoni (T, I, R, RP/MP): prva nedelja sa tom zonom i najveći u planu.
- M2 Udeo rada u trajanju kvalitetnog dana = rad / (WU + rad + oporavci + CD), prva nedelja i vrh.
- M3 Trkački tempo: najveći trening u RP/MP [km] i kao % dužine trke; ukupno km u RP/MP u planu; broj nedelja sa RP/MP.
- M4 Dugi: najduži [km, min] i kao % trke; broj dugih koji imaju bilo koji deo brži od E; najduži niz uzastopnih
  ne-rasteretnih nedelja sa istim dugim (± 0,1 km).
- M5 Ubrzanja: broj laganih dana sa ubrzanjima po planu (bez dana pred trku).
- M6 Tačke merenja forme: broj testova / kontrolnih trka po planu, po osnovi tempa (rezultat / osećaj) i početnik;
  broj nedelja od poslednje tačke (ili starta) do trke; da li se ijedan tempo menja u generatoru bez novog rezultata.
- M7 Raspodela intenziteta: % km bržih od E po fazi.
- M8 Obim: vrh / start; udeo dugog u nedelji vrha.
- M9 Adaptacija (čitanjem koda, ne merenjem): spisak signala koje `assess.ts` čita, po distanci; da li ostvaren tempo,
  trajanje ili RPE KVALITETNOG treninga ima ikakav efekat; da li app sloj (`v2/app/`) nudi nešto od toga van jezgra.

## Šta drži dozu (najvažniji deo)

Za nedelju vrha svake zone u svakom planu utvrdi koje pravilo je sprečilo veću dozu: plafon udela zone, „dan kvaliteta
≤ dugi" (pouka 32), kraj lestvice, „≤ 1 nivo nedeljno", kapacitet nedelje, početni nivo 60 % plafona, drugo. Izveštaj:
% planova po uzroku, po distanci × dani. Navedi ID pravila i fajl/funkciju vlasnika. Ako ovo traži instrumentaciju
jezgra, napravi je kao kopiju izbora u skripti (jezgro ostaje netaknuto) i dokaži da kopija bira isto što i jezgro.

## Izveštaj

`docs/generators-v2/perfection/reports/P0-REPORT.md` (≤ 200 redova): tabela po metrici i distanci; tabela „šta drži
dozu"; za svaku metriku vlasnik pravila (ID, fajl); pun ispis po nedelji za profil (a) sve 4 distance u
`P0/profile-a-<D>.txt`; sirovi brojevi u `P0/*.json`. Na kraju odeljak „Mišljenje" (odvojeno): gde je po tvojoj oceni
najveći trenerski manjak po distanci, najviše 5 tačaka po distanci. Ne predlaži kod.

## Stani i javi

Ako generator za deo mreže odbija ulaz ili baca grešku: zabeleži ulaz i razlog, nastavi sa ostatkom. Ako neka metrika
ne može da se izračuna iz plana bez nagađanja: napiši šta nedostaje, ne procenjuj.

## Kraj

Commit (samo `docs/generators-v2/perfection/**`) + push na radnu granu. Zatim poruka organizatoru alatom
`send_message` na sesiju iz instrukcije: SHA, putanja izveštaja, 5 najvažnijih brojeva, šta nije urađeno.

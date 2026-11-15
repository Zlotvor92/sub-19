# P8-10K — završetak (odluke posle STOP-a i dovođenje testova u zeleno)

Stanje: prethodni tab je gurnuo 10k-v2.13.0 (`1cdbb18`) sa ugrađenim G1–G8 i 10K (c), ali brzi nivo `tenK/v2` NIJE
zelen (23 fajla / 63 testa) i CI na vrhu grane pada. Ovo je prioritet: grana ne sme da ostane crvena.

Pročitaj: `AGENTS.md`; `PROGRAM.md` (pravila za tab, „Testovi", kraj dnevnika); `reports/P8-10K-REPORT.md` i
`reports/P8-10K-STOP.md` (S1–S8); `briefs/P8-ispravke-po-slepoj-oceni.md` i `briefs/P8-dopuna-po-glavnom-treneru.md`;
`coach/ROUND-01.md` (10K).

## Odluke organizatora (S1–S8)

- **S1/S6, S5 — donja granica ispred G5.** G5 „≤ 60 %" važi do najnižeg nivoa lestvice zone: rasterećenje i taper nikad
  ne idu ispod najniže doze (postojeće 2,0 km / početnik 1,5 km; RP: prvi nivo), i kad je to > 60 %. Jedna funkcija:
  doza = max(najniži nivo; najviši nivo ≤ 60 %). Taper uvek ima trkački tempo (G2), sem uz ograničenja bola/povratka.
  Dugi rasterećenja 0,8 × poslednji, ali ne ispod najdužeg laganog dana te nedelje (postojeće „dugi ≥ lagan").
- **S7 — start iznad satnog plafona:** plan sa ravnim obimom je ispravan (vrh = start). Jedna rečenica u planu zašto
  obim ne raste i šta trkač dobija umesto toga (kvalitet i dugi). Bez daljih izmena.
- **S2 — dugi početnika:** B1 kako je izmereno (9,7 km + rečenica) — prihvaćeno.
- **S3 — početnik, T 1,5 km kroz 9 nedelja:** plafon T početnika = max(udeo × cilj nedelje; 3,0 km), uz G4 (≤ 30 min);
  lestvica početnika napreduje 1,5 → 2,0 → 2,5 → 3,0 km po postojećem pravilu „≤ 1 nivo nedeljno".
- **S8 — odbijanje `d5-r-14w/w6wed/over120` (DELOAD_CONTENT):** konstruktor i validator moraju da čitaju istu funkciju
  doze rasterećenja iz prve tačke; posle toga 0 odbijanja na mrežama adaptacije — izmeri.
- S4 i ostalo iz STOP-a što ovde nije navedeno: ostaje kako je ugrađeno; navedi u izveštaju.

## Posao

1. Ugradi odluke; `policy.ts` redovi; verzija ostaje 10k-v2.13.0 ako nije bila ni u jednom zelenom stanju na grani —
   inače 10k-v2.13.1 (`KNOWN_VERSIONS` zadržava sve ranije).
2. Testovi u zeleno: stara očekivanja → nova (samo gde je promena posledica odlučenih pravila; svaku takvu izmenu
   navedi po klasi u izveštaju); nezavisne invarijante mreža za G7/G8/G1b; referentni heševi → nova fikstura promenjenih
   planova po postojećem obrascu (`segmentP5.changed-*` kao uzor), sa dokazom po klasi.
3. Sabotaže G1–G8 (`web/scripts/sabotage.mjs`, `--bail=1`).
4. Jednom na kraju: `npm run check`, `npx vitest run --changed <polazni SHA pre P8-10K>`, pun nivo `tenK/v2` (≈ 20–25
   min; posle popravki ponovi samo pale fajlove), E2E 10K, `npm run build`. `byteSame` fiksture u drugim distancama
   koje sadrže 10K ključeve: ponovo snimi, samo 10K ključevi.
5. Ponovo generiši 12 profila u `P8-10K/plans/` (isti format).
6. Dopuni `reports/P8-10K-REPORT.md` (odeljak „Završetak": odluke, brojevi, trajanja testova). Lokalni commit posle
   svakog koraka; push čim je brzi nivo zelen (ne čekaj pun nivo da bi grana prestala da bude crvena), pa drugi push
   posle punog nivoa ako je bilo popravki.

## Kraj

`send_message` organizatoru (`session_01GnHHiXE3NeQzLDcD3vaM5E`): SHA, stanje testova (brojevi), šta je promenjeno u
očekivanjima po klasi, otvorena pitanja. Ako alat traži dozvolu koju niko ne može da da, ne čekaj.

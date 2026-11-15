# P8-5K — završetak (odluke posle STOP-a i dovođenje testova u zeleno)

Stanje: prethodni tab je gurnuo 5k-v2.15.0 (`d62ae99`) sa ugrađenim 5K (a)–(e), G1–G7 i G3, ali 42 testa u 17 fajlova
`fiveK/v2` još očekuju pravila pre dopune — CI na vrhu grane pada. Prioritet: grana ne sme da ostane crvena.

Pročitaj: `AGENTS.md`; `PROGRAM.md` (pravila za tab, „Testovi", kraj dnevnika); `reports/P8-5K-REPORT.md` i
`reports/P8-5K-STOP.md`; `briefs/P8-ispravke-po-slepoj-oceni.md` i `briefs/P8-dopuna-po-glavnom-treneru.md`;
`coach/ROUND-01.md` (5K).

## Odluke organizatora

1. **G6 (STOP):** izmeri varijantu B (lagan ≤ 0,75 × dugi za 4+ dana, cilj se spušta u konstruktoru). Ako u B vrh
   obima padne ≤ 10 % u svakoj grupi — ugradi B. Inače ostaje A (kako je ugrađeno: 0,70, cilj ostaje, planirano < cilj),
   ali upozorenje o tome sme da se pojavi najviše jednom po planu (G3). Brojeve obe varijante u izveštaj.
2. **Drugi I posle smanjenog prvog:** I doza sme da poraste najviše jedan korak lestvice po nedelji i posle prvog
   (smanjenog) I treninga (p07: 3 × 1000 → 6 × 800 m u jednoj nedelji nije dozvoljeno).
3. **Tumačenja** (razvoj 5K = baza + vrhunac; „tabela početnika" = kapacitet plana početnika; WU/CD trke najmanje
   1,0 / 0,5 km): prihvaćena.

## Posao

1. Ugradi odluke; `policy.ts` redovi; verzija 5k-v2.15.1 (`KNOWN_VERSIONS` zadržava sve ranije, uključujući 2.15.0).
2. Testovi u zeleno: 42 testa — stara očekivanja → nova samo gde je promena posledica odlučenih pravila (navedi po
   klasi); nezavisne invarijante mreža za G7, G1a/b, G6; otisci regresije po postojećem obrascu sa razlogom P8.
3. Sabotaže 12/12 (+ nove za tačke 1 i 2), kroz `web/scripts/sabotage.mjs`, `--bail=1`.
4. Jednom na kraju: `npm run check`, `npx vitest run --changed 9055e5b`, pun nivo `fiveK/v2` (≈ 4 min), E2E 5K,
   `npm run build`; `byteSame` fiksture drugih distanci sa 5K ključevima ponovo snimi (samo 5K ključevi).
5. Merenja P0 i 12 profila P7 ponovi POSLE dopune (izveštaj sada ima brojeve pre dopune); ispiši 12 profila u
   `docs/generators-v2/perfection/P8-5K/plans/` skriptama iz `P7/` (format kao `P7/plans`, bez A/B).
6. Dopuni `reports/P8-5K-REPORT.md` (odeljak „Završetak"). Lokalni commit posle svakog koraka; push čim je brzi nivo
   zelen, drugi push posle punog nivoa ako je bilo popravki.

## Kraj

`send_message` organizatoru (`session_01GnHHiXE3NeQzLDcD3vaM5E`): SHA, stanje testova, izmene očekivanja po klasi,
brojevi G6 A/B, otvorena pitanja. Ako alat traži dozvolu koju niko ne može da da, ne čekaj.

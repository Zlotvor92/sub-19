# Program „trenerski kvalitet v2" — organizator

Nalog korisnika (9. 11. 2026): organizator vodi posao kroz zasebne sesije (tabove), jednu po jednu. Tab završi segment,
pošalje izveštaj, organizator proveri i daje sledeću instrukciju. Cilj: v2 generatori (5K, 10K, HM, maraton) koji su
dobri kao trener, ne samo kao bezbedan konstruktor plana.

## Polazna ocena organizatora (HM v2, hm-v2.4.1, jedan plan + politika)

Profil: 10 km 46:00 (VDOT 44,1), 40 km, 4 dana, 16 nedelja, cilj 1:40. Dobro: rast obima, rasterećenja, kotrljajuća
granica dugog, pošten odnos prema cilju, odbijanje umesto degenerisanog plana, taper. Slabo:

1. Mala doza kvaliteta: nedelja 1 T 2,0 km (≈ 9,5 min rada uz 35 min WU/CD); vrh T 2 × 2400 m, vrh I 4 × 1000 m.
2. Malo rada u trkačkom tempu: najveći trening 8 km (≈ 38 % trke); uzrok plafon 15 % nedelje po treningu (H11).
3. Dugi je uvek samo lagan; 5 nedelja platoa na 22,4 km.
4. Tempo zamrznut: plan sa rezultatom nema test ni kontrolnu trku; menja ga samo nov rezultat koji korisnik unese.
5. Adaptacija ne čita kako su odrađeni kvalitetni treninzi (samo % izvršenja, pauzu, bol, RPE laganih).
6. Nema ubrzanja na laganim danima; WU/CD nije srazmeran treningu.

Ostale tri distance organizator još nije merio — zato je prvi segment merna osnova (P0).

## Pravila za svaki tab

- `AGENTS.md` važi u celosti: radna grana `claude/generator-isolation-5k-10k-hm-marathon`, nova se ne pravi; vremena po
  beogradskom vremenu; stalni uslovi 1–8; nivoi testova i sabotaže kako tamo piše.
- Bez PR-a, mergea u `main`, deploya i promene prekidača. v1 se ne dira.
- Trenerske brojeve odlučuje organizator. Kad zadato pravilo ne može da se ispuni zajedno sa postojećim (sudar pravila,
  odbijanja, pad invarijanti) — STANI, izmeri, napiši `reports/<segment>-STOP.md` sa opcijama i brojevima. Ne biraj sam.
- Svaka trenerska izmena: merenje pre/posle na mrežama distance, red u `policy.ts` (pravilo, mesto, obrazloženje sa
  oznakom izvor ili heuristika), nova `policyVersion`, spisak promenjenih planova, sabotaža novog pravila.
- Izveštaj: `docs/generators-v2/perfection/reports/<segment>-REPORT.md`, najviše 200 redova, svaka brojka sa komandom
  koja je ponavlja. Odvoj izmereno od mišljenja.
- Na kraju: commit + push na radnu granu, pa poruka organizatoru (ID sesije je u instrukciji) sa SHA i putanjom izveštaja.

## Izbor modela po segmentu (nalog korisnika, 9. 11. 2026)

Najjači dozvoljen model taba je Opus 5.5. Organizator za svaki segment bira najslabiji model koji ga pouzdano rešava
uz precizan zadatak:

- Opus 5.5: izmena pravila generatora, sudari pravila, adaptacija, dizajn merenja.
- Sonnet 5.5: jasno omeđene izmene (tekst za korisnika, usklađivanje već odlučenog pravila, dopuna testa, ponavljanje
  merenja postojećom skriptom).
- Haiku 5.5: mehanički poslovi (pokretanje gotove skripte i prepis brojeva, formatiranje, provera spiska).

Slabiji model dobija uži zadatak: tačni fajlovi i funkcije, očekivani izlaz, komanda provere, šta ne dira.

## Testovi — štednja vremena (nalog korisnika, 9. 11. 2026)

Nivoi su u `AGENTS.md`; ovde je samo šta tab sme i kada.

- Segment bez izmene `web/src/**` (merenje, izveštaj, dokumentacija): nijedan test.
- U toku rada: samo namenski test fajla koji se menja (`npx vitest run <fajl>`), brz nivo.
- Jednom na kraju segmenta: `npm run check` + `npx vitest run --changed <polazni SHA>` + pun nivo SAMO foldera dirane
  distance (`TEST_FULL=1 npx vitest run --project node <folder>/v2`). Ne ponavljati posle izmena koje ne diraju taj kod.
- Zabranjeno tabu: `npm run check:full`, pun nivo drugih distanci, projekat `v1` (v1 se ne dira), ceo skup sabotaža.
  Sabotaža: samo novo pravilo, kroz `web/scripts/sabotage.mjs` sa `--bail=1`.
- Više trenerskih izmena iste distance ide u jedan segment, da pun nivo te distance trči jednom, ne po izmeni.
- Push koda pokreće CI (pun nivo): jedan push po segmentu, na kraju. Međukoraci se ne pushuju; push samo `docs/**` CI ne
  pokreće.
- Test koji traje > 15 min ili visi: prekini, zabeleži komandu i trajanje u izveštaj, ne pokreći ponovo bez odluke
  organizatora.
- Izveštaj navodi svaku pokrenutu komandu testa i njeno trajanje.

## Redosled (privremen; zaključava se posle P0)

| Segment | Sadržaj | Stanje |
|---|---|---|
| P0 | Merna osnova trenerskih metrika, sve 4 distance, bez izmene generatora | gotovo (`53b2dd4`, `reports/P0-REPORT.md`) |
| T1 | Brži CI i testovi: izbor po dometu izmene, E2E, v1 (uporedo sa P0) | u toku |
| P1 | HM: specifičan dugi (RP blok), plafon i lestvica RP — `briefs/P1-hm-specificnost.md` | u toku |
| P2 | Maraton: ista klasa (MP u dugom, doza) | čeka |
| P3 | 10K | čeka |
| P4 | 5K | čeka |
| P5 | Petlja forme: kontrolna tačka u planu sa rezultatom; izvršenje kvaliteta u adaptaciji | čeka |
| P6 | Ubrzanja na laganim danima; WU/CD srazmerno treningu | čeka |
| P7 | Nezavisna slepa trenerska ocena pre/posle + merenje ishoda u aplikaciji (prognoza prema rezultatu) | čeka |

## Kada je gotovo

Pragovi metrika se upisuju ovde posle P0. Uslov: svi pragovi ispunjeni na mrežama, 0 prekršaja invarijanti, 0 novih
odbijanja realnih ulaza, slepa trenerska ocena pre/posle. Ograničenje koje tabovi ne mogu da uklone: da li pravila
stvarno daju bolje rezultate vidi se tek na stvarnim korisnicima kroz mesece (P7 pravi merenje, ne dokaz).

## Dnevnik odluka

- 9. 11. 2026: program otvoren; P0 izdat (Opus 5.5, sesija session_01GnHHiWjtxT9rm68GZMbjHY).
- 9. 11. 2026: korisnik — za manje poslove slabiji modeli uz precizno navođenje; testovi štedljivo (odeljak „Testovi").
- 9. 11. 2026: korisnik — ubrzati testove i CI; izdat T1 (CI run 764: 12,7 min zida, ≈ 85 runner-minuta, sve na svaki push).
- 9. 11. 2026: P0 primljen i proveren (profil (a) HM = nezavisno generisan plan organizatora; kopija izbora = jezgro u
  > 99,7 % za 10K/HM/MAR). Nalazi za sve 4: dugi nikad nema deo brži od E (0/697); RP/MP trening 28–50 % trke; plan sa
  rezultatom nema tačku merenja forme; 10K/HM/MAR bez ubrzanja; RPE/tempo kvaliteta bez efekta u adaptaciji.
- 9. 11. 2026: odluka P1 (HM): smena nedelja A/B u specifičnoj fazi (RP trening / dugi sa RP blokom 4–6–8 km), plafon RP
  15 → 20 %, lestvica RP do 3 × 5000 m. T/I početna doza, ubrzanja i WU/CD idu u P6 (sve distance), petlja forme u P5.

# K3 — krug 3: izmene po sudu glavnog trenera (krug 2)

Izvor: `coach/ROUND-02.md` (§ 3 sud, § 4 izmene, § 5 šta ne dirati). Pročitaj § 3–5 pre rada; ostatak ne treba.
Jedan tab = jedna distanca (navedena u poruci). Radi SAMO u folderu svoje distance `web/src/domain/generators/<D>/v2/`
(+ test/E2E koji direktno zavisi). Grana `claude/generator-isolation-5k-10k-hm-marathon`, `git pull --rebase` pre rada i
pre svakog push-a (drugi tab radi drugu distancu uporedo). Bez nove grane, bez PR-a, ništa u main.

## Način rada (obavezno)

1. Pravila ugrađuj REDOM kojim su navedena za tvoju distancu. Svako pravilo = zaseban commit sa zelenim brzim nivoom
   svoje distance (`npx vitest run --project node src/domain/generators/<D>/v2`). Nikad push sa crvenim testovima.
2. Jedno mesto odluke po pravilu (konstruktor), validator čita isto i samo prijavljuje (AGENTS.md, uslovi 1–8).
3. Za svako pravilo: merenje pre/posle na mreži te distance (broj planova koje pravilo menja, odbijanja, vrh obima) i
   pre/posle na 12 profila (`docs/generators-v2/perfection/P9/render.ts`, izlaz u `P9/plans/<D>/`, v. `reports/P9a-REPORT.md`).
4. SUDAR ili NOVA ODBIJANJA (> 0 novih) ili vrh obima niži > 10 % u > 10 % planova neke grupe: NE izmišljaj novo
   pravilo. Vrati prethodno ponašanje za spornu klasu (ili celo pravilo ako ne može usko), zapiši brojeve i opcije u
   `reports/K3-<D>-REPORT.md` § Otvoreno, idi na sledeće pravilo. Ne zastajkuj.
5. Verzija: jedan skok manje verzije za ceo K3 (npr. 5k-v2.16.0), `KNOWN_VERSIONS` + prethodna, red u DECISIONS po
   pravilu (oznaka K3-<slovo>).
6. Testovi: usklađuj samo očekivanja koja pravilo zaista menja; za svako pravilo nezavisna invarijanta na mreži + jedna
   sabotaža kroz `web/scripts/sabotage.mjs` (`--bail=1`). Na kraju JEDNOM: pun nivo svoje distance
   (`TEST_FULL=1 npx vitest run --project node src/domain/generators/<D>/v2`), `npx vitest run --changed <polazni SHA>`,
   E2E svoje distance, `npm run check`. Ne pokreći `check:full`. Mreže jednu po jednu (OOM).
7. Na kraju: ponovo ispiši `P9/plans/<D>/` (12 fajlova), `reports/K3-<D>-REPORT.md` (≤ 80 redova: po pravilu — mesto u
   kodu, pre/posle, testovi; § Otvoreno), commit + push, poruka organizatoru (`send_message`, session_id `@parent`):
   SHA, verzija, po pravilu ugrađeno/vraćeno + brojevi, testovi. Ako alat traži dozvolu ili ga nema, ne čekaj.
8. Štedi: čitaj samo fajlove koje pravilo dira (policy, mesto odluke, validator, testovi koji padnu).

NE DIRATI (trener, § 5): satni plafon vrha za redovne; minute RP/MP usred nedelje za VDOT < 50; trkačka nedelja
9–12 min; test kao jedini kvalitet nedelje; uvod početnika bez kvaliteta; tekst zaglavlja.

## 5K

- **K3-A (I doza po obimu).** Vrh I rada u planu (VDOT ≥ 40) po vrhu nedeljnog obima: 30–45 km → 12–16 min;
  45–65 km → 16–20 min; ≥ 65 km → 18–24 min. VDOT < 40: ≤ 18 min. Ispod 30 km (i < 25 km) sadašnje vrednosti. Budžet I
  i korak lestvice podesi tako da vrh padne u opseg (donja granica je cilj, gornja plafon); G4 plafon 24 min ostaje.
  I blok ≥ 3 ne-rasteretne nedelje sa I u planu ≥ 10 nedelja. Merenje: medijana vrha I po grupi obima (sada 10,1 min
  ukupno), p01/p02/p05/p07 (cilj 16 / 13–14 / 20 / 18 min).
- **K3-B (4 dana).** Redovan plan sa TAČNO 4 dana: lagan ≤ 0,75 × dugi (5+ dana ostaje 0,70; početnik 0,80). Nedelja 1
  ≥ 95 % trenutnog obima (ako pravilo laganog to ne da, nedelja 1 sme do 0,80). Cilj obima se NE spušta.
- **K3-C (3 dana).** Redovan plan sa 3 dana: lagan ≤ 0,70 × dugi (višak se prijavljuje jednom po planu); u specifičnoj
  fazi dugi dobija 6 × 20 s ubrzanja; ista doza iste zone najviše 2 ne-rasteretne nedelje zaredom (posle toga korak
  gore ako staje, inače promena strukture iste doze).
- **K3-D (vrh pre tapera).** Najteža nedelja po minutima rada je 2 nedelje pred trku; poslednja ne-rasteretna nedelja
  pred taper nosi ≤ 85 % minuta rada najteže nedelje.
- **K3-E (test).** Rad kontrolnog testa ≤ 2 × najveća dotadašnja doza rada u planu; inače test 2 km „jako ravnomerno".
- **K3-F (dan manje).** Ako bi lagan dan bio < 30 min u više od 2 nedelje izgradnje: plan se pravi sa jednim danom
  manje (izbacuje se lagan dan koji nije dugi ni kvalitet; najmanje 3 dana), uz rečenicu u napomeni plana. Ako je ovo
  preveliki zahvat za jedno mesto odluke — samo izmeri koliko planova pogađa i ostavi u § Otvoreno.

## 10K

- **K3-A (doza).** I po obimu kao 5K K3-A. RP pri vrhu ≥ 50 km/ned (VDOT ≥ 40): vrh RP rada 22–30 min (sada p07 14–18,
  p05 21–23); G4 plafon RP 30 min ostaje. I blok ≥ 3 nedelje u planu ≥ 10 nedelja.
- **K3-B (4 dana)** — kao 5K K3-B.
- **K3-C (3 dana)** — kao 5K K3-C, ali drugi podražaj u dugom u specifičnoj fazi: završnih 10–15 min u T.
- **K3-D (vrh pre tapera)** — kao 5K K3-D.
- **K3-E (test)** — kao 5K K3-E.
- **K3-F (dan manje)** — kao 5K K3-F. Sitno: napomena plana od 8 ned bez testa — bez „posle prilagođavanja" za nov plan.

## HM

- **K3-A (dugi početnika na pravom mestu).** Najduži dugi početnika pada u poslednje 3 ne-rasteretne nedelje pred
  taper; dugi u specifičnoj fazi nikad niži od najdužeg iz razvoja (osim rasterećenja). Dugi > 45 % nedelje najviše u
  3 nedelje. (p11: 13,2 pa pad na 11,4 — ne sme.)
- **K3-B (taper ≤ 60 %).** Taper RP ≤ 60 % poslednje doze i kad je najniži nivo lestvice veći: kraća struktura van
  lestvice (2 × 1500 m ili 3 × 1000 m; p03/p10 25–26 → ≤ 18 min). Zamenjuje odluku S1-O1.
- **K3-C (3 dana).** Redovan plan 3 dana: lagan ≤ 0,70 × dugi; u specifičnoj fazi dugi nosi RP blok najnižeg nivoa i
  tada je kvalitet usred nedelje lakši (T umesto RP); ista doza iste zone najviše 2 ne-rasteretne nedelje.
- **K3-D (vrh pre tapera).** Najteža nedelja po minutima rada 3 nedelje pred trku; poslednja ne-rasteretna pred taper
  ≤ 85 % te doze.
- **K3-E (brzi).** VDOT ≥ 50 pri vrhu ≥ 80 km/ned: RP blok u dugom 4 → 6 → 8 km (dok minuti dozvoljavaju).
- **K3-F (talas dugog).** Kad dugi stoji na plafonu više od 3 ne-rasteretne nedelje: smenjuj plafon / 0,85 × plafon;
  plafon najviše 4 puta u planu (3 dana: 3 puta); nedelje na plafonu nose blok, nedelje na 0,85 su lagane.
- **K3-G (dan manje / test)** — kao 5K K3-F i K3-E (samo ako je mali zahvat; inače izmeri i ostavi otvoreno).

## MAR

- **K3-A (najduži dugi).** U najviše 3 ne-rasteretne nedelje vrha udeo dugog do 45 % (4 dana) / 50 % (3 dana); cilj
  najdužeg: redovan ≥ 26 km ili 2 h 45, početnik ≥ 24 km ili 3 h 00 (postojeći plafon 180 min / 32 km ostaje). Ako ni
  tako ne staje: rečenica u zaglavlju („za maraton treba X km/ned ili N dana; preporuka polumaraton ili duža priprema").
  Merenje: najduži dugi p01/p02/p03/p06/p10/p11 (sada 22,4 / 22,4 / 21 / 17,6 / 21 / 17,9).
- **K3-B (početnik vrh).** Početnik: vrh ≤ start × 1,30 i ≤ 7,5 h (p12 → ≈ 65 km). Zamenjuje S1-O1. Ako se vrate 42
  odbijanja sa dna tabele (S1): taper N−1 početnika sme do izvodljivog cilja naviše; ako ni to — zadrži 1,5 samo za
  klasu koja se odbija i navedi brojeve.
- **K3-C (3 dana)** — kao HM K3-C, sa MP blokom najnižeg nivoa.
- **K3-D (vrh pre tapera)** — kao HM K3-D.
- **K3-E (brzi i dan pred dugi).** VDOT ≥ 50 pri vrhu ≥ 80 km/ned: MP u dugom do 16–18 km (≤ 75 min). Dan pred dugi
  ≤ 50 % dugog (p09: 19,1 → ≤ 14 km). Početnik: jedan MP trening se seli u dugi (20–30 min), ukupno se ne dodaje.
- **K3-F (talas dugog)** — kao HM K3-F (p08: 29,3 km × 14 → 3–4 puta, između 24–25 km).
- **K3-G (dan manje / test)** — kao 5K K3-F i K3-E (samo ako je mali zahvat).

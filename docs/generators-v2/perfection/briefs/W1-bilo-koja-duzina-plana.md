# W1 — plan za bilo koji broj nedelja, uz upozorenje (nalog vlasnika, 11. 11. 2026)

Nalog vlasnika: „Dozvoli svima da generišu plan za koliko god hoće nedelja uz upozorenje."
Danas generator ODBIJA unos van opsega: 5K 6–16; 10K 8–18 (početnik ≥ 10); HM 10–20 (početnik ≥ 12); maraton 12–24
(početnik ≥ 16) — `input.ts` (`weeksMin`/`weeksMax`/`planWeeks`, `beginner.weeksMin`). Posle W1 ta odbijanja ne
postoje: plan se pravi i nosi jasno upozorenje. Ostala odbijanja (obim, dani, datumi, skorašnji dugi…) se NE diraju.

Jedan tab = jedna distanca (u poruci). Radi SAMO u `web/src/domain/generators/<D>/v2/` (+ test/E2E koji direktno
zavisi). Način rada: `briefs/K3-krug-3.md` § „Način rada" (pročitaj; važi sve — zeleni brzi nivo pre svakog push-a,
jedno mesto odluke, validator čita isto, sabotaža po pravilu, na kraju jednom pun nivo + testovi nad promenjenim +
E2E + `npm run check`, izveštaj `reports/W1-<D>-REPORT.md` ≤ 60 redova, poruka organizatoru). Verzija: sledeća manja.

## Pravila

Oznake: N = broj nedelja plana; MIN/MAX = sadašnje granice distance (za početnika MIN = `beginner.weeksMin`).

**W1-A — kratak plan (1 ≤ N < MIN).** Plan se pravi. Faze: uzmi raspored faza najkraćeg dozvoljenog plana (MIN
nedelja, isti tip trkača) i zadrži njegovih POSLEDNJIH N nedelja (trkačka nedelja uvek; zatim taper; zatim
specifična/vrhunac; zatim razvoj; baza i uvod otpadaju prvi). N = 1 je samo trkačka nedelja, N = 2 taper + trkačka.
Doze i obim se grade UNAPRED od prve zadržane nedelje po postojećim pravilima: polazni obim = trenutni obim trkača,
rast po pravilu koraka, polazni nivo doze kao na početku plana (pravilo F4), dugi po pravilu udela — nema skoka na
dozu koju bi odsečene nedelje „donele". Bez kontrolnog testa ako po G7 ne staje. Rasterećenja po položaju u
zadržanom rasporedu. Ako neka postojeća provera obara ovakav plan (npr. „taper ≤ 60 % poslednje doze" bez prethodne
doze, „najduži dugi u poslednje 3 nedelje"), pravilo se za kratak plan primenjuje na ono što postoji; validator ne
sme da odbije plan samo zato što je kratak.

**W1-B — dug plan (N > MAX, najviše 52).** Plan se pravi kao: (N − MAX) nedelja „osnovne pripreme" + standardni plan
od MAX nedelja. Osnovna priprema: faza baze, bez dana kvaliteta — lagani dani, ubrzanja na jednom laganom danu (F3),
dugi po pravilu; cilj obima = trenutni obim (bez rasta), svaka četvrta nedelja rasterećenje po postojećem faktoru.
Standardni deo kreće od istog trenutnog obima. Tehnička granica: N > 52 se i dalje odbija („najviše 52 nedelje").

**W1-C — upozorenje.** Jedno upozorenje plana (isti kanal kojim korisnik već vidi upozorenja — `userWarnings`/napomena
plana, kako tvoja distanca radi) + ista rečenica u napomeni plana. Tekst za korisnika, bez internih oznaka:
- kratak: „Skraćena priprema: plan ima N nedelja, a za pun ciklus za <distanca> preporučuje se najmanje MIN. Plan je
  napravljen za izabrani datum, ali nema vremena za sve faze pripreme i ne garantuje spremnost ni ciljno vreme. Ne
  nadoknađuj kraći rok naglim povećanjem obima ili intenziteta."
- dug: „Plan je duži od preporučenih MAX nedelja: prvih K nedelja je osnovna priprema na sadašnjem obimu, a puna
  priprema za <distanca> počinje u nedelji K+1."
Brojeve i padeže uskladi postojećim pomoćnim funkcijama distance. Postojeće upozorenje za početnika ostaje uz ovo.

**W1-D — adaptacija i prenos.** Plan nastao po W1-A/B mora da prođe adaptaciju (unos treninga, umor, pauza, bol,
rezultat testa) i prenos (handoff) kao i svaki drugi: odluka o rasporedu faza se čita iz upisanog plana (princip
pouke 29), ne računa se ponovo iz dužine. Proveri mrežom: za N ∈ {1, 2, 3, MIN − 1} i N ∈ {MAX + 1, MAX + 8, 52}, po
osnovnim profilima (redovan sa rezultatom, po osećaju, početnik; 3–6 dana; mali i veliki obim) — 0 odbijanja zbog
dužine i 0 padova validatora; izmeri koliko planova se i dalje odbija iz DRUGIH razloga (to je u redu, navedi).

## Testovi

- Postojeći testovi koji očekuju odbijanje zbog dužine: zameni očekivanjem plana + upozorenja.
- Nova mreža W1 (gore) kao nezavisna invarijanta: plan postoji, ima upozorenje, trkačka nedelja je poslednja, nema
  nedelje ispod minimalnog smislenog obima, nema praznog treninga, dugi ≥ lagan (AGENTS.md uslov 8).
- Planovi sa N u [MIN, MAX] ostaju bajt-isti (dokaži na postojećim baznim linijama).
- E2E: jedan slučaj kratkog plana kroz onboarding svoje distance (plan se pravi, upozorenje vidljivo). Ekrane van
  foldera distance NE menjaj; ako neki zajednički ekran blokira ili ne prikazuje upozorenje — navedi tačno gde.

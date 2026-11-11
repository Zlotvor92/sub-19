# C1 — „Cilj 80", korak 1: dugi kao lestvica sa sadržajem + vrh pa spuštanje

Izvor: `target/GAP.md` stavke 1 i 2 (pročitaj § 2 redove 1–2 i § 3) i ciljni planovi svoje distance
`target/<D>/pNN-target.md` (4 fajla — to je oblik koji treba dobiti; brojevi obima po danima u njima su procena, ne
norma). Način rada: `briefs/K3-krug-3.md` § „Način rada" (važi sve: jedna distanca = jedan tab, samo folder
`web/src/domain/generators/<D>/v2/`, pravilo = zaseban commit sa zelenim brzim nivoom, jedno mesto odluke, validator
čita isto, merenje pre/posle na mreži i 12 profila, sabotaža po pravilu, na kraju jednom pun nivo + testovi nad
promenjenim + E2E + `npm run check`, ispis `P9/plans/<D>/`, izveštaj `reports/C1-<D>-REPORT.md` ≤ 80 redova, poruka
organizatoru). Verzija: sledeća manja.

## Odobrena promena osnove (organizator)

Do sada je važilo „doza iste zone ne opada kroz plan" (5K: strogi rast RP; 10K: lanac doza D12/D33; HM: lanac doze i
nedelja B; MAR: M12/M19). OD C1: invarijanta važi DO NEDELJE VRHA. Posle nedelje vrha doza SME da pada, po pravilu
C1-B. Konstruktor i validator se menjaju zajedno; adaptacija čita nedelju vrha iz upisanog plana (pouka 29), ne
računa je ponovo. Prethodni izveštaji gde je ovo bio sudar: `reports/K3-<D>-REPORT.md` § Otvoreno (K3-D).
Ovo NIJE dozvola za druge izmene osnove: sve što nije C1-A/C1-B ostaje kako jeste.

## C1-B — vrh pa spuštanje (radi PRVO; C1-A se oslanja na nedelju vrha)

1. Nedelja vrha V = ne-rasteretna nedelja 3 nedelje pred trku (trka u nedelji N → V = N − 3); plan ≤ 8 nedelja:
   V = N − 2. Ako je to rasterećenje ili nedelja testa: najbliža ranija ne-rasteretna bez testa.
2. Najveći zbir minuta rada kvaliteta u planu (svi dani kvaliteta + blok u dugom) je u nedelji V. Lestvice doza se
   grade tako da najviši nivo padne u V (ne u poslednju nedelju pred taper).
3. Nedelje između V i tapera: zbir minuta rada ≤ 85 % nedelje V, ali ≥ 60 % (nije rasterećenje); ista zona, niži
   nivo lestvice ili kraća struktura.
4. Taper ≤ 60 % nedelje V po minutima rada; trkačka nedelja kao do sada (6–12 min, postojeći plafoni).
5. Obim (km): vrh obima ostaje gde je (kraj razvoja po G1) ili u V — NE pomeraj pravila obima osim ako nedelja V po
   novom rasporedu doza ne staje; tada prijavi.
Merenje: u koliko planova je najteža nedelja (minuti rada) tačno V (sada: MAR 0 %, HM ≈ 7 %, 10K/5K v. K3-D);
nedelja posle V > 85 %; taper > 60 %; odbijanja (0 novih).

## C1-A — dugi kao lestvica sa sadržajem

1. **Lestvica dužine (redovan plan; početnik ostaje po svojim pravilima — to je korak 2).** L = najduži dugi plana po
   sadašnjim pravilima (ne menja se). Prva nedelja: dugi = max(postojeći donji uslov iz skorašnjeg dugog; 0,82 × L),
   najviše L. Raste ravnomerno do L u poslednjoj ne-rasteretnoj nedelji razvoja; korak 0,5–1 km (5K/10K), 1–2 km
   (HM/MAR), zaokruženje po postojećem pravilu. Plan u kome je sadašnji dugi već ispod 0,82 × L na startu se ne menja.
2. **Talas (samo HM i MAR, svi brojevi dana).** Od početka plana: nedelja „gore" po lestvici / nedelja „dole" =
   0,80–0,85 × poslednja „gore" (rasterećenje se računa kao „dole"). Postojeći talas iz K4 (plafon od kraja, najviše
   3–4 puta) ostaje kao pravilo za poslednje nedelje; C1 ga produžava unazad. 5K/10K: bez talasa.
3. **Lagan dan uz kraći dugi.** Granica laganog (udeo × dugi) se računa prema poslednjoj nedelji „gore" (ne prema
   nedelji „dole" niti prema nižem dugom s početka lestvice ako bi to spustilo nedelju 1 ispod 95 % trenutnog
   obima — tada važi postojeći izuzetak nedelje 1 / 0,80). Cilj: C1-A ne sme da spusti planirani obim; ako spusti
   vrh > 10 % u > 10 % planova grupe → granica laganog ostaje kao pre C1 za tu grupu.
4. **Sadržaj dugog** (u okviru postojećih plafona minuta; nedelja sa sadržajem u dugom: drugi kvalitet te nedelje
   lakši ili lagan, kao u K4-A):
   - 5K: u 2–3 nedelje oko V poslednja 3 km dugog progresivno (do tempa između laganog i T); ubrzanja ostaju.
   - 10K: u 2–3 nedelje oko V završnih 10–15 min u T (sada samo plan sa 3 dana) — za sve brojeve dana.
   - HM: blok RP u dugom 4 → 6 → 8 km (VDOT ≥ 50 i ≥ 80 km do 10 km), poslednji i najduži u nedelji V; u nedelji
     posle V blok 4 km.
   - MAR: blok MP u dugom 8 → 12 → 14 km (brzi do 16–18 po K3-E), najduži u nedelji V (3 nedelje pred trku); posle V
     bez bloka ili ≤ 8 km.
Merenje: broj ne-rasteretnih nedelja sa istim dugim kao prethodna ne-rasteretna (plato) pre/posle; dugi u nedelji 1
/ L; planirani vrh obima; broj planova sa sadržajem u dugom; p04, p08, p05, p01 pre/posle (dugi po nedeljama).

## Sudari

Ako C1-B ne može da se ugradi ni uz odobrenu promenu invarijante (navedi tačno koje pravilo i gde): NE radi C1-A
deo 4 (zavisi od V), uradi C1-A delove 1–3, izveštaj § Otvoreno sa opcijama. Nova odbijanja > 0 ili vrh −10 % u
> 10 % planova grupe → prethodno ponašanje za tu klasu + brojevi.

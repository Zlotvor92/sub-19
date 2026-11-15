# K4 — krug 4: dve stavke koje po glavnom treneru još vrede (krug 3)

Izvor: `coach/ROUND-03.md` (§ neugrađeno A i B, § sud po distanci). Način rada: ISTI kao `briefs/K3-krug-3.md`
§ „Način rada" (pročitaj ga; važi sve: pravilo = zaseban commit sa zelenim brzim nivoom, jedno mesto odluke, merenje
pre/posle na mreži i na 12 profila, sudar ili nova odbijanja ili vrh −10 % u > 10 % planova grupe → prethodno
ponašanje + brojevi u § Otvoreno, sabotaža po pravilu, na kraju jednom pun nivo + E2E + `npm run check`, ispis
`P9/plans/<D>/`, izveštaj `reports/K4-<D>-REPORT.md` ≤ 60 redova, poruka organizatoru). Verzija: sledeća manja.
Prethodni nalazi i mesta u kodu: `reports/K3-<D>-REPORT.md` (§ Otvoreno).

## K4-A — plan sa 3 dana (HM i MAR; redovan plan, ne početnik)

Problem: 3 dana na HM/maratonu su najslabiji planovi (dugi isti i do 50 % nedelje svake nedelje, bez drugog podražaja).
Rešenje trenera, kao jedna celina:
1. U specifičnoj fazi (i kasnom razvoju ako staje) dugi u nedelji B nosi blok trkačkog tempa NAJNIŽEG nivoa lestvice
   (HM: RP, MAR: MP). U TOJ nedelji kvalitet usred nedelje je LAGAN dan (ne T, ne RP) — tako nema sudara sa lancem
   doza: koristi postojeći mehanizam nedelje B za 4+ dana (HM: P1 „B-nedelja", MAR: P2 „MP blok u dugom"), samo ga
   otvori za 3 dana. Ne uvodi nov tip slota.
2. Talas dugog: kad dugi stoji na plafonu više od 3 ne-rasteretne nedelje zaredom — smenjuj plafon / 0,85 × plafon;
   plafon najviše 3 puta u planu sa 3 dana; nedelje na plafonu su one sa blokom, nedelje na 0,85 su lagane. Plafon se
   troši OD KRAJA plana unazad (poslednje nedelje pred taper imaju prednost), ne od početka.
3. Tek uz 1 i 2: lagan ≤ 0,70 × dugi za 3 dana. Ako i tada vrh pada > 10 % u > 10 % planova — ostaje 0,80.
Merenje: p08 i p03/p10 pre/posle (dugi po nedeljama, km u trkačkom tempu), broj planova sa blokom, odbijanja.
Ako deo 1 ne može postojećim mehanizmom: stani na tom delu, izmeri, § Otvoreno; delove 2 i 3 ne radi bez dela 1.

## K4-B — mali obim: kratak lagan dan (sve distance)

Problem: lagan dan < 30 min u više od 2 nedelje (p06 na sve četiri distance, HM p11, 10K p11) — plan ima dan koji
ne vredi izlaska. NE menja se broj dana ni raspored (ekrani se ne diraju).
Rešenje: u planu gde bi najkraći lagan dan bio < 30 min u više od 2 nedelje izgradnje, taj dan (jedan po nedelji:
najkraći lagan koji nije dugi ni kvalitet) dobija oznaku u tekstu treninga „odmor ili 20 min lagano po želji", a
njegovi km se NE računaju u obavezan obim nedelje: prelaze u ostale lagane dane do njihove granice (lagan ≤ udeo ×
dugi), ostatak je „planirano < cilj" bez upozorenja po nedelji. Jedna rečenica u napomeni plana. Trening ostaje tip
„lagano" sa km 0 ili najmanjim dozvoljenim — izaberi ono što validator i ekrani već podnose (dan odmora u danu
trčanja već postoji kod perioda bola / rasterećenja — iskoristi isti oblik). Ako nijedan postojeći oblik ne prolazi
bez izmene van foldera distance: samo rečenica u napomeni plana + merenje, bez izmene treninga.
Merenje: broj planova i nedelja koje pravilo pogađa (K3 izmereno: 5K 983, 10K 7078, HM 4297, MAR ≈ 2300), obim
ostalih laganih dana, odbijanja.

## Raspodela

- HM: K4-A pa K4-B. MAR: K4-A pa K4-B. 5K: samo K4-B. 10K: samo K4-B.

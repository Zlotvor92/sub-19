# Glavni prompt — HM v2 i maraton v2

Vodi organizator (sesija `session_01CtvbsCTQ3RmMWYYTgGt6Wm`). Ovaj dokument je zajednički deo svakog segmenta HM v2 i
maraton v2: radna sesija dobija kratak prompt segmenta („Segment HM-01 … pročitaj MASTER-HM-MARATHON.md § 1–3 i § 4/5")
i radi po ovom dokumentu. Trenerski brojevi su SAMO ovde (§ 4, § 5); kad nečega nema — opreznija opcija + odstupanje u
izveštaju, ili STANI.

Polazište: 10K v2 (`10k-v2.5.x`) i 5K v2 (`5k-v2.7.x`) su tehnički obrazac (kopira se, ne uvozi).

## 0. Faze

| Faza | Šta | Kako |
|---|---|---|
| 1 | Jezgro + adaptacija: HM-01 … HM-04 i MAR-01 … MAR-04 | dve sesije uporedo (HM, maraton), segmenti redom unutar distance; posle svakog segmenta provera organizatora |
| 2 | Aplikacija: HM-05 → HM-06 → MAR-05 → MAR-06 | redom, jedna sesija u isto vreme (zajednički fajlovi) |
| 3 | Predaja v2 (maraton → HM → 10K, kao cilj samo činjenice) | jedna sesija, posle faze 2 |
| 4 | Kompletna provera obe distance (organizator) + `npm run check:full` + ceo E2E | merge u main samo na izričitu odluku korisnika |

## 1. Pravila za svaku radnu sesiju (doslovno)

- Grana `claude/generator-isolation-5k-10k-hm-marathon`; pre rada `git pull`; pre pusha `git pull --no-rebase`; nikad
  rebase/force; nema nove grane, PR-a, mergea u main ni deploya. Jedan segment = jedan commit (+ izveštaj, STATUS).
- Kraj ili STANI: `send_message` organizatoru (sesija gore): SHA, status, putanja izveštaja, otvorena pitanja. Na sudaru
  STANI i čekaj odgovor organizatora; ne biraš sam između trenerskih opcija.
- Folderi: HM → `web/src/domain/generators/halfMarathon/v2/**` i `docs/hm-v2/**`; maraton →
  `web/src/domain/generators/marathon/v2/**` i `docs/marathon-v2/**`. U fazi 1 NIŠTA van svog foldera (druga sesija radi
  paralelno u drugom).
- Izolacija (AGENTS.md uslov 7): v2 distance ne uvozi ništa van svog v2 foldera (ni tenK, ni fiveK, ni v1); test izolacije
  po obrascu `tenK/v2/isolation.node.test.ts`; postojeći architecture/isolation testovi bez novih izuzetaka.
- v1 bajt-isti: HM v1, maraton v1, lični plan vlasnika (`personalPlan.node.test.ts` se ne menja); `halfMarathon/index.ts`
  i `marathon/index.ts` se ne menjaju do faze 2.
- Svaka odluka: jedno mesto u kodu, red u `policy.ts` DECISIONS (pravilo, mesto, obrazloženje), test koji pada pre izmene.
  Validator samo prijavljuje. Bez petlji skraćivanja/dopune.
- Svaka tvrdnja u izveštaju iz stvarno pokrenute komande ili merenja (sa brojem).
- Testovi (AGENTS.md, `docs/testing/TEST-SPEED.md`): mreže kroz `src/test/level.ts` (`sample` u brzom nivou, `part` za
  delove punog nivoa `*.full.node.test.ts`), mreže u `beforeAll`; nijedan fajl brzog nivoa > 60 s (zid sa collect, ne samo
  „tests"); ceo node skup distance u brzom nivou ≤ 60 s. Pre predaje: `npm run check` i pun nivo svoje distance
  (`TEST_FULL=1 npx vitest run --project node <folder>`); `npm run check:full` kad diraš zajednički kod.
- Sabotaže SAMO kroz `web/scripts/sabotage.mjs` (`docs/testing/SABOTAGE.md`), samo fajlovi koji treba da uhvate, `--bail=1`.
- Agenti (Agent tool) u sesiji samo za čitanje koda, merne skripte i izveštaje — ne za izmene jezgra. Dele 4 jezgra sa
  tobom: testove i merenja pokreći jedan po jedan.

## 2. Pouke iz 5K, 10K i HM/maraton (obavezne; svaku pokrij testom)

1. Cilj nedelje iz STVARNE konstrukcije; rupa izvodljivosti → samo ta nedelja na najbliži izvodljiv cilj; globalni vrh se
   nikad ne spušta; regresija vrhova prema prethodnom segmentu (fixture + izuzeci sa razlogom).
2. Dugi ≥ svaki lagan (tvrdo); udeo dugog po broju dana.
3. Glavna doza ne opada kroz ne-rasteretne nedelje izgradnje; nema identičnih uzastopnih ne-rasteretnih nedelja; baza bez
   platoa; bez višeg nivoa → ista doza druge strukture.
4. Rasterećenje nikad na prvoj nedelji faze, ni u ned 1–2, ni na poslednjoj pred taperom.
5. Trkačka: cilj = planirano; dan pred trku ≤ 30 min; oštrenje ≥ 3 dana pre trke i ≤ RP doza tapera; lagan trkačke ≤
   lagan tapera; trkačka (bez trke) ≤ taper; Uslov 8 trkačke računa i trku.
6. Validator samo prijavljuje; jedan plafon po zoni; WU/CD nisu pufer; odbijanje umesto degenerisanog plana.
7. Adaptacija: povratni rast do nivoa pre smanjenja; donja granica = minimum nedelje; nepotpun zapis ≠ pauza (coverage);
   eksplicitna pauza; bol > pauza > umor > izvršenje; zaštita prošlosti/urađenog/zaključanog.
8. Aplikacija: prekidač podrazumevano isključen i skriven; nikad tihi fallback na v1; prilagođavanje samo pregled +
   potvrda + revizija; trka van obima nedelje u prikazu; uvoz čuva trčanja van plana; pokrivenost samo iz fullSync.
9. Strukturni kapacitet: udeo dugog × (lagan ≤ dugi) × fiksni WU/CD određuju najveći obim; nedelja 1 < trenutni obim sme
   samo kad je dugi nedelje 1 na vremenskom plafonu.
10. Najniži nivo lestvice mora stati u plafon pri najmanjem obimu reda.
11. Druga struktura iste doze: 100 m, pa 50 m kad podele nema; najmanja deonica po zoni.
12. Doza sme da padne (plafon ispred progresije) samo u nedelji ograničenoj kapacitetom.
13. Početnik nema test; test ne sme da „pojede" nedelju.
14. Kvalitetni dan duži od dugog po trajanju → upozorenje sa preporukom manje dana.
15. Svaka ispravka se prvo izmeri na celoj mreži pre/posle; neočekivan pomak = objasni ili odbaci ispravku.
16. Adaptirani plan: struktura dana uzima tempo i osnovu NEDELJE (posle rezultata tempo važi od sledeće nedelje); bez
    koraka adaptacije — bajt-isto kao generator (10K 06, A1).
17. Rezultati su činjenice: test plana (vreme deonice na danu testa), test 3 km, trka (3/5/10 km, HM, maraton); plan po
    osećaju ostaje po osećaju do nedelje rezultata.
18. Bol: sidro r = nedelja koja sadrži asOf + 1 (isti bol daje isti plan bez obzira na dan u nedelji); osnova povratka =
    min(round(0,7 × nivo pre bola), cilj nedelje r) — jedna funkcija za konstruktor, validator i poruku; progresija doze
    kreće ispočetka od r + 1; mreža bola u SVAKOM danu nedelje (10K A16, 5K 08d).
19. Promena cilja: svi budući treninzi zaključani → treninzi bajt-isti, menja se samo ocena.
20. Traka „Plan treba prilagoditi" samo za NOVO ograničenje posle poslednje adaptacije; posledica drugog uslova (npr.
    premeštanje testa) nije razlog.
21. Predaja: izvor šalje samo činjenice; cilj sam izvodi povratni ulaz (jedan vlasnik, `returnInput`); test celog toka
    (izvor → predaja → cilj) i kontrola cilja (10K Predaja-1).
22. Redovno rasterećenje odmah posle nedelje smanjenja otpada (10K A17, 5K 08e): nedelja smanjenja = (a) korak sa ciljem
    koraka koji je smanjenje (pauza, manjak; polje `reduced: true`; višak `false`), (b) sidro bola r; (c) nov start ne
    ulazi. Prinudno rasterećenje (umor) se nikad ne ukida; niz izgradnje od ukinute nedelje ≤ (pravilo niza) + 1, inače
    ostaje; jedno mesto odluke (okviri nedelja), validator čita isti podatak.
23. Konstruktor nikad ne sastavlja ono što validator odbija (10K N7): pretraga RANE i SREDNJE adaptacije na svim mrežama —
    asOf u nedelji 1 (sreda i kraj), sredinom nedelje i pre svake posebne nedelje (test, rasterećenje, taper), svi
    scenariji — mora dati 0 odbijanja. Odstupanje od pravila (npr. cilj naviše da test stane) prihvata se samo ako
    sastavljena nedelja ima svojstvo zbog kog odstupanje postoji.
24. Veličina koju koriste i konstruktor i validator (najduži dugi, poslednja izgradnja, minimum nedelje, osnova povratka)
    ima JEDNU funkciju; dve definicije iste stvari su greška.
25. Minimum nedelje važi za CILJ; planirano ispod cilja zbog dana bola/odmora je upozorenje (10K A4
    PLANNED_BELOW_TARGET_LIMITS), ne greška.
26. Merenje vremena testova uključuje collect/import (JSON reporter ga ne vidi); sabotaže alatom, ne celim skupom.
27. (MAR-01) Kad jednake deonice nemaju drugu strukturu iste doze, druga struktura je piramida u opsegu zone sa korakom
    200 m i istim zbirom (npr. I 5000 = 800-1000-1200-1200-800), naizmenično sa jednakim deonicama (pouka 3).
28. (MAR-01) Opcioni ulaz `recentLongRunKm` (skorašnji najduži trk, 5–42 km): dugi nedelje 1 ≤ max(1,1 × recentLongRunKm,
    recentLongRunKm + 1,0); nedelja 1 sme ispod trenutnog obima i kad je dugi ograničen ovim (dopuna pouke 9). Bez ulaza:
    napomena nedelje 1 sa pragom. Važi za HM od HM-02 i za maraton od MAR-02.

## 3. Tok jednog segmenta i provera

IZVRŠILAC (radna sesija): implementira segment po odlukama, testovi, mreže, primeri (`docs/<dist>-v2/artifacts/`),
izveštaj `docs/<dist>-v2/reports/SEGMENT-NN-IMPLEMENTATION.md` (≤ 150 linija: odluke | mesto | test, odstupanja sa
ulazom, sabotaže sa trajanjem, komande i rezultati, K1–K6, regresija, stalni uslovi 1–8, tabela jednog plana, „Preostali
problemi"), `docs/<dist>-v2/STATUS.md` (≤ 80 linija). Commit, pull, push, poruka organizatoru.

ORGANIZATOR posle svakog segmenta: putanje diffa; testovi; SOPSTVENA nezavisna pretraga invarijanti i rane adaptacije;
trenersko čitanje tabela (mali/veliki obim, spor/brz trkač); poređenje brojki iz izveštaja sa merenjem. Nalazi idu u
sledeći segment ili ispravku (`NNb`).

KONTROLNE METRIKE (svaki segment, svaka mreža): K1 odbijanja i greške validatora (0); K2 ned 1 < obim: ukupno / bez dugog
na plafonu; K3 nedelje izgradnje bez kvaliteta; K4 vrh niži od prethodnog segmenta (broj, najveći pad, razlog); K5
trkačka > taper, pad doze van kapaciteta, susedni teški dani, dugi < lagan (0); K6 ponavljanja slota, kvalitetni dan
duži od dugog, CAPACITY_LIMITED, vrh/start — po broju dana.

Segmenti po distanci (faza 1): 01 jezgro 4 dana sa rezultatom · 02 3/5/6 dana · 03 po osećaju + test, početnik,
odbijanje trčanja/hodanja · 04 adaptacija. Verzije `<id>.0.0` … `<id>.3.0` (id `hm-v2` / `marathon-v2`), ispravke patch.
Mreže: 01 — 4 dana × sve nedelje × obim (korak 5) × VDOT {30,35,40,45,50,55,60,70} × 3 rasporeda × trka sub/ned; 02 —
3–6 dana po tabeli; 03 — po osećaju (lagan {270,315,360,405,450,510}) i početnik (po osećaju 330/390/450/510, VDOT
30/35/40); 04 — mreža scenarija (svi brojevi dana × rezultat/osećaj + početnik; asOf: ned 1 sreda i kraj, kraj ned 2,
sredina, pre testa/rasterećenja/tapera, sreda tapera; scenariji: bez činjenica, 100 %, manjak 50 %, višak 120 %, pauza 10
(coverage), 20 (eksplicitna), 35 (nov start), bol 5, bol 8 u svakom danu nedelje, umor, rezultat ±2 VDOT, test, nepotpuna
pokrivenost, zaključani + urađeni, lanac, bol + pauza) + pouke 7, 18, 22, 23 kao posebni testovi.

## 4. Polumaraton (policyId `hm-v2`)

- H1 Opseg 01: 4 dana; 10–20 nedelja; obim 30–60 km; rezultat 5 km/10 km/HM/maraton ≤ 84 dana; VDOT 30–80; < 10 ned
  trajno odbijanje (preporuka 10K); > 20 „počni kasnije"; < 30 km preporuka 10K ili osnove.
- H2 Tempo Daniels–Gilbert; zone E 0,62–0,70, T 0,88, I 0,975, R 1,05 (sekundarni izvor); RP = prognoza HM iz trenutnog
  VDOT-a; fiksno do adaptacije.
- H3 Cilj: Δ VDOT ≤ 0,1·N realističan, ≤ 0,2·N ambiciozan, više nerealan (upozorenje).
- H4 Faze: trka 1, taper 1, B = N − 2: specifično 3 (B ≤ 9) / 4 (B 10–13) / 5 (B ≥ 14); baza = ceil((B − spec)/2);
  razvoj ostatak (Bosquet i sar. 2007: smanjenje 8–14 dana; više sportova).
- H5 Rasterećenje: ≤ 3 izgradnje (izuzetno 4 kad bi palo na prvu nedelju faze); 0,8×; 1 kvalitet T ≈ 60 % (min 2,0 km);
  dugi 0,8× poslednjeg ne-rasteretnog.
- H6 Obim: ned 1 = trenutni; +6 % (min 1,0, max 4,0 km); vrh = min(start × 1,4; start + 20; max dana; kapacitet).
- H7 Taper: 0,7 × vrh; RP i T ≈ 60 % (min RP 2 × 2000 m, T 2,0 km); dugi ≤ 0,6 × najduži.
- H8 Trkačka: dana = min(dani, 5), trka zamenjuje dugi; oštrenje 2 × 2000 m RP (2:00) ≥ 3 dana pre trke i ≤ RP tapera;
  dan pred trku 20 min E + 4 × 20 s; ostali min(35 min E, lagan tapera); trka 21,1 km + WU 10 + CD 10 van obima;
  Uslov 8 = planirano + 21,1.
- H9 Raspored: kvaliteti i dugi međusobno nesusedni (ciklično); dugi iz ulaza / nedelja / poslednji dan.
- H10 Kvalitet: baza Q1 R, Q2 T kont.; razvoj Q1 I, Q2 T cruise; specifično Q1 RP, Q2 T cruise. Lestvice:
  R 6×200 · 8×200 · 6×300 · 10×200 · 8×300 · 8×400 | T kont. 2,0 · 2,5 · 3,0 · 4,0 · 5,0 · 6,0 · 7,0 |
  T cruise 2×1200 · 3×1000 · 2×1600 · 4×1000 · 3×1600 · 4×1500 · 4×1600 · 5×1600 · 3×3000 |
  I 2×1000 · 3×800 · 3×1000 · 4×1000 · 4×1200 · 5×1000 · 5×1200 |
  RP 2×2000 · 2×2500 · 2×3000 · 2×4000 · 3×3000 · 2×5000 · 3×4000.
  Druga struktura: T ≥ 1000 m ili kontinuirano; RP ≥ 2000 m ili kontinuirano do 10 km; I 800–1200 m do 6 ili piramida;
  R 200/300/400.
- H11 Plafoni po treningu: R 5 %, I 8 %, T 10 %, RP 15 %.
- H12 Progresija: ≤ 1 nivo/ned; početni nivo = najviši ≤ 60 % plafona; prelazi T cruise ≥ T kont., RP ≥ I.
- H13 Dužine: dugi ≤ udeo dana i ≤ 150 min sporim E; lagan ≥ 4 km; upozorenje kad je najduži dugi < 16 km.
- H14 WU/CD po trenutnom obimu: < 40 km 15/10; 40–59,9 20/15; ≥ 60 25/15. Oporavci: R isti metraž; I 1:1 (max 4:00,
  15 s); T cruise 60 s (≤ 1600 m) / 90 s; RP 90 s (≤ 3000 m) / 120 s.
- H15 Tabela dana (02): 3 d: 1 Q + lagan + dugi, 25–45 km, max 55, dugi 45 %, min 12 | 4 d: 2 Q + 1 lagan, 30–60,
  max 70, 35 %, min 16 | 5 d: 2 Q + 2 lagana, 35–75, max 85, 32 %, min 20 | 6 d: 2 Q + 3 lagana, 40–90, max 100, 30 %,
  min 24. 3 dana: jedan kvalitet T kont. → T cruise → RP, bez I/R. 5/6 dana: lagani jednaki. 1/2/7 dana odbijanje.
- H16 Po osećaju (03): easyPaceSecPerKm 270–510 obavezan; E = lagan ± 15 s; procena VDOT-a = VDOT čiji je brži kraj E =
  lagan (25–60) samo za orijentir; RPE T 6–7, RP 6–7, I 8, R 8; test 5 km u poslednjoj nedelji baze (Q1 ili kvalitet
  rasterećenja), u obimu, ne u dozi; bez prognoze/cilja do testa. Pouka 23: cilj rasterećenja sa testom naviše samo ako
  nedelja zaista ima test.
- H17 Početnik (03): 4–5 dana; 12–20 ned; obim 4 d 20–40, 5 d 25–45; uvod 2 ned; jedan kvalitet (T kont. → T cruise →
  RP), bez I/R; T kont. početnika [1,5; 2,0; …] i T kont. kad prvi nivo faze ne staje; rast +5 % (1,0–2,0 km); vrh
  min(1,4×; +15; max; kapacitet); dugi ≤ 135 min; WU/CD 15/10; bez testa; upozorenje kad je najduži dugi < 14 km.
  runWalk → RUN_WALK_NOT_SUPPORTED (preporuka 5K trčanje/hodanje).
- H18 Adaptacija (04): kao 10K v2 A1–A17 (pročitaj izveštaje 10K 04, 06b, 06c, 06d i `tenK/v2/policy.ts` DECISIONS), uz
  pouke 18, 22–25; „orijentir" kad je nov start i < 10 nedelja do trke; bol: dugi ≤ 60 min, lagani × 0,7 (≥ 4 km); taper
  posle smanjenja = 0,7 × najveći cilj izgradnje posle poslednjeg smanjenja; donja granica = minimum nedelje broja dana;
  rezultati 5000/10000/21097,5/42195.

## 5. Maraton (policyId `marathon-v2`)

- M1 Opseg 01: 4 dana; 12–24 nedelje; obim 35–65 km; rezultat 10 km/HM/maraton (5 km dozvoljen uz upozorenje) ≤ 84 dana;
  VDOT 30–80; < 12 ned trajno (preporuka polumaratona); > 24 „počni kasnije"; < 35 km preporuka polumaratona ili osnove.
- M2 Tempo: Daniels–Gilbert, zone kao H2; MP = prognoza maratona iz VDOT-a umanjenog za korekciju obima: −2,0 VDOT kad je
  trenutni obim < 40 km, −1,0 za 40–59,9 km, 0 od 60 km (heuristika; Vickers i Vertosick 2016: Riegel je kod rekreativaca
  preoptimističan za maraton, obim popravlja prognozu). Fiksno do adaptacije.
- M3 Cilj: Δ VDOT ≤ 0,08·N realističan, ≤ 0,16·N ambiciozan, više nerealan (heuristika).
- M4 Faze: trka 1, taper 2, B = N − 3: specifično 4 (B ≤ 12) / 5 (B 13–16) / 6 (B ≥ 17); baza = ceil((B − spec)/2);
  razvoj ostatak. DECISIONS: duži taper je opreznija opcija za maraton (praksa; Bosquet 2007: 8–14 dana opšte
  optimalno, specifični dokaz za maraton ograničen).
- M5 Rasterećenje kao H5 (min T 2,0 km).
- M6 Obim: ned 1 = trenutni; +6 % (min 1,0, max 5,0 km); vrh = min(start × 1,5; start + 30; max dana; kapacitet).
- M7 Taper: ned N−2 0,8 × vrh (MP i T ≈ 60 % poslednje doze; dugi ≤ 0,65 × najduži); ned N−1 0,6 × vrh (MP ≈ 50 %, bez T;
  dugi ≤ 0,45 × najduži); minimum MP u taperu 2 × 3000 m.
- M8 Trkačka: dana = min(dani, 5), trka zamenjuje dugi; oštrenje 2 × 2000 m MP (2:00) ≥ 3 dana pre trke i ≤ MP doza
  poslednje nedelje tapera; dan pred trku 20 min E + 4 × 20 s; ostali min(30 min E, lagan tapera); trka 42,2 km + WU 5 min
  van obima; Uslov 8 = planirano + 42,2.
- M9 Raspored kao H9.
- M10 Kvalitet: baza Q1 R, Q2 T kont.; razvoj Q1 I, Q2 T cruise; specifično Q1 MP, Q2 T cruise. Lestvice: R kao H10 |
  T kont. 2,0 · 3,0 · 4,0 · 5,0 · 6,0 · 8,0 | T cruise 2×1200 · 3×1000 · 3×1600 · 4×1600 · 5×1600 · 3×3200 |
  I 2×1000 · 3×1000 · 4×1000 · 5×1000 · 5×1200 | MP 2×3000 (6) · 2×4000 (8) · 2×5000 (10) · 12 kont. · 2×7000 (14) ·
  16 kont. Druga struktura: MP ≥ 3000 m ili kontinuirano do 16 km; ostalo kao H10.
- M11 Plafoni po treningu: R 5 %, I 8 %, T 10 %, MP 20 % (Daniels: M ≤ 20 % nedelje, sekundarni izvor).
- M12 Progresija kao H12 (prelaz MP ≥ poslednje I).
- M13 Dužine: dugi ≤ udeo dana i ≤ 150 min sporim E (Daniels, sekundarni izvor); lagan ≥ 5 km; upozorenje
  MARATHON_LONG_SHORT kad je najduži dugi < 26 km (preporuka: više dana ili obima).
- M14 WU/CD po trenutnom obimu: < 50 km 15/10; 50–69,9 20/15; ≥ 70 25/15; oporavci kao H14; MP 90 s (≤ 4000 m) / 120 s.
- M15 Tabela dana (02): 3 d: 1 Q + lagan + dugi, 30–50 km, max 60, dugi 50 %, min 15 | 4 d: 2 Q + 1 lagan, 35–65,
  max 80, 40 %, min 20 | 5 d: 2 Q + 2 lagana, 40–85, max 100, 35 %, min 25 | 6 d: 2 Q + 3 lagana, 50–110, max 120, 32 %,
  min 30. 3 dana: jedan kvalitet T kont. → T cruise → MP, bez I/R. 5/6 dana lagani jednaki. 1/2/7 dana odbijanje.
- M16 Po osećaju (03): kao H16 (test 5 km; MP po korekciji iz M2 posle testa; RPE MP 5–6 „ritam maratona").
- M17 Početnik (03): 4–5 dana; 16–24 ned; obim 4 d 25–45, 5 d 30–50; uvod 2 ned; jedan kvalitet (T kont. → T cruise → MP),
  bez I/R; T kont. početnika [1,5; 2,0; …] i T kont. kad prvi nivo faze ne staje; rast +5 % (1,0–2,5 km); vrh min(1,5×;
  +25; max; kapacitet); dugi ≤ 150 min; WU/CD 15/10; bez testa; upozorenje kad je najduži dugi < 24 km („cilj: završiti").
  runWalk → RUN_WALK_NOT_SUPPORTED (preporuka kraće distance).
- M18 Adaptacija (04): kao 10K v2 A1–A17, uz pouke 18, 22–25; „orijentir" kad je nov start i < 12 nedelja do trke; bol:
  dugi ≤ 60 min, lagani × 0,7 (≥ 5 km); taper posle smanjenja: N−2 0,8 ×, N−1 0,6 × najvećeg cilja izgradnje posle
  poslednjeg smanjenja; donja granica = minimum nedelje broja dana; rezultati 5000/10000/21097,5/42195.

## 6. Faza 2 i 3 (aplikacija i predaja)

- 05 (svaka distanca): prekidač `generatorV2HalfMarathon` / `generatorV2Marathon` po obrascu 5K/10K (podrazumevano
  isključen; vidljiv samo administratoru ili uz `VITE_HM_V2` / `VITE_MARATHON_V2`); rutiranje u `select.ts` po policyId;
  KNOWN_VERSIONS; nikad tihi fallback; adapter `<dist>/v2/app/` (jedini v2 kod koji zna format aplikacije, lokalni
  strukturni tipovi); čarobnjak, prikaz (trka van obima), sat; v1, lični plan i ostale distance bajt-isti (snimak/heš);
  E2E za distancu.
- 06 (svaka distanca): `<dist>/v2/app/facts.ts` (jedino mesto prevoda; pouke 16–20); pregled → potvrda → revizija;
  vraćanje verzije; traka; Forma; promena cilja.
- Predaja (faza 3, pouka 21): izvor šalje SAMO činjenice. HM v2 → 10K (10K v2 ako je njegov prekidač uključen za
  korisnika, inače 10K v1). Maraton v2 → HM ili 10K (v2 cilj ako je njegov prekidač uključen, inače v1). HM v2 kao CILJ
  maratona prima samo činjenice i sam određuje povratnu politiku.
- Kompletna provera (faza 4, organizator): kao `docs/10k-v2/reports/FINAL-CHECK-10K.md`, uz pretragu rane adaptacije.

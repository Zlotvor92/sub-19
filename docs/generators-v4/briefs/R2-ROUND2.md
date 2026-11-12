# Krug 2 — ispravke posle ocene HM V4 (12. 11. 2026)

Ocena kruga 1: trener 68,4 (v3: 77,6), drugi sudija 60,9; nijedan plan na ≥ 80. Oba sudije nezavisno navode iste
sistemske greške. Izvori (čitaj ih): `docs/generators-v4/coach/ROUND-V4-HM-01.md`,
`docs/generators-v4/judge2/ROUND-V4-HM-01.md`. Ovaj fajl je odluka organizatora šta se menja i ko to radi.
Napomena: raniji zahtev organizatora „V4 ≥ v3 po vrhu km i najdužem dugom" se POVLAČI — proizveo je prevelik vrh i
lagane dane od 14–17 km. v3 brojevi su orijentir, ne donja granica; važe pravila ispod.

## Pravila (R) i vlasnik

**Motor (`engine/`) — tab M**
- R1. Nedelja trke i sužavanje: lagan dan ≤ lagan dan istog mesta prethodne nedelje i ≤ `safety.taperEasyMaxSec`
  (novo, opciono; podrazumevano 50 min; 3 dana 40 min). Neutrošen budžet se NE preliva — nedelja je manja od cilja.
- R2. Lagani dani nisu pufer: (a) lagan dan ≤ 65 % dugog te nedelje (`easyMaxShareOfLong`, proveri da veže);
  (b) lagan dan ≤ 1,25 × najduži lagan dan prethodne nedelje koja nije rasterećenje (prva nedelja: bez uslova);
  (c) kad kvaliteta u nedelji nema, njegov budžet se ne seli u lagane dane preko (a)/(b). Višak ostaje neplaniran
  (planirano < cilj; čuvar to ne prijavljuje do −15 %).
- R3. Rast i vrh: nedelja ≤ najveća od prethodne 3 (van pauze/rampe) × (1 + `maxWeeklyRampPct`), BEZ izuzetka posle
  nedelje sa proverom forme; vrh `P ≤ B × safety.maxPeakOverBase` (novo; podrazumevano 1,40).
- R4. Dugi i dani: dugi ≤ `longShareByRunDays` × PLANIRANI zbir te nedelje (ne × vrh). Motor NIKAD sam ne izbacuje
  traženi dan kad je `runDays ≥ 3`: ako budžet ne dâ `minEasySec` po laganom danu, prvo se skraćuje dugi (do svog
  udela), pa kvalitet postaje lagan dan; dan otpada tek kao poslednje i tada plan to kaže (upozorenje sa razlogom).
- R5. Osnova ≥ sadašnji obim u minutima: cilj nedelje gradnje `T_k = max(loadPct × P, B + dodatno opterećenje
  kvaliteta te nedelje)` — kvalitet ide PREKO sadašnjih minuta, ne umesto njih (sada p05 ima 69–80 km uz 90).
- R6. Istina o tempu trke: zaglavlje dobija rečenicu (tekst iz `format`): „Tempo trke u treninzima je tvoja
  današnja forma (X/km). Tvoj cilj A traži Y/km — dostižan je / na ivici / van raspona (raspon …). Tempa se
  ubrzavaju kad trka ili test to potvrde." Taktika dana trke računa se iz: cilja ako je u rasponu, inače iz
  očekivanog vremena; za trkača po osećaju bez s/km (opis napora).
- R7. Bol: nivo 1–3: 1 dan odmora pa lagano, bez `impact: 'visok'` 5 dana; nivo 4–6: 2 dana odmora, zatim samo
  lagano; BEZ kvaliteta i bloka 10 dana (ne 7), prvi kvalitet ≤ 60 % doze, dugi ≤ 75 % poslednjeg dugog 14 dana;
  nivo ≥ 7 kao sada. Tekst promene mora da sadrži: uslov za nastavak („nastavi ako je bol ≤ 2/10 i ne raste"),
  prag za prekid i lekara. Posle prozora NE „plan se nastavlja kako je bio" bez uslova.
- R8. Propušten ključni trening: (a) uvek rečenica u PROMENE (šta je propušteno, šta to znači, šta plan radi), i
  kad se treninzi ne menjaju; (b) propušten dugi sa blokom ili vršni kvalitet, a do nedelje `taper` ima ≥ 1 puna
  nedelja `build`/`peak`: sledeći dugi dobija blok na PRETHODNOM koraku lestvice (ne većem); inače „nije nadoknadivo
  — poslednje dve nedelje su za odmor"; (c) lanac dugog ide od STVARNO odrađenih dugih (tri nedelje bez dugog →
  sledeći dugi ≤ poslednji odrađen + korak, bez bloka).
- R9. Pauza i planirana provera forme: test koji padne u pauzu/rampu se POMERA u prvu nedelju posle rampe (zamenjuje
  njen kvalitet), ne briše. Tekst „prvih N dana bez brzih" mora da odgovara stvarnom prvom danu kvaliteta u planu.
  Povratak posle pauze: nedelje posle rampe ≤ poslednja puna nedelja pre pauze × 1,10 pa po pravilu rasta (nema
  24 → 33,5 → 51,7 km).
- R10. Ispis (`render`/`format`): bez tempa uz uspone i korake po naporu; bez duplog „nedelja trke"; nedelja 2 pre
  trke se ne zove „gradnja"; „Plan počinje dan posle trke" (trka) / „posle testa" (test) — bez „trke ili testa od
  100 min"; zbir nedelje trke broji trku („3 treninga + trka"); „brz rad 23 % vremena trčanja"; zaglavlje kaže koji
  sadašnji obim plan pretpostavlja („Polazim od tvojih ≈ 40 km nedeljno"); urađene nedelje se ispisuju kao urađene
  (tempa kakva su bila), ne prepisuju se novim tempom; posle dana trke jedna rečenica o oporavku; svaka promena
  prognoze u odnosu na prethodni ispis nosi rečenicu „zašto".
- R11. Upozorenja: predlog „dodaj K. dan → vrh X, dugi Y" se nudi samo ako su X i Y VEĆI od onoga što plan već ima
  (inače drugi oblik rečenice); nikad broj manji od planiranog. Trkač sa VDOT-om kome obim ograničava kvalitet
  (plan ne može da smesti kvalitet nivoa) dobija upozorenje `obim-za-nivo` sa predlogom (podatak `adequate`).

**Forma (`fitness/`) — tab F**
- R12. Prognoza ne sme da se pogoršava kad trkač radi po planu (S21: 1:39:42 → 1:40:35 posle 6 odrađenih nedelja):
  odrađen plan je dokaz. Predlog: očekivani dobitak koji „istekne" sa odrađenim nedeljama se pripisuje tekućoj
  proceni srazmerno pridržavanju (odrađeno opterećenje / planirano, ≥ 0,85 → pun iznos; < 0,6 → ništa), kao signal
  „odrađen plan" (mali k, ne skače), tako da `expectedSec` ostaje stabilan dok se plan sprovodi, a raspon se
  sužava. Svaka promena `expectedSec` > 20 s između dva poziva mora da ima `FormChange` sa rečenicom.
- R13. „Pad baze": forma opada kad hronično opterećenje padne ≥ 30 % ispod onog od pre 6 nedelja, i bez prekida od
  14 dana (vlasnik: 5 trčanja od 3. 10; model i dalje kaže 1:40:42). Oprezno, sa objašnjenjem.
- R14. Trka sa hodanjem / prvi rezultat: pouzdanost najviše srednja; korekcija rezultata (npr. negativan split) mora
  da ima rečenicu u objašnjenju („2:12:00 → procena 2:09:34 jer…"), inače se rezultat ne koriguje.

**Podaci polumaratona (`distances/hm/`) — tab D (posle taba M)**
- R15. Vrh ≤ × 1,40 baze (4 dana ≈ +30–35 %), rast ≤ 10 %/ned, lagan ≤ 65 % dugog, dugi ≤ 40 % nedelje kod 4+ dana
  (3 dana ≤ 50 %, početnik po podatku), nedelja trke: uto 40–50 min + oštrenje + kratko pred trku.
- R16. Doze: sredina nedelje u tempu trke nikad manja od prethodnog praga (prag 2 × 15 min → RP ≥ 6 km ukupno);
  skaliranje po nivou (VDOT ≥ 55: RP 12–15 km, intervali; VDOT 44–46 sa 30–40 km: prag do 25–28 min, RP 2 × 3 km,
  blok 4 → 6 km). Raznovrsnost u dugoj pripremi: usponi/intervali u razvoju (18 nedelja bez ijednog intervala nije
  prihvatljivo), ne 9–11 istih nedelja praga.
- R17. Provera forme: ne prvog dana plana — 2–3. nedelja, subota, 3 km za početnika i obim < 25 km; tekst upozorenja
  i plan navode ISTU distancu testa; pripremna trka 10 km vikendom (kao v3) gde priprema dozvoljava.
- R18. 3 dana: srednji dan ≤ 70 % dugog, blok u dugom do 7+ km; p11: rasterećenje ne sme imati duži dugi.
- R19. Napomene: gel na dugom i na trci isto pravilo; lestvica intervala sa ≥ 15 min rada ili se ne nudi.
- R20. Otisci, 12 + 2 ispisa, 24 scenarija; u izveštaju po profilu: vrh/polazno, najveći lagan dan/dugi, udeo
  dugog, najveći skok nedelje, min i max treninga nedeljno naspram traženih dana — to su brojevi koje organizator
  gleda pre slanja sudijama.

## Kapija kruga 2 (organizator proverava pre sudija)
Za svih 12 profila i oba plana vlasnika, mašinski (test u `distances/hm/`): vrh ≤ 1,40 × polazno; skok nedelje
≤ 10 % (+ zaokruživanje) van rasterećenja; lagan dan ≤ 65 % dugog; dugi ≤ 40 % nedelje (4+ dana); broj treninga =
traženi dani u svakoj nedelji gradnje; nedelja trke: nijedan lagan dan > 50 min ni duži od istog dana prethodne
nedelje; nedelja 1 ≥ 95 % sadašnjeg obima (km); scenario „ništa" → `expectedSec` se ne pogoršava.

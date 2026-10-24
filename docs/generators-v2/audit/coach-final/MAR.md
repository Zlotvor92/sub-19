# Trenerska ocena početnog plana — MAR v2

Kod: vrh grane `claude/generator-isolation-5k-10k-hm-marathon` (886b6c4), `marathon-v2@marathon-v2.7.0`. Samo početni plan
iz profila; bez adaptacija, predaje i testova. Skripta: `MAR-gen.ts` (iz `web/`: `node ../docs/generators-v2/audit/coach-final/MAR-gen.ts [--days]`).

18 profila: 3/4/5/6 dana; 30–110 km; VDOT 33–65; dva plana po osećaju; dva početnika; 12 i 24 nedelje; cilj +4 VDOT;
skorašnji najduži trk: bez unosa, 8, 10, 12, 15, 18, 20, 25, 30, 32 km. Svih 18 je generisano, nijedan nije odbijen.

## 1. Ocena: 6/10

Kostur je dobar: faze, rasterećenja, raspored, tempo po Danielsu, taper i trkačka nedelja. Plan ipak ne vodi maratonca do
maratonskog dugog trka. Uz to, kratak skorašnji najduži trk prepolovi nedeljni obim celog plana.

## 2. Problemi

| # | Problem | Primer (profil, nedelja, brojevi) | Profila | Bitnost | Činjenica / mišljenje |
|---|---|---|---|---|---|
| 1 | Kratak skorašnji najduži trk obara nedeljni obim, a ne samo dugi trk. Obim se ne vraća. | `4d-65km-v58-16w-rl8`: trenutno 65 km, ned 1 = 35,1 km (−46 %), lagan 7,2 km, dugi 9 km; vrh plana 59,4 km < trenutnih 65. `rl12`: ned 1 = 39,9 km umesto 50 (−20 %). `3d-45km-rl18`: 42,2 umesto 45. Upozorenje uz rl8 navodi pogrešan uzrok („ograničava ga udeo dugog… veći obim daje duži dugi"), a stvarni uzrok je plafon skoka od 8 km. | 3/18 (2 jako) | **blokira** | činjenica (brojevi); da je to pogrešno, mišljenje |
| 2 | Najduži dugi trk je kratak za maraton. Plafon je ≤ 150 min laganim tempom (143 min u planu), a u 16/18 profila najduži dugi trk je < 28 km. | VDOT 45, 4 dana, 75 km vrh: 24,4 km. VDOT 33: 19,2 km. VDOT 35, 3 dana: 20,0 km. VDOT 40, 3 dana: 22,2 km. Samo 5d-80 (28,7) i 6d-110 (32,8) prilaze orijentiru 30–35 km / ~3 h. | 16/18 | **bitno** | Plafon od 150 min je Danielsovo pravilo (činjenica). Da je za maraton prekratak, mišljenje: Pfitzinger ide do ~32 km, Hansons do ~26 km. |
| 3 | Dugi trk stoji na istoj dužini 5–15 nedelja. Nema progresije ni maratonskog tempa (MP) u dugom trku. | `5d-80km`: 28,7 km od ned 2 do ned 17. `6d-110km`: 32,8 km od ned 1 do 15. `4d-50km`: 24,4 km od ned 6 do 15 (10 nedelja). `6d-60km-24w`: 25,7 km od ned 9 do 21. Svi dugi trkovi su „lagano". | ~14/18 | **bitno** | činjenica (brojevi); da je to slabost, mišljenje |
| 4 | Interne oznake i besmislene rečenice u porukama korisniku. | Svaka napomena ima „(M6)", „(M13a)", „(M7a)", „pouka 32". „Vrh 75,0 km umesto do 75,0 km (M6)" (isti broj). „Cilj po pravilu 65,0 km nije izvodljiv u konstrukciji nedelje". Taper: „minimum tapera ispred plafona (M7a)". | 18/18 (oznake); 5/18 („X umesto do X") | **bitno** | činjenica |
| 5 | Početnik dobija najduži dugi trk od samo 18 km. Ograničava ga udeo ≤ 40/35 % nedelje, a ne trajanje. | `pocetnik-4d-30km-20w`: vrh 45 km, dugi 18,0 km / 126 min. `pocetnik-5d-35km`: 18,3 km. Postoji upozorenje „cilj je završiti". | 2/2 | **bitno** | mišljenje (novajlijski planovi tipa Higdon idu do ~32 km) |
| 6 | Udeo dugog trka u nedelji je 40–50 % pri 3–4 dana. | `3d-30km`: dugi = 50 % nedelje svih 15 nedelja izgradnje; 4 dana: 40 %. | 9/18 | sitno | Daniels: dugi ≤ 25–30 % nedelje (činjenica). Uz 3 dana to je teško izbeći (mišljenje). |
| 7 | Pri 4 dana nedelja specifične faze ima 3 teška dana od 4 (MP + T + dugi). Lagano je tada 72–75 %. | `4d-35km-v33` ned 11/13: E 72 %, MP 10 km + T 4,8 km + dugi. `osecaj-4d` ned 15: E 72 %. | ~6/18 | sitno | mišljenje (orijentir 75–80 %) |
| 8 | U taperu je lagan trk jednak „dugom". Pri malom obimu doza MP u N−1 se ne smanjuje. | `4d-50km` ned 16: dugi 15,8 = lagan 15,8; ned 17: 10,9 = 10,9. `3d-30km` ned 16 i 17: MP 2 × 3000 obe nedelje. | ~8/18 | sitno | činjenica |

## 3. Šta je dobro

- Obim: polazi od trenutnog obima, kad skorašnji najduži trk nije kratak. Rast je 5–6 % nedeljno. Rasterećenje je svake
  4. nedelje, −20 %, sa jednim kvalitetom. Vrh je ~1,5 × start, uz plafon po broju dana, i realan je.
- Tempo je u skladu sa Danielsom: E 62–70 % VDOT-a. T je između tempa na 10K i HM (VDOT 45: T 4:38, 10K 4:31, HM 4:45).
  I je oko tempa na 5K/3K, R je brži od I. MP je konzervativno korigovan pri malom obimu (VDOT 45 / 50 km → 3:32 umesto
  3:28) i to se prikazuje. Planovi po osećaju imaju test 5 km i RPE.
- Doze kvaliteta su u Danielsovim granicama u svim profilima: I ≤ 7 %, T ≤ 10 %, R ≤ 5 %. Faze idu logično: R+T u bazi,
  I+T u razvoju, MP+T u specifičnoj fazi, MP u taperu. Doza raste postepeno. WU/CD rastu sa nivoom (15/10 → 25/15 min).
- Raspored je dobar: kvalitet je utorkom i četvrtkom, dugi nedeljom, lagani su između. Nema uzastopnih teških dana ni na
  granici nedelje. U trkačkoj nedelji je oštrenje u četvrtak, a dan pred trku 20 min lagano + 4 × 20 s. Taper ima 2
  nedelje + trkačku nedelju (0,8 → 0,6 vrha → ~25 %), uz zadržan MP.
- Početnik: dve nedelje bez kvaliteta, rast 5 %, samo T i MP, bez I i R.
- Napomena nedelje 1 bez unetog najdužeg trka traži da se on unese. Nerealan cilj je jasno označen (+4 VDOT za 18
  nedelja → „nerealan").

## 4. Šta bi trener promenio

- Skorašnji najduži trk treba da ograniči samo prvih nekoliko dugih trkova. Nedeljni obim ostaje na trenutnom nivou, a
  razliku nose lagani dani. Kratak skorašnji najduži trk ne sme da spusti vrh plana ispod trenutnog obima. Upozorenje
  mora da navede pravi uzrok.
- Dugi trk: dozvoliti ~32 km ili ~3 h, šta god dođe prvo, bar u 2–3 nedelje specifične faze. Za sporije trkače dozvoliti
  vreme preko 150 min (npr. do 3 h) ili dodati produženi lagani trk srednje dužine. Progresija dugog treba da ide talasom
  (raste, pa rasterećenje), a ne da stoji ravno 10 nedelja. U specifičnoj fazi dodati dugi trk sa MP delom (npr.
  poslednjih 8–16 km MP).
- Početniku podići najduži dugi trk na ~26–30 km, makar uz veći udeo dugog u nedelji ili kroz hodanje u dugom.
- Poruke: izbaciti oznake M…, „pouka" i „konstrukcija nedelje". Ne pisati „X umesto do X". Napisati ljudski zašto je
  nešto ograničeno.
- Pri 4 dana u specifičnoj fazi jedan od dva kvaliteta svesti na laganiji (npr. kratak T ili strides), da lagano ostane
  ≥ 75 %. U taperu „dugi" treba da bude bar malo duži od laganog, ili da se ne zove dugi.

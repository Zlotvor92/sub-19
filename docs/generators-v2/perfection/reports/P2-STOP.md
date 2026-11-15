# P2 — STOP: S1 kako je zadat spušta ukupni MP; nedelja B ne staje u > 10 % grupe F 5/6 d

9. 11. 2026, 22:30 (Europe/Belgrade). Polazni SHA `38fd091` (marathon-v2.8.0). Kod NIJE ugrađen u `web/src` ni
pushovan: stanje rada je u `docs/generators-v2/perfection/P2/s1s2-wip.patch` (S1 + S2 konstruktor i validator,
`specific.ts`; bez S3 adaptacije osim zabrane bloka u nedelji sa ograničenjima, bez S4 testova, bez izmene testova),
S2 sam u `P2/s2.patch`, opcija O3 u `P2/s1s2-o3.patch`. Testovi nisu pokretani (kod nije ostao u stablu).

Dva uslova iz zadatka za STOP su ispunjena:
1. **ukupni MP medijana manja nego pre**: R 52 → 50 km, sve porodice 50,5 → 48 km (grupe 4/5/6 d: 49,5 → 47,5 /
   52,25 → 48 / 62 → 54 km);
2. **nedelja B ne staje u > 10 % planova grupe 4–6 dana**: F 5 d 1/8 (13 %), F 6 d 2/8 (25 %) (R 4/5/6 d: 0 / 6 / 8 %).

Nova odbijanja: 0 (sve opcije). Sudara sa poukama 2, 9, 28, 32 i „doza ne opada" (O1): 0 grešaka validatora.

## Komande (iz `web/`, svaka ≈ 1 s; nijedna nije test)

- **K0** `git apply ../docs/generators-v2/perfection/P2/s1s2-wip.patch` (za K2–K5; za K1 samo `P2/s2.patch`; za K6
  `P2/s1s2-o3.patch` umesto njega). Bez `P2_EXP` patch se ponaša tačno kako je zadato (O1).
- **K1** `node ../docs/generators-v2/perfection/P2/measure.ts pre` na `38fd091` (mreža P0, 192 ulaza); isto sa
  `s2.patch` → `measure.ts s2`; `node ../docs/generators-v2/perfection/P2/compare.ts pre s2`.
- **K2** `P2_EXP=O1 node ../docs/generators-v2/perfection/P2/measure.ts exp-O1` i `compare.ts pre exp-O1`;
  `node ../docs/generators-v2/perfection/P2/breakdown.ts pre exp-O1` (MP po izvoru, nedelje B koje nisu B).
- **K3** isto sa `P2_EXP=O2`, **K4** `P2_EXP=O5`, **K5** `P2_EXP=D3` (3 dana, samo merenje), **K6** `P2_EXP=O3`.
  `P2_EXP` (samo merenje) pravila ROLES, B_WEEK_MP, LONG_BLOCK, MAIN_DOSE_DECREASE, HARD_ADJACENT (D3 i PHASE_QUALITY,
  O3 i DOSE_JUMP/SLOT_REPEAT/DOSE_STALL) prijavljuje kao upozorenja, da bi se izmerio plan opcije koju validator O1 ne
  poznaje.
- **K7** `[P2_EXP=…] node ../docs/generators-v2/perfection/P2/profile.ts <oznaka>` → `P2/profile-a-MAR-<oznaka>.txt`.
- Δ ukupnog MP po planu i grupi: jednolinijski `node -e` nad `raw-MAR-*.json` (polje `m.m3.totalKm`), isti kao u
  `breakdown.ts`; sirovi JSON nisu u gitu (`P2/.gitignore`), ponavljaju se komandama K1–K6.

## Šta je ugrađeno u patchu (da bi se izmerilo)

- **S2**: `lengths.longMaxSec` 9000 → 10800 (redovan plan), `beginner.longMaxSec` 9000 (bez promene; vrh dugog
  početnika F2 ostaje 10800); `planRule` nosi `longMaxSec`; poruka CAPACITY_LIMITED i provera VOLUME_START čitaju
  plafon pravila (pre: fiksno 150 min).
- **S1** (`specific.ts`, jedno mesto): raspored tipova iz okvira (`specificTypes`: ne-rasteretne specifične nedelje,
  poslednja B, unazad smena; samo redovan 4–6 d); `bAllowed` (bez testa, ograničenja koraka, cilj po pravilu — ne
  povratak `downOnly`); nedelja B: Q1 lagan (stanje MP slota se ne menja), Q2 T po progresiji (drugi član pouke 32 uz
  lagan dan više), blok `chooseBlockKm`: lestvica 8/10/12/14/16 km, blok ≥ prethodnog bloka, najmanji nivo ≥ poslednje
  MP doze treninga kad je iznad sledećeg nivoa i staje, inače najviši ≤ sledećeg nivoa; ≤ 50 % dugog, trajanje (E deo
  sporim E + blok MP) ≤ granica dugog; dan kvaliteta ≤ lagan dugi ostaje ≤ dugi sa blokom. Ne staje → nedelja A uz
  napomenu. `QualityState.blockM`, `Picks.blockM`, `writtenPicks` čita blok iz dugog.
- Validator: ROLES (Q1 nedelje B lagan), LONG_BLOCK (samo nedelja B po rasporedu, oblik, nivo, granice, nivo po pravilu
  iz iste funkcije), B_WEEK_MP, glavna doza = T + I + MP trening + blok sa poređenjem unutar tipa (O1 iz P1), drugi član
  pouke 32 za Q2 nedelje B, LIMITS (dugi sa blokom je kvalitet). Prikaz (S4): naslov „Dugi 24,0 km: 16,0 km lagano +
  8,0 km u maratonskom tempu", segmenti E + MP (app/structure ih prenosi bez izmene — nije provereno testom).

## Sudar 1 — ukupni MP pada (K2, K4, K6)

Uzrok je strukturni, ne greška izvođenja: lestvica MP treninga napreduje samo u nedeljama A (polovina specifičnih
nedelja), a blok nedelje B po zadatom pravilu prati poslednju MP dozu treninga (jedan nivo po nedelji B). Primer
R-d4-50km-18w-v45, specifične ne-rasteretne nedelje 11, 13, 14, 15: pre MP 8 · 10 · 12 · 14 km (44); S1 MP 8 · blok 8
· MP 10 · blok 10 (36); taper 8 + 5,5 → 6 + 6 (≈ 60 % / 50 % poslednje MP doze treninga, 14 → 10 km). Ukupno 61,5 → 52.

MP po izvoru, medijana po planu, R (K2 `breakdown.ts`): pre trening 36 · blok 0 · taper 12 · oštrenje 4 = 52; S1 (O1)
trening 18 · blok 18 · taper 12 · oštrenje 4 = 50.

| opcija | ukupno MP R [km] | 4 d / 5 d / 6 d (R+F) [km] | planova 4–6 d sa padom MP | najveći MP trening / blok R | nedelja > 25 % km bržih od E |
|---|---|---|---|---|---|
| pre (marathon-v2.8.0) | 52 [34–80] | 49,5 / 52,25 / 62 | — | 12 / — | 97 |
| samo S2 | 52 [34–82] | 49,5 / 52,25 / 62 | 0 | 12 / — | 104 |
| O1 kako je zadato | 50 [34,9–80] | 47,5 / 48 / 54 | 94 / 132 | 10 / 10 | 22 |
| O5 blok = sledeći nivo iznad max(poslednji blok, poslednji MP trening) | 52 [34,9–82] | 47,5 / 49 / 55,75 | 88 / 132 | 10 / 10 | 26 |
| O3 = O5 + MP trening A nastavlja od max(poslednji MP trening, poslednji blok) | 52 [34,9–82] | 49,5 / 50 / 57 | 65 / 132 | 12 / 10 | 66 |
| O2 nedelja B zadržava MP trening, T dan lagan (kao odluka P1 za HM) | 69,3 [36–112] | 67,5 / 77,75 / 82 | 0 / 132 | 12 / 10 | 177 |

R medijana 52 kod O5/O3 drže 3-dnevni planovi (bez smene, samo S2); u grupama 4–6 d pad ostaje. Nedelje > 25 % (K2):
O1 npr. R-d4-35km-18w-* ned 15 28,2 %, R-d5-40km-12w-* ned 6 25,4 % — sve na dnu obima (35–40 km); O2: nedelja B ima
MP trening + blok (profil (a) ned 13: MP 12 km + blok 10 km u 60 km = 37 % nedelje u MP). Kolona broji sve nedelje
osim trkačke, sve porodice (`compare.ts pre <oznaka>`, red „nedelja … > 25 %"); pre i samo S2 to su pretežno nedelje
specifične faze sa MP + T (MP 20 % + T 10 %).

Ostalo O1 (R, K2): dugih sa blokom 2 [0–2]; najveći blok 10 [0–16] km; % km bržih od E nedelja A 20,5 [13,3–22,6],
nedelja B 20,6 [15,5–26,3]; orijentir „blok ≥ 14 km u planovima sa vrhom ≥ 60 km/ned" 21/109 (O3 45/109, O2 29/109).
Niz tipova (sve porodice): ABAB 78, BAB 46, AAAA 47 i AAA 16 (3 d i početnik — bez smene), ABAA 3, BAA 2.
Promenjenih planova O1: 158/192 (3 d 26/44 samo zbog S2; početnik 0/16).

## Sudar 2 — nedelja B ne staje (K2)

| grupa | planova sa B koja nije B | nedelja |
|---|---|---|
| R 4 d / F 4 d | 0/36 / 0/8 | 0 |
| R 5 d / F 5 d | 2/36 (6 %) / 1/8 (13 %) | 2 / 1 |
| R 6 d / F 6 d | 3/36 (8 %) / 2/8 (25 %) | 5 / 3 |

Svi su na vrhu obima sa sporim trkačem (85 km 5 d, 110 km 6 d; VDOT 35 / lagan 450 s/km). Uzrok (K0 + ispis
`DBG`, `P2_EXP=DBG`): dužine nisu izvodljive pri cilju nedelje — bez dana MP treninga (≈ 22 km) lagani ≤ 0,8 × dugi
(T1) ne nose ostatak. Primer R-d6-110km-18w-v35 ned 13: cilj 118,5 km, T 15,2 km + dugi 24,1 km (180 min) + 4 lagana ≤
19,2 km = 116,1 km < cilj; blok bi stao (8–12 km). Isti mehanizam kao P1 Sudar 2 (P-a ugrađeno: nedelja je A uz
napomenu, sledeća po rasporedu). O2 nema ovih nedelja (0 u svim grupama).

## S2 sam (K1; R, n 144; medijana [min–max])

| metrika | pre | samo S2 |
|---|---|---|
| najduži dugi [km] | 24,2 [19,4–32,8] | 26,2 [19,4–38,4] |
| najduži dugi [min, srednjim E] | 143 [84–143] | 153 [84–172] |
| najduži dugi [% trke] | 57,4 [46–77,7] | 62,1 [46–91] |
| najduži < 26 km ograničen trajanjem (napomena N11), sve porodice | 82 | 41 (R 58 → 24, F 16 → 9, B 8 → 8) |
| MARATHON_LONG_SHORT (upozorenje) | 0 | 0 |
| promenjenih planova | — | 113/192 (početnik 0/16) |

Najduži dugi km / min / % trke po VDOT (R, isto za 3–6 d osim gde piše): v35 20 / 143 / 47,4 → 24,1 / 172 / 57,1;
v45 24,4 / 143 / 57,8 → 29,3 / 171 / 69,4; v55 28,7 / 143 / 68 → 30 / 149 / 71,1 (5 d 32,5 / 162 / 77; 6 d 34,5 / 172 /
81,8); v65 30 / 131 / 71,1 → bez promene (5 d 32,5; 6 d 32,8 → 35,2 / 153 / 83,4). Orijentir „najduži dugi ≥ 28 km za
VDOT ≥ 45": 72/108. Najduži dugi mreže 38,4 km (6 d, vrh obima) — navodim, ne ispravljam.

## 3 dana — samo merenje (K5, gruba ugradnja: Q1 nedelje B = T cruise sledeći nivo posle poslednje T doze u plafonu
T 10 %, blok 6/8/10/12 km)

R 3 d: 7/36 planova odbijeno (svi 12 ned: 30 km — SLOT_REPEAT/IDENTICAL_WEEKS, 50 km — DOSE_DECREASE; to su odbijanja
grube ugradnje T lanca, ne mera pravila); nedelja B staje 47/58 (81 %); ukupni MP (planovi koji prolaze) 44 vs 50 samo
S2 za iste planove; najveći blok 8 km; % km bržih od E nedelja B 21,3. F 3 d: 3/8 odbijeno, B staje 6/10, MP 44 vs 46.

## Profil (a) (10 km 46:00, 40 km, 4 d, 16 ned; K7; pun ispis `P2/profile-a-MAR-<oznaka>.txt`)

| | ned 9 (A) | ned 10 | ned 11 | ned 13 | taper | ukupno MP | najduži dugi |
|---|---|---|---|---|---|---|---|
| pre | MP 6 | MP 8 | MP 10 | MP 12 | 6 + 6 | 52 | 24,0 km / 143 min |
| samo S2 | isto | isto | isto | isto | 6 + 6 | 52 | 24,0 (udeo 40 %) |
| O1 / O5 | MP 6 | blok 8 (dugi 24: 16 + 8) | MP 8 | blok 10 (14 + 10) | 6 + 6 | 48 | 24,0 |
| O3 | MP 6 | blok 8 | MP 10 | blok 12 (12 + 12) | 6 + 6 | 52 | 24,0 |
| O2 | MP 6 | MP 8 + blok 8 | MP 10 | MP 12 + blok 10 | 6 + 6 | 70 | 24,0 |

(Tabela profila: MP km po nedelji iz ispisa; oštrenje 4 km u svima.) T u O1 ostaje 4800 m (plafon T 10 %) kroz celu
specifičnu fazu.

## Nije izmereno (stao pre toga)

S3 u celini (A5 umor ne broji dugi sa blokom — nije ugrađeno; bol/ograničenja — samo „B tek bez ograničenja"), S4 test,
mreže adaptacije, sabotaže, testovi, `changed-<sha>.json`.

## Mišljenje (odvojeno od merenja)

1. Zadato pravilo „ukupni MP ne sme da padne zbog smene" se ne može ispuniti dok su MP trening i blok na istoj
   lestvici a nedelja B nema MP trening: svaka nedelja B je propuštena stepenica MP treninga, a taper (≈ 60/50 %
   poslednje MP doze treninga) pada sa njom. Isto što je P1 pokazao za HM.
2. O2 (kao odluka P1 za HM: B zadržava MP trening, T dan lagan) jedina vraća i povećava MP i uklanja „B ne staje", ali
   nedelja B tada ima medijanu 27,7 % [19,7–34,3] km bržih od E (177 nedelja > 25 %, pre 97); za maraton po mom
   mišljenju preveliko. O1 smanjuje takve nedelje 104 → 22 (dan MP + T zamenjen T + blokom).
3. O3 je najbliža zadatom obliku (B bez MP treninga) uz stalnu progresiju MP stimulusa; drži medijanu 4 d, ali 5–6 d
   i dalje gube 2–5 km MP. Ako je cilj „ne pada", treba dodatna poluga (npr. taper MP iz max(MP trening, blok) ili
   drugačija lestvica bloka) — nije mereno.
4. Nedelje B koje ne staju (F 5/6 d) su na vrhu obima sa sporim trkačem; po mom mišljenju P-a (nedelja A) je
   prihvatljiva — n = 8 po grupi F, 1–2 plana.

## Otvorena pitanja organizatoru

1. Oblik nedelje B: O1 (kako je zadato) / O5 / O3 / O2 / drugo (npr. O3 + taper iz max(MP trening, blok))?
2. Ako ostaje B bez MP treninga: da li je dozvoljen pad ukupnog MP (koliko) ili tražite polugu da ne padne?
3. Nedelje B koje ne staju na vrhu obima (F 5 d 13 %, F 6 d 25 %, R ≤ 8 %): prihvatiti P-a (nedelja A)?
4. S2: najduži dugi do 38,4 km (6 d, VDOT 55–65, vrh obima) i 172 min srednjim E — prihvatljivo ili gornja granica km?
5. 3 dana: posle merenja (B staje 81 %, MP 44 vs 50) ostaje bez nedelje B?

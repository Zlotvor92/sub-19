# P1 — STOP: sudar S1 × H12 i nedelje B koje ne staju

9. 11. 2026, 22:00 (Europe/Belgrade). Polazni SHA `998c668` (hm-v2.8.0). Kod NIJE ugrađen u `web/src` ni pushovan:
stanje rada je u `docs/generators-v2/perfection/P1/s1s2-wip.patch` (S1 + S2 konstruktor i validator, bez S3/S4 i bez
izmene testova), S2 sam u `P1/s2.patch`. Testovi nisu pokretani (kod nije ostao u stablu).

Dva uslova iz zadatka za STOP su ispunjena:
1. **sudar S1 sa H12** („glavna doza ne opada", MAIN_DOSE_DECREASE): 102 / 192 plana mreže P0 odbijena;
2. **nedelja tipa B ne može da se sastavi u > 5 % planova grupe**: R 3 d 39 %, F 3 d 63 %, R 4 d 11 %, F 4–6 d 25 %,
   R 5–6 d 8 %.

## Komande (iz `web/`, svaka ≈ 1–2 s; nijedna nije test)

- **K0** `git apply ../docs/generators-v2/perfection/P1/s1s2-wip.patch` (za K3–K6; za K2 samo `P1/s2.patch`).
- **K1** `node ../docs/generators-v2/perfection/P1/measure.ts pre` na `998c668` (mreža P0, 192 ulaza) → `P1/raw-HM-pre.json`.
- **K2** isto sa `P1/s2.patch` → `measure.ts s2`; poređenje `node ../docs/generators-v2/perfection/P1/compare.ts pre s2`.
- **K3** sa celim patchom: `node ../docs/generators-v2/perfection/P1/measure.ts wip2` → 102 odbijena, sva `MAIN_DOSE_DECREASE`.
- **K4** `P1_EXP_MAIN=1 node ../docs/generators-v2/perfection/P1/measure.ts exp` (pravilo MAIN_DOSE_DECREASE privremeno
  upozorenje, samo za merenje) i `compare.ts pre exp`.
- **K5** `P1_EXP_MAIN=1 node ../docs/generators-v2/perfection/P1/stop-main.ts` — opcije O0–O3 i „B ne staje".
- **K6** `P1_DEBUG_GAP=1 P1_EXP_MAIN=1 node ../docs/generators-v2/perfection/P1/gap.ts` — potrebno sniženje cilja za nedelju B (week.ts, oznaka
  `P1GAP`; brojanje po grupi kao u K5).

## Šta je ugrađeno u patchu (da bi se izmerilo)

- S2: `caps.RP` 0,15 → 0,20; lestvica RP + `3 × 5000 m`. **Premisa zadatka nije tačna:** nivo `2 × 5000 m` već postoji
  (pre `3 × 4000 m`, 10 km < 12 km), pa je dodat samo `3 × 5000 m`; lestvica: … 2 × 5000 · 3 × 4000 · 3 × 5000.
- S1 (`specific.ts`, jedno mesto): tip nedelje iz upisanih nedelja (`specificTypeAfter`: suprotan poslednjoj
  ne-rasteretnoj specifičnoj, prva A); nedelja B samo bez ograničenja koraka i testa, cilj po pravilu; Q1 B = I
  održavanja (doza = poslednja I doza, korak `maintain`, druga struktura naizmenično) ili T po H12 (3 d, početnik);
  Q2 = T cruise po progresiji; blok `chooseBlockKm`: sledeći nivo 4/6/8 (početnik 2/3/4), najviši koji staje (≤ 40 %
  dugog, trajanje ≤ 150/135 min, svaki dan kvaliteta koji je ≤ lagan dugi ostaje ≤ dugi sa blokom); ne staje → nedelja
  A. Stanje doze: nedelja B ne menja Q1 (RP); `weekPicksOf` (konstruktor i validator) čita blok iz dugog.
- Validator: `LONG_BLOCK`, `B_WEEK_RP`, `B_WEEK_ORDER`, `B_WEEK_I`, RPE bloka (po osećaju), Q1 B u PHASE_QUALITY,
  lanac doze i početni nivo bez Q1 nedelje B, LIMITS (dugi sa blokom = kvalitet), `mainDoseM` sa blokom (specific.ts).

Posle K3 jedino preostalo pravilo koje odbija je MAIN_DOSE_DECREASE (sva ostala greška-pravila 0).

## Sudar 1 — H12 „glavna doza ne opada" (K5)

Glavna doza = T + I + RP treninga + blok (kako zadaje S1). Nedelja B i nedelja A imaju različit sastav (A: RP + T;
B: I održavanja + T + blok), pa smena A/B spušta glavnu dozu u 106 nedelja: **B → A 67, A → B 39**; pad medijana
1000 m, najviše 3200 m. Primer R-d3-25km-10w-v35: 7000 m → 5000 m.

| opcija (definicija poređenja) | odbijenih planova (R 3/4/5/6 d · F 3/4/5/6 d · B 4/5 d) |
|---|---|
| O0 kako je zadato: svaka ne-rasteretna nedelja prema prethodnoj, doza sa blokom | 23/17/21/17 od 36 · 3/4/3/2 od 8 · 4/8 od 8 = **102/192** |
| O1 poređenje unutar tipa: A sa poslednjom A (ili nedeljom pre specifične faze), B sa poslednjom B | **0** |
| O2 nedelja B se ne poredi i nije osnova poređenja (kao nedelja testa), A sa poslednjom A | **0** |
| O3 glavna doza bez bloka (kao hm-v2.8.0), svaka nedelja prema prethodnoj | 23/27/32/33 od 36 · 3/5/6/6 od 8 · 8/6 od 8 = 149 |

O1 i O2 ne menjaju planove (samo definiciju provere); planovi su tada oni iz K4 (tabela dole). O1 zadržava zahtev da
nedelja B ne opada prema prethodnoj B (blok raste, T raste, I stoji); O2 ga nema. Treća mogućnost — konstruktor bira B
samo kad glavna doza ne pada — nije merena: pad B → A (67 od 106) nastaje u nedelji A, koju konstruktor ne bira, pa
bi to tražilo i ograničenje RP nedelje A (novo pravilo).

## Sudar 2 — nedelja B ne staje (K5, K6)

Očekivan tip B, nedelja ispala A (bez ograničenja, plan generatora). Uzrok u svim slučajevima: dužine (`buildLengths`)
nisu izvodljive pri cilju nedelje — Q1 nedelje B (I održavanja / T u plafonu T 10 %) ima manje km od RP treninga
nedelje A, dugi je već na granici (udeo / 150 min / pouka 28), a lagan ne sme preko 0,8 × dugi (T1) → ostatak nema
gde. Primer R-d3-35km-20w-v45 ned 15: cilj 49 km, dugi 22,0 km (45 %), lagan ≤ 17,6 km; RP 6000 m (10,5 km dan) zamenjen
T 4800 m (≈ 9,4 km dan) → lagan bi bio > 17,6 km.

| grupa | planova sa B koja ne staje | nedelja | potrebno sniženje cilja da B stane [km] med (max) |
|---|---|---|---|
| R 3 d | 14/36 (39 %) | 30 | 2,2 (6,7) |
| F 3 d | 5/8 (63 %) | 13 | 1,8 (5,6) |
| R 4 d | 4/36 (11 %) | 9 | 2,7 (6,4) |
| F 4 d | 2/8 (25 %) | 5 | 2,8 (6,4) |
| R 5 d | 3/36 (8 %) | 7 | 4,1 (7,3) |
| F 5 d | 2/8 (25 %) | 5 | 6,2 (8,5) |
| R 6 d | 3/36 (8 %) | 7 | 3,1 (4,1) |
| F 6 d | 2/8 (25 %) | 5 | 5,1 (7,7) |
| B 4/5 d | 0/16 | 0 | — |

(1 nedelja bez ijednog izvodljivog cilja za B.) Opcije: **P-a** prihvatiti da je takva nedelja A (kako je u patchu;
sledeća je opet B) — brojke gore; **P-b** nedelja B sme niži izvodljiv cilj (WEEK_FITTED / CAPACITY_LIMITED) — cena
sniženja u koloni desno; **P-c** u nedelji B lagan sme preko 0,8 × dugi (izuzetak T1) — nije mereno (menja vlasnika
dužina).

## Izmereno pre/posle (K1, K2, K4; planovi sa rezultatom R, n 144; medijana [min–max])

| metrika | hm-v2.8.0 | samo S2 | S1 + S2 (O1/O2, P-a) |
|---|---|---|---|
| najveći RP trening [km] | 8 [5–12] | 9 [6–15] | 8 [5–15] |
| ukupno RP u planu (trening + blok) [km] | 30 [14–53] | 37 [23–69] | 30 [21–65] |
| dugih sa blokom (sa delom bržim od E) | 0 [0–0] | 0 [0–0] | 1 [0–2] |
| najveći blok [km] | — | — | 4 [0–6] |
| % km bržih od E, specifična faza | 16,8 [7,7–21,9] | 19,4 [10–23,3] | 18,5 [10–22,5] |
| najduži dan nedelje [km] | 20,5 [14,5–24] | 21,2 [15–25,6] | 21,2 [15,1–25,1] |
| uzrok vrha RP: plafon / ≤ 1 nivo / kraj lestvice / pouka 32 | 76 / 57 / 10 / 1 | 37 / 68 / 35 / 4 | 3 / 125 / 14 / 2 |
| nedelja specifične faze sa > 25 % km bržih od E (sve porodice, od 776) | 0 | 84 | 36 |

Ostalo (K4, sve porodice): 0 novih odbijanja uz O1/O2; promenjeno 189/192 planova (S2 sam 177/192). Početnik (B, n 16):
najveći RP 5,5 → 5 km, ukupno 21 → 19 km, blok 2,5 [2–3] km. Dugih sa blokom po pripremi (R+F+B): 10 ned 1 [0–1]; 15 ned
1 [0–1]; 20 ned 2 [0–2] (3 d 1,5). Niz tipova specifičnih ne-rasteretnih nedelja: ABA 99, ABAB 58, AAA 20, AAAA 13,
AAB 1, ABAA 1. Orijentiri organizatora: medijana ukupnog RP ≥ 45 km — **30**; najveći RP trening ≥ 10 km u planovima
≥ 50 km/ned — 45/60 (samo S2: 58/60); ≥ 2 duga sa blokom u pripremi ≥ 12 ned — 40/96.

Nedelje > 25 % (S1 + S2): npr. R-d4-30km-20w-v45 ned 5 specifične 31 % (30 km/ned, RP + T ≈ 40 % km, dugi lagan —
nedelja A), R-d3-25km-20w-* ned 5 26,3 %, R-d4-30km-15w-* ned 2 26,2 %. Sve na dnu obima (25–30 km); uzrok S2 (veći RP
pri malom cilju), ne blok — samo S2 daje 84 takve nedelje. Nisu ispravljane.

Profil (a) (10 km 46:00, 40 km, 4 d, 16 ned; pun ispis `P1/profile-a-HM-exp.txt`; pre `P0/profile-a-HM.txt`):
specifična faza A (RP 6000 + T 4800) · B (I 5 × 800 održavanja + T 2 × 2400 + dugi 22,4 km: 18,4 + 4,0 km RP) ·
rasterećenje · A (RP 2 × 4000) · B (I 4 × 1000 + T 2 × 2400 + dugi 22,4: 16,4 + 6,0 km RP). Najveći RP trening 8 km (pre
8), ukupno RP 32 km = 6 + 8 + blokovi 4 + 6 + taper 4 + oštrenje 4 (pre 35 = 5 + 6 + 8 + 8 + 4 + 4).

## Nije izmereno (stao pre toga)

S3 (adaptacija: A4 dugi lagan u nedelji bola — u patchu samo preko „bez ograničenja koraka"; A5 umor ne broji dugi sa
blokom — nije ugrađeno), S4 (prikaz: tekst naslova i segmenti postoje u treningu; `app/structure.ts` ih prenosi kao
lagan deo + rad RP, nije provereno testom), mrežne invarijante (`gridInvariants.ts` još poredi Q1 kroz specifičnu fazu
i glavnu dozu bez bloka), sabotaže, mreže adaptacije, testovi.

## Mišljenje (odvojeno od merenja)

1. Sa 3–5 nedelja specifične faze i smenom A/B lestvica RP napreduje samo u nedeljama A (2–3 nedelje), pa S1 u ovom
   obliku vraća ukupni RP na nivo hm-v2.8.0 (30 km) i poništava dobitak S2 (37 km). Blok (4–6 km) ne nadoknađuje
   izgubljen RP trening. Orijentir ≥ 45 km ne izgleda dostižan bez duže specifične faze ili RP stimulusa i u nedelji B.
2. Za H12 bih predložio O1 (poređenje unutar tipa): čuva „ne opada" za oba niza i ne obara nijedan plan; O2 je slabiji.
3. Za nedelje B koje ne staju P-a je najmanje invazivna (bez novog broja, bez promene cilja); P-b menja obim (pouka 9 /
   H6) zbog tipa nedelje.

## Otvorena pitanja organizatoru

1. Definicija „glavna doza ne opada" uz smenu A/B: O0 / O1 / O2 / O3 (ili drugo)?
2. Nedelja B koja ne staje (39–63 % planova 3 dana): P-a / P-b / P-c?
3. S obzirom na tačku 1 mišljenja — da li S1 ostaje u ovom obliku (B bez RP treninga) ili se menja odnos A/B?
4. Lestvica RP: dodati samo 3 × 5000 m (2 × 5000 m postoji) — potvrda?
5. Nedelje > 25 % km bržih od E na dnu obima (posledica S2) — prihvatljivo?

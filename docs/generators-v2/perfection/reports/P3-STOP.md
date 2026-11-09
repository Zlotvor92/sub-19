# P3 — STOP: nedelja B ne staje u > 10 % planova grupa 4–6 dana (10K)

9. 11. 2026, 22:25 (Europe/Belgrade). Polazni SHA `38fd091` (10k-v2.10.0). Kod NIJE ugrađen u `web/src` ni pushovan:
stanje rada (S1 + S2 + S3, konstruktor i validator, 10k-v2.11.0) je u `docs/generators-v2/perfection/P3/s123-wip.patch`,
prekidači samo za merenje opcija u `P3/exp-options.patch`. Testovi nisu pokretani (kod nije ostao u stablu).

Uslov iz zadatka za STOP je ispunjen: **nedelja B ne staje u > 10 % planova grupe** — R 4 d 17 %, R 5 d 22 %, R 6 d
14 %, F 4 d 63 %, F 5 d 13 %, F 6 d 13 %. Ostali uslovi za STOP nisu ispunjeni: 0 novih odbijanja, „dan kvaliteta ≤
dugi" (pouka 35) bez promene, „doza ne opada" uz poređenje unutar tipa obara 0 planova.

## Komande (iz `web/`, svaka ≈ 1 s; nijedna nije test)

- **K0** iz korena: `git apply docs/generators-v2/perfection/P3/s123-wip.patch` (za K2–K5); za K4–K5 još
  `git apply docs/generators-v2/perfection/P3/exp-options.patch`.
- **K1** na `38fd091`: `node ../docs/generators-v2/perfection/P3/measure.ts pre` (mreža P0, 192 ulaza) → `P3/raw-10K-pre.json`.
- **K2** sa patchom: `node ../docs/generators-v2/perfection/P3/measure.ts s123`; `node ../docs/generators-v2/perfection/P3/compare.ts pre s123`.
- **K3** `P3_EXP=s1 … measure.ts s1` (samo S1: bez smene A/B i bez provere tipa) i `compare.ts pre s1`.
- **K4** `P3_EXP=pb … measure.ts pb` (P-b) i `compare.ts s123 pb`; **K5** `P3_EXP=pc … measure.ts pc` (P-c) i `compare.ts s123 pc`.
- **K6** `node ../docs/generators-v2/perfection/P3/profile.ts pre|s123` → `P3/profile-a-10K-{pre,s123}.txt`.
- Uzrok po nedelji: napomena konstruktora „Nedelja B ne staje: …" (tri vrste uzroka, v. dole), brojanje iz K2.

Fajlovi `raw-10K-*.json` (≈ 10 MB svaki) nisu u repou; ponavljaju se K1–K5. Provera patcha: posle `git apply` ponovljen
K2 daje 0 razlika prema prvom merenju (`compare.ts s123 chk`: promenjenih 0/192), isto za K4.

## Šta je ugrađeno u patchu

- **S1 (D33):** jedan plafon RP, tabela `caps.RP` po cilju nedelje: < 40 km 10 %, ≥ 40 km 15 %; jedini pristup
  `policy.capShare` (i `capPct` za tekst), `quality.capM` ga čita, validator čita isto. Lestvica RP: … 3 × 2000 ·
  **4 × 1600 (6,4 km) · 5 × 1600 m (8,0 km)**. Obrazac postojeće lestvice nije jednoznačan (koraci 0,6 / 1 / 0,5 / 0,5 /
  1 km), pa je uzet rezervni niz iz zadatka: 6 × 1000 m otpada (6,0 km nije veće od kraja lestvice), **4 × 2000 m nije
  nivo** jer ima istu dozu kao 5 × 1600 m („bez duplih doza") — ostaje kao druga struktura iste doze po D30.
- **S2 (D34):** `specific.ts` (jedno mesto odluke, iz upisanih nedelja): redovan plan 4–6 dana, ne-rasteretna
  specifična nedelja bez ograničenja kvaliteta; prva A, posle A je B i obrnuto; tip upisane nedelje = ima li Q2 I.
  Nedelja B: Q1 RP po progresiji (bez promene), Q2 = I održavanja (`quality.pickMaintainI`: doza poslednje I,
  struktura druga struktura iste doze kad postoji, korak `maintain`); stanje T slota se ne menja (`advance`), novo
  stanje `i`. B ne staje → nedelja A uz napomenu `Nedelja B ne staje: <uzrok>` (P-a), sledeća je B.
- **S3 (A25):** konstruktor zove `specificTypeNext` nad nedeljama kakve se upisuju (`out` + `written`), validator nad
  planom (upisanim nedeljama) — ista funkcija.
- **Validator:** `SPECIFIC_TYPE` (greška: B gde treba A; A gde treba B bez napomene), `B_WEEK_NOT_FIT` (upozorenje),
  `I_MAINTAIN` (doza = poslednja I, korak `maintain`), PHASE_QUALITY dozvoljava I na Q2 nedelje B, lanac T slota i D16
  preskaču Q2 nedelje B, `MAIN_DOSE_DECREASE` po tipu (O1 iz P1: A sa poslednjom A ili nedeljom pre specifične faze,
  B sa poslednjom B), stanje slota za rasterećenje/taper ne čita Q2 nedelje B.
- Nisu dirani testovi, `gridInvariants.ts`, `app/plan.ts KNOWN_VERSIONS` (10k-v2.11.0 tamo još ne postoji), STATUS.

Kontrola validatora (K3 bez izuzeća): konstruktor bez smene A/B, a validator sa proverom tipa → 132/132 plana 4–6 dana
odbijena `SPECIFIC_TYPE` (provera hvata izostanak pravila; zvanična sabotaža nije rađena).

## Sudar — nedelja B ne staje (K2)

Uzrok u **svih 34 nedelja**: dužine pri cilju (napomena „nedelja ne može da se sastavi pri cilju … (dužine dugog i
laganih)"); plafon I 8 %: 0, pouka 35 (dan I duži od dugog): 0, nema I doze: 0. Mehanizam: nedelja je već ograničena
kapacitetom (cilj spušten, „Nedelja ne može da se sastavi na X km"), dugi na granici (105 min / udeo D17), a lagan ≤ 0,8 ×
dugi (T1, A24). Dan I održavanja ima manje km od T dana nedelje A (npr. I 3 × 1000 m ≈ 10,3 km dan prema T 5 × 1000 m
≈ 11,7 km), pa ostatak do cilja nema gde. Isti mehanizam kao HM „sudar 2" (P1-STOP).
Primer `R-d4-40km-13w-v45` ned 10: cilj 54,0 km (redovan rast 55,0), dugi 17,1 km / 100 min, lagan 13,6 km (0,795 ×
dugi); I održavanja 3,0 km ne staje → A (RP 5 × 1000 + T 5 × 1000 m); ned 11 isto.

| grupa | planova sa B koja ne staje (P-a) | nedelja | P-b: sniženje cilja nedelje B [km] med (max) | P-c: preostalo |
|---|---|---|---|---|
| R 4 d | 6/36 (17 %) | 7 | 1,35 (2,1) | 0/36 |
| R 5 d | 8/36 (22 %) | 11 | 1,1 (2,1) | 0/36 |
| R 6 d | 5/36 (14 %) | 8 | 1,0 (1,4) | 1/36 |
| F 4 d | 5/8 (63 %) | 6 | 1,3 (1,9) | 0/8 |
| F 5 d | 1/8 (13 %) | 1 | 2,1 | 0/8 |
| F 6 d | 1/8 (13 %) | 1 | 1,5 | 0/8 |

Planovi sa B koja ne staje (26): 25 sa VDOT 35–45 ili laganim 450 s/km (dugi na granici 105 min), 1 F 330 s/km; priprema
8 ned 15, 13 ned 6, 18 ned 5.
Niz tipova specifičnih ne-rasteretnih nedelja (R + F 4–6 d, P-a): ABA 73, AB 33, AA 15, AAA 8, AAB 3.

Opcije (brojke iz K2, K4, K5):
- **P-a** (u patchu): nedelja je A uz napomenu, sledeća B. Ne menja obim; 23 plana (R+F) ostaju bez ijedne nedelje B
  (AA 15, AAA 8). 0 novih odbijanja.
- **P-b**: nedelja B sme niži izvodljiv cilj (ista pretraga D6, WEEK_FITTED) — B staje svuda (0 nedelja A umesto B);
  cena: nedelja B niža za 1,3 km medijana (0,1–2,1; n 26), vrh plana −2,1 do +0,6 km. 0 novih odbijanja; tip nedelje
  tada menja obim (pouka 9 / D6: obim ne bi smeo da zavisi od tipa nedelje).
- **P-c**: u nedelji B lagan sme preko 0,8 × dugi (izuzetak T1, lagan ≤ dugi i ≥ 3 km) — B staje u 25/26 planova
  (ostaje 1, R 6 d); cena: u tim nedeljama lagan/dugi 0,89 medijana (0,81–1,00), upozorenje EASY_VS_LONG_SMALL; menja
  vlasnika dužina (A24/T1) zbog tipa nedelje.
- Nemereno: **P-d** dan I održavanja nosi više km (npr. duži WU/CD ili I doza = najveća I, ne poslednja) — nova
  trenerska odluka (WU/CD je P6).

## Izmereno pre/posle (K1–K5; planovi sa rezultatom R, n 144; medijana [min–max])

| metrika | 10k-v2.10.0 | samo S1 | S1+S2+S3 (P-a) | P-b | P-c |
|---|---|---|---|---|---|
| najveći RP trening [km] | 4 [2,4–6] | 5 [2,4–8] | 5 [2,4–8] | 5 [2,4–8] | 5 [2,4–8] |
| isto, % trke | 40 [24–60] | 50 [24–80] | 50 [24–80] | 50 | 50 |
| ukupno RP u planu [km] (M3) | 15,4 [4,4–24] | 18,4 [4,4–31,5] | 18,4 [4,4–31,5] | 18,4 | 18,4 |
| I minuti u specifičnoj fazi | 0 [0–0] | 0 | 9,1 [0–25] | 10,9 [0–25] | 10,9 [0–25] |
| % km bržih od E, specifična (M7) | 14,7 [7,8–19,7] | 16,3 [8,2–19,7] | 15,6 [8,2–19,1] | 15,2 [8,2–18,4] | 15 [8,2–18,3] |
| % km bržih od E, taper | 11,6 [0–16,9] | 13,8 [0–16,9] | 13,8 [0–16,9] | — | — |
| uzrok vrha RP: plafon / ≤ 1 nivo + kraj faze / kraj lestvice | 79 / 43 / 22 | 39 / 78 / 27 | 39 / 78 / 27 | isto | isto |
| nedelja > 25 % km bržih od E (sve porodice, 192 plana) | 5 | 5 | 5 | 5 | 5 |
| R ≥ 40 km/ned sa najvećim RP treningom ≥ 6 km | 22/84 | 62/84 | 62/84 | 62/84 | 62/84 |

% km bržih od E u bazi i razvoju bez promene (8,7 / 10,4). Pouka 35 (drugi dan kvaliteta lagan): 0 [0–4] pre i posle.
Nedelje > 25 %: istih 5 kao pre (F 3–4 d, 20–25 km, baza nedelja 2 i 6; uzrok nije P3), nijedna nova. Po osećaju (F,
n 32): RP najveći 3,5 → 4,3 km, ukupno 11,9 → 14,5 km, I u specifičnoj 0 → 8,4 min. Početnik (B, n 16): menja se 1 plan
(4 d, cilj ≥ 40 km: RP plafon 15 %), najveći RP 4 → 5 km u tom planu. Promenjeni planovi (P-a, prema pre): 144/192 —
R 3 d 12/36, R 4 d 35/36, R 5–6 d 36/36, F 3 d 2/8, F 4 d 6/8, F 5–6 d 8/8, B 4 d 1/8, B 3 d 0/8 (K2).
Lestvica u upotrebi (P-a): RP 4 × 1600 m u 46 dana, 5 × 1600 m 39, 4 × 2000 m (druga struktura 8 km) 27; 2 × 3000 m
14 → 0 (posle 6,0 km sledi 6,4 km, ne druga struktura). I održavanja: i 2 × 1000 m (kad je poslednja I razvoja 2,0 km).

Orijentiri organizatora: najveći RP ≥ 6 km u planovima ≥ 40 km/ned — 62/84 (pre 22/84); ukupno RP ≥ 22 km medijana —
**18,4** (pre 15,4), ni jedna opcija ga ne menja: vrh RP drži „≤ 1 nivo nedeljno + kraj faze" u 78/144 (specifična faza
3–4 ne-rasteretne nedelje, 8–9 ned: 2).

Profil (a) (10 km 46:00, 40 km, 4 d, 16 ned; `P3/profile-a-10K-{pre,s123}.txt`): specifična faza pre — ned 11 RP 4 × 1000
+ T 2 × 2500 · ned 13 RP 3 × 1500 + T 5,0 km · ned 14 RP 5 × 1000 + T 2 × 2500; posle — ned 11 (A) RP 3 × 1500 + T 2 ×
2500 · rasterećenje · ned 13 (B) RP 5 × 1000 + **I 4 × 900 m održavanja** (3,6 km = poslednja I razvoja 3 × 1200 m) ·
ned 14 (A) **RP 3 × 2000 m** + T 5,0 km. RP najveći 5 → 6 km (50 → 60 % trke), ukupno 19,5 → 21,5 km; ciljevi
specifičnih nedelja 51,7 / 52,0 / 52,8 → 52,1 / 53,1 / 53,5 km. Taper isti (RP 3 × 1000 + T 3 × 1000 m).

## Nije urađeno (stao pre toga)

Testovi (nijedan pokrenut), sabotaže S1–S2, mreže adaptacije (S3 meren samo kroz ugradnju u konstruktor, ne kroz
`adapt*` mreže), `gridInvariants.ts` (provera Q2 u specifičnoj fazi nije gledana), KNOWN_VERSIONS, STATUS 10K, izveštaj
P3-REPORT.

## Mišljenje (odvojeno od merenja)

1. S1 nosi skoro ceo dobitak RP (najveći 4 → 5 km, ≥ 6 km u 62/84 planova ≥ 40 km); S2 ne menja RP (Q1 je isti), dodaje
   ≈ 9–11 min I u specifičnoj fazi i blago smanjuje % brzih km (I održavanja < T doza).
2. Nedelja B koja ne staje je posledica kapaciteta (dugi 105 min + T1), ne plafona I. P-a je najmanje invazivna, ali u
   23 plana B nikad ne nastaje. P-b je čista po vlasniku (ista pretraga cilja), ali tip nedelje menja obim za ≈ 1,3 km;
   P-c ruši T1 tačno u nedeljama gde je T1 obavezujuće. Ja bih uzeo P-a uz prijavu, ili P-b ako je cilj da B postoji u
   svakom planu — odluka je vaša.
3. Orijentir ukupnog RP ≥ 22 km nije dostižan samo plafonom i lestvicom: drži ga ≤ 1 nivo nedeljno u 3–4 nedelje.

## Otvorena pitanja organizatoru

1. Nedelja B koja ne staje (R 4–6 d 14–22 %, F 4 d 63 %): P-a / P-b / P-c / drugo?
2. Lestvica RP: 4 × 1600 · 5 × 1600 m (4 × 2000 m samo kao druga struktura 8 km) — potvrda?
3. I održavanja = poslednja I doza razvoja i kad je mala (2,0 km, 2 × 1000 m) — prihvatljivo, ili najveća I doza razvoja?
4. Druge strukture RP iste doze po D30 dozvoljavaju i 2 × 3200 / 2 × 4000 m (deonica > 3000 m, oporavak 120 s); u
   mreži se ne pojavljuju, ali pravilo ih ne isključuje — ostaje tako?

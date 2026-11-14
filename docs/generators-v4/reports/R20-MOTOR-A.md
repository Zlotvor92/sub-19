# R20 — MOTOR A (prilagođavanje na događaje), 14. 11. 2026 (po Beogradu) — A1–A6 urađeni (A2 bez prognoze)
Stanje `cf064743` (+ ispis `500a88f5`). V4 69 fajlova, 1081 prolazi, 20 očekivano pada (polazno 64 / 1043 / 25; razlika =
novi testovi oba motora i tabova). Typecheck 0, kapije HM/10K/5K/MAR 0, ispisi sve 4 distance obnovljeni.
## A1 (`e7f27ca0`) — jedno pravilo posle prekida (`engine/breakRamp.ts`, u replan i plan)
- Dugi ≤ max(+20 min, +15 %) od poslednjeg odrađenog (6 nedelja); prvi brzi svake vrste u 14 dana ≤ 70 % i ≤ odrađeni
  (razlika u hlađenje); blok ≤ odrađeni blok; nedelja posle rasterećenja ≤ +25 % i ≤ 1,2 × najveće od tri.
- Posle neplanirane trke povratak po nedeljama po dužini trke (≤ 75 min 85 %; ≤ 2 h 60/80 %; ≤ 3 h 50/65/80 %; duže
  40/55/70/85 %), dan posle duge trke odmor; pravila „70 %"/`afterLongRace` ne važe uz raspored. Svojstvo nad svim
  distancama `distances/breakRamp.test.ts`.
- HM s07 dugi 70→110 → 70→90→110; MAR s12 3 h 07 → 2 h 22; MAR s17/s18 ned 1 18→32 / 22→38 km; vlasnik-v2 dugi
  6,5/8,5/11,5/13,5/15 km. Otisci: 5K p15, MAR p15 (prvi brzi posle povrede 70 %).
## A2 (`9cd6dee1`) — put ≠ bolest, srazmerno danima
- Put 5–10 dana: jedna nedelja 87,5 % sa jednim kvalitetom (0,8), dugi ≤ 0,9 referentnog, druga = plan; bolest 5–6
  dana 80/95 % (7–10: 75/90 %). Nedelja sa jednim kvalitetom zadržava podražaj bloka (5K s05: intervali ostaju).
- HM s27 ned 1 44,3 → 49,7 km sa pragom; 5K s27 dobija rp u ned 1. NIJE: prognoza posle pauze (5K s27 26:15 → 26:22).
## A3 (`eb753ab0`) — provera forme se pomera, ne briše
- Posle rasporeda 3 dana (ne 10), kandidati: drugi kvalitet, dan kvaliteta, svaki lagan dan (HM s05, s25, s27
  zadržavaju proveru); po osećaju provera sme da zameni tempo trke (10K s16: 31. 12.); upozorenje prati novi datum.
## A4 (`70e90446`) — bol
- Prvi trening iste vrste strogo manji (≤ 80 %; 10K s13 23 → 18 min); prva nedelja sa kvalitetom jedan kvalitet;
  14 dana lagan ≤ 65 % dugog; Z3 se gasi posle 24 dana; ispod najmanje doze ostaje kvalitet (10K s15 ima–ima–ima);
  dugi prvih 7 dana ≤ 60 % (MAR s13 116 → 92 min); svaka nedelja ≤ +25 % (HM s15 22 → 31 → 37 postaje 22 → 26,8 →
  27,7 → 33,3). KNOWN skinuti: MAR s15 (MOTOR A4), 10K s13.
## A5 (`70516a22`) — propušten najduži dugi / prenet blok
- Bez nedelje gradnje do trke: sledeći dugi lagan ≈ 85 % propuštenog (MAR s28, s09: N−2 104 min sa blokom → 140 min
  lagano ≈ 24 km). Prenet blok: kad bi nedelja imala tri podražaja, poslednji kvalitet pre dugog postaje lagan.
## A6 (`468ecca9`, `cf064743`)
- `mergeChanges`: jedan dan/nedelja jedan red u lancima; stari rezultat (> 14 dana) se ne objavljuje kao nov događaj
  (tempa idu uz sledeći: HM s08, MAR s08/s26); posle trke prve 3 nedelje nisu „vršne" (5K s20), bez rasterećenja u
  prve 4 kad raspored kreće < 65 % (HM s19 13,6 → 21,3 km u ned 4; dugi 35/35/35 → 40/55/55).
## Namerno prepravljeni testovi (sažetak)
returnSchedule, hm/r14 (treća nedelja i put), examples § 12 b/d, round4 E, hm+tenk r10, marathon scenarios (raspored
umesto `afterLongRace`, `returnKeepLong` na granici lanca, R1 izmena N−2), marathon r9 KNOWN (s11/s12 silazak),
paceDirection (po osećaju), Z3 u sva 4 scenarios.test (24 dana, +3 min), hm/gate (vlasnik-v2 skinut sa „ČEKA FORMU"),
determinism timeout 15 s.
## Lagan dan 18 min (nalaz organizatora)
Proverom nad svim scenarijima: na stvarnim distancama lagan dan ispod poda (osim dana pred trku) postoji samo u
rampi posle bola (HM s15, 20 min). 18 min je u sintetičkim podacima primera § 12 (bez `easyNotBelowMin`) — nije menjano.

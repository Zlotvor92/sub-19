# R24 — jedna, završna ispravka generatora V4 (trener, 14. 11. 2026)

Izvor: `ROUND-V4-HM-14`, `-10K-07`, `-MAR-05`, `-5K-05` (§ D i § E), stanje **e1136a16**. Nije nova ocena. Kod je gledan
samo radi izvodljivosti: brojevi su u `distances/<d>/safety.ts`, namera u `templates.ts`, treninzi u `library.ts`,
tekst u `texts.ts`; pravila u `engine/build.ts` (lagani dani, dugi), `engine/replan.ts` (`onMissed`/`guardMissed`,
`onPain`/`firstZoneAfterPain`, `onPause`/`smoothExit`), `engine/render.ts` i `racePace.ts` (zaglavlje).
Ocene u zagradi su R23. „Ulaz" = Plan za ulaz. Pouzdanost procene: [visoka] / [srednja] / [niska].

**Važi za svaku stavku (tačka 6, da se ne ponavlja):** ostaju ispunjene provere R22 — posle trke dani 1–3 odmor ili
≤ 30 min i nedelja 1 ≤ 60 %; jedan polazni broj forme; tempo trke u treninzima = savet za trku; prvi dan posle pauze
nije dugi; nema doze manje od najmanje iz biblioteke. Ispis profila koji nije naveden u § C na kraju mora ostati
BAJT-ISTI (test otiska).

## MOTOR (zajednički)

**M1. Propušten ključni trening — sledeći se meri prema ODRAĐENOM.**
- Pogađa: MAR s12 (74), s25 (77), s11 (80).
- Sada: pravilo „jedan propušten ne menja sledeći" važi bez uslova. s12: propuštena oba duga sa blokom (2 h 47 / 27 min,
  2 h 59 / 34 min), najduži odrađeni 2 h 35 bez bloka → sledeći 3 h 6 / 41 min. s25: prvi blok 11,5 km (propušten
  5,5 km, odrađenih nema). s11: 3 h 3 / 33 min posle odrađenih 2 h 40 bez bloka.
- Treba: sledeći ključni ostaje po planu SAMO ako važe oba: (a) dugi ≤ najduži odrađeni u poslednjih 5 nedelja + 20 min;
  (b) blok u tempu trke ≤ 1,5 × najveći odrađeni blok iste vrste, a ako nijedan nije odrađen ≤ doza prvog propuštenog
  bloka. Ko ne ispuni — skraćuje se tačno na tu granicu (ne briše se, ne zamenjuje laganim); naredni rastu korakom
  šablona. U spisku promena jedna rečenica („sledeći dugi je 2 h 55 sa 27 min: toliko nosi ono što je odrađeno").
  Očekivani ispis: s12 ned 15 → 2 h 55 / 27 min; s25 ned 7 → blok 5,5 km (dugi 24,5 km ostaje), ned 9 → ≤ 8,5 km;
  s11 ned 21 → 3 h / 27 min.
- Provera: svojstvo nad svim scenarijima E3/E7 svih distanci: za svaki budući dugi d posle propuštenog ključnog,
  `d.min ≤ maxDoneLong5w + 20` i `d.blok ≤ max(1,5 × maxDoneBlok, prviPropušteniBlok)`; + tri tvrdnje gore.
- Ne sme: HM s10, s25, s27; 10K s11, s25; 5K s10, s25, s27 — tamo su oba uslova već ispunjena, ispis isti.
- Učinak: s12 → ≈ 81, s25 → ≈ 80, s11 → ≈ 81; maraton E3 79,5 → ≈ 81,3 [visoka].

**M2. Posle bola prvi brzi trening postoji.**
- Pogađa: 10K s15 (77).
- Sada: bol 17. 1. → nedelje 13–15 samo lagano (11,8 / 14,6 / 17,3 km), prvi brzi 18. 2. (32. dan), provera forme otpada.
- Treba: prvi termin kvaliteta ≥ 11. dana od prijave bola dobija prag u komadu = veće od (najmanja doza praga iz
  biblioteke, 50 % poslednje odrađene doze praga), najviše 60 %. Kad je 50–60 % ispod najmanje doze biblioteke, uzima se
  najmanja doza (ne briše se). Sledeće nedelje tempo trke = najmanja doza biblioteke za tu zonu (10 km: 2 × 1 km).
  Dugi ostaje „tri četvrtine pa + 20 min" kao sada. Očekivano s15: 28. 1. prag 10 min, 4. 2. tempo trke 2 × 1 km.
- Provera: svojstvo nad E4 svih distanci: od kraja prozora bola (dan 10–14) do prvog brzog treninga ≤ 7 dana, osim ako
  je do trke < 10 dana; nijedna doza ispod najmanje iz biblioteke (postojeći `microDose.test.ts` ostaje zelen).
- Ne sme: 10K s13, s16; HM s13–s16; 5K s13, s16 (prvi brzi je već unutar 7 dana — ispis isti). 5K s15 sme da dobije
  nazad jedan trening (fartlek ili tempo trke u najmanjoj dozi).
- Učinak: s15 → ≈ 81; 10 km E4 79,3 → ≈ 80,3 [visoka].

**M3. Zaglavlje: jedno vreme i jedan tempo za trku; rečenica o formi samo kad je tačna; najviše tri upozorenja.**
- Pogađa: MAR p03, p13 (+ p01, p06, p07, p11, p19 — isti red zaglavlja); parovi P2 B na HM (83), 10 km (83), MAR.
- Sada: (a) „Tempo trke u treninzima je tempo koji plan savetuje (7:22/km) … Očekivano vreme (4:56:16) traži 7:01/km"
  — tri tempa uz formu 6:41; 10K P2 B: savet 5:55, „očekivano 56:02 traži 5:36". (b) upozorenje o 3 dana kaže „računaj
  na današnju formu (4:41:53), ne na napredak — prognoza ga zato ne računa", a prognoza je 4:56:16. (c) P2 B: 6–7 stavki.
- Treba: (a) kad je savet za trku sporiji od tempa očekivanog vremena, deo „Očekivano vreme … traži X/km" se NE ispisuje;
  red glasi: „Tempo trke u treninzima je tempo koji plan savetuje za trku (S/km) — sporiji od današnje forme (F/km),
  v. upozorenja." Savetovano vreme (S × distanca) mora biti unutar raspona prognoze; ako nije, gornja granica raspona se
  širi do njega. (b) rečenica „računaj na današnju formu (X) … prognoza ga ne računa" ispisuje se samo kad je
  očekivano == forma; inače: „računaj na očekivano vreme (Y), sporije od današnje forme". (c) u UPOZORENJIMA najviše
  3 stavke + najviše jedna „Pomoglo bi i"; redosled prvenstva: tegoba/bol → dužina pripreme → obim → najduži dugi →
  broj dana → nema rezultata; višak (od 4. nadalje) se spaja u „Pomoglo bi i" jednom rečenicom. (d) „poslednjih 1 km" →
  „poslednji kilometar".
- Provera: nad mrežom ulaza: u zaglavlju se uz reč „/km" za trku javljaju najviše dva tempa (forma, savet); ako tekst
  sadrži „ne na napredak", onda `ocekivano == forma`; `brojStavkiUpozorenja ≤ 3`; regex `poslednjih 1 km` = 0 pogodaka.
- Ne sme: planovi gde je savet == forma (HM p03, p08, p10; 10K p08; MAR p08) — red ostaje isti.
- Učinak: MAR p03, p13 iskrenost + 0,5 do + 1 (p13 ulaz 76,5 → ≈ 78); P2 na HM/10 km + 0,5 [visoka].

**M4. Posle trke se skraćuje i DUGI, ne samo laki dani.**
- Pogađa: nedelja posle pripremne trke u maratonu (p11 ned 16: dugi 2 h 25 = 62 % od 32,3 km; p02 24 km od 39; p15
  2 h 30 od 40,9); planovi „juče trka": 5K s20 (prvi trk 65 min, dugi 90 min 7. dan, trka trajala 70 min), HM s20
  (75 pa 95 min), MAR s20 (95 min), HM s19 (ned 2 = 17,6 km, 88 %), HM s18 (upozorenje „forma traži više brzog rada").
- Treba: (a) dugi 6–8. dana posle trke punim naporom (pripremna ili juče) ≤ 75 % poslednjeg odrađenog dugog u minutima;
  kod plana „juče trka" uz to ≤ trajanje te trke i ≤ 60 % uobičajenog dugog. (b) prvi trk posle trke ≤ 40 min.
  (c) nivoi `pocetnik` i `pocetnik-nov`: nedelja 2 ≤ 75 % uobičajenog obima. (d) upozorenje „forma traži više brzog
  rada" se ne ispisuje u planu koji počinje dan posle trke.
  Očekivano: p11 ned 16 dugi 1 h 45; p02 18 km; p15 1 h 50; 5K s20 čet 40 min, dugi 55 min; HM s20 dugi 45 min pa ≤ 75;
  HM s19 ned 2 ≤ 15 km.
- Provera: proširiti `postRace.test.ts`: za svaku trku punim naporom u planu ili stanju, prvi dugi posle nje u
  prozoru 6–8 dana `≤ 0,75 × prethodniDugi`; (b), (c) kao tvrdnje nad s19, s20.
- Ne sme: nedelja 1 ≤ 60 % i dani 1–3 (već ispunjeno); prvi brzi trening ostaje 9–18. dana.
- Učinak: MAR p11 80 → ≈ 80,5 (sigurniji prolaz), 5K s20 81 → ≈ 83, HM s19/s20 + 1 [visoka].

**M5. Povratak posle pauze i bola: prva nedelja i rast.**
- Pogađa: HM s27 (82), HM s16 (79).
- Sada: s27 posle 6 dana puta nedelja 13 = 53,2 km sa dugim 1 h 50 (poslednji odrađeni dugi 1 h 50); s16 nedelje
  9 → 10: 41,3 → 60,8 km (+ 47 %).
- Treba: (a) pauza 4–7 dana bez bolesti: prva puna nedelja ≤ 85 % poslednje pune odrađene, prvi dugi ≤ 80 % poslednjeg
  odrađenog dugog (s27: ≤ 51 km, dugi ≤ 90 min — kao u R21). (b) dok plan ne stigne nivo pre prekida, nedelja raste
  najviše + 25 % u odnosu na prethodnu NERASTEREĆENU nedelju (s16: 41,3 → ≤ 51,6 → ≤ 60,8).
- Provera: proširiti `pauseReturn.test.ts` / `breakRamp.test.ts`: svojstvo (b) nad svim scenarijima E2, E4, E7; tvrdnja (a) nad s27.
- Ne sme: 10K i 5K s27, MAR s27 (prva nedelja je već ≤ 85 %); HM s05–s07 (rast je već ≤ 25 %, osim s07 29 → 38 km — sme da padne na 36).
- Učinak: s27 → 83, s16 → ≈ 80,5 [srednja].

**M6. Najkraći lagan dan — tri koraka, pa dan manje.** (zamenjuje pravilo „svi traženi dani ostaju, lagan pada na 20 min")
- Pogađa: 5K p02 (75,5), p15 (75,5), p03 (75), p06 (65,5), p09 (80); 10K p02 (76,5), p06 (74), p03 (79,5); HM p06 (76,5), p04 (80), p12 (81).
- Sada: lagan dan 20–25 min kao zaseban trening u nedeljama gradnje (5K p15 ned 4, 7, 8, 9, 12, 13; 10K p02 ned 2, 5, 6,
  7; HM p06 31 min osam nedelja uz prag nivoa 35).
- Treba: u nedelji koja NIJE nedelja trke, sužavanje ni nedelja provere, kad je lagan dan < `minEasyMin[nivo]`:
  1. nedelja sme do + 5 % iznad cilja da se dan dopuni; 2. ako nije dovoljno, dugi se skraćuje do
  max(1,3 × najkraći lagan, 85 % dugog iz šablona); 3. ako ni to nije dovoljno, nedelja ima jedan lagan dan manje
  (nikad ispod 3 dana trčanja; plan sa 3 tražena dana ne gubi dan) i njegovi km idu u ostale lagane dane.
  Zaglavlje tada jednom kaže: „Tražio si N dana; u nedeljama a–b plan ima N − 1, da nijedno trčanje ne bude kraće od
  M min — taj dan može biti šetnja." `minEasyFallbackMin` (20 min) važi još samo za nedelju trke, sužavanje, nedelju
  provere, nivo `pocetnik-nov` i planove sa 3 dana.
- Provera: svojstvo nad mrežom ulaza: za `runDays ≥ 4` i nivo ≠ `pocetnik-nov`, svaki lagan dan u nedelji gradnje ili
  rasterećenja `≥ minEasyMin[nivo]`; zbir nedelje ≤ 1,05 × cilj; `runDays(nedelja) ≥ max(3, traženo − 1)`.
- Ne sme: brz rad ≤ 22 % (ako korak 3 podigne udeo iznad, skraćuje se zagrevanje/hlađenje laganog dana, ne doza);
  5K p09, p07 i 10K p01 imaju kratke dane samo u sužavanju — ispis isti.
- Učinak: 5K p15 → ≈ 78, p02 → ≈ 78 (sa P3: 79–80), p03 → ≈ 77 (sa P3: 79–80); 10K p02 → ≈ 78,5, p06 → ≈ 76; HM p06 → ≈ 78,5 [srednja].

## PODATAK

**P1. Sva četiri `safety.ts`: prag najkraćeg laganog važi od 4 dana.**
- Pogađa: isti profili kao M6 (4 dana: 5K p02, p15; 10K p02). Sada: `minEasyFromRunDays: 5`.
- Treba: `minEasyFromRunDays: 4`; `minEasyMin` dopuniti: `pocetnik: 25` (5 km, 10 km), ostalo kako jeste (5 km i 10 km
  iskusni 30, mali/povratnik 25; HM i maraton 35).
- Provera: ista kao M6. Ne sme: planovi sa 3 dana. Učinak: uračunat u M6.

**P2. 5 km `safety.ts`/`texts.ts`: nivo `pocetnik-nov` po stažu, ne po jednom testu.**
- Pogađa: 5K par P2 B (80,5). Sada: `pocetnik-nov` traži `maxTenureWeeks: 8` I `maxLongestRunM: 5000`; B ima test na
  10 km pa je „početnik" — prognoza 25:45 sa 0:48 napretka, nema rečenice o cilju ni „šta posle trke".
- Treba: `{ beginner: true, maxTenureWeeks: 12 }` bez `maxLongestRunM`; `forecastMaxGainByLevel['pocetnik-nov'] = 0`
  ostaje. Očekivano B: „bez računanja napretka", stavka „cilj je da istrčiš celih 5 km … posle trke nastavi 3 dana još
  4 nedelje"; prvi kvalitet ≥ 5. nedelje, vrh 15–16 km.
- Provera: tvrdnja nad P2 B: `nivo == 'pocetnik-nov'`, `ocekivano == forma`, tekst sadrži „Posle trke nastavi".
- Ne sme: 5K p13 (već `pocetnik-nov`), p11 i P2 A (staž > 12 nedelja) — ispis isti. Učinak: P2 → 82,5 [visoka].

**P3. 5 km `templates.ts`/`safety.ts`: obim i dugi rastu.**
- Pogađa: p12 (77), p10 (76,5), p08 (75), p03 (75), p02 (75,5).
- Sada → treba (nedelje gradnje, bez rasterećenja):
  p12: kreće 43,5 km uz sadašnjih 48, najviše 44,4 → nedelja 1 = 47–48 km, vrh 52–53 km; oznaka „vršna" na najvećoj nedelji.
  p10: 16,3–17,8 km u ned 6–13, dugi 55 min šest puta → 17 / 18 / 19 / 20 km, dugi 55 → 60 → 65 min (najviše dva ista zaredom).
  p08: 33,5 km uz sadašnjih 36, 33–36 km devet nedelja → nedelja 1 = 35–36 km, talas do 40–41 km (dugi 15 → 16 → 17 km,
  laki dan do 75 min); upozorenje o 3 dana dobija predlog: „4. dan od 35 min → nedelja do 46 km".
  p03: 14,2–15,7 km u ned 2–5, dugi 45 min četiri puta → 15 / 16,5 / 18 km, dugi 45 → 50 → 55 min.
  p02: 31,2 → 33,8 km → vrh 36–37 km u 5. ili 6. nedelji.
  Opšti brojevi: nedelja 1 ≥ 0,97 × sadašnji obim; za plan ≥ 8 nedelja vrh ≥ 1,15 × sadašnji obim (≥ 1,10 kad je
  sadašnji ≥ 45 km); isti dugi najviše dve nedelje gradnje zaredom.
- Provera: ta tri broja kao svojstvo nad mrežom 5 km (nivoi osim `pocetnik-nov`); skok nedelje ≤ 12 % (K7) ostaje.
- Ne sme: p01, p04, p05, p07, p09, p11, p16 (svi ispunjavaju sva tri broja — ispis isti; proveriti otiskom).
- Učinak: p12 → ≈ 80 [srednja]; p10 → ≈ 79,5, p03 → ≈ 79,5, p02 → ≈ 79,5 [niska za prelazak]; p08 → ≈ 78 (ostaje ispod).

**P4. 5 km: plafoni p14 i p13.**
- p14 (ulaz 78; 4 nedelje): `texts.ts` — upozorenje dobija rečenicu „Posle trke: nedelju dana lagano, pa 8–10 nedelja
  od ovog obima za pravi napredak"; `templates.ts` — 3. nedelja tempo trke 5 × 800 m (sada 3 × 800 m).
- p13 (ulaz 76; `pocetnik-nov`, 10 nedelja): radnim danima neprekidno trčanje 25 → 30 → 35 min od 5. do 8. nedelje
  (sada 25–30), vrh 14,5–15 km (sada 12,6); iz upozorenja o obimu izbaciti „Duža priprema ovde ne pomaže" i „bar 15 km".
- Provera: tvrdnje nad p13, p14 (tekst, doza, vrh); p13 skok nedelje ≤ 10 %. Ne sme: P2 B deli nivo sa p13 — proveriti
  da mu vrh ne pređe 16 km. Učinak: p14 ulaz → ≈ 80,5 [srednja]; p13 → ≈ 79,5 [niska za prelazak].

**P5. 5 km p06 (65,5): kratka priprema brzog trkača.**
- Sada: 6 nedelja, 25 km, 5 dana; ned 5 (24,2 km) bez brzog treninga; ned 2–5 pet dana po 22 min; tri upozorenja.
- Treba: nedelje 2–4 po DVA kvaliteta (intervali 4–5 × 800 m ili prag 12–15 min + tempo trke 6–8 × 400 m); nedelja 5
  (−1): tempo trke 3 × 1 km i ≤ 70 % vrha (≤ 21,7 km); uz M6 plan ima 4 dana u ned 1–5. Upozorenja ≤ 3 rešava M3.
- Provera: p06: svaka nedelja osim nedelje trke ima ≥ 1 trening u tempu trke ili bržem; ned 5 ≤ 0,70 × vrh.
- Učinak: → ≈ 73–75. **Ne može preko 80 u jednom krugu:** 25 km i 6 nedelja ne nose doze koje forma 17:30 traži;
  ostaje sa upozorenjem (već postoji: „podigni obim do …").

**P6. 10 km `templates.ts`: p03, p10, p08, p06.**
- p03 (79,5): ned 7 = 25,9 km < ned 6 = 26,5 → ned 7 = 27–27,5 km (dugi 85 min ostaje); rasterećenje ned 4 21,3 km
  (−10 %) → 19–19,5 km (−20 %); lagan dan u nedelji provere 25 → 30 min.
- p10 (78): tri nedelje provere u 18 → dve (ned 4 i ned 12; treća postaje nedelja gradnje); obim ned 6–15 sa 25–29 →
  do 31–32 km.
- p08 (77,5; 3 dana): talas 42 → 44 → 46 → 48 km (dugi do 19 km dva puta, laki dan do 90 min).
- p06 (74): najveći rad u tempu trke 4 × 1 km → 5 × 1 km i 3 × 1,6 km (ned 5, 6); lagani dani rešava M6.
- Provera: tvrdnje nad imenovanim nedeljama; opšte: u 10 km šablonu najviše 1 provera forme na 8 nedelja.
- Ne sme: p01, p04, p05, p07, p09, p11, p12 — ispis isti. p10 i p12 dele šablon „po osećaju": p12 ima 12 nedelja i
  jednu proveru, ne dira se.
- Učinak: p03 → ≈ 80,5 [visoka]; p10 → ≈ 80 [srednja]; p08 → ≈ 79 i p06 → ≈ 77 — **ostaju ispod praga** (p08: tri dana
  po 85 min + dugi su već plafon trajanja; p06: 8 nedelja i 30 km za formu 36:24), sa postojećim upozorenjem.
  **10K p02 (76,5)** posle M6 ≈ 78,5 — ostaje ispod: 8 nedelja od 31 km daje rast do 36 km i ništa više.

**P7. Polumaraton `templates.ts`: p06 (76,5).**
- Sada: ned 7 brz rad 25 % (tempo trke 3 × 2 km + blok 8 km u dugom 16 km). Treba: blok 7 km ili tempo trke 2 × 2 km
  (≤ 22 %); lagani dani rešava M6 (4 dana po 38–40 min u ned 1–8).
- Provera: p06: nijedna nedelja > 22 %. Učinak: ≈ 79 — **ostaje ispod praga** (10 nedelja, 35 km, forma 1:20) [srednja].
  vlasnik-v1 (78, dugi ≤ 15 km) se ne dira: zamrznut lični plan.

**P8. Maraton `templates.ts`/`safety.ts`: p04, p18, p10, P2 B.**
- p04 (79,5): ned 17–21 traju 9 h – 9 h 50, laki dani 1 h 40 – 1 h 45 → laki dan ≤ 1 h 30, nedelja ≤ 9 h; dugi u ned
  3–9 pet puta 2 h 40 → 2 h 40 / 2 h 45 / 2 h 50 / 2 h 50 / 2 h 55 (plafon „dugi sporog trkača" ostaje 3 h 10).
- p18 (ulaz 78,5): ned 10 rasterećenje (31,2 km) + ned 11 provera (29,5 km) → provera forme ide U nedelju rasterećenja
  (ned 10), ned 11 je gradnja (≈ 43 km, dugi 2 h 25); lakih nedelja 4 od 20.
- p10 (ulaz 77,5): dugi 2 h 5 – 2 h 40 od 5. do 18. nedelje → raste + 5–10 min po nedelji gradnje do 2 h 50 pre
  pripremne trke; dve provere umesto tri.
- P2 B (80,5): najduži dugi 15,2 km, vrh 29,9 km → vratiti na ≥ 17 km (2 h 20 hod-trk) i vrh ≥ 32 km, kao u 21d4b070
  (razlika `pairs/p2b.txt` između dva stanja pokazuje šta je spustilo plafon nivoa `pocetnik-nov`).
- Provera: p04: `max(lakiDan) ≤ 90 min`, `max(nedelja) ≤ 540 min`; p18: nema dve uzastopne nedelje < 75 % prethodne
  gradnje; p10: dugi strogo raste kroz nedelje gradnje do 2 h 50; P2 B: najduži ≥ 17 km.
- Ne sme: p05, p07, p12, p14, p17 dele šablone — ispis isti; p11 (80) deli nivo sa p18 delimično: dugi mu se ne skraćuje.
- Učinak: p04 → ≈ 80,5 [visoka]; p18 ulaz → ≈ 80,5 [srednja]; p10 ulaz → ≈ 80 [niska]; P2 → 82.

**P9. Maraton plafoni p19 (75,5), p13 (76,5), p06 (73) — doze.**
- p19: četvrtak prag 12–18 min → lagano 60–70 min sa 2 × 8 min tempa maratona (kao p13). p13: vrh 34,5 → ≈ 38 km,
  dugi 2 h 50 jednom (ned 7). p06: prag 11–15 min → 20–30 min, lagani 29–40 → ≥ 40 min (M6), vrh 56,7 → 62–65 km.
- Učinak: p19 → ≈ 78,5, p13 → ≈ 79, p06 → ≈ 77. **Nijedan ne prelazi 80 u jednom krugu** — 8, 10 i 12 nedelja za maraton
  su ulaz koji plan može samo da ublaži; ostaju sa upozorenjem i predlogom polumaratona (već ispisano).

## Završni deo

**(a) Redosled.** 1. PODATAK uporedo, po distanci (četiri izvršioca bez dodira): 5 km P2–P5 · 10 km P6 · HM P7 ·
maraton P8–P9; P1 radi onaj ko radi M6. 2. MOTOR posle podataka, redom M6 (+ P1) → M4 → M1 → M2 → M5 → M3. M1, M2 i M5
su u `replan.ts` — jedan izvršilac; M6 i M4 u `build.ts` — drugi; M3 u `render.ts` — treći, poslednji (menja tekst
svih planova sa savetom sporijeg tempa). Posle svake stavke: ceo V4 skup + otisci.

**(b) Crta.**
- **Obavezno za kraj:** M1, M2, M3, M4, M5 (sve regresije R23 i bezbednost posle trke/pauze), M6 + P1 (lagan dan),
  P2 (5K P2 B), P8 (p04, p18, P2 B), P6 samo p03 i p10, P3 samo p12.
- **Može da ostane:** P3 ostatak (p10, p03, p02, p08), P4, P5, P7, P9, P6 p08 i p06, P8 p10; HM s08 (prognoza posle
  izgubljene vršne nedelje i dalje računa 2:44 napretka); oznaka „vršna" na 13. umesto 15. nedelji (10K p11).

**(c) Čiji se ispis menja — jedino to se posle ocenjuje.**
- HM: p06, p04, p12 (M6); s16, s19, s20, s27, s18 (tekst); par P2 B (zaglavlje).
- 10 km: p02, p03, p06, p08, p10; s15; par P2 B.
- Maraton: p01, p03, p06, p07, p11, p13, p19 (red zaglavlja), p02, p15 (dugi posle pripremne trke), p04, p10, p18;
  s11, s12, s25, s20, i svi scenariji čiji je osnovni plan p11/p02/p15; parovi P2 B, P1/P3 samo ako imaju pripremnu trku.
- 5 km: p02, p03, p06, p08, p10, p12, p13, p14, p15; s20, s15; par P2 B.
- Sve ostalo (HM p01–p03, p05, p07–p11; 10K p01, p04, p05, p07, p09, p11, p12; MAR p05, p09, p12, p14, p16, p17; 5K p01,
  p04, p05, p07, p09, p11, p16) mora ostati bajt-isto.

**Očekivan prolaz posle „obavezno za kraj"** (sada → posle): HM 9/10 i 2/2 → isto · 10 km 7/12 → 9/12 [srednja] ·
maraton 11/12 i 2/7 → 12/12 i 3/7 [srednja] · 5 km 7/14 i 0/2 → 8/14 i 0/2 [srednja]. Sa svim stavkama: 5 km do
9–11/14 i 1/2, maraton 4/7 [niska]. **Ostaju ispod praga i posle svega:** 5K p06, p08; 10K p02, p06, p08; HM p06;
MAR p06, p13, p19 — devet profila čiji ulaz (kratka priprema, mali obim uz brzu formu, tri dana) plan može da
ublaži, ne da nadoknadi; svaki već nosi upozorenje sa konkretnim predlogom.

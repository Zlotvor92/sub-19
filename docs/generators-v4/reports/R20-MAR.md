# R20 — maraton tab (podatak), 14. 11. 2026, po Beogradu
Nalog `briefs/R20.md` § PODATAK MAR; trener `coach/ROUND-V4-MAR-03` § Posebna provera, § D6. Menjani samo
`distances/marathon/` i `plans/MAR/`; ispisi HM/10K/5K bajt-isti. Kapija MAR 0, 19/19; `target-compare` 20 od 78.
Najduži dugi pre (`efdff989`) → posle: p01 26,5/2:32 = ; p02 28/2:28 → 28,5/2:31; p03 23,8/2:51 → 25,8/3:06;
p06 24,5/1:52 → 26/1:59; p09 28,5 → 29/2:43; p10 21,8/2:35 → 25,1/3:00; p11 22,6/2:38 → 26,1/3:03 (N−5 24,4/2:52);
p13 19,2/2:30 → 19,9/2:35; p17 32,5 → 33/2:34; p18 22/2:45 → 24/3:00 hod-trk (N−3); p19 21,5/2:17 → 23/2:27;
p04, p05, p07, p08, p12, p14, p15, p16 isti. P2 A: 2 h 15 → 2:52 (N−5) i 3:03 (N−3).
- Dugi po vremenu: početnik ≥ 20 ned — N−7 lagan dugi (bez bloka), N−6 dugi raste (bez talasa 0,68), pa lestvica
  ide N−8 → N−3 bez platoa (p11 140-145-160-172-·-183 min). Udeo: dve najduže nedelje 0,6 u minutima (kapija: ≤ 55 %
  km kod 4 dana, ≤ 60 % kod 3); ostale 45/50 %; početnik 4 dana 0,455, hod-trk 4 dana 0,445; korak 1,75 km.
- p19 (8 ned): N−4 je gradnja (kraći dugi), ne rasterećenje. Hod-trk na trci 10 + 1 kao u dugom; tekst ne kaže
  „kao na dugim" trkaču čiji dugi nisu hod-trk (p03, p10).
- Testovi: R18 (≥ b38a0ec4) bez izuzetaka; nov R20 (početnik/spor ≥ 20 ned: dva duga ≥ 2 h 50; p18 ≥ 2 h 55;
  p13 ≥ 2 h 35; p11 bez platoa). K7: hod-trk korak u stvarnom trajanju ≤ 12 %, dugi bez bloka u prikazanim km.
- Nije postignuto: p13 2 h 45 — n4 125 min (50 % nedelje od 32 km), pa K7 (12 %) daje n5 ≤ 140, n7 ≤ 157; ima 155.
**MOTOR:**
1. `peakShare` po broju dana (4 dana 55 %, 3 dana 60 %) — sada jedan broj.
2. Pripremni PM (p05/p17): nedelja trke sa obimom 0,7 ostaje ≈ 114 km — poslednja 2–3 dana pred trku treba
   skratiti u motoru (namera iz podatka se ne vidi u obimu).
3. A4: s15 — prvi blok MP posle bola (N−5, dve nedelje kasnije) 33 od 33 min; u KNOWN.
4. Rastezanje koraka (R19, × 1,15) uz zaokruživanje dana prelazi K7 za 0,02–0,3 km (p13, p19) kod koraka > 1,75.
5. B6/D7: P2 B (najduži 17,3 km) bez predloga polumaratona; D8 p18 raspon prognoze do 5 h 15 (B5).

## § R20b — 3 dana, p06, p08 (trener `coach/ROUND-V4-R19B`)
- Upozorenje `malo-dana` sada dobijaju i p03, p10 i p13 (podatak: `minRunDaysByLevel` samo za početnika; ranije su
  spor/mali/hod-trk bili izuzeti). Predlog: 4. dan od 50 min (p03), 55 min (p10), 40 min (p13); p08 75 min → dugi 30 km.
- MOTOR: za p03/p10/p13 probni plan sa 4 dana ne daje više km (vrh se računa iz polaznog obima), pa tekst kaže „isti
  obim se deli…" bez broja; trener traži broj (km nedelje i najduži dugi sa 4. danom). p13: B6 spaja predlog dana u
  `mali-obim`, a `malo-dana` ostaje bez predloga (prazan tekst).
- p08 (3 dana, 24 ned): N−7 lagan dugi 92 % i kod 1–3 dana → dugi 30 km (2:47) u N−5 i 30 km (2:48) u N−3 (pre 27/28,5).
  p03 i p10 isti najduži (25,8 / 25,8 km; p10 sa 25,1). Blok MP od 12. nedelje (p08) nije rađen.
- p06 (brz, 12 ned): 26 km / 1:59, ne 2 h 20 / 30 km — MOTOR: korak dugog je stalan (1,75 km, × 1,15), a 15 → 30 km
  za 8 nedelja gradnje traži korak ≈ 12 % (K7 to dozvoljava); vrh 56 km (lestvica), trener traži ≈ 65.
- Kapije 4 × 0; V4 + isolation 1072 + 24; typecheck čist; HM/10K/5K bajt-isti; target-compare 21 od 78.

# Glavni trener — V4 polumaraton, krug 15 (R25, 15. 11. 2026) — ZAVRŠNA ocena posle R24

Ocenjeno stanje **b8ad0bb6**, upoređeno sa e1136a16 (krug 14 / R23). Nov trener (nov tab). Ista rubrika (RUBRIC-V4, § A3), razvrstavanje iz `R21-RAZVRSTAVANJE.md` bez izmene (plafon ulaza: p03, p10). `judge2/` nije čitan. **Postupak:** fajl bajt-isti između dva stanja → ocena R23 preneta („prenet"); promenjen fajl → sve nedelje ponovo iz dana (zbir, udeo brzog, dugi, najkraći lagan dan, skok — skriptom) + zaglavlje i upozorenja. Ocene promenjenih su R23 ± učinak izmene (ista strogost), ne moja nezavisna skala — v. kalibraciju.

## 0. Kalibracija (stanje e1136a16, moja nezavisna ocena dela Plan naspram R23)

| plan | R23 | moja | razlika | odakle |
|---|---|---|---|---|
| HM p06 | 76,5 | 77,5 | +1 | oporavak 7,5 umesto 7 (jedna nedelja na 25 % nije nalaz K6) |
| 10K p03 | 79,5 | 78 | −1,5 | doza 7,5 (tempo trke najviše 4 × 1 km + 11 min) |
| MAR p04 | 79,5 | 77,5 | −2 | uklapanje 7 (lagani dani 1 h 40 – 1 h 55), progresija 7 |
| 5K p12 | 77 | 73,5 | **−3,5** | uklapanje 6,5 („start ispod sadašnjeg obima" je sidro za 5), progresija 6,5 (obim ne raste 7 nedelja) |

Prosek razlike −1,5; jedna preko 3 poena (5K p12) — **zapisano, nije štimovano**. Stroži sam od R23 na ravnom obimu i startu ispod sadašnjeg obima. Da pragovi ostanu uporedivi, promenjeni planovi su ocenjeni kao „R23 + izmena".

## 1. Šta se promenilo (HM, `git diff e1136a16 b8ad0bb6 -- plans/HM`)

p06 · parovi P1 A (prag 11 → 12 min, jedan red) i P2 B · scenariji s18 (jedno upozorenje manje) i s19 (nedelja 2). Sve ostalo bajt-isto. **Van `R24-ISPRAVKA.md` § (c): par P1 A** (najmanja doza praga 12 min — bez uticaja). Iz § (c) se NISU promenili: p04, p12 (M6 ih ne dira), s16, s20, s27 (M5 i „juče trka" deo M4 nisu urađeni).

**Zbirno: Plan 80,2 · Prilagođavanje 83,5 · Personalizacija 84,2 → zbirna 82,0** (k14: 80,1 · 83,4 · 84,0 → 81,9).
**Po merilu: „dozvoljava" 9 od 10 (k14: 9 od 10) · plafon ulaza 2 od 2 (k14: 2 od 2).**

## A. Plan — po profilu

| profil | grupa | Plan stara R23 → **sada** | Plan za ulaz R23 → **sada** | status | prolazi |
|---|---|---|---|---|---|
| p01 | dozvoljava | 82 → **82** | — | prenet | da |
| p02 | dozvoljava | 82 → **82** | — | prenet | da |
| p03 | **plafon** | 78,5 → **78,5** | 81 → **81** | prenet | da |
| p04 | dozvoljava | 80 → **80** | — | prenet | da |
| p05 | dozvoljava | 80,5 → **80,5** | — | prenet | da |
| p06 | dozvoljava | 76,5 → **77** | — | **ocenjen ponovo** | **ne** |
| p07 | dozvoljava | 80,5 → **80,5** | — | prenet | da |
| p08 | dozvoljava | 80 → **80** | — | prenet | da |
| p09 | dozvoljava | 81 → **81** | — | prenet | da |
| p10 | **plafon** | 78,5 → **78,5** | 80,5 → **80,5** | prenet | da |
| p11 | dozvoljava | 81 → **81** | — | prenet | da |
| p12 | dozvoljava | 81 → **81** | — | prenet | da |
| **prosek** | | **80,1 → 80,2** | | | 11 od 12 |
| vlasnik-v1 | dozvoljava | 78 → **78** | — | prenet | ne (dugi ≤ 15 km, zamrznut) |
| vlasnik-v2 | dozvoljava | 81,5 → **81,5** | — | prenet | da |

**p06 76,5 → 77 (ne prolazi).** Iz dana: 40,7 / 45,4 / 48,9 / 47,8 / 50,5 / 41,8 / 48,5 / 36,1 / 30,1 / 19,6 km; brz rad 6 / 4 / 14 / 14 / 20 / 5 / **25** / 20 / 11 / 10 %; dugi 13 / 14 / 15,5 / 16 / 18 / 13,5 / 16 km.
- Bolje: lagani dani u 2. i 3. nedelji 36 min (bilo 31); dugi sada raste ravnomerno 13 → 14 → 15,5 → 16 → 18 km (bilo 13 → 15 → 17 → 13,5 → 18).
- Isto: lagani 31 min u nedeljama 1, 4, 5, 6, 7 (šest od osam; prag nivoa 35 min); **nedelja 7 i dalje 25 % brzog rada** (tempo trke 3 × 2 km + 8 km u dugom od 16 km) — P7 nije rađen.
- Lošije: 4. nedelja tempo trke 2 × 2,5 km (bilo 2 × 3,5 km) — doza manja da bi dugi bio 16 km.
- **Dan manje uz upozorenje: u ovom planu ga NEMA.** Svih osam nedelja gradnje i dalje ima 5 treninga; M6 je samo dopunio dve nedelje. Upozorenje je staro i sada delom netačno: kaže „lagani dani su u 1–8. nedelji kratki — oko 30 min", a u 2. i 3. nedelji su 36 min.
- K-provere: K5, K7, K8 nema; K6: jedna nedelja na 25 % (bez plafona, kao u R23).

## B. Prilagođavanje

| događaj | R23 | **sada** | scenariji |
|---|---|---|---|
| E1 rezultat | 84,3 | **84,3** | preneto |
| E2 bolest | 82,0 | **82,0** | preneto |
| E3 propušteno | 83,5 | **83,5** | preneto (s10 isti — M1 ga ne dira, kako je traženo) |
| E4 bol | 79,5 | **79,5** | preneto; **s16 isti** (41,3 → 60,8 km, +47 %) |
| E5 juče trka | 81,5 | **81,9** | s17 82 · s18 82 → **82,5** · s19 81 → **82** · s20 81 (isti) |
| E6 ništa | 90,8 | **90,8** | preneto |
| E7 dva događaja | 82,3 | **82,3** | preneto; **s27 isti** (53,2 km, dugi 1 h 50 odmah posle puta) |
| **deo B** | **83,4** | **83,5** | |

- **s19 (juče prvi polumaraton, početnik):** nedelja 1 = 12,2 km (pon–sre odmor, 25 / 25 / dugi 40 min), **nedelja 2 = 14,9 km** (3 × 25 min + dugi 35 min; bilo 17,6 km sa dugim 55 min) — 74 % uobičajenih 20 km, u granici koju je R24 tražio (≤ 75 %). Nedelja 3 = 19,7 km, dugi 55 min. Prvi brzi 3. 12. (prag 2 × 6 min). Dobro.
- **s18:** iz plana koji počinje dan posle trke uklonjeno upozorenje „forma traži više brzog rada … podigni do 80 km". Treninzi isti.
- **s27 i s16 — kako je najavljeno, iste kao u R23** (M5 nije urađen): regresija R21 → R23 ostaje otvorena.
- **s20:** dugi 75 min sedmi i 95 min četrnaesti dan posle prvog polumaratona — nepromenjeno.

## C. Personalizacija

P1 85 (A: samo prag 11 → 12 min) · **P2 83 → 83,5** · P3 84 (prenet) → **84,2** (k14 84,0).

**P2 B (šest nedelja trčanja, tegoba u istoriji):** zaglavlje sada ima dva tempa (forma 6:00, savet 6:42/km) umesto tri; savet za trku 6:42/km = 2:21:38 je unutar raspona (1:54:32–2:32:57). Upozorenja: tri stavke + „Pomoglo bi i" (bilo šest + jedna). Prvi prag 12 min u komadu (bilo 8 min — najmanja doza biblioteke). Cena skraćivanja:
- nestale su stavka „Trčiš tek oko 5 nedelja …" i rečenica „Ili na isti datum trči kraću distancu (10 km)" — konkretan predlog koji AGENTS § 6 traži;
- „Pomoglo bi i" se završava sa „te nedelje trči kako piše — od 13. nedelje plan koristi sve tražene dane", a stavka na koju se „te nedelje" odnosi (3 treninga u nedeljama 4 i 12) više ne postoji — rečenica je nerazumljiva.

## D. Regresije (R23 dobro → sada lošije)

1. **P2 B, upozorenja:** predlog kraće distance i stavka o stažu su ispali; ostatak rečenice „te nedelje …" visi bez prethodnika. Ocena para ipak +0,5 (zaglavlje je tačnije), ali ovo je nov nalaz.
2. **p06, 4. nedelja:** tempo trke 2 × 2,5 km umesto 2 × 3,5 km; upozorenje o laganim danima više ne odgovara nedeljama 2–3. Bez pada ocene. Nijedna ocena profila, scenarija ni para nije pala.

## E. Šta vlasnik treba da zna pre puštanja (najviše 5)

1. **Posle pauze i posle bola plan se vraća prebrzo (s27, s16)** — prva nedelja posle šest dana puta 53,2 km sa dugim 1 h 50; posle bola skok 41 → 61 km (+47 %). Nije opasno za svakoga, ali je to mesto gde plan najmanje liči na trenera. Poznato, neurađeno (M5).
2. **P2 B:** početniku sa šest nedelja staža plan više ne kaže „trči 10 km umesto polumaratona" i ima jednu nerazumljivu rečenicu u „Pomoglo bi i". Tekst, ne bezbednost.
3. **p06 (brz trkač, 35 km, 5 dana, 10 nedelja):** lagani dani od 31 min i jedna nedelja sa 25 % brzog rada; „dan manje" se ovde ne pojavljuje. Plan je upotrebljiv i nosi upozorenje, ali je ispod praga.
4. **s20:** dugi 75 pa 95 min u prve dve nedelje posle prvog polumaratona početnika — na gornjoj ivici.

## F. Presuda

**HM: B 83,5 i C 84,2 prolaze; „dozvoljava" 9 od 10, plafon ulaza 2 od 2 — isto kao R23.** Ne prolazi samo **p06 77** (i vlasnik-v1 78, zamrznut). R24 je na polumaratonu doneo malo: s19 i s18 bolji, zaglavlje P2 B tačnije; p06, s27 i s16 su ostali gde su bili.

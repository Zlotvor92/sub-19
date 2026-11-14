# Glavni trener — V4 5 km, krug 6 (R25, 15. 11. 2026) — ZAVRŠNA ocena posle R24

Ocenjeno stanje **b8ad0bb6**, upoređeno sa e1136a16 (krug 5 / R23). Ista rubrika (§ A3), razvrstavanje iz `R21-RAZVRSTAVANJE.md` bez izmene (plafon ulaza: p13, p14). `judge2/` nije čitan. Postupak i kalibracija: `ROUND-V4-HM-15.md` § 0 (**5K p12 iz e1136a16: moja ocena 73,5 naspram 77 u R23, razlika −3,5 — preko 3 poena, zapisano, nije štimovano**; p12 se u ovom krugu nije menjao, pa mu je ocena R23 preneta).

## 1. Šta se promenilo (`git diff e1136a16 b8ad0bb6 -- plans/5K`)

p02 (jedan dan + oznaka vršne nedelje) · p15 (dva dana) · parovi P1 A (prag 2 × 5 → 2 × 6 min), P2 A (prag 2 × 3 → 2 × 5 min), P2 B (ceo plan) · scenario s15. Sve ostalo bajt-isto. **Van `R24-ISPRAVKA.md` § (c): parovi P1 A i P2 A** (najmanja doza praga; bez uticaja). **Iz § (c) se NISU promenili: p03, p06, p08, p10, p12, p13, p14 i s20** — od podataka za 5 km urađen je samo P2 (nivo `pocetnik-nov`); P3, P4 i P5 nisu, a „juče trka" deo M4 takođe nije.

**Zbirno: Plan 77,4 · Prilagođavanje 82,8 · Personalizacija 82,7 → zbirna 80,1** (k5: 77,4 · 82,8 · 82,2 → 80,0).
**Po merilu: „dozvoljava" 7 od 14 (k5: 7 od 14) · plafon ulaza 0 od 2 (k5: 0 od 2).**

## A. Plan — po profilu

| profil | grupa | Plan stara R23 → **sada** | Plan za ulaz R23 → **sada** | status | prolazi | šta deli od praga |
|---|---|---|---|---|---|---|
| p01 | dozvoljava | 82 → **82** | — | prenet | da | |
| p02 | dozvoljava | 75,5 → **75,5** | — | **ocenjen ponovo** | **ne** | obim 31,2 → 34 km i nazad; lagan dan 22–28 min u nedeljama 3, 6, 7; „vršna" na 2. nedelji |
| p03 | dozvoljava | 75 → **75** | — | prenet | **ne** | obim 14,2–15,7 km, dugi 45 min četiri puta, lagan dan 20 min |
| p04 | dozvoljava | 80,5 → **80,5** | — | prenet | da | |
| p05 | dozvoljava | 82 → **82** | — | prenet | da | |
| p06 | dozvoljava | 65,5 → **65,5** | — | prenet | **ne** | **šesti krug isto:** 5. nedelja bez brzog treninga, pet dana po 22 min, tri upozorenja |
| p07 | dozvoljava | 80 → **80** | — | prenet | da | |
| p08 | dozvoljava | 75 → **75** | — | prenet | **ne** | kreće ispod sadašnjeg obima; 33–36 km devet nedelja |
| p09 | dozvoljava | 80 → **80** | — | prenet | da | |
| p10 | dozvoljava | 76,5 → **76,5** | — | prenet | **ne** | obim 16,3–17,8 km osam nedelja, dugi 55 min šest puta |
| p11 | dozvoljava | 80 → **80** | — | prenet | da | |
| p12 | dozvoljava | 77 → **77** | — | prenet | **ne** | kreće sa 43,5 km uz sadašnjih 48 i ne stiže ih |
| p13 | **plafon** | 77 → **77** | 76 → **76** | prenet | **ne** | vrh 12,6 km; „duža priprema ne pomaže" |
| p14 | **plafon** | 77 → **77** | 78 → **78** | prenet | **ne** | ni reči šta posle trke; 3 × 800 m u 3. nedelji |
| p15 | dozvoljava | 75,5 → **76** | — | **ocenjen ponovo** | **ne** | lagani 20 min u nedeljama 4, 8, 9 (gradnja) i 12, 13 |
| p16 | dozvoljava | 80 → **80** | — | prenet | da | |
| **prosek** | | **77,4 → 77,4** | | | 7 od 16 | |

**Ponovo ocenjeni (sve nedelje iz dana):**
- **p15 75,5 → 76.** Jedina izmena: 7. nedelja ima dva laka dana po 25 min (bilo 20), nedelja 21,1 km (bilo 19,5). Lagani dani od 20 min ostaju u 4., 8. i 9. nedelji gradnje (8. i 9. uz 19–20 % brzog rada) i u obe nedelje sužavanja. Obim 17 → 19,1 → 20,8 → 21,1 → 21,5 → (19,5) → 21,1 → 21,7 → 23,9 → (22,1) → 24,8 km; dugi 45 min šest puta.
- **p02 75,5 → 75,5.** Subota 2. nedelje 5,5 km / 31 min (bilo 5 km / 28 min). Time je 2. nedelja (34 km) za 0,2 km veća od pete (33,8 km), pa je **oznaka „vršna nedelja" prešla na 2. od 8 nedelja**, a peta — sa testom iza sebe, tempom trke 5 × 1 km i dugim 11 km — piše „gradnja". Dobitak od dužeg dana poništava pogrešna oznaka.
- **Dan manje uz upozorenje (p02, p15): NEMA ga ni u jednom.** Oba plana imaju 4 treninga u svim nedeljama osim nedelje trke; zaglavlja ne pominju dane. M6 je u svakom produžio jedan, odnosno dva dana za 3–5 min. Pitanje „da li je plan sa danom manje bolji" zato nema na čemu da se oceni; plan je bolji tek neznatno.
- **K-provere:** K5, K6, K7 nema; K8 (20–22 min kao zaseban dan) ostaje: p02, p03, p06, p09, p15.

## B. Prilagođavanje

| događaj | R23 | **sada** | scenariji |
|---|---|---|---|
| E1 / E2 / E3 | 83,8 / 81,0 / 82 | **isto** | preneto |
| E4 bol | 80,0 | **80,4** | s15 79 → **80,5**; ostali preneti |
| E5 juče trka | 82,0 | **82,0** | preneto; **s20 isti** (prvi trk 65 min, dugi 90 min sedmi dan) |
| E6 / E7 | 89,8 / 80,7 | **isto** | preneto |
| **deo B** | **82,8** | **82,8** | |

**s15 (bol 4/10, 10. 1.) 79 → 80,5.** Dan po dan: do 20. 1. samo lagano, 24. 1. dugi 30 min; **26. 1. (šesnaesti dan) prag 12 min u komadu**, zatim tempo trke 3 × 900 m (4. 2.) i 3 × 600 m, pa trka. Nedelja 13 = 11,7 km (bilo 9,7 samo lagano). Brzi rad se vraća jednom nedeljno u tri uzastopne nedelje — kako treba. Ostaje: dugi 30 min četiri nedelje zaredom (11–14), lagani dani 20 min.

## C. Personalizacija

P1 84 (A: jedan red) · **P2 80,5 → 82** · P3 82 (prenet) → **82,7** (k5 82,2).

**P2 B — regresija R23 zatvorena.** Trkač sa šest nedelja staža je ponovo `pocetnik-nov`: prognoza 26:33 „bez računanja napretka: tek počinješ da trčiš"; treća stavka upozorenja kaže „cilj neka bude da završiš trku; za vreme odluči posle provere forme", a „Pomoglo bi i": „posle trke nastavi sa 3 dana nedeljno još 4 nedelje, pa izaberi sledećih 5 km za 8–10 nedelja". Prvi kvalitet je fartlek 6 × 1 min u 6. nedelji (bilo prag 2 × 3 min u petoj), vrh 16,1 km, najduži 6,9 km / 50 min; tempo trke 3 × 400 → 5 × 400 m. Smer razlike prema A je tačan. Tanko: trkač koji je juče istrčao test na 10 km dobija dugi od najviše 50 min i lagane dane od 20 min — oprezno, ali uz tegobu u istoriji odbranjivo.

## D. Regresije (R23 dobro → sada lošije)

1. **p02:** oznaka „vršna nedelja" na 2. umesto na 5. nedelji (bez pada ocene; poništen dobitak od M6).
Nijedna ocena nije pala. Regresija R23 (P2 B) je zatvorena.

## E. Šta vlasnik treba da zna pre puštanja (najviše 5)

1. **5 km je distanca na kojoj je R24 doneo najmanje: sedam od četrnaest profila je i dalje ispod praga, isti kao u R23.** Ispravke obima i dugog (p12, p10, p08, p03, p02), plafona (p13, p14) i p06 nisu rađene. Planovi nisu opasni — tanki su: obim ne raste, dugi stoji, lagani dani od 20–22 min.
2. **p06 (25 km, 6 nedelja, forma 17:30) — šesti krug 65,5:** nedelja pred sužavanje bez ijednog brzog treninga i pet dana po 22 min. To je jedini plan na 5 km koji bih nazvao lošim, ne samo tankim.
3. **Lagan dan od 20 min kao zaseban trening** i dalje postoji u nedeljama gradnje (p15: 4., 8., 9.; p03; p06). „Dan manje" se u ispisima ne pojavljuje.
4. **s20 (juče 10 km za 70 min, početnik):** prvi trk četvrtog dana traje 65 min, dugi 90 min sedmi dan — duže od same trke. Nepromenjeno.
5. **p02:** „vršna nedelja" piše na 2. nedelji — zbunjuje, nije opasno.

## F. Presuda

**5 km: B 82,8 i C 82,7 prolaze; „dozvoljava" 7 od 14, plafon ulaza 0 od 2 — isto kao R23.** Niko nije prešao prag, niko nije pao. Ispod: p12 77 · p10 76,5 · p15 76 · p02 75,5 · p03 75 · p08 75 · p06 65,5; plafon p14 78 · p13 76.

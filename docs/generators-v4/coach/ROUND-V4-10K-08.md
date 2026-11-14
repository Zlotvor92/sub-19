# Glavni trener — V4 10 km, krug 8 (R25, 15. 11. 2026) — ZAVRŠNA ocena posle R24

Ocenjeno stanje **b8ad0bb6**, upoređeno sa e1136a16 (krug 7 / R23). Ista rubrika, razvrstavanje iz `R21-RAZVRSTAVANJE.md` bez izmene (**10 km nema profila sa plafonom ulaza**). `judge2/` nije čitan. Postupak i kalibracija: `ROUND-V4-HM-15.md` § 0 (10K p03 iz e1136a16: moja ocena 78 naspram 79,5 u R23, razlika −1,5; ocene promenjenih su „R23 + izmena").

## 1. Šta se promenilo (`git diff e1136a16 b8ad0bb6 -- plans/10K`)

p02, p03, p10 · parovi P2 A (prag 2 × 4 → 2 × 5 min, jedan red) i P2 B · scenario s15. Sve ostalo bajt-isto. **Van `R24-ISPRAVKA.md` § (c): par P2 A** (najmanja doza praga; bez uticaja). Iz § (c) se NISU promenili: p06 i p08 (P6 je urađen samo za p03 i p10; M6 ne menja p06).

**Zbirno: Plan 79,4 · Prilagođavanje 83,2 · Personalizacija 83,5 → zbirna 81,4** (k7: 79,2 · 83,1 · 83,3 → 81,2).
**Po merilu: „dozvoljava" 8 od 12 (k7: 7 od 12).**

## A. Plan — po profilu (svi „ulaz dozvoljava")

| profil | Plan stara R23 → **sada** | status | prolazi | šta deli od 80 |
|---|---|---|---|---|
| p01 | 81,5 → **81,5** | prenet | da | |
| p02 | 76,5 → **77** | **ocenjen ponovo** | **ne** | rast samo 31,4 → 36 km; lagan dan 25 min u vršnoj nedelji (22 % brzog rada) i u sužavanju |
| p03 | 79,5 → **80,5** | **ocenjen ponovo** | **da** | |
| p04 | 80 → **80** | prenet | da | |
| p05 | 81 → **81** | prenet | da | |
| p06 | 74 → **74** | prenet | **ne** | tri upozorenja; lagani 24–25 min u nedeljama 2–6; tempo trke najviše 4 × 1 km |
| p07 | 80,5 → **80,5** | prenet | da | |
| p08 | 77,5 → **77,5** | prenet | **ne** | obim 42–46 km četrnaest nedelja |
| p09 | 81 → **81** | prenet | da | |
| p10 | 78 → **79** | **ocenjen ponovo** | **ne** | obim 25,5–29,1 km od 6. do 15. nedelje (traženo do 31–32 km) |
| p11 | 80,5 → **80,5** | prenet | da | |
| p12 | 80 → **80** | prenet | da | |
| **prosek** | **79,2 → 79,4** | | 8 od 12 | |

**Ponovo ocenjeni (sve nedelje iz dana):**
- **p03 79,5 → 80,5 — prelazi prag.** Obim 20,3 / 22 / 23,7 / **19,3** / 24,6 / 26,5 / **26,7** / 26,1 / 28,4 / 23,3 / 17,5 / 10 km; dugi 65 / 70 / 74 / 60 / 80 / 80 / 85 / 75 / 86 min. Sva tri nalaza R23 su zatvorena: rasterećenje u 4. nedelji je −19 % (bilo −10 %), 7. nedelja nije manja od šeste (tempo trke 3 × 1 km umesto 2 × 1,2 km), u nedelji provere (8.) lagan dan je 60 min i dugi 75 min (bilo 25 i 60 min). Tanko: od 5. do 9. nedelje pet nedelja gradnje bez rasterećenja — na 25–28 km i tri dana to je podnošljivo.
- **p10 78 → 79.** Dve provere forme (4. i 12. nedelja) umesto tri; 8. nedelja je sada gradnja (25,8 km, intervali 4 × 3 min, dugi 80 min) umesto rasterećenja sa pragom 13 min. Obim 25,8 / 25,5 / 25,8 / 26,9 / 28,9 / 26,9 / (23,5) / 27,5 / 29,1 / 29,1 km — tri nedelje zaredom na 25,5–25,8 km i vrh 29,1; traženi rast do 31–32 km nije izveden. Oznaka „vršna" je na 14. nedelji (8 % brzog), a petnaesta ima isti obim i 18 %.
- **p02 76,5 → 77.** Jedina izmena: subota 2. nedelje 5,5 km / 31 min (bilo 4,5 km / 25 min), nedelja 33,7 km. Lagani dani 25 min ostaju u nedeljama 5 (vršna), 6 i 7 (sužavanje). **Dan manje uz upozorenje: NEMA ga** — sve nedelje imaju 4 treninga, zaglavlje ne pominje dane. Plan je minimalno bolji (jedan dan duži za 6 min).
- **K-provere:** K5, K6, K7 nema; K8: 24–25 min kao zaseban dan ostaje u p06 (nedelje 2–6) i p02 (vršna nedelja).

## B. Prilagođavanje

| događaj | R23 | **sada** | scenariji |
|---|---|---|---|
| E1 rezultat | 84,3 | **84,3** | preneto |
| E2 bolest | 82,0 | **82,0** | preneto |
| E3 propušteno | 82,5 | **82,5** | preneto (s11 isti — M1 ga ne dira) |
| E4 bol | 79,3 | **79,8** | s13 82 · s14 78 · s15 77 → **79** · s16 80 |
| E5 juče trka | 82,5 | **82,5** | preneto |
| E6 ništa | 89,8 | **89,8** | preneto |
| E7 dva događaja | 81,3 | **81,3** | preneto |
| **deo B** | **83,1** | **83,2** | |

**s15 (bol 4/10 posle dugog, 17. 1.) — regresija R23 delom zatvorena, 77 → 79.** Dan po dan: 18. i 19. 1. odmor, 21. 1. lagano 25 min, 24. 1. dugi 35 min; 26. 1. lagano 25 min, **28. 1. (jedanaesti dan) prag 12 min u komadu**, 31. 1. dugi 35 min (nedelja 13,2 km, 13 % brzog). Zatim opet dve nedelje samo lagano: 14,6 km (dugi 55 min) i 17,3 km (dugi 70 min); sledeći brzi trening tek 18. 2. (tempo trke 2 × 1,2 km), pa 2 × 1 km i trka. Dakle jedan prag u pet nedelja pred trku; u R21 je bilo prag → 2 × 600 m → 2 × 1 km (80). Tekst promena je tačan („prvi brzi trening je 28. 1."); provera forme i dalje otpada uz objašnjenje. Dugi „tri četvrtine pa + 20 min" je dobar.

## C. Personalizacija

P1 84 (prenet) · **P2 83 → 83,5** · P3 83 (prenet) → **83,5** (k7 83,3).

**P2 B:** zaglavlje — „tempo koji plan savetuje za trku (5:55/km) — sporiji od današnje forme (5:36/km)", bez „očekivano vreme traži 5:36/km"; savet 59:12 je unutar raspona 52:26–1:02:22; „poslednji kilometar" ispravljeno; tri stavke + „Pomoglo bi i" (bilo pet + jedna). Prvi prag 2 × 5 min. Cena: ispali su stavka „Trčiš tek oko 5 nedelja …" i predlog „Ili na isti datum trči kraću distancu (5 km)". Prognoza i dalje ispravno kaže „tek počinješ da trčiš, napredak se ne pretpostavlja".

## D. Regresije (R23 dobro → sada lošije)

1. **P2 B, upozorenja:** bez predloga kraće distance i bez stavke o stažu (ocena para ipak +0,5 zbog tačnijeg zaglavlja).
2. **p10:** oznaka „vršna nedelja" na 14. umesto na 15. nedelji (isti obim, više brzog rada) — bez pada ocene.
Nijedna ocena nije pala. Regresije R23: **s15 delom zatvorena (77 → 79, bilo 80 u R21); P2 B zaglavlje zatvoreno; p11 oznaka vršne nedelje ostaje.**

## E. Šta vlasnik treba da zna pre puštanja (najviše 5)

1. **s15 — posle bola plan do trke ima jedan prag i dva mala treninga u tempu trke** (pet nedelja). Bezbedno je, ali trkač dolazi na start sa manje brzog rada nego što bi trener dao kad bol prođe.
2. **Kratke pripreme brzih trkača (p02: 8 nedelja / 31 km; p06: 8 nedelja / 30 km / forma 36:24) i tri dana na 41 km (p08) ostaju ispod praga** — 77, 74 i 77,5. Planovi su upotrebljivi i svaki nosi upozorenje sa predlogom; plan ne može da nadoknadi ulaz. p06 ima tri upozorenja i lagane dane od 24–25 min u pet nedelja.
3. **„Dan manje uz upozorenje" se u ispisima 10 km ne pojavljuje ni jednom** — M6 je u p02 samo produžio jedan dan. Ako vlasnik to očekuje u aplikaciji, neće ga videti na ovim profilima.
4. **p10 (početnik po osećaju, 18 nedelja):** dobar plan na 79 — do praga ga deli samo ravan obim od 6. do 15. nedelje.

## F. Presuda

**10 km: B 83,2 i C 83,5 prolaze; „dozvoljava" 8 od 12 (R23: 7 od 12).** Prag je prešao **p03 (80,5)**; niko nije pao. Ispod praga: p10 79 · p08 77,5 · p02 77 · p06 74.

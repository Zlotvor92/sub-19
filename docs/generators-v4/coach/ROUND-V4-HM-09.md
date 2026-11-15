# Glavni trener — V4 polumaraton, krug 9 (13. 11. 2026)

Prvi krug novog glavnog trenera, istom rubrikom (`RUBRIC-V4.md`, `SCENARIOS-V4.md`). Ocenjeno sa `origin/claude/v4`
@ 12651ae (ispisi iz 5989be4, „krug 9b"). Kod nije čitan, testovi nisu pokretani, `judge2/` nije čitan.
Brojeve sam računao sam iz dana (zbir km i minuta po nedelji, dugi, najduži lagan dan, odnos nedelje prema vrhu,
skokovi); zbir u redu „Zbir" se svuda slaže sa danima (K5 bez nalaza).

- **Planovi p01–p12, vlasnik-v1, vlasnik-v2:** čitani dan po dan.
- **Scenariji čitani dan po dan** (nedelja događaja + 3–5 nedelja posle, zaglavlje, „zašto", spisak izmena):
  s01 (E1), s02, s04, s05 (E2, ceo ostatak plana), s06, s07, s08, s09 (E3), s10, s12, s13 (E4), s14, s15, s16,
  s17 (E5), s18, s19, s20, s24 (E6), s26 (E7). **Iz pregleda + brojeva po nedelji (bez čitanja dana):** s03, s11,
  s21–s23, s25, s27.
- **Parovi:** P1 B, P2 B, P3 A, P3 B prve 4 nedelje dan po dan + brojevi iz pregleda za svih 6.

**Zbirno: Plan 78,5 (sa proverama 78,2) · Prilagođavanje 80,8 · Personalizacija 83,7 → zbirna 80,2**
(krug 7 kod prethodnog trenera: 79,3 · 83,7 · 84,0 → 81,6). Pad je skoro ceo u E2 (bolest), i nastao je u krugu 9b.

## 0. Kalibracija (stanje 2776b5d, koje je ocenio prethodni trener)

| profil | prethodni | **moja** | pomak | zašto |
|---|---|---|---|---|
| p01 | 82,5 | **81,5** | −1 | lagani subotni dani 4–5,5 km (24–33 min) u ned 1–7 uz nedelju od 41–48 km |
| p05 | 81,5 | **80,5** | −1 | dugi 24 km devet nedelja zaredom (ned 1–9), pa 28 km u ned 11 — plato pa skok |
| p06 | 75 | **67** | **−8** | 4 od 7 nedelja gradnje bez ijednog brzog treninga (ned 4, 6, 8, 9); nedelja −1 (39 km) veća od nedelje −2 (35,5 km) i bez ičeg brzog; sužavanje 72 % → 51 % |
| p08 | 75,5 | **74** | −1,5 | počinje sa 41 km ispod sadašnjih 45; 41–47 km jedanaest nedelja |
| p11 | 80,5 | **80** | −0,5 | provera u „specifičnoj", pa opet „razvoj" (oznake faza); prognoza −7 min za početnika |

**Pomak mog merila:** opšte sam oko 1 poen stroži (4 profila, −0,5 do −1,5). Kod p06 razlika je 8 poena: ocenu 75
prethodni trener je dao u krugu 5/6, kad je p06 imao kvalitet u skoro svakoj nedelji; u stanju 2776b5d je kvalitet
izbačen iz 4 od 7 nedelja (upozorenje to i kaže), a isti obrazac je on sam na 10 km ocenio sa 57. Mislim da je
ocena 75 za 2776b5d nasleđena, ne ponovo izvedena. Unazad ništa ne štimujem; ocene ispod su na mom merilu.

## A. Plan

| profil | ulaz | prethodna | **sada** | vrh km | dugi max | brz max | −2 / −1 / trka (% vrha) | glavno |
|---|---|---|---|---|---|---|---|---|
| p01 | 10 km 46:00, 40 km, 4 d, 16 n | 82,5 | **81,5** | 54,8 | 20,5 km | 25 % | 71 / 63 / 32 | isto kao 2776b5d (prag 4:46 umesto 4:42) |
| p02 | 5 km 20:25, 40 km, 4 d, 14 n | 81 | **82** | 53,9 | 20,5 km | 24 % | 66 / 61 / 32 | ned 8–9 dva rada u tempu trke + prag, uredno |
| p03 | spor, 25 km, 3 d, 16 n | 77 | **77** | 38,2 | 2 h 15 | 25 % | 77 / 55 / 26 | na plafonu ulaza |
| p04 | spor, 55 km, 5 d, 20 n | 80 | **79,5** | 65,4 | 2 h 11 | 18 % | 75 / 57 / 33 | dugi 2 h 10 sedam puta (objašnjeno); ned 13 samo jedan kvalitet |
| p05 | brz, 90 km, 6 d, 16 n | 82 | **80,5** | 113,2 | 28 km | 19 % | 71 / 61 / 34 | dugi 24 km × 9, pa 25,5 → 28 km |
| p06 | brz, 35 km, 5 d, 10 n | 75 | **71** | 49,0 | 16,5 km | 24 % | 76 / 72 / 51 | bolje od 2776b5d (kvalitet u ned 4, 8, 9), ali ned 6 bez kvaliteta i sužavanje plitko |
| p07 | VDOT 45, 55 km, 5 d, 10 n | 80,5 | **80,5** | 71,8 | 21,5 km | 21 % | 77 / 67 / 34 | — |
| p08 | VDOT 45, 45 km, 3 d, 20 n | 75,5 | **74** (73,3) | 53,0 | 22,5 km | 25 % | 64 / 55 / 28 | kreće sa 41,2 km; ned 14 → 15: 46 → 53 km (+15 %) |
| p09 | po osećaju, 45 km, 4 d, 16 n | 81 | **81** | 62,3 | 22 km | 25 % | 72 / 61 / 30 | prag 2 × 18 dve nedelje zaredom (ned 9, 10) |
| p10 | po osećaju, 25 km, 3 d, 20 n | 76 | **76,5** (73,5) | 40,1 | 2 h 15 | 25 % | 72 / 52 / 25 | ned 14 → 15: 35 → 40,1 km (+15 %) |
| p11 | početnik, 20 km, 4 d, 20 n | 80,5 | **80,5** | 39,1 | 1 h 55 | 21 % | 72 / 64 / 31 | prognoza sada −3 % (2:00:29), dobro; oznake faza ned 12–15 |
| p12 | početnik po osećaju, 45 km, 5 d, 16 n | 81 | **78,5** | 60,1 | 2 h 10 | 22 % | 73 / 62 / 30 | „vršna nedelja" u ned 10 od 16; dugi 1 h 40 tri nedelje; faze skaču |
| **prosek** | | **79,3** | **78,5** | | | | | |

U zagradi: „Plan sa proverama" gde postoji nalaz. Na ≥ 80: **6 od 12** (p01, p02, p05, p07, p09, p11); prag rubrike
je 7. Uz pomak merila od ~1 poen (§ 0) p04 (79,5) i p12 (78,5) su na granici.

**K-provere:** K1, K2, K3, K5, K6, K8 bez nalaza (lagani 18–19 min dan pred trku ne računam kao zaseban trening).
K4: bez nalaza u čitanim delovima. **K7:** p08 ned 15 (+15 %) i p10 ned 15 (+15 %) posle nedelje koja nije
rasterećenje → progresija ≤ 6 u oceni sa proverama. Dugi: nijedan skok veći i od +2 km i od +12 % (p05 25,5 → 28 km
= +2,5 km / +10 %; p11 55 → 65 min je +1,5 km).

**Planovi vlasnika (nisu u proseku):**
- **vlasnik-v1 — 78.** 10 nedelja, 30 → 38,2 km, dugi do 15 km. Upozorenje je uzorno (šta, šta znači za trku,
  „12 nedelja → 41,5 km, dugi 17,5 km"). Slabije: sužavanje 79 / 74 / 40 % (nedelja −2 nosi tempo trke 4,5 km +
  3 km u dugom, 21 %).
- **vlasnik-v2 — 80,5.** Počinje dan posle polumaratona: ned 1 13 km (tri trčanja 20–35 min), prvi prag 24. 12.
  (11. dan) uz zamenu ako je umoran; 30 → 46,7 km za 18 nedelja; dugi do 18,5 km; nedelja −3 25 %, sužavanje
  69 / 66 %; trka u subotu, oštrenje utorak. Slabije: ned 2 već 28,8 km (96 % uobičajenog) i dugi 11,5 km 8 dana
  posle trke; subotnji lagani 4–5,5 km.

**Popravljeno (prema 2776b5d):** p06 ima kvalitet u ned 4, 8, 9 (upozorenje sada „2 od 7"); p11 prognoza 2:00:29
umesto 1:57:11; p07/p08 prag 4:36 (isti rezultat, više nije brži uz manji obim); I/R bez dokaza sa kraće trke više
nisu brži.
**Pogoršano:** ništa u planovima.

## B. Prilagođavanje

| događaj | k7 (prethodni) | **sada** | scenariji |
|---|---|---|---|
| E1 rezultat | 85,3 | **82,3** | s01 85 · s02 79 · s03 85 · s04 80 |
| E2 bolest | 82,5 | **71,8** | s05 **60** · s06 81,5 · s07 74,5 · s08 71 |
| E3 propušteno | 84,5 | **83,1** | s09 83 · s10 84 · s11 83 · s12 82,5 |
| E4 bol | 79,8 | **78,0** | s13 80 · s14 81 · s15 73 · s16 78 |
| E5 juče trka | 85,0 | **81,6** | s17 80,5 · s18 82 · s19 84 · s20 80 |
| E6 ništa | 91,0 | **90,8** | s21–s23 91 · s24 90 |
| E7 dva događaja | 77,7 | **78,3** | s25 82 · s26 71 · s27 82 |
| **deo B** | **83,7** | **80,8** | |

**Šta je dobro (viđeno u danima):**
- s14 popravljen: subota 55 min uz dugi 95 min, pa dugi 1 h 50 (+15 min); usponi izbačeni, prvi I 3 × 3 i prag
  2 × 6 smanjeni.
- s13 popravljen: prvi blok u tempu trke posle bola 5,5 km (61 % od 9), ned 11 sve lagano.
- s26: dan trke je trka, test 9 dana posle trke izbačen, obe zone usporene i tekst to kaže po zoni.
- s06: povratak 25 → 41 → 49 km, poslednji blok smanjen na 16 min, ned 18 netaknuta.
- s12: dugi posle dva propuštena kreće od poslednjeg odrađenog (1 h 55), bez bloka; najteža nedelja ostaje.
- E6: otisak isti, prognoza pomera se 2 s.

**Greške nađene čitanjem:**
1. **s05 (bolest 7 dana u ned 6, p01) — 43 izmene, ceo ostatak plana srazmerno snižen:** ned 7–11 20,5 / 26,5 /
   31,9 / 36,1 / 42,9 km, pa najteža nedelja (ned 13) 36,2 km umesto 50, najduži dugi do trke **94 min (15,5 km)
   umesto 2 h 4**, cilj prelazi u „van raspona". Bolest 10 nedelja pred trku ne opravdava gubitak vrha: dobar
   trener vraća prvobitan plan od ned 9 uz vrh 52–54 km. Plan je bio dobar u krugu 6 (22 → 33,5 → 40,4 → 48,5 km,
   pa prvobitan plan); ovo je posledica kruga 9b (A10 b „povratak najviše 2 × prekid + 7 dana" i A17 „izgubljen
   obim").
2. **s07 (p11, ned 10):** isto pravilo — „od 8. 2. ostatak plana je srazmerno niži": ned 11 15,4 km (50 % poslednje odrađene), vrh
   30 umesto 39 km do kraja.
3. **s08 (p12, bolest 3 nedelje pred trku):** ned 14 22 km (dobro), ali ned 15 (nedelja −1) je pet trčanja od
   20–35 min i „dugi 35 min" (17,3 km) — nijedan podražaj u tempu trke od ned 12 do oštrenja.
4. **s26:** tri dana posle trke dugi 90 min, a poslednji odrađen 60 min (+50 %), usred povratka posle bola. Krug 7
   je ovo tražio; nije urađeno. Tekst dva puta kaže da se provera izostavlja i tvrdi „provera forme je bila deo
   plana" za trku koja to nije bila.
5. **Tekst izmene navodi pogrešan rezultat (s02):** „Rezultat 10 km za 55:35 (28. 11.) pokazuje bolju formu…" —
   događaj je trka 53:54 od 23. 1. (rečenica „zašto" to tačno navodi). Isti kvar kao 10 km s01 u krugu 1: popravljen
   je samo kad u istoriji nema ranijeg rezultata. U svim p12 scenarijima (s04, s08, s12, s16, s24) spisak izmena
   ponovo objavljuje test od 28. 11. kao novu promenu.
6. **E5 (s17, s18, s20):** dugi u drugoj nedelji posle polumaratona 90–100 % uobičajenog (s17 15 km, s18 1 h 40,
   s20 90 min); pravilo je ≤ 60 % dve nedelje. Prvi brz trening 11. dan je dobar.
7. s15 (p11, bol posle dugog): ned 12 12,6 km, ned 13 30,9 km (+145 %) — obim se vraća brže od dugog.

## C. Personalizacija

| par | k6/k7 | **sada** | C1 | C2 | C3 | C4 | C5 | viđeno |
|---|---|---|---|---|---|---|---|---|
| P1 stabilan / povratnik | 85 | **85** | 8,5 | 8,5 | 8,5 | 8,5 | 9 | A 40,8 → 53,3 km, dugi 16 → 21; B 33,6 → 49,6 km, dugi 13,5 → 19,5, dve nedelje samo ubrzanja i brda 15 s, test ned 4, forma 1:51:59 „niska" sa rasponom 1:45–1:56 |
| P2 početnik / nov + tegoba | 84 | **83** | 8,5 | 8 | 8 | 8,5 | 9 | A 20 → 40,4; B 10,4 → 30,8 (× 1,5), hod-trk, prognoza B bez napretka (2:06:30, raspon 1:56–2:23); B ned 1 → 2 10,4 → 20,7 km (× 2) |
| P3 prebrzo / spori + prag | 83 | **83** | 8,5 | 8 | 8,5 | 8,5 | 7,5 | A dve nedelje bez kvaliteta, upozorenje o laganom tempu, prvi prag 23 min (traženo 15–20); B prag 22 min u ned 1, dugi 2 h 10 od ned 1 (ispravljeno); A je označen kao „povratnik" |
| **deo C** | **84,0** | **83,7** | | | | | | |

## D. Ispravke (najviše 8)

**MOTOR**
1. **Bolest/pauza ne snižava ostatak plana srazmerno.** Posle prozora povratka plan se vraća na prvobitan; vrh se
   spušta najviše 5–10 % ako je izgubljena nedelja u poslednjih 6 pred trku, a najduži dugi ostaje ≥ 90 %
   prvobitnog ako je do trke ≥ 6 nedelja (s05: ned 13 ~48–50 km, dugi ~19 km; s07 isto). Vratiti ponašanje iz kruga 6.
2. **Granica dugog posle prekida meri se od poslednjeg STVARNO istrčanog dugog i važi i posle trke i pauze zbog
   puta** (+25 % / +20 min): s26 60 → najviše 75–80 min tri dana posle trke (bolje: 60 min).
3. **Tekst izmene opisuje samo događaj koji ju je izazvao:** rezultat po datumu događaja (s02), bez ponovnog
   objavljivanja ranijeg testa (p12: s04, s08, s12, s16, s24); jedna rečenica o izostavljenoj proveri (s26).
4. **Kasna bolest (≤ 3 nedelje do trke):** nedelja −1 ≈ 55–65 % uobičajenog sa jednim kratkim radom u tempu trke
   (2 × 5–8 min) i dugim 60–70 min, ne pet trčanja od 20 min (s08).
5. **E5:** dugi u nedeljama 1–2 posle polumaratona ≤ 60 % uobičajenog (s17, s18, s20); obim nedelje 2 ≤ 75 %.

**PODATAK (HM)**
6. p06: nedelja −1 ≤ 70 % vrha i nedelja trke ≤ 45 %; ned 6 dobija jedan kvalitet (prag 2 × 8 min) umesto nule.
7. p08: nedelja 1 = sadašnji obim (45, ne 41,2 km); p08/p10 ned 15 ne raste > 12 % posle nedelje koja nije
   rasterećenje (ravnomernije ned 13–15).
8. Oznake faza: nedelja provere nosi fazu nedelja oko sebe (p11 ned 12 „specifična" između „razvoja"; p12 ned 8);
   „vršna nedelja" je stvarno najveća nedelja pred specifičnu (p12 ned 10 od 16 → ned 13).

## E. Presuda

**HM nije zatvoren u ovom stanju — zbog prilagođavanja, ne zbog planova.** Planovi su na nivou kruga 6/7 (nijedan
lošiji, tri bolja), i to smatram zatvorenim: 6 od 12 na ≥ 80 na mom merilu odgovara 7–8 od 12 na merilu
prethodnog trenera (§ 0), a četiri profila (p03, p06, p08, p10) su na plafonu ulaza. Ali krug 9b je u E2 uveo
pravilo koje posle bolesti od 7 dana trajno seče ostatak plana (s05 60, s07 74,5): deo B pada sa 83,7 na 80,8,
tik iznad praga. Zatvaranje traži ispravke 1 i 2 (motor, nasleđuju ih sve distance) i ponovni pogled na s05, s07,
s08, s26; očekujem B ≈ 83–84 i zbirnu ≈ 81,5–82.

Za pregled vlasnika:
- **s05** — ned 9–16 posle bolesti: najteža nedelja 36 km, dugi do 94 min, cilj „van raspona".
- **s08** — nedelja pred trku posle bolesti: pet trčanja od 20–35 min.
- **vlasnik-v2** — ned 1–2 posle polumaratona 13. 12.: 13 km pa 28,8 km i prag 11. dana.

Ograničenja: s03, s11, s21–s23, s25, s27 ocenjeni iz pregleda i brojeva po nedelji; parovi delom iz brojeva;
K4 proveravan samo u pročitanim delovima; svi scenariji su sintetički („urađeno" je tačno po planu).

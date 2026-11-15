# Glavni trener — R19B: novo merilo (plafon ulaza), sve četiri distance (14. 11. 2026)

Nov trener-sudija. Stanje **ef506f4c** (isto kao R19). Ocene „Plan (stara skala)" su prepisane iz `ROUND-V4-HM-12`,
`-10K-05`, `-MAR-03`, `-5K-03` i nisu menjane. Novo je: razvrstavanje svih 59 profila (urađeno i push-ovano PRE
čitanja planova: `R19B-RAZVRSTAVANJE.md`, commit 23aac07c) i ocena „Plan za ulaz" po RUBRIC-V4 § A3 za 11 profila
sa plafonom ulaza. Tih 11 planova čitano je dan po dan; zbirovi, udeli dugog i skokovi računati iz dana, ne iz
zaglavlja. `judge2/` i `LOG.md` nisu čitani.

## 1. Zbir

| distanca | ulaz dozvoljava: prolazi (stara ≥ 80) | plafon ulaza: prolazi (Plan za ulaz ≥ 80) | ukupno prolazi |
|---|---|---|---|
| polumaraton | 7 od 10 | 0 od 2 | 7 od 12 |
| 10 km | 4 od 12 | — (nema) | 4 od 12 |
| maraton | 8 od 12 | 0 od 7 | 8 od 19 |
| 5 km | 4 od 14 | 0 od 2 | 4 od 16 |
| **ukupno** | **23 od 48** | **0 od 11** | **23 od 59** |

Vlasnik (van zbira): v1 78 — ne prolazi; v2 81,5 — prolazi; oba „ulaz dozvoljava".

**Nijedan plan sa plafonom ulaza ne prolazi novo merilo** (raspon 57,7–74,5; najbliži maraton p08 74,5 i p03 73).
Razlog je isti kod gotovo svih i nije u nedeljama treninga: **bezbednost je svuda 7,5–8,5, a iskrenost 4–7**.
Plan upozori da obim i dugi ne nose distancu, a onda u prognozi i planu trke zada tempo iz forme na kraćim
deonicama — bez kazne, ponekad i sa „napretkom". Trener sa istim ulazom ne bi napravio mnogo drugačije nedelje, ali
bi trkaču rekao drugo vreme i drugačiji početak trke.

## 2. Tabele po distanci

### Polumaraton — dozvoljava 7 od 10 prolazi · plafon ulaza 0 od 2 prolazi

| profil | grupa | razlog razvrstavanja | Plan (stara) | Plan za ulaz | prolazi | šta deli od 80 |
|---|---|---|---|---|---|---|
| p01 | dozvoljava | 40 km · 16 ned · 4 dana | 82 | — | da |  |
| p02 | dozvoljava | 40 km · 14 · 4 | 82 | — | da |  |
| p03 | **plafon** | 3 dana na 25 km: dugi je polovina nedelje | 76,5 | **68,5** | **ne** | v. § 3 |
| p04 | dozvoljava | 55 km · 20 · 5 | 80 | — | da |  |
| p05 | dozvoljava | 90 km · 16 · 6 | 80,5 | — | da |  |
| p06 | dozvoljava | 10 ned na pragu, 5 dana (nesiguran) | 72 | — | **ne** | tri upozorenja od kojih je jedno netačno i protivreči drugom, a 6. nedelja nema nijedan kvalitet |
| p07 | dozvoljava | 55 km · 10 · 5 | 80,5 | — | da |  |
| p08 | dozvoljava | 3 dana, ali 45 km i 20 ned (nesiguran) | 74 | — | **ne** | kreće sa 41,2 km uz sadašnjih 45, 15. nedelja skače +15 %, a brz rad je 24–25 % u tri nedelje |
| p09 | dozvoljava | 45 km · 16 · 4 | 81 | — | da |  |
| p10 | **plafon** | 3 dana na 25 km, kao p03 | 76 | **67** | **ne** | v. § 3 |
| p11 | dozvoljava | 20 ned i 4 dana nadoknađuju 20 km | 81 | — | da |  |
| p12 | dozvoljava | 45 km · 16 · 5 | 79,5 | — | **ne** | dugi stoji 1 h 40 prve tri nedelje, a tempo trke se prvi put javlja tek u 11. od 16 nedelja |

### 10 km — dozvoljava 4 od 12 prolazi · plafon ulaza: nema

| profil | grupa | razlog razvrstavanja | Plan (stara) | Plan za ulaz | prolazi | šta deli od 80 |
|---|---|---|---|---|---|---|
| p01 | dozvoljava | 41 km · 16 · 4 | 81,5 | — | da |  |
| p02 | dozvoljava | 8 ned na pragu uz 30 km (nesiguran) | 75 | — | **ne** | lagani dani od 4,5 km / 25 min i nedelja −1 na 73 % vrha |
| p03 | dozvoljava | 3 dana nose 10 km; 12 ned | 78 | — | **ne** | obim se ljulja (23,7 / 21,3 / 24,6 / 26,5 / 24,6 / 19,5 km) pa jedna vršna od 28,4 km; dugi 80 min tri nedelje zaredom |
| p04 | dozvoljava | 50 km · 18 · 5 | 79 | — | **ne** | dugi 100 min devet nedelja, nijednom sa završnicom u tempu trke |
| p05 | dozvoljava | 80 km · 12 · 6 | 81 | — | da |  |
| p06 | dozvoljava | 8 ned na pragu uz 31 km (nesiguran) | 72,5 | — | **ne** | nedelja −1 na 78 % vrha, tri upozorenja i lagani dani od 5 km / 24 min |
| p07 | dozvoljava | 51 km · 8 · 5 | 80,5 | — | da |  |
| p08 | dozvoljava | 3 dana nose 10 km | 75 | — | **ne** | kreće sa 38,9 km uz sadašnjih 41 i stoji 39–44 km četrnaest nedelja |
| p09 | dozvoljava | 41 km · 12 · 4 | 81 | — | da |  |
| p10 | dozvoljava | 3 dana, 20 km, ali 18 ned (nesiguran) | 77,5 | — | **ne** | obim stoji 25–29 km od 6. do 15. nedelje uz tri nedelje provere; dugi posle provere skače +2,6 do +3,9 km |
| p11 | dozvoljava | 18 ned za početnika na 10 km | 79,5 | — | **ne** | dugi 75 min pet puta i obim 23,5–24,7 km od 10. do 15. nedelje — fali jedna nedelja stvarnog vrha |
| p12 | dozvoljava | 36 km · 12 · 4 | 77,5 | — | **ne** | rast samo 35 → 40,6 km: 2. nedelja jednaka prvoj, 4–8. nedelja ista (38 km, dugi 85 min) |

### Maraton — dozvoljava 8 od 12 prolazi · plafon ulaza 0 od 7 prolazi

| profil | grupa | razlog razvrstavanja | Plan (stara) | Plan za ulaz | prolazi | šta deli od 80 |
|---|---|---|---|---|---|---|
| p01 | dozvoljava | 40 km · 16 · 4, na pragu (nesiguran) | 80,5 | — | da |  |
| p02 | dozvoljava | 40 km · 18 · 4 | 82 | — | da |  |
| p03 | **plafon** | 3 dana i 30 km; trka > 4 h 45 | 75,5 | **73** | **ne** | v. § 3 |
| p04 | dozvoljava | 65 km · 24 · 5 | 78,5 | — | **ne** | dugi 23,5 km već u prvoj nedelji i zatim 2 h 40–3 h 10 u talasu bez daljeg rasta |
| p05 | dozvoljava | 110 km · 18 · 6 | 81,5 | — | da |  |
| p06 | **plafon** | 12 ned sa 40 km | 74 | **65,5** | **ne** | v. § 3 |
| p07 | dozvoljava | 12 ned, ali 65 km i 5 dana (nesiguran) | 81 | — | da |  |
| p08 | **plafon** | 3 dana: dugi je 45–55 % nedelje (nesiguran) | 78 | **74,5** | **ne** | v. § 3 |
| p09 | dozvoljava | 50 km · 18 · 4 | 81,5 | — | da |  |
| p10 | **plafon** | 3 dana i 30 km | 75,5 | **70** | **ne** | v. § 3 |
| p11 | dozvoljava | 25 km, ali 24 ned (nesiguran) | 75 | — | **ne** | dugi stoji na 2 h 15 pet nedelja i staje na 22,6 km / 2 h 38 iako 24 nedelje nose 2 h 50–3 h dva puta |
| p12 | dozvoljava | 50 km · 18 · 5 | 80,5 | — | da |  |
| p13 | **plafon** | 10 ned, 28 km, 3 dana | 71 | **69,8** | **ne** | v. § 3 |
| p14 | dozvoljava | 85 km · 16 · 6 | 82,5 | — | da |  |
| p15 | dozvoljava | 40 km · 20 · 5 | 78,5 | — | **ne** | lagani dani 30–35 min jedanaest nedelja uz dugi od 2 h+, pa dugi nosi 45–50 % nedelje |
| p16 | dozvoljava | 45 km · 18 · 4 | 79,5 | — | **ne** | dugi od 2 h 15 u prvoj nedelji (49 % nedelje) trkaču sa skorašnjom tegobom u kolenu |
| p17 | dozvoljava | 90 km · 18 · 6 | 81 | — | da |  |
| p18 | **plafon** | 30 km uz 20 ned, početnik (nesiguran) | 72,5 | **66,8** | **ne** | v. § 3 |
| p19 | **plafon** | 8 ned | 72 | **69** | **ne** | v. § 3 |

### 5 km — dozvoljava 4 od 14 prolazi · plafon ulaza 0 od 2 prolazi

| profil | grupa | razlog razvrstavanja | Plan (stara) | Plan za ulaz | prolazi | šta deli od 80 |
|---|---|---|---|---|---|---|
| p01 | dozvoljava | 42 km · 12 · 4 | 82 | — | da |  |
| p02 | dozvoljava | 31 km · 8 · 4 | 73,5 | — | **ne** | obim ne raste (31 → 33,8 km), lagani dani 22 min u tri nedelje, nedelja −1 na 75 % |
| p03 | dozvoljava | 3 dana nose 5 km | 75 | — | **ne** | obim stoji 15,3–16 km od 3. do 7. nedelje, dugi 45 min četiri puta, lagani dan 20–25 min |
| p04 | dozvoljava | 46 km · 16 · 5 | 79 | — | **ne** | obim stoji 48–50 km od 2. do 11. nedelje, a dugi 90 min deset puta |
| p05 | dozvoljava | 67 km · 10 · 5 | 82 | — | da |  |
| p06 | dozvoljava | 6 ned na pragu (nesiguran) | 65,5 | — | **ne** | nedelja 5 bez ijednog brzog treninga, nedelje 2–4 pet dana po 22 min sa jednim kvalitetom, tri upozorenja |
| p07 | dozvoljava | 6 ned na pragu (nesiguran) | 78,5 | — | **ne** | sužavanje počinje već u 4. od 6 nedelja (82 % pa 70 %), a ponedeljak i subota padaju na 5 km |
| p08 | dozvoljava | 3 dana nose 5 km | 73,5 | — | **ne** | obim ravan 33–36 km šesnaest nedelja i nema predloga 4. dana |
| p09 | dozvoljava | 32 km · 10 · 4 | 77,5 | — | **ne** | nedelja −1 na 76 % vrha i lagani dani 20–22 min |
| p10 | dozvoljava | 3 dana nose 5 km | 76 | — | **ne** | obim stoji 16,3–17,8 km od 6. do 13. nedelje, dugi 55 min šest puta, tri nedelje provere u 16 |
| p11 | dozvoljava | 16 ned i 5 km | 80 | — | da |  |
| p12 | dozvoljava | 48 km · 10 · 4 | 76,5 | — | **ne** | plan kreće sa 43,5 km i nikad ne stiže sadašnjih 48 km (najviše 44,4) |
| p13 | **plafon** | staž 6 nedelja, 11 km (nesiguran) | 75,5 | **57,7** | **ne** | v. § 3 |
| p14 | **plafon** | 4 ned | 75,5 | **69,8** | **ne** | v. § 3 |
| p15 | dozvoljava | 20 km · 14 · 4 | 75,5 | — | **ne** | lagani dani od 20 min u sedam nedelja |
| p16 | dozvoljava | 25 km · 12 · 4 | 80 | — | da |  |
## 3. Plan za ulaz — obrazloženja (11 profila)

Težine: bezbednost 30 %, iskorišćenost ulaza 30 %, iskrenost 25 %, šta ostaje posle trke 15 %. Realna vremena koja
navodim su moja trenerska procena [srednja pouzdanost], ne podatak.

**Polumaraton p03 — 68,5** (stara 76,5) · bezbednost 7,5 · iskorišćenost 8 · iskrenost 4 · posle trke 8
- *Bezbednost:* nema skoka ni K2/K7, ali ned 13 ima 25 % brzog rada (prag 2 × 15 min + 35 min tempa trke u dugom) — na ivici K6. *Iskorišćenost:* tri dana su iskorišćena: utorak do 75 min, kvalitet svake nedelje, dugi do 2 h 15 (18,2 km) sa blokovima. *Iskrenost:* plan nema nijedno upozorenje: ne kaže da su 3 dana i 25 km malo za polumaraton, a prognoza računa napredak (2:06:45). *Posle trke:* ostavlja 38 km nedeljno i dugi od 18 km — dobra osnova.
- **Ispravka — PODATAK: vratiti upozorenje o 3 dana sa brojem (4. dan od 40 min → nedelja ≈ 40 km, dugi 18 km pada sa 48 % na ispod 45 %) i prognozu bez napretka dok ga provera ne potvrdi.**

**Polumaraton p10 — 67,0** (stara 76) · bezbednost 7,5 · iskorišćenost 7,5 · iskrenost 4 · posle trke 8
- *Bezbednost:* isto kao p03: ned 17 ima 25 % brzog rada; ostalo mirno. *Iskorišćenost:* dugi stoji 1 h 55–2 h 1 od 9. do 14. nedelje, pa 2 h 15 jednom — 20 nedelja daje isti vrh kao 16 kod p03. *Iskrenost:* jedino upozorenje je o nedostatku rezultata; prognoza 2:11 iz laganog tempa 7:30/km je 15–20 min prebrza, a dugi od 18 km traje duže od prognozirane trke. *Posle trke:* 40 km nedeljno i dugi 18 km.
- **Ispravka — MOTOR: procena iz laganog tempa ne sme dati tempo trke brži od laganog za više od ≈ 45 s/km na polumaratonu (ovde 1:16); uz to upozorenje o 3 dana kao kod p03.**

**Maraton p03 — 73,0** (stara 75,5) · bezbednost 8 · iskorišćenost 8 · iskrenost 5,5 · posle trke 7,5
- *Bezbednost:* bez nalaza; dugi 3 h 1 min sa 51 min tempa maratona tri nedelje pred trku je zahtevan, ali podnošljiv. *Iskorišćenost:* najbolje iskorišćen plan sa 3 dana: utorak do 1 h 45, pripremni polumaraton, dugi 2 h 49 i 3 h 1. *Iskrenost:* upozorenje govori samo o obimu, ne o 3 dana; prognoza 4:33 (6:28/km) uz dugi od 25 km i lagan tempo 7:13–7:56 je 15–30 min prebrza; „hod-trk kao na dugim" iako dugi nisu hod-trk. *Posle trke:* 47 km i dugi od 3 h; kaže 26 dana bez brzog.
- **Ispravka — MOTOR: kad plan ima upozorenje o obimu ili dugom, očekivano vreme dobija kaznu i širi raspon (ovde 4:45–5:10) i trka kreće 15–20 s/km sporije od tempa iz forme; upozorenje predlaže 4. dan.**

**Maraton p06 — 65,5** (stara 74) · bezbednost 8 · iskorišćenost 5,5 · iskrenost 5,5 · posle trke 7,5
- *Bezbednost:* bez nalaza; rast 40 → 56 km uz dva rasterećenja. *Iskorišćenost:* za trkača od 2:52 najveća nedelja traje 4 h 23, dugi 26 km manje od 2 h, prag 11–15 min svih 12 nedelja bez rasta, lagani 29–37 min. *Iskrenost:* četiri upozorenja; prognoza obećava napredak (2:50:20) dok upozorenja kažu da će tempo pasti — realno 3:00–3:10. *Posle trke:* 56 km i dugi 26 km.
- **Ispravka — PODATAK: brzom trkaču granice po vremenu, ne po km — dugi do 2 h 20 (30 km), prag 20–30 min, lagani ≥ 40 min; vrh ≈ 65 km.**

**Maraton p08 — 74,5** (stara 78) · bezbednost 8 · iskorišćenost 7 · iskrenost 7 · posle trke 8
- *Bezbednost:* bez nalaza; prvi dugi 23,5 km je visok, ali trkač već trči 50 km u tri treninga. *Iskorišćenost:* utorak 17–20 km je dobro rešenje, ali dugi za 24 nedelje raste samo 23,5 → 28,5 km, a tempo maratona se ozbiljno javlja tek od 18. nedelje. *Iskrenost:* jedno tačno upozorenje sa predlogom 4. dana (75 min → dugi 30 km); ne kaže šta 3 dana znače za vreme, a prognoza računa napredak od 5 min. *Posle trke:* 65 km i dugi 28,5 km.
- **Ispravka — PODATAK: sa 24 nedelje i 3 dana dugi dva puta do 30–32 km (2 h 55–3 h 5) i blok tempa maratona u dugom od 12. nedelje.**

**Maraton p10 — 70,0** (stara 75,5) · bezbednost 8 · iskorišćenost 7 · iskrenost 5,5 · posle trke 7,5
- *Bezbednost:* bez nalaza. *Iskorišćenost:* dugi stoji 2 h 5–2 h 40 od 5. do 18. nedelje, vrh 46,9 km kao kod p03 sa 18 nedelja — šest nedelja više nije donelo ništa; tri nedelje provere. *Iskrenost:* tri upozorenja, nijedno o 3 dana; prognoza 4:30 iz laganog tempa 7:30/km (6:25/km kroz maraton) je nerealna — realno 5:00–5:30. *Posle trke:* 47 km i dugi od 3 h.
- **Ispravka — MOTOR: procena maratona iz laganog tempa (sada 65 s/km brže od laganog) — za ovakav ulaz tempo trke ≈ lagani tempo, raspon do 5 h 30.**

**Maraton p13 — 69,8** (stara 71) · bezbednost 8 · iskorišćenost 6,5 · iskrenost 6 · posle trke 7,5
- *Bezbednost:* bez nalaza; dugi hod-trk raste 10–15 min, rasterećenje u 6. nedelji. *Iskorišćenost:* četvrtak je 34–50 min sa 10–22 min rada — trećina dana potrošena na trening koji maratonu ovde ne treba; dugi staje na 2 h 30. *Iskrenost:* upozorenja su konkretna (16 nedelja, polumaraton na isti datum), ali ih je tri, piše „tek počinješ da trčiš" trkaču sa polumaratonom 2:15, a prognoza 4:42 uz hod-trk i dugi od 19 km je 20–40 min prebrza. *Posle trke:* 35 km i navika od 3 dana; kaže šta treba za sledeću trku.
- **Ispravka — PODATAK: četvrtak 60–75 min lagano sa 2 × 6–10 min tempa maratona, dugi do 2 h 45 (21 km) — nedelja 38–40 km umesto 34,8.**

**Maraton p18 — 66,8** (stara 72,5) · bezbednost 8,5 · iskorišćenost 6 · iskrenost 4,5 · posle trke 8
- *Bezbednost:* najmirniji plan skupa; rasterećenje na dve nedelje daje rezervu. *Iskorišćenost:* od prvih 11 nedelja četiri su rasterećenje ili provera; dugi je 2 h 20 tek u 13. nedelji i 2 h 45 jednom; lagani 40 min prve tri nedelje. *Iskrenost:* četiri upozorenja; prognoza 4:30 (raspon od 4:03) za početnika sa laganim tempom 7:30/km i ciljem „samo da završim" — realno 5:15–5:45; nema predloga polumaratona. *Posle trke:* 48 km, 4 dana, dugi 2 h 45.
- **Ispravka — MOTOR: uz cilj „samo da završim" i procenu iz laganog tempa prognoza je raspon do realnog vremena hod-trka (5 h 15–5 h 45), ne 4:30; upozorenje nudi polumaraton.**

**Maraton p19 — 69,0** (stara 72) · bezbednost 8 · iskorišćenost 6,5 · iskrenost 6 · posle trke 7
- *Bezbednost:* bez nalaza; dugi +2 km nedeljno, rasterećenje u 4. nedelji. *Iskorišćenost:* dugi staje na 22,5 km (47 % nedelje) iako bi 25 km u N−3 bio bezbedan; četvrtak 6–7,5 km sa pragom 12–18 min umesto srednje dugog. *Iskrenost:* upozorenja su konkretna (16 nedelja, 60 km, 26 km, polumaraton), ali su tri i dva se ponavljaju; prognoza 4:02 i plan trke „od 10. do 32. km 5:45/km" protivreče rečenici „trku počni sporije". *Posle trke:* 48 km i dugi 22,5 km; 23 dana bez brzog.
- **Ispravka — MOTOR: isto kao MAR p03 — kazna u prognozi (4:10–4:30) i sporiji početak u planu trke kad upozorenje kaže da dugi ne nosi distancu.**

**5 km p13 — 57,7** (stara 75,5) · bezbednost 8,5 · iskorišćenost 4,5 · iskrenost 4,5 · posle trke 5
- *Bezbednost:* bezopasan; ništa ne može da povredi. *Iskorišćenost:* lagani 20 min šest nedelja, dugi hod-trk 5 + 1 od prve do poslednje nedelje bez promene odnosa, tri nedelje sužavanja sa vrha od 12,7 km — trkač nijednom ne trči 5 km u komadu. *Iskrenost:* tri upozorenja; „treba 15 km nedeljno" i „duža priprema ne pomaže" nisu tačni za početnika; prognoza 30:40 je optimistična; ne kaže da je cilj istrčati celu trku i da je hod dozvoljen. *Posle trke:* posle trke je tamo gde je bio: 12 km nedeljno, 25 min u komadu.
- **Ispravka — PODATAK: početnički šablon — neprekidno trčanje 20 → 30–35 min, dugi 5 + 1 → 8 + 1 → 40 min u komadu, jedna laka nedelja pred trku umesto tri; upozorenje: „cilj je istrčati celu trku, očekuj 32–36 min".**

**5 km p14 — 69,8** (stara 75,5) · bezbednost 8 · iskorišćenost 7 · iskrenost 6 · posle trke 6,5
- *Bezbednost:* bez nalaza; dva kvaliteta u prvoj nedelji su umerena. *Iskorišćenost:* za 4 nedelje gotovo sve je tu; druga nedelja ima jedan pravi kvalitet (tempo trke 5 × 1 km), treća samo 3 × 800 m. *Iskrenost:* prognoza je poštena (6 s napretka), ali upozorenje je prepisano sa dugih distanci („završni deo trke biće teži od svega u pripremi", „dugi do 12,1 km") i ne kaže šta 4 nedelje stvarno znače. *Posle trke:* ništa se ne gradi; nema reči o nastavku.
- **Ispravka — PODATAK: upozorenje za kratku pripremu na 5 km („4 nedelje samo izoštravaju postojeću formu; za napredak 8–10 nedelja") i drugi kvalitet u 2. nedelji.**
## 4. Ispravke po učinku

| # | vrsta | ispravka | profili | dobitak na „Plan za ulaz" |
|---|---|---|---|---|
| 1 | MOTOR | Kad plan nosi upozorenje o obimu ili dugom: očekivano vreme dobija kaznu i širi raspon, nema „napretka", a plan trke kreće sporije od tempa iz forme — upozorenje, prognoza i napomena za trku moraju da kažu isto | maraton p03, p06, p13, p19 | +5 do +7 |
| 2 | MOTOR | Procena iz laganog tempa: tempo trke ne brži od laganog za više od ≈ 45 s/km na polumaratonu i ≈ 0–20 s/km na maratonu (sada 65–76 s/km) | maraton p10, p18; HM p10 | +6 do +9 |
| 3 | PODATAK | Upozorenje o 3 dana sa predlogom 4. dana i brojem i na polumaratonu i na maratonu (sada ga ima samo maraton p08) | HM p03, p10; maraton p03, p10 | +4 do +10 |
| 4 | PODATAK | Dugi na maratonu se ograničava vremenom (do 3 h; brz trkač do 2 h 20) i sme do 55 % nedelje u dve najduže nedelje | maraton p06, p08, p13, p18, p19 | +3 do +6 |
| 5 | PODATAK | Početnički šablon 5 km: neprekidno trčanje raste, odnos hod-trka se menja, jedna laka nedelja umesto tri sužavanja, pošteno upozorenje | 5 km p13 | +15 |
| 6 | PODATAK | Četvrtak malih maratonskih planova: 60–75 min lagano umesto praga 12–18 min; brzom trkaču prag 20–30 min | maraton p13, p19, p06 | +3 do +5 |
| 7 | MOTOR | Najviše dva upozorenja; „mali obim" i „kratak dugi" su jedno upozorenje | maraton p06, p10, p13, p18, p19; 5 km p13 | +1 do +2 |
| 8 | PODATAK | Tekst upozorenja o kratkoj pripremi po distanci (5 km ne govori o dugom i „završnom delu trke") | 5 km p14 | +4 |
| 9 | PODATAK | Polumaraton sa 3 dana: nedelja sa pragom 2 × 15 min i 35 min tempa trke u dugom ima 25 % brzog rada — skratiti jedno | HM p03, p10 | +1,5 |
| 10 | MOTOR | „Hod-trk od starta, kao na dugim" samo kad su dugi u planu hod-trk | maraton p03, p10 | +1 |

Posle ispravki 1–4 očekujem [srednja]: maraton p03 i p08 ≈ 80–82, HM p03 ≈ 80, maraton p10, p13, p19 ≈ 76–79;
maraton p06 i p18 i 5 km p13 traže i izmenu nedelja (ispravke 4–6).

Za grupu „ulaz dozvoljava" (25 profila ispod 80) ponavljaju se četiri uzroka, već navedena u R19: obim koji stoji
ili kreće ispod sadašnjeg (10 km p08, p10, p12; 5 km p02, p03, p04, p08, p10, p12; HM p08), kratki lagani dani
(10 km p02, p06; 5 km p02, p09, p15; maraton p15), nedelja −1 iznad 70 % (10 km p02, p06; 5 km p02, p09) i dugi
koji stoji (maraton p11, p04; 10 km p04, p11; HM p12).

## 5. Gde nisam siguran

1. **Prag obima u mom razvrstavanju je bio prestrog za kratke distance.** Razvrstavao sam iz prvog reda, gde obim
   piše opisno. Stvarni brojevi (vidim ih tek sada): 5 km p03 12 km, p10 13 km, p11 12 km; 10 km p11 15 km; HM p11
   20 km — po slovu mog pravila (5 km ≥ 15, 10 km ≥ 20, HM ≥ 25 km) to bi bio plafon. Razvrstavanje NE menjam posle
   čitanja; mislim da je pogrešan prag, ne odluka (5 km p11 i HM p11 imaju 80 i 81 na staroj skali). Ko prag
   primeni doslovno, dobija 4–5 profila više u plafonu.
2. **HM p03 i p10** sam stavio u plafon računajući na trku od 2 h 35+; plan polazi od forme 2:10. Dugi od 18 km je
   48 % nedelje, pa razlog i dalje stoji, ali ovo je najtanji „plafon" u skupu. Da su „dozvoljava", opet ne bi
   prošli (76,5 i 76).
3. **Kratke pripreme na pragu** (HM p06, 10 km p02 i p06, 5 km p06 i p07, vlasnik-v1) vodim kao „dozvoljava"; R19 je
   10 km p02/p06 zvao plafonom ulaza. Ako se prebace, treba im ocena „Plan za ulaz" koju ovde nisam dao.
4. **Maraton p08** (3 dana, 50 km, 24 ned) i **p18** (30 km, 20 ned) su granični plafon; **p11** (25 km, 24 ned)
   granično dozvoljava. p08 ima staru ocenu 78 i Plan za ulaz 74,5 — plan je bolji nego što grupa sugeriše.
5. **Iskrenost nosi presudu.** Ocene 4–6 počivaju na mojoj proceni realnog vremena trke; ako organizator ima
   podatke da trkači sa ovakvim ulazom zaista trče vreme iz forme na kraćim deonicama, iskrenost raste za 1,5–2 i
   maraton p03 i p08 prelaze 78–80.
6. Stare ocene sam znao pre razvrstavanja (nalog je tražio da ih pročitam); 11 planova sa plafonom čitao sam ceo,
   ostale nisam ponovo ocenjivao — rečenice „šta deli od 80" su iz R19 i ranijih krugova, uz pregled nedelja za 12
   planova gde R19 razlog ne navodi.

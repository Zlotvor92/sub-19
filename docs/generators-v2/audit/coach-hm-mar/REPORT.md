# Ugao 1b — trenersko čitanje HM i maratona (coach-hm-mar)

Kod: **670700e** (`git diff --stat 670700e HEAD -- web/` prazan pre merenja i pre izveštaja). Ništa u `web/` nije menjano.
Slučajnosti nema: svi ulazi su fiksni (START mreža 2026-11-02), uzorci su deterministički (`lib.ts` `sampleBases`, svaki
k-ti plan porodice, k = R 400 / F 200 / B 100).

## Šta je mereno

| skripta (iz `web/`: `node ../docs/generators-v2/audit/coach-hm-mar/<x>`) | izlaz | obim |
|---|---|---|
| `../../final-check/coach.ts HM\|MAR` (nepromenjena, 4a) | `coach-HM.md`, `coach-MAR.md` | po distanci 12 planova + 6 adaptacija |
| `coach2.ts HM\|MAR` (novo) | `coach2-HM.md`, `coach2-MAR.md` | po distanci 8 novih profila + 1 plan izvora sa ponudom „kraća distanca" (HM 476 tokova, MAR 544 + 544) |
| `measure.ts HM\|MAR 400 200 100` | `measure-HM.json`, `measure-MAR.json` | generator: SVI realni ulazi mreža (HM 24 852, MAR 31 650; 270/270 nerealnih izostavljeno); adaptacija: HM 49 planova × 23 292 toka, MAR 110 × 64 692 toka, 0 odbijanja |
| `measure-jump.ts HM\|MAR 400 200 100` | `measure-jump-*.json` | HM 9 058, MAR 25 718 tokova (pauza 10/20/35, manjak 50 %, bol posle pauze, lanac) |
| `jump-check.ts`, `jump-example.ts` | `jump-example.txt` | potvrda uzroka nalaza 5 |

Novi profili (po distanci): cilj +3 i +6 VDOT, najkraća priprema (HM 10 ned; početnik HM 12 / MAR 16 ned; MAR 12 ned),
početnik 3 dana, 6 dana veliki obim (HM 90 km VDOT 60, MAR 110 km VDOT 60), dugi subotom uz trku nedeljom, start usred
nedelje (plan od četvrtka, trka u sredu). Napomena: HM „kratka 10 ned" ponavlja 4a profil `kratka-4d-v45-10w` (isti ulaz).

## Nalazi

| # | ugao | distanca | broj | ulaz koji ga reprodukuje | uzrok | klasa | predlog |
|---|---|---|---|---|---|---|---|
| 1 | coach-hm-mar | HM | generator 1 446 / 24 852 realnih planova (5,8 %; 552 sa OBA dana kvaliteta dužim od dugog); adaptacija 1 405 / 23 292 toka (novo u odnosu na plan generatora; 997 bez ikakvog upozorenja LONG_SHORTER/TAPER) | najgori: `f-d6-10w-40km-e270-A` (THM.feelInputs; VDOT 58,6) ned 9 dan kvaliteta 52 min, dugi 23 min. Realan tok: `coach2-HM.md` plan izvora (4 d, 40 km, VDOT 45, 16 ned; pauza 35, asOf 2026-11-04) ned 15 utorak RP 2 × 2000 56 min + četvrtak T 2 × 1000 45 min, nedelja dugi 5,6 km / 33 min | MASTER pouka 35 („nedelja sa dva dana kvaliteta … drugi postaje lagan") u kodu važi samo za izgradnju (`halfMarathon/v2/policy.ts:372` F4a-N5: „baza, razvoj, specifična"); u taperu najmanja doza je izuzeta od drugog člana pouke 32 (`quality.ts:375-377`), dugi tapera je ostatak cilja (`week.ts:571`, grana tapera, `taperLengths`). LONG_SHORTER_THAN_QUALITY broji samo izgradnju i rasterećenje | T | Odluka: pouka 35 i u taperu (drugi dan → lagan, dugi raste) ili upozorenje. Trener ne bi potpisao „dugi" od 23–33 min uz dva kvaliteta od 45–56 min u nedelji pred trku |
| 2 | coach-hm-mar | HM, MAR | napomena tvrdi suprotno od plana: HM generator 909, adaptacija 546; MAR generator 9 054, adaptacija 205 | HM: isti tok kao #1 (ned 15: „T 2,0 km umesto 2,4 km (≈ 60 %): dan kvaliteta ne sme biti duži od dugog tapera (pouka 32)", a dan je 45 > 33 min). MAR: `coach2-MAR.md` `6d-veliki-v60-18w-110km` ned 17 „MP 6,0 km umesto 8,0 km — dan kvaliteta ne sme biti duži od dugog", dan 65 > dugi 64 min | tekst napomene ne vidi da je doza na podu (izuzeta) — HM `week.ts:620` | K | Kad je doza na najmanjem nivou: tekst „najmanja doza; dan ostaje duži od dugog" (ili bez tvrdnje) |
| 3 | coach-hm-mar | MAR | generator 22 344 / 31 650 realnih planova (70,6 %) ima nedelju tapera sa danom kvaliteta dužim od dugog (oba dana: 0; najviše 26 min); upozorenje TAPER_MP_OVER_CAP samo u 1 491 od njih; adaptacija 3 738 / 64 692 (1 951 bez upozorenja) | realan: `coach2-MAR.md` `cilj+3-4d-v45-18w` (4 d, 50 km, VDOT 45) ned 17 (N−1) utorak MP 2 × 3000 67 min, nedelja dugi 10,9 km 64 min = lagani 10,9 = 10,9 | M7 dugi N−1 ≤ 0,5 × najduži i MP pod 2 × 3000 (izuzet, pouka 32) | T | **Delom poznato** (4a: 3d TAPER_MP_OVER_CAP; N12 „lagan = dugi u taperu" svesno). Nova činjenica je obim (≈ 71 % planova, ne samo 3 d). Odluka: dopuniti N12 ili dugi N−1 ≥ dan MP |
| 4 | coach-hm-mar | MAR, HM | lagan ≥ 0,9 × dugi u nedelji izgradnje: MAR 10 521 / 31 650 (33,2 %), od toga 6 826 sa takvim laganim DAN PRE ili POSLE dugog i ≥ 120 min; HM 3 906 / 24 852 (15,7 %), susedan dan 1 869 (1 839 ≥ 120 min). Najveći: MAR lagan 27,2 = dugi 27,2 (`feel-d4-17w-65km-e315-A`), HM lagan 23,5 / dugi 24 (`f-d4-18w-55km-e360-A`) | realan: `coach2-MAR.md` `dugi-sub-trka-ned-4d-v45-18w` (4 d, 50 km, VDOT 45): ned 9–11 subota dugi 24,4 (143 min), nedelja lagan 20,3–23,7 km (119–139 min); isto sa dugim nedeljom (`cilj+3-4d-v45-18w`, lagan subotom) | dugi ograničen trajanjem 150 min i udelom (M13/H13), ostatak cilja nedelje ide u lagane (vlasnik obima); bez plafona laganog | T | **4a** zabeležio samo bazni plan (ned 10–11) bez odluke. Trener ne bi potpisao dva duga trčanja zaredom (44–48 km vikend) za VDOT 45 na 4 dana. Odluka: plafon laganog (npr. ≤ 0,75 × dugi ili ≤ 90 min) uz manjak → planirano < cilj (uslov 3), ili niži vrh za 3–4 dana |
| 5 | coach-hm-mar | HM, MAR | dugi u prve 4 buduće nedelje (nedelja ≥ 5) iznad plafona skoka računatog iz STVARNO trčanog, a u plafonu iz upisanih dana: HM 1 060 / 9 058 tokova (162 za > 3 km), MAR 3 584 / 25 718 (800 za > 3 km); najviše 11,9 / 14,9 km iznad | `jump-example.txt`: HM 6 d, 75 km, lak 405 s/km, 17 ned, `painPause` asOf 2027-01-10 (19 dana bez trčanja poznatih iz pokrivenosti, bol 6) → ned 11 dugi 8,5, ned 12 dugi 21,4 km; MAR 5 d, 70 km, lak 315, 23 ned, asOf 2027-01-31 → ned 14 dugi 10,9, ned 15 dugi 26,9. Takođe `coach-MAR.md` pauza 35 (kraj ned 8): ned 12 dugi 11,7 → 14,9 km (+27 %), L = 19,5 km planiranog, netrčanog dugog ned 8 (`jump-check.ts`) | plafon skoka uzima L iz upisanih (planiranih) dugih i za nedelje za koje pokrivenost kaže da nisu trčane: HM `lengths.ts:46` `rollingLongCap10`, MAR `lengths.ts:38` `jumpBase10` | T (kandidat B) | Po slovu pouke 28/29 (upisani dani) plan je ispravan, pa nije B bez odluke. Tumačenje pouke 37 („dan poznat iz pokrivenosti bez zapisa = 0") primeniti i na L skoka. Nedelje 1–4 izuzete iz merenja (L uključuje pretpostavljeni skorašnji trk) |
| 6 | coach-hm-mar | HM, MAR | 79 / 79 napomena nedelja koje korisnik vidi u 16 planova `coach2` nosi internu oznaku pravila (M7 15, H8 9, M8 9, M13a 8, pouka 28 7, H7 7, H5 4, A3/A4 …) i formule („max(1,1 × najduži, najduži + 1 km)"); isto upozorenja (npr. „pouka 32; HI3") | svaki plan, npr. `coach2-HM.md` ned 1 | `volume.userWeekNotes` / `app/plan.ts` filtriraju samo tehničku napomenu cilja | K | Oznake pravila odvojiti od teksta za korisnika |

Nema potvrđenog nalaza klase B na realnom ulazu: 0 odbijanja (generator 56 502 realna ulaza, adaptacija 122 760 tokova u
`measure*.ts`). Prazan trening, dugi < lagan i prošlost ovde nisu posebno mereni (pokrivaju ih `commonChecks` drugih uglova).

## 1. Ranije trenerske primedbe (4a, `final-check/coach-notes.md`) na 670700e

Tabele generatora HM su bajt-iste kao u 4a (diff samo u adaptacijama); tabele generatora maratona su iste, menjana su samo
upozorenja (N11: MARATHON_LONG_SHORT nestaje kad dugi ograničava 150 min — umesto toga rečenica u opisu plana).

| plan | 4a primedba | sada |
|---|---|---|
| HM generator, svih 12 | taper 3d-mali, platoi (3d-veliki, 4d-v62, 6d-v68, duga-5d), 6d-mali lagani 4–6 km, početnik | **važi** (bez promene; N12 svesno) |
| HM bol 5, pauza 20, +2 VDOT, lanac | — | isto |
| HM pauza 35 (N5) | dugi 5,8–9,5 uz 2 kvaliteta 46–48 min; taper bez kvaliteta; trkačka bez oštrenja | **delom ispravljeno**: ned 11–12 drugi kvalitet lagan (pouka 35), dugi 10,2–11,5; ostaje taper bez kvaliteta, trkačka bez oštrenja; novo DELOAD_LONG_SHORTENED (ned 13 dugi 7,6 km, T 45 > 44 min) |
| HM umor pre starta (N7) | ned 2 sa dozom planirane ned 2 | **ispravljeno**: ned 2 = planirana ned 1 (R 6 × 200 + T 2,0), ostatak pomeren |
| MAR generator | 3d-mali MP u oba tapera; taper lagan = dugi; 4d-v32 dugi 18,7; 6d platoi; duga plato | **važi**; upozorenje MARATHON_LONG_SHORT uklonjeno po N11 (4d-v32, 5d-v48, 6d-v35, po osećaju, kratka, duga) — samo rečenica plana |
| MAR bazni 4 d 50 km | lagan 23,0–23,7 uz dugi 24,4; napomena „Cilj po pravilu 45,0 nije izvodljiv" | lagan **važi** (→ nalaz 4, sa obimom); napomena ostaje u planu, aplikacija je ne prikazuje (N11) |
| MAR pauza 35 | dugi 10,8–14,6; MP dan duži od dugog; taper N−1 bez kvaliteta | **promenjeno**: dugi 11,2–16,3, ned 12 drugi kvalitet lagan (pouka 35); novo ned 12 skok dugog 11,7 → 14,9 (→ nalaz 5); ostaje N−1 bez kvaliteta, trkačka bez oštrenja, ned 16 MP 67 > dugi 64 min |
| MAR bol 5, pauza 20, umor, +2 VDOT, lanac | — / ispravno | isto (samo bez MARATHON_LONG_SHORT) |

## 2–3. Novi profili — trenersko čitanje

Činjenice (iz `coach2-*.md`):
- **Cilj brži od VDOT-a.** Plan je isti za svaki cilj (tempo iz rezultata, poruka to kaže). HM +3 = „ambiciozan", bez
  upozorenja u listi (samo ocena cilja); +6 GOAL_UNREALISTIC. MAR +3 već „nerealan" (ambiciozno ≤ 2,9 za 18 ned).
- **Najkraća priprema.** HM 10 ned i MAR 12 ned prolaze bez upozorenja; MAR dostiže dugi 24,4 km u ned 6. Početnik
  HM 12 / MAR 16 ned: uvod 2 nedelje, taper T 1,5, trkačka bez oštrenja; MAR početnik MARATHON_LONG_SHORT (18 km).
- **Početnik 3 dana:** odbijeno sa porukom BEGINNER_DAYS i preporukom 4–5 dana (dokumentovano, nije nalaz).
- **6 dana veliki obim:** HM vrh 100 km, plato ned 5–14, dugi 24 km od ned 1; MAR vrh 120 km, plato ned 3–15, dugi 30,8 km
  od ned 1 (uz napomenu o skorašnjem dugom). Poznata klasa platoa (N12).
- **Dugi subotom, trka nedeljom:** trkačka subota = „Lagano 20 min + 4 × 20 s"; taper bez sudara. MAR: nedeljni lagan
  posle subotnjeg dugog 20,3–23,7 km (nalaz 4).
- **Start četvrtak / trka sreda:** nedelje čet–sre, raspored dana po kalendaru isti; oštrenje subota (4 dana pre trke),
  dan pred trku utorak. Bez nalaza. (Aplikacija `alignedStart` start inače poravnava na dan posle trke − 7N.)
- **Ponuda „kraća distanca":** HM 1 / 476 tokova (pauza 35 u ned 1); MAR bazni 4 d / 50 km: 0 / 544 jer je plan generatora
  već ispod praga 26 km (24,4 km — po definiciji bez ponude); 5 d / 60 km / VDOT 50: 31 / 544. Oba prikazana izvora (najduži
  dugi 13,5 km HM, 19,3 km MAR posle povratka) — ponuda je trenerski opravdana. HM izvor ima taper iz nalaza 1.

Mišljenje (ne činjenica):
- Oštrenje HM RP 2 × 2000 m tri dana pred trku i MAR MP 2 × 2000 m — prihvatljivo.
- Maraton nema MP deonice u dugom trčanju (sve MP je u danu kvaliteta); većina trenera bi ih stavila u kasne duge. To je
  izbor strukture, ne greška.
- MAR dugi tapera N−2 0,65–0,7 × najduži i N−1 ≤ 0,5 × najduži je kraće od uobičajene prakse, ali po pravilu M7.

## Izlazi

Svi fajlovi u ovom folderu; najveći ~67 KB (ništa preko 2 MB).

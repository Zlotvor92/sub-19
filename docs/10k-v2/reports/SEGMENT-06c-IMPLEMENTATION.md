# 10K v2 — Segment 06c (10k-v2.5.0): ZAUSTAVLJENO — sudar A17 sa D5 (12 i 17 nedelja) i J2 sa A8

Polazni SHA `4917959`, grana `claude/generator-isolation-5k-10k-hm-marathon`. Odluka A17 je implementirana kao
**prototip** i izmerena na mrežama 04, P i R. Prototip se **ne commituje**: u planovima od 12 i 17 nedelja posle
ukinutog rasterećenja sledi 5 uzastopnih nedelja izgradnje. Odluka za taj slučaj kaže „stani i prijavi sudar sa
brojevima (ne ubacuj novo rasterećenje sam)". Generator, validator, poruke i oznaka verzije ostaju kao na `4917959`
(`10k-v2.4.1`).

Commitovano je samo ono što ne menja ponašanje: definicija mreže R (`testInputs.ts`), heševi na 4917959, skripte
merenja, diff prototipa i ovaj izveštaj.

## 0. Zaključak

- **Sudar 1 (odluka, tačka 3):** 384 toka mreže R (64 po scenariju smanjenja × 6) dobijaju 5 uzastopnih nedelja
  izgradnje od ukinute nedelje. Validator ih odbija (`DELOAD_RUN`, plan se ne vraća). Javlja se tačno u dva slučaja:
  12 ned sa smanjenom ned 3 i 17 ned sa smanjenom ned 7. Uzrok je D5 izuzetak „4 izgradnje kad bi rasterećenje
  palo na prvu nedelju faze", koji sledi odmah posle ukinutog rasterećenja.
- **Sudar 2 (J2 sa A8):** 8 tokova mreže 04 (manjak, asOf sreda ned 6, 14/18 ned, 3/4 dana) imaju cilj nedelje
  posle smanjenja iznad nivoa pre smanjenja (28,4 > 28,1; 39,8 > 39,3). Razlog je A8 „nikad sporije od D6": korak
  D6 od osnove prelazi nivo. Isti skok postoji i na 4917959, samo nedelju kasnije (posle rasterećenja).
- Ostalo u prototipu radi kako je odlučeno: J1 0, J4 0, J5 (bajt-isto van A17/N2) 0 izuzetaka, poruka N2 tačna.
- Podatak iz PROBLEMA: „svaki 12." iz `gridInputs` daje **252** plana, ne 189. Brojevi 644/2268 su reprodukovani
  tačno sa 252 plana; sa 189 planova ne bi bilo 2268 tokova.

## 1. Odluka doslovno (A17, 10k-v2.5.0; heuristika)

> 1. Nedelja smanjenja koraka adaptacije:
>    (a) korak sa ciljem koraka i nivoom pre smanjenja (startKm ≠ null I levelKm ≠ null; to su pauza A3 i manjak A2,
>    a višak A6 nije) → nedelja fromWeek;
>    (b) korak bola sa povratkom (returnFrom ≠ null) → nedelja sidra r (returnFrom.week);
>    (c) korak sa novim startom (restart, pauza ≥ 28 dana) se NE računa: rePeriodize već gradi raspored od novog starta.
> 2. Ako je nedelja ODMAH posle nedelje smanjenja redovno rasterećenje (deload iz osnovnog rasporeda, faza izgradnje,
>    nije prinudno rasterećenje A5, nije taper ni trkačka nedelja), to rasterećenje se ukida. Ta nedelja postaje nedelja
>    izgradnje: cilj po A8 (povratni rast od osnove; kod bola od osnove returnBase10), kvalitet po fazi uz postojeća
>    ograničenja po datumima (A3/A4). Prinudno rasterećenje (A5) se nikad ne ukida.
> 3. Raspored rasterećenja posle toga se ne pomera: sledeće redovno rasterećenje ostaje gde je u osnovnom rasporedu.
>    D5 izuzetak A17: posle ukinutog rasterećenja dozvoljene su najviše 4 uzastopne nedelje izgradnje (od ukinute
>    nedelje), jer je nedelja smanjenja služila kao oporavak. Ako bi ih bilo više od 4, stani i prijavi sudar sa
>    brojevima (ne ubacuj novo rasterećenje sam).
> 4. Jedno mesto odluke: steps.ts framesFor (isto mesto kao A5). Validator D5 dobija izuzetak A17 iz iste funkcije ili
>    iz istog podatka (ne sme sam da ponavlja pravilo drugačije). assess.ts se ne menja, osim ako je potreban podatak
>    (npr. oznaka koraka); tada ga objasni.
> 5. Poruka (N2): kad deluje min sa ciljem nedelje sidra (osnova = cilj nedelje r < 0,7 × nivo), poruka PAIN glasi:
>    „Posle nedelje {r} rast kreće od {osnova} km (cilj nedelje {r}; 70 % nivoa pre bola bilo bi {x} km)."
>    Inače ostaje sadašnja. Brojevi u 10K formatu (zarez).
>    Kad A17 ukine rasterećenje, poruka koraka dobija rečenicu:
>    „Redovno rasterećenje u nedelji {n+1} otpada: nedelja {n} je smanjena (A17)."
> 6. Verzija i aplikacija: policy.ts version = '10k-v2.5.0', DECISIONS A17 …; tekst A5/D5 …; app/plan.ts
>    KNOWN_VERSIONS = ['10k-v2.4.0', '10k-v2.4.1', '10k-v2.5.0'] …

Tačka 6 nije rađena, jer je rad zaustavljen pre verzije.

## 2. Fajl → izmena

### Commitovano (ponašanje nepromenjeno)

| fajl | izmena |
|---|---|
| `tenK/v2/testInputs.ts` | mreža R: `reliefGridBases` (252 R + 20 F + 20 B = 292 plana), `RELIEF_SCENARIOS` (7), `reliefAsOfs` (kraj ned 2…N−4), `reliefFacts`. Samo ulazi, bez uvoza van `tenK/v2/`. |
| `tenK/v2/segment06c.adapt-hashes-4917959.json` (nov) | 20 569 heševa (`planHash81`, bez oznake verzije) izlaza adaptacije na 4917959: mreža 04 2040, P 336, R 18 193. |
| `docs/10k-v2/artifacts/segment-06c/regression-4917959.ts` | skripta heševa; kod iz checkouta 4917959, definicija mreže R iz ovog stabla (kao 06b za P). |
| `docs/10k-v2/artifacts/segment-06c/a17-prototype.diff` | prototip A17 + N2 (`steps.ts`, `validate.ts`, `assess.ts`, `adapt.ts`), NIJE primenjen. |
| `docs/10k-v2/artifacts/segment-06c/measure-a17.ts`, `measure-a17.json` | merenje prototipa prema heševima 4917959 (svi tokovi, odbijanja sa porukom, J1, J2, J4). |
| `docs/10k-v2/STATUS.md`, ovaj izveštaj | — |

### Prototip (`a17-prototype.diff`, izmereno, ne commitovano)

| fajl | izmena |
|---|---|
| `steps.ts` | `reducedWeeks(step)`: (a) `startKm ≠ null && levelKm ≠ null` → fromWeek; (b) `returnFrom` → r; (c) `restart` → nijedna. `framesFor(…, dropped?)`: posle A5 u istoj petlji ukida redovno rasterećenje nedelje w + 1. Uslovi: izgradnja, deload, nije u skupu prinudnih iz dosadašnjih koraka. U `dropped` upisuje nedelja → indeks koraka. Nov start (rePeriodize) briše prinudne i ukinute od svog fromWeek. Jedino mesto odluke. |
| `validate.ts` | `framesFor(…, dropped)` (isti poziv kao za FRAMES); D5: na nedelji iz `dropped` niz se broji od 1, granica `P.deload.exceptionRun` (4) do sledećeg rasterećenja; poruka `DELOAD_RUN … (D5, A17)`. Pravilo se ne ponavlja. |
| `assess.ts` | samo `painReturnNote` (poruka N2): kad je `returnBase10 < round(0,7 × nivo)` → „… rast kreće od {osnova} km (cilj nedelje {r}; 70 % nivoa pre bola bilo bi {x} km)." Odluke assess nepromenjene. |
| `adapt.ts` | rečenica A17: `framesFor(baseFrames(…), …, dropped)`, nedelje ukinute poslednjim korakom. Za (a) rečenica ide u poruku PAUSE/UNDER/OVER, za (b) u poruku PAIN. Pauza + bol na kraju nedelje (r = n) daje jednu rečenicu, u poruci PAUSE. |
| `volume.ts` | bez izmene: ukinuta nedelja dobija cilj iz postojećeg `adaptNominal10` (nextBuild10 od osnove, kod bola od `returnBase10`). |

## 3. Primeri iz PROBLEMA (10w-25km-v30-A-sat, asOf kraj ned 3): ned 4–7, cilj/planirano, 4917959 → prototip

| scenario | 4917959 | prototip A17 |
|---|---|---|
| pauza 10 d (breaks) | 4 21,2/21,24 · **5 rast. 17,0** · 6 23,3 · 7 25,0 | 4 21,2/21,24 · **5 23,3/23,34** · 6 25,0/24,96 · 7 26,5 |
| pauza 20 d | 4 17,5 · **5 rast. 14,0** · 6 19,3 · 7 21,2 | 4 17,5 · **5 19,3** · 6 21,2 · 7 23,3 |
| bol 5 (dan asOf) | 4 29,8/20,9 · **5 rast. 14,9** · 6 20,5 · 7 22,6 | 4 29,8/20,9 · **5 20,5/20,54** · 6 22,6 · 7 24,9 |
| bol 8 | 4 29,8/9,2 · **5 rast. 14,9/14,5** · 6 20,5 · 7 22,6 | 4 29,8/9,2 · **5 20,5/19,24** · 6 22,6 · 7 24,9 |
| manjak (1 od 4 odrađen) | 4 23,8/23,84 · **5 rast. 19,0** · 6 26,2 · 7 27,8 | 4 23,8/23,84 · **5 26,2/26,24** · 6 27,8 · 7 29,5 |
| pauza 10 + bol 5 | 4 21,2/16,7 · **5 rast. 14,9** · 6 20,5 · 7 22,6 | 4 21,2/16,7 · **5 20,5** · 6 22,6 · 7 24,9 |
| umor | 4 rast. 22,5 · 5 29,8 · 6 31,6 · 7 33,5 | isto (A5, bajt-isto) |

J2 za ned 5: pauza 10 osnova 21,2 → 23,3 = 21,2 + 2,1 (≤ nivo 25,0); bol 5 osnova 18,6 → 20,5 = 18,6 + 1,9 (≤ 26,5);
manjak osnova 23,8 → 26,2 = 23,8 + 2,4 (≤ 26,5). Posle ukinute ned 5 izgradnja traje 5–8, to su 4 nedelje (10 ned:
taper 9).

Poruka (manjak): „… cilj 23,8 km (A2). Povratak do 26,5 km … (A8). Redovno rasterećenje u nedelji 5 otpada: nedelja 4
je smanjena (A17)."

N2 (`d4-r-14w`, pauza + bol, asOf 2026-12-09):
- 4917959: „Posle nedelje 6 rast kreće od 70 % nivoa pre bola (26,5 km)."
- prototip: „Posle nedelje 6 rast kreće od 26,5 km (cilj nedelje 6; 70 % nivoa pre bola bilo bi 29,2 km)."

## 4. Sudari (odluka organizatora)

### Sudar 1 — A17 tačka 3: više od 4 uzastopne nedelje izgradnje od ukinute nedelje

D5 rasporedi (`periodize`, isti za 3–6 dana, rezultat/osećaj, početnika). Prikazan je razmak od rasterećenja do
sledećeg rasterećenja ili tapera:

| N | raspored (R = rasterećenje) | rasterećenja | nedelja od ukinutog do sledećeg |
|---|---|---|---|
| 12 | b b b **R** d d d s **R** s t r | 4, 9 | 4 → 8 = **5** (ned 8 je prva nedelja specifične faze, D5 izuzetak 4 izgradnje 5–8) |
| 17 | b b b R b b d **R** d d d s **R** s s t r | 4, 8, 13 | 8 → 12 = **5** (ned 12 prva nedelja specifične); ostali ≤ 4 |
| ostali 8–18 | — | — | ≤ 4 |

Sudar nastaje kad je nedelja smanjenja 3 (N = 12) ili 7 (N = 17), bez obzira na scenario, broj dana i osnovu tempa.

Mreža R (asOf = kraj ned 2…N−4):
- 64 toka po scenariju smanjenja (pauza 10, pauza 20, bol 5, bol 8, manjak, pauza 10 + bol 5) = **384 toka**;
- planovi: 28 R planova od 12 ned (asOf kraj ned 2) i 28 R planova od 17 ned (asOf kraj ned 6);
- iz F i B: `f-d3-17w-40km-e405-A-sat`, `f-d5-12w-35km-e270-A-sat`, `f-d6-12w-55km-e270-A-sat`,
  `f-d6-17w-50km-e405-A-sat`, `b-d3-12w-15km-e330-C-sat`, `b-d3-17w-15km-e450-B-sat`, `b-d4-12w-26km-v30-A-sun`,
  `b-d4-17w-22km-v40-A-sun`;
- svih 384 tokova odbija validator: `DELOAD_RUN: 5 uzastopne nedelje izgradnje bez rasterećenja (D5, A17)`, ned 8
  (12 ned, 192 toka) ili ned 12 (17 ned, 192 toka);
- mreža 04 (10/14/18 ned) i P: 0 sudara. U P plan od 12 ned ima r = 7 ili 8; posle ukinute ned 9 dolaze izgradnje
  9–10, pa taper.

Brojevi pre provere validatora. Prikazana je konstrukcija prototipa; ista je i uz drugu granicu, jer granica deluje
samo u validatoru:

| ulaz / asOf | ned 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|---|---|---|---|---|---|---|---|---|---|
| `12w-25km-v30-A-sat` generator | 26,5 | 28,1 | R 22,5 | 29,8 | 31,6 | 33,5 | 34,6 | R 27,7 | 35,0 |
| pauza 10, kraj ned 2 | 26,5 | 20,0 | **22,0** | 24,2 | 25,7 | 27,2 | 28,8 | R 23,0 | 30,5 |
| bol 5, kraj ned 2 | 26,5 | 28,1 | **19,3** | 21,2 | 23,3 | 25,0 | 26,5 | R 21,2 | 28,1 |
| manjak, kraj ned 2 | 26,5 | 22,5 | **24,8** | 26,3 | 27,9 | 29,6 | 31,4 | R 25,1 | 33,3 |

| ulaz / asOf | ned 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 |
|---|---|---|---|---|---|---|---|---|
| `17w-25km-v30-A-sat` generator | 31,6 | 33,5 | R 26,8 | 35,0 | 35,0 | 35,0 | 34,6 | R 27,7 |
| pauza 10, kraj ned 6 | 31,6 | 23,8 | **26,2** | 28,1 | 29,8 | 31,6 | 33,5 | R 26,8 |
| bol 5, kraj ned 6 | 31,6 | 33,5 | **23,0** | 25,3 | 27,8 | 29,8 | 31,6 | R 25,3 |

Šta odluka traži, bez mog izbora. Brojevi su iz merenja, ne preporuka:
- (A) ukinuto rasterećenje ostaje, a granica od ukinute nedelje je 5 kad je sledeći deo D5 izuzetak 4. Ekvivalentno
  tome: brojanje „posle ukinute nedelje", najviše 4. Proba (jedna linija validatora `exceptionRun + 1`, nije
  commitovana): 0 odbijanja; J1 0, J4 0; A17 deluje u 739 tokova po scenariju umesto 675.
- (B) rasterećenje se ne ukida kad bi niz od ukinute nedelje bio > 4. Tih 384 toka ostaje bajt-isto kao 4917959: dve
  lake nedelje zaredom ostaju u ta dva slučaja.
- (C) pomeranje sledećeg rasterećenja ranije. Odluka to zabranjuje („ne ubacuj novo rasterećenje sam"); nije mereno.

Drugi oblici istog sudara, nisu u mrežama:
- asOf usred nedelje sa nedeljom smanjenja 3 (12 ned) ili 7 (17 ned);
- raspored posle novog starta (`rePeriodize`), ako sadrži deo sa izuzetkom 4, a kasniji korak smanji nedelju pre
  njegovog rasterećenja.

### Sudar 2 — J2 „≤ nivo pre smanjenja" i A8 „nikad sporije od D6"

8 tokova mreže 04, manjak 50 %, asOf sreda ned 6, planovi `d3-r/f` i `d4-r/f` × 14 i 18 ned. Nedelja smanjenja je 7
(cilj = 0,8 × cilj ned 7). Ned 8 je ukinuto rasterećenje.

| plan | nivo (ned 3; ned 4 rasterećenje, prozor A2 počinje u ned 5) | osnova ned 7 | ned 8 (A17) | povratak A8 | D6 |
|---|---|---|---|---|---|
| d3 × 4 | 28,1 | 26,8 | **28,4** | min(26,8 + 2,7; 28,1) = 28,1 | 26,8 + 1,6 = 28,4 |
| d4 × 4 | 39,3 | 37,5 | **39,8** | min(37,5 + 3,8; 39,3) = 39,3 | 37,5 + 2,3 = 39,8 |

`nextBuild10` uzima veće od dva (A8: „nikad sporije od D6"), pa je cilj iznad nivoa. Deo „+10 %" iz J2 važi
(28,4 ≤ 29,5; 39,8 ≤ 41,3), a deo „≤ nivo" ne važi. Na 4917959 isti cilj (28,4 / 39,8) dobija ned 9, posle
rasterećenja ned 8: to ponašanje nije novo. Potrebna je odluka: J2 kao „≤ max(nivo, osnova + D6)" ili izmena A8.

## 5. Regresija prototipa prema 4917959 (`measure-a17.json`)

Generator bez činjenica: u prototipu nema izmene puta bez koraka. `grid`, `feelGrid`, `beginnerGrid` (R 15 840,
F 11 880, B 3402) prolaze u prototipu, a heš testovi su bez izmene.

| mreža / scenario | tokova | promenjeno | A17 | N2 | odbijeno (sudar 1) |
|---|---|---|---|---|---|
| 04 under50 | 120 | 40 | 40 | 0 | 0 |
| 04 pause10 / pause20 | 120 / 120 | 40 / 40 | 40 / 40 | 0 | 0 |
| 04 pain5 / pain8 | 120 / 120 | 20 / 20 | 20 / 20 | 0 | 0 |
| 04 chain | 120 | 60 | 60 (prvi korak; rečenica u napomenama plana) | 0 | 0 |
| 04 painPause | 120 | 72 | 40 | 56 | 0 |
| 04 ostalih 10 scenarija | 1200 | 0 | 0 | 0 | 0 |
| P bol 4 / 5 / 7 / 8 | 84 × 4 | 22 × 4 | 22 × 4 | 0 | 0 |
| R pauza 10 / pauza 20 / bol 5 / bol 8 / manjak | 2599 × 5 | 675 + 64 × 5 | 675 × 5 | 0 | 64 × 5 |
| R pauza 10 + bol 5 | 2599 | 1096 + 64 | 675 | 537 | 64 |
| R umor | 2599 | 0 | 0 | 0 | 0 |

- Mreža 04: 292 / 2040 promenjeno.
- P: 88 / 336 promenjeno.
- R: 4471 promenjeno i 384 odbijeno / 18 193.
- R4 podskup (252 plana, 2268 tokova po scenariju): 644 toka sa rasterećenjem posle smanjenja na 4917959. Od toga A17
  ukida 588; 56 je sudar 1 (28 × 12 ned + 28 × 17 ned).

Postojeći testovi `tenK/v2` sa prototipom: 263 / 267 prolazi. Padaju samo 4 očekivanja, sva zavise od A17:

1. `adapt.node`: rezultati po scenariju (broj rasterećenja i primenjenih uslova mreže 04);
2. `adapt.node`: 06b regresija prema e6540a5 (180 tokova više: A17);
3. `painGrid`: I3, spisak izuzetaka trkačke nedelje;
4. `painGrid`: primer E. Ned 4 je bila rasterećenje 23,8, a sada je ukinuta: 32,7 = osnova 29,7 + 3,0.

Staro → novo za ova očekivanja nije upisano, jer verzija nije napravljena.

## 6. J1–J5 (prototip, sve tri mreže)

| | rezultat |
|---|---|
| J1: posle nedelje smanjenja nema redovnog rasterećenja (prinudno sme) | **0** prekršaja (svi vraćeni tokovi) |
| J2: cilj posle smanjenja ≤ osnova + max(10 %, 1,0 km) i ≤ nivo | „+10 %": **0**; „≤ nivo": **8** (sudar 2); tokovi bez A17: 0 |
| J3: ≤ 4 izgradnje od ukinute nedelje, 0 grešaka validatora | **384** toka > 4 (sudar 1), svi odbijeni; ostali 0 grešaka |
| J4 (Uslov 8): km > 0, dugi ≥ lagan, ≥ minimum D17, bez kvaliteta u danima bola/odmora, prošlost i urađeno bajt-isti | **0** (`adaptInvariants` + validator, svi vraćeni tokovi) |
| J5: tokovi bez smanjenja i bez rasterećenja posle njega bajt-isti prema 4917959 | **0** izuzetaka. Svaki promenjen tok ima A17 ili N2, i svaki tok sa A17/N2 je promenjen. 40 tokova `chain` nosi A17 iz prvog koraka, u napomenama plana. |

J2 je meren nezavisno od `volume.ts`. Za (a) osnova je cilj nedelje smanjenja. Za (b) osnova je min(round(0,7 ×
nivo), cilj nedelje r). Nivo je `levelKm` koraka.

## 7. Sabotaže

Nisu rađene: nema commitovanog A17 koji bi sabotaže proveravale. Test mreže R (J1–J5) i sabotaže (a)–(d) idu uz
konačnu odluku.

## 8. Komande i rezultati

- `git worktree add --detach <wt> 4917959` + `node docs/10k-v2/artifacts/segment-06c/regression-4917959.ts <wt>` →
  20 569 heševa (2040 + 336 + 18 193), 2 min 18 s; `prettier --write`.
- Reprodukcija PROBLEMA na 4917959 (pre prototipa): R4 252 plana, pauza 10 / bol 5 / manjak **644/2268** svaki
  (i pauza 20, bol 8, pauza + bol: 644/2268; umor 0); primer `10w-25km-v30-A-sat` ned 4–5 isti kao u PROBLEMU.
- `git apply a17-prototype.diff` + `node docs/10k-v2/artifacts/segment-06c/measure-a17.ts` (iz `web/`) → 3 min 3 s,
  dva puta isti rezultat; `git checkout` četiri fajla.
- Prototip: `npx vitest run --project node src/domain/generators/tenK/v2` → 21 fajl, 263 / 267, 143 s (4 pada,
  odeljak 5).
- Commitovano stanje (kod = 4917959):
  - `npx tsc -b --noEmit`, `npx eslint .`, `npx prettier --check .`: exit 0;
  - `npx vitest run --project node src/domain/generators/tenK/v2`: 21 fajl, **267 / 267**, 135 s (uključuje
    `isolation.node.test.ts`);
  - `npm run check`: **exit 0 — 220 fajlova, 2710 testova**, 822 s ukupno, testovi 665 s.
- E2E nije pokretan: aplikacioni kod i oznaka verzije nisu menjani.

## 9. AGENTS.md uslovi 1–8 (prototip / commitovano)

1. Jedan vlasnik. Ukidanje se odlučuje samo u `steps.framesFor`. Validator i poruka čitaju isti `dropped`. Obim
   računa samo `volume.ts`, bez izmene.
2. Plafoni nedirnuti.
3. WU/CD nedirnuti.
4. A17 ulazi u konstruktor kroz okvire. Završna zaštita samo proverava (J4: prošlost bajt-isto).
5. Handoff bez izmene.
6. Oznaka ostaje `10k-v2.4.1`, faza svake nedelje iz odluke generatora. Prototip nije menjao verziju.
7. `isolation.node.test.ts` prolazi. Mreža R uvozi samo iz `tenK/v2/`.
8. J4 0 u svim vraćenim tokovima. Sudar 1 je odbijanje, ne degenerisan plan.

## 10. Preostalo (za organizatora)

1. **Sudar 1:** izbor (A), (B), (C) ili drugo za 12 ned (smanjena ned 3) i 17 ned (smanjena ned 7).
2. **Sudar 2:** J2 „≤ nivo" ili A8 „nikad sporije od D6".
3. Tumačenje (a) kod bola i viška u istom koraku. Višak (A6) postavlja `startKm`, a bol `levelKm`, pa doslovno
   „startKm ≠ null I levelKm ≠ null" računa fromWeek kao nedelju smanjenja. Nijedan scenario mreža to ne kombinuje.
4. Brojevi u nalazu N1: „189 planova" → 252 (svaki 12. od 3024).
5. Posle odluke: tačka 6 (verzija, DECISIONS A17, A5/D5 tekst, `KNOWN_VERSIONS`), test mreže R (J1–J5), sabotaže
   (a)–(d), staro → novo za 4 očekivanja, E2E. Heševi 4917959 iz ovog commita važe i tada (kod generatora nije
   menjan).

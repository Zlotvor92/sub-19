# 5K v2 — Segment 08e (5k-v2.7.0): rasterećenje odmah posle smanjenja otpada (Odluka 9); adaptacija koju konstruktor sastavi, a validator odbije (P2)

- Grana: `claude/generator-isolation-5k-10k-hm-marathon` (AGENTS.md). Polazni SHA: `51a924f` („PWA: prva instalacija
  service workera …"; kod 5K v2 isti kao b09ae49, 5k-v2.6.1). Commit: commit koji sadrži ovaj izveštaj (SHA u završnoj
  poruci organizatoru).
- Status: Odluka 9 i P2 implementirani. Izvršilac se zaustavio dvaput (§ 9.1 nova klasa P2 VOLUME_DELOAD, § 9.2 oznaka
  verzije u 10K snimku i UI testu); oba **rešena odlukom organizatora** i implementirana. Organizator je ispravio i
  tumačenje granice niza (§ 1, tačka 5 odgovora) — granica je izmerena iz generatora.
- Menjano: `web/src/domain/generators/fiveK/v2/`, `docs/5k-v2/`; uz izričitu dozvolu organizatora (§ 9.2) samo ključevi
  „5K v2 …" u `tenK/v2/app/byteSame.068410b.json` i oznaka verzije u `features/onboarding/fiveKV2Flow.test.tsx`. Kod
  10K nije uvožen ni menjan (Uslov 7). Bez PR-a, mergea i deploya.

## 1. Odluka (doslovno)

Nalog organizatora (ODLUKE 1–3):

> 1. Nova odluka (sledeći broj po konvenciji 5K, u policy.ts DECISIONS i tekstu odluka): redovno rasterećenje odmah posle
>    nedelje smanjenja otpada.
>    - Nedelja smanjenja: (a) korak sa ciljem koraka koji je smanjenje — pauza i manjak (višak NIJE) → fromWeek; (b) korak bola
>      sa povratkom (returnFrom) → returnFrom.week; (c) korak sa novim startom (restart) se ne računa.
>    - Oznaka: AdaptStep dobija `reduced?: boolean` — true za pauzu i manjak (i sa novim startom; (c) ga i dalje isključuje),
>      false za višak, odsutno bez cilja koraka. Korak sačuvan pre 5k-v2.7.0 (bez polja): rezervni put po starom tumačenju
>      (cilj koraka i nivo pre smanjenja postoje), uz izuzetak viška ako se može prepoznati — inače prihvaćeno kao 10K § 9.2.
>    - Ukida se samo redovno rasterećenje iz osnovnog rasporeda, u fazi izgradnje, koje nije prinudno (umor) ni taper/trka.
>      Prinudno rasterećenje se nikad ne ukida (framesFor danas ne pamti prinudna — dodaj skup kao 10K).
>    - Granica niza: od ukinute nedelje (uključujući nju) najviše (pravilo najdužeg niza izgradnje bez rasterećenja u 5K,
>      za početnika svoje) + 1 nedelja do sledećeg rasterećenja ili kraja izgradnje; ako bi niz bio duži — rasterećenje ostaje
>      (upiši broj takvih tokova). Raspored se ne pomera, ništa se ne ubacuje.
>    - Ukinuta nedelja dobija cilj po postojećem pravilu povratka (cilj izgradnje od osnove; kod bola osnova iz 08d).
>    - Jedno mesto odluke: steps.ts framesFor; validator čita isti podatak (dropped iz istog poziva), ne ponavlja pravilo.
>    - Poruka koraka: „Redovno rasterećenje u nedelji {n+1} otpada: nedelja {n} je smanjena ({oznaka odluke})."
>    - Kontrolno trčanje (po osećaju): postojeća pravila premeštanja važe; izmene broja/nedelje testa izmeri i navedi.
> 2. P2 — konstruktor ne sme sastaviti ono što validator odbije. Za svaku klasu nađi koju odluku iz policy.ts svaka strana
>    primenjuje:
>    - jedna strana primenjuje odluku koju druga ne zna → druga strana čita ISTU funkciju (jedan vlasnik);
>    - obe primenjuju iste odluke različito → ispravlja se strana koja odstupa od teksta odluke;
>    - WEEK_MIN_VOLUME: ako je uzrok dani bola/odmora (ograničenja po datumima), trenerski: minimum nedelje važi za CILJ
>      nedelje; planirano ispod cilja zbog dana bola je upozorenje, ne greška (isto tumačenje kao 10K A4
>      PLANNED_BELOW_TARGET_LIMITS). Ako je ispod minimuma sam cilj → greška konstruktora (donja granica).
>    - tekst odluke nejasan/protivrečan ili nova klasa → STANI sa predlogom.
> 3. Verzija 5k-v2.7.0; app/plan.ts KNOWN_VERSIONS + '5k-v2.6.1'; sačuvan plan starije verzije ostaje 5K v2 i prilagođava
>    se po 2.7.0 (test).

Odluke organizatora posle zaustavljanja (doslovno, skraćeno samo za ponavljanja):

> 1. VOLUME_DELOAD (3 toka): PRIHVAĆEN tvoj predlog, u 08e. Jedna funkcija u volume.ts za cilj ostatka pauze
>    (pauseRemainderKm: min(startKm, cilj) kad pauseRemainder i firstWeek < fromWeek i firstWeek je izgradnja/rasterećenje
>    po okviru); adaptVolume je zove, validator na nedelji firstWeek takvog koraka prihvata cilj iz iste funkcije (kao
>    resetKm za fromWeek). Konstruktor bajt-isti. Trenerski: rasterećenje u kom počinje pauza sme ispod 0,8 × prethodne —
>    pauza je jači razlog za smanjenje. Test sa sva 3 toka + sabotaža (validator bez izuzetka → pada).
> 2. VOLUME_GROWTH i WEEK_MIN_VOLUME: ispravke kako si opisao — u redu.
> 3. VDOT_OUT_OF_RANGE (104): po dizajnu, nije P2 — samo navedi u izveštaju.
> 4. Oznaka „Odluka 9": u redu.
> 5. Granica niza — ISPRAVKA tvog tumačenja: kao 10K (granica = najduži niz koji generator sam dozvoljava + 1). Izmeri
>    najduži niz izgradnje bez rasterećenja koji 5K generator pravi u osnovnom rasporedu (bez činjenica) na svim mrežama,
>    posebno redovni i početnik; granica = taj maksimum + 1 (uključujući ukinutu nedelju). Upiši izmerene brojeve i broj
>    tokova koji zadrže rasterećenje (cilj: ~0; ako ostane > 5 % od 819 — STANI sa merenjem).
> 6. Validator: ako ijedno pravilo validatora zavisi od rasporeda rasterećenja (…), ono čita ISTI `dropped` iz istog
>    framesFor poziva — ne sopstveno pravilo. Ako zaista nijedno ne zavisi, sabotaža (c) se zamenjuje sabotažom „ukinuta
>    nedelja dobija cilj rasterećenja (0,8×)" — mora pasti.
>
> STANI 2: ODOBRENO kao 08d. (1) Ponovo snimi SAMO ključeve „5K v2 …" u web/src/domain/generators/tenK/v2/app/
> byteSame.068410b.json (ostali bajt-isti — dokaz diffom ključeva + test sa privremeno vraćenom oznakom …). (2) Promeni
> samo oznaku u web/src/features/onboarding/fiveKV2Flow.test.tsx. Verzija ostaje 5k-v2.7.0; KNOWN_VERSIONS + 5k-v2.6.1.

Tumačenja (u izveštaju, ne nova pravila):
- **Oznaka odluke**: 5k-v2.6.0 ima Odluke 1–8, 5k-v2.6.1 „Odluka 1 dopuna" → „Odluka 9" (potvrđeno, tačka 4).
- **Granica (tačka 5)**: izmereno na `periodize` za sve podržane dužine plana (`input.planWeeks` 6–16) bez kratke
  pripreme (6–7 ned nemaju rasterećenja po 2.3.0, pa Odluka 9 tu nema dejstva):

  | deloadEvery | najduži niz izgradnje bez rasterećenja po dužini plana 8–16 ned | maksimum | granica |
  |---|---|---|---|
  | 4 (ostali) | 8:3 9:3 10:4 11:**5** 12:3 13:3 14:3 15:4 16:3 | 5 (plan od 11 ned) | **6** |
  | 3 (početnik) | 8:3 9:2 10:2 11:2 12:**3** 13:2 14:**3** 15:3 16:2 | 3 | **4** |

  Na mrežama (adaptNetwork 60 + rw posle prelaza) maksimum je 4 (ostali; plan od 11 ned nije u mreži) i 3 (početnik); za
  granicu je uzet maksimum generatora (svi planovi), jer je to „najduži niz koji generator sam dozvoljava". Kratka
  priprema (bez rasterećenja) ima nizove 4–5 i za početnika; ne ulazi, jer tu nema šta da se ukine.
  Granica je izvedena u kodu (`steps.reliefMaxRun`: isto merenje nad `periodize`), bez novog broja u politici.
  **Zadržano granicom: 0 tokova** u obe pretrage (sa prvobitnim tumačenjem `deloadEvery` = 4/3 bilo bi 156 od 975 —
  svi planovi od 10 nedelja bez početnika).

## 2. Fajl → izmena

| Fajl | Izmena |
|---|---|
| `fiveK/v2/steps.ts` | `reliefMaxRun(deloadEvery)` (l. 106; granica iz `periodize`), `targetReducedWeek` (l. 126; (a) + rezervni put za stari korak), `reducedWeeks` (l. 134; (a) + (b), nov start → []); `framesFor(…, dropped?)` (l. 154): skup prinudnih (umor), posle umora u istoj petlji ukida redovno rasterećenje w + 1 (izgradnja, rasteretna, nije prinudna, niz od nje ≤ granice) i upisuje `dropped` (nedelja → indeks koraka); nov start briše prinudna i ukinuta od svog fromWeek. **Jedino mesto odluke.** |
| `fiveK/v2/generate.ts` | `construct` prosleđuje `dropped` u `framesFor` i vraća ga u `Constructed.dropped` (isti poziv). |
| `fiveK/v2/adapt.ts` | Rečenica Odluke 9 za nedelje koje je ukinuo poslednji korak (`c.dropped`): (a) → PAUSE/UNDER_EXECUTION, (b) → PAIN; pauza i bol iste nedelje — jedna rečenica, uz pauzu. |
| `fiveK/v2/assess.ts` | Samo podatak: `step.reduced = true` uz pauzu (i nov start) i manjak, `false` uz višak. Nijedna odluka nije menjana. |
| `fiveK/v2/types.ts` | `AdaptStep.reduced?: boolean` (komentar: značenje, stari korak). |
| `fiveK/v2/volume.ts` | P2 VOLUME_DELOAD: `pauseRemainderKm(step, okvir, cilj)` (l. 268) — jedino mesto pravila ostatka pauze (2.5.0 Odluka 3); `adaptVolume` ga zove (l. 331; bajt-isto). Ukinuta nedelja: bez izmene (`nextBuildKm` od osnove; bol `returnBaseKm`). |
| `fiveK/v2/validate.ts` | P2: VOLUME_GROWTH preskače cilj na donjoj granici (`floored(w)` — isti `adaptFloorKm`, blok premešten ispred provere rasta); WEEK_MIN_VOLUME u nedelji sa danima bola meri cilj (l. 410); VOLUME_DELOAD prihvata cilj ostatka pauze iz `pauseRemainderKm` (`remainderOk`, l. 437). Odluka 9: bez izmene (§ 5). |
| `fiveK/v2/policy.ts` | `version: '5k-v2.7.0'`; DECISIONS 5k-v2.7.0 (Odluka 9 (1)–(6), P2 (7), primeri pre → posle, granica, merenje). |
| `fiveK/v2/app/plan.ts` | `KNOWN_VERSIONS = ['5k-v2.6.0', '5k-v2.6.1', P.version]`. |
| `fiveK/v2/testInputs.ts` | Pretraga 08e: `RELIEF_NARROW`/`RELIEF_WIDE`, `reliefBases`, `reliefFacts` (pauza 10/20/35 kao `breaks`, bol, pauza + bol, manjak, višak, umor, rezultat ±2 VDOT), `reliefCases`, `reliefCheck` (ocena toka nezavisno od steps.ts), `canonResult08e` (heš bez oznake verzije i polja `reduced`). Uvozi samo `dates.ts` i tipove. |
| `fiveK/v2/segment08e.harness.node.test.ts` (nov) | Mreže „rasterećenje posle smanjenja" i „rana adaptacija": J1–J4, polje reduced, rečenica, regresija prema 51a924f, determinizam; granica izmerena iz `periodize` (nezavisno od steps.ts). |
| `fiveK/v2/segment08e.node.test.ts` (nov, 27 testova) | Uska mreža (pun nivo: cela), šira (brz: nedelje 1–3); primeri, granica (sintetički koraci), prinudno, nov start, višak + bol, stari korak, P2 (3 klase). |
| `fiveK/v2/segment08e.2.full.node.test.ts` (nov) | Pun nivo: šira pretraga cela (10 852 toka). |
| `fiveK/v2/segment08e.adapt-hashes-51a924f.json` (nov) | Heševi i odbijanja 5952 + 10 852 toka, kod iz checkouta 51a924f (`measure-08e.ts`). |
| `fiveK/v2/segment08d.node.test.ts` | Heš `canonResult08e` (polje reduced; bf47249 ga nema); izmenjena očekivanja zavisna od odluke (§ 4.3). |
| `fiveK/v2/app/adapt.node.test.ts` | KNOWN_VERSIONS (3 verzije), oznaka rezultata, 08d primer (ned 3 ukinuta, § 4.3); nov test 08e: sačuvan plan 5k-v2.6.1 → current → prilagođavanje po 2.7.0 (rečenica Odluke 9). |
| `fiveK/v2/app/app.node.test.ts`, `fiveK/v2/segment02.node.test.ts` | Oznaka `5k-v2.6.1` → `5k-v2.7.0`; primer nepoznate verzije `5k-v2.7.0` → `5k-v2.7.1`. |
| `tenK/v2/app/byteSame.068410b.json` | Dozvola § 9.2: ponovo snimljeni samo ključevi „5K v2 …" (19 od 41; ostalih 121 bajt-isti). |
| `features/onboarding/fiveKV2Flow.test.tsx` | Dozvola § 9.2: samo oznaka `5k-v2.7.0`. |
| `docs/5k-v2/artifacts/segment-08e/` | `measure-08e.ts` (merenje pre/posle i fixture), `before-51a924f.json`, `after.json`, `sabotage-08e.json` (ulaz alata), `sabotage-08e.result.json`. |
| `docs/5k-v2/STATUS.md`, ovaj izveštaj | Sekcija „Segment 08e". |

`runWalk*.ts` nisu menjani; kontinuirani deo posle prelaza gradi isti `construct` (u široj pretrazi: rw-16w-pocetnik-e420
posle prelaza, ned 9–14).

## 3. Merenje pre / posle

Skripta: `node docs/5k-v2/artifacts/segment-08e/measure-08e.ts <koren> <izlaz.json> [<fixture.json> [<pre.json>]]` —
kod iz zadatog checkouta, definicije tokova i ocena (`reliefCheck`) iz ovog stabla; 54 s po pokretanju (oba ista).
P1 = tok čija nedelja n + 1 posle nedelje smanjenja (iz uslova koraka: pauza/manjak → fromWeek, bol sa povratkom → r;
nov start ne) je redovno rasterećenje (nije prinudno) u izgradnji, sa nizom od n + 1 ≤ granice.

### 3.1 Uska pretraga (organizator): adaptNetwork 60 × asOf {kraj ned w, kraj − 3}, w = 1 … N − 2 × 6 scenarija

| scenario | tokova | sa nedeljom smanjenja | P1 pre → posle | ukinuto posle | najduži niz od ukinute | odbijeno pre → posle | promenjeno = rečenica + ranije odbijeno |
|---|---|---|---|---|---|---|---|
| pause10 | 992 | 992 | 152 → 0 | 152 | 5 | 0 → 0 | 152 = 152 + 0 |
| pause20 | 992 | 992 | 152 → 0 | 152 | 5 | 0 → 0 | 152 = 152 + 0 |
| pain5 | 992 | 826 | 147 → 0 | 152 | 5 | 12 (VOLUME_GROWTH) → 0 | 159 = 152 + 7 |
| pain8 | 992 | 826 | 147 → 0 | 152 | 5 | 12 (VOLUME_GROWTH) → 0 | 159 = 152 + 7 |
| pause10pain5 | 992 | 972 | 225 → 0 | 228 | 5 | 20 (WEEK_MIN_VOLUME 14, VOLUME_GROWTH 6) → 0 | 245 = 228 + 17 |
| missed | 992 | 778 | 152 → 0 | 152 | 5 | 0 → 0 | 152 = 152 + 0 |
| **ukupno** | **5952** | 5386 → 5430 | **975 → 0** | **988** | 5 (≤ 6) | **44 → 0** | 1019 = 988 + 31 |

- Pre: 44 odbijena tačno kao u nalazu (30 VOLUME_GROWTH, 14 WEEK_MIN_VOLUME). P1 tačno iz polja koraka: 975 (gruba mera
  organizatora 529/2366). Zadržano granicom: 0.
- Ukinuto 988 = 975 + 13 tokova koji su pre bili odbijeni, a sada su prihvaćeni sa ukinutim rasterećenjem.

### 3.2 Šira pretraga („rana adaptacija"): 60 + rw posle prelaza × asOf {sreda, kraj ned w} × 11 scenarija

| scenario | tokova | P1 pre → posle | ukinuto | odbijeno pre → posle | promenjeno = rečenica + ranije odbijeno |
|---|---|---|---|---|---|
| pause10 | 992 | 152 → 0 | 152 | 0 → 0 | 152 = 152 + 0 |
| pause20 | 992 | 152 → 0 | 152 | 3 (VOLUME_DELOAD) → 0 | 155 = 152 + 3 |
| pain5 / pain8 | 992 / 992 | 147 → 0 | 152 | 11 (VOLUME_GROWTH) → 0 | 158 = 152 + 6 |
| pause10pain5 | 992 | 225 → 0 | 228 | 17 (WEEK_MIN_VOLUME 11, VOLUME_GROWTH 6) → 0 | 242 = 228 + 14 |
| missed | 992 | 142 → 0 | 142 | 0 → 0 | 142 = 142 + 0 |
| pause35 (nov start) | 992 | 0 | 0 | 0 | 0 |
| over (višak 125 %) | 992 | 0 | 0 | 0 | 0 |
| fatigue (umor) | 932 | 0 | 0 | 0 | 0 |
| faster / slower (±2 VDOT) | 992 / 992 | 0 | 0 | 28 / 76 VDOT_OUT_OF_RANGE → isto | 0 |
| **ukupno** | **10 852** | **965 → 0** | **978** | **146 → 104** (42 P2 → 0; 104 VDOT_OUT_OF_RANGE po dizajnu) | 1007 = 978 + 29 |

- VDOT_OUT_OF_RANGE (104): rezultat ±2 VDOT izlazi iz opsega ulaza (početnici sa VDOT ~30 sporije, VDOT 58 brže) —
  odbijanje ulaza po dizajnu (assess), nije P2 (odluka organizatora, tačka 3). Umor: 60 tokova bez 2 laka dana u
  prozoru nije sastavljeno (932).
- Kontrolno trčanje (po osećaju; postojeće premeštanje, `framesFor`): uska 90 tokova — test ranije u ukinutu nedelju
  (5 → 4: 64, 6 → 5: 12) ili dodat gde ga ranije nije bilo (— → 4: 12, — → 6: 2); šira 94 (68 / 14 / 10 / 2). Nijedan
  test nije uklonjen. Spisak: `after.json` → `regression.*.testChanges`.

## 4. Primeri i regresija

### 4.1 Primeri (cilj km; R = rasterećenje; 5k-v2.6.1 → 5k-v2.7.0; test `segment08e.node.test.ts`)

| tok | ned 3 | ned 4 | ned 5 | ned 6 | ned 7 | ned 8 |
|---|---|---|---|---|---|---|
| v45-d4-22km-14w, kraj ned 2, pauza 10 | 17,6 | R 14,1 → **19,3** | 19,3 → 21,2 | 21,2 → 22,8 | 22,8 → 24,6 | R 18,2 → R 19,7 |
| isto, bol 5 | 25,5 (plan. 20,4) | R 12,3 → **16,9** | 16,9 → 18,5 | 18,5 → 20,3 | 20,3 → 22,0 | R 16,2 → R 17,6 |
| isto, manjak | 20,4 | R 16,3 → **22,0** | 22,0 → 23,7 | 23,7 → 25,5 | 25,5 → 27,5 | R 20,4 → R 22,0 |

- Pauza + bol (asOf četvrtak 2026-11-12): nedelje smanjenja 3 (pauza) i 2 (sidro bola); ned 4 ukinuta, jedna rečenica,
  uz PAUSE: „… Redovno rasterećenje u nedelji 4 otpada: nedelja 3 je smanjena (Odluka 9)."
- Primer iz nalaza (v45-d3-15km-10w, kraj ned 1, pauza 10): ned 2 cilj 12 → ned 3 rasterećenje 9,6 → **13,2**, ned 4
  14,5 (niz 3–7 = 5 ≤ 6). Sa prvobitnim tumačenjem granice (4) ostalo bi rasterećenje.
- Kontrolno trčanje: feel-d4-22km-12w, bol 5 kraj ned 2: test iz ned 3 (dani bola) → 2.6.1 ned 5 (ned 4 rasterećenje),
  2.7.0 ned 4.

### 4.2 Regresija

- **Generator bez činjenica**: bajt-isti osim oznake — segment07 „700 ulaza: heš = fixture c9003aa", segment05b vrhovi,
  segment06/07 mreže (`none`) prolaze bez izmene očekivanja; `byteSame` (10K snimak tokova kroz aplikaciju) sa privremeno
  vraćenom oznakom `5k-v2.6.1` na konačnom kodu: 2/2 sa starim snimkom (§ 9.2).
- **Prema 51a924f** (fixture `segment08e.adapt-hashes-51a924f.json`, heš bez oznake verzije i polja `reduced`): u obe
  pretrage svaki promenjen tok ima rečenicu Odluke 9 ili je na 51a924f bio odbijen; svaki tok sa rečenicom je promenjen;
  **0 drugih promena** (uska 1019 = 988 + 31, šira 1007 = 978 + 29). Pauza 35, višak, umor, rezultat: 0 promena.
- **Postojeće mreže 08d** (732 + 392 prema bf47249, heš `canonResult08e`): promenjeno i dalje samo s06/pain5 60/60 (u
  postojećim mrežama asOf sredinom plana nijedno redovno rasterećenje nije odmah posle nedelje smanjenja); mreža P: 380
  promenjenih kao u 08d, 0 odbijanja.

### 4.3 Izmenjena očekivanja zavisna od odluke (staro → novo)

1. `segment08d` „nekadašnji BASE_R_DECREASE": ned 5 = 18,2 → za asOf pon–sub (r = 3) ned 4 = 18,2 (nije rasterećenje),
   ned 5 = 20,0; asOf nedelja 2026-11-22 (r = 4 je samo rasterećenje) bez promene (R 20,4, ned 5 18,2). Doza ned 5 i dalje
   R 0,80 + T 1,00 (2026-11-18, bol 5).
2. `segment08d` I1: rasterećenja u nedelji r + 1: 124 → 0 (sva su redovna i ukinuta).
3. `segment08d` primer E: ned 4–6 [24,2 R, 33,2, 36,5] → [33,2, 36,5, 40,1] (ned 4 = osnova 30,2 + 10%).
4. `app/adapt.node` 08d (bol 11. 11., asOf 12. 11., plan 10 ned): ned 3 rasterećenje ostaje → otpada (niz 3–7 = 5 ≤ 6),
   rečenica u PAIN; KNOWN_VERSIONS 3; oznaka rezultata 5k-v2.7.0.
5. Oznaka verzije: segment02, app.node (2 mesta + primer nepoznate 5k-v2.7.1), fiveKV2Flow.test.tsx, plan nosi tekuću
   oznaku u segment08d.

## 5. Invarijante J1–J4 (mreže 08e; nezavisno od steps.ts)

| | uska (5952) | šira (10 852) |
|---|---|---|
| J1: posle nedelje smanjenja nikad redovno rasterećenje (prinudno sme) | 0 | 0 |
| J2: niz od ukinute nedelje ≤ granice (6; početnik 4); zadržano granicom | 0 prekršaja, najduži 5; zadržano 0 | 0, najduži 5; 0 |
| J3: odbijanja od validatora | 0 | 0 (104 VDOT_OUT_OF_RANGE — ulaz) |
| J4: km > 0, dugi ≥ lagan, nedelja ≥ minimum (dani bola: cilj), bez kvaliteta/ubrzanja u danima bola, prošlost bajt-ista | 0 | 0 |
| polje reduced (pauza/manjak true, višak false, inače bez) / rečenica = ukinute nedelje | 0 / 0 | 0 / 0 |

- Validator i Odluka 9 (tačka 6 organizatora): nijedno pravilo validatora ne zavisi od rasporeda rasterećenja.
  VOLUME_DELOAD meri samo nedelje koje su u planu rasteretne (ukinuta nije); donja granica (`floored`, base0 iz
  `periodize`/`planVolume`, validate.ts:493) čita cilj generatora za tu nedelju isto kao `adaptVolume.fitAt`
  (`base.targets`), pa obe strane računaju istu granicu; nijedno drugo pravilo ne poredi sa rasporedom. Merenje: sa
  ukidanjem (pre P2 ispravki) 0 novih odbijanja u obe pretrage. Zato validator ne dobija izuzetak, a sabotaža (c) je
  zamenjena sabotažom „ukinuta nedelja dobija cilj rasterećenja (0,8×)".
- Granica u testu: sintetički koraci na d5-60km-16w-v58 (rasterećenja 4, 7, 11) — sidro 6 pa 3: ned 7 ukinuta, ned 4
  ostaje (niz 4–10 = 7 > 6); obrnut redosled: obe ukinute (svaki niz meri se od ukinute nedelje napred, kao 10K).

## 6. Sabotaže (`web/scripts/sabotage.mjs`, brz nivo, `--bail=1`, `--parallel 2`; samo `segment08e.node.test.ts`)

Ulaz `docs/5k-v2/artifacts/segment-08e/sabotage-08e.json`, rezultat `sabotage-08e.result.json`. Stanje `src` posle
vraćanja isto kao pre (heš 41375fe5c107e18f). Ukupno **8/8 PAO, 42,3 s**.

| sabotaža | izmena | trajanje | prvi pali test |
|---|---|---|---|
| (a) Odluka 9 isključena | `for (const w of reducedWeeks(s))` → `[]` | 6,0 s | uska mreža „J1, J2 …" |
| (b) ukida i prinudno | bez `!forced.has(next.index)` | 12,0 s | „prinudno rasterećenje (umor) se nikad ne ukida …" |
| (c) ukinuta nedelja dobija cilj rasterećenja (0,8×) — zamena za „validator bez izuzetka" | `adaptVolume`: `else if (f.deload \|\| bazni cilj < prethodnog)` | 6,0 s | uska mreža „J3: 0 odbijanja …" |
| (d) nov start ulazi | bez `if (s.restart) return null/[]` | 10,7 s | šira mreža „rečenica Odluke 9 … polje reduced" |
| (e) reduced se ne čita | samo stari put (startKm i nivo) | 11,7 s | „višak + bol u istom koraku … ned 4 ostaje rasterećenje" |
| (f1) P2 VOLUME_GROWTH vraćeno | bez `!floored(w)` u proveri rasta | 6,4 s | uska mreža „J3 …" |
| (f2) P2 WEEK_MIN_VOLUME vraćeno | minimum uvek za planirano | 7,4 s | uska mreža „J3 …" |
| (f3) P2 VOLUME_DELOAD vraćeno | bez `!remainderOk(w)` | 11,1 s | „VOLUME_DELOAD: pauza 20 … (3 toka)" |

## 7. Komande i rezultati (iz `web/`)

| komanda | rezultat |
|---|---|
| `npx tsc -b --noEmit` | exit 0 |
| `npx eslint src/domain/generators/fiveK/v2` | exit 0 |
| `npx prettier --check` (izmenjeni fajlovi) | „All matched files use Prettier code style!" |
| `npx vitest run --project node src/domain/generators/fiveK/v2` (brz) | 16 fajlova, **655 / 655**, 22,6 s (51a924f: 15 / 627) |
| `npx vitest run --project node src/domain/generators/fiveK/v2/segment08e.node.test.ts` (brz) | 27 / 27, ~11 s |
| `TEST_FULL=1 npx vitest run --project node src/domain/generators/fiveK/v2/segment08e` | 2 fajla, 27 / 27, 47 s |
| `npx vitest run --project node src/domain/generators/tenK/v2/app/byteSame.node.test.ts` | 2 / 2 (i sa privremeno vraćenom oznakom + starim snimkom: 2 / 2) |
| `npx vitest run src/features/onboarding/fiveKV2Flow.test.tsx` | 5 / 5 |
| `node scripts/sabotage.mjs ../docs/5k-v2/artifacts/segment-08e/sabotage-08e.json --parallel 2` | 8/8 PAO, 42,3 s |
| `npm run check` | exit 0 — typecheck, lint, format; vitest 222 / 222 fajla, 2763 / 2763 testa (6 min 39 s) |
| `npm run check:full` | exit 0 — 271 / 271 fajl, 2914 / 2914 testova (14 min 37 s) |
| `node ../docs/5k-v2/artifacts/segment-08e/measure-08e.ts <wt 51a924f> …` / `… .` | pre / posle, 54 s svako; fixture iz checkouta 51a924f |

## 8. AGENTS.md — stalni uslovi 1–8

1. Jedan vlasnik odluke: ukidanje rasterećenja samo `steps.framesFor` (`reducedWeeks`, `reliefMaxRun`); konstrukcija i
   poruka čitaju isti `dropped` iz istog poziva; obim ukinute nedelje samo `volume.adaptVolume` (bez izmene); ostatak
   pauze samo `volume.pauseRemainderKm`; donja granica samo `volume.adaptFloorKm`. Validator samo prijavljuje i čita iste
   funkcije. Bez petlji skraćivanja/dopune.
2. Jedan plafon po zoni: bez novih limita. Granica niza nije nov broj: izvedena iz `periodize` (najduži niz generatora + 1).
3. WU/CD nisu dirani; manjak u nedeljama bola ostaje planirano < cilj (upozorenje PLANNED_BELOW_TARGET_LIMITS).
4. Adaptacija: nedelja smanjenja (uslov poznat unapred) ulazi u konstruktor kroz okvire (`framesFor`); završna zaštita i
   spajanje nepromenjeni; J4 proverava prošlost bajt-istu.
5. Handoff: bez izmene (kontinuirani deo posle prelaza gradi isti konstruktor; rw u široj pretrazi).
6. Plan nosi `5k-v2`/`5k-v2.7.0` i fazu svake nedelje; sačuvani 5k-v2.6.0 i 5k-v2.6.1 su poznate verzije (test 08e u
   `app/adapt.node.test.ts`).
7. Nula uvoza van `fiveK/v2/`: `isolation.node.test.ts` prolazi bez novih izuzetaka; `testInputs.ts` uvozi samo `dates.ts`
   i tipove; pravilo je napisano iznova (kod 10K nije uvožen).
8. Upotrebljivost: J4 na 5952 + 10 852 toka (pun nivo) — nijedan prazan trening, dugi ≥ lagan, nedelja ≥ minimum (cilj
   u nedelji sa danima bola), bez kvaliteta i ubrzanja u danima bola; 0 odbijanja od validatora.

## 9. Zaustavljanja i preostalo

### 9.1 STANI 1 — nova klasa P2 VOLUME_DELOAD (rešeno odlukom organizatora)

Šira pretraga: 3 toka pauze 20 sa asOf u sredu nedelje rasterećenja (v38-d4-38km-10w 2026-11-18, v38-d4-38km-14w
2026-11-25, v45-d4-38km-14w 2026-12-23). Konstruktor (2.5.0 Odluka 3, adaptVolume): cilj ostatka tekuće nedelje =
min(cilj pauze, cilj) → rasterećenje 29,9 → 26,2 = 0,70 × 37,4; validator je merio 0,8 × prethodne (izuzetak `resetKm`
važi samo za fromWeek). Četvrtkom se ne javlja jer je nedelja mešovita. Rešenje (prihvaćen predlog): `pauseRemainderKm`
u volume.ts, adaptVolume (bajt-isto) i validator (`remainderOk`) je čitaju. Rezultat: 0 odbijanja; test „VOLUME_DELOAD
… (3 toka)"; sabotaža (f3) pada.

### 9.2 STANI 2 — oznaka verzije van dozvoljenih putanja (rešeno odlukom organizatora)

`tenK/v2/app/byteSame.068410b.json` hešira `policyVersion` u ključevima „5K v2", a `fiveKV2Flow.test.tsx:84` očekuje
oznaku. Postupak: `BYTE_SAME_RECORD=1` u kopiju, spajanje (stari fajl, za ključeve „5K v2" nove vrednosti), isti format.
Dokaz: (1) 140 ključeva, isti redosled; promenjeno 19, svi „5K v2 …" (od 41: po planu #0/#1/#2 generisanje, plan,
generator, policy, prilagođavanje, adaptacija, kod #0 i cilj — isti skup kao u 08d); spojen fajl = pun novi snimak;
(2) sa privremeno vraćenom `version = '5k-v2.6.1'` na konačnom kodu i starim snimkom oba testa prolaze 2/2.

### 9.3 Preostalo (bez izmene)

- Uzastopni koraci mogu ukinuti dva rasterećenja zaredom (npr. sidro 3 pa sidro 6 na planu sa rasterećenjima 4 i 7 →
  ned 1–10 bez rasterećenja), jer se niz meri od ukinute nedelje napred (tekst odluke, isto kao 10K); svaki takav niz
  sadrži nedelje smanjenja. U mrežama 08e (jedan korak) nema slučaja; sintetički je u testu granice.
- Stari korak (pre 5k-v2.7.0) višak + bol se ne može razlikovati od manjka (oba imaju cilj koraka i nivo) → računa se
  kao smanjenje (prihvaćeno kao 10K § 9.2; test to dokumentuje). Višak bez bola (nivo null) se prepoznaje.
- 5K v2 je iza prekidača; korisnika sa sačuvanim koracima 2.6.x nema u produkciji.

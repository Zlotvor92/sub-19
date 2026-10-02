# TRAINING ENGINE AUDIT

Predmet: `generatePlan` i sve što ga hrani ili čita (`app.js` 5757–9110 + VDOT lanac 2388–2970 + povreda/opterećenje 1576–1960).
Metoda: čitanje koda, pokretanje starog generatora kroz `test/harness.mjs`, reproduktivne probe u `docs/probes/`.
Oznake: **[E]** evidence-based (objavljena matematika), **[H]** coaching heuristic, **[P]** product decision, **[?]** potencijalno sporno, **[B]** dokazan defekt.
Gde nema dokaza piše **„Nedovoljno dokaza"**. Izvori navedeni u komentarima koda (Daniels, Riegel, Bosquet, Buist, Nielsen, Pfitzinger, 158.000 maratonaca…) **nisu proveravani u ovom auditu** — navode se kao „kod tvrdi".

## 1. Presuda

Generator je **funkcionalno bogat i izuzetno dobro zaštićen testovima** (1 553 testa prolaze; 2 304-scenarija golden-master otisak). Zato je pravilna strategija **ne reimplementacija nego strukturiran, ponašanje-očuvavajući port** pod otiskom, pa tek onda namerne izmene, svaka dokumentovana (v. §12).

Tri nalaza koji menjaju plan rada:

1. **Izlaz generatora je istovremeno i perzistirani oblik** (`S.genPlan` u `user_state.data`). Njegova polja (`tag`, `desc`, `km`, `session.type`, …) ostaju kakva jesu. Port čuva tačan oblik; „lepi" engleski tipovi su aliasi nad istim ključevima (v. §10).
2. **Generator prihvata degenerisan ulaz bez greške** (§11): nevažeći datum trke daje plan sa 0 nedelja i `meta.weeks=NaN`; nepoznat `intensity` daje `NaN` u kilometraži, opisima i tempu; `pb.sec=Infinity` daje negativan VDOT. Čarobnjak to blokira, ali `S.genPlan.ulaz` iz uvezenog backupa/servera ulazi u `planSaNovimCiljem`/`recalibratedPlan` **nevalidiran**. Zahtev „NaN/Infinity/invalid dates/impossible race dates" iz specifikacije stari kod **ne ispunjava**.
3. **„VDOT ne određuje nedeljni obim" važi samo za rampu obima, ne za isporučene kilometre.** Isti ulaz sa PB 18:20 vs 25:00 daje različitu kilometražu u 10 od 17 nedelja (5K, do 1,7 km), 17/21 (10K, **do 7,9 km**), 19/27 (HM, do 4,2 km) — zbog vremenskih plafona (`tempoMaxSec/pT`, `lrCap` po minutima, fartlek km). To je tipična trenerska praksa (vreme na nogama), ali **nije ono što specifikacija tvrdi**. Odluka u §12 (D1).

## 2. ULAZI

`generatePlan(inp)` — jedini javni ulaz domena.

| Polje | Tip | Podrazumevano | Validacija u starom kodu | Ocena |
|---|---|---|---|---|
| `startDate` | `YYYY-MM-DD` | — (obavezno) | **nema**: nevažeći → `RangeError: Invalid time value` | [B] |
| `raceDate` | `YYYY-MM-DD` | — (obavezno) | **nema**: `'abc'`/`undefined` → plan sa 0 nedelja, `meta.weeks=NaN`; `'2026-02-31'` → tiho prelivanje u 03.03. | [B] |
| `raceDistM` | `5000 \| 10000 \| 21097.5 \| 42195` | `5000` | tabela profila; nepoznato → greška (OK). String `"5000"` prolazi (ključ objekta) | [?] |
| `pb` `{distM, sec}` | broj, broj | — | `>0` proverava; **ne** proverava gornju granicu ni konačnost (`Infinity` → VDOT −5,7; `sec=1` → VDOT 7,3·10⁶). Čarobnjak ima `PB_SANITY` (5K 12:00–99:59, 10K 25:00–99:59, HM 55:00–4:00:00, 42K 1:55:00–7:00:00) — **samo u UI-ju** | [B] |
| `weeklyKm` | broj | — | `>0`; `NaN` odbijen, `Infinity` prolazi (tiho svedeno na 120 u `_cur0`), 500 prolazi | [B] |
| `runDays` | 2–7 | 4 | `Math.round` + clamp (NaN → 4 preko `||`) | [P] tiho ispravljanje |
| `quality` | 1–2 | 2 | clamp | [P] |
| `intensity` | `kons \| std \| agr` | **nema** | nepoznato/izostavljeno → `RAMP[x]` je `undefined` → `NaN` u `vdotGoal`, `racePace`, `km`, opisima | [B] |
| `goalSec` | broj | `null` (→ `predictedSec`) | nema: `1` → `racePace=0`, `NaN` se tiho tretira kao odsutno | [B] |
| `trainedRecently` | bool | `true` (samo `=== false` je „početnik") | — | [P] |
| `lrDow` | 1–7 | 7 (nedelja) | clamp u `buildDaySlots`; 9 → 7 | [P] |
| `qDows` | niz 1–7 | — | filtrira/sortira/skraćuje na `effQ` | [P] |
| `runDows` | niz 1–7 | — | `>=2` izabrana dana se poštuju TAČNO; LR se dodaje ako fali | [P] |
| `_noSuggest` | bool | — | interni flag protiv rekurzije | tehnički |

Sat: generator **ne čita sat**; `startDate` je ulaz (UI prosleđuje `todayStr()`). Datumska matematika je mešovita: `mondayOfWeek`/`nextMonday` su UTC, `addD`/`diffD`/`s2d` lokalno-kalendarske (`new Date(y,m,d)`); za čiste datume su ekvivalentne, ali je to **nenamerna zavisnost od TZ-a** koju novi `domain/date` mora ukloniti (čist UTC epoch-day račun). Test: `danas.test.mjs` (prelazak preko ponoći).

## 3. IZLAZI

```
{ weeks: Week[], pred: PredRow[], qs: Record<string,number[]>, meta: Meta } | { error: string }
Week   = { w, vol, days: Day[], deload: boolean, focus: string }
Day    = { dow(1–7), tag: 'lako'|'rw'|'tempo'|'int'|'lr'|'snaga'|'odmor'|'trka'|'test', km|null, desc,
           rest?:true, mlr?:true, runWalk?:{runSec,walkSec,label}, session?: Session }
Session= { type:'int'|'pyramid'|'fartlek'|'prog'|'tempo', kind:string, wuKm, cdKm, paceSec, overrides:{}, … }
PredRow= { w, l:'N<w> · <kind>', q(km), pt(sec/km), p5k(sec — vreme na raceDistM!), nemeri?:true }
Meta   = { vdot0, vdotGoal, predictedSec, realno, goalVdot, start, weeks, intensity, racePace, runDays,
           quality, dayWarnings[], raceDistM, raceName, baseWeeks, raceDate, goalSec }
```

`adaptGeneratedPlan` zatim: `dow` 1–7 → 0–6, dodaje `id='g<w>d<dow+1>'`, `week.start`, prefiks `qs` ključeva `n→g`, `pred[i].id='g<w>_<i>'`. **Polje `p5k` se zove „5k" iako nosi vreme na ciljnoj distanci** — ime ostaje (perzistirano), tip dokumentuje stvarno značenje.

Sadržaj izlaza po zahtevu iz zadatka: nedelje ✔ `weeks`; dani ✔ `days`; sesije ✔ `session`; kilometraža ✔ `km`/`vol`; tempo ✔ `session.paceSec`/`desc`; zone ✔ implicitno (`pace…` iz `paceForZone`) — **zone se ne emituju kao zasebno polje**; WU/CD ✔ `session.wuKm/cdKm`; LR ✔ `tag:'lr'`; MLR ✔ `mlr:true`; deload ✔ `week.deload`; taper/trka ✔ `focus`, `tag:'trka'` (taper **nema** zastavicu — prepoznaje se po `focus` tekstu, v. [?] P8); VDOT progresija ✔ `pred[].p5k` + `meta.vdot0/vdotGoal`.

## 4. Tok `generatePlan` (stvarni redosled)

1. profil iz `DIST_PROFILES[raceDistM]`; validacija ulaza (§2).
2. `start = mondayOfWeek(startDate)`; `weeks = floor(days/7)+1`; granice `prof.minWeeks` (5K 6, 10K 8, HM 10, 42K 12) i 104.
3. `taperW` (1; HM i 42K = 2), `zadnjaRadna = weeks−1−taperW`.
4. `peakProcena = prof.peakVol(cur0, rampSteps, intensity)`; `hoceMLR`; `qCut` (2→1 kvalitet ako `peak < prof.qual2MinKm`).
5. `buildDaySlots(runDays, qWant, prefs, hoceMLR)` — jednom za ceo plan.
6. `assess(pb, weeks, intensity, goalSec, raceDistM)` → `vdot0`, `vdotGoal = vdot0 + RAMP[intensity]·min(max(weeks−2,1),20)`, `predictedSec`, `realno`.
7. Bazna faza: početnik `baseWeeks = min(prof.baseWeeksBeginner, weeks−prof.minWeeks)`, run/walk prve 4 nedelje (`RW_LESTVICA`).
8. Niz ciljnih obima `vols[]` (rast, deload svaka 4., undulacija na odredištu, taper, trkačka).
9. Po nedelji: `vdotW`, tempa zona, tip nedelje (`isRace/isDeload/isTaper1/isTaper2/base`), sesije (`prof.buildQuality`), `volQ` iz probne raspodele, WU/CD proširenje, `allocEasyLR`, taper LR, `klampLR`, raspored po danima, strides, **izravnavanje rasta**, **klamp tapera**.
10. Trkačka nedelja: protokol po pomeraju od dana trke (−3 shakeout, −2 aktivacija 6×200, −1 shakeout, 0 trka); dani koji padaju u prethodnu nedelju pregazuju tamo.
11. Upozorenja (`dayWarnings`): nerealan cilj, `qCut`, `volFloor`, `minDanaPrep`, prekratak run/walk, „početnik + >30 km", manjak prve nedelje >15%, strukturni plafon (probni pozivi za 7 dana), `bazaMin`.
12. Filtriranje dana nedelje 1 pre `startDate` + čišćenje `pred`/`qs`.

## 5. Klasifikacija odluka

### 5.1 Matematički čvrsto [E]

| Šta | Gde | Status |
|---|---|---|
| `VO2(v) = −4.60 + 0.182258·v + 0.000104·v²` (v u m/min) | `vo2AtV` | Daniels–Gilbert; **kod tvrdi „objavljene"**. Test `pure.test` poredi sa tabelom Daniels Running Formula (±0,6 VDOT). Nedovoljno dokaza za tačnost iznad tolerancije od 0,6 — dodati tabelu (§13). |
| `%VO2max(t) = 0.8 + 0.1894393·e^(−0.012778 t) + 0.2989558·e^(−0.1932605 t)` (t u min) | `pctVo2max` | isto |
| `VDOT = VO2(v)/%VO2max(t)` | `vdotFromRace` | |
| `raceTimeForVdot` (Newton, 40 iter., tolerancija 1e−6) | | Test `pure`: round-trip <1 s. **Konvergencija van 20–85 nije testirana.** |
| `vdotFromPace` ≡ binarna pretraga inverza `paceForZone`, vraća `hi` (round-trip tačan u 1206/1206 kombinacija, kod tvrdi) | | zadržati, test postoji |
| Riegel `t₂ = t₁·(d₂/d₁)^1.06` | `riegelDist`, `riegelV2` | objavljeni eksponent. **Tri varijante** (`riegel(tempoSec,q)` normalizuje na 5 km, `riegelDist(sec,fromM,toM)`, `riegelV2(tempo,qKm)`), isti eksponent, različiti potpisi — spojiti u jednu funkciju |
| Zona **M** = tempo maratona za dati VDOT (iz iste jednačine), ne procenat | `paceForZone('M')` | ispravljeno u prošlosti, zadržati |
| Mapiranje procenta VO2max → brzina (`vAtVo2`) | | [E] matematika; **konstante procenta** su [H] |

### 5.2 Coaching heuristika [H]

| Konstanta / pravilo | Vrednost | Napomena iz koda | Ocena |
|---|---|---|---|
| Zone `Z = {I:1.00, T:0.88, M:0.80→definicija, E:0.70, LR:0.68, R:1.05}` | | „izbor unutar objavljenih opsega, kalibrisan na etalon plan" | [H][?] **Nedovoljno dokaza** da odgovara Danielsovim tabelama; dodati referentnu tabelu tempa po VDOT-u |
| `RAMP = {kons .15, std .25, agr .43}` VDOT/ned | | kons/std „unutar Danielsove smernice ~1 poen/4–6 ned. (ekspertska heuristika)"; **agr 0.43 kalibrisan na putanju jednog autora plana** | [H][?] `agr` je jedna tačka podataka; nedovoljno dokaza |
| `RAMP_CAP_WEEKS = 20` | | „inženjerski izbor, NE fiziološka granica" | [H] |
| `DELOAD_EVERY=4`, `DELOAD_F` .73 (5K), .75 (10K), .76 (HM), .78 (42K) | | etalon 32/44 | [H] |
| Taper: 5K `.65`, 10K `.72`, HM 2 ned. `.82/.75`, 42K 2 ned. `.80/.65`; trkačka nedelja `.30/.34/.36/.40` | | 42K: „analiza 158.000+ maratonaca ~80/65/40%" i Bosquet 2007 (41–60% smanjenja) | [H]; izvor **nije proveren** |
| `KORAK_*` rast: `clamp(vol·pct, min, max)` — 5K std 5.5% [1.8–3.5 km]; 10K [2.0–4.0]; HM [2.2–4.5]; 42K (v. kod) | | „procenat je pogrešna mera na niskom obimu" | [H] |
| `CILJ_OBIM_*` 55/70/80/95 km; `peakVol`: `odredište = min(CILJ, max(cur·1.75, cur+20))`, `gornja = max(cur·1.10, odredište)`, apsolutni plafon 120/140/160/180 | | | [H][P] |
| `lrCap_*` (udeo nedelje, vremenski cap, apsolutni cap): 5K `max(.27v, min(8,.40v))`, 90 min, 20 km; 10K `.30/.42`, 105 min, **24 km**; HM `.30/.45`, 135 min, **22 km**; 42K `.30/.42`, 180 min, 32 km | | | [H] [?] absolutni cap 10K (24) > HM (22) — verovatno nedostižan zbog vremenskog capa (105 min), ali **nedovoljno dokaza da je namerno** |
| Budžeti zona po nedelji: I ≤8% (5K) / 8% (10K) / 6% (HM) / 5% (42K); T 10%; R 5/4/3/2%; M/ritam 10% (≤12/≤16 km) | | „Danielsovi procenti — smernica, ne izmerena granica" | [H] |
| `tempoMaxSec`: 20/25/30/35 min | | | [H] |
| `qual2MinKm`: 18/24/30/38 | | | [P] |
| `bazaMin`: 30/40/45/55 km | | upozorenje, ne blokada | [P] |
| `baseWeeksBeginner`: 6/8/10/12; `RW_WEEKS=4`; lestvica 1:1→2:1→3:1→5:1 | | | [H] |
| `POCETNIK_MAX_KM = 30` | | upozorenje | [P] |
| `undulacija [0.94, 0.99, 1.03]` na odredištu | | „ne treba da raste, ali 18 identičnih nedelja se ne čita kao plan" | [H] |
| MLR (HM/42K): `minDana 5`, `minKm 45/50`, udeo `.62/.60` LR-a; bira lak dan najdalje od LR (izbegava samo LR–MLR susedstvo) | | Pfitzinger obrazac | [H] |
| Gorivo u opisu LR: HM ≥90 min; 42K ≥75 min, jako ≥120 min | | | [H] |
| Izravnavanje rasta: dozvoljen korak ×1.6 apsolutnog koraka; sečenje samo lakih dana, ≤30% sopstvene vrednosti, pod `podPoDanu` (1.5–3 km) | | „10% pravilo nije potvrđeno u RCT-u (Buist 2008); rizik vezan za skokove >30% (Nielsen 2014)" | [H] |
| `GROW_MAX=1.08` | | **koristi ga samo `reentryPlan`** | [H] |
| 42K ciklus LR (`lrCiklus42K`): faktori 1.00/.85/.75/1.00/.85/.92/.80 po „doKraja" | | dva prava vrhunca LR | [H] |
| Faze po udelu kvalitetnog ciklusa: 5K `.25/.75`, 10K `.30/.70`, HM `.30/.60`, 42K `.33/.73` | | | [H] |

### 5.3 Product decision [P]

Podrazumevane vrednosti (`runDays=4`, `quality=2`), LR podrazumevano nedelja, plan počinje od dana generisanja (ne od ponedeljka), `RW_WEEKS` kao „obavezan mesec", UI poruke i svih ~15 `dayWarnings`, `qual2MinKm`, `bazaMin`, minimalni broj dana po distanci (`minDanaPrep` HM 4 / 42K 5), snaga na prvom slobodnom danu (`pickStrengthDay`, samo `runDays ≤ 5`), vlasnikov hardkodovan plan, to što se **ništa ne blokira** („plan kaže istinu i pušta čoveka da odluči"). **Granica kategorija se u kodu već poštuje u komentarima**; u TS-u se kategorije razdvajaju strukturno (§10).

## 6. VDOT adaptacija — poređenje sa zahtevom

Zahtev: *min. broj merenja, confidence, prag, glačanje, zaštita od jednog izuzetnog treninga, manual override, zaštita zaključanog treninga; nikad ubrzati ceo plan na osnovu jednog treninga.*

| Zahtev | Stari kod | Ocena |
|---|---|---|
| Minimum merenja | `VDOT_MIN_MERENJA = 3` za **predlog** | ✔ |
| Prag | `VDOT_PRAG = 1.5` VDOT poena; `VDOT_PRAG_SEK = 3` s/km po danu | ✔ |
| Glačanje | `preracunajVdotLog`: `vdot = prev + α(izmereno−prev)`, α po tipu sesije: test3k **.60**, tempo **.28**, interval **.12**, repeticije **.04**, ostalo **.15** | ✔ [H] (težine su inženjerski izbor, kod to kaže) |
| Zaštita od jedne izuzetne sesije | automatska: odbacuje se merenje koje odstupa >`AUTO_VDOT_TOL=4` od forme; van opsega tablice (`vdotPaceUOpsegu`); nemoguć VDOT (`vdotMoguc`). **Ručni unos se uvek prihvata** (osim van tablice) | ✔ |
| Sesije koje ne mere formu | `nemeri` (aktivacija, tempo trke: `KIND_IZ_CILJA`) — čitati ih kao merenje daje cirkularnost (inverz M propisa **jeste** `vdotGoal`) | ✔ ispravno i važno |
| Idempotentnost | lanac je čista funkcija sortiranih izmerenih vrednosti; ponovni unos istih podataka ne pomera VDOT | ✔ |
| Manual override / zaključan trening | `S.alts[id].pace` (ručno) ima prednost; `paceAuto` razlikuje auto; `session.overrides.paceSec` štiti od prepisa; `vdotPredlog` preskače ručno zaključane, odrađene, dan trke, aktivaciju | ✔ |
| **Nikad automatski ubrzati plan** | `vdotPredlog` samo **predlaže**; primena traži korisnikov klik (`primeniVdotPredlog`); obim se ne dira | ✔ |
| **Confidence** kao veličina | **ne postoji eksplicitno**; α po tipu je implicitna težina | **✗ nedostaje** — predlog: izvedena `confidence` (broj merenja × težina tipa) samo za prikaz, **bez** promene praga |
| `recalibratedPlan` (regeneriše preostale nedelje sa virtuelnim PB-om) | **ne poziva se iz UI-ja** (v. ARCHITECTURE R7) | [?] portovati + testovi, ne povezivati bez odluke |

## 7. Obim, struktura nedelje, sesije

**Obim.** Rampa je `vol_{k+1} = min(vol_k + korak(vol_k, intensity), peakTarget)` sa deloadom svake 4. (`vols[]` posle deloada se nastavlja od nedelje PRE deloada), pa undulacija tek kad je odredište dostignuto. Ciljni niz se **posle** potkresuje stvarnom raspodelom (`allocEasyLR`, izravnavanje, klamp tapera), pa je isporučeni obim ≠ ciljni. Merenje u kodu: bez klampa taper je isporučivao 83–92% vrhunca umesto 80%.

**Struktura nedelje.** `buildDaySlots`: LR `lrDow` (podrazumevano 7); `effQ = runDays≤3 ? 1 : ≤2`; `q1` ≈ 1/3, `q2` ≈ 2/3 preostalih dana (ili tačno izabrani); `mlr` na lakom danu najdalje od LR; `rest` ostaje; snaga prvi `rest` (Pon–Sub) ako `runDays≤5`. `dayPrefWarnings` samo upozorava (dva teška dana zaredom; LR uz MLR). **Dokazano „etalon" samo za `runDays=4, quality=2`** (kod to kaže); ostale kombinacije su ekstrapolacija [H].

**Sesije po distanci** (`mk*`/`buildQuality*`): intervali (5K 600–1200 m, 10K 1000–1600, HM 1200–2000, 42K 1200–2000), tempo kontinuirani (limit `tempoMaxSec`), cruise (`Tempo isprekidan`), repeticije (5K 200/300 m; 10K/HM/42K manje), piramida i fartlek (samo 5K/10K), trkački ritam (5K/10K), progresivno (10K/HM/42K), **kontrolna trka** (HM, 4 ned. pred cilj), maratonski tempo (42K), strides (svaki 2. lak dan). Strategija ritma HM po vremenu trke: `<80 min → 'prag'`, `≤110 → 'blokovi'`, inače `'dugo'`.

**Odvojenost po distanci.** Matrica familija po distanci je zaključana testom `simetrija-distanci`; „61 funkcija i 25 konstanti nose sufiks 5K/10K/21K/42K" (README). Cilj nove arhitekture je profil **kao podatak + strategije kao funkcije**, ne 4× kopirane funkcije — ali **bez promene izlaza** dok otisak ne kaže drugačije.

## 8. Povreda, opterećenje, povratak (domen oporavka)

Čiste funkcije nad `S.knee`, `S.log`, planom (sve [H], bez objavljenog izvora u kodu osim ACWR/Gabbett napomene):
`kneeStatus` (7 dana: ≥3 dana sa bolom ≥3 → „FIZIJATAR"; maks ≥6 → „STANI"; ≥3 → „PAZI"), `returnToRunPhase` (42 dana lookback; 7 dana bez bola, pa lestvica 50/70/85% po nedelji, zatim 100%), `injuryProposal` (bol → run/walk `RW_PO_BOLU` od bola ≥4: 9→1:2 @25%, 7→1:1 @35%, 6→2:1 @45%, 5→3:1 @55%, 4→5:1 @65%; ne-nosivi delovi tela ne zaustavljaju plan), `PREKID_PROZOR=28`, `PREKID_PRAG=0.70`, `PREKID_BEZ_KVALITETA=10`, `hronicniObim` (prosek 4 nedelje, sa `vanPlana` za pre-plan trčanja), `acwrSada`, `acwrPlan`.
Invarijanta: **plan se nikad ne prazni** ni na bolu 10 (test `povreda`).
`reentryPlan(input, resumeWeek, lastRealizedVol, vdotAtPause)`: prva nedelja ≤ `lastRealized·GROW_MAX`, ostalo „vraća krivu". **Ne poziva se iz UI-ja.**

Napomena o imenovanju: perzistirano polje `S.knee` nosi zapise o bolu za sve delove tela; ime ostaje (data contract), tip u TS: `PainRecord`.

## 9. Postojeći testovi → invarijante → TS pandan

Tabela je **obaveza**: nijedan stari test se ne briše dok njegova invarijanta nema TS test. Status je „TODO" dok se ne portuje (praćenje u `docs/REWRITE_PLAN.md` §6).

| Invarijanta iz zadatka | Stari test(ovi) | Novi test (cilj) |
|---|---|---|
| NaN / Infinity u km, opisu, tempu | `generator` „bez NaN", „neuredna decimala"; `pure` | `generator.invariants.test.ts` + **novo**: `generator.input.test.ts` (§11) |
| invalid dates, impossible race dates | `generator` „odbija degenerisan ulaz" (pokriva samo `minWeeks`/`maxWeeks`) — **rupa** | **novo** (property test nad datumima) |
| invalid race distance | `generator` (`raceDistM:1234`) | `generator.input.test.ts` |
| inconsistent session mileage / description | `generator-racunica` (km dana == `sessKm`, opis) | `session.calc.test.ts` |
| incorrect pace | `generator-racunica` „tempo svake sesije je tempo zone", `pure` zone | `vdot.zones.test.ts`, `session.calc.test.ts` |
| incorrect WU/CD | `simetrija-distanci` „zagrevanje iz jedne funkcije"; `deload-ostrina` | `session.wucd.test.ts` |
| broken taper | `generator` „taper i trkačka ispod vrhunca"; otisak | `taper.test.ts` |
| broken deload | `generator` „deload manji", `deload-ostrina` (11) | `deload.test.ts` |
| reverse mileage progression | `generator` „obim nikad ne skoči preko bezbedne granice"; otisak | `volume.progression.test.ts` |
| invalid long run | `generator` „LR je NAJDUŽE", `simetrija` lrCap | `longrun.test.ts` |
| duplicated dates | `generator` „dow jedinstven", „7 dana" — **datumi se ne proveravaju u domenu** (nema dana sa datumom do `adaptGeneratedPlan`) | **novo** na nivou `adaptPlan` |
| orphan prediction rows | `generator` „PRED i qs pokazuju na dan koji stvarno postoji", `forma-vs-plan` | `pred.consistency.test.ts` |
| broken race-week activation | `forma-vs-plan` „aktivacija pred trku" (4 distance × ranih dana u nedelji) | `raceweek.test.ts` |
| golden master | `generator-otisak` (2304) | **parity gate** (§10): isti SHA po scenariju |
| VDOT referentne vrednosti | `pure` | `vdot.reference.test.ts` + tabela |
| lanac forme, glačanje, `nemeri` | `vdot-plan`, `forma-vs-plan`, `state` | `vdot.chain.test.ts` |
| povreda/povratak | `povreda`, `povratak-obim`, `opterecenje-pre-plana` | `injury.test.ts`, `load.test.ts` |
| test na 3 km | `test-3km` (39) | `t3k.test.ts` |

## 10. Ciljna struktura i strategija parity-ja

```
web/src/domain/training/
  types.ts                 wire-oblik (perzistirani) + discriminated unions (Day po `tag`, Session po `type`)
  constants/{evidence,heuristics,product}.ts   TRI ODVOJENA FAJLA — nikad pomešane konstante (zahtev #12)
  date/                    čist UTC epoch-day račun, bez Date.now()
  vdot/                    calculateVDOT, racePrediction, paceForZone, vdotFromPace, zones.ts
  generator/               generatePlan (orkestrator), validateInput, buildDaySlots, volume, deload, taper, progression, raceWeek, warnings
  distances/               profile5k, profile10k, profileHalf, profileMarathon  (DistanceProfile = podaci + strategije)
  sessions/                intervals, tempo, cruise, repetitions, progression, longRun, strides, fartlek, pyramid
  adaptation/              vdotChain (preracunajVdotLog), proposal (vdotPredlog), recalibrate, reentry
  recovery/                injury, returnToRun, acwr
  validation/              validatePlan (invarijante kao funkcija — korišćena i u testovima i u runtime-u za uvezene planove)
```

**Ne koristi:** DOM, `localStorage`, `fetch`, `window`, `document`, `Date.now()`/`new Date()` bez ubrizganog sata, Zustand, Supabase, React. Pravilo se **nameće** ESLint `no-restricted-globals`/`no-restricted-imports` na `src/domain/**` i Vitest-om koji uvozi domen u `node` okruženju.

**Parity strategija (dva koraka, ne jedan skok):**

- **Korak A — port bez promene ponašanja.** Isti redosled operacija i zaokruživanja (`r1`), isti izlaz. Gate: `scenariji()` iz `test/otisak-generatora.mjs` (2 304) → `kanonski()` → SHA-256 → **identičan** `fixtures/otisak-generatora.json`. Novi Vitest test učitava isti fixture. *To je jače od „funkcionalne ekvivalencije" iz zadatka i jeftinije od ručnog parity testa.* Dodatno: diferencijalni test protiv živog starog generatora (`harness.loadApp`) na slučajnim (seeded) ulazima — hvata ono što otisak ne pokriva (`lrDow`, `qDows`, `runDows`, `goalSec`, `quality:1`: otisak ih nikad ne menja).
- **Korak B — namerne izmene**, svaka kao zaseban commit: (1) opis starog ponašanja, (2) zašto je problem, (3) novo ponašanje, (4) test koji potvrđuje; otisak se regeneriše **samo** u tom commit-u, a diff otiska je deo review-a. Dokumentuje se u `docs/ENGINE_CHANGES.md` (nastaje u Koraku B).

Pokrivenost otiska — **šta NE meri**: `goalSec`, `lrDow`, `qDows`, `runDows`, `quality:1`, `startDate` usred nedelje (fiksan ponedeljak 2026-01-05), nepoznat `intensity`, jedan PB po distanci, funkcije nivoa `S.genPlan` (`recalibratedPlan`, `reentryPlan`, `planSaNovimCiljem`). Pokriva: 4 distance × 3 dužine × `runDays` 3–6 × 8 obima × 3 `intensity` × početnik/trenirao. Zato su dodatni diferencijalni testovi obavezni.

## 11. Defekti nađeni probama (reproduktivno)

Skripte: `docs/probes/legacy-degenerate-input.mjs`, `legacy-nan-leak.mjs`, `legacy-volume-vs-vdot.mjs`. Rezultat pokretanja 2026-10-01 na `APP_VERSION 282`:

| ID | Ulaz | Stari izlaz | Zašto je problem | Predloženo (Korak B) |
|---|---|---|---|---|
| G1 | `raceDate:'abc'` ili izostavljen | plan sa `weeks:[]`, `meta.weeks=NaN`, **bez `error`** | prazan plan tretiran kao uspeh; `adaptGeneratedPlan` ga prihvata | `validateInput` → `error` |
| G2 | `raceDate:'2026-02-31'` | plan do 03.03. (prelivanje) | nemoguć datum prihvaćen kao drugi | odbiti: kalendarska validacija |
| G3 | `startDate` nevažeći/izostavljen | `RangeError: Invalid time value` (izuzetak) | rušenje umesto greške; `planSaNovimCiljem`/`recalibratedPlan` nemaju `try` | `error` |
| G4 | `intensity` izostavljen/nepoznat | `NaN` u `vdotGoal`, `racePace`, **4 `km`**, **5 opisa** | NaN u perzistiranom planu; u UI „NaN km" | odbiti ili podrazumevano `std` (odluka D2) |
| G5 | `pb.sec=Infinity` / `1` | `vdot0 = −5.7` / `7 312 972,9`; opisi sa `NaN` | `PB_SANITY` je samo u UI-ju | granice po distanci u domenu |
| G6 | `weeklyKm:Infinity` / `500` | prolazi, `NaN` u 2 mesta (`Infinity`) | | konačnost + gornja granica |
| G7 | `goalSec:1` | `racePace = 0` | deljenje/0 tempo u sesijama | `goalSec` ∈ (predictedSec·0.5, ·2) ili odbij |
| G8 | `raceDistM:'5000'` (string) | prolazi (koercija ključa) | tip curi u `meta.raceDistM` | striktan tip |
| G9 | isti ulaz, PB 18:20 vs 25:00 | različit obim: 10/17 ned (5K), 17/21 (10K), 19/27 (HM), 12/34 (42K); max 7,9 km | zahtev „obim odvojen od forme" nije doslovno tačan | odluka D1 |

## 12. Odluke za vlasnika (blokiraju Korak B, ne Korak A)

- **D1 — Spregnutost obima i tempa kroz vremenske plafone.** Opcije: (a) zadržati (vreme-na-nogama), dokumentovati kao [H], dodati test koji ograničava efekat; (b) razdvojiti (obim isključivo iz `weeklyKm`, plafoni u km). **Preporuka: (a)** — (b) bi promenio planove svima i ne popravlja trenersku ispravnost; ali tvrdnja „obim je odvojen od forme" mora iz dokumentacije otići.
- **D2 — `intensity` kao jedna ručica za dva efekta** (rast obima i rast VDOT-a). Predlog: dokumentovati; razdvajanje je izmena proizvoda.
- **D3 — `confidence`** kao prikazna veličina (§6).
- **D4 — Granice `PB_SANITY`/`goalSec` u domenu** (G5, G7) — brojevi su product decision; predlog: preuzeti `PB_SANITY` kao jedini izvor.
- **D5 — Taper kao eksplicitna zastavica** u `Week` (sada samo `focus` tekst) — **dodavanje polja** menja perzistirani oblik; samo uz bump `SCHEMA` i unazad-kompatibilno čitanje. Preporuka: **ne sada**.

## 13. Rezime

**Zadržati:** VDOT matematiku, `vdotFromPace` round-trip, ceo lanac forme (glačanje, `nemeri`, idempotentnost), predlog-bez-automatike, deload/taper klampove, protokol trkačke nedelje po pomeraju, izravnavanje rasta, otisak i invarijante, upozorenja koja „govore istinu".
**Promeniti (Korak B):** G1–G8 (validacija), spojiti tri Riegel funkcije, ukloniti zavisnost od TZ-a, jedan izvor `PB_SANITY`, `confidence` samo za prikaz (ako D3).
**Dodatni testovi:** Daniels tabela za zone (sve 4 zone × VDOT 30–80), Newton konvergencija van 20–85, property testovi za datume, diferencijalni test protiv starog generatora na `lrDow/qDows/runDows/goalSec/quality`, `validatePlan` nad svim planovima otiska, `recalibratedPlan`/`reentryPlan` kroz otisak varijante.
**Ne znam / nedovoljno dokaza:** tačnost konstanti zona prema Danielsovim tabelama; izvori taper brojeva; da li je `agr=.43` šire primenljiv; da li je `qDows`/`runDows` kombinacija koje nisu `4d/2q` ikad klinički proveravana.

## 14. Odluke vlasnika i provera tvrdnji (2026-10-02)

**Odluke:** D1 (a) ostaje · D2 razdvojeno (`volIntensity`) · D3 ne · D5 zastavica `taper` · `recalibratedPlan` povezan. Detalji i testovi: `ENGINE_CHANGES.md` Korak C.

**Provera tvrdnji iz odgovora o generatoru** (svaka ponovo izvedena, ne preuzeta):

| Tvrdnja | Rezultat | Kako |
|---|---|---|
| D1: PB menja obim — 5K 10/17 nedelja (do 1,7 km), 10K 17/21 (do 7,9), HM 19/27 (do 4,2) | **Tačno, ali sa ispravkom:** PB-ovi nisu isti po distancama — 5K 18:20 vs 25:00, 10K 40:00 vs 55:00, HM 1:23:20 vs 2:05:00; maraton (3:00:00 vs 4:20:00) 12/34 nedelja, do 0,3 km (u odgovoru nije bilo) | `node docs/probes/legacy-volume-vs-vdot.mjs` (stari kod) |
| D1: „tebe ova razlika praktično ne pogađa" | **Potvrđeno za 5K / 40 km nedeljno / 5 dana:** PB 19:30, 20:00, 21:30, 22:30 naspram 20:37 menja 4–7 od 25 nedelja, najviše za 0,2–0,6 km | skripta nad starim kodom (isti ulaz, 5 PB-ova) |
| D2: „tempo napretka određuje i rast obima i ciljni VDOT" | **Tačno.** Dodatak koji nisam rekao: na 5K ovaj izbor ne menja vrhunac plana (55,3 / 55,2 / 55,2 km za kons/std/agr) — samo koliko brzo se do njega stiže (prvih ~8 nedelja); na maratonu menja i vrhunac (62,3 / 65,0 / 67,8 km) | probe (stari kod), `generator.volIntensity.test.ts` |
| D5: „taper se prepoznaje samo po tekstu opisa nedelje" | **Netačno / nepotpuno.** Prikaz faze (`weekPhase`) je koristio POZICIJU (pretposlednja nedelja = TAPER), a tekst „Taper …" je postojao samo u opisu. Posledica: na HM i maratonu (2 taper nedelje u generatoru) prva je prikazivana kao „VRHUNAC". Ispravljeno | čitanje koda + `taper.test.ts` |
| „Taper: 5K i 10K jedna nedelja, HM i maraton dve" | **Tačno** (`taperWeeks`: samo 21K i 42K ga definišu = 2, ostalo podrazumevano 1) | `distances.ts` |
| „Granice tempa 2:20–20:00 po km" | **Tačno** (`MIN/MAX_PLAUSIBLE_PACE_SEC_PER_KM` 140 / 1200) | `constants/product.ts`, `generator.input.test.ts` |
| „Prag 1,5 VDOT, bar 3 merenja, 3 s/km" | **Tačno** | `constants/heuristics.ts` + oracle test adaptacije |
| VDOT/Daniels-Gilbert formula | **Slaže se sa objavljenim vrednostima** (sekundarni izvor, nije Danielsova knjiga): 5K 20:00 → VDOT 49,8 (kod: 49,81); ekvivalenti 1 milja 5:51, 10K 41:28, HM 1:31:50, M 3:11:17 — sve se poklapaju do sekunde; prag-tempo 6:52/mi (kod 4:16/km = 6:52/mi); VO2max-tempo 3:51/km (kod 3:51/km) | `vdotFromRace`, `raceTimeForVdot`, `paceForZone` pokrenuti nad 5K 20:00; izvori: runbuzz.com, brenoamelo.com (pretraga) |
| Taper obim | **Smer i trajanje se slažu sa metaanalizom** (Bosquet i sar., 2007: taper 8–14 dana, obim −41–60 %, intenzitet i frekvencija neizmenjeni). Konkretne vrednosti u kodu (`taperFactor` 0,65–0,75, trkačka nedelja 0,3–0,4) NISU izvedene iz te studije i izvor im ne znam | pretraga; `distances.ts` |

**I dalje „nedovoljno dokaza" (nije moglo da se potvrdi):** udeli VO2max za zone **E** (0,70) i **R** (1,05) — sekundarni izvori se razilaze oko lakog tempa; `agr = 0,43 VDOT/nedelji` („kalibrisano na jedan dokumentovan slučaj" — slučaj nije dostupan); izvor konkretnih taper faktora. T, I i M zone i sve race-ekvivalencije jesu potvrđene.


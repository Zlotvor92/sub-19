# Faza 3a — dizajn predaje v2 između distanci (izveštaj)

Grana `claude/generator-isolation-5k-10k-hm-marathon`, polazni SHA `4780b9a`. Samo čitanje + merenje; kod nije menjan.
Merne skripte i izlazi su u ovom folderu (§ 7). Brojevi linija važe na `4780b9a`.

## 0. Zaključak

1. **Kraća distanca u v2 (P1):** danas je nema — v2 adaptacija nikad ne odbija (4a: 0 / 114 012 HM, 0 / 164 394 maraton),
   ali u **3 018 / 114 012 (2,6 %)** HM i **3 141 / 164 394 (1,9 %)** maratonskih tokova adaptacija spusti najduži dugi ispod praga distance, a plan
   ostaje „puna priprema" bez ponude. Preporuka: odluka v2 izvora kad je posle adaptacije najduži dugi < praga sopstvenog
   upozorenja (HM 16 / početnik 14 km, maraton 26 / 24 km), samo opcija „kraća distanca" (+ „zadrži plan").
2. **Činjenice (P2):** `HandoffFacts` (v1) se popunjava bez politike izvora: `execution` iz opisa 28 dana + potvrde
   korisnika, `startingKm = reportedBaseKm`, ulaz bez izvedenih polja; za v2 cilj se dodaje neobavezno polje sa sirovim
   činjenicama (oblik `AdaptFacts`, bez `dayId` izvora).
3. **Cilj (P3):** v2 cilj = `generate` (činjenice ulaza, cele nedelje do trke) + `adapt` (iste činjenice) — bez novih
   trenerskih brojeva; adapt nikad ne odbija (M3), odbijanja su samo ulazna (< 8 / < 10 nedelja, opseg obima i dana).
   v1 cilj radi mehanički, ali **curi format v2** u 100 % predaja i ne radi za plan po osećaju (M2) → potreban čistač
   pogleda izvora u `handoff.ts`. Izbor v2/v1 cilja = prekidač cilja (`generatorForNewPlan`).
4. **Ugovor (P4):** `preparationForPlan` dobija `HM_V2_PREPARATION`/`MARATHON_V2_PREPARATION` (`policy: null` uvek);
   jedina tipska izmena: `isLimitedLongPreparation(meta, plan?)`. Nijedan v2 ne uvozi drugi; lepak ostaje `select.ts` +
   `handoff.ts`.
5. **Format (P5):** plan posle predaje = nova revizija u formatu cilja; prošle nedelje izvora se kaleme po početku nedelje
   (ID dana kao v1), inače se dnevnik izvora (`log[id]`, `g{w}d{dow}`) lepi za dane cilja.
6. **Segmenti (P6):** 3b lepak → 3c HM v2 izvor ∥ 3d 10K/5K v2 cilj → 3e maraton v2 izvor → 3f HM v2 cilj → 3g UI + E2E.

## 1. Stanje danas

**v1 (radi, Predaja-1).** Tok: `stores/executionActions.ts:359` `storedPreparationDecision` → `select.ts:1291`
`preparationForPlan` (samo `HALF_MARATHON_GENERATOR`/`MARATHON_GENERATOR`) → `halfMarathon/plan/preparationDecision.ts:267`
`preparationDecision` (`SHORTER` :32, HM → 10K, 5K; maraton :32 → HM, 10K) → `regenerate` :168 → argument `handoff`
= `handoff.ts:13` `regeneratorForDistance` (10K/5K/HM **v1**) → cilj `tenK/plan/handoffTarget.ts:85` `handoffFuture` →
`handoffInput` :54 (saglasnost `startDate = execution.date + 1` :66) → `returnInput` (cilj izvodi obim, dugi, spremnost,
politiku). `HandoffFacts` nije u `contract.ts`: strukturni tip po distanci (HM :161, maraton :162, ciljevi
`*/plan/handoffTarget.ts:22`). Okidač: `isLimitedLongPreparation` (dugi < 16 km HM / 26 km maraton ili vrh < minPeakKm).

**v2 (nema predaje).** `preparationForPlan` → `null` za `HALF_MARATHON_V2_GENERATOR`/`MARATHON_V2_GENERATOR`
(`select.ts:1291–1295`; komentari :725, :915–916, :1170 „faza 3"). `executionBasis` je (b) „ne koristi se"
(`halfMarathon/v2/app/members.ts:40, 64`; isto maraton, 10K). Preporuke kraće distance postoje samo kao ODBIJANJA
čarobnjaka (plan ne postoji, nije predaja): HM `input.ts:97` RUN_WALK, `:130` PLAN_TOO_SHORT („10K"), BEGINNER_SHORT,
`generate.ts:101` RECENT_LONG_TOO_SHORT (samo generator, ne adaptacija — `policy.ts:402` N10.2); maraton `input.ts:109,
142, 208`, `generate.ts:78`. Stanje „priprema nepotpuna" v2 samo PRIJAVLJUJE: HM `validate.ts:656` LONG_RUN_SHORT
(`longWarnKm` 16 / početnik 14, `policy.ts:663, 521`), maraton `validate.ts:632` MARATHON_LONG_SHORT (26 / 24).
Format: plan v2 nema `ulaz`; nosi ceo plan v2 (`hmV2`/`marathonV2`/`tenKV2`) i meta v2 (`plan.ts:186`); ID dana
`g{w}d{dow}` (`plan.ts:223`) — isti oblik kao v1.

## 2. Merenja

**M1 — `shorter.ts`** (4a mreže, uzorak 193/97/29 kao `early.ts`, svih 17 scenarija + lanac; plan porodice R dobija
cilj = prognoza v2):

| Mera | HM v2 | maraton v2 |
|---|---|---|
| planovi / tokovi / odbijene adaptacije | 212 / 114 012 / 0 | 253 / 164 394 / 0 |
| plan iz generatora već ispod praga (`bornShort`, stanje čarobnjaka) | 28 (13 %) | 188 (74 %) |
| **adaptacija spustila najduži dugi ispod praga** (`longLost`; prag v2 16/14, 26/24 km) | **3 018 (2,6 %)** | **3 141 (1,9 %)** |
| od toga upozorenje v2 novo posle adaptacije | 3 018 | 2 558 |
| isto po v1 pragu (16 / 26 km za sve) | 2 368 | 2 989 |
| scenariji (najčešći) | pauza 35 878, bol+pauza 403, pauza 20 386, bol 8 346, bol 5 325 | test5k 615, pauza 35 598, bol+pauza 311, bol 8 282, pauza 20 281, slower 248 |
| preostalo nedelja (4–7 / 8–11 / ≥ 12) | 341 / 1 370 / 1 307 | 226 / 876 / 2 039 |
| najduži dugi posle ≥ 10 km (10K po dužini) / ≥ 16 km (HM) | 2 997 / — | 3 141 / 3 106 |
| ocena cilja lošija (R, cilj = prognoza) | 3 957 / 45 522 (slower, test5k) | 5 547 / 70 668 (slower, test5k) |

Kod maratona rezultat (test5k = fiksno 25:00, slower) spušta VDOT → kraći dugi po trajanju (150 min) → ispod 26 km; to
je okidač „kraća distanca" iz rezultata, ne iz pauze (O1).

**M2 — `v1target.measure.ts`** (v1 cilj BEZ izmene nad planom za upis v2; asOf start − 1, kraj ned. 2, ⌊N/2⌋; bez
izvršenja i sa potvrđenom pauzom 14 d; izlaz `v1target.json`):

| Izvor → cilj | pozivi | uspeh | curenje meta v2 | objekat v2 ostaje | prošli dani v2 (`structure`) | izbor posle upisa |
|---|---|---|---|---|---|---|
| HM v2 (rezultat) → 10K/5K v1 | 2 088 | 2 088 | 2 088 (`racePace`, `trainingVdot`, `predictedHmSec`, `paceBasis`) | 2 088 (`hmV2`) | 1 740 | 10K v1 / 5K v1 |
| HM v2 (po osećaju) → 10K/5K v1 | 2 448 | **0** | — | — | — | „Neispravan skorašnji rezultat" (v1 traži `pb`) |
| maraton v2 (rezultat) → HM/10K v1 | 2 700 | 2 700 | 2 700 (+ `mpVdot`, `predictedMarathonSec`) | 2 700 (`marathonV2`) | 2 252 | HM v1 / 10K v1 |
| maraton v2 (po osećaju) → HM/10K v1 | 3 168 | **0** | — | — | — | isto |

Posledica curenja (čitanjem koda, nije mereno): `previewRestore` (`executionActions.ts:598`) bira generator po
snimku; vraćanje revizije HM v2 na plan 10K v1 koji nosi zastareli `hmV2` prolazi `restoreMerge` (`v2Of(current)` nije
`null`) i spaja nad zastarelim planom v2 umesto da odbije.

**M3 — `v2target.ts`** (v2 cilj = generate + adapt, činjenice izvora bez `dayId`; asOf start − 1, kraj ned. 2,
⌊N/2⌋, N − 4; scenariji none/under50/pause35/pain8/fatigue; obim = čarobnjak izvora; izlazi `v2target-*.json`):

| Izvor → cilj | pozivi | generisano | adapt OK / odbijeno | zajedničke provere | uspeh po preostalim nedeljama (< 8 / 8–9 / 10–11 / ≥ 12) |
|---|---|---|---|---|---|
| HM → 10K v2 | 4 240 | 1 840 | 1 840 / 0 | 0 | 0/1485 · 325/530 · 400/560 · 1115/1665 |
| HM → 5K v2 | 4 240 | 1 385 | 1 385 / 0 | 0 | 170/1485 · 230/530 · 250/560 · 735/1665 |
| maraton → HM v2 | 5 060 | 2 265 | 2 265 / 0 | 0 | 0/1480 · 0/390 · 310/580 · 1955/2610 |
| maraton → 10K v2 | 5 060 | 1 755 | 1 755 / 0 | 0 | 0/1480 · 165/390 · 295/580 · 1295/2610 |

Odbijanja cilja (najčešća): PLAN_TOO_SHORT (10K < 8, HM < 10 ned.; 5K PLAN_LENGTH_OUT_OF_RANGE), opseg obima za broj
dana (WEEKLY_KM_TOO_HIGH / OUT_OF_RANGE), dani početnika (BEGINNER_DAYS, 5K RUN_DAYS_COUNT), EASY_PACE_REQUIRED (rezultat
izvora stariji od 84 d u trenutku predaje, a lak tempo nije u ulazu izvora).

## 3. Pitanja, opcije, preporuke

**P1 — kada v2 nudi kraću distancu.** v1 ekvivalent (`preparationDecision`) u v2 ne postoji; v2 adaptacija nema
odbijanje sa preporukom (4a: 0), pa „adaptacija prihvaćena, priprema nepotpuna" (M1) je jedino stanje predaje.
- A. Ništa (kao danas): M1 tokovi ostaju bez ponude; preporuka samo u čarobnjaku.
- B. **(preporuka)** Odluka v2 izvora: posle prihvaćene adaptacije, najduži dugi < praga sopstvenog upozorenja (ista
  funkcija kao validator: HM `longestLong10`, maraton `longShortOf`; jedan vlasnik), a pre adaptacije nije bio; trka u
  budućnosti. Opcije: kraća distanca istog datuma (prva koju cilj pokriva, redom kao v1) + „zadrži plan v2". Prikaz u
  pregledu adaptacije, nikad automatski. Pauza/bol/manjak ulaze samo kroz adaptaciju (ona već smanjuje), ne kao drugi
  okidač — nema dva limita za istu stvar.
- C. Pun v1 skup (i „pomeri trku", „povratni režim"): pretraga 52 nedelje generisanjem v2 i bazni režim su nova
  pravila — van faze 3 (otvoreno pitanje O2).
Cilj (ocena) „unrealistic" posle rezultata nije okidač (v1 ga nema; M1 meri učestalost radi odluke).

**P2 — šta izvor šalje.** Samo činjenice (pouka 21, uslov 5):
- ulaz: datum trke, dani i dan dugog, početnik, poslednji rezultat (iz ulaza ili iz koraka adaptacije — `step.result` je
  činjenica), lak tempo, skorašnji najduži i obim iz čarobnjaka (označeni kao stari unos, ne izvedeni);
- izvršenje: sirove činjenice prozora 28 dana (zapisi sa datumom, km, s, RPE, bol; pauze; pokrivenost; rezultati) —
  ono što `v2/app/facts.ts` već gradi, BEZ `dayId` izvora (dan izvora nije dan cilja; M3 bez njega: 0 odbijanja);
- NE šalje: korake adaptacije (`startKm`, `levelKm`, `returnFrom.share`, `restart`, `orientation`), politiku, policyId.
`HandoffFacts` (v1 oblik) v2 izvor MOŽE da popuni bez politike: `execution` = {datum potvrde, razlog i trajanje pauze iz
potvrde korisnika (kao v1 tok), `reportedBaseKm`/`reportedLongRunKm` iz opisa 28 dana (`executionModel`, član „v2"),
`startingKm = reportedBaseKm`}, ulaz saglasan (`startDate = datum + 1`) → v1 cilj ide kroz `returnInput` i `startingKm`
ne čita. Za v2 cilj: neobavezno polje `raw` (sirove činjenice); v1 ciljevi ga ne čitaju (strukturni tip).
Preporuka: `HandoffFacts` premestiti u `contract.ts` (type-only, neutralan) uz `raw?`; vrednosti za v1 bajt-iste.

**P3 — kako cilj izvodi povratni ulaz.**
- v2 cilj: A. **(preporuka)** `generate` iz činjenica ulaza (start = cele nedelje do trke od asOf + 1, `alignedStart`)
  + `adapt(plan, raw, asOf)` — povratnu politiku određuje adaptacija cilja (A2/A3/A5), bez novih brojeva; M3: 0
  odbijanja adaptacije, 0 prekršaja zajedničkih provera. B. Obim iz činjenica u ulaz (npr. prosek 2–4 nedelje) — nov
  trenerski broj, dva vlasnika obima (ulaz + adaptacija). Odbijanje generatora cilja → opcija „nedostupna" sa razlogom v2
  doslovno; nikad tihi prelaz na v1 cilj.
- Ko bira: `generatorForNewPlan(ciljna distanca, prekidači korisnika)` — isti prekidač kao čarobnjak (MASTER § 6).
- Prekidač cilja isključen → v1 cilj. Radi bez izmene v1 koda samo uz čistač u `handoff.ts`: `current` bez objekta v2 i
  meta ključeva v2 (spisak daje adapter izvora, jedini koji zna svoj format). Plan po osećaju → v1 cilj nemoguć (M2:
  0 %) → opcija nedostupna sa razlogom (O5).

**P4 — ugovor.** Postaju korišćeni: `preparationForPlan` (v2 izvori), nov `handoffFuture` u `tenK/v2/app`, `fiveK/v2/app`,
`halfMarathon/v2/app` (cilj). `DecisionBasis` v2: `policy: null` uvek (oblik dozvoljava), `guardBaseKm` izostavljen
(baza rasta je odluka cilja). `isLimitedLongPreparation(meta)` ne vidi nedelje → `isLimitedLongPreparation(meta, plan?)`
(v1 ignoriše drugi argument → bajt-isto). `executionBasis` ostaje „ne koristi se" (v2 tok ide kroz `basisFromPlan` +
pregled). Uslov 7: v2 izvor dobija ciljeve kao argument (kao `ShorterDistanceHandoff`), nijedan uvoz između foldera.

**P5 — format i istorija.** Rezultat = nova revizija (`commitPlanChange` → `recordPlanRevision`, razlog 'goal', `change`
from→to kao v1). Plan je u formatu cilja i nosi oznaku cilja (`stampForStorage`). ID: prošle nedelje izvora (≤ asOf)
ostaju u planu, nedelje cilja dobijaju ID po početku nedelje (pravilo v1 `graftFuturePlan`); novi plan sa `g1d1…` bi
zalepio dnevnik izvora za dane cilja (`log[id]`). Vraćanje na staru distancu: vraćanje revizije pre predaje → izričito
odbijanje („verzija druge distance"), ne spajanje; kao test (danas bi uspelo zbog curenja, M2). KNOWN_VERSIONS: cilj v2
koji dobije prefiks nedelja izvora ili meta predaje → nova manja verzija + stare ostaju u `KNOWN_VERSIONS`. v1 izvori, v1
ciljevi i lični plan: bajt-isti (reference `otherDistances`, `equivalence`, `personalPlan`, `policyIsolation`).

## 4. Predlog segmenata

| Seg. | Opseg (folderi) | Sadržaj | Testovi |
|---|---|---|---|
| 3b | `generators/{handoff,select,contract}.ts`, testovi u `generators/` | izbor cilja po prekidaču; čistač pogleda izvora za v1 cilj; `HandoffFacts` + `raw?` u ugovor; `isLimitedLongPreparation(meta, plan?)` | M2 ponovljen: curenje 0, objekat v2 0; v1 reference bajt-iste; `architecture`/`runtimeIsolation` |
| 3c | `halfMarathon/v2/**` | izvor: odluka P1-B (jedna funkcija), činjenice P2, `HM_V2_PREPARATION`; `members.ts` | M1 HM: broj ponuda = 3 018 / 114 012 (2,6 %); tok HM v2 → 10K v1 (čistač); T1 (politika izvora ne menja cilj) |
| 3d | `tenK/v2/**`, `fiveK/v2/**` | cilj: `handoffFuture` = generate + adapt, ID po početku nedelje, pokrivenost po pravilu cilja | M3: 0 prekršaja; T2 (politika cilja menja cilj); uslov 8 na rezultatu |
| 3e | `marathon/v2/**` | izvor kao 3c (→ HM, 10K) | tok maraton v2 → HM v1/v2, 10K v1/v2 |
| 3f | `halfMarathon/v2/**` | HM v2 kao cilj maratona | maraton v2 → HM v2 ceo tok |
| 3g | `stores/`, `features/`, E2E | odluka u pregledu adaptacije v2, potvrda, revizija, odbijanje vraćanja | E2E po kombinaciji prekidača (v2→v2, v2→v1) |

Redosled: 3b pre svih (zajednički fajlovi); 3c ∥ 3d (disjunktni folderi) tek kad se završe tekući segmenti u
`fiveK/v2`, `tenK/v2`, `halfMarathon/v2`; 3e posle 3d; 3f posle 3c (isti folder); 3g poslednji (jedna sesija).
Rizici: sudar ID-jeva dnevnika (P5); dani između predaje i starta cilja (0–6 d, O6); opseg obima/dana cilja uži od
izvora (M3); plan po osećaju bez v1 cilja (M2); vraćanje revizije preko distance; paralelni segmenti u istim folderima.

## 5. Otvorena pitanja (organizator/korisnik)

- **O1 prag okidača:** (a) pragovi upozorenja v2 (HM 16/14, maraton 26/24) **[preporuka: jedan vlasnik]**; (b) v1 16/26
  za sve (početnik dobija ponudu ranije).
- **O2 opcije pored kraće distance:** (a) samo kraća + „zadrži plan" **[preporuka]**; (b) i „pomeri trku" (pretraga
  generisanjem v2); (c) i povratni režim.
- **O3 obim v2 cilja:** (a) obim čarobnjaka + adapt sa činjenicama **[preporuka, bez novog broja]**; (b) obim iz
  činjenica (nov broj, drugi vlasnik).
- **O4 obim/dani van opsega cilja:** (a) opcija nedostupna sa razlogom v2 **[preporuka]**; (b) cilj spušta na svoj
  maksimum uz napomenu (nova odluka cilja).
- **O5 v2 izvor po osećaju, prekidač cilja isključen:** (a) opcija nedostupna („v1 cilj traži rezultat") **[preporuka]**;
  (b) v2 cilj i bez prekidača (krši MASTER § 6).
- **O6 dani od predaje do starta cilja:** (a) bez plana, kao nov plan iz čarobnjaka (`alignedStart`) **[preporuka]**;
  (b) dani izvora ostaju (kvalitet izvora pred novim planom).
- **O7 v1 izvor → v2 cilj kad je prekidač uključen:** (a) ne, v1 ostaje bajt-isti **[preporuka]**; (b) da.

## 6. Uslovi AGENTS.md (za predlog)

1 jedan vlasnik: okidač P1 = funkcija validatora; povratna politika = adaptacija cilja. 3 WU/CD: ne diraju se.
5 predaja: izvor šalje činjenice (P2), cilj izvodi ulaz i politiku (P3); test T1/T2 po obrascu Predaja-1. 6 plan cilja
nosi policyId/fazu cilja (`stampForStorage`). 7 nula uvoza: ciljevi kao argument, lepak u `select.ts`/`handoff.ts`.
8 upotrebljivost: zajedničke provere na planu cilja (M3: 0).

## 7. Komande

| Komanda (iz korena; M2 iz `web/`) | Trajanje |
|---|---|
| `node docs/generators-v2/handoff/shorter.ts HM 193 97 29 > shorter-HM.json` (i `MAR`) | 688 s / 1 406 s |
| `npx vitest run --config ../docs/generators-v2/handoff/vitest.measure.config.mjs` → `v1target.json` | 31 s |
| `node docs/generators-v2/handoff/v2target.ts HM 193 97 29 > v2target-HM.json` (i `MAR`) | 24 s / 45 s |

## 8. Odluke organizatora

- O1: (a) Okidač je prag upozorenja v2: HM 16/14, maraton 26/24 km. Ista funkcija kao validator (jedan vlasnik). Ponuda dolazi samo na PRELAZU: posle prihvaćene adaptacije najduži dugi je < praga, a pre nje nije bio, i trka je u budućnosti. Okidač iz rezultata kod maratona je dozvoljen, jer ponuda nije prelaz na silu („zadrži plan" uvek postoji).
- O2: (a) Samo „kraća distanca" i „zadrži plan v2". Pomeranje trke i povratni režim su van faze 3.
- O3: (a) Obim iz čarobnjaka + adapt sa činjenicama. Nema novog broja; povratnu politiku određuje adaptacija cilja.
- O4: (a) Opcija je nedostupna, uz razlog cilja v2 doslovno. Nikad tihi prelaz na v1 cilj.
- O5: (a) Opcija je nedostupna, uz razlog („cilj v1 traži rezultat") — MASTER § 6.
- O6: (b), NE (a). Tekuća nedelja ostaje nedelja izvora, i to adaptirana (kao prošle nedelje), a cilj počinje od sledećeg ponedeljka (alignedStart). Kalemi se na granici nedelje, istim mehanizmom kao P5 (prošle nedelje izvora + nedelje cilja sa ID po početku nedelje). Razlog: korisnik usred plana ne sme da ostane 0–6 dana bez plana. Nedelja izvora je već usklađena sa činjenicama adaptacijom koja je dala ponudu.
- O7: (a) Ne. v1 izvori ostaju bajt-isti.
- P1–P6 prihvatam, uz izmene iznad. Redosled segmenata kao u § 4.

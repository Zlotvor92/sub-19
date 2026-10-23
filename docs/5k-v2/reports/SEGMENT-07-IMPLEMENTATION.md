# Segment 07 — ispravke adaptacije i trčanje/hodanje (5k-v2.6.0)

Polazni commit: c9003aa. Kod samo u `web/src/domain/generators/fiveK/v2/`; nije povezano sa select.ts/store/UI.

## Odluke (DECISIONS 5k-v2.6.0, heuristike) i odstupanja
| # | Pravilo | Mesto |
|---|---|---|
| 1 | Posle smanjenja (pauza, bol, manjak izvršenja) cilj raste +10%/ned do nivoa pre smanjenja u svim fazama osim tapera i trke (oštrenje ne drži ispod nivoa); iznad nivoa redovna pravila | `volume.adaptVolume` → `nextBuildKm`, `returnLevelAt` |
| 2 | Donja granica adaptiranog cilja = minimum nedelje; kvalitet koji ne staje otpada (f) | `volume.adaptFloorKm` (assess i validate ga koriste) |
| 3 | `facts.coverage {from, to, complete}`; odluke 2, 3, 6 samo u potpunoj pokrivenosti; bol, umor, rezultat i `facts.breaks [{kind:'break', from, to}]` uvek | `assess.ts` (`coveredDays`, `knownKm`) |
| 4 | Lestvica L1–L12 (jedna tabela `runWalk.levels`, obrazloženje u komentaru), aktivno 20–35 min + 5 min hoda pre i posle, RPE 3–4, bez kvaliteta i tempa; km = procena trčanja ili null | `policy.runWalk`, `runWalk.runWalkSession` |
| 5 | Projekcija +1 nivo / 2 sesije, nivo za svaki dan, `projection` | `runWalk.constructRunWalk` |
| 6 | 2 uzastopne sesije (završena, RPE ≤ 6, bol < 4) → +1; RPE ≥ 7 → isti; bol ≥ 4 / pauza 7–13 → −1; ≥ 14 → −2; ≥ L1 | `runWalkAssess.ts` |
| 7 | Nivo trkačke nedelje < L12 → trka odnosom tog nivoa, cilj „završiti", bez vremena; 2 sesije (nivo − 1) pa trka | `runWalk.runWalkRace`, `raceWeekSessionDates` |
| 8 | L12 i ≥ 6 nedelja do trke → ostatak = `generateFiveKV2` kao početnik po osećaju; zapis u reasons (`TRANSITION`) | `runWalkAssess` (odluka), `runWalkAdapt` (gradnja) |

Tumačenja i odstupanja: (a) „nivo pre smanjenja" = cilj poslednje NE-rasteretne nedelje izgradnje završene pre
prvog dana događaja (pauza: prvi dan bez trčanja; bol: prvi zapis bola; izvršenje: početak 7-dnevnog prozora);
bez nje start plana; više koraka → najveći nivo. (b) Povratak ne usporava redovan rast (veće od dva); rasterećenje u
povratku ostaje (0,8 × poslednja ne-rasteretna); +10% važi i za početnika. (c) Bol ne menja cilj nedelje bola (dani
su ograničeni, kao 2.5.0); rast posle poslednje nedelje bola kreće od 0,7 × njenog cilja (lagani −30%), vrh tapera
od tada. (d) Važi i za nov start (≥ 28): povratak sme iznad peakKm(novi start), do nivoa. (e) Odstupanje od 7,5/10/12,5:
u izgradnji granica je max(minimum nedelje, n × 3 km) = 9/12/15 km — nedelja ispod ne može da se sastavi ni bez
kvaliteta (lagan ≥ 3 km, Uslov 8); taper 7,5/10/12,5. Uz to (konstruktor, pravilo f): kontrolno trčanje koje ne staje
otpada sa kvalitetom; oštrenje trkačke nedelje otpada ako bi nedelja bila < 4 km. (f) Bez `coverage` nijedan dan bez
zapisa nije poznat (kao complete = false; 2.5.0 je pretpostavljao potpunost od prvog zapisa) — testovi Segmenta 06
sada šalju coverage. Eksplicitna pauza važi ako je završena u poslednjih 7 dana i posle prethodne adaptacije.
„Obim pre pauze" iz zapisa samo ako je prozor pokriven i svako trčanje ima km; inače cilj plana. Trčanje = završen
zapis sa km ILI trajanjem (bilo samo km > 0). (g) Ulaz trčanja/hodanja: `currentWeeklyKm` ostaje obavezan, 0–35
(informacija); `typicalEasyPaceSecPerKm` opcion, isti opseg 4:30–8:30; rezultat i cilj bez opsega VDOT-a; početnik
mora navesti canRun30Min (`INPUT_SHAPE`); kod `RUN_WALK_NOT_SUPPORTED_YET` uklonjen. (h) Lestvica: 1:00/2:00×8,
1:30/2:00×7, 2:00/2:00×6, 3:00/2:00×5, 4:00/2:00×5, 5:00/1:30×4, 8:00/1:30×3, 10:00/1:30×3, 15:00/1:00×2, 20, 25,
30 min. (i) `projection` = nivo zavisi od pretpostavljenih sesija. Bez RPE sesija ne potvrđuje napredak; sesija
broji samo ako je njen nivo ≥ trenutnog; propuštena (zapis ili potpuna pokrivenost) prekida niz; pauza = poznati dani
bez trčanja (potpuna pokrivenost ili `breaks`); činjenice se obrađuju posle asOf prethodnog koraka (pauza preko
granice umanjuje samo razliku stepena). (j) Trka za kontinuiran nivo < L12: trajanje nivoa / 1:00 hoda; napor trke
RPE 3–4 „ravnomerno, kao na treningu"; sesije trkačke nedelje = dva dana trčanja najbliža trci, bez dana pred trku
kad su tri. (k) Prelaz: obim = 3 × 30 min tipičnim tempom (E 7:00 → 12,9 km); bez tempa, ispod 12 km (E sporiji od
7:30) ili sa zaključanim danima posle prelaza — bez prelaza (`TRANSITION` applied = false); posle prelaza deo
trčanja/hodanja je zamrznut, kontinuirani deo adaptira isti kontinuirani adapt. (l) Ispravljena postojeća greška (i
na c9003aa): validator `BEGINNER_INTRO` nije prihvatao nedelju uvoda bez ubrzanja uz zabranu kvaliteta (pauza).
(m) Tipovi: `GenerateResult.plan` = `FiveKV2Plan | FiveKV2RunWalkPlan` (`planType: 'runWalk'`); `adaptFiveKV2` ima
preopterećenja (isti poziv); 8 mesta u starim testovima sužava tip.

## Fajlovi
Novi: `runWalk.ts`, `runWalkAssess.ts`, `runWalkAdapt.ts`, `runWalkValidate.ts`, `segment07.node.test.ts`,
`segment07.generate-c9003aa.json`. Izmenjeni: `types.ts`, `policy.ts` (5k-v2.6.0, `adapt.returnGrowth`, `runWalk`,
DECISIONS), `input.ts`, `volume.ts`, `assess.ts`, `validate.ts`, `generate.ts`, `adapt.ts`, `index.ts`; testovi
`generate.node`, `segment02/03/04/05/05b/06`. Primeri: `docs/5k-v2/artifacts/segment-07/` (`run.ts`,
`snapshot-c9003aa.ts`, `c9003aa.json`, `inputs.json`, 6 × `<primer>.json`, `examples.md`).

## Komande i rezultati (iz web/)
- `npm ci` (node_modules nije postojao).
- `npx tsc -p tsconfig.domain.json --noEmit` → prvi put 1 greška (TS6133, neiskorišćen uvoz) → exit 0.
- `npx tsc -p tsconfig.oracle.json --noEmit` (testovi) → prvi put 23 greške (union tip u 5 starih test fajlova, 8 mesta) → exit 0.
- `npx eslint src/domain/generators/fiveK/v2/` → exit 0 (prvi put).
- `npx prettier --check src/domain/generators/fiveK/v2/` → prvi put 9 fajlova → `--write` → exit 0.
- `npx vitest run --project node src/domain/generators/fiveK/v2/` → prvi put 22 pada / 444 (verzija, RUN_WALK, S06
  bez coverage, S06 +8%) → testovi ažurirani → 11 fajlova / 554 prolazi (110 novih).
- Novi testovi na c9003aa (worktree, isti fajl + fixture): 106 pada / 4 prolazi — prolaze samo regresija generisanja,
  broj planova mreže B i dva testa pravila koja važe i ranije (potpuna pokrivenost → pauza; bol/rezultat bez
  coverage). Svaka odluka 1–8 ima bar jedan test koji pada pojedinačno na proveri (npr. 25,5 ≠ 26 / 40,8; 25 ≠ 15;
  12 ≠ 9; nepotpun unos menja plan; `RUN_WALK_NOT_SUPPORTED_YET` umesto plana; `P.runWalk` nedefinisan).
- Regresija generisanja: 700 ulaza (640 planova: sa rezultatom, po osećaju, početnik; 3/4/5 dana; 6–16 ned) heš JSON-a
  = c9003aa (osim policyVersion), test sa fixture-om; šira provera 980 ulaza: 640/640 planova bajt-isti, razlike samo
  canRun30Min = false (140: plan trčanje/hodanje ili RUN_DAYS_COUNT) i početnik bez canRun30Min (140: INPUT_SHAPE).
- `npx vitest run --project node src/domain/generators/` → 27 fajlova / 697 testova prolazi (459 s)
- `npm run check` → exit 0 iz prvog pokušaja (typecheck, lint, format, 187 fajlova / 2326 testova, 10,5 min)

## Mreže
- A: `adaptNetwork` 60 planova × 7 scenarija Segmenta 06 (sa coverage) + × 2 nova: „nepotpun unos 5 dana"
  (complete = false) → 60/60 nedelje bajt-iste; „eksplicitna pauza" (break 10 dana, bez coverage) → 60/60 PAUSE;
  540 adaptacija, 0 grešaka validatora.
- B: trčanje/hodanje 6/8/12/16 ned × 4 varijante (početnik E 7:00; bez tempa; početnik E 8:00; iskusan E 6:40 sa
  rezultatom kao informacijom) × 6 scenarija (sve odrađeno, RPE 7, bol 5, pauza 10, pauza 20, nepotpun unos) + lanac posle
  7 dana → 192 adaptacije, 0 grešaka; prošlost bajt-ista; prelaz 4 (16 ned, E 7:00/6:40), L12 bez prelaza 4.

## Stalni uslovi 1–8
1. Jedan vlasnik: obim `adaptVolume`/`nextBuildKm`, granica `adaptFloorKm`, činjenice `assess.ts` /
   `runWalkAssess.ts`, nivo i sesija `runWalk.ts`; validator samo prijavljuje. Bez petlji (jedini lanac: f).
2. Jedan plafon po zoni (nepromenjeno); povratak ima jednu granicu (nivo), ne drugi plafon iste stvari.
3. WU/CD nepromenjeni; trčanje/hodanje: 5 min hoda pre/posle je deo sesije, ne pufer.
4. Ograničenja ulaze u konstruktor (assess → construct/constructRunWalk); zaštita samo proverava (prošlost,
   urađeno, zaključano bajt-isto, i u planu trčanja/hodanja).
5. Handoff: nije deo segmenta. 6. `policyId`/`policyVersion` 5k-v2.6.0; faza svake nedelje (`runWalk`/`race`).
7. Izolacija: novi fajlovi uvoze samo v2 (`isolation.node.test.ts`). 8. Validator obara praznu sesiju, skok nivoa
   > 1, sesiju van lestvice, nedelju < 3 sesije; kontinuirano: trkačka nedelja < 4 km više ne nastaje.

## Primer — dev-04, pauza 20 dana (asOf kraj ned 7; ceo primer `artifacts/segment-07/examples.md`)
| Ned | Generator | c9003aa | 5k-v2.6.0 |
|---|---|---|---|
| 8 | peak (r) 36,4 | 23,7 | 23,7 (bez kvaliteta) |
| 9 | peak 45,5 | 25,5 | 26,0 |
| 10–11 | sharpen 45,5 | 25,5 / 25,5 | 28,6 / 31,4 |
| 12–13 | taper 38,7 / 31,9 | 21,7 / 17,8 | 26,7 / 22,0 |
| 14 | race 19,49 | 12,73 | 15,36 |
Nivo pre smanjenja 40,8 (ned 3; ned 4 rasteretna). 5 dana / 30 km / pauza 35: start 15 km (c9003aa 25), taper
15,4 / 12,7 (c9003aa 25 / 25). Nepotpun unos 5 dana: bez promena (c9003aa: manjak izvršenja, ned 8–14 −20–31%).

## Primer — trčanje/hodanje 10 ned, posle 3 nedelje (RPE 5, 5, 7, 5, 5, pa pauza 10 dana)
| Nedelja | Nivoi po danu (uto, čet, sub) | Napomena |
|---|---|---|
| 1–3 | L1 L1 L2* · L2* L3* L3* · L4* L4* L5* | prošlost (bajt-isto) |
| 4 | L2 L2 L3* | L3 posle 5 sesija (RPE 7 prekida niz), pauza 10 → −1 |
| 5–9 | L3* L4* L4* · L5* L5* L6* · L6* L7* L7* · L8* L8* L9* · L9* L10* L10* | projekcija od L2 |
| 10 | L10* L10* trka L11* | trka 25:00 trčanje / 1:00 hod, cilj „završiti" (projekcija generatora: L12, bez hoda) |
16 ned, E 7:00, sve odrađeno do kraja ned 8 → L12 → od ned 9 početnik po osećaju 12,9 km (vrh 14,1, test 3 km u ned 11).

## Preostali problemi
1. Svi pragovi (+10%, 0,7 posle bola, definicija nivoa, lestvica, RPE 6/7, −1/−2, 3 × 30 min) su heuristike bez
   trenerske provere.
2. Bez `coverage` adaptacija ne vidi pauzu ni manjak iz zapisa — aktivacija mora slati pokrivenost (izvor: sat ili potvrda).
3. Eksplicitno propušteni treninzi (`completed: false`) bez potpune pokrivenosti nisu „poznati dani bez trčanja".
4. Run/walk: tempo sporiji od 8:30 se odbija (isti opseg); prelaz traži ≥ 12 km (E ≤ 7:30) — sporiji ostaju na L12.
5. Run/walk: zakasneli zapisi za dane pre prethodne adaptacije se ne obrađuju; posle prelaza nema povratka na hodanje.
6. Hod se ne procenjuje u km; trka bez procene trajanja (namerno „završiti").
7. Kontrolno trčanje koje ne staje u smanjen obim otpada (ne premešta se).
8. Iz Segmenta 06 ostaju 2, 3, 5–7 (dayId = datum, mešovite nedelje, lagani −30% ne ispod 3 km, rezultat u trkačkoj
   nedelji, plan starije verzije).

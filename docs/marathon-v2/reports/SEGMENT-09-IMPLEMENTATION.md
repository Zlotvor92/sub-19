# Maraton v2 — Segment MAR-09 (marathon-v2.6.0): ispravke posle dubinske provere

Polazni SHA `618a7f6`; commiti `7f28839`, `897b67d`, `907a2c6` (grana `claude/generator-isolation-5k-10k-hm-marathon`). Spisak: `docs/generators-v2/audit/fixes/MAR.md`
(zaključan) + `00-common.md`. Menjan samo folder `web/src/domain/generators/marathon/v2/**` i `docs/marathon-v2/**`.
Merne skripte iz `docs/generators-v2/audit/` pokrenute bez izmene; tri kojima se promenio potpis funkcije (t. 4) su
kopirane u `artifacts/segment-09/` sa novim potpisom (jedina razlika: tempo nedelje kao funkcija; `mar-capacity-pace`
i referenca skripte čita `jumpLongs10`).

## Stavke

| # | stavka | uzrok → ispravka (jedan vlasnik) | merenje pre → posle |
|---|---|---|---|
| 1 | bol 8 kraj ned N−2 (3 d) → EMPTY_WEEK trkačke | `week.raceOnlyWeek` je tražio dane odmora U trkačkoj nedelji, a `raceWeekRest` (pouka 30) je trkačku praznio zbog N−1 = 0. Jedna definicija: trkačka nedelja = faza race + samo trka (RACE_WEEK_SHORT); koji dani smeju da otpadnu i dalje proverava RACE_WEEK (raceWeekRuns + raceWeekRest, isti podatak kao konstrukcija). Trkačka nedelja nikad nije prazna. | `owner/mar-emptyweek-search.ts`: **224 / 10 976 → 0** (N−1: 0 → 0); `mar-emptyweek-example.ts`: odbijeno → plan |
| 2 | skok dugog posle netrčanih nedelja (1b #5) | `jumpBase10` je uzimao L iz upisanih (planiranih) dugih i za nedelje za koje činjenice kažu da nisu trčane. Pouka 37 za L: cela prošla nedelja čiji su svi dani poznati (potpuna pokrivenost ili pauza; dan bez zapisa = 0) ulazi u L najviše sa najdužim odrađenim trkom (< 5 km: nije L). Korak nosi `ranLongs` (assess, jednom); `lengths.jumpLongs10` jedina funkcija za konstruktor, validator (LONG_JUMP, rasterećenje) i kapacitet. Činjenice važe samo za nedelje građene posle asOf koraka (prošle nedelje se ne preračunavaju), samo spuštaju L; nedelje 1–4 bez promene; prazan prozor zadržava upisani L (plafon se ne ukida). | `coach-hm-mar/measure-jump.ts MAR 400 200 100`: **3 584 / 25 718 → 0**, 0 odbijanja; primer painPause 5 d 70 km: ned 15 dugi 26,9 → 11,9 km |
| 2b | posledica t. 2: taper N−1 > N−2 (run-all early-MAR 2 toka, painPause pred taper) | Plafon skoka iz trčanog spušta cilj N−2 (izvodljivost), a N−1 je ostajao po pravilu. Jedini vlasnik cilja (volume.leaveWeek, zovu ga konstruktor i validator): taper samo naniže — cilj sledeće nedelje tapera ≤ ostvaren cilj ove (`tailCap10`). | early-MAR „taper N−1 > N−2" **2 → 0** (0/164 394); test `segment09` t. 2b (na `618a7f6` prolazi — nalaz je nastao ovim segmentom) |
| 3 | Z4 vraćanje revizije | `restoreMerge` je spajao prošlost trenutne i budućnost sačuvane verzije bez jezgra. Vraćanje kroz jezgro (writtenWeeks + revalidacija svega posle) bi bio veliki zahvat → pravilo iz 00-common: vraća se samo verzija posle poslednjeg prilagođavanja (isti koraci adaptacije), uz jasnu poruku; vraćen plan mora proći `validatePlan` (inače odbijanje). | `artifacts/segment-09/mar-restore.ts` (obrazac `owner/tenK-restore.ts`, 2 880 tokova; pre: 2 832 vraćena): vraćen plan koji krši validator **1 362 → 0**; sledeća adaptacija odbijena 236 → 0; sva vraćanja posle prilagođavanja odbijena porukom |
| 4 | MARATHON_LONG_SHORT pogrešan razlog, poruka kapaciteta | `longShortOf` i `capacityWeeks/capacityLimits` su dobijali tempo PLANA, konstruktor gradi tempom NEDELJE. Sada primaju `pacesOf(week)` (= `steps.pacesAt`, isti tempo kao `ctxAt`) u konstruktoru (generate) i validatoru. | `owner/mar-adapt-search.ts 150 4004` (kopija): neslaganje timeCapped **1 409 / 17 300 → 0**, odbijanja 1 → 0; `mar-capacity-pace.ts 100 4004` (kopija): pogrešno ograničenje u poruci **247 → 0**, referenca skripte (sa `jumpLongs10`) = proizvodni ishod: sve razlike **→ 0** (2 462 plana sa CAPACITY_LIMITED); `mar-timecap-example.ts`: timeCapped false → true, upozorenje → napomena |
| 5 | napomena „dan kvaliteta ne sme biti duži od dugog" kad jeste (1b #2) | `lowerNote` nije video najnižu dozu. Napomena dobija `longer` (dan kvaliteta posle spuštanja i dalje duži od dugog nedelje posle ograničenja bola — `limitedLong10`, isto mesto kao `limitDays`): tada „najniža doza zone; dan kvaliteta ostaje duži od dugog (najniži nivo izuzet)". Rasterećenje, taper i „jedan kvalitet" adaptacije (napomena se pravi posle dužina). | `coach-hm-mar/measure.ts MAR 400 200 100` t1contra: generator **9 054 → 0**, adaptacija **205 → 72**. Preostalih 72 skripta broji kad je BILO KOJI dan kvaliteta duži; napomena se odnosi na svoju zonu: klasifikacija (`scratchpad` kopija, 66 132 toka) — napomena o zoni čiji je dan zaista duži: **6** (sve pause35: zaštićen, već prošao MP dan prethodnog plana u mešovitoj nedelji, napomena opisuje sastavljeni dan); ostalo = napomena o T, a duži je MP tapera (M7a, „MP u taperu duži od dugog" — nije na spisku) |
| 6a | Z1 | `mixedRest`: kad je jedini uzrok viška upisani višak (zaštićeni po činjenicama > planirani zaštićeni, a sa planiranim preostali dani staju) i planirano sa zadržanim kvalitetom ≤ 1,10 × cilj → kvalitet ostaje, lagani na minimumu, MIXED_WEEK_OVER (validator zove istu funkciju). `P.mixed.overShare = 1,1`. | `consistency/mixed-drop.ts MAR 97`: otpao kvalitet uz višak ≤ 10 % **1 588 → 0** (ukupno otpalo 1 759 → 117, svih 117 > 10 %); odbijanja 0 → 0 |
| 6b | Z2 | Jedno mesto prevoda `app/format.userText` (bez internih oznaka M/A/D/H/N…, „pouka N", „Uslov N", Q1/Q2 → „Prvi/Drugi dan kvaliteta"; decimalni zarez; km najviše 1 decimala; bez „.."). Aplikacija ga zove na svakom izlazu: fokus nedelje, „Na šta da paziš" (napomene + upozorenja), ocena cilja, razlozi i napomene prilagođavanja, traka, odbijanja (generisanje, adaptacija, promena cilja). `rule`/`code` ostaju. „vi" → „ti" (MIXED_WEEK_OVER). RECENT_LONG_TOO_SHORT: pravilo max(10 %, 1 km) i prag „Plan je izvodljiv od X km" (kao HM; prag = najmanji r u koraku 0,5 km sa kojim je konstrukcija izvodljiva). Oporavak je već m:ss. | test mreže (`segment09`): korisnički tekstovi svakog 9. plana mreže bez obrasca oznake, bez decimalne tačke i „.." — 0 |
| 6c | Z3 | Forma je imala sopstvenu definiciju „čeka prilagođavanje". Odluka o rezultatu je jedna funkcija `assess.resultFates` (stariji / nije noviji / VDOT van opsega / nije najnoviji / primenjuje se) — adaptacija i Forma je čitaju; Forma za VDOT van opsega piše „VDOT van 30–80, ne menja tempo". | test (`segment09`): VDOT van opsega → 'range', ne „čeka" |

Z5 se odnosi na ciljeve predaje (5K/10K/HM); maraton nije cilj — nema rada u ovom folderu.

## Verzija politike i otisci

`marathon-v2.5.1` → **`marathon-v2.6.0`** (DECISIONS `MAR-09`). `KNOWN_VERSIONS` ∪ `marathon-v2.5.1` (planovi sačuvani
pod 2.5.1 ostaju planovi maratona v2). Zamrznuti otisci mreža (`segment0*.json`, `byteSame`): nijedan nije menjan —
pun nivo foldera prolazi bez izmene otisaka (generator na mrežama otisaka bajt-isti po normalizovanom hešu; tekst
napomene t. 5 nije u hešu). Promenjeni tokovi (adaptacija): t. 1 (trkačka samo sa trkom umesto odbijanja), t. 2
(dugi posle potpuno poznatih netrčanih/manje trčanih nedelja), t. 4 (napomena umesto upozorenja, tekst kapaciteta),
Z1 (kvalitet ostaje u mešovitoj nedelji uz upisani višak ≤ 10 %).

Izmenjeni postojeći testovi (ponašanje promenjeno odlukom, ne oslabljeno): `segment07` (trkačka samo sa trkom bez
osnova sada obara RACE_WEEK, ne EMPTY_WEEK), `adaptFlow` (vraćanje posle prilagođavanja → odbijanje; traka kao
korisnički tekst; KNOWN_VERSIONS), `app` (ocena cilja i napomene kao korisnički tekst), `dayCap` (napomena tapera
kaže da je najniža doza duža od dugog), `volume` (nov tekst RECENT_LONG_TOO_SHORT), `handoffSource` (tempo nedelje),
`policy` (verzija, DECISIONS).

## Testovi, sabotaže

- Nov `segment09.node.test.ts` (11 testova): 10 testova stavki na `618a7f6` **10/10 pada**, posle prolazi; t. 2b je regresioni test posledice t. 2.
- Sabotaže `artifacts/segment-09/sabotage.json` (`--bail=1`, `--parallel 2`): **10/10 palo**, stanje src vraćeno
  (`sabotage-result.json`).
- `npx tsc -b --noEmit` 0; eslint 0; prettier 0.
- `TEST_FULL=1 npx vitest run --project node src/domain/generators/marathon`: **88/88 fajlova, 525/525** (konačan kod).
- `npm run check` (posle prve verzije): tsc/eslint/prettier 0; brzi testovi 325/327 fajlova — 2 pala UI testa maratona v2 (`features/onboarding/marathonV2Flow.test.tsx`: napomene doslovno; `features/plan/marathonV2Adapt.test.tsx`: vraćanje revizije posle prilagođavanja) — očekivanja usklađena sa Z2/Z4 (samo testovi maratona v2, bez izmene zajedničkog koda).
- `npx vitest run --changed 670700e`: posle t. 5 **327/327, 3 682/3 682**; na konačnom kodu 326/327 — `domain/training/generator/audit.test.ts` (nevezan, bez izmena) prekoračio 5 s pod opterećenjem (5 069 ms, paralelno run-all), samostalno 7/7.
- E2E `npx playwright test e2e/marathon-v2`: **3/3** (vraćanje revizije posle prilagođavanja → poruka odbijanja, plan se ne menja).
- `bash docs/generators-v2/final-check/run-all.sh /tmp/ra 2 '.*-MAR|handoff-adapt-MAR-.*'` + `summarize-all.py`
  (konačan kod `907a2c6`): **18 poslova, 0 nečistih** — early 0/164 394, two-step new/cum 0/137 632, last-weeks
  0/89 309, result-pain 0/73 188, locked-pause 0/54 848, start-day 0/43 418, edges 0/20 000 (generator
  RECENT_LONG_TOO_SHORT 4, očekivano), locked-test 0/5 880, fatigue-* čisto, predaja MAR→HM/10K/5K 0, shorter offer
  3 358, warnings/targeted bez odbijanja. (Regex `'.*-MAR$'` iz 00-common u ovom `grep -E "^(…)\|"` ne hvata
  nijedan posao — `$` pre `\|`; korišćen `'.*-MAR|handoff-adapt-MAR-.*'`.) measure-jump ponovljen posle
  `907a2c6`: 0.

## Primećeno, nije rađeno

- `mar-capacity-pace.ts` (audit original) i `mar-timecap-example.ts`/`mar-adapt-search.ts` zovu stari potpis — kopije
  u `artifacts/segment-09/`. Original referenca kapaciteta računa L iz planiranih dugih; posle t. 2 to se razlikuje
  od proizvodnog ishoda u painPause tokovima (33 toka) — kopija koristi `jumpLongs10`.
- t. 5: 6 / 66 132 tokova — mešovita nedelja: napomena spuštene doze opisuje sastavljeni dan, a upisan je prošli dan
  prethodnog plana (duži). Napomene mešovite nedelje uopšte opisuju konstrukciju; nije rađeno.
- `mar-restore`: vraćanje posle prilagođavanja je sada uvek odbijeno (fallback iz 00-common). Vraćanje kroz jezgro
  (stvarno vraćanje starije verzije uz činjenice posle nje) ostaje za odluku.
- Napomene konstruktora i dalje nose oznake (validator čita neke napomene po tekstu, npr. „(pouka 30)", „(A9, M8)");
  korisnik ih ne vidi (userText). Prepisivanje izvora poruka nije rađeno (veliki zahvat, nije na spisku).
- Ostalo „Nije na spisku" iz MAR.md nije dirano.

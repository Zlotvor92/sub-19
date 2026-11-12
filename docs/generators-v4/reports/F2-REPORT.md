# F2 — izveštaj: motor V4 (12. 11. 2026)
## Šta je urađeno
`web/src/domain/v4/engine/` (≈ 4 300 redova koda + 2 700 testova i test-podataka), bez ijednog uvoza van foldera:
`constants.ts`, `vdot.ts` (prvi commit 5c7e09e) · `dates.ts`, `format.ts` (množina, datumi, decimalni zarez) ·
`load.ts` (`summarize`, `runLoad`, sredine 42/7) · `formFallback.ts` (procena iz izjave iza `EstimateFormFn`) ·
`state.ts` (`buildState`) · `template.ts` (`expandTemplate`, nivo, šablon) · `decide.ts` (vrh, plafoni, dugi, dani) ·
`select.ts` (doza, izbor, koraci, tekst; „recept" dana) · `build.ts` (JEDAN prolaz kroz nedelje: `weekTarget` →
`longPlan` → `fastBudget` → `easyFill` → spremnost; `isMutable`) · `readiness.ts` (`applyReadiness`, § 6.5 + § 14.1) ·
`plan.ts` · `events.ts` (`deriveEvents`) · `replan.ts` (kandidat po događaju + objašnjenja § 10) · `guard.ts`
(`validate`, `guard`, `warnings`) · `render.ts` (`renderPlan`) · `fingerprint.ts` · `index.ts`.
`plan` i `replan` zovu isti prolaz; dan se gradi iz namere + `decisions` + `adjustments`, pa je ponovno građenje
idempotentno. Sintetičke distance: `testdata/synthetic.ts` (8 km, 2 šablona, 10 unosa) i `testdata/example.ts`
(21 097,5 m, podešena po § 12 (a)). Primeri ispisa: `docs/generators-v4/plans/SYN/` (3 plana).
## Testovi (projekat `domain`): 9 fajlova, 112 testova, ≈ 1,9 s
Determinizam na mreži od 224 ulaza (dani 1–7 × 12 dužina 1–30 ned × 4 profila × start u rampi/van nje) · stabilnost
(`[]`, `none`, primenjen događaj, `deriveEvents` bez novosti, 45 dana trčanja po planu dan za danom) · zaštita za
15 događaja (prošlo, urađeno, ručno, zaključano, dan trke, `protected`) · čuvar na mreži · odbijanje samo § 8.1
(14 slučajeva) · 42,2 km za 3 nedelje, 1 dan, 5 km → plan + 5 upozorenja · primeri § 12 (a), (b), (d), § 14.1 ·
K1–K5 nad `renderPlan` · izolacija (čita izvor). Primer (a) se poklapa sa SPEC-om: vrh 245 BO, plafoni 26,9 / 36,7 /
17,1 / 39,2 min, dugi 103 min, nedelja 1 = 181 BO i 28,4 km, raspon 1:38:25–1:40:00–1:41:59.
`typecheck`, ESLint, Prettier čisti; `src/domain/isolation.test.ts` zelen (pravila domena važe i za `v4`, bez izmena).
**Nalazi čuvara dozvoljeni na mreži** (ulaz ih traži): 1–2 dana (`ispod-cilja`, `min-nedelja`, `brz-udeo`, `skok`,
`taper`, `lagan-dugi`); 3 dana (`ispod-cilja`, `min-nedelja`); obim po danu > 70 ili < 25 BO (`ispod-cilja`,
`lagan-dugi`); start u rampi (`ispod-cilja` do 4. nedelje). Nikad: doza, dugi, prazan, uzastopni teški, trka.
## Izmene tipova (`types.ts`)
`Paces.easy` (E 66 % za račun km) · `PlanWeek.longSec` (odlučen dugi pre spremnosti; adapter: najduži dan) ·
`PlanHeader.adjustments?` + tip `Adjustment` (uzroci spremnosti i ponovljena doza) · `MainSet` continuous / split /
finish-block / progressive: opciono `by: 'trajanje' | 'duzina'` + tip `WorkUnit` · `BuildStateFn` 4. i 5. argument
(`estimate?`, `doc?`) · po dopunama: `Run.planned?`, `Run.tempC?`, `profile.birthYear?`, `RunnerFacts.painHistory?`,
`Adjustment` pauze nosi `reason?`, a napor/pauza/bol `lastLongSec?`. Značenje postojećih polja nije menjano.
## Odstupanja od SPEC-a (sa razlogom)
1. **`adjustments` u zaglavlju.** § 1.3 kaže „dan iz namere + decisions"; da bi kasniji događaj izgradio isti dan,
   uzroci (napor, pauza, bol, umor, ponovljena doza) moraju da se pamte. Upisuju se samo uz primenjen događaj.
2. **Dodatak ide PREKO laganog dela** (4,5 km + ≈ 1 km ubrzanja): iz cilja se oduzima ceo dodatak (≈ 8 BO), ne
   2,7 kao u (a); plafon dana važi za ceo dan. Razlog: K5. Ispis: tempo samo za zone rada, u zagradi iza teksta.
3. **„Prvi kvalitet posle rampe × 0,8"** važi 14 dana posle rampe (`POST_RAMP_FIRST_DAYS`), posebno za blok u dugom
   i za kvalitet. Bez roka bi smanjilo podražaj koji se prvi put javi mesecima kasnije.
4. **Izvedena pauza** nastaje u `deriveEvents` (i u `buildState` kad dobije `doc`); današnji dan se ne sudi.
5. **`availability-change`** čuva namere nedelja i menja samo raspored dana i najduži dugi; **`goal-change` (datum)**
   razvija šablon na (prošle + preostale) nedelje i uzima kraj, vrh i plafoni ostaju. Doslovno „plan od sutra" bi
   usred pripreme vratio fazu i obim na početak. Promena distance: sve iznova po novim podacima.
6. **Nepotpune nedelje:** cilj × (dostupni dani trčanja / svi). U nedelji trke sidro rasporeda je dan trke; dan pre
   trke je lagano ≤ 20 min ili odmor, bez dodatka (§ 6.2 k. 10 to ostavlja šablonu, a šablon ne zna dan trke).
7. **Pravilo rasta** koristi planirano POSLE spremnosti (stvarno za prošle nedelje); pre plana `B` — kao u (b).
8. **`warnings` prima objekat** `{ state, goal, data, decisions, doc }`: vrh u km i najduži dugi se čitaju iz
   izgrađenog plana. Suvi poziv pre generisanja = `plan()` (čist i brz). Dodato upozorenje `bol` (nivo ≥ 7).
9. **§ 14.6 (ugrađeno posle prve isporuke):** rampa po razlogu (2,0 / 1,0 / 1,5 × dani, do 28), dugi u rampi
    ≤ 75 %, blok tek posle dugog bez bloka ≥ 90 % pa od najnižeg koraka lestvice, izveden umor traži i 7 dana
    ≥ 1,2 × B. Moja tumačenja: „poslednji odrađeni dugi" = najduže trčanje (bez trke/testa) u 28 dana pre uzroka
    (dugi rasterećenja ne spušta plafon); pravilo bloka se gasi 42 dana posle pauze; buduće duge računam kao
    odrađene, prošle samo ako imaju trčanje. Primer (b) je sada rampa 14 dana.
10. **Sitno:** opterećenje odrađenog trčanja koristi prag TEKUĆE forme; seme baze bez `weeklyKm` je prosek istorije;
    šablon bez pogotka → najbliži istog nivoa (izuzetak samo kad `templates` nema nijedan šablon). Zaokruživanje: dugi naniže (0,5 km / 5 min); blok ≤ polovine dugog; broj deonica tako da rad ≤ plafon + 90 s.
## Zapažanja (nisu odstupanja, traže pažnju)
- Jedna trka u retkoj istoriji (bez ostalih trčanja) podiže bazu ≈ 16 % (§ 5.3 doslovno) → F4/F9.
- Trčanje bez krugova se boduje po prosečnom tempu: dan kvaliteta vredi ≈ 8 % manje od planiranog, pa pravilo rasta
  posle pauze veže jače (u (b) 155 umesto 169 BO za 4. nedelju).
- Ostatak laganog budžeta ispod `minEasySec` propada (§ 6.2 k. 7): sa 3 dana, dugi sa blokom + jak kvalitet izbace
  lagan dan. U smanjenoj nedelji blok u dugom prvi troši budžet, pa kvalitet usred nedelje može da otpadne.
## Šta F3 (podaci distance) mora da zna
**Polja koja određuju obim po nedeljama:** `template.startPct` (`P = B / startPct`), `WeekIntent.loadPct`
(tail + cycle), `body[].share`, `recoveryEvery`, `recovery.loadFactor`, `safety.maxWeeklyRampPct`, `minRampLoad`
(samo `build`/`peak`), `peakLoadCap[nivo]`, `levels`. **Raspodela unutar nedelje (km):** `longMaxSec[nivo]`,
`longShareByRunDays`, `longStepSec`, `longStartShare`, `LongSlot.lenPct`; `doseCaps`, `progression`, `dosePct`,
`minDoseSec`, `maxFastShare(Peak)`; `minEasySec`, `easyMaxShareOfLong`, `dayBeforeLongMaxShare`; `warmupCooldown`;
`presentation.byDurationAboveSecPerKm`.
**„Nedelja 1 ≈ sadašnji km":** `B = km × E tempo / 60` (30 km × 5:52 = 176 BO); cilj 1. nedelje = `loadPct₁ × B /
startPct`. Minut praga vredi 2 BO, pa nedelja sa kvalitetom ima manje km za isto BO: `loadPct₁ ≈ startPct × 1,03`
daje 28,4 km (primer: 0,72 / 0,74), `× 1,04` daje 29,5 km (sintetička: 0,75 / 0,78); za tačno 30 km `× 1,06–1,08`.
Ostalo: svaki podražaj kvaliteta i bloka mora imati red u `doseCaps` (inače doza 0 → lagan dan); blok je unos
`kind: 'long'` sa svojim podražajem; `stimuli[k]` ide na `qualityDays[k]`; za ≤ 3 dana treba lakši šablon; deonice
neka imaju `requires.minDoseSec`; tekstovi `{n} {rep} {dose} {rec} {len}`, opciono `race`, `faza.<id>`, `napor.<zona>`.
## Šta F4 i F5 moraju da znaju
**F4:** `buildState(facts, goal, data, estimateForm, doc?)`; motor ne uvozi `fitness/`. Procena se poziva dva puta
(`planned: null`, pa `{ baseLoad, peakLoad }`) i dobija trčanja sa `planned` i pauze izvedene iz plana kad je `doc` dat. Zaglavlje nosi snimak; `form-update` izvodi `deriveEvents` (0,5 VDOT, pouzdanost ≥ srednja, 14 dana);
`result` menja tempa odmah od 0,3. Brojevi § 7.5 su samo u `formFallback.ts`.
**F5:** adapter popunjava `PlanWeek.longSec`, `Paces.easy`, `eventsFrom = today`; `adjustments` izostavlja. Na događaj
se dan u prozoru gradi iz izvedene namere: `intent.stimuli[].stimulus` moraju biti oznake iz biblioteke distance,
inače dan postaje lagan. `templateId` van podataka je dozvoljen. `protected` → `replan` vraća isti objekat. Čuvar
nalaze nad preuzetim danima daje kao `rucno`. Otisak: `fingerprint(doc, facts)`, red po danu.
## Drugi krug (12. 11. 2026, po pregledu organizatora)
1. § 14.6 i § 14.1 su ugrađeni (v. odstupanje 9); test iz plana i pripremna trka: 3 dana bez ičeg brzog.
2. Pravilo rasta (`m`) i lanac dugog ne gledaju nedelje koje seku pauzu ili rampu (`underRamp`); čuvar `skok` i
   `dugi-korak` isto. Primer 03: 18 → 25,7 → 31 km (bilo 20 / 26 / 22), lagani dani ne postaju odmor.
3. Lagan dan sa ≥ 3 dana trčanja ostaje na `minEasySec` dok nedelja ne pređe cilj za > 10 % (tada otpada najraniji,
   dan posle kvaliteta poslednji); `GUARD_JUMP_TOLERANCE` 0,10. Sa 1–2 dana ostaje staro pravilo.
4. Ispis: tempo samo uz deonicu rada, na mestu opcione oznake `{pace}` u šablonu teksta („prag {n} × {rep}{pace},
   oporavak {rec}" → „prag 2 × 7 min (4:40/km), oporavak 1:30 džog"); bez oznake zagrada na kraju; po osećaju oznaka
   ne daje ništa. `Workout.text` i otisak nikad ne nose tempo. Lagani i dugi bez tempa; PROMENE imaju jedno
   objašnjenje po događaju. Čuvar `lagan-dugi` poredi km (dugi sa blokom kraće traje).
5. Blok posle pauze: prvi dugi posle rampe ispunjava uslov ≥ 90 % (lanac dugog ne gleda nedelje rampe), pa se blok
   vraća čim ga šablon traži — test nad planom od 16 nedelja.
6. Urađen dan plana bez krugova: planirana prosečna težina × stvarno trajanje kad je odrađeno ≥ 90 % planiranog
   trajanja (`Run.planned.durationSec/load`, popunjava `buildState` kad dobije plan); inače po prosečnom tempu.
Otisci se menjaju: dugi (zaokruživanje naniže), lagani dani u nedeljama gde je ostatak bio < `minEasySec`, tekst
oporavka („1:30 džog"), nedelje posle pauze/rampe. Čuvar `brz-udeo` ne meri nedelju trke (mala je, trka ne ulazi u zbir).

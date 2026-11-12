# Brief F2 — motor V4 (Fable 5.2)

Ti implementiraš MOTOR novog generatora planova trčanja (V4): `web/src/domain/v4/engine/`. Specifikacija je gotova i
prošla je kapiju; ne menjaš je, implementiraš je. Motor ne zna za distance.

## Pročitaj (samo ovo)
1. `AGENTS.md` — SAMO odeljak „V4 generator — pravila".
2. `docs/generators-v4/SPEC.md` — ceo; § 14 (dopune organizatora) ima prednost nad ostatkom.
3. `web/src/domain/v4/engine/types.ts` — tipovi (smeš da ih dopuniš kad implementacija to traži; svaku izmenu tipa
   navedi u izveštaju; ne menjaj značenje postojećih polja).
4. `docs/generators-v4/reports/F1-REPORT.md` i `docs/generators-v4/coach/RUBRIC-V4.md` (samo deo o proverama K1–K8).
NE čitaj v2/v3 kod, stare testove, `PROGRAM.md`.

## Isporuka (ovim redom; guraj posle svakog koraka kad su testovi zeleni)
1. PRVI commit (u roku od ≈ 20 min, drugi tabovi čekaju): `engine/constants.ts` (svi brojevi modela sa upućivanjem
   na odeljak SPEC-a) i `engine/vdot.ts` (VDOT iz rezultata, vreme za VDOT bisekcijom, tempo zona, težina RP iz
   `distanceM`) + test (`vdot.test.ts`: VDOT 44,6 ↔ polumaraton 1:41:00, tempa iz § 5.4 na ± 1 s).
2. `load.ts` (opterećenje koraka/treninga/trčanja, baza/umor, `summarize`), `state.ts` (`buildState`),
   `template.ts` (`expandTemplate`), `select.ts` (izbor treninga, doze, raspored dana), `plan.ts` (`plan`, redosled
   § 6.2, svaka veličina jedna funkcija-vlasnik), `readiness.ts` (`applyReadiness`, § 6.5 + § 14.1),
   `events.ts` (`deriveEvents`), `replan.ts`, `guard.ts` (`validate`, `guard`, `warnings`), `render.ts` (§ 14.2),
   `fingerprint.ts` (§ 9.2, kanonska serijalizacija sa stalnim redosledom ključeva), `index.ts` (javni izvoz).
   Ugovor forme: motor prima `FormEstimate` kao deo stanja; dok `fitness/` ne postoji, `buildState` koristi
   najprostiju procenu iz izjave (`profile.recentResult` / lagani tempo, § 2.4) iza jednog interfejsa koji će
   `fitness/` zameniti — ne implementiraj § 7.2–7.5 (to radi drugi tab).
3. Sintetička distanca za testove: `engine/testdata/synthetic.ts` (izmišljena distanca, npr. 8 km, 3–6 unosa
   biblioteke, 1–2 šablona, svi `SafetyNumbers`) — dokaz da motor radi bez ijedne prave distance.
4. Testovi (`web/src/domain/v4/engine/*.test.ts`, projekat `domain`; ceo skup < 2 min, cilj < 30 s):
   - determinizam: isti ulaz → bajt-isti izlaz (mreža ≥ 200 ulaza: dani 1–7, nedelje 1–30, baza, nivo, start u
     rampi/van nje);
   - stabilnost: `replan(doc, state, [])` i sa `deriveEvents` bez novosti → isti dokument, `changes: []`, i posle
     dodavanja urađenih trčanja koja odgovaraju planu;
   - zaštita: prošli, urađeni, `manual`, `locked`, dan trke, `protected` plan — netaknuti za svaki događaj;
     `replan` menja samo `date > today`;
   - čuvar bez nalaza na mreži za ispravne ulaze (nalazi dozvoljeni samo tamo gde ulaz to traži — navedi koje);
   - ništa se ne odbija osim § 8.1 (maraton-dužina za 3 nedelje, 1 dan, 5 km/ned → plan + upozorenje sa tri
     rečenice i predlogom u brojevima);
   - prošetani primeri § 12 (a), (b), (d) kao testovi nad sintetičkom distancom podešenom da liči na primer:
     (d) nema brzog rada pre 11. dana; (b) rampa 11 dana, urađeno netaknuto; plus § 14.1 (test 3 km → ništa brzo
     3 dana);
   - mašinske provere K1–K5 nad `renderPlan`: prognoza na dan trke ≠ današnja kad je plan ≥ 10 nedelja i raspon
     postoji; bez brzog u 3 dana posle trke/testa; upozorenje ima problem/značenje/predlog sa brojem; nema ISO
     datuma, internih izraza ni pogrešne množine („1 nedelja", „2 nedelje", „5 nedelja", „21 nedelja"); zbir km dana =
     km nedelje;
   - izolacija: u `engine/` nema niske sa imenom distance (`maraton`, `polumaraton`, `5k`, `10k`, `hm`…), nema
     poređenja `distanceM` sa konstantom, nema uvoza van `web/src/domain/v4/` (test čita izvor).
5. `docs/generators-v4/reports/F2-REPORT.md` (≤ 80 redova): šta je urađeno, trajanje skupa, odstupanja od SPEC-a
   (svako sa razlogom), izmene tipova, šta F3 (podaci distance) mora da zna — tačan spisak polja `DistanceData`
   koja utiču na obim po nedeljama i primer kako se dobija „nedelja 1 ≈ sadašnji km".
6. Primer ispisa: `docs/generators-v4/plans/SYN/` — 3 plana sintetičke distance kroz `renderPlan` (nov; dan posle
   trke; posle 7 dana pauze sa spiskom promena).

## Pravila
- Čiste funkcije: bez `Date.now`, `Math.random`, mreže, globalnog stanja. Strogi TS, bez `any`, bez `as` osim na
  granicama serijalizacije. Male funkcije sa jednim vlasnikom odluke; bez petlji „skrati pa dopuni".
- Kad SPEC nije dovoljan ili se dve odredbe sudare: najmanja odluka u duhu SPEC-a + zapis u izveštaj (odeljak
  „Odstupanja"); ne staješ, ne pitaš, ne menjaš SPEC.md.
- Pre svakog push-a: `cd web && npm run typecheck && npx eslint src/domain/v4 && npx prettier --check src/domain/v4
  && npx vitest run src/domain/v4`. Postojeći testovi repozitorijuma koji proveravaju domen (`src/domain/isolation.test.ts`,
  `eslint.domain-rules`) moraju ostati zeleni — ako neko pravilo ne poznaje folder `v4`, javi mi u izveštaju i u
  poruci; stare testove i pravila ne menjaš.
- Nikad push sa crvenim testovima. Push samo na `claude/v4` (pre push-a `git pull --rebase origin claude/v4`; drugi
  tabovi guraju u `docs/` i druge foldere V4). Bez PR-a, ništa u `main`, baza se ne dira, aplikacija se ne dira.
- Pišeš samo u `web/src/domain/v4/engine/`, `docs/generators-v4/reports/F2-REPORT.md`, `docs/generators-v4/plans/SYN/`.
- Commit trailer: `Co-Authored-By: Claude Fable 5.2 <noreply@anthropic.com>`; bez drugih oznaka modela.
- Ako alat traži dozvolu ili ga nema — ne čekaj. Kontejner može da se restartuje: guraj često.

## Poruke organizatoru (`mcp__claude-code-remote__send_message`, `session_id` = `@parent`)
- Posle koraka 1 (odmah): „vdot/constants gurnuti, SHA".
- Kad `plan` + `renderPlan` rade nad sintetičkom distancom (i pre `replan`): SHA + javni potpisi — tada kreće tab
  za podatke polumaratona.
- Na kraju: SHA, broj testova i trajanje, odstupanja, šta F3/F4/F5 moraju da znaju.

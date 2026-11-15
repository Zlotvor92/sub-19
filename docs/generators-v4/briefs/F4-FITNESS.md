# Brief F4 — forma iz trčanja (Opus 5.5)

Implementiraš `web/src/domain/v4/fitness/`: procenu forme trkača iz njegovih trčanja i očekivani raspon na dan trke.
Zahtev vlasnika (AGENTS.md, V4 pravilo 9a): forma nije jedan uneti rezultat nego procena koja se obnavlja iz
treninga; oprezna, objašnjiva, radi bez pulsa; plan prikazuje polaznu formu, trenutnu procenu i raspon na dan trke.
Povod: stari generator je za 18 nedelja pripreme prognozirao 1:41 → 1:41.

## Pročitaj (samo ovo)
1. `AGENTS.md` — SAMO odeljak „V4 generator — pravila" (posebno 9a).
2. `docs/generators-v4/SPEC.md` § 0, § 2, § 5.4, § 7 (ceo), § 14.3, § 14.4, § 14.6 (plafon napretka: polazni brojevi).
3. `web/src/domain/v4/engine/types.ts` (`RunnerFacts`, `Run`, `FormEstimate`, `FormChange`…), `engine/vdot.ts`,
   `engine/constants.ts` (gotovi; uvoziš samo ta tri fajla iz motora — ništa drugo; motor piše drugi tab i ne diraš ga).
4. `docs/generators-v4/coach/SPEC-REVIEW.md` (deo o napretku) i `docs/generators-v4/LOG.md` (F0: šta aplikacija čuva).
5. `web/src/domain/v4/fitness/fixtures/owner-2026-autumn.json` — jedini stvarni uzorak (8 trčanja vlasnika).

## Isporuka
1. `fitness/estimate.ts`: `estimateForm(facts, { distanceM, raceDate }, planned | null) → FormEstimate` po § 7.1–7.5
   (signali: trka, test, odrađen kvalitet, trend pulsa, pauza, izjava; pouzdanost; plafon napretka; raspon).
   `fitness/constants.ts`: svi brojevi sa upućivanjem na odeljak i pouzdanošću. `fitness/explain.ts`: rečenice za
   `FormChange` („zašto se promenilo") na srpskom, pravilna množina, bez internih izraza. `fitness/index.ts`.
   Ako ti treba polje koje `types.ts` nema — NE menjaj `engine/types.ts`; definiši lokalni tip u `fitness/types.ts`
   i navedi u izveštaju šta treba preneti u tipove motora.
2. Kalibracija plafona napretka (§ 14.3, § 14.6): polazni brojevi trenera; proveri ih na poznatim rasponima napretka
   rekreativaca (smeš pretragu weba; navedi izvore i pouzdanost; ne izmišljaj), i na trci vlasnika: polumaraton
   1:42:01 na 26 °C sa izrazito negativnim splitom (poslednja 3 km 4:28 → 4:17) — šta procena kaže o stvarnoj formi
   i koliko toplota i raspodela tempa menjaju dokaz. Predloži da li rezultat trke treba korigovati za uslove
   (temperatura, negativan split) i kako, oprezno. Odluku donesi sam i obrazloži.
3. Testovi (`fitness/*.test.ts`, projekat `domain`, ukupno < 20 s):
   - ne skače: jedan odličan trening pomera procenu ≤ 0,1 VDOT; zbir kvaliteta ≤ 0,3 VDOT / 7 dana;
   - trka pomera odmah (k 0,7), test (k 0,5); niska pouzdanost → k 1,0;
   - bez pulsa: isti niz bez `avgHr`/pulsa po km daje procenu (signal pulsa preskočen, niža pouzdanost);
   - puls samo kao trend: jedno trčanje sa niskim pulsom ne menja ništa; intervali i kratke deonice se ne koriste;
   - pauza spušta formu (−0,3 %/dan posle petog, najviše −8 %);
   - determinizam i „urađeno se ne menja" (ulaz netaknut, isti ulaz → isti izlaz);
   - raspon: za plan ≥ 10 nedelja `expectedSec` < današnje vreme; raspon se sužava kad pouzdanost raste;
     početnik ima veći plafon od trkača sa > 3 god.;
   - izmišljeni nizovi sa poznatim odgovorom (generator nizova u testu): trkač koji stvarno napreduje 0,1 VDOT/ned
     kroz 12 nedelja (kvalitet drži sve brže) → procena prati sa kašnjenjem, ne prebacuje; trkač koji stagnira →
     procena stoji; trkač sa šumom ± 3 % → procena ne „šeta" (broj promena tempa po histerezi § 7.6 ≤ 2 u 12 ned.);
   - uzorak vlasnika: procena kroz 8 trčanja, ispis istorije promena.
4. `docs/generators-v4/reports/F4-REPORT.md` (≤ 80 redova): konačni brojevi i pouzdanost, izvori, šta procena kaže
   za vlasnika (forma 3. 10, danas, raspon za polumaraton 13. 12. 2026. i za 17. 4. 2027) uz jasno „nedovoljno
   podataka" gde je tako (8 trčanja; od 3. 10. samo 5 trčanja), odstupanja od SPEC-a, šta treba u tipovima motora.

## Pravila
- Čiste funkcije, strogi TS, bez `any`; nula uvoza van `web/src/domain/v4/`; iz motora samo tipovi, `vdot.ts`,
  `constants.ts`. Pišeš samo u `web/src/domain/v4/fitness/` i svoj izveštaj.
- Sudar ili nejasnoća → najmanja odluka u duhu SPEC-a + zapis; ne staješ i ne pitaš.
- Pre push-a: `cd web && npm ci` (prvi put), `npm run typecheck && npx eslint src/domain/v4/fitness && npx prettier
  --check src/domain/v4/fitness && npx vitest run src/domain/v4/fitness`. Nikad push sa crvenim testovima.
- Grana `claude/v4`; pre push-a `git pull --rebase origin claude/v4` (drugi tabovi guraju u druge foldere). Bez
  PR-a, ništa u `main`, baza i aplikacija se ne diraju.
- Commit trailer: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; bez drugih oznaka modela.
- Privatnost: uzorak vlasnika ostaje u repozitorijumu; ne šalji ga spoljnim servisima (pretraga samo opštih pojmova).
- Na kraju: poruka organizatoru (`mcp__claude-code-remote__send_message`, `session_id` = `@parent`): SHA, broj
  testova i trajanje, konačni brojevi plafona, procena za vlasnika, šta je nesigurno.

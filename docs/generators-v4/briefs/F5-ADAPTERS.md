# Brief F5 — adapteri: postojeći planovi → PlanDoc (Opus 5.5)

Zahtev vlasnika (AGENTS.md, V4 pravilo 8): V4 mora da radi nad planovima koji već postoje u aplikaciji — planovi
starog formata, v2 planovi i lični plan vlasnika — a preuzimanje samo po sebi NE SME da promeni plan (isti datumi,
treninzi, urađeno, zaključano, ručne izmene). Ti pišeš adaptere i dokaz „otisak pre = otisak posle".

## Pročitaj
1. `AGENTS.md` — SAMO „V4 generator — pravila" (t. 7 i 8).
2. `docs/generators-v4/SPEC.md` § 1, § 2, § 9, § 12 (c), § 14; `docs/generators-v4/reports/F2-REPORT.md` (deo „F5").
3. `docs/generators-v4/LOG.md` — F0: šta je u bazi (formati, ključevi `genPlan`, `log`, `alts`, `moves`, `vanPlana`;
   19 planova starog formata u dve podvrste, 3 v2 plana).
4. `web/src/domain/v4/engine/types.ts`, `engine/index.ts` (`fingerprint`, `replan`, `deriveEvents`, `buildState`,
   `guard`).
5. Stari oblik, SAMO kao opis podataka (čitaš, ne uvoziš u kod adaptera): `web/src/domain/plan/types.ts`,
   `web/src/domain/plan/resolve.ts` (kako aplikacija danas primenjuje `alts` i `moves` na plan — to je istina o
   tome šta korisnik vidi), `web/src/domain/state/` (oblik `log`, `alts`, `moves`, `vanPlana`),
   `web/src/domain/personal/index.ts` (lični plan vlasnika, `personalPlan`, `meta.licni`), `web/src/test/legacyPlans.ts`
   + `web/src/test/fixtures/legacy-plans.json.gz` (zamrznuti planovi starog formata).

## Isporuka
1. `web/src/domain/v4/adapters/`: `legacy.ts` (stari format, obe podvrste), `v2.ts` (v2 planovi svih distanci:
   `meta.policyId`, `weeks[].phase`, dan sa `structure`), `personal.ts` (lični plan vlasnika → `header.protected =
   true`), `shared.ts` (zajedničko čitanje `log`/`alts`/`moves`/`vanPlana` → `Run[]`, `origin`, `base`, `movedFrom`,
   `locked`), `detect.ts` (`adopt(stanjeKorisnika, today) → { doc, facts } | { error }` — sam prepozna format),
   `fingerprintLegacy.ts` (§ 9.2: otisak direktno iz starog stanja), `index.ts`.
   Kod adaptera ne uvozi ništa van `web/src/domain/v4/` (stari oblik opiši sopstvenim, uskim tipovima „ono što
   čitam", sa `unknown` na ulazu i proverom oblika; nepoznato polje se ne gubi nego ide u `legacy`/`extras`).
2. Uzorci kao podatak u `web/src/domain/v4/adapters/fixtures/` (JSON, snimljeni jednom skriptom
   `adapters/fixtures/capture.md` opiše kako): 
   - stari format: ≥ 8 planova iz zamrznutih fikstura (obe podvrste, sve 4 distance, uklj. `runWalk`, `strides`,
     `finish`, `mlr`, dan sa `km: null`, plan sa `planRevisions`/`goalChange` ako postoji u fiksturama);
   - v2: po 2 plana za 5K, 10K, HM, maraton — snimi ih jednom iz zamrznutog v2 generatora u repozitorijumu za
     izmišljene profile (plan kao podatak; kod v2 ne menjaš i ne uvoziš u adapter);
   - lični plan vlasnika: izlaz `personalPlan(...)`;
   - stanja korisnika uz planove (izmišljena, u obliku iz F0): urađeno (`done` sa km/sec/hr/perKm), preskočeno,
     `pending`, ručne izmene (`alts`: odmor, drugi km, drugi opis), pomeranja (`moves`), trčanja van plana, zaključan
     dan — bar 3 kombinacije po formatu, uklj. primer SPEC § 12 (c).
   NIKAKVI tuđi podaci iz baze; bazu ne čitaš.
3. Testovi `adapters/*.test.ts` (projekat `domain`, < 30 s):
   - za SVAKI uzorak: `fingerprintLegacy(legacy) === fingerprint(adopt(legacy))`;
   - nezavisna provera otiska: test (samo test, ne kod adaptera) sme da uveze `web/src/domain/plan/resolve.ts` kao
     proročište i uporedi dan-po-dan (datum, odmor, km, opis) razrešen plan aplikacije sa `PlanDoc` — da otisak ne
     bude „sam sebi svedok";
   - posle preuzimanja: `replan(doc, buildState(...), deriveEvents(doc, state), data)` → isti dokument,
     `changes: []` (data: `engine/testdata/synthetic.ts` ili `distances/hm` kad postoji); i sutradan, kad trkač
     odradi planirano, opet `[]`;
   - lični plan: `protected`, `replan` sa bilo kojim događajem vraća isti objekat; čuvar daje samo `rucno`;
   - ulaz se ne menja (duboko zamrznut ulaz, adapter ne baca); neispravan/nepoznat oblik → `{ error }`, ne izuzetak;
   - `intent` izveden za preostale nedelje (§ 9.3): `kind` iz `deload`/`taper`, `loadPct`, `long.lenPct`, `stimuli`
     samo iz oznaka koje biblioteka distance poznaje (tabela preslikavanja po distanci je podatak adaptera).
4. `docs/generators-v4/reports/F5-REPORT.md` (≤ 80 redova): broj uzoraka i rezultat (mora 100 % bez razlike), šta se
   iz starog formata ne može verno preneti (ako išta) i kako je sačuvano, tabela preslikavanja oznaka, šta
   aplikacija mora da prosledi adapteru (F9), zahtevi prema motoru (ne menjaš `engine/` — prijavi).

## Pravila
- Samo čitanje starog: adapter ništa ne piše u stari plan/stanje. Ništa iz v2 se ne prenosi kao kod.
- Pišeš samo u `web/src/domain/v4/adapters/` i svoj izveštaj. Ne diraj `engine/`, `fitness/`, `distances/`,
  aplikaciju, stare testove, bazu.
- Pre push-a: `cd web && npm ci` (prvi put), `npm run typecheck && npx eslint src/domain/v4/adapters && npx prettier
  --check src/domain/v4/adapters && npx vitest run src/domain/v4`. Nikad push sa crvenim testovima.
- Grana `claude/v4`, pre push-a `git pull --rebase origin claude/v4` (tab motora i tab polumaratona guraju uporedo).
  Bez PR-a, ništa u `main`. Commit trailer: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Sudar ili nejasnoća → najmanja odluka u duhu SPEC § 9 + zapis; ne staješ. Guraj često.
- Na kraju poruka organizatoru (`send_message`, `session_id` = `@parent`): SHA, broj uzoraka, rezultat otiska,
  šta nije moglo verno, zahtevi prema motoru.

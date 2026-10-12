# Reprodukcija završnog QA

Node 24 potreban je za sync TypeScript import hooks u domenskim probama. CI app/test/E2E koristi Node22. Ovaj direktorijum je nov; ne pokretati stare writers iz `generator-ab/` preko originalnih dokaza.

## Checkout-i i identitet

Checkout finalne QA grane `qa/generator-ab-final-seven` u `sub-19/`; pored nje napraviti sibling worktree `generator-a/` na tačnom A commitu:

```bash
git worktree add --detach ../generator-a f7bcbe99d135cd4c1e7b837d0369e8066c1b3baa
npm ci --prefix web
```

B produkcione funkcije su zaključane na `1a7571e98de4793688a037d5a62f912cae18adf2`. Finalna grana ima QA/test/dokumentacione dodatke; validator proverava svih309 produkcionih file hash-eva kandidata. Ako koristiš drugačije apsolutne putanje, generation/common-event harness prima override:

```bash
SUB20_QA_OLD_ROOT=/path/to/generator-a SUB20_QA_NEW_ROOT=/path/to/sub-19 node docs/probes/generator-final-plans.mjs
SUB20_QA_OLD_ROOT=/path/to/generator-a SUB20_QA_NEW_ROOT=/path/to/sub-19 node docs/probes/generator-final-events.mjs
```

Samostalne U01/U05 probe očekuju sibling `../generator-a`, kao gore. Drugi korisnički probe-i očekuju pokretanje iz korena finalnog repoa. Manifest čuva originalne lokalne putanje, source hash-eve, verzije i nasumičan X/Y raspored; re-generacija ne menja raspored. Posle reprodukcije uporediti hash-eve i zapisati razlike pre prihvatanja promenjenog output-a.

## Deset nezavisnih korisničkih proba

```bash
node docs/qa/generator-final/users/U01-probe.mjs
python docs/qa/generator-final/users/U02-probe.py
node docs/qa/generator-final/users/U03-probe.mjs
node docs/qa/generator-final/users/U04-final-probe.mjs
node docs/qa/generator-final/users/U05-probe.mjs
node docs/qa/generator-final/users/U06-probe.mjs
node docs/qa/generator-final/users/U07-probe.mjs
node docs/qa/generator-final/users/U08-probe.mjs
node docs/qa/generator-final/users/U09-controls.mjs
python docs/probes/generator-final-U10.py
```

Sve koriste realne production domenske funkcije. Glavni common replay ostavlja doslovnu istorijsku analizu, current plan, log i opcije; recomputed analysis se samo zasebno beleži. Za U08 nijedna opcija nije zamena primarnog odbijanja. U09 52-week extension je eksplorativan neponuđeni kontrolni slučaj, ne uspešna puna priprema. U08 envelope failure je zabeleženo otvoreno audit zapažanje; probe exit0 ne znači da je taj nalaz zatvoren. Logovi ovog završnog ponavljanja i njihovi hash-evi su u `validation/user-probes.json`.

## Scores, događaji i zaključavanje

Početne AI score datoteke ne re-generišu se prostim pokretanjem skripte. To su subjektivne ocene od četiri nezavisna agenta. Rubrika, rasponi, hash-evi, week coverage i svi40 događaja programski se proveravaju:

```bash
node docs/probes/generator-final-check.mjs
```

Validator ne prepisuje score/event score dokumente. Proverava 80 score redova, ponderisane sume,1.296 week notes,40 event zapisa,10 korisničkih izveštaja, nepromenjene početne score/report hash-eve, A plan hash-eve protiv originalnog „new”,309 produkcionih fajlova i94 originalna QA fajla.

Tačni event paketi čitani od trenera sačuvani su u `coach-inputs/` kao gzip, sa oba hash-a. Za pregled, primer:

```bash
python - <<'PYREAD'
import gzip,json
with gzip.open('docs/qa/generator-final/coach-inputs/U03-event.json.gz','rt') as f:
    data=json.load(f)
print(data['profile']['id'],list(data['cases']))
PYREAD
```

`coaches/*-scores.json` su zaključane početne ocene; `coaches/*-events.json/md` su kasniji pregledi. Ne koristiti otkrivenu X/Y mapu ili već poznate zaključke u novom pokušaju koji se naziva slepim.

## Tehničke i browser provere

```bash
cd web
npm run typecheck
npm run lint
npm run format:check
npm test
npm run build
npx tsc -p tsconfig.e2e.json --noEmit
npx playwright install --with-deps chromium
CI=1 npm run e2e
```

Ako je Chromium sistemski instaliran, postaviti `SUB20_CHROMIUM` na njegov izvršni fajl. U ovom runtime-u lokalni ZIP download je truncated/non-ZIP, pa lokalni E2E nije predstavljen kao prolaz. GitHub CI izvršava stvarni browser suite. Aktuelni run, prvi neuspešni pokušaji i artifact su u `validation/ci.json`.

Fokusirani tokovi:

```bash
npx playwright test e2e/generator-ab-users.spec.ts e2e/phase3-execution.spec.ts e2e/final-preservation.spec.ts
npm test -- src/domain/plan/finalIntegration.node.test.ts src/domain/plan/finalize.node.test.ts src/domain/plan/fatigueRecovery.node.test.ts
```

Backend iz korena:

```bash
node --test --test-reporter=spec 'test/**/*.test.mjs'
```

Browser: realni wizard i UI mutacije; samo auth/backend su fixture-i. Novi test ne injectuje manual alt, predLock, moves ili log u state. Prvo prolazi realnu izmenu, pomeranje, upis tempa i unose kilometraže/vremena. Drugi done trening je future prescription završen unapred, zato restore mora zaštititi njegov sadržaj i mimo cutoff pravila. Ne tvrdi se live server, sat ili iOS Safari verifikacija.

## Očuvanje dokaza

Sve nove output-e sledeće funkcionalne popravke čuvati u novom direktorijumu. Ne ažurirati ove score/evidence hash-eve da bi prikrili novu promenu. Vercel deploymentEnabled=false za ovu QA granu; nema auto merge/deploy. Sledeći prozor polazi sa draft PR-a #43 i otvorenih R01–R10 u REPORT.md.

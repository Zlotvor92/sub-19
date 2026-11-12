# Uzorci adaptera V4 — kako su snimljeni (jednom, 12. 11. 2026)

Uzorci su podatak; ne prave se ponovo. Ništa nije iz baze: stari format je iz zamrznutih fikstura repozitorijuma,
v2 iz zamrznutog v2 generatora za izmišljene profile, lični plan iz `personalPlan(...)`, stanja su izmišljena.

## Planovi (`*.json`, oblik `{ source | input, plan }`)

Privremeni test `web/src/test/v4capture.tmp.node.test.ts` (obrisan posle snimanja), pokrenut iz `web/`:
`npx vitest run --project node src/test/v4capture.tmp.node.test.ts`. Radio je:

- v2: `v2Plan(input)` iz `@/test/generators` (isti put kao aplikacija: generator v2 distance + njegov adapter) za
  8 profila (`v2-5k-a/b`, `v2-10k-a/b`, `v2-hm-a/b`, `v2-mar-a/b`; ulaz je u polju `input` svakog fajla).
- lični plan: `personalPlan(personalBaselineVdot({}))` iz `@/domain/personal` → `personal.json`.
- stari format: plan doslovno iz `src/test/fixtures/legacy-plans.json.gz` (`adapt`, podvrsta sa `athlete`/
  `preparation`: `legacy-07e0f679`, `-11a38446`, `-43e5e913`, `-6d83c535`, `-70aea0f8`, `-85067d34`, `-93f00602`)
  i iz `src/test/fixtures/legacy-adapt.json.gz` (podvrsta bez njih: `legacy-02bcaaa2`, `-02f8331b`, `-030dd329`,
  `-072ed214`, `-156a711a`). Ime fajla = prvih 8 znakova ključa; pun ključ je u polju `source`.

## Stanja korisnika (`states/*.json`, oblik `{ plan, today, state }`)

`cp capture/states.cjs.txt /tmp/s.cjs && node /tmp/s.cjs <ovaj folder>` (nastavak `.txt` da ga eslint ne parsira) — skripta je ovde sačuvana; deterministička (bez sata i slučajnosti).
`state` sadrži `log`, `alts`, `moves`, `vanPlana` (+ `vanPlanaV2`, `knee`); test dodaje `genPlan` iz `plan`.
Pokriva: urađeno (km, sec, hr, `perKm`, `laps`, `runDate`), urađeno bez trajanja, preskočeno, `pending`, izmena na
odmor, drugi km, drugi opis, izmena samo tempa (struktura ostaje), pomeranje (zamena dana, prošli dan, sudar,
neispravan datum), van plana (`vanPlana`, `vanPlanaV2`), zaključan unos (`log.lock`), bol (`knee`), primer
SPEC § 12 (c) (`legacy-spec-c`), dan posle trke, unos u `log` za dan kog nema u planu (lični plan, `n2d6`).

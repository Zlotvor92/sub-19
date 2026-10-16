# Arhitektura — nastavak 2 (nalaz 4, ostatak A5)

Grana `claude/generator-isolation-5k-10k-hm-marathon`; polazni SHA `5313068`. Bez PR-a/mergea/deploya. `fiveK/v2/` i
`docs/5k-v2/` nisu dirani. Izlaz generatora (plan, prilagođavanje, predlozi) nepromenjen — v. „Provere".

## Nalaz 4 — ručna izmena prikazivala stari trening

Uzrok: `resolvePlan` je kod izmene menjao tag/km/opis, a `session` ostavljao originalan; prikaz prvo čita `session`.
Ispravka (jedno mesto odluke: `resolvePlan`, u `domain/plan/resolve.ts` i istovetno u kopiji svakog generatora jer
generatori nemaju zajednički kod): `ResolvedDay.session` = **važeći** propis, `ResolvedDay.originSession` = **original**.
`session` ostaje original samo kad izmena ne dira tip, km i opis (menja samo tempo, ritam ili snagu; tako izgledaju i
automatske izmene tempa); inače `undefined` → važi opis izmene. Sačuvani podaci se ne menjaju (bez migracije).

Test `generators/activeSession.node.test.ts` (zajednički resolve + 4 generatora; izmena→lagano, isti tip sa novim opisom,
samo tempo, odmor; izvoz na sat): **pre ispravke 25/25 pada** (`session` = stari intervali, `originSession` ne postoji),
**posle 26/26 prolazi**; test za sat bez ispravke pada (`'Intervali'` u događaju).

| Potrošač | Čita | Zašto |
|---|---|---|
| `day/planView.sessionCore` (Plan tab) | važeći | prikaz onoga što treba odraditi |
| `day/breakdown` (struktura dana) | važeći | isto; za izmenu čita opis (kako je komentar već tvrdio) |
| `features/session/sessionModel` (segmenti, trajanje, ciljni tempo) | važeći | procena trajanja i naslov dana |
| `day/compare.sessionSignature` | važeći | poređenje stimulusa onoga što se trči |
| `plan/describe.sessKind` (+ kopije) | važeći | kod izmene ionako imenuje po tipu (`hasAlt`) |
| `day/workPace` (zona merenja) | važeći | merenje se vezuje za ono što je stvarno trčano; bez strukture → zona reda |
| `*/training/adaptation/matching.kindMatch` (+ stari `training/adaptation`) | **original** | identitet dana: red predikcije nosi naziv originalne sesije |
| `*/matching.dayZone` (predlog tempa, dokaz forme) | važeći | promenjen tip već čita trenutni tip; inače zona reda = zona originala |
| `*/adaptation/proposal` (ručno zaključan tempo) | **original** | zaključavanje je na sačuvanoj sesiji |
| `*/watch/icuWorkouts` (izvoz na sat, `icuPush`) | važeći | sat dobija važeći trening |
| `*/weather.targetPace` | važeći | tempo za karticu vremena |
| `stores/executionActions.planPreviewChanges` | važeći | pregled minuta/teških dana posle izmena |
| interni tokovi generatora (`finalize`, `fatigueRecovery`, `future`, `replan`, `automaticAlts`) | bez promene | čitaju sačuvane dane ili razrešavaju bez izmena; dan sa izmenom već ide po tagu |
| zapis reference ličnog plana (`test/personal/scenarios.ts`) | original | stari mehanizam je u `session` držao original; beleži se u starom obliku |

## A5 — neutralni tipovi tereta

Novi `generators/contract.ts`: svi tipovi tereta ugovora (rezultat generisanja, razrešen plan, izvršenje, run/walk,
kapija kvaliteta, promena cilja/rekalibracija, odluka o pripremi, predlog/dokaz forme, oporavak, sat, vreme,
poravnanje). Format perzistiranog plana dolazi iz `../state` (`TrainingPlan`, `Week`, `PredictionRow`, `RunWalk` sada
izvezeni iz `state` kao tip — već su bili deo formata). `select.ts` uvozi tipove samo iz `./contract` i re-eksportuje
ista imena (aplikacija nepromenjena); iz foldera distance ostaju samo `import * as fiveK/tenK/halfMarathon/marathon`.
Generatori se i dalje proveravaju sa `satisfies PlanGenerator`/`PreparationApi`. Test `generators/contract.node.test.ts`
obara svaki drugi uvoz iz foldera distance u `select.ts` (i tip kroz imenski prostor generatora), kao i bilo kakav uvoz
iz foldera distance u `contract.ts`; na starom `select.ts` pada (1/3), na novom 3/3.

## Provere (iz `web/`)

- `npx tsc -p tsconfig.domain.json --noEmit` → EXIT 0.
- `npx vitest run --project node src/domain/generators/` → 21 fajl, **333/333** (uključ. `personalPlan` 13782 toka
  identično staroj referenci, ekvivalencija 5K/10K/HM/maraton).
- `npm run check` → prvi pokušaj EXIT 1: lint `no-unnecessary-type-assertion` u novom testu (ispravljeno);
  drugi pokušaj **EXIT 0** — typecheck, lint, format, 181 fajl / **1962/1962** testova.

## Namerne promene ponašanja

- Dan ručno izmenjen tako da izmena nema strukturu: Plan tab, struktura dana, segmenti/trajanje, potpis za poređenje,
  sat i kartica vremena čitaju opis izmene, ne stare intervale. Oracle testovi `planView`, `day` i `icuWorkouts` sada
  proveravaju da je razlika od starog koda SAMO na tim danima i da je stari izlaz tačno prikaz originala (otisak D6
  sata se proverava u starom obliku).
- Pregled izmene plana (`planPreviewChanges`) više ne broji olakšan dan kao težak.
- Isti tip, ručno nov opis: merenje uzima zonu reda predikcije umesto zone originalne sesije (u praksi iste).

## Preostalo

- Izmena samo tempa (ručni `alt.pace`) zadržava strukturu sa tempom originala; naslov dana koristi `alt.pace`
  (`targetPace`), ali `sessionCore`/razlaganje i dalje pokazuju tempo sesije — postojeće ponašanje, nije menjano.
- `ReturnPolicy` u `contract.ts` je unija tri doslovne politike HM/maratona (osnov odluke ide u oba smera); promena
  vrednosti u generatoru pada pri prevođenju i traži svesnu izmenu ugovora.
- `docs/ENGINE_CHANGES.md` nije ažuriran (van zadatih fajlova). A1 ostatak (test 3 km → VDOT), A3, A7 (`icuPush`/čarobnjak
  `UNSUPPORTED_DISTANCE`) — kao u `ARCHITECTURE-FOLLOWUP.md`; povezivanje `fiveK/v2` sa `select.ts` nije urađeno.

# Uputstvo za agente

## Radna grana — OBAVEZNO

Sve izmene, od sada pa nadalje, rade se na grani **`claude/generator-isolation-5k-10k-hm-marathon`**.

- **Ne pravi novu granu.** Ni za novi zadatak, ni za novi segment, ni za ispravku.
- Pre rada: `git fetch origin claude/generator-isolation-5k-10k-hm-marathon` i
  `git checkout claude/generator-isolation-5k-10k-hm-marathon` (pa `git pull origin claude/generator-isolation-5k-10k-hm-marathon`).
- Commit i push idu na tu istu granu: `git push -u origin claude/generator-isolation-5k-10k-hm-marathon`.
- Ako sesija/okruženje dodeli drugu granu, ipak radi na ovoj; ako to nije moguće, stani i javi umesto da praviš novu.
- Grana sadrži sva četiri izdvojena generatora (5K, 10K, polumaraton, maraton). Stanje izdvajanja:
  `docs/generator-isolation/STATUS.md`.

## Vreme — OBAVEZNO

Sva vremena koja se javljaju korisniku (iz baze, logova, CI-ja, bilo odakle) navode se
isključivo po beogradskom vremenu (`Europe/Belgrade`, CET/CEST), ne u UTC. U SQL-u:
`... at time zone 'Europe/Belgrade'`.

## Stalni uslovi za v2 generatore (sve distance)

Svaki v2 segment bilo koje distance mora ih ispuniti i izvestiti o njima.

1. Jedan vlasnik odluke: obim, doza kvaliteta, dužina dugog, WU/CD imaju
   po jedno mesto odlučivanja. Bez petlji uzastopnog skraćivanja/dopune.
   Validator samo prijavljuje.
2. Jedan plafon po zoni, nema dva limita za istu stvar.
3. WU/CD su trenerski deo treninga, ne pufer za km. Manjak obima ide u
   lagane dane ili se prijavljuje kao planirano < cilj.
4. Adaptacija (kad bude): uslovi poznati unapred ulaze u konstruktor;
   završna zaštita samo štiti urađeno, stvarne km/min, datume, ručne
   izmene i zaključane treninge.
5. Handoff (kad bude): kao cilj prima samo činjenice i sam određuje
   povratnu politiku; kao izvor ne šalje svoju politiku.
6. Plan nosi policyId/policyVersion i fazu svake nedelje iz odluke
   generatora.
7. Nula uvoza van foldera distance (osim type-only neutralnih tipova),
   proverava test, bez novih izuzetaka.
8. Upotrebljivost, ne samo aritmetika: test obara degenerisan plan
   (nedelja ispod minimalnog smislenog obima, prazan trening, dugi < lagan).

## Testovi i sabotaže

- Segment: `npm run check` (brz nivo, iz `web/`) + NAMENSKI testovi onoga što je menjano: `npx vitest run --changed
  <polazni SHA>` (vitest sam bira testove koji uvoze promenjene fajlove; sa `TEST_FULL=1` i pun nivo tih testova) +
  E2E dirane distance. Pun nivo celog foldera samo kad je menjan generator te distance:
  `TEST_FULL=1 npx vitest run --project node <folder>`.
- v1 generatori (podrazumevani u produkciji, kod se ne menja): testovi poređenja sa referencama starog koda su
  vitest projekat `v1` — u brzom nivou (`npm run check`, `--changed`) isključen, u punom uključen. Kad se dira v1 (folderi
  distanci van `v2/`, `select.ts`, `handoff.ts`, zajednički domen, `src/test/`): još `npm run test:v1` (pun) ili
  `TEST_V1=1 npx vitest run --project v1` (brz).
  `npm run check:full` (45–75 min, skoro sve su mreže generatora) se lokalno pokreće SAMO kad je menjan domenski kod
  (`web/src/domain/**` — generatori v1/v2, zajednički domen, reference) ili test infrastruktura, i tada jednom, pre
  mergea u main; nikad po segmentu. Izmene koje ne diraju `src/domain/**` ni test infrastrukturu (ekrani, stil, tekst,
  `features/`, `components/`, dokumentacija): `npm run check` + E2E dirnutih ekrana + `npm run build` — bez lokalnog
  `check:full`, ni pre mergea. Pun nivo u svakom slučaju pokreće CI na svaki push koda (`npm test` bez projekta `v1`,
  6 delova uravnoteženih po trajanju; projekat `v1` poseban posao kad se od poslednjeg zelenog run-a menja nešto što
  v1 koristi, na `main`-u uvek; push samo `docs/**` ga ne pokreće; dok run radi, čeka samo najnoviji push iste grane);
  u main tek kad je CI zelen. Nivoi, uzorci i merenja: `docs/testing/TEST-SPEED.md`.
- Sabotaže samo kroz `web/scripts/sabotage.mjs`, na fajlovima koji treba da ih uhvate, sa `--bail=1`; nikad ceo
  skup. Uputstvo: `docs/testing/SABOTAGE.md`.

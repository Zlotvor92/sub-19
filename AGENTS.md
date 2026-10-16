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

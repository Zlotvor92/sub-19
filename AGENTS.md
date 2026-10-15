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

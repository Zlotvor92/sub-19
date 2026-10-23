# Maraton v2 — Segment MAR-08c (test alat; marathon-v2.5.1 bez promene domena)

Polazni SHA `78292d4`. Menjano samo `adaptInvariants.ts` (nezavisna invarijanta), nov test, `docs/marathon-v2/**`.

## Uzrok
`adaptInvariants` „ograničenje: doza raste": najveća dosadašnja doza po zoni (`maxDose`) skupljana je samo iz NEmešovitih
nedelja (`if (m) continue;` pre bloka doze). Upisane doze mešovitih nedelja (pouka 29) su ispadale, pa je ograničena
nedelja poređena sa starijom, manjom dozom. Primer `d3-15w-45km-v30-C-sat` (over120 sreda ned 2 → + 7 pauza 20): upisano
T 2000 → 3000 → 4000 (ned 2–3 mešovite), ned 5 „jedan kvalitet" T cruise 2400 — doza PADA, invarijanta je poredila sa
2000. Konstruktor (writtenPicks) i validator ({ state }) već čitaju upisane doze; plan je bio ispravan.

## Ispravka | test
Mešovita nedelja izgradnje (ne rasterećenje) se i dalje ne sudi, ali njene upisane doze ulaze u `maxDose`.
`segment08c.node` (primer): pada na 78292d4 („doza raste ned 5"), prolazi posle.

## Dokazi (iz `web/`)
- Pretraga `artifacts/segment-08c/dose-search.ts` (svaki 7. plan, over120 sreda ned 2 → + 7 pause20, new + cum,
  9120 tokova, 0 odbijanja): „doza raste" **130 → 0**; stvarni rast prema svim upisanim nedeljama 0 → 0.
- `two-step.ts MAR 193 97 29`: pokrenut posle pusha (prvi pokušaj nije startovao — `sh` bez `time`); rezultat šaljem
  organizatoru kao dopunu (na d73b83a / 78292d4: inv 1 = ovaj tok).
- Sabotaža `artifacts/segment-08c/sabotage-08c.json` (mešovite nedelje opet bez doze, `--bail=1`): 1/1 palo, 2,0 s.
- `npx tsc -b --noEmit` 0; eslint 0; prettier 0. `npm run check`: exit 0 — 318 fajlova / 3647 testova (586 s).
- `TEST_FULL=1 npx vitest run --changed 78292d4`: 33/33 fajla, 142/142 (1033 s). E2E nije potreban (domen nepromenjen).

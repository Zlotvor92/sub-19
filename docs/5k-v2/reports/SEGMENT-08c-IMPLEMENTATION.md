# Segment 08c — tačnost činjenica iz uvoza (rizici 1 i 2 iz 08b)

Grana `claude/generator-isolation-5k-10k-hm-marathon`, polazni `f09a50a`. Pravila v2 (`policy.ts`, konstrukcija, `assess`)
nisu menjana. Sve novo važi SAMO za aktivan plan 5K v2 (`isFiveKV2Plan`); uvoz za v1 je bajt-isti (dokaz ispod).

## Gde je uvoz odbacivao trčanja (f09a50a)
| Mesto (fajl:funkcija, linija) | Šta se gubilo |
|---|---|
| `services/strava/stravaSync.ts:createStravaSync.run` 240; `services/icu/icuSync.ts:syncActivities` 251 | trčanje na dan odmora, van datuma plana, dan bez km (`continue`) |
| isto, 246 / 258 + `domain/activities/raceDay.ts:importedDay` (`selectRaceActivity`) | dan trke: sve osim glavne aktivnosti (zagrevanje); bez para — sve |
| `domain/recovery/load.ts:recordOutOfPlan` 73/81 | `vanPlana` čuva samo dane PRE plana (datum → km); od prvog dana briše |
| `domain/activities/icuImport.ts:icuRunsByDate` 47 | icu trening bez km (vremenska sesija) |
| `stravaSync.ts:parseActivities`, `api/icuApi.ts:activities` | neispravna stavka spiska — tiho |
Rizik 2: `icuSync.ts:syncActivities` `finish()` (286) upisuje `trSync` i kad detalji/tokovi padnu (301, 305, 354, ručni
prekid). Strava ISTO: `lastSync` (356) i kad tokovi/krugovi padnu (273/278/314/331), nepotpun spisak, neprepoznata stavka.

## Šta je promenjeno
- `domain/activities/offPlan.ts` (novo, čisto): `recordOffPlanRuns` — neupareno trčanje (od prvog dana plana do danas)
  → `vanPlanaV2['izvor:ID'] = {date, km, sec, src, id}`; duplikati po pravilu `mergeDay`; uparena se uklanjaju; ceo
  spisak zamenjuje zapise svog perioda (oba izvora — nema zbira Strava + icu), nepotpun samo dopunjuje.
  `stravaActivityIssue`/`icuActivityIssue` (nepoznat tip, trčanje bez datuma, ni km ni trajanje), `syncStatus`.
- Stanje: `PersistedState.vanPlanaV2?` (opciono, `RECOVERY_KEYS`, `cleanOffPlanRuns` u migraciji samo kad polje
  postoji), `OffPlanRun`/`SyncIssue` u `state/types.ts` (u v2 samo type-only kroz `exchange.ts`).
- `stravaSync`/`icuSync`: skup uparenih ID-jeva; svaki neuspeh (spisak, stavka, tok, krug, detalj) → `SyncIssue` sa
  danom; za v2: `vanPlanaV2` + na vezi `fullSync`, `fullSyncFrom`, `syncIssues`. icu: plan v2 ne izlazi rano na prazan
  spisak; `icuApi.activities` vraća i `skipped`. Portovi u `app/integrations.ts` čitaju/pišu polje samo kad postoji.
- `fiveK/v2/app/facts.ts`: zapisi van plana → treninzi bez `dayId` (jezgro: van plana = lagan), km prozora = upareni +
  van plana; zapis čiju aktivnost dnevnik već nosi (`stravaId`/`icuId`) se ne broji. Pokrivenost: `lastSuccessDate` =
  dan `fullSync`, `from` ≥ `fullSyncFrom`; neobrađena aktivnost → pokrivenost (jedan opseg do danas) počinje dan posle
  nje, bez dana → `complete=false`; razlog u `notes`; `coverageText` to kaže.
- `stores/fiveKV2Actions.ts:syncSources` čita ISKLJUČIVO `fullSync` (+ `fullSyncFrom`, `syncIssues`); izvori nose
  `offPlanRuns`; ugovor `AdaptationSources` proširen opcionim poljima. `FiveKV2Adjustment` prati i `icu`/`vanPlanaV2`.

## Novo značenje (`strava.*`, `icu.*`, samo plan 5K v2)
`lastSync`/`trSync`: nepromenjeni (spisak preuzet i upisan; i dalje ih čitaju prikaz i automatski uvoz).
`fullSync` (ms): spisak CEO (Strava < 400, icu < 200) i svaka stavka prepoznata, svaka aktivnost obrađena (uparena ili
van plana) i svaki TRAŽEN tok/krug/detalj preuzet. Bilo šta od toga ne → `fullSync`/`fullSyncFrom` ostaju stari.
`syncIssues` = problemi poslednje sinhronizacije (≤ 50). Odluke: odloženo ograničenjem (icu 24 detalja / 3 toka po
sinhronizaciji) nije neuspeh — ne menja datum/km/trajanje, a inače bi trajno blokiralo; Strava 404/prazan niz za
tokove/krugove (ručno uneta aktivnost) je odgovor, ne neuspeh (kao `icu-bez-strukture`); „nedostaje trajanje/km" = ni km
ni trajanje (sa jednim od njih činjenica postoji); neprepoznata stavka spiska (i `null`) jeste neuspeh — konzervativno.

## Testovi (pre = f09a50a + novi testovi, worktree)
- `fiveK/v2/app/importFacts.node.test.ts` 10: Strava i icu trčanja na dane odmora → zapisi → facts → bez PAUSE/
  UNDER_EXECUTION; dupla sinhronizacija + dvostruki upload + prelaz Strava→icu → 3 zapisa; uparivanje/brisanje uklanja
  zapis; neobrađena aktivnost (bez tipa, bez km i trajanja) → dan nepoznat + napomena; icu detalji pali → `trSync`
  pomeren, `fullSync` ne → `complete=false`, nema PAUSE (posle uspešne: PAUSE); icu tokovi pali (ručno); Strava tokovi
  pali (isto); Strava 404 tokova → `fullSync` se pomera; Strava spisak > 400. Na f09a50a: 10/10 pada; sonda: dan
  odmora (Strava, icu) i pad detalja/tokova → `PAUSE` 7 dana, cilj 25 → 20 km, uz `complete=true`.
- `features/plan/fiveKV2Import.test.tsx` 1 (UI, ceo `createApp` → uvoz → Prilagodi plan): „Budući deo plana se ne
  menja", bez pauze/manjka, zapis potpun. f09a50a: pada.
- `domain/activities/offPlan.test.ts` 4 (pravila zapisa, `syncStatus`, migracija). f09a50a: fajl pada (nema modula).
- `services/importV1Snapshot.node.test.ts` (+ `.f09a50a.json`): 5K v1/10K/HM/maraton × (Strava, icu auto, icu ručno
  sa padom detalja) = 12 snimaka (svaki `commit`, svaki upis veze, ishod; dani odmora, pre plana, bez tipa/km, padovi).
  SHA-256 snimljen na f09a50a (2× isti; ponovo posle izmene pomoćnika) = posle izmene → **uvoz v1 bajt-isti**.

## Komande i rezultati (iz `web/`)
- `npx tsc -p tsconfig.domain.json --noEmit` → 0; `npx tsc -b --noEmit` → 0; `npx vitest run --project node
  src/domain/generators/` → 0, 30 fajlova / 749 (08b: 29 / 739).
- `npm run check` (typecheck, eslint, prettier, vitest) → 0, 195 fajlova / 2396 testova (08b: 191 / 2380).
- E2E (`--workers=1`): `fivek-v2` 3/3, sinhronizacija `strava` 2/2, `race-analysis` 3/3 (icu/Strava), `data` 3/3.
- Neuspesi usput (ispravljeni): eslint 10 (`--fix` uklonio i potreban kast → `tsc` 2); UI test 1. pokušaj `fullSync`
  `null` jer test nije služio tokove (ispravno) → dodati tokovi; pregled diffa: Strava 404 tokova ručne aktivnosti bi
  trajno držao `fullSync` → 404/prazan niz = odgovor (+ test); prvi `npm run check` prekinut kao zastareo.

## Preostalo
- Pokrivenost je jedan opseg: neobrađen dan čini nepoznatim i dane pre njega (rupa traži promenu jezgra). Aktivnost
  čiji detalji/tokovi kod izvora STALNO padaju drži `fullSync` (pokrivenost samo potvrdom; razlog u napomeni).
- `fullSync`/problemi su po uređaju (veza ne ide na server, kao `trSync`). Iz 08b: pauza do potvrde, `planVdotNow`,
  pragovi trake, sat (delovi po osećaju, run/walk bez tempa).

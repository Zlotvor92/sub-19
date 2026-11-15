# Nalog F9-KORAK7 — priključenje V4 na aplikaciju, ostatak koraka 7 (Opus, nov tab)

Prethodni tab F9 je stao na čistom commitu zbog konteksta. Urađeno do sada (sve na `claude/v4`): sloj
`web/src/integrations/v4/` (facts, view, adopt, edits, events), `web/src/services/strava/activityImport.ts`,
`web/src/services/v4/` (planApi, store.commitAction, eventsApi, activityStore, access), `web/src/stores/v4Store.ts` +
grananje `useResolvedPlan`/`currentPlan` (`e395d65a`), `supabase/v4.sql`. Baza: tabele postoje na produkciji
(organizator); TI BAZU NE DIRAŠ.

## Pročitaj (samo ovo)
`AGENTS.md` § V4 (tačke 6, 8, 12); `docs/generators-v4/f9/INTEGRACIJA.md` (§ 5–7: odluke vlasnika, redosled);
`docs/generators-v4/F8-PREDLOG.md` § 9; javne ulaze `integrations/v4/index.ts`, `services/v4/`, `stores/v4Store.ts`.

## Uradi (korak 7, ostatak) — svaka celina svoj commit
1. Učitavač pri pokretanju (`app/integrations.ts`): `readAccess` + `planApi.load` → `useV4Store.set({enabled, row,
   today po Beogradu})`. Bez mreže ili bez reda: isključeno (WITHOUT_ROW ostaje `false` — menja se tek pri puštanju).
2. `useHasPlan` (= genPlan || V4 doc) za korisnika koji ima samo `plan_v4`; ekrani koji danas pitaju „ima li plana"
   preko `useActiveGenPlan` prelaze na njega SAMO pod zastavicom.
3. Čarobnjak i „Generiši nov plan" pod zastavicom: plan pravi V4 motor → `commitAction`; stari plan se arhivira, a
   trčanja i forma OSTAJU (odluka vlasnika 4); upozorenja motora se prikazuju PRE generisanja i ostaju u zaglavlju
   (postojećim komponentama, bez novog dizajna).
4. M6: uz upozorenje `dan-izostavljen` dugme „Ipak hoću N dana" → `Availability.confirmedRunDays = true` (odluka
   vlasnika: dan manje uz upozorenje; ako trkač ipak hoće — pušta se).
5. SwapSheet / AltSheet pod zastavicom → `edits.applyMove` / `applyEdit` → `store.commitAction` (+ `eventsApi.append`
   manual-edit).
6. Strava: `activities` (createActivityImport + createSupabaseActivityStore) u `createStravaSync` samo kad je
   V4 uključen.
7. E2E: sa UGAŠENOM zastavicom postojeći E2E dirnutih ekrana zeleni BEZ izmene; sa upaljenom — sve četiri distance
   (nov plan, nedelja/dan, premeštanje, unos trčanja), mreža lažirana (bez prave baze i prave Strave).

## Granice
- Sa ugašenom zastavicom ponašanje je isto kao danas; postojeći UI/E2E testovi se ne menjaju da bi prošli.
- Lični plan vlasnika (`meta.licni`) ostaje na starom prikazu do 13. 12. 2026. Plan bez istog otiska ostaje na
  starom prikazu (odluka 5).
- `web/src/domain/v4/**` ne diraj (tab motora R24 tamo još radi — `git pull --rebase origin claude/v4` pre svakog
  push-a; ako se javni ulaz promeni, prilagodi sloj i navedi). v2 i HM v1 ne diraj. Novi ekrani iz koraka 8 (Forma,
  traka promena, „Nešto se desilo?") NE.
- Bez baze, deploya, PR-a; ništa u `main`. `npm run check` + E2E dirnutih ekrana + `npm run build`; bez `check:full`.
- Na ≈ 60 % konteksta stani na čistom commitu i javi dokle si.

## Kraj
Završnu poruku (≤ 25 redova: po celini urađeno/neurađeno + SHA, brojevi testova i E2E, šta ostaje) pošalji
`send_message` na `session_01GnHHiXvCMLj5eDdp2ae77u` — NE na @parent. Zatim stani.

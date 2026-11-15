# Drugo puštanje, korak 1 — izveštaj (15. 11. 2026, po Beogradu)

Grana `claude/v4`, polazni `73ce172d`. Baza, `main`, deploy i PR nisu dirani; v2/v1 kod, adapteri i fiksture nisu brisani.

## Celine
| # | SHA | Šta |
|---|---|---|
| 1 | `3b26b7eb` | `kindOfStoredPlan` (`web/src/stores/detect.ts`; adapter folder ne sme da uvozi `select.isLegacyPlan`, sloj `integrations/v4` takođe) + `detect.test.ts` (8 testova). Jedina izmena domena: `domain/v4/adapters/index.ts` izvozi `isV2`/`isPersonal` |
| 2 | `b4237bfa` | `adoptionOf` + `v4.adoptStored`: posle `load()` sa sveže učitanim praznim redom, vrsta `v2`/`licni` → `commitAction` (piše samo kad je `cur === null`); različit otisak → upis + upozorenje `preuzimanje-otisak` u `header.warnings`; greška adaptera → ništa se ne upisuje, samo događaj `preuzeto-greska`. Ukinuti `personalProtected`/`PERSONAL_PROTECTED_UNTIL`; `activeOf`/`useActiveGenPlan`: za vlasnika lični plan pre `genPlan`. Test `adoptStored.test.ts` (5) |
| 3 | `2962cdec` | `discardLegacyPlan` (polja tačno po § 2d) + `guardStoredPlan` posle `engine.start()` za `stari`/`v2-prosla-trka`/`nepoznat`. Uklonjen `LegacyPlanNotice` (tri ekrana i fajl). Test svojstva `discardLegacyPlan.test.ts` (4) |
| 4 | `9b72d128` | E2E (v. dole) + ispravka: događaj preuzimanja ide kao vrsta `preuzeto` (ranije bi `commit` upisao `none`) |

## Provere
- `npm run check` (posle celine 3 i ponovo nad `9b72d128`): 406 fajlova, 4901 prošlo + 12 očekivanih padova.
- E2E lokalno ceo: 93/93; `npm run build`: uspešan.
- CI run 1021 (`9b72d128`, 12:57–13:01): sve zeleno (database, scope, test, web, web-test 1/1, web-e2e 1–3/3).
  Napomena: `ciScope` je izabrao `select`, ne „sve", iako je diran domen van `generators/<D>/v2/` — vredi proveriti pravilo.
- `npm run check:full` nad `9b72d128` (završen ≈ 14:15): 544 fajla, 5433 prošlo + 12 očekivanih padova, izlaz 0.

## Promenjeni postojeći testovi
- `v4Store.test.ts`: „lični plan vlasnika do 13. 12.: stari prikaz" → „zaštita ukinuta: uz zastavicu i red prikaz iz plan_v4";
  „A5: personalProtected…" → „lični plan bez reda se preuzima adapterom (isti otisak), dani/km isti kao stari prikaz".
- `adopt.test.ts` (integrations): „različit otisak → ne preuzima se" → isti status/otisci + sada nosi `doc` i `adoptedDoc` dodaje upozorenje jednom.
- `personal.test.tsx`: „generisan plan ima prednost i za vlasnika" → „za vlasnika lični plan ima prednost; tuđ nalog: generisan".
- `personalPlanGenerator.test.tsx` › „plan bez podržane distance": nalog prebačen na nevlasnika (predmet testa je tuđ plan).
- E2E `v4.spec.ts` › „puštanje: v2 … `v4.row` ostaje null" → „drugo puštanje: red u plan_v4, isti prikaz, `user_state`
  nepromenjen, drugo otvaranje i drugi uređaj (nov kontekst) bez upisa (`writes = 1`, jedan događaj `preuzeto`)".
- E2E `legacy-plan.spec.ts` › „stari plan: prikazuje se, unos radi, Generiši nov plan" → „stari plan se uklanja → samo
  čarobnjak; `log`/`vdotLog` prazni, ručni bol i `ui.lastBackup` ostaju; isto stiže na server".
- Nov E2E `owner.spec.ts` › „lični plan vlasnika prelazi u plan_v4 (zaštićen), prikaz isti kao pre".

## Odstupanja i odluke tabova
- Čuvar NE uklanja vlasnikov `genPlan` (vrsta za vlasnika je uvek `licni`, a nalog kaže „nikad za licni"); § 2b je
  predviđao uklanjanje posle upisa. Organizator kaže da vlasnik nema `genPlan`, pa je razlika samo teorijska.
- `meta.licni` na tuđem nalogu → `licni` (ne briše se, kao u SQL-u), pa se i preuzima.
- v2 bez ispravnog `raceDate` → `v2-prosla-trka` (briše se, kao SQL `coalesce('')`).
- `discardLegacyPlan` prazni CEO `log`/`pred`/…/`vdotLog` i sve `knee`/`kg` sa `src` (§ 2d), ne samo `g…` kao `discardPlan`.
- Nije rađeno (nije u nalogu): `v4AdoptCensus.mjs` (§ 3), podrazumevano uključen V4 u lažnom backendu E2E (§ 4 kor. 1).

## Rizici pri puštanju
- Čuvar radi i kad je V4 izričito isključen (`ukljuceno=false`): korisnik sa starim planom tada dobija stari v2 čarobnjak.
- Upis se radi samo uz sveže učitan red (ne iz keša van mreže); nalog koji se ne otvori ostaje bez reda (§ 2c).
- Čuvar se pokreće jednom po pokretanju; stanje koje kasnije stigne sinhronizacijom sa drugog uređaja hvata tek sledeće otvaranje.
- `toResolved` daje dan odmora bez opisa („Odmor" → `null`), kao i za v2 već danas; km, datumi, ID i redovi ekrana Plan (E2E) su isti.

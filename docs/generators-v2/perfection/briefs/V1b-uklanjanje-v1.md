# V1b — uklanjanje v1 generatora 5K, 10K i maratona

Odluka korisnika: v1 se briše; njegov ugrađeni lični plan mora da ostane potpuno upotrebljiv; korisnici starih v1
planova generišu nov plan. Odluke organizatora su u `PROGRAM.md` (dnevnik, unos „V1a primljen").

Pročitaj prvo: `AGENTS.md`, `docs/generators-v2/perfection/PROGRAM.md`, `reports/V1a-REPORT.md` (ceo — to je tvoj plan,
posebno § 6 redosled), `reports/T1-REPORT.md` (CI po dometu), `ARCHITECTURE.md`.

## Obim

1. **Briše se** v1 za 5K, 10K i maraton: folderi distanci van `v2/`, njihovi testovi (`equivalence*`, `isolation`), delovi
   `otherDistances*`, `runtimeIsolation*`, `guidance`, `generator.differential/fingerprint` koji ih pokrivaju, pomoćnici
   `src/test/{fiveK,tenK,marathon}`, reference `.json.gz` tih distanci, grane v1 u `select.ts`, `handoff.ts`, `flags.ts`,
   čarobnjaku i `domain/onboarding`.
2. **Ostaje zamrznut** HM v1 (`halfMarathon/` van `v2/`), ali se koristi SAMO za plan sa `meta.licni === true`
   (`LEGACY_PERSONAL_GENERATOR`); nijedan drugi plan ni nov plan ne sme da ga dobije. Ostaju `personalPlan.node.test.ts`,
   `personal-reference.json.gz`, `src/test/personal`, `src/test/halfMarathon` koliko taj test traži. HM v1 kod se NE menja
   (ni trimovanje) — dokaz bajt-istog ponašanja ličnog plana je postojeća referenca. Brisanje HM v1 je segment V1c, posle
   13. 12. 2026.
3. **Stari planovi u bazi** (`genPlan` bez `meta.policyId`, nisu `licni`): plan se i dalje otvara i prikazuje, unos radi;
   nema generatora → jedna jasna poruka („Plan je napravljen starim generatorom: prikazuje se, ali se više ne
   prilagođava") i dugme „Generiši nov plan". Nigde pad: zaštiti `executionActions.ts planGenerator()` i sve pozivaoce iz
   tabele V1a § 2. Bez migracije stanja, baza se ne dira. Postojeće ponašanje „Generiši nov plan" (briše unose starog plana)
   se ne menja, ali potvrda mora jasno da kaže šta se briše a šta ostaje — proveri tekst i dopuni ga ako ne kaže.
4. **Novi planovi**: samo v2, jedna putanja u čarobnjaku; prekidači i `VITE_*_V2`/`VITE_V2_DEFAULT_ON` grane nestaju
   (`vercel.json` buildCommand ostavi kakav jeste ako promenljiva postane bez efekta — navedi u izveštaju; deploy
   konfiguraciju ne menjaj bez potrebe). Pregled u čarobnjaku (`outlook`, upozorenja, `formPreview`) na v2.
5. **Uslov 7**: `fiveK/exchange.ts` tipovi → `fiveK/v2/app/exchange.ts`; `select.ts` uvozi `*/v2/app/index.ts` direktno.
6. **Testovi**: 99 testova koji prave ulaz v1 generatorom (`src/test/generators.ts`) → v2 generatori; zamrznute fiksture
   v1-formata plana samo za testove prikaza starog plana (tačka 3) i `*.oracle.test.ts` koji čuvaju prikaz/stanje. 18 v2
   testova koji uvoze v1 → ukloni poređenje sa v1, zadrži proveru granice. Nijedna provera ponašanja aplikacije ne sme da
   nestane bez zamene: u izveštaju tabela „test → šta je čuvao → čime je zamenjen / zašto je obrisan".
7. **CI**: posao v1 svodi se na ono što ostaje (lični plan — može u redovne delove); `ciScope.mjs` spisak `V1_REFERENCE`
   uskladi; „sve" podeli na 10 delova (odluka posle T1); `docs/qa`: obriši samo foldere koje nijedan živ test ne čita.
8. **Dokumentacija**: `AGENTS.md` (odeljak testova: v1 više nije podrazumevan ni prisutan osim HM za lični plan),
   `ARCHITECTURE.md`, `docs/generator-isolation/STATUS.md` (kratak zapis), `docs/testing/TEST-SPEED.md`.

## Kako raditi

- Redosled iz V1a § 6: prvo koraci koji ništa ne brišu (tipovi, status `legacy`, lični plan, čarobnjak na v2, testovi na
  v2), svaki sa svojom proverom; brisanje foldera na kraju. Posle svakog koraka lokalni commit (bez push-a).
- Ne diraj pravila v2 generatora (`*/v2/*.ts` van `app/` i testova) — policyVersion se ne menja; izlaz v2 bajt-isti
  (bazne linije netaknute). Ako neki test v2 mora da se menja zbog uvoza v1, menjaj samo uvoz/poređenje.
- Lični plan: pre i posle izmene `personalPlan.node.test.ts` + `features/personal*` + E2E vlasnika moraju biti zeleni;
  u izveštaju dokaz da nijedna funkcija iz tabele V1a § 2 nije izgubljena za `licni` plan.
- E2E: sav skup jednom na kraju (menja se čarobnjak i ponašanje plana) + nov E2E „stari plan: poruka i dugme".
- Testovi: ovo je izmena zajedničkog domena i test infrastrukture, pa po `AGENTS.md` ide `npm run check` u toku rada po
  potrebi i JEDNOM `npm run check:full` na kraju (jedini segment programa koji ga sme). Push koda: jedan, na kraju; CI će
  biti „sve".

## Stani i javi (`reports/V1b-STOP.md`, opcije sa brojevima)

Funkcija ličnog plana koja ne može da ostane bez izmene HM v1; test koji čuva ponašanje aplikacije a ne može da pređe
na v2 ni na fiksturu; v2 odbija ulaz koji čarobnjak danas prihvata i za koji nema poruke; više od 20 E2E padova čiji
uzrok nije očigledna posledica brisanja.

## Izveštaj i kraj

`docs/generators-v2/perfection/reports/V1b-REPORT.md` (≤ 200 redova): obrisano (fajlovi/redovi po grupi), zadržano i zašto,
tabela testova, dokaz za lični plan, ponašanje starog plana (snimak ekrana ili opis E2E), merenje CI pre/posle (run-ovi),
trajanje svake komande testa, šta nije urađeno. Commit + push na radnu granu (`git pull --rebase` pre push-a), pa
`send_message` organizatoru; ako alat traži dozvolu koju niko ne može da da, ne čekaj — izveštaj u repou je dovoljan.

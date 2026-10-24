# Ispravke posle dubinske provere — zajednička pravila (organizator, sesija session_01CtvbsCTQ3RmMWYYTgGt6Wm)

Izvor nalaza: `docs/generators-v2/audit/*/REPORT.md` (uglovi coach-5k-10k, coach-hm-mar, fuzz, chains, owner, consistency, app).
Odluke organizatora su u tvom fajlu zadatka; spisak je ZAKLJUČAN. Šta nije na spisku — ne radi (zapiši u izveštaj pod
„Primećeno, nije rađeno"). Budžet je ograničen (nedeljni limit naloga): radi efikasno, bez širokih istraživanja.

1. Grana `claude/generator-isolation-5k-10k-hm-marathon` (ne pravi novu). Pre rada `git pull origin <grana>`.
   Druge 3 sesije rade paralelno na drugim distancama: menjaj SAMO folder svoje distance
   (`web/src/domain/generators/<distanca>/v2/**`, njegove testove, `web/e2e/<distanca>-v2*.spec.ts` ako treba) i svoj
   izveštaj `docs/<distanca>-v2/reports/SEGMENT-<oznaka>-IMPLEMENTATION.md` + `docs/<distanca>-v2/STATUS.md`.
   NE menjaj zajedničke fajlove (`docs/generators-v2/MASTER-HM-MARATHON.md`, `docs/generator-isolation/STATUS.md`,
   `final-check/*`, `features/**` zajednički kod, `domain/generators/*.ts` van foldera distance) — ako ti treba izmena
   tamo, stani i javi organizatoru (send_message) šta i zašto.
2. Stalni uslovi iz AGENTS.md (1–8) važe. Jedan vlasnik odluke: svaka ispravka „dve definicije" završava sa JEDNOM
   funkcijom koju zovu i konstruktor i validator/adaptacija (pouka 24).
3. Svaka ispravka: (a) test koji pada pre i prolazi posle (ulaz iz nalaza); (b) sabotaža kroz
   `web/scripts/sabotage.mjs` sa `--bail=1` na fajlu koji je treba uhvatiti (docs/testing/SABOTAGE.md); (c) ponovo pokreni
   mernu skriptu iz `docs/generators-v2/audit/<ugao>/` koja je našla nalaz i zapiši broj pre → posle.
4. Verzija politike: podigni `policyVersion` svoje distance jednom (minor) i zapiši promene u DECISIONS/komentarima kao
   dosad. Zamrznuti otisci (hash JSON u testovima): po postojećoj konvenciji foldera; svaka promenjena vrednost mora biti
   objašnjena ispravkom (spisak tokova koji su se promenili i zašto).
5. Testovi (AGENTS.md): `npm run check` (iz web/) + `npx vitest run --changed 670700e` + `TEST_FULL=1 npx vitest run
   --project node src/domain/generators/<distanca>` + E2E svoje distance (`npx playwright test e2e/<distanca>-v2*`,
   Chromium je već instaliran; ne pokreći playwright install). NE `check:full`. Dugi poslovi u pozadini, bez sleep petlji.
6. Na kraju: `bash docs/generators-v2/final-check/run-all.sh /tmp/ra 4 '.*-<DIST>$'` (DIST = 5K|10K|HM|MAR; regex
   hvata poslove te distance) + `python3 docs/generators-v2/final-check/summarize-all.py /tmp/ra`: 0 nečistih osim
   poznatih (FINAL-2026-10-23.md). Rezultat u izveštaj.
7. Commit(i) na srpskom, `git pull --rebase origin <grana> && git push -u origin <grana>` (do 4 pokušaja). Završna
   poruka organizatoru (send_message session_01CtvbsCTQ3RmMWYYTgGt6Wm): SHA, nova verzija politike, tabela stavka →
   urađeno/nije + broj pre → posle, testovi (brojevi), run-all sažetak, sabotaže, otvoreno. Kratko, srpski.
8. Ne izmišljaj: ako stavka ne može bez trenerske odluke koja nije zapisana — stani na toj stavci, uradi ostale,
   javi pitanje u završnoj poruci.

Zajednička pravila u svim distancama (odluke organizatora):
- Z1 Pouka 37 dopuna: kvalitet NE otpada u mešovitoj nedelji kad je jedini uzrok viška upisani višak (zaštićeni po
  činjenicama > planirani zaštićeni) i planirano sa zadržanim kvalitetom ≤ 1,10 × cilj: kvalitet ostaje, lagani na
  minimum, upozorenje MIXED. Merenje: `docs/generators-v2/audit/consistency/mixed-drop.ts <D> 97` (kvalitet otpao u
  over120 → 0 kada je višak ≤ 10 %).
- Z2 Tekst korisniku: bez internih oznaka (D6, A3/A4, H17, M7, pouka N, F4a…) u napomenama, upozorenjima i porukama koje
  vidi korisnik; decimalni zarez; najviše 1 decimala za km; trajanje oporavka m:ss; bez „..". Tehničke oznake mogu
  ostati u `code`/internim poljima. Test: nijedna korisnička poruka plana iz mreže ne sadrži obrazac interne oznake.
- Z3 Forma (`app/form.ts`) ne piše „čeka prilagođavanje" za rezultat koji jezgro ignoriše (VDOT van opsega i sl.) —
  Forma čita odluku jezgra (jedan vlasnik).
- Z4 Vraćanje revizije (`app/adapt.ts` restoreMerge): izmeri obrascem `docs/generators-v2/audit/owner/tenK-restore.ts`
  (vraćen plan prolazi validatePlan; sledeća adaptacija nije odbijena). Ako ima kršenja: vraćanje kroz jezgro
  (writtenWeeks + validatePlan). Pojašnjenje organizatora (07:20): vraćanje je pre svega „poništi prilagođavanje" — NE
  odbija se samo zato što posle snimka postoji adaptacija. Spoj pa validatePlan istom funkcijom jezgra: prolazi →
  primeni; ne prolazi → odbij sa jasnom porukom. Neposredno poništavanje (verzija tik pre poslednje adaptacije, bez
  novih zapisa posle) mora da prođe (test). Cilj: vraćen plan koji krši validator = 0; odbijena vraćanja = broj + razlozi.
- Z5 Cilj predaje (`app/handoffTarget.ts`, samo 5K/10K/HM kao ciljevi): cilj sam određuje politiku (uslov 5) —
  (a) rezultat izvora nepodržane distance → plan bez rezultata (po osećaju / lak tempo izvora), ne odbijanje;
  (b) početnik izvora iznad maksimuma tabele početnika cilja → plan bez oznake početnika (kako poruka WEEKLY_KM_TOO_HIGH
  već kaže). Test: MAR v2 početnik 45 km → ponuda HM i 10K postoji; HM izvor sa HM rezultatom → 5K cilj postoji.

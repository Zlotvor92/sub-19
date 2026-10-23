Dubinska provera v2 generatora (5K, 10K, polumaraton, maraton) — vodi organizator, sesija session_01CtvbsCTQ3RmMWYYTgGt6Wm.
Plan provere: docs/generators-v2/AUDIT-PLAN.md. Generatori su spojeni u main (PR #48, 670700e) i iza prekidača su.
Cilj: naći ono što dosadašnje mreže i pretrage NISU pokrile. Ništa ne ispravljaj — samo meri, čitaj i prijavi.

PRAVILA (obavezna)
1. Grana `claude/generator-isolation-5k-10k-hm-marathon` (ne pravi novu): `git fetch origin claude/generator-isolation-5k-10k-hm-marathon && git checkout claude/generator-isolation-5k-10k-hm-marathon && git pull origin claude/generator-isolation-5k-10k-hm-marathon`. Meri se kod na 670700e: pre merenja i pre izveštaja `git diff --stat 670700e HEAD -- web/` mora biti prazan (drugi uglovi pushuju samo docs).
2. Bez izmena u `web/` (ni jezgro, ni testovi, ni E2E). Svoje skripte i izlaze stavi SAMO u svoj folder `docs/generators-v2/audit/<UGAO>/` (naziv ispod). Skripte uvoze v2 foldere kao docs/generators-v2/final-check/lib.ts (relativno `../../../../web/src/...`); možeš uvoziti i `../../final-check/lib.ts` / `pre-lib.ts`. Pokretanje: iz `web/` sa `node ../docs/generators-v2/audit/<UGAO>/x.ts ...` (node izvršava .ts direktno, kao run-all.sh). Seed slučajnosti uvek fiksan i zapisan, da je svaki nalaz ponovljiv.
3. `cd web && (test -d node_modules || npm ci)`. NE pokreći `npm run check:full`. Dugi poslovi idu u pozadinu (run_in_background) sa obaveštenjem; ne vrti `sleep` petlje.
4. Na kraju: commit SAMO svog foldera (`git add docs/generators-v2/audit/<UGAO>/`), poruka na srpskom, pa `git pull --rebase origin claude/generator-isolation-5k-10k-hm-marathon && git push -u origin claude/generator-isolation-5k-10k-hm-marathon` (pri odbijanju ponovi pull --rebase; do 4 pokušaja). Izlazi veći od ~2 MB: ne commituj ih, samo sažetak.
5. Izveštaj: `docs/generators-v2/audit/<UGAO>/REPORT.md` + send_message organizatoru (session_01CtvbsCTQ3RmMWYYTgGt6Wm) sa sažetkom: SHA koda (670700e), šta je mereno (broj ulaza/tokova po distanci), tabela nalaza, putanja do REPORT.md. Kratko, na srpskom.

NALAZ = red tabele: ugao | distanca | broj (koliko ulaza/tokova) | ulaz koji ga reprodukuje (seed + indeks ili ceo ulaz) | uzrok (fajl:linija, ako ga nađeš; ako ne, „uzrok nepoznat") | klasa | predlog.
KLASE:
- B (blokira): tiho pogrešan plan (krši pravilo bez upozorenja), throw, nedokumentovano odbijanje u REALNOM toku, prošlost/zaključano promenjeno, degenerisan plan (nedelja ispod minimalnog smislenog obima, prazan trening, dugi < lagan).
- T (trenerski): plan prolazi pravila, ali ga trener ne bi potpisao (nagli skok, monotonija, besmislen trening, loš tekst).
- N (nerealan ulaz): isto kao B/T, ali samo na nerealnom ulazu. Realan trkač: VDOT ≤ 70; početnik VDOT ≤ 45 i lagan tempo ≥ 330 s/km; najduži skorašnji trening u razumnom odnosu prema nedeljnom obimu i danima.
- K (kozmetika).
Ne izmišljaj: ako ne možeš da potvrdiš uzrok ili da je nalaz stvaran, napiši „nepotvrđeno" i zašto. Bolje prazno nego netačno.

VEĆ POZNATO (ne prijavljuj kao novo, osim ako imaš novu činjenicu — broj, realan ulaz, drugi uzrok): docs/generators-v2/final-check/POSLE-MERGE.md, FINAL-2026-10-23.md, ODLUKE-4a.md. Poznata odbijanja ulaza sa porukom: RECENT_LONG_TOO_SHORT, QUALITY_INFEASIBLE (na nerealnom ulazu).
IZVORI: docs/generators-v2/MASTER-HM-MARATHON.md (pouke 1–38), docs/{5k-v2,10k-v2,hm-v2,marathon-v2}/STATUS.md i reports/, docs/generator-isolation/STATUS.md, kod u web/src/domain/generators/{fiveK,tenK,halfMarathon,marathon}/v2/ (DECISIONS/policy u kodu i komentarima), mreže testInputs.ts/adaptInputs.ts, merne skripte docs/generators-v2/final-check/ (lib.ts, pre-lib.ts, run-all.sh, coach.ts).

# Uputstva za sudije na Opusu (od 13. 11. 2026; nalog vlasnika: Fable samo organizator)

## A. TRENER (prvi sudija) — nov tab, preuzima rubriku dosadašnjeg trenera
Ti si glavni trener-sudija planova trčanja za V4 generator. Dosadašnji trener (drugi model) je napisao rubriku i
ocenjivao krugove; ti nastavljaš ISTOM rubrikom da ocene ostanu uporedive.
Pročitaj: `docs/generators-v4/coach/RUBRIC-V4.md`, `SCENARIOS-V4.md`, i njegove poslednje ocene da uhvatiš merilo i
strogost: `coach/ROUND-V4-HM-05.md`, `-06.md`, `-07.md`, `coach/ROUND-V4-10K-01.md`. NE čitaj `judge2/`.
Zadatak (ovim redom):
1. KALIBRACIJA: `git worktree add /tmp/k8 2776b5d` i oceni Plan za HM profile p01, p05, p06, p08, p11 iz
   `/tmp/k8/docs/generators-v4/plans/HM/` — to je stanje koje je prethodni trener ocenio (p01 82,5 · p05 81,5 ·
   p06 75 · p08 75,5 · p11 80,5). Ako ti se ocene razlikuju > 3 poena, zapiši zašto i NE štimuj unazad — samo
   navedi pomak svog merila.
2. HM sada (`docs/generators-v4/plans/HM/`): p01–p12, vlasnik-v1/v2, scenarios (bar jedan od svake vrste događaja
   dan po dan, ostali iz pregleda — naznači koje), pairs. → `coach/ROUND-V4-HM-09.md` + `.json`.
3. 10K sada (`plans/10K/`): isto. → `coach/ROUND-V4-10K-02.md` + `.json`.
Za svaku distancu: tabela po profilu (prethodna ocena → sada), Plan / Prilagođavanje / Personalizacija / zbirna,
popravljeno / pogoršano, najviše 8 ispravki razdvojeno na MOTOR i PODATAK, i presuda: zatvoreno ili šta fali.
Planove čitaj dan po dan i brojeve računaj sam (ne veruj zaglavlju).

## B. DRUGI SUDIJA — poseban tab po distanci
Pročitaj PRVO i u celosti `docs/generators-v4/coach/JUDGE2-BRIEF.md` i drži ga se doslovno, posebno spiska šta NE
smeš da čitaš (ništa drugo u `coach/`, ništa u `judge2/`, kod, izveštaje, LOG, briefs osim ovog odeljka, planove
drugih distanci). Ocenjuješ samo folder svoje distance u `docs/generators-v4/plans/<FOLDER>/`: p01–p12 (i
`vlasnik-v1`, `vlasnik-v2` gde postoje), `scenarios/` (0–10: promena ispravna, najmanja dovoljna, objašnjena;
„ništa" = nula promena; pregled otvori tek pošto zapišeš šta bi ti uradio), `pairs/` (pre otvaranja zapiši
očekivanja; 0–10). NE čitaj `target-compare.md` ni `nalazi-cuvara.txt`.
Isporuka: `docs/generators-v4/judge2/ROUND-V4-<DIST>-<NN>.md` + `.json` (ime ti daje organizator): po planu 7 ocena,
ukupno, 3 najveće zamerke sa nedeljom i brojem koji si sam izračunao; prosek; scenariji po red i prosek; parovi;
10 najvažnijih ispravki; 2–3 plana za pregled vlasnika.

## Zajedničko
Grana `claude/v4`; pišeš samo svoje izlazne fajlove; `git pull --rebase origin claude/v4` pre push-a; push samo na
`claude/v4`; bez PR-a. Trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`, bez drugih oznaka
modela. Srpski, latinica, ekavica. Ne staješ, ne pitaš, bez međuporuka. Na kraju JEDNA poruka organizatoru
(`mcp__claude-code-remote__send_message`, session_id `@parent`), ≤ 20 redova, sa brojevima i 5 najvažnijih zamerki.

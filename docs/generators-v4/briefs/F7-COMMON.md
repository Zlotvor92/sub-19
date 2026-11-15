# Brief F7 — nova distanca kao PODATAK (zajednički deo), 13. 11. 2026

(Napomena: ovaj fajl greškom nije bio gurnut kad su otvoreni tabovi 5K i maraton — pull je pao pa je upis preskočen.)

Motor je zajednički i ne zna za distance; HM (`distances/hm/`) i 10K (`distances/tenk/`) su obrazac.
- Čitaj: AGENTS.md § „V4 generator — pravila"; SPEC § 11, § 14; folder najbliže distance u celosti + skripte
  `docs/generators-v4/plans/*.ts` (`--dist`); zamke: `coach/ROUND-V4-HM-05/06/07/09.md`, `ROUND-V4-10K-01/02.md`,
  `briefs/R9-ROUND9.md`, `reports/R7-REPORT.md`, `reports/F7-10K-REPORT.md`, LOG od 13. 11. 09:40; ciljni planovi u
  `coach/target/` (nose grešku: previše brzog rada u vrhu — pravila krugova imaju prednost). Ne čitaj v2 ni `judge2/`.
- Pravila plana koja moraju da važe: brz rad po nedelji i u vršnoj ograničen (uklj. tempo trke i blok), silazak
  obima i intenziteta, sužavanje nikad naopako, prvi trening zone ≤ 70 % vrha, specifična faza bez rupe, tempo trke
  raste, dugi nikad kraći od laganog, zone nikad brže od stvarnog rezultata, faze ne idu unazad, predlozi u
  upozorenjima iz jednog izvora i iz brojeva plana.
- Isporuka: `distances/<id>/` (sva polja `safety` iz obrasca; nula uvoza drugih distanci; `engine/`, `fitness/` se ne
  diraju; distanca u registru); 12+ profila, scenariji (uklj. tri sa dva događaja), 6 parova; testovi (`<id>.test`,
  `gate.test`, scenariji, otisci, mreža); ispisi `plans/<FOLDER>/`; izveštaj ≤ 80 redova sa tabelom po profilu,
  kapijom i ZAHTEVIMA ZA MOTOR.
- Rad: grana `claude/v4`, `git pull --rebase` + ceo V4 skup + `npm run typecheck` neposredno pre SVAKOG push-a; nikad
  crveno; trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; bez PR-a, `main`, deploya, baze;
  nejasnoća → najmanja odluka + zapis; bez međuporuka; pre kraja pročitaj sam sve planove dan po dan i 6 scenarija;
  jedna završna poruka organizatoru ≤ 20 redova.

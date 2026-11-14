# R21 — ocena sve četiri distance posle R20 (stanje `21d4b070`), 14. 11. 2026, po NOVOM MERILU

Važi `briefs/JUDGES-OPUS.md` (A trener, Zajedničko) uz razlike:
- Ocenjuješ SAMO stanje `21d4b070`: `git fetch --unshallow origin claude/v4 || git fetch origin claude/v4`, pa
  `git worktree add /tmp/r21 21d4b070`; planovi iz `/tmp/r21/docs/generators-v4/plans/`. Izlaz pišeš u glavnom stablu
  na `claude/v4` (svež klon kaže „diverged" — plitak klon: posle `--unshallow` `git merge --ff-only origin/claude/v4`).
- Trailer `Co-Authored-By: Claude Fable 5.2 <noreply@anthropic.com>`. Završna poruka na session_id
  `session_01GnHHiXbHoY1xUw1QNCS3LN` (NE `@parent`), ≤ 25 redova.

## Merilo (odluka vlasnika, 14. 11.) — `coach/RUBRIC-V4.md` § A3
Svaki profil kome ulaz dozvoljava: Plan (stara skala) ≥ 80. Profil sa plafonom ulaza: „Plan za ulaz" ≥ 80, a stara
ocena ne niža nego u R19. B ≥ 80, C ≥ 80. Prosek distance je pomoćni broj. Drugi sudija: nijedan plan < 65.

## A. Trener (NOV tab, jedan za sve četiri distance)
Nastavljaš ISTOM rubrikom (`coach/RUBRIC-V4.md`, `SCENARIOS-V4.md`). Merilo i strogost uhvati iz R19:
`coach/ROUND-V4-HM-12.md`, `-10K-05.md`, `-MAR-03.md`, `-5K-03.md` i dopune po novom merilu `coach/ROUND-V4-R19B.md`
+ `coach/R19B-RAZVRSTAVANJE.md` (stanje `ef506f4c`). NE čitaj `judge2/`.
1. RAZVRSTAVANJE: preuzmi ono iz `R19B-RAZVRSTAVANJE.md` (ne menjaj ga posle čitanja planova; ako se ne slažeš sa
   nekim redom, napiši to PRE otvaranja planova, sa razlogom). Trener R19B je sam naveo da mu je prag obima bio
   prestrog za kratke distance — o tome odluči unapred i zapiši.
2. KALIBRACIJA (kratko): `git worktree add /tmp/k19 ef506f4c`; oceni Plan za HM p01, p06, MAR p11, 5K p06 i „Plan za
   ulaz" za MAR p13, 5K p13 iz `/tmp/k19/...` i uporedi sa R19 / R19B. Razlika > 3 poena: zapiši, NE štimuj unazad.
3. Redom HM → `coach/ROUND-V4-HM-13`, 10K → `-10K-06`, MAR → `-MAR-04`, 5K → `-5K-04` (`.md` + `.json`). Po profilu:
   grupa, Plan (stara skala) prethodna → sada, „Plan za ulaz" prethodna → sada (samo plafon ulaza, po četiri
   kriterijuma), prolazi/ne. B i C kao do sada. Planove čitaj dan po dan, brojeve računaj sam. Scenariji dan po dan
   bar: povratak posle prekida (s05–s08, s15, s16, s25, s27 — R20 je uveo jedno pravilo povratka: dugi ≤ +20 min ili
   +15 % nedeljno, prvi brzi ≤ 70 % doze; put ≠ bolest; provera forme se pomera), bol (s13–s15), posle trke (s17–s20,
   s26), propušten najduži dugi (MAR s28, s09), rezultat (s01–s04), „ništa" (s22). Posebno proveri: iskrenost
   prognoze uz upozorenje o obimu (MAR p03, p06, p13, p19; 5K p13), procenu iz laganog tempa (MAR p10, p18; HM p10),
   MAR dugi po vremenu (p11, p18, p08), 5K p06 (ned 5), dugi u ned 1 iz istorije (parovi P3).
   Najviše 8 ispravki po distanci, MOTOR / PODATAK, poređane po učinku na PROLAZ profila. Push posle svake distance.
4. Završna poruka: po distanci koliko profila prolazi u svakoj grupi (prethodno → sada), Plan/B/C proseci, svi profili
   koji ne prolaze sa ocenom i onim što ih deli od praga, 5 ispravki sa najvećim učinkom.

## B. Drugi sudija (NOV tab po distanci) — nalog dobija u poruci, ovaj fajl ne čita
Izlaz: HM `judge2/ROUND-V4-HM-13`, 10K `-10K-06`, MAR `-MAR-04`, 5K `-5K-04`.

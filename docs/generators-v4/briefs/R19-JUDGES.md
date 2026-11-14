# R19 — ocena sve četiri distance posle R17–R19 (stanje `ef506f4c`), 14. 11. 2026

Važi `briefs/JUDGES-OPUS.md` (A trener, B drugi sudija, Zajedničko) uz razlike:
- Ocenjuješ SAMO stanje `ef506f4c`: `git fetch --unshallow origin claude/v4 || git fetch origin claude/v4`, pa
  `git worktree add /tmp/r19 ef506f4c`; planovi iz `/tmp/r19/docs/generators-v4/plans/`. Izlazne fajlove pišeš u
  glavnom stablu na grani `claude/v4` (svež klon često kaže „diverged" — to je plitak klon: posle `--unshallow`
  uradi `git merge --ff-only origin/claude/v4`; ništa ne briši).
- Sudije su sada na Fable 5.2: trailer `Co-Authored-By: Claude Fable 5.2 <noreply@anthropic.com>`.
- Završna poruka na session_id `session_01GnHHiXbHoY1xUw1QNCS3LN` (NE `@parent`), ≤ 20 redova.

## A. Trener (NOV tab, jedan za sve četiri distance)
Ti si nov trener-sudija; nastavljaš ISTOM rubrikom (`coach/RUBRIC-V4.md`, `coach/SCENARIOS-V4.md`). Merilo i strogost
uhvati iz poslednjih ocena: `coach/ROUND-V4-HM-11.md`, `ROUND-V4-10K-04.md`, `ROUND-V4-MAR-02.md`, `ROUND-V4-5K-02.md`
(stanje `fb2c1a3`). NE čitaj `judge2/`.
1. KALIBRACIJA (kratko): `git worktree add /tmp/k16 fb2c1a3`; oceni Plan za HM p01, p04, p06 i 5K p06, p12 iz
   `/tmp/k16/docs/generators-v4/plans/` i uporedi sa ocenama u gornjim fajlovima. Razlika > 3 poena: zapiši zašto, NE
   štimuj unazad — navedi pomak svog merila na vrhu svakog izveštaja.
2. Redom HM → `coach/ROUND-V4-HM-12`, 10K → `ROUND-V4-10K-05`, MAR → `ROUND-V4-MAR-03`, 5K → `ROUND-V4-5K-03`
   (`.md` + `.json`). Tabela prethodna → sada po profilu; Plan / B (prilagođavanje) / C (personalizacija) / zbirna.
   Planove čitaj dan po dan, brojeve računaj sam. Scenariji dan po dan bar: povratak posle prekida (s05–s08, s15,
   s16, s25, s27 — R19 je promenio rampu: 5–10 dana 75/90 %/plan, 11–21 dan 60/75/90 %/plan), posle trke (s17–s20,
   s26), rezultat (s01–s04), „ništa" (s22). Posebno proveri: MAR najduži dugi po profilu (p11 22,6 km, p18 22 km,
   p13 19,2 km — da li je dovoljno), 10K plafon dugog (mali 1 h 30, spor 1 h 30 do 3 dana / 1 h 40 od 4), 5K p06.
   Najviše 8 ispravki po distanci, razdvojeno MOTOR / PODATAK. Push posle svake distance.

## B. Drugi sudija (NOV tab po distanci)
HM → `judge2/ROUND-V4-HM-12`, 10K → `judge2/ROUND-V4-10K-05`, MAR → `judge2/ROUND-V4-MAR-03`, 5K →
`judge2/ROUND-V4-5K-03`. Folder distance: `/tmp/r19/docs/generators-v4/plans/<HM|10K|MAR|5K>/`.
PAROVI — pravilo bez izuzetka: PRVO zapiši očekivanja samo iz ulaza koje ti daje spisak parova (imena fajlova /
opis profila), tek onda otvori fajlove para. Pre toga ne otvaraj ni zaglavlja planova para ni `pregled.md`. Isto za
scenarije: prvo šta bi ti uradio, pa plan. Ne čitaj `pregled.md`, `target-compare.md`, `nalazi-cuvara.txt`, ništa u
`judge2/` (ni ranije runde), ništa u `coach/` osim `JUDGE2-BRIEF.md`. Ako nešto od toga ipak vidiš, napiši na vrhu.

## Merilo
Trener Plan ≥ 80 po distanci, B i C ≥ 80; drugi sudija nijedan plan < 65.

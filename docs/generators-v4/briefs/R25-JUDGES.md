# R25 — ZAVRŠNA ocena posle R24 (stanje `b8ad0bb6`), 15. 11. 2026

Vlasnik: „da se privodi kraju". Ovo je poslednja ocena generatora pre ulaska u aplikaciju. Štedljivo: ocenjuje se samo
ono čiji se ispis promenio. Ocenjuješ ISKLJUČIVO stanje `b8ad0bb6`: `git fetch --unshallow origin claude/v4 || git
fetch origin claude/v4`, `git worktree add /tmp/r25 b8ad0bb6`; planovi iz `/tmp/r25/docs/generators-v4/plans/`. Izlaz
pišeš u glavnom stablu na `claude/v4` (svež klon kaže „diverged" — plitak klon; posle `--unshallow`
`git merge --ff-only origin/claude/v4`; pre push-a `git pull --rebase origin claude/v4` — na grani uporedo radi drugi
tab). Ništa osim svojih izlaznih fajlova ne menjaš. Završna poruka na session_id `session_01GnHHiXvCMLj5eDdp2ae77u`
(NE `@parent`), ≤ 30 redova. Vremena po Beogradu; brojeve ne izmišljaj.

## Merilo (odluka vlasnika 14. 11.) — `coach/RUBRIC-V4.md` § A3
Profil kome ulaz dozvoljava: Plan (stara skala) ≥ 80. Profil sa plafonom ulaza (HM p03, p10; MAR p03, p06, p08, p10,
p13, p18, p19; 5K p13, p14): „Plan za ulaz" ≥ 80, stara ocena ne pada. B ≥ 80, C ≥ 80. Drugi sudija: nijedan plan < 65.

## A. Trener (NOV tab, jedan za sve četiri distance)
Ista rubrika (`coach/RUBRIC-V4.md`, `SCENARIOS-V4.md`), razvrstavanje `coach/R21-RAZVRSTAVANJE.md` (ne menjaš ga).
Strogost uhvati iz R23: `coach/ROUND-V4-HM-14.md`, `-10K-07.md`, `-MAR-05.md`, `-5K-05.md` (stanje `e1136a16`).
NE čitaj `judge2/`. Šta je menjano i šta se očekivalo: `coach/R24-ISPRAVKA.md` (specifikacija prethodnog trenera) i
`reports/R24-MOTOR.md`; podatak: 5K `f8a2a5dc`, 10K `fb12606`, MAR `3efe27dd`.
1. KALIBRACIJA (kratko): `git worktree add /tmp/k23 e1136a16`; oceni Plan za HM p06, 10K p03, MAR p04, 5K p12 iz
   `/tmp/k23/...` i uporedi sa R23. Razlika > 3 poena: zapiši, NE štimuj unazad.
2. ŠTA SE OCENJUJE: sam odredi spisak — fajlovi u `docs/generators-v4/plans/` koji se razlikuju između `e1136a16` i
   `b8ad0bb6` (`git diff --stat e1136a16 b8ad0bb6 -- docs/generators-v4/plans/`). Samo te profile/scenarije/parove
   ocenjuješ ponovo; ostalima prenosiš ocenu R23 i to označiš. Ako se promenio neko koga `R24-ISPRAVKA.md` § (c) ne
   navodi — navedi ga poimence (to je moguća nenamerna izmena).
3. Redom HM → `coach/ROUND-V4-HM-15`, 10K → `-10K-08`, MAR → `-MAR-06`, 5K → `-5K-06` (`.md` ≤ 90 redova + `.json`).
   Po profilu: grupa, Plan R23 → sada, „Plan za ulaz" R23 → sada (samo plafon), prolazi/ne. B i C kao do sada. Planove
   čitaj dan po dan, brojeve računaj sam. Posebno proveri regresije R23: MAR s11/s12/s25 (propušteni dugi), 10K s15
   (posle bola), parovi P2 B, MAR p03/p13 (tekst naspram prognoze), MAR p04, nedelja posle pripremne trke (MAR p11,
   p02, p15), HM s27 i s16 (M5 NIJE urađen — očekuj da su iste); i novo: dan manje uz upozorenje (5K p02, p15; 10K
   p02; HM p06; MAR p06) — da li je upozorenje jasno i da li je plan sa danom manje bolji.
   § D Regresije (R23 dobro → sada lošije). § E: najviše 5 nalaza po distanci, samo ono što bi vlasnik morao da zna
   pre puštanja (bezbednost, besmislen trening, netačan tekst); NE piši novu listu ispravki za sledeći krug.
4. Završna poruka: po distanci prolaz po grupama (R23 → sada), Plan/B/C, ko ne prolazi sa ocenom, regresije, i jedna
   rečenica: da li bi ovo stanje pustio trkačima (da / da uz navedeno / ne, zašto).

## B. Drugi sudija (NOV tab, JEDAN za sve četiri distance) — ne vidi ciljne planove
Uputstvo: `docs/generators-v4/coach/JUDGE2-BRIEF.md` (jedino što čitaš o merilu). NE čitaj `coach/target/`, izveštaje
trenera (`coach/ROUND-*`), `coach/R24-ISPRAVKA.md`, `reports/`, `LOG.md` ni ranije `judge2/` izveštaje.
Oceni planove profila (ne scenarije i parove) koji se razlikuju između `21d4b070` i `b8ad0bb6`
(`git diff --stat 21d4b070 b8ad0bb6 -- docs/generators-v4/plans/`), sve četiri distance, iz `/tmp/r25/...`.
Izlaz: `judge2/ROUND-V4-HM-14`, `-10K-07`, `-MAR-05`, `-5K-05` (`.md` ≤ 60 redova + `.json`): ocena po planu, tri
najveće zamerke po planu ispod 75, i izričito spisak planova < 65 (ili „nema"). Push posle svake distance.
Završna poruka: po distanci broj ocenjenih, najniža ocena, svi planovi < 65 sa razlogom u jednoj rečenici.

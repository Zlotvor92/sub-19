# Primopredaja organizatora 2 (13. 11. 2026, ≈ 15:45) — privremeno na Opus

Vlasnik: Fable nedeljni limit je na 98 %. Do reseta organizator je OVAJ Opus tab; posle reseta vlasnik vraća ulogu
na Fable. Prethodni organizator: `session_01GnHHiaZ5S4B3XFjScT1iPv` (Fable) — NE šalji mu poruke (svako buđenje
troši Fable). Vlasnik razgovara direktno sa tobom.

## Pročitaj
1. `AGENTS.md` § „V4 generator — pravila". 2. Ovaj fajl. 3. `docs/generators-v4/LOG.md` — unosi od 13. 11. (ceo
dan; tu su sve odluke i greške). 4. `docs/generators-v4/HANDOFF.md` § 2, 3, 6 (kako vlasnik radi, granice, kako se
vode tabovi). Po potrebi `PLAN.md`.

## Vlasnik
Srpski, latinica, ekavica. Prvo odgovor u 1–2 rečenice, pa obrazloženje; kratko (čita sa telefona); bez uvoda i
pohvala; činjenice označi [visoka]/[srednja]/[niska]; „ne znam" kad nema podataka; vremena po Beogradu; grešku
reci u prvoj rečenici. Ne pitaj ono što možeš sam da odlučiš.

## Granice (bez izuzetka)
Ništa u `main`, bez deploya, bez izmene baze (samo SELECT), bez PR-a — bez izričite potvrde vlasnika. Push samo na
`claude/v4`. Tuđi podaci samo kao zbirne brojke; u repozitorijum samo podaci vlasnika i izmišljeni primeri. v2 se
ne dira. Trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; bez drugih oznaka modela.

## Modeli (nalog vlasnika)
Do reseta: SVE na Opusu (organizator, motor, podaci, trener, drugi sudija); Sonnet za mehaniku. Fable se ne otvara.
Opus tabova koliko treba. Fable trener `session_01GnHHiWk1PhzvzdGjhxZ5ob` se NE koristi i NE arhivira.

## Stanje (grana `claude/v4`)
- Motor `web/src/domain/v4/engine/`, forma `fitness/` (lična kriva forme po dužini, kalibrisana na Stravi vlasnika:
  `fitness/fixtures/owner-strava-2026.json`, izveštaj `reports/F4K-REPORT.md`), adapteri.
- Distance kao podatak: `distances/hm/` (krug 9), `tenk/` (krug 3), `fivek/` i `marathon/` (prva verzija, bez ocene).
- Poslednje ocene (Opus sudije, `coach/ROUND-V4-HM-09.md`, `ROUND-V4-10K-02.md`, `judge2/ROUND-V4-HM-09.md`,
  `ROUND-V4-10K-02.md`): HM trener Plan 78,5 / B 80,8 / C 83,7 / zbirna 80,2; drugi sudija 73,2. 10K trener Plan
  76,9 / zbirna 78,8; drugi sudija 68,6. Cilj: Plan ≥ 80 po distanci, B i C ≥ 80, drugi sudija bez plana < 65.
- Procena vlasnika: danas ≈ 1:42:09; Bokeški 13. 12. 1:40:22 – 1:41:56 – 1:43:40 [niska].

## Tabovi
- Motor (Opus) `session_01GnHHiWa47Guy3uDTKR2kE5` — RADI krug 10 (27 stavki; spisak u LOG-u od 14:50 nadalje i u
  porukama; izveštaj će biti `reports/R10-REPORT.md`). Najvažnije: stavka 1 (povratak posle prekida: geometrijski na
  prvobitan plan, nikad trajno niže — ispravka moje greške iz 9b).
- 10K `session_01GnHHiXivSsUTpEuBAFcJZi`, 5K `session_01GnHHiYgBWy4zCKtBd6YPxy`, maraton
  `session_01GnHHiWbwULZGywbJmwtnzH`, forma `session_01GnHHiYchQtH6mmwpQBMi1S`, trener (Opus)
  `session_01GnHHiXrqBkKYzMY76jQDiz` — završili, čekaju; koristi ih za sledeće krugove svoje distance.
- Satna provera je ISKLJUČENA. Tab koji stane na limitu niko ne gura — proveravaj `get_session` kad dugo ćuti.

## Sledeći koraci
1. Kad motor javi krug 10: `git pull`, `cd web && npx vitest run src/domain/v4 src/domain/isolation.test.ts`,
   `npm run typecheck`, kapije `npx vite-node ../docs/generators-v4/plans/gate.ts [--dist tenk|fivek|marathon]`.
   Brojeve iz taba ne prenosi vlasniku kao proverene dok ih sam ne pokreneš. Tab motora je jednom javio „typecheck
   čist" kad nije bio.
2. Ocena sve četiri distance na Opusu po `briefs/JUDGES-OPUS.md` (trener: postojeći Opus tab; drugi sudija: NOV tab
   po distanci, ne sme da vidi ranije ocene). Za 5K i maraton trener presuđuje i gde stoji provera forme.
3. Ispravke po distanci (tab te distance za podatke, tab motora za opšta pravila; zahtev za motor ide preko tebe).
   Jedan tab u jednom folderu u isto vreme.
4. Kad HM prođe: pregled vlasnika (trener predlaže HM s05, s08, vlasnik-v2; `docs/generators-v4/plans/HM/`).
5. Čeka vlasnika: 6 pitanja u `docs/generators-v4/F8-PREDLOG.md`; ulazak u aplikaciju (F9) samo uz potvrdu.

## Naučeno danas (ne ponavljaj)
- Svaka odluka o modelu forme ili ponovnom planiranju mora prvo na test nad SVIM profilima i scenarijima svih
  distanci; tri moje odluke su bile preširoke (zone po trajanju → prag brži od trke; prenos naviše bez dokaza;
  „ostatak plana srazmerno niži" posle bolesti).
- Posle `git pull` proveri da je prošao pre nego što nastaviš (preskočen upis `F7-COMMON.md` zbog pada pull-a).
- Tabovima traži JEDNU završnu poruku; dopune šalji sa `priority: next`.

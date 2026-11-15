# R14 — nov tab motora (Opus), nastavak krugova 12–13 (13. 11. 2026, organizator)

Prethodni tab motora (`session_01GnHHiWa47Guy3uDTKR2kE5`) je potrošio kontekst; ti ga nasleđuješ.

## Pročitaj (redom)
1. `AGENTS.md` § „V4 generator — pravila" (važi samo to; v2 se ne dira).
2. `docs/generators-v4/SPEC.md` (jezgro) — po potrebi, ciljano.
3. `briefs/R12.md` (spisak M1–M11 i podatak), `reports/R12-REPORT.md`, `reports/R13-REPORT.md` (šta je urađeno i
   predlozi), `reports/R12-10K.md`, `R12-MAR.md`, `R12-5K.md` (zahtevi tabova distanci = M12–M16, M20–M26).
4. Ocene: `coach/ROUND-V4-{HM-10,10K-03,MAR-01,5K-01}.md` (D, E) i `judge2/` iste runde — samo za razumevanje
   zamerki; ne menjaj ih.
5. `docs/generators-v4/F8-PREDLOG.md` § 9 (odluke vlasnika; M27 premeštanje dana).

## Urađeno (ne ponavljaj)
M1, M9, M14, M18 (determinizam ispravan; weeklyKmAt), deo M2 (najteža nedelja spuštena, keptPeak), deo M3 (dugi
3 dana posle trke), deo M17 (provera 5K čitana, smer tempa, rečenica po zoni), HM prag-p-2x ≥ 12 min.

## Redosled (obavezan; push posle svake stavke)
1. M17 ostatak + M7: dan trke ne vraća sporiji cilj kad je forma brža; prognoza i tempo trke ne brži od današnje
   forme kad upozorenje kaže da obim ne nosi trku (MAR p03/p06/p10/p13/p19); 5K s03 KNOWN (projekcija 4 s).
2. M2 ostatak + M21: model rampe po dužini pauze (povratna nedelja 60–70 %, druga 75–80 %), lagan ≥ 30 min uz dugi
   ≥ 90 min (≥ 45 min kod 5 dana / 55 km), prvi rast dugog ≤ +20 min; rampa vidi dodatu istoriju (5K p15);
   maraton čuva dugi ≥ 26 km kad je do trke ≥ 4 ned, posle puta referenca poslednji pravi dugi.
3. M20 + M12 ostatak: kvalitet ima prednost nad laganim danom na podu (5K p06, 10K p06); A1 ne vraća bodove u dugi;
   vrh ne u 3. od 8 nedelja.
4. M6 + M24: upozorenja — brojevi iz istorije, „vršna" = najveća (po opterećenju, M22), bez protivrečnosti, tačni
   predlozi; p16 savet po godinama, ne obim-za-nivo.
5. M10: trka na dan dugog (maraton pripremni polumaraton u N−9 je sada it.fails — skini).
6. M3 ostatak (MAR E5 ned 1–2 posle polumaratona dugi ≤ 60 %, nedelja ≤ 75 %; HM s18), M4 kao podatak
   `maxConsecutiveWithHard`, M23, M26 (dugi < lagan ne sme da postoji).
7. Podatak HM: p06 (−1 ≤ 70 %, trka ≤ 45 %, ned 6 kvalitet), p08 (ned 1 = 45 km), p08/p10 ned 15 bez +15 %, p12
   najveća doza tempa trke ne 14 dana pred trku.
8. Ako ostane vremena: M5, M8, M11, M13, M15, M16, M19, M25; zatim M27 (premeštanje dana kao ulaz, F8 § 9).

## Pravila
- Svaka izmena: testovi nad SVIM profilima i scenarijima SVIH distanci; promenjen otisak mora biti nameran i
  naveden. Ne vraćaj preširoka pravila (9b „ostatak srazmerno niži"; k10 „najteža nedelja briše se").
- Folderi: ti `engine/`, `fitness/`, `distances/hm/`, `distances/fivek/`; `tenk/` i `marathon/` samo kroz zahtev
  organizatoru (tabovi tih distanci), osim jedne linije podatka koju zahtev izričito traži.
- Provera pre svakog push-a: `cd web && npx vitest run src/domain/v4 src/domain/isolation.test.ts`,
  `npm run typecheck`, `npx vite-node ../docs/generators-v4/plans/gate.ts [--dist tenk|fivek|marathon]` (sve 0).
  Typecheck pokreni neposredno pre push-a. Posle poslednjeg push-a ispiši sve četiri distance.
- `git pull --rebase origin claude/v4` pre push-a; push samo na `claude/v4`; bez PR-a. Trailer
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`, bez drugih oznaka modela.
- Izveštaj `reports/R14-REPORT.md` ≤ 40 redova. Kad ti kontekst pređe ~70 %, završi tekuću stavku, push, izveštaj.
- Srpski, latinica, ekavica. Bez međuporuka. JEDNA završna poruka organizatoru na session_id
  `session_01GnHHiWPXbg8CKcY2ux7NvC` (NE @parent): dokle si stigao, brojevi provere, šta ostaje.

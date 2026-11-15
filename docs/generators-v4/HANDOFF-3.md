# Primopredaja organizatora 3 (13. 11. 2026, ≈ 22:35 po Beogradu) — nazad na Fable 5.2

Prethodni organizator (Opus): `session_01GnHHiWPXbg8CKcY2ux7NvC` — od sada mu NE šalji ništa.
Vlasnik je resetovao limit i vraća organizatora na Fable 5.2. Vlasnik razgovara direktno sa tobom.

## Pročitaj
1. `AGENTS.md` § „V4 generator — pravila". 2. Ovaj fajl. 3. `docs/generators-v4/LOG.md` od unosa „13. 11. 2026, 17:18"
nadalje (sve odluke i ocene ovog organizatora). 4. `HANDOFF-2.md` § Vlasnik, Granice, Naučeno. 5. `F8-PREDLOG.md` § 9
(odluke vlasnika o aplikaciji). Brief-ovi koji su u toku: `briefs/R18-MOTOR.md`, `R16-JUDGES.md`.

## NOVA PRAVILA VLASNIKA (13. 11., 22:35)
- **Organizator: Fable 5.2.** Kad ti kontekst pređe ~700 000 tokena: napiši `HANDOFF-<N+1>.md` (stanje, tabovi sa
  ID-jevima, šta je u toku, sledeći koraci), otvori NOV tab organizatora na `claude-fable-5-2` sa nalogom da ga
  pročita, i predaj titulu. Novi organizator obaveštava tabove o novom session_id. Tako se izbegava zatrpan kontekst.
- **Oba trenera (glavni trener i drugi sudija) su NOVI tabovi na `claude-fable-5-2`.** Za svaku ocenu otvaraš nov tab
  (drugi sudija i dalje po distanci, bez uvida u ranije ocene). Postojeći Opus trener
  (`session_01GnHHiXrqBkKYzMY76jQDiz`) se više ne koristi — arhiviraj ga.
- **Sve ostalo: Opus 5.5 (`claude-opus-5-5`), mehanika Sonnet 5.5 (`claude-sonnet-5-5`).**
- Tabove koji se ne koriste arhiviraj (vlasnik to traži).

## Odluke vlasnika danas (detalji u LOG-u i F8 § 9)
- Korisnik odobrava promene po PRIJAVLJENOM događaju (bolest, put, bol, umor); forma/tempa i mala usklađivanja se
  primenjuju sami (uz „zašto se promenilo").
- Puno odobrenje za sve izmene baze potrebne V4 — izvršenje tek pri ulasku u aplikaciju (F9).
- Strava: što više istorije (≥ 26 ned sažetak, 8 ned po km). Premeštanje dana = činjenica, generator preslaže
  nedelju (M27). Uvođenje sve odjednom, pa brisanje v2.
- Pregled vlasnika TEK NA KRAJU, samo planovi gde se sudije ne slažu (pravilo u LOG-u, unos 20:30).

## Stanje (grana `claude/v4`)
- Poslednja provera organizatora: `fb2c1a3` — 60 fajlova, 1001 + 23 očekivano; typecheck čist; kapije 4 × 0 [visoka].
  Posle toga: motor R17 (`a477b36`), 5K R17 (`e89f38b`), 10K R17 (`fd3dcf9`), maraton R17 (`6ba24eeb`) — po
  izveštajima kapije 0; NISAM sam proverio.
- Ocene R16 (stanje `fb2c1a3`): trener HM 78,3/83,4/83,7 → 80,9; 10K 77,7/82,4/83,0 → 80,2; MAR 77,2/81,0/80,5 →
  79,0; 5K 75,9/82,1/80,0 → 78,6. Drugi sudija planovi: HM 72,7 (p04 59), 10K 68,1 (P06 56), MAR 64,6 (p13 49),
  5K 62,1 (p06 45). Merilo: trener Plan ≥ 80, B i C ≥ 80; drugi sudija nijedan plan < 65.
- Tvoja procena vlasnika: HM očekivano 1:41:00 (SPEC § 12 a), Bokeški 13. 12.

## Tabovi (aktivni)
- **Motor R18 (Opus)** `session_01GnHHiWAUGx5TtBZpKGZEo7` — RADI po `briefs/R18-MOTOR.md` (13 stavki: smer tempa,
  prenos HM→10K, M5, tekstovi, MAR s17, povratak, bol, 5K p06, upozorenja, M22, HM podatak, test „ništa", M27) +
  dopune u porukama (10K p06 sužavanje, 10K p08 polazni dugi, minRunDaysByLevel, timeout hm/r9b, zaokruživanje
  koraka dugog MAR, talas ispod polaznog dugog). Tabovi motora pune kontekst za ~2 h — kad javi „pun kontekst",
  napiši R19-MOTOR.md sa urađenim/preostalim i otvori nov tab.
- **Maraton (Opus)** `session_01GnHHiWbwULZGywbJmwtnzH` — RADI dopunu R17 (pripremni polumaraton, početnici
  p13/p18, udeo dugog, upozorenja; plafon dugog za spor nivo 3 h 15 kad je trka > 4 h 30).
- **10K (Opus)** `session_01GnHHiXivSsUTpEuBAFcJZi`, **5K (Opus)** `session_01GnHHiYgBWy4zCKtBd6YPxy` — završili R17,
  čekaju. 10K tab ne čita judge2 (prvobitni nalog) — daj mu zamerke iz judge2 u poruci.
- Neaktivni, ne diraj: prethodni Fable organizator `session_01GnHHiaZ5S4B3XFjScT1iPv`; stari Fable trener
  `session_01GnHHiWk1PhzvzdGjhxZ5ob` (vlasnik ga je vratio iz arhive).

## Sledeći koraci
1. Odmah: `get_session` bez argumenta (tvoj ID); pošalji motoru, maratonu, 10K i 5K tabu: „Organizator je od sada
   sesija <ID>; završne poruke šalji na taj session_id". Arhiviraj Opus trenera.
2. Kad motor R18 i maraton završe: sam pokreni `cd web && npx vitest run src/domain/v4 src/domain/isolation.test.ts`,
   `npm run typecheck`, kapije `npx vite-node ../docs/generators-v4/plans/gate.ts [--dist tenk|fivek|marathon]`.
3. Ocena R19 sve četiri distance: NOV Fable trener (rubrika `coach/RUBRIC-V4.md`, isto merilo; prethodne ocene
   `coach/ROUND-V4-*-11/04/02/02`) + 4 NOVA Fable druga sudije (`coach/JUDGE2-BRIEF.md`, parovi: očekivanja PRE
   otvaranja). Šablon naloga: `briefs/R16-JUDGES.md`.
4. Ispravke po nalazima (motor / tab distance), dok Plan ≥ 80 i drugi sudija bez plana < 65.
5. Na kraju: filtrirani pregled vlasnika (neslaganje sudija), pa F9 ulazak u aplikaciju.

## Naučeno danas (ne ponavljaj)
- Tabovi motora pune kontekst brzo; brief mora da kaže „staješ tek preko ~700 000" i da ocene čita samo `grep`-om
  (jedan tab je stao na 32 % jer je „70 %" shvatio pogrešno).
- Šalji tabu dopune sa `priority: next`; tab koji je već poslao završnu poruku dopunu ne vidi dok ne dobije nov red
  — proveri da li je obradio.
- Široko pravilo motora skoro uvek pravi regresiju na drugoj distanci (k10 „briše najtežu nedelju", R15 „4 dana
  zaredom"): uvek test nad svim profilima i scenarijima svih distanci.
- Drugi sudije ponekad vide zaglavlja parova pre očekivanja — naglasi pravilo u svakom nalogu.

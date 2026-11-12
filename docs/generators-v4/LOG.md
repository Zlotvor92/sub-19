# V4 — dnevnik organizatora

Vremena po Beogradu. Novi unosi idu na dno. Pouzdanost: [visoka] izmereno/pročitano, [srednja] iz izveštaja taba,
[niska] procena.

## 12. 11. 2026.

### 09:40 — preuzeta uloga, provera alata
- Nov organizator (sesija na Fable 5.2) preuzeo ulogu po `HANDOFF.md`.
- Alati: otvaranje taba i poruke (claude-code-remote) rade; Supabase SELECT radi (projekat „Sub20"); GitHub konektor
  radi. [visoka]
- NE radi: Strava konektor (`needs_reconnect`). Posledica ispod (F0, tačka 4). Traži se od vlasnika.
- Grana `claude/v4` napravljena od `de5946f` (vrh radne grane).

### 09:42 — F0: šta je u bazi (samo SELECT, zbirno) [visoka]
1. Sve stanje korisnika je jedan JSON: `user_state.data` (31 korisnik). Ključevi: `genPlan` (plan), `log` (urađeno,
   po ID-ju dana `n<nedelja>d<dan>`), `alts` (ručne izmene dana), `moves` (pomereni dani → datum), `vanPlana`
   (datum → km), `wellness` (datum → HRV, puls u miru, san, CTL/ATL), `knee`, `kg`, `strava`/`icu` (veza), `ui`.
   Nema posebnih tabela za planove ni za aktivnosti. `user_state_istorija` čuva 74 ranija snimka.
2. Planovi: 22 korisnika imaju `genPlan`, 9 nema (među njima vlasnik — njegov lični plan je ugrađen u kod, ne u bazi).
   - v2: 3 plana (2 × `10k-v2.10.0`, 1 × `hm-v2.8.0`). Oblik: `meta` (policyId, policyVersion, vdot, goalSec,
     raceDate, runDays, start…), `weeks[] {w, start, phase, focus, deload, taper?, days[]}`,
     dan `{id, dow, rest, tag, km, desc, structure}`, uz `tenKV2`/`hmV2`, `pred`, `qs`.
   - stari format: 19 planova u dve podvrste (bez `athlete`/`preparation` — 9; sa njima — 10; jedan ima i
     `planRevisions`, `goalChange`). Nedelja nema `phase`; dan `{id, dow, rest, tag, km|null, desc, session?,
     strides?, runWalk?, finish?, mlr?}`.
   - po distanci (svi formati): 10K 10, 5K 6, HM 3, maraton 3. Trke u budućnosti: 18 od 22.
3. Urađeni treninzi: ukupno 25 unosa kod 5 korisnika; bez vlasnika — 10 unosa kod 4 korisnika, bez pulsa po km.
   Ručne izmene (`alts`) ima 5 korisnika, pomeranja (`moves`) 2. Strava je povezana kod 4 korisnika.
4. Strava/intervals aktivnosti se u bazi čuvaju SAMO kad su vezane za dan plana (unos u `log`): km, trajanje, puls,
   maks. puls, po km `{paceSec, hr, gapSec, stopSec, cadence}`, krugovi sa oznakom rad/oporavak (intervals), zone,
   temperatura, uspon, „decoupling". Trčanja van plana: samo datum → km. Istorija pre plana se ne čuva.
   Vlasnik: 15 unosa od 27. 9. 2026. (9 sa tempom i pulsom po km), 3 van plana, 152 dana jutarnjih merenja
   (11. 6 – 9. 11), polumaraton u Nišu 3. 10. 2026: 1:42:01 (krugovi po km sa pulsom).

### 09:43 — zaključci F0 i odluke organizatora
- O1. „12 nedelja aktivnosti 3–4 korisnika" iz PLAN § F0 NE POSTOJI u bazi. Procena forme (F4) se razvija i
  proverava na: (a) podacima vlasnika, (b) izmišljenim nizovima sa poznatim odgovorom. Punu Strava istoriju
  vlasnika mogu da čitam tek kad vlasnik ponovo poveže Strava konektor — do tada F4 radi sa (b) i sa 15 unosa.
- O2. SPEC mora da uzme u obzir: ulaz procene forme je spisak trčanja (datum, km, trajanje, opciono puls, po km,
  krugovi) BEZ obzira da li je vezano za dan plana; aplikacija danas čuva pun zapis samo za dan plana — to je
  praznina koju F8/F9 moraju da zatvore (čuvati sažetak svake aktivnosti), inače forma iz trčanja nema ulaz.
- O3. Uzorci za adaptere: ne iznosim tuđe planove. Stari format — postojeće zamrznute fiksture
  `web/src/test/legacyPlans.ts`; v2 — planovi izmišljenih profila snimljeni jednom iz zamrznutog v2 generatora
  (plan kao podatak); lični plan — iz `web/src/domain/personal/`. Ključevi iz tačke 2 su spisak polja koji adapter
  mora da pokrije (uklj. `alts`, `moves`, `log`, `vanPlana`).
- O4. Stanje korisnika za preuzimanje = plan + `log` + `alts` + `moves` + `vanPlana`; adapter čita sve to, ne samo
  `genPlan`.

### 09:45 — pokrenuto
- Tabovi (satna provera ih čita odavde):
  - F1 SPEC — `session_01GnHHiZsCpXuJKp2fG6qCB1` (Fable), brief `briefs/F1-SPEC.md`. Stanje: radi.
  - F6 merilo — trener `session_01GnHHiWk1PhzvzdGjhxZ5ob` (Fable): RUBRIC-V4, SCENARIOS-V4, JUDGE2-BRIEF, pa ciljni
    planovi 10K; piše u `docs/generators-v4/coach/`. Stanje: radi.
- Satna provera: `trig_01YSecBGzp1ugHwXhLb7ugBu` (svakog sata u :43), gura tabove zastale na petočasovnom limitu;
  nedeljni limit → stajem i javljam vlasniku.
- CI: `web/scripts/ciScope.mjs` — folder `web/src/domain/v4/` odlučuje graf uvoza (ne „sve"); test dodat
  (`ciScope.node.test.ts`, 30/30 zeleno). Razlog: bez toga svaki push V4 koda pokreće pun CI u 10 delova. Ovaj push
  sam dira `web/scripts/` → jedan pun CI run, očekivano.

### 09:50 — F6 stavke 1–3 stigle (trener, `c90eff1b`) [srednja — nisam još ocenio sadržaj]
- `coach/RUBRIC-V4.md`, `SCENARIOS-V4.md`, `JUDGE2-BRIEF.md` preuzeti na `claude/v4`. Trenerov tab sme da gura samo
  na staru radnu granu (podešavanje sesije); odluka: ne tražim izuzetak, ja prenosim `docs/generators-v4/coach/`
  na `claude/v4` posle svake njegove isporuke.
- Obavezne provere K1–K8 (prognoza bez napretka, brzo u 3 dana posle trke, predlog bez „šta/koliko/šta se dobija",
  gramatika brojeva, aritmetika, > 25 % brzog rada, skok, prazan trening): K1–K5 idu u mašinske testove V4.
- Zahtevi trenera prema V4: ispis plana pre/posle događaja za 24 scenarija sa objašnjenjem; oblik istorije trkača;
  ispis nosi današnju prognozu i prognozu na dan trke sa rasponom. → ulazi u brief F2/F3.

### 09:52 — F6 stavka 4: ciljni planovi 10K (trener, `049ef13f`) [srednja]
- `coach/target/10K/` (p01, p03, p06, p11 + README sa pravilima za šablone 10K) preuzeto na `claude/v4`.
- Trener je slobodan → sledeći zadatak: ciljni planovi 5K i maraton (po 4 profila), da F7 ne čeka.

### 09:55 — ciljni planovi 5K i maraton (trener, `87ec9492`) [srednja]
- `coach/target/5K/` i `coach/target/MAR/` (po 4 plana + README sa brojevima za šablone) preuzeto na `claude/v4`.
  Ciljni planovi sada postoje za sve četiri distance (HM od ranije u `docs/generators-v2/perfection/target/HM`).
- Trener čeka ispise HM V4. Napomena: planovi su prerađeni planovi „Cilj 80" od 11. 11, obim po danima je procena.

### 10:05 — KAPIJA F1 PROŠLA (SPEC `54b0e17`, 570 redova; pročitao ceo) [visoka da pokriva zahteve; brojevi niska–srednja]
- Pokriva: PlanDoc isti oblik za generisan/ručni/preuzet; planiranje iz stanja; jedna mera (min × težina 1/1,5/2/3),
  baza/umor 42/7; povratak kao jedna rampa iz činjenica (posle HM 1:41 → 15 dana, prvi kvalitet 11. dan); stabilnost
  po konstrukciji; forma iz trčanja sa histerezom tempa; čuvar samo prijavljuje; adapteri sa otiskom; distanca kao
  podatak; 4 prošetana primera sa brojevima.
- Dopune organizatora (SPEC § 14): (1) ništa brzo u prva 3 dana posle trke/testa bez obzira na trajanje (SPEC je za
  5 km i test 3 km dozvoljavao kvalitet 2–3. dana — sudar sa K2); (2) ispis za čoveka `renderPlan` u motoru, sa
  množinom i datumima, nad njim mašinske provere K1–K5; (3) plafon napretka je previše oprezan (1:41:00 → 1:40:00
  za 10 nedelja) — F4 kalibriše naviše; (4) `vdot.ts`/`constants.ts` prvi commit motora da F4 ne čeka.
- Rizik koji pratim: merenje u bodovima daje manje km nego što trkač navodi (nedelja 1: 28,4 od 30 km) — rešava se
  podacima šablona u F3, proveravam na ispisu.
- Sledeće: F2 motor (Fable), brief `briefs/F2-ENGINE.md`. F4 forma kreće čim motor gurne `vdot.ts`; F3 kad `plan` +
  `renderPlan` rade nad sintetičkom distancom; F5 posle F2.
- Tabovi 10:05: F1 `session_01GnHHiZsCpXuJKp2fG6qCB1` — ZAVRŠEN (sve gurnuto, ne gurati dalje). F2 motor —
  `session_01GnHHiZ6y2YtRdf4VfVddBC` (Fable), radi. Trener — piše `coach/SPEC-REVIEW.md` (rampa povratka, blok posle
  bolesti, plafon napretka, težine) i parove personalizacije u obliku SPEC § 2.

### 10:10 — presuda trenera o SPEC-u (`233d5090`, `coach/SPEC-REVIEW.md`) → SPEC § 14.6
- Prihvaćeno: rampa po razlogu pauze (bolest 2,0 × dani, put 1,0, nepoznato 1,5; do 28 dana); dugi u rampi ≤ 75 %
  poslednjeg; posle pauze ≥ 7 dana blok u dugom tek posle jednog dugog bez bloka; stroži uslov za izveden umor;
  viši plafon napretka kao polazna vrednost za F4; opciona polja istorije (datum rezultata, godište, ranije tegobe).
- Odbijeno za sada: nelinearna težina dugog (druga skala u jedinoj meri) — ponovo kod maratona.
- Motoru poslata dopuna (poruka u toku rada).

### 10:15 — motor gurnuo `vdot.ts`/`constants.ts` (`5c7e09e`) → pokrenut F4 (forma, Opus)
- Uzorak vlasnika `web/src/domain/v4/fitness/fixtures/owner-2026-autumn.json`: u bazi je samo 8 trčanja sa tempom i
  pulsom (27. 9 – 6. 11); posle polumaratona 3. 10. svega 5 trčanja (4–8 km). [visoka]
- Tabovi 10:16: F4 forma — `session_01GnHHiYchQtH6mmwpQBMi1S` (Opus), radi. Brief F3 (`briefs/F3-HM.md`) spreman;
  tab se otvara kad motor javi da `plan` + `renderPlan` rade.

### 10:28 — F4 forma gotova (`fc0d892`); provereno: 34 testa V4 zelena za 0,6 s (pokrenuo sam) [visoka]
- Plafon napretka: trenerovi brojevi, udeo očekivanog 0,65. Izvor za % napretka rekreativaca nije nađen → brojevi
  ostaju [niska–srednja], ne izmišljaju se.
- Vlasnik: Niš 1:42:01 = VDOT 44,09; korekcija samo za negativan split (+0,67) → 44,76 (≈ 1:40:42); toplota se ne
  preračunava (nema proverenog koeficijenta). Raspon HM 13. 12: 1:39:39 – 1:40:20 – 1:41:11; HM 17. 4. 2027:
  1:36:41 – 1:38:21 – 1:41:11 uz obim +30 %. [niska — 8 trčanja]
- PRAZNINA koju sam uočio (nije u SPEC-u): procena ne spušta formu kad obim padne bez prekida ≥ 14 dana. Vlasnik
  je po bazi od 3. 10. trčao 5 puta (4–8 km) — model i dalje kaže 1:40:42 „danas". Treba signal „pad baze"
  (npr. hronično opterećenje ispod X % onog pre 6 nedelja → forma opada). Ide u drugi krug F4 posle F2, uz Strava
  istoriju ako konektor proradi (da se ne kalibriše na nepotpunim podacima).
- Zahtevi F4 prema tipovima (`Run.planned`, `Run.tempC`, izvedene pauze, ubrizgan `EstimateFormFn`) poslati motoru.
- F4 tab `session_01GnHHiYchQtH6mmwpQBMi1S`: ZAVRŠEN.

### 10:30 — motor: `plan` + `renderPlan` rade (`c2ee685`) → pokrenut F3 (HM podaci, Opus) `session_01GnHHiamNMpKXMSuJ6DLNNH`

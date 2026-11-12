# Brief F1 — specifikacija jezgra V4 (Fable 5.2)

Ti si tab koji piše SPECIFIKACIJU JEZGRA novog generatora planova trčanja (V4) za aplikaciju „Sub-20". Ne pišeš
motor — pišeš ugovor po kome će ga drugi tab napisati, i tipove. Organizator čita tvoj SPEC kao kapiju pre motora.

## Zašto
Stari generatori (v2, v3) prave plan od nule iz jednog unetog rezultata. Vlasnik je na v3 planu video: prognoza
1:41 → 1:41 kroz 18 nedelja (nema napretka); prva nedelja dan posle trke ima brze deonice; sa malim obimom nema
jasnog predloga šta treba. V4 to rešava arhitekturom: plan je podatak, planira se iz STANJA trkača, forma se čita
iz trčanja, distanca je podatak, adaptacija je ponovno planiranje.

## Pročitaj (ovim redom, i samo ovo)
1. `AGENTS.md` — SAMO odeljak „V4 generator — pravila" (tačke 1–12, 9a). To je zakon.
2. `docs/generators-v4/PLAN.md` § 2–4 i `docs/generators-v4/LOG.md` (nalazi iz baze: šta aplikacija stvarno čuva).
3. Referenca znanja (ne kod koji se nastavlja): `git worktree add /tmp/v3 origin/claude/v3-hm`, pa
   `web/src/domain/generators/halfMarathon/v3/` (templates, sessions, scale, guard, paces, types) i
   `docs/generators-v2/perfection/P9v3/reports/V3-HM-REPORT.md`. Gledaj ŠTA šablon i trening moraju da izraze.
4. `docs/generators-v2/perfection/coach/ROUND-V3-HM-03.md` — šta trener traži (deo 2: prilagođavanje,
   personalizacija).
5. Oblik postojećih planova samo koliko treba za `PlanDoc`: `web/src/domain/plan/types.ts`,
   `web/src/domain/personal/index.ts` (lični plan vlasnika), `web/src/test/legacyPlans.ts` (zaglavlje i jedan plan).
NE čitaj: v2 generatore (`generators/*/v2/`), `PROGRAM.md`, stare testove. Ništa se iz v2 ne prenosi.

## Isporuka
A. `docs/generators-v4/SPEC.md` (ciljno 400–700 redova, srpski, latinica), sa odeljcima:
 1. `PlanDoc` (verzionisan): plan → nedelje → dani → trening (struktura koraka: zagrevanje/rad/oporavak/hlađenje,
    cilj kao tempo-zona ili napor, trajanje ili dužina). Isti oblik za generisan, ručno unet i preuzet plan. Šta je
    poreklo dana (iz šablona / ručno / urađeno / zaključano) i kako se čuva namera (faza, uloga, podražaj).
    Zaglavlje: upozorenja (AGENTS t. 6: problem + značenje + konkretan predlog), forma (polazna, trenutna, raspon).
 2. `RunnerState`: sve što motor sme da zna o trkaču DANAS — odrađena trčanja (datum, km, trajanje, opciono puls,
    po km, krugovi; vezana za dan plana ili ne), obim po nedeljama, najduža trčanja, forma i njena pouzdanost,
    umor/svežina, dostupni dani, zaključano, ručne izmene, poslednja trka. Šta je obavezno, a šta opciono; ponašanje
    kad opcionog nema (nov korisnik bez ijednog trčanja mora da dobije plan).
 3. `Event`: rezultat trke/testa, propušten trening, pauza (bolest/put), bol, umor, ručna izmena, promena cilja ili
    datuma, „ništa". Za svaki: šta menja u stanju.
 4. `Template` (namera nedelje: faza, opterećenje kao % vrha, uloga dugog, vrste podražaja) i `Workout` (unos
    biblioteke: oznake, zahtevi — min. forma/obim/faza, doza koja se skalira, tekst). Pravilo izbora treninga po
    oznakama — determinističko, bez nasumičnosti; napredovanje kroz nedelje (isti podražaj raste).
 5. JEDNA mera opterećenja (minuti × težina intenziteta) — tačna formula i tabela težina po zoni; model forme/umora
    (dve eksponencijalne sredine ili jednostavnije — obrazloži); kako se iz opterećenja izvode km.
 6. Ugovor `plan(state, goal, distanceData) → PlanDoc` i `replan(doc, state, events) → {doc, changes[]}`:
    čista funkcija; determinizam; stabilnost (bez događaja → bajt-isti plan); prošlost, urađeno, zaključano i ručno
    se ne diraju; menja se samo od sutra; koliko daleko unapred sme promena posle kog događaja (najmanja dovoljna).
    Povratak posle trke i pauze izlazi iz stanja (umor, dani od trke), ne iz posebnog pravila po distanci.
 7. Forma iz trčanja (ugovor za `fitness/`, AGENTS 9a): ulazi, izlaz (polazna, trenutna procena, pouzdanost, raspon
    na dan trke, objašnjenje), pravila opreza (ne skače na jedan trening), puls samo kao višenedeljni trend na
    ravnomernim laganim; radi bez pulsa; plafon napretka zavisi od trkača (obim, staž, raniji napredak) — predloži
    konkretan model i brojeve sa obrazloženjem i pouzdanošću; kako tempa u planu prate procenu bez „šetanja".
 8. Čuvar: spisak provera (samo prijavljuje), šta je neispravan unos (jedino što se odbija), oblik upozorenja.
 9. Preuzimanje (AGENTS t. 8): ugovor adaptera `stari plan + log + izmene + pomeranja → PlanDoc + RunnerState`,
    otisak pre = posle, preostale nedelje kao šablon, lični plan vlasnika se nikad ne prepravlja sam.
10. Format objašnjenja promene („zašto se plan promenio"): struktura + 3 primera rečenica.
11. Distanca kao podatak: tačan spisak onoga što folder distance sadrži (šabloni po dužini pripreme i nivou,
    biblioteka, brojevi bezbednosti, tekstovi) i dokaz da motoru ne treba grananje po distanci (uklj. maraton:
    dugi, ishrana; 5K: brzina).
12. Tri prošetana primera sa brojevima: (a) nov plan HM, 30 km/ned, 4 dana, 10 nedelja, forma 1:41; (b) ponovno
    planiranje posle 7 dana bolesti u 5. nedelji; (c) preuzet plan starog formata u 3. nedelji sa dve ručne izmene
    i jednim propuštenim treningom, bez događaja → nula promena. Plus (d) plan koji počinje dan posle polumaratona.
13. Otvorena pitanja i odluke koje si doneo (svaka: šta, zašto, pouzdanost). Šta svesno NIJE u prvoj verziji.
B. Tipovi: `web/src/domain/v4/engine/types.ts` (samo tipovi i konstante verzije, bez logike; strogi TS, bez `any`;
   nula uvoza van `web/src/domain/v4/`). Mora da prođe `npx tsc --noEmit -p .` iz `web/` (ili ekvivalent iz
   `npm run check`).
C. Izveštaj `docs/generators-v4/reports/F1-REPORT.md` (≤ 80 redova): šta je odlučeno, najveći rizici, šta tab motora
   mora prvo da uradi.

## Merila kvaliteta SPEC-a
- Tab motora može da implementira bez ijednog pitanja; svaka formula ima brojeve i jedinicu.
- U `engine/` nema imena distance ni grananja po njoj; sve što se razlikuje je podatak.
- Jedno mesto odluke za svaku veličinu (obim, doza, dugi). Bez petlji „skrati pa dopuni".
- Jednostavnije je bolje: ako dve varijante rade, biraj onu sa manje pojmova. Model koji ne možeš da objasniš
  trkaču u dve rečenice je previše složen.
- Trenerske brojke (težine zona, plafon napretka, rast obima) označi pouzdanošću; ne izmišljaj izvore.

## Granice
- Grana `claude/v4` (već postoji; `git pull` pre rada). Push samo na `claude/v4`. Bez PR-a, ništa u `main`, bez
  deploya, baza se ne dira (nemaš ni potrebu da je čitaš — nalazi su u LOG-u).
- Pišeš samo: `docs/generators-v4/SPEC.md`, `docs/generators-v4/reports/F1-REPORT.md`,
  `web/src/domain/v4/engine/types.ts`. Ništa drugo ne menjaš (ni CI, ni stare testove, ni aplikaciju).
- Nikad push sa crvenom proverom tipova. Sudar ili nejasnoća → najmanja odluka u okviru AGENTS pravila + zapis u
  § 13; ne staješ i ne čekaš odgovor. Ako alat traži dozvolu ili ga nema — ne čekaj, zaobiđi u okviru granica.
- Commit trailer: `Co-Authored-By: Claude Fable 5.2 <noreply@anthropic.com>`; bez drugih oznaka modela.
- Vremena po Beogradu. Jezik dokumenata: srpski, latinica, ekavica.

## Na kraju
Gurni sve, pa pošalji organizatoru poruku (`mcp__claude-code-remote__send_message`, `session_id` = `@parent`):
SHA, broj redova SPEC-a, 5 najvažnijih odluka, 3 najveća rizika, šta ti je bilo nejasno.

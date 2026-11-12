# Primopredaja uloge organizatora (12. 11. 2026)

Vlasnik je naložio: prethodni organizator (sesija `session_01GnHHiXE3NeQzLDcD3vaM5E`) predaje CELU ulogu novom tabu na
Fable 5.2. Ti si od sada organizator. Imaš puna ovlašćenja da otvaraš tabove, donosiš tehničke i trenerske odluke i
dovedeš V4 generator do kraja. Vlasnik razgovara direktno sa tobom u tvom tabu.

## 1. Šta prvo da pročitaš (ovim redom)

1. `AGENTS.md` — odeljak „V4 generator — pravila" (jedino što važi za V4; pravila iznad i ispod važe za zamrznuti v2).
2. `docs/generators-v4/PLAN.md` — plan rada: cilj, mere, folderi, faze F0–F9 sa kapijama, raspored dana 1, rizici,
   odluke vlasnika (§ 8).
3. Ovaj fajl.
4. Po potrebi: `docs/generators-v2/perfection/PROGRAM.md` (dnevnik svega do sada — dugačak; čitaj samo kraj, od
   „Cilj 80"), `docs/generators-v2/perfection/target/GAP.md`, `coach/ROUND-V3-HM-01…03.md`.

## 2. Vlasnik — kako radi i šta traži

- Jezik: srpski, latinica, ekavica. Prvo odgovor u 1–2 rečenice, pa obrazloženje. Bez uvoda, ljubaznosti, pohvala i
  rezimea. Činjenice označi [visoka]/[srednja]/[niska]; odvoj činjenice od tumačenja; „ne znam" kad nema podataka;
  ne izmišljaj brojeve. Ako greši ili je premisa netačna — reci u prvoj rečenici. Vremena po Beogradu.
- Čita sa telefona, kratko. Ne pitaj ga ništa što možeš sam da odlučiš; pitaj samo kad bi pogrešna pretpostavka
  značila rad ispočetka ili kad je odluka o proizvodu/produkciji njegova.
- „Radi, ne staj": ne ostavljaj da nešto stoji. Kad tab stane na limitu — gurni ga. Javljaj kratko šta se desilo.
- Bez štednje tokena od 12. 11. (dobio pun reset). Kad udari NEDELJNI limit — stani i javi mu da uradi reset.
- Kad promeni smer, primeni ODMAH (prekini tab, pošalji novu poruku). Jednom je uhvatio tab koji je radio po starom
  nalogu jer je moja izmena čekala u redu — to ne sme da se ponovi.

## 3. Granice koje važe bez izuzetka

- Ništa u `main`, bez deploya, bez izmene baze, bez PR-a — bez izričite potvrde vlasnika. Baza: samo SELECT.
- Tuđi podaci (planovi i Strava aktivnosti drugih korisnika): smeš da čitaš; u repozitorijum idu SAMO podaci vlasnika
  i izmišljeni primeri; tuđi samo kao zbirne brojke. Ne šalji lične podatke spoljnim servisima.
- v2 je bataljen: ne dorađuj ga, ne spajaj, ne prenosi ništa iz njega (osim čitanja starih PLANOVA kao podataka).
- Lični plan vlasnika (zamrznut HM v1, `meta.licni`) i v2 u produkciji rade dok ih V4 ne zameni. Vlasnik trči
  Bokeški polumaraton 13. 12. 2026; Beogradski polumaraton je 17. 4. 2027 (maraton 18. 4.) [srednja, pretraga].
- Commit trailer: `Co-Authored-By: <model taba> <noreply@anthropic.com>`; bez drugih oznaka modela u commit-ima.

## 4. Stanje na kraju 11. 11.

- Radna grana `claude/generator-isolation-5k-10k-hm-marathon`: zamrznuti v2 (5k-v2.17.0, 10k-v2.16.0, hm-v2.15.0,
  marathon-v2.15.0; ocena trenera 60,6) + sva dokumentacija. Ne spaja se nikud. Sa nje praviš `claude/v4`.
- Grana `claude/v3-hm` (`82941da`): HM v3 — nov generator na šablonima, `web/src/domain/generators/halfMarathon/v3/`
  (≈ 1,9 hilj. redova, 8 fajlova: build, dates, guard, layout, paces, scale, sessions, templates, text, types), test
  `web/src/domain/generators/halfMarathonV3.node.test.ts`, ispis `docs/generators-v2/perfection/P9v3/plans/HM/`,
  izveštaj `…/reports/V3-HM-REPORT.md`. Ocena trenera 77,6 (stari 62,7); 7/12 profila na ≥ 80; ostalih 5 na plafonu
  ulaza (71–75). Ovo je polazna REFERENCA ZNANJA za V4 (šabloni, brojevi, tekstovi), ne kod koji se nastavlja.
- Grana `claude/v3-pilot-hm`: napušten pokušaj, ne koristiti.
- Glavni trener: `session_01GnHHiWk1PhzvzdGjhxZ5ob` (Fable; NE arhiviraj). Zna rubriku, sve krugove, pisao ciljne
  planove. Obraćaš mu se `send_message`; odgovor stiže kao poruka. Piše u `docs/generators-v2/perfection/coach/` na
  radnoj grani — od sada neka piše u `docs/generators-v4/coach/` na `claude/v4`.
- Satni zadatak `trig_01CFHbUaiL3BoxeKtCU6Jj6f` je isključen i vezan za staru sesiju — napravi svoj.

## 5. Šta je vlasnik sam primetio na v3 (mora da bude rešeno u V4)

Napravio sam mu dva plana (HM, 1:41:00, 30 km/ned, 4 dana: 10 nedelja; i 18 nedelja od Bokeškog do Beogradskog):
1. Prognoza 1:41 → 1:41 kroz 18 nedelja: generator ne predviđa napredak (pravilo 0,1 VDOT/ned, najviše 2, koristi se
   samo za proveru unetog cilja; dalo bi 1:37:37). Vlasnik misli da je i to premalo. → forma iz trčanja, raspon na dan
   trke, plafon napretka po trkaču (AGENTS 9a).
2. Prva nedelja dan posle trke ima brze deonice → planiranje iz stanja.
3. Sa 30 km/ned i 10 nedelja najduži dugi 14,5 km — plan to kaže, ali vlasnik očekuje jasan predlog šta treba.
4. Rečenica „u 1 nedelja jedan lagan dan otpada" (gramatika brojeva).
Kako sam pravio plan: `git worktree add <scratch>/v3 origin/claude/v3-hm`, mali `.ts` fajl koji uvozi
`generate`, `renderText` iz `…/halfMarathon/v3/index.ts`, `node fajl.ts` (Node sam skida tipove).

## 6. Kako vodiš tabove (naučeno na teži način)

- Alati: `mcp__claude-code-remote__create_session` (source_url repo, source_revision, outcome_branch, model, title,
  tags, permission_mode auto, prompt), `send_message`, `get_session`, `interrupt_session`, `archive_session`,
  `list_sessions`, `create_trigger`/`update_trigger`. PRVO PROVERI da ih imaš; ako ti neki fali (npr. ne možeš da
  otvoriš tab ili nemaš Supabase/GitHub konektor) — odmah javi vlasniku šta tačno fali, ne zaobilazi.
- Modeli: `claude-fable-5-2` za jezgro motora, model stanja/opterećenja, specifikaciju, trenerski sud i drugog
  sudiju; `claude-opus-5-5` za sve ostalo (podaci distanci, adapteri, forma po specifikaciji, testovi, ispisi);
  `claude-sonnet-5-5` samo za čisto mehanički posao bez odluka. Okvirna cena taba: Sonnet ≈ 1 USD, Opus 5–25,
  Fable 20–50.
- Brief: cilj i zašto, tačno šta da pročita (i šta NE), granice (grana, folder, šta ne dira), isporuka (fajlovi,
  testovi, izveštaj ≤ 80 redova), „nikad push sa crvenim testovima", „sudar ili nejasnoća → najmanja odluka u okviru
  specifikacije + zapis, ne staj", poruka tebi na kraju (`send_message`, session_id `@parent`), „ako alat traži
  dozvolu ili ga nema, ne čekaj". Uzak, precizan brief daje najbolje rezultate; širok brief se razlije.
- Poruka poslata tabu koji radi ČEKA kraj njegovog koraka. Promena smera = `interrupt_session` (poništava i poruke u
  redu) pa JEDNA nova poruka koja zamenjuje sve prethodne.
- Tab koji stane na limitu se NE nastavlja sam: `get_session` → `rate_limit_info` (five_hour: posle reseta pošalji
  „nastavi tamo gde si stao i završi"; seven_day rejected: stani i javi vlasniku). Satni zadatak to radi umesto tebe.
- Pre arhiviranja proveri da je SVE gurnuto (jednom je izgubljen nedovršen rad koji je bio samo u tabovom stash-u).
- Ne zovi `list_events` bez `kinds` (ogroman izlaz). Status čitaj iz `get_session` (`task_summary`,
  `post_turn_summary`).
- Svaki izveštaj proveri sam: `git pull`, pokreni brze testove tog dela, pročitaj izveštaj; brojevi iz taba su
  [srednja] dok ih ne potvrdiš. Odluke upisuj u `docs/generators-v4/LOG.md` sa vremenom.
- Najviše 3–4 taba uporedo (petočasovni limit). Po folderu jedan tab u jednom trenutku; motor menja samo tab motora.
- CI: `web/scripts/ciScope.mjs` tretira domen van `generators/<D>/v2/` kao „sve" (pun CI u 10 delova) — za V4 folder
  to znači pun CI na svaki push. Smeš da prilagodiš ciScope za `web/src/domain/v4/` (to je test infrastruktura;
  odluka je tvoja). Postojeći test `scripts/ciScope.node.test.ts` traži da su svi testovi u `halfMarathon/` vezani
  za v2 — V4 testove drži van starih foldera distanci.
- Kontejner može da se restartuje i prekine pozadinske komande — duge provere pokreći ponovo, ne čekaj u nedogled.

## 7. Merilo i njegova slabost

- Ocena: trener istom rubrikom (ROUND fajlovi). Slabost: isti AI sudija je pisao ciljne planove, po njima je pravljen
  v3, i on ocenjuje. Zato u V4: drugi nezavisan sudija (ne vidi ciljne planove ni ocene prvog) + kratak pregled
  vlasnika (2–3 plana po distanci, najviše 5 redova šta da pogleda). Vlasnik je uhvatio ono što sudija nije.
- Trener o „90+": ocena samog plana staje na 80–84; do ≈ 92 vode podaci o trkaču (+4–5), prilagođavanje (+4–5),
  generator (+2–3), sadržaj oko trčanja (+1–2), usmeravanje unosa (+5–10 za profile na plafonu ulaza). Nova rubrika:
  Plan 50 % + Prilagođavanje 30 % + Personalizacija 20 % (`coach/ROUND-V3-HM-03.md`, deo 2).
- Automatska skripta `docs/generators-v2/perfection/score/score.ts`: Spearman 0,40 prema treneru — samo detektor
  regresija, ne zamena za sudiju.

## 8. Tvoj prvi dan

Radi po `PLAN.md` § 4–5: F0 sam (grana `claude/v4`, baza SELECT, uzorci, `LOG.md`), zatim F1 specifikacija jezgra
(Fable tab) uz F6 kod trenera, kapija F1 (ti čitaš SPEC), F2 motor (Fable), od sredine F2 F3 i F4 (Opus), F5 adapteri,
na kraju dana ocena HM V4. Plan smeš da menjaš kad vidiš bolje — upiši zašto u LOG. Na kraju svakog većeg koraka
javi vlasniku kratko: šta je gotovo, šta je izmereno, šta sledi, šta (ako išta) treba od njega.

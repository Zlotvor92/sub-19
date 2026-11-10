# Program „trenerski kvalitet v2" — organizator

Nalog korisnika (9. 11. 2026): organizator vodi posao kroz zasebne sesije (tabove), jednu po jednu. Tab završi segment,
pošalje izveštaj, organizator proveri i daje sledeću instrukciju. Cilj: v2 generatori (5K, 10K, HM, maraton) koji su
dobri kao trener, ne samo kao bezbedan konstruktor plana.

## Polazna ocena organizatora (HM v2, hm-v2.4.1, jedan plan + politika)

Profil: 10 km 46:00 (VDOT 44,1), 40 km, 4 dana, 16 nedelja, cilj 1:40. Dobro: rast obima, rasterećenja, kotrljajuća
granica dugog, pošten odnos prema cilju, odbijanje umesto degenerisanog plana, taper. Slabo:

1. Mala doza kvaliteta: nedelja 1 T 2,0 km (≈ 9,5 min rada uz 35 min WU/CD); vrh T 2 × 2400 m, vrh I 4 × 1000 m.
2. Malo rada u trkačkom tempu: najveći trening 8 km (≈ 38 % trke); uzrok plafon 15 % nedelje po treningu (H11).
3. Dugi je uvek samo lagan; 5 nedelja platoa na 22,4 km.
4. Tempo zamrznut: plan sa rezultatom nema test ni kontrolnu trku; menja ga samo nov rezultat koji korisnik unese.
5. Adaptacija ne čita kako su odrađeni kvalitetni treninzi (samo % izvršenja, pauzu, bol, RPE laganih).
6. Nema ubrzanja na laganim danima; WU/CD nije srazmeran treningu.

Ostale tri distance organizator još nije merio — zato je prvi segment merna osnova (P0).

## Pravila za svaki tab

- `AGENTS.md` važi u celosti: radna grana `claude/generator-isolation-5k-10k-hm-marathon`, nova se ne pravi; vremena po
  beogradskom vremenu; stalni uslovi 1–8; nivoi testova i sabotaže kako tamo piše.
- Bez PR-a, mergea u `main`, deploya i promene prekidača. v1 se ne dira.
- Trenerske brojeve odlučuje organizator. Kad zadato pravilo ne može da se ispuni zajedno sa postojećim (sudar pravila,
  odbijanja, pad invarijanti) — STANI, izmeri, napiši `reports/<segment>-STOP.md` sa opcijama i brojevima. Ne biraj sam.
- Svaka trenerska izmena: merenje pre/posle na mrežama distance, red u `policy.ts` (pravilo, mesto, obrazloženje sa
  oznakom izvor ili heuristika), nova `policyVersion`, spisak promenjenih planova, sabotaža novog pravila.
- Izveštaj: `docs/generators-v2/perfection/reports/<segment>-REPORT.md`, najviše 200 redova, svaka brojka sa komandom
  koja je ponavlja. Odvoj izmereno od mišljenja.
- Na kraju: commit + push na radnu granu, pa poruka organizatoru (ID sesije je u instrukciji) sa SHA i putanjom izveštaja.

## Izbor modela po segmentu (nalog korisnika, 9. 11. 2026)

Najjači dozvoljen model taba je Opus 5.5. Organizator za svaki segment bira najslabiji model koji ga pouzdano rešava
uz precizan zadatak:

- Opus 5.5: izmena pravila generatora, sudari pravila, adaptacija, dizajn merenja.
- Sonnet 5.5: jasno omeđene izmene (tekst za korisnika, usklađivanje već odlučenog pravila, dopuna testa, ponavljanje
  merenja postojećom skriptom).
- Haiku 5.5: mehanički poslovi (pokretanje gotove skripte i prepis brojeva, formatiranje, provera spiska).

Slabiji model dobija uži zadatak: tačni fajlovi i funkcije, očekivani izlaz, komanda provere, šta ne dira.

## Testovi — štednja vremena (nalog korisnika, 9. 11. 2026)

Nivoi su u `AGENTS.md`; ovde je samo šta tab sme i kada.

- Segment bez izmene `web/src/**` (merenje, izveštaj, dokumentacija): nijedan test.
- U toku rada: samo namenski test fajla koji se menja (`npx vitest run <fajl>`), brz nivo.
- Jednom na kraju segmenta: `npm run check` + `npx vitest run --changed <polazni SHA>` + pun nivo SAMO foldera dirane
  distance (`TEST_FULL=1 npx vitest run --project node <folder>/v2`). Ne ponavljati posle izmena koje ne diraju taj kod.
- Zabranjeno tabu: `npm run check:full`, pun nivo drugih distanci, projekat `v1` (v1 se ne dira), ceo skup sabotaža.
  Sabotaža: samo novo pravilo, kroz `web/scripts/sabotage.mjs` sa `--bail=1`.
- Više trenerskih izmena iste distance ide u jedan segment, da pun nivo te distance trči jednom, ne po izmeni.
- Push koda pokreće CI (pun nivo): jedan push po segmentu, na kraju. Međukoraci se ne pushuju; push samo `docs/**` CI ne
  pokreće.
- Test koji traje > 15 min ili visi: prekini, zabeleži komandu i trajanje u izveštaj, ne pokreći ponovo bez odluke
  organizatora.
- Izveštaj navodi svaku pokrenutu komandu testa i njeno trajanje.

## Granica korišćenja naloga (naučeno 10. 11. 2026)

Pet Opus tabova uporedo potrošilo je petočasovnu granicu za ≈ 3,5 h; tabovi tada staju sa greškom 429 (status „failed",
`usage_limit_reached`) i NE nastavljaju sami posle resetovanja. Pravila: najviše 3 Opus taba uporedo; tab radi lokalne
commit-e posle svakog koraka; posle resetovanja organizator (satna provera) šalje svakom zaustavljenom tabu poruku
„nastavi" — ne otvara nov tab dok stari ima lokalni rad.

## Model tabova (nalog korisnika, 10. 11. 2026; ispravljeno u 06:00)

Svi NOVI tabovi se otvaraju na `claude-fable-5-2` — odmah, ne tek posle sledećeg limita (potrošnja Fable-a se
resetovanjem vraća u nedeljni limit; Opus ne). Tabovi koji već rade na Opusu završavaju svoj segment. Kad se dostigne
nedeljni limit, korisnik radi „Fable reset" — organizator tada javlja i čeka. Najviše 4 teška taba uporedo.

## Glavni trener (nalog korisnika, 10. 11. 2026, 05:32)

Stalni tab na Fable 5.2: sesija `session_01GnHHiWk1PhzvzdGjhxZ5ob`, uloga „glavni trener". Organizator mu u krugovima
šalje ispise novih planova (poruka u tu sesiju sa putanjom foldera); on vraća `coach/ROUND-NN.md` (+ .json): ocene po
rubrici P7b, trenerski standard po distanci, deset najvažnijih izmena, sud o tekućim pravilima. Sme da koristi i
instalira skillove trkačkog trenera i pretragu weba; ne menja kod. Organizator na osnovu izveštaja odlučuje izmene za
sledeći krug i upisuje ih u dnevnik. Krug 1: 48 planova „posle P5" + sud o P8 (izdato). Tab se ne arhivira između krugova.

## Redosled (privremen; zaključava se posle P0)

| Segment | Sadržaj | Stanje |
|---|---|---|
| P0 | Merna osnova trenerskih metrika, sve 4 distance, bez izmene generatora | gotovo (`53b2dd4`, `reports/P0-REPORT.md`) |
| T1 | Brži CI i testovi: izbor po dometu izmene, E2E u 3 dela, keš zavisnosti | gotovo (`c4aff71`, `reports/T1-REPORT.md`) |
| V1a | Uklanjanje v1: popis i plan (bez koda) | gotovo (`d7df09e`, `reports/V1a-REPORT.md`) |
| V1b | Uklanjanje v1 za 5K/10K/maraton + prevođenje testova | gotovo (`322284b`, `reports/V1b-REPORT.md`) |
| V1c | Brisanje HM v1 (posle trke vlasnika 13. 12. 2026) | čeka datum |
| P1 | HM: specifičan dugi (RP blok), plafon i lestvica RP | gotovo (`3a57a15`, hm-v2.9.0, `reports/P1-REPORT.md`) |
| P2 | Maraton: dugi sa MP blokom, dugi do 180 min / 32 km | gotovo (`320edc5`, marathon-v2.9.0, `reports/P2-REPORT.md`) |
| P3 | 10K: plafon/lestvica RP, održavanje I | gotovo (`7484b05`, 10k-v2.11.0, `reports/P3-REPORT.md`) |
| P4 | 5K: budžet I/RP 10–12 %, VDOT do 70 — `briefs/P4-5k-doza.md` | gotovo (5k-v2.13.0, `reports/P4-REPORT.md`), čeka prijem |
| P5 | Po distanci (4 taba): kontrolni test u planu sa rezultatom, kvalitet u adaptaciji, ubrzanja, početna doza T/I — `briefs/P5-forma-ubrzanja-pocetna-doza.md` | 5K gotovo (`3f96c04`, 5k-v2.14.0, `reports/P5-5K-REPORT.md`); MAR gotovo (`e033718`, marathon-v2.10.0, `reports/P5-MAR-REPORT.md`); HM gotovo (`8fca1ff`, hm-v2.10.0, `reports/P5-HM-REPORT.md`); 10K gotovo (`81b8cb1`, 10k-v2.12.0, `reports/P5-10K-REPORT.md`) |
| P7a | Priprema slepe ocene: anonimni ispisi planova pre/posle — `briefs/P7a-priprema-slepe-ocene.md` (Sonnet 5.5) | gotovo (`a8f8dc0`; 48 ispisa, 0 odbijanja u obe verzije); 10K „posle" se ponavlja posle P5-10K |
| P7b | Slepa trenerska ocena, 4 taba po distanci — `briefs/P7b-slepa-trenerska-ocena.md` (Opus 5.5: sud, ne mehanika) | gotovo, sve 4 (`P7/reviews/`, `P7/KEY-AND-RESULTS.md`) |
| P8 | Ispravke po slepoj oceni, po distanci — `briefs/P8-ispravke-po-slepoj-oceni.md` | 5K, 10K (Opus), HM, MAR (Fable) u toku, sa dopunom po treneru |
| P9 | Ponovljena slepa ocena (pre / posle P5 / posle P8) na istim profilima | čeka P8 |
| P10 | Merenje ishoda u aplikaciji (prognoza prema rezultatu) | čeka |

## Kada je gotovo

Pragovi metrika se upisuju ovde posle P0. Uslov: svi pragovi ispunjeni na mrežama, 0 prekršaja invarijanti, 0 novih
odbijanja realnih ulaza, slepa trenerska ocena pre/posle. Ograničenje koje tabovi ne mogu da uklone: da li pravila
stvarno daju bolje rezultate vidi se tek na stvarnim korisnicima kroz mesece (P7 pravi merenje, ne dokaz).

## Dnevnik odluka

- 9. 11. 2026: program otvoren; P0 izdat (Opus 5.5, sesija session_01GnHHiWjtxT9rm68GZMbjHY).
- 9. 11. 2026: korisnik — za manje poslove slabiji modeli uz precizno navođenje; testovi štedljivo (odeljak „Testovi").
- 9. 11. 2026: korisnik — ubrzati testove i CI; izdat T1 (CI run 764: 12,7 min zida, ≈ 85 runner-minuta, sve na svaki push).
- 9. 11. 2026: P0 primljen i proveren (profil (a) HM = nezavisno generisan plan organizatora; kopija izbora = jezgro u
  > 99,7 % za 10K/HM/MAR). Nalazi za sve 4: dugi nikad nema deo brži od E (0/697); RP/MP trening 28–50 % trke; plan sa
  rezultatom nema tačku merenja forme; 10K/HM/MAR bez ubrzanja; RPE/tempo kvaliteta bez efekta u adaptaciji.
- 9. 11. 2026: odluka P1 (HM): smena nedelja A/B u specifičnoj fazi (RP trening / dugi sa RP blokom 4–6–8 km), plafon RP
  15 → 20 %, lestvica RP do 3 × 5000 m. T/I početna doza, ubrzanja i WU/CD idu u P6 (sve distance), petlja forme u P5.
- 9. 11. 2026: korisnik — v1 se briše; lični plan vlasnika mora da preživi; korisnici v1 planova generišu nov (baza: 19 v1 planova, 15 bez unosa, nijedan menjan posle 18. 10.). Deploy ostaje odluka korisnika.
- 9. 11. 2026: P1 STOP (`89f31c8`): prvi nacrt S1 (nedelja B bez RP treninga) vraća ukupni RP na 30 km i sudara se sa H12 (102/192). Odluka: nedelja B zadržava RP trening, T dan postaje lagan (mehanizam pouke 35), blok u dugom 4–6–8 km; samo redovan plan 4–6 dana; poslednja nedelja izgradnje je B; H12 po O1; plafon RP 15 % ispod 40 km cilja, 20 % od 40 km (`briefs/P1-odluke-posle-stop.md`).
- 9. 11. 2026: V1a primljen. Ispravka ranije tvrdnje organizatora: v2 je u produkciji podrazumevan od 24. 10. 2026.
  (`vercel.json` buildCommand `VITE_V2_DEFAULT_ON=1`), ne v1. Odluke za V1b: (1) lični plan — opcija A vremenski
  ograničena: HM v1 ostaje zamrznut samo za `meta.licni === true` do posle trke 13. 12. 2026, pa V1c; 5K/10K/maraton v1
  se brišu u V1b; (2) baza se ne dira, postojeće ponašanje „Generiši nov plan" (briše unose starog plana) se u V1b ne
  menja — korisnik obaveštava vlasnike v1 planova; (3) V1b čeka T1 i P1; (4) testovi koji prave ulaz v1 generatorom
  prelaze na v2 generatore; zamrznute fiksture samo za testove prikaza starog (v1) formata plana, koji mora i dalje da
  se otvara; (5) `docs/qa`: brišu se samo folderi koje nijedan živ test ne čita; (6) raspon nedelja ostaje odbijanje sa
  porukom (već je tako u produkciji).
- 9. 11. 2026 (noć): korisnik — raditi celu noć bez pitanja, odrešene ruke. Organizator: P2 i P3 izdati uporedo sa P1
  (odvojeni folderi distanci). Redosled dalje: V1b (posle T1, P1, P2, P3) → P4 (5K) → P5 (petlja forme) → P6 (ubrzanja,
  WU/CD) → P7. Granica koju organizator sam drži: ništa u `main`, bez deploya i bez izmene baze dok korisnik ne potvrdi.
- 9. 11. 2026 (noć): P3 STOP (`9c0fa49`): nedelja B (I održavanja) ne staje u 14–22 % planova 4–6 dana (dan I ima manje km od T dana, nedelja na kapacitetu). Odluka: P-b — niži izvodljiv cilj do 3,0 km, inače nedelja A; lestvica RP + 4 × 1600, 5 × 1600 m; I održavanja = najveća I doza razvoja; D30 ostaje; ukupni RP 18,4 km prihvaćen.
- 9. 11. 2026 (noć): P2 STOP (`9f4cbc8`): nedelja B bez MP treninga spušta ukupni MP 52 → 50 km; O2 (B zadržava MP trening) daje 69 km ali 177 nedelja > 25 % brzih km. Odluka: O3 (blok jedan nivo iznad max(blok, MP trening), MP trening nastavlja od max) + MP tapera od max; prag pada ukupnog MP ≤ 5 % po grupi (inače samo prijaviti); dugi ≤ 32 km uz 180 min; 3 dana i početnik bez nedelje B. Maraton se svesno razlikuje od HM (HM: B zadržava RP trening).
- 9. 11. 2026 (noć): P1 STOP 2 (`0b6e944`): S1+S2 ugrađeni (ukupno RP 30 → 43 km, 2 duga sa blokom, 0 odbijanja, baza/razvoj bajt-isti); sudar pojasa plafona sa taperom (1365 planova bez kvaliteta u taperu). Odluka: RP tapera = najviši nivo ≤ min(60 %, plafon), min 2 × 2000 m; blok podleže plafonu RP; F 5–6 d bez B i 81 nedelja > 25 % prihvaćeni.
- 10. 11. 2026 00:15: T1 primljen (tab je čekao dozvolu za poruku; izveštaj pročitan iz repoa). CI po dometu izmene: jedna distanca v2 12,7 → 5,6 min zida (≈ 90 → 32 runner-min), samo ekran 5,4 min (≈ 15 runner-min), `.claude/**` ne pokreće web poslove, „sve" 9,4–9,7 min. Pokrivenost „sve" ista (524 → 525 fajlova, razlika je nov test izbora). Otvoreno za V1b: 10 delova za „sve" (zid ≈ 8 min) i sabijanje lanca starih regresija 10K `earlyGrid` (≈ 8 % punog nivoa) — odluka: 10 delova da, sabijanje lanca ne (gubi dokaz uzroka starih izmena).
- 10. 11. 2026 00:20: P1 primljen i proveren (organizator nezavisno generisao profil (a): poslednja nedelja izgradnje RP 2 × 5000 m + dugi 22,4 km sa 6 km RP; taper RP 2 × 2500 m + oštrenje). Ukupno RP 30 → 45 km, 2 duga sa blokom, 0 odbijanja, baza/razvoj bajt-isti; pun nivo HM v2 439/439, sabotaže 6/6. Prihvaćeno: fajl `marathon/v2/app/byteSame` (samo HM ključevi), prag lanaca u `segment07b`, B_WEEK_MISSING samo za plan bez adaptacije. Poznato, ostaje za P7: 16 nedelja tipa B sa 30–33 % brzih km (cilj 42–49 km).
- 10. 11. 2026 00:30: P2 primljen (profil (a) pregledan: nedelje 10 i 13 dugi 24 km sa 8 i 12 km MP, MP trening 2 × 5000 m između). Ukupno MP 52 → 52 km (trening 36 → 20, blok 0 → 20); najduži dugi 24,2 → 26,2 km; nedelja > 25 % brzih 97 → 76; 0 novih odbijanja na 31 920 planova; pun nivo 528 testova, sabotaže 9/9. Potvrđena tumačenja T1 (izuzetak spuštene doze preko tipova), T2 (prelaz I → MP iznad bloka samo kad staje u plafon), T3 (tip nedelje u adaptaciji iz rasporeda, prošlost se ne preslaže). Prihvaćeno: 6 dana −8,1 % ukupnog MP (blok ≤ 50 % dugog). T na plafonu 10 % ostaje (Daniels), nije tema P6.
- 10. 11. 2026 00:45: P4 STOP (`42c24f7`): S1 bez nalaza (I 11 → 13,7 min, najveći RP 2,5 → 3,2 km, profil (b) I 14 min); S2 (VDOT 70) daje degenerisanu nedelju samo za 3 d / 12 km / VDOT ≥ 67 i oštrenje 300 m ispod 60 s. Odluka: VDOT do 70 uz odbijanje te klase ulaza sa preporukom; oštrenje ispod 60 s prihvaćeno; maxReps na 5 dana se ne dira.
- 10. 11. 2026 00:50: P4 primljen. I rad 11 → 13,7 min, najveći RP 2,5 → 3,2 km, odbijanja VDOT 65 27 → 0; B2 (3 d, < 12,1 km, VDOT ≥ 66 → odbijanje sa preporukom); F1 (dopuna pouke 23: trajanje deonice I/RP na tekućem tempu; 10 odbijanja rane mreže → 0); pun nivo 787/787, sabotaže 8/8. Za P7: vrh 6 × 1000 m RP (120 % trke) kod velikog obima; maxReps drži vrh na 5 dana. Za P5: posle sporijeg rezultata u vrhuncu doza pada na jedan kvalitet.
- 10. 11. 2026 00:55: P5 i P6 spojeni u jedan zadatak po distanci (jedan pun nivo po distanci). Odluke: F1 test u planu sa rezultatom ≥ 12 ned (5K ≥ 10) u poslednjoj ne-rasteretnoj nedelji razvoja; F2 dva uzastopna kvaliteta preskočena ili RPE ≥ 9 → sledeća nedelja bez rasta doze; F3 jedan lagan dan nedeljno sa ubrzanjima 4/6 × 20 s (10K, HM, MAR); F4 početni nivo T i I ≤ 80 % plafona (10K, HM, MAR). WU/CD se NE skraćuje (uslov 3): mali udeo rada se rešava većom početnom dozom.
- 10. 11. 2026 00:58: P3 primljen. Najveći RP 4 → 5 km (≥ 6 km u planovima ≥ 40 km: 22/84 → 62/84), ukupno RP 15,4 → 18,4 km, I u specifičnoj fazi 0 → 10,4 min, 0 novih odbijanja; pun nivo 736/736, sabotaže 8/8. Prihvaćeno: vrh plana niži u 6 % planova (do 2,1 km), F 5/6 d po 1 plan bez nedelje B, tri fajla van foldera (oznake verzije, 13 heševa byteSame). Izdati P5-10K i V1b (uporedo sa P5 tabovima).
- 10. 11. 2026 01:07: P5-10K STOP (`df3bdc4`): F1 + F4 zajedno → MAIN_DOSE_DECREASE (126/18 864; svaki sam 0) jer provera glavne doze preskače nedelju testa sa spuštenim slotom. Odluka (važi za sve distance, javljeno i P5-HM i P5-MAR): nedelja kontrolnog testa sa spuštenim slotom je referenca glavne doze (samo validator); test se broji u % brzih km; kontrolni test u nedelji sa ograničenjem otpada uz napomenu.
- 10. 11. 2026 01:28: P5-10K dopuna STOP (`01623a1`): F4 udvostručuje nedelje u kojima drugi dan kvaliteta postaje lagan (342 → 660 nedelja, 5–6 dana, 35–45 km, VDOT 60–70). Odluka (sve distance, javljeno P5-HM i P5-MAR): početni nivo T/I = najviši ≤ 80 % plafona koji ne izaziva pouku 35 / spuštanje po pouci 32; inače ostaje nivo po 60 %. Veća početna doza ne sme da košta drugi dan kvaliteta. Ako to traži novo mesto odluke — ostaje P-a (prihvatiti).
- 10. 11. 2026 01:43: P5-5K stigao (`df96d0e`, 5k-v2.14.0): F1 jedan test u planu ≥ 10 ned (menja se samo nedelja testa), F2 radi (0 odbijanja na 104 800 tokova), pun nivo 796/796, sabotaže 11/11. Vraćeno na doradu jednom tačkom (važi za sve distance, javljeno ostalim P5 tabovima): F2 „neodrađen" samo ako tog datuma nema NIJEDNOG trčanja (ni van plana) — uvoz/Strava sa nevezanim trčanjima ne sme da okine F2. Prihvaćeno: manjak km u nedelji testa kao prijava, 16 nedelja > 25 % (nedelje testa, mali obim). B1/B2 (blaža grana posle sporijeg rezultata, 10/4 192 tokova) odloženo.
- 10. 11. 2026 01:52: P5-5K primljen (`3f96c04`): F2 po datumu ugrađen (trčanje van plana tog datuma = odrađen), pun nivo 797/797, sabotaže 13/13, otisci mreža isti. Prihvaćeno: trkač koji trči drugim danima od plana (nijedno trčanje na datume kvaliteta) i dalje okida F2 — efekat je blag (doza jedne nedelje ne raste), pravilo po nedelji se ne uvodi.
- 10. 11. 2026 02:18: P5-MAR primljen. Test 1 po planu (8–9 ned do trke); prvi T 11,8 → 17,9 min, prvi I 12,7 → 18,6 min; ubrzanja 0 → 17 dana po planu; ukupno MP i vrh obima isti; 0 novih odbijanja na 31 920 planova; pun nivo 546 testova, sabotaže 9/9. Odluke: (1) plan od 12 nedelja u kome test zamenjuje jedini I trening — prihvaćeno (test 5 km je sam VO2 stimulus); (2) F2 niži izvodljiv cilj u 9 % tokova — prihvaćeno; (3) ubrzanja se NE broje u % brzih km (bez njih 87 → 77 nedelja > 25 %); (4) tumačenja T3–T5 potvrđena.
- 10. 11. 2026 04:12: V1b, P5-10K i P5-HM stali u 02:36–03:00 na granici korišćenja naloga (429; reset 03:40). Posle resetovanja svima poslata poruka „nastavi". Zastoj ≈ 1 h 30 min (satna provera u 03:09 je i sama čekala granicu). Od sada najviše 3 Opus taba uporedo.
- 10. 11. 2026 04:42: P5-HM primljen. Test 1 po planu ≥ 12 ned (6–8 ned pre trke); prvi T 11,3 → 13,7 min, prvi I 10,9 → 15,7 min; ubrzanja 0 → 14 dana; vrh obima i ukupno RP isti; 0 novih odbijanja na 27 930 planova; pun nivo 450/450, sabotaže 7/7. F4 na HM smanjuje nedelje pouke 35 (25 494 → 22 641), deo „× pouka 35" nije ugrađen (P-a) — prihvaćeno. Nalaz: `KNOWN_VERSIONS` nije imao hm-v2.8.0 (verzija u produkciji) od P1 — ispravljeno u P5-HM; organizator proverio sve 4 distance: produkcione verzije 5k-v2.12.0, 10k-v2.10.0, hm-v2.8.0, marathon-v2.8.0 su u spiskovima (P5-10K upozoren da zadrži 10k-v2.11.0). Nalaz: harness adaptacije HM držao ceo JSON tokova (OOM 3,3 GB) → heš; isti obrazac proveriti u ostalim distancama (P8).
- 10. 11. 2026 04:47: P7a primljen (Sonnet 5.5, ≈ 5 min): 48 anonimnih ispisa, ključ i seme kod organizatora van repoa (objavljuju se posle ocena). Izdati P7b za 5K, HM i MAR (Opus 5.5; laki tabovi — samo čitanje, bez testova; svesno iznad granice od 3 Opus taba). 10K čeka P5-10K.
- 10. 11. 2026 05:02: P5-10K primljen: test 1 po planu ≥ 12 ned; T ned 1 10,3 → 13,7 min; ubrzanja 0 → 12 dana; 0 odbijanja na 34 146 planova; pouka 35 ista (P-b); sabotaže 14/14; pun nivo jednom (24 min) + ponovljeni samo popravljeni fajlovi. Prihvaćeno: DOSE_DROPPED raste (veća početna doza pa spuštanje kapacitetom), ponavljanja slota po osećaju 5–6 d, lagan dan sa ubrzanjima po osećaju ne ide na sat. Sve četiri distance imaju P5.
- 10. 11. 2026 05:02: P7b stigao za 5K, HM, MAR (ocene u `P7/reviews/`; ključ A/B ostaje van repoa do ocene 10K). Otključano kod organizatora — prosek star → nov: 5K 60,7 → 58,9 (nov slabiji: 3 profila većeg obima, −8,5 do −13; zamerke: rasterećenje i taper ne smanjuju kvalitet, skok doze R 8 min → I 26 min, dan kvaliteta dug kao dugi); HM 55,4 → 58,0 (nov bolji u 11/12); MAR 53,3 → 59,7 (nov bolji u 10/12, 2 isto). Nijedan plan > 72. Zajedničke zamerke obe verzije: plato dugog i obima, napomene protivreče brojevima, tekst sa „nije izvodljiv"/„odstupanje", trkački dan 5K 8,5 km za sve nivoe, početnik sa većim obimom spušten, spori 3 d bez trkačkog tempa u taperu. → sadržaj P8.
- 10. 11. 2026 05:15: P7b 10K stigao; ključ i rezultati objavljeni (`P7/KEY-AND-RESULTS.md`). Ukupno 48 parova: 54,5 → 58,2; 5K 60,7 → 58,9 (pogoršanje kod većeg obima), 10K 52,0 → 56,0, HM 55,4 → 58,0, MAR 53,3 → 59,7. Odluka: P8 po distanci — G1 obim raste do kraja razvoja, G2 najniži nivo lestvice uvek staje u plafon, G3 tekst za trkača; 5K budžet ≥ 40 km nazad na 10 %, rasterećenje ≤ 60 % i taper ≤ 70 % doze, trkački dan po nivou; HM nedelja sa blokom ≤ 25 % RP; MAR početnik MP ≤ 60 min. Merilo P8 je ponovljena slepa ocena (P9), ne orijentiri organizatora.
- 10. 11. 2026 05:33: otvoren stalni tab „glavni trener" (Fable 5.2), krug 1 izdat. Njegov sud o P8 stiže dok P8-5K i P8-10K rade: ako ospori neko pravilo P8, organizator šalje dopunu tim tabovima pre njihovog push-a, a P8-HM i P8-MAR se izdaju sa već usklađenim zadatkom.
- 10. 11. 2026 05:45: glavni trener, krug 1 (`f7e08d2`, `coach/ROUND-01.md`): prosek 48 planova 54,6 (slepa 58,2). Glavni nalaz: opterećenje se meri u km i udelima, a plaća u minutima (HM RP 3 × 5000 m = 88 min kod sporog; MAR 95 km ≈ 11 h/ned; oštrenje 27–28 min MP tri dana pred maraton). Sud o P8: G1 bez plafona vrha zadržava prevelike planove; G2 u trkačkoj nedelji šteti sporima. Odluka: `briefs/P8-dopuna-po-glavnom-treneru.md` — plafon vrha (faktor po dužini pripreme + satni plafon po VDOT-u), korak < 3 % se ne primenjuje, G4 plafon treninga u minutima, G5 taper/oštrenje/rasterećenje u minutima, G6 lagan ≤ 0,70 × dugi (4+ dana), G7 test jedini kvalitet nedelje i ne pre nedelje 4, G8 dugi početnika do distance. Nije usvojeno sada (krug 2): talas dugog, blok za 3 dana/početnika, donji prag doze, automatsko smanjenje dana. Satni plafoni za VDOT ≥ 40 su dopuna organizatora (trener dao samo VDOT < 40) — tražiti njegov sud u krugu 2.
- 10. 11. 2026 05:56: V1b primljen i proveren (organizator: folderi `fiveK`, `tenK`, `marathon` sadrže samo `v2/`; HM v1 prisutan; `personalPlan.node.test.ts` nezavisno pokrenut — 3/3). Obrisano 270 fajlova / 33,7 hilj. redova + `docs/qa` + prekidači + E2E v1 tokova; pun nivo 431/431 (49 min 53 s), E2E 82/82. Stari plan u bazi: prikaz i unos rade, poruka + „Generiši nov plan". Prihvaćeno: stari plan ne klasifikuje merenja tempa i nema predlog bola; maraton → 10K predaja nedostupna preko 18 nedelja (sa razlogom); `vercel.json` promenljiva ostaje bez efekta. Za V1c (posle 13. 12.): testovi koji porede sa HM v1 prelaze na fiksture. CI posle push-a još nije potvrđen — proveriti pre P9. Izdat P8-HM.
- 10. 11. 2026 06:00: korisnik — nove tabove otvarati na Fable-u odmah. P8-HM na Opusu prekinut posle 3 min (bez izmena u repou) i ponovo izdat na Fable 5.2; izdat i P8-MAR na Fable 5.2.
- 10. 11. 2026 06:05: korisnik — kad završe tabovi koji sada rade (P8 × 4), STATI; bez novih tabova i novog posla do resetovanja petočasovnog limita (09:00). Posle resetovanja: svi tabovi na Fable 5.2 do nedeljnog ili Fable limita; tada stati i javiti korisniku da uradi Fable reset. Organizator u pauzi samo prima i proverava izveštaje P8.


# Brief F3 — polumaraton kao podatak (Opus 5.5)

Pišeš podatke distance „polumaraton" za V4 motor: `web/src/domain/v4/distances/hm/` — šabloni, biblioteka treninga,
brojevi bezbednosti, „adekvatna priprema", napomene, tekstovi. Motor je gotov (ili pri kraju) i NE menjaš ga; distanca
je čist podatak (jedan izvoz `DistanceData`). Cilj: planovi za 12 profila koje trener oceni ≥ 77,6 (ocena starog v3)
i bez nalaza čuvara; stvarni cilj ≥ 80.

## Pročitaj
1. `AGENTS.md` — SAMO „V4 generator — pravila".
2. `docs/generators-v4/SPEC.md` § 4, § 5, § 6.2, § 8, § 11, § 12, § 14; `docs/generators-v4/reports/F2-REPORT.md`
   (šta F3 mora da znati: koja polja utiču na obim, kako se dobija „nedelja 1 ≈ sadašnji km").
3. `web/src/domain/v4/engine/types.ts` (`DistanceData` i sve što sadrži), `engine/index.ts` (javni izvoz),
   `engine/testdata/synthetic.ts` (primer ispravnog `DistanceData`).
4. ZNANJE (ne kod koji se prenosi): `git worktree add /tmp/v3 origin/claude/v3-hm` →
   `web/src/domain/generators/halfMarathon/v3/{templates,sessions,scale,text,guard}.ts`,
   `docs/generators-v2/perfection/reports/V3-HM-REPORT.md`, `docs/generators-v2/perfection/P9v3/plans/HM/p01–p12.txt`
   (šta je v3 davao za istih 12 profila). Brojeve i tekstove smeš da preuzmeš kao znanje; kod pišeš iznova u obliku
   `DistanceData`.
5. Merilo: `docs/generators-v4/coach/RUBRIC-V4.md` (deo Plan + provere K1–K8), ciljni planovi trenera
   `docs/generators-v2/perfection/target/HM/` (p01, p04, p11, p12), poslednja ocena `docs/generators-v2/perfection/
   coach/ROUND-V3-HM-03.md` (šta je falilo do 80), profili `docs/generators-v2/perfection/P9/inputs.json` (HM).
NE čitaj v2 generatore ni stare testove.

## Isporuka
1. `distances/hm/`: `index.ts` (izvoz `hm: DistanceData`), `templates.ts`, `library.ts`, `safety.ts`, `adequate.ts`,
   `texts.ts`, `notes.ts` (podela po potrebi). Pokrivenost šablona: svaki nivo × 1–52 nedelje × 1–7 dana (SPEC § 4.2).
   Tekstovi na srpskom (latinica, ekavica), bez internih izraza, sa pravilnom množinom kroz zamene motora.
2. `distances/hm/hm.test.ts` (projekat `domain`, < 30 s): pokrivenost šablona; čuvar bez nalaza na mreži ulaza
   (dani 3–6, nedelje 6–24, obim 15–80 km, forma 1:25–2:30, početnik) osim nalaza koje ulaz opravdava (navedi);
   upotrebljivost (nema nedelje ispod minimalnog smislenog obima, praznog treninga, dugog kraćeg od laganog);
   otisci 12 profila zaključani (`fingerprint` → snimak u `distances/hm/__fixtures__/`), da izmena motora ne
   promeni HM nenamerno; provere K1–K8 nad `renderPlan` za 12 profila.
3. Ispisi: `docs/generators-v4/plans/HM/p01.txt … p12.txt` kroz `renderPlan` (skripta `docs/generators-v4/plans/
   render.ts`, pokretanje `node` — navedi komandu), plus dva plana vlasnika: (v1) HM, forma 1:41:00, 30 km/ned,
   4 dana, 10 nedelja; (v2) 18 nedelja od 14. 12. 2026. (dan posle polumaratona 13. 12.) do 17. 4. 2027.
   Plus scenariji prilagođavanja iz `docs/generators-v4/coach/SCENARIOS-V4.md`: za svaki od 24 scenarija ispis PRE i
   POSLE (`replan`) sa spiskom promena → `docs/generators-v4/plans/HM/scenarios/` (ako `replan` još nije u motoru,
   ovo ostavi za kraj i javi).
4. Poređenje sa v3 po profilu (km vrha, najduži dugi, broj kvaliteta, udeo brzog rada) u izveštaju
   `docs/generators-v4/reports/F3-REPORT.md` (≤ 80 redova) + spisak zahteva prema motoru (šta nisi mogao da izraziš
   podatkom — NE zaobilazi kodom u distanci, prijavi).

## Trenerski zahtevi koje podaci moraju da ispune (provereno na v3 i od vlasnika)
- Nedelja 1 ne sme biti ispod sadašnjeg obima trkača (motor meri u bodovima; podesi `startPct`/`loadPct`).
- Mali obim (30 km, 10 nedelja): upozorenje sa konkretnim predlogom (nedelje, km, dani) — `adequate`.
- Plan duži od 10 nedelja pokazuje napredak u prognozi (dolazi iz `fitness/`; ti samo proveri da ispis to nosi).
- Najteža nedelja 2–3 nedelje pred trku, sledeća ≤ 85 %; brz rad ≤ 22 % vremena nedelje; dugi 30–35 % nedelje kod
  4+ dana; blok tempa trke u dugom raste po lestvici; taper 2 nedelje; ništa brzo 3 dana posle kontrolne trke/testa.
- 3 dana nedeljno i početnik: plan ima smisla i jasno kaže šta nedostaje do adekvatne pripreme.

## Pravila
- Nula uvoza van `web/src/domain/v4/` (iz motora: tipovi i javni izvoz); ništa iz druge distance; ne menjaj
  `engine/` ni `fitness/` (zahtev → izveštaj + poruka organizatoru). Pišeš samo u `distances/hm/`,
  `docs/generators-v4/plans/`, svoj izveštaj.
- Pre push-a: `cd web && npm ci` (prvi put), `npm run typecheck && npx eslint src/domain/v4/distances && npx prettier
  --check src/domain/v4/distances && npx vitest run src/domain/v4`. Nikad push sa crvenim testovima.
- Grana `claude/v4`, pre push-a `git pull --rebase origin claude/v4`. Bez PR-a, ništa u `main`, baza i aplikacija se
  ne diraju. Commit trailer: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Sudar ili nejasnoća → najmanja odluka + zapis; ne staješ. Guraj često (kontejner može da se restartuje).
- Poruke organizatoru (`send_message`, `session_id` = `@parent`): (1) kad prvih 12 ispisa postoji — SHA, da ih
  pošaljem sudijama; (2) na kraju — SHA, brojevi poređenja sa v3, zahtevi prema motoru.

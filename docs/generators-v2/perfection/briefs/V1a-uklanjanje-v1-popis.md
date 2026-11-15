# V1a — uklanjanje v1 generatora: popis i plan (bez izmene koda)

Odluka korisnika (9. 11. 2026): v1 se briše. Uslov: ugrađeni lični plan vlasnika mora da preživi i ostane upotrebljiv.
Korisnici sa v1 planom generišu nov plan (v2) — to je prihvaćeno.

Stanje baze (organizator, 9. 11.): 31 korisnik; 19 planova bez `meta.policyId` (v1), 17 sa trkom u budućnosti, nijedan
menjan posle 18. 10.; 15 od 19 bez ijednog unosa u dnevniku; 3 plana na v2 (2 × 10K, 1 × HM); 9 korisnika bez
generisanog plana (među njima vlasnik sa ugrađenim ličnim planom, `genPlan === null`).

Ovaj segment NE menja `web/src/**`, workflow ni testove i ne pokreće testove. Rezultat je plan izvođenja.

Pročitaj prvo: `AGENTS.md`, `docs/generators-v2/perfection/PROGRAM.md`, `ARCHITECTURE.md`,
`docs/generator-isolation/STATUS.md` (zaglavlje), `web/src/domain/generators/select.ts`, `flags.ts`, `handoff.ts`,
`contract.ts`, `web/src/domain/personal/index.ts`, `web/src/data/personalPlan*`, `docs/testing/TEST-SPEED.md` § 11.2.

## Šta treba utvrditi (svaka tvrdnja sa fajlom i redom ili komandom)

1. **Granica v1.** Tačan spisak: fajlovi/folderi koji su samo v1 (folderi distanci van `v2/`, zajednički domen koji
   koristi samo v1, reference, `docs/qa`, test projekat `v1`, CI posao); fajlovi koje dele v1 i v2 ili aplikacija
   (tipovi stanja, `domain/plan`, `domain/training`, prikaz, sat, izvoz); fajlovi koje v2 uvozi iz v1 (ako ih ima —
   uslov 7 kaže da nema, proveri). Broj fajlova i redova po grupi.
2. **Lični plan vlasnika.** Šta mu tačno treba u radu: prikaz, unos, ručne izmene, predikcija/forma, prilagođavanje
   (bol, pauza, umor), handoff. Koji v1 kod svaka od tih funkcija poziva (`select.generatorForPlan` → HM v1…). Tri
   opcije sa cenom i rizikom: (A) lični plan zadržava najmanji zamrznut podskup koda koji mu treba (spisak fajlova);
   (B) lični plan ostaje bez automatskog prilagođavanja (statički plan + unos + ručne izmene) — šta tačno prestaje da
   radi; (C) lični plan se prevodi na `hm-v2` format — da li je izvodljivo bez promene treninga. Plan traje do trke
   13. 12. 2026; navedi šta se dešava posle (novi lični plan?).
3. **Postojeći v1 planovi u bazi** (`genPlan` bez `meta.policyId`). Kako aplikacija danas reaguje na plan nepoznate
   politike (`select.ts` status `legacy`/`unknown`). Predlog ponašanja posle brisanja: plan se čita samo za prikaz
   istorije ili se nudi „Generiši nov plan" — bez pada, bez gubitka dnevnika (`log`, `vanPlana`, `kg`, `wellness`).
   Da li treba migracija stanja; ako da, kakva i da li je povratna.
4. **Novi planovi → v2 podrazumevano.** Šta se menja u `flags.ts`/`select.ts`/čarobnjaku/podešavanjima; šta v1 ume a
   v2 ne (trčanje/hodanje van 5K, brz završetak dugog, predlog tempa iz forme, broj dana, rasponi nedelja/obima, VDOT
   opsezi, handoff smerovi…) — tabela „ulaz koji je v1 primao, a v2 odbija", sa procenom koliko je čest.
5. **Testovi i CI.** Koji testovi nestaju sa v1 (projekat `v1`, ekvivalencije, reference `.json.gz`), koji testovi
   ČUVAJU nešto drugo a slučajno zavise od v1 (prikaz, stanje, migracije, lični plan) — šta sa njima. Procena dobitka
   (lokalno brz/pun nivo, CI) iz `web/scripts/test-durations.json`.
6. **Redosled izvođenja.** Koraci koji se mogu vratiti, svaki sa proverom; šta mora pre čega; gde je tačka bez
   povratka (to je deploy — njega odlučuje korisnik). Sudari sa tabovima koji rade uporedo: T1 (workflow, `web/scripts`,
   `vitest.config.ts`) i P1 (`halfMarathon/v2/**`).

## Izveštaj

`docs/generators-v2/perfection/reports/V1a-REPORT.md` (≤ 200 redova): tabele iz tačaka 1–5, plan iz tačke 6, preporuka za
lični plan (jedna, sa razlogom), spisak otvorenih odluka za organizatora. Odvoj izmereno od mišljenja.

## Kraj

Commit samo `docs/generators-v2/perfection/**` + push na radnu granu, pa `send_message` organizatoru: SHA, izveštaj,
preporuka za lični plan, 5 najvažnijih nalaza.

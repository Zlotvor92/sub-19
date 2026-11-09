# T1 — brži CI i testovi (bez slabljenja zaštite)

Nalog korisnika (9. 11. 2026): testovi i CI predugo traju. Radi se uporedo sa P0 (P0 dira samo
`docs/generators-v2/perfection/**`; ti ne diraš taj folder osim svog izveštaja).

Pročitaj prvo: `AGENTS.md`, `docs/testing/TEST-SPEED.md` (posebno § 10–11), `.github/workflows/test.yml`,
`web/vitest.config.ts`, `web/scripts/testSequencer.ts`, `docs/generators-v2/perfection/PROGRAM.md` (odeljak „Testovi").

## Izmereno stanje (organizator, run 764, `main`, 1. 11.)

- Run 12,7 min zida. Delovi `web-test` 6,7–11,9 min (npm ci ≈ 40 s po poslu). `web` 11,4 min: npm ci 40 s, tipovi 37 s,
  lint 89 s, format 42 s, build 9 s, E2E 7,6 min. `web-test-v1` 10,2 min. Zbir ≈ 85 runner-minuta po run-u.
- Svaki push koda pokreće SVE, i kad menja samo `.claude/skills/*.md` (run-ovi 758, 759) ili jedan ekran.

## Cilj

1. **Izbor po dometu izmene** (najveći dobitak). Pun nivo testa trči samo za ono što je push mogao da promeni, računato
   od poslednjeg zelenog run-a grane (isti lanac kao postojeći `v1-changes`). Osnov: uslov 7 iz `AGENTS.md` (nula uvoza
   van foldera distance, test to čuva) i lint izolacije domena.
   - Izmena samo u `generators/<D>/v2/**` → pun nivo samo tog foldera; ostalo brz nivo ili ništa (odluči merenjem).
   - Izmena van `web/src/domain/**` i test infrastrukture (ekrani, stil, tekst) → bez punih mreža generatora.
   - Izmena koja nije kod aplikacije (`.claude/**`, `reel-*/**`, `scripts/` van weba…) → ne pokreće web testove.
   - Zajedničko (`web/src/test/**`, `web/scripts/**`, `vitest.config.ts`, `package*.json`, workflow, `docs/qa/**`,
     koren `generators/*.ts`, zajednički domen) → sve.
   - `main` i `workflow_dispatch` → uvek sve. Bez zelenog run-a grane → sve.
   - Razmotri `vitest --changed <sha>` (graf uvoza) i dopuni ga pravilom foldera za fajlove koje testovi čitaju kroz
     `fs` (bazne linije `*.json`, `docs/qa`) — graf uvoza ih ne vidi. Izbor mora biti JEDNA funkcija/skripta sa testom.
2. **Posao `web`**: razdvoji statičke provere od E2E; E2E skrati (keš Playwright pregledača, delovi). Izmeri pre/posle.
3. **v1 posao**: podeli ako trči (≤ 6 min).
4. Ne povećavaj zbir runner-minuta po run-u za „sve"; za tipičan push ga smanji.

Ciljni zid (mereno na stvarnim run-ovima): push jedne distance v2 ≤ 7 min; push samo ekrana ≤ 6 min; „sve" ≤ 9 min.
Ako neki cilj nije dostižan, izmeri zašto i javi — ne slabi zaštitu da bi ga dostigao.

## Šta ne sme

- Nijedan test se ne briše, ne preskače i ne uzorkuje ređe. Pokrivenost run-a „sve" ostaje ista (isti fajlovi, isti
  redovi) — dokaži spiskom fajlova pre/posle.
- Ne diraj `web/src/domain/generators/*/v2/**` produkcioni kod ni bazne linije. Ne diraj v1.
- Sabijanje lanca starih regresija (TEST-SPEED § 11.5) NE radi — samo izmeri koliki bi dobitak bio (brz i pun nivo, po
  distanci) i napiši u izveštaj; odluka je organizatorova.

## Dokaz ispravnosti izbora (obavezno)

- Test izbora: za zadat spisak promenjenih fajlova vraća očekivan skup (tabela slučajeva: jedna distanca, dve distance,
  ekran, zajednički fajl, bazna linija, workflow, samo dokumentacija, nepoznat fajl → sve).
- Podrazumevano kad izbor nije siguran: sve. Nepoznata putanja u `web/src/domain/**` → sve.
- Lanac ostaje zatvoren: zeleni run je zelen i kad je deo preskočen; opiši zašto svaki zeleni commit ima svaku oblast
  proverenu direktno ili preko prethodnog zelenog (kao § 11.2).
- Sabotaža dometa na stvarnom CI-ju, najviše 2 push-a: (a) bezopasna izmena u `halfMarathon/v2` → trče HM testovi,
  maratonski ne; (b) izmena u `web/src/test/` → sve. Vrati izmene posle.

## Testovi i push

Lokalno: samo testovi fajlova koje menjaš (`web/scripts/*.node.test.ts`) + `npm run check` jednom na kraju. Ne pokreći
`check:full` ni pun nivo generatora lokalno — „sve" izmeri na CI-ju. Najviše 5 push-eva koda ukupno (svaki pokreće CI);
grupiši izmene. Dok CI radi, ne čekaj u petlji: radi sledeće, proveri kad završi.

## Dokumentacija

Ažuriraj `AGENTS.md` (odeljak „Testovi i sabotaže": šta CI sada pokreće i kada) i `docs/testing/TEST-SPEED.md` (nov § 12
ili 13 sa merenjima pre/posle i brojevima run-ova). Izveštaj: `docs/generators-v2/perfection/reports/T1-REPORT.md`
(≤ 150 redova): tabela pre/posle po vrsti push-a (zid, runner-minuti, broj run-a), dokaz pokrivenosti, sabotaže dometa,
izmereni dobitak sabijanja lanca, šta nije urađeno.

## Kraj

Commit + push na radnu granu, pa `send_message` organizatoru (sesija iz instrukcije): SHA, putanja izveštaja, tabela
pre/posle u 5 redova, otvorena pitanja. Sudar sa pravilom ili nejasna odluka → STANI i pitaj istom porukom.

# Nalog PUŠTANJE-1 — spajanje `main` u `claude/v4` i pune provere (Opus, jedan tab)

Odluka vlasnika (15. 11. 2026): „Sve je ovo ok, imaš amin, kreni u prebacivanje na V4 generator." Generator i
aplikacija su ZAMRZNUTI na `claude/v4` — u ovom nalogu se NE menja ponašanje generatora ni aplikacije; radi se samo
ono što traži spajanje i ono što provere pokažu kao pokvareno spajanjem.

## Stanje
- `claude/v4` je 850+ commitova ispred `main` (V4 + 345 commitova radne grane, uklj. V1b brisanje v1 generatora).
- `main` ima JEDAN commit koga nema na `claude/v4`: `6a37541d` (#55, 1. 11. 2026) — NOV lični plan vlasnika (6 nedelja
  od 2. 11., Bokeški polumaraton 13. 12., cilj 1:40:00) + skillovi u `.claude/skills/`. Vlasnik po tom planu trenira
  SADA: plan iz `main` ima prednost i ne sme da se promeni nijednim treningom.
- Probno `git merge origin/main` u `claude/v4` daje 7 sukoba „obrisano kod nas / menjano u main":
  `web/src/domain/generators/{halfMarathon,marathon,tenK}/v2/app/byteSame.*.json`,
  `web/src/test/fixtures/guidance-reference.json.gz`, `web/src/test/fixtures/state-reference.json.gz`,
  `web/src/test/guidance/captureReference.node.test.ts`, `web/src/domain/generators/guidance.node.test.ts`.
  Auto-spojeno (proveri): `web/src/data/personalPlan.ts`, `web/src/domain/personal/**`,
  `web/src/features/personal.test.tsx`, `web/e2e/owner.spec.ts`, `personalPlan.node.test.ts`,
  `web/src/test/fixtures/personal-reference.json.gz`.

## Uradi
1. `git fetch --unshallow origin claude/v4; git fetch origin main; git checkout claude/v4; git merge --ff-only
   origin/claude/v4`, pa `git merge origin/main` (pravi merge commit, bez rebase-a i bez force-a).
   Sukobi: fajl obrisan na `claude/v4` ostaje obrisan — ali za svaki proveri ZAŠTO je obrisan (koji commit) i da li
   izmena iz `main` nosi nešto što mora da se prenese u ono što ga je zamenilo (npr. novu referencu ličnog plana).
   Reference/fiksture ličnog plana pravi po postupku iz repoa (`docs/testing/**`, komentari u testovima) — ne ručno.
2. Dokaz da je lični plan iz `main` netaknut: posle spajanja `git diff origin/main -- web/src/data/personalPlan.ts`
   je PRAZAN; testovi ličnog plana (`personalPlan.node.test.ts`, `domain/personal/**`, `features/personal.test.tsx`,
   `e2e/owner.spec.ts`) zeleni. V4 sloj: `integrations/v4` testovi preuzimanja ličnog plana i `personalProtected`
   (zaštićen do 13. 12. 2026 — vlasniku se pod V4 ništa ne upisuje i prikaz ostaje stari) zeleni sa NOVIM planom; ako
   neki test padne zato što je snimljen nad starim ličnim planom, uskladi fiksturu postupkom, ne slabi tvrdnju.
3. Provere, tim redom (sve iz `web/` osim korenskih testova): `npm ci`; `npm run check`; korenski testovi
   (`npm test` u korenu ako postoje — `test/api.test.mjs`); `npm run build`; ceo E2E skup (`--trace off`);
   `npm run check:full` (45–75 min — pusti u pozadini i čekaj; ne prekidaj prekratkim rokom).
   Sve što padne: ako je posledica spajanja — popravi; ako je postojalo i pre spajanja na `claude/v4` — NE popravljaj,
   navedi tačno (fajl, test, poruka).
4. Push na `claude/v4` (običan push; pre toga `git pull --rebase` NE — imaš merge commit; ako se grana pomerila,
   `git merge origin/claude/v4`). NE diraj `main`, ne pravi PR, ne deployuj — to radi organizator.
5. Posle push-a pogledaj CI za taj commit na `claude/v4` (GitHub MCP alati `mcp__github__*`; učitaj ih kroz
   ToolSearch) i sačekaj ishod; ako CI padne zbog spajanja — popravi i ponovi; ako pada nešto nevezano — navedi.

## Granice
- Ne menjaj `web/src/domain/v4/**` (osim fikstura koje spajanje traži), `integrations/`, `services/`, ekrane, bazu.
- Ne briši i ne slabi testove. Bez sabotaža. Vremena po Beogradu.
- Ako spajanje traži odluku koja menja ponašanje za korisnike ili lični plan vlasnika — STANI i javi.

## Kraj
Izveštaj `docs/generators-v4/reports/PUSTANJE-SPAJANJE.md` (≤ 50 redova): SHA merge commita, kako je rešen svaki od
7 sukoba, dokaz za lični plan, brojevi svake provere, stanje CI, šta je padalo i pre spajanja. Završna poruka ≤ 20
redova `send_message` na `session_01GnHHiXvCMLj5eDdp2ae77u` — NE na @parent. Zatim stani.

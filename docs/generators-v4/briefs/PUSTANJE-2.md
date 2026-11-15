# Nalog PUŠTANJE-2 — `claude/v4` → `main` i provera produkcije (Opus, nov tab)

Odluka vlasnika (15. 11. 2026, ≈ 08:00 po Beogradu): „Sve je ovo ok, imaš amin, kreni u prebacivanje na V4
generator." Ovaj nalog izvršava upis u `main`; Vercel sam deployuje sa `main` (`vercel.json` → `git.deploymentEnabled.main`).
NE menjaš nijedan red koda, testa ni baze. Ako bilo koji uslov ispod nije ispunjen — STANI i javi, ne popravljaj.

## 0. Preduslovi — proveri SVE pre bilo kakvog upisa (ako jedan ne važi: stani, javi tačno koji)
a. Postoji `docs/generators-v4/reports/PUSTANJE-SPAJANJE.md` na `claude/v4` i u njemu su: merge commit `main` →
   `claude/v4`, `npm run check` čist, `npm run check:full` čist, ceo E2E zelen, `npm run build` prolazi.
b. `origin/main` je predak `origin/claude/v4`: `git fetch origin main claude/v4 && git merge-base --is-ancestor
   origin/main origin/claude/v4` vraća 0. (Ako je `main` u međuvremenu dobio nov commit — stani.)
c. Lični plan vlasnika netaknut: `git diff origin/main origin/claude/v4 -- web/src/data/personalPlan.ts` je PRAZAN.
d. CI (workflow `test.yml`) je ZELEN na poslednjem commitu `origin/claude/v4` koji dira kod (GitHub MCP alati
   `mcp__github__*` — učitaj kroz ToolSearch; `actions_list` / `get_check_run`). Ako CI još radi — čekaj (proveravaj
   na 5–10 min, najduže 90 min); ako je crven — stani i javi koji posao i koja poruka.
e. U `web/src/services/v4/access.ts` je `WITHOUT_ROW = true` (puštanje svima) — samo pročitaj i potvrdi.

## 1. PR i spajanje
1. Proveri da li već postoji otvoren PR `claude/v4` → `main` (`list_pull_requests`); ako ne, napravi ga
   (`create_pull_request`, base `main`, head `claude/v4`). Naslov: „V4 generator planova + priključenje na aplikaciju
   (puštanje svima)". Opis (srpski, latinica), kratko: šta ulazi (V4 motor i četiri distance, sloj
   `integrations/v4`, `services/v4`, novi ekrani, Strava uvoz aktivnosti; uz to 345 commitova radne grane od 30. 10.,
   uključujući V1b brisanje v1 generatora), stanje baze (tabele već postoje na produkciji, rezerva
   `rezerva_20261114`), provere (brojevi iz `PUSTANJE-SPAJANJE.md`), ocene (trener/drugi sudija — `LOG.md`),
   vraćanje nazad (dole § 3). Ako repo ima PR šablon — isprati mu naslove. Bez tajni, ključeva i e-adresa.
   Na kraj opisa:
   `🤖 Generated with [Claude Code](https://claude.com/claude-code)`
2. Sačekaj da provere na PR-u budu zelene. Zatim spoji (`merge_pull_request`) metodom **merge** (merge commit, da
   istorija ostane ista kao na grani); ako repo ne dozvoljava merge commit, javi i stani (NE squash bez pitanja).
   Granu `claude/v4` NE briši.
3. Zabeleži SHA na `main` posle spajanja.

## 2. Provera produkcije (samo čitanje)
1. Vercel: sačekaj produkcioni deployment za taj SHA (Vercel MCP alati `mcp__Vercel__*` kroz ToolSearch:
   `list_deployments` / `get_deployment`; ako nisu dostupni, `curl -sI https://sub-19.vercel.app/` i poredi
   `last-modified`/etag pre i posle). Stanje mora biti READY; ako build padne — javi tačan red greške iz build loga i
   stani (NE pokušavaj ponovni deploy ni izmenu koda).
2. `curl -sS -o /dev/null -w '%{http_code}' https://sub-19.vercel.app/` → 200; početna strana vraća HTML aplikacije.
3. Vercel runtime greške u prvih 10 minuta posle deploya (`get_runtime_errors`) — navedi ih ako postoje.
4. Supabase (projekat `clnsxvtulvoeqakchydz`, SAMO `select`, kroz `mcp__Supabase__execute_sql` ako je dostupan):
   `select (select count(*) from public.user_state) as user_state, (select count(*) from public.plan_v4) as plan_v4,
   (select count(*) from public.aktivnost) as aktivnost, (select count(*) from public.v4_pristup) as v4_pristup;`
   Očekivano odmah posle puštanja: `user_state` 31 ili više, ostalo 0 ili malo. Nikakav insert/update/delete/DDL.

## 3. Vraćanje nazad (NE izvršavaj — samo upiši u izveštaj; izvršava se isključivo na nalog vlasnika)
- Aplikacija: Vercel → Deployments → prethodni produkcioni deployment → Promote to Production (ID prethodnog
  deploymenta zapiši u izveštaj PRE spajanja).
- Samo V4, svima: `insert into public.v4_pristup (user_id, ukljuceno, napomena) select id, false, 'vraćeno' from
  auth.users on conflict (user_id) do update set ukljuceno = false, od = now();`
- Baza: rezerva svih tabela od 14. 11. u šemi `rezerva_20261114`.

## Granice
- Nijedna izmena koda, testova, baze, podešavanja Vercela ni GitHub-a osim PR-a i njegovog spajanja.
- Ne zatvaraj i ne otvaraj ponovo PR, ne guraj prazne commitove, ne preskači i ne gasi provere.
- Ako nešto nije kao što nalog opisuje — stani i javi; ne improvizuj.
- Vremena po Beogradu. Brojeve ne izmišljaj; što nisi proverio napiši kao neprovereno.

## Kraj
Izveštaj `docs/generators-v4/reports/PUSTANJE-2.md` na `claude/v4` (≤ 40 redova; commit samo tog fajla, push na
`claude/v4`, NE na `main`): preduslovi a–e sa dokazom, broj PR-a, SHA na `main`, vreme spajanja i deploya, ID novog
i prethodnog produkcionog deploymenta, http kod, runtime greške, brojevi iz baze, postupak vraćanja. Završna poruka
≤ 20 redova `send_message` na `session_01GnHHiXvCMLj5eDdp2ae77u` — NE na @parent. Zatim stani.

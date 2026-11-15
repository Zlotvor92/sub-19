# PUŠTANJE-2 — izveštaj (15. 11. 2026, vremena po Beogradu)

Potvrda vlasnika: direktno u sesiji izvršioca, 15. 11. ≈ 11:40 („Spajaj i deploy"). Preneta potvrda organizatora
(09:xx) nije prihvaćena kao dovoljna; do direktne potvrde ništa nije upisano.

## Preduslovi § 0 (provereno pre upisa, b i d ponovljeni neposredno pre PR-a)
- a. `reports/PUSTANJE-SPAJANJE.md`: merge `f16761cf`; check 403/403; check:full 541/541; E2E 92/92; build OK.
- b. `git merge-base --is-ancestor origin/main origin/claude/v4` = 0 (`main` = `6a37541d`, bez novih commitova).
- c. `git diff origin/main origin/claude/v4 -- web/src/data/personalPlan.ts`: prazno.
- d. CI `test.yml` run 1019 ZELEN na `823ec123` (09:38–09:43). `823ec123..cdb3213d` (vrh pri spajanju) menja samo
  `docs/**` (3 fajla) — CI se na to ne pokreće (`paths: !docs/**`).
- e. `web/src/services/v4/access.ts:11` `export const WITHOUT_ROW = true;`

## PR i spajanje
- PR **#56** `claude/v4` → `main`; jedina provera na PR-u „Vercel Preview Comments" uspešna.
- Spojeno metodom **merge**, `expectedHeadSha` `cdb3213d`, u 11:41:38. SHA na `main`: **`638c9e04`**
  (`638c9e047a3676aa88140161587ef0c6e9538f8e`). Grana `claude/v4` nije brisana.

## Produkcija (samo čitanje)
- Novi produkcioni deployment **`dpl_AaYv2BttHizAgUHtyEQWaW7k9Y5Q`** (SHA `638c9e04`): napravljen 11:41:59, **READY**
  11:44:24; alias `sub-19.vercel.app`.
- Prethodni produkcioni: **`dpl_7MsjJPUAPfBwZFzBp1HxxwPLKq5k`** (`6a37541d`, 01. 11. 18:24), rollback kandidat.
- `https://sub-19.vercel.app/` → **200**, HTML aplikacije (`<title>sub20 · Trkački plan</title>`, `#root`); etag se
  promenio u 11:44:31.
- Vercel runtime greške od 11:44:24 do 11:55: **nema**.
- Supabase `clnsxvtulvoeqakchydz` (samo `select`, ≈ 11:45): `user_state` 31, `plan_v4` 0, `aktivnost` 0, `v4_pristup` 0.

## Vraćanje nazad (NIJE izvršeno — samo na nalog vlasnika)
- Aplikacija: Vercel → Deployments → `dpl_7MsjJPUAPfBwZFzBp1HxxwPLKq5k` → Promote to Production.
- Samo V4, svima: `insert into public.v4_pristup (user_id, ukljuceno, napomena) select id, false, 'vraćeno' from
  auth.users on conflict (user_id) do update set ukljuceno = false, od = now();`
- Baza: rezerva svih tabela od 14. 11. u šemi `rezerva_20261114`.

## Napomena
- Opis PR-a navodi 885 commitova ispred `main` (stvaran broj `git rev-list --count`), ne 345 iz naloga.

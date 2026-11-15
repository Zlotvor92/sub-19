# Drugo puštanje, korak 1 → `main` — izveštaj (15. 11. 2026, po Beogradu)

Potvrda vlasnika: direktno u sesiji („Spajaj sve u main"). Kod, testovi i baza nisu menjani; SQL iz `f9/BRISANJE-PLAN.md` nije izvršavan.

## Preduslovi
- a. `reports/PUSTANJE2-KORAK1.md`: check 4901 + 12 očekivanih, check:full 5433 + 12 očekivanih (izlaz 0), E2E 93/93, build uspešan.
- b. Prva provera nad `f68556be`: NIJE važilo (`638c9e04` nije bio predak). Organizator je spojio `main` nazad (`db0c6f60`, stablo isto kao `f68556be`); ponovo: `merge-base --is-ancestor` = 0.
- c. `git diff origin/main origin/claude/v4 -- web/src/data/personalPlan.ts`: prazan.
- d. CI run 1021 (`9b72d128`, 12:57–13:01) zelen; `9b72d128..db0c6f60` menja samo `docs/**`.
- Prethodni produkcioni deployment potvrđen pre spajanja: `dpl_AaYv2BttHizAgUHtyEQWaW7k9Y5Q` (READY, `main@638c9e04`).

## Spajanje
- PR #57 `claude/v4` → `main`, `mergeable_state: clean`, provera „Vercel Preview Comments" zelena.
- Spojen metodom merge ≈ 15:14; SHA na `main`: `7fe9d387f6b53bf276465cab3b1de4338e62aead`. Grana `claude/v4` nije brisana.

## Produkcija (samo čitanje)
- Deployment `dpl_9zdBhwHJXE81ctGLPFbnAE6uQo8T`: napravljen 15:14:36, READY 15:17:05, alias `sub-19.vercel.app`.
- `https://sub-19.vercel.app/` → 200, HTML aplikacije (`<title>sub20 · Trkački plan`).
- Vercel runtime greške od 15:14 do ≈ 15:20: nema. Ceo prozor od 10 minuta nije pokriven (neprovereno posle ≈ 15:20).
- Supabase (`select`, ≈ 15:19): `user_state` 31, `plan_v4` 1, `aktivnost` 0, `v4_pristup` 0.

## Vraćanje nazad (ne izvršeno; samo na nalog vlasnika)
- Aplikacija: Vercel → Deployments → `dpl_AaYv2BttHizAgUHtyEQWaW7k9Y5Q` → Promote to Production.
- Samo V4, svima: `insert into public.v4_pristup (user_id, ukljuceno, napomena) select id, false, 'vraćeno' from auth.users on conflict (user_id) do update set ukljuceno = false, od = now();`
- Planovi uklonjeni pri otvaranju vraćaju se samo iz rezerve `rezerva_20261114` (stanje od 14. 11.).

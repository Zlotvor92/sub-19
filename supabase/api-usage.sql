-- =====================================================================
-- SUB-20 — dnevni brojači koji su POSTOJALI SAMO U ŽIVOJ BAZI
--
-- ZAŠTO OVAJ FAJL POSTOJI
-- `api/analyze.js` zove `check_and_bump_api_usage`, `api/report-bug.js` zove
-- `check_and_bump_bug_usage`, a `api/daily-report.js` čita tabelu `api_usage`.
-- Nijedno od toga nije bilo u repozitorijumu — postojalo je samo u Supabase
-- projektu, napravljeno rukom kroz SQL Editor. Posledica: baza se ne može
-- ponoviti od nule. Novo okruženje (test projekat, oporavak posle brisanja,
-- prelazak na drugi nalog) dobija aplikaciju kojoj limiti TIHO ne rade — jer
-- oba mesta u kodu namerno propuštaju poziv kad funkcija ne odgovori.
--
-- ⚠ OVO JE ZAPIS POSTOJEĆEG OBLIKA, NE NOVA ŠEMA.
-- Napisano je prema onome što kod stvarno traži:
--   - `check_and_bump_api_usage(p_limit integer)` — baca DAILY_LIMIT_EXCEEDED
--   - `check_and_bump_bug_usage(p_limit integer)` — isto
--   - `api_usage(user_id, day, calls)` — daily-report čita ta tri polja
-- `create table if not exists` NE dira postojeće tabele. `create or replace
-- function` MENJA postojeće funkcije — ako se tvoje razlikuju, uporedi ih pre
-- puštanja (Supabase → Database → Functions).
--
-- KAKO SE PUŠTA
-- Supabase → SQL Editor → nalepi CEO ovaj fajl → Run. Puštanje dvaput je
-- bezbedno.
--
-- ŠTA NE DIRA
-- `endpoint_usage`, `push_pretplata`, `ai_posao`, `user_state`.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Tabele
--
-- Odvojene su namerno: trošenje AI analiza ne sme da blokira prijavu buga i
-- obrnuto. (Novi endpointi više ne dobijaju svoju tabelu — za njih postoji
-- `endpoint_usage` sa nazivom kao običnom kolonom, v. rate-limit.sql. Ove dve
-- su starije i ostaju jer `daily-report` čita `api_usage` po imenu.)
-- ---------------------------------------------------------------------
create table if not exists public.api_usage (
  user_id uuid    not null references auth.users(id) on delete cascade,
  day     date    not null,
  calls   integer not null default 0,
  primary key (user_id, day)
);

comment on table public.api_usage is
  'Dnevni brojač AI analiza po korisniku. Piše se ISKLJUČIVO kroz check_and_bump_api_usage().';

create table if not exists public.bug_report_usage (
  user_id uuid    not null references auth.users(id) on delete cascade,
  day     date    not null,
  calls   integer not null default 0,
  primary key (user_id, day)
);

comment on table public.bug_report_usage is
  'Dnevni brojač prijava buga po korisniku. Piše se ISKLJUČIVO kroz check_and_bump_bug_usage().';

-- RLS uključen, a namerno BEZ IJEDNE POLITIKE — isto pravilo kao za
-- `endpoint_usage`: kad bi korisnik mogao da smanji sopstveni brojač, limit
-- ne bi postojao. Upisuju samo funkcije ispod, koje rade kao SECURITY DEFINER.
alter table public.api_usage        enable row level security;
alter table public.bug_report_usage enable row level security;

-- ---------------------------------------------------------------------
-- 2. Funkcije — proveri i uvećaj, atomski
--
-- Jedna naredba (`insert … on conflict do update … returning`), pa dva
-- paralelna zahteva ne mogu oba da pročitaju staru vrednost. Greška se BACA
-- (ne vraća false) da Postgres poništi i samo uvećanje — inače bi brojač
-- rastao u nedogled dok neko lupa po dugmetu.
--
-- Dan je Beogradski, ne UTC — v. isto obrazloženje u rate-limit.sql.
-- ---------------------------------------------------------------------
create or replace function public.check_and_bump_api_usage(p_limit integer)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_dan  date := (now() at time zone 'Europe/Belgrade')::date;
  v_broj integer;
begin
  if v_user is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '28000';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 100000 then
    raise exception 'BAD_LIMIT' using errcode = '22023';
  end if;

  insert into public.api_usage as u (user_id, day, calls)
  values (v_user, v_dan, 1)
  on conflict (user_id, day)
  do update set calls = u.calls + 1
  returning u.calls into v_broj;

  if v_broj > p_limit then
    raise exception 'DAILY_LIMIT_EXCEEDED' using errcode = 'P0001';
  end if;

  -- Čišćenje starih redova ovog korisnika. `daily-report` prikazuje SAMO
  -- poslednji dan sa pozivima, pa dublja istorija nema čitaoca. Devedeset
  -- dana je i dalje velikodušno.
  delete from public.api_usage where user_id = v_user and day < v_dan - 90;

  return v_broj;
end;
$$;

create or replace function public.check_and_bump_bug_usage(p_limit integer)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_dan  date := (now() at time zone 'Europe/Belgrade')::date;
  v_broj integer;
begin
  if v_user is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '28000';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 100000 then
    raise exception 'BAD_LIMIT' using errcode = '22023';
  end if;

  insert into public.bug_report_usage as u (user_id, day, calls)
  values (v_user, v_dan, 1)
  on conflict (user_id, day)
  do update set calls = u.calls + 1
  returning u.calls into v_broj;

  if v_broj > p_limit then
    raise exception 'DAILY_LIMIT_EXCEEDED' using errcode = 'P0001';
  end if;

  delete from public.bug_report_usage where user_id = v_user and day < v_dan - 90;

  return v_broj;
end;
$$;

-- ---------------------------------------------------------------------
-- 3. Dozvole
--
-- `public` se prvo skida jer Postgres novim funkcijama podrazumevano daje
-- EXECUTE svima; `anon` je namerno izostavljen (bez tokena je auth.uid()
-- ionako null, pa bi poziv samo bacio NOT_AUTHENTICATED).
-- Direktnog pristupa tabelama nema ni za čitanje — jedini put je funkcija.
-- (`daily-report` čita `api_usage` service_role ključem, koji RLS i dozvole
-- za `authenticated` ionako zaobilazi.)
-- ---------------------------------------------------------------------
revoke all on function public.check_and_bump_api_usage(integer) from public;
revoke all on function public.check_and_bump_bug_usage(integer) from public;
grant execute on function public.check_and_bump_api_usage(integer) to authenticated;
grant execute on function public.check_and_bump_bug_usage(integer) to authenticated;

revoke all on table public.api_usage        from anon, authenticated;
revoke all on table public.bug_report_usage from anon, authenticated;

-- =====================================================================
-- PROVERA DA JE PUŠTENO — u ZASEBNOM pokretanju (obriši editor pa nalepi
-- samo ovo):
--
--   select to_regclass('public.api_usage')                                as t1,
--          to_regclass('public.bug_report_usage')                         as t2,
--          to_regprocedure('public.check_and_bump_api_usage(integer)')    as f1,
--          to_regprocedure('public.check_and_bump_bug_usage(integer)')    as f2;
--
-- Sve četiri popunjene = na mestu je.
--
-- ⚠ NE DODAJ `select public.check_and_bump_api_usage(30)` NA KRAJ OVE SKRIPTE.
-- Iz istog razloga kao u rate-limit.sql: SQL Editor pušta sve kao JEDNU
-- transakciju, funkcija bez prijavljenog korisnika baca NOT_AUTHENTICATED, a
-- ta greška poništi CELU transakciju — pa u bazi ne ostane ništa, dok poruka
-- izgleda kao uspešna provera.
-- =====================================================================

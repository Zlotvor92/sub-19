-- =====================================================================
-- SUB-20 — dnevni limit poziva po korisniku, za /api/wellness i /api/workouts
--
-- ŠTA REŠAVA
-- Ta dva endpointa idu kroz naš Vercel server ka intervals.icu. Prijava je
-- otvorena svakome ko ima Google nalog, a limita nije bilo — dakle jedan
-- prijavljen korisnik je mogao u petlji da gađa intervals.icu SA NAŠE IP
-- ADRESE. Posledice (blokada, žalba) snosi vlasnik aplikacije, ne on.
--
-- KAKO SE PUŠTA
-- Supabase → SQL Editor → nalepi CEO ovaj fajl → Run. Traje sekund.
-- Puštanje dvaput je bezbedno (sve je `if not exists` / `create or replace`).
--
-- ŠTA NE DIRA
-- Postojeće `api_usage` i `bug_report_usage` tabele i njihove funkcije
-- (`check_and_bump_api_usage`, `check_and_bump_bug_usage`) ostaju netaknute.
-- Ovo je NOVA, odvojena tabela — trošenje AI analiza ne sme da utiče na
-- povlačenje podataka sa sata i obrnuto.
--
-- ZAŠTO JEDNA TABELA ZA SVE ENDPOINTE, A NE PO TABELA PO ENDPOINTU
-- Prve dve su napravljene svaka za sebe, pa svaki novi endpoint traži novu
-- tabelu, novu funkciju i novu dozvolu — tri mesta da se pogreši. Ovde je
-- naziv endpointa OBIČNA KOLONA, pa se sledeći endpoint dodaje bez ijedne
-- izmene u bazi: samo se u kodu pozove sa drugim `p_endpoint`.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Tabela
-- ---------------------------------------------------------------------
create table if not exists public.endpoint_usage (
  user_id  uuid    not null references auth.users(id) on delete cascade,
  dan      date    not null,
  endpoint text    not null,
  broj     integer not null default 0,
  primary key (user_id, dan, endpoint)
);

comment on table public.endpoint_usage is
  'Dnevni brojač poziva po korisniku i endpointu. Piše se ISKLJUČIVO kroz check_and_bump_endpoint().';

-- RLS uključen, a namerno BEZ IJEDNE POLITIKE.
-- Bez politike nijedan prijavljen korisnik ne može ni da pročita ni da
-- promeni svoj brojač preko REST API-ja — a to je cela poenta: kad bi mogao
-- da ga smanji, limit ne bi postojao. Upisuje samo funkcija ispod, koja radi
-- kao SECURITY DEFINER (u pravima vlasnika, pa RLS ne važi za nju).
alter table public.endpoint_usage enable row level security;

-- ---------------------------------------------------------------------
-- 2. Funkcija — proveri i uvećaj, atomski
-- ---------------------------------------------------------------------
-- ZAŠTO FUNKCIJA, A NE "pročitaj pa upiši" IZ KODA
-- Dva zahteva koja stignu u istoj milisekundi bi oba pročitala staru vrednost
-- i oba prošla. `insert ... on conflict do update ... returning` je jedna
-- naredba: drugi zahtev čeka na zaključan red i dobija već uvećan broj.
--
-- ZAŠTO SE GREŠKA BACA, A NE VRAĆA false
-- Kad funkcija baci izuzetak, Postgres poništava celu transakciju — dakle i
-- uvećanje koje se upravo desilo. Brojač zato staje tačno na p_limit i ne
-- raste u nedogled dok neko lupa po dugmetu.
create or replace function public.check_and_bump_endpoint(
  p_endpoint text,
  p_limit    integer
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_dan  date := (now() at time zone 'utc')::date;
  v_broj integer;
begin
  -- Bez prijave nema brojanja. `auth.uid()` je null kad se pozove sa anon
  -- ključem bez korisnikovog tokena — to nikad ne sme da prođe kao "0 poziva".
  if v_user is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '28000';
  end if;

  -- Naziv endpointa ulazi u primarni ključ. Bez ovoga bi pozivalac sa
  -- izmišljenim nazivom (npr. slučajan string po pozivu) svaki put dobijao
  -- NOV red sa brojem 1 — limit bi postojao, a ne bi radio.
  if p_endpoint is null or p_endpoint !~ '^[a-z0-9_-]{1,40}$' then
    raise exception 'BAD_ENDPOINT' using errcode = '22023';
  end if;

  if p_limit is null or p_limit < 1 or p_limit > 100000 then
    raise exception 'BAD_LIMIT' using errcode = '22023';
  end if;

  insert into public.endpoint_usage as u (user_id, dan, endpoint, broj)
  values (v_user, v_dan, p_endpoint, 1)
  on conflict (user_id, dan, endpoint)
  do update set broj = u.broj + 1
  returning u.broj into v_broj;

  if v_broj > p_limit then
    raise exception 'DAILY_LIMIT_EXCEEDED' using errcode = 'P0001';
  end if;

  -- Čišćenje starih redova ovog korisnika. Ide OVDE, a ne kao zakazan posao,
  -- da tabela ostane ograničena bez pg_cron-a i bez ijednog podešavanja.
  -- Jeftino je: pogađa prefiks primarnog ključa i briše nekoliko redova.
  delete from public.endpoint_usage
   where user_id = v_user and dan < v_dan - 30;

  return v_broj;
end;
$$;

comment on function public.check_and_bump_endpoint(text, integer) is
  'Uvećava dnevni brojač za (auth.uid(), danas, p_endpoint) i baca DAILY_LIMIT_EXCEEDED kad pređe p_limit.';

-- ---------------------------------------------------------------------
-- 3. Dozvole
-- ---------------------------------------------------------------------
-- Funkciju sme da zove SAMO prijavljen korisnik. `anon` je namerno izostavljen
-- (bez tokena `auth.uid()` je ionako null), a `public` se prvo skida jer
-- Postgres novim funkcijama podrazumevano daje EXECUTE svima.
revoke all on function public.check_and_bump_endpoint(text, integer) from public;
grant execute on function public.check_and_bump_endpoint(text, integer) to authenticated;

-- Nikakav direktan pristup tabeli — ni čitanje. Brojač se ne pokazuje i ne
-- menja spolja; jedini put do njega je funkcija iznad.
revoke all on table public.endpoint_usage from anon, authenticated;

-- =====================================================================
-- PROVERA DA RADI (opciono, u istom SQL Editoru)
--
--   select public.check_and_bump_endpoint('test', 2);   -- 1
--   select public.check_and_bump_endpoint('test', 2);   -- 2
--   select public.check_and_bump_endpoint('test', 2);   -- greška DAILY_LIMIT_EXCEEDED
--
-- U SQL Editoru je `auth.uid()` obično null, pa ćeš dobiti NOT_AUTHENTICATED —
-- to znači da funkcija radi ispravno. Pravu proveru radi aplikacija.
-- Za brisanje probnih redova:
--
--   delete from public.endpoint_usage where endpoint = 'test';
-- =====================================================================
